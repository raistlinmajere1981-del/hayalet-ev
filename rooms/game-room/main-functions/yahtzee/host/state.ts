import {
  YAHTZEE_CATEGORIES,
  YAHTZEE_SCHEMA_VERSION,
  createEmptyTurn,
  getYahtzeeTotal,
  getYahtzeeUpperBonus,
  getYahtzeeUpperSubtotal,
  isYahtzeeComplete,
  type YahtzeeCategory,
  type YahtzeeScoreCard,
  type YahtzeeTurn,
} from "./engine.js";

export interface YahtzeeStateApi {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
}

export interface YahtzeeHostState {
  schemaVersion: number;
  active: boolean;
  complete: boolean;
  turnIndex: number;
  turn: YahtzeeTurn;
  card: YahtzeeScoreCard;
  upperSubtotal: number;
  upperBonus: number;
  total: number;
  status: string;
}

const STATE_KEY = "yahtzee-game";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function sanitizeTurn(candidate: unknown): YahtzeeTurn {
  const source = isRecord(candidate) ? candidate : {};
  const rawDice: unknown[] = Array.isArray(source["dice"]) ? source["dice"] : [];
  const rawHeld: unknown[] = Array.isArray(source["held"]) ? source["held"] : [];
  const fallback = createEmptyTurn();
  return {
    dice: fallback.dice.map((fallbackDie, index) => {
      const value = rawDice[index];
      return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6
        ? (value as 1 | 2 | 3 | 4 | 5 | 6)
        : fallbackDie;
    }),
    held: fallback.held.map((_, index) => rawHeld[index] === true),
    rollCount:
      typeof source["rollCount"] === "number" &&
      Number.isInteger(source["rollCount"]) &&
      source["rollCount"] >= 0 &&
      source["rollCount"] <= 3
        ? source["rollCount"]
        : 0,
  };
}

function sanitizeCard(candidate: unknown): YahtzeeScoreCard {
  const source = isRecord(candidate) ? candidate : {};
  const rawScores = isRecord(source["scores"]) ? source["scores"] : {};
  const scores: Partial<Record<YahtzeeCategory, number>> = {};
  for (const category of YAHTZEE_CATEGORIES) {
    const value = rawScores[category];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      scores[category] = Math.floor(value);
    }
  }
  return { scores };
}

export function createInitialYahtzeeState(): YahtzeeHostState {
  return {
    schemaVersion: YAHTZEE_SCHEMA_VERSION,
    active: false,
    complete: false,
    turnIndex: 0,
    turn: createEmptyTurn(),
    card: { scores: {} },
    upperSubtotal: 0,
    upperBonus: 0,
    total: 0,
    status: "ready",
  };
}

export function normalizeYahtzeeState(candidate: unknown): YahtzeeHostState {
  const source = isRecord(candidate) ? candidate : {};
  const card = sanitizeCard(source["card"]);
  const complete = isYahtzeeComplete(card);
  return {
    schemaVersion: YAHTZEE_SCHEMA_VERSION,
    active: source["active"] === true && complete === false,
    complete,
    turnIndex:
      typeof source["turnIndex"] === "number" &&
      Number.isInteger(source["turnIndex"]) &&
      source["turnIndex"] >= 0
        ? Math.min(source["turnIndex"], YAHTZEE_CATEGORIES.length)
        : 0,
    turn: sanitizeTurn(source["turn"]),
    card,
    upperSubtotal: getYahtzeeUpperSubtotal(card),
    upperBonus: getYahtzeeUpperBonus(card),
    total: getYahtzeeTotal(card),
    status: typeof source["status"] === "string" ? source["status"] : "",
  };
}

export function loadYahtzeeState(api: YahtzeeStateApi): YahtzeeHostState {
  return normalizeYahtzeeState(api.getState(STATE_KEY));
}

export function saveYahtzeeState(api: YahtzeeStateApi, state: YahtzeeHostState): YahtzeeHostState {
  const normalized = normalizeYahtzeeState(state);
  api.setState(STATE_KEY, normalized);
  return normalized;
}
