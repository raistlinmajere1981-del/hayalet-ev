package com.hayaletev.gaiaclient.hardware

import android.os.SystemClock
import com.hayaletev.gaiaclient.core.MonoClock

object SystemMonoClock : MonoClock {
    override fun elapsedRealtimeMs(): Long = SystemClock.elapsedRealtime()
    override fun wallTimeMs(): Long = System.currentTimeMillis()
}
