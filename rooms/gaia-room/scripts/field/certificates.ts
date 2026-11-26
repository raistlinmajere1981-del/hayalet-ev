import {
  createHash,
  createPublicKey,
  randomBytes,
  verify,
  X509Certificate,
  type KeyObject,
} from "node:crypto";
import { isIP } from "node:net";
import * as asn from "asn1js";
import * as pki from "pkijs";
import ipaddr from "ipaddr.js";

const day = 86_400_000;
export const certificatePolicy = {
  caDays: 3650,
  leafDays: 365,
  renewLeafDays: 30,
  replaceCaDays: 365,
} as const;
const ecdsaSha256 = "1.2.840.10045.4.3.2";
const commonName = "2.5.4.3";
type Profile = { role: "ca" } | { role: "client" } | { role: "server"; origin: string };

export function sha256(input: Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function derBase64(input: unknown): Buffer {
  if (typeof input !== "string" || !input.length || input.length > 24_000)
    throw new Error("Invalid Gaia DER length");
  const der = Buffer.from(input, "base64");
  if (der.toString("base64") !== input) throw new Error("Invalid Gaia DER encoding");
  return der;
}

function schema(der: Buffer) {
  const parsed = asn.fromBER(der, { maxDepth: 24, maxNodes: 512 });
  if (parsed.offset !== der.length || !(parsed.result instanceof asn.Sequence))
    throw new Error("Invalid Gaia ASN.1 object");
  return parsed.result;
}

function requireP256(key: KeyObject) {
  if (
    key.type !== "public" ||
    key.asymmetricKeyType !== "ec" ||
    key.asymmetricKeyDetails?.namedCurve !== "prime256v1"
  )
    throw new Error("Gaia requires an EC P-256 public key");
}

export function publicKeyFingerprint(key: KeyObject): string {
  requireP256(key);
  return sha256(key.export({ format: "der", type: "spki" }));
}

export function verifyClientCsr(csrDer: unknown) {
  const der = derBase64(csrDer);
  const sequence = schema(der);
  const info = sequence.valueBlock.value[0];
  if (
    sequence.valueBlock.value.length !== 3 ||
    !(info instanceof asn.Sequence) ||
    info.valueBlock.value.length !== 4
  )
    throw new Error("Invalid Gaia PKCS#10 structure");
  const attributes = info.valueBlock.value[3];
  if (
    !(attributes instanceof asn.Constructed) ||
    attributes.idBlock.tagClass !== 3 ||
    attributes.idBlock.tagNumber !== 0 ||
    attributes.valueBlock.value.length !== 0
  )
    throw new Error("Gaia CSR attributes and extension requests are forbidden");
  const csr = new pki.CertificationRequest({ schema: sequence });
  if (
    csr.version !== 0 ||
    csr.signatureAlgorithm.algorithmId !== ecdsaSha256 ||
    csr.signatureAlgorithm.algorithmParams !== undefined ||
    csr.signatureValue.valueBlock.unusedBits ||
    !der.equals(Buffer.from(sequence.toBER()))
  )
    throw new Error("Invalid Gaia CSR profile");
  const spki = csr.subjectPublicKeyInfo;
  if (
    spki.algorithm.algorithmId !== "1.2.840.10045.2.1" ||
    !(spki.algorithm.algorithmParams instanceof asn.ObjectIdentifier) ||
    spki.algorithm.algorithmParams.valueBlock.toString() !== "1.2.840.10045.3.1.7" ||
    spki.subjectPublicKey.valueBlock.unusedBits !== 0 ||
    spki.subjectPublicKey.valueBlock.valueHexView.length !== 65 ||
    spki.subjectPublicKey.valueBlock.valueHexView[0] !== 4
  )
    throw new Error("Gaia requires a named P-256 uncompressed public key");
  const key = createPublicKey({
    format: "der",
    type: "spki",
    key: Buffer.from(csr.subjectPublicKeyInfo.toSchema().toBER()),
  });
  const fingerprint = publicKeyFingerprint(key);
  if (!verify("sha256", csr.tbsView, key, csr.signatureValue.valueBlock.valueHexView))
    throw new Error("Invalid Gaia CSR signature");
  return { key, fingerprint };
}

export function httpsHost(origin: unknown): string {
  if (typeof origin !== "string" || origin.length > 300)
    throw new Error("Invalid Gaia HTTPS origin");
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.origin !== origin || url.port === "0")
    throw new Error("Expected a canonical Gaia HTTPS origin");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    !isIP(host) &&
    (host.length > 253 ||
      !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
  )
    throw new Error("Invalid Gaia HTTPS host");
  return host;
}

