import { createHash } from "node:crypto";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { capabilityIds, sampleSchema } from "../../../../gaia-protocol/v1/src/schema.ts";
import { capabilityOf } from "../devices/capabilities.ts";
import { physicalSnapshot, type PhysicalSnapshotInput } from "../devices/physical.ts";
import {
  activeStatuses,
  recordStatus,
  type DeviceStatus,
  type DeviceStatuses,
  type MeasuredContext,
  type MeasuredOrder,
  type Observation,
  type StatusUpdate,
  type VirtualUpdate,
} from "../devices/status.ts";
import type { World } from "../spatial/world.ts";
import { fields, record, segment } from "./batch.ts";
import { hasCode, publish, readRegular } from "./files.ts";

export interface StoredStatuses {
  identity: string | null;
  statuses: DeviceStatuses;
}

export function parseVirtualUpdate(input: unknown): VirtualUpdate {
  if (!record(input)) throw new Error("Invalid Gaia virtual update");
  segment(input["deviceId"]);
  if (input["kind"] === "link") fields(input, ["kind", "deviceId", "state"]);
  else if (input["kind"] === "observation")
    fields(input, ["kind", "deviceId", "capability", "at", "quality", "value", "unit"]);
  else throw new Error("Invalid Gaia virtual update");
  return input as VirtualUpdate;
}

function time(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 8.64e15;
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
  );
}

const catalog = new Set<string>(capabilityIds);

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
    throw new Error("Invalid Gaia device status file");
}

// Status truth depends only on device identity and capability declarations. Names and mounts
// change without retiring observations, while capability, hardware or source changes do not.
export function deviceStatusIdentity(world: World, epoch = 0): string {
  const devices = Object.entries(world.devices)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, device]) => [
      id,
      device.source,
      device.hardwareId ?? null,
      [...new Set(device.capabilities)].sort(),
    ]);
  return createHash("sha256")
    .update(JSON.stringify([epoch, devices]))
    .digest("hex");
}

function scalarValue(value: unknown, quality: unknown): boolean {
  return quality === "valid"
    ? typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))
    : quality === "invalid" && value === null;
}

function readLink(input: unknown): { state: "online" | "offline"; at: number } | undefined {
  if (input === undefined) return undefined;
  if (
    !record(input) ||
    (input["state"] !== "online" && input["state"] !== "offline") ||
    !time(input["at"])
  )
    throw new Error("Invalid Gaia device connection record");
  return { state: input["state"], at: input["at"] };
}

// v1/v2 rows are the legacy scalar sidecar. Their shape and at <= receivedAt rule stay intact
// so a matching v2 virtual record survives the v3 transition without reinterpretation.
function readLegacyDevices(input: unknown): DeviceStatuses {
  if (!record(input)) throw new Error("Invalid Gaia device status file");
  const statuses: DeviceStatuses = {};
  for (const [id, raw] of Object.entries(input)) {
    if (!record(raw)) throw new Error("Invalid Gaia device status file");
    const source = raw["source"];
    if (source !== "simulated" && source !== "measured")
      throw new Error("Invalid Gaia device status file");
    only(raw, ["source", "observations"], ["hardwareId", "link", "lastContactAt", "lastOfflineAt"]);
    const hardwareId = raw["hardwareId"];
    if (hardwareId !== undefined && typeof hardwareId !== "string")
      throw new Error("Invalid Gaia device status file");
    const legacyLink = readLink(raw["link"]);
    const link = source === "measured" && legacyLink?.state === "online" ? undefined : legacyLink;
    const lastContactAt = raw["lastContactAt"];
    const lastOfflineAt = raw["lastOfflineAt"];
    if (lastContactAt !== undefined && !time(lastContactAt))
      throw new Error("Invalid Gaia device status file");
    if (lastOfflineAt !== undefined && !time(lastOfflineAt))
      throw new Error("Invalid Gaia device status file");

    if (!record(raw["observations"])) throw new Error("Invalid Gaia device status file");
    const observations: Record<string, Observation> = {};
    for (const [capability, sample] of Object.entries(raw["observations"])) {
      if (!record(sample)) throw new Error("Invalid Gaia device observation record");
      only(sample, ["at", "receivedAt", "value", "unit", "source", "quality"]);
      if (
        !time(sample["at"]) ||
        !time(sample["receivedAt"]) ||
        sample["at"] > sample["receivedAt"] ||
        sample["source"] !== source ||
        typeof sample["unit"] !== "string" ||
        !scalarValue(sample["value"], sample["quality"])
      )
        throw new Error("Invalid Gaia device observation record");
      observations[capability] = {
        at: sample["at"],
        receivedAt: sample["receivedAt"],
        value: sample["value"] as Observation["value"],
        unit: sample["unit"],
        source,
        quality: sample["quality"] as "valid" | "invalid",
      };
    }

    statuses[id] = {
      source,
      ...(hardwareId === undefined ? {} : { hardwareId }),
      ...(link === undefined ? {} : { link }),
      ...(lastContactAt === undefined ? {} : { lastContactAt }),
      ...(lastOfflineAt === undefined ? {} : { lastOfflineAt }),
      observations,
    };
  }
  return statuses;
}

