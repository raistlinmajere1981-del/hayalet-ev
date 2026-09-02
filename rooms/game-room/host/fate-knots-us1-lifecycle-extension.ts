import {
  FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES,
  applyFateKnotsUs1ClientMirrorSync,
  cancelFateKnotsUs1RunCharacter,
  clearFateKnotsUs1Lifecycle,
  dispatchFateKnotsUs1LifecycleIfNeeded,
  forwardFateKnotsUs1ClientIntent,
  recordFateKnotsUs1NpcDialogue,
  requestFateKnotsUs1RunCharacter,
} from "../main-functions/fate-knots/host/us1-player-lifecycle.js";
import { readFateKnotsRunSetupSeatProjection } from "../main-functions/fate-knots/host/run-setup-seat-coordination.js";
import { FATE_KNOTS_FEATURE_ID } from "../shared/host/feature-meta.js";
import type { GameRoomHostApi } from "../shared/host/activation.js";

type CommandHandler = (payload?: unknown) => unknown;

type ActivatedGameRoomHost = {
  commands: Record<string, CommandHandler>;
  onRoomReady: () => void;
  onRoomEvent: (payload: unknown) => void;
  dispose?: () => void;
};

type GameRoomHostRuntime = {
  activate(api: GameRoomHostApi): unknown;
};

