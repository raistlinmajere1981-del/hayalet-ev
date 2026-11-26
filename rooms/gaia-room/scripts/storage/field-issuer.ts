import {
  createPrivateKey,
  generateKeyPairSync,
  randomUUID,
  X509Certificate,
  type KeyObject,
} from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join, sep } from "node:path";
import {
  derBase64,
  httpsHost,
  publicKeyFingerprint,
  sha256,
  signFieldCertificate,
  verifyFieldCa,
  verifyFieldPeer,
} from "../field/certificates.ts";
import {
  approvalDigest,
  inspectUsbRequest,
  parseApproval,
  verifyInstallation,
  type InstallationApproval,
  type LocalInstallation,
} from "../field/installation.ts";
import { verifyActiveAssignment, type AuthorizationStore } from "../field/enrollment.ts";
import { issuedCertificate, readIssuances, writeIssuances } from "./issuance-store.ts";
import { privatePath, readAuthorizationStore, trustedFieldRoot } from "./enrollment-store.ts";
import { acquireDirectoryLock, hasCode, publish, serialized } from "./files.ts";
import { caMarker, privateBytes, readFieldTrust } from "./field-trust.ts";
import { projectDirectory, readDocument } from "./project-document.ts";

interface SigningMedia {
  directory: string;
  passphrase: Buffer;
}

async function signingDirectory(root: string, media: SigningMedia) {
  if (!process.getuid)
    throw new Error("Gaia private key provisioning requires verified POSIX permissions");
  await trustedFieldRoot(media.directory);
  if (
    root === media.directory ||
    root.startsWith(media.directory + sep) ||
    media.directory.startsWith(root + sep)
  )
    throw new Error("Gaia signing media must be separate from center storage");
  if (
    !Buffer.isBuffer(media.passphrase) ||
    media.passphrase.length < 16 ||
    media.passphrase.length > 1024
  )
    throw new Error("Invalid Gaia signing passphrase");
  return join(media.directory, "gaia-signing");
}

async function signingKey(key: KeyObject) {
  const der = key.export({ type: "pkcs8", format: "der" });
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } finally {
    der.fill(0);
  }
}

async function unlock(
  root: string,
  media: SigningMedia,
  trust: Awaited<ReturnType<typeof readFieldTrust>>
) {
  const dir = await signingDirectory(root, media);
  await privatePath(dir, true);
  const encrypted = await privateBytes(join(dir, "ca.key"), 16_384);
  if (!encrypted.toString("ascii").startsWith("-----BEGIN ENCRYPTED PRIVATE KEY-----\n"))
    throw new Error("Invalid encrypted Gaia CA signing key");
  const key = createPrivateKey({ key: encrypted, passphrase: media.passphrase });
  if (!trust.ca.checkPrivateKey(key))
    throw new Error("Gaia signing key does not match this center");
  return signingKey(key);
}

export async function provisionFieldCa(root: string, media: SigningMedia) {
  await trustedFieldRoot(root);
  const dir = await signingDirectory(root, media);
  const release = await acquireDirectoryLock(root, true);
  try {
    const store = await readAuthorizationStore(root);
    if (store.assignments.length || store.preparedBegins.length || store.revocations.length)
      throw new Error("Gaia CA bootstrap requires a new authorization history");
    await mkdir(caMarker(root), { mode: 0o700 });
    const online = join(root, "field", "pki");
    await mkdir(online, { mode: 0o700 });
    await mkdir(dir, { mode: 0o700 });
    const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const cert = await signFieldCertificate(
      { role: "ca" },
      "Gaia Field " + randomUUID(),
      keys.publicKey,
      await signingKey(keys.privateKey)
    );
    const der = derBase64(cert);
    const fingerprint = sha256(der);
    verifyFieldCa(cert, fingerprint);
    await publish(
      join(dir, "ca.key"),
      keys.privateKey.export({
        format: "pem",
        type: "pkcs8",
        cipher: "aes-256-cbc",
        passphrase: media.passphrase,
      })
    );
    await publish(join(online, "ca.der"), der);
    await writeIssuances(online, { version: 1, certificates: {}, discarded: [] });
    await publish(join(caMarker(root), "sha256"), fingerprint);
    return fingerprint;
  } finally {
    await release();
  }
}

export async function rotateFieldServer(root: string, media: SigningMedia, origin: string) {
  httpsHost(origin);
  const trust = await readFieldTrust(root);
  await readAuthorizationStore(root);
  const dir = join(root, "field", "pki");
  return serialized(dir, async () => {
    const path = join(dir, "server.pem");
    await privatePath(path, false).catch((error: unknown) => {
      if (!hasCode(error, "ENOENT")) throw error;
    });
    const signer = await unlock(root, media, trust);
    const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const profile = { role: "server" as const, origin };
    const der = derBase64(
      await signFieldCertificate(profile, "Gaia HTTPS", keys.publicKey, signer, trust.ca)
    );
    const cert = verifyFieldPeer(der, profile, trust.caCertificate, trust.fingerprint);
    await publish(
      path,
      cert.toString() + "\n" + keys.privateKey.export({ format: "pem", type: "pkcs8" })
    );
    return sha256(der);
  });
}

