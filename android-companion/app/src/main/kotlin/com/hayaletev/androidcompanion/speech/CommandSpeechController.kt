package com.hayaletev.androidcompanion.speech

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale

enum class SpeechFallbackMode {
    SYSTEM,
    VOSK_SEAM,
}

data class CommandPhraseCatalog(
    val openCamera: List<String> = emptyList(),
    val capture: List<String> = emptyList(),
    val retake: List<String> = emptyList(),
    val attach: List<String> = emptyList(),
    val stop: List<String> = emptyList(),
    val cancel: List<String> = emptyList(),
) {
    fun detect(text: String): CommandCandidate? {
        val normalizedText = normalizePhrase(text)
        if (normalizedText.isBlank()) {
            return null
        }

        val intents = listOf(
            "open-camera" to openCamera,
            "capture" to capture,
            "retake" to retake,
            "attach" to attach,
            "stop" to stop,
            "cancel" to cancel,
        )
        intents.forEach { (intent, phrases) ->
            val match = phrases
                .map(::normalizePhrase)
                .firstOrNull { phrase ->
                    phrase.isNotBlank() &&
                        (normalizedText == phrase || normalizedText.contains(phrase))
                }
            if (match != null) {
                return CommandCandidate(intent = intent, matchedPhrase = match)
            }
        }

        return null
    }

    companion object {
        private fun normalizePhrase(value: String): String {
            return value
                .trim()
                .lowercase(Locale.ROOT)
                .replace(Regex("[^\\p{L}\\p{N}\\s]"), " ")
                .replace(Regex("\\s+"), " ")
                .trim()
        }
    }
}

data class CommandCandidate(
    val intent: String,
    val matchedPhrase: String,
)

data class CommandSpeechConfig(
    val enabled: Boolean = true,
    val fallbackMode: SpeechFallbackMode = SpeechFallbackMode.SYSTEM,
    val phraseCatalog: CommandPhraseCatalog = CommandPhraseCatalog(),
)

data class CommandSpeechResult(
    val transcript: String,
    val backend: String,
    val commandCandidate: CommandCandidate?,
)

private enum class SpeechBackendKind(val wireValue: String) {
    ON_DEVICE("on-device"),
    SYSTEM("system"),
    VOSK_SEAM("vosk-seam"),
    UNAVAILABLE("unavailable"),
}

class CommandSpeechController(
    private val context: Context,
    private val scope: CoroutineScope,
    private val onFinalTranscript: (CommandSpeechResult) -> Unit,
) {
    private var speechRecognizer: SpeechRecognizer? = null
    private var restartJob: Job? = null
    private var active = false
    private var config = CommandSpeechConfig()
    private var backendKind = SpeechBackendKind.UNAVAILABLE

    private val recognitionListener =
        object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = scheduleRestart()

            override fun onError(error: Int) {
                CompanionDiagnostics.w("speech", "Speech recognizer reported error code $error.")
                scheduleRestart()
            }

            override fun onResults(results: Bundle?) {
                val text = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    ?.trim()
                    .orEmpty()
                if (text.isNotEmpty()) {
                    val commandCandidate = config.phraseCatalog.detect(text)
                    CompanionDiagnostics.i(
                        "speech",
                        "Speech transcript captured.",
                        "backend=${backendKind.wireValue}, command=${commandCandidate?.intent ?: "none"}, text=${text.take(160)}",
                    )
                    onFinalTranscript(
                        CommandSpeechResult(
                            transcript = text,
                            backend = backendKind.wireValue,
                            commandCandidate = commandCandidate,
                        )
                    )
                }
                scheduleRestart()
            }

            override fun onPartialResults(partialResults: Bundle?) = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        }

    fun updateConfig(nextConfig: CommandSpeechConfig) {
        config = nextConfig
        CompanionDiagnostics.i(
            "speech",
            "Speech config updated.",
            "enabled=${config.enabled}, fallback=${config.fallbackMode.name.lowercase()}, openCameraPhrases=${config.phraseCatalog.openCamera.size}",
        )
        CompanionDiagnostics.setState(
            "Speech",
            if (config.enabled) {
                "Enabled (${config.fallbackMode.name.lowercase()})"
            } else {
                "Disabled"
            },
        )
        recreateRecognizer()
        if (active) {
            startListening()
        }
    }

    fun start() {
        if (active) {
            return
        }

        active = true
        CompanionDiagnostics.i("speech", "Starting speech controller.")
        startListening()
    }

    fun stop() {
        if (active) {
            CompanionDiagnostics.i("speech", "Stopping speech controller.")
        }
        active = false
        restartJob?.cancel()
        restartJob = null
        speechRecognizer?.cancel()
    }

    fun destroy() {
        stop()
        speechRecognizer?.destroy()
        speechRecognizer = null
    }

    private fun recreateRecognizer() {
        speechRecognizer?.destroy()
        speechRecognizer = null
        backendKind = SpeechBackendKind.UNAVAILABLE
        CompanionDiagnostics.setState("Speech backend", backendKind.wireValue)
    }

    private fun scheduleRestart() {
        if (!active) {
            return
        }

        restartJob?.cancel()
        restartJob =
            scope.launch(Dispatchers.Main.immediate) {
                delay(400)
                if (active) {
                    startListening()
                }
            }
    }

    private fun startListening() {
        if (!active || config.enabled != true) {
            return
        }

        val recognizer = ensureRecognizer() ?: run {
            CompanionDiagnostics.w("speech", "Speech recognizer is unavailable on this device.")
            return
        }
        recognizer.cancel()
        recognizer.startListening(buildRecognizerIntent())
    }

    private fun ensureRecognizer(): SpeechRecognizer? {
        if (speechRecognizer != null) {
            return speechRecognizer
        }

        val recognizer = createRecognizer() ?: return null
        recognizer.setRecognitionListener(recognitionListener)
        speechRecognizer = recognizer
        return recognizer
    }

    private fun createRecognizer(): SpeechRecognizer? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val onDeviceAvailable =
                runCatching { SpeechRecognizer.isOnDeviceRecognitionAvailable(context) }
                    .getOrDefault(false)
            if (onDeviceAvailable) {
                backendKind = SpeechBackendKind.ON_DEVICE
                CompanionDiagnostics.i("speech", "Using on-device speech recognizer.")
                CompanionDiagnostics.setState("Speech backend", backendKind.wireValue)
                return SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
            }
        }

        return when (config.fallbackMode) {
            SpeechFallbackMode.SYSTEM -> {
                if (SpeechRecognizer.isRecognitionAvailable(context)) {
                    backendKind = SpeechBackendKind.SYSTEM
                    CompanionDiagnostics.i("speech", "Using system speech recognizer.")
                    CompanionDiagnostics.setState("Speech backend", backendKind.wireValue)
                    SpeechRecognizer.createSpeechRecognizer(context)
                } else {
                    backendKind = SpeechBackendKind.UNAVAILABLE
                    CompanionDiagnostics.w("speech", "System speech recognition is unavailable.")
                    CompanionDiagnostics.setState("Speech backend", backendKind.wireValue)
                    null
                }
            }

            SpeechFallbackMode.VOSK_SEAM -> {
                backendKind = SpeechBackendKind.VOSK_SEAM
                CompanionDiagnostics.w("speech", "Vosk seam fallback is not implemented yet.")
                CompanionDiagnostics.setState("Speech backend", backendKind.wireValue)
                null
            }
        }
    }

    private fun buildRecognizerIntent(): Intent {
        return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
        }
    }
}
