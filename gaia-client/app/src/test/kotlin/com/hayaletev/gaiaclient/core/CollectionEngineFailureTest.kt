package com.hayaletev.gaiaclient.core

import com.hayaletev.gaiaclient.support.FixedClock
import com.hayaletev.gaiaclient.support.ManualSleeper
import com.hayaletev.gaiaclient.support.RecordingEngineEvents
import com.hayaletev.gaiaclient.support.RecordingSampleStore
import com.hayaletev.gaiaclient.support.ScriptedTransport
import com.hayaletev.gaiaclient.support.SequenceBackoff
import com.hayaletev.gaiaclient.transport.OpenResult
import com.hayaletev.gaiaclient.transport.SendResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CollectionEngineFailureTest {
    private data class Harness(
        val transport: ScriptedTransport,
        val store: RecordingSampleStore,
        val events: RecordingEngineEvents,
        val sleeper: ManualSleeper,
        val backoff: SequenceBackoff,
        val engine: CollectionEngine,
        val scope: CoroutineScope
    ) {
        suspend fun close() {
            engine.stop()?.join()
            scope.cancel()
        }
    }

    private fun harness(vararg backoffDelays: Long): Harness {
        val transport = ScriptedTransport()
        val store = RecordingSampleStore()
        val events = RecordingEngineEvents()
        val sleeper = ManualSleeper()
        val backoff = SequenceBackoff(*backoffDelays)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val clock = FixedClock()
        val engine = CollectionEngine(
            scope = scope,
            transport = transport,
            store = store,
            snapshotFactory = SnapshotFactory(clock),
            clock = clock,
            sleeper = sleeper,
            backoff = backoff,
            events = events,
            installationId = "installation-1",
            runId = "run-1",
            offered = listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL)
        )
        store.snapshotMap = mapOf(
            CapabilityId.BATTERY_LEVEL to Sample.valid(
                CapabilityId.BATTERY_LEVEL,
                SampleValue.Integer(83),
                1_000
            ),
            CapabilityId.SIGNAL to Sample.valid(
                CapabilityId.SIGNAL,
                SampleValue.Integer(-67),
                1_000
            )
        )
        return Harness(transport, store, events, sleeper, backoff, engine, scope)
    }

    private suspend fun Harness.openFirstSession(
        sessionId: String = "session-1",
        accepted: List<CapabilityId> = listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL)
    ): ObservationPacket {
        engine.start()
        withTimeout(5_000) { transport.nextOpenContext() }
        transport.respondOpen(OpenResult.Opened(sessionId, accepted, 10_000))
        withTimeout(5_000) { events.awaitOpened() }
        return withTimeout(5_000) { transport.nextSend() }
    }

    @Test
    fun retryableReusesTheFrozenPacketAndAcceptedResetsBackoff() = runBlocking {
        val h = harness(500, 1_000)
        try {
            val first = h.openFirstSession()
            h.transport.respondSend(SendResult.Retryable("busy"))

            assertEquals(500L, withTimeout(5_000) { h.sleeper.nextDelay() })
            val retryState = withTimeout(5_000) {
                h.events.awaitState {
                    it.phase == EnginePhase.RETRY_WAIT && it.lastOutcome == SendOutcome.RETRYABLE
                }
            }
            assertEquals(first, retryState.lastPacket)

            h.sleeper.releaseNext()
            val retried = withTimeout(5_000) { h.transport.nextSend() }
            assertEquals(first, retried)
            assertEquals(first.sentMonoMs, retried.sentMonoMs)
            assertEquals(first.samples, retried.samples)

            h.transport.respondSend(SendResult.Accepted("session-1", first.seq))
            assertEquals(10_000L, withTimeout(5_000) { h.sleeper.nextDelay() })
            withTimeout(5_000) {
                h.events.awaitState {
                    it.phase == EnginePhase.WAITING && it.lastOutcome == SendOutcome.ACCEPTED
                }
            }
            assertEquals(1, h.backoff.resetCount())

            h.sleeper.releaseNext()
            val second = withTimeout(5_000) { h.transport.nextSend() }
            assertEquals(2L, second.seq)
        } finally {
            h.close()
        }
    }

    @Test
    fun failedOpenClosesAndRetriesAfterBackoff() = runBlocking {
        val h = harness(700)
        try {
            h.engine.start()
            val firstContext = withTimeout(5_000) { h.transport.nextOpenContext() }
            h.transport.respondOpen(OpenResult.Failed("no-network"))

            assertEquals(700L, withTimeout(5_000) { h.sleeper.nextDelay() })
            withTimeout(5_000) {
                h.events.awaitState {
                    it.phase == EnginePhase.RETRY_WAIT &&
                        it.lastOutcome == SendOutcome.OPEN_FAILED
                }
            }
            assertEquals(1, h.transport.closeCount.get())

            h.sleeper.releaseNext()
            val secondContext = withTimeout(5_000) { h.transport.nextOpenContext() }
            assertEquals(firstContext, secondContext)

            h.transport.respondOpen(
                OpenResult.Opened(
                    "session-1",
                    listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                    10_000
                )
            )
            assertEquals("session-1", withTimeout(5_000) { h.events.awaitOpened() }.sessionId)
        } finally {
            h.close()
        }
    }

    @Test
    fun sessionLostClosesAndReopensImmediately() = runBlocking {
        assertImmediateReopen(SendResult.SessionLost("expired"))
    }

    @Test
    fun rejectedClosesAndReopensImmediately() = runBlocking {
        assertImmediateReopen(SendResult.Rejected("rejected"))
    }

    private suspend fun assertImmediateReopen(result: SendResult) {
        val h = harness(500)
        try {
            val first = h.openFirstSession("session-1")
            h.transport.respondSend(result)

            withTimeout(5_000) { h.transport.nextOpenContext() }
            assertEquals(1, h.transport.closeCount.get())
            assertEquals(1, h.store.endCount())
            assertEquals(1, h.events.closedCount())
            assertNull(withTimeoutOrNull(200) { h.sleeper.nextDelay() })

            h.transport.respondOpen(
                OpenResult.Opened(
                    "session-2",
                    listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                    10_000
                )
            )
            val opened = withTimeout(5_000) { h.events.awaitOpened() }
            assertEquals("session-2", opened.sessionId)
            assertEquals(2, h.store.beginCallsCopy().size)
            assertEquals(
                setOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                h.store.beginCallsCopy().last().accepted
            )

            val second = withTimeout(5_000) { h.transport.nextSend() }
            assertEquals("session-2", second.sessionId)
            assertEquals(1L, second.seq)
            assertTrue(second.seq != first.seq || second.sessionId != first.sessionId)
        } finally {
            h.close()
        }
    }

    @Test
    fun acceptedWithWrongSessionIsSessionLoss() = runBlocking {
        assertWrongAck(SendResult.Accepted("session-other", 1))
    }

    @Test
    fun acceptedWithWrongSeqIsSessionLoss() = runBlocking {
        assertWrongAck(SendResult.Accepted("session-1", 2))
    }

    private suspend fun assertWrongAck(result: SendResult.Accepted) {
        val h = harness(500)
        try {
            val first = h.openFirstSession("session-1")
            h.transport.respondSend(result)

            withTimeout(5_000) { h.transport.nextOpenContext() }
            assertEquals(1, h.transport.closeCount.get())
            assertEquals(1, h.store.endCount())
            assertEquals(1, h.events.closedCount())
            assertTrue(h.store.sentPacketsCopy().isEmpty())

            h.transport.respondOpen(
                OpenResult.Opened(
                    "session-2",
                    listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                    10_000
                )
            )
            assertEquals("session-2", withTimeout(5_000) { h.events.awaitOpened() }.sessionId)
            val second = withTimeout(5_000) { h.transport.nextSend() }
            assertEquals("session-2", second.sessionId)
            assertEquals(1L, second.seq)
            assertTrue(second.sessionId != first.sessionId)
        } finally {
            h.close()
        }
    }

    @Test
    fun stopWhileOpenIsSuspendedCancelsAndIgnoresLateOpen() = runBlocking {
        val h = harness()
        try {
            h.engine.start()
            withTimeout(5_000) { h.transport.nextOpenContext() }

            h.engine.stop()?.join()
            assertEquals(EnginePhase.STOPPED, h.engine.state().phase)
            assertEquals(1, h.transport.closeCount.get())
            assertEquals(1, h.store.endCount())
            assertTrue(h.events.openedCopy().isEmpty())

            h.transport.respondOpen(
                OpenResult.Opened(
                    "late-session",
                    listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                    10_000
                )
            )
            delay(100)
            assertEquals(EnginePhase.STOPPED, h.engine.state().phase)
            assertNull(h.events.tryOpened())
            assertNull(h.transport.tryNextSend())
            assertTrue(h.store.beginCallsCopy().isEmpty())
        } finally {
            h.close()
        }
    }

    @Test
    fun stopWhileSendIsSuspendedCancelsAndIgnoresLateSend() = runBlocking {
        val h = harness()
        try {
            val first = h.openFirstSession()
            h.engine.stop()?.join()

            assertEquals(EnginePhase.STOPPED, h.engine.state().phase)
            assertEquals(1, h.transport.closeCount.get())
            assertEquals(1, h.store.endCount())
            assertEquals(1, h.events.closedCount())
            assertTrue(h.store.sentPacketsCopy().isEmpty())

            h.transport.respondSend(SendResult.Accepted("session-1", first.seq))
            delay(100)
            assertEquals(EnginePhase.STOPPED, h.engine.state().phase)
            assertTrue(h.store.sentPacketsCopy().isEmpty())
            assertNull(h.transport.tryNextSend())
        } finally {
            h.close()
        }
    }

    @Test
    fun slowSendDoesNotCatchUp() = runBlocking {
        val h = harness()
        try {
            val first = h.openFirstSession()
            delay(100)
            h.transport.respondSend(SendResult.Accepted("session-1", first.seq))

            assertEquals(10_000L, withTimeout(5_000) { h.sleeper.nextDelay() })
            assertNull(h.transport.tryNextSend())

            h.sleeper.releaseNext()
            val second = withTimeout(5_000) { h.transport.nextSend() }
            assertEquals(2L, second.seq)
        } finally {
            h.close()
        }
    }

    @Test
    fun resubscribeRequestsReachTheEngineEvents() = runBlocking {
        val h = harness()
        try {
            val first = h.openFirstSession()
            h.store.requestResubscribe(setOf(CapabilityId.BATTERY_LEVEL))
            h.transport.respondSend(SendResult.Accepted("session-1", first.seq))

            assertEquals(
                setOf(CapabilityId.BATTERY_LEVEL),
                withTimeout(5_000) { h.events.awaitResubscribe() }
            )
            assertTrue(h.store.consumeResubscribeRequests().isEmpty())
        } finally {
            h.close()
        }
    }

    @Test
    fun stopIsIdempotentAndSecondStartDoesNotOpenTwice() = runBlocking {
        val h = harness()
        try {
            h.engine.start()
            withTimeout(5_000) { h.transport.nextOpenContext() }
            h.engine.start()
            delay(100)
            assertNull(h.transport.tryNextOpenContext())

            h.transport.respondOpen(
                OpenResult.Opened(
                    "session-1",
                    listOf(CapabilityId.BATTERY_LEVEL, CapabilityId.SIGNAL),
                    10_000
                )
            )
            withTimeout(5_000) { h.events.awaitOpened() }
            withTimeout(5_000) { h.transport.nextSend() }

            h.engine.stop()?.join()
            val closeAfterFirstStop = h.transport.closeCount.get()
            assertNull(h.engine.stop())
            assertEquals(closeAfterFirstStop, h.transport.closeCount.get())
        } finally {
            h.close()
        }
    }
}
