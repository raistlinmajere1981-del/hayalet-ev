package com.hayaletev.gaiaclient.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class SampleTest {
    @Test
    fun batteryLevelAcceptsOnlyCatalogIntegers() {
        val sample = Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(0), 1_000)
        assertEquals(Quality.VALID, sample.quality)
        assertEquals(SampleValue.Integer(0), sample.value)

        assertThrows(IllegalArgumentException::class.java) {
            Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(101), 1_000)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Decimal(42.0), 1_000)
        }
    }

    @Test
    fun signalUsesInclusiveProtocolRange() {
        assertEquals(
            Quality.VALID,
            Sample.valid(CapabilityId.SIGNAL, SampleValue.Integer(-126), 1_000).quality
        )
        assertThrows(IllegalArgumentException::class.java) {
            Sample.valid(CapabilityId.SIGNAL, SampleValue.Integer(1), 1_000)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Sample.valid(CapabilityId.SIGNAL, SampleValue.Integer(-127), 1_000)
        }
    }

    @Test
    fun networkNoneMustNotClaimConnectivity() {
        assertEquals(
            Quality.VALID,
            Sample.valid(
                CapabilityId.NETWORK,
                SampleValue.Network(NetworkTransport.NONE, false, false),
                1_000
            ).quality
        )
        assertThrows(IllegalArgumentException::class.java) {
            Sample.valid(
                CapabilityId.NETWORK,
                SampleValue.Network(NetworkTransport.NONE, true, false),
                1_000
            )
        }
    }

    @Test
    fun zeroVectorIsValid() {
        val sample = Sample.valid(
            CapabilityId.ACCELEROMETER,
            SampleValue.Vector3(0.0, 0.0, 0.0),
            0
        )
        assertEquals(Quality.VALID, sample.quality)
        assertEquals(0L, sample.sampleMonoMs)
    }

    @Test
    fun invalidAndMissingCarryTheRightTimeShape() {
        val invalid = Sample.invalid(CapabilityId.BATTERY_LEVEL, 1_000)
        assertNull(invalid.value)
        assertEquals(1_000L, invalid.sampleMonoMs)

        val missing = Sample.missing(CapabilityId.BATTERY_LEVEL)
        assertNull(missing.value)
        assertNull(missing.sampleMonoMs)
    }

    @Test
    fun illegalQualityValueTimeCombinationsThrow() {
        assertThrows(IllegalArgumentException::class.java) {
            Sample(CapabilityId.BATTERY_LEVEL, Quality.VALID, null, 1_000)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Sample(CapabilityId.BATTERY_LEVEL, Quality.INVALID, SampleValue.Integer(1), 1_000)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Sample(CapabilityId.BATTERY_LEVEL, Quality.MISSING, null, 1_000)
        }
    }
}
