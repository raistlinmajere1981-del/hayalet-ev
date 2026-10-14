import {
  FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES,
  createFateKnotsRunSetupSeatCommands,
} from "../main-functions/fate-knots/host/run-setup-seat-runtime.js";
import { FATE_KNOTS_FEATURE_ID } from "../shared/host/feature-meta.js";
import type { GameRoomHostApi } from "../shared/host/activation.js";

type GameRoomHostRuntime = {
  activate(api: GameRoomHostApi): unknown;
};

type FateKnotsNotifyApi = GameRoomHostApi & {
  notifyRoom?: (eventType: string, data: unknown) => void;
};

function readRegisteredRoomArgs(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  return "roomArgs" in record ? record["roomArgs"] : {};
}

function notifySetupSeats(api: GameRoomHostApi, state: unknown): void {
  (api as FateKnotsNotifyApi).notifyRoom?.("fate-knots-run-setup-seat-state", {
    roomId: "game-room",
    featureId: FATE_KNOTS_FEATURE_ID,
    state,
  });
}

/**
 * Adds player-owned run-setup choices without changing the public manifest.
 * AI2 and US1 receive the same spoiler-safe setup projection as room-ui, but
 * each select command is scope-bound to exactly one player seat.
 */
export function extendGameRoomHostRuntimeWithFateKnotsRunSetupSeats<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const activated = baseRuntime.activate(api);
      const commands = createFateKnotsRunSetupSeatCommands(api);
      const registrations = [
        [
          FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.getLocalState,
          "room-ui",
          "Read current Fate Knots run setup seat selections.",
          false,
        ],
        [
          FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.getAi2,
          "ai-slots",
          "Read player-safe Fate Knots run setup data for AI2.",
          false,
        ],
        [
          FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.getRemote,
          "us1",
          "Read player-safe Fate Knots run setup data for US1.",
          false,
        ],
        [
          FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.selectLocal,
          "room-ui",
          "Select the local player's Fate Knots run character.",
          true,
        ],
        [
          FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.selectAi2,
          "ai-slots",
          "Select AI2's Fate Knots run character.",
          true,
        ],
        [
          FATE_KNOTS_RUN_SETUP_SEAT_COMMAND_NAMES.selectRemote,
          "us1",
          "Select US1's Fate Knots run character.",
          true,
        ],
      ] as const;

      for (const [commandName, scope, description, notifies] of registrations) {
        const handler = commands[commandName];
        api.registerCommand?.(
          commandName,
          function (payload: unknown) {
            const result = handler(readRegisteredRoomArgs(payload));
            if (notifies && result.ok && "state" in result) notifySetupSeats(api, result.state);
            return result;
          },
          { description, scope, exposure: "internal" }
        );
      }

      return activated;
    },
  };
}
