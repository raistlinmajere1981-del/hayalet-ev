import { normalizeLocale, normalizeText } from "../../../shared/host/text.js";
import {
  FATE_KNOTS_PHASES,
  FATE_KNOTS_SCHEMA_VERSION,
  FATE_KNOTS_STATUS_COPY,
  FATE_KNOTS_WAIT_MODES,
  FATE_KNOTS_WAIT_TIMEOUT_MS,
} from "./constants.js";

function normalizePhase(value) {
  const allowed = Object.values(FATE_KNOTS_PHASES);
  return allowed.includes(value) ? value : FATE_KNOTS_PHASES.idle;
}

function normalizeWaitMode(value) {
  const allowed = Object.values(FATE_KNOTS_WAIT_MODES);
  return allowed.includes(value) ? value : FATE_KNOTS_WAIT_MODES.idle;
}

function normalizeStatusKey(value) {
  const key = normalizeText(value);
  return Object.prototype.hasOwnProperty.call(FATE_KNOTS_STATUS_COPY, key) ? key : "idle";
}

export function createHeroSelection() {
  return {
    avatarId: null,
    classId: null,
    backgroundId: null,
    locked: false,
    autoAssigned: false,
    updatedAt: null,
  };
}

export function normalizeHeroSelection(candidate) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  return {
    avatarId: normalizeText(source.avatarId) || null,
    classId: normalizeText(source.classId) || null,
    backgroundId: normalizeText(source.backgroundId) || null,
    locked: source.locked === true,
    autoAssigned: source.autoAssigned === true,
    updatedAt:
      typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt)
        ? Math.trunc(source.updatedAt)
        : null,
  };
}

export function createParticipant(options = {}) {
  const seatId = normalizeText(options.seatId) || "user";
  const type = normalizeText(options.type) || (seatId === "user" ? "local-user" : "ai");
  return {
    seatId,
    provider: normalizeText(options.provider) || (seatId === "user" ? "room-ui" : seatId),
    type,
    nickname: normalizeText(options.nickname) || seatId.toUpperCase(),
    ready: options.ready === true,
    connected: options.connected !== false,
    active: options.active !== false,
    selection: normalizeHeroSelection(options.selection),
    decisionChoiceId: normalizeText(options.decisionChoiceId) || null,
  };
}

export function normalizeParticipant(candidate) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  return createParticipant({
    seatId: source.seatId,
    provider: source.provider,
    type: source.type,
    nickname: source.nickname,
    ready: source.ready,
    connected: source.connected,
    active: source.active,
    selection: source.selection,
    decisionChoiceId: source.decisionChoiceId,
  });
}

export function createWaitingState(mode = FATE_KNOTS_WAIT_MODES.idle, reason = "", pendingSeatIds = [], now = Date.now(), timeoutMs = FATE_KNOTS_WAIT_TIMEOUT_MS) {
  const normalizedMode = normalizeWaitMode(mode);
  const nextPendingSeatIds = Array.isArray(pendingSeatIds)
    ? pendingSeatIds.map(normalizeText).filter(Boolean)
    : [];
  const hasDeadline =
    normalizedMode !== FATE_KNOTS_WAIT_MODES.idle &&
    normalizedMode !== FATE_KNOTS_WAIT_MODES.desync &&
    nextPendingSeatIds.length > 0;
  const startedAt = normalizedMode === FATE_KNOTS_WAIT_MODES.idle ? null : Math.trunc(now);

  return {
    mode: normalizedMode,
    reason: normalizeText(reason),
    pendingSeatIds: nextPendingSeatIds,
    startedAt,
    deadlineAt: hasDeadline ? Math.trunc(now + timeoutMs) : null,
  };
}

export function normalizeWaitingState(candidate) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  const waiting = createWaitingState(source.mode, source.reason, source.pendingSeatIds, Date.now());
  waiting.startedAt =
    typeof source.startedAt === "number" && Number.isFinite(source.startedAt)
      ? Math.trunc(source.startedAt)
      : waiting.startedAt;
  waiting.deadlineAt =
    typeof source.deadlineAt === "number" && Number.isFinite(source.deadlineAt)
      ? Math.trunc(source.deadlineAt)
      : waiting.deadlineAt;
  return waiting;
}

export function createDecisionState(options = {}) {
  const choices = Array.isArray(options.choices) ? options.choices : [];
  const participantIds = Array.isArray(options.participantIds) ? options.participantIds : [];
  const now = typeof options.now === "number" ? options.now : Date.now();
  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? options.timeoutMs
      : FATE_KNOTS_WAIT_TIMEOUT_MS;
  const choiceIds = choices
    .map(function (choice) {
      return normalizeText(choice && typeof choice === "object" ? choice.id : choice);
    })
    .filter(Boolean);
  const activeParticipantIds = participantIds.map(normalizeText).filter(Boolean);
  const aiPending = activeParticipantIds.filter(function (seatId) {
    return seatId !== "user";
  });

  return {
    stepId: normalizeText(options.stepId),
    choiceIds,
    participantIds: activeParticipantIds,
    votes: {},
    resolvedChoiceId: null,
    conflict: false,
    updatedAt: Math.trunc(now),
    deadlineAt: aiPending.length > 0 ? Math.trunc(now + timeoutMs) : null,
  };
}

