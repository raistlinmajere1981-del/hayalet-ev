package com.hayaletev.gaiaclient

import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.widget.Button
import android.widget.TextView
import com.hayaletev.gaiaclient.core.CapabilityCatalog
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.NetworkTransport
import com.hayaletev.gaiaclient.core.Quality
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleValue
import com.hayaletev.gaiaclient.core.SendOutcome
import com.hayaletev.gaiaclient.service.ClientBinder
import com.hayaletev.gaiaclient.service.ClientError
import com.hayaletev.gaiaclient.service.ClientListener
import com.hayaletev.gaiaclient.service.ClientState
import com.hayaletev.gaiaclient.service.GaiaClientService
import com.hayaletev.gaiaclient.service.StopReason
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var setup: PairingControls
    private lateinit var deviceInfoView: TextView
    private lateinit var startStopButton: Button
    private lateinit var statusView: TextView
    private lateinit var sessionView: TextView
    private lateinit var tickView: TextView
    private lateinit var outcomeView: TextView
    private lateinit var foundView: TextView
    private lateinit var acceptedView: TextView
    private lateinit var measurementsView: TextView

    private val handler = Handler(Looper.getMainLooper())
    private var lastState = ClientState()
    private var boundService: GaiaClientService? = null
    private var bound = false
    private var bindRequested = false
    private var bindAttempt = 0
    private var started = false
    private var localStartFailed = false

    private val listener = ClientListener { state ->
        lastState = state
        render(state)
    }

    private val connection: ServiceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val clientBinder = binder as? ClientBinder ?: return
            bindRequested = false
            if (!started || isFinishing || isDestroyed) {
                // A callback from a bind that outlived onStop must not attach a
                // listener the Activity will never remove.
                runCatching { unbindService(connection) }
                return
            }
            bound = true
            boundService = clientBinder.service
            clientBinder.service.addListener(listener)
            lastState = clientBinder.service.state()
            render(lastState)
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            bindRequested = false
            bound = false
            boundService = null
        }
    }

    private val ticker = object : Runnable {
        override fun run() {
            if (!bound) lastState = GaiaClientService.lastState()
            render(lastState)
            handler.postDelayed(this, 1_000)
        }
    }

    private val bindRetry = object : Runnable {
        override fun run() {
            if (!started || bound || bindRequested || isFinishing || isDestroyed) return
            if (!GaiaClientService.isRunning) {
                if (bindAttempt < 10) {
                    bindAttempt += 1
                    handler.postDelayed(this, 200)
                }
                return
            }
            bindIfRunning()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        setup = PairingControls(this)
        deviceInfoView = findViewById(R.id.tv_device_info)
        startStopButton = findViewById(R.id.btn_start_stop)
        statusView = findViewById(R.id.tv_status)
        sessionView = findViewById(R.id.tv_session)
        tickView = findViewById(R.id.tv_tick)
        outcomeView = findViewById(R.id.tv_outcome)
        foundView = findViewById(R.id.tv_found)
        acceptedView = findViewById(R.id.tv_accepted)
        measurementsView = findViewById(R.id.tv_measurements)

        deviceInfoView.text = getString(
            R.string.device_info,
            Build.MANUFACTURER,
            Build.MODEL,
            Build.VERSION.RELEASE,
            Build.VERSION.SDK_INT,
            Build.SUPPORTED_ABIS.firstOrNull() ?: "—"
        )

        startStopButton.setOnClickListener {
            if (GaiaClientService.isRunning) stopCollection() else if (!setup.busy) startCollection()
        }
        render(lastState)
    }

    override fun onStart() {
        super.onStart()
        started = true
        lastState = GaiaClientService.lastState()
        if (GaiaClientService.isRunning) {
            bindIfRunning()
        } else {
            render(lastState)
        }
        bindAttempt = 0
        handler.removeCallbacks(bindRetry)
        handler.postDelayed(bindRetry, 200)
    }

    override fun onStop() {
        started = false
        val wasBound = bound
        if (wasBound) {
            boundService?.removeListener(listener)
            boundService = null
        }
        if (bindRequested || wasBound) {
            runCatching { unbindService(connection) }
        }
        bound = false
        bindRequested = false
        handler.removeCallbacks(bindRetry)
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        handler.removeCallbacks(ticker)
        handler.post(ticker)
    }

    override fun onPause() {
        handler.removeCallbacks(ticker)
        super.onPause()
    }

    override fun onDestroy() {
        setup.close()
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    @Deprecated("Activity result callback for the platform document picker")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode == RESULT_OK) data?.data?.let { setup.selected(requestCode, it) }
    }

    private fun startCollection() {
        localStartFailed = false
        requestNotificationPermission()
        try {
            startForegroundService(GaiaClientService.startIntent(this))
            bindAttempt = 0
            handler.removeCallbacks(bindRetry)
            handler.postDelayed(bindRetry, 200)
        } catch (failure: Exception) {
            localStartFailed = true
            lastState = lastState.copy(
                running = false,
                error = ClientError.START_FAILED
            )
            render(lastState)
        }
    }

    private fun stopCollection() {
        val service = boundService
        if (service != null) {
            service.requestStop(StopReason.USER)
        } else if (GaiaClientService.isRunning) {
            startService(GaiaClientService.stopIntent(this))
        }
    }

    private fun requestNotificationPermission() {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100)
        }
    }

    private fun bindIfRunning() {
        if (bound || bindRequested || !GaiaClientService.isRunning) return
        val intent = Intent(this, GaiaClientService::class.java)
        if (bindService(intent, connection, 0)) {
            bindRequested = true
        } else if (bindAttempt < 10) {
            bindAttempt += 1
            handler.postDelayed(bindRetry, 200)
        }
    }

    private fun render(state: ClientState) {
        if (isFinishing || isDestroyed) return

        startStopButton.text = getString(
            if (state.running || GaiaClientService.isRunning) R.string.stop else R.string.start
        )

        setup.running(state.running || GaiaClientService.isRunning)
        statusView.text = when {
            state.running || GaiaClientService.isRunning -> getString(R.string.state_running)
            state.error == ClientError.IDENTITY_UNAVAILABLE ->
                getString(R.string.error_identity_unavailable)
            state.error == ClientError.CERTIFICATE -> getString(R.string.error_certificate)
            state.error == ClientError.INSTALLATION -> getString(R.string.error_installation)
            state.error == ClientError.PAIRING_BUSY -> getString(R.string.error_pairing_busy)
            state.error == ClientError.AUTHORIZATION -> getString(R.string.error_authorization)
            state.error == ClientError.PROTOCOL -> getString(R.string.error_protocol)
            localStartFailed || state.error == ClientError.START_FAILED -> getString(R.string.error_start_failed)
            state.stopReason != null -> getString(
                R.string.stop_reason_format,
                stopReasonName(state.stopReason)
            )
            else -> getString(R.string.state_stopped)
        }

        sessionView.text = getString(R.string.label_session) + ": " +
            (state.sessionShortId ?: getString(R.string.no_session))
        tickView.text = getString(R.string.label_tick) + ": " + state.tickCount
        outcomeView.text = getString(R.string.label_outcome) + ": " +
            outcomeText(state.lastOutcome)

        foundView.text = getString(R.string.label_found) + ": " + joinCapabilities(state.found)
        acceptedView.text = getString(R.string.label_accepted) + ": " +
            joinCapabilities(state.accepted)

        val packet = state.lastPacket
        measurementsView.text = if (packet == null || packet.samples.isEmpty()) {
            getString(R.string.label_measurements) + "\n" + getString(R.string.no_measurements)
        } else {
            val now = SystemClock.elapsedRealtime()
            getString(R.string.label_measurements) + "\n" +
                packet.samples.joinToString("\n") { sampleText(it, now) }
        }
    }

    private fun joinCapabilities(ids: List<CapabilityId>): String =
        if (ids.isEmpty()) {
            getString(R.string.none_value)
        } else {
            ids.joinToString(", ") { capabilityName(it) }
        }

    private fun sampleText(sample: Sample, nowMonoMs: Long): String {
        val name = capabilityName(sample.id)
        return when (sample.quality) {
            Quality.VALID -> {
                val value = formatValue(sample.value)
                val age = formatAge(nowMonoMs, sample.sampleMonoMs)
                if (sample.value is SampleValue.Text || sample.value is SampleValue.Network) {
                    getString(
                        R.string.measurement_valid_text,
                        name,
                        value,
                        getString(R.string.quality_valid),
                        age
                    )
                } else {
                    getString(
                        R.string.measurement_valid,
                        name,
                        value,
                        CapabilityCatalog.definition(sample.id).unit,
                        getString(R.string.quality_valid),
                        age
                    )
                }
            }

            Quality.INVALID -> getString(
                R.string.measurement_invalid,
                name,
                getString(R.string.quality_invalid),
                formatAge(nowMonoMs, sample.sampleMonoMs)
            )

            Quality.MISSING -> getString(
                R.string.measurement_missing,
                name,
                getString(R.string.quality_missing)
            )
        }
    }

    private fun formatValue(value: SampleValue?): String = when (value) {
        null -> getString(R.string.quality_missing)
        is SampleValue.Integer -> value.value.toString()
        is SampleValue.Decimal -> String.format(Locale.US, "%.1f", value.value)
        is SampleValue.Vector3 -> String.format(
            Locale.US,
            "(%.2f, %.2f, %.2f)",
            value.x,
            value.y,
            value.z
        )
        is SampleValue.Text -> when (value.value) {
            "charging" -> getString(R.string.charge_charging)
            "discharging" -> getString(R.string.charge_discharging)
            "not_charging" -> getString(R.string.charge_not_charging)
            "full" -> getString(R.string.charge_full)
            "near" -> getString(R.string.proximity_near)
            "far" -> getString(R.string.proximity_far)
            else -> value.value
        }
        is SampleValue.Network -> getString(
            R.string.network_value,
            transportName(value.transport),
            getString(R.string.label_internet),
            yesNo(value.internetCapable),
            getString(R.string.label_validated),
            yesNo(value.validated)
        )
    }

    private fun formatAge(nowMonoMs: Long, sampleMonoMs: Long?): String {
        val ageSeconds = ((nowMonoMs - (sampleMonoMs ?: nowMonoMs)).coerceAtLeast(0)) / 1_000
        return if (ageSeconds >= 60) {
            getString(R.string.age_minutes_seconds, ageSeconds / 60, ageSeconds % 60)
        } else {
            getString(R.string.age_seconds, ageSeconds)
        }
    }

    private fun capabilityName(id: CapabilityId): String = getString(
        when (id) {
            CapabilityId.BATTERY_LEVEL -> R.string.cap_battery_level
            CapabilityId.BATTERY_PACK_TEMPERATURE -> R.string.cap_battery_temp
            CapabilityId.BATTERY_VOLTAGE -> R.string.cap_battery_voltage
            CapabilityId.BATTERY_CHARGE_STATE -> R.string.cap_charge_state
            CapabilityId.ACCELEROMETER -> R.string.cap_accel
            CapabilityId.PROXIMITY -> R.string.cap_proximity
            CapabilityId.NETWORK -> R.string.cap_network
            CapabilityId.SIGNAL -> R.string.cap_signal
        }
    )

    private fun outcomeText(outcome: SendOutcome?): String = getString(
        when (outcome) {
            SendOutcome.ACCEPTED -> R.string.outcome_accepted
            SendOutcome.RETRYABLE -> R.string.outcome_retryable
            SendOutcome.SESSION_LOST -> R.string.outcome_session_lost
            SendOutcome.OPEN_FAILED -> R.string.outcome_open_failed
            null -> R.string.outcome_none
        }
    )

    private fun stopReasonName(reason: StopReason): String = getString(
        when (reason) {
            StopReason.USER -> R.string.stop_reason_user
            StopReason.SYSTEM_TIMEOUT -> R.string.stop_reason_system_timeout
            StopReason.DESTROYED -> R.string.stop_reason_destroyed
        }
    )

    private fun transportName(transport: NetworkTransport): String =
        getString(
            when (transport) {
                NetworkTransport.NONE -> R.string.transport_none
                NetworkTransport.WIFI -> R.string.transport_wifi
                NetworkTransport.CELLULAR -> R.string.transport_cellular
                NetworkTransport.OTHER -> R.string.transport_other
            }
        )

    private fun yesNo(value: Boolean): String =
        getString(if (value) R.string.yes else R.string.no)
}
