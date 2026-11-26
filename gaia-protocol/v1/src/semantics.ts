import type { Ack, ObservationPacket, SessionOpenResponse } from "./schema.ts";

/**
 * Reference checks for constraints that JSON Schema cannot express:
 * uniqueness by sample id, membership against the accepted set, cross-field
 * time order and ACK/session correlation. B4/B6/B7 must run equivalent
 * checks inside the session and transport boundary; these helpers are not a
 * session state machine.
 */

export function duplicateCapabilities(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates].sort();
}

export function samplesOutsideAccepted(
  packet: ObservationPacket,
  accepted: readonly string[]
): string[] {
  const allowed = new Set(accepted);
  return packet.samples.filter((sample) => !allowed.has(sample.id)).map((sample) => sample.id);
}

export function missingCapabilityIds(
  packet: ObservationPacket,
  accepted: readonly string[]
): string[] {
  const present = new Set<string>(packet.samples.map((sample) => sample.id));
  return accepted.filter((id) => !present.has(id));
}

export function samplesAfterSend(packet: ObservationPacket): string[] {
  return packet.samples
    .filter((sample) => "sampleMonoMs" in sample && sample.sampleMonoMs > packet.sentMonoMs)
    .map((sample) => sample.id);
}

export function ackSessionMismatch(ack: Ack, packet: ObservationPacket): boolean {
  return ack.sessionId !== packet.sessionId;
}

export function ackSeqMismatch(ack: Ack, packet: ObservationPacket): boolean {
  return ack.seq !== packet.seq;
}

export function acceptedNotSubset(
  response: SessionOpenResponse,
  offered: readonly string[]
): string[] {
  const offeredSet = new Set(offered);
  return response.accepted.filter((id) => !offeredSet.has(id));
}

export function t1Accepted(
  offered: readonly string[],
  inventory: readonly string[],
  permission: readonly string[],
  catalog: readonly string[]
): string[] {
  const inventorySet = new Set(inventory);
  const permissionSet = new Set(permission);
  const catalogSet = new Set(catalog);
  return offered.filter(
    (id) => catalogSet.has(id) && inventorySet.has(id) && permissionSet.has(id)
  );
}
