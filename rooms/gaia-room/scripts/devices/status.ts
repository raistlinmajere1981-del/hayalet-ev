import { capabilityOf } from "./capabilities.ts";
import type { Device, Id, World } from "../spatial/world.ts";

export const freshForMs = 60_000;
export type Connection = "online" | "offline" | "unknown" | "unbound";
type Source = "simulated" | "measured";
type Quality = "valid" | "invalid" | "missing";
export type Freshness = "fresh" | "stale" | "noData";

export interface NetworkState {
  transport: "none" | "wifi" | "cellular" | "other";
  internetCapable: boolean;
  validated: boolean;
}

export type ObservationValue =
  number | boolean | string | [number, number, number] | NetworkState | null;

export interface Observation {
  // Simulated readings carry the wall time supplied by the virtual input. Measured
  // readings derive this display estimate from the first accepted age upper bound.
  at?: number;
  receivedAt: number;
  value: ObservationValue;
  unit: string;
  source: Source;
  quality: Quality;
  // Measured evidence only. Monotonic acceptance fields are RAM-only and never serialized.
  sampleMonoMs?: number;
  sentMonoMs?: number;
  ageUpperMs?: number;
  acceptedMonoMs?: number;
}

// Session ordering memory survives missing views. It is persisted so a later packet cannot
// use a missing gap to overwrite an older sample; acceptedMonoMs stays in RAM.
export interface MeasuredOrder {
  sampleMonoMs: number;
  quality: "valid" | "invalid";
  value: ObservationValue;
  unit: string;
  receivedAt: number;
  at?: number;
  sentMonoMs?: number;
  ageUpperMs?: number;
  acceptedMonoMs?: number;
}

export interface MeasuredContext {
  installationId: string;
  authorizationGeneration: number;
  runId: string;
  sessionId: string;
  seq: number;
  sentMonoMs: number;
  deviceWallMs: number;
  acceptedAt: number;
  acceptedMonoMs?: number;
  order?: Record<string, MeasuredOrder>;
}

export interface DeviceStatus {
  source: Source;
  hardwareId?: Id;
  link?: { state: "online" | "offline"; at: number };
  lastContactAt?: number;
  lastOfflineAt?: number;
  measured?: MeasuredContext;
  observations: Record<string, Observation>;
}

export type DeviceStatuses = Record<Id, DeviceStatus>;
export interface StatusSnapshot {
  project: Id;
  revision: number;
  statuses: DeviceStatuses;
}
export type StatusInput =
  | { kind: "link"; state: "online" | "offline" }
  | {
      kind: "observation";
      capability: string;
      at: number;
      quality: "valid" | "invalid";
      value: number | boolean | null;
      unit: string;
    };
export type VirtualUpdate = StatusInput & { deviceId: Id };
export type StatusUpdate = VirtualUpdate & { source: Source; hardwareId?: Id };

export function statusMatches(device: Device, status: DeviceStatus): boolean {
  return device.source === "virtual"
    ? status.source === "simulated" && status.hardwareId === undefined
    : status.source === "measured" &&
        !!device.hardwareId &&
        status.hardwareId === device.hardwareId;
}

// Renderer memory is trusted only for the exact saved world revision it was reconciled against.
// A failed read or an inventory save therefore hides the old snapshot instead of presenting it.
export function visibleStatuses(
  world: World,
  snapshot: StatusSnapshot | undefined,
  unreadable: boolean
): DeviceStatuses {
  if (
    unreadable ||
    !snapshot ||
    snapshot.project !== world.id ||
    snapshot.revision !== world.revision
  )
    return {};
  return activeStatuses(world, snapshot.statuses);
}

export function activeStatuses(world: World, current: DeviceStatuses): DeviceStatuses {
  return Object.fromEntries(
    Object.entries(current).flatMap(([id, status]) => {
      const device = Object.hasOwn(world.devices, id) ? world.devices[id] : undefined;
      if (!device || !statusMatches(device, status)) return [];
      const observations = Object.fromEntries(
        Object.entries(status.observations).filter(([capability]) =>
          device.capabilities.includes(capability)
        )
      );
      // Removed capabilities must not leave ordering memory behind: re-adding one later
      // cannot revive a view that the inventory no longer declares.
      const order = status.measured?.order;
      const measured =
        status.measured === undefined || order === undefined
          ? status.measured
          : {
              ...status.measured,
              order: Object.fromEntries(
                Object.entries(order).filter(([capability]) =>
                  device.capabilities.includes(capability)
                )
              ),
            };
      return [[id, { ...status, ...(measured === undefined ? {} : { measured }), observations }]];
    })
  );
}

