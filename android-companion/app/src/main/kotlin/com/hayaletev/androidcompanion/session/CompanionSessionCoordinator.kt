package com.hayaletev.androidcompanion.session

import android.content.Context
import android.content.Intent
import android.os.SystemClock
import com.hayaletev.androidcompanion.R
import com.hayaletev.androidcompanion.capture.CameraSessionConfig
import com.hayaletev.androidcompanion.capture.CameraSessionController
import com.hayaletev.androidcompanion.capture.CaptureLens
import com.hayaletev.androidcompanion.capture.CapturePhotoQuality
import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import com.hayaletev.androidcompanion.model.CompanionManifest
import com.hayaletev.androidcompanion.transcript.AndroidAudioRecorder
import com.hayaletev.androidcompanion.transcript.AndroidRecordingResult
import com.hayaletev.androidcompanion.transcript.AndroidVoskTranscriber
import com.hayaletev.androidcompanion.transcript.TranscriptModelManager
import com.hayaletev.androidcompanion.transcript.requireAndroidVoskModelProfile
import com.hayaletev.androidcompanion.transport.BridgeCommand
import com.hayaletev.androidcompanion.transport.BridgeCommandProfile
import com.hayaletev.androidcompanion.transport.BridgePermissions
import com.hayaletev.androidcompanion.transport.BridgeTranscriptModelProfile
import com.hayaletev.androidcompanion.transport.DesktopBridgeClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

private const val BRIDGE_OFFLINE_RETRY_MS = 5_000L
private const val DIAGNOSTICS_SYNC_INTERVAL_MS = 15_000L

data class CompanionUiState(
    val connectionStatus: String,
    val target: String,
    val permissionsSummary: String,
    val dictationStatus: String? = null,
    val dictationDetail: String? = null,
    val dictationModel: String? = null,
)

