package com.hayaletev.gaiaclient.hardware

/**
 * Serializes subscription work with release. Once closed, later work is
 * rejected and a concurrent close waits for the in-flight subscription before
 * releasing resources. This is what prevents a late sensor callback from
 * re-registering a listener after the service has stopped.
 */
internal class SubscriptionGate {
    private val lock = Any()

    @Volatile
    private var closed = false

    fun <T> whileOpen(block: () -> T): T? = synchronized(lock) {
        if (closed) null else block()
    }

    fun close(block: () -> Unit) {
        synchronized(lock) {
            if (closed) return
            closed = true
            block()
        }
    }

    fun isClosed(): Boolean = closed
}
