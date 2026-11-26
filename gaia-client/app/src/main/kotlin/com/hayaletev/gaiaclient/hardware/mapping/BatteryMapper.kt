package com.hayaletev.gaiaclient.hardware.mapping

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleValue

enum class ChargeStatus {
    UNKNOWN,
    CHARGING,
    DISCHARGING,
    NOT_CHARGING,
    FULL,
    OTHER
}

data class BatteryReading(
    val level: Int?,
    val scale: Int?,
    val temperatureTenths: Int?,
    val voltageMv: Int?,
    val status: ChargeStatus?,
    val isInitialSticky: Boolean,
    val receiptMonoMs: Long
)

/**
 * A sticky broadcast only proves what the OS cached, not when the battery was
 * measured. Treating that cache as a new sample would re-date it on every
 * start, so the initial sticky delivery yields no samples and the store keeps
 * the capabilities missing until a real broadcast arrives.
 */
object BatteryMapper {
    fun map(reading: BatteryReading): List<Sample> {
        if (reading.isInitialSticky) return emptyList()

        return listOf(
            levelSample(reading),
            temperatureSample(reading),
            voltageSample(reading),
            chargeStateSample(reading)
        )
    }

    private fun levelSample(reading: BatteryReading): Sample {
        val level = reading.level
        val scale = reading.scale
        if (level == null || scale == null || level == -1 || scale == -1) {
            return Sample.missing(CapabilityId.BATTERY_LEVEL)
        }
        if (scale <= 0) return Sample.invalid(CapabilityId.BATTERY_LEVEL, reading.receiptMonoMs)
        // Integer division can round 256/255 up to 100; reject the raw range
        // before that lossy step so an out-of-range level never looks valid.
        if (level < 0 || level > scale) {
            return Sample.invalid(CapabilityId.BATTERY_LEVEL, reading.receiptMonoMs)
        }

        val percent = level * 100L / scale
        return if (percent in 0..100) {
            Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(percent), reading.receiptMonoMs)
        } else {
            Sample.invalid(CapabilityId.BATTERY_LEVEL, reading.receiptMonoMs)
        }
    }

    private fun temperatureSample(reading: BatteryReading): Sample {
        val tenths = reading.temperatureTenths
            ?: return Sample.missing(CapabilityId.BATTERY_PACK_TEMPERATURE)
        return Sample.valid(
            CapabilityId.BATTERY_PACK_TEMPERATURE,
            SampleValue.Decimal(tenths / 10.0),
            reading.receiptMonoMs
        )
    }

    private fun voltageSample(reading: BatteryReading): Sample {
        val millivolts = reading.voltageMv
        return when {
            millivolts == null || millivolts == -1 -> Sample.missing(CapabilityId.BATTERY_VOLTAGE)
            millivolts < 0 -> Sample.invalid(CapabilityId.BATTERY_VOLTAGE, reading.receiptMonoMs)
            else -> Sample.valid(
                CapabilityId.BATTERY_VOLTAGE,
                SampleValue.Integer(millivolts.toLong()),
                reading.receiptMonoMs
            )
        }
    }

    private fun chargeStateSample(reading: BatteryReading): Sample {
        val status = reading.status
        return when (status) {
            null, ChargeStatus.UNKNOWN -> Sample.missing(CapabilityId.BATTERY_CHARGE_STATE)
            ChargeStatus.OTHER -> Sample.invalid(
                CapabilityId.BATTERY_CHARGE_STATE,
                reading.receiptMonoMs
            )
            ChargeStatus.CHARGING -> chargeState("charging", reading.receiptMonoMs)
            ChargeStatus.DISCHARGING -> chargeState("discharging", reading.receiptMonoMs)
            ChargeStatus.NOT_CHARGING -> chargeState("not_charging", reading.receiptMonoMs)
            ChargeStatus.FULL -> chargeState("full", reading.receiptMonoMs)
        }
    }

    private fun chargeState(value: String, receiptMonoMs: Long): Sample =
        Sample.valid(
            CapabilityId.BATTERY_CHARGE_STATE,
            SampleValue.Text(value),
            receiptMonoMs
        )
}
