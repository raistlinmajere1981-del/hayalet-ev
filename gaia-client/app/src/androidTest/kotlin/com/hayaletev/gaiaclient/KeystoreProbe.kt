package com.hayaletev.gaiaclient

import android.app.Activity
import android.app.Instrumentation
import android.os.Build
import android.os.Bundle
import android.security.keystore.KeyInfo
import com.hayaletev.gaiaclient.hardware.SystemMonoClock
import com.hayaletev.gaiaclient.pairing.*
import com.hayaletev.gaiaclient.protocol.uuidV4
import com.hayaletev.gaiaclient.transport.*
import java.io.File
import java.security.KeyFactory
import java.security.KeyStore
import java.security.PrivateKey
import java.security.cert.CertificateNotYetValidException
import java.util.UUID
import kotlinx.coroutines.runBlocking

/**
 * Uses a disposable installation under cache so a field pairing is never replaced by a measurement.
 */
class KeystoreProbe : Instrumentation() {
    private lateinit var args: Bundle

    override fun onCreate(arguments: Bundle) {
        super.onCreate(arguments)
        args = arguments
        start()
    }

    override fun onStart() {
        val result = Bundle()
        try {
            require(Build.MODEL == "SM-J701F")
            val dir = File(targetContext.cacheDir, "b6-probe")
            val store = PairingStore(dir, AndroidPairingKeys())
            when (args.getString("action")) {
                "ui" -> {
                    check(
                        !File(targetContext.noBackupFilesDir, "gaia-client/field-installation")
                            .exists()
                    )
                    val activity =
                        startActivitySync(
                            android.content
                                .Intent(targetContext, MainActivity::class.java)
                                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                        )
                    fun waitUi(check: () -> Boolean) {
                        val until = android.os.SystemClock.elapsedRealtime() + 5000
                        var ok = false
                        while (!ok && android.os.SystemClock.elapsedRealtime() < until) {
                            runOnMainSync { ok = check() }
                            if (!ok) Thread.sleep(50)
                        }
                        check(ok)
                    }
                    try {
                        waitUi {
                            activity
                                .findViewById<android.widget.TextView>(R.id.tv_pairing)
                                .text
                                .toString() == activity.getString(R.string.unpaired)
                        }
                        for ((button, action) in listOf(
                            R.id.btn_export to android.content.Intent.ACTION_CREATE_DOCUMENT,
                            R.id.btn_import to android.content.Intent.ACTION_OPEN_DOCUMENT
                        )) {
                            val filter = android.content.IntentFilter(action).apply {
                                addCategory(android.content.Intent.CATEGORY_OPENABLE)
                                addDataType("application/json")
                            }
                            val monitor = addMonitor(filter, ActivityResult(Activity.RESULT_CANCELED, null), true)
                            try {
                                runOnMainSync { activity.findViewById<android.widget.Button>(button).performClick() }
                                check(monitor.hits == 1)
                            } finally { removeMonitor(monitor) }
                        }
                        runOnMainSync {
                            activity
                                .findViewById<android.widget.Button>(R.id.btn_start_stop)
                                .performClick()
                        }
                        waitUi {
                            activity
                                .findViewById<android.widget.TextView>(R.id.tv_status)
                                .text
                                .toString() == activity.getString(R.string.error_installation)
                        }
                        check(!com.hayaletev.gaiaclient.service.GaiaClientService.isRunning)
                        result.putString(
                            "measurement",
                            "JSON document intents verified; unpaired Start showed installation error and stopped",
                        )
                    } finally {
                        runOnMainSync { activity.finish() }
                    }
                }
                "resolve" -> {
                    val address = androidHostLookup(targetContext).resolve("localhost") { false }
                    check(address.isLoopbackAddress)
                    result.putString("measurement", "private resolver returned loopback")
                }
                "request" -> {
                    require(dir.mkdir())
                    val req = store.request()
                    File(dir, "request.json").writeBytes(req.bytes)
                    val id = File(dir, "installation-id").readText()
                    require(uuidV4.matches(id))
                    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
                    val alias = ks.aliases().toList().single { it.startsWith("gaia.$id.") }
                    val key = ks.getKey(alias, null) as PrivateKey
                    val info =
                        KeyFactory.getInstance("EC", "AndroidKeyStore")
                            .getKeySpec(key, KeyInfo::class.java)
                    @Suppress("DEPRECATION") // API 28 reports backing through KeyInfo.
                    result.putString(
                        "measurement",
                        "hardware=${info.isInsideSecureHardware}, bits=${info.keySize}, nonexportable=${key.encoded == null}",
                    )
                }
                "verify" -> {
                    val pkg = File(dir, "package.json").readBytes()
                    val pin = File(dir, "pin").readText().trim()
                    try {
                        store.install(pkg, pin)
                        val transport =
                            FieldTransport(
                                store.active(),
                                SystemMonoClock,
                                androidHostLookup(targetContext),
                            )
                        try {
                            runBlocking {
                                val opened =
                                    transport.open(
                                        SessionOpenContext(
                                            store.active().id,
                                            UUID.randomUUID().toString(),
                                            emptyList(),
                                        )
                                    )
                                check(opened is OpenResult.Opened)
                                val packet =
                                    com.hayaletev.gaiaclient.core.ObservationPacket(
                                        sessionId = opened.sessionId,
                                        seq = 1,
                                        sentMonoMs = SystemMonoClock.elapsedRealtimeMs(),
                                        deviceWallMs = System.currentTimeMillis(),
                                        samples = emptyList(),
                                    )
                                check(transport.send(packet) is SendResult.Accepted)
                            }
                            result.putString("measurement", "paired, mTLS open and ACK")
                        } finally {
                            transport.close()
                        }
                    } catch (e: CertificateNotYetValidException) {
                        check(runCatching { store.active() }.isFailure)
                        result.putString(
                            "measurement",
                            "certificate not yet valid, no active identity",
                        )
                    }
                }
                "clean" -> {
                    val id =
                        File(dir, "installation-id").readText().also { require(uuidV4.matches(it)) }
                    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
                    ks.aliases()
                        .toList()
                        .filter { it.startsWith("gaia.$id.") }
                        .forEach(ks::deleteEntry)
                    check(dir.deleteRecursively())
                    result.putString("measurement", "removed test keys and cache")
                }
                else -> error("Unknown probe step")
            }
            finish(Activity.RESULT_OK, result)
        } catch (e: Throwable) {
            result.putString("failure", e.stackTraceToString())
            finish(Activity.RESULT_CANCELED, result)
        }
    }
}
