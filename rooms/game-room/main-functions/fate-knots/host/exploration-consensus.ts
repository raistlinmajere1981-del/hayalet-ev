import type { FateKnotsRunState, FateKnotsSeatId, FateKnotsUniversePackage } from "../shared/contracts.js";
import {
  getFateKnotsLegalStoryTransitions,
  type FateKnotsStoryTransitionView,
} from "../shared/story-progression.js";
import type { FateKnotsPersistenceApi } from "./persistence.js";

const EXPLORATION_CONSENSUS_KEY = "fate-knots:exploration-consensus-v1";
const MAX_MESSAGES = 80;
const MAX_MESSAGE_LENGTH = 2000;
const PLAYER_SEATS = new Set<FateKnotsSeatId>(["user", "ai2", "us1"]);

export interface FateKnotsExplorationMessage {
  messageId: string;
  seatId: FateKnotsSeatId;
  text: string;
}

export interface FateKnotsExplorationChoice {
  seatId: FateKnotsSeatId;
  transitionId: string | null;
}

export interface FateKnotsExplorationConsensusProjection {
  runId: string;
  activeKnotId: string;
  activeLocationId: string | null;
  activeSeatIds: FateKnotsSeatId[];
  availableTransitions: FateKnotsStoryTransitionView[];
  choices: FateKnotsExplorationChoice[];
  messages: FateKnotsExplorationMessage[];
  unanimousTransitionId: string | null;
}

interface FateKnotsExplorationConsensusHotState {
  runId: string;
  activeKnotId: string;
  activeLocationId: string | null;
  nextMessageIndex: number;
  choices: FateKnotsExplorationChoice[];
  messages: FateKnotsExplorationMessage[];
}

export type FateKnotsExplorationConsensusIssueCode =
  | "exploration-unavailable"
  | "seat-not-active"
  | "seat-ambiguous"
  | "message-empty"
  | "message-too-long"
  | "transition-not-legal";

export interface FateKnotsExplorationConsensusIssue {
  code: FateKnotsExplorationConsensusIssueCode;
  seatId?: FateKnotsSeatId;
  transitionId?: string;
}

