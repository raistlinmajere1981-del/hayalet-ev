package com.hayaletev.gaiaclient.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SampleMemoryTest {
    private fun packet(seq: Long, sample: Sample): ObservationPacket =
        ObservationPacket(
            sessionId = "00000000-0000-4000-8000-000000000001",
            seq = seq,
            sentMonoMs = sample.sampleMonoMs ?: 0,
            deviceWallMs = 1_700_000_000_000,
            samples = listOf(sample)
        )

    @Test
    fun beginSessionClearsOldStateAndEndSessionRejectsOffers() {
        val memory = SampleMemory()
        memory.beginSession(setOf(CapabilityId.BATTERY_LEVEL), 100)
        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(50), 101))
        assertEquals(1, memory.snapshot().size)

        memory.beginSession(setOf(CapabilityId.SIGNAL), 200)
        assertTrue(memory.snapshot().isEmpty())

        memory.offer(Sample.valid(CapabilityId.SIGNAL, SampleValue.Integer(-60), 201))
        assertEquals(1, memory.snapshot().size)

        memory.endSession()
        memory.offer(Sample.valid(CapabilityId.SIGNAL, SampleValue.Integer(-50), 202))
        assertTrue(memory.snapshot().isEmpty())
    }

    @Test
    fun onlyAcceptedCapabilitiesAreStoredAndOverwritesStayBounded() {
        val memory = SampleMemory()
        memory.beginSession(CapabilityCatalog.ids.toSet(), 0)

        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(10), 1))
        memory.offer(Sample.valid(CapabilityId.SIGNAL, SampleValue.Integer(-60), 1))
        memory.offer(Sample.valid(CapabilityId.SIGNAL, SampleValue.Integer(-61), 2))
        memory.offer(Sample.valid(CapabilityId.PROXIMITY, SampleValue.Text("near"), 1))

        val snapshot = memory.snapshot()
        assertEquals(3, snapshot.size)
        assertEquals(SampleValue.Integer(-61), snapshot[CapabilityId.SIGNAL]?.value)
        assertTrue(snapshot.size <= 8)
    }

    @Test
    fun evidenceFloorRejectsOldSamples() {
        val memory = SampleMemory()
        memory.beginSession(setOf(CapabilityId.BATTERY_LEVEL), 1_000)

        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(50), 1_000))
        assertNull(memory.snapshot()[CapabilityId.BATTERY_LEVEL])

        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(51), 1_001))
        assertEquals(
            SampleValue.Integer(51),
            memory.snapshot()[CapabilityId.BATTERY_LEVEL]?.value
        )
    }

    @Test
    fun missingOfferReplacesPreviousValue() {
        val memory = SampleMemory()
        memory.beginSession(setOf(CapabilityId.BATTERY_LEVEL), 0)
        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(50), 1))
        memory.offer(Sample.missing(CapabilityId.BATTERY_LEVEL))

        val stored = memory.snapshot()[CapabilityId.BATTERY_LEVEL]
        assertEquals(Quality.MISSING, stored?.quality)
        assertNull(stored?.value)
        assertNull(stored?.sampleMonoMs)
    }

    @Test
    fun sentWatermarkRejectsRegressedAndConflictingTimes() {
        val memory = SampleMemory()
        memory.beginSession(setOf(CapabilityId.BATTERY_LEVEL), 0)
        memory.recordSent(
            packet(
                1,
                Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(83), 1_000)
            )
        )

        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(84), 999))
        assertEquals(Quality.MISSING, memory.snapshot()[CapabilityId.BATTERY_LEVEL]?.quality)
        assertEquals(setOf(CapabilityId.BATTERY_LEVEL), memory.consumeResubscribeRequests())

        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(84), 1_000))
        assertEquals(Quality.MISSING, memory.snapshot()[CapabilityId.BATTERY_LEVEL]?.quality)
        assertEquals(setOf(CapabilityId.BATTERY_LEVEL), memory.consumeResubscribeRequests())

        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(83), 1_000))
        assertEquals(
            SampleValue.Integer(83),
            memory.snapshot()[CapabilityId.BATTERY_LEVEL]?.value
        )
        assertTrue(memory.consumeResubscribeRequests().isEmpty())

        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(84), 1_001))
        assertEquals(
            SampleValue.Integer(84),
            memory.snapshot()[CapabilityId.BATTERY_LEVEL]?.value
        )
        assertTrue(memory.consumeResubscribeRequests().isEmpty())
    }

    @Test
    fun watermarkSurvivesInterveningMissingSample() {
        val memory = SampleMemory()
        memory.beginSession(setOf(CapabilityId.BATTERY_LEVEL), 0)
        memory.recordSent(
            packet(
                1,
                Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(83), 1_000)
            )
        )

        memory.offer(Sample.missing(CapabilityId.BATTERY_LEVEL))
        assertEquals(Quality.MISSING, memory.snapshot()[CapabilityId.BATTERY_LEVEL]?.quality)

        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(82), 999))
        assertEquals(Quality.MISSING, memory.snapshot()[CapabilityId.BATTERY_LEVEL]?.quality)
        assertEquals(setOf(CapabilityId.BATTERY_LEVEL), memory.consumeResubscribeRequests())
    }

    @Test
    fun resubscribeRequestsAreReturnedOnceAndCleared() {
        val memory = SampleMemory()
        memory.beginSession(setOf(CapabilityId.BATTERY_LEVEL), 0)
        memory.recordSent(
            packet(
                1,
                Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(83), 1_000)
            )
        )
        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(82), 999))

        assertEquals(setOf(CapabilityId.BATTERY_LEVEL), memory.consumeResubscribeRequests())
        assertTrue(memory.consumeResubscribeRequests().isEmpty())
    }

    @Test
    fun snapshotIsACopy() {
        val memory = SampleMemory()
        memory.beginSession(setOf(CapabilityId.BATTERY_LEVEL), 0)
        memory.offer(Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(50), 1))

        val snapshot = memory.snapshot()
        snapshot.toMutableMap().clear()
        assertEquals(1, memory.snapshot().size)
        assertFalse(memory.snapshot().isEmpty())
    }

    @Test
    fun lateOlderCallbackDoesNotReplaceLatestUnsentEvidence() {
        val memory = SampleMemory()
        val id = CapabilityId.ACCELEROMETER
        memory.beginSession(setOf(id), 100)
        val newest = Sample.valid(id, SampleValue.Vector3(1.0, 2.0, 3.0), 200)
        memory.offer(newest)
        memory.offer(Sample.valid(id, SampleValue.Vector3(4.0, 5.0, 6.0), 199))
        assertEquals(newest, memory.snapshot()[id])
    }

    @Test
    fun ackReconcilesAConflictingCallbackReceivedWhilePacketWasInFlight() {
        val memory = SampleMemory()
        val id = CapabilityId.ACCELEROMETER
        memory.beginSession(setOf(id), 100)
        val frozen = Sample.valid(id, SampleValue.Vector3(1.0, 2.0, 3.0), 200)
        memory.offer(frozen)
        val inFlight = packet(1, frozen)
        memory.offer(Sample.valid(id, SampleValue.Vector3(4.0, 5.0, 6.0), 200))
        memory.recordSent(inFlight)
        assertEquals(Quality.MISSING, memory.snapshot()[id]?.quality)
        assertEquals(setOf(id), memory.consumeResubscribeRequests())
    }

    @Test
    fun olderThanAckCannotEraseNewerUnsentEvidence() {
        val memory = SampleMemory()
        val id = CapabilityId.ACCELEROMETER
        memory.beginSession(setOf(id), 100)
        val previous = Sample.valid(id, SampleValue.Vector3(1.0, 2.0, 3.0), 200)
        memory.offer(previous)
        memory.recordSent(packet(1, previous))
        val newest = Sample.valid(id, SampleValue.Vector3(4.0, 5.0, 6.0), 300)
        memory.offer(newest)
        memory.offer(Sample.valid(id, SampleValue.Vector3(7.0, 8.0, 9.0), 199))
        assertEquals(newest, memory.snapshot()[id])
        assertTrue(memory.consumeResubscribeRequests().isEmpty())
    }

    @Test
    fun sameMillisecondBeforeFirstPacketUsesLastValue() {
        val memory = SampleMemory()
        val id = CapabilityId.ACCELEROMETER
        memory.beginSession(setOf(id), 100)
        memory.offer(Sample.valid(id, SampleValue.Vector3(1.0, 2.0, 3.0), 200))
        val newest = Sample.valid(id, SampleValue.Vector3(4.0, 5.0, 6.0), 200)
        memory.offer(newest)
        assertEquals(newest, memory.snapshot()[id])
        assertTrue(memory.consumeResubscribeRequests().isEmpty())
    }
}
