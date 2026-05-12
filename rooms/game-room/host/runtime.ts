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
} from "../main-functions/backgammon/host/state.js";
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
  clearUs1SyncLoop as backgammonClearUs1SyncLoop,
  ensureUs1SyncLoop as backgammonEnsureUs1SyncLoop,
  BACKGAMMON_COMMAND_NAMES,
  handleAcceptInvite as backgammonHandleAcceptInvite,
  handleAiMove as backgammonHandleAiMove,
  handleRejectInvite as backgammonHandleRejectInvite,
  handleRemoteMove as backgammonHandleRemoteMove,
  handleReset as backgammonHandleReset,
  handleStart as backgammonHandleStart,
  handleUserMove as backgammonHandleUserMove,
  syncFromContext as backgammonSyncFromContext,
  syncUs1Mailbox as backgammonSyncUs1Mailbox,
} from "../main-functions/backgammon/host/runtime.js";
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

      function saveBackgammonStateCompat(handlerApi: GameRoomHostApi, value: unknown): void {
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
        backgammonEnsureUs1SyncLoop(
          handlerApi as unknown as Parameters<typeof backgammonEnsureUs1SyncLoop>[0]
        );
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
        return backgammonSyncUs1Mailbox(
          handlerApi as unknown as Parameters<typeof backgammonSyncUs1Mailbox>[0],
          reason
        );
      }

      function syncFromContextCompat(handlerApi: GameRoomHostApi, payload: unknown): void {
        backgammonSyncFromContext(handlerApi, payload);
      }

      function clearUs1SyncLoopCompat(handlerApi: GameRoomHostApi): void {
        backgammonClearUs1SyncLoop(handlerApi as Parameters<typeof backgammonClearUs1SyncLoop>[0]);
      }

      bootstrapGameRoomHostState(api, {
        clearPendingInvite: clearPendingInviteCompat,
        createInitialTeamTetrisState: createInitialTeamTetrisState,
        createInitialBackgammonState: createInitialState,
        defaultStarter: DEFAULT_STARTER,
        defaultTarget: DEFAULT_TARGET,
        ensureUs1SyncLoop: ensureUs1SyncLoopCompat,
        readLocale: readLocale,
        resetFateKnotsState: resetFateKnotsStateCompat,
        saveContext: saveContext,
        saveInviteInbox: saveInviteInboxCompat,
        saveTeamTetrisState: saveTeamTetrisStateCompat,
        saveBackgammonState: saveBackgammonStateCompat,
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
          handleBackgammonAcceptInvite: asCommandHandler(
            backgammonHandleAcceptInvite as unknown as BridgeCommandHandler
          ),
          handleBackgammonAiMove: asCommandHandler(
            backgammonHandleAiMove as unknown as BridgeCommandHandler
          ),
          handleBackgammonRejectInvite: asCommandHandler(
            backgammonHandleRejectInvite as unknown as BridgeCommandHandler
          ),
          handleBackgammonRemoteMove: asCommandHandler(
            backgammonHandleRemoteMove as unknown as BridgeCommandHandler
          ),
          handleBackgammonReset: asNoPayloadHandler(
            backgammonHandleReset as unknown as BridgeNoPayloadHandler
          ),
          handleBackgammonStart: asCommandHandler(
            backgammonHandleStart as unknown as BridgeCommandHandler
          ),
          handleBackgammonUserMove: asCommandHandler(
            backgammonHandleUserMove as unknown as BridgeCommandHandler
          ),
          backgammonCommandNames: BACKGAMMON_COMMAND_NAMES,
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
