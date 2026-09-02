import {
  FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES,
  clearFateKnotsExplorationConsensusAfterAdvance,
  createFateKnotsExplorationConsensusCommands,
} from "../main-functions/fate-knots/host/exploration-consensus-runtime.js";
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

function notifyExplorationConsensus(api: GameRoomHostApi, state: unknown): void {
  (api as FateKnotsNotifyApi).notifyRoom?.("fate-knots-exploration-consensus-state", {
    roomId: "game-room",
    featureId: FATE_KNOTS_FEATURE_ID,
    state,
  });
}

/**
 * Adds Fate Knots exploration coordination without widening the main Game Room
 * runtime surface. These commands are intentionally internal registrations, the
 * same pattern used by other room-local host capabilities that do not belong in
 * the public manifest command catalogue.
 *
 * Sender identity is command-bound: room UI can only act as USER, AI slots only
 * as AI2, and the remote transport only as US1. Public exploration choices live
 * in hot coordination state. Canonical Run mutation happens only when every
 * active player seat converges on the same legal transition.
 */
export function extendGameRoomHostRuntimeWithFateKnotsExploration<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const activated = baseRuntime.activate(api);
      const commands = createFateKnotsExplorationConsensusCommands(api);

      const registrations = [
        [
          FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.get,
          "room-ui",
          false,
          "Read the shared Fate Knots exploration discussion and public choices.",
        ],
        [
          FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.sendLocal,
          "room-ui",
          false,
          "Post the local player's Fate Knots exploration message.",
        ],
        [
          FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.sendAi2,
          "ai-slots",
          false,
          "Post AI2's Fate Knots exploration message.",
        ],
        [
          FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.sendRemote,
          "us1",
          false,
          "Post US1's Fate Knots exploration message.",
        ],
        [
          FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.chooseLocal,
          "room-ui",
          true,
          "Set the local player's public Fate Knots exploration choice.",
        ],
        [
          FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.chooseAi2,
          "ai-slots",
          true,
          "Set AI2's public Fate Knots exploration choice.",
        ],
        [
          FATE_KNOTS_EXPLORATION_CONSENSUS_COMMAND_NAMES.chooseRemote,
          "us1",
          true,
          "Set US1's public Fate Knots exploration choice.",
        ],
      ] as const;

      for (const [commandName, scope, mutatesCanon, description] of registrations) {
        const handler = commands[commandName];
        if (handler === undefined) {
          throw new Error(`Missing Fate Knots exploration handler: ${commandName}`);
        }

        api.registerCommand?.(
          commandName,
          function (payload: unknown) {
            const roomArgs = readRegisteredRoomArgs(payload);
            if (!mutatesCanon) {
              const result = handler(roomArgs);
              if (result.ok) notifyExplorationConsensus(api, result.state.consensus);
              return result;
            }

            return persistFateKnotsCommandMutation(api, () => handler(roomArgs)).then((result) => {
              if (!result.ok) return result;

              if (result.state.advanced) {
                clearFateKnotsExplorationConsensusAfterAdvance(api);
                notifyExplorationConsensus(api, null);
                pushFateKnotsHubState(api);
              } else {
                notifyExplorationConsensus(api, result.state.consensus);
              }
              return result;
            });
          },
          { description, scope, exposure: "internal" }
        );
      }

      return activated;
    },
  };
}
