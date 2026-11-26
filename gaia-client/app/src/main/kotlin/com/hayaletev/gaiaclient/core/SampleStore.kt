package com.hayaletev.gaiaclient.core

interface SampleStore {
    fun beginSession(accepted: Set<CapabilityId>, floorMonoMs: Long)
    fun endSession()
    fun snapshot(): Map<CapabilityId, Sample>
    fun recordSent(packet: ObservationPacket)
    fun consumeResubscribeRequests(): Set<CapabilityId>
}
