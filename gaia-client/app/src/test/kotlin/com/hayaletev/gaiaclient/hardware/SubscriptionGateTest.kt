package com.hayaletev.gaiaclient.hardware

import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SubscriptionGateTest {
    @Test
    fun closeWaitsForInFlightWorkAndBlocksLaterWork() {
        val gate = SubscriptionGate()
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val closeStarted = CountDownLatch(1)
        val order = CopyOnWriteArrayList<String>()

        val register = thread(name = "gate-register") {
            gate.whileOpen {
                order += "register"
                entered.countDown()
                release.await()
            }
        }
        assertTrue(entered.await(2, TimeUnit.SECONDS))

        val close = thread(name = "gate-close") {
            closeStarted.countDown()
            gate.close { order += "close" }
        }
        assertTrue(closeStarted.await(2, TimeUnit.SECONDS))

        release.countDown()
        register.join(2_000)
        close.join(2_000)

        assertFalse(register.isAlive)
        assertFalse(close.isAlive)
        assertEquals(listOf("register", "close"), order.toList())
        assertTrue(gate.isClosed())

        var laterWork = false
        val result = gate.whileOpen { laterWork = true }
        assertNull(result)
        assertFalse(laterWork)
    }

    @Test
    fun closeIsIdempotent() {
        val gate = SubscriptionGate()
        var closes = 0

        gate.close { closes += 1 }
        gate.close { closes += 1 }

        assertEquals(1, closes)
    }
}
