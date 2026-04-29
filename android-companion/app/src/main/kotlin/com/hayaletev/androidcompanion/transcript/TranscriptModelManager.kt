package com.hayaletev.androidcompanion.transcript

import android.content.Context
import com.hayaletev.androidcompanion.debug.CompanionDiagnostics
import com.hayaletev.androidcompanion.transport.BridgeTranscriptModelProfile
import com.hayaletev.androidcompanion.transport.DesktopBridgeClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest

class TranscriptModelManager(
    private val context: Context,
    private val bridgeClient: DesktopBridgeClient,
) {
    suspend fun ensureModel(profile: BridgeTranscriptModelProfile): File = withContext(Dispatchers.IO) {
        val directory = File(context.filesDir, "transcript-models").apply { mkdirs() }
        val modelFile = File(directory, profile.fileName)
        if (modelFile.isFile && validateModel(modelFile, profile)) {
            return@withContext modelFile
        }

        val downloadFile = File(directory, "${profile.fileName}.download")
        if (downloadFile.exists()) {
            downloadFile.delete()
        }

        CompanionDiagnostics.i(
            "transcript",
            "Requesting transcript model from desktop bridge.",
            "model=${profile.modelId}, file=${profile.fileName}",
        )
        bridgeClient.downloadTranscriptModel(profile.fileName, downloadFile)
        if (validateModel(downloadFile, profile).not()) {
            downloadFile.delete()
            throw IllegalStateException("Downloaded transcript model checksum did not match.")
        }
        if (modelFile.exists()) {
            modelFile.delete()
        }
        downloadFile.renameTo(modelFile)
        modelFile
    }

    private fun validateModel(file: File, profile: BridgeTranscriptModelProfile): Boolean {
        if (file.isFile.not()) {
            return false
        }
        if (profile.expectedBytes != null && file.length() != profile.expectedBytes) {
            return false
        }
        return sha1(file).equals(profile.expectedSha1, ignoreCase = true)
    }

    private fun sha1(file: File): String {
        val digest = MessageDigest.getInstance("SHA-1")
        file.inputStream().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) {
                    break
                }
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
