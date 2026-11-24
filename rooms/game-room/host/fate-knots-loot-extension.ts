import { persistFateKnotsCommandMutation } from "../main-functions/fate-knots/host/durable-persistence.js";
import {
  FATE_KNOTS_LOOT_COMMAND_NAMES,
  clearFateKnotsLootCoordinationAfterResolve,
  createFateKnotsLootCommands,
} from "../main-functions/fate-knots/host/loot-runtime.js";
import { pushFateKnotsHubState } from "../main-functions/fate-knots/host/runtime-sync.js";
import type { GameRoomHostApi } from "../shared/host/activation.js";
import { FATE_KNOTS_FEATURE_ID } from "../shared/host/feature-meta.js";

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

function notifyLoot(api: GameRoomHostApi, state: unknown): void {
  (api as FateKnotsNotifyApi).notifyRoom?.("fate-knots-loot-state", {
    roomId: "game-room",
    featureId: FATE_KNOTS_FEATURE_ID,
    state,
  });
}

/**
 * Adds the V1 neutral-loot proposal/approval surface.
 *
 * Proposals and approvals are hot coordination state. Canonical inventory does
 * not change until every active USER/AI2/US1 seat approves the exact proposal.
 * Final approval is committed through the crash-atomic Fate persistence
 * envelope; coordination is cleared only after that durable commit succeeds so
 * the same unanimous proposal can be retried safely after a storage failure.
 */
export function extendGameRoomHostRuntimeWithFateKnotsLoot<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const activated = baseRuntime.activate(api);
      const commands = createFateKnotsLootCommands(api);

      const readHandler = commands[FATE_KNOTS_LOOT_COMMAND_NAMES.get];
      if (readHandler === undefined) throw new Error("Missing Fate Knots loot state handler.");
      api.registerCommand?.(
        FATE_KNOTS_LOOT_COMMAND_NAMES.get,
        function (payload: unknown) {
          const result = readHandler(readRegisteredRoomArgs(payload));
          if (result.ok) notifyLoot(api, result.state);
          return result;
        },
        {
          description: "Read the current public Fate Knots neutral loot proposal and approvals.",
          scope: "room-ui",
          exposure: "internal",
        }
      );

      const proposalRegistrations = [
        [
          FATE_KNOTS_LOOT_COMMAND_NAMES.proposeLocal,
          "room-ui",
          "Submit the local player's exact Fate Knots loot allocation proposal.",
        ],
        [
          FATE_KNOTS_LOOT_COMMAND_NAMES.proposeAi2,
          "ai-slots",
          "Submit AI2's exact Fate Knots loot allocation proposal.",
        ],
        [
          FATE_KNOTS_LOOT_COMMAND_NAMES.proposeRemote,
          "us1",
          "Submit US1's exact Fate Knots loot allocation proposal.",
        ],
      ] as const;
      for (const [commandName, scope, description] of proposalRegistrations) {
        const handler = commands[commandName];
        if (handler === undefined)
          throw new Error(`Missing Fate Knots loot proposal handler: ${commandName}`);
        api.registerCommand?.(
          commandName,
          function (payload: unknown) {
            const roomArgs = readRegisteredRoomArgs(payload);
            return persistFateKnotsCommandMutation(api, () => handler(roomArgs)).then((result) => {
              if (!result.ok) return result;
              if (result.state.resolved) {
                clearFateKnotsLootCoordinationAfterResolve(api);
                notifyLoot(api, null);
                pushFateKnotsHubState(api);
              } else {
                notifyLoot(api, result.state);
              }
              return result;
            });
          },
          { description, scope, exposure: "internal" }
        );
      }

      const approvalRegistrations = [
        [
          FATE_KNOTS_LOOT_COMMAND_NAMES.approveLocal,
          "room-ui",
          "Approve the current Fate Knots loot proposal as the local player.",
        ],
        [
          FATE_KNOTS_LOOT_COMMAND_NAMES.approveAi2,
          "ai-slots",
          "Approve the current Fate Knots loot proposal as AI2.",
        ],
        [
          FATE_KNOTS_LOOT_COMMAND_NAMES.approveRemote,
          "us1",
          "Approve the current Fate Knots loot proposal as US1.",
        ],
      ] as const;
      for (const [commandName, scope, description] of approvalRegistrations) {
        const handler = commands[commandName];
        if (handler === undefined)
          throw new Error(`Missing Fate Knots loot approval handler: ${commandName}`);
        api.registerCommand?.(
          commandName,
          function (payload: unknown) {
            const roomArgs = readRegisteredRoomArgs(payload);
            return persistFateKnotsCommandMutation(api, () => handler(roomArgs)).then((result) => {
              if (!result.ok) return result;
              if (result.state.resolved) {
                clearFateKnotsLootCoordinationAfterResolve(api);
                notifyLoot(api, null);
                pushFateKnotsHubState(api);
              } else {
                notifyLoot(api, result.state);
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
