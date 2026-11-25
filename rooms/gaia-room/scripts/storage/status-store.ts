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

function readStatuses(input: unknown): DeviceStatuses {
  fields(input, ["schemaVersion", "devices"]);
  const { devices, schemaVersion } = input;
  if (schemaVersion !== 1 || !record(devices)) throw new Error("Invalid Gaia device status file");
  for (const status of Object.values(devices)) {
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
  return devices as DeviceStatuses;
}

export async function projectStatuses(
  dir: string,
  world: World,
  update?: StatusUpdate
): Promise<DeviceStatuses> {
  const path = join(dir, "device-status.json");
  let stored: DeviceStatuses = {};
  try {
    stored = readStatuses(JSON.parse((await readRegular(path)).toString("utf8")));
  } catch (error) {
    if (!hasCode(error, "ENOENT")) throw error;
  }
  const active = activeStatuses(world, stored);
  if (!update) return active;
  const next = recordStatus(world, active, update, Date.now());
  if (next !== active) await publish(path, JSON.stringify({ schemaVersion: 1, devices: next }));
  return next;
}
