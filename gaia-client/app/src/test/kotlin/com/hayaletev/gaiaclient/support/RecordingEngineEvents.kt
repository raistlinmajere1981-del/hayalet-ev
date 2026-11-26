package com.hayaletev.gaiaclient.support

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.EngineEvents
import com.hayaletev.gaiaclient.core.EngineState
import kotlinx.coroutines.channels.Channel

data class OpenedEvent(
    val sessionId: String,
    val accepted: List<CapabilityId>,
    val floorMonoMs: Long
)

class RecordingEngineEvents(
    private val onEvent: (String) -> Unit = {}
) : EngineEvents {
    private val lock = Any()
    private val opened = mutableListOf<OpenedEvent>()
    private val states = mutableListOf<EngineState>()
    private val resubscribes = mutableListOf<Set<CapabilityId>>()

    private var closedCount = 0
    private var beforeSnapshotCount = 0

    private val openedChannel = Channel<OpenedEvent>(Channel.UNLIMITED)
    private val stateChannel = Channel<EngineState>(Channel.UNLIMITED)
    private val closedChannel = Channel<Unit>(Channel.UNLIMITED)
    private val beforeSnapshotChannel = Channel<Unit>(Channel.UNLIMITED)
    private val resubscribeChannel = Channel<Set<CapabilityId>>(Channel.UNLIMITED)

    override fun onSessionOpened(
        sessionId: String,
        accepted: List<CapabilityId>,
        floorMonoMs: Long
    ) {
        onEvent("opened")
        val event = OpenedEvent(sessionId, accepted.toList(), floorMonoMs)
        synchronized(lock) { opened += event }
        openedChannel.trySend(event)
    }

    override fun onSessionClosed() {
        onEvent("closed")
        synchronized(lock) { closedCount += 1 }
        closedChannel.trySend(Unit)
    }

    override fun onBeforeSnapshot() {
        onEvent("beforeSnapshot")
        synchronized(lock) { beforeSnapshotCount += 1 }
        beforeSnapshotChannel.trySend(Unit)
    }

    override fun onResubscribe(ids: Set<CapabilityId>) {
        onEvent("resubscribe")
        val copy = ids.toSet()
        synchronized(lock) { resubscribes += copy }
        resubscribeChannel.trySend(copy)
    }

    override fun onState(state: EngineState) {
        synchronized(lock) { states += state }
        stateChannel.trySend(state)
    }

    suspend fun awaitOpened(): OpenedEvent = openedChannel.receive()

    fun tryOpened(): OpenedEvent? = openedChannel.tryReceive().getOrNull()

    suspend fun awaitClosed() {
        closedChannel.receive()
    }

    suspend fun awaitBeforeSnapshot() {
        beforeSnapshotChannel.receive()
    }

    suspend fun awaitResubscribe(): Set<CapabilityId> = resubscribeChannel.receive()

    suspend fun awaitState(predicate: (EngineState) -> Boolean): EngineState {
        while (true) {
            val state = stateChannel.receive()
            if (predicate(state)) return state
        }
    }

    fun openedCopy(): List<OpenedEvent> = synchronized(lock) { opened.toList() }

    fun statesCopy(): List<EngineState> = synchronized(lock) { states.toList() }

    fun resubscribesCopy(): List<Set<CapabilityId>> = synchronized(lock) { resubscribes.toList() }

    fun closedCount(): Int = synchronized(lock) { closedCount }

    fun beforeSnapshotCount(): Int = synchronized(lock) { beforeSnapshotCount }
}