export type FateKnotsExplorationConsensusResult =
  | { ok: true; state: FateKnotsExplorationConsensusProjection; issues: [] }
  | { ok: false; state: null; issues: FateKnotsExplorationConsensusIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneHotState(state: FateKnotsExplorationConsensusHotState): FateKnotsExplorationConsensusHotState {
  return structuredClone(state);
}

function currentScope(run: FateKnotsRunState): {
  runId: string;
  activeKnotId: string;
  activeLocationId: string | null;
} | null {
  if (
    run.result !== "active" ||
    run.phase !== "exploration" ||
    run.activeCombat !== null ||
    run.activeStoryTransitionId !== null ||
    run.activeKnotId === null
  ) {
    return null;
  }
  return {
    runId: run.runId,
    activeKnotId: run.activeKnotId,
    activeLocationId: run.activeLocationId,
  };
}

function sameScope(
  state: FateKnotsExplorationConsensusHotState,
  scope: NonNullable<ReturnType<typeof currentScope>>
): boolean {
  return (
    state.runId === scope.runId &&
    state.activeKnotId === scope.activeKnotId &&
    state.activeLocationId === scope.activeLocationId
  );
}

function readHotState(value: unknown): FateKnotsExplorationConsensusHotState | null {
  if (!isRecord(value)) return null;
  const runId = typeof value["runId"] === "string" ? value["runId"] : "";
  const activeKnotId = typeof value["activeKnotId"] === "string" ? value["activeKnotId"] : "";
  const activeLocationId =
    value["activeLocationId"] === null
      ? null
      : typeof value["activeLocationId"] === "string"
        ? value["activeLocationId"]
        : undefined;
  const nextMessageIndex = value["nextMessageIndex"];
  if (
    runId === "" ||
    activeKnotId === "" ||
    activeLocationId === undefined ||
    typeof nextMessageIndex !== "number" ||
    !Number.isInteger(nextMessageIndex) ||
    nextMessageIndex < 0 ||
    !Array.isArray(value["choices"]) ||
    !Array.isArray(value["messages"])
  ) {
    return null;
  }

  const choices: FateKnotsExplorationChoice[] = [];
  for (const entry of value["choices"]) {
    if (!isRecord(entry)) continue;
    const seatId = entry["seatId"];
    const transitionId = entry["transitionId"];
    if (!PLAYER_SEATS.has(seatId as FateKnotsSeatId)) continue;
    if (transitionId !== null && typeof transitionId !== "string") continue;
    choices.push({ seatId: seatId as FateKnotsSeatId, transitionId });
  }

  const messages: FateKnotsExplorationMessage[] = [];
  for (const entry of value["messages"]) {
    if (!isRecord(entry)) continue;
    const messageId = entry["messageId"];
    const seatId = entry["seatId"];
    const text = entry["text"];
    if (
      typeof messageId !== "string" ||
      !PLAYER_SEATS.has(seatId as FateKnotsSeatId) ||
      typeof text !== "string"
    ) {
      continue;
    }
    messages.push({ messageId, seatId: seatId as FateKnotsSeatId, text });
  }

  return {
    runId,
    activeKnotId,
    activeLocationId,
    nextMessageIndex,
    choices,
    messages: messages.slice(-MAX_MESSAGES),
  };
}

function createHotState(
  scope: NonNullable<ReturnType<typeof currentScope>>
): FateKnotsExplorationConsensusHotState {
  return {
    ...scope,
    nextMessageIndex: 0,
    choices: [],
    messages: [],
  };
}

function loadScopedHotState(
  api: FateKnotsPersistenceApi,
  run: FateKnotsRunState
): FateKnotsExplorationConsensusHotState | null {
  const scope = currentScope(run);
  if (!scope) return null;
  const stored = readHotState(api.getState(EXPLORATION_CONSENSUS_KEY));
  return stored && sameScope(stored, scope) ? stored : createHotState(scope);
}

function activePlayerSeats(
  run: FateKnotsRunState
): { seats: FateKnotsSeatId[]; issue: FateKnotsExplorationConsensusIssue | null } {
  const partyIds = new Set(run.partyActorIds);
  const counts = new Map<FateKnotsSeatId, number>();
  for (const actor of run.actors) {
    if (!partyIds.has(actor.actorId) || !actor.seatId || !PLAYER_SEATS.has(actor.seatId)) continue;
    counts.set(actor.seatId, (counts.get(actor.seatId) ?? 0) + 1);
  }
  for (const [seatId, count] of counts) {
    if (count > 1) return { seats: [], issue: { code: "seat-ambiguous", seatId } };
  }
  const seats = (["user", "ai2", "us1"] as FateKnotsSeatId[]).filter(
    (seatId) => counts.get(seatId) === 1
  );
  return { seats, issue: null };
}

function legalTransitionViews(
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): FateKnotsStoryTransitionView[] {
  return getFateKnotsLegalStoryTransitions(universe, run).map((transition) => ({
    id: transition.id,
    label: transition.label,
    kind: transition.kind,
  }));
}

function normalizeChoices(
  hot: FateKnotsExplorationConsensusHotState,
  activeSeatIds: FateKnotsSeatId[],
  availableTransitions: FateKnotsStoryTransitionView[]
): FateKnotsExplorationChoice[] {
  const legal = new Set(availableTransitions.map((transition) => transition.id));
  const bySeat = new Map(hot.choices.map((choice) => [choice.seatId, choice.transitionId] as const));
  return activeSeatIds.map((seatId) => {
    const current = bySeat.get(seatId) ?? null;
    return { seatId, transitionId: current !== null && legal.has(current) ? current : null };
  });
}

function unanimousTransitionId(choices: FateKnotsExplorationChoice[]): string | null {
  if (choices.length === 0) return null;
  const first = choices[0]?.transitionId ?? null;
  if (first === null) return null;
  return choices.every((choice) => choice.transitionId === first) ? first : null;
}

function project(
  api: FateKnotsPersistenceApi,
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  hotInput?: FateKnotsExplorationConsensusHotState
): FateKnotsExplorationConsensusResult {
  const hot = hotInput ?? loadScopedHotState(api, run);
  if (!hot) return { ok: false, state: null, issues: [{ code: "exploration-unavailable" }] };
  const seatResult = activePlayerSeats(run);
  if (seatResult.issue) return { ok: false, state: null, issues: [seatResult.issue] };
  const availableTransitions = legalTransitionViews(universe, run);
  const choices = normalizeChoices(hot, seatResult.seats, availableTransitions);
  const normalizedHot = cloneHotState(hot);
  normalizedHot.choices = choices;
  api.setState(EXPLORATION_CONSENSUS_KEY, normalizedHot);
  return {
    ok: true,
    state: {
      runId: hot.runId,
      activeKnotId: hot.activeKnotId,
      activeLocationId: hot.activeLocationId,
      activeSeatIds: seatResult.seats,
      availableTransitions,
      choices,
      messages: hot.messages.slice(),
      unanimousTransitionId: unanimousTransitionId(choices),
    },
    issues: [],
  };
}

export function getFateKnotsExplorationConsensus(
  api: FateKnotsPersistenceApi,
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState
): FateKnotsExplorationConsensusResult {
  return project(api, universe, run);
}

export function appendFateKnotsExplorationMessage(
  api: FateKnotsPersistenceApi,
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  seatId: FateKnotsSeatId,
  textInput: string
): FateKnotsExplorationConsensusResult {
  const hot = loadScopedHotState(api, run);
  if (!hot) return { ok: false, state: null, issues: [{ code: "exploration-unavailable" }] };
  const seats = activePlayerSeats(run);
  if (seats.issue) return { ok: false, state: null, issues: [seats.issue] };
  if (!seats.seats.includes(seatId)) {
    return { ok: false, state: null, issues: [{ code: "seat-not-active", seatId }] };
  }
  const text = textInput.trim();
  if (text === "") return { ok: false, state: null, issues: [{ code: "message-empty", seatId }] };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, state: null, issues: [{ code: "message-too-long", seatId }] };
  }
  hot.messages.push({
    messageId: `${run.runId}:exploration:${hot.nextMessageIndex}`,
    seatId,
    text,
  });
  hot.nextMessageIndex += 1;
  hot.messages = hot.messages.slice(-MAX_MESSAGES);
  api.setState(EXPLORATION_CONSENSUS_KEY, hot);
  return project(api, universe, run, hot);
}

