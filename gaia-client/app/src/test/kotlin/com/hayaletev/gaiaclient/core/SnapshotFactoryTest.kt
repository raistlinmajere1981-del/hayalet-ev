package com.hayaletev.gaiaclient.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SnapshotFactoryTest {
    private class FakeClock(
        var elapsedRealtimeMs: Long = 5_000,
        var wallTimeMs: Long = 1_700_000_000_000
    ) : MonoClock {
        override fun elapsedRealtimeMs(): Long = elapsedRealtimeMs
        override fun wallTimeMs(): Long = wallTimeMs
    }

    private val clock = FakeClock()
    private val factory = SnapshotFactory(clock)

    @Test
    fun fillsAcceptedInCatalogOrderAndOmitsUnaccepted() {
        val samples = mapOf(
            CapabilityId.SIGNAL to Sample.valid(CapabilityId.SIGNAL, SampleValue.Integer(-70), 4_000),
            CapabilityId.BATTERY_LEVEL to Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(0), 1_000),
            CapabilityId.NETWORK to Sample.valid(
                CapabilityId.NETWORK,
                SampleValue.Network(NetworkTransport.NONE, false, false),
                2_000
            ),
            CapabilityId.ACCELEROMETER to Sample.valid(
                CapabilityId.ACCELEROMETER,
                SampleValue.Vector3(0.0, 0.0, 0.0),
                3_000
            ),
            CapabilityId.BATTERY_VOLTAGE to Sample.valid(
                CapabilityId.BATTERY_VOLTAGE,
                SampleValue.Integer(4_200),
                1_000
            )
        )
        val accepted = listOf(
            CapabilityId.SIGNAL,
            CapabilityId.BATTERY_LEVEL,
            CapabilityId.NETWORK,
            CapabilityId.ACCELEROMETER,
            CapabilityId.PROXIMITY
        )

        val packet = factory.create("session-1", 7, accepted, samples)

        assertEquals(
            listOf(
                CapabilityId.BATTERY_LEVEL,
                CapabilityId.ACCELEROMETER,
                CapabilityId.PROXIMITY,
                CapabilityId.NETWORK,
                CapabilityId.SIGNAL
            ),
            packet.samples.map { it.id }
        )
        assertEquals(SampleValue.Integer(0), packet.samples[0].value)
        assertEquals(SampleValue.Vector3(0.0, 0.0, 0.0), packet.samples[1].value)
        assertEquals(Quality.MISSING, packet.samples[2].quality)
        assertEquals(
            SampleValue.Network(NetworkTransport.NONE, false, false),
            packet.samples[3].value
        )
        assertEquals(SampleValue.Integer(-70), packet.samples[4].value)
        assertTrue(packet.samples.none { it.id == CapabilityId.BATTERY_VOLTAGE })
    }

    @Test
    fun preservesOriginalTimesAndFreezesPacketTimes() {
        val packet = factory.create(
            "session-1",
            1,
            listOf(CapabilityId.BATTERY_LEVEL),
            mapOf(
                CapabilityId.BATTERY_LEVEL to Sample.valid(
                    CapabilityId.BATTERY_LEVEL,
                    SampleValue.Integer(42),
                    1_234
                )
            )
        )

        assertEquals(5_000L, packet.sentMonoMs)
        assertEquals(1_700_000_000_000L, packet.deviceWallMs)
        assertEquals(1_234L, packet.samples.single().sampleMonoMs)
        assertEquals("session-1", packet.sessionId)
        assertEquals(1L, packet.seq)
    }

    @Test
    fun futureSampleBecomesMissing() {
        val packet = factory.create(
            "session-1",
            1,
            listOf(CapabilityId.BATTERY_LEVEL),
            mapOf(
                CapabilityId.BATTERY_LEVEL to Sample.valid(
                    CapabilityId.BATTERY_LEVEL,
                    SampleValue.Integer(42),
                    5_001
                )
            )
        )

        assertEquals(Quality.MISSING, packet.samples.single().quality)
    }

    @Test
    fun emptyAcceptedProducesHeartbeat() {
        val packet = factory.create("session-1", 1, emptyList(), emptyMap())
        assertTrue(packet.samples.isEmpty())
    }
}
