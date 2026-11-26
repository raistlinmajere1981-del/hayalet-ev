package com.hayaletev.gaiaclient.support

import com.hayaletev.gaiaclient.core.MonoClock

class FixedClock(
    var elapsed: Long = 5_000,
    var wall: Long = 1_700_000_000_000
) : MonoClock {
    override fun elapsedRealtimeMs(): Long = elapsed
    override fun wallTimeMs(): Long = wall
}