async function checkInventory(
  root: string,
  a: InstallationApproval,
  store: AuthorizationStore,
  certificates: Record<string, string>
) {
  const change = a.change;
  const parent =
    change.kind === "begin"
      ? undefined
      : store.assignments.find((row) => row.id === change.assignmentId);
  if (change.kind !== "begin" && (!parent || parent.state !== "active"))
    throw new Error("Gaia installation predecessor is not active");
  if (
    parent &&
    change.kind !== "reassign" &&
    (parent.projectId !== a.projectId || parent.deviceId !== a.deviceId)
  )
    throw new Error("Wrong Gaia installation target");
  if (parent && change.kind === "renew") {
    const der = derBase64(certificates[parent.beginOperationId]);
    if (sha256(der) !== parent.fingerprint)
      throw new Error("Missing Gaia renewal predecessor certificate");
    if (publicKeyFingerprint(new X509Certificate(der).publicKey) === a.publicKeyFingerprint)
      throw new Error("Gaia renewal requires a new client key");
  }
  if (parent && change.kind === "reassign") {
    if (parent.projectId === a.projectId) throw new Error("Invalid Gaia reassignment target");
    const dir = await projectDirectory(root, parent.projectId);
    await serialized(dir, async () => {
      const doc = await readDocument(join(dir, "world.json"), parent.projectId);
      if (doc.world.revision !== change.expectedSourceRevision)
        throw new Error("Gaia installation source revision conflict");
      verifyActiveAssignment(doc.world, doc.statusEpoch ?? 0, parent);
    });
  }
  const dir = await projectDirectory(root, a.projectId);
  await serialized(dir, async () => {
    const doc = await readDocument(join(dir, "world.json"), a.projectId);
    const device = doc.world.devices[a.deviceId];
    if (
      doc.world.revision !== a.expectedRevision ||
      device?.source !== "physical" ||
      !a.capabilities.every((c) => device.capabilities.includes(c))
    )
      throw new Error("Gaia installation inventory or revision conflict");
    if (parent && change.kind !== "reassign")
      verifyActiveAssignment(doc.world, doc.statusEpoch ?? 0, parent);
    if (
      change.kind === "rebindHardware"
        ? device.hardwareId === a.hardwareId
        : device.hardwareId !== undefined && device.hardwareId !== a.hardwareId
    )
      throw new Error("Gaia installation hardware conflict");
    if (change.kind === "renew" && a.installationId !== parent?.installationId)
      throw new Error("Gaia installation renewal conflict");
  });
}

export async function issueLocalInstallation(
  root: string,
  media: SigningMedia,
  usb: unknown,
  input: unknown
): Promise<LocalInstallation> {
  const approval = parseApproval(structuredClone(input));
  const csr = inspectUsbRequest(usb);
  const trust = await readFieldTrust(root);
  if (
    approval.installationId !== csr.installationId ||
    approval.publicKeyFingerprint !== csr.fingerprint ||
    approval.caFingerprint !== trust.fingerprint
  )
    throw new Error("Gaia USB request does not match local approval");
  const dir = join(root, "field", "pki");
  return serialized(dir, async () => {
    const store = await readAuthorizationStore(root);
    const journal = await readIssuances(dir);
    const prior = issuedCertificate(journal, approval.operationId);
    const makePackage = (clientCertificate: string): LocalInstallation => ({
      version: 1,
      approval,
      caCertificate: trust.caCertificate,
      clientCertificate,
    });
    if (typeof prior === "string") {
      const pkg = makePackage(prior);
      const verified = verifyInstallation(pkg, trust.fingerprint);
      if (
        store.assignments.some(
          (a) =>
            (a.fingerprint === verified.certificateFingerprint && a.state === "revoked") ||
            (a.carryCancelled && a.carryTarget?.fingerprint === verified.certificateFingerprint)
        )
      )
        throw new Error("Gaia installation certificate was revoked");
      return pkg;
    }
    if (
      store.assignments.some((a) =>
        [a.beginOperationId, a.carryOperationId, a.completeOperationId].includes(
          approval.operationId
        )
      ) ||
      [...store.revocations, ...store.preparedBegins].some(
        (r) => r.operationId === approval.operationId
      )
    )
      throw new Error("Gaia installation operation already used");
    await checkInventory(root, approval, store, journal.certificates);
    const key = await unlock(root, media, trust);
    const cert = await signFieldCertificate(
      { role: "client" },
      approvalDigest(approval),
      csr.key,
      key,
      trust.ca
    );
    const pkg = makePackage(cert);
    verifyInstallation(pkg, trust.fingerprint);
    journal.certificates[approval.operationId] = cert;
    await writeIssuances(dir, journal);
    return pkg;
  });
}
