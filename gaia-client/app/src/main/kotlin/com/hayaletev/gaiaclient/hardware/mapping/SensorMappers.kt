package com.hayaletev.gaiaclient.hardware.mapping

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleValue

data class AccelReading(
    val x: Float,
    val y: Float,
    val z: Float,
    val timestampNs: Long,
    val accuracy: Int
)

data class ProximityReading(
    val distance: Float,
    val maxRange: Float,
    val timestampNs: Long,
    val accuracy: Int
)

/** Android reports SENSOR_STATUS_UNRELIABLE as -1; such readings must not become zero vectors. */
private const val UNRELIABLE = -1

object AccelMapper {
    fun map(reading: AccelReading): Sample {
        val sampleMonoMs = reading.timestampNs / 1_000_000L
        val finite = reading.x.isFinite() && reading.y.isFinite() && reading.z.isFinite()

        if (!finite || reading.accuracy == UNRELIABLE) {
            return Sample.invalid(CapabilityId.ACCELEROMETER, sampleMonoMs)
        }
        return Sample.valid(
            CapabilityId.ACCELEROMETER,
            SampleValue.Vector3(
                reading.x.toDouble(),
                reading.y.toDouble(),
                reading.z.toDouble()
            ),
            sampleMonoMs
        )
    }
}

object ProximityMapper {
    fun map(reading: ProximityReading): Sample? {
        if (!reading.maxRange.isFinite() || reading.maxRange <= 0f) return null

        val sampleMonoMs = reading.timestampNs / 1_000_000L
        val distance = reading.distance
        if (!distance.isFinite() || distance < 0f || distance > reading.maxRange ||
            reading.accuracy == UNRELIABLE
        ) {
            return Sample.invalid(CapabilityId.PROXIMITY, sampleMonoMs)
        }

        val state = if (distance < reading.maxRange) "near" else "far"
        return Sample.valid(
            CapabilityId.PROXIMITY,
            SampleValue.Text(state),
            sampleMonoMs
        )
    }
}
