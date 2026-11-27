package com.hayaletev.gaiaclient.transport

import com.hayaletev.gaiaclient.core.CapabilityId
import com.hayaletev.gaiaclient.pairing.canonicalOrigin
import com.hayaletev.gaiaclient.protocol.*
import com.hayaletev.gaiaclient.support.RepoPaths
import org.junit.Assert.*
import org.junit.Test

class FieldWireTest {
    private val fixtures = RepoPaths.protocolDir().resolve("fixtures")
    private val all = CapabilityId.entries
    private val ids = all.map { it.wireId }
    private val session = "ab7d90f6-124b-487a-a512-2441b5540978"

    private fun rejected(f: () -> Unit) {
        assertThrows(Exception::class.java, f)
    }

    @Test
    fun sessionResponseFixtures() {
        val valid = fixtures.resolve("valid/session-open-response.json").readBytes()
        assertEquals(all, opened(valid, all, ids).accepted)
        for (f in
            fixtures.resolve("invalid/schema").listFiles()!!.filter {
                it.name.startsWith("session-open-response-")
            }) {
            rejected { opened(f.readBytes(), all, ids) }
        }
        val invalid =
            fixtures
                .resolve("invalid/semantic/session-open-response-accepted-not-subset.json")
                .readBytes()
        rejected { opened(invalid, emptyList(), ids) }
        rejected { opened(valid, all, emptyList()) }
    }

    @Test
    fun ackFixturesAndExactNumbers() {
        val valid = fixtures.resolve("valid/ack.json").readText()
        assertTrue(acknowledged(valid.toByteArray(), session, 1))
        for (f in fixtures.resolve("invalid").walk().filter { it.name.startsWith("ack-") }) {
            assertFalse(runCatching { acknowledged(f.readBytes(), session, 1) }.getOrDefault(false))
        }
        for (n in
            listOf(
                "-1",
                "1.000000000000000001",
                "9007199254740992",
                "\"1\"",
                "null",
                "1e9999999",
            )) {
            rejected { acknowledged(valid.replace("1795647910913", n).toByteArray(), session, 1) }
        }
        rejected {
            acknowledged(valid.replace("\"v\":", "\"extra\":1,\"v\":").toByteArray(), session, 1)
        }
    }

    @Test
    fun sequenceBoundaryAndHandshakeFailures() {
        val max = com.hayaletev.gaiaclient.core.MAX_SAFE_INTEGER
        fun ack(seq: Long) =
            """{"v":1,"sessionId":"$session","seq":$seq,"acceptedAt":0}""".toByteArray()
        assertTrue(acknowledged(ack(max), session, max))
        rejected { acknowledged(ack(max + 1), session, max + 1) }
        val timeout = javax.net.ssl.SSLHandshakeException("handshake stopped")
        timeout.initCause(java.net.SocketTimeoutException())
        assertFalse(timeout.isCertificateFailure())
        assertFalse(javax.net.ssl.SSLHandshakeException("Remote host terminated the handshake").isCertificateFailure())
        assertTrue(javax.net.ssl.SSLException("Received fatal alert: bad_certificate").isCertificateFailure())
    }

    @Test
    fun strictJsonStreamBudgets() {
        for (name in
            listOf(
                "invalid-utf8.bin",
                "body-limit-plus-one.json",
                "duplicate-key.json",
                "prototype-keys.json",
                "depth-too-deep.json",
            )) {
            rejected { parseObject(fixtures.resolve("raw/observation-$name").readBytes()) }
        }
        parseObject(fixtures.resolve("raw/observation-body-limit-exact.json").readBytes())
        for (s in listOf("{}{}", "/* */{}", "{a:1}", "{\"v\":1,}", "{\"v\":NaN}")) rejected {
            parseObject(s.toByteArray())
        }
    }

    @Test
    fun framingCountsBodiesAndHeadersBeforeAllocation() {
        fun response(extra: String, payload: String = "") =
            readResponse(
                ("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nCache-Control: no-store\r\n" +
                        extra +
                        "\r\n" +
                        payload)
                    .byteInputStream()
            ) {}
        for (h in
            listOf(
                "Content-Length: 16385\r\n",
                "Content-Length: -1\r\n",
                "X: " + "x".repeat(8192) + "\r\n",
                "Content-Encoding: gzip\r\n",
                "Content-Length: 3\r\nContent-Length: 3\r\n",
                "Transfer-Encoding: chunked\r\nContent-Length: 1\r\n",
                "Content-Length: 10\r\n",
            )) rejected { response(h) }
        rejected { response("", "a".repeat(16385)) }
        rejected { response("Transfer-Encoding: chunked\r\n", "4001\r\n") }
        assertEquals(
            "{}",
            response("Transfer-Encoding: chunked\r\n", "2\r\n{}\r\n0\r\n\r\n").body.decodeToString(),
        )
    }

    @Test
    fun onlyCanonicalOrigins() {
        for (s in
            listOf(
                "http://test",
                "https://EXAMPLE.test",
                "https://127.1",
                "https://0x7f000001",
                "https://example.test:443",
                "https://example.test:0",
                "https://name@host",
                "https://test/",
                "https://test?",
                "https://test#",
                "https://[0000::1]",
                "https://[fe80::1%251]",
            )) rejected { canonicalOrigin(s) }
        for (s in
            listOf(
                "https://192.168.1.10",
                "https://gaia.test:8443",
                "https://[::1]",
                "https://[2001:db8::1]:8443",
            )) assertEquals(s, canonicalOrigin(s).toString())
    }
}
