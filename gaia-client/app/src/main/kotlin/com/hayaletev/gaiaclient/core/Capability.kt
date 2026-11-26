package com.hayaletev.gaiaclient.core

const val MAX_SAFE_INTEGER: Long = 9_007_199_254_740_991L

enum class CapabilityId(val wireId: String) {
    BATTERY_LEVEL("battery.level.v1"),
    BATTERY_PACK_TEMPERATURE("battery.pack-temperature.v1"),
    BATTERY_VOLTAGE("battery.voltage.v1"),
    BATTERY_CHARGE_STATE("battery.charge-state.v1"),
    ACCELEROMETER("accelerometer.xyz.v1"),
    PROXIMITY("proximity.state.v1"),
    NETWORK("network.state.v1"),
    SIGNAL("signal.read.v1");

    companion object {
        fun fromWire(wireId: String): CapabilityId? = entries.firstOrNull { it.wireId == wireId }
    }
}

enum class ValueKind { INTEGER, DECIMAL, TEXT, VECTOR3, NETWORK }

enum class NetworkFieldType { ENUM, BOOLEAN }

data class NetworkFieldDefinition(
    val name: String,
    val type: NetworkFieldType,
    val enumValues: List<String> = emptyList()
)

data class CapabilityDefinition(
    val id: CapabilityId,
    val unit: String,
    val kind: ValueKind,
    val minimum: Long? = null,
    val maximum: Long? = null,
    val enumValues: List<String> = emptyList(),
    val length: Int? = null,
    val fields: List<NetworkFieldDefinition> = emptyList()
) {
    fun accepts(value: SampleValue): Boolean = when (kind) {
        ValueKind.INTEGER -> value is SampleValue.Integer &&
            minimum != null && maximum != null &&
            value.value in minimum..maximum
        ValueKind.DECIMAL -> value is SampleValue.Decimal && value.value.isFinite()
        ValueKind.TEXT -> value is SampleValue.Text && value.value in enumValues
        ValueKind.VECTOR3 -> value is SampleValue.Vector3 &&
            value.x.isFinite() && value.y.isFinite() && value.z.isFinite()
        ValueKind.NETWORK -> value is SampleValue.Network &&
            (value.transport != NetworkTransport.NONE || (!value.internetCapable && !value.validated))
    }
}

object CapabilityCatalog {
    val all: List<CapabilityDefinition> = listOf(
        CapabilityDefinition(
            id = CapabilityId.BATTERY_LEVEL,
            unit = "%",
            kind = ValueKind.INTEGER,
            minimum = 0,
            maximum = 100
        ),
        CapabilityDefinition(
            id = CapabilityId.BATTERY_PACK_TEMPERATURE,
            unit = "°C",
            kind = ValueKind.DECIMAL
        ),
        CapabilityDefinition(
            id = CapabilityId.BATTERY_VOLTAGE,
            unit = "mV",
            kind = ValueKind.INTEGER,
            minimum = 0,
            maximum = MAX_SAFE_INTEGER
        ),
        CapabilityDefinition(
            id = CapabilityId.BATTERY_CHARGE_STATE,
            unit = "1",
            kind = ValueKind.TEXT,
            enumValues = listOf("charging", "discharging", "full", "not_charging")
        ),
        CapabilityDefinition(
            id = CapabilityId.ACCELEROMETER,
            unit = "m/s²",
            kind = ValueKind.VECTOR3,
            length = 3
        ),
        CapabilityDefinition(
            id = CapabilityId.PROXIMITY,
            unit = "1",
            kind = ValueKind.TEXT,
            enumValues = listOf("near", "far")
        ),
        CapabilityDefinition(
            id = CapabilityId.NETWORK,
            unit = "1",
            kind = ValueKind.NETWORK,
            fields = listOf(
                NetworkFieldDefinition(
                    "transport",
                    NetworkFieldType.ENUM,
                    listOf("none", "wifi", "cellular", "other")
                ),
                NetworkFieldDefinition("internetCapable", NetworkFieldType.BOOLEAN),
                NetworkFieldDefinition("validated", NetworkFieldType.BOOLEAN)
            )
        ),
        CapabilityDefinition(
            id = CapabilityId.SIGNAL,
            unit = "dBm",
            kind = ValueKind.INTEGER,
            minimum = -126,
            maximum = 0
        )
    )

    val ids: List<CapabilityId> = all.map { it.id }

    private val byId: Map<CapabilityId, CapabilityDefinition> = all.associateBy { it.id }

    fun definition(id: CapabilityId): CapabilityDefinition = byId.getValue(id)

    fun orderOf(id: CapabilityId): Int = all.indexOfFirst { it.id == id }
}
