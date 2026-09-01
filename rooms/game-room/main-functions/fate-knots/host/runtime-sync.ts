import { FATE_KNOTS_FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import type { FateKnotsForgeHubSnapshot } from "./forge-orchestration.js";
import { buildFateKnotsHubSnapshot } from "./hub-state.js";
import type { FateKnotsPersistenceApi } from "./persistence.js";

export interface FateKnotsRuntimeSyncApi extends FateKnotsPersistenceApi {
  notifyRoom?(eventType: string, data: unknown): void;
}

/**
 * Pushes only the player-safe neutral Hub projection. Full canonical universe
 * data, Forge prompts and Forge candidates stay host-side until a later runtime
 * projection explicitly permits them.
 */
export function pushFateKnotsHubState(
  api: FateKnotsRuntimeSyncApi,
  forgeSnapshot?: FateKnotsForgeHubSnapshot
) {
  const state = buildFateKnotsHubSnapshot(api, forgeSnapshot);
  api.notifyRoom?.("fate-knots-hub-state", {
    roomId: ROOM_ID,
    featureId: FATE_KNOTS_FEATURE_ID,
    state,
  });
  return state;
}