function name(cn: string) {
  return new pki.RelativeDistinguishedNames({
    typesAndValues: [
      new pki.AttributeTypeAndValue({ type: commonName, value: new asn.Utf8String({ value: cn }) }),
    ],
  });
}

function extension(id: string, critical: boolean, value: asn.BaseBlock) {
  return new pki.Extension({ extnID: id, critical, extnValue: value.toBER() });
}

function keyId(info: pki.PublicKeyInfo) {
  return new asn.OctetString({
    valueHex: createHash("sha256")
      .update(info.subjectPublicKey.valueBlock.valueHexView)
      .digest()
      .subarray(0, 20),
  });
}

function extensions(profile: Profile, subject: pki.PublicKeyInfo, issuer: pki.PublicKeyInfo) {
  const ca = profile.role === "ca";
  const result = [
    extension(
      "2.5.29.19",
      true,
      new pki.BasicConstraints(ca ? { cA: true, pathLenConstraint: 0 } : {}).toSchema()
    ),
    extension(
      "2.5.29.15",
      true,
      new asn.BitString({ valueHex: Uint8Array.of(ca ? 0x04 : 0x80), unusedBits: ca ? 2 : 7 })
    ),
    extension("2.5.29.14", false, keyId(subject)),
  ];
  if (!ca) {
    result.push(
      extension(
        "2.5.29.35",
        false,
        new pki.AuthorityKeyIdentifier({ keyIdentifier: keyId(issuer) }).toSchema()
      )
    );
    result.push(
      extension(
        "2.5.29.37",
        false,
        new pki.ExtKeyUsage({
          keyPurposes: [profile.role === "client" ? "1.3.6.1.5.5.7.3.2" : "1.3.6.1.5.5.7.3.1"],
        }).toSchema()
      )
    );
  }
  if (profile.role === "server") {
    const host = httpsHost(profile.origin);
    const alt = isIP(host)
      ? new pki.GeneralName({
          type: 7,
          value: new asn.OctetString({
            valueHex: Uint8Array.from(ipaddr.parse(host).toByteArray()),
          }),
        })
      : new pki.GeneralName({ type: 2, value: host });
    result.push(extension("2.5.29.17", false, new pki.AltName({ altNames: [alt] }).toSchema()));
  }
  return result;
}

function certificateTime(ms: number) {
  const value = new Date(ms);
  return new pki.Time({ type: value.getUTCFullYear() >= 2050 ? 1 : 0, value });
}

