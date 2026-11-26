package com.hayaletev.gaiaclient.protocol

import com.hayaletev.gaiaclient.core.CapabilityCatalog
import com.hayaletev.gaiaclient.core.ObservationPacket
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleValue

object ObservationCodec {
    fun toJson(packet: ObservationPacket): JsonValue.Obj = JsonValue.Obj(
        listOf(
            "v" to JsonValue.Num(packet.v.toDouble(), integer = true),
            "sessionId" to JsonValue.Str(packet.sessionId),
            "seq" to JsonValue.Num(packet.seq.toDouble(), integer = true),
            "sentMonoMs" to JsonValue.Num(packet.sentMonoMs.toDouble(), integer = true),
            "deviceWallMs" to JsonValue.Num(packet.deviceWallMs.toDouble(), integer = true),
            "samples" to JsonValue.Arr(packet.samples.map(::sampleToJson))
        )
    )

    fun encode(packet: ObservationPacket): String = JsonWriter.write(toJson(packet))

    private fun sampleToJson(sample: Sample): JsonValue.Obj {
        val entries = mutableListOf<Pair<String, JsonValue>>()
        entries += "id" to JsonValue.Str(sample.id.wireId)
        entries += "quality" to JsonValue.Str(sample.quality.name.lowercase())
        sample.sampleMonoMs?.let {
            entries += "sampleMonoMs" to JsonValue.Num(it.toDouble(), integer = true)
        }
        entries += "unit" to JsonValue.Str(CapabilityCatalog.definition(sample.id).unit)
        entries += "value" to valueToJson(sample.value)
        return JsonValue.Obj(entries)
    }

    private fun valueToJson(value: SampleValue?): JsonValue = when (value) {
        null -> JsonValue.Null
        is SampleValue.Integer -> JsonValue.Num(value.value.toDouble(), integer = true)
        is SampleValue.Decimal -> JsonValue.Num(value.value, integer = false)
        is SampleValue.Text -> JsonValue.Str(value.value)
        is SampleValue.Vector3 -> JsonValue.Arr(
            listOf(
                JsonValue.Num(value.x, integer = false),
                JsonValue.Num(value.y, integer = false),
                JsonValue.Num(value.z, integer = false)
            )
        )
        is SampleValue.Network -> JsonValue.Obj(
            listOf(
                "transport" to JsonValue.Str(value.transport.wire),
                "internetCapable" to JsonValue.Bool(value.internetCapable),
                "validated" to JsonValue.Bool(value.validated)
            )
        )
    }
}
