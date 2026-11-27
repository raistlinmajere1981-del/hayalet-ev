package com.hayaletev.gaiaclient.service

import com.hayaletev.gaiaclient.protocol.bounded
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.UUID

class InstallationIdentityException(message: String, cause: Throwable? = null) :
    Exception(message, cause)

/**
 * Lives outside Android backup on purpose: `allowBackup=false` in the manifest
 * keeps the installation identity scoped to this device install. Restoring it
 * elsewhere would merge two physical clients under one central identity.
 *
 * A missing file is the only case that creates an identity. An existing but
 * unreadable or invalid file is a hard failure: replacing it would silently
 * break the central mapping, so recovery is an explicit reinstall.
 */
class InstallationStore(private val dir: File) {
    fun getOrCreate(): String = synchronized(identityLock) {
        try {
            readOrCreate()
        } catch (failure: InstallationIdentityException) {
            throw failure
        } catch (failure: Exception) {
            throw InstallationIdentityException(
                "installation identity could not be resolved",
                failure
            )
        }
    }

    private fun readOrCreate(): String {
        val file = File(dir, FILE_NAME)
        if (file.exists()) {
            val existing = try {
                file.inputStream().use { it.bounded(128) }.toString(Charsets.UTF_8).trim()
            } catch (failure: Exception) {
                throw InstallationIdentityException("installation identity is unreadable", failure)
            }
            if (!UUID_V4.matches(existing)) {
                throw InstallationIdentityException("installation identity is corrupt")
            }
            return existing
        }

        if (File(dir, "field-installation").exists()) {
            throw InstallationIdentityException("paired installation identity is missing")
        }
        if (!dir.isDirectory && !dir.mkdirs()) {
            throw InstallationIdentityException(
                "installation identity directory could not be created"
            )
        }
        if (!dir.isDirectory) {
            throw InstallationIdentityException(
                "installation identity directory is not a directory"
            )
        }

        val id = UUID.randomUUID().toString()
        val temp = File(dir, "$FILE_NAME.tmp")
        try {
            try {
                FileOutputStream(temp).use { output ->
                    output.write(id.toByteArray(Charsets.UTF_8))
                    output.fd.sync()
                }
            } catch (failure: Exception) {
                throw InstallationIdentityException(
                    "installation identity could not be written",
                    failure
                )
            }
            try {
                Files.move(
                    temp.toPath(),
                    file.toPath(),
                    StandardCopyOption.ATOMIC_MOVE
                )
            } catch (failure: Exception) {
                throw InstallationIdentityException(
                    "installation identity could not be committed atomically",
                    failure
                )
            }
        } finally {
            temp.delete()
        }
        return id
    }

    private companion object {
        val identityLock = Any()
        const val FILE_NAME = "installation-id"
        val UUID_V4 = Regex(
            "^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"
        )
    }
}
