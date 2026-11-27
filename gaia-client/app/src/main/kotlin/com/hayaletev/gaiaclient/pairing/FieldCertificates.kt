package com.hayaletev.gaiaclient.pairing

import java.net.URL
import java.security.KeyPair
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.Base64
import java.util.Date
import org.bouncycastle.asn1.*
import org.bouncycastle.asn1.pkcs.CertificationRequest
import org.bouncycastle.asn1.pkcs.CertificationRequestInfo
import org.bouncycastle.asn1.x500.X500Name
import org.bouncycastle.asn1.x509.*

internal fun ByteArray.sha256(): ByteArray = MessageDigest.getInstance("SHA-256").digest(this)

internal fun ByteArray.fingerprint(): String = sha256().joinToString("") { "%02x".format(it) }

internal fun ByteArray.base64(): String = Base64.getEncoder().encodeToString(this)

internal fun decodeDer(s: String): ByteArray {
    require(s.length in 1..24000)
    return Base64.getDecoder().decode(s).also { require(it.base64() == s) }
}

private val signatureAlgorithm = AlgorithmIdentifier(ASN1ObjectIdentifier("1.2.840.10045.4.3.2"))

internal fun usbRequest(id: String, keys: KeyPair): ByteArray {
    require(com.hayaletev.gaiaclient.protocol.uuidV4.matches(id))
    val info = CertificationRequestInfo(X500Name("CN=Gaia Client"), spki(keys.public), DERSet())
    val signature =
        Signature.getInstance("SHA256withECDSA").run {
            initSign(keys.private)
            update(info.getEncoded("DER"))
            sign()
        }
    val csr = CertificationRequest(info, signatureAlgorithm, DERBitString(signature))
    return """{"version":1,"installationId":"$id","csr":"${csr.getEncoded("DER").base64()}"}"""
        .toByteArray()
}

private fun spki(key: PublicKey): SubjectPublicKeyInfo =
    SubjectPublicKeyInfo.getInstance(key.encoded).also {
        require(it.algorithm.algorithm.id == "1.2.840.10045.2.1")
        require(it.algorithm.parameters == ASN1ObjectIdentifier("1.2.840.10045.3.1.7"))
        require(it.publicKeyData.octets.size == 65 && it.publicKeyData.octets.first() == 4.toByte())
    }

internal fun canonicalOrigin(s: String): URL {
    val u = URL(s)
    val host = u.host
    require(s.length <= 300 && u.protocol == "https")
    require(u.port == -1 || u.port in 1..65535 && u.port != 443)
    require(s == "https://" + host + (if (u.port == -1) "" else ":" + u.port))
    if (host.startsWith("[")) {
        require('%' !in host)
        val ip = ASN1OctetString.getInstance(GeneralName(7, host.drop(1).dropLast(1)).name).octets
        require(ip.size == 16)
        val groups =
            ip.asList().chunked(2).map {
                ((it[0].toInt() and 255) shl 8) or (it[1].toInt() and 255)
            }
        val words = groups.map { it.toString(16) }
        val run =
            Regex("(?:^|(?<=:))0(?::0)+(?=:|$)").findAll(words.joinToString(":")).maxByOrNull {
                it.value.length
            }
        val canonical =
            words.joinToString(":").let { full ->
                if (run == null) full
                else
                    full.substring(0, run.range.first).trimEnd(':') +
                        "::" +
                        full.substring(run.range.last + 1).trimStart(':')
            }
        require(host == "[$canonical]")
    } else {
        val labels = host.split('.')
        require(
            host.length <= 253 &&
                labels.all { it.matches(Regex("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")) }
        )
        if (labels.last().matches(Regex("[0-9]+|0x[0-9a-f]*"))) {
            require(
                labels.size == 4 &&
                    labels.all { it.toIntOrNull() in 0..255 && it.toInt().toString() == it }
            )
        }
    }
    return u
}

