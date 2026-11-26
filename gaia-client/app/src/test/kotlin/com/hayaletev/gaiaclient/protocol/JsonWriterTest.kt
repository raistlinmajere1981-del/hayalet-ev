package com.hayaletev.gaiaclient.protocol

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class JsonWriterTest {
    @Test
    fun escapesJsonControlCharacters() {
        val value = JsonValue.Str("a\"b\\c\n\t\u0001")
        assertEquals("\"a\\\"b\\\\c\\n\\t\\u0001\"", JsonWriter.write(value))
    }

    @Test
    fun preservesUnicodeUnits() {
        assertEquals("\"°C m/s²\"", JsonWriter.write(JsonValue.Str("°C m/s²")))
    }

    @Test
    fun integerNumbersDoNotGainADecimalPoint() {
        assertEquals("42", JsonWriter.write(JsonValue.Num(42.0, integer = true)))
        assertEquals("-126", JsonWriter.write(JsonValue.Num(-126.0, integer = true)))
    }

    @Test
    fun decimalsKeepTheirDecimalForm() {
        assertEquals("19.9", JsonWriter.write(JsonValue.Num(19.9, integer = false)))
    }

    @Test
    fun arraysAndObjectsNest() {
        val value = JsonValue.Obj(
            listOf(
                "a" to JsonValue.Arr(
                    listOf(
                        JsonValue.Num(1.0, integer = true),
                        JsonValue.Bool(true)
                    )
                ),
                "b" to JsonValue.Obj(listOf("c" to JsonValue.Null))
            )
        )
        assertEquals("{\"a\":[1,true],\"b\":{\"c\":null}}", JsonWriter.write(value))
    }

    @Test
    fun nonFiniteNumbersAreRejected() {
        assertThrows(IllegalArgumentException::class.java) {
            JsonWriter.write(JsonValue.Num(Double.NaN, integer = false))
        }
        assertThrows(IllegalArgumentException::class.java) {
            JsonWriter.write(JsonValue.Num(Double.POSITIVE_INFINITY, integer = false))
        }
    }
}
