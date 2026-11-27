package com.hayaletev.gaiaclient.pairing

/**
 * Process-wide ownership of the field identity. A pending document operation
 * can outlive its Activity, and an old run can still be draining after Stop.
 * Neither may overlap mutation of the key or published installation.
 */
internal class FieldUseGate {
    private var owner: Lease? = null

    @Synchronized
    fun acquire(): Lease? {
        if (owner != null) return null
        return Lease(this).also { owner = it }
    }

    @Synchronized
    fun occupied(): Boolean = owner != null

    @Synchronized
    private fun release(lease: Lease) {
        if (owner === lease) owner = null
    }

    class Lease internal constructor(private val gate: FieldUseGate) : AutoCloseable {
        override fun close() = gate.release(this)
    }

    companion object {
        val process = FieldUseGate()
    }
}
