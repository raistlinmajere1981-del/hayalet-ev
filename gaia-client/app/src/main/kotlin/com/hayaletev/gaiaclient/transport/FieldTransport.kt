package com.hayaletev.gaiaclient.transport

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.hayaletev.gaiaclient.core.*
import com.hayaletev.gaiaclient.pairing.Installation
import com.hayaletev.gaiaclient.protocol.*
import java.security.cert.CertificateException
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLException
import javax.net.ssl.SSLPeerUnverifiedException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal fun opened(
    body: ByteArray,
    offered: List<CapabilityId>,
    approved: List<String>,
): OpenResult.Opened {
    val obj = parseObject(body)
    obj.fields("v", "sessionId", "accepted", "intervalMs", "timeoutMs")
    require(
        obj.integer("v") == 1L &&
            obj.integer("intervalMs") == 10000L &&
            obj.integer("timeoutMs") == 35000L
    )
    val id = obj.str("sessionId").also { require(uuidV4.matches(it)) }
    val accepted =
        obj.uniqueStrings("accepted", 32).map { wire ->
            require(wire in approved)
            requireNotNull(CapabilityId.fromWire(wire)).also { require(it in offered) }
        }
    return OpenResult.Opened(id, accepted, 10000)
}

internal fun acknowledged(body: ByteArray, id: String, seq: Long): Boolean {
    val obj = parseObject(body)
    obj.fields("v", "sessionId", "seq", "acceptedAt")
    obj.integer("acceptedAt")
    return obj.integer("v") == 1L &&
        uuidV4.matches(id) &&
        obj.str("sessionId") == id &&
        seq > 0 &&
        obj.integer("seq") == seq
}

private fun errorCode(body: ByteArray): String {
    val obj = parseObject(body)
    obj.fields("v", "error")
    require(obj.integer("v") == 1L)
    return obj.str("error")
}

internal class FieldTransport(
    private val site: Installation,
    private val clock: MonoClock,
    lookup: HostLookup,
) : TransportAdapter {
    override val mode = TransportMode.FIELD
    private val connection = FieldConnection(site, clock, lookup)
    private var session: OpenResult.Opened? = null
    private var deadline = 0L
    private var pending: Frozen? = null

    private data class Frozen(val seq: Long, val bytes: ByteArray, val started: Long)

    private val inFlight = AtomicBoolean()
    private var credit = 15000L
    private var refill = clock.elapsedRealtimeMs()

    // Each request spends five seconds of credit. Three tokens cover the opening burst.
    private fun waitForCredit(): Long {
        val now = clock.elapsedRealtimeMs()
        credit = (credit + (now - refill).coerceIn(0, 15000)).coerceAtMost(15000)
        refill = now
        if (credit < 5000) return 5000 - credit
        credit -= 5000
        return 0
    }

    override suspend fun open(context: SessionOpenContext): OpenResult =
        withContext(Dispatchers.IO) {
            if (!inFlight.compareAndSet(false, true))
                return@withContext OpenResult.Failed("request-pending")
            try {
                require(context.installationId == site.id && uuidV4.matches(context.runId))
                val wait = waitForCredit()
                if (wait > 0) return@withContext OpenResult.Failed("rate-limit", wait)
                val request =
                    JsonObject().apply {
                        addProperty("v", 1)
                        addProperty("projectId", site.project)
                        addProperty("deviceId", site.device)
                        addProperty("installationId", site.id)
                        addProperty("runId", context.runId)
                        add(
                            "offered",
                            JsonArray().apply { context.offered.forEach { add(it.wireId) } },
                        )
                    }
                val start = clock.elapsedRealtimeMs()
                val res = connection.post("/gaia/v1/sessions", request.toString().toByteArray())
                when (res.status) {
                    201 ->
                        opened(res.body, context.offered, site.capabilities)
                            .copy(deadlineMs = start + 35000)
                            .also {
                                session = it
                                deadline = start + 35000
                            }
                    403 -> OpenResult.Terminal(FieldError.AUTHORIZATION)
                    else ->
                        if (isProtocolRejection(res)) OpenResult.Terminal(FieldError.PROTOCOL)
                        else OpenResult.Failed("open-failed", res.retryAfterMs)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (e.isCertificateFailure()) OpenResult.Terminal(FieldError.CERTIFICATE)
                else OpenResult.Failed("connection")
            } finally {
                inFlight.set(false)
            }
        }

    override suspend fun send(packet: ObservationPacket): SendResult =
        withContext(Dispatchers.IO) {
            if (!inFlight.compareAndSet(false, true))
                return@withContext SendResult.Retryable("request-pending")
            try {
                val start = clock.elapsedRealtimeMs()
                val current = session
                if (current == null || packet.sessionId != current.sessionId || start >= deadline)
                    return@withContext SendResult.SessionLost("expired")
                val wait = waitForCredit()
                if (wait > 0) return@withContext SendResult.Retryable("rate-limit", wait)
                val frozen =
                    pending
                        ?: run {
                            val json = ObservationCodec.toJson(packet)
                            require(
                                ObservationValidator.validate(
                                        json,
                                        current.accepted.map { it.wireId }.toSet(),
                                    )
                                    .isEmpty()
                            )
                            Frozen(packet.seq, JsonWriter.write(json).toByteArray(), start).also {
                                pending = it
                            }
                        }
                require(frozen.seq == packet.seq)
                val res = connection.post("/gaia/v1/observations", frozen.bytes)
                when {
                    res.status == 403 -> SendResult.Terminal(FieldError.AUTHORIZATION)
                    clock.elapsedRealtimeMs() >= deadline ->
                        SendResult.SessionLost("expired", res.retryAfterMs)
                    res.status == 200 && acknowledged(res.body, current.sessionId, frozen.seq) -> {
                        pending = null
                        // A replayed ACK describes the original acceptance, not the retry.
                        deadline = frozen.started + 35000
                        SendResult.Accepted(current.sessionId, frozen.seq, deadline)
                    }
                    res.status == 409 &&
                        errorCode(res.body) in
                            setOf("session_expired", "sequence_conflict", "session_busy") ->
                        SendResult.SessionLost("session-conflict", res.retryAfterMs)
                    isProtocolRejection(res) -> SendResult.Terminal(FieldError.PROTOCOL)
                    else -> SendResult.Retryable("unconfirmed", res.retryAfterMs)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (e.isCertificateFailure()) SendResult.Terminal(FieldError.CERTIFICATE)
                else SendResult.Retryable("unconfirmed")
            } finally {
                inFlight.set(false)
            }
        }

    private fun isProtocolRejection(res: FieldResponse): Boolean =
        when (res.status) {
            400 -> errorCode(res.body) == "invalid_packet"
            413 -> errorCode(res.body) == "too_large"
            415 -> errorCode(res.body) == "media_type"
            else -> false
        }

    override fun endSession() {
        session = null
        pending = null
    }

    override fun onClockChanged() = connection.interrupt()

    override fun close() {
        connection.close()
    }
}

internal fun Exception.isCertificateFailure(): Boolean =
    generateSequence<Throwable>(this) { it.cause }.any { cause ->
        when (cause) {
            is CertificateException, is SSLPeerUnverifiedException -> true
            is SSLException -> {
                // Providers can expose a peer certificate alert without a CertificateException cause.
                val alert = cause.message.orEmpty().lowercase().replace('_', ' ')
                certificateAlerts.any { it in alert }
            }
            else -> false
        }
    }

private val certificateAlerts = listOf(
    "bad certificate", "unsupported certificate", "certificate revoked", "certificate expired",
    "certificate unknown", "unknown ca", "certificate required", "certificate verify failed"
)
