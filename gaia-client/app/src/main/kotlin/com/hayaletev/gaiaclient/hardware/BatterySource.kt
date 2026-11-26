package com.hayaletev.gaiaclient.hardware

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import com.hayaletev.gaiaclient.core.MonoClock
import com.hayaletev.gaiaclient.core.SampleMemory
import com.hayaletev.gaiaclient.hardware.mapping.BatteryMapper
import com.hayaletev.gaiaclient.hardware.mapping.BatteryReading
import com.hayaletev.gaiaclient.hardware.mapping.ChargeStatus

class BatterySource(
    private val context: Context,
    private val clock: MonoClock,
    private val memory: SampleMemory
) {
    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != Intent.ACTION_BATTERY_CHANGED) return
            val reading = BatteryReading(
                level = intent.intOrNull(BatteryManager.EXTRA_LEVEL),
                scale = intent.intOrNull(BatteryManager.EXTRA_SCALE),
                temperatureTenths = intent.intOrNull(BatteryManager.EXTRA_TEMPERATURE),
                voltageMv = intent.intOrNull(BatteryManager.EXTRA_VOLTAGE),
                status = statusOf(intent.intOrNull(BatteryManager.EXTRA_STATUS)),
                isInitialSticky = isInitialStickyBroadcast,
                receiptMonoMs = clock.elapsedRealtimeMs()
            )
            BatteryMapper.map(reading).forEach(memory::offer)
        }
    }

    fun start() {
        if (registered) return
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }
        registered = true
    }

    fun stop() {
        if (!registered) return
        context.unregisterReceiver(receiver)
        registered = false
    }

    private fun statusOf(value: Int?): ChargeStatus? = when (value) {
        null -> null
        BatteryManager.BATTERY_STATUS_CHARGING -> ChargeStatus.CHARGING
        BatteryManager.BATTERY_STATUS_DISCHARGING -> ChargeStatus.DISCHARGING
        BatteryManager.BATTERY_STATUS_NOT_CHARGING -> ChargeStatus.NOT_CHARGING
        BatteryManager.BATTERY_STATUS_FULL -> ChargeStatus.FULL
        BatteryManager.BATTERY_STATUS_UNKNOWN -> ChargeStatus.UNKNOWN
        else -> ChargeStatus.OTHER
    }

    private fun Intent.intOrNull(name: String): Int? =
        if (hasExtra(name)) getIntExtra(name, 0) else null
}
