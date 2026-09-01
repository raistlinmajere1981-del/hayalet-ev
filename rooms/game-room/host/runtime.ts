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
import {
  FATE_KNOTS_FEATURE_ID,
  YAHTZEE_FEATURE_ID,
} from "../shared/host/feature-meta.js";
import {
  handleTeamTetrisMove,
  handleTeamTetrisReset,
  handleTeamTetrisStart,
  pushActiveFeatureState,
} from "../main-functions/team-tetris/host/runtime.js";
import {
  YAHTZEE_COMMAND_NAMES,
  handleYahtzeeAiAction,
  handleYahtzeeRemoteReset,
  handleYahtzeeRemoteStart,
  handleYahtzeeRemoteSync,
  handleYahtzeeReset,
  handleYahtzeeRoll,
  handleYahtzeeScore,
  handleYahtzeeStart,
  handleYahtzeeToggleHold,
  initializeYahtzeeState,
  pushYahtzeeState,
} from "../main-functions/yahtzee/host/runtime.js";
import {
  FATE_KNOTS_COMMAND_NAMES,
  handleFateKnotsActivateRun,
  handleFateKnotsActivateUniverse,
  handleFateKnotsDeleteRun,
  handleFateKnotsDeleteUniverse,
  handleFateKnotsRefresh,
  handleFateKnotsSaveRun,
  handleFateKnotsSaveUniverse,
  initializeFateKnotsState,
  pushFateKnotsState,
} from "../main-functions/fate-knots/host/runtime.js";
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

      function ensureUs1SyncLoopCompat(handlerApi: GameRoomHostApi): void {
        backgammonEnsureUs1SyncLoop(
          handlerApi as unknown as Parameters<typeof backgammonEnsureUs1SyncLoop>[0]
        );
      }

      function pushActiveFeatureStateCompat(handlerApi: GameRoomHostApi): void {
        const context = loadContext(handlerApi);
        const activeFeatureId = getActiveFeatureId(context);
        if (activeFeatureId === FATE_KNOTS_FEATURE_ID) {
          pushFateKnotsState(handlerApi);
          return;
        }
        if (activeFeatureId === YAHTZEE_FEATURE_ID) {
          pushYahtzeeState(handlerApi);
          return;
        }
        pushActiveFeatureState(handlerApi);
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
        saveContext: saveContext,
        saveInviteInbox: saveInviteInboxCompat,
        saveTeamTetrisState: saveTeamTetrisStateCompat,
        saveBackgammonState: saveBackgammonStateCompat,
      });
      initializeYahtzeeState(api);
      initializeFateKnotsState(api);

      const commands = createGameRoomCommandRegistry(api, {
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
      });

      commands[YAHTZEE_COMMAND_NAMES.start] = function (payload?: unknown) {
        return handleYahtzeeStart(api, payload ?? {});
      };
      commands[YAHTZEE_COMMAND_NAMES.reset] = function () {
        return handleYahtzeeReset(api);
      };
      commands[YAHTZEE_COMMAND_NAMES.roll] = function () {
        return handleYahtzeeRoll(api);
      };
      commands[YAHTZEE_COMMAND_NAMES.toggleHold] = function (payload?: unknown) {
        return handleYahtzeeToggleHold(api, payload ?? {});
      };
      commands[YAHTZEE_COMMAND_NAMES.score] = function (payload?: unknown) {
        return handleYahtzeeScore(api, payload ?? {});
      };
      commands[YAHTZEE_COMMAND_NAMES.aiAction] = function (payload?: unknown) {
        return handleYahtzeeAiAction(api, payload ?? {});
      };
      commands[YAHTZEE_COMMAND_NAMES.remoteStart] = function (payload?: unknown) {
        return handleYahtzeeRemoteStart(api, payload ?? {});
      };
      commands[YAHTZEE_COMMAND_NAMES.remoteSync] = function (payload?: unknown) {
        return handleYahtzeeRemoteSync(api, payload ?? {});
      };
      commands[YAHTZEE_COMMAND_NAMES.remoteReset] = function (payload?: unknown) {
        return handleYahtzeeRemoteReset(api, payload ?? {});
      };

      commands[FATE_KNOTS_COMMAND_NAMES.refresh] = function () {
        return handleFateKnotsRefresh(api);
      };
      commands[FATE_KNOTS_COMMAND_NAMES.saveUniverse] = function (payload?: unknown) {
        return handleFateKnotsSaveUniverse(api, payload ?? {});
      };
      commands[FATE_KNOTS_COMMAND_NAMES.activateUniverse] = function (payload?: unknown) {
        return handleFateKnotsActivateUniverse(api, payload ?? {});
      };
      commands[FATE_KNOTS_COMMAND_NAMES.deleteUniverse] = function (payload?: unknown) {
        return handleFateKnotsDeleteUniverse(api, payload ?? {});
      };
      commands[FATE_KNOTS_COMMAND_NAMES.saveRun] = function (payload?: unknown) {
        return handleFateKnotsSaveRun(api, payload ?? {});
      };
      commands[FATE_KNOTS_COMMAND_NAMES.activateRun] = function (payload?: unknown) {
        return handleFateKnotsActivateRun(api, payload ?? {});
      };
      commands[FATE_KNOTS_COMMAND_NAMES.deleteRun] = function (payload?: unknown) {
        return handleFateKnotsDeleteRun(api, payload ?? {});
      };

      return {
        commands,
        ...createGameRoomHostLifecycle(api, {
          clearUs1SyncLoop: clearUs1SyncLoopCompat,
          pushActiveFeatureState: pushActiveFeatureStateCompat,
          syncFromContext: syncFromContextCompat,
          syncUs1Mailbox: syncUs1MailboxCompat,
        }),
      };
    },
  };
}