function validateStoredValue(
  capability: string,
  quality: "valid" | "invalid" | "missing",
  unit: string,
  value: unknown,
  sampleMonoMs: number | undefined
): void {
  const definition = capabilityOf(capability);
  if (catalog.has(capability)) {
    if (quality === "missing") {
      if (!sampleSchema.safeParse({ id: capability, quality, unit, value }).success)
        throw new Error("Invalid Gaia device observation record");
      return;
    }
    if (sampleMonoMs !== undefined) {
      if (
        !sampleSchema.safeParse({
          id: capability,
          quality,
          sampleMonoMs,
          unit,
          value,
        }).success
      )
        throw new Error("Invalid Gaia device observation record");
      return;
    }
    // A v2 measured row carries no monotonic sample time. Preserve its scalar last-known
    // view without granting it the stronger field-schema trust reserved for timed evidence.
    if (!definition || definition.kind === "media" || unit !== definition.unit)
      throw new Error("Invalid Gaia device observation record");
    if (
      quality === "invalid"
        ? value !== null
        : !(typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)))
    )
      throw new Error("Invalid Gaia device observation record");
    return;
  }

  if (
    !definition ||
    (definition.kind !== "number" && definition.kind !== "boolean") ||
    unit !== definition.unit
  )
    throw new Error("Invalid Gaia device observation record");
  if (quality === "missing") {
    if (value !== null) throw new Error("Invalid Gaia device observation record");
    return;
  }
  if (quality === "valid") {
    if (typeof value !== definition.kind || (typeof value === "number" && !Number.isFinite(value)))
      throw new Error("Invalid Gaia device observation record");
    return;
  }
  if (value !== null) throw new Error("Invalid Gaia device observation record");
}

function readOrder(input: unknown): Record<string, MeasuredOrder> {
  if (!record(input)) throw new Error("Invalid Gaia device status file");
  const order: Record<string, MeasuredOrder> = {};
  for (const [capability, raw] of Object.entries(input)) {
    if (!record(raw)) throw new Error("Invalid Gaia device observation record");
    only(
      raw,
      ["sampleMonoMs", "quality", "value", "unit", "receivedAt"],
      ["at", "sentMonoMs", "ageUpperMs"]
    );
    const quality = raw["quality"];
    if (
      (quality !== "valid" && quality !== "invalid") ||
      !nonNegative(raw["sampleMonoMs"]) ||
      typeof raw["unit"] !== "string" ||
      !time(raw["receivedAt"])
    )
      throw new Error("Invalid Gaia device observation record");
    validateStoredValue(capability, quality, raw["unit"], raw["value"], raw["sampleMonoMs"]);
    if (raw["at"] !== undefined && !time(raw["at"]))
      throw new Error("Invalid Gaia device observation record");
    if (raw["sentMonoMs"] !== undefined && !nonNegative(raw["sentMonoMs"]))
      throw new Error("Invalid Gaia device observation record");
    if (raw["ageUpperMs"] !== undefined && !nonNegative(raw["ageUpperMs"]))
      throw new Error("Invalid Gaia device observation record");
    order[capability] = {
      sampleMonoMs: raw["sampleMonoMs"],
      quality,
      value: raw["value"] as Observation["value"],
      unit: raw["unit"],
      receivedAt: raw["receivedAt"],
      ...(raw["at"] === undefined ? {} : { at: raw["at"] }),
      ...(raw["sentMonoMs"] === undefined ? {} : { sentMonoMs: raw["sentMonoMs"] }),
      ...(raw["ageUpperMs"] === undefined ? {} : { ageUpperMs: raw["ageUpperMs"] }),
    };
  }
  return order;
}

