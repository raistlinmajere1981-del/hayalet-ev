package com.hayaletev.gaiaclient.protocol

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ObservationValidatorTest {
    private val session = "ab7d90f6-124b-487a-a512-2441b5540978"

    private fun num(value: Double): JsonValue.Num = JsonValue.Num(value, integer = true)

    private fun sample(
        id: String,
        quality: String,
        unit: String,
        value: JsonValue,
        time: Double? = 1_000.0
    ): JsonValue.Obj {
        val entries = mutableListOf<Pair<String, JsonValue>>()
        entries += "id" to JsonValue.Str(id)
        entries += "quality" to JsonValue.Str(quality)
        if (time != null) entries += "sampleMonoMs" to num(time)
        entries += "unit" to JsonValue.Str(unit)
        entries += "value" to value
        return JsonValue.Obj(entries)
    }

    private fun packet(
        samples: List<JsonValue>,
        version: Double = 1.0,
        sessionId: String = session,
        seq: Double = 1.0,
        sentMonoMs: Double = 2_000.0,
        deviceWallMs: Double = 1_700_000_000_000.0,
        extra: List<Pair<String, JsonValue>> = emptyList()
    ): JsonValue.Obj = JsonValue.Obj(
        listOf(
            "v" to num(version),
            "sessionId" to JsonValue.Str(sessionId),
            "seq" to num(seq),
            "sentMonoMs" to num(sentMonoMs),
            "deviceWallMs" to num(deviceWallMs),
            "samples" to JsonValue.Arr(samples)
        ) + extra
    )

    private fun battery(value: JsonValue = num(50.0), time: Double = 1_000.0): JsonValue.Obj =
        sample("battery.level.v1", "valid", "%", value, time)

    private fun codes(root: JsonValue, accepted: Set<String>? = null): Set<String> =
        ObservationValidator.validate(root, accepted).map { it.code }.toSet()

    @Test
    fun envelopeFailuresUseStableCodes() {
        assertTrue("wrong-version" in codes(packet(listOf(battery()), version = 2.0)))
        assertTrue("invalid-uuid" in codes(packet(listOf(battery()), sessionId = "ABC")))
        assertTrue("sequence-range" in codes(packet(listOf(battery()), seq = 0.0)))
        assertTrue(
            "unsafe-integer" in codes(
                packet(listOf(battery()), seq = 9_007_199_254_740_992.0)
            )
        )
        assertTrue("negative-time" in codes(packet(listOf(battery()), sentMonoMs = -1.0)))
    }

    @Test
    fun packetShapeFailuresUseStableCodes() {
        val withExtra = packet(listOf(battery()), extra = listOf("source" to JsonValue.Str("android")))
        assertTrue("extra-field" in codes(withExtra))

        val withoutWall = JsonValue.Obj(
            packet(listOf(battery())).entries.filter { it.first != "deviceWallMs" }
        )
        assertTrue("missing-field" in codes(withoutWall))
    }

    @Test
    fun sampleIdentityFailuresUseStableCodes() {
        val unknown = sample("camera.view.v1", "valid", "1", JsonValue.Bool(true))
        assertTrue("unknown-capability" in codes(packet(listOf(unknown))))

        assertTrue(
            "duplicate-capability" in codes(packet(listOf(battery(), battery())))
        )
    }

    @Test
    fun unitAndValueFailuresUseStableCodes() {
        assertTrue(
            "wrong-unit" in codes(
                packet(listOf(sample("battery.level.v1", "valid", "°C", num(50.0))))
            )
        )
        assertTrue(
            "wrong-value-type" in codes(
                packet(listOf(sample("battery.level.v1", "valid", "%", JsonValue.Str("83"))))
            )
        )
        assertTrue(
            "invalid-vector" in codes(
                packet(
                    listOf(
                        sample(
                            "accelerometer.xyz.v1",
                            "valid",
                            "m/s²",
                            JsonValue.Arr(listOf(num(0.0), num(0.0)))
                        )
                    )
                )
            )
        )
    }

    @Test
    fun qualityTimeRulesUseStableCodes() {
        val missingWithTime = sample(
            "signal.read.v1",
            "missing",
            "dBm",
            JsonValue.Null,
            time = 1_000.0
        )
        assertTrue("missing-time-rule" in codes(packet(listOf(missingWithTime))))

        val future = battery(time = 1_001.0)
        assertTrue(
            "sample-after-send" in codes(packet(listOf(future), sentMonoMs = 1_000.0))
        )
    }

    @Test
    fun membershipChecksUseStableCodes() {
        assertTrue(
            "unapproved-capability" in codes(
                packet(listOf(battery())),
                accepted = setOf("signal.read.v1")
            )
        )
        assertTrue(
            "missing-capability" in codes(
                packet(emptyList()),
                accepted = setOf("battery.level.v1")
            )
        )
    }

    @Test
    fun catalogBoundariesAreRejected() {
        val networkNoneWithFlags = sample(
            "network.state.v1",
            "valid",
            "1",
            JsonValue.Obj(
                listOf(
                    "transport" to JsonValue.Str("none"),
                    "internetCapable" to JsonValue.Bool(true),
                    "validated" to JsonValue.Bool(false)
                )
            )
        )
        assertTrue("wrong-value-type" in codes(packet(listOf(networkNoneWithFlags))))

        assertTrue(
            "wrong-value-type" in codes(
                packet(listOf(sample("signal.read.v1", "valid", "dBm", num(1.0))))
            )
        )
        assertTrue(
            "wrong-value-type" in codes(
                packet(listOf(sample("battery.level.v1", "valid", "%", num(101.0))))
            )
        )
        assertTrue(
            "wrong-value-type" in codes(
                packet(listOf(sample("proximity.state.v1", "valid", "1", num(9.0))))
            )
        )
    }

    @Test
    fun emptyHeartbeatIsValidForAnEmptyAcceptedSet() {
        assertEquals(emptySet<String>(), codes(packet(emptyList()), accepted = emptySet()))
    }
}
