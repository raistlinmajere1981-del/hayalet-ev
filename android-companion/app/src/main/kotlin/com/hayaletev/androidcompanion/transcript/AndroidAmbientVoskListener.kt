package com.hayaletev.androidcompanion.transcript

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import com.hayaletev.androidcompanion.transport.BridgeTranscriptModelProfile
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.text.Normalizer
import java.util.Locale

private const val AMBIENT_VOSK_SAMPLE_RATE = 16_000.0f
private const val AMBIENT_MIN_CAPTURE_MS = 500L

data class AndroidAmbientListenerConfig(
    val requestId: String,
    val target: String,
    val wakePhrases: List<String>,
    val activeWindowMs: Long,
    val silenceTimeoutMs: Long,
    val modelProfile: BridgeTranscriptModelProfile,
    val modelDirectory: File,
)

data class AndroidAmbientTranscript(
    val text: String,
    val wakePhrase: String,
    val activeWindowMs: Long,
    val silenceTimeoutMs: Long,
    val capturedMs: Long,
)

class AndroidAmbientVoskListener(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    private val sampleRate = 16_000
    private var recorder: AudioRecord? = null
    private var listenerJob: Job? = null

    fun isRunning(): Boolean = listenerJob?.isActive == true

    fun start(
        config: AndroidAmbientListenerConfig,
        onStatus: suspend (status: String, message: String, transcript: String?, metadata: JSONObject?) -> Unit,
        onTranscript: suspend (transcript: AndroidAmbientTranscript) -> Unit,
    ) {
        stop()
        if (
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            throw IllegalStateException("Android microphone permission is missing.")
        }

        val bufferSize = resolveBufferSize()
        val nextRecorder = createRecorder(bufferSize)
        if (nextRecorder.state != AudioRecord.STATE_INITIALIZED) {
            nextRecorder.release()
            throw IllegalStateException("Android ambient microphone recorder could not be initialized.")
        }

        recorder = nextRecorder
        listenerJob =
            scope.launch(Dispatchers.IO) {
                runAmbientLoop(config, nextRecorder, bufferSize, onStatus, onTranscript)
            }
    }

    fun stop() {
        listenerJob?.cancel()
        listenerJob = null
        runCatching { recorder?.stop() }
    }

    private suspend fun runAmbientLoop(
        config: AndroidAmbientListenerConfig,
        activeRecorder: AudioRecord,
        bufferSize: Int,
        onStatus: suspend (status: String, message: String, transcript: String?, metadata: JSONObject?) -> Unit,
        onTranscript: suspend (transcript: AndroidAmbientTranscript) -> Unit,
    ) {
        try {
            activeRecorder.startRecording()
            CompanionDiagnostics.i(
                "ambient",
                "Android ambient listener started.",
                "target=${config.target}, wake=${config.wakePhrases.joinToString("|")}",
            )
            onStatus("started", "Android ambient wake listener started.", null, null)

            Model(config.modelDirectory.absolutePath).use { model ->
                var wakeRecognizer = Recognizer(model, AMBIENT_VOSK_SAMPLE_RATE)
                var captureRecognizer: Recognizer? = null
                var detectedWakePhrase = config.wakePhrases.firstOrNull().orEmpty()
                var captureStartedAtMs = 0L
                var lastSpeechAtMs = 0L
                val buffer = ByteArray(bufferSize)

                while (scope.isActive && listenerJob?.isActive == true) {
                    val read = activeRecorder.read(buffer, 0, buffer.size)
                    if (read <= 0) {
                        continue
                    }

                    val now = SystemClock.elapsedRealtime()
                    val activeCaptureRecognizer = captureRecognizer
                    if (activeCaptureRecognizer === null) {
                        val accepted = wakeRecognizer.acceptWaveForm(buffer, read)
                        val recognizedText =
                            readVoskText(if (accepted) wakeRecognizer.result else wakeRecognizer.partialResult)
                        val wakeMatch = stripWakePhrase(recognizedText, config.wakePhrases)
                        if (wakeMatch !== null) {
                            detectedWakePhrase = wakeMatch.first
                            val ignoredWakeSuffix = wakeMatch.second.takeIf { it.isNotBlank() }
                            wakeRecognizer.close()
                            wakeRecognizer = Recognizer(model, AMBIENT_VOSK_SAMPLE_RATE)
                            captureRecognizer = Recognizer(model, AMBIENT_VOSK_SAMPLE_RATE)
                            captureStartedAtMs = now
                            lastSpeechAtMs = now
                            onStatus(
                                "wake-detected",
                                "Ambient wake phrase detected.",
                                null,
                                JSONObject()
                                    .put("wakePhrase", detectedWakePhrase)
                                    .put("ignoredWakeSuffix", ignoredWakeSuffix),
                            )
                            onStatus("capturing", "Ambient command capture started.", null, null)
                            continue
                        }
                        if (accepted) {
                            wakeRecognizer.close()
                            wakeRecognizer = Recognizer(model, AMBIENT_VOSK_SAMPLE_RATE)
                        }
                        continue
                    }

                    activeCaptureRecognizer.acceptWaveForm(buffer, read)
                    val partial = readVoskText(activeCaptureRecognizer.partialResult)
                    if (partial.isNotBlank()) {
                        lastSpeechAtMs = now
                    }

                    val capturedMs = now - captureStartedAtMs
                    val windowExpired = capturedMs >= config.activeWindowMs
                    val silenceExpired =
                        capturedMs >= AMBIENT_MIN_CAPTURE_MS &&
                            now - lastSpeechAtMs >= config.silenceTimeoutMs
                    if (windowExpired.not() && silenceExpired.not()) {
                        continue
                    }

                    val recognizedFinal = readVoskText(activeCaptureRecognizer.finalResult)
                    activeCaptureRecognizer.close()
                    captureRecognizer = null
                    val transcriptText =
                        recognizedFinal
                            .replace(Regex("\\s+"), " ")
                            .trim()
                    wakeRecognizer.close()
                    wakeRecognizer = Recognizer(model, AMBIENT_VOSK_SAMPLE_RATE)

                    if (transcriptText.isBlank()) {
                        onStatus("done", "Ambient wake captured no speech.", null, null)
                        continue
                    }

                    onStatus("transcribing", "Ambient phrase recognized on phone.", transcriptText, null)
                    onTranscript(
                        AndroidAmbientTranscript(
                            text = transcriptText,
                            wakePhrase = detectedWakePhrase,
                            activeWindowMs = config.activeWindowMs,
                            silenceTimeoutMs = config.silenceTimeoutMs,
                            capturedMs = capturedMs,
                        )
                    )
                    onStatus("done", "Ambient transcript submitted.", transcriptText, null)
                }

                runCatching { captureRecognizer?.close() }
                wakeRecognizer.close()
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            CompanionDiagnostics.e("ambient", "Android ambient listener failed.", throwable = error)
            onStatus(
                "failed",
                error.message?.trim().takeUnless { it.isNullOrEmpty() } ?: "Ambient listener failed.",
                null,
                null,
            )
        } finally {
            runCatching { activeRecorder.stop() }
            activeRecorder.release()
            if (recorder === activeRecorder) {
                recorder = null
            }
            CompanionDiagnostics.i("ambient", "Android ambient listener stopped.")
        }
    }

    private fun resolveBufferSize(): Int {
        val minimum = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        if (minimum <= 0) {
            throw IllegalStateException("Android microphone buffer size could not be resolved.")
        }
        return minimum.coerceAtLeast(sampleRate / 2)
    }

    @SuppressLint("MissingPermission")
    private fun createRecorder(bufferSize: Int): AudioRecord {
        return AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            bufferSize,
        )
    }

    private fun readVoskText(payload: String?): String {
        if (payload.isNullOrBlank()) {
            return ""
        }
        val json = runCatching { JSONObject(payload) }.getOrNull() ?: return ""
        return (json.optString("text").ifBlank { json.optString("partial") }).trim()
    }

    private fun stripWakePhrase(text: String, wakePhrases: List<String>): Pair<String, String>? {
        val normalizedText = normalizeAmbientText(text)
        if (normalizedText.isBlank()) {
            return null
        }

        for (phrase in wakePhrases) {
            val normalizedPhrase = normalizeAmbientText(phrase)
            if (normalizedPhrase.isBlank()) {
                continue
            }
            if (normalizedText == normalizedPhrase || normalizedText.startsWith("$normalizedPhrase ")) {
                val rawWords = text.trim().split(Regex("\\s+"))
                val wakeWordCount = normalizedPhrase.split(Regex("\\s+")).size
                return phrase to rawWords.drop(wakeWordCount).joinToString(" ").trim()
            }
        }

        return null
    }

    private fun normalizeAmbientText(value: String): String {
        val lower = value.lowercase(Locale.forLanguageTag("tr-TR")).replace('ı', 'i')
        return Normalizer.normalize(lower, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
            .replace(Regex("[^\\p{L}\\p{N}\\s]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
