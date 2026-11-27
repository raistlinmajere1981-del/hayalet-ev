import { createHash, randomUUID } from "node:crypto";
import { capabilityId } from "../devices/capabilities.ts";
import type { Device, World } from "../spatial/world.ts";

export type AuthorizationState = "pending" | "active" | "revoked";

// One row is one generation of a local physical-device authorization. Revoked rows stay
// forever so a later world or sidecar change cannot make an old fingerprint current again.
export interface AuthorizationAssignment {
  id: string;
  lineageId: string;
  predecessorId?: string;
  successorId?: string;
  projectId: string;
  deviceId: string;
  hardwareId: string;
  installationId: string;
  fingerprint: string;
  authorizationGeneration: number;
  statusEpoch: number;
  capabilities: string[];
  state: AuthorizationState;
  createdAt: number;
  updatedAt: number;
  revokedAt?: number;
  beginOperationId: string;
  beginDigest: string;
  beginApproval?: { capabilities: string[]; expectedRevision?: number };
  completeOperationId?: string;
  completeDigest?: string;
  carryOperationId?: string;
  carryDigest?: string;
  carryTarget?: TransferTarget & { observedRevision: number; authorizationGeneration: number };
  carryCancelled?: true;
}
type TransferTarget = Pick<
  AuthorizationAssignment,
  "projectId" | "deviceId" | "installationId" | "hardwareId" | "fingerprint" | "capabilities"
>;

export interface AuthorizationStore {
  schemaVersion: 2;
  assignments: AuthorizationAssignment[];
  preparedBegins: { operationId: string; digest: string }[];
  revocations: { operationId: string; assignmentId: string; resultId: string }[];
}

export interface BeginAuthorizationInput {
  projectId: string;
  operationId: string;
  deviceId: string;
  hardwareId: string;
  installationId: string;
  fingerprint: string;
  capabilities: readonly string[];
  renews?: string;
  expectedRevision?: number;
  now: number;
}

export interface CompleteAuthorizationInput {
  assignmentId: string;
  operationId: string;
  now: number;
}

export interface RevokeAuthorizationInput {
  assignmentId: string;
  operationId: string;
  now: number;
}

export interface ActivateAuthorizationInput {
  projectId: string;
  operationId: string;
  deviceId: string;
  hardwareId: string;
  installationId: string;
  fingerprint: string;
  capabilities: readonly string[];
  lineageId: string;
  authorizationGeneration: number;
  predecessorId: string;
  operationDigest: string;
  now: number;
}

export interface VerifyAuthorizationExpectation {
  authorizationGeneration?: number;
  statusEpoch?: number;
}

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const identifierPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const reservedIdentifiers = /^(con|prn|aux|nul|com[0-9]|lpt[0-9]|constructor|prototype)$/;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function only(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  if (
    !required.every((key) => Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  )
    throw new Error("Invalid Gaia authorization record");
}

function identifier(value: unknown): value is string {
  return (
    typeof value === "string" && identifierPattern.test(value) && !reservedIdentifiers.test(value)
  );
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function fingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function hardware(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256;
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function capabilityList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => capabilityId(entry)) &&
    new Set(value).size === value.length
  );
}

function sortedCapabilities(value: readonly string[]): string[] {
  return [...new Set(value)].sort();
}

function digest(action: string, value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify([action, value]))
    .digest("hex");
}

function beginDigestOf(input: BeginAuthorizationInput): string {
  return digest("begin", [
    input.projectId,
    input.deviceId,
    input.hardwareId,
    input.installationId,
    input.fingerprint,
    sortedCapabilities(input.capabilities),
    input.renews ?? null,
    input.expectedRevision ?? null,
  ]);
}

function completeDigestOf(assignmentId: string): string {
  return digest("complete", [assignmentId]);
}

function findAssignment(store: AuthorizationStore, id: string): AuthorizationAssignment {
  const assignment = store.assignments.find((entry) => entry.id === id);
  if (!assignment) throw new Error("Unknown Gaia authorization assignment");
  return assignment;
}

function assertOperationUnused(
  store: AuthorizationStore,
  operationId: string,
  carrying?: string
): void {
  if (
    store.revocations.some((entry) => entry.operationId === operationId) ||
    store.preparedBegins.some((entry) => entry.operationId === operationId)
  )
    throw new Error("Gaia authorization operation ID was reused");
  for (const assignment of store.assignments) {
    if (
      assignment.beginOperationId === operationId ||
      assignment.completeOperationId === operationId ||
      (assignment.carryOperationId === operationId && assignment.id !== carrying)
    )
      throw new Error("Gaia authorization operation ID was reused");
  }
}

function assertWorldDevice(
  world: World,
  projectId: string,
  deviceId: string,
  hardwareId: string,
  capabilities: readonly string[]
): Device {
  if (world.id !== projectId) throw new Error("Gaia authorization project mismatch");
  const device = Object.hasOwn(world.devices, deviceId) ? world.devices[deviceId] : undefined;
  if (!device) throw new Error("Gaia authorization device mismatch");
  if (device.source !== "physical")
    throw new Error("Gaia authorization requires a physical device");
  if (!device.hardwareId || device.hardwareId !== hardwareId)
    throw new Error("Gaia authorization hardware mismatch");
  if (!capabilities.every((id) => device.capabilities.includes(id)))
    throw new Error("Gaia authorization capability is outside the device inventory");
  return device;
}

