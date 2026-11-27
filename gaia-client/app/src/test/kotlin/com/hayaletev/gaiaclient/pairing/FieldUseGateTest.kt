package com.hayaletev.gaiaclient.pairing

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

class FieldUseGateTest {
    @Test
    fun recreatedActivityAndServiceCannotAcquireWhileOldMutationOwnsIdentity() {
        val gate = FieldUseGate()
        val old = requireNotNull(gate.acquire())
        assertTrue(gate.occupied())
        assertNull(gate.acquire())
        assertNull(gate.acquire())
        old.close()
        requireNotNull(gate.acquire()).use {
            assertNull(gate.acquire())
        }
        assertFalse(gate.occupied())
    }

    @Test
    fun repeatedOldReleaseCannotFreeNewRunOwnership() {
        val gate = FieldUseGate()
        val old = requireNotNull(gate.acquire())
        old.close()
        val current = requireNotNull(gate.acquire())
        old.close()
        assertNull(gate.acquire())
        current.close()
        assertFalse(gate.occupied())
    }

    @Test
    fun simultaneousStartAndMutationHaveExactlyOneOwner() {
        val gate = FieldUseGate()
        val go = CountDownLatch(1)
        val attempted = CountDownLatch(2)
        val wins = AtomicInteger()
        val workers = List(2) {
            thread {
                check(go.await(2, TimeUnit.SECONDS))
                val lease = gate.acquire()
                if (lease != null) wins.incrementAndGet()
                attempted.countDown()
                try { check(attempted.await(2, TimeUnit.SECONDS)) }
                finally { lease?.close() }
            }
        }
        go.countDown()
        workers.forEach { it.join(3000); assertFalse(it.isAlive) }
        assertEquals(1, wins.get())
        assertFalse(gate.occupied())
    }
}
