import { loadContext, readLocale } from "../../../shared/host/context-state.js";
import { fillTemplate, normalizeText, translate } from "../../../shared/host/text.js";
import {
  FATE_KNOTS_COMMAND_COPY,
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SUPPORTED_AI_SEATS,
} from "./constants.js";
import {
  applyFateKnotsCombatAction,
  buildFateKnotsCombatTurnId,
  getCurrentFateKnotsCombatTurn,
  settleAutomaticFateKnotsCombatTurns,
  type FateKnotsEnemyAction,
} from "./combat-engine.js";
import type { FateKnotsCombatState } from "./combat-engine.js";
import {
  readFateKnotsChoicePayload,
  readFateKnotsCombatPayload,
  readFateKnotsDmPacketPayload,
  readFateKnotsNpcBanterPayload,
  readFateKnotsSelectionPayload,
  readFateKnotsSyncPayload,
  resolveFateKnotsSeatId,
} from "./payloads.js";
import {
  loadFateKnotsProfile,
  loadFateKnotsSaveSlot,
  loadFateKnotsState,
  pushFateKnotsState,
  refreshFateKnotsState,
  resetFateKnotsState,
  saveFateKnotsSaveSlot,
} from "./state.js";
import { createFateKnotsPromptRuntime } from "./prompt-runtime.js";
import { createFateKnotsPhaseRuntime } from "./phase-runtime.js";
import {
  applySelectionPayload,
  buildRunParticipants,
  buildSessionId,
  clearAmbientPromptKeys,
  clearCombatPromptKey,
  clearDecisionPromptKey,
  ensureFateKnotsContent,
  getParticipant,
  getUs1RemoteUserId,
  getUserParticipant,
  isSelectionComplete,
  listPendingDecisionSeats,
  markDesync,
  maybeMarkSeatLossOrTimeout,
  persistProfileFromUser,
  persistRunSummary,
  resetPromptDispatchState,
  sanitizePacketText,
  setCombatWaiting,
  setDecisionWaiting,
  setIdleWaiting,
  updateContentSummary,
  updateTransportFromSendResult,
  validateSelectionPayload,
} from "./session-support.js";

type RoomApi = {
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  getLocale?: () => unknown;
  notifyRoom?: (eventType: string, data: unknown) => void;
};

type FateKnotsCommandState = Parameters<typeof pushFateKnotsState>[1];
type FateKnotsBaseContentRegistry = Parameters<typeof pushFateKnotsState>[2];
type FateKnotsPromptRuntimeDeps = Parameters<typeof createFateKnotsPromptRuntime>[0];
type FateKnotsPhaseRuntimeDeps = Parameters<typeof createFateKnotsPhaseRuntime>[0];
type FateKnotsSessionState = Parameters<typeof updateContentSummary>[0];
type FateKnotsSummaryContentRegistry = Parameters<typeof updateContentSummary>[1];
type FateKnotsProfileState = Parameters<typeof persistProfileFromUser>[1];
type FateKnotsPhaseState = Parameters<typeof advancePendingWork>[1];
type FateKnotsPhaseContentRegistry = Parameters<typeof advancePendingWork>[2];
type FateKnotsSelectionState = Parameters<typeof isSelectionComplete>[0];
type FateKnotsDecisionPromptState = Parameters<typeof clearDecisionPromptKey>[0];
type FateKnotsCombatPromptState = Parameters<typeof clearCombatPromptKey>[0];
type FateKnotsSeatLossState = Parameters<typeof maybeMarkSeatLossOrTimeout>[0];
type FateKnotsCombatWaitingState = Parameters<typeof setCombatWaiting>[0];

type FateKnotsCommandContentRegistry = FateKnotsBaseContentRegistry & {
  scenario: {
    entryStepId: string;
  };
  combatConfig: {
    startingEnergy: number;
  };
  enemyActionsById: Map<string, FateKnotsEnemyAction>;
};

function commandMessage(locale: string, key: string, params: Record<string, string> = {}) {
  return fillTemplate(translate(locale, FATE_KNOTS_COMMAND_COPY, key), params);
}

function asCombatState(raw: unknown): FateKnotsCombatState {
  return raw as FateKnotsCombatState;
}

