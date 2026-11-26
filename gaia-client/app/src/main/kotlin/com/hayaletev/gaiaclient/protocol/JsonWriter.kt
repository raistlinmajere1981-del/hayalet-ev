package com.hayaletev.gaiaclient.protocol

import com.hayaletev.gaiaclient.core.MAX_SAFE_INTEGER
import kotlin.math.abs
import kotlin.math.floor

object JsonWriter {
    fun write(value: JsonValue): String = when (value) {
        JsonValue.Null -> "null"
        is JsonValue.Bool -> if (value.value) "true" else "false"
        is JsonValue.Num -> writeNumber(value)
        is JsonValue.Str -> quote(value.value)
        is JsonValue.Arr -> value.items.joinToString(",", "[", "]") { write(it) }
        is JsonValue.Obj -> value.entries.joinToString(",", "{", "}") { (key, item) ->
            quote(key) + ":" + write(item)
        }
    }

    private fun writeNumber(number: JsonValue.Num): String {
        val value = number.value
        require(value.isFinite()) { "JSON numbers must be finite" }
        if (!number.integer) {
            return if (value == 0.0) "0.0" else value.toString()
        }
        require(value == floor(value)) { "integer JSON number must not have a fraction" }
        require(abs(value) <= MAX_SAFE_INTEGER.toDouble()) {
            "integer JSON number must stay within the safe range"
        }
        return value.toLong().toString()
    }

    private fun quote(value: String): String = buildString(value.length + 2) {
        append('"')
        for (character in value) {
            when (character) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\b' -> append("\\b")
                '\u000C' -> append("\\f")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> {
                    if (character < ' ') {
                        append("\\u")
                        append(character.code.toString(16).padStart(4, '0'))
                    } else {
                        append(character)
                    }
                }
            }
        }
        append('"')
    }
}
