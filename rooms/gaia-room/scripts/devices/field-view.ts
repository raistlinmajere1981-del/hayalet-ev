import type { DeviceStatus, Observation, Freshness } from "./status.ts";

export interface PhysicalView {
  source: "measured";
  connection: "online" | "offline" | "unknown";
  linkRemainingMs: number;
  lastContactAt?: number;
  observations: Record<
    string,
    Pick<Observation, "quality" | "value" | "unit" | "receivedAt" | "at"> & {
      freshness: Freshness;
      freshRemainingMs: number;
    }
  >;
}

export type SimulatedStatus = DeviceStatus & { source: "simulated" };

export interface GaiaStatusReply {
  physicalError?: "authorization_unavailable";
  revision: number;
  statuses: Record<string, SimulatedStatus>;
  physical: Record<string, PhysicalView>;
}

// Both timestamps belong to the renderer. Charging the whole round trip is conservative even
// when the host dispatch, disk read, structured clone or renderer event loop is delayed.
export function agePhysicalView(view: PhysicalView, elapsedMs: number): PhysicalView {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs >= 0 ? Math.ceil(elapsedMs) : Infinity;
  const linkRemainingMs = Math.max(0, view.linkRemainingMs - elapsed);
  return {
    ...view,
    linkRemainingMs,
    connection: view.connection === "online" && !linkRemainingMs ? "offline" : view.connection,
    observations: Object.fromEntries(
      Object.entries(view.observations).map(([id, observation]) => {
        const freshRemainingMs = linkRemainingMs
          ? Math.max(0, observation.freshRemainingMs - elapsed)
          : 0;
        return [
          id,
          {
            ...observation,
            freshRemainingMs,
            freshness:
              observation.quality === "missing" ? "noData" : freshRemainingMs ? "fresh" : "stale",
          },
        ];
      })
    ),
  };
}