export async function signFieldCertificate(
  profile: Profile,
  cn: string,
  key: KeyObject,
  signingKey: CryptoKey,
  issuer?: X509Certificate
): Promise<string> {
  requireP256(key);
  if ((profile.role === "ca") !== (issuer === undefined)) throw new Error("Invalid Gaia issuer");
  const start = Math.floor(Date.now() / 1000) * 1000;
  const days = issuer ? certificatePolicy.leafDays : certificatePolicy.caDays;
  const end = Math.min(start + days * day, issuer ? Date.parse(issuer.validTo) : Infinity);
  if (end <= start + certificatePolicy.renewLeafDays * day)
    throw new Error("Replace expiring Gaia CA before issuance");
  const parent = issuer ? new pki.Certificate({ schema: schema(issuer.raw) }) : undefined;
  const info = pki.PublicKeyInfo.fromBER(key.export({ format: "der", type: "spki" }));
  const subject = name(cn);
  const cert = new pki.Certificate({
    version: 2,
    serialNumber: asn.Integer.fromBigInt(BigInt("0x" + randomBytes(16).toString("hex")) || 1n),
    issuer: parent?.subject ?? subject,
    subject,
    subjectPublicKeyInfo: info,
    notBefore: certificateTime(start),
    notAfter: certificateTime(end),
    extensions: extensions(profile, info, parent?.subjectPublicKeyInfo ?? info),
  });
  await cert.sign(signingKey, "SHA-256");
  return Buffer.from(cert.toSchema().toBER()).toString("base64");
}

function checkProfile(der: Buffer, profile: Profile, now: number, issuer?: X509Certificate) {
  const cert = new X509Certificate(der);
  const root = issuer ?? cert;
  const parsed = new pki.Certificate({ schema: schema(der) });
  const parent = issuer ? new pki.Certificate({ schema: schema(issuer.raw) }) : parsed;
  requireP256(cert.publicKey);
  if (
    !cert.raw.equals(der) ||
    parsed.version !== 2 ||
    parsed.signature.algorithmId !== ecdsaSha256 ||
    parsed.signatureAlgorithm.algorithmId !== ecdsaSha256 ||
    parsed.signature.algorithmParams !== undefined ||
    parsed.signatureAlgorithm.algorithmParams !== undefined ||
    cert.ca !== (profile.role === "ca") ||
    !cert.checkIssued(root) ||
    !cert.verify(root.publicKey)
  )
    throw new Error("Invalid Gaia certificate chain or profile");
  const from = Date.parse(cert.validFrom),
    to = Date.parse(cert.validTo);
  if (
    !Number.isSafeInteger(now) ||
    !(from <= now && now <= to) ||
    to - from >
      (profile.role === "ca" ? certificatePolicy.caDays : certificatePolicy.leafDays) * day ||
    from < Date.parse(root.validFrom) ||
    to > Date.parse(root.validTo)
  )
    throw new Error("Gaia certificate is outside its validity period");
  const expected = extensions(profile, parsed.subjectPublicKeyInfo, parent.subjectPublicKeyInfo);
  if (
    parsed.extensions?.length !== expected.length ||
    !expected.every((ext) =>
      parsed.extensions?.some(
        (actual) =>
          actual.extnID === ext.extnID &&
          actual.critical === ext.critical &&
          Buffer.from(actual.extnValue.valueBlock.valueHexView).equals(
            ext.extnValue.valueBlock.valueHexView
          )
      )
    )
  )
    throw new Error("Invalid Gaia certificate usage, extensions or SAN");
  if (profile.role === "server") {
    const host = httpsHost(profile.origin);
    if (
      !(isIP(host)
        ? cert.checkIP(host)
        : cert.checkHost(host, { subject: "never", wildcards: false }))
    )
      throw new Error("Invalid Gaia server SAN");
  }
  return cert;
}

export function verifyFieldCa(caDer: string, expectedCaFingerprint: string, now = Date.now()) {
  const der = derBase64(caDer);
  if (sha256(der) !== expectedCaFingerprint) throw new Error("Wrong Gaia field CA");
  return checkProfile(der, { role: "ca" }, now);
}

// The caller supplies the separately trusted CA pin and the already authenticated TLS peer DER.
export function verifyFieldPeer(
  der: Buffer,
  profile: Exclude<Profile, { role: "ca" }>,
  caDer: string,
  caFingerprint: string,
  now = Date.now()
) {
  if (!der.length || der.length > 18_000) throw new Error("Invalid Gaia peer certificate length");
  return checkProfile(der, profile, now, verifyFieldCa(caDer, caFingerprint, now));
}
