import { createPrivateKey, X509Certificate } from "node:crypto";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { sha256, verifyFieldCa, verifyFieldPeer } from "../field/certificates.ts";
import { privatePath, readAuthorizationStore, trustedFieldRoot } from "./enrollment-store.ts";
import { hasCode, readRegular } from "./files.ts";

export function caMarker(root: string) {
  return join(root, ".field-provisioned", "x509");
}

export async function usesFieldCa(root: string) {
  const present = await Promise.all(
    [caMarker(root), join(root, "field", "pki")].map(async (path) => {
      try {
        await lstat(path);
        return true;
      } catch (error) {
        if (hasCode(error, "ENOENT")) return false;
        throw error;
      }
    })
  );
  return present.some(Boolean);
}

export async function privateBytes(path: string, limit: number) {
  await privatePath(path, false);
  return readRegular(path, limit);
}

export async function readFieldTrust(root: string) {
  if (!process.getuid) throw new Error("Gaia field trust requires verified POSIX permissions");
  await trustedFieldRoot(root);
  await privatePath(join(root, ".field-provisioned"), true);
  await privatePath(caMarker(root), true);
  await privatePath(join(root, "field"), true);
  await privatePath(join(root, "field", "pki"), true);
  const fingerprint = (await privateBytes(join(caMarker(root), "sha256"), 64)).toString();
  const caCertificate = (await privateBytes(join(root, "field", "pki", "ca.der"), 18_000)).toString(
    "base64"
  );
  const ca = verifyFieldCa(caCertificate, fingerprint);
  return { caCertificate, fingerprint, ca };
}

export async function readFieldServerIdentity(root: string, origin: string) {
  await readAuthorizationStore(root);
  const trust = await readFieldTrust(root);
  const pem = (await privateBytes(join(root, "field", "pki", "server.pem"), 24_000)).toString();
  const split = pem.indexOf("-----BEGIN PRIVATE KEY-----");
  if (split < 1) throw new Error("Invalid Gaia server identity");
  const cert = pem.slice(0, split),
    key = pem.slice(split);
  const peer = verifyFieldPeer(
    new X509Certificate(cert).raw,
    { role: "server", origin },
    trust.caCertificate,
    trust.fingerprint
  );
  if (!peer.checkPrivateKey(createPrivateKey(key))) throw new Error("Wrong Gaia server key");
  return { cert, key, ca: trust.ca.toString(), fingerprint: sha256(peer.raw) };
}
