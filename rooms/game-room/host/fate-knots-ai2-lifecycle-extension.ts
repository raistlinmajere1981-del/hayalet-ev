import {
  FATE_KNOTS_AI2_LIFECYCLE_COMMAND_NAMES,
  clearFateKnotsAi2Lifecycle,
  dispatchFateKnotsAi2LifecycleIfNeeded,
  requestFateKnotsAi2RunCharacter,
} from "../main-functions/fate-knots/host/ai2-player-lifecycle.js";
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

type FateKnotsLifecycleApi = GameRoomHostApi & {
  notifyRoom?: (eventType: string, data: unknown) => void;
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

function notifySetupSeats(api: FateKnotsLifecycleApi, universeId: string): void {
  api.notifyRoom?.("fate-knots-run-setup-seat-state", {
    roomId: "game-room",
    featureId: FATE_KNOTS_FEATURE_ID,
    state: readFateKnotsRunSetupSeatProjection(api, universeId),
  });
}

function scheduleAi2Lifecycle(api: FateKnotsLifecycleApi): void {
  void dispatchFateKnotsAi2LifecycleIfNeeded(api).catch((error: unknown) => {
    api.log(
      "warn",
      `Fate Knots AI2 lifecycle dispatch failed: ${error instanceof Error ? error.message : String(error)}`
    );
  });
}

function wrapCommandHandler(
  api: FateKnotsLifecycleApi,
  commandName: string,
  handler: CommandHandler
): CommandHandler {
  if (!commandName.startsWith("GameRoomFateKnots")) return handler;
  return function (payload?: unknown) {
    const result = handler(payload);
    if (isPromiseLike(result)) {
      return Promise.resolve(result).then((value) => {
        scheduleAi2Lifecycle(api);
        return value;
      });
    }
    scheduleAi2Lifecycle(api);
    return result;
  };
}

/**
 * Outermost Fate Knots host extension that turns the existing seat-bound AI2
 * commands into a real player lifecycle. It deliberately does not add mechanic
 * authority: after every Fate Knots state/coordination command it only probes
 * player-safe state and, when AI2 owes a decision, sends a bounded prompt whose
 * reply must return through the already scoped AI2 room command.
 */
export function extendGameRoomHostRuntimeWithFateKnotsAi2Lifecycle<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const lifecycleApi = api as FateKnotsLifecycleApi;
      const originalRegisterCommand = api.registerCommand;

      if (originalRegisterCommand) {
        api.registerCommand = function (commandName, handler, options) {
          originalRegisterCommand(
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

      originalRegisterCommand?.(
        FATE_KNOTS_AI2_LIFECYCLE_COMMAND_NAMES.requestRunCharacter,
        async function (payload: unknown) {
          const universeId = readUniverseId(payload);
          const result = await requestFateKnotsAi2RunCharacter(
            lifecycleApi,
            readRegisteredRoomArgs(payload)
          );
          if (universeId) notifySetupSeats(lifecycleApi, universeId);
          return result;
        },
        {
          description: "Invite AI2 to choose its own player character for Fate Knots run setup.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      const baseOnRoomReady = activated.onRoomReady;
      const baseOnRoomEvent = activated.onRoomEvent;
      const baseDispose = activated.dispose;

      return {
        ...activated,
        onRoomReady() {
          baseOnRoomReady();
          scheduleAi2Lifecycle(lifecycleApi);
        },
        onRoomEvent(payload: unknown) {
          baseOnRoomEvent(payload);
          if (isRecord(payload) && payload["type"] === "host-context") {
            scheduleAi2Lifecycle(lifecycleApi);
          }
        },
        dispose() {
          clearFateKnotsAi2Lifecycle(lifecycleApi);
          baseDispose?.();
        },
      };
    },
  };
}
