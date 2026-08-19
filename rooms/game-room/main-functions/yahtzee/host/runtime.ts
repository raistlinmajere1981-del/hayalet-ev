import {
  YAHTZEE_CATEGORIES,
  createEmptyTurn,
  isYahtzeeComplete,
  rollYahtzeeDice,
  scoreYahtzeeCategory,
  type YahtzeeCategory,
} from "./engine.js";
import {
  createInitialYahtzeeState,
  loadYahtzeeState,
  saveYahtzeeState,
  type YahtzeeHostState,
  type YahtzeeStateApi,
} from "./state.js";

export const YAHTZEE_COMMAND_NAMES = {
  start: "GameRoomYahtzeeStart",
  reset: "GameRoomYahtzeeReset",
  roll: "GameRoomYahtzeeRoll",
  toggleHold: "GameRoomYahtzeeToggleHold",
  score: "GameRoomYahtzeeScore",
} as const;

interface YahtzeeRuntimeApi extends YahtzeeStateApi {
  notifyRoom?(eventType: string, data: unknown): void;
  showToast?(payload: { type?: "success" | "error" | "info" | "warning"; message: string }): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function result(success: boolean, message: string) {
  return { success, message };
}

function pushState(api: YahtzeeRuntimeApi, state: YahtzeeHostState): YahtzeeHostState {
  const saved = saveYahtzeeState(api, state);
  api.notifyRoom?.("yahtzee-state", { state: saved });
  return saved;
}

function readIndex(payload: unknown): number | null {
  const source =
    isRecord(payload) && isRecord(payload["roomArgs"])
      ? payload["roomArgs"]
      : isRecord(payload)
        ? payload
        : {};
  const value = source["index"];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 5
    ? value
    : null;
}

function readCategory(payload: unknown): YahtzeeCategory | null {
  const source =
    isRecord(payload) && isRecord(payload["roomArgs"])
      ? payload["roomArgs"]
      : isRecord(payload)
        ? payload
        : {};
  const value = source["category"];
  return typeof value === "string" && YAHTZEE_CATEGORIES.includes(value as YahtzeeCategory)
    ? (value as YahtzeeCategory)
    : null;
}

export function initializeYahtzeeState(api: YahtzeeRuntimeApi): void {
  saveYahtzeeState(api, loadYahtzeeState(api));
}

export function pushYahtzeeState(api: YahtzeeRuntimeApi): YahtzeeHostState {
  return pushState(api, loadYahtzeeState(api));
}

export function handleYahtzeeStart(api: YahtzeeRuntimeApi): unknown {
  const state = createInitialYahtzeeState();
  state.active = true;
  state.turn = rollYahtzeeDice(createEmptyTurn());
  state.status = "firstRoll";
  pushState(api, state);
  return result(true, "Yahtzee game started.");
}

export function handleYahtzeeReset(api: YahtzeeRuntimeApi): unknown {
  pushState(api, createInitialYahtzeeState());
  return result(true, "Yahtzee game reset.");
}

export function handleYahtzeeRoll(api: YahtzeeRuntimeApi): unknown {
  const state = loadYahtzeeState(api);
  if (!state.active || state.complete) return result(false, "There is no active Yahtzee turn.");
  if (state.turn.rollCount >= 3) return result(false, "No rerolls remain for this turn.");
  state.turn = rollYahtzeeDice(state.turn);
  state.status = state.turn.rollCount >= 3 ? "finalRoll" : "chooseDiceOrScore";
  pushState(api, state);
  return result(true, "Dice rolled.");
}

export function handleYahtzeeToggleHold(api: YahtzeeRuntimeApi, payload: unknown): unknown {
  const state = loadYahtzeeState(api);
  const index = readIndex(payload);
  if (!state.active || state.complete || state.turn.rollCount === 0)
    return result(false, "Roll before holding dice.");
  if (index === null) return result(false, "Invalid die index.");
  if (state.turn.rollCount >= 3) return result(false, "The final roll is already complete.");
  state.turn.held[index] = !state.turn.held[index];
  pushState(api, state);
  return result(true, state.turn.held[index] ? "Die held." : "Die released.");
}

export function handleYahtzeeScore(api: YahtzeeRuntimeApi, payload: unknown): unknown {
  const state = loadYahtzeeState(api);
  const category = readCategory(payload);
  if (!state.active || state.complete || state.turn.rollCount === 0)
    return result(false, "Roll before scoring.");
  if (category === null) return result(false, "Unknown Yahtzee category.");
  if (typeof state.card.scores[category] === "number")
    return result(false, "That category is already filled.");

  state.card.scores[category] = scoreYahtzeeCategory(category, state.turn.dice);
  state.turnIndex += 1;
  state.complete = isYahtzeeComplete(state.card);
  state.active = !state.complete;

  if (state.complete) {
    state.status = "complete";
  } else {
    state.turn = rollYahtzeeDice(createEmptyTurn());
    state.status = "newTurn";
  }

  const saved = pushState(api, state);
  if (saved.complete)
    api.showToast?.({ type: "success", message: `Yahtzee complete: ${saved.total} points.` });
  return result(true, `Scored ${category}.`);
}
