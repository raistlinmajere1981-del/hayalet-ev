package com.hayaletev.gaiaclient.transport

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.ObservationPacket

enum class TransportMode { LOCAL_TEST }

data class SessionOpenContext(
    val installationId: String,
    val runId: String,
    val offered: List<CapabilityId>
)

sealed interface OpenResult {
    data class Opened(
        val sessionId: String,
        val accepted: List<CapabilityId>,
        val intervalMs: Long
    ) : OpenResult

    data class Failed(val reason: String) : OpenResult
}

sealed interface SendResult {
    data class Accepted(val sessionId: String, val seq: Long) : SendResult
    data class Retryable(val reason: String) : SendResult
    data class Rejected(val reason: String) : SendResult
    data class SessionLost(val reason: String) : SendResult
}

/**
 * B6 replaces the implementation behind this seam, not the collection engine.
 * The B5 fake accepts locally; a real adapter must map the wire contract as
 * follows:
 *
 * - `Accepted` only after a matching server ACK for this `sessionId` and `seq`.
 * - HTTP 403 / revoked authorization is terminal: B6 adds a terminal result so
 *   the engine stops instead of reopening the session.
 * - `Retry-After` travels with `Retryable`; the engine waits at least that long
 *   in addition to its backoff.
 * - The 35 s session timeout closes the session with `SessionLost`; the next
 *   open starts a new session at `seq = 1`.
 */
interface TransportAdapter {
    val mode: TransportMode
    suspend fun open(context: SessionOpenContext): OpenResult
    suspend fun send(packet: ObservationPacket): SendResult
    fun close()
}