export function normalizeDecisionState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const next = createDecisionState({
    stepId: candidate.stepId,
    choices: Array.isArray(candidate.choiceIds) ? candidate.choiceIds : [],
    participantIds: Array.isArray(candidate.participantIds) ? candidate.participantIds : [],
    now: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
  });
  const votes =
    candidate.votes && typeof candidate.votes === "object" && Array.isArray(candidate.votes) === false
      ? candidate.votes
      : {};
  Object.keys(votes).forEach(function (seatId) {
    const key = normalizeText(seatId);
    const choiceId = normalizeText(votes[seatId]);
    if (key !== "" && choiceId !== "") {
      next.votes[key] = choiceId;
    }
  });
  next.resolvedChoiceId = normalizeText(candidate.resolvedChoiceId) || null;
  next.conflict = candidate.conflict === true;
  next.updatedAt =
    typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt)
      ? Math.trunc(candidate.updatedAt)
      : next.updatedAt;
  next.deadlineAt =
    typeof candidate.deadlineAt === "number" && Number.isFinite(candidate.deadlineAt)
      ? Math.trunc(candidate.deadlineAt)
      : next.deadlineAt;
  return next;
}

export function createResultState() {
  return {
    outcome: "idle",
    title: "",
    summary: "",
    continueHint: "Reset to replay the slice.",
  };
}

export function normalizeResultState(candidate) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  return {
    outcome: normalizeText(source.outcome) || "idle",
    title: normalizeText(source.title),
    summary: normalizeText(source.summary),
    continueHint: normalizeText(source.continueHint) || "Reset to replay the slice.",
  };
}

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
      reason: "",
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
    contentSummary: {
      assetErrors: 0,
      sourceErrors: 0,
    },
    startedAt: null,
    updatedAt: null,
  };
}

export function normalizeExcludedSeats(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function (entry) {
      const source =
        entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
      return {
        seatId: normalizeText(source.seatId),
        reason: normalizeText(source.reason),
      };
    })
    .filter(function (entry) {
      return entry.seatId !== "";
    });
}

export function normalizeFateKnotsState(candidate, localeFallback) {
  const initial = createInitialFateKnotsState(localeFallback);
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : null;

  if (!source) {
    return initial;
  }

  if (source.schemaVersion !== FATE_KNOTS_SCHEMA_VERSION) {
    initial.compatibility = {
      mode: "reset-safe",
      reason: "schema-mismatch",
    };
    return initial;
  }

  initial.locale = normalizeLocale(source.locale || localeFallback);
  initial.active = source.active === true;
  initial.phase = normalizePhase(source.phase);
  initial.statusKey = normalizeStatusKey(source.statusKey);
  initial.compatibility =
    source.compatibility && typeof source.compatibility === "object" && Array.isArray(source.compatibility) === false
      ? {
          mode: normalizeText(source.compatibility.mode) || "fresh",
          reason: normalizeText(source.compatibility.reason),
        }
      : initial.compatibility;
  initial.sessionId = normalizeText(source.sessionId) || null;
  initial.participantMode = normalizeText(source.participantMode) || "user-plus-ready-ai";
  initial.rosterLocked = source.rosterLocked === true;
  initial.participants = Array.isArray(source.participants)
    ? source.participants.map(normalizeParticipant)
    : [];
  initial.excludedSeats = normalizeExcludedSeats(source.excludedSeats);
  initial.waiting = normalizeWaitingState(source.waiting);
  initial.scenarioLog = Array.isArray(source.scenarioLog)
    ? source.scenarioLog.map(normalizeText).filter(Boolean).slice(-24)
    : [];
  initial.currentLocationId = normalizeText(source.currentLocationId) || null;
  initial.currentStepId = normalizeText(source.currentStepId) || null;
  initial.decision = normalizeDecisionState(source.decision);
  initial.combat = source.combat && typeof source.combat === "object" ? source.combat : null;
  initial.result = normalizeResultState(source.result);
  initial.contentSummary =
    source.contentSummary && typeof source.contentSummary === "object" && Array.isArray(source.contentSummary) === false
      ? {
          assetErrors:
            typeof source.contentSummary.assetErrors === "number" && Number.isFinite(source.contentSummary.assetErrors)
              ? Math.trunc(source.contentSummary.assetErrors)
              : 0,
          sourceErrors:
            typeof source.contentSummary.sourceErrors === "number" && Number.isFinite(source.contentSummary.sourceErrors)
              ? Math.trunc(source.contentSummary.sourceErrors)
              : 0,
        }
      : initial.contentSummary;
  initial.startedAt =
    typeof source.startedAt === "number" && Number.isFinite(source.startedAt)
      ? Math.trunc(source.startedAt)
      : null;
  initial.updatedAt =
    typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt)
      ? Math.trunc(source.updatedAt)
      : null;
  return initial;
}