function loadCommandContentRegistry(api: RoomApi): FateKnotsCommandContentRegistry {
  return ensureFateKnotsContent(api) as unknown as FateKnotsCommandContentRegistry;
}

function asCommandState(value: ReturnType<typeof loadFateKnotsState>): FateKnotsCommandState {
  return value as unknown as FateKnotsCommandState;
}

function asSessionState(value: FateKnotsCommandState): FateKnotsSessionState {
  return value as unknown as FateKnotsSessionState;
}

function asProfileState(value: FateKnotsCommandState): FateKnotsProfileState {
  return value as unknown as FateKnotsProfileState;
}

function asPhaseState(value: FateKnotsCommandState): FateKnotsPhaseState {
  return value as unknown as FateKnotsPhaseState;
}

function asPhaseContentRegistry(
  value: FateKnotsCommandContentRegistry
): FateKnotsPhaseContentRegistry {
  return value as unknown as FateKnotsPhaseContentRegistry;
}

function asSelectionState(value: Record<string, unknown>): FateKnotsSelectionState {
  return value as unknown as FateKnotsSelectionState;
}

function readUs1RemoteUserId(
  api: RoomApi,
  state: FateKnotsCommandState,
  context: Parameters<typeof getUs1RemoteUserId>[2]
) {
  return getUs1RemoteUserId(
    api as Parameters<typeof getUs1RemoteUserId>[0],
    asSessionState(state),
    context
  );
}

function persistUserProfile(api: RoomApi, state: FateKnotsCommandState) {
  persistProfileFromUser(
    api as Parameters<typeof persistProfileFromUser>[0],
    asProfileState(state)
  );
}

function refreshContentSummary(
  state: FateKnotsCommandState,
  contentRegistry: FateKnotsCommandContentRegistry
) {
  updateContentSummary(
    asSessionState(state),
    contentRegistry as unknown as FateKnotsSummaryContentRegistry
  );
}

function setCommandIdleWaiting(state: FateKnotsCommandState) {
  setIdleWaiting(asSessionState(state));
}

function clearCommandDecisionPromptKey(state: FateKnotsCommandState, seatId: string) {
  clearDecisionPromptKey(state as unknown as FateKnotsDecisionPromptState, seatId);
}

function clearCommandCombatPromptKey(state: FateKnotsCommandState, seatId: string) {
  clearCombatPromptKey(state as unknown as FateKnotsCombatPromptState, seatId);
}

function markSeatLossOrTimeout(
  state: FateKnotsCommandState,
  context: Parameters<typeof maybeMarkSeatLossOrTimeout>[1],
  now: number
) {
  maybeMarkSeatLossOrTimeout(state as unknown as FateKnotsSeatLossState, context, now);
}

function setCommandCombatWaiting(state: FateKnotsCommandState, now: number) {
  setCombatWaiting(state as unknown as FateKnotsCombatWaitingState, now);
}

const fateKnotsPromptRuntimeDeps = {
  getParticipant: getParticipant,
  listPendingDecisionSeats: listPendingDecisionSeats,
  getUs1RemoteUserId: getUs1RemoteUserId,
  updateTransportFromSendResult: updateTransportFromSendResult,
};
const fateKnotsPromptRuntime = createFateKnotsPromptRuntime(
  fateKnotsPromptRuntimeDeps as unknown as FateKnotsPromptRuntimeDeps
);
const dispatchDecisionPrompts = fateKnotsPromptRuntime.dispatchDecisionPrompts;
const dispatchCombatPrompt = fateKnotsPromptRuntime.dispatchCombatPrompt;
const dispatchAmbientPrompts = fateKnotsPromptRuntime.dispatchAmbientPrompts;

function ensureActiveSession(state: Record<string, unknown>, locale: string) {
  if (!state["active"] || !state["sessionId"]) {
    return { success: false, message: commandMessage(locale, "notActive") };
  }
  return null;
}

function validateSessionId(
  expectedSessionId: string | null,
  payloadSessionId: string | null,
  locale: string
) {
  if (payloadSessionId && expectedSessionId && payloadSessionId !== expectedSessionId) {
    return { success: false, message: commandMessage(locale, "stalePayload") };
  }
  return null;
}

