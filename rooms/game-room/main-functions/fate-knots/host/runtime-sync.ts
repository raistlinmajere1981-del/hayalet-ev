import { FATE_KNOTS_FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { normalizeFateKnotsCanonicalUniversePackage } from "../forge/canonical-universe.js";
import type { FateKnotsForgeHubSnapshot } from "./forge-orchestration.js";
import { buildFateKnotsGameplayState, type FateKnotsGameplayState } from "./gameplay-state.js";
import { buildFateKnotsHubSnapshot } from "./hub-state.js";
import {
  readFateKnotsRunLibrary,
  readFateKnotsSessionState,
  readFateKnotsUniverseLibrary,
  type FateKnotsPersistenceApi,
} from "./persistence.js";

export interface FateKnotsRuntimeSyncApi extends FateKnotsPersistenceApi {
  notifyRoom?(eventType: string, data: unknown): void;
}

function buildSelectedFateKnotsGameplayState(
  api: FateKnotsRuntimeSyncApi
): FateKnotsGameplayState | null {
  const sessionRead = readFateKnotsSessionState(api);
  if (sessionRead.issues.length > 0 || sessionRead.value.activeRunId === null) return null;

  const runRead = readFateKnotsRunLibrary(api);
  if (runRead.issues.length > 0) return null;
  const run = runRead.value.runs.find(
    (entry) => entry.runId === sessionRead.value.activeRunId
  );
  if (!run || run.phase === "run-setup") return null;

  const universeRead = readFateKnotsUniverseLibrary(api);
  if (universeRead.issues.length > 0) return null;
  const storedUniverse = universeRead.value.universes.find(
    (universe) => universe.universeId === run.universeId
  );
  if (!storedUniverse) return null;

  const canonical = normalizeFateKnotsCanonicalUniversePackage(storedUniverse);
  if (!canonical.valid || !canonical.package) return null;

  const projected = buildFateKnotsGameplayState(canonical.package, run);
  return projected.ok ? projected.state : null;
}

/**
 * Compatibility sync entry point used by the Game Room host.
 *
 * The neutral Hub projection is always emitted so management/setup remains
 * available. Once the selected run has left run-setup, a second player-safe
 * gameplay projection is emitted for the future living-book renderer.
 *
 * Raw Universe Packages, Run States, enemy commits and hidden canon never cross
 * this bridge. If persistence/canonical projection is invalid, gameplay sync is
 * skipped rather than falling back to raw state.
 */
export function pushFateKnotsHubState(
  api: FateKnotsRuntimeSyncApi,
  forgeSnapshot?: FateKnotsForgeHubSnapshot
) {
  const hubState = buildFateKnotsHubSnapshot(api, forgeSnapshot);
  api.notifyRoom?.("fate-knots-hub-state", {
    roomId: ROOM_ID,
    featureId: FATE_KNOTS_FEATURE_ID,
    state: hubState,
  });

  const gameplayState = buildSelectedFateKnotsGameplayState(api);
  if (gameplayState !== null) {
    api.notifyRoom?.("fate-knots-gameplay-state", {
      roomId: ROOM_ID,
      featureId: FATE_KNOTS_FEATURE_ID,
      state: gameplayState,
    });
  }

  return hubState;
}
