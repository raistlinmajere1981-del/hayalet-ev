package com.hayaletev.gaiaclient.protocol

import com.hayaletev.gaiaclient.core.CapabilityCatalog
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.support.JsonFixtureParser
import com.hayaletev.gaiaclient.support.RepoPaths
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ObservationFixtureTest {
    @Test
    fun everyB5ObservationFixtureMatchesItsManifestExpectation() {
        val protocolDir = RepoPaths.protocolDir()
        val manifest = JSONObject(File(protocolDir, "fixtures/manifest.json").readText())
        val t1 = JSONObject(File(protocolDir, "scenarios/t1.json").readText())
        val t1Accepted = t1.getJSONArray("expectedAccepted").toStringSet()
        val allAccepted = CapabilityCatalog.ids.map { it.wireId }.toSet()
        val cases = manifest.getJSONArray("cases")

        var checked = 0
        for (index in 0 until cases.length()) {
            val case = cases.getJSONObject(index)
            if (case.optString("layer") == "raw") continue
            if (case.optString("schema") != "observation") continue

            val id = case.getString("id")
            val fixture = File(protocolDir, "fixtures/" + case.getString("file"))
            val root = JsonFixtureParser.parse(fixture)
            val accepted = when {
                id == "observation.heartbeat-empty" -> emptySet()
                id.startsWith("observation.t1") || case.getString("layer") == "semantic" -> t1Accepted
                else -> allAccepted
            }

            val errors = ObservationValidator.validate(root, accepted)
            if (case.getString("expect") == "valid") {
                assertTrue("$id should be valid, got $errors", errors.isEmpty())
            } else {
                val violation = case.getString("violation")
                assertTrue(
                    "$id should contain $violation, got $errors",
                    errors.any { it.code == violation }
                )
            }
            checked++
        }

        assertTrue("expected the B5 observation fixture matrix, checked $checked", checked >= 30)
    }

    private fun org.json.JSONArray.toStringSet(): Set<String> =
        (0 until length()).map { getString(it) }.toSet()
}
