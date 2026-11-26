package com.hayaletev.gaiaclient.core

import kotlin.random.Random

interface Backoff {
    fun nextDelayMs(): Long
    fun reset()
}

class FullJitterBackoff(private val random: Random = Random.Default) : Backoff {
    private val caps = longArrayOf(1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000)
    private var index = 0

    override fun nextDelayMs(): Long {
        val cap = caps[index.coerceAtMost(caps.lastIndex)]
        if (index < caps.lastIndex) index += 1
        return random.nextLong(0, cap + 1)
    }

    override fun reset() {
        index = 0
    }
}
