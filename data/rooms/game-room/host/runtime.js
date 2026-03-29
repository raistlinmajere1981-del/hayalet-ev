import { teamTetrisEngine } from "../main-functions/team-tetris/host/engine.js";
import {
  createInitialTeamTetrisState,
  saveTeamTetrisState
} from "../main-functions/team-tetris/host/state.js";
import {
  DEFAULT_STARTER,
  DEFAULT_TARGET,
  createInitialState,
  saveInviteInbox,
  saveState,
  clearPendingInvite
} from "../main-functions/xox/host/state.js";
import {
  getActiveFeatureId,
  loadContext,
  readLocale,
  saveContext
} from "../shared/host/context-state.js";
import { FATE_KNOTS_FEATURE_ID } from "../shared/host/feature-meta.js";
import {
  handleTeamTetrisMove,
  handleTeamTetrisReset,
  handleTeamTetrisStart,
  pushActiveFeatureState
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
  syncUs1Mailbox as xoxSyncUs1Mailbox
} from "../main-functions/xox/host/runtime.js";
import {
  dispatchPendingWork as dispatchPendingFateKnotsWork,
  handleCharacterSelect as fateKnotsHandleCharacterSelect,
  handleChoice as fateKnotsHandleChoice,
  handleCombatAction as fateKnotsHandleCombatAction,
  handleDmPacket as fateKnotsHandleDmPacket,
  handleEnd as fateKnotsHandleEnd,
  handleNpcBanter as fateKnotsHandleNpcBanter,
  handleReady as fateKnotsHandleReady,
  handleReset as fateKnotsHandleReset,
  handleSync as fateKnotsHandleSync,
  handleStart as fateKnotsHandleStart
} from "../main-functions/fate-knots/host/runtime.js";
import { resetFateKnotsState } from "../main-functions/fate-knots/host/state.js";
import { FATE_KNOTS_COMMAND_NAMES } from "../main-functions/fate-knots/host/constants.js";
import { bootstrapGameRoomHostState, createGameRoomHostLifecycle } from "../shared/host/activation.js";
import { createGameRoomCommandRegistry } from "../shared/host/command-registry.js";
export { teamTetrisEngine };
export default function createGameRoomHostRuntime() {
  return {
    activate(api) {
      bootstrapGameRoomHostState(api, {
        clearPendingInvite,
        createInitialTeamTetrisState,
        createInitialXoxState: createInitialState,
        defaultStarter: DEFAULT_STARTER,
        defaultTarget: DEFAULT_TARGET,
        ensureUs1SyncLoop: xoxEnsureUs1SyncLoop,
        readLocale,
        resetFateKnotsState,
        saveContext,
        saveInviteInbox,
        saveTeamTetrisState,
        saveXoxState: saveState
      });
      return {
        commands: createGameRoomCommandRegistry(api, {
          fateKnotsCommandNames: FATE_KNOTS_COMMAND_NAMES,
          handleFateKnotsCharacterSelect: fateKnotsHandleCharacterSelect,
          handleFateKnotsChoice: fateKnotsHandleChoice,
          handleFateKnotsCombatAction: fateKnotsHandleCombatAction,
          handleFateKnotsDmPacket: fateKnotsHandleDmPacket,
          handleFateKnotsEnd: fateKnotsHandleEnd,
          handleFateKnotsNpcBanter: fateKnotsHandleNpcBanter,
          handleFateKnotsReady: fateKnotsHandleReady,
          handleFateKnotsReset: fateKnotsHandleReset,
          handleFateKnotsStart: fateKnotsHandleStart,
          handleFateKnotsSync: fateKnotsHandleSync,
          handleTeamTetrisMove,
          handleTeamTetrisReset,
          handleTeamTetrisStart,
          handleXoxAcceptInvite: xoxHandleAcceptInvite,
          handleXoxAiMove: xoxHandleAiMove,
          handleXoxRejectInvite: xoxHandleRejectInvite,
          handleXoxRemoteMove: xoxHandleRemoteMove,
          handleXoxReset: xoxHandleReset,
          handleXoxStart: xoxHandleStart,
          handleXoxUserMove: xoxHandleUserMove,
          xoxCommandNames: XOX_COMMAND_NAMES
        }),
        ...createGameRoomHostLifecycle(api, {
          clearUs1SyncLoop: xoxClearUs1SyncLoop,
          dispatchPendingFateKnotsWork,
          fateKnotsFeatureId: FATE_KNOTS_FEATURE_ID,
          getActiveFeatureId,
          loadContext,
          pushActiveFeatureState,
          syncFromContext: xoxSyncFromContext,
          syncUs1Mailbox: xoxSyncUs1Mailbox
        })
      };
    }
  };
}