function readMeasured(input: unknown): MeasuredContext {
  if (!record(input)) throw new Error("Invalid Gaia device status file");
  only(
    input,
    [
      "installationId",
      "authorizationGeneration",
      "runId",
      "sessionId",
      "seq",
      "sentMonoMs",
      "deviceWallMs",
      "acceptedAt",
    ],
    ["order", "assignmentId"]
  );
  const seq = input["seq"];
  if (
    (input["assignmentId"] !== undefined && !uuid(input["assignmentId"])) ||
    !uuid(input["installationId"]) ||
    !uuid(input["runId"]) ||
    !uuid(input["sessionId"]) ||
    !nonNegative(input["authorizationGeneration"]) ||
    !nonNegative(input["sentMonoMs"]) ||
    !nonNegative(input["deviceWallMs"]) ||
    typeof seq !== "number" ||
    !Number.isSafeInteger(seq) ||
    seq < 1 ||
    !time(input["acceptedAt"])
  )
    throw new Error("Invalid Gaia device status file");
  const order = input["order"] === undefined ? undefined : readOrder(input["order"]);
  return {
    ...(input["assignmentId"] === undefined ? {} : { assignmentId: input["assignmentId"] }),
    installationId: input["installationId"],
    authorizationGeneration: input["authorizationGeneration"],
    runId: input["runId"],
    sessionId: input["sessionId"],
    seq,
    sentMonoMs: input["sentMonoMs"],
    deviceWallMs: input["deviceWallMs"],
    acceptedAt: input["acceptedAt"],
    ...(order === undefined ? {} : { order }),
  };
}

function readV3Observations(
  input: unknown,
  source: "simulated" | "measured"
): Record<string, Observation> {
  if (!record(input)) throw new Error("Invalid Gaia device status file");
  const observations: Record<string, Observation> = {};
  for (const [capability, raw] of Object.entries(input)) {
    if (!record(raw) || raw["source"] !== source)
      throw new Error("Invalid Gaia device observation record");
    const quality = raw["quality"];
    if (source === "simulated") {
      only(raw, ["at", "receivedAt", "value", "unit", "source", "quality"]);
      if (
        (quality !== "valid" && quality !== "invalid") ||
        !time(raw["at"]) ||
        !time(raw["receivedAt"]) ||
        raw["at"] > raw["receivedAt"] ||
        typeof raw["unit"] !== "string" ||
        !scalarValue(raw["value"], quality)
      )
        throw new Error("Invalid Gaia device observation record");
      observations[capability] = {
        at: raw["at"],
        receivedAt: raw["receivedAt"],
        value: raw["value"] as Observation["value"],
        unit: raw["unit"],
        source,
        quality,
      };
      continue;
    }

    if (quality !== "valid" && quality !== "invalid" && quality !== "missing")
      throw new Error("Invalid Gaia device observation record");
    if (typeof raw["unit"] !== "string" || !time(raw["receivedAt"]))
      throw new Error("Invalid Gaia device observation record");
    if (quality === "missing") {
      only(raw, ["quality", "unit", "value", "source", "receivedAt"]);
      if (raw["value"] !== null) throw new Error("Invalid Gaia device observation record");
      validateStoredValue(capability, quality, raw["unit"], null, undefined);
      observations[capability] = {
        quality,
        value: null,
        unit: raw["unit"],
        source,
        receivedAt: raw["receivedAt"],
      };
      continue;
    }

    only(
      raw,
      ["quality", "unit", "value", "source", "receivedAt"],
      ["sampleMonoMs", "sentMonoMs", "ageUpperMs", "at"]
    );
    if (raw["sampleMonoMs"] !== undefined && !nonNegative(raw["sampleMonoMs"]))
      throw new Error("Invalid Gaia device observation record");
    if (raw["sentMonoMs"] !== undefined && !nonNegative(raw["sentMonoMs"]))
      throw new Error("Invalid Gaia device observation record");
    if (raw["ageUpperMs"] !== undefined && !nonNegative(raw["ageUpperMs"]))
      throw new Error("Invalid Gaia device observation record");
    if (raw["at"] !== undefined && !time(raw["at"]))
      throw new Error("Invalid Gaia device observation record");
    validateStoredValue(capability, quality, raw["unit"], raw["value"], raw["sampleMonoMs"]);
    const at =
      raw["at"] ??
      (raw["ageUpperMs"] === undefined ? undefined : raw["receivedAt"] - raw["ageUpperMs"]);
    observations[capability] = {
      quality,
      value: raw["value"] as Observation["value"],
      unit: raw["unit"],
      source,
      receivedAt: raw["receivedAt"],
      ...(raw["sampleMonoMs"] === undefined ? {} : { sampleMonoMs: raw["sampleMonoMs"] }),
      ...(raw["sentMonoMs"] === undefined ? {} : { sentMonoMs: raw["sentMonoMs"] }),
      ...(raw["ageUpperMs"] === undefined ? {} : { ageUpperMs: raw["ageUpperMs"] }),
      ...(at === undefined || at <= 0 ? {} : { at }),
    };
  }
  return observations;
}

