package com.hayaletev.gaiaclient.service

/**
 * Owns the run generation used to reject callbacks and UI states that belong
 * to an earlier Start. Kept free of Android types so the Stop/Start ordering
 * is deterministic under JVM tests.
 */
internal class RunGuard {
    private val lock = Any()
    private var generation = 0L
    private var running = false

    fun start(): Long = synchronized(lock) {
        generation += 1
        running = true
        generation
    }

    fun stop() = synchronized(lock) {
        generation += 1
        running = false
    }

    fun isCurrent(candidate: Long): Boolean = synchronized(lock) {
        running && candidate == generation
    }

    fun isRunning(): Boolean = synchronized(lock) { running }
}
