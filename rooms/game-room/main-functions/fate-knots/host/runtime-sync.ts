import { FATE_KNOTS_FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { buildFateKnotsHubSnapshot } from "./hub-state.js";
import type { FateKnotsPersistenceApi } from "./persistence.js";

export interface FateKnotsRuntimeSyncApi extends FateKnotsPersistenceApi {
  notifyRoom?(eventType: string, data: unknown): void;
}

/**
 * Pushes only the player-safe neutral Hub projection. Full canonical universe
 * data stays host-side until a later runtime projection explicitly permits it.
 */
export function pushFateKnotsHubState(api: FateKnotsRuntimeSyncApi) {
  const state = buildFateKnotsHubSnapshot(api);
  api.notifyRoom?.("fate-knots-hub-state", {
    roomId: ROOM_ID,
    featureId: FATE_KNOTS_FEATURE_ID,
    state,
  });
  return state;
}
