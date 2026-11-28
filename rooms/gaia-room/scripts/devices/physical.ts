import {
  capabilityIds,
  observationPacketSchema,
  type ObservationPacket,
} from "../protocol/schema.ts";
import {
  duplicateCapabilities,
  missingCapabilityIds,
  samplesAfterSend,
  samplesOutsideAccepted,
} from "../protocol/semantics.ts";
import type { Id, World } from "../spatial/world.ts";
import {
  statusMatches,
  type DeviceStatus,
  type DeviceStatuses,
  type MeasuredOrder,
  type Observation,
  type ObservationValue,
} from "./status.ts";

const uuidV4Pattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const catalog = new Set<string>(capabilityIds);

// B4 owns the session state machine. This is the explicit trusted boundary it must supply:
// authorization/binding generation plus the central monotonic anchors needed for age.
export interface PhysicalSessionContext {
  assignmentId?: string;
  deviceId: Id;
  hardwareId: Id;
  installationId: string;
  authorizationGeneration: number;
  runId: string;
  sessionId: string;
  accepted: readonly string[];
  acceptedAt: number;
  acceptedMonoMs: number;
  previousResponseMonoMs?: number;
}

export interface PhysicalSnapshotInput {
  context: PhysicalSessionContext;
  packet: unknown;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function time(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 8.64e15;
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function sameValue(left: ObservationValue, right: ObservationValue): boolean {
  if (typeof left === "number" && typeof right === "number") return left === right;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) =>
        sameValue(value as ObservationValue, right[index] as ObservationValue)
      )
    );
  }
  if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
    const a = left as unknown as Record<string, unknown>;
    const b = right as unknown as Record<string, unknown>;
    const keys = Object.keys(a).sort();
    const other = Object.keys(b).sort();
    return (
      keys.length === other.length &&
      keys.every(
        (key, index) =>
          key === other[index] && sameValue(a[key] as ObservationValue, b[key] as ObservationValue)
      )
    );
  }
  return left === right;
}

function assertContext(world: World, context: PhysicalSessionContext): DeviceStatus {
  if (!record(context)) throw new Error("Invalid Gaia physical session context");
  const device = Object.hasOwn(world.devices, context.deviceId)
    ? world.devices[context.deviceId]
    : undefined;
  if (!device || device.source !== "physical" || !device.hardwareId)
    throw new Error("Gaia physical device identity mismatch");
  if (device.hardwareId !== context.hardwareId)
    throw new Error("Gaia physical device identity mismatch");
  if (!uuidV4Pattern.test(context.installationId))
    throw new Error("Invalid Gaia installation identity");
  if (!uuidV4Pattern.test(context.runId)) throw new Error("Invalid Gaia run identity");
  if (!uuidV4Pattern.test(context.sessionId)) throw new Error("Invalid Gaia session identity");
  if (!nonNegative(context.authorizationGeneration))
    throw new Error("Invalid Gaia authorization generation");
  if (!time(context.acceptedAt)) throw new Error("Invalid Gaia acceptance time");
  if (!nonNegative(context.acceptedMonoMs)) throw new Error("Invalid Gaia monotonic acceptance");
  if (
    context.previousResponseMonoMs !== undefined &&
    (!nonNegative(context.previousResponseMonoMs) ||
      context.previousResponseMonoMs > context.acceptedMonoMs)
  )
    throw new Error("Invalid Gaia monotonic context");

  if (
    !Array.isArray(context.accepted) ||
    !context.accepted.every((id) => typeof id === "string" && catalog.has(id)) ||
    new Set(context.accepted).size !== context.accepted.length ||
    context.accepted.some((id) => !device.capabilities.includes(id))
  )
    throw new Error("Invalid Gaia accepted capability set");

  return {
    source: "measured",
    hardwareId: context.hardwareId,
    observations: {},
  };
}

function assertPacket(packet: unknown, context: PhysicalSessionContext): ObservationPacket {
  const parsed = observationPacketSchema.safeParse(packet);
  if (!parsed.success) throw new Error("Invalid Gaia observation packet");
  const value = parsed.data;
  if (value.sessionId !== context.sessionId) throw new Error("Gaia observation session mismatch");
  if (duplicateCapabilities(value.samples.map((sample) => sample.id)).length)
    throw new Error("Gaia observation packet has duplicate capabilities");
  if (samplesOutsideAccepted(value, context.accepted).length)
    throw new Error("Gaia observation packet has a sample outside accepted capabilities");
  if (missingCapabilityIds(value, context.accepted).length)
    throw new Error("Gaia observation packet does not cover accepted capabilities");
  if (samplesAfterSend(value).length)
    throw new Error("Gaia observation packet has a sample after send time");
  return value;
}

function ageUpper(
  sampleMonoMs: number,
  sentMonoMs: number,
  context: PhysicalSessionContext
): number | undefined {
  if (context.previousResponseMonoMs === undefined) return undefined;
  const wait = context.acceptedMonoMs - context.previousResponseMonoMs;
  if (!Number.isSafeInteger(wait) || wait < 0) throw new Error("Invalid Gaia monotonic context");
  const transit = sentMonoMs - sampleMonoMs;
  if (!Number.isSafeInteger(transit) || transit < 0)
    throw new Error("Invalid Gaia observation time");
  const age = transit + wait;
  return Number.isSafeInteger(age) ? age : undefined;
}