function validateAssignment(value: unknown): AuthorizationAssignment {
  if (!record(value)) throw new Error("Invalid Gaia authorization record");
  only(
    value,
    [
      "id",
      "lineageId",
      "projectId",
      "deviceId",
      "hardwareId",
      "installationId",
      "fingerprint",
      "authorizationGeneration",
      "statusEpoch",
      "capabilities",
      "state",
      "createdAt",
      "updatedAt",
      "beginOperationId",
      "beginDigest",
    ],
    [
      "revokedAt",
      "completeOperationId",
      "completeDigest",
      "predecessorId",
      "successorId",
      "beginApproval",
      "carryOperationId",
      "carryDigest",
      "carryTarget",
      "carryCancelled",
    ]
  );
  const state = value["state"];
  if (state !== "pending" && state !== "active" && state !== "revoked")
    throw new Error("Invalid Gaia authorization record");
  const capabilities = value["capabilities"];
  if (
    !uuid(value["id"]) ||
    !uuid(value["lineageId"]) ||
    !identifier(value["projectId"]) ||
    !identifier(value["deviceId"]) ||
    !hardware(value["hardwareId"]) ||
    !uuid(value["installationId"]) ||
    !fingerprint(value["fingerprint"]) ||
    !Number.isSafeInteger(value["authorizationGeneration"]) ||
    (value["authorizationGeneration"] as number) < 1 ||
    !nonNegative(value["statusEpoch"]) ||
    !capabilityList(capabilities) ||
    !capabilities.every((entry, index) => index === 0 || capabilities[index - 1]! < entry) ||
    !positive(value["createdAt"]) ||
    !positive(value["updatedAt"]) ||
    (value["updatedAt"] as number) < (value["createdAt"] as number) ||
    !uuid(value["beginOperationId"]) ||
    !fingerprint(value["beginDigest"])
  )
    throw new Error("Invalid Gaia authorization record");

  const completeOperationId = value["completeOperationId"];
  const approval = value["beginApproval"];
  if (approval !== undefined) {
    if (!record(approval)) throw new Error("Invalid Gaia begin approval");
    only(approval, ["capabilities"], ["expectedRevision"]);
    if (
      !capabilityList(approval["capabilities"]) ||
      (approval["expectedRevision"] !== undefined && !nonNegative(approval["expectedRevision"]))
    )
      throw new Error("Invalid Gaia begin approval");
  }
  const completeDigest = value["completeDigest"];
  if ((completeOperationId === undefined) !== (completeDigest === undefined))
    throw new Error("Invalid Gaia authorization record");
  if (
    completeOperationId !== undefined &&
    (!uuid(completeOperationId) || !fingerprint(completeDigest))
  )
    throw new Error("Invalid Gaia authorization record");
  if (state === "pending" && completeOperationId !== undefined)
    throw new Error("Invalid Gaia authorization record");

  if (value["predecessorId"] !== undefined && !uuid(value["predecessorId"]))
    throw new Error("Invalid Gaia authorization record");
  if (value["successorId"] !== undefined && (!uuid(value["successorId"]) || state !== "revoked"))
    throw new Error("Invalid Gaia authorization successor");
  if (completeDigest !== undefined && completeDigest !== completeDigestOf(value["id"] as string))
    throw new Error("Invalid Gaia authorization record");

  const revokedAt = value["revokedAt"];
  if (state === "revoked") {
    if (!positive(revokedAt) || revokedAt < (value["createdAt"] as number))
      throw new Error("Invalid Gaia authorization record");
  } else if (revokedAt !== undefined) {
    throw new Error("Invalid Gaia authorization record");
  }

  const carryOperationId = value["carryOperationId"];
  const target = value["carryTarget"];
  if ((carryOperationId === undefined) !== (target === undefined))
    throw new Error("Invalid Gaia authorization record");
  if (target !== undefined) {
    if (!record(target)) throw new Error("Invalid Gaia transfer target");
    only(target, [
      "observedRevision",
      "authorizationGeneration",
      "projectId",
      "deviceId",
      "installationId",
      "hardwareId",
      "fingerprint",
      "capabilities",
    ]);
    if (
      !nonNegative(target["observedRevision"]) ||
      !positive(target["authorizationGeneration"]) ||
      !identifier(target["projectId"]) ||
      !identifier(target["deviceId"]) ||
      !uuid(target["installationId"]) ||
      !hardware(target["hardwareId"]) ||
      !fingerprint(target["fingerprint"]) ||
      !capabilityList(target["capabilities"])
    )
      throw new Error("Invalid Gaia transfer target");
  }
  if (
    (carryOperationId === undefined) !== (value["carryDigest"] === undefined) ||
    (carryOperationId !== undefined &&
      (!uuid(carryOperationId) || !fingerprint(value["carryDigest"]) || state !== "revoked")) ||
    (value["carryCancelled"] !== undefined &&
      (value["carryCancelled"] !== true || !carryOperationId))
  )
    throw new Error("Invalid Gaia authorization record");

  return value as unknown as AuthorizationAssignment;
}

function overlaps(a: TransferTarget, b: TransferTarget) {
  return (
    a.installationId === b.installationId ||
    a.hardwareId === b.hardwareId ||
    (a.projectId === b.projectId && a.deviceId === b.deviceId)
  );
}

