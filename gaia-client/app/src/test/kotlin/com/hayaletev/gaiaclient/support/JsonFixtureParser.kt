package com.hayaletev.gaiaclient.support

import com.hayaletev.gaiaclient.protocol.JsonValue
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.File
import java.math.BigDecimal
import java.math.BigInteger
import kotlin.math.floor

object JsonFixtureParser {
    fun parse(file: File): JsonValue = parse(file.readText())

    fun parse(text: String): JsonValue = convert(JSONTokener(text).nextValue())

    private fun convert(value: Any?): JsonValue = when (value) {
        null, JSONObject.NULL -> JsonValue.Null
        is Boolean -> JsonValue.Bool(value)
        is String -> JsonValue.Str(value)
        is JSONObject -> JsonValue.Obj(
            value.keys().asSequence().map { key -> key to convert(value.get(key)) }.toList()
        )
        is JSONArray -> JsonValue.Arr((0 until value.length()).map { convert(value.get(it)) })
        is BigDecimal -> JsonValue.Num(
            value.toDouble(),
            integer = value.stripTrailingZeros().scale() <= 0
        )
        is BigInteger -> JsonValue.Num(value.toDouble(), integer = true)
        is Number -> {
            val number = value.toDouble()
            JsonValue.Num(number, integer = number.isFinite() && number == floor(number))
        }
        else -> error("unsupported JSON value: ${value::class.java.name}")
    }
}
