import { getActiveFeatureId, loadContext, readLocale } from "../../../shared/host/context-state.js";
import { FATE_KNOTS_FEATURE_ID } from "../../../shared/host/feature-meta.js";
import { FATE_KNOTS_CONTENT_STATE_KEY } from "./constants.js";
import {
  ensureFateKnotsContent,
  maybeMarkSeatLossOrTimeout,
  updateContentSummary,
} from "./session-support.js";
import { loadFateKnotsState, resetFateKnotsState } from "./state.js";

type FateKnotsContextApi = Parameters<typeof ensureFateKnotsContent>[0] &
  Parameters<typeof loadFateKnotsState>[0];
type FateKnotsContextState = ReturnType<typeof loadContext>;
type FateKnotsContextHostState = Parameters<typeof maybeMarkSeatLossOrTimeout>[0];

interface FateKnotsContextSyncOptions {
  context?: FateKnotsContextState;
  previousActiveFeatureId?: string | null;
  activeFeatureId?: string | null;
}

export function syncFromContext(
  api: FateKnotsContextApi,
  options: FateKnotsContextSyncOptions = {}
) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api) as unknown as FateKnotsContextHostState;
  const context = options.context ?? loadContext(api);
  const previousActiveFeatureId = options.previousActiveFeatureId ?? null;
  const activeFeatureId = options.activeFeatureId ?? getActiveFeatureId(context);

  if (
    previousActiveFeatureId === FATE_KNOTS_FEATURE_ID &&
    activeFeatureId !== FATE_KNOTS_FEATURE_ID
  ) {
    resetFateKnotsState(api, "activeFeatureReset");
    return;
  }

  state.locale = readLocale(api);
  maybeMarkSeatLossOrTimeout(state, context, Date.now());
  if (context.slots.us1.remoteUserId) {
    state.transport.remoteUserId = context.slots.us1.remoteUserId;
  }
  updateContentSummary(state, contentRegistry);
  api.setState("xox-context", context);
  api.setState(FATE_KNOTS_CONTENT_STATE_KEY, contentRegistry);
  api.setState("fate-knots-game", state);
}