type FateKnotsUs1LifecycleApi = GameRoomHostApi & {
  notifyRoom?: (eventType: string, data: unknown) => void;
  dispatchBridge?(options: Record<string, unknown>): Promise<unknown> | unknown;
  deleteState?(key: string): void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRegisteredRoomArgs(payload: unknown): unknown {
  if (!isRecord(payload)) return {};
  return "roomArgs" in payload ? payload["roomArgs"] : {};
}

function readUniverseId(payload: unknown): string | null {
  const roomArgs = readRegisteredRoomArgs(payload);
  if (!isRecord(roomArgs)) return null;
  const value = roomArgs["universeId"];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function notifySetupSeats(api: FateKnotsUs1LifecycleApi, universeId: string): void {
  api.notifyRoom?.("fate-knots-run-setup-seat-state", {
    roomId: "game-room",
    featureId: FATE_KNOTS_FEATURE_ID,
    state: readFateKnotsRunSetupSeatProjection(api, universeId),
  });
}

function notifyUs1Mirror(api: FateKnotsUs1LifecycleApi, state: unknown): void {
  api.notifyRoom?.("fate-knots-us1-mirror-state", {
    roomId: "game-room",
    featureId: FATE_KNOTS_FEATURE_ID,
    state,
  });
}

function scheduleUs1Lifecycle(api: FateKnotsUs1LifecycleApi): void {
  void dispatchFateKnotsUs1LifecycleIfNeeded(api).catch((error: unknown) => {
    api.log(
      "warn",
      `Fate Knots US1 lifecycle synchronization failed: ${error instanceof Error ? error.message : String(error)}`
    );
  });
}

function afterWorldCommand(
  api: FateKnotsUs1LifecycleApi,
  commandName: string,
  value: unknown
): void {
  if (commandName === "GameRoomFateKnotsRemoteSpeakNpc" && isRecord(value) && value["ok"] === true) {
    recordFateKnotsUs1NpcDialogue(api, value["state"]);
  }
  scheduleUs1Lifecycle(api);
}

function shouldWrap(commandName: string): boolean {
  return (
    commandName.startsWith("GameRoomFateKnots") &&
    !commandName.startsWith("GameRoomFateKnotsUs1Client") &&
    commandName !== FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.requestRunCharacter &&
    commandName !== FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.cancelRunCharacter
  );
}

function wrapCommandHandler(
  api: FateKnotsUs1LifecycleApi,
  commandName: string,
  handler: CommandHandler
): CommandHandler {
  if (!shouldWrap(commandName)) return handler;
  return function (payload?: unknown) {
    const result = handler(payload);
    if (isPromiseLike(result)) {
      return Promise.resolve(result).then((value) => {
        afterWorldCommand(api, commandName, value);
        return value;
      });
    }
    afterWorldCommand(api, commandName, result);
    return result;
  };
}

function registerCommand(
  api: GameRoomHostApi,
  originalRegisterCommand: GameRoomHostApi["registerCommand"],
  commandName: string,
  handler: (payload: unknown) => unknown,
  options: Parameters<NonNullable<GameRoomHostApi["registerCommand"]>>[2]
): void {
  originalRegisterCommand?.call(api, commandName, handler, options);
}

/**
 * Outermost US1 lifecycle layer. The World Host sends only player-safe mirror
 * snapshots to the remote Game Room. The remote client stores no canonical
 * universe/run authority: its room-ui commands are converted to intent-only
 * messages that return to the World Host's existing `scope: us1` commands.
 */
export function extendGameRoomHostRuntimeWithFateKnotsUs1Lifecycle<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const lifecycleApi = api as FateKnotsUs1LifecycleApi;
      const originalRegisterCommand = api.registerCommand;

      if (originalRegisterCommand) {
        api.registerCommand = function (commandName, handler, options) {
          originalRegisterCommand.call(
            api,
            commandName,
            wrapCommandHandler(lifecycleApi, commandName, handler),
            options
          );
        };
      }

      let activated: ActivatedGameRoomHost;
      try {
        activated = baseRuntime.activate(api) as ActivatedGameRoomHost;
      } finally {
        if (originalRegisterCommand) api.registerCommand = originalRegisterCommand;
      }

      for (const [commandName, handler] of Object.entries(activated.commands)) {
        activated.commands[commandName] = wrapCommandHandler(lifecycleApi, commandName, handler);
      }

      registerCommand(
        api,
        originalRegisterCommand,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.requestRunCharacter,
        async function (payload: unknown) {
          const universeId = readUniverseId(payload);
          const result = await requestFateKnotsUs1RunCharacter(
            lifecycleApi,
            readRegisteredRoomArgs(payload)
          );
          if (universeId) notifySetupSeats(lifecycleApi, universeId);
          return result;
        },
        {
          description: "Invite US1 to choose its own Fate Knots player character.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      registerCommand(
        api,
        originalRegisterCommand,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.cancelRunCharacter,
        async function (payload: unknown) {
          const universeId = readUniverseId(payload);
          const result = await cancelFateKnotsUs1RunCharacter(
            lifecycleApi,
            readRegisteredRoomArgs(payload)
          );
          if (universeId) notifySetupSeats(lifecycleApi, universeId);
          return result;
        },
        {
          description: "Cancel US1 participation in the current Fate Knots run setup.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      registerCommand(
        api,
        originalRegisterCommand,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSync,
        function (payload: unknown) {
          const result = applyFateKnotsUs1ClientMirrorSync(
            lifecycleApi,
            readRegisteredRoomArgs(payload)
          );
          if (result.ok) notifyUs1Mirror(lifecycleApi, result.state);
          return result;
        },
        {
          description: "Apply a player-safe Fate Knots mirror snapshot from the World Host.",
          scope: "us1",
          exposure: "internal",
        }
      );

      const clientCommands = [
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSelectCharacter,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSendExplorationMessage,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientChooseExploration,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSendCombatMessage,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientCompleteCombatMove,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSpeakNpc,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientProposeLoot,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientApproveLoot,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientSetCampEquipment,
        FATE_KNOTS_US1_LIFECYCLE_COMMAND_NAMES.clientReadyCamp,
      ] as const;

      for (const commandName of clientCommands) {
        registerCommand(
          api,
          originalRegisterCommand,
          commandName,
          function (payload: unknown) {
            return forwardFateKnotsUs1ClientIntent(
              lifecycleApi,
              commandName,
              readRegisteredRoomArgs(payload)
            );
          },
          {
            description: "Forward one US1 Fate Knots player intent to the World Host.",
            scope: "room-ui",
            exposure: "internal",
          }
        );
      }

      const baseOnRoomReady = activated.onRoomReady;
      const baseOnRoomEvent = activated.onRoomEvent;
      const baseDispose = activated.dispose;

      return {
        ...activated,
        onRoomReady() {
          baseOnRoomReady();
          scheduleUs1Lifecycle(lifecycleApi);
        },
        onRoomEvent(payload: unknown) {
          baseOnRoomEvent(payload);
          if (isRecord(payload) && payload["type"] === "host-context") {
            scheduleUs1Lifecycle(lifecycleApi);
          }
        },
        dispose() {
          clearFateKnotsUs1Lifecycle(lifecycleApi);
          baseDispose?.();
        },
      };
    },
  };
}
