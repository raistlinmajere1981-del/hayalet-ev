import {
  FATE_KNOTS_CAMP_COMMAND_NAMES,
  createFateKnotsCampCommands,
} from "../main-functions/fate-knots/host/camp-runtime.js";
import {
  FATE_KNOTS_NPC_DIALOGUE_COMMAND_NAMES,
  createFateKnotsNpcDialogueCommands,
} from "../main-functions/fate-knots/host/npc-dialogue-runtime.js";
import { persistFateKnotsCommandMutation } from "../main-functions/fate-knots/host/durable-persistence.js";
import { pushFateKnotsHubState } from "../main-functions/fate-knots/host/runtime-sync.js";
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

function notifyCamp(api: GameRoomHostApi, state: unknown): void {
  (api as FateKnotsNotifyApi).notifyRoom?.("fate-knots-camp-state", {
    roomId: "game-room",
    featureId: FATE_KNOTS_FEATURE_ID,
    state,
  });
}

function notifyNpcDialogue(api: GameRoomHostApi, state: unknown): void {
  (api as FateKnotsNotifyApi).notifyRoom?.("fate-knots-npc-dialogue-state", {
    roomId: "game-room",
    featureId: FATE_KNOTS_FEATURE_ID,
    state,
  });
}

/**
 * Registers V1 camp coordination and bounded AI0 dialogue on top of the base
 * Game Room runtime without widening the public manifest command catalogue.
 *
 * Player identity is command-bound for every seat-sensitive mutation. Camp
 * readiness has no timeout/fallback, and NPC dialogue never mutates canonical
 * story state; any AI0 interaction proposal still flows through exploration
 * consensus before the engine can advance it.
 */
export function extendGameRoomHostRuntimeWithFateKnotsCampSocial<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const activated = baseRuntime.activate(api);
      const campCommands = createFateKnotsCampCommands(api);
      const npcCommands = createFateKnotsNpcDialogueCommands(api);

      const campRegistrations = [
        [
          FATE_KNOTS_CAMP_COMMAND_NAMES.open,
          "room-ui",
          true,
          "Open and settle one Fate Knots camp.",
        ],
        [
          FATE_KNOTS_CAMP_COMMAND_NAMES.get,
          "room-ui",
          false,
          "Read current Fate Knots camp readiness.",
        ],
        [
          FATE_KNOTS_CAMP_COMMAND_NAMES.setLocalEquipment,
          "room-ui",
          true,
          "Change the local player's Fate Knots camp equipment.",
        ],
        [
          FATE_KNOTS_CAMP_COMMAND_NAMES.setAi2Equipment,
          "ai-slots",
          true,
          "Change AI2's Fate Knots camp equipment.",
        ],
        [
          FATE_KNOTS_CAMP_COMMAND_NAMES.setRemoteEquipment,
          "us1",
          true,
          "Change US1's Fate Knots camp equipment.",
        ],
        [
          FATE_KNOTS_CAMP_COMMAND_NAMES.readyLocal,
          "room-ui",
          true,
          "Lock the local player's Fate Knots camp readiness.",
        ],
        [
          FATE_KNOTS_CAMP_COMMAND_NAMES.readyAi2,
          "ai-slots",
          true,
          "Lock AI2's Fate Knots camp readiness.",
        ],
        [
          FATE_KNOTS_CAMP_COMMAND_NAMES.readyRemote,
          "us1",
          true,
          "Lock US1's Fate Knots camp readiness.",
        ],
      ] as const;

      for (const [commandName, scope, mutatesCanon, description] of campRegistrations) {
        const handler = campCommands[commandName];
        if (handler === undefined)
          throw new Error(`Missing Fate Knots camp handler: ${commandName}`);
        api.registerCommand?.(
          commandName,
          function (payload: unknown) {
            const roomArgs = readRegisteredRoomArgs(payload);
            if (!mutatesCanon) {
              const result = handler(roomArgs);
              if (result.ok) notifyCamp(api, result.state);
              return result;
            }
            return persistFateKnotsCommandMutation(api, () => handler(roomArgs)).then((result) => {
              if (result.ok) {
                notifyCamp(api, result.state.exited ? null : result.state);
                pushFateKnotsHubState(api);
              }
              return result;
            });
          },
          { description, scope, exposure: "internal" }
        );
      }

      const npcRegistrations = [
        [
          FATE_KNOTS_NPC_DIALOGUE_COMMAND_NAMES.speakLocal,
          "room-ui",
          "Speak to a Fate Knots NPC as the local player.",
        ],
        [
          FATE_KNOTS_NPC_DIALOGUE_COMMAND_NAMES.speakAi2,
          "ai-slots",
          "Speak to a Fate Knots NPC as AI2.",
        ],
        [
          FATE_KNOTS_NPC_DIALOGUE_COMMAND_NAMES.speakRemote,
          "us1",
          "Speak to a Fate Knots NPC as US1.",
        ],
      ] as const;

      for (const [commandName, scope, description] of npcRegistrations) {
        const handler = npcCommands[commandName];
        if (handler === undefined)
          throw new Error(`Missing Fate Knots NPC handler: ${commandName}`);
        api.registerCommand?.(
          commandName,
          async function (payload: unknown) {
            const result = await handler(readRegisteredRoomArgs(payload));
            if (result.ok) notifyNpcDialogue(api, result.state);
            return result;
          },
          { description, scope, exposure: "internal" }
        );
      }

      return activated;
    },
  };
}
