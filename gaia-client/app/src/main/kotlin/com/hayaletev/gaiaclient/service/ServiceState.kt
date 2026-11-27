package com.hayaletev.gaiaclient.service

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.core.ObservationPacket
import com.hayaletev.gaiaclient.core.SendOutcome
import com.hayaletev.gaiaclient.transport.TransportMode

enum class StopReason { USER, SYSTEM_TIMEOUT, DESTROYED }

enum class ClientError { IDENTITY_UNAVAILABLE, START_FAILED, PAIRING_BUSY, INSTALLATION, CERTIFICATE, AUTHORIZATION, PROTOCOL }

data class ClientState(
    val running: Boolean = false,
    val stopReason: StopReason? = null,
    val error: ClientError? = null,
    val transportMode: TransportMode = TransportMode.FIELD,
    val found: List<CapabilityId> = emptyList(),
    val accepted: List<CapabilityId> = emptyList(),
    val sessionShortId: String? = null,
    val tickCount: Long = 0,
    val lastOutcome: SendOutcome? = null,
    val lastPacket: ObservationPacket? = null
)

fun interface ClientListener {
    fun onState(state: ClientState)
}
