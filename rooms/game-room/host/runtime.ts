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
  FEATURE_ID,
  GAME_ROOM_HOME_FEATURE_ID,
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
  FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES,
  createFateKnotsCombatDiscussionCommands,
} from "../main-functions/fate-knots/host/combat-discussion-runtime.js";
import {
  FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES,
  createFateKnotsCombatOptionCommands,
} from "../main-functions/fate-knots/host/combat-options-runtime.js";
import {
  FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES,
  createFateKnotsCombatTurnCommands,
} from "../main-functions/fate-knots/host/combat-turn-runtime.js";
import { createFateKnotsForgeOrchestrator } from "../main-functions/fate-knots/host/forge-orchestration.js";
import {
  FATE_KNOTS_GAMEPLAY_COMMAND_NAMES,
  createFateKnotsGameplayCommands,
} from "../main-functions/fate-knots/host/gameplay-runtime.js";
import {
  FATE_KNOTS_MANAGEMENT_COMMAND_NAMES,
  createFateKnotsManagementCommands,
} from "../main-functions/fate-knots/host/management-runtime.js";
import {
  FATE_KNOTS_RUN_COMMAND_NAMES,
  createFateKnotsRunCommands,
  type FateKnotsRunCommandDependencies,
} from "../main-functions/fate-knots/host/run-runtime.js";
import { createFateKnotsRunSetupCommands } from "../main-functions/fate-knots/host/run-setup-runtime.js";
import { pushFateKnotsHubState } from "../main-functions/fate-knots/host/runtime-sync.js";
import {
  hydrateFateKnotsDurablePersistence,
  persistFateKnotsCommandMutation,
} from "../main-functions/fate-knots/host/durable-persistence.js";
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
type FateKnotsPlayerSeatId = Parameters<
  NonNullable<FateKnotsRunCommandDependencies["isPlayerSeatAvailable"]>
>[0];
type FateKnotsNotifyApi = GameRoomHostApi & {
  notifyRoom?: (eventType: string, data: unknown) => void;
};

const FATE_KNOTS_MUTATION_COMMANDS = new Set<string>([
  FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.activateUniverse,
  FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.activateRun,
  FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.deleteRun,
  FATE_KNOTS_MANAGEMENT_COMMAND_NAMES.deleteUniverse,
  FATE_KNOTS_RUN_COMMAND_NAMES.createRun,
  FATE_KNOTS_RUN_COMMAND_NAMES.startRun,
]);

function readRegisteredRoomArgs(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  return "roomArgs" in record ? record["roomArgs"] : {};
}

