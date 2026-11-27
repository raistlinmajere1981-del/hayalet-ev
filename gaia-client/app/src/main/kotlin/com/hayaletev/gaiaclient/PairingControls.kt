package com.hayaletev.gaiaclient

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import com.hayaletev.gaiaclient.pairing.*
import com.hayaletev.gaiaclient.protocol.bounded
import com.hayaletev.gaiaclient.service.GaiaClientService
import java.security.cert.CertificateException
import java.util.concurrent.Executors

internal class PairingControls(private val activity: Activity) {
    private val io = Executors.newSingleThreadExecutor()
    private val status = activity.findViewById<TextView>(R.id.tv_pairing)
    private val export = activity.findViewById<Button>(R.id.btn_export)
    private val import = activity.findViewById<Button>(R.id.btn_import)
    var busy = false
        private set

    init {
        export.setOnClickListener { pick(Intent.ACTION_CREATE_DOCUMENT, EXPORT) }
        import.setOnClickListener { pick(Intent.ACTION_OPEN_DOCUMENT, IMPORT) }
        work {
            val store = pairingStore(activity)
            val active = store.description() ?: activity.getString(R.string.unpaired)
            val pending = store.pendingIdentity()
            if (pending == null) active
            else "$active\n${activity.getString(R.string.compare_spki)}\n$pending"
        }
    }

    private fun pick(action: String, code: Int) {
        val intent =
            Intent(action).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json")
        if (code == EXPORT) intent.putExtra(Intent.EXTRA_TITLE, "gaia-usb-request.json")
        activity.startActivityForResult(intent, code)
    }

    fun selected(code: Int, uri: Uri) {
        if (uri.scheme != "content" || GaiaClientService.isRunning || busy) return
        when (code) {
            EXPORT ->
                work(mutating = true) {
                    val request = pairingStore(activity).request()
                    requireNotNull(activity.contentResolver.openOutputStream(uri, "wt")).use {
                        it.write(request.bytes)
                    }
                    activity.getString(R.string.compare_spki) +
                        "\nUUID ${request.installationId}\nSPKI ${request.spki}"
                }
            IMPORT -> {
                val pin =
                    EditText(activity).apply {
                        isSingleLine = true
                        inputType = android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
                    }
                AlertDialog.Builder(activity)
                    .setTitle(R.string.enter_pin)
                    .setView(pin)
                    .setNegativeButton(android.R.string.cancel, null)
                    .setPositiveButton(R.string.install) { _, _ ->
                        val trusted = pin.text.toString().trim().lowercase()
                        work(mutating = true) {
                            val bytes =
                                requireNotNull(activity.contentResolver.openInputStream(uri)).use {
                                    it.bounded(PACKAGE_LIMIT)
                                }
                            val store = pairingStore(activity)
                            store.install(bytes, trusted)
                            requireNotNull(store.description())
                        }
                    }
                    .show()
            }
        }
    }

    fun running(running: Boolean) {
        val available = !running && !busy && !FieldUseGate.process.occupied()
        export.isEnabled = available
        import.isEnabled = available
    }

    private fun work(mutating: Boolean = false, action: () -> String) {
        if (busy || activity.isDestroyed || activity.isFinishing) return
        val lease = if (mutating) FieldUseGate.process.acquire() else null
        if (mutating && lease == null) {
            status.text = activity.getString(R.string.error_pairing_busy)
            return
        }
        busy = true
        running(GaiaClientService.isRunning)
        io.execute {
            val message =
                try {
                    action()
                } catch (e: CertificateException) {
                    activity.getString(R.string.error_certificate)
                } catch (e: Exception) {
                    activity.getString(R.string.error_installation)
                } finally {
                    lease?.close()
                }
            activity.runOnUiThread {
                if (!activity.isDestroyed && !activity.isFinishing) {
                    busy = false
                    status.text = message
                    running(GaiaClientService.isRunning)
                }
            }
        }
    }

    fun close() {
        // A queued mutation already owns the process lease. Let it complete
        // and release that lease even if the Activity was recreated.
        io.shutdown()
    }

    private companion object {
        const val EXPORT = 301
        const val IMPORT = 302
    }
}
