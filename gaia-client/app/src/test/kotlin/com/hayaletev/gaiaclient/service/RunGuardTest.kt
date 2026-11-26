package com.hayaletev.gaiaclient.service

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RunGuardTest {
    @Test
    fun stopInvalidatesTheOldRunAndStartCreatesANewGeneration() {
        val guard = RunGuard()
        val first = guard.start()
        assertTrue(guard.isCurrent(first))

        guard.stop()
        assertFalse(guard.isCurrent(first))
        assertFalse(guard.isRunning())

        val second = guard.start()
        assertTrue(guard.isCurrent(second))
        assertFalse(guard.isCurrent(first))
    }

    @Test
    fun repeatedStopDoesNotMakeAnOldGenerationCurrent() {
        val guard = RunGuard()
        val first = guard.start()
        guard.stop()
        guard.stop()

        assertFalse(guard.isCurrent(first))
        assertFalse(guard.isRunning())
    }

    @Test
    fun aLateCallbackFromThePreviousRunCannotPublishAfterRestart() {
        val guard = RunGuard()
        val first = guard.start()
        guard.stop()
        val second = guard.start()

        assertFalse(guard.isCurrent(first))
        assertTrue(guard.isCurrent(second))
    }
}
