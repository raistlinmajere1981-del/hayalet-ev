package com.hayaletev.gaiaclient.support

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.ObservationPacket
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleStore

data class BeginCall(val accepted: Set<CapabilityId>, val floorMonoMs: Long)

class RecordingSampleStore(
    private val onEvent: (String) -> Unit = {}
) : SampleStore {
    private val lock = Any()
    private val beginCalls = mutableListOf<BeginCall>()
    private val sentPackets = mutableListOf<ObservationPacket>()
    private val resubscribe = LinkedHashSet<CapabilityId>()

    private var endCount = 0
    private var snapshotCalls = 0

    @Volatile
    var snapshotMap: Map<CapabilityId, Sample> = emptyMap()

    override fun beginSession(accepted: Set<CapabilityId>, floorMonoMs: Long) {
        synchronized(lock) {
            beginCalls += BeginCall(accepted.toSet(), floorMonoMs)
        }
    }

    override fun endSession() {
        synchronized(lock) {
            endCount += 1
        }
    }

    override fun snapshot(): Map<CapabilityId, Sample> {
        synchronized(lock) {
            snapshotCalls += 1
        }
        onEvent("snapshot")
        return snapshotMap
    }

    override fun recordSent(packet: ObservationPacket) {
        synchronized(lock) {
            sentPackets += packet
        }
    }

    override fun consumeResubscribeRequests(): Set<CapabilityId> = synchronized(lock) {
        val requested = LinkedHashSet(resubscribe)
        resubscribe.clear()
        requested
    }

    fun requestResubscribe(ids: Set<CapabilityId>) {
        synchronized(lock) {
            resubscribe += ids
        }
    }

    fun beginCallsCopy(): List<BeginCall> = synchronized(lock) { beginCalls.toList() }

    fun sentPacketsCopy(): List<ObservationPacket> = synchronized(lock) { sentPackets.toList() }

    fun endCount(): Int = synchronized(lock) { endCount }

    fun snapshotCalls(): Int = synchronized(lock) { snapshotCalls }
}
