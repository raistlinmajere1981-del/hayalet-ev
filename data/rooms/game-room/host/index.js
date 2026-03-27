import {
  TEAM_TETRIS_BOARD_HEIGHT,
  TEAM_TETRIS_BOARD_WIDTH,
  TEAM_TETRIS_MOVE_SCHEMA,
  TEAM_TETRIS_PIECE_IDS,
  TEAM_TETRIS_SCHEMA_VERSION,
  TEAM_TETRIS_SEAT_IDS,
  TEAM_TETRIS_TURN_LOOP,
  applyTeamTetrisMove,
  buildTeamTetrisBoardHash,
  buildTeamTetrisSeatView,
  buildTeamTetrisTurnToken,
  cloneTeamTetrisMatch,
  createTeamTetrisMatch,
  getTeamTetrisLegalRotations,
  getTeamTetrisSpawnPosition,
  getTeamTetrisTeamIds,
  replayTeamTetrisPath,
  teamTetrisBoardToRows,
  teamTetrisEngine,
  validateTeamTetrisMove,
} from "../main-functions/team-tetris/host/engine.js";
import {
  TEAM_TETRIS_COMMAND_COPY,
  TEAM_TETRIS_STATUS_COPY,
  createInitialTeamTetrisState,
  loadTeamTetrisState,
  saveTeamTetrisState,
} from "../main-functions/team-tetris/host/state.js";
import {
  COMMAND_COPY,
  DEFAULT_STARTER,
  DEFAULT_TARGET,
  STATUS_COPY,
  US1_SYNC_INTERVAL_MS,
  buildBoardAscii,
  buildBoardStateHash,
  createInitialState,
  createPendingInvite,
  getAvailableCells,
  getOpponentInfo,
  getOutcomeForBoard,
  loadInviteInbox,
  loadPendingInvite,
  loadState,
  normalizeInviteInbox,
  pushRoomState,
  refreshRoomState,
  resolveStatusText,
  saveInviteInbox,
  savePendingInvite,
  saveState,
  clearPendingInvite,
  sanitizeStarter,
  sanitizeTarget,
} from "../main-functions/xox/host/state.js";
import {
  readArgs,
  readBoardHashBeforeMove,
  readCell,
  readInviteId,
  readInviteNote,
  readRemoteUserId,
  readTransportMessageId,
  readTurnIndex,
  normalizeTeamTetrisMoveArgs,
} from "../shared/host/command-args.js";
import {
  createSlotState,
  getActiveFeatureId,
  loadContext,
  readLocale,
  saveContext,
} from "../shared/host/context-state.js";
import {
  FEATURE_ID,
  PAGE_ID,
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID,
  TEAM_TETRIS_PAGE_ID,
} from "../shared/host/feature-meta.js";
import { fillTemplate, normalizeText, translate } from "../shared/host/text.js";
import {
  blockTeamTetrisMatch,
  dispatchNextTeamTetrisTurn,
  handleTeamTetrisMove,
  handleTeamTetrisReset,
  handleTeamTetrisStart,
  getTeamTetrisReadiness,
  pushActiveFeatureState,
} from "../main-functions/team-tetris/host/runtime.js";
import {
  clearUs1SyncLoop as xoxClearUs1SyncLoop,
  ensureUs1SyncLoop as xoxEnsureUs1SyncLoop,
  XOX_COMMAND_NAMES,
  handleAcceptInvite as xoxHandleAcceptInvite,
  handleAiMove as xoxHandleAiMove,
  handleRejectInvite as xoxHandleRejectInvite,
  handleRemoteMove as xoxHandleRemoteMove,
  handleReset as xoxHandleReset,
  handleStart as xoxHandleStart,
  handleUserMove as xoxHandleUserMove,
  syncFromContext as xoxSyncFromContext,
  syncUs1Mailbox as xoxSyncUs1Mailbox,
} from "../main-functions/xox/host/runtime.js";

const gameRoomHost = {
  activate: function activate(api) {
    api.log("info", "Game Room XOX host activated.");
    saveContext(api, {});
    saveInviteInbox(api, []);
    clearPendingInvite(api);
    saveState(api, createInitialState(readLocale(api), DEFAULT_TARGET, DEFAULT_STARTER));
    saveTeamTetrisState(api, createInitialTeamTetrisState(readLocale(api)));
    xoxEnsureUs1SyncLoop(api);

    return {
      commands: {
        [XOX_COMMAND_NAMES.start]: function (payload) {
          return xoxHandleStart(api, payload || {});
        },
        [XOX_COMMAND_NAMES.reset]: function () {
          return xoxHandleReset(api);
        },
        [XOX_COMMAND_NAMES.userMove]: function (payload) {
          return xoxHandleUserMove(api, payload || {});
        },
        [XOX_COMMAND_NAMES.aiMove]: function (payload) {
          return xoxHandleAiMove(api, payload || {});
        },
        [XOX_COMMAND_NAMES.remoteMove]: function (payload) {
          return xoxHandleRemoteMove(api, payload || {});
        },
        [XOX_COMMAND_NAMES.acceptInvite]: function (payload) {
          return xoxHandleAcceptInvite(api, payload || {});
        },
        [XOX_COMMAND_NAMES.rejectInvite]: function (payload) {
          return xoxHandleRejectInvite(api, payload || {});
        },
        GameRoomTeamTetrisStart: function (payload) {
          return handleTeamTetrisStart(api, payload || {});
        },
        GameRoomTeamTetrisReset: function () {
          return handleTeamTetrisReset(api);
        },
        GameRoomTeamTetrisUserMove: function (payload) {
          return handleTeamTetrisMove(api, payload || {});
        },
        GameRoomTeamTetrisAiMove: function (payload) {
          return handleTeamTetrisMove(api, payload || {});
        },
        GameRoomTeamTetrisRemoteMove: function (payload) {
          return handleTeamTetrisMove(api, payload || {});
        },
      },
      onRoomReady: function onRoomReady() {
        pushActiveFeatureState(api);
        void xoxSyncUs1Mailbox(api, "room-ready");
      },
      onRoomEvent: function onRoomEvent(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return;
        }

        if (payload.type === "host-context") {
          xoxSyncFromContext(api, payload);
          void xoxSyncUs1Mailbox(api, "context");
        }
      },
      dispose: function dispose() {
        xoxClearUs1SyncLoop(api);
        api.log("info", "Game Room XOX host disposed.");
      },
    };
  },
};

export { teamTetrisEngine };
export default gameRoomHost;
