package com.hayaletev.gaiaclient.hardware

import android.content.Context
import android.content.pm.PackageManager
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.MonoClock
import com.hayaletev.gaiaclient.core.SampleMemory

class HardwareSnapshotSource(
    context: Context,
    clock: MonoClock
) {
    private val appContext = context.applicationContext

    val memory = SampleMemory()

    private val battery = BatterySource(appContext, clock, memory)
    private val sensors = SensorSource(appContext, memory)
    private val network = NetworkSource(appContext, clock, memory)
    private val gate = SubscriptionGate()

    val found: List<CapabilityId> = buildList {
        add(CapabilityId.BATTERY_LEVEL)
        add(CapabilityId.BATTERY_PACK_TEMPERATURE)
        add(CapabilityId.BATTERY_VOLTAGE)
        add(CapabilityId.BATTERY_CHARGE_STATE)
        if (sensors.hasAccelerometer()) add(CapabilityId.ACCELEROMETER)
        if (sensors.hasProximity()) add(CapabilityId.PROXIMITY)
        add(CapabilityId.NETWORK)
        if (
            network.hasWifi() &&
            appContext.packageManager.hasSystemFeature(PackageManager.FEATURE_WIFI)
        ) {
            add(CapabilityId.SIGNAL)
        }
    }

    fun start() {
        gate.whileOpen {
            battery.start()
            network.start()
        }
    }

    fun onSessionOpened(accepted: List<CapabilityId>, floorMonoMs: Long) {
        // The engine already called memory.beginSession with this floor. Sensors
        // registered before the session could still deliver pre-floor events, so
        // renewing them here is what makes post-open evidence trustworthy.
        gate.whileOpen {
            sensors.renew(accepted.toSet())
            network.resetSignal()
        }
    }

    fun onSessionClosed() {
        gate.whileOpen {
            sensors.release()
            network.resetSignal()
        }
    }

    fun refreshNetwork() {
        // No subscription is created here; a close may end the session between
        // the check and the offer, in which case SampleMemory rejects it.
        if (!gate.isClosed()) network.refresh()
    }

    fun resubscribe(ids: Set<CapabilityId>) {
        gate.whileOpen {
            val sensorIds = ids.filter {
                it == CapabilityId.ACCELEROMETER || it == CapabilityId.PROXIMITY
            }.toSet()
            if (sensorIds.isNotEmpty()) sensors.resubscribe(sensorIds)
            if (CapabilityId.SIGNAL in ids) network.resetSignal()
            if (CapabilityId.NETWORK in ids) network.refresh()
        }
    }

    fun dispose() {
        gate.close {
            // Cleanup is best-effort: one failing unregister must not leave the
            // remaining sensors or receivers attached after Stop.
            runCatching { battery.stop() }
            runCatching { network.stop() }
            runCatching { sensors.release() }
            memory.endSession()
        }
    }
}