const fateKnotsPhaseRuntimeDeps = {
  clearAmbientPromptKeys: clearAmbientPromptKeys,
  clearCombatPromptKey: clearCombatPromptKey,
  clearDecisionPromptKey: clearDecisionPromptKey,
  dispatchAmbientPrompts: dispatchAmbientPrompts,
  dispatchCombatPrompt: dispatchCombatPrompt,
  dispatchDecisionPrompts: dispatchDecisionPrompts,
  listPendingDecisionSeats: listPendingDecisionSeats,
  markDesync: markDesync,
  maybeMarkSeatLossOrTimeout: maybeMarkSeatLossOrTimeout,
  persistRunSummary: persistRunSummary,
  resetPromptDispatchState: resetPromptDispatchState,
  setCombatWaiting: setCombatWaiting,
  setDecisionWaiting: setDecisionWaiting,
  setIdleWaiting: setIdleWaiting,
};
const fateKnotsPhaseRuntime = createFateKnotsPhaseRuntime(
  fateKnotsPhaseRuntimeDeps as unknown as FateKnotsPhaseRuntimeDeps
);
export const advancePendingWork = fateKnotsPhaseRuntime.advancePendingWork;
const finalizeRun = fateKnotsPhaseRuntime.finalizeRun;
const getCombatStatusKey = fateKnotsPhaseRuntime.getCombatStatusKey;
export const prepareSync = fateKnotsPhaseRuntime.prepareSync;
const resolveDecisionProgress = fateKnotsPhaseRuntime.resolveDecisionProgress;
const startScenarioStep = fateKnotsPhaseRuntime.startScenarioStep;

export async function handleStart(api: RoomApi) {
  const contentRegistry = loadCommandContentRegistry(api);
  const context = loadContext(api);
  const profile = loadFateKnotsProfile(api);
  const saveSlot = loadFateKnotsSaveSlot(api);
  const readyAiSeats = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function (seatId: string) {
    const slot = context.slots[seatId as keyof typeof context.slots];
    return slot.dispatchable === true;
  });
  if (readyAiSeats.length === 0) {
    refreshFateKnotsState(api, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "needReadyCompanions") };
  }

  const sessionId = buildSessionId();
  const now = Date.now();
  const state = asCommandState(resetFateKnotsState(api, "idle"));
  const runConfig = buildRunParticipants(
    context,
    contentRegistry,
    sessionId,
    profile,
    readUs1RemoteUserId(api, state, context)
  );

  state.active = true;
  state.phase = FATE_KNOTS_PHASES.characterCreation;
  state.statusKey = "characterCreation";
  state.sessionId = sessionId;
  state.rosterLocked = true;
  state.participants = runConfig.participants;
  state.excludedSeats = runConfig.excludedSeats;
  state.transport = runConfig.transport;
  saveFateKnotsSaveSlot(api, {
    ...saveSlot,
    hasResumeData: false,
    updatedAt: now,
  });
  state.startedAt = now;
  state.updatedAt = now;
  refreshContentSummary(state, contentRegistry);
  setCommandIdleWaiting(state);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "started") };
}

export function handleReset(api: RoomApi) {
  const contentRegistry = loadCommandContentRegistry(api);
  pushFateKnotsState(api, asCommandState(resetFateKnotsState(api, "idle")), contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "reset") };
}

export function handleCharacterSelect(api: RoomApi, payload: unknown) {
  const contentRegistry = loadCommandContentRegistry(api);
  const state = asCommandState(loadFateKnotsState(api));
  const activeSession = ensureActiveSession(state, readLocale(api));
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }
  if (state.phase !== FATE_KNOTS_PHASES.characterCreation) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "wrongPhase") };
  }
  const userParticipant = getUserParticipant(state);
  if (!userParticipant || userParticipant.selection.locked === true) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "wrongPhase") };
  }

  const selectionPayload = readFateKnotsSelectionPayload(payload);
  if (validateSelectionPayload(selectionPayload, contentRegistry) !== true) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "invalidSelection") };
  }

  applySelectionPayload(userParticipant, selectionPayload, Date.now());
  persistUserProfile(api, state);
  refreshContentSummary(state, contentRegistry);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "selectionSaved") };
}

