package com.hayaletev.gaiaclient.pairing

import com.hayaletev.gaiaclient.protocol.*
import java.net.URL
import java.security.KeyPair
import java.security.SecureRandom
import java.security.Signature
import java.security.cert.X509Certificate
import javax.security.auth.x500.X500Principal

internal const val PACKAGE_LIMIT = 96 * 1024
private val fingerprint = Regex("[0-9a-f]{64}")
private val segment =
    Regex("(?!(?:con|prn|aux|nul|com[0-9]|lpt[0-9]|constructor|prototype)$)[a-z0-9][a-z0-9-]{0,63}")

internal data class Installation(
    val id: String,
    val project: String,
    val device: String,
    val origin: URL,
    val capabilities: List<String>,
    val keys: KeyPair,
    val client: X509Certificate,
    val ca: X509Certificate,
)

internal fun verifyInstallation(
    bytes: ByteArray,
    pin: String,
    id: String,
    keys: KeyPair,
    now: Long,
): Installation {
    val pkg = parseObject(bytes, PACKAGE_LIMIT)
    pkg.fields("version", "approval", "clientCertificate", "caCertificate")
    require(pkg.integer("version") == 1L && fingerprint.matches(pin))
    val a = pkg.getAsJsonObject("approval")
    a.fields(
        "operationId",
        "projectId",
        "deviceId",
        "hardwareId",
        "installationId",
        "capabilities",
        "expectedRevision",
        "publicKeyFingerprint",
        "caFingerprint",
        "httpsOrigin",
        "change",
    )
    val caDer = decodeDer(pkg.str("caCertificate"))
    require(caDer.fingerprint() == pin && a.str("caFingerprint") == pin)
    val ca = certificate(caDer)
    val client = certificate(decodeDer(pkg.str("clientCertificate")))
    checkCertificate(ca, ca, "ca", now)
    checkCertificate(client, ca, "client", now)
    require(keys.public.encoded.contentEquals(client.publicKey.encoded))
    val spki = keys.public.encoded.fingerprint()
    require(
        a.str("publicKeyFingerprint") == spki && a.str("installationId") == id && uuidV4.matches(id)
    )
    val operation = a.str("operationId").also { require(uuidV4.matches(it)) }
    val project = a.str("projectId").also { require(segment.matches(it)) }
    val device = a.str("deviceId").also { require(segment.matches(it)) }
    val hardware =
        a.str("hardwareId").also {
            require(
                it.trim { ch -> ch.isWhitespace() || ch == '\uFEFF' }.isNotEmpty() &&
                    it.length <= 256
            )
        }
    val caps = a.uniqueStrings("capabilities", 256).sorted()
    require(caps.all { it.matches(Regex("[a-z][a-z0-9.-]{0,95}")) })
    val origin = canonicalOrigin(a.str("httpsOrigin"))
    val change = a.getAsJsonObject("change")
    val kind = change.str("kind")
    when (kind) {
        "begin" -> change.fields("kind")
        "renew",
        "rebindHardware" -> change.fields("kind", "assignmentId")
        "reassign" -> change.fields("kind", "assignmentId", "expectedSourceRevision")
        else -> error("Unknown installation change")
    }
    val assignment =
        if (kind == "begin") JsonValue.Null
        else JsonValue.Str(change.str("assignmentId").also { require(uuidV4.matches(it)) })
    fun number(n: Long) = JsonValue.Num(n.toDouble(), true)
    val revision =
        if (kind == "reassign") number(change.integer("expectedSourceRevision")) else JsonValue.Null
    val values =
        listOf("gaia-install-v1", operation, project, device, hardware, id).map(JsonValue::Str) +
            listOf(
                JsonValue.Arr(caps.map(JsonValue::Str)),
                number(a.integer("expectedRevision")),
                JsonValue.Str(spki),
                JsonValue.Str(pin),
                JsonValue.Str(origin.toString()),
                JsonValue.Str(kind),
                assignment,
                revision,
            )
    val digest = JsonWriter.write(JsonValue.Arr(values)).toByteArray().fingerprint()
    require(client.subjectX500Principal.getName(X500Principal.RFC2253) == "CN=$digest")
    // Key metadata alone cannot prove the private half is present and usable.
    val challenge = ByteArray(32).also(SecureRandom()::nextBytes)
    val proof =
        Signature.getInstance("SHA256withECDSA").run {
            initSign(keys.private)
            update(challenge)
            sign()
        }
    require(
        Signature.getInstance("SHA256withECDSA").run {
            initVerify(client.publicKey)
            update(challenge)
            verify(proof)
        }
    )
    return Installation(id, project, device, origin, caps, keys, client, ca)
}
