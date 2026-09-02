import {
  FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES,
  createFateKnotsCombatDiscussionCommands,
} from "../main-functions/fate-knots/host/combat-discussion-runtime.js";
import {
  FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES,
  createFateKnotsCombatOptionCommands,
} from "../main-functions/fate-knots/host/combat-options-runtime.js";
import type { GameRoomHostApi } from "../shared/host/activation.js";

type GameRoomHostRuntime = {
  activate(api: GameRoomHostApi): unknown;
};

function readRegisteredRoomArgs(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  return "roomArgs" in record ? record["roomArgs"] : {};
}

/**
 * Adds the private read half of the AI2/US1 combat lifecycle.
 *
 * Base runtime already owns seat-bound message sends and complete-move commands.
 * These distinct scoped reads ensure AI2/US1 can inspect only their own legal
 * card/target options while still reading the shared party discussion.
 */
export function extendGameRoomHostRuntimeWithFateKnotsPlayerCombat<T extends GameRoomHostRuntime>(
  baseRuntime: T
): T {
  return {
    ...baseRuntime,
    activate(api: GameRoomHostApi) {
      const activated = baseRuntime.activate(api);
      const optionCommands = createFateKnotsCombatOptionCommands(api);
      const discussionCommands = createFateKnotsCombatDiscussionCommands(api);
      const registrations = [
        [
          FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getAi2Options,
          optionCommands[FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getAi2Options],
          "ai-slots",
          "Read AI2's private legal Fate Knots combat card/target options.",
        ],
        [
          FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getRemoteOptions,
          optionCommands[FATE_KNOTS_COMBAT_OPTION_COMMAND_NAMES.getRemoteOptions],
          "us1",
          "Read US1's private legal Fate Knots combat card/target options.",
        ],
        [
          FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.getAi2,
          discussionCommands[FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.getAi2],
          "ai-slots",
          "Read the shared Fate Knots combat discussion for AI2.",
        ],
        [
          FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.getRemote,
          discussionCommands[FATE_KNOTS_COMBAT_DISCUSSION_COMMAND_NAMES.getRemote],
          "us1",
          "Read the shared Fate Knots combat discussion for US1.",
        ],
      ] as const;

      for (const [commandName, handler, scope, description] of registrations) {
        if (handler === undefined) {
          throw new Error(`Missing Fate Knots player-combat handler: ${commandName}`);
        }
        api.registerCommand?.(
          commandName,
          function (payload: unknown) {
            return handler(readRegisteredRoomArgs(payload));
          },
          { description, scope, exposure: "internal" }
        );
      }

      return activated;
    },
  };
}