function sameTarget(a: TransferTarget, b: TransferTarget) {
  return (
    a.projectId === b.projectId &&
    a.deviceId === b.deviceId &&
    a.hardwareId === b.hardwareId &&
    a.installationId === b.installationId &&
    a.fingerprint === b.fingerprint &&
    JSON.stringify(sortedCapabilities(a.capabilities)) ===
      JSON.stringify(sortedCapabilities(b.capabilities))
  );
}

function assertAvailableToTransfer(
  store: AuthorizationStore,
  target: TransferTarget,
  operationId: string
) {
  for (const a of store.assignments) {
    const reserved = a.carryTarget;
    if (!reserved || a.carryOperationId === operationId) continue;
    if (reserved.fingerprint === target.fingerprint)
      throw new Error(
        a.carryCancelled
          ? "Gaia transfer certificate was revoked"
          : "Gaia transfer certificate is already reserved"
      );
    if (!a.carryCancelled && overlaps(reserved, target) && !a.successorId)
      throw new Error("Gaia binding is reserved for a transfer");
  }
}

function assertStoreInvariants(store: AuthorizationStore): void {
  const byId = new Map(store.assignments.map((a) => [a.id, a]));
  if (byId.size !== store.assignments.length) throw new Error("Invalid Gaia authorization store");
  const byBegin = new Map(store.assignments.map((a) => [a.beginOperationId, a]));
  const byFingerprint = new Map(store.assignments.map((a) => [a.fingerprint, a]));
  if (byFingerprint.size !== byId.size) throw new Error("Invalid Gaia authorization store");
  const operations = new Set<string>();
  const lineageGenerations = new Set<string>();
  const carries = new Set<string>();
  for (const assignment of store.assignments) {
    for (const operation of [assignment.beginOperationId, assignment.completeOperationId]) {
      if (operation === undefined) continue;
      if (operations.has(operation)) throw new Error("Invalid Gaia authorization store");
      operations.add(operation);
    }
    const lineageGeneration = `${assignment.lineageId}\0${assignment.authorizationGeneration}`;
    if (lineageGenerations.has(lineageGeneration))
      throw new Error("Invalid Gaia authorization store");
    lineageGenerations.add(lineageGeneration);
    if (assignment.carryOperationId !== undefined) {
      if (carries.has(assignment.carryOperationId))
        throw new Error("Invalid Gaia authorization store");
      carries.add(assignment.carryOperationId);
    }
  }

  const reservedFingerprints = new Set<string>();
  for (const a of store.assignments) {
    if (a.carryTarget) {
      const fp = a.carryTarget.fingerprint;
      if (
        reservedFingerprints.has(fp) ||
        (byFingerprint.has(fp) && byFingerprint.get(fp)?.beginOperationId !== a.carryOperationId)
      )
        throw new Error("Invalid Gaia transfer reservation");
      reservedFingerprints.add(fp);
    }
    const parent = a.predecessorId === undefined ? undefined : byId.get(a.predecessorId);
    if (
      a.authorizationGeneration === 1
        ? a.predecessorId !== undefined
        : !parent ||
          parent.lineageId !== a.lineageId ||
          parent.authorizationGeneration >= a.authorizationGeneration ||
          !lineageGenerations.has(`${a.lineageId}\0${a.authorizationGeneration - 1}`)
    )
      throw new Error("Invalid Gaia authorization store");
    const transferred = parent !== undefined && parent.carryOperationId === a.beginOperationId;
    if (
      transferred
        ? a.beginApproval !== undefined
        : !a.beginApproval ||
          !a.capabilities.every((cap) => a.beginApproval!.capabilities.includes(cap)) ||
          a.beginDigest !==
            beginDigestOf({
              ...a,
              ...a.beginApproval,
              operationId: a.beginOperationId,
              now: a.createdAt,
              ...(a.predecessorId ? { renews: a.predecessorId } : {}),
            })
    )
      throw new Error("Invalid Gaia begin approval");
    if (
      transferred &&
      (parent.carryDigest !== a.beginDigest ||
        parent.carryCancelled ||
        a.state === "pending" ||
        a.completeOperationId)
    )
      throw new Error("Invalid Gaia authorization store");
    if (
      transferred &&
      (!parent.carryTarget ||
        parent.carryTarget.authorizationGeneration !== a.authorizationGeneration ||
        parent.carryTarget.fingerprint !== a.fingerprint ||
        parent.carryTarget.installationId !== a.installationId ||
        parent.carryTarget.hardwareId !== a.hardwareId ||
        parent.carryTarget.projectId !== a.projectId ||
        parent.carryTarget.deviceId !== a.deviceId ||
        !a.capabilities.every((cap) => parent.carryTarget!.capabilities.includes(cap)))
    )
      throw new Error("Invalid Gaia authorization store");
    if (
      parent &&
      !transferred &&
      (parent.projectId !== a.projectId ||
        parent.deviceId !== a.deviceId ||
        parent.installationId !== a.installationId ||
        parent.hardwareId !== a.hardwareId)
    )
      throw new Error("Invalid Gaia authorization store");
    const committed = transferred || a.completeOperationId !== undefined;
    if (a.successorId && byId.get(a.successorId)?.predecessorId !== a.id)
      throw new Error("Invalid Gaia authorization successor");
    if ((a.state === "active" || a.carryOperationId) && !committed)
      throw new Error("Invalid Gaia authorization store");
    if (
      parent &&
      ((!parent.completeOperationId &&
        byId.get(parent.predecessorId ?? "")?.carryOperationId !== parent.beginOperationId) ||
        (a.state === "pending" && parent.state !== "active") ||
        committed !== (parent.successorId === a.id) ||
        (committed && parent.state !== "revoked"))
    )
      throw new Error("Invalid Gaia authorization store");
    if (
      a.carryOperationId &&
      operations.has(a.carryOperationId) &&
      byBegin.get(a.carryOperationId)?.predecessorId !== a.id
    )
      throw new Error("Invalid Gaia authorization store");
  }
  for (const receipt of store.revocations) {
    if (!record(receipt)) throw new Error("Invalid Gaia authorization store");
    only(receipt, ["operationId", "assignmentId", "resultId"]);
    const target = byId.get(receipt.assignmentId),
      result = byId.get(receipt.resultId);
    if (
      !uuid(receipt.operationId) ||
      operations.has(receipt.operationId) ||
      carries.has(receipt.operationId) ||
      !target ||
      !result ||
      result.state !== "revoked" ||
      result.successorId ||
      (result.carryOperationId && !result.carryCancelled) ||
      target.lineageId !== result.lineageId ||
      result.authorizationGeneration < target.authorizationGeneration
    )
      throw new Error("Invalid Gaia authorization store");
    let ancestor = result;
    while (ancestor.id !== target.id && ancestor.predecessorId)
      ancestor = byId.get(ancestor.predecessorId)!;
    if (ancestor.id !== target.id) throw new Error("Invalid Gaia revocation receipt");
    operations.add(receipt.operationId);
  }
  for (const receipt of store.preparedBegins) {
    if (!record(receipt)) throw new Error("Invalid Gaia authorization store");
    only(receipt, ["operationId", "digest"]);
    if (
      !uuid(receipt.operationId) ||
      !fingerprint(receipt.digest) ||
      operations.has(receipt.operationId) ||
      carries.has(receipt.operationId)
    )
      throw new Error("Invalid Gaia authorization store");
    operations.add(receipt.operationId);
  }

  const active = store.assignments.filter((assignment) => assignment.state === "active");
  const activeLineages = new Set<string>();
  const activeFingerprints = new Set<string>();
  const activeInstallations = new Set<string>();
  const activeHardware = new Set<string>();
  const activeDevices = new Set<string>();
  for (const assignment of active) {
    const deviceKey = `${assignment.projectId}\0${assignment.deviceId}`;
    if (
      activeLineages.has(assignment.lineageId) ||
      activeFingerprints.has(assignment.fingerprint) ||
      activeInstallations.has(assignment.installationId) ||
      activeHardware.has(assignment.hardwareId) ||
      activeDevices.has(deviceKey)
    )
      throw new Error("Invalid Gaia authorization store");
    activeLineages.add(assignment.lineageId);
    activeFingerprints.add(assignment.fingerprint);
    activeInstallations.add(assignment.installationId);
    activeHardware.add(assignment.hardwareId);
    activeDevices.add(deviceKey);
  }

  const pendingFingerprints = new Set<string>();
  const pendingInstallations = new Set<string>();
  const pendingHardware = new Set<string>();
  const pendingDevices = new Set<string>();
  for (const assignment of store.assignments.filter((entry) => entry.state === "pending")) {
    const deviceKey = `${assignment.projectId}\0${assignment.deviceId}`;
    if (
      pendingFingerprints.has(assignment.fingerprint) ||
      activeFingerprints.has(assignment.fingerprint) ||
      pendingInstallations.has(assignment.installationId) ||
      pendingHardware.has(assignment.hardwareId) ||
      pendingDevices.has(deviceKey)
    )
      throw new Error("Invalid Gaia authorization store");
    pendingFingerprints.add(assignment.fingerprint);
    pendingInstallations.add(assignment.installationId);
    pendingHardware.add(assignment.hardwareId);
    pendingDevices.add(deviceKey);

    const predecessor = active.find(
      (entry) =>
        entry.installationId === assignment.installationId ||
        entry.hardwareId === assignment.hardwareId ||
        (entry.projectId === assignment.projectId && entry.deviceId === assignment.deviceId)
    );
    if (predecessor === undefined) continue;
    if (
      predecessor.lineageId !== assignment.lineageId ||
      predecessor.projectId !== assignment.projectId ||
      predecessor.deviceId !== assignment.deviceId ||
      predecessor.hardwareId !== assignment.hardwareId ||
      predecessor.installationId !== assignment.installationId ||
      predecessor.fingerprint === assignment.fingerprint ||
      assignment.predecessorId !== predecessor.id
    )
      throw new Error("Invalid Gaia authorization store");
  }
}

