package com.hayaletev.gaiadiagnostic.hardware

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.SystemClock

/**
 * Collects hardware state using only standard Android APIs; no root required.
 * Returns null/absent fields when hardware is unavailable rather than fabricating values.
 */
class HardwareCollector(private val context: Context) {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    // ---- Battery ----

    fun getBatterySnapshot(): BatterySnapshot {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val pct = if (level >= 0 && scale > 0) (level * 100 / scale) else -1
        // Temperature is in tenths of a degree Celsius (battery pack sensor, NOT ambient air)
        val tempTenths = intent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE) ?: Int.MIN_VALUE
        val tempC = if (tempTenths != Int.MIN_VALUE) tempTenths / 10.0f else null
        val voltage = intent?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1) ?: -1
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
        return BatterySnapshot(
            levelPct = pct,
            temperatureBatteryC = tempC,
            voltageMillivolts = if (voltage >= 0) voltage else null,
            chargingStatus = chargingStatusString(status),
            plugged = pluggedString(plugged)
        )
    }

    private fun chargingStatusString(status: Int) = when (status) {
        BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
        BatteryManager.BATTERY_STATUS_DISCHARGING -> "discharging"
        BatteryManager.BATTERY_STATUS_FULL -> "full"
        BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not_charging"
        else -> "unknown"
    }

    private fun pluggedString(plugged: Int) = when (plugged) {
        BatteryManager.BATTERY_PLUGGED_AC -> "ac"
        BatteryManager.BATTERY_PLUGGED_USB -> "usb"
        BatteryManager.BATTERY_PLUGGED_WIRELESS -> "wireless"
        0 -> "unplugged"
        else -> "unknown"
    }

    // ---- Sensors ----

    fun listSensors(): List<SensorInfo> {
        return sensorManager.getSensorList(Sensor.TYPE_ALL).map {
            SensorInfo(
                type = it.type,
                name = it.name,
                vendor = it.vendor,
                version = it.version,
                maxRange = it.maximumRange,
                resolution = it.resolution,
                power = it.power,
                minDelay = it.minDelay
            )
        }
    }

    fun hasAccelerometer(): Boolean =
        sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null

    fun hasProximity(): Boolean =
        sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY) != null

    fun getSensorManager(): SensorManager = sensorManager

    // ---- Network ----

    fun getNetworkSnapshot(): NetworkSnapshot {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork
        val caps = network?.let { cm.getNetworkCapabilities(it) }
        val hasInternet = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        val isWifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        val isCellular = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true

        val wifiRssi: Int? = if (isWifi) {
            @Suppress("DEPRECATION")
            val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val info = wm.connectionInfo
            if (info != null && info.rssi != -127) info.rssi else null
        } else null

        return NetworkSnapshot(
            hasInternet = hasInternet,
            isWifi = isWifi,
            isCellular = isCellular,
            wifiRssiDbm = wifiRssi
        )
    }

    // ---- Camera / Microphone availability ----

    fun hasCameraHardware(): Boolean =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)

    fun hasMicrophoneHardware(): Boolean =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_MICROPHONE)

    // ---- System time ----

    fun getTimestamps(): TimestampSnapshot {
        val wallMs = System.currentTimeMillis()
        val monotonicMs = SystemClock.elapsedRealtime()
        return TimestampSnapshot(wallMs = wallMs, monotonicMs = monotonicMs)
    }
}

data class BatterySnapshot(
    val levelPct: Int,
    /** Battery pack temperature in Celsius — NOT ambient air temperature */
    val temperatureBatteryC: Float?,
    val voltageMillivolts: Int?,
    val chargingStatus: String,
    val plugged: String
)

data class SensorInfo(
    val type: Int,
    val name: String,
    val vendor: String,
    val version: Int,
    val maxRange: Float,
    val resolution: Float,
    val power: Float,
    val minDelay: Int
)

data class NetworkSnapshot(
    val hasInternet: Boolean,
    val isWifi: Boolean,
    val isCellular: Boolean,
    val wifiRssiDbm: Int?
)

data class TimestampSnapshot(
    val wallMs: Long,
    val monotonicMs: Long
)
