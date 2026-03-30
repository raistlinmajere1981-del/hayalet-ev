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
  handleDmPacket as fateKnotsHandleDmPacket,
  handleEnd as fateKnotsHandleEnd,
  handleNpcBanter as fateKnotsHandleNpcBanter,
  handleReady as fateKnotsHandleReady,
  handleReset as fateKnotsHandleReset,
  handleSync as fateKnotsHandleSync,
  handleStart as fateKnotsHandleStart,
} from "../main-functions/fate-knots/host/runtime.js";
import { resetFateKnotsState } from "../main-functions/fate-knots/host/state.js";
import { FATE_KNOTS_COMMAND_NAMES } from "../main-functions/fate-knots/host/constants.js";
import {
  bootstrapGameRoomHostState,
  createGameRoomHostLifecycle,
} from "../shared/host/activation.js";
import { createGameRoomCommandRegistry } from "../shared/host/command-registry.js";

export { teamTetrisEngine };

export default function createGameRoomHostRuntime() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Bridge layer: command dispatch passes unknown, handlers expect specific types.
    activate(api: any) {
      function asCommandHandler(handler: (handlerApi: any, payload: any) => unknown) {
        return (handlerApi: unknown, payload?: unknown) =>
          handler(handlerApi as any, payload as any);
      }

      function asNoPayloadHandler(handler: (handlerApi: any) => unknown) {
        return (handlerApi: unknown) => handler(handlerApi as any);
      }

      function saveXoxStateCompat(
        handlerApi: Parameters<typeof saveState>[0],
        value: unknown
      ): void {
        void saveState(handlerApi, value as Parameters<typeof saveState>[1]);
      }

      function getActiveFeatureIdCompat(context: unknown): string {
        return getActiveFeatureId(context as Parameters<typeof getActiveFeatureId>[0]);
      }

      bootstrapGameRoomHostState(api, {
        clearPendingInvite: clearPendingInvite,
        createInitialTeamTetrisState: createInitialTeamTetrisState,
        createInitialXoxState: createInitialState,
        defaultStarter: DEFAULT_STARTER,
        defaultTarget: DEFAULT_TARGET,
        ensureUs1SyncLoop: xoxEnsureUs1SyncLoop,
        readLocale: readLocale,
        resetFateKnotsState: resetFateKnotsState,
        saveContext: saveContext,
        saveInviteInbox: saveInviteInbox,
        saveTeamTetrisState: saveTeamTetrisState,
        saveXoxState: saveXoxStateCompat,
      });

      return {
        commands: createGameRoomCommandRegistry(api, {
          fateKnotsCommandNames: FATE_KNOTS_COMMAND_NAMES,
          handleFateKnotsCharacterSelect: asCommandHandler(fateKnotsHandleCharacterSelect),
          handleFateKnotsChoice: asCommandHandler(fateKnotsHandleChoice),
          handleFateKnotsCombatAction: asCommandHandler(fateKnotsHandleCombatAction),
          handleFateKnotsDmPacket: asCommandHandler(fateKnotsHandleDmPacket),
          handleFateKnotsEnd: asNoPayloadHandler(fateKnotsHandleEnd),
          handleFateKnotsNpcBanter: asCommandHandler(fateKnotsHandleNpcBanter),
          handleFateKnotsReady: asNoPayloadHandler(fateKnotsHandleReady),
          handleFateKnotsReset: asNoPayloadHandler(fateKnotsHandleReset),
          handleFateKnotsStart: asCommandHandler(fateKnotsHandleStart),
          handleFateKnotsSync: asCommandHandler(fateKnotsHandleSync),
          handleTeamTetrisMove: asCommandHandler(handleTeamTetrisMove),
          handleTeamTetrisReset: asNoPayloadHandler(handleTeamTetrisReset),
          handleTeamTetrisStart: asCommandHandler(handleTeamTetrisStart),
          handleXoxAcceptInvite: asCommandHandler(xoxHandleAcceptInvite),
          handleXoxAiMove: asCommandHandler(xoxHandleAiMove),
          handleXoxRejectInvite: asCommandHandler(xoxHandleRejectInvite),
          handleXoxRemoteMove: asCommandHandler(xoxHandleRemoteMove),
          handleXoxReset: asNoPayloadHandler(xoxHandleReset),
          handleXoxStart: asCommandHandler(xoxHandleStart),
          handleXoxUserMove: asCommandHandler(xoxHandleUserMove),
          xoxCommandNames: XOX_COMMAND_NAMES,
        }),
        ...createGameRoomHostLifecycle(api, {
          clearUs1SyncLoop: xoxClearUs1SyncLoop,
          dispatchPendingFateKnotsWork: dispatchPendingFateKnotsWork,
          fateKnotsFeatureId: FATE_KNOTS_FEATURE_ID,
          getActiveFeatureId: getActiveFeatureIdCompat,
          loadContext: loadContext,
          pushActiveFeatureState: pushActiveFeatureState,
          syncFromContext: xoxSyncFromContext,
          syncUs1Mailbox: xoxSyncUs1Mailbox,
        }),
      };
    },
  };
}