export function emptyAuthorizationStore(): AuthorizationStore {
  return { schemaVersion: 2, assignments: [], revocations: [], preparedBegins: [] };
}

export function parseAuthorizationStore(input: unknown): AuthorizationStore {
  if (!record(input)) throw new Error("Invalid Gaia authorization store");
  only(input, ["schemaVersion", "assignments", "revocations", "preparedBegins"]);
  if (
    input["schemaVersion"] !== 2 ||
    !Array.isArray(input["assignments"]) ||
    !Array.isArray(input["revocations"]) ||
    !Array.isArray(input["preparedBegins"])
  )
    throw new Error("Invalid Gaia authorization store");
  const store: AuthorizationStore = {
    schemaVersion: 2,
    preparedBegins: input["preparedBegins"] as AuthorizationStore["preparedBegins"],
    revocations: input["revocations"] as AuthorizationStore["revocations"],
    assignments: input["assignments"].map(validateAssignment),
  };
  assertStoreInvariants(store);
  return store;
}

export function serializeAuthorizationStore(store: AuthorizationStore): string {
  return JSON.stringify({
    schemaVersion: store.schemaVersion,
    preparedBegins: store.preparedBegins,
    revocations: store.revocations,
    assignments: [...store.assignments].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    ),
  });
}

export function resolveActiveAssignmentFromStore(
  store: AuthorizationStore,
  value: string
): AuthorizationAssignment | undefined {
  if (!fingerprint(value)) throw new Error("Invalid Gaia authorization fingerprint");
  const matches = store.assignments.filter(
    (assignment) => assignment.state === "active" && assignment.fingerprint === value
  );
  if (matches.length > 1) throw new Error("Invalid Gaia authorization store");
  return matches[0];
}

