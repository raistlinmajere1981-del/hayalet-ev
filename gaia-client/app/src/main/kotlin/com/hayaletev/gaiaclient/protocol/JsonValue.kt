package com.hayaletev.gaiaclient.protocol

sealed interface JsonValue {
    data object Null : JsonValue
    data class Bool(val value: Boolean) : JsonValue
    data class Num(val value: Double, val integer: Boolean) : JsonValue
    data class Str(val value: String) : JsonValue
    data class Arr(val items: List<JsonValue>) : JsonValue
    data class Obj(val entries: List<Pair<String, JsonValue>>) : JsonValue
}
