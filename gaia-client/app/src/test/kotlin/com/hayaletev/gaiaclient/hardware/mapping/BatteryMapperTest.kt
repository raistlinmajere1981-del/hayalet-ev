package com.hayaletev.gaiaclient.hardware.mapping

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.Quality
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BatteryMapperTest {
    private fun reading(
        level: Int? = 50,
        scale: Int? = 100,
        temperatureTenths: Int? = 199,
        voltageMv: Int? = 4_200,
        status: ChargeStatus? = ChargeStatus.CHARGING,
        isInitialSticky: Boolean = false,
        receiptMonoMs: Long = 1_000
    ): BatteryReading = BatteryReading(
        level = level,
        scale = scale,
        temperatureTenths = temperatureTenths,
        voltageMv = voltageMv,
        status = status,
        isInitialSticky = isInitialSticky,
        receiptMonoMs = receiptMonoMs
    )

    private fun List<Sample>.byId(id: CapabilityId): Sample = first { it.id == id }

    @Test
    fun initialStickyCacheIsNeverAValidMeasurement() {
        assertTrue(BatteryMapper.map(reading(isInitialSticky = true)).isEmpty())
    }

    @Test
    fun newDeliveryMapsFourValidSamplesAtReceiptTime() {
        val samples = BatteryMapper.map(
            reading(level = 0, scale = 100, temperatureTenths = 199, voltageMv = 0)
        )

        assertEquals(4, samples.size)
        assertEquals(
            listOf(
                CapabilityId.BATTERY_LEVEL,
                CapabilityId.BATTERY_PACK_TEMPERATURE,
                CapabilityId.BATTERY_VOLTAGE,
                CapabilityId.BATTERY_CHARGE_STATE
            ),
            samples.map { it.id }
        )
        assertEquals(SampleValue.Integer(0), samples[0].value)
        assertEquals(SampleValue.Decimal(19.9), samples[1].value)
        assertEquals(SampleValue.Integer(0), samples[2].value)
        assertEquals(SampleValue.Text("charging"), samples[3].value)
        assertTrue(samples.all { it.quality == Quality.VALID && it.sampleMonoMs == 1_000L })
    }

    @Test
    fun levelSentinelsAndRangeAreHonest() {
        assertEquals(
            Quality.MISSING,
            BatteryMapper.map(reading(level = -1)).byId(CapabilityId.BATTERY_LEVEL).quality
        )
        assertEquals(
            Quality.MISSING,
            BatteryMapper.map(reading(scale = -1)).byId(CapabilityId.BATTERY_LEVEL).quality
        )
        assertEquals(
            Quality.MISSING,
            BatteryMapper.map(reading(level = null)).byId(CapabilityId.BATTERY_LEVEL).quality
        )
        assertEquals(
            Quality.MISSING,
            BatteryMapper.map(reading(scale = null)).byId(CapabilityId.BATTERY_LEVEL).quality
        )
        assertEquals(
            Quality.INVALID,
            BatteryMapper.map(reading(scale = 0)).byId(CapabilityId.BATTERY_LEVEL).quality
        )
        assertEquals(
            Quality.INVALID,
            BatteryMapper.map(reading(level = 101, scale = 100))
                .byId(CapabilityId.BATTERY_LEVEL).quality
        )
        assertEquals(
            Quality.INVALID,
            BatteryMapper.map(reading(level = -2)).byId(CapabilityId.BATTERY_LEVEL).quality
        )
        assertEquals(
            SampleValue.Integer(100),
            BatteryMapper.map(reading(level = 255, scale = 255))
                .byId(CapabilityId.BATTERY_LEVEL).value
        )
        assertEquals(
            SampleValue.Integer(33),
            BatteryMapper.map(reading(level = 1, scale = 3))
                .byId(CapabilityId.BATTERY_LEVEL).value
        )
    }

    @Test
    fun temperatureIsTenthsOfADegreeOrMissing() {
        val missing = BatteryMapper.map(reading(temperatureTenths = null))
            .byId(CapabilityId.BATTERY_PACK_TEMPERATURE)
        assertEquals(Quality.MISSING, missing.quality)
        assertNull(missing.sampleMonoMs)

        assertEquals(
            SampleValue.Decimal(-5.5),
            BatteryMapper.map(reading(temperatureTenths = -55))
                .byId(CapabilityId.BATTERY_PACK_TEMPERATURE).value
        )
    }

    @Test
    fun voltageUsesMinusOneAsMissingAndOtherNegativesAsInvalid() {
        val missing = BatteryMapper.map(reading(voltageMv = -1))
            .byId(CapabilityId.BATTERY_VOLTAGE)
        assertEquals(Quality.MISSING, missing.quality)
        assertNull(missing.sampleMonoMs)

        assertEquals(
            Quality.INVALID,
            BatteryMapper.map(reading(voltageMv = -2)).byId(CapabilityId.BATTERY_VOLTAGE).quality
        )
        assertEquals(
            SampleValue.Integer(4_312),
            BatteryMapper.map(reading(voltageMv = 4_312))
                .byId(CapabilityId.BATTERY_VOLTAGE).value
        )
    }

    @Test
    fun chargeStatusMapsKnownValuesAndRejectsUnknownDeliveries() {
        assertEquals(
            Quality.MISSING,
            BatteryMapper.map(reading(status = null))
                .byId(CapabilityId.BATTERY_CHARGE_STATE).quality
        )
        assertEquals(
            Quality.MISSING,
            BatteryMapper.map(reading(status = ChargeStatus.UNKNOWN))
                .byId(CapabilityId.BATTERY_CHARGE_STATE).quality
        )
        assertEquals(
            Quality.INVALID,
            BatteryMapper.map(reading(status = ChargeStatus.OTHER))
                .byId(CapabilityId.BATTERY_CHARGE_STATE).quality
        )

        assertEquals(
            SampleValue.Text("charging"),
            BatteryMapper.map(reading(status = ChargeStatus.CHARGING))
                .byId(CapabilityId.BATTERY_CHARGE_STATE).value
        )
        assertEquals(
            SampleValue.Text("discharging"),
            BatteryMapper.map(reading(status = ChargeStatus.DISCHARGING))
                .byId(CapabilityId.BATTERY_CHARGE_STATE).value
        )
        assertEquals(
            SampleValue.Text("not_charging"),
            BatteryMapper.map(reading(status = ChargeStatus.NOT_CHARGING))
                .byId(CapabilityId.BATTERY_CHARGE_STATE).value
        )
        assertEquals(
            SampleValue.Text("full"),
            BatteryMapper.map(reading(status = ChargeStatus.FULL))
                .byId(CapabilityId.BATTERY_CHARGE_STATE).value
        )
    }

    @Test
    fun validAndInvalidSamplesCarryReceiptTimeWhileMissingDoNot() {
        val samples = BatteryMapper.map(
            reading(
                level = 50,
                scale = 0,
                temperatureTenths = null,
                voltageMv = -2,
                status = ChargeStatus.OTHER,
                receiptMonoMs = 9_999
            )
        )

        assertEquals(9_999L, samples.byId(CapabilityId.BATTERY_LEVEL).sampleMonoMs)
        assertEquals(Quality.INVALID, samples.byId(CapabilityId.BATTERY_LEVEL).quality)
        assertEquals(9_999L, samples.byId(CapabilityId.BATTERY_VOLTAGE).sampleMonoMs)
        assertEquals(9_999L, samples.byId(CapabilityId.BATTERY_CHARGE_STATE).sampleMonoMs)
        assertEquals(Quality.MISSING, samples.byId(CapabilityId.BATTERY_PACK_TEMPERATURE).quality)
        assertNull(samples.byId(CapabilityId.BATTERY_PACK_TEMPERATURE).sampleMonoMs)
    }

    @Test
    fun rawLevelOutsideScaleCannotBecomeValidByIntegerRounding() {
        assertEquals(
            Quality.INVALID,
            BatteryMapper.map(reading(level = 256, scale = 255))
                .byId(CapabilityId.BATTERY_LEVEL).quality
        )
        assertEquals(
            Quality.INVALID,
            BatteryMapper.map(reading(level = -2, scale = 255))
                .byId(CapabilityId.BATTERY_LEVEL).quality
        )
    }
}