export class FieldAuthorizationDenied extends Error {}

export function verifyActiveAssignment(
  world: World,
  epoch: number,
  assignment: AuthorizationAssignment,
  expected: VerifyAuthorizationExpectation = {}
): void {
  if (assignment.state !== "active")
    throw new FieldAuthorizationDenied("Gaia authorization is not active");
  verifyAssignmentBinding(world, epoch, assignment, expected);
}

export function verifyAssignmentBinding(
  world: World,
  epoch: number,
  assignment: AuthorizationAssignment,
  expected: VerifyAuthorizationExpectation = {}
): void {
  if (assignment.projectId !== world.id)
    throw new FieldAuthorizationDenied("Gaia authorization project mismatch");
  if (
    assignment.statusEpoch !== epoch ||
    (expected.statusEpoch !== undefined && expected.statusEpoch !== epoch)
  )
    throw new FieldAuthorizationDenied("Gaia authorization is stale for this inventory epoch");
  if (
    expected.authorizationGeneration !== undefined &&
    assignment.authorizationGeneration !== expected.authorizationGeneration
  )
    throw new FieldAuthorizationDenied("Gaia authorization generation mismatch");
  const device = Object.hasOwn(world.devices, assignment.deviceId)
    ? world.devices[assignment.deviceId]
    : undefined;
  if (!device || device.source !== "physical")
    throw new FieldAuthorizationDenied("Gaia authorization device mismatch");
  if (device.hardwareId !== assignment.hardwareId)
    throw new FieldAuthorizationDenied("Gaia authorization hardware mismatch");
  if (!assignment.capabilities.every((id) => device.capabilities.includes(id)))
    throw new FieldAuthorizationDenied("Gaia authorization capability mismatch");
}

export function authorizationCapabilities(
  world: World,
  assignment: AuthorizationAssignment
): string[] {
  const device = Object.hasOwn(world.devices, assignment.deviceId)
    ? world.devices[assignment.deviceId]
    : undefined;
  if (!device) return [];
  return assignment.capabilities.filter((id) => device.capabilities.includes(id));
}

// A world receipt is project-local and can be displaced. Reserve the global operation ID
// before its first world write; only a matching pending publication consumes the reservation.
export function prepareBegin(store: AuthorizationStore, input: BeginAuthorizationInput) {
  const approval = beginDigestOf(input);
  const prior = store.preparedBegins.find((r) => r.operationId === input.operationId);
  if (prior) {
    if (prior.digest !== approval)
      throw new Error("Gaia authorization operation was reused with different content");
    return store;
  }
  assertOperationUnused(store, input.operationId);
  return {
    ...store,
    preparedBegins: [...store.preparedBegins, { operationId: input.operationId, digest: approval }],
  };
}

