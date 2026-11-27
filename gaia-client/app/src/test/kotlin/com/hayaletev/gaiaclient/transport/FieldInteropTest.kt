package com.hayaletev.gaiaclient.transport

import com.hayaletev.gaiaclient.core.*
import com.hayaletev.gaiaclient.pairing.*
import com.hayaletev.gaiaclient.protocol.parseObject
import com.hayaletev.gaiaclient.protocol.str
import com.hayaletev.gaiaclient.support.RepoPaths
import java.io.File
import java.nio.file.Files
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.cert.CertificateException
import java.security.spec.ECGenParameterSpec
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class FieldInteropTest {
    private class Keys : PairingKeys {
        val pairs = mutableMapOf<String, KeyPair>()

        override fun generate(alias: String) =
            KeyPairGenerator.getInstance("EC").run {
                initialize(ECGenParameterSpec("secp256r1"))
                generateKeyPair().also { pairs[alias] = it }
            }

        override fun load(alias: String) = pairs[alias]

        override fun delete(alias: String) {
            pairs.remove(alias)
        }
    }

    private class Clock : MonoClock {
        @Volatile var extra = 0L
        @Volatile var wallJump = 0L

        override fun elapsedRealtimeMs() = System.nanoTime() / 1000000 + extra

        override fun wallTimeMs() = System.currentTimeMillis() + extra + wallJump
    }

    private class Fixture(
        val dir: File,
        val store: PairingStore,
        val keys: Keys,
        val spki: String,
        val center: Process,
    ) {
        val bytes
            get() = dir.resolve("package.json").readBytes()

        val pin
            get() = dir.resolve("pin").readText()

        val clock = Clock()

        fun mode(s: String) = dir.resolve("mode").writeText(s)

        fun events() = dir.resolve("events").takeIf { it.exists() }?.readLines() ?: emptyList()

        fun transport() =
            FieldTransport(store.install(bytes, pin), clock) { host, _ ->
                java.net.InetAddress.getByName(host)
            }

        fun context() =
            SessionOpenContext(store.active().id, UUID.randomUUID().toString(), emptyList())

        fun packet(id: String) =
            ObservationPacket(
                sessionId = id,
                seq = 1,
                sentMonoMs = clock.elapsedRealtimeMs(),
                deviceWallMs = clock.wallTimeMs(),
                samples = emptyList(),
            )
    }

    private fun fixture(san: String = "correct", work: suspend Fixture.() -> Unit) = runBlocking {
        val dir = Files.createTempDirectory("gaia-b6-jvm-").toFile()
        val repo = RepoPaths.protocolDir().parentFile!!.parentFile!!
        var center: Process? = null
        try {
            val keys = Keys()
            val store = PairingStore(dir.resolve("install"), keys)
            val req = store.request()
            dir.resolve("request.json").writeBytes(req.bytes)
            center =
                ProcessBuilder(
                        "node",
                        "--import",
                        "tsx",
                        "gaia-client/app/src/test/interop/center.mts",
                        dir.path,
                        san,
                    )
                    .directory(repo)
                    .redirectError(ProcessBuilder.Redirect.INHERIT)
                    .start()
            assertEquals("ready", center.inputStream.bufferedReader().readLine())
            Fixture(dir, store, keys, req.spki, center).work()
        } finally {
            center?.outputStream?.close()
            if (center != null && !center.waitFor(5, TimeUnit.SECONDS))
                center.destroyForcibly().waitFor()
            dir.deleteRecursively()
        }
    }

    @Test
    fun b32InstallationIsAtomicAndBoundToTheLocalCandidate() = fixture {
        assertTrue(runCatching { store.active() }.isFailure)
        assertEquals(spki, store.request().spki)
        fun reject(bytes: ByteArray, trust: String = pin) =
            assertThrows(Exception::class.java) { store.install(bytes, trust) }
        reject(bytes, "0".repeat(64))
        reject(bytes.copyOf(bytes.size / 2))
        val pkg = parseObject(bytes)
        val approval = pkg.getAsJsonObject("approval")
        for ((field, value) in
            mapOf(
                "projectId" to "other",
                "hardwareId" to "other",
                "deviceId" to "other",
                "installationId" to UUID.randomUUID().toString(),
                "operationId" to UUID.randomUUID().toString(),
                "httpsOrigin" to "https://other.test",
                "publicKeyFingerprint" to "0".repeat(64),
            )) {
            val original = approval.str(field)
            approval.addProperty(field, value)
            reject(pkg.toString().toByteArray())
            approval.addProperty(field, original)
        }
        val cert = decodeDer(pkg.str("clientCertificate"))
        for (bad in
            listOf(
                (cert + 0.toByte()).base64(),
                cert.base64() + " ",
                cert.copyOf(cert.size - 1).base64(),
            )) {
            pkg.addProperty("clientCertificate", bad)
            reject(pkg.toString().toByteArray())
        }
        val site = store.install(bytes, pin)
        assertEquals(spki, site.client.publicKey.encoded.fingerprint())
        assertEquals(site.id, store.install(bytes, pin).id)
        assertThrows(CertificateException::class.java) {
            verifyInstallation(bytes, pin, site.id, site.keys, site.client.notBefore.time - 1)
        }
        assertThrows(CertificateException::class.java) {
            verifyInstallation(bytes, pin, site.id, site.keys, site.client.notAfter.time + 1)
        }
        assertThrows(Exception::class.java) {
            checkCertificate(
                site.client,
                site.ca,
                "server",
                System.currentTimeMillis(),
                "127.0.0.1",
            )
        }
        val next = store.request()
        assertNotEquals(spki, next.spki)
        assertEquals(site.id, store.active().id)
        assertThrows(Exception::class.java) {
            verifyInstallation(
                bytes,
                pin,
                site.id,
                keys.pairs.values.last(),
                System.currentTimeMillis(),
            )
        }
        assertThrows(Exception::class.java) {
            verifyInstallation(
                bytes,
                pin,
                site.id,
                KeyPair(site.keys.public, keys.pairs.values.last().private),
                System.currentTimeMillis(),
            )
        }
        dir.resolve("request.json").writeBytes(next.bytes)
        center.outputStream.apply {
            write("renew\n".toByteArray())
            flush()
        }
        assertEquals("renewed", center.inputStream.bufferedReader().readLine())
        val renewal = dir.resolve("renewal.json").readBytes()
        val spoiled = parseObject(renewal)
        spoiled
            .getAsJsonObject("approval")
            .getAsJsonObject("change")
            .addProperty("assignmentId", UUID.randomUUID().toString())
        reject(spoiled.toString().toByteArray())
        assertEquals(spki, store.active().keys.public.encoded.fingerprint())
        val obstruction = dir.resolve("install/field-installation.tmp")
        assertTrue(obstruction.mkdir())
        obstruction.resolve("occupied").writeText("test")
        reject(renewal)
        assertEquals(spki, store.active().keys.public.encoded.fingerprint())
        assertEquals(next.spki, store.request().spki)
        assertTrue(obstruction.deleteRecursively())
        assertEquals(next.spki, store.install(renewal, pin).keys.public.encoded.fingerprint())
        assertEquals(1, keys.pairs.size)
        reject(bytes)
        keys.pairs.clear()
        assertTrue(runCatching { store.active() }.isFailure)
        dir.resolve("install/field-installation").writeText("{}")
        assertTrue(runCatching { store.request() }.isFailure)
    }

    @Test
    fun tls12NegotiatesEcdheAeadWithMutualAuthentication() =
        fixture("tls12") {
            val t = transport()
            try {
                assertTrue(t.open(context()) is OpenResult.Opened)
                val negotiated = dir.resolve("negotiated").readText()
                assertTrue(
                    negotiated,
                    negotiated.matches(
                        Regex(
                            "TLSv1.2 TLS_ECDHE_ECDSA_WITH_(AES_(128|256)_GCM|CHACHA20_POLY1305)_SHA(256|384)"
                        )
                    ),
                )
            } finally {
                t.close()
            }
        }

    @Test
    fun wrongServerSanFailsDuringHandshake() =
        fixture("wrong-san") {
            val t = transport()
            try {
                assertEquals(OpenResult.Terminal(FieldError.CERTIFICATE), t.open(context()))
                assertTrue(events().isEmpty())
            } finally {
                t.close()
            }
        }

    @Test
    fun uncertainResponsesKeepIdenticalBytesUntilAckAndRevocationStopsAccess() = fixture {
        val t = transport()
        try {
            val session = t.open(context()) as OpenResult.Opened
            assertTrue(dir.resolve("negotiated").readText().startsWith("TLSv1.3 "))
            val p = packet(session.sessionId)
            for (failure in listOf("wrong-ack", "eof", "redirect", "busy")) {
                mode(failure)
                val retry =
                    t.send(p.copy(deviceWallMs = clock.wallTimeMs())) as SendResult.Retryable
                if (failure == "busy") assertEquals(7000L, retry.retryAfterMs)
                clock.extra += 5100
            }
            mode("ok")
            val ack = t.send(p) as SendResult.Accepted
            assertEquals(session.sessionId, ack.sessionId)
            assertEquals(1L, ack.seq)
            val hashes =
                events().filter { it.startsWith("/gaia/v1/observations") }.map { it.split(" ")[1] }
            assertEquals(5, hashes.size)
            assertEquals(1, hashes.distinct().size)
            clock.extra += 5100
            mode("revoke")
            assertEquals(SendResult.Terminal(FieldError.AUTHORIZATION), t.send(p.copy(seq = 2)))
            assertEquals(OpenResult.Terminal(FieldError.AUTHORIZATION), t.open(context()))
        } finally {
            t.close()
        }
    }

    @Test
    fun expiredSessionAnd35sDeadlineDropPendingBytes() = fixture {
        val t = transport()
        try {
            val first = t.open(context()) as OpenResult.Opened
            mode("expired")
            assertTrue(t.send(packet(first.sessionId)) is SendResult.SessionLost)
            t.endSession()
            mode("ok")
            val next = t.open(context()) as OpenResult.Opened
            assertNotEquals(first.sessionId, next.sessionId)
            clock.extra += 35000
            val before = events()
            assertTrue(t.send(packet(next.sessionId)) is SendResult.SessionLost)
            assertEquals(before, events())
        } finally {
            t.close()
        }
    }

    @Test
    fun stopInterruptsRealOpenAndSendAndReleasesTheSocket() = fixture {
        for (opening in listOf(true, false)) {
            mode(if (opening) "stall" else "stall-send")
            val t = transport()
            val ctx = context()
            val store = com.hayaletev.gaiaclient.support.RecordingSampleStore()
            val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
            val engine =
                CollectionEngine(
                    scope,
                    t,
                    store,
                    SnapshotFactory(clock),
                    clock,
                    CoroutineSleeper,
                    FullJitterBackoff(),
                    com.hayaletev.gaiaclient.support.RecordingEngineEvents(),
                    ctx.installationId,
                    ctx.runId,
                    emptyList(),
                )
            val initial = events().size
            try {
                engine.start()
                val path = if (opening) "/gaia/v1/sessions" else "/gaia/v1/observations"
                withTimeout(3000) {
                    while (events().drop(initial).none { it.startsWith(path) }) delay(10)
                }
                val count = events().size
                assertTrue(t.open(ctx) is OpenResult.Failed)
                assertEquals(count, events().size)
                withTimeout(1000) {
                    engine.stop()?.join()
                    while (events().last() != "closed") delay(10)
                }
                assertEquals(EnginePhase.STOPPED, engine.state().phase)
                assertTrue(store.sentPacketsCopy().isEmpty())
                assertEquals(1, store.endCount())
            } finally {
                engine.stop()
                t.close()
                scope.cancel()
            }
        }
        withTimeout(1000) {
            while (Thread.getAllStackTraces().keys.any { it.name == "gaia-tls-deadline" }) delay(10)
        }
    }

    @Test
    fun timeoutAndClockJumpCloseInFlightConnectionAndRequireFreshHandshake() = fixture {
        val t = transport()
        try {
            val ctx = context()
            mode("stall")
            val start = System.nanoTime()
            assertTrue(withTimeout(7000) { t.open(ctx) } is OpenResult.Failed)
            assertTrue(System.nanoTime() - start >= 4500000000L)
            mode("ok")
            val session = t.open(ctx) as OpenResult.Opened
            mode("stall")
            coroutineScope {
                val pending = async { t.send(packet(session.sessionId)) }
                withTimeout(3000) {
                    while (!events().any { it.startsWith("/gaia/v1/observations") }) delay(10)
                }
                clock.wallJump = 86400000
                assertTrue(withTimeout(1000) { pending.await() } is SendResult.Retryable)
            }
            clock.extra += 5100
            mode("ok")
            assertTrue(t.send(packet(session.sessionId)) is SendResult.Accepted)
        } finally {
            t.close()
        }
    }
}
