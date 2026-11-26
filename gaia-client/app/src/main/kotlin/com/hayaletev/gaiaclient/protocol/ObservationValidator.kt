package com.hayaletev.gaiaclient.protocol

import com.hayaletev.gaiaclient.core.CapabilityCatalog
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.MAX_SAFE_INTEGER
import com.hayaletev.gaiaclient.core.ValueKind
import kotlin.math.abs
import kotlin.math.floor

data class ValidationError(val code: String, val path: String)

object ObservationValidator {
    private val uuidV4 = Regex(
        "^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"
    )
    private val packetKeys = setOf(
        "v",
        "sessionId",
        "seq",
        "sentMonoMs",
        "deviceWallMs",
        "samples"
    )
    private val sampleKeys = setOf("id", "quality", "sampleMonoMs", "unit", "value")
    private val qualities = setOf("valid", "invalid", "missing")
    private val transports = setOf("none", "wifi", "cellular", "other")

    fun validate(root: JsonValue, accepted: Set<String>? = null): List<ValidationError> {
        val errors = mutableListOf<ValidationError>()
        if (root !is JsonValue.Obj) {
            errors += ValidationError("wrong-value-type", "$")
            return errors
        }

        checkShape(root, packetKeys, packetKeys, "$", errors)

        val version = root.field("v")
        if (version != null && !(version is JsonValue.Num && version.value == 1.0)) {
            errors += ValidationError("wrong-version", "$.v")
        }

        val sessionId = root.field("sessionId")
        if (sessionId != null && (sessionId !is JsonValue.Str || !uuidV4.matches(sessionId.value))) {
            errors += ValidationError("invalid-uuid", "$.sessionId")
        }

        validateSeq(root.field("seq"), "$.seq", errors)
        val sentMonoMs = validateTime(root.field("sentMonoMs"), "$.sentMonoMs", errors)
        validateTime(root.field("deviceWallMs"), "$.deviceWallMs", errors)

        val samplesValue = root.field("samples")
        if (samplesValue != null && samplesValue !is JsonValue.Arr) {
            errors += ValidationError("wrong-value-type", "$.samples")
        } else if (samplesValue is JsonValue.Arr) {
            if (samplesValue.items.size > 32) {
                errors += ValidationError("too-many-samples", "$.samples")
            }
            val seen = LinkedHashSet<String>()
            val present = LinkedHashSet<String>()
            for ((index, sample) in samplesValue.items.withIndex()) {
                validateSample(
                    sample,
                    "$.samples[$index]",
                    sentMonoMs,
                    accepted,
                    seen,
                    present,
                    errors
                )
            }
            if (accepted != null) {
                for (id in accepted) {
                    if (CapabilityId.fromWire(id) == null) {
                        errors += ValidationError("unknown-capability", "$.accepted")
                    }
                }
                for (id in accepted) {
                    if (CapabilityId.fromWire(id) != null && id !in present) {
                        errors += ValidationError("missing-capability", "$.accepted")
                    }
                }
            }
        }

        return errors
    }

    private fun validateSample(
        sample: JsonValue,
        path: String,
        sentMonoMs: Long?,
        accepted: Set<String>?,
        seen: MutableSet<String>,
        present: MutableSet<String>,
        errors: MutableList<ValidationError>
    ) {
        if (sample !is JsonValue.Obj) {
            errors += ValidationError("wrong-value-type", path)
            return
        }

        val idValue = sample.field("id")
        var id: CapabilityId? = null
        if (idValue != null) {
            if (idValue !is JsonValue.Str) {
                errors += ValidationError("wrong-value-type", "$path.id")
            } else {
                id = CapabilityId.fromWire(idValue.value)
                if (id == null) {
                    errors += ValidationError("unknown-capability", "$path.id")
                } else {
                    present += id.wireId
                    if (!seen.add(id.wireId)) {
                        errors += ValidationError("duplicate-capability", "$path.id")
                    }
                    if (accepted != null && id.wireId !in accepted) {
                        errors += ValidationError("unapproved-capability", "$path.id")
                    }
                }
            }
        }

        val qualityValue = sample.field("quality")
        var quality: String? = null
        if (qualityValue != null) {
            if (qualityValue !is JsonValue.Str || qualityValue.value !in qualities) {
                errors += ValidationError("wrong-value-type", "$path.quality")
            } else {
                quality = qualityValue.value
            }
        }

        val allowed = when (quality) {
            "missing" -> sampleKeys - "sampleMonoMs"
            null -> sampleKeys
            else -> sampleKeys
        }
        checkShape(sample, allowed, allowed, path, errors)

        val unitValue = sample.field("unit")
        if (unitValue != null) {
            if (unitValue !is JsonValue.Str) {
                errors += ValidationError("wrong-unit", "$path.unit")
            } else if (id != null && unitValue.value != CapabilityCatalog.definition(id).unit) {
                errors += ValidationError("wrong-unit", "$path.unit")
            }
        }

        val value = sample.field("value")
        if (value != null) {
            when (quality) {
                "valid" -> {
                    if (value is JsonValue.Null) {
                        errors += ValidationError("wrong-value-type", "$path.value")
                    } else if (id != null) {
                        validateValue(id, value, "$path.value", errors)
                    }
                }
                "invalid", "missing" -> {
                    if (value !is JsonValue.Null) {
                        errors += ValidationError("wrong-value-type", "$path.value")
                    }
                }
            }
        }

        val timeValue = sample.field("sampleMonoMs")
        if (quality == "missing") {
            if (timeValue != null) {
                errors += ValidationError("missing-time-rule", "$path.sampleMonoMs")
            }
        } else if (quality == "valid" || quality == "invalid") {
            if (timeValue != null) {
                val sampleMonoMs = validateTime(timeValue, "$path.sampleMonoMs", errors)
                if (sampleMonoMs != null && sentMonoMs != null && sampleMonoMs > sentMonoMs) {
                    errors += ValidationError("sample-after-send", "$path.sampleMonoMs")
                }
            }
        }
    }