export function beginAuthorization(
  store: AuthorizationStore,
  world: World,
  epoch: number,
  input: BeginAuthorizationInput
): { store: AuthorizationStore; assignment: AuthorizationAssignment } {
  if (
    !identifier(input.projectId) ||
    !uuid(input.operationId) ||
    !identifier(input.deviceId) ||
    !hardware(input.hardwareId) ||
    !uuid(input.installationId) ||
    !fingerprint(input.fingerprint) ||
    !capabilityList(input.capabilities) ||
    !positive(input.now) ||
    (input.renews !== undefined && !uuid(input.renews))
  )
    throw new Error("Invalid Gaia authorization request");
  if (!nonNegative(epoch)) throw new Error("Invalid Gaia inventory epoch");
  const capabilities = sortedCapabilities(input.capabilities);

  const value = beginDigestOf(input);
  const replay = store.assignments.find(
    (assignment) => assignment.beginOperationId === input.operationId
  );
  if (replay) {
    if (replay.beginDigest !== value)
      throw new Error("Gaia authorization operation was reused with different content");
    return { store, assignment: replay };
  }
  const prepared = store.preparedBegins.find((r) => r.operationId === input.operationId);
  if (prepared) {
    if (prepared.digest !== value)
      throw new Error("Gaia authorization operation was reused with different content");
    store = { ...store, preparedBegins: store.preparedBegins.filter((r) => r !== prepared) };
  }
  assertOperationUnused(store, input.operationId);
  assertAvailableToTransfer(store, { ...input, capabilities }, input.operationId);
  assertWorldDevice(world, input.projectId, input.deviceId, input.hardwareId, capabilities);

  // A revoked certificate fingerprint is historical evidence, not a reusable identity.
  // Re-enrollment requires a new certificate and a new local begin operation.
  if (
    store.assignments.some(
      (assignment) => assignment.state === "revoked" && assignment.fingerprint === input.fingerprint
    )
  )
    throw new Error("Gaia authorization certificate fingerprint was revoked");

  let predecessor: AuthorizationAssignment | undefined;
  if (input.renews !== undefined) {
    predecessor = findAssignment(store, input.renews);
    if (predecessor.state !== "active")
      throw new Error("Gaia authorization renewal predecessor is not active");
    verifyActiveAssignment(world, epoch, predecessor);
    if (
      predecessor.projectId !== input.projectId ||
      predecessor.deviceId !== input.deviceId ||
      predecessor.hardwareId !== input.hardwareId ||
      predecessor.installationId !== input.installationId
    )
      throw new Error("Gaia authorization renewal binding mismatch");
    if (predecessor.fingerprint === input.fingerprint)
      throw new Error("Gaia authorization renewal needs a new certificate fingerprint");
    if (
      store.assignments.some(
        (assignment) =>
          assignment.state !== "revoked" &&
          assignment.lineageId === predecessor!.lineageId &&
          assignment.id !== predecessor!.id
      )
    )
      throw new Error("Gaia authorization lineage already has a pending generation");
  }

  for (const assignment of store.assignments) {
    if (assignment.state === "revoked") continue;
    if (predecessor !== undefined && assignment.id === predecessor.id) continue;
    if (assignment.installationId === input.installationId)
      throw new Error("Gaia authorization installation is already assigned");
    if (assignment.hardwareId === input.hardwareId)
      throw new Error("Gaia authorization hardware is already assigned");
    if (assignment.fingerprint === input.fingerprint)
      throw new Error("Gaia authorization fingerprint is already assigned");
    if (assignment.projectId === input.projectId && assignment.deviceId === input.deviceId)
      throw new Error("Gaia authorization device is already assigned");
  }

  const assignment: AuthorizationAssignment = {
    id: randomUUID(),
    lineageId: predecessor?.lineageId ?? randomUUID(),
    projectId: input.projectId,
    deviceId: input.deviceId,
    hardwareId: input.hardwareId,
    installationId: input.installationId,
    fingerprint: input.fingerprint,
    ...(predecessor ? { predecessorId: predecessor.id } : {}),
    authorizationGeneration: predecessor ? nextGeneration(store, predecessor.lineageId) : 1,
    statusEpoch: epoch,
    capabilities,
    state: "pending",
    createdAt: input.now,
    updatedAt: input.now,
    beginOperationId: input.operationId,
    beginDigest: value,
    beginApproval: {
      capabilities: [...capabilities],
      ...(input.expectedRevision === undefined ? {} : { expectedRevision: input.expectedRevision }),
    },
  };
  const next: AuthorizationStore = { ...store, assignments: [...store.assignments, assignment] };
  assertStoreInvariants(next);
  return { store: next, assignment };
}

export function completeAuthorization(
  store: AuthorizationStore,
  world: World,
  epoch: number,
  input: CompleteAuthorizationInput
): { store: AuthorizationStore; assignment: AuthorizationAssignment } {
  if (!uuid(input.assignmentId) || !uuid(input.operationId) || !positive(input.now))
    throw new Error("Invalid Gaia authorization request");
  if (!nonNegative(epoch)) throw new Error("Invalid Gaia inventory epoch");
  const current = findAssignment(store, input.assignmentId);
  const value = completeDigestOf(input.assignmentId);
  if (current.completeOperationId === input.operationId) {
    if (current.completeDigest !== value)
      throw new Error("Gaia authorization operation was reused with different content");
    return { store, assignment: current };
  }
  assertOperationUnused(store, input.operationId);
  if (current.state !== "pending") throw new Error("Gaia authorization is not pending");
  if (current.predecessorId)
    verifyActiveAssignment(world, epoch, findAssignment(store, current.predecessorId));
  assertWorldDevice(
    world,
    current.projectId,
    current.deviceId,
    current.hardwareId,
    current.capabilities
  );
  if (current.statusEpoch !== epoch)
    throw new Error("Gaia authorization is stale for this inventory epoch");

  for (const assignment of store.assignments) {
    if (assignment.state !== "active" || assignment.id === current.id) continue;
    if (assignment.lineageId === current.lineageId) continue;
    if (assignment.fingerprint === current.fingerprint)
      throw new Error("Gaia authorization fingerprint is already assigned");
    if (assignment.installationId === current.installationId)
      throw new Error("Gaia authorization installation is already assigned");
    if (assignment.hardwareId === current.hardwareId)
      throw new Error("Gaia authorization hardware is already assigned");
    if (assignment.projectId === current.projectId && assignment.deviceId === current.deviceId)
      throw new Error("Gaia authorization device is already assigned");
  }

  const assignments = store.assignments.map((assignment) => {
    if (assignment.id === current.id)
      return {
        ...assignment,
        state: "active" as const,
        completeOperationId: input.operationId,
        completeDigest: value,
        updatedAt: Math.max(input.now, assignment.updatedAt),
      };
    if (assignment.state === "active" && assignment.lineageId === current.lineageId)
      return {
        ...assignment,
        successorId: current.id,
        state: "revoked" as const,
        revokedAt: Math.max(input.now, assignment.updatedAt),
        updatedAt: Math.max(input.now, assignment.updatedAt),
      };
    return assignment;
  });
  const next: AuthorizationStore = { ...store, assignments };
  assertStoreInvariants(next);
  return {
    store: next,
    assignment: next.assignments.find((assignment) => assignment.id === current.id)!,
  };
}