data class CompanionLaunchContext(
    val deviceId: String = "android-companion",
    val target: String = "analyze-compose",
    val cameraConfig: CameraSessionConfig = CameraSessionConfig(),
    val transcriptModel: BridgeTranscriptModelProfile? = null,
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
    private var lastDiagnosticsSyncAtMs = -DIAGNOSTICS_SYNC_INTERVAL_MS
    private var lastUiState: CompanionUiState? = null
    private var bridgeConnected = false
    private val audioRecorder = AndroidAudioRecorder(appContext, scope)
    private val modelManager = TranscriptModelManager(appContext, bridgeClient)
    private val voskTranscriber = AndroidVoskTranscriber()
    private var dictationStatus = appContext.getString(R.string.dictation_status_idle)
    private var dictationDetail = appContext.getString(R.string.dictation_detail_waiting)

    fun updateLaunchContext(intent: Intent?) {
        val deviceId = intent?.getStringExtra("deviceId")?.trim().orEmpty()
        val target = intent?.getStringExtra("target")?.trim().orEmpty()

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
            )

        publishLaunchContextDiagnostics()
        CompanionDiagnostics.i(
            "intent",
            "Launch context updated.",
            buildLaunchContextSummary(),
        )
        publishUiState(
            connectionStatus = appContext.getString(R.string.status_waiting_desktop),
            permissionsSummary = appContext.getString(R.string.permissions_missing),
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
                        publishUiState(
                            connectionStatus = appContext.getString(R.string.status_permissions_required),
                            permissionsSummary = appContext.getString(R.string.permissions_missing),
                        )
                        delay(BRIDGE_OFFLINE_RETRY_MS)
                        continue
                    }

                    var nextDelayMs = manifest.commandPollIntervalMs.toLong()
                    try {
                        if (bridgeConnected.not() && lastBridgeFailureSignature == null) {
                            publishUiState(
                                connectionStatus = appContext.getString(R.string.status_connecting_desktop),
                                permissionsSummary = appContext.getString(R.string.permissions_ready),
                            )
                        }

                        val commands =
                            bridgeClient.registerSession(
                                deviceId = launchContext.deviceId,
                                target = launchContext.target,
                                permissions = BridgePermissions(camera = "granted", microphone = "granted"),
                                previewActive = cameraController.isPreviewBound(),
                                reportFailureToDiagnostics = false,
                            ) + bridgeClient.pollCommands(
                                launchContext.deviceId,
                                reportFailureToDiagnostics = false,
                            )
                        val uniqueCommands = commands.distinctBy { it.id }
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
                        if (uniqueCommands.isNotEmpty()) {
                            CompanionDiagnostics.i(
                                "bridge",
                                "Received ${uniqueCommands.size} command(s) from desktop.",
                                uniqueCommands.joinToString(", ") { it.kind },
                            )
                        }

                        publishUiState(
                            connectionStatus = appContext.getString(R.string.status_connected_desktop),
                            permissionsSummary = appContext.getString(R.string.permissions_ready),
                        )

                        uniqueCommands.forEach { command ->
                            handleCommand(command)
                        }
                        syncDiagnosticsSnapshotIfDue()
                    } catch (error: Exception) {
                        nextDelayMs = BRIDGE_OFFLINE_RETRY_MS
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
                        publishUiState(
                            connectionStatus = appContext.getString(R.string.status_waiting_desktop),
                            permissionsSummary = appContext.getString(R.string.permissions_ready),
                        )
                    }

                    delay(nextDelayMs)
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
        updateDictationUi(
            appContext.getString(R.string.dictation_status_idle),
            appContext.getString(R.string.dictation_detail_waiting),
        )
        audioRecorder.cancel()
        cameraController.stopSession()
    }

    fun destroy() {
        CompanionDiagnostics.i("session", "Destroying session coordinator.")
        stop()
    }

    suspend fun captureManualPhoto(): File {
        cameraController.ensurePreview(launchContext.cameraConfig)
        val file = File.createTempFile("analyze-capture-", ".jpg", appContext.cacheDir)
        val captured = cameraController.takePhoto(file)
        CompanionDiagnostics.i(
            "manual-image",
            "Manual phone capture completed.",
            "target=${launchContext.target}, file=${captured.name}",
        )
        return captured
    }

    suspend fun uploadManualPhoto(file: File) {
        bridgeClient.uploadAnalyzeCapture(
            deviceId = launchContext.deviceId,
            target = launchContext.target,
            requestId = "manual-${SystemClock.elapsedRealtime()}",
            file = file,
            stageForAnalyze = true,
        )
        CompanionDiagnostics.i(
            "manual-image",
            "Manual phone capture uploaded to Analyze.",
            "target=${launchContext.target}, file=${file.name}",
        )
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
                    bridgeClient.uploadAnalyzeCapture(
                        launchContext.deviceId,
                        command.target,
                        command.requestId ?: command.id,
                        captured,
                        stageForAnalyze = true,
                    )
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
                    audioRecorder.cancel()
                    updateDictationUi(
                        appContext.getString(R.string.dictation_status_idle),
                        appContext.getString(R.string.dictation_detail_waiting),
                    )
                    cameraController.stopSession()
                    bridgeClient.acknowledgeCommand(
                        deviceId = launchContext.deviceId,
                        command = command,
                        status = "done",
                        message = "Phone capture session closed.",
                        previewActive = cameraController.isPreviewBound(),
                    )
                }

                "start-dictation" -> {
                    val file = audioRecorder.start()
                    updateDictationUi(
                        appContext.getString(R.string.dictation_status_recording),
                        appContext.getString(R.string.dictation_detail_recording_file, file.name),
                    )
                    publishUiState(
                        connectionStatus = appContext.getString(R.string.status_connected_desktop),
                        permissionsSummary = appContext.getString(R.string.permissions_ready),
                    )
                    bridgeClient.acknowledgeCommand(
                        deviceId = launchContext.deviceId,
                        command = command,
                        status = "accepted",
                        message = "Android microphone recording started.",
                        previewActive = cameraController.isPreviewBound(),
                    )
                    CompanionDiagnostics.setState("Dictation recording", file.name)
                }

                "stop-dictation" -> {
                    val recording = audioRecorder.stop()
                    updateDictationUi(
                        appContext.getString(R.string.dictation_status_recorded),
                        appContext.getString(
                            R.string.dictation_detail_recorded,
                            recording.durationMs,
                            recording.bytesWritten,
                        ),
                    )
                    publishUiState(
                        connectionStatus = appContext.getString(R.string.status_connected_desktop),
                        permissionsSummary = appContext.getString(R.string.permissions_ready),
                    )
                    bridgeClient.acknowledgeCommand(
                        deviceId = launchContext.deviceId,
                        command = command,
                        status = "accepted",
                        message = "Android microphone recording stopped; transcribing on phone.",
                        previewActive = cameraController.isPreviewBound(),
                    )
                    updateDictationUi(
                        appContext.getString(R.string.dictation_status_transcribing),
                        appContext.getString(R.string.dictation_detail_transcribing),
                    )
                    publishUiState(
                        connectionStatus = appContext.getString(R.string.status_connected_desktop),
                        permissionsSummary = appContext.getString(R.string.permissions_ready),
                    )
                    val modelProfile = requireAndroidVoskModelProfile(launchContext.transcriptModel)
                    val model = modelManager.ensureModel(modelProfile)
                    val transcript =
                        voskTranscriber.transcribe(
                            modelDirectory = model,
                            audioFile = recording.file,
                            language = modelProfile.language,
                        )
                    bridgeClient.submitTranscript(
                        requestId = command.requestId ?: command.id,
                        deviceId = launchContext.deviceId,
                        target = command.target,
                        text = transcript,
                        isFinal = true,
                        metadata = buildTranscriptMetadata(recording, modelProfile),
                    )
                    updateDictationUi(
                        appContext.getString(R.string.dictation_status_done),
                        appContext.getString(
                            R.string.dictation_detail_done,
                            transcript.replace(Regex("\\s+"), " ").take(120),
                        ),
                    )
                    publishUiState(
                        connectionStatus = appContext.getString(R.string.status_connected_desktop),
                        permissionsSummary = appContext.getString(R.string.permissions_ready),
                    )
                    bridgeClient.acknowledgeCommand(
                        deviceId = launchContext.deviceId,
                        command = command,
                        status = "done",
                        message = "Android Vosk transcript submitted.",
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
            val errorSummary = summarizeError(error)
            CompanionDiagnostics.setState("Last bridge error", errorSummary)
            if (command.kind == "start-dictation") {
                audioRecorder.cancel()
            }
            if (command.kind == "start-dictation" || command.kind == "stop-dictation") {
                updateDictationUi(
                    appContext.getString(R.string.dictation_status_error),
                    errorSummary,
                )
                publishUiState(
                    connectionStatus = appContext.getString(R.string.status_connected_desktop),
                    permissionsSummary = appContext.getString(R.string.permissions_ready),
                )
            }
            runCatching {
                bridgeClient.acknowledgeCommand(
                    deviceId = launchContext.deviceId,
                    command = command,
                    status = "failed",
                    message = errorSummary,
                    previewActive = cameraController.isPreviewBound(),
                )
            }.onFailure { ackError ->
                CompanionDiagnostics.e(
                    "bridge",
                    "Failed to report command failure to desktop.",
                    throwable = ackError,
                )
            }
            throw error
        }
    }

    private fun buildUiState(connectionStatus: String, permissionsSummary: String): CompanionUiState {
        return CompanionUiState(
            connectionStatus = connectionStatus,
            target = launchContext.target,
            permissionsSummary = permissionsSummary,
            dictationStatus = dictationStatus,
            dictationDetail = dictationDetail,
            dictationModel =
                launchContext.transcriptModel?.let { "${it.backend} / ${it.modelId}" }
                    ?: appContext.getString(R.string.dictation_model_waiting),
        )
    }

    private fun publishUiState(connectionStatus: String, permissionsSummary: String) {
        val state =
            buildUiState(
                connectionStatus = connectionStatus,
                permissionsSummary = permissionsSummary,
            )
        if (state == lastUiState) {
            return
        }
        lastUiState = state
        onUiState(state)
    }

    private fun updateDictationUi(status: String, detail: String) {
        dictationStatus = status
        dictationDetail = detail
        CompanionDiagnostics.setState("Dictation", status)
        CompanionDiagnostics.setState("Dictation detail", detail)
    }

    private fun buildTranscriptMetadata(
        recording: AndroidRecordingResult,
        modelProfile: BridgeTranscriptModelProfile,
    ): JSONObject {
        return JSONObject()
            .put("speechBackend", "${modelProfile.backend}-android")
            .put("recordedOn", "android-device")
            .put("microphone", "android-default-mic")
            .put("audioPath", recording.file.absolutePath)
            .put("durationMs", recording.durationMs)
            .put("sampleRate", recording.sampleRate)
            .put("bytesWritten", recording.bytesWritten)
            .put("modelId", modelProfile.modelId)
            .put("modelFile", modelProfile.fileName)
            .put("language", modelProfile.language)
            .put("archiveFormat", modelProfile.archiveFormat)
    }

    private fun applyCommandProfile(profile: BridgeCommandProfile?) {
        if (profile == null) {
            return
        }

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
                transcriptModel = requireAndroidVoskModelProfile(profile.transcriptModel),
            )

        publishLaunchContextDiagnostics()
        CompanionDiagnostics.d(
            "command",
            "Applied command profile overrides.",
            "defaultLens=${profile.defaultLens ?: "unchanged"}, photoQuality=${profile.photoQuality ?: "unchanged"}, dictationBackend=vosk",
        )
    }

    private fun publishLaunchContextDiagnostics() {
        CompanionDiagnostics.setState("Device", launchContext.deviceId)
        CompanionDiagnostics.setState("Target", launchContext.target)
        CompanionDiagnostics.setState(
            "Camera config",
            "${launchContext.cameraConfig.lens.name.lowercase()} / ${launchContext.cameraConfig.photoQuality.name.lowercase()}",
        )
        CompanionDiagnostics.setState(
            "Transcript model",
            launchContext.transcriptModel?.modelId ?: "Waiting for desktop command",
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
            append(", transcriptModel=")
            append(launchContext.transcriptModel?.modelId ?: "pending")
        }
    }

    private suspend fun syncDiagnosticsSnapshotIfDue() {
        val now = SystemClock.elapsedRealtime()
        if (now - lastDiagnosticsSyncAtMs < DIAGNOSTICS_SYNC_INTERVAL_MS) {
            return
        }
        lastDiagnosticsSyncAtMs = now
        syncDiagnosticsSnapshot()
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
