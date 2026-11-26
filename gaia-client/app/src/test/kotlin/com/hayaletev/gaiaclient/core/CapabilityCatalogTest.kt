package com.hayaletev.gaiaclient.core

import com.hayaletev.gaiaclient.support.RepoPaths
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class CapabilityCatalogTest {
    @Test
    fun catalogMatchesB1Schema() {
        val root = JSONObject(File(RepoPaths.protocolDir(), "schema/capabilities.json").readText())
        val expected = root.getJSONArray("capabilities")
        assertEquals(8, expected.length())
        assertEquals(8, CapabilityCatalog.all.size)

        for (index in 0 until expected.length()) {
            val source = expected.getJSONObject(index)
            val definition = CapabilityCatalog.all[index]
            assertEquals(source.getString("id"), definition.id.wireId)
            assertEquals(source.getString("unit"), definition.unit)

            when (source.getString("valueType")) {
                "integer" -> {
                    assertEquals(ValueKind.INTEGER, definition.kind)
                    assertEquals(source.getLong("minimum"), definition.minimum)
                    assertEquals(source.getLong("maximum"), definition.maximum)
                }
                "number" -> {
                    assertEquals(ValueKind.DECIMAL, definition.kind)
                    assertNull(definition.minimum)
                    assertNull(definition.maximum)
                }
                "string" -> {
                    assertEquals(ValueKind.TEXT, definition.kind)
                    assertEquals(
                        source.getJSONArray("enumValues").toStringList(),
                        definition.enumValues
                    )
                }
                "vector3" -> {
                    assertEquals(ValueKind.VECTOR3, definition.kind)
                    assertEquals(source.getInt("length"), definition.length)
                }
                "object" -> {
                    assertEquals(ValueKind.NETWORK, definition.kind)
                    assertEquals(
                        listOf(
                            NetworkFieldDefinition(
                                "transport",
                                NetworkFieldType.ENUM,
                                listOf("none", "wifi", "cellular", "other")
                            ),
                            NetworkFieldDefinition("internetCapable", NetworkFieldType.BOOLEAN),
                            NetworkFieldDefinition("validated", NetworkFieldType.BOOLEAN)
                        ),
                        definition.fields
                    )
                }
                else -> error("unexpected valueType in B1 schema")
            }
        }

        assertEquals(
            listOf(
                "battery.level.v1",
                "battery.pack-temperature.v1",
                "battery.voltage.v1",
                "battery.charge-state.v1",
                "accelerometer.xyz.v1",
                "proximity.state.v1",
                "network.state.v1",
                "signal.read.v1"
            ),
            CapabilityCatalog.ids.map { it.wireId }
        )
        assertTrue(CapabilityCatalog.ids.toSet().size == 8)
    }

    private fun org.json.JSONArray.toStringList(): List<String> =
        (0 until length()).map { getString(it) }
}
