package com.hayaletev.gaiaclient.transport

import com.hayaletev.gaiaclient.core.MonoClock
import com.hayaletev.gaiaclient.pairing.*
import com.hayaletev.gaiaclient.protocol.WIRE_LIMIT
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.security.Principal
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import javax.net.ssl.*
import kotlin.math.abs

internal fun interface HostLookup {
    fun resolve(host: String, cancelled: () -> Boolean): InetAddress
}

internal class FieldConnection(
    private val site: Installation,
    private val clock: MonoClock,
    private val lookup: HostLookup,
) {
    private var active: Socket? = null
    private var closed = false

    @Synchronized
    fun close() {
        closed = true
        active?.close()
    }

    @Synchronized
    fun interrupt() {
        active?.close()
    }

    fun post(path: String, body: ByteArray): FieldResponse {
        require(body.size <= WIRE_LIMIT)
        val tcp = Socket()
        synchronized(this) {
            if (closed || active != null) {
                tcp.close()
                throw IOException("Connection unavailable")
            }
            active = tcp
        }
        val start = clock.elapsedRealtimeMs()
        val offset = clock.wallTimeMs() - start
        val phaseEnd = AtomicLong(start + 5000)
        fun expired(): Boolean {
            val mono = clock.elapsedRealtimeMs()
            return tcp.isClosed ||
                mono < start ||
                mono - start >= 10000 ||
                mono >= phaseEnd.get() ||
                abs(clock.wallTimeMs() - mono - offset) > 1000
        }
        val timer = Executors.newSingleThreadScheduledExecutor {
            Thread(it, "gaia-tls-deadline").apply { isDaemon = true }
        }
        try {
            timer.scheduleWithFixedDelay(
                { if (expired()) tcp.close() },
                50,
                50,
                TimeUnit.MILLISECONDS,
            )
            val host = site.origin.host.removeSurrounding("[", "]")
            val port = site.origin.port.takeIf { it != -1 } ?: 443
            val now = clock.wallTimeMs()
            site.client.checkValidity(java.util.Date(now))
            site.ca.checkValidity(java.util.Date(now))
            val address = lookup.resolve(host) { tcp.isClosed || expired() }
            tcp.connect(InetSocketAddress(address, port), 5000)
            tcp.soTimeout = 5000
            // A fresh context prevents session resumption from skipping peer verification.
            val context = SSLContext.getInstance("TLS")
            context.init(
                arrayOf(FieldKeyManager(site)),
                arrayOf(FieldTrustManager(site, clock)),
                null,
            )
            val tls = context.socketFactory.createSocket(tcp, host, port, true) as SSLSocket
            return tls.use {
                tls.enabledProtocols =
                    tls.supportedProtocols
                        .filter { it in setOf("TLSv1.2", "TLSv1.3") }
                        .toTypedArray()
                tls.enabledCipherSuites =
                    tls.supportedCipherSuites.filter { it in suites }.toTypedArray()
                tls.sslParameters =
                    tls.sslParameters.apply { endpointIdentificationAlgorithm = "HTTPS" }
                tls.startHandshake()
                if (tls.session.localCertificates?.firstOrNull() != site.client)
                    throw SSLPeerUnverifiedException("Client authentication required")
                if (expired()) throw IOException("TLS deadline or clock change")
                phaseEnd.set(clock.elapsedRealtimeMs() + 5000)
                val header =
                    "POST $path HTTP/1.1\r\nHost: ${site.origin.authority}\r\n" +
                        "Content-Type: application/json; charset=utf-8\r\nAccept: application/json\r\n" +
                        "Cache-Control: no-store\r\nConnection: close\r\nContent-Length: ${body.size}\r\n\r\n"
                tls.outputStream.apply {
                    write(header.toByteArray(Charsets.US_ASCII))
                    write(body)
                    flush()
                }
                val response =
                    readResponse(tls.inputStream.buffered()) {
                        if (expired()) throw IOException("Header deadline or clock change")
                        phaseEnd.set(clock.elapsedRealtimeMs() + 5000)
                    }
                if (expired()) throw IOException("Response deadline or clock change")
                response
            }
        } finally {
            timer.shutdownNow()
            try {
                tcp.close()
            } finally {
                synchronized(this) { active = null }
            }
        }
    }

    private companion object {
        val suites =
            setOf(
                "TLS_AES_128_GCM_SHA256",
                "TLS_AES_256_GCM_SHA384",
                "TLS_CHACHA20_POLY1305_SHA256",
                "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
                "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
                "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
            )
    }
}

private class FieldTrustManager(private val site: Installation, private val clock: MonoClock) :
    X509TrustManager {
    override fun getAcceptedIssuers() = arrayOf(site.ca)

    override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) =
        throw CertificateException("Server authentication only")

    override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
        try {
            require(chain.size == 1 || chain.size == 2 && chain[1] == site.ca)
            val now = clock.wallTimeMs()
            checkCertificate(site.ca, site.ca, "ca", now)
            checkCertificate(
                certificate(chain.first().encoded),
                site.ca,
                "server",
                now,
                site.origin.host,
            )
        } catch (e: Exception) {
            throw CertificateException("Field server identity rejected", e)
        }
    }
}

private class FieldKeyManager(private val site: Installation) : X509ExtendedKeyManager() {
    override fun chooseClientAlias(
        types: Array<out String>,
        issuers: Array<out Principal>?,
        socket: Socket?,
    ) =
        "field"
            .takeIf {
                "EC" in types &&
                    (issuers.isNullOrEmpty() || site.ca.subjectX500Principal in issuers)
            }

    override fun getClientAliases(type: String, issuers: Array<out Principal>?) =
        chooseClientAlias(arrayOf(type), issuers, null)?.let { arrayOf(it) }

    override fun getCertificateChain(alias: String?) =
        if (alias == "field") arrayOf(site.client, site.ca) else null

    override fun getPrivateKey(alias: String?) = site.keys.private.takeIf { alias == "field" }

    override fun getServerAliases(type: String?, issuers: Array<out Principal>?): Array<String>? =
        null

    override fun chooseServerAlias(
        type: String?,
        issuers: Array<out Principal>?,
        socket: Socket?,
    ): String? = null
}
