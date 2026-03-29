import {
  loadContext,
  readLocale,
} from "../../../shared/host/context-state.js";
import { fillTemplate, translate } from "../../../shared/host/text.js";
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
} from "./combat-engine.js";
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

function commandMessage(locale, key, params) {
  return fillTemplate(translate(locale, FATE_KNOTS_COMMAND_COPY, key), params || {});
}

const fateKnotsPromptRuntime = createFateKnotsPromptRuntime({
  getParticipant: getParticipant,
  listPendingDecisionSeats: listPendingDecisionSeats,
  getUs1RemoteUserId: getUs1RemoteUserId,
  updateTransportFromSendResult: updateTransportFromSendResult,
});
const dispatchDecisionPrompts = fateKnotsPromptRuntime.dispatchDecisionPrompts;
const dispatchCombatPrompt = fateKnotsPromptRuntime.dispatchCombatPrompt;
const dispatchAmbientPrompts = fateKnotsPromptRuntime.dispatchAmbientPrompts;

function ensureActiveSession(state, locale) {
  if (!state.active || !state.sessionId) {
    return { success: false, message: commandMessage(locale, "notActive") };
  }
  return null;
}

function validateSessionId(expectedSessionId, payloadSessionId, locale) {
  if (payloadSessionId && expectedSessionId && payloadSessionId !== expectedSessionId) {
    return { success: false, message: commandMessage(locale, "stalePayload") };
  }
  return null;
}

const fateKnotsPhaseRuntime = createFateKnotsPhaseRuntime({
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
});
export const advancePendingWork = fateKnotsPhaseRuntime.advancePendingWork;
const finalizeRun = fateKnotsPhaseRuntime.finalizeRun;
const getCombatStatusKey = fateKnotsPhaseRuntime.getCombatStatusKey;
export const prepareSync = fateKnotsPhaseRuntime.prepareSync;
const resolveDecisionProgress = fateKnotsPhaseRuntime.resolveDecisionProgress;
const startScenarioStep = fateKnotsPhaseRuntime.startScenarioStep;

export async function handleStart(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  const context = loadContext(api);
  const profile = loadFateKnotsProfile(api);
  const saveSlot = loadFateKnotsSaveSlot(api);
  const readyAiSeats = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function (seatId) {
    return context?.slots?.[seatId]?.ready === true;
  });
  if (readyAiSeats.length === 0) {
    refreshFateKnotsState(api, contentRegistry);
    return { success: false, message: commandMessage(readLocale(api), "needReadyCompanions") };
  }

  const sessionId = buildSessionId();
  const now = Date.now();
  const state = resetFateKnotsState(api, "idle");
  const runConfig = buildRunParticipants(
    context,
    contentRegistry,
    sessionId,
    profile,
    getUs1RemoteUserId(api, state, context)
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
  updateContentSummary(state, contentRegistry);
  setIdleWaiting(state);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "started") };
}

export function handleReset(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  pushFateKnotsState(api, resetFateKnotsState(api, "idle"), contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "reset") };
}

export function handleCharacterSelect(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
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
  persistProfileFromUser(api, state);
  updateContentSummary(state, contentRegistry);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "selectionSaved") };
}

export async function handleReady(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
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
  persistProfileFromUser(api, state);
  const everyoneLocked = state.participants.every(function (participant) {
    return participant.selection.locked === true && isSelectionComplete(participant.selection) === true;
  });
  if (everyoneLocked) {
    startScenarioStep(state, contentRegistry, contentRegistry.scenario.entryStepId, Date.now());
    await advancePendingWork(api, state, contentRegistry, Date.now());
  }
  updateContentSummary(state, contentRegistry);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "ready") };
}

export async function handleChoice(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
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
  if (!state.decision.choiceIds.includes(choicePayload.choiceId || "")) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidChoice") };
  }

  participant.decisionChoiceId = choicePayload.choiceId;
  state.decision.votes[seatId] = choicePayload.choiceId;
  state.decision.updatedAt = Date.now();
  state.decision.conflict = false;
  clearDecisionPromptKey(state, seatId);
  resolveDecisionProgress(api, state, contentRegistry, Date.now());
  await advancePendingWork(api, state, contentRegistry, Date.now());
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "choiceAccepted") };
}

export async function handleCombatAction(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
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

  const currentTurnId = buildFateKnotsCombatTurnId(state.combat);
  if (combatPayload.turnId && currentTurnId && combatPayload.turnId !== currentTurnId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "stalePayload") };
  }
  const seatId = resolveFateKnotsSeatId(payload);
  const currentTurn = getCurrentFateKnotsCombatTurn(state.combat);
  if (!seatId || !currentTurn || currentTurn.seatId !== seatId) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  const result = applyFateKnotsCombatAction(state.combat, seatId, combatPayload.actionId, contentRegistry.cardsById);
  if (!result.success) {
    pushFateKnotsState(api, state, contentRegistry);
    return { success: false, message: commandMessage(locale, "invalidAction") };
  }

  clearCombatPromptKey(state, seatId);
  settleAutomaticFateKnotsCombatTurns(state.combat, contentRegistry.enemyActionsById);
  if (state.combat.outcome === "victory") {
    finalizeRun(
      api,
      state,
      "victory",
      "Village Secured",
      "The first Fate Knots combat hook resolves in the party's favor."
    );
  } else if (state.combat.outcome === "defeat") {
    finalizeRun(
      api,
      state,
      "defeat",
      "The Knot Tightens",
      "The party fell before it could stabilize the well square."
    );
  } else {
    state.statusKey = getCombatStatusKey(state);
    setCombatWaiting(state, Date.now());
    await advancePendingWork(api, state, contentRegistry, Date.now());
  }

  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "combatActionAccepted") };
}

export async function handleSync(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
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
  maybeMarkSeatLossOrTimeout(state, loadContext(api), now);
  prepareSync(state, now);

  await advancePendingWork(api, state, contentRegistry, now);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "syncQueued") };
}

export function handleDmPacket(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
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

  state.dmNarration = {
    kind: "dm",
    seatId,
    phase: packet.phase || state.phase,
    text,
    stepId: packet.stepId || state.currentStepId || null,
    encounterId: packet.encounterId || state.combat?.encounterId || null,
    turnId: packet.turnId || buildFateKnotsCombatTurnId(state.combat) || null,
    updatedAt: Date.now(),
  };
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "dmPacketAccepted") };
}

export function handleNpcBanter(api, payload) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
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

  state.npcBanter = {
    kind: "npc",
    seatId: speakerSeatId,
    phase: packet.phase || state.phase,
    text,
    stepId: packet.stepId || state.currentStepId || null,
    encounterId: packet.encounterId || state.combat?.encounterId || null,
    turnId: packet.turnId || buildFateKnotsCombatTurnId(state.combat) || null,
    updatedAt: Date.now(),
  };
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "npcBanterAccepted") };
}

export function handleEnd(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  pushFateKnotsState(api, resetFateKnotsState(api, "idle"), contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "ended") };
}

export async function dispatchPendingWork(api) {
  const contentRegistry = ensureFateKnotsContent(api);
  const state = loadFateKnotsState(api);
  await advancePendingWork(api, state, contentRegistry, Date.now());
  pushFateKnotsState(api, state, contentRegistry);
}