function readV3Devices(input: unknown): DeviceStatuses {
  if (!record(input)) throw new Error("Invalid Gaia device status file");
  const statuses: DeviceStatuses = {};
  for (const [id, raw] of Object.entries(input)) {
    if (!record(raw)) throw new Error("Invalid Gaia device status file");
    const source = raw["source"];
    if (source !== "simulated" && source !== "measured")
      throw new Error("Invalid Gaia device status file");
    only(
      raw,
      ["source", "observations"],
      ["hardwareId", "link", "lastContactAt", "lastOfflineAt", "measured"]
    );
    let hardwareId: string | undefined;
    if (source === "measured") {
      const value = raw["hardwareId"];
      if (typeof value !== "string" || !value) throw new Error("Invalid Gaia device status file");
      hardwareId = value;
    } else if (raw["hardwareId"] !== undefined) {
      throw new Error("Invalid Gaia device status file");
    }
    const link = readLink(raw["link"]);
    // A persisted online flag is not live evidence after a restart. Contact/offline times
    // stay; only an explicit offline transition survives the read.
    const restoredLink = source === "measured" && link?.state === "online" ? undefined : link;
    const lastContactAt = raw["lastContactAt"];
    const lastOfflineAt = raw["lastOfflineAt"];
    if (lastContactAt !== undefined && !time(lastContactAt))
      throw new Error("Invalid Gaia device status file");
    if (lastOfflineAt !== undefined && !time(lastOfflineAt))
      throw new Error("Invalid Gaia device status file");
    const measured = raw["measured"] === undefined ? undefined : readMeasured(raw["measured"]);
    if (source === "simulated" && measured !== undefined)
      throw new Error("Invalid Gaia device status file");
    statuses[id] = {
      source,
      ...(hardwareId === undefined ? {} : { hardwareId }),
      ...(restoredLink === undefined ? {} : { link: restoredLink }),
      ...(lastContactAt === undefined ? {} : { lastContactAt }),
      ...(lastOfflineAt === undefined ? {} : { lastOfflineAt }),
      ...(measured === undefined ? {} : { measured }),
      observations: readV3Observations(raw["observations"], source),
    };
  }
  return statuses;
}

function readStatuses(input: unknown): StoredStatuses {
  if (!record(input)) throw new Error("Invalid Gaia device status file");
  if (input["schemaVersion"] === 1) {
    fields(input, ["schemaVersion", "devices"]);
    return { identity: null, statuses: readLegacyDevices(input["devices"]) };
  }
  if (input["schemaVersion"] === 2 || input["schemaVersion"] === 3) {
    fields(input, ["schemaVersion", "identity", "devices"]);
    const identity = input["identity"];
    if (typeof identity !== "string" || !/^[a-f0-9]{64}$/.test(identity))
      throw new Error("Invalid Gaia device status identity");
    return {
      identity,
      statuses:
        input["schemaVersion"] === 3
          ? readV3Devices(input["devices"])
          : readLegacyDevices(input["devices"]),
    };
  }
  throw new Error("Unsupported Gaia device status schema");
}

