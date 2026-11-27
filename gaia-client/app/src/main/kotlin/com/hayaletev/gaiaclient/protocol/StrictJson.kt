package com.hayaletev.gaiaclient.protocol

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonObject
import com.google.gson.JsonPrimitive
import com.google.gson.Strictness
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import com.hayaletev.gaiaclient.core.MAX_SAFE_INTEGER
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.StringReader
import java.nio.ByteBuffer

internal const val WIRE_LIMIT = 16 * 1024
internal val uuidV4 = Regex("[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}")

internal fun InputStream.bounded(limit: Int): ByteArray {
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(4096)
    while (true) {
        val n = read(buffer, 0, minOf(buffer.size, limit - out.size() + 1))
        if (n < 0) return out.toByteArray()
        require(n > 0 && n <= limit - out.size())
        out.write(buffer, 0, n)
    }
}

internal fun parseObject(bytes: ByteArray, limit: Int = WIRE_LIMIT): JsonObject {
    require(bytes.size <= limit)
    val json = Charsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString()
    return JsonReader(StringReader(json)).use { r ->
        r.strictness = Strictness.STRICT
        val obj = readValue(r, 0).asJsonObject
        require(r.peek() == JsonToken.END_DOCUMENT)
        obj
    }
}

private fun readValue(r: JsonReader, depth: Int): JsonElement =
    when (r.peek()) {
        JsonToken.BEGIN_OBJECT ->
            JsonObject().apply {
                require(depth < 5)
                r.beginObject()
                while (r.hasNext()) {
                    val key = r.nextName()
                    require(!has(key) && key !in setOf("__proto__", "constructor", "prototype"))
                    add(key, readValue(r, depth + 1))
                }
                r.endObject()
            }
        JsonToken.BEGIN_ARRAY ->
            JsonArray().apply {
                require(depth < 5)
                r.beginArray()
                while (r.hasNext()) add(readValue(r, depth + 1))
                r.endArray()
            }
        JsonToken.STRING -> JsonPrimitive(r.nextString())
        JsonToken.NUMBER -> JsonPrimitive(r.nextString().toBigDecimal())
        JsonToken.BOOLEAN -> JsonPrimitive(r.nextBoolean())
        JsonToken.NULL -> {
            r.nextNull()
            JsonNull.INSTANCE
        }
        else -> error("Invalid JSON token")
    }

internal fun JsonObject.fields(vararg names: String) = require(keySet() == names.toSet())

internal fun JsonElement.string(): String {
    require(isJsonPrimitive && asJsonPrimitive.isString)
    return asString
}

internal fun JsonObject.str(key: String) = get(key).string()

internal fun JsonObject.integer(key: String): Long {
    val n = get(key).asJsonPrimitive
    require(n.isNumber)
    val decimal = n.asBigDecimal
    require(decimal.signum() >= 0 && decimal <= MAX_SAFE_INTEGER.toBigDecimal())
    return decimal.longValueExact()
}

internal fun JsonObject.uniqueStrings(key: String, max: Int): List<String> {
    val a = getAsJsonArray(key)
    require(a.size() <= max)
    return a.map { it.string() }.also { require(it.size == it.toSet().size) }
}
