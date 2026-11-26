package com.hayaletev.gaiaclient.core

class SampleMemory : SampleStore {
    private val lock = Any()
    private val samples = LinkedHashMap<CapabilityId, Sample>()
    private val lastSent = LinkedHashMap<CapabilityId, Sample>()
    private val resubscribe = LinkedHashSet<CapabilityId>()

    private var accepted: Set<CapabilityId> = emptySet()
    private var floorMonoMs: Long = 0
    private var accepting: Boolean = false

    fun offer(sample: Sample) {
        synchronized(lock) {
            if (!accepting || sample.id !in accepted) return

            val sampleMonoMs = sample.sampleMonoMs
            if (sampleMonoMs != null && sampleMonoMs <= floorMonoMs) return

            // Ignore a late event if a strictly newer observation is already
            // held. A delayed callback cannot erase newer evidence merely
            // because it also falls behind the last acknowledged watermark.
            val currentMonoMs = samples[sample.id]?.sampleMonoMs
            if (sampleMonoMs != null && currentMonoMs != null && sampleMonoMs < currentMonoMs) return

            val sent = lastSent[sample.id]
            if (sent != null && sampleMonoMs != null) {
                val sentMonoMs = sent.sampleMonoMs
                if (sentMonoMs != null && sampleMonoMs <= sentMonoMs) {
                    val sameEvidence = sampleMonoMs == sentMonoMs && sameValue(sample, sent)
                    if (!sameEvidence) {
                        invalidate(sample.id)
                        return
                    }
                }
            }

            // Before acknowledgement, the last callback within one millisecond
            // wins. recordSent reconciles a frozen packet with later callbacks.
            samples[sample.id] = sample
            if (sample.quality != Quality.MISSING) {
                resubscribe.remove(sample.id)
            }
        }
    }

    override fun beginSession(accepted: Set<CapabilityId>, floorMonoMs: Long) {
        require(floorMonoMs >= 0) { "evidence floor must be non-negative" }
        synchronized(lock) {
            this.accepted = accepted.toSet()
            this.floorMonoMs = floorMonoMs
            accepting = true
            samples.clear()
            lastSent.clear()
            resubscribe.clear()
        }
    }

    override fun endSession() {
        synchronized(lock) {
            accepting = false
            accepted = emptySet()
            floorMonoMs = 0
            samples.clear()
            lastSent.clear()
            resubscribe.clear()
        }
    }

    override fun snapshot(): Map<CapabilityId, Sample> = synchronized(lock) {
        LinkedHashMap(samples)
    }

    override fun recordSent(packet: ObservationPacket) {
        synchronized(lock) {
            for (sample in packet.samples) {
                if (sample.quality == Quality.MISSING || sample.sampleMonoMs == null) continue
                lastSent[sample.id] = sample
                reconcileAfterSent(sample)
            }
        }
    }

    /**
     * The packet was built before the ACK. Any callback that arrived while it
     * was in flight must be judged against the accepted evidence, not left as
     * if it had been observed after the ACK.
     */
    private fun reconcileAfterSent(sent: Sample) {
        val current = samples[sent.id] ?: return
        val currentMonoMs = current.sampleMonoMs ?: return
        val sentMonoMs = sent.sampleMonoMs ?: return
        if (currentMonoMs < sentMonoMs) {
            invalidate(sent.id)
        } else if (currentMonoMs == sentMonoMs && !sameValue(current, sent)) {
            invalidate(sent.id)
        }
    }

    private fun invalidate(id: CapabilityId) {
        samples[id] = Sample.missing(id)
        resubscribe.add(id)
    }

    override fun consumeResubscribeRequests(): Set<CapabilityId> = synchronized(lock) {
        val requested = LinkedHashSet(resubscribe)
        resubscribe.clear()
        requested
    }

    private fun sameValue(left: Sample, right: Sample): Boolean =
        left.quality == right.quality && left.value == right.value
}
