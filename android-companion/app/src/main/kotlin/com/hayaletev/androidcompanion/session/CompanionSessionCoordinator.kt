package com.hayaletev.androidcompanion.session

import android.content.Context
import android.content.Intent
import com.hayaletev.androidcompanion.R
import com.hayaletev.androidcompanion.capture.CameraSessionConfig
import com.hayaletev.androidcompanion.capture.CameraSessionController
import com.hayaletev.androidcompanion.capture.CaptureLens
import com.hayaletev.androidcompanion.capture.CapturePhotoQuality
import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import com.hayaletev.androidcompanion.model.CompanionManifest
import com.hayaletev.androidcompanion.speech.CommandPhraseCatalog
import com.hayaletev.androidcompanion.speech.CommandSpeechConfig
import com.hayaletev.androidcompanion.speech.CommandSpeechController
import com.hayaletev.androidcompanion.speech.CommandSpeechResult
import com.hayaletev.androidcompanion.speech.SpeechFallbackMode
import com.hayaletev.androidcompanion.transport.BridgeCommand
import com.hayaletev.androidcompanion.transport.BridgeCommandProfile
import com.hayaletev.androidcompanion.transport.BridgePermissions
import com.hayaletev.androidcompanion.transport.DesktopBridgeClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

data class CompanionUiState(
    val connectionStatus: String,
    val target: String,
    val permissionsSummary: String,
)

data class CompanionLaunchContext(
    val deviceId: String = "android-companion",
    val target: String = "analyze-compose",
    val cameraConfig: CameraSessionConfig = CameraSessionConfig(),
    val speechConfig: CommandSpeechConfig = CommandSpeechConfig(),
)

