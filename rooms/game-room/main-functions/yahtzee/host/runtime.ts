import {
  YAHTZEE_CATEGORIES,
  buildYahtzeeLegalActionIds,
  createEmptyTurn,
  parseYahtzeeHoldMask,
  rollYahtzeeDice,
  scoreYahtzeeCategory,
  type YahtzeeCategory,
} from "./engine.js";
import {
  advanceYahtzeePlayer,
  bumpYahtzeeRevision,
  createInitialYahtzeeState,
  createYahtzeeMatchState,
  getActiveYahtzeePlayer,
  isYahtzeeSeatLocallyControlled,
  loadYahtzeeState,
  normalizeYahtzeeState,
  refreshYahtzeeDerivedState,
  saveYahtzeeState,
  type YahtzeeHostState,
  type YahtzeeMode,
  type YahtzeeSeatId,
  type YahtzeeStateApi,
} from "./state.js";
import { loadContext } from "../../../shared/host/context-state.js";
import {
  readArgs,
  readRemoteUserId,
  readTurnIndex,
  readTurnToken,
} from "../../../shared/host/command-args.js";
import {
  sendYahtzeeAiTurn,
  sendYahtzeeUs1Reset,
  sendYahtzeeUs1Start,
  sendYahtzeeUs1Sync,
} from "./transport.js";

export const YAHTZEE_COMMAND_NAMES = {
  start: "GameRoomYahtzeeStart",
  reset: "GameRoomYahtzeeReset",
  roll: "GameRoomYahtzeeRoll",
  toggleHold: "GameRoomYahtzeeToggleHold",
  score: "GameRoomYahtzeeScore",
  aiAction: "GameRoomYahtzeeAiAction",
  remoteStart: "GameRoomYahtzeeRemoteStart",
  remoteSync: "GameRoomYahtzeeRemoteSync",
  remoteReset: "GameRoomYahtzeeRemoteReset",
} as const;

const EXPECTED_COMMAND_CAPTURE_STATE_KEY = "room.expectedCommandCapture";

