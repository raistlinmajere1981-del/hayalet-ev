import {
  getActiveFeatureId,
  loadContext,
  readLocale,
  saveContext
} from "../../../shared/host/context-state.js";
import { TEAM_TETRIS_FEATURE_ID } from "../../../shared/host/feature-meta.js";
import {
  blockTeamTetrisMatch,
  pushActiveFeatureState,
  resetTeamTetrisState
} from "../../team-tetris/host/runtime.js";
import { loadTeamTetrisState } from "../../team-tetris/host/state.js";
import { syncFromContext as fateKnotsSyncFromContext } from "../../fate-knots/host/runtime.js";
import { getOpponentInfo, loadState, saveState } from "./state.js";
import { blockMatch, isBlocked } from "./runtime-match.js";
function readTeamTetrisSeatReadiness(context) {
  return {
    ai1: context.slots.ai1.dispatchable === true,
    ai2: context.slots.ai2.dispatchable === true,
    us1: context.slots.us1.dispatchable === true
  };
}
export function syncFromContext(api, payload) {
  const previousContext = loadContext(api);
  const previousActiveFeatureId = getActiveFeatureId(previousContext);
  const context = saveContext(api, payload);
  const activeFeatureId = getActiveFeatureId(context);
  fateKnotsSyncFromContext(api, {
    context,
    previousActiveFeatureId,
    activeFeatureId
  });
  const state = loadState(api);
  const teamTetrisState = loadTeamTetrisState(api);
  if (previousActiveFeatureId === TEAM_TETRIS_FEATURE_ID && activeFeatureId !== TEAM_TETRIS_FEATURE_ID) {
    resetTeamTetrisState(api, "activeFeatureReset");
  }
  state.locale = readLocale(api);
  if (state.active === true && isBlocked(state) !== true) {
    const opponent = getOpponentInfo(context, state);
    const readyForActiveMatch = opponent.dispatchable === true && (state.target !== "us1" || state.remoteUserId === null || opponent.remoteUserId === state.remoteUserId);
    if (readyForActiveMatch !== true) {
      blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
      return;
    }
  }
  saveState(api, state);
  if (teamTetrisState.match && teamTetrisState.result !== "blocked") {
    const readiness = readTeamTetrisSeatReadiness(context);
    if (readiness.ai1 !== true || readiness.ai2 !== true || readiness.us1 !== true) {
      blockTeamTetrisMatch(api, teamTetrisState, "blockedOpponent", "required-seat-unavailable");
      return;
    }
  }
  pushActiveFeatureState(api);
}
