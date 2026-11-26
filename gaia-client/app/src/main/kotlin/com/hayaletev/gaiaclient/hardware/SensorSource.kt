package com.hayaletev.gaiaclient.hardware

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.Sample
import com.hayaletev.gaiaclient.core.SampleMemory
import com.hayaletev.gaiaclient.hardware.mapping.AccelMapper
import com.hayaletev.gaiaclient.hardware.mapping.AccelReading
import com.hayaletev.gaiaclient.hardware.mapping.ProximityMapper
import com.hayaletev.gaiaclient.hardware.mapping.ProximityReading

class SensorSource(
    context: Context,
    private val memory: SampleMemory
) {
    private val sensorManager =
        context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

    private val accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private val proximity = sensorManager
        ?.getDefaultSensor(Sensor.TYPE_PROXIMITY)
        ?.takeIf { it.maximumRange.isFinite() && it.maximumRange > 0f }

    private val registered = LinkedHashSet<Int>()

    private val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            when (event.sensor.type) {
                Sensor.TYPE_ACCELEROMETER -> {
                    val values = event.values
                    if (values.size < 3) {
                        memory.offer(
                            Sample.invalid(
                                CapabilityId.ACCELEROMETER,
                                event.timestamp / 1_000_000L
                            )
                        )
                    } else {
                        memory.offer(
                            AccelMapper.map(
                                AccelReading(
                                    x = values[0],
                                    y = values[1],
                                    z = values[2],
                                    timestampNs = event.timestamp,
                                    accuracy = event.accuracy
                                )
                            )
                        )
                    }
                }

                Sensor.TYPE_PROXIMITY -> {
                    val mapped = ProximityMapper.map(
                        ProximityReading(
                            distance = event.values.firstOrNull() ?: Float.NaN,
                            maxRange = event.sensor.maximumRange,
                            timestampNs = event.timestamp,
                            accuracy = event.accuracy
                        )
                    )
                    memory.offer(mapped ?: Sample.missing(CapabilityId.PROXIMITY))
                }
            }
        }

        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) = Unit
    }

    fun hasAccelerometer(): Boolean = accelerometer != null

    fun hasProximity(): Boolean = proximity != null

    fun renew(accepted: Set<CapabilityId>) {
        unregisterAll()
        if (CapabilityId.ACCELEROMETER in accepted) {
            register(accelerometer, Sensor.TYPE_ACCELEROMETER, CapabilityId.ACCELEROMETER)
        }
        if (CapabilityId.PROXIMITY in accepted) {
            register(proximity, Sensor.TYPE_PROXIMITY, CapabilityId.PROXIMITY)
        }
    }

    fun resubscribe(ids: Set<CapabilityId>) {
        if (CapabilityId.ACCELEROMETER in ids) {
            unregister(Sensor.TYPE_ACCELEROMETER)
            memory.offer(Sample.missing(CapabilityId.ACCELEROMETER))
            register(accelerometer, Sensor.TYPE_ACCELEROMETER, CapabilityId.ACCELEROMETER)
        }
        if (CapabilityId.PROXIMITY in ids) {
            unregister(Sensor.TYPE_PROXIMITY)
            memory.offer(Sample.missing(CapabilityId.PROXIMITY))
            register(proximity, Sensor.TYPE_PROXIMITY, CapabilityId.PROXIMITY)
        }
    }

    fun release() {
        unregisterAll()
    }

    private fun register(sensor: Sensor?, type: Int, id: CapabilityId) {
        if (sensor == null || sensorManager == null) {
            memory.offer(Sample.missing(id))
            return
        }
        val ok = sensorManager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        if (ok) {
            registered += type
        } else {
            memory.offer(Sample.missing(id))
        }
    }

    private fun unregister(type: Int) {
        if (!registered.remove(type)) return
        when (type) {
            Sensor.TYPE_ACCELEROMETER -> sensorManager?.unregisterListener(listener, accelerometer)
            Sensor.TYPE_PROXIMITY -> sensorManager?.unregisterListener(listener, proximity)
        }
    }

    private fun unregisterAll() {
        for (type in registered.toList()) unregister(type)
        sensorManager?.unregisterListener(listener)
        registered.clear()
    }
}
