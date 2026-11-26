package com.hayaletev.gaiaclient.hardware.mapping

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.Quality
import com.hayaletev.gaiaclient.core.SampleValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SensorMappersTest {
    private fun accel(
        x: Float = 0f,
        y: Float = 0f,
        z: Float = 0f,
        timestampNs: Long = 1_813_970_123_456,
        accuracy: Int = 3
    ): AccelReading = AccelReading(x, y, z, timestampNs, accuracy)

    private fun proximity(
        distance: Float = 0f,
        maxRange: Float = 5f,
        timestampNs: Long = 1_813_970_123_456,
        accuracy: Int = 3
    ): ProximityReading = ProximityReading(distance, maxRange, timestampNs, accuracy)

    @Test
    fun accelerometerCopiesTheVectorAndFloorsTheEventTime() {
        val sample = AccelMapper.map(accel(x = 0.25f, y = -9.81f, z = 1.5f))

        assertEquals(CapabilityId.ACCELEROMETER, sample.id)
        assertEquals(Quality.VALID, sample.quality)
        assertEquals(1_813_970L, sample.sampleMonoMs)
        val value = sample.value as SampleValue.Vector3
        assertEquals(0.25, value.x.toDouble(), 1e-6)
        assertEquals(-9.81, value.y.toDouble(), 1e-6)
        assertEquals(1.5, value.z.toDouble(), 1e-6)
    }

    @Test
    fun zeroVectorIsAValidMeasurement() {
        val sample = AccelMapper.map(accel(timestampNs = 0))

        assertEquals(Quality.VALID, sample.quality)
        assertEquals(0L, sample.sampleMonoMs)
        assertEquals(SampleValue.Vector3(0.0, 0.0, 0.0), sample.value)
    }

    @Test
    fun nonFiniteAccelerometerAxesAreInvalidAtTheEventTime() {
        for (reading in listOf(
            accel(x = Float.NaN),
            accel(y = Float.POSITIVE_INFINITY),
            accel(z = Float.NEGATIVE_INFINITY)
        )) {
            val sample = AccelMapper.map(reading)
            assertEquals(Quality.INVALID, sample.quality)
            assertNull(sample.value)
            assertEquals(1_813_970L, sample.sampleMonoMs)
        }
    }

    @Test
    fun unreliableAccelerometerAccuracyIsInvalidAtTheEventTime() {
        val sample = AccelMapper.map(accel(accuracy = -1))

        assertEquals(Quality.INVALID, sample.quality)
        assertNull(sample.value)
        assertEquals(1_813_970L, sample.sampleMonoMs)
    }

    @Test
    fun proximityNearCoversZeroUpToButNotIncludingTheRange() {
        val atZero = ProximityMapper.map(proximity(distance = 0f, maxRange = 5f))!!
        assertEquals(Quality.VALID, atZero.quality)
        assertEquals(SampleValue.Text("near"), atZero.value)

        val justInside = ProximityMapper.map(
            proximity(distance = 4.9f, maxRange = 5f)
        )!!
        assertEquals(Quality.VALID, justInside.quality)
        assertEquals(SampleValue.Text("near"), justInside.value)
    }

    @Test
    fun proximityAtOrBeyondTheRangeIsFar() {
        val atRange = ProximityMapper.map(proximity(distance = 5f, maxRange = 5f))!!
        assertEquals(SampleValue.Text("far"), atRange.value)

        val beyond = ProximityMapper.map(proximity(distance = 5.1f, maxRange = 5f))!!
        assertEquals(Quality.INVALID, beyond.quality)
        assertNull(beyond.value)
    }

    @Test
    fun invalidProximityDistancesAreInvalidAtTheEventTime() {
        for (reading in listOf(
            proximity(distance = -0.1f),
            proximity(distance = Float.NaN),
            proximity(distance = Float.POSITIVE_INFINITY)
        )) {
            val sample = ProximityMapper.map(reading)!!
            assertEquals(Quality.INVALID, sample.quality)
            assertNull(sample.value)
            assertEquals(1_813_970L, sample.sampleMonoMs)
        }
    }

    @Test
    fun unreliableProximityAccuracyIsInvalid() {
        val sample = ProximityMapper.map(proximity(accuracy = -1))!!

        assertEquals(Quality.INVALID, sample.quality)
        assertEquals(1_813_970L, sample.sampleMonoMs)
    }

    @Test
    fun proximityWithoutAUsableRangeIsNotOffered() {
        assertNull(ProximityMapper.map(proximity(maxRange = 0f)))
        assertNull(ProximityMapper.map(proximity(maxRange = -1f)))
        assertNull(ProximityMapper.map(proximity(maxRange = Float.NaN)))
        assertNull(ProximityMapper.map(proximity(maxRange = Float.POSITIVE_INFINITY)))
    }

    @Test
    fun proximityFloorsTheEventTime() {
        val sample = ProximityMapper.map(proximity(timestampNs = 1_813_970_999_999))!!
        assertEquals(1_813_970L, sample.sampleMonoMs)
    }
}
