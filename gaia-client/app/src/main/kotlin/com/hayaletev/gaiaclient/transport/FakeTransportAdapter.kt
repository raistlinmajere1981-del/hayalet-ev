package com.hayaletev.gaiaclient.transport

import com.hayaletev.gaiaclient.core.ObservationPacket
import java.util.UUID

class FakeTransportAdapter : TransportAdapter {
    private val lock = Any()

    override val mode: TransportMode = TransportMode.LOCAL_TEST

    @Volatile
    var currentSessionId: String? = null
        private set

    @Volatile
    var lastContext: SessionOpenContext? = null
        private set

    @Volatile
    var lastPacket: ObservationPacket? = null
        private set

    @Volatile
    var sentCount: Int = 0
        private set

    override suspend fun open(context: SessionOpenContext): OpenResult = synchronized(lock) {
        if (currentSessionId != null) {
            return@synchronized OpenResult.Failed("session-already-open")
        }
        val sessionId = UUID.randomUUID().toString()
        currentSessionId = sessionId
        lastContext = context
        lastPacket = null
        OpenResult.Opened(
            sessionId = sessionId,
            accepted = context.offered,
            intervalMs = 10_000
        )
    }

    override suspend fun send(packet: ObservationPacket): SendResult = synchronized(lock) {
        val sessionId = currentSessionId
            ?: return@synchronized SendResult.SessionLost("no-open-session")
        if (packet.sessionId != sessionId) {
            return@synchronized SendResult.SessionLost("session-mismatch")
        }
        lastPacket = packet
        sentCount += 1
        SendResult.Accepted(sessionId, packet.seq)
    }

    override fun close() {
        synchronized(lock) {
            currentSessionId = null
            lastPacket = null
        }
    }
}
