package com.hayaletev.gaiaclient.support

import com.hayaletev.gaiaclient.core.ObservationPacket
import com.hayaletev.gaiaclient.transport.OpenResult
import com.hayaletev.gaiaclient.transport.SendResult
import com.hayaletev.gaiaclient.transport.SessionOpenContext
import com.hayaletev.gaiaclient.transport.TransportAdapter
import com.hayaletev.gaiaclient.transport.TransportMode
import kotlinx.coroutines.channels.Channel
import java.util.concurrent.atomic.AtomicInteger

class ScriptedTransport(
    private val onEvent: (String) -> Unit = {}
) : TransportAdapter {
    override val mode: TransportMode = TransportMode.LOCAL_TEST

    private val openContexts = Channel<SessionOpenContext>(Channel.UNLIMITED)
    private val openResults = Channel<OpenResult>(Channel.UNLIMITED)
    private val sends = Channel<ObservationPacket>(Channel.UNLIMITED)
    private val sendResults = Channel<SendResult>(Channel.UNLIMITED)

    val closeCount = AtomicInteger()

    override suspend fun open(context: SessionOpenContext): OpenResult {
        onEvent("open")
        openContexts.send(context)
        return openResults.receive()
    }

    override suspend fun send(packet: ObservationPacket): SendResult {
        onEvent("send")
        sends.send(packet)
        return sendResults.receive()
    }

    override fun close() {
        onEvent("close")
        closeCount.incrementAndGet()
    }

    suspend fun nextOpenContext(): SessionOpenContext = openContexts.receive()

    fun tryNextOpenContext(): SessionOpenContext? = openContexts.tryReceive().getOrNull()

    fun respondOpen(result: OpenResult) {
        openResults.trySend(result)
    }

    suspend fun nextSend(): ObservationPacket = sends.receive()

    fun tryNextSend(): ObservationPacket? = sends.tryReceive().getOrNull()

    fun respondSend(result: SendResult) {
        sendResults.trySend(result)
    }
}
