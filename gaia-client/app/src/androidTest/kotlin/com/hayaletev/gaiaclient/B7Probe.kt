package com.hayaletev.gaiaclient

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.widget.Button
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.Quality
import com.hayaletev.gaiaclient.core.SendOutcome
import com.hayaletev.gaiaclient.pairing.pairingStore
import com.hayaletev.gaiaclient.service.GaiaClientService
import java.io.File

/** The measurement APK has a disposable application ID and its own Keystore namespace. */
class B7Probe : Instrumentation() {
    private lateinit var step: String

    override fun onCreate(arguments: Bundle) {
        super.onCreate(arguments)
        step = requireNotNull(arguments.getString("action"))
        start()
    }

    override fun onStart() {
        val result = Bundle()
        try {
            check(Build.MODEL == "SM-J701F" && targetContext.packageName == "com.hayaletev.gaiaclient.b7probe")
            val store = pairingStore(targetContext)
            val cache = targetContext.cacheDir
            when (step) {
                "request" -> File(cache, "request.json").writeBytes(store.request().bytes)
                "measure" -> {
                    store.install(File(cache, "package.json").readBytes(), File(cache, "pin").readText())
                    val activity = startActivitySync(Intent(targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    try {
                        runOnMainSync { activity.findViewById<Button>(R.id.btn_start_stop).performClick() }
                        val deadline = SystemClock.elapsedRealtime() + 45000
                        while (true) {
                            val state = GaiaClientService.lastState()
                            if (state.tickCount >= 2 && state.lastOutcome == SendOutcome.ACCEPTED &&
                                state.lastPacket?.samples?.any { it.id == CapabilityId.ACCELEROMETER && it.quality == Quality.VALID } == true) {
                                result.putString("measurement", "foreground service received ACK for seq ${state.lastPacket.seq} with a valid accelerometer sample")
                                break
                            }
                            check(state.error == null && SystemClock.elapsedRealtime() < deadline) { "ticks=${state.tickCount}, outcome=${state.lastOutcome}, error=${state.error}" }
                            Thread.sleep(100)
                        }
                    } finally {
                        if (GaiaClientService.isRunning) runOnMainSync { activity.findViewById<Button>(R.id.btn_start_stop).performClick() }
                        runOnMainSync { activity.finish() }
                    }
                }
                else -> error("Unknown B7 measurement action")
            }
            finish(Activity.RESULT_OK, result)
        } catch (error: Throwable) {
            result.putString("failure", error.stackTraceToString())
            finish(Activity.RESULT_CANCELED, result)
        }
    }
}
