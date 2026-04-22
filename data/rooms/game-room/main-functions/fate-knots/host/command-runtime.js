import { loadContext, readLocale } from "../../../shared/host/context-state.js";
import { fillTemplate, normalizeText, translate } from "../../../shared/host/text.js";
import {
  FATE_KNOTS_COMMAND_COPY,
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SUPPORTED_AI_SEATS
} from "./constants.js";
import {
  applyFateKnotsCombatAction,
  buildFateKnotsCombatTurnId,
  getCurrentFateKnotsCombatTurn,
  settleAutomaticFateKnotsCombatTurns
} from "./combat-engine.js";
import {
  readFateKnotsChoicePayload,
  readFateKnotsCombatPayload,
  readFateKnotsDmPacketPayload,
  readFateKnotsNpcBanterPayload,
  readFateKnotsSelectionPayload,
  readFateKnotsSyncPayload,
  resolveFateKnotsSeatId
} from "./payloads.js";
import {
  loadFateKnotsProfile,
  loadFateKnotsSaveSlot,
  loadFateKnotsState,
  pushFateKnotsState,
  refreshFateKnotsState,
  resetFateKnotsState,
  saveFateKnotsSaveSlot
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
  validateSelectionPayload
} from "./session-support.js";
function commandMessage(locale, key, params = {}) {
  return fillTemplate(translate(locale, FATE_KNOTS_COMMAND_COPY, key), params);
}
function asCombatState(raw) {
  return raw;
}
function loadCommandContentRegistry(api) {
  return ensureFateKnotsContent(api);
}
function asCommandState(value) {
  return value;
}
function asSessionState(value) {
  return value;
}
function asProfileState(value) {
  return value;
}
function asPhaseState(value) {
  return value;
}
function asPhaseContentRegistry(value) {
  return value;
}
function asSelectionState(value) {
  return value;
}
function readUs1RemoteUserId(api, state, context) {
  return getUs1RemoteUserId(api, asSessionState(state), context);
}
function persistUserProfile(api, state) {
  persistProfileFromUser(api, asProfileState(state));
}
function refreshContentSummary(state, contentRegistry) {
  updateContentSummary(
    asSessionState(state),
    contentRegistry
  );
}
function setCommandIdleWaiting(state) {
  setIdleWaiting(asSessionState(state));
}
function clearCommandDecisionPromptKey(state, seatId) {
  clearDecisionPromptKey(state, seatId);
}
function clearCommandCombatPromptKey(state, seatId) {
  clearCombatPromptKey(state, seatId);
}
function markSeatLossOrTimeout(state, context, now) {
  maybeMarkSeatLossOrTimeout(state, context, now);
}
function setCommandCombatWaiting(state, now) {
  setCombatWaiting(state, now);
}
const fateKnotsPromptRuntimeDeps = {
  getParticipant,
  listPendingDecisionSeats,
  getUs1RemoteUserId,
  updateTransportFromSendResult
};
const fateKnotsPromptRuntime = createFateKnotsPromptRuntime(
  fateKnotsPromptRuntimeDeps
);
const dispatchDecisionPrompts = fateKnotsPromptRuntime.dispatchDecisionPrompts;
const dispatchCombatPrompt = fateKnotsPromptRuntime.dispatchCombatPrompt;
const dispatchAmbientPrompts = fateKnotsPromptRuntime.dispatchAmbientPrompts;
function ensureActiveSession(state, locale) {
  if (!state["active"] || !state["sessionId"]) {
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
const fateKnotsPhaseRuntimeDeps = {
  clearAmbientPromptKeys,
  clearCombatPromptKey,
  clearDecisionPromptKey,
  dispatchAmbientPrompts,
  dispatchCombatPrompt,
  dispatchDecisionPrompts,
  listPendingDecisionSeats,
  markDesync,
  maybeMarkSeatLossOrTimeout,
  persistRunSummary,
  resetPromptDispatchState,
  setCombatWaiting,
  setDecisionWaiting,
  setIdleWaiting
};
const fateKnotsPhaseRuntime = createFateKnotsPhaseRuntime(
  fateKnotsPhaseRuntimeDeps
);
export const advancePendingWork = fateKnotsPhaseRuntime.advancePendingWork;
const finalizeRun = fateKnotsPhaseRuntime.finalizeRun;
const getCombatStatusKey = fateKnotsPhaseRuntime.getCombatStatusKey;
export const prepareSync = fateKnotsPhaseRuntime.prepareSync;
const resolveDecisionProgress = fateKnotsPhaseRuntime.resolveDecisionProgress;
const startScenarioStep = fateKnotsPhaseRuntime.startScenarioStep;
export async function handleStart(api) {
  const contentRegistry = loadCommandContentRegistry(api);
  const context = loadContext(api);
  const profile = loadFateKnotsProfile(api);
  const saveSlot = loadFateKnotsSaveSlot(api);
  const readyAiSeats = FATE_KNOTS_SUPPORTED_AI_SEATS.filter(function(seatId) {
    const slot = context.slots[seatId];
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
    updatedAt: now
  });
  state.startedAt = now;
  state.updatedAt = now;
  refreshContentSummary(state, contentRegistry);
  setCommandIdleWaiting(state);
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "started") };
}
export function handleReset(api) {
  const contentRegistry = loadCommandContentRegistry(api);
  pushFateKnotsState(api, asCommandState(resetFateKnotsState(api, "idle")), contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "reset") };
}
export function handleCharacterSelect(api, payload) {
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
export async function handleReady(api) {
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
  const everyoneLocked = state.participants.every(function(participant) {
    const selection = participant["selection"];
    return selection["locked"] === true && isSelectionComplete(asSelectionState(selection)) === true;
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
export async function handleChoice(api, payload) {
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
export async function handleCombatAction(api, payload) {
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
export async function handleSync(api, payload) {
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
export function handleDmPacket(api, payload) {
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
    updatedAt: Date.now()
  };
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "dmPacketAccepted") };
}
export function handleNpcBanter(api, payload) {
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
    updatedAt: Date.now()
  };
  pushFateKnotsState(api, state, contentRegistry);
  return { success: true, message: commandMessage(locale, "npcBanterAccepted") };
}
export function handleEnd(api) {
  const contentRegistry = loadCommandContentRegistry(api);
  pushFateKnotsState(api, asCommandState(resetFateKnotsState(api, "idle")), contentRegistry);
  return { success: true, message: commandMessage(readLocale(api), "ended") };
}
export async function dispatchPendingWork(api) {
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