    private fun validateValue(
        id: CapabilityId,
        value: JsonValue,
        path: String,
        errors: MutableList<ValidationError>
    ) {
        val definition = CapabilityCatalog.definition(id)
        when (definition.kind) {
            ValueKind.INTEGER -> {
                if (value !is JsonValue.Num || !value.value.isFinite()) {
                    errors += ValidationError("wrong-value-type", path)
                    return
                }
                if (abs(value.value) > MAX_SAFE_INTEGER.toDouble()) {
                    errors += ValidationError("unsafe-integer", path)
                    return
                }
                if (value.value != floor(value.value)) {
                    errors += ValidationError("wrong-value-type", path)
                    return
                }
                if (definition.minimum != null && value.value < definition.minimum) {
                    errors += ValidationError("wrong-value-type", path)
                } else if (definition.maximum != null && value.value > definition.maximum) {
                    errors += ValidationError("wrong-value-type", path)
                }
            }
            ValueKind.DECIMAL -> {
                if (value !is JsonValue.Num || !value.value.isFinite()) {
                    errors += ValidationError("wrong-value-type", path)
                }
            }
            ValueKind.TEXT -> {
                if (value !is JsonValue.Str || value.value !in definition.enumValues) {
                    errors += ValidationError("wrong-value-type", path)
                }
            }
            ValueKind.VECTOR3 -> {
                if (value !is JsonValue.Arr) {
                    errors += ValidationError("wrong-value-type", path)
                } else if (
                    value.items.size != 3 ||
                    value.items.any { it !is JsonValue.Num || !it.value.isFinite() }
                ) {
                    errors += ValidationError("invalid-vector", path)
                }
            }
            ValueKind.NETWORK -> validateNetwork(value, path, errors)
        }
    }

    private fun validateNetwork(
        value: JsonValue,
        path: String,
        errors: MutableList<ValidationError>
    ) {
        if (value !is JsonValue.Obj) {
            errors += ValidationError("wrong-value-type", path)
            return
        }
        val allowed = setOf("transport", "internetCapable", "validated")
        checkShape(value, allowed, allowed, path, errors)

        val transportValue = value.field("transport")
        var transport: String? = null
        if (transportValue != null) {
            if (transportValue !is JsonValue.Str || transportValue.value !in transports) {
                errors += ValidationError("wrong-value-type", "$path.transport")
            } else {
                transport = transportValue.value
            }
        }

        val internet = readBoolean(value, "internetCapable", path, errors)
        val validated = readBoolean(value, "validated", path, errors)
        if (transport == "none" && (internet == true || validated == true)) {
            errors += ValidationError("wrong-value-type", path)
        }
    }

    private fun readBoolean(
        value: JsonValue.Obj,
        name: String,
        path: String,
        errors: MutableList<ValidationError>
    ): Boolean? {
        val field = value.field(name) ?: return null
        if (field !is JsonValue.Bool) {
            errors += ValidationError("wrong-value-type", "$path.$name")
            return null
        }
        return field.value
    }

    private fun validateSeq(
        value: JsonValue?,
        path: String,
        errors: MutableList<ValidationError>
    ): Long? {
        if (value == null) return null
        if (value !is JsonValue.Num || !value.value.isFinite()) {
            errors += ValidationError("sequence-range", path)
            return null
        }
        if (value.value > MAX_SAFE_INTEGER.toDouble()) {
            errors += ValidationError("unsafe-integer", path)
            return null
        }
        if (value.value < 1 || value.value != floor(value.value)) {
            errors += ValidationError("sequence-range", path)
            return null
        }
        return value.value.toLong()
    }

    private fun validateTime(
        value: JsonValue?,
        path: String,
        errors: MutableList<ValidationError>
    ): Long? {
        if (value == null) return null
        if (value !is JsonValue.Num || !value.value.isFinite()) {
            errors += ValidationError("wrong-value-type", path)
            return null
        }
        if (value.value < 0) {
            errors += ValidationError("negative-time", path)
            return null
        }
        if (value.value > MAX_SAFE_INTEGER.toDouble()) {
            errors += ValidationError("unsafe-integer", path)
            return null
        }
        if (value.value != floor(value.value)) {
            errors += ValidationError("wrong-value-type", path)
            return null
        }
        return value.value.toLong()
    }

    private fun checkShape(
        value: JsonValue.Obj,
        allowed: Set<String>,
        required: Set<String>,
        path: String,
        errors: MutableList<ValidationError>
    ) {
        val keys = value.entries.map { it.first }.toSet()
        for (key in keys) {
            if (key !in allowed) {
                errors += ValidationError("extra-field", "$path.$key")
            }
        }
        for (key in required) {
            if (key !in keys) {
                errors += ValidationError("missing-field", "$path.$key")
            }
        }
    }

    private fun JsonValue.Obj.field(name: String): JsonValue? =
        entries.firstOrNull { it.first == name }?.second
}
