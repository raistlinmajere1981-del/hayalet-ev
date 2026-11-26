import type { KeyObject } from "node:crypto";
import { capabilityId } from "../devices/capabilities.ts";
import { fields, record, segment, uuid } from "../storage/batch.ts";
import {
  derBase64,
  httpsHost,
  publicKeyFingerprint,
  sha256,
  verifyClientCsr,
  verifyFieldPeer,
} from "./certificates.ts";

type Change =
  | { kind: "begin" }
  | { kind: "renew" | "rebindHardware"; assignmentId: string }
  | { kind: "reassign"; assignmentId: string; expectedSourceRevision: number };

export interface InstallationApproval {
  operationId: string;
  projectId: string;
  deviceId: string;
  hardwareId: string;
  installationId: string;
  capabilities: string[];
  expectedRevision: number;
  publicKeyFingerprint: string;
  caFingerprint: string;
  httpsOrigin: string;
  change: Change;
}

export interface LocalInstallation {
  version: 1;
  approval: InstallationApproval;
  clientCertificate: string;
  caCertificate: string;
}

function revision(n: unknown) {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0)
    throw new Error("Invalid Gaia installation revision");
}

export function parseApproval(input: unknown): InstallationApproval {
  fields(input, [
    "operationId",
    "projectId",
    "deviceId",
    "installationId",
    "hardwareId",
    "capabilities",
    "expectedRevision",
    "publicKeyFingerprint",
    "caFingerprint",
    "httpsOrigin",
    "change",
  ]);
  uuid(input["operationId"]);
  uuid(input["installationId"]);
  segment(input["projectId"]);
  segment(input["deviceId"]);
  revision(input["expectedRevision"]);
  httpsHost(input["httpsOrigin"]);
  for (const hash of [input["publicKeyFingerprint"], input["caFingerprint"]])
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))
      throw new Error("Invalid Gaia installation fingerprint");
  const hw = input["hardwareId"],
    caps = input["capabilities"],
    change = input["change"];
  if (
    typeof hw !== "string" ||
    !hw.trim() ||
    hw.length > 256 ||
    !Array.isArray(caps) ||
    caps.length > 256 ||
    !caps.every(capabilityId) ||
    new Set(caps).size !== caps.length
  )
    throw new Error("Invalid Gaia hardware or capabilities");
  if (!record(change)) throw new Error("Invalid Gaia installation action");
  if (change["kind"] === "begin") fields(change, ["kind"]);
  else {
    if (
      change["kind"] !== "renew" &&
      change["kind"] !== "rebindHardware" &&
      change["kind"] !== "reassign"
    )
      throw new Error("Invalid Gaia installation action");
    fields(
      change,
      change["kind"] === "reassign"
        ? ["kind", "assignmentId", "expectedSourceRevision"]
        : ["kind", "assignmentId"]
    );
    uuid(change["assignmentId"]);
    if (change["kind"] === "reassign") revision(change["expectedSourceRevision"]);
  }
  return {
    ...input,
    capabilities: [...caps].sort(),
    change: { ...change },
  } as InstallationApproval;
}

export function approvalDigest(a: InstallationApproval): string {
  const change = a.change;
  return sha256(
    JSON.stringify([
      "gaia-install-v1",
      a.operationId,
      a.projectId,
      a.deviceId,
      a.hardwareId,
      a.installationId,
      a.capabilities,
      a.expectedRevision,
      a.publicKeyFingerprint,
      a.caFingerprint,
      a.httpsOrigin,
      change.kind,
      change.kind === "begin" ? null : change.assignmentId,
      change.kind === "reassign" ? change.expectedSourceRevision : null,
    ])
  );
}

export function inspectUsbRequest(input: unknown) {
  fields(input, ["version", "installationId", "csr"]);
  uuid(input["installationId"]);
  if (input["version"] !== 1) throw new Error("Unknown Gaia USB request version");
  return { installationId: input["installationId"], ...verifyClientCsr(input["csr"]) };
}

export function verifyInstallation(input: unknown, trustedCaFingerprint: string, now = Date.now()) {
  fields(input, ["version", "approval", "clientCertificate", "caCertificate"]);
  if (
    input["version"] !== 1 ||
    typeof input["clientCertificate"] !== "string" ||
    typeof input["caCertificate"] !== "string"
  )
    throw new Error("Invalid Gaia installation package");
  const approval = parseApproval(input["approval"]);
  if (approval.caFingerprint !== trustedCaFingerprint)
    throw new Error("Wrong Gaia installation CA");
  const cert = verifyFieldPeer(
    derBase64(input["clientCertificate"]),
    { role: "client" },
    input["caCertificate"],
    trustedCaFingerprint,
    now
  );
  if (
    cert.subject !== "CN=" + approvalDigest(approval) ||
    publicKeyFingerprint(cert.publicKey) !== approval.publicKeyFingerprint
  )
    throw new Error("Gaia certificate does not match the approved installation");
  return { approval, certificateFingerprint: sha256(cert.raw) };
}

// B6 supplies the public half of its own Keystore alias and a pin read from the center display.
export function verifyClientInstallation(
  input: unknown,
  local: { installationId: string; publicKey: KeyObject; trustedCaFingerprint: string },
  now = Date.now()
) {
  const verified = verifyInstallation(input, local.trustedCaFingerprint, now);
  if (
    verified.approval.installationId !== local.installationId ||
    verified.approval.publicKeyFingerprint !== publicKeyFingerprint(local.publicKey)
  )
    throw new Error("Gaia installation belongs to a different client or key");
  return verified;
}

export function approvedEnrollmentCommand(a: InstallationApproval, fingerprint: string) {
  const common = {
    operationId: a.operationId,
    hardwareId: a.hardwareId,
    installationId: a.installationId,
    capabilities: a.capabilities,
    fingerprint,
  };
  if (a.change.kind === "reassign")
    return {
      ...common,
      action: "reassign",
      assignmentId: a.change.assignmentId,
      expectedSourceRevision: a.change.expectedSourceRevision,
      targetProject: a.projectId,
      targetDeviceId: a.deviceId,
      expectedTargetRevision: a.expectedRevision,
    };
  if (a.change.kind === "rebindHardware")
    return {
      ...common,
      action: "rebindHardware",
      assignmentId: a.change.assignmentId,
      expectedRevision: a.expectedRevision,
    };
  return {
    ...common,
    action: "begin",
    project: a.projectId,
    deviceId: a.deviceId,
    expectedRevision: a.expectedRevision,
    ...(a.change.kind === "renew" ? { renews: a.change.assignmentId } : {}),
  };
}