interface YahtzeeRuntimeApi extends YahtzeeStateApi {
  notifyRoom?(eventType: string, data: unknown): void;
  dispatchBridge?(options: Record<string, unknown>): Promise<unknown> | unknown;
  deleteState?(key: string): void;
  showToast?(payload: { type?: "success" | "error" | "info" | "warning"; message: string }): void;
  log?(level: "debug" | "info" | "warn" | "error", message: string): void;
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

function clearExpectedAiCommand(api: YahtzeeRuntimeApi): void {
  if (typeof api.deleteState === "function") {
    api.deleteState(EXPECTED_COMMAND_CAPTURE_STATE_KEY);
    return;
  }
  api.setState(EXPECTED_COMMAND_CAPTURE_STATE_KEY, null);
}

function setExpectedAiCommand(api: YahtzeeRuntimeApi, provider: "ai1" | "ai2"): void {
  api.setState(EXPECTED_COMMAND_CAPTURE_STATE_KEY, {
    provider,
    commandName: YAHTZEE_COMMAND_NAMES.aiAction,
    message: "Yahtzee AI turn did not return a valid room command.",
  });
}

function readIndex(payload: unknown): number | null {
  const source = readArgs(payload);
  const value = source["index"];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 5
    ? value
    : null;
}

function readCategory(payload: unknown): YahtzeeCategory | null {
  const source = readArgs(payload);
  const value = source["category"];
  return typeof value === "string" && YAHTZEE_CATEGORIES.includes(value as YahtzeeCategory)
    ? (value as YahtzeeCategory)
    : null;
}

function readMode(payload: unknown): YahtzeeMode {
  const value = readArgs(payload)["mode"];
  return value === "local2" || value === "ai1" || value === "ai2" || value === "us1"
    ? value
    : "solo";
}

function readLegalActionId(payload: unknown): string | null {
  const value = readArgs(payload)["legalActionId"];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readMatchId(payload: unknown): string | null {
  const value = readArgs(payload)["matchId"];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readRevision(payload: unknown): number | null {
  const value = readArgs(payload)["revision"];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readSnapshot(payload: unknown): Record<string, unknown> | null {
  const value = readArgs(payload)["snapshot"];
  return isRecord(value) ? value : null;
}

function readProvider(payload: unknown): string {
  return isRecord(payload) && typeof payload["provider"] === "string"
    ? payload["provider"].trim()
    : "";
}

function readPlayerLabels(state: YahtzeeHostState): Partial<Record<YahtzeeSeatId, string>> {
  const labels: Partial<Record<YahtzeeSeatId, string>> = {};
  for (const player of state.players) labels[player.seatId] = player.label;
  return labels;
}

function getModeLabels(
  api: YahtzeeRuntimeApi,
  mode: YahtzeeMode
): Partial<Record<YahtzeeSeatId, string>> {
  const context = loadContext(api);
  const labels: Partial<Record<YahtzeeSeatId, string>> = {
    user: context.user.nickname || "Player 1",
    local2: "Player 2",
  };
  if (mode === "ai1" || mode === "ai2" || mode === "us1") {
    labels[mode] = context.slots[mode].nickname || mode.toUpperCase();
  }
  return labels;
}

function canStartMode(api: YahtzeeRuntimeApi, mode: YahtzeeMode): boolean {
  if (mode === "solo" || mode === "local2") return true;
  const context = loadContext(api);
  return context.slots[mode].dispatchable === true;
}

function prepareFirstRoll(state: YahtzeeHostState, status = "firstRoll"): YahtzeeHostState {
  state.turn = rollYahtzeeDice(createEmptyTurn());
  state.status = status;
  return refreshYahtzeeDerivedState(state);
}

async function syncUs1State(api: YahtzeeRuntimeApi, state: YahtzeeHostState): Promise<boolean> {
  if (state.mode !== "us1") return true;
  const sendResult = await sendYahtzeeUs1Sync(api, state);
  if (sendResult.success !== true) {
    state.status = "syncFailed";
    pushState(api, state);
    api.showToast?.({ type: "warning", message: "Yahtzee US1 synchronization failed." });
    return false;
  }
  if (sendResult.localSessionId) state.localSessionId = sendResult.localSessionId;
  if (sendResult.remoteUserId) state.remoteUserId = sendResult.remoteUserId;
  pushState(api, state);
  return true;
}

async function dispatchAiTurnIfNeeded(
  api: YahtzeeRuntimeApi,
  state: YahtzeeHostState
): Promise<boolean> {
  if (state.activeSeatId !== "ai1" && state.activeSeatId !== "ai2") {
    clearExpectedAiCommand(api);
    return true;
  }
  state.status = "aiThinking";
  pushState(api, state);
  const sendResult = await sendYahtzeeAiTurn(api, state);
  if (sendResult.success !== true) {
    clearExpectedAiCommand(api);
    state.status = "blockedOpponent";
    pushState(api, state);
    api.showToast?.({ type: "warning", message: "Selected Yahtzee AI opponent is unavailable." });
    return false;
  }
  setExpectedAiCommand(api, state.activeSeatId);
  return true;
}

function finishScoringTurn(state: YahtzeeHostState): YahtzeeHostState {
  refreshYahtzeeDerivedState(state);
  if (state.complete) {
    state.active = false;
    state.status = "complete";
    bumpYahtzeeRevision(state);
    return refreshYahtzeeDerivedState(state);
  }

  advanceYahtzeePlayer(state);
  state.turn = rollYahtzeeDice(createEmptyTurn());
  state.status =
    state.activeSeatId === "ai1" || state.activeSeatId === "ai2" ? "aiThinking" : "newTurn";
  bumpYahtzeeRevision(state);
  return refreshYahtzeeDerivedState(state);
}

export function initializeYahtzeeState(api: YahtzeeRuntimeApi): void {
  saveYahtzeeState(api, loadYahtzeeState(api));
}

export function pushYahtzeeState(api: YahtzeeRuntimeApi): YahtzeeHostState {
  return pushState(api, loadYahtzeeState(api));
}

export async function handleYahtzeeStart(
  api: YahtzeeRuntimeApi,
  payload: unknown = {}
): Promise<unknown> {
  clearExpectedAiCommand(api);
  const mode = readMode(payload);
  if (!canStartMode(api, mode)) {
    return result(false, `The selected Yahtzee opponent (${mode}) is not ready.`);
  }

  const context = loadContext(api);
  const state = createYahtzeeMatchState(mode, {
    localSeatId: "user",
    labels: getModeLabels(api, mode),
  });
  prepareFirstRoll(state);

  if (mode === "us1") {
    state.remoteUserId = context.slots.us1.remoteUserId || null;
    if (!state.remoteUserId) {
      return result(false, "A connected US1 remote user is required for online Yahtzee.");
    }
    const sendResult = await sendYahtzeeUs1Start(api, state);
    if (sendResult.success !== true) {
      return result(false, "The US1 Yahtzee match could not be started.");
    }
    if (sendResult.localSessionId) state.localSessionId = sendResult.localSessionId;
    if (sendResult.remoteUserId) state.remoteUserId = sendResult.remoteUserId;
  }

  pushState(api, state);
  return result(
    true,
    mode === "solo" ? "Yahtzee game started." : "Two-player Yahtzee match started."
  );
}

export async function handleYahtzeeReset(api: YahtzeeRuntimeApi): Promise<unknown> {
  clearExpectedAiCommand(api);
  const current = loadYahtzeeState(api);
  let remoteResetSuccess = true;
  if (current.mode === "us1" && current.matchId) {
    remoteResetSuccess = (await sendYahtzeeUs1Reset(api, current)).success === true;
  }
  const reset = createInitialYahtzeeState(
    current.mode,
    current.localSeatId,
    readPlayerLabels(current)
  );
  pushState(api, reset);
  return result(
    remoteResetSuccess,
    remoteResetSuccess
      ? "Yahtzee game reset."
      : "Yahtzee reset locally; US1 reset delivery failed."
  );
}

export async function handleYahtzeeRoll(api: YahtzeeRuntimeApi): Promise<unknown> {
  const state = loadYahtzeeState(api);
  if (!state.active || state.complete) return result(false, "There is no active Yahtzee turn.");
  if (!isYahtzeeSeatLocallyControlled(state))
    return result(false, "Wait for the other Yahtzee player.");
  if (state.turn.rollCount >= 3) return result(false, "No rerolls remain for this turn.");
  state.turn = rollYahtzeeDice(state.turn);
  state.status = state.turn.rollCount >= 3 ? "finalRoll" : "chooseDiceOrScore";
  bumpYahtzeeRevision(state);
  const saved = pushState(api, state);
  const synced = await syncUs1State(api, saved);
  return result(synced, synced ? "Dice rolled." : "Dice rolled locally, but US1 sync failed.");
}

export async function handleYahtzeeToggleHold(
  api: YahtzeeRuntimeApi,
  payload: unknown
): Promise<unknown> {
  const state = loadYahtzeeState(api);
  const index = readIndex(payload);
  if (!state.active || state.complete || state.turn.rollCount === 0)
    return result(false, "Roll before holding dice.");
  if (!isYahtzeeSeatLocallyControlled(state))
    return result(false, "Wait for the other Yahtzee player.");
  if (index === null) return result(false, "Invalid die index.");
  if (state.turn.rollCount >= 3)
    return result(false, "The final roll is already complete.");
  state.turn.held[index] = !state.turn.held[index];
  bumpYahtzeeRevision(state);
  const saved = pushState(api, state);
  const synced = await syncUs1State(api, saved);
  return result(
    synced,
    synced
      ? state.turn.held[index]
        ? "Die held."
        : "Die released."
      : "Hold changed locally, but US1 sync failed."
  );
}

export async function handleYahtzeeScore(
  api: YahtzeeRuntimeApi,
  payload: unknown
): Promise<unknown> {
  const state = loadYahtzeeState(api);
  const category = readCategory(payload);
  if (!state.active || state.complete || state.turn.rollCount === 0)
    return result(false, "Roll before scoring.");
  if (!isYahtzeeSeatLocallyControlled(state))
    return result(false, "Wait for the other Yahtzee player.");
  if (category === null) return result(false, "Unknown Yahtzee category.");

  const player = getActiveYahtzeePlayer(state);
  if (typeof player.card.scores[category] === "number")
    return result(false, "That category is already filled.");

  player.card.scores[category] = scoreYahtzeeCategory(category, state.turn.dice);
  state.turnIndex += 1;
  finishScoringTurn(state);
  const saved = pushState(api, state);

  if (saved.complete) {
    clearExpectedAiCommand(api);
    await syncUs1State(api, saved);
    api.showToast?.({
      type: "success",
      message:
        saved.players.length === 1
          ? `Yahtzee complete: ${saved.players[0]?.total ?? saved.total} points.`
          : saved.winnerSeatId
            ? `${saved.players.find((entry) => entry.seatId === saved.winnerSeatId)?.label || saved.winnerSeatId} wins Yahtzee.`
            : "Yahtzee match ended in a draw.",
    });
    return result(true, `Scored ${category}.`);
  }

  if (saved.mode === "us1") {
    const synced = await syncUs1State(api, saved);
    return result(
      synced,
      synced ? `Scored ${category}.` : "Score saved locally, but US1 sync failed."
    );
  }

  if (saved.activeSeatId === "ai1" || saved.activeSeatId === "ai2") {
    const dispatched = await dispatchAiTurnIfNeeded(api, saved);
    return result(
      dispatched,
      dispatched ? `Scored ${category}. AI turn dispatched.` : "Score saved, but AI dispatch failed."
    );
  }

  return result(true, `Scored ${category}.`);
}

export async function handleYahtzeeAiAction(
  api: YahtzeeRuntimeApi,
  payload: unknown
): Promise<unknown> {
  const state = loadYahtzeeState(api);
  const provider = readProvider(payload);
  const legalActionId = readLegalActionId(payload);
  const turnToken = readTurnToken(payload);
  const turnIndex = readTurnIndex(payload);

  if (!state.active || (state.activeSeatId !== "ai1" && state.activeSeatId !== "ai2"))
    return result(false, "There is no active Yahtzee AI turn.");
  if (provider && provider !== state.activeSeatId)
    return result(false, "Yahtzee AI provider mismatch.");
  if (turnToken !== state.turnToken || turnIndex !== state.turnIndex)
    return result(false, "Stale Yahtzee AI action.");

  const player = getActiveYahtzeePlayer(state);
  const legalActionIds = buildYahtzeeLegalActionIds(state.turn, player.card);
  if (!legalActionId || !legalActionIds.includes(legalActionId))
    return result(false, "Invalid Yahtzee legalActionId.");

  clearExpectedAiCommand(api);
  if (legalActionId.startsWith("reroll:")) {
    const held = parseYahtzeeHoldMask(legalActionId.slice("reroll:".length));
    if (!held) return result(false, "Invalid Yahtzee hold mask.");
    state.turn.held = held;
    state.turn = rollYahtzeeDice(state.turn);
    state.status = state.turn.rollCount >= 3 ? "finalRoll" : "aiThinking";
    bumpYahtzeeRevision(state);
    const saved = pushState(api, state);
    const dispatched = await dispatchAiTurnIfNeeded(api, saved);
    return result(
      dispatched,
      dispatched ? "AI reroll applied." : "AI reroll applied, but next dispatch failed."
    );
  }

  const category = legalActionId.slice("score:".length) as YahtzeeCategory;
  if (!YAHTZEE_CATEGORIES.includes(category))
    return result(false, "Invalid Yahtzee score action.");
  player.card.scores[category] = scoreYahtzeeCategory(category, state.turn.dice);
  state.turnIndex += 1;
  finishScoringTurn(state);
  const saved = pushState(api, state);
  clearExpectedAiCommand(api);
  if (saved.complete) {
    api.showToast?.({
      type: "success",
      message: saved.winnerSeatId
        ? `${saved.players.find((entry) => entry.seatId === saved.winnerSeatId)?.label || saved.winnerSeatId} wins Yahtzee.`
        : "Yahtzee match ended in a draw.",
    });
  }
  return result(true, `AI scored ${category}.`);
}

export function handleYahtzeeRemoteStart(api: YahtzeeRuntimeApi, payload: unknown): unknown {
  clearExpectedAiCommand(api);
  const snapshot = readSnapshot(payload);
  const matchId = readMatchId(payload);
  const current = loadYahtzeeState(api);
  if (!snapshot || !matchId) return result(false, "Invalid remote Yahtzee start payload.");
  if (current.active && current.matchId && current.matchId !== matchId)
    return result(false, "Another Yahtzee match is already active.");

  const context = loadContext(api);
  const remoteUserId = readRemoteUserId(payload) || context.slots.us1.remoteUserId || null;
  const mirrored = normalizeYahtzeeState({
    ...snapshot,
    mode: "us1",
    matchId,
    localSeatId: "us1",
    remoteUserId,
    localSessionId: null,
  });
  mirrored.status = mirrored.activeSeatId === mirrored.localSeatId ? "newTurn" : "waitOpponent";
  pushState(api, mirrored);
  api.showToast?.({ type: "info", message: "Incoming US1 Yahtzee match started." });
  return result(true, "Remote Yahtzee match started.");
}

export function handleYahtzeeRemoteSync(api: YahtzeeRuntimeApi, payload: unknown): unknown {
  const current = loadYahtzeeState(api);
  const snapshot = readSnapshot(payload);
  const matchId = readMatchId(payload);
  const revision = readRevision(payload);
  if (current.mode !== "us1" || !current.matchId || current.matchId !== matchId)
    return result(false, "Remote Yahtzee match mismatch.");
  if (!snapshot || revision === null || revision <= current.revision)
    return result(false, "Stale remote Yahtzee synchronization.");

  const incomingRemoteUserId = readRemoteUserId(payload);
  if (
    current.remoteUserId &&
    incomingRemoteUserId &&
    current.remoteUserId !== incomingRemoteUserId
  )
    return result(false, "Remote Yahtzee user mismatch.");

  const mirrored = normalizeYahtzeeState({
    ...snapshot,
    mode: "us1",
    matchId: current.matchId,
    localSeatId: current.localSeatId,
    remoteUserId: current.remoteUserId || incomingRemoteUserId,
    localSessionId: current.localSessionId,
  });
  if (!mirrored.complete) {
    mirrored.status =
      mirrored.activeSeatId === mirrored.localSeatId ? mirrored.status : "waitOpponent";
  }
  pushState(api, mirrored);
  return result(true, "Remote Yahtzee state synchronized.");
}

export function handleYahtzeeRemoteReset(api: YahtzeeRuntimeApi, payload: unknown): unknown {
  clearExpectedAiCommand(api);
  const current = loadYahtzeeState(api);
  const matchId = readMatchId(payload);
  if (!current.matchId || current.matchId !== matchId)
    return result(false, "Remote Yahtzee reset does not match the active match.");
  const reset = createInitialYahtzeeState("us1", current.localSeatId, readPlayerLabels(current));
  reset.remoteUserId = current.remoteUserId;
  reset.localSessionId = current.localSessionId;
  pushState(api, reset);
  api.showToast?.({
    type: "info",
    message: "US1 Yahtzee match was reset by the remote player.",
  });
  return result(true, "Remote Yahtzee match reset.");
}