function nextGeneration(store: AuthorizationStore, lineageId: string): number {
  return (
    store.assignments.reduce(
      (max, a) => (a.lineageId === lineageId ? Math.max(max, a.authorizationGeneration) : max),
      0
    ) + 1
  );
}

function closeAssignment(
  store: AuthorizationStore,
  current: AuthorizationAssignment,
  now: number,
  carry?: {
    carryOperationId: string;
    carryDigest: string;
    carryTarget: NonNullable<AuthorizationAssignment["carryTarget"]>;
  }
) {
  const at = Math.max(now, current.updatedAt);
  const assignment: AuthorizationAssignment = {
    ...current,
    state: "revoked",
    updatedAt: at,
    revokedAt: current.revokedAt ?? at,
    ...(carry ?? (current.carryOperationId ? { carryCancelled: true as const } : {})),
  };
  const next: AuthorizationStore = {
    ...store,
    assignments: store.assignments.map((entry) => {
      if (entry.id === current.id) return assignment;
      if (entry.state === "pending" && entry.predecessorId === current.id)
        return {
          ...entry,
          state: "revoked" as const,
          revokedAt: Math.max(now, entry.updatedAt),
          updatedAt: Math.max(now, entry.updatedAt),
        };
      return entry;
    }),
  };
  assertStoreInvariants(next);
  return { store: next, assignment };
}

export function releaseForTransfer(
  store: AuthorizationStore,
  current: AuthorizationAssignment,
  operationId: string,
  approval: string,
  target: TransferTarget,
  observedRevision: number | undefined,
  now: number
) {
  if (!uuid(operationId) || !fingerprint(approval))
    throw new Error("Invalid Gaia transfer approval");
  if (current.state === "revoked") {
    if (
      current.carryOperationId !== operationId ||
      current.carryDigest !== approval ||
      !current.carryTarget ||
      !sameTarget(current.carryTarget, target) ||
      current.carryCancelled
    )
      throw new Error("Gaia transfer approval conflict or cancelled operation");
    return { store, assignment: current };
  }
  if (current.state !== "active") throw new Error("Gaia authorization is not active");
  if (!nonNegative(observedRevision)) throw new Error("Missing Gaia target revision at approval");
  assertOperationUnused(store, operationId);
  assertAvailableToTransfer(store, target, operationId);
  if (
    store.assignments.some(
      (a) =>
        a.fingerprint === target.fingerprint ||
        (a.lineageId !== current.lineageId && a.state !== "revoked" && overlaps(a, target))
    )
  )
    throw new Error("Gaia certificate or binding is already assigned or revoked");
  return closeAssignment(store, current, now, {
    carryOperationId: operationId,
    carryDigest: approval,
    carryTarget: {
      ...target,
      observedRevision,
      authorizationGeneration: nextGeneration(store, current.lineageId),
    },
  });
}

// Follow committed successors only. Cancelling a pending renewal cannot revoke its parent.
export function revocationTarget(
  store: AuthorizationStore,
  assignmentId: string,
  operationId: string
) {
  const receipt = store.revocations.find((entry) => entry.operationId === operationId);
  if (receipt) {
    if (receipt.assignmentId !== assignmentId)
      throw new Error("Gaia authorization operation was reused with different content");
    return findAssignment(store, receipt.resultId);
  }
  let current = findAssignment(store, assignmentId);
  const byId = new Map(store.assignments.map((a) => [a.id, a]));
  while (current.successorId) current = byId.get(current.successorId)!;
  return current;
}

export function revokeAuthorization(store: AuthorizationStore, input: RevokeAuthorizationInput) {
  if (!uuid(input.assignmentId) || !uuid(input.operationId) || !positive(input.now))
    throw new Error("Invalid Gaia authorization request");
  const current = revocationTarget(store, input.assignmentId, input.operationId);
  if (store.revocations.some((r) => r.operationId === input.operationId))
    return { store, assignment: current };
  assertOperationUnused(store, input.operationId);
  const outcome = closeAssignment(store, current, input.now);
  outcome.store.revocations = [
    ...store.revocations,
    { operationId: input.operationId, assignmentId: input.assignmentId, resultId: current.id },
  ];
  return outcome;
}