function fromOrder(order: MeasuredOrder): Observation {
  return {
    quality: order.quality,
    value: order.value,
    unit: order.unit,
    source: "measured",
    receivedAt: order.receivedAt,
    sampleMonoMs: order.sampleMonoMs,
    ...(order.at === undefined ? {} : { at: order.at }),
    ...(order.sentMonoMs === undefined ? {} : { sentMonoMs: order.sentMonoMs }),
    ...(order.ageUpperMs === undefined ? {} : { ageUpperMs: order.ageUpperMs }),
    ...(order.acceptedMonoMs === undefined ? {} : { acceptedMonoMs: order.acceptedMonoMs }),
  };
}

function orderOf(observation: Observation): MeasuredOrder | undefined {
  if (
    observation.sampleMonoMs === undefined ||
    (observation.quality !== "valid" && observation.quality !== "invalid")
  )
    return undefined;
  return {
    sampleMonoMs: observation.sampleMonoMs,
    quality: observation.quality,
    value: observation.value,
    unit: observation.unit,
    receivedAt: observation.receivedAt,
    ...(observation.at === undefined ? {} : { at: observation.at }),
    ...(observation.sentMonoMs === undefined ? {} : { sentMonoMs: observation.sentMonoMs }),
    ...(observation.ageUpperMs === undefined ? {} : { ageUpperMs: observation.ageUpperMs }),
    ...(observation.acceptedMonoMs === undefined
      ? {}
      : { acceptedMonoMs: observation.acceptedMonoMs }),
  };
}

export function physicalSnapshot(
  world: World,
  current: DeviceStatuses,
  input: PhysicalSnapshotInput
): DeviceStatuses {
  const { context } = input;
  const identity = assertContext(world, context);
  const packet = assertPacket(input.packet, context);

  const stored = current[context.deviceId];
  const status =
    stored && statusMatches(world.devices[context.deviceId]!, stored) ? stored : undefined;
  const previous = status?.measured;
  // A persisted session identity must not be mistaken for a fresh session. Only the
  // caller's matching RAM proof can continue that session.
  const sameSession =
    previous !== undefined &&
    previous.installationId === context.installationId &&
    previous.authorizationGeneration === context.authorizationGeneration &&
    previous.runId === context.runId &&
    previous.sessionId === context.sessionId;

  if (sameSession && previous) {
    if (previous.acceptedMonoMs === undefined)
      throw new Error("Gaia physical session continuity unavailable");
    if (packet.seq <= previous.seq) throw new Error("Gaia observation sequence did not advance");
    if (packet.sentMonoMs < previous.sentMonoMs)
      throw new Error("Gaia observation send time regressed");
    if (
      context.previousResponseMonoMs !== undefined &&
      previous.acceptedMonoMs !== undefined &&
      context.previousResponseMonoMs < previous.acceptedMonoMs
    )
      throw new Error("Invalid Gaia monotonic context");
  }

  const accepted = new Set(context.accepted);
  const order: Record<string, MeasuredOrder> = {};
  if (sameSession && previous?.order) {
    for (const [capability, entry] of Object.entries(previous.order)) {
      if (accepted.has(capability)) order[capability] = { ...entry };
    }
  }
  if (sameSession && status) {
    for (const [capability, observation] of Object.entries(status.observations)) {
      if (order[capability] || !accepted.has(capability)) continue;
      const entry = orderOf(observation);
      if (entry) order[capability] = entry;
    }
  }

  const observations: Record<string, Observation> = {};
  for (const sample of packet.samples) {
    const capability = sample.id;
    if (sample.quality === "missing") {
      observations[capability] = {
        quality: "missing",
        value: null,
        unit: sample.unit,
        source: "measured",
        receivedAt: context.acceptedAt,
      };
      continue;
    }

    const prior = order[capability];
    if (prior) {
      if (sample.sampleMonoMs < prior.sampleMonoMs)
        throw new Error("Gaia observation sample regressed");
      if (sample.sampleMonoMs === prior.sampleMonoMs) {
        if (
          prior.quality !== sample.quality ||
          prior.unit !== sample.unit ||
          !sameValue(prior.value, sample.value)
        )
          throw new Error("Gaia observation sample conflict");
        observations[capability] = fromOrder(prior);
        continue;
      }
    }

    const age = ageUpper(sample.sampleMonoMs, packet.sentMonoMs, context);
    const at = age === undefined ? undefined : context.acceptedAt - age;
    const observation: Observation = {
      quality: sample.quality,
      value: sample.value,
      unit: sample.unit,
      source: "measured",
      receivedAt: context.acceptedAt,
      sampleMonoMs: sample.sampleMonoMs,
      sentMonoMs: packet.sentMonoMs,
      acceptedMonoMs: context.acceptedMonoMs,
      ...(age === undefined ? {} : { ageUpperMs: age }),
      ...(at === undefined || at <= 0 ? {} : { at }),
    };
    observations[capability] = observation;
    order[capability] = orderOf(observation)!;
  }

  return {
    ...current,
    [context.deviceId]: {
      ...(status ?? identity),
      source: "measured",
      hardwareId: context.hardwareId,
      link: { state: "online", at: context.acceptedAt },
      lastContactAt: context.acceptedAt,
      measured: {
        ...(context.assignmentId === undefined ? {} : { assignmentId: context.assignmentId }),
        installationId: context.installationId,
        authorizationGeneration: context.authorizationGeneration,
        runId: context.runId,
        sessionId: context.sessionId,
        seq: packet.seq,
        sentMonoMs: packet.sentMonoMs,
        deviceWallMs: packet.deviceWallMs,
        acceptedAt: context.acceptedAt,
        acceptedMonoMs: context.acceptedMonoMs,
        ...(Object.keys(order).length ? { order } : {}),
      },
      observations,
    },
  };
}