async function readStored(path: string): Promise<StoredStatuses | undefined> {
  let bytes: Buffer;
  try {
    bytes = await readRegular(path);
  } catch (error) {
    if (hasCode(error, "ENOENT")) return undefined;
    throw error;
  }
  try {
    return readStatuses(JSON.parse(bytes.toString("utf8")));
  } catch {
    throw new Error("Gaia device status file is unreadable");
  }
}

// A sidecar written for another identity cannot prove that retired observations never existed.
// Dropping it fails closed; a status update or a later identity-changing inventory save rebuilds it.
export function reconcileDeviceStatuses(
  world: World,
  previousIdentity: string,
  stored: StoredStatuses | undefined
): DeviceStatuses {
  return stored && stored.identity === previousIdentity
    ? activeStatuses(world, stored.statuses)
    : {};
}

function serializeOrder(order: Record<string, MeasuredOrder>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(order).map(([capability, entry]) => [
      capability,
      {
        sampleMonoMs: entry.sampleMonoMs,
        quality: entry.quality,
        value: entry.value,
        unit: entry.unit,
        receivedAt: entry.receivedAt,
        ...(entry.at === undefined ? {} : { at: entry.at }),
        ...(entry.sentMonoMs === undefined ? {} : { sentMonoMs: entry.sentMonoMs }),
        ...(entry.ageUpperMs === undefined ? {} : { ageUpperMs: entry.ageUpperMs }),
      },
    ])
  );
}

function serializeMeasured(measured: MeasuredContext): Record<string, unknown> {
  return {
    ...(measured.assignmentId === undefined ? {} : { assignmentId: measured.assignmentId }),
    installationId: measured.installationId,
    authorizationGeneration: measured.authorizationGeneration,
    runId: measured.runId,
    sessionId: measured.sessionId,
    seq: measured.seq,
    sentMonoMs: measured.sentMonoMs,
    deviceWallMs: measured.deviceWallMs,
    acceptedAt: measured.acceptedAt,
    ...(measured.order === undefined || !Object.keys(measured.order).length
      ? {}
      : { order: serializeOrder(measured.order) }),
  };
}

function serializeObservation(observation: Observation): Record<string, unknown> {
  if (observation.source === "simulated")
    return {
      at: observation.at,
      receivedAt: observation.receivedAt,
      value: observation.value,
      unit: observation.unit,
      source: observation.source,
      quality: observation.quality,
    };
  if (observation.quality === "missing")
    return {
      quality: observation.quality,
      value: null,
      unit: observation.unit,
      source: observation.source,
      receivedAt: observation.receivedAt,
    };
  return {
    quality: observation.quality,
    value: observation.value,
    unit: observation.unit,
    source: observation.source,
    receivedAt: observation.receivedAt,
    ...(observation.sampleMonoMs === undefined ? {} : { sampleMonoMs: observation.sampleMonoMs }),
    ...(observation.sentMonoMs === undefined ? {} : { sentMonoMs: observation.sentMonoMs }),
    ...(observation.ageUpperMs === undefined ? {} : { ageUpperMs: observation.ageUpperMs }),
    ...(observation.at === undefined ? {} : { at: observation.at }),
  };
}

function serializeStatus(status: DeviceStatus): Record<string, unknown> {
  const link =
    status.link === undefined || (status.source === "measured" && status.link.state === "online")
      ? undefined
      : status.link;
  return {
    source: status.source,
    ...(status.source === "measured" && status.hardwareId !== undefined
      ? { hardwareId: status.hardwareId }
      : {}),
    ...(link === undefined ? {} : { link }),
    ...(status.lastContactAt === undefined ? {} : { lastContactAt: status.lastContactAt }),
    ...(status.lastOfflineAt === undefined ? {} : { lastOfflineAt: status.lastOfflineAt }),
    ...(status.measured === undefined ? {} : { measured: serializeMeasured(status.measured) }),
    observations: Object.fromEntries(
      Object.entries(status.observations).map(([capability, observation]) => [
        capability,
        serializeObservation(observation),
      ])
    ),
  };
}

function serializeStatuses(identity: string, statuses: DeviceStatuses): string {
  const devices = Object.fromEntries(
    Object.entries(statuses).flatMap(([id, status]) =>
      // A measured row without a hardware identity cannot be attributed after a restart.
      status.source === "measured" && status.hardwareId === undefined
        ? []
        : [[id, serializeStatus(status)]]
    )
  );
  return JSON.stringify({ schemaVersion: 3, identity, devices });
}

