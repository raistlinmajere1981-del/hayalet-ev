import { normalizeText } from "../../../shared/host/text.js";
import {
  FATE_KNOTS_PHASES,
  FATE_KNOTS_STATUS_COPY,
  FATE_KNOTS_WAIT_MODES,
  FATE_KNOTS_WAIT_TIMEOUT_MS
} from "./constants.js";
function readRecord(candidate) {
  return candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
}
export function normalizePhase(value) {
  const allowed = Object.values(FATE_KNOTS_PHASES);
  return typeof value === "string" && allowed.includes(value) ? value : FATE_KNOTS_PHASES.idle;
}
export function normalizeWaitMode(value) {
  const allowed = Object.values(FATE_KNOTS_WAIT_MODES);
  return typeof value === "string" && allowed.includes(value) ? value : FATE_KNOTS_WAIT_MODES.idle;
}
export function normalizeStatusKey(value) {
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
    updatedAt: null
  };
}
export function normalizeHeroSelection(candidate) {
  const source = readRecord(candidate);
  return {
    avatarId: normalizeText(source.avatarId) || null,
    classId: normalizeText(source.classId) || null,
    backgroundId: normalizeText(source.backgroundId) || null,
    locked: source.locked === true,
    autoAssigned: source.autoAssigned === true,
    updatedAt: typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt) ? Math.trunc(source.updatedAt) : null
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
    decisionChoiceId: normalizeText(options.decisionChoiceId) || null
  };
}
export function normalizeParticipant(candidate) {
  const source = readRecord(candidate);
  return createParticipant({
    seatId: source.seatId,
    provider: source.provider,
    type: source.type,
    nickname: source.nickname,
    ready: source.ready,
    connected: source.connected,
    active: source.active,
    selection: source.selection,
    decisionChoiceId: source.decisionChoiceId
  });
}
export function createWaitingState(mode = FATE_KNOTS_WAIT_MODES.idle, reason = "", pendingSeatIds = [], now = Date.now(), timeoutMs = FATE_KNOTS_WAIT_TIMEOUT_MS) {
  const normalizedMode = normalizeWaitMode(mode);
  const nextPendingSeatIds = Array.isArray(pendingSeatIds) ? pendingSeatIds.map(normalizeText).filter(Boolean) : [];
  const hasDeadline = normalizedMode !== FATE_KNOTS_WAIT_MODES.idle && normalizedMode !== FATE_KNOTS_WAIT_MODES.desync && nextPendingSeatIds.length > 0;
  const startedAt = normalizedMode === FATE_KNOTS_WAIT_MODES.idle ? null : Math.trunc(now);
  return {
    mode: normalizedMode,
    reason: normalizeText(reason),
    pendingSeatIds: nextPendingSeatIds,
    startedAt,
    deadlineAt: hasDeadline ? Math.trunc(now + timeoutMs) : null
  };
}
export function normalizeWaitingState(candidate) {
  const source = readRecord(candidate);
  const waiting = createWaitingState(
    normalizeText(source.mode),
    normalizeText(source.reason),
    Array.isArray(source.pendingSeatIds) ? source.pendingSeatIds : [],
    Date.now()
  );
  waiting.startedAt = typeof source.startedAt === "number" && Number.isFinite(source.startedAt) ? Math.trunc(source.startedAt) : waiting.startedAt;
  waiting.deadlineAt = typeof source.deadlineAt === "number" && Number.isFinite(source.deadlineAt) ? Math.trunc(source.deadlineAt) : waiting.deadlineAt;
  return waiting;
}
export function createDecisionState(options = {}) {
  const choices = Array.isArray(options.choices) ? options.choices : [];
  const participantIds = Array.isArray(options.participantIds) ? options.participantIds : [];
  const now = typeof options.now === "number" ? options.now : Date.now();
  const timeoutMs = typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) ? options.timeoutMs : FATE_KNOTS_WAIT_TIMEOUT_MS;
  const choiceIds = choices.map(function(choice) {
    return normalizeText(
      choice && typeof choice === "object" && !Array.isArray(choice) ? choice.id : choice
    );
  }).filter(Boolean);
  const activeParticipantIds = participantIds.map(normalizeText).filter(Boolean);
  const aiPending = activeParticipantIds.filter(function(seatId) {
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
    deadlineAt: aiPending.length > 0 ? Math.trunc(now + timeoutMs) : null
  };
}
export function normalizeDecisionState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const source = readRecord(candidate);
  const next = createDecisionState({
    stepId: source.stepId,
    choices: Array.isArray(source.choiceIds) ? source.choiceIds : [],
    participantIds: Array.isArray(source.participantIds) ? source.participantIds : [],
    now: typeof source.updatedAt === "number" ? source.updatedAt : Date.now()
  });
  const votes = source.votes && typeof source.votes === "object" && Array.isArray(source.votes) === false ? source.votes : {};
  Object.keys(votes).forEach(function(seatId) {
    const key = normalizeText(seatId);
    const choiceId = normalizeText(votes[seatId]);
    if (key !== "" && choiceId !== "") {
      next.votes[key] = choiceId;
    }
  });
  next.resolvedChoiceId = normalizeText(source.resolvedChoiceId) || null;
  next.conflict = source.conflict === true;
  next.updatedAt = typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt) ? Math.trunc(source.updatedAt) : next.updatedAt;
  next.deadlineAt = typeof source.deadlineAt === "number" && Number.isFinite(source.deadlineAt) ? Math.trunc(source.deadlineAt) : next.deadlineAt;
  return next;
}
