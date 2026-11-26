package com.hayaletev.gaiaclient.core

import com.hayaletev.gaiaclient.transport.OpenResult
import com.hayaletev.gaiaclient.transport.SendResult
import com.hayaletev.gaiaclient.transport.SessionOpenContext
import com.hayaletev.gaiaclient.transport.TransportAdapter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class EnginePhase { STOPPED, OPENING, SENDING, WAITING, RETRY_WAIT }

enum class SendOutcome { ACCEPTED, RETRYABLE, REJECTED, SESSION_LOST, OPEN_FAILED }

data class EngineState(
    val phase: EnginePhase = EnginePhase.STOPPED,
    val sessionId: String? = null,
    val accepted: List<CapabilityId> = emptyList(),
    val tickCount: Long = 0,
    val lastOutcome: SendOutcome? = null,
    val lastPacket: ObservationPacket? = null
)

interface EngineEvents {
    fun onSessionOpened(sessionId: String, accepted: List<CapabilityId>, floorMonoMs: Long)
    fun onSessionClosed()
    fun onBeforeSnapshot()
    fun onResubscribe(ids: Set<CapabilityId>)
    fun onState(state: EngineState)
}

class CollectionEngine(
    private val scope: CoroutineScope,
    private val transport: TransportAdapter,
    private val store: SampleStore,
    private val snapshotFactory: SnapshotFactory,
    private val clock: MonoClock,
    private val sleeper: Sleeper,
    private val backoff: Backoff,
    private val events: EngineEvents,
    private val installationId: String,
    private val runId: String,
    private val offered: List<CapabilityId>
) {
    private val lock = Any()
    private var job: Job? = null
    private var state = EngineState()
    private var sessionActive = false

    @Volatile
    private var stopped = true

    fun start() {
        val opening: EngineState
        synchronized(lock) {
            if (job?.isActive == true) return
            stopped = false
            sessionActive = false
            opening = EngineState(phase = EnginePhase.OPENING)
            state = opening
            job = scope.launch { runLoop() }
        }
        events.onState(opening)
    }

    fun stop(): Job? {
        val current: Job?
        val wasActive: Boolean
        val stoppedState: EngineState
        synchronized(lock) {
            if (stopped && job == null) return null
            stopped = true
            current = job
            job = null
            wasActive = sessionActive
            sessionActive = false
            stoppedState = state.copy(
                phase = EnginePhase.STOPPED,
                sessionId = null,
                accepted = emptyList(),
                lastPacket = null
            )
            state = stoppedState
        }

        current?.cancel()
        transport.close()
        store.endSession()
        if (wasActive) events.onSessionClosed()
        events.onState(stoppedState)
        return current
    }

    fun state(): EngineState = synchronized(lock) { state }

    private suspend fun runLoop() {
        while (currentCoroutineContext().isActive && !stopped) {
            publish(
                EngineState(
                    phase = EnginePhase.OPENING,
                    lastOutcome = currentOutcome()
                )
            )

            val openResult = try {
                transport.open(SessionOpenContext(installationId, runId, offered))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                OpenResult.Failed(failure.message ?: "open-exception")
            }

            if (!currentCoroutineContext().isActive || stopped) return

            when (openResult) {
                is OpenResult.Opened -> {
                    val accepted = openResult.accepted.toList()
                    val floorMonoMs = clock.elapsedRealtimeMs()
                    store.beginSession(accepted.toSet(), floorMonoMs)
                    synchronized(lock) { sessionActive = true }
                    events.onSessionOpened(openResult.sessionId, accepted, floorMonoMs)
                    publish(
                        EngineState(
                            phase = EnginePhase.WAITING,
                            sessionId = openResult.sessionId,
                            accepted = accepted,
                            lastOutcome = currentOutcome()
                        )
                    )
                    runSession(openResult, accepted)
                }

                is OpenResult.Failed -> {
                    transport.close()
                    publish(
                        EngineState(
                            phase = EnginePhase.RETRY_WAIT,
                            lastOutcome = SendOutcome.OPEN_FAILED
                        )
                    )
                    sleeper.sleep(backoff.nextDelayMs())
                }
            }
        }
    }

    private suspend fun runSession(opened: OpenResult.Opened, accepted: List<CapabilityId>) {
        var seq = 1L
        var tickCount = 0L
        var pending: ObservationPacket? = null

        while (currentCoroutineContext().isActive && !stopped) {
            val packet = pending ?: buildPacket(opened.sessionId, seq, accepted)
            pending = packet
            publish(
                EngineState(
                    phase = EnginePhase.SENDING,
                    sessionId = opened.sessionId,
                    accepted = accepted,
                    tickCount = tickCount,
                    lastOutcome = currentOutcome(),
                    lastPacket = packet
                )
            )

            val result = try {
                transport.send(packet)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                SendResult.Retryable(failure.message ?: "send-exception")
            }

            if (!currentCoroutineContext().isActive || stopped) return

            val resubscribe = store.consumeResubscribeRequests()
            if (resubscribe.isNotEmpty()) events.onResubscribe(resubscribe)

            when (result) {
                is SendResult.Accepted -> {
                    if (result.sessionId != opened.sessionId || result.seq != packet.seq) {
                        endSession(SendOutcome.SESSION_LOST)
                        return
                    }
                    store.recordSent(packet)
                    val afterAck = store.consumeResubscribeRequests()
                    if (afterAck.isNotEmpty()) events.onResubscribe(afterAck)
                    tickCount += 1
                    backoff.reset()
                    pending = null
                    publish(
                        EngineState(
                            phase = EnginePhase.WAITING,
                            sessionId = opened.sessionId,
                            accepted = accepted,
                            tickCount = tickCount,
                            lastOutcome = SendOutcome.ACCEPTED,
                            lastPacket = packet
                        )
                    )
                    seq = packet.seq + 1
                    sleeper.sleep(opened.intervalMs.coerceAtLeast(1))
                }

                is SendResult.Retryable -> {
                    publish(
                        EngineState(
                            phase = EnginePhase.RETRY_WAIT,
                            sessionId = opened.sessionId,
                            accepted = accepted,
                            tickCount = tickCount,
                            lastOutcome = SendOutcome.RETRYABLE,
                            lastPacket = packet
                        )
                    )
                    sleeper.sleep(backoff.nextDelayMs())
                }

                is SendResult.Rejected -> {
                    // B5 fake rejection is retryable by design. B6 maps a
                    // terminal 403 to its own result instead of this path.
                    endSession(SendOutcome.REJECTED)
                    return
                }

                is SendResult.SessionLost -> {
                    endSession(SendOutcome.SESSION_LOST)
                    return
                }
            }
        }
    }

    private fun buildPacket(
        sessionId: String,
        seq: Long,
        accepted: List<CapabilityId>
    ): ObservationPacket {
        events.onBeforeSnapshot()
        return snapshotFactory.create(sessionId, seq, accepted, store.snapshot())
    }

    private fun endSession(outcome: SendOutcome) {
        transport.close()
        store.endSession()
        synchronized(lock) { sessionActive = false }
        events.onSessionClosed()
        publish(
            EngineState(
                phase = EnginePhase.OPENING,
                lastOutcome = outcome
            )
        )
    }

    private fun publish(next: EngineState) {
        synchronized(lock) {
            if (stopped && next.phase != EnginePhase.STOPPED) return
            state = next
        }
        events.onState(next)
    }

    private fun currentOutcome(): SendOutcome? = synchronized(lock) { state.lastOutcome }
}