export function chooseFateKnotsExplorationTransition(
  api: FateKnotsPersistenceApi,
  universe: FateKnotsUniversePackage,
  run: FateKnotsRunState,
  seatId: FateKnotsSeatId,
  transitionId: string | null
): FateKnotsExplorationConsensusResult {
  const hot = loadScopedHotState(api, run);
  if (!hot) return { ok: false, state: null, issues: [{ code: "exploration-unavailable" }] };
  const seats = activePlayerSeats(run);
  if (seats.issue) return { ok: false, state: null, issues: [seats.issue] };
  if (!seats.seats.includes(seatId)) {
    return { ok: false, state: null, issues: [{ code: "seat-not-active", seatId }] };
  }
  const legal = new Set(getFateKnotsLegalStoryTransitions(universe, run).map((entry) => entry.id));
  if (transitionId !== null && !legal.has(transitionId)) {
    return {
      ok: false,
      state: null,
      issues: [{ code: "transition-not-legal", seatId, transitionId }],
    };
  }
  const bySeat = new Map(hot.choices.map((choice) => [choice.seatId, choice.transitionId] as const));
  bySeat.set(seatId, transitionId);
  hot.choices = seats.seats.map((activeSeatId) => ({
    seatId: activeSeatId,
    transitionId: bySeat.get(activeSeatId) ?? null,
  }));
  api.setState(EXPLORATION_CONSENSUS_KEY, hot);
  return project(api, universe, run, hot);
}

export function clearFateKnotsExplorationConsensus(api: FateKnotsPersistenceApi): void {
  api.setState(EXPLORATION_CONSENSUS_KEY, null);
}