export async function projectStatuses(
  dir: string,
  world: World,
  epoch: number,
  update?: StatusUpdate,
  check?: () => void
): Promise<DeviceStatuses> {
  const path = join(dir, "device-status.json");
  const stored = await readStored(path);
  const identity = deviceStatusIdentity(world, epoch);
  const active =
    stored && stored.identity === identity ? activeStatuses(world, stored.statuses) : {};
  if (!update) return active;
  check?.();
  const next = recordStatus(world, active, update, Date.now());
  if (next !== active) await publish(path, serializeStatuses(identity, next));
  return next;
}

// Explicit RAM continuity is owned by B4, not by a hidden storage cache. Its identity
// binds it to the published inventory epoch; the persisted device row must still match.
export interface PhysicalLiveProof {
  identity: string;
  status: DeviceStatus;
}

export function matchesLiveProof(
  identity: string,
  persisted: DeviceStatus,
  proof: PhysicalLiveProof
) {
  return (
    proof.identity === identity &&
    proof.status.source === "measured" &&
    proof.status.measured?.acceptedMonoMs !== undefined &&
    isDeepStrictEqual(serializeStatus(proof.status), serializeStatus(persisted))
  );
}

// The physical ingest boundary. B4/B7 must call this while holding the project writer lock,
// after re-reading world.json and re-checking authorization/session/epoch. A failed packet
// never publishes, and a failed publish never advances the caller's ACK or seq.
export async function projectPhysicalSnapshot(
  dir: string,
  world: World,
  epoch: number,
  input: PhysicalSnapshotInput,
  previousLive?: PhysicalLiveProof
): Promise<DeviceStatuses> {
  const path = join(dir, "device-status.json");
  const stored = await readStored(path);
  const identity = deviceStatusIdentity(world, epoch);
  const active =
    stored && stored.identity === identity ? activeStatuses(world, stored.statuses) : {};
  if (previousLive !== undefined) {
    const persisted = active[input.context.deviceId];
    if (!persisted || !matchesLiveProof(identity, persisted, previousLive))
      throw new Error("Gaia physical session continuity mismatch");
    active[input.context.deviceId] = previousLive.status;
  }
  const next = physicalSnapshot(world, active, input);
  await publish(path, serializeStatuses(identity, next));
  return next;
}

// Runs only after a world publication succeeds. A write failure leaves the sidecar stale,
// which the identity check then treats as unreadable history rather than valid status.
export async function reconcileStatuses(
  dir: string,
  world: World,
  previous: World,
  epoch: number,
  previousEpoch: number
): Promise<void> {
  const previousIdentity = deviceStatusIdentity(previous, previousEpoch);
  const identity = deviceStatusIdentity(world, epoch);
  if (identity === previousIdentity) return;
  const path = join(dir, "device-status.json");
  const stored = await readStored(path);
  if (!stored) return;
  await publish(
    path,
    serializeStatuses(identity, reconcileDeviceStatuses(world, previousIdentity, stored))
  );
}

// The caller holds the same project lock as session opening and snapshot publication.
export async function projectPhysicalOffline(
  dir: string,
  world: World,
  epoch: number,
  retired: {
    statusEpoch: number;
    deviceId: string;
    sessionId: string;
    lastSeq: number;
    hardwareId: string;
    authorizationGeneration: number;
    installationId: string;
  },
  at: number
): Promise<void> {
  if (epoch !== retired.statusEpoch) return;
  const path = join(dir, "device-status.json");
  const stored = await readStored(path);
  const identity = deviceStatusIdentity(world, epoch);
  if (!stored || stored.identity !== identity) return;
  const active = activeStatuses(world, stored.statuses);
  const row = active[retired.deviceId];
  const measured = row?.measured;
  if (
    row?.hardwareId !== retired.hardwareId ||
    measured?.sessionId !== retired.sessionId ||
    measured.seq !== retired.lastSeq ||
    measured.authorizationGeneration !== retired.authorizationGeneration ||
    measured.installationId !== retired.installationId
  )
    return;
  const next = recordStatus(
    world,
    active,
    {
      kind: "link",
      source: "measured",
      state: "offline",
      deviceId: retired.deviceId,
      hardwareId: retired.hardwareId,
    },
    at
  );
  await publish(path, serializeStatuses(identity, next));
}
