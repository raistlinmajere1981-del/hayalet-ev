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

export const YAHTZEE_MODES = ["solo", "local2", "ai1", "ai2", "us1"] as const;
export type YahtzeeMode = (typeof YAHTZEE_MODES)[number];
export type YahtzeeSeatId = "user" | "local2" | "ai1" | "ai2" | "us1";

export interface YahtzeeStateApi {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
}

export interface YahtzeePlayerState {
  seatId: YahtzeeSeatId;
  label: string;
  card: YahtzeeScoreCard;
  upperSubtotal: number;
  upperBonus: number;
  total: number;
  complete: boolean;
}

export interface YahtzeeHostState {
  schemaVersion: number;
  mode: YahtzeeMode;
  matchId: string | null;
  revision: number;
  localSeatId: "user" | "us1";
  opponentSeatId: YahtzeeSeatId | null;
  remoteUserId: string | null;
  localSessionId: string | null;
  active: boolean;
  complete: boolean;
  players: YahtzeePlayerState[];
  activePlayerIndex: number;
  activeSeatId: YahtzeeSeatId;
  turnIndex: number;
  turnToken: string;
  turn: YahtzeeTurn;
  result: "idle" | "pending" | "draw" | "complete";
  winnerSeatId: YahtzeeSeatId | null;
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

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function sanitizeMode(value: unknown): YahtzeeMode {
  return typeof value === "string" && YAHTZEE_MODES.includes(value as YahtzeeMode)
    ? (value as YahtzeeMode)
    : "solo";
}

function opponentSeatForMode(mode: YahtzeeMode): YahtzeeSeatId | null {
  if (mode === "solo") return null;
  return mode;
}

function sanitizeSeatId(value: unknown): YahtzeeSeatId | null {
  return value === "user" ||
    value === "local2" ||
    value === "ai1" ||
    value === "ai2" ||
    value === "us1"
    ? value
    : null;
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

function createPlayer(seatId: YahtzeeSeatId, label: string): YahtzeePlayerState {
  return refreshPlayer({
    seatId,
    label,
    card: { scores: {} },
    upperSubtotal: 0,
    upperBonus: 0,
    total: 0,
    complete: false,
  });
}

function refreshPlayer(player: YahtzeePlayerState): YahtzeePlayerState {
  player.upperSubtotal = getYahtzeeUpperSubtotal(player.card);
  player.upperBonus = getYahtzeeUpperBonus(player.card);
  player.total = getYahtzeeTotal(player.card);
  player.complete = isYahtzeeComplete(player.card);
  return player;
}

function sanitizePlayer(candidate: unknown, fallbackSeatId: YahtzeeSeatId): YahtzeePlayerState {
  const source = isRecord(candidate) ? candidate : {};
  const seatId = sanitizeSeatId(source["seatId"]) || fallbackSeatId;
  const label = readString(source["label"]) || seatId.toUpperCase();
  return refreshPlayer({
    seatId,
    label,
    card: sanitizeCard(source["card"]),
    upperSubtotal: 0,
    upperBonus: 0,
    total: 0,
    complete: false,
  });
}

function createPlayersForMode(
  mode: YahtzeeMode,
  labels: Partial<Record<YahtzeeSeatId, string>> = {}
): YahtzeePlayerState[] {
  const players = [createPlayer("user", labels.user || "Player 1")];
  const opponentSeatId = opponentSeatForMode(mode);
  if (opponentSeatId !== null) {
    players.push(createPlayer(opponentSeatId, labels[opponentSeatId] || opponentSeatId.toUpperCase()));
  }
  return players;
}

function determineWinner(players: YahtzeePlayerState[]): YahtzeeSeatId | null {
  if (players.length < 2 || players.some((player) => player.complete !== true)) return null;
  if (players[0].total === players[1].total) return null;
  return players[0].total > players[1].total ? players[0].seatId : players[1].seatId;
}

export function createYahtzeeTurnToken(turnIndex: number, revision: number): string {
  const entropy = Math.floor(Math.random() * 0x100000000)
    .toString(36)
    .padStart(6, "0");
  return `yz-${turnIndex}-${revision}-${entropy}`;
}

export function createYahtzeeMatchId(): string {
  return `yz-${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000000).toString(36)}`;
}

export function createInitialYahtzeeState(
  mode: YahtzeeMode = "solo",
  localSeatId: "user" | "us1" = "user",
  labels: Partial<Record<YahtzeeSeatId, string>> = {}
): YahtzeeHostState {
  const players = createPlayersForMode(mode, labels);
  const activePlayer = players[0];
  return {
    schemaVersion: YAHTZEE_SCHEMA_VERSION,
    mode,
    matchId: null,
    revision: 0,
    localSeatId,
    opponentSeatId: opponentSeatForMode(mode),
    remoteUserId: null,
    localSessionId: null,
    active: false,
    complete: false,
    players,
    activePlayerIndex: 0,
    activeSeatId: activePlayer.seatId,
    turnIndex: 0,
    turnToken: "",
    turn: createEmptyTurn(),
    result: "idle",
    winnerSeatId: null,
    card: activePlayer.card,
    upperSubtotal: activePlayer.upperSubtotal,
    upperBonus: activePlayer.upperBonus,
    total: activePlayer.total,
    status: "ready",
  };
}

export function createYahtzeeMatchState(
  mode: YahtzeeMode,
  options: {
    localSeatId?: "user" | "us1";
    labels?: Partial<Record<YahtzeeSeatId, string>>;
    matchId?: string | null;
  } = {}
): YahtzeeHostState {
  const state = createInitialYahtzeeState(mode, options.localSeatId || "user", options.labels || {});
  state.matchId = options.matchId || createYahtzeeMatchId();
  state.active = true;
  state.result = "pending";
  state.revision = 1;
  state.turnToken = createYahtzeeTurnToken(state.turnIndex, state.revision);
  return state;
}

export function getActiveYahtzeePlayer(state: YahtzeeHostState): YahtzeePlayerState {
  return state.players[state.activePlayerIndex] || state.players[0];
}

export function isYahtzeeSeatLocallyControlled(state: YahtzeeHostState): boolean {
  if (state.mode === "local2") {
    return state.activeSeatId === "user" || state.activeSeatId === "local2";
  }
  return state.activeSeatId === state.localSeatId;
}

export function refreshYahtzeeDerivedState(state: YahtzeeHostState): YahtzeeHostState {
  state.players = state.players.map((player) => refreshPlayer(player));
  if (state.players.length === 0) {
    state.players = createPlayersForMode(state.mode);
  }
  state.activePlayerIndex = Math.max(0, Math.min(state.activePlayerIndex, state.players.length - 1));
  const activePlayer = getActiveYahtzeePlayer(state);
  state.activeSeatId = activePlayer.seatId;
  state.card = activePlayer.card;
  state.upperSubtotal = activePlayer.upperSubtotal;
  state.upperBonus = activePlayer.upperBonus;
  state.total = activePlayer.total;
  state.complete = state.players.every((player) => player.complete === true);
  state.active = state.active === true && state.complete === false;
  state.winnerSeatId = state.complete ? determineWinner(state.players) : null;
  state.result = state.complete
    ? state.players.length > 1 && state.winnerSeatId === null
      ? "draw"
      : "complete"
    : state.active
      ? "pending"
      : "idle";
  return state;
}

export function advanceYahtzeePlayer(state: YahtzeeHostState): YahtzeeHostState {
  if (state.players.length <= 1) return refreshYahtzeeDerivedState(state);
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const nextIndex = (state.activePlayerIndex + offset) % state.players.length;
    if (state.players[nextIndex]?.complete !== true) {
      state.activePlayerIndex = nextIndex;
      break;
    }
  }
  return refreshYahtzeeDerivedState(state);
}

export function bumpYahtzeeRevision(state: YahtzeeHostState): YahtzeeHostState {
  state.revision += 1;
  state.turnToken = createYahtzeeTurnToken(state.turnIndex, state.revision);
  return state;
}

export function normalizeYahtzeeState(candidate: unknown): YahtzeeHostState {
  const source = isRecord(candidate) ? candidate : {};
  const mode = sanitizeMode(source["mode"]);
  const opponentSeatId = opponentSeatForMode(mode);
  const rawPlayers = Array.isArray(source["players"]) ? source["players"] : [];
  let players: YahtzeePlayerState[];

  if (rawPlayers.length > 0) {
    players = [sanitizePlayer(rawPlayers[0], "user")];
    if (opponentSeatId !== null) {
      players.push(sanitizePlayer(rawPlayers[1], opponentSeatId));
      players[1].seatId = opponentSeatId;
    }
    players[0].seatId = "user";
  } else {
    players = createPlayersForMode(mode);
    if (isRecord(source["card"])) {
      players[0].card = sanitizeCard(source["card"]);
      refreshPlayer(players[0]);
    }
  }

  const complete = players.every((player) => player.complete === true);
  const rawActivePlayerIndex =
    typeof source["activePlayerIndex"] === "number" && Number.isInteger(source["activePlayerIndex"])
      ? source["activePlayerIndex"]
      : 0;
  const activePlayerIndex = Math.max(0, Math.min(rawActivePlayerIndex, players.length - 1));
  const activePlayer = players[activePlayerIndex] || players[0];
  const revision =
    typeof source["revision"] === "number" && Number.isInteger(source["revision"]) && source["revision"] >= 0
      ? source["revision"]
      : 0;
  const turnIndex =
    typeof source["turnIndex"] === "number" && Number.isInteger(source["turnIndex"]) && source["turnIndex"] >= 0
      ? source["turnIndex"]
      : 0;
  const localSeatId = source["localSeatId"] === "us1" ? "us1" : "user";
  const state: YahtzeeHostState = {
    schemaVersion: YAHTZEE_SCHEMA_VERSION,
    mode,
    matchId: readString(source["matchId"]),
    revision,
    localSeatId,
    opponentSeatId,
    remoteUserId: readString(source["remoteUserId"]),
    localSessionId: readString(source["localSessionId"]),
    active: source["active"] === true && complete === false,
    complete,
    players,
    activePlayerIndex,
    activeSeatId: activePlayer.seatId,
    turnIndex,
    turnToken: readString(source["turnToken"]) || createYahtzeeTurnToken(turnIndex, revision),
    turn: sanitizeTurn(source["turn"]),
    result: "idle",
    winnerSeatId: null,
    card: activePlayer.card,
    upperSubtotal: activePlayer.upperSubtotal,
    upperBonus: activePlayer.upperBonus,
    total: activePlayer.total,
    status: typeof source["status"] === "string" ? source["status"] : "ready",
  };
  return refreshYahtzeeDerivedState(state);
}

export function loadYahtzeeState(api: YahtzeeStateApi): YahtzeeHostState {
  return normalizeYahtzeeState(api.getState(STATE_KEY));
}

export function saveYahtzeeState(api: YahtzeeStateApi, state: YahtzeeHostState): YahtzeeHostState {
  const normalized = normalizeYahtzeeState(state);
  api.setState(STATE_KEY, normalized);
  return normalized;
}
