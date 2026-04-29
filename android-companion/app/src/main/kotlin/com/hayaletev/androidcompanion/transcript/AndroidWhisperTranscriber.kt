package com.hayaletev.androidcompanion.transcript

import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

object AndroidWhisperNative {
    init {
        System.loadLibrary("hayalet_whisper")
    }

    external fun transcribe(
        modelPath: String,
        audioPath: String,
        language: String,
        threads: Int,
    ): String
}

class AndroidWhisperTranscriber {
    suspend fun transcribe(
        modelFile: File,
        audioFile: File,
        language: String,
    ): String = withContext(Dispatchers.Default) {
        CompanionDiagnostics.i(
            "transcript",
            "Starting Android whisper.cpp transcription.",
            "model=${modelFile.name}, audio=${audioFile.name}, language=$language",
        )
        val text = AndroidWhisperNative.transcribe(
            modelFile.absolutePath,
            audioFile.absolutePath,
            language.ifBlank { "tr" },
            2,
        ).trim()
        if (text.isBlank()) {
            throw IllegalStateException("Android whisper.cpp returned an empty transcript.")
        }
        CompanionDiagnostics.i("transcript", "Android whisper.cpp transcription completed.")
        text
    }
}
