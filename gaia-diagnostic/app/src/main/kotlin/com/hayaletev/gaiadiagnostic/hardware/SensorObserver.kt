package com.hayaletev.gaiadiagnostic.hardware

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.channels.Channel

/**
 * Subscribes to accelerometer and proximity at a low rate.
 * Sensor readings arrive via callback and are forwarded once per sample.
 * Unregister via [release] when no longer needed.
 *
 * NOTE: Using SENSOR_DELAY_NORMAL (~5 Hz typical) to avoid high-frequency streaming.
 */
class SensorObserver(private val sensorManager: SensorManager) {

    private val _accelChannel = Channel<AccelReading>(capacity = Channel.CONFLATED)
    private val _proxChannel  = Channel<ProxReading>(capacity = Channel.CONFLATED)

    val accelChannel get() = _accelChannel
    val proxChannel  get() = _proxChannel

    private val accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val prox  = sensorManager.getDefaultSensor(Sensor.TYPE_PROXIMITY)

    private val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            when (event.sensor.type) {
                Sensor.TYPE_ACCELEROMETER -> {
                    _accelChannel.trySend(
                        AccelReading(event.values[0], event.values[1], event.values[2], event.timestamp)
                    )
                }
                Sensor.TYPE_PROXIMITY -> {
                    _proxChannel.trySend(
                        ProxReading(event.values[0], event.timestamp)
                    )
                }
            }
        }

        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) = Unit
    }

    fun register() {
        accel?.let { sensorManager.registerListener(listener, it, SensorManager.SENSOR_DELAY_NORMAL) }
        prox?.let  { sensorManager.registerListener(listener, it, SensorManager.SENSOR_DELAY_NORMAL) }
    }

    fun release() {
        sensorManager.unregisterListener(listener)
        _accelChannel.close()
        _proxChannel.close()
    }
}

data class AccelReading(val x: Float, val y: Float, val z: Float, val timestampNs: Long)
data class ProxReading(val distanceCm: Float, val timestampNs: Long)
