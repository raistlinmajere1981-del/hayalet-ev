package com.hayaletev.gaiaclient.protocol

import com.hayaletev.gaiaclient.core.CapabilityCatalog
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.NetworkTransport
import com.hayaletev.gaiaclient.core.ObservationPacket
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleValue
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ObservationCodecTest {
    private val packet = ObservationPacket(
        sessionId = "00000000-0000-4000-8000-000000000001",
        seq = 3,
        sentMonoMs = 1_000,
        deviceWallMs = 1_700_000_000_000,
        samples = listOf(
            Sample.valid(CapabilityId.BATTERY_LEVEL, SampleValue.Integer(0), 1_000),
            Sample.valid(CapabilityId.BATTERY_PACK_TEMPERATURE, SampleValue.Decimal(19.9), 1_000),
            Sample.valid(CapabilityId.BATTERY_VOLTAGE, SampleValue.Integer(4_200), 1_000),
            Sample.valid(CapabilityId.BATTERY_CHARGE_STATE, SampleValue.Text("charging"), 1_000),
            Sample.valid(
                CapabilityId.ACCELEROMETER,
                SampleValue.Vector3(0.0, 0.0, 0.0),
                1_000
            ),
            Sample.invalid(CapabilityId.PROXIMITY, 1_000),
            Sample.valid(
                CapabilityId.NETWORK,
                SampleValue.Network(NetworkTransport.NONE, false, false),
                1_000
            ),
            Sample.missing(CapabilityId.SIGNAL)
        )
    )

    @Test
    fun encodesEnvelopeAndEverySample() {
        val root = JSONObject(ObservationCodec.encode(packet))

        assertEquals(1, root.getInt("v"))
        assertEquals(packet.sessionId, root.getString("sessionId"))
        assertEquals(3L, root.getLong("seq"))
        assertEquals(1_000L, root.getLong("sentMonoMs"))
        assertEquals(1_700_000_000_000L, root.getLong("deviceWallMs"))

        val samples = root.getJSONArray("samples")
        assertEquals(8, samples.length())
        val ids = (0 until samples.length()).map { samples.getJSONObject(it).getString("id") }
        assertEquals(CapabilityCatalog.ids.map { it.wireId }, ids)
    }

    @Test
    fun preservesValidZerosFalseAndVector() {
        val samples = JSONObject(ObservationCodec.encode(packet)).getJSONArray("samples")
        val byId = (0 until samples.length()).associate {
            val sample = samples.getJSONObject(it)
            sample.getString("id") to sample
        }

        assertEquals(0, byId.getValue("battery.level.v1").getInt("value"))
        val network = byId.getValue("network.state.v1").getJSONObject("value")
        assertEquals("none", network.getString("transport"))
        assertFalse(network.getBoolean("internetCapable"))
        assertFalse(network.getBoolean("validated"))
        val vector = byId.getValue("accelerometer.xyz.v1").getJSONArray("value")
        assertEquals(3, vector.length())
        assertEquals(0.0, vector.getDouble(0), 0.0)
        assertEquals(0.0, vector.getDouble(1), 0.0)
        assertEquals(0.0, vector.getDouble(2), 0.0)
    }

    @Test
    fun missingHasNoTimeAndInvalidHasNullValue() {
        val samples = JSONObject(ObservationCodec.encode(packet)).getJSONArray("samples")
        val byId = (0 until samples.length()).associate {
            val sample = samples.getJSONObject(it)
            sample.getString("id") to sample
        }

        val missing = byId.getValue("signal.read.v1")
        assertFalse(missing.has("sampleMonoMs"))
        assertTrue(missing.isNull("value"))

        val invalid = byId.getValue("proximity.state.v1")
        assertEquals(1_000L, invalid.getLong("sampleMonoMs"))
        assertTrue(invalid.isNull("value"))
    }

    @Test
    fun everySampleCarriesTheCatalogUnit() {
        val samples = JSONObject(ObservationCodec.encode(packet)).getJSONArray("samples")
        for (index in 0 until samples.length()) {
            val sample = samples.getJSONObject(index)
            val id = CapabilityId.fromWire(sample.getString("id"))!!
            assertEquals(CapabilityCatalog.definition(id).unit, sample.getString("unit"))
        }
    }

    @Test
    fun writerAndEncoderAgree() {
        assertEquals(
            JsonWriter.write(ObservationCodec.toJson(packet)),
            ObservationCodec.encode(packet)
        )
    }

    @Test
    fun envelopeKeysStayInContractOrder() {
        val encoded = ObservationCodec.encode(packet)
        val keys = listOf("v", "sessionId", "seq", "sentMonoMs", "deviceWallMs", "samples")
        val positions = keys.map { encoded.indexOf("\"$it\"") }
        assertEquals(positions.sorted(), positions)
        assertTrue(positions.all { it >= 0 })
    }
}
