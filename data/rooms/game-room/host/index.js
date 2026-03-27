import { teamTetrisEngine } from "../main-functions/team-tetris/host/engine.js";
import {
  createInitialTeamTetrisState,
  saveTeamTetrisState,
} from "../main-functions/team-tetris/host/state.js";
import {
  DEFAULT_STARTER,
  DEFAULT_TARGET,
  createInitialState,
  saveInviteInbox,
  saveState,
  clearPendingInvite,
} from "../main-functions/xox/host/state.js";
import {
  getActiveFeatureId,
  loadContext,
  readLocale,
  saveContext,
} from "../shared/host/context-state.js";
import { FATE_KNOTS_FEATURE_ID } from "../shared/host/feature-meta.js";
import {
  handleTeamTetrisMove,
  handleTeamTetrisReset,
  handleTeamTetrisStart,
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
import {
  dispatchPendingWork as dispatchPendingFateKnotsWork,
  handleCharacterSelect as fateKnotsHandleCharacterSelect,
  handleChoice as fateKnotsHandleChoice,
  handleCombatAction as fateKnotsHandleCombatAction,
  handleEnd as fateKnotsHandleEnd,
  handleReady as fateKnotsHandleReady,
  handleReset as fateKnotsHandleReset,
  handleSync as fateKnotsHandleSync,
  handleStart as fateKnotsHandleStart,
} from "../main-functions/fate-knots/host/runtime.js";
import { resetFateKnotsState } from "../main-functions/fate-knots/host/state.js";
import { FATE_KNOTS_COMMAND_NAMES } from "../main-functions/fate-knots/host/constants.js";

const gameRoomHost = {
  activate: function activate(api) {
    api.log("info", "Game Room host activated.");
    saveContext(api, {});
    saveInviteInbox(api, []);
    clearPendingInvite(api);
    saveState(api, createInitialState(readLocale(api), DEFAULT_TARGET, DEFAULT_STARTER));
    saveTeamTetrisState(api, createInitialTeamTetrisState(readLocale(api)));
    resetFateKnotsState(api, "idle");
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
        [FATE_KNOTS_COMMAND_NAMES.start]: function (payload) {
          return fateKnotsHandleStart(api, payload || {});
        },
        [FATE_KNOTS_COMMAND_NAMES.reset]: function () {
          return fateKnotsHandleReset(api);
        },
        [FATE_KNOTS_COMMAND_NAMES.ready]: function () {
          return fateKnotsHandleReady(api);
        },
        [FATE_KNOTS_COMMAND_NAMES.characterSelect]: function (payload) {
          return fateKnotsHandleCharacterSelect(api, payload || {});
        },
        [FATE_KNOTS_COMMAND_NAMES.choice]: function (payload) {
          return fateKnotsHandleChoice(api, payload || {});
        },
        [FATE_KNOTS_COMMAND_NAMES.combatAction]: function (payload) {
          return fateKnotsHandleCombatAction(api, payload || {});
        },
        [FATE_KNOTS_COMMAND_NAMES.sync]: function (payload) {
          return fateKnotsHandleSync(api, payload || {});
        },
        [FATE_KNOTS_COMMAND_NAMES.end]: function () {
          return fateKnotsHandleEnd(api);
        },
        [FATE_KNOTS_COMMAND_NAMES.aiChoice]: function (payload) {
          return fateKnotsHandleChoice(api, payload || {});
        },
        [FATE_KNOTS_COMMAND_NAMES.aiCombatAction]: function (payload) {
          return fateKnotsHandleCombatAction(api, payload || {});
        },
        [FATE_KNOTS_COMMAND_NAMES.remoteChoice]: function (payload) {
          return fateKnotsHandleChoice(api, payload || {});
        },
        [FATE_KNOTS_COMMAND_NAMES.remoteCombatAction]: function (payload) {
          return fateKnotsHandleCombatAction(api, payload || {});
        },
      },
      onRoomReady: function onRoomReady() {
        pushActiveFeatureState(api);
        if (getActiveFeatureId(loadContext(api)) === FATE_KNOTS_FEATURE_ID) {
          void dispatchPendingFateKnotsWork(api);
        }
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
        api.log("info", "Game Room host disposed.");
      },
    };
  },
};

export { teamTetrisEngine };
export default gameRoomHost;