export default function createGameRoomHostRuntime() {
  return {
    activate(api: GameRoomHostApi) {
      let fateKnotsHydration: ReturnType<typeof hydrateFateKnotsDurablePersistence> | null = null;
      const fateKnotsForge = createFateKnotsForgeOrchestrator(api);

      function asCommandHandler(handler: BridgeCommandHandler) {
        return (handlerApi: unknown, payload?: unknown) =>
          handler(handlerApi as GameRoomHostApi, payload ?? {});
      }

      function asNoPayloadHandler(handler: BridgeNoPayloadHandler) {
        return (handlerApi: unknown) => handler(handlerApi as GameRoomHostApi);
      }

      async function withFateKnotsReady<T>(operation: () => T | Promise<T>): Promise<T> {
        if (fateKnotsHydration) await fateKnotsHydration;
        return await operation();
      }

      function isBackgammonActive(handlerApi: GameRoomHostApi): boolean {
        return getActiveFeatureId(loadContext(handlerApi)) === FEATURE_ID;
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
        if (!isBackgammonActive(handlerApi)) {
          backgammonClearUs1SyncLoop(
            handlerApi as Parameters<typeof backgammonClearUs1SyncLoop>[0]
          );
          return;
        }
        backgammonEnsureUs1SyncLoop(
          handlerApi as unknown as Parameters<typeof backgammonEnsureUs1SyncLoop>[0]
        );
      }

      function pushFateKnotsHubStateCompat(handlerApi: GameRoomHostApi): void {
        pushFateKnotsHubState(handlerApi, fateKnotsForge.getHubSnapshot());
      }

      function pushFateKnotsHubStateWhenReady(handlerApi: GameRoomHostApi): void {
        const hydration = fateKnotsHydration;
        if (!hydration) {
          pushFateKnotsHubStateCompat(handlerApi);
          return;
        }
        void hydration
          .then(() => {
            if (getActiveFeatureId(loadContext(handlerApi)) === FATE_KNOTS_FEATURE_ID) {
              pushFateKnotsHubStateCompat(handlerApi);
            }
          })
          .catch((error: unknown) => {
            handlerApi.log(
              "warn",
              `Fate Knots state hydration failed before Hub projection: ${error instanceof Error ? error.message : String(error)}`
            );
          });
      }

      function isFateKnotsPlayerSeatAvailable(seatId: FateKnotsPlayerSeatId): boolean {
        if (seatId === "user") return true;
        const context = loadContext(api);
        return seatId === "ai2"
          ? context.slots.ai2.dispatchable === true
          : context.slots.us1.dispatchable === true;
      }

      function pushActiveFeatureStateCompat(handlerApi: GameRoomHostApi): void {
        const context = loadContext(handlerApi);
        const activeFeatureId = getActiveFeatureId(context);
        if (activeFeatureId === GAME_ROOM_HOME_FEATURE_ID) {
          return;
        }
        if (activeFeatureId === YAHTZEE_FEATURE_ID) {
          pushYahtzeeState(handlerApi);
          return;
        }
        if (activeFeatureId === FATE_KNOTS_FEATURE_ID) {
          pushFateKnotsHubStateWhenReady(handlerApi);
          return;
        }
        pushActiveFeatureState(handlerApi);
      }

      function syncUs1MailboxCompat(handlerApi: GameRoomHostApi, reason: string): Promise<unknown> {
        if (!isBackgammonActive(handlerApi)) {
          backgammonClearUs1SyncLoop(
            handlerApi as Parameters<typeof backgammonClearUs1SyncLoop>[0]
          );
          return Promise.resolve(null);
        }
        return backgammonSyncUs1Mailbox(
          handlerApi as unknown as Parameters<typeof backgammonSyncUs1Mailbox>[0],
          reason
        );
      }

      function syncFromContextCompat(handlerApi: GameRoomHostApi, payload: unknown): void {
        backgammonSyncFromContext(handlerApi, payload);
        const activeFeatureId = getActiveFeatureId(loadContext(handlerApi));
        if (activeFeatureId === FATE_KNOTS_FEATURE_ID) {
          pushFateKnotsHubStateWhenReady(handlerApi);
          return;
        }
        if (activeFeatureId === YAHTZEE_FEATURE_ID) {
          pushYahtzeeState(handlerApi);
        }
      }

      function clearUs1SyncLoopCompat(handlerApi: GameRoomHostApi): void {
        backgammonClearUs1SyncLoop(handlerApi as Parameters<typeof backgammonClearUs1SyncLoop>[0]);
      }

      function notifyFateKnotsCombatDiscussion(state: unknown): void {
        (api as FateKnotsNotifyApi).notifyRoom?.("fate-knots-combat-discussion-state", {
          roomId: "game-room",
          featureId: FATE_KNOTS_FEATURE_ID,
          state,
        });
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
      fateKnotsHydration = hydrateFateKnotsDurablePersistence(api);
      void fateKnotsHydration.catch((error: unknown) => {
        api.log(
          "warn",
          `Fate Knots background hydration failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });

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

      const fateKnotsManagementCommands = createFateKnotsManagementCommands(api, {
        getForgeSnapshot: () => fateKnotsForge.getHubSnapshot(),
      });
      const fateKnotsRunSetupCommands = createFateKnotsRunSetupCommands(api);
      const fateKnotsRunCommands = createFateKnotsRunCommands(api, {
        isPlayerSeatAvailable: isFateKnotsPlayerSeatAvailable,
      });
      const fateKnotsGameplayCommands = createFateKnotsGameplayCommands(api);
      const fateKnotsCombatOptionCommands = createFateKnotsCombatOptionCommands(api);
      const fateKnotsCombatDiscussionCommands = createFateKnotsCombatDiscussionCommands(api);
      const fateKnotsCombatTurnCommands = createFateKnotsCombatTurnCommands(api);
      const fateKnotsGameplayCommand =
        fateKnotsGameplayCommands[FATE_KNOTS_GAMEPLAY_COMMAND_NAMES.getGameplayState];
      const fateKnotsCombatOptionsCommand =
        fateKnotsCombatOptionCommands[FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getLocalOptions];
      const fateKnotsCombatDiscussionGetCommand =
        fateKnotsCombatDiscussionCommands[FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.get];
      if (
        fateKnotsGameplayCommand === undefined ||
        fateKnotsCombatOptionsCommand === undefined ||
        fateKnotsCombatDiscussionGetCommand === undefined
      ) {
        throw new Error("Fate Knots read command registry is incomplete.");
      }

      api.registerCommand?.(
        FATE_KNOTS_GAMEPLAY_COMMAND_NAMES.getGameplayState,
        function (payload: unknown) {
          return withFateKnotsReady(() => {
            const result = fateKnotsGameplayCommand(readRegisteredRoomArgs(payload));
            pushFateKnotsHubStateCompat(api);
            return result;
          });
        },
        {
          description: "Read one player-safe Fate Knots active-run projection.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      api.registerCommand?.(
        FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getLocalOptions,
        function (payload: unknown) {
          return withFateKnotsReady(() =>
            fateKnotsCombatOptionsCommand(readRegisteredRoomArgs(payload))
          );
        },
        {
          description:
            "Read the local player's current legal Fate Knots combat card/target options.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      const discussionRegistrations = [
        [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.get, "room-ui", "Read the shared Fate Knots party combat discussion."],
        [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.sendLocal, "room-ui", "Post the local player's message to shared Fate Knots combat discussion."],
        [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.sendAi2, "ai-slots", "Post AI2's player message to shared Fate Knots combat discussion."],
        [FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.sendRemote, "us1", "Post US1's remote player message to shared Fate Knots combat discussion."],
      ] as const;
      for (const [commandName, scope, description] of discussionRegistrations) {
        const handler = fateKnotsCombatDiscussionCommands[commandName];
        if (handler === undefined) throw new Error(`Missing Fate Knots discussion handler: ${commandName}`);
        api.registerCommand?.(
          commandName,
          function (payload: unknown) {
            return withFateKnotsReady(() => {
              const result = handler(readRegisteredRoomArgs(payload));
              if (result.ok) notifyFateKnotsCombatDiscussion(result.state);
              return result;
            });
          },
          { description, scope, exposure: "internal" }
        );
      }

      const completeMoveRegistrations = [
        [FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES.completeLocal, "room-ui", "Lock the local player's legal Fate Knots combat move."],
        [FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES.completeAi2, "ai-slots", "Lock AI2's legal Fate Knots combat move."],
        [FATE_KNOTS_COMBAT_TURN_COMMAND_NAMES.completeRemote, "us1", "Lock US1's legal Fate Knots combat move."],
      ] as const;
      for (const [commandName, scope, description] of completeMoveRegistrations) {
        const handler = fateKnotsCombatTurnCommands[commandName];
        if (handler === undefined) throw new Error(`Missing Fate Knots combat-turn handler: ${commandName}`);
        api.registerCommand?.(
          commandName,
          function (payload: unknown) {
            return withFateKnotsReady(async () => {
              const roomArgs = readRegisteredRoomArgs(payload);
              const result = await persistFateKnotsCommandMutation(api, () => handler(roomArgs));
              pushFateKnotsHubStateCompat(api);
              if (result.ok) {
                const discussion = fateKnotsCombatDiscussionGetCommand(roomArgs);
                notifyFateKnotsCombatDiscussion(discussion.ok ? discussion.state : null);
              }
              return result;
            });
          },
          { description, scope, exposure: "internal" }
        );
      }

      const fateKnotsCommands = {
        ...fateKnotsManagementCommands,
        ...fateKnotsRunSetupCommands,
        ...fateKnotsRunCommands,
      };
      for (const [commandName, handler] of Object.entries(fateKnotsCommands)) {
        commands[commandName] = function (payload?: unknown) {
          return withFateKnotsReady(async () => {
            const result = FATE_KNOTS_MUTATION_COMMANDS.has(commandName)
              ? await persistFateKnotsCommandMutation(api, () => handler(payload))
              : handler(payload);
            pushFateKnotsHubStateCompat(api);
            return result;
          });
        };
      }

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
