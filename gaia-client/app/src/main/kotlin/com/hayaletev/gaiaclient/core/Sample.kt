package com.hayaletev.gaiaclient.core

enum class Quality { VALID, INVALID, MISSING }

enum class NetworkTransport(val wire: String) {
    NONE("none"),
    WIFI("wifi"),
    CELLULAR("cellular"),
    OTHER("other");

    companion object {
        fun fromWire(wire: String): NetworkTransport? = entries.firstOrNull { it.wire == wire }
    }
}

sealed interface SampleValue {
    data class Integer(val value: Long) : SampleValue
    data class Decimal(val value: Double) : SampleValue
    data class Text(val value: String) : SampleValue
    data class Vector3(val x: Double, val y: Double, val z: Double) : SampleValue
    data class Network(
        val transport: NetworkTransport,
        val internetCapable: Boolean,
        val validated: Boolean
    ) : SampleValue
}

data class Sample(
    val id: CapabilityId,
    val quality: Quality,
    val value: SampleValue?,
    val sampleMonoMs: Long?
) {
    init {
        when (quality) {
            Quality.VALID -> {
                require(value != null) { "valid sample requires a value" }
                require(sampleMonoMs != null && sampleMonoMs >= 0) {
                    "valid sample requires a non-negative time"
                }
                require(CapabilityCatalog.definition(id).accepts(value)) {
                    "value does not match the catalog for ${id.wireId}"
                }
            }
            Quality.INVALID -> {
                require(value == null) { "invalid sample must not carry a value" }
                require(sampleMonoMs != null && sampleMonoMs >= 0) {
                    "invalid sample requires a non-negative time"
                }
            }
            Quality.MISSING -> {
                require(value == null) { "missing sample must not carry a value" }
                require(sampleMonoMs == null) { "missing sample must not carry a time" }
            }
        }
    }

    companion object {
        fun valid(id: CapabilityId, value: SampleValue, sampleMonoMs: Long): Sample =
            Sample(id, Quality.VALID, value, sampleMonoMs)

        fun invalid(id: CapabilityId, sampleMonoMs: Long): Sample =
            Sample(id, Quality.INVALID, null, sampleMonoMs)

        fun missing(id: CapabilityId): Sample = Sample(id, Quality.MISSING, null, null)
    }
}
