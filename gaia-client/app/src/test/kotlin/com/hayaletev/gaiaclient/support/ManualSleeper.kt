package com.hayaletev.gaiaclient.support

import com.hayaletev.gaiaclient.core.Sleeper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.Channel

class ManualSleeper : Sleeper {
    private val delays = Channel<Long>(Channel.UNLIMITED)
    private val gates = Channel<CompletableDeferred<Unit>>(Channel.UNLIMITED)

    override suspend fun sleep(ms: Long) {
        val gate = CompletableDeferred<Unit>()
        delays.send(ms)
        gates.send(gate)
        gate.await()
    }

    suspend fun nextDelay(): Long = delays.receive()

    suspend fun releaseNext() {
        gates.receive().complete(Unit)
    }
}