// Bound recursion and node allocation before handing untrusted USB or TLS input to ASN.1.
private fun checkDerBounds(der: ByteArray) {
    var nodes = 0
    fun walk(start: Int, end: Int, depth: Int) {
        require(depth <= 24)
        var at = start
        while (at < end) {
            require(++nodes <= 512 && end - at >= 2)
            val tag = der[at++].toInt() and 255
            require(tag and 31 != 31)
            val first = der[at++].toInt() and 255
            var size = first
            if (first >= 128) {
                val count = first - 128
                require(count in 1..2 && end - at >= count && der[at] != 0.toByte())
                size = 0
                repeat(count) { size = (size shl 8) or (der[at++].toInt() and 255) }
                require(size >= 128)
            }
            require(size <= end - at)
            if (tag and 32 != 0) walk(at, at + size, depth + 1)
            at += size
        }
    }
    walk(0, der.size, 1)
}

internal fun certificate(der: ByteArray): X509Certificate {
    require(der.size in 1..18000)
    checkDerBounds(der)
    val parsed =
        org.bouncycastle.asn1.x509.Certificate.getInstance(ASN1Primitive.fromByteArray(der))
    require(der.contentEquals(parsed.getEncoded("DER")))
    require(
        parsed.signatureAlgorithm == signatureAlgorithm &&
            parsed.tbsCertificate.signature == signatureAlgorithm
    )
    val x509 =
        CertificateFactory.getInstance("X.509").generateCertificate(der.inputStream())
            as X509Certificate
    require(der.contentEquals(x509.encoded))
    return x509
}

internal fun checkCertificate(
    cert: X509Certificate,
    ca: X509Certificate,
    role: String,
    now: Long,
    host: String? = null,
) {
    val isCa = role == "ca"
    val key = spki(cert.publicKey)
    cert.checkValidity(Date(now))
    require(cert.version == 3 && cert.issuerX500Principal == ca.subjectX500Principal)
    require(cert.notBefore >= ca.notBefore && cert.notAfter <= ca.notAfter)
    require(cert.notAfter.time - cert.notBefore.time <= (if (isCa) 3650L else 365L) * 86400000)
    cert.verify(ca.publicKey)
    val kid = key.publicKeyData.octets.sha256().copyOf(20)
    val expected =
        mutableMapOf<ASN1ObjectIdentifier, ASN1Encodable>(
            Extension.basicConstraints to
                (if (isCa) BasicConstraints(0) else BasicConstraints(false)),
            Extension.keyUsage to
                KeyUsage(if (isCa) KeyUsage.keyCertSign else KeyUsage.digitalSignature),
            Extension.subjectKeyIdentifier to SubjectKeyIdentifier(kid),
        )
    if (!isCa) {
        expected[Extension.authorityKeyIdentifier] =
            AuthorityKeyIdentifier(spki(ca.publicKey).publicKeyData.octets.sha256().copyOf(20))
        expected[Extension.extendedKeyUsage] =
            ExtendedKeyUsage(
                if (role == "client") KeyPurposeId.id_kp_clientAuth
                else KeyPurposeId.id_kp_serverAuth
            )
    }
    if (role == "server") {
        val name = requireNotNull(host).removeSurrounding("[", "]")
        val ip = ':' in name || name.matches(Regex("[0-9.]+"))
        expected[Extension.subjectAlternativeName] =
            GeneralNames(GeneralName(if (ip) 7 else 2, name))
    }
    val ext =
        org.bouncycastle.asn1.x509.Certificate.getInstance(cert.encoded).tbsCertificate.extensions
    require(ext.extensionOIDs.toSet() == expected.keys)
    for ((oid, value) in expected) {
        val actual = ext.getExtension(oid)
        require(
            actual.isCritical == (oid == Extension.basicConstraints || oid == Extension.keyUsage)
        )
        require(actual.extnValue.octets.contentEquals(value.toASN1Primitive().getEncoded("DER")))
    }
}