export async function handleReady(api: RoomApi) {
  const contentRegistry = loadCommandContentRegistry(api);
  const state = asCommandState(loadFateKnotsState(api));
  const activeSession = ensureActiveSession(state, readLocale(api));
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }
  if (state.phase !== FATE_KNOTS_PHASES.characterCreation) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "wrongPhase") };
  }

  const userParticipant = getUserParticipant(state);
  if (!userParticipant || isSelectionComplete(userParticipant.selection) !== true) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "incompleteSelection") };
  }

  userParticipant.selection.locked = true;
  userParticipant.selection.updatedAt = Date.now();
  persistUserProfile(api, state);
  const everyoneLocked = state.participants.every(function (participant: Record<string, unknown>) {
    const selection = participant["selection"] as Record<string, unknown>;
    return (
      selection["locked"] === true && isSelectionComplete(asSelectionState(selection)) === true
    );
  });
  if (everyoneLocked) {
    startScenarioStep(
      asPhaseState(state),
      asPhaseContentRegistry(contentRegistry),
      contentRegistry.scenario.entryStepId,
      Date.now()
    );
    await advancePendingWork(
      api,
      asPhaseState(state),
      asPhaseContentRegistry(contentRegistry),
      Date.now()
    );
  }
  refreshContentSummary(state, contentRegistry);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "ready") };
}

export async function handleChoice(api: RoomApi, payload: unknown) {
  const contentRegistry = loadCommandContentRegistry(api);
  const state = asCommandState(loadFateKnotsState(api));
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }
  if (state.phase !== FATE_KNOTS_PHASES.scenario || !state.decision) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "wrongPhase") };
  }

  const choicePayload = readFateKnotsChoicePayload(payload);
  const stale = validateSessionId(state.sessionId, choicePayload.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }
  if (choicePayload.stepId && choicePayload.stepId !== state.currentStepId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "stalePayload") };
  }

  const seatId = resolveFateKnotsSeatId(payload);
  const participant = seatId ? getParticipant(state, seatId) : null;
  if (!seatId || !participant) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  const choiceId = choicePayload.choiceId || "";
  if (choiceId === "" || !state.decision.choiceIds.includes(choiceId)) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidChoice") };
  }

  participant.decisionChoiceId = choiceId;
  state.decision.votes[seatId] = choiceId;
  state.decision.updatedAt = Date.now();
  state.decision.conflict = false;
  clearCommandDecisionPromptKey(state, seatId);
  resolveDecisionProgress(
    api,
    asPhaseState(state),
    asPhaseContentRegistry(contentRegistry),
    Date.now()
  );
  await advancePendingWork(
    api,
    asPhaseState(state),
    asPhaseContentRegistry(contentRegistry),
    Date.now()
  );
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "choiceAccepted") };
}

export async function handleCombatAction(api: RoomApi, payload: unknown) {
  const contentRegistry = loadCommandContentRegistry(api);
  const state = asCommandState(loadFateKnotsState(api));
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }
  if (state.phase !== FATE_KNOTS_PHASES.combat || !state.combat) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "wrongPhase") };
  }

  const combatPayload = readFateKnotsCombatPayload(payload);
  const stale = validateSessionId(state.sessionId, combatPayload.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }

  const combat = asCombatState(state.combat);
  const currentTurnId = buildFateKnotsCombatTurnId(combat);
  if (combatPayload.turnId && currentTurnId && combatPayload.turnId !== currentTurnId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "stalePayload") };
  }
  const seatId = resolveFateKnotsSeatId(payload);
  const currentTurn = getCurrentFateKnotsCombatTurn(combat);
  if (!seatId || !currentTurn || currentTurn.seatId !== seatId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  const actionId = combatPayload.actionId;
  if (!actionId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidAction") };
  }
  const result = applyFateKnotsCombatAction(combat, seatId, actionId, contentRegistry.cardsById);
  if (!result.success) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidAction") };
  }

  clearCommandCombatPromptKey(state, seatId);
  settleAutomaticFateKnotsCombatTurns(combat, contentRegistry.enemyActionsById);
  if (combat.outcome === "victory") {
    finalizeRun(
      api,
      asPhaseState(state),
      "victory",
      "Village Secured",
      "The first Fate Knots combat hook resolves in the party's favor."
    );
  } else if (combat.outcome === "defeat") {
    finalizeRun(
      api,
      asPhaseState(state),
      "defeat",
      "The Knot Tightens",
      "The party fell before it could stabilize the well square."
    );
  } else {
    state.statusKey = getCombatStatusKey(asPhaseState(state));
    setCommandCombatWaiting(state, Date.now());
    await advancePendingWork(
      api,
      asPhaseState(state),
      asPhaseContentRegistry(contentRegistry),
      Date.now()
    );
  }

  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "combatActionAccepted") };
}