class CompanionSessionCoordinator(
    private val appContext: Context,
    private val scope: CoroutineScope,
    private val manifest: CompanionManifest,
    private val bridgeClient: DesktopBridgeClient,
    private val cameraController: CameraSessionController,
    private val onUiState: (CompanionUiState) -> Unit,
) {
    private var launchContext = CompanionLaunchContext()
    private var pollJob: Job? = null
    private var lastBridgeFailureSignature: String? = null
    private var lastDiagnosticsSyncFailureSignature: String? = null
    private var bridgeConnected = false
    private val speechController =
        CommandSpeechController(appContext, scope) { result ->
            scope.launch {
                runCatching {
                    bridgeClient.submitTranscript(
                        deviceId = launchContext.deviceId,
                        target = launchContext.target,
                        text = result.transcript,
                        isFinal = true,
                        metadata = buildTranscriptMetadata(result),
                    )
                }.onFailure { error ->
                    CompanionDiagnostics.w(
                        "speech",
                        "Transcript submission failed.",
                        throwable = error,
                    )
                }
            }
        }

    fun updateLaunchContext(intent: Intent?) {
        val deviceId = intent?.getStringExtra("deviceId")?.trim().orEmpty()
        val target = intent?.getStringExtra("target")?.trim().orEmpty()
        val speechEnabled = intent?.getBooleanExtra("speechEnabled", true) ?: true
        val fallbackMode =
            when (intent?.getStringExtra("speechFallbackMode")) {
                "vosk-seam" -> SpeechFallbackMode.VOSK_SEAM
                else -> SpeechFallbackMode.SYSTEM
            }
        val phraseCatalog = parsePhraseCatalog(intent?.getStringExtra("commandCatalogJson"))

        launchContext =
            launchContext.copy(
                deviceId = if (deviceId.isNotEmpty()) deviceId else launchContext.deviceId,
                target = if (target.isNotEmpty()) target else launchContext.target,
                cameraConfig =
                    CameraSessionConfig(
                        lens =
                            if (intent?.getStringExtra("defaultLens") == "front") {
                                CaptureLens.FRONT
                            } else {
                                CaptureLens.BACK
                            },
                        photoQuality =
                            if (intent?.getStringExtra("photoQuality") == "balanced") {
                                CapturePhotoQuality.BALANCED
                            } else {
                                CapturePhotoQuality.HIGH
                            },
                    ),
                speechConfig =
                    CommandSpeechConfig(
                        enabled = speechEnabled,
                        fallbackMode = fallbackMode,
                        phraseCatalog = phraseCatalog,
                    ),
            )

        speechController.updateConfig(launchContext.speechConfig)
        publishLaunchContextDiagnostics()
        CompanionDiagnostics.i(
            "intent",
            "Launch context updated.",
            buildLaunchContextSummary(),
        )
        onUiState(
            CompanionUiState(
                connectionStatus = appContext.getString(R.string.status_waiting_desktop),
                target = launchContext.target,
                permissionsSummary = appContext.getString(R.string.permissions_missing),
            )
        )
    }

    fun start(hasPermissions: () -> Boolean) {
        if (pollJob != null) {
            CompanionDiagnostics.d("session", "Desktop session loop is already running.")
            return
        }

        CompanionDiagnostics.i("session", "Starting desktop session loop.")
        CompanionDiagnostics.setState("Session loop", "Running")
        pollJob =
            scope.launch(Dispatchers.Main.immediate) {
                while (isActive) {
                    if (!hasPermissions()) {
                        bridgeConnected = false
                        CompanionDiagnostics.setState("Bridge", "Blocked by missing permissions")
                        onUiState(
                            CompanionUiState(
                                connectionStatus = appContext.getString(R.string.status_permissions_required),
                                target = launchContext.target,
                                permissionsSummary = appContext.getString(R.string.permissions_missing),
                            )
                        )
                        delay(manifest.commandPollIntervalMs.toLong())
                        continue
                    }

                    try {
                        onUiState(
                            CompanionUiState(
                                connectionStatus = appContext.getString(R.string.status_connecting_desktop),
                                target = launchContext.target,
                                permissionsSummary = appContext.getString(R.string.permissions_ready),
                            )
                        )

                        val commands =
                            bridgeClient.registerSession(
                                deviceId = launchContext.deviceId,
                                target = launchContext.target,
                                permissions = BridgePermissions(camera = "granted", microphone = "granted"),
                                previewActive = cameraController.isPreviewBound(),
                            ) + bridgeClient.pollCommands(launchContext.deviceId)
                        CompanionDiagnostics.setState("Bridge", "Connected")
                        CompanionDiagnostics.clearState("Last bridge error")
                        if (bridgeConnected.not()) {
                            CompanionDiagnostics.i(
                                "bridge",
                                "Desktop bridge connected.",
                                buildLaunchContextSummary(),
                            )
                        }
                        bridgeConnected = true
                        lastBridgeFailureSignature = null
                        if (commands.isNotEmpty()) {
                            CompanionDiagnostics.i(
                                "bridge",
                                "Received ${commands.size} command(s) from desktop.",
                                commands.joinToString(", ") { it.kind },
                            )
                        }

                        onUiState(
                            CompanionUiState(
                                connectionStatus = appContext.getString(R.string.status_connected_desktop),
                                target = launchContext.target,
                                permissionsSummary = appContext.getString(R.string.permissions_ready),
                            )
                        )

                        commands.distinctBy { it.id }.forEach { command ->
                            handleCommand(command)
                        }
                        syncDiagnosticsSnapshot()
                    } catch (error: Exception) {
                        bridgeConnected = false
                        val errorSignature = summarizeError(error)
                        CompanionDiagnostics.setState("Bridge", "Waiting for desktop")
                        CompanionDiagnostics.setState("Last bridge error", errorSignature)
                        if (lastBridgeFailureSignature != errorSignature) {
                            CompanionDiagnostics.w(
                                "bridge",
                                "Desktop bridge loop is waiting for a healthy connection.",
                                throwable = error,
                            )
                        }
                        lastBridgeFailureSignature = errorSignature
                        onUiState(
                            CompanionUiState(
                                connectionStatus = appContext.getString(R.string.status_waiting_desktop),
                                target = launchContext.target,
                                permissionsSummary = appContext.getString(R.string.permissions_ready),
                            )
                        )
                    }

                    delay(manifest.commandPollIntervalMs.toLong())
                }
            }
    }

    fun stop() {
        CompanionDiagnostics.i("session", "Stopping desktop session loop.")
        pollJob?.cancel()
        pollJob = null
        bridgeConnected = false
        CompanionDiagnostics.setState("Session loop", "Stopped")
        CompanionDiagnostics.setState("Bridge", "Idle")
        speechController.stop()
        cameraController.stopSession()
    }

    fun destroy() {
        CompanionDiagnostics.i("session", "Destroying session coordinator.")
        stop()
        speechController.destroy()
    }

    private suspend fun handleCommand(command: BridgeCommand) {
        applyCommandProfile(command.profile)
        CompanionDiagnostics.setState("Last command", command.kind)
        CompanionDiagnostics.i(
            "command",
            "Handling command ${command.kind}.",
            "target=${command.target}",
        )
        runCatching {
            when (command.kind) {
                "open-camera" -> {
                    cameraController.ensurePreview(launchContext.cameraConfig)
                    if (launchContext.speechConfig.enabled) {
                        speechController.start()
                    }
                    bridgeClient.acknowledgeCommand(
                        deviceId = launchContext.deviceId,
                        command = command,
                        status = "accepted",
                        message = "Phone preview is active.",
                        previewActive = cameraController.isPreviewBound(),
                    )
                }

                "capture-photo" -> {
                    cameraController.ensurePreview(launchContext.cameraConfig)
                    val file = File.createTempFile("analyze-capture-", ".jpg", appContext.cacheDir)
                    val captured = cameraController.takePhoto(file)
                    bridgeClient.uploadAnalyzeCapture(launchContext.deviceId, captured)
                    bridgeClient.acknowledgeCommand(
                        deviceId = launchContext.deviceId,
                        command = command,
                        status = "done",
                        message = "Phone capture uploaded to Hayalet Ev.",
                        previewActive = cameraController.isPreviewBound(),
                    )
                }

                "retake-photo" -> {
                    cameraController.ensurePreview(launchContext.cameraConfig)
                    bridgeClient.acknowledgeCommand(
                        deviceId = launchContext.deviceId,
                        command = command,
                        status = "accepted",
                        message = "Ready to retake the phone capture.",
                        previewActive = cameraController.isPreviewBound(),
                    )
                }

                "close-camera" -> {
                    speechController.stop()
                    cameraController.stopSession()
                    bridgeClient.acknowledgeCommand(
                        deviceId = launchContext.deviceId,
                        command = command,
                        status = "done",
                        message = "Phone capture session closed.",
                        previewActive = cameraController.isPreviewBound(),
                    )
                }
            }
        }.onFailure { error ->
            CompanionDiagnostics.e(
                "command",
                "Command ${command.kind} failed.",
                throwable = error,
            )
            CompanionDiagnostics.setState("Last bridge error", summarizeError(error))
            throw error
        }
    }

    private fun buildTranscriptMetadata(result: CommandSpeechResult): JSONObject {
        val metadata = JSONObject().put("speechBackend", result.backend)
        result.commandCandidate?.let { candidate ->
            metadata.put(
                "commandCandidate",
                JSONObject()
                    .put("intent", candidate.intent)
                    .put("matchedPhrase", candidate.matchedPhrase),
            )
        }
        return metadata
    }

    private fun parsePhraseCatalog(rawJson: String?): CommandPhraseCatalog {
        if (rawJson.isNullOrBlank()) {
            return CommandPhraseCatalog()
        }

        val parsed = runCatching { JSONObject(rawJson) }.getOrNull() ?: return CommandPhraseCatalog()
        return CommandPhraseCatalog(
            openCamera = parsed.readPhraseList("openCamera"),
            capture = parsed.readPhraseList("capture"),
            retake = parsed.readPhraseList("retake"),
            attach = parsed.readPhraseList("attach"),
            stop = parsed.readPhraseList("stop"),
            cancel = parsed.readPhraseList("cancel"),
        )
    }

    private fun applyCommandProfile(profile: BridgeCommandProfile?) {
        if (profile == null) {
            return
        }

        val phraseCatalog =
            launchContext.speechConfig.phraseCatalog.copy(
                openCamera =
                    profile.commandPhrases.openCamera.takeIf { it.isNotEmpty() }
                        ?: launchContext.speechConfig.phraseCatalog.openCamera,
                capture =
                    profile.commandPhrases.capture.takeIf { it.isNotEmpty() }
                        ?: launchContext.speechConfig.phraseCatalog.capture,
                retake =
                    profile.commandPhrases.retake.takeIf { it.isNotEmpty() }
                        ?: launchContext.speechConfig.phraseCatalog.retake,
                attach =
                    profile.commandPhrases.attach.takeIf { it.isNotEmpty() }
                        ?: launchContext.speechConfig.phraseCatalog.attach,
                stop =
                    profile.commandPhrases.stop.takeIf { it.isNotEmpty() }
                        ?: launchContext.speechConfig.phraseCatalog.stop,
                cancel =
                    profile.commandPhrases.cancel.takeIf { it.isNotEmpty() }
                        ?: launchContext.speechConfig.phraseCatalog.cancel,
            )

        launchContext =
            launchContext.copy(
                cameraConfig =
                    launchContext.cameraConfig.copy(
                        lens =
                            when (profile.defaultLens) {
                                "front" -> CaptureLens.FRONT
                                "back" -> CaptureLens.BACK
                                else -> launchContext.cameraConfig.lens
                            },
                        photoQuality =
                            when (profile.photoQuality) {
                                "balanced" -> CapturePhotoQuality.BALANCED
                                "high" -> CapturePhotoQuality.HIGH
                                else -> launchContext.cameraConfig.photoQuality
                            },
                    ),
                speechConfig = launchContext.speechConfig.copy(phraseCatalog = phraseCatalog),
            )

        speechController.updateConfig(launchContext.speechConfig)
        publishLaunchContextDiagnostics()
        CompanionDiagnostics.d(
            "command",
            "Applied command profile overrides.",
            "defaultLens=${profile.defaultLens ?: "unchanged"}, photoQuality=${profile.photoQuality ?: "unchanged"}",
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

    private fun publishLaunchContextDiagnostics() {
        CompanionDiagnostics.setState("Device", launchContext.deviceId)
        CompanionDiagnostics.setState("Target", launchContext.target)
        CompanionDiagnostics.setState(
            "Camera config",
            "${launchContext.cameraConfig.lens.name.lowercase()} / ${launchContext.cameraConfig.photoQuality.name.lowercase()}",
        )
        CompanionDiagnostics.setState(
            "Speech",
            if (launchContext.speechConfig.enabled) {
                "Enabled (${launchContext.speechConfig.fallbackMode.name.lowercase()})"
            } else {
                "Disabled"
            },
        )
    }

    private fun buildLaunchContextSummary(): String {
        return buildString {
            append("deviceId=")
            append(launchContext.deviceId)
            append(", target=")
            append(launchContext.target)
            append(", lens=")
            append(launchContext.cameraConfig.lens.name.lowercase())
            append(", photoQuality=")
            append(launchContext.cameraConfig.photoQuality.name.lowercase())
            append(", speechEnabled=")
            append(launchContext.speechConfig.enabled)
            append(", fallback=")
            append(launchContext.speechConfig.fallbackMode.name.lowercase())
        }
    }

    private suspend fun syncDiagnosticsSnapshot() {
        runCatching {
            bridgeClient.submitDiagnosticsSnapshot(launchContext.deviceId)
        }.onSuccess {
            if (lastDiagnosticsSyncFailureSignature != null) {
                CompanionDiagnostics.i("diagnostics", "Desktop diagnostics shadow sync recovered.")
            }
            lastDiagnosticsSyncFailureSignature = null
        }.onFailure { error ->
            val errorSignature = summarizeError(error)
            if (lastDiagnosticsSyncFailureSignature != errorSignature) {
                CompanionDiagnostics.w(
                    "diagnostics",
                    "Desktop diagnostics shadow sync failed.",
                    throwable = error,
                )
            }
            lastDiagnosticsSyncFailureSignature = errorSignature
        }
    }

    private fun summarizeError(error: Throwable): String {
        val message = error.message?.trim().takeUnless { it.isNullOrEmpty() } ?: "No detail"
        return "${error::class.simpleName}: $message"
    }
}
