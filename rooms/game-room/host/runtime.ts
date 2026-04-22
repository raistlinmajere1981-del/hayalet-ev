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
  type GameRoomHostApi,
} from "../shared/host/activation.js";
import { createGameRoomCommandRegistry } from "../shared/host/command-registry.js";

export { teamTetrisEngine };

type BridgeCommandHandler = (handlerApi: GameRoomHostApi, payload: unknown) => unknown;
type BridgeNoPayloadHandler = (handlerApi: GameRoomHostApi) => unknown;

export default function createGameRoomHostRuntime() {
  return {
    activate(api: GameRoomHostApi) {
      function asCommandHandler(handler: BridgeCommandHandler) {
        return (handlerApi: unknown, payload?: unknown) =>
          handler(handlerApi as GameRoomHostApi, payload ?? {});
      }

      function asNoPayloadHandler(handler: BridgeNoPayloadHandler) {
        return (handlerApi: unknown) => handler(handlerApi as GameRoomHostApi);
      }

      function saveXoxStateCompat(handlerApi: GameRoomHostApi, value: unknown): void {
        void saveState(handlerApi, value as Parameters<typeof saveState>[1]);
      }

      function saveInviteInboxCompat(handlerApi: GameRoomHostApi, payload: unknown[]): void {
        void saveInviteInbox(handlerApi, payload);
      }

      function clearPendingInviteCompat(handlerApi: GameRoomHostApi): void {
        clearPendingInvite(handlerApi);
      }

      function saveTeamTetrisStateCompat(handlerApi: GameRoomHostApi, value: unknown): void {
        saveTeamTetrisState(handlerApi, value as Parameters<typeof saveTeamTetrisState>[1]);
      }

      function resetFateKnotsStateCompat(handlerApi: GameRoomHostApi, phase: string): void {
        void resetFateKnotsState(handlerApi, phase);
      }

      function ensureUs1SyncLoopCompat(handlerApi: GameRoomHostApi): void {
        xoxEnsureUs1SyncLoop(handlerApi as unknown as Parameters<typeof xoxEnsureUs1SyncLoop>[0]);
      }

      function getActiveFeatureIdCompat(context: unknown): string {
        return getActiveFeatureId(context as Parameters<typeof getActiveFeatureId>[0]);
      }

      function pushActiveFeatureStateCompat(handlerApi: GameRoomHostApi): void {
        pushActiveFeatureState(handlerApi);
      }

      function dispatchPendingFateKnotsWorkCompat(handlerApi: GameRoomHostApi): Promise<unknown> {
        return dispatchPendingFateKnotsWork(handlerApi);
      }

      function syncUs1MailboxCompat(handlerApi: GameRoomHostApi, reason: string): Promise<unknown> {
        return xoxSyncUs1Mailbox(
          handlerApi as unknown as Parameters<typeof xoxSyncUs1Mailbox>[0],
          reason
        );
      }

      function syncFromContextCompat(handlerApi: GameRoomHostApi, payload: unknown): void {
        xoxSyncFromContext(handlerApi, payload);
      }

      function clearUs1SyncLoopCompat(handlerApi: GameRoomHostApi): void {
        xoxClearUs1SyncLoop(handlerApi as Parameters<typeof xoxClearUs1SyncLoop>[0]);
      }

      bootstrapGameRoomHostState(api, {
        clearPendingInvite: clearPendingInviteCompat,
        createInitialTeamTetrisState: createInitialTeamTetrisState,
        createInitialXoxState: createInitialState,
        defaultStarter: DEFAULT_STARTER,
        defaultTarget: DEFAULT_TARGET,
        ensureUs1SyncLoop: ensureUs1SyncLoopCompat,
        readLocale: readLocale,
        resetFateKnotsState: resetFateKnotsStateCompat,
        saveContext: saveContext,
        saveInviteInbox: saveInviteInboxCompat,
        saveTeamTetrisState: saveTeamTetrisStateCompat,
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
          handleXoxAcceptInvite: asCommandHandler(
            xoxHandleAcceptInvite as unknown as BridgeCommandHandler
          ),
          handleXoxAiMove: asCommandHandler(xoxHandleAiMove as unknown as BridgeCommandHandler),
          handleXoxRejectInvite: asCommandHandler(
            xoxHandleRejectInvite as unknown as BridgeCommandHandler
          ),
          handleXoxRemoteMove: asCommandHandler(
            xoxHandleRemoteMove as unknown as BridgeCommandHandler
          ),
          handleXoxReset: asNoPayloadHandler(xoxHandleReset as unknown as BridgeNoPayloadHandler),
          handleXoxStart: asCommandHandler(xoxHandleStart as unknown as BridgeCommandHandler),
          handleXoxUserMove: asCommandHandler(xoxHandleUserMove as unknown as BridgeCommandHandler),
          xoxCommandNames: XOX_COMMAND_NAMES,
        }),
        ...createGameRoomHostLifecycle(api, {
          clearUs1SyncLoop: clearUs1SyncLoopCompat,
          dispatchPendingFateKnotsWork: dispatchPendingFateKnotsWorkCompat,
          fateKnotsFeatureId: FATE_KNOTS_FEATURE_ID,
          getActiveFeatureId: getActiveFeatureIdCompat,
          loadContext: loadContext,
          pushActiveFeatureState: pushActiveFeatureStateCompat,
          syncFromContext: syncFromContextCompat,
          syncUs1Mailbox: syncUs1MailboxCompat,
        }),
      };
    },
  };
}