export async function handleSync(api: RoomApi, payload: unknown) {
  const contentRegistry = loadCommandContentRegistry(api);
  const state = asCommandState(loadFateKnotsState(api));
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }

  const syncPayload = readFateKnotsSyncPayload(payload);
  const stale = validateSessionId(state.sessionId, syncPayload.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }

  const now = Date.now();
  markSeatLossOrTimeout(state, loadContext(api), now);
  prepareSync(asPhaseState(state), now);

  await advancePendingWork(api, asPhaseState(state), asPhaseContentRegistry(contentRegistry), now);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "syncQueued") };
}

export function handleDmPacket(api: RoomApi, payload: unknown) {
  const contentRegistry = loadCommandContentRegistry(api);
  const state = asCommandState(loadFateKnotsState(api));
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }

  const packet = readFateKnotsDmPacketPayload(payload);
  const stale = validateSessionId(state.sessionId, packet.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }
  const seatId = resolveFateKnotsSeatId(payload);
  if (!FATE_KNOTS_SUPPORTED_AI_SEATS.includes(seatId || "")) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  const text = sanitizePacketText(packet.text);
  if (!text) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidPacket") };
  }

  const combat = state.combat ? asCombatState(state.combat) : null;

  state.dmNarration = {
    kind: "dm",
    seatId,
    phase: packet.phase || state.phase,
    text,
    stepId: normalizeText(packet.stepId) || state.currentStepId || null,
    encounterId: normalizeText(packet.encounterId) || normalizeText(combat?.encounterId) || null,
    turnId: normalizeText(packet.turnId) || (combat ? buildFateKnotsCombatTurnId(combat) : null),
    updatedAt: Date.now(),
  };
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "dmPacketAccepted") };
}

export function handleNpcBanter(api: RoomApi, payload: unknown) {
  const contentRegistry = loadCommandContentRegistry(api);
  const state = asCommandState(loadFateKnotsState(api));
  const locale = readLocale(api);
  const activeSession = ensureActiveSession(state, locale);
  if (activeSession) {
    pushFateKnotsState(api, state, contentRegistry);
    return activeSession;
  }

  const packet = readFateKnotsNpcBanterPayload(payload);
  const stale = validateSessionId(state.sessionId, packet.sessionId, locale);
  if (stale) {
    pushFateKnotsState(api, state, contentRegistry);
    return stale;
  }
  const providerSeatId = resolveFateKnotsSeatId(payload);
  if (!FATE_KNOTS_SUPPORTED_AI_SEATS.includes(providerSeatId || "")) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  const speakerSeatId = packet.seatId || providerSeatId;
  const text = sanitizePacketText(packet.text);
  if (!text) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidPacket") };
  }

  const combat = state.combat ? asCombatState(state.combat) : null;

  state.npcBanter = {
    kind: "npc",
    seatId: speakerSeatId,
    phase: packet.phase || state.phase,
    text,
    stepId: normalizeText(packet.stepId) || state.currentStepId || null,
    encounterId: normalizeText(packet.encounterId) || normalizeText(combat?.encounterId) || null,
    turnId: normalizeText(packet.turnId) || (combat ? buildFateKnotsCombatTurnId(combat) : null),
    updatedAt: Date.now(),
  };
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "npcBanterAccepted") };
}

export function handleEnd(api: RoomApi) {
  const contentRegistry = loadCommandContentRegistry(api);
  pushFateKnotsState(api, asCommandState(resetFateKnotsState(api, "idle")), contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "ended") };
}

export async function dispatchPendingWork(api: RoomApi) {
  const contentRegistry = loadCommandContentRegistry(api);
  const state = asCommandState(loadFateKnotsState(api));
  await advancePendingWork(
    api,
    asPhaseState(state),
    asPhaseContentRegistry(contentRegistry),
    Date.now()
  );
  pushFateKnotsState(api, state, contentRegistry);
}
