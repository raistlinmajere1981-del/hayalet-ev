package com.hayaletev.gaiaclient.core

class SnapshotFactory(private val clock: MonoClock) {
    fun create(
        sessionId: String,
        seq: Long,
        accepted: List<CapabilityId>,
        samples: Map<CapabilityId, Sample>
    ): ObservationPacket {
        require(seq >= 1) { "seq must start at 1" }

        val sentMonoMs = clock.elapsedRealtimeMs()
        val packetSamples = accepted
            .distinct()
            .sortedBy { CapabilityCatalog.orderOf(it) }
            .map { id ->
                val stored = samples[id]
                when {
                    stored == null || stored.id != id -> Sample.missing(id)
                    stored.quality != Quality.MISSING &&
                        stored.sampleMonoMs != null &&
                        stored.sampleMonoMs > sentMonoMs -> Sample.missing(id)
                    else -> stored
                }
            }

        return ObservationPacket(
            sessionId = sessionId,
            seq = seq,
            sentMonoMs = sentMonoMs,
            deviceWallMs = clock.wallTimeMs(),
            samples = packetSamples
        )
    }
}
