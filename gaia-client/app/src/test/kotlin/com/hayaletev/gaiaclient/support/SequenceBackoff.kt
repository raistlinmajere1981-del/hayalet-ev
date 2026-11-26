package com.hayaletev.gaiaclient.support

import com.hayaletev.gaiaclient.core.Backoff

class SequenceBackoff(vararg delays: Long) : Backoff {
    private val values = delays.toList()
    private var index = 0
    private var resetCount = 0

    override fun nextDelayMs(): Long {
        val delay = values.getOrElse(index) { values.lastOrNull() ?: 0L }
        index += 1
        return delay
    }

    override fun reset() {
        index = 0
        resetCount += 1
    }

    fun resetCount(): Int = resetCount
}
