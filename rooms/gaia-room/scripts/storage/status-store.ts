import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  activeStatuses,
  recordStatus,
  type DeviceStatuses,
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

function readDevices(input: unknown): DeviceStatuses {
  if (!record(input)) throw new Error("Invalid Gaia device status file");
  for (const status of Object.values(input)) {
    if (
      !record(status) ||
      (status["source"] !== "simulated" && status["source"] !== "measured") ||
      (status["hardwareId"] !== undefined && typeof status["hardwareId"] !== "string") ||
      !record(status["observations"]) ||
      [status["lastContactAt"], status["lastOfflineAt"]].some(
        (value) => value !== undefined && !time(value)
      )
    )
      throw new Error("Invalid Gaia device status file");

    const link = status["link"];
    if (
      link !== undefined &&
      (!record(link) ||
        (link["state"] !== "online" && link["state"] !== "offline") ||
        !time(link["at"]))
    )
      throw new Error("Invalid Gaia device connection record");

    for (const sample of Object.values(status["observations"])) {
      if (
        !record(sample) ||
        !time(sample["at"]) ||
        !time(sample["receivedAt"]) ||
        sample["at"] > sample["receivedAt"] ||
        sample["source"] !== status["source"] ||
        typeof sample["unit"] !== "string" ||
        (sample["quality"] === "valid"
          ? typeof sample["value"] !== "boolean" && !Number.isFinite(sample["value"])
          : sample["quality"] !== "invalid" || sample["value"] !== null)
      )
        throw new Error("Invalid Gaia device observation record");
    }
  }
  return input as DeviceStatuses;
}

function readStatuses(input: unknown): StoredStatuses {
  if (!record(input)) throw new Error("Invalid Gaia device status file");
  if (input["schemaVersion"] === 1) {
    fields(input, ["schemaVersion", "devices"]);
    return { identity: null, statuses: readDevices(input["devices"]) };
  }
  if (input["schemaVersion"] !== 2) throw new Error("Unsupported Gaia device status schema");
  fields(input, ["schemaVersion", "identity", "devices"]);
  const identity = input["identity"];
  if (typeof identity !== "string" || !/^[a-f0-9]{64}$/.test(identity))
    throw new Error("Invalid Gaia device status identity");
  return { identity, statuses: readDevices(input["devices"]) };
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

export async function projectStatuses(
  dir: string,
  world: World,
  epoch: number,
  update?: StatusUpdate
): Promise<DeviceStatuses> {
  const path = join(dir, "device-status.json");
  const stored = await readStored(path);
  const identity = deviceStatusIdentity(world, epoch);
  const active =
    stored && stored.identity === identity ? activeStatuses(world, stored.statuses) : {};
  if (!update) return active;
  const next = recordStatus(world, active, update, Date.now());
  if (next !== active)
    await publish(path, JSON.stringify({ schemaVersion: 2, identity, devices: next }));
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
    JSON.stringify({
      schemaVersion: 2,
      identity,
      devices: reconcileDeviceStatuses(world, previousIdentity, stored),
    })
  );
}