export function activateAuthorization(
  store: AuthorizationStore,
  world: World,
  epoch: number,
  input: ActivateAuthorizationInput
): { store: AuthorizationStore; assignment: AuthorizationAssignment } {
  if (
    !identifier(input.projectId) ||
    !uuid(input.operationId) ||
    !identifier(input.deviceId) ||
    !hardware(input.hardwareId) ||
    !uuid(input.installationId) ||
    !fingerprint(input.fingerprint) ||
    !capabilityList(input.capabilities) ||
    !uuid(input.lineageId) ||
    !Number.isSafeInteger(input.authorizationGeneration) ||
    input.authorizationGeneration < 1 ||
    !positive(input.now) ||
    !uuid(input.predecessorId) ||
    !fingerprint(input.operationDigest)
  )
    throw new Error("Invalid Gaia authorization request");
  if (!nonNegative(epoch)) throw new Error("Invalid Gaia inventory epoch");
  const capabilities = sortedCapabilities(input.capabilities);
  assertWorldDevice(world, input.projectId, input.deviceId, input.hardwareId, capabilities);

  const value = input.operationDigest;
  assertOperationUnused(store, input.operationId, input.predecessorId);
  assertAvailableToTransfer(store, { ...input, capabilities }, input.operationId);

  if (
    store.assignments.some(
      (assignment) => assignment.state === "revoked" && assignment.fingerprint === input.fingerprint
    )
  )
    throw new Error("Gaia authorization certificate fingerprint was revoked");

  const predecessor = findAssignment(store, input.predecessorId);
  if (predecessor.state !== "revoked")
    throw new Error("Gaia authorization predecessor is still active");
  if (
    predecessor.carryOperationId !== input.operationId ||
    predecessor.carryDigest !== value ||
    predecessor.carryCancelled
  )
    throw new Error("Gaia authorization predecessor was not released by this operation");
  if (predecessor.lineageId !== input.lineageId)
    throw new Error("Gaia authorization lineage mismatch");
  const target = predecessor.carryTarget;
  if (
    !target ||
    target.authorizationGeneration !== input.authorizationGeneration ||
    !sameTarget(target, { ...input, capabilities })
  )
    throw new Error("Gaia transfer approval content mismatch");
  if (input.authorizationGeneration !== nextGeneration(store, predecessor.lineageId))
    throw new Error("Gaia authorization generation did not advance");

  for (const assignment of store.assignments) {
    if (assignment.state === "revoked") continue;
    if (assignment.fingerprint === input.fingerprint)
      throw new Error("Gaia authorization fingerprint is already assigned");
    if (assignment.installationId === input.installationId)
      throw new Error("Gaia authorization installation is already assigned");
    if (assignment.hardwareId === input.hardwareId)
      throw new Error("Gaia authorization hardware is already assigned");
    if (assignment.projectId === input.projectId && assignment.deviceId === input.deviceId)
      throw new Error("Gaia authorization device is already assigned");
  }

  const assignment: AuthorizationAssignment = {
    id: randomUUID(),
    lineageId: input.lineageId,
    predecessorId: input.predecessorId,
    projectId: input.projectId,
    deviceId: input.deviceId,
    hardwareId: input.hardwareId,
    installationId: input.installationId,
    fingerprint: input.fingerprint,
    authorizationGeneration: input.authorizationGeneration,
    statusEpoch: epoch,
    capabilities,
    state: "active",
    createdAt: input.now,
    updatedAt: input.now,
    beginOperationId: input.operationId,
    beginDigest: value,
  };
  const next: AuthorizationStore = {
    ...store,
    assignments: [
      ...store.assignments.map((a) =>
        a.id === predecessor.id ? { ...a, successorId: assignment.id } : a
      ),
      assignment,
    ],
  };
  assertStoreInvariants(next);
  return { store: next, assignment };
}

// A world save may carry a permission forward only when the same hardware binding survived
// from the verified previous epoch. Any missed sync, deletion, hardware change or A->B->A
// returns makes the old row permanently revoked instead of reauthorizing it.
export function reconcileAuthorizationAssignments(
  store: AuthorizationStore,
  previousWorld: World,
  previousEpoch: number,
  world: World,
  epoch: number,
  now: number
): AuthorizationStore {
  if (
    previousWorld.id !== world.id ||
    !nonNegative(previousEpoch) ||
    !nonNegative(epoch) ||
    !positive(now)
  )
    throw new Error("Invalid Gaia authorization reconciliation");
  let changed = false;
  const assignments = store.assignments.map((assignment) => {
    if (assignment.state === "revoked" || assignment.projectId !== world.id) return assignment;
    const previousDevice = previousWorld.devices[assignment.deviceId];
    const device = world.devices[assignment.deviceId];

    const updatedAt = Math.max(now, assignment.updatedAt);
    const continues =
      assignment.statusEpoch === previousEpoch &&
      previousDevice !== undefined &&
      previousDevice.source === "physical" &&
      previousDevice.hardwareId === assignment.hardwareId &&
      device !== undefined &&
      device.source === "physical" &&
      device.hardwareId === assignment.hardwareId;
    if (!continues) {
      changed = true;
      return {
        ...assignment,
        state: "revoked" as const,
        revokedAt: updatedAt,
        updatedAt,
      };
    }

    const capabilities = assignment.capabilities.filter((id) => device.capabilities.includes(id));
    if (epoch === previousEpoch && capabilities.length === assignment.capabilities.length)
      return assignment;
    changed = true;
    return {
      ...assignment,
      statusEpoch: epoch,
      capabilities,
      updatedAt,
    };
  });
  if (!changed) return store;
  const next: AuthorizationStore = { ...store, assignments };
  assertStoreInvariants(next);
  return next;
}
