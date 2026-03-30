import type { TeamTetrisStateApi } from "../../team-tetris/host/state.js";
import type { GameRoomContextState } from "../../../shared/types/room-shell-contracts.js";
import {
  getActiveFeatureId,
  loadContext,
  readLocale,
  saveContext,
} from "../../../shared/host/context-state.js";
import { TEAM_TETRIS_FEATURE_ID } from "../../../shared/host/feature-meta.js";
import {
  blockTeamTetrisMatch,
  pushActiveFeatureState,
  resetTeamTetrisState,
} from "../../team-tetris/host/runtime.js";
import { loadTeamTetrisState } from "../../team-tetris/host/state.js";
import { syncFromContext as fateKnotsSyncFromContext } from "../../fate-knots/host/runtime.js";
import { getOpponentInfo, loadState, saveState } from "./state.js";
import { blockMatch, isBlocked } from "./runtime-match.js";

type TeamTetrisSeatReadiness = {
  ai1: boolean;
  ai2: boolean;
  us1: boolean;
};

interface XoxRuntimeSyncApi extends TeamTetrisStateApi {
  notifyRoom?(eventType: string, data: unknown): void;
}

function readTeamTetrisSeatReadiness(context: GameRoomContextState): TeamTetrisSeatReadiness {
  return {
    ai1: context.slots.ai1.ready === true,
    ai2: context.slots.ai2.ready === true,
    us1: context.slots.us1.ready === true,
  };
}

export function syncFromContext(api: XoxRuntimeSyncApi, payload: unknown) {
  const previousContext = loadContext(api);
  const previousActiveFeatureId = getActiveFeatureId(previousContext);
  const context = saveContext(api, payload);
  const activeFeatureId = getActiveFeatureId(context);
  fateKnotsSyncFromContext(api, {
    context,
    previousActiveFeatureId,
    activeFeatureId,
  });

  const state = loadState(api);
  const teamTetrisState = loadTeamTetrisState(api);
  if (
    previousActiveFeatureId === TEAM_TETRIS_FEATURE_ID &&
    activeFeatureId !== TEAM_TETRIS_FEATURE_ID
  ) {
    resetTeamTetrisState(api, "activeFeatureReset");
  }

  state.locale = readLocale(api);
  if (state.active === true && isBlocked(state) !== true) {
    const opponent = getOpponentInfo(context, state);
    const readyForActiveMatch =
      opponent.ready === true &&
      (state.target !== "us1" ||
        state.remoteUserId === null ||
        opponent.remoteUserId === state.remoteUserId);
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
