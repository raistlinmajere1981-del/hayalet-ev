package com.hayaletev.gaiadiagnostic.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.util.Log
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.MutableLiveData
import com.hayaletev.gaiadiagnostic.MainActivity
import com.hayaletev.gaiadiagnostic.R
import com.hayaletev.gaiadiagnostic.hardware.AccelReading
import com.hayaletev.gaiadiagnostic.hardware.HardwareCollector
import com.hayaletev.gaiadiagnostic.hardware.ProxReading
import com.hayaletev.gaiadiagnostic.hardware.SensorObserver
import com.hayaletev.gaiadiagnostic.network.SendResult
import com.hayaletev.gaiadiagnostic.network.TestConnector
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Foreground service that gathers hardware observations on a low-frequency timer
 * and optionally relays them to the ADB-reverse test receiver.
 *
 * Activity-independent: survives screen-off and app backgrounding.
 * Does NOT hold a wake lock — Android scheduler may coalesce wakeups, which is acceptable
 * for a low-frequency diagnostic poller.
 */
class DiagnosticService : LifecycleService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private lateinit var hw: HardwareCollector
    private lateinit var sensorObs: SensorObserver
    private lateinit var connector: TestConnector

    private var pollJob: Job? = null
    private var sensorJob: Job? = null

    // Last sensor readings updated from sensor coroutines, read by poll loop
    @Volatile private var lastAccel: AccelReading? = null
    @Volatile private var lastProx: ProxReading? = null

    inner class LocalBinder : Binder() {
        fun getService() = this@DiagnosticService
    }

    private val binder = LocalBinder()

    override fun onCreate() {
        super.onCreate()
        hw = HardwareCollector(applicationContext)
        sensorObs = SensorObserver(hw.getSensorManager())
        connector = TestConnector()
        isRunning = true
        startForegroundWithNotification()
        startObserving()
    }

    override fun onBind(intent: Intent): IBinder {
        super.onBind(intent)
        return binder
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        sensorObs.release()
        scope.cancel()
        liveText.postValue(null)
        super.onDestroy()
        Log.i(TAG, "DiagnosticService destroyed; all subscriptions released")
    }

    private fun startForegroundWithNotification() {
        val channelId = "gaia_diagnostic"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            channelId,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = getString(R.string.notif_channel_desc) }
        nm.createNotificationChannel(channel)

        val pi = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification: Notification = Notification.Builder(this, channelId)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(getString(R.string.notif_text))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()

        startForeground(NOTIF_ID, notification)
    }

    private fun startObserving() {
        sensorObs.register()

        // Drain sensor channels into volatile fields; CONFLATED channel keeps only the latest
        sensorJob = scope.launch {
            launch {
                for (reading in sensorObs.accelChannel) {
                    lastAccel = reading
                }
            }
            launch {
                for (reading in sensorObs.proxChannel) {
                    lastProx = reading
                }
            }
        }

        // Poll at low frequency: every POLL_INTERVAL_MS
        pollJob = scope.launch {
            while (true) {
                try {
                    tick()
                } catch (e: Exception) {
                    Log.w(TAG, "tick error: ${e.message}")
                }
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    private fun tick() {
        val battery = hw.getBatterySnapshot()
        val network = hw.getNetworkSnapshot()
        val ts = hw.getTimestamps()
        val accel = lastAccel
        val prox = lastProx

        val accelStr = if (accel != null) {
            "x=%.2f y=%.2f z=%.2f".format(accel.x, accel.y, accel.z)
        } else "N/A"

        val proxStr = if (prox != null) {
            "%.1f cm".format(prox.distanceCm)
        } else "N/A"

        val rssiStr = if (network.wifiRssiDbm != null) "${network.wifiRssiDbm} dBm" else "N/A"
        val tempStr = if (battery.temperatureBatteryC != null) "%.1f°C".format(battery.temperatureBatteryC) else "N/A"
        val voltStr = if (battery.voltageMillivolts != null) "${battery.voltageMillivolts} mV" else "N/A"

        val display = buildString {
            appendLine("Bat: ${battery.levelPct}% | ${battery.chargingStatus} (${battery.plugged})")
            appendLine("Bat temp (pack): $tempStr")
            appendLine("Voltage: $voltStr")
            appendLine("Accel: $accelStr")
            appendLine("Prox: $proxStr")
            appendLine("Net: ${if (network.hasInternet) "online" else "offline"} | WiFi:${network.isWifi} Cell:${network.isCellular}")
            appendLine("RSSI: $rssiStr")
            appendLine("Wall: ${ts.wallMs}ms | Mono: ${ts.monotonicMs}ms")
        }

        liveText.postValue(display.trim())
        Log.d(TAG, display)

        // Attempt relay to test receiver; failure is non-fatal
        val json = buildObservationJson(
            battery.levelPct, battery.temperatureBatteryC,
            battery.voltageMillivolts, battery.chargingStatus,
            accel, prox,
            network.hasInternet, network.isWifi, network.wifiRssiDbm,
            ts.wallMs, ts.monotonicMs
        )

        when (val result = connector.send(json)) {
            is SendResult.Ok  -> Log.i(TAG, "relay OK rtt=${result.rttMs}ms resp=${result.response}")
            is SendResult.Err -> Log.d(TAG, "relay unavailable: ${result.message}")
        }
    }

    private fun buildObservationJson(
        batteryPct: Int,
        batteryTempC: Float?,
        voltageMillivolts: Int?,
        chargingStatus: String,
        accel: AccelReading?,
        prox: ProxReading?,
        hasInternet: Boolean,
        isWifi: Boolean,
        wifiRssi: Int?,
        wallMs: Long,
        monotonicMs: Long
    ): String {
        val sb = StringBuilder()
        sb.append("""{"type":"gaia_diagnostic_obs"""")
        sb.append(""","deviceWallMs":$wallMs""")
        sb.append(""","deviceMonotonicMs":$monotonicMs""")
        sb.append(""","batteryPct":$batteryPct""")
        sb.append(""","batteryTempC":${batteryTempC ?: "null"}""")
        sb.append(""","voltageMillivolts":${voltageMillivolts ?: "null"}""")
        sb.append(""","chargingStatus":"$chargingStatus"""")
        if (accel != null) {
            sb.append(""","accel":{"x":${accel.x},"y":${accel.y},"z":${accel.z}}""")
        } else {
            sb.append(""","accel":null""")
        }
        if (prox != null) {
            sb.append(""","proxCm":${prox.distanceCm}""")
        } else {
            sb.append(""","proxCm":null""")
        }
        sb.append(""","internet":$hasInternet,"wifi":$isWifi,"wifiRssi":${wifiRssi ?: "null"}""")
        sb.append("}")
        return sb.toString()
    }

    companion object {
        private const val TAG = "DiagnosticService"
        private const val NOTIF_ID = 9701
        private const val POLL_INTERVAL_MS = 10_000L  // 0.1 Hz — intentionally low

        // Shared state; set only by service lifecycle
        @Volatile var isRunning = false
            private set

        // Live display text; observed by MainActivity
        val liveText = MutableLiveData<String?>()
    }
}
