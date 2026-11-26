package com.hayaletev.gaiaclient.core

import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class BackoffTest {
    @Test
    fun fullJitterStaysWithinCapsAndResets() {
        val backoff = FullJitterBackoff(Random(1234))
        val caps = listOf(1_000L, 2_000L, 4_000L, 8_000L, 16_000L, 32_000L, 60_000L, 60_000L)
        for (cap in caps) {
            assertTrue(backoff.nextDelayMs() in 0..cap)
        }

        backoff.reset()
        assertTrue(backoff.nextDelayMs() in 0..1_000L)
    }
}
