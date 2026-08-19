import { buildYahtzeeLegalActionIds } from "./engine.js";
import { getActiveYahtzeePlayer, type YahtzeeHostState } from "./state.js";

export function buildYahtzeeAiTurnMessage(state: YahtzeeHostState): string {
  const player = getActiveYahtzeePlayer(state);
  const legalActionIds = buildYahtzeeLegalActionIds(state.turn, player.card);
  const scoreSummary = Object.entries(player.card.scores)
    .map(([category, score]) => `${category}=${String(score)}`)
    .join(", ");
  const commandExample = {
    action: "room.command",
    payload: {
      commandName: "GameRoomYahtzeeAiAction",
      legalActionId: "<LEGAL_ACTION_ID>",
      turnToken: state.turnToken,
      turnIndex: state.turnIndex,
    },
  };

  return [
    "[TURN][GAME-ROOM][YAHTZEE]",
    `You are ${state.activeSeatId.toUpperCase()} in a two-player Yahtzee match.`,
    `Dice: ${JSON.stringify(state.turn.dice)}`,
    `Roll: ${state.turn.rollCount}/3`,
    `Current score card: ${scoreSummary || "empty"}`,
    "Choose exactly one legalActionId from the list below.",
    "reroll:abcde means hold the dice marked 1, reroll the dice marked 0, then the host generates the new dice.",
    "score:<category> commits the current dice to that unused category and ends your turn.",
    `Legal action ids: ${legalActionIds.join(", ")}`,
    "Reply with only this command, replacing <LEGAL_ACTION_ID> with one listed above:",
    `++cmd:SlotBridge(${JSON.stringify(commandExample)})`,
    "Do not invent dice results. The Game Room host owns all randomness and validates the action id.",
  ].join("\n");
}

export function buildYahtzeeUs1StartText(state: YahtzeeHostState): string {
  const localPlayer = state.players.find((player) => player.seatId === "user");
  return [
    "[START][GAME-ROOM][YAHTZEE][US1]",
    `${localPlayer?.label || "Remote player"} started a two-player Yahtzee match with you.`,
    "The match is synchronized through Game Room transport. Open Game Room > Yahtzee to play when it is your turn.",
    `Match: ${state.matchId || "unknown"}`,
  ].join("\n");
}

export function buildYahtzeeUs1SyncText(state: YahtzeeHostState): string {
  const player = getActiveYahtzeePlayer(state);
  return [
    "[SYNC][GAME-ROOM][YAHTZEE][US1]",
    `Turn ${state.turnIndex + 1}: ${player.label}`,
    `Dice: ${state.turn.dice.join(" ")} · roll ${state.turn.rollCount}/3`,
    `Revision: ${state.revision}`,
  ].join("\n");
}

export function buildYahtzeeUs1ResetText(matchId: string): string {
  return `[RESET][GAME-ROOM][YAHTZEE][US1]\nMatch ${matchId} was reset.`;
}
