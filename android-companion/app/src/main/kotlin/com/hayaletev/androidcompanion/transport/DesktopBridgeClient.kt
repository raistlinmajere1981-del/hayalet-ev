package com.hayaletev.androidcompanion.transport

import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import com.hayaletev.androidcompanion.model.CompanionManifest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

data class BridgeCommand(
    val id: String,
    val kind: String,
    val target: String,
    val profile: BridgeCommandProfile? = null,
)

data class BridgePermissions(
    val camera: String,
    val microphone: String
)

data class BridgeCommandPhraseProfile(
    val openCamera: List<String> = emptyList(),
    val capture: List<String> = emptyList(),
    val retake: List<String> = emptyList(),
    val attach: List<String> = emptyList(),
    val stop: List<String> = emptyList(),
    val cancel: List<String> = emptyList(),
)

data class BridgeCommandProfile(
    val defaultLens: String? = null,
    val photoQuality: String? = null,
    val commandPhrases: BridgeCommandPhraseProfile = BridgeCommandPhraseProfile(),
)

class DesktopBridgeClient(private val manifest: CompanionManifest) {
    private val client = OkHttpClient.Builder()
        .callTimeout(10, TimeUnit.SECONDS)
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val baseUrl = "http://127.0.0.1:${manifest.bridgePort}"

    init {
        CompanionDiagnostics.setState("Bridge endpoint", baseUrl)
    }

    suspend fun registerSession(
        deviceId: String,
        target: String,
        permissions: BridgePermissions,
        previewActive: Boolean
    ): List<BridgeCommand> {
        val payload = JSONObject()
            .put("deviceId", deviceId)
            .put("appVersion", manifest.versionName)
            .put("target", target)
            .put("transport", "adb-reverse")
            .put("previewActive", previewActive)
            .put(
                "permissions",
                JSONObject()
                    .put("camera", permissions.camera)
                    .put("microphone", permissions.microphone)
            )
        val response = postJson("/api/v1/session/register", payload)
        return parseCommands(response.optJSONArray("pendingCommands"))
    }

    suspend fun pollCommands(deviceId: String): List<BridgeCommand> {
        val response = getJson("/api/v1/session/commands?deviceId=$deviceId")
        val commands = parseCommands(response.optJSONArray("commands"))
        if (commands.isNotEmpty()) {
            CompanionDiagnostics.i(
                "bridge",
                "Desktop command queue returned ${commands.size} command(s).",
                commands.joinToString(", ") { it.kind },
            )
        }
        return commands
    }

    suspend fun acknowledgeCommand(
        deviceId: String,
        command: BridgeCommand,
        status: String,
        message: String,
        previewActive: Boolean? = null,
    ) {
        val payload = JSONObject()
            .put("deviceId", deviceId)
            .put("commandId", command.id)
            .put("kind", command.kind)
            .put("status", status)
            .put("message", message)
        if (previewActive != null) {
            payload.put("previewActive", previewActive)
        }
        postJson("/api/v1/session/ack", payload)
        CompanionDiagnostics.i(
            "bridge",
            "Acknowledged command ${command.kind}.",
            "status=$status, previewActive=$previewActive",
        )
    }

    suspend fun uploadAnalyzeCapture(
        deviceId: String,
        file: File
    ) {
        val bytes = withContext(Dispatchers.IO) { file.readBytes() }
        val payload = JSONObject()
            .put("deviceId", deviceId)
            .put("fileName", file.name)
            .put("contentBase64", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP))
        postJson("/api/v1/media/analyze", payload)
        CompanionDiagnostics.i(
            "bridge",
            "Uploaded analyze capture to desktop.",
            "file=${file.name}, bytes=${bytes.size}",
        )
    }

    suspend fun submitTranscript(
        deviceId: String,
        target: String,
        text: String,
        isFinal: Boolean,
        metadata: JSONObject? = null,
    ) {
        val payload = JSONObject()
            .put("deviceId", deviceId)
            .put("target", target)
            .put("text", text)
            .put("isFinal", isFinal)
        if (metadata != null) {
            payload.put("metadata", metadata)
        }
        postJson("/api/v1/transcript/ingress", payload)
        CompanionDiagnostics.d(
            "speech",
            "Submitted transcript to desktop bridge.",
            "target=$target, final=$isFinal",
        )
    }

    suspend fun submitDiagnosticsSnapshot(deviceId: String) {
        postJson(
            "/api/v1/diagnostics/snapshot",
            CompanionDiagnostics.buildSnapshotPayload(deviceId),
            reportFailureToDiagnostics = false,
        )
    }

    private suspend fun getJson(path: String): JSONObject = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    CompanionDiagnostics.e(
                        "bridge",
                        "GET $path failed with ${response.code}.",
                        body.ifBlank { "Bridge request failed." },
                    )
                    throw IllegalStateException(body.ifBlank { "Bridge request failed: ${response.code}" })
                }
                JSONObject(body.ifBlank { "{}" })
            }
        } catch (error: Exception) {
            CompanionDiagnostics.e("bridge", "GET $path failed.", throwable = error)
            throw error
        }
    }

    private suspend fun postJson(
        path: String,
        payload: JSONObject,
        reportFailureToDiagnostics: Boolean = true,
    ): JSONObject = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .post(payload.toString().toRequestBody(jsonMediaType))
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    if (reportFailureToDiagnostics) {
                        CompanionDiagnostics.e(
                            "bridge",
                            "POST $path failed with ${response.code}.",
                            body.ifBlank { "Bridge request failed." },
                        )
                    }
                    throw IllegalStateException(body.ifBlank { "Bridge request failed: ${response.code}" })
                }
                JSONObject(body.ifBlank { "{}" })
            }
        } catch (error: Exception) {
            if (reportFailureToDiagnostics) {
                CompanionDiagnostics.e("bridge", "POST $path failed.", throwable = error)
            }
            throw error
        }
    }

    private fun parseCommands(array: JSONArray?): List<BridgeCommand> {
        if (array == null) {
            return emptyList()
        }

        return buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val kind = item.optString("kind")
                val target = item.optString("target")
                if (id.isBlank() || kind.isBlank() || target.isBlank()) {
                    continue
                }
                add(
                    BridgeCommand(
                        id = id,
                        kind = kind,
                        target = target,
                        profile = item.optJSONObject("profile")?.toBridgeCommandProfile(),
                    )
                )
            }
        }
    }

    private fun JSONObject.toBridgeCommandProfile(): BridgeCommandProfile {
        val phrases =
            optJSONObject("commandPhrases")?.let { commandPhrases ->
                BridgeCommandPhraseProfile(
                    openCamera = commandPhrases.readPhraseList("openCamera"),
                    capture = commandPhrases.readPhraseList("capture"),
                    retake = commandPhrases.readPhraseList("retake"),
                    attach = commandPhrases.readPhraseList("attach"),
                    stop = commandPhrases.readPhraseList("stop"),
                    cancel = commandPhrases.readPhraseList("cancel"),
                )
            } ?: BridgeCommandPhraseProfile()

        return BridgeCommandProfile(
            defaultLens = optString("defaultLens").ifBlank { null },
            photoQuality = optString("photoQuality").ifBlank { null },
            commandPhrases = phrases,
        )
    }

    private fun JSONObject.readPhraseList(key: String): List<String> {
        val array = optJSONArray(key) ?: return emptyList()
        return buildList {
            for (index in 0 until array.length()) {
                val value = array.optString(index).trim()
                if (value.isNotEmpty() && contains(value).not()) {
                    add(value)
                }
            }
        }
    }
}
