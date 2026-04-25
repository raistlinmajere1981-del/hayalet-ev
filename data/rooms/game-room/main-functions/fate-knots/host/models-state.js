import { normalizeLocale, normalizeText } from "../../../shared/host/text.js";
import { FATE_KNOTS_PHASES, FATE_KNOTS_SCHEMA_VERSION } from "./constants.js";
import {
  createDecisionState,
  createParticipant,
  createWaitingState,
  normalizeDecisionState,
  normalizeParticipant,
  normalizePhase,
  normalizeStatusKey,
  normalizeWaitingState
} from "./models-roster.js";
import {
  createPromptDispatchState,
  createResultState,
  createTransportState,
  normalizeAmbientPacket,
  normalizeExcludedSeats,
  normalizePromptDispatchState,
  normalizeResultState,
  normalizeTransportState
} from "./models-memory.js";
export function createInitialFateKnotsState(locale) {
  return {
    schemaVersion: FATE_KNOTS_SCHEMA_VERSION,
    locale: normalizeLocale(locale),
    featureId: "fate-knots",
    active: false,
    phase: FATE_KNOTS_PHASES.idle,
    statusKey: "idle",
    compatibility: {
      mode: "fresh",
      reason: ""
    },
    sessionId: null,
    participantMode: "user-plus-ready-ai",
    rosterLocked: false,
    participants: [],
    excludedSeats: [],
    waiting: createWaitingState(),
    scenarioLog: [],
    currentLocationId: null,
    currentStepId: null,
    decision: null,
    combat: null,
    result: createResultState(),
    dmNarration: null,
    npcBanter: null,
    dispatch: createPromptDispatchState(),
    transport: createTransportState(),
    contentSummary: {
      assetErrors: 0,
      sourceErrors: 0
    },
    startedAt: null,
    updatedAt: null
  };
}
export function normalizeFateKnotsState(candidate, localeFallback) {
  const initial = createInitialFateKnotsState(localeFallback);
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : null;
  if (!source) {
    return initial;
  }
  if (source.schemaVersion !== FATE_KNOTS_SCHEMA_VERSION) {
    initial.compatibility = {
      mode: "reset-safe",
      reason: "schema-mismatch"
    };
    return initial;
  }
  initial.locale = normalizeLocale(source.locale || localeFallback);
  initial.active = source.active === true;
  initial.phase = normalizePhase(source.phase);
  initial.statusKey = normalizeStatusKey(source.statusKey);
  initial.compatibility = source.compatibility && typeof source.compatibility === "object" && Array.isArray(source.compatibility) === false ? (function() {
    const compat = source.compatibility;
    return {
      mode: normalizeText(compat.mode) || "fresh",
      reason: normalizeText(compat.reason)
    };
  })() : initial.compatibility;
  initial.sessionId = normalizeText(source.sessionId) || null;
  initial.participantMode = normalizeText(source.participantMode) || "user-plus-ready-ai";
  initial.rosterLocked = source.rosterLocked === true;
  initial.participants = Array.isArray(source.participants) ? source.participants.map(normalizeParticipant) : [];
  initial.excludedSeats = normalizeExcludedSeats(source.excludedSeats);
  initial.waiting = normalizeWaitingState(source.waiting);
  initial.scenarioLog = Array.isArray(source.scenarioLog) ? source.scenarioLog.map(normalizeText).filter(Boolean).slice(-24) : [];
  initial.currentLocationId = normalizeText(source.currentLocationId) || null;
  initial.currentStepId = normalizeText(source.currentStepId) || null;
  initial.decision = normalizeDecisionState(source.decision);
  initial.combat = source.combat && typeof source.combat === "object" && Array.isArray(source.combat) === false ? source.combat : null;
  initial.result = normalizeResultState(source.result);
  initial.dmNarration = normalizeAmbientPacket(source.dmNarration, "dm");
  initial.npcBanter = normalizeAmbientPacket(source.npcBanter, "npc");
  initial.dispatch = normalizePromptDispatchState(source.dispatch);
  initial.transport = normalizeTransportState(source.transport);
  initial.contentSummary = source.contentSummary && typeof source.contentSummary === "object" && Array.isArray(source.contentSummary) === false ? (function() {
    const summary = source.contentSummary;
    return {
      assetErrors: typeof summary.assetErrors === "number" && Number.isFinite(summary.assetErrors) ? Math.trunc(summary.assetErrors) : 0,
      sourceErrors: typeof summary.sourceErrors === "number" && Number.isFinite(summary.sourceErrors) ? Math.trunc(summary.sourceErrors) : 0
    };
  })() : initial.contentSummary;
  initial.startedAt = typeof source.startedAt === "number" && Number.isFinite(source.startedAt) ? Math.trunc(source.startedAt) : null;
  initial.updatedAt = typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt) ? Math.trunc(source.updatedAt) : null;
  return initial;
}
export { createDecisionState, createParticipant, createWaitingState };
