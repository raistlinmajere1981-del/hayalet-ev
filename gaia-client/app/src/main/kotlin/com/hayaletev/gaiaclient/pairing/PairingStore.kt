package com.hayaletev.gaiaclient.pairing

import com.google.gson.JsonObject
import com.hayaletev.gaiaclient.protocol.*
import com.hayaletev.gaiaclient.service.InstallationStore
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.KeyPair
import java.util.Base64

internal interface PairingKeys {
    fun generate(alias: String): KeyPair

    fun load(alias: String): KeyPair?

    fun delete(alias: String)
}

internal data class UsbExport(val bytes: ByteArray, val spki: String, val installationId: String)

internal class PairingStore(private val dir: File, private val keys: PairingKeys) {
    private val record = File(dir, "field-installation")
    private val identity = InstallationStore(dir)

    private data class State(
        val id: String,
        val active: String,
        val pending: String,
        val pin: String,
        val pkg: ByteArray,
    )

    private fun state(): State {
        if (record.exists()) require(File(dir, "installation-id").isFile)
        val id = identity.getOrCreate()
        if (!record.exists()) return State(id, "", "", "", byteArrayOf())
        val obj =
            parseObject(
                record.inputStream().use { it.bounded(PACKAGE_LIMIT * 2) },
                PACKAGE_LIMIT * 2,
            )
        obj.fields("v", "id", "active", "pending", "pin", "package")
        require(obj.integer("v") == 1L && obj.str("id") == id)
        val active = obj.str("active")
        val pending = obj.str("pending")
        require(listOf(active, pending).all { it in setOf("", "a", "b") } && active != pending)
        val pkg = Base64.getDecoder().decode(obj.str("package"))
        require(pkg.size <= PACKAGE_LIMIT && pkg.base64() == obj.str("package"))
        val pin = obj.str("pin")
        require(
            if (active.isEmpty()) pkg.isEmpty() && pin.isEmpty()
            else pkg.isNotEmpty() && pin.matches(Regex("[0-9a-f]{64}"))
        )
        return State(id, active, pending, pin, pkg)
    }

    private fun save(s: State) {
        val json =
            JsonObject().apply {
                addProperty("v", 1)
                addProperty("id", s.id)
                addProperty("active", s.active)
                addProperty("pending", s.pending)
                addProperty("pin", s.pin)
                addProperty("package", s.pkg.base64())
            }
        val tmp = File(dir, "field-installation.tmp")
        try {
            FileOutputStream(tmp).use {
                it.write(json.toString().toByteArray())
                it.fd.sync()
            }
            Files.move(
                tmp.toPath(),
                record.toPath(),
                StandardCopyOption.REPLACE_EXISTING,
                StandardCopyOption.ATOMIC_MOVE,
            )
        } finally {
            tmp.delete()
        }
    }

    private fun State.alias(slot: String) = "gaia.$id.$slot"

    fun request(): UsbExport =
        synchronized(lock) {
            var s = state()
            // Persist the candidate name first so an interrupted generation can be retried.
            if (s.pending.isEmpty()) {
                val next = if (s.active == "a") "b" else "a"
                // Two slots bound orphaned keys even after a crash just after publication.
                keys.delete(s.alias(next))
                s = s.copy(pending = next)
                save(s)
            }
            val alias = s.alias(s.pending)
            val pair = keys.load(alias) ?: keys.generate(alias)
            UsbExport(usbRequest(s.id, pair), pair.public.encoded.fingerprint(), s.id)
        }

    fun install(bytes: ByteArray, pin: String): Installation =
        synchronized(lock) {
            val s = state()
            if (s.active.isNotEmpty() && s.pin == pin && s.pkg.contentEquals(bytes)) return active()
            require(s.pending.isNotEmpty())
            val pair = requireNotNull(keys.load(s.alias(s.pending)))
            val verified = verifyInstallation(bytes, pin, s.id, pair, System.currentTimeMillis())
            save(s.copy(active = s.pending, pending = "", pin = pin, pkg = bytes))
            if (s.active.isNotEmpty()) runCatching { keys.delete(s.alias(s.active)) }
            verified
        }

    fun active(): Installation =
        synchronized(lock) {
            val s = state()
            require(s.active.isNotEmpty())
            val pair = requireNotNull(keys.load(s.alias(s.active)))
            verifyInstallation(s.pkg, s.pin, s.id, pair, System.currentTimeMillis())
        }

    fun pendingIdentity(): String? =
        synchronized(lock) {
            val s = state()
            if (s.pending.isEmpty()) return null
            val key = requireNotNull(keys.load(s.alias(s.pending)))
            "UUID ${s.id}\nSPKI ${key.public.encoded.fingerprint()}"
        }

    fun description(): String? =
        synchronized(lock) {
            val s = state()
            if (s.active.isEmpty()) return null
            val i = active()
            "${i.project} / ${i.device}\n${i.origin}\nCA ${s.pin}\nSPKI ${i.keys.public.encoded.fingerprint()}"
        }

    companion object {
        private val lock = Any()
    }
}