export function recordStatus(
  world: World,
  current: DeviceStatuses,
  update: StatusUpdate,
  receivedAt: number
): DeviceStatuses {
  const { deviceId, source, hardwareId } = update;
  const device = Object.hasOwn(world.devices, deviceId) ? world.devices[deviceId] : undefined;
  const identity: DeviceStatus = {
    source,
    ...(hardwareId === undefined ? {} : { hardwareId }),
    observations: {},
  };
  if (!device || !statusMatches(device, identity))
    throw new Error("Gaia observation identity mismatch");
  if (!Number.isSafeInteger(receivedAt) || receivedAt <= 0)
    throw new Error("Invalid Gaia receipt time");

  const stored = current[deviceId];
  const status = stored && statusMatches(device, stored) ? stored : identity;
  if (update.kind === "link") {
    if (update.state !== "online" && update.state !== "offline")
      throw new Error("Invalid Gaia connection state");
    if (status.link && status.link.at > receivedAt) return current;
    return {
      ...current,
      [deviceId]: {
        ...status,
        link: { state: update.state, at: receivedAt },
        ...(update.state === "online"
          ? { lastContactAt: receivedAt }
          : { lastOfflineAt: receivedAt }),
      },
    };
  }
  const { at, capability, quality, unit, value } = update;
  const definition = typeof capability === "string" ? capabilityOf(capability) : undefined;
  const scalar = definition?.kind === "number" || definition?.kind === "boolean";
  const physical = definition !== undefined && "physical" in definition && definition.physical;
  if (
    !device.capabilities.includes(capability) ||
    !definition ||
    !scalar ||
    physical ||
    unit !== definition.unit ||
    !Number.isSafeInteger(at) ||
    at <= 0 ||
    at > receivedAt ||
    (quality === "valid"
      ? typeof value !== definition.kind || (typeof value === "number" && !Number.isFinite(value))
      : quality !== "invalid" || value !== null)
  )
    throw new Error("Invalid Gaia observation");

  const previous = status.observations[capability];
  if (
    previous &&
    (previous.receivedAt > receivedAt ||
      (source === "measured" && previous.at !== undefined && previous.at > at))
  )
    return current;
  return {
    ...current,
    [deviceId]: {
      ...status,
      ...(status.link?.state !== "offline"
        ? { lastContactAt: Math.max(receivedAt, status.lastContactAt ?? 0) }
        : {}),
      observations: {
        ...status.observations,
        [capability]: { at, receivedAt, value, unit, source, quality },
      },
    },
  };
}

export function connection(device: Device, status?: DeviceStatus): Connection {
  if (device.source === "physical" && !device.hardwareId) return "unbound";
  return status?.link?.state ?? "unknown";
}

// Measured freshness needs a live central monotonic anchor. Without one (restart, sidecar
// read, or a B4 session that has not supplied a clock) the record is last-known/stale.
export function measuredFreshness(
  status: DeviceStatus | undefined,
  reading: Observation | undefined,
  monoMs?: number
): Freshness {
  if (!reading || reading.quality === "missing") return "noData";
  if (status?.link?.state === "offline") return "stale";
  // A reconnect cannot make a reading that was first accepted before the last offline
  // transition fresh again; only evidence accepted after it can.
  if (status?.lastOfflineAt !== undefined && reading.receivedAt <= status.lastOfflineAt)
    return "stale";
  if (
    reading.source !== "measured" ||
    reading.ageUpperMs === undefined ||
    reading.acceptedMonoMs === undefined ||
    monoMs === undefined ||
    !Number.isSafeInteger(reading.ageUpperMs) ||
    !Number.isSafeInteger(reading.acceptedMonoMs) ||
    !Number.isSafeInteger(monoMs)
  )
    return "stale";
  const elapsed = monoMs - reading.acceptedMonoMs;
  if (elapsed < 0) return "stale";
  const age = reading.ageUpperMs + elapsed;
  if (!Number.isSafeInteger(age)) return "stale";
  return age < freshForMs ? "fresh" : "stale";
}

export function observationFreshness(
  status: DeviceStatus | undefined,
  reading: Observation | undefined,
  now: number,
  monoMs?: number
): Freshness {
  if (!reading || reading.quality === "missing") return "noData";
  if (reading.source === "measured") return measuredFreshness(status, reading, monoMs);
  if (reading.at === undefined) return "stale";
  if (
    status?.link?.state === "offline" ||
    reading.at <= (status?.lastOfflineAt ?? 0) ||
    now >= reading.at + freshForMs
  )
    return "stale";
  return "fresh";
}

export type DeviceHealth = Connection | Freshness | "invalid";

export function deviceHealth(
  device: Device,
  status: DeviceStatus | undefined,
  now: number,
  monoMs?: number
): DeviceHealth {
  const link = connection(device, status);
  if (link === "offline" || link === "unbound") return link;
  const readable = device.capabilities.filter((id) => {
    const definition = capabilityOf(id);
    return definition && definition.kind !== "media";
  });
  const observations = readable.map((id) => status?.observations[id]);
  if (observations.some((reading) => reading?.quality === "invalid")) return "invalid";
  if (
    observations.some(
      (reading) => reading && observationFreshness(status, reading, now, monoMs) === "stale"
    )
  )
    return "stale";
  if (observations.some((reading) => reading?.quality === "missing")) return "noData";
  if (link === "online" && observations.some((reading) => !reading)) return "noData";
  return link;
}
