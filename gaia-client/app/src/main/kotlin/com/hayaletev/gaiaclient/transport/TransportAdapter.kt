package com.hayaletev.gaiaclient.transport

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.ObservationPacket

enum class TransportMode { FIELD, LOCAL_TEST }

enum class FieldError { CERTIFICATE, AUTHORIZATION, PROTOCOL }

data class SessionOpenContext(
    val installationId: String,
    val runId: String,
    val offered: List<CapabilityId>
)

sealed interface OpenResult {
    data class Opened(
        val sessionId: String,
        val accepted: List<CapabilityId>,
        val intervalMs: Long,
        val deadlineMs: Long? = null
    ) : OpenResult

    data class Terminal(val error: FieldError) : OpenResult
    data class Failed(val reason: String, val retryAfterMs: Long = 0) : OpenResult
}

sealed interface SendResult {
    data class Accepted(val sessionId: String, val seq: Long, val deadlineMs: Long? = null) : SendResult
    data class Terminal(val error: FieldError) : SendResult
    data class Retryable(val reason: String, val retryAfterMs: Long = 0) : SendResult
    data class SessionLost(val reason: String, val retryAfterMs: Long = 0) : SendResult
}

interface TransportAdapter {
    val mode: TransportMode
    suspend fun open(context: SessionOpenContext): OpenResult
    suspend fun send(packet: ObservationPacket): SendResult
    fun onClockChanged() {}
    fun endSession() = close()
    fun close()
}
