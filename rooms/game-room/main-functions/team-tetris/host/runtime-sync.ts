import {
  buildTeamTetrisSeatView,
  getTeamTetrisTeamIds,
  TEAM_TETRIS_BOARD_HEIGHT,
  TEAM_TETRIS_BOARD_WIDTH,
  TEAM_TETRIS_SCHEMA_VERSION,
  TEAM_TETRIS_TURN_LOOP,
} from "./engine.js";
import {
  TEAM_TETRIS_STATUS_COPY,
  createInitialTeamTetrisState,
  loadTeamTetrisState,
  saveTeamTetrisState,
} from "./state.js";
import {
  getActiveFeatureId,
  loadContext,
  readLocale,
} from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_FEATURE_ID,
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID,
} from "../../../shared/host/feature-meta.js";
import { translate } from "../../../shared/host/text.js";
import { loadState, pushRoomState } from "../../xox/host/state.js";
import { loadFateKnotsState, pushFateKnotsState } from "../../fate-knots/host/state.js";
import { loadFateKnotsContentRegistry } from "../../fate-knots/host/content-loader.js";

function isTeamTetrisBlocked(state) {
  return state.result === "blocked" || state.blockedReason !== "";
}

function getTeamTetrisReadiness(context) {
  const slots = context && context.slots ? context.slots : {};
  return {
    ai1: !!(slots.ai1 && slots.ai1.ready === true),
    ai2: !!(slots.ai2 && slots.ai2.ready === true),
    us1: !!(slots.us1 && slots.us1.ready === true),
  };
}

function buildEmptyTeamTetrisRows() {
  return Array.from({ length: TEAM_TETRIS_BOARD_HEIGHT }, function () {
    return ".".repeat(TEAM_TETRIS_BOARD_WIDTH);
  });
}

function resolveTeamTetrisStatusText(state, context) {
  if (state.blockedReason) {
    return state.blockedReason;
  }
  if (state.match && state.match.result === "pending" && state.match.currentTurn) {
    return "";
  }
  const readiness = getTeamTetrisReadiness(context);
  const canStart = readiness.ai1 && readiness.ai2 && readiness.us1;
  const statusKey = canStart && state.statusKey === "idle" ? "ready" : state.statusKey;
  return translate(state.locale, TEAM_TETRIS_STATUS_COPY, statusKey);
}

function serializeTeamTetrisState(api, state, context) {
  const readiness = getTeamTetrisReadiness(context);
  const canStart = readiness.ai1 && readiness.ai2 && readiness.us1;
  const savedState = saveTeamTetrisState(api, state);
  const userView = savedState.match ? buildTeamTetrisSeatView(savedState.match, "user") : null;
  const boardSnapshots =
    userView !== null
      ? [
          {
            teamId: userView.ownTeam.teamId,
            visibility: "private",
            rows: userView.ownTeam.boardRows.slice(),
            boardBeforePartnerPieceRows: userView.ownTeam.boardBeforePartnerPieceRows.slice(),
            partnerLastPiece: userView.ownTeam.partnerLastPiece,
          },
          {
            teamId: userView.opponentTeam.teamId,
            visibility: "public",
            rows: userView.opponentTeam.boardRows.slice(),
          },
        ]
      : [
          {
            teamId: "team-a",
            visibility: "private",
            rows: buildEmptyTeamTetrisRows(),
            boardBeforePartnerPieceRows: buildEmptyTeamTetrisRows(),
            partnerLastPiece: null,
          },
          {
            teamId: "team-b",
            visibility: "public",
            rows: buildEmptyTeamTetrisRows(),
          },
        ];
  return {
    roomId: ROOM_ID,
    featureId: TEAM_TETRIS_FEATURE_ID,
    schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
    active:
      savedState.result === "blocked"
        ? false
        : savedState.match
          ? savedState.match.result === "pending"
          : savedState.active,
    result:
      savedState.result === "blocked"
        ? "blocked"
        : savedState.match
          ? savedState.match.result
          : savedState.result,
    hiddenPairs: savedState.hiddenPairs,
    revealPairsOnFinish: savedState.revealPairsOnFinish,
    blockedReason: savedState.blockedReason,
    matchId: savedState.match ? savedState.match.matchId : savedState.matchId,
    localSessionId: savedState.localSessionId,
    remoteUserId: savedState.remoteUserId,
    lastRemoteTransportMessageId: savedState.lastRemoteTransportMessageId,
    lastRemoteTurnIndex: savedState.lastRemoteTurnIndex,
    canStart: canStart,
    requiredSlots: readiness,
    board: {
      width: TEAM_TETRIS_BOARD_WIDTH,
      height: TEAM_TETRIS_BOARD_HEIGHT,
      seedLabel: "contract-frozen",
    },
    boards: boardSnapshots,
    turnLoop: TEAM_TETRIS_TURN_LOOP.slice(),
    currentTurn:
      savedState.match && savedState.match.currentTurn ? { ...savedState.match.currentTurn } : null,
    teams:
      savedState.match &&
      savedState.revealPairsOnFinish === true &&
      savedState.match.revealedPairs === true
        ? getTeamTetrisTeamIds().map(function (teamId) {
            return {
              teamId: teamId,
              seatIds: savedState.match.teams[teamId].seatIds.slice(),
            };
          })
        : null,
    userView: userView,
    status: resolveTeamTetrisStatusText(savedState, context),
  };
}

function pushTeamTetrisState(api, state) {
  const context = loadContext(api);
  api.notifyRoom("team-tetris-state", {
    state: serializeTeamTetrisState(api, state, context),
  });
  return loadTeamTetrisState(api);
}

function blockTeamTetrisMatch(api, state, statusKey, blockedReason) {
  state.active = false;
  state.result = "blocked";
  state.statusKey = statusKey;
  state.blockedReason = blockedReason;
  return pushTeamTetrisState(api, state);
}

function resetTeamTetrisState(api, statusKey) {
  const nextState = createInitialTeamTetrisState(readLocale(api));
  if (
    typeof statusKey === "string" &&
    Object.prototype.hasOwnProperty.call(TEAM_TETRIS_STATUS_COPY, statusKey)
  ) {
    nextState.statusKey = statusKey;
  }
  return saveTeamTetrisState(api, nextState);
}

function pushActiveFeatureState(api) {
  const context = loadContext(api);
  if (getActiveFeatureId(context) === TEAM_TETRIS_FEATURE_ID) {
    return pushTeamTetrisState(api, loadTeamTetrisState(api));
  }
  if (getActiveFeatureId(context) === FATE_KNOTS_FEATURE_ID) {
    return pushFateKnotsState(api, loadFateKnotsState(api), loadFateKnotsContentRegistry());
  }
  return pushRoomState(api, loadState(api));
}

export {
  blockTeamTetrisMatch,
  buildEmptyTeamTetrisRows,
  getTeamTetrisReadiness,
  isTeamTetrisBlocked,
  pushActiveFeatureState,
  pushTeamTetrisState,
  resetTeamTetrisState,
  resolveTeamTetrisStatusText,
  serializeTeamTetrisState,
};
