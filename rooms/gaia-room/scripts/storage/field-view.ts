import type { PhysicalView, GaiaStatusReply, SimulatedStatus } from "../devices/field-view.ts";
import { measuredFreshRemainingMs, type DeviceStatuses } from "../devices/status.ts";
import { FieldAuthorizationDenied, verifyActiveAssignment } from "../field/enrollment.ts";
import type { SessionManager } from "../field/session.ts";
import type { World } from "../spatial/world.ts";
import { readAuthorizationStore } from "./enrollment-store.ts";
import { deviceStatusIdentity, matchesLiveProof } from "./status-store.ts";

export type ReadLive = SessionManager["liveReading"];

// Called inside the project writer lock, shared by B7 publication, inventory and revocation.
export async function projectStatusView(
  root: string,
  world: World,
  epoch: number,
  rows: DeviceStatuses,
  readLive?: ReadLive
): Promise<GaiaStatusReply> {
  const statuses = Object.fromEntries(
    Object.entries(rows).filter(
      (entry): entry is [string, SimulatedStatus] => entry[1].source === "simulated"
    )
  );
  const physical: Record<string, PhysicalView> = {};
  const result = { revision: world.revision, statuses, physical };
  const measured = Object.entries(rows).filter(
    ([, row]) => row.source === "measured" && row.measured
  );
  if (!measured.length) return result;
  const store = await readAuthorizationStore(root).catch(() => undefined);
  if (!store) return { ...result, physicalError: "authorization_unavailable" };
  const { assignments } = store;
  const identity = deviceStatusIdentity(world, epoch);
  for (const [deviceId, row] of measured) {
    const context = row.measured;
    if (!context) continue;
    // Older B7 rows predate the assignment UUID. A fresh lineage can reuse generation one,
    // so the historical tuple must resolve uniquely even when revoked grants are included.
    const matches = assignments.filter(
      (a) =>
        a.projectId === world.id &&
        a.deviceId === deviceId &&
        a.installationId === context.installationId &&
        a.hardwareId === row.hardwareId &&
        a.authorizationGeneration === context.authorizationGeneration &&
        (context.assignmentId === undefined || a.id === context.assignmentId)
    );
    const grant = matches[0];
    if (matches.length !== 1 || !grant) continue;
    try {
      verifyActiveAssignment(world, epoch, grant);
    } catch (error) {
      if (error instanceof FieldAuthorizationDenied) continue;
      throw error;
    }
    const candidate = readLive?.(grant.fingerprint, context.sessionId);
    const live =
      candidate && matchesLiveProof(identity, row, candidate.proof) ? candidate : undefined;
    const linkRemainingMs = live?.linkRemainingMs ?? 0;
    const view: PhysicalView = {
      source: "measured",
      connection: live
        ? linkRemainingMs > 0
          ? "online"
          : "offline"
        : row.link?.state === "offline"
          ? "offline"
          : "unknown",
      linkRemainingMs,
      ...(row.lastContactAt === undefined ? {} : { lastContactAt: row.lastContactAt }),
      observations: {},
    };
    for (const [id, sample] of Object.entries(row.observations)) {
      if (!grant.capabilities.includes(id)) continue;
      const evidence = live?.proof.status.observations[id];
      const freshRemainingMs =
        live && linkRemainingMs > 0
          ? measuredFreshRemainingMs(live.proof.status, evidence, live.now)
          : 0;
      view.observations[id] = {
        quality: sample.quality,
        value: sample.value,
        unit: sample.unit,
        receivedAt: sample.receivedAt,
        ...(sample.at === undefined ? {} : { at: sample.at }),
        freshRemainingMs,
        freshness: sample.quality === "missing" ? "noData" : freshRemainingMs ? "fresh" : "stale",
      };
    }
    physical[deviceId] = view;
  }
  return result;
}
