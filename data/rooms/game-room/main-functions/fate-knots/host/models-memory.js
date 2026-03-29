import { normalizeText } from "../../../shared/host/text.js";
import { FATE_KNOTS_MAX_HISTORY_ENTRIES } from "./constants.js";
export function createResultState() {
  return {
    outcome: "idle",
    title: "",
    summary: "",
    continueHint: "Reset to replay the slice."
  };
}
export function createProfileState() {
  return {
    avatarId: null,
    classId: null,
    backgroundId: null,
    updatedAt: null
  };
}
export function normalizeProfileState(candidate) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const next = createProfileState();
  next.avatarId = normalizeText(source.avatarId) || null;
  next.classId = normalizeText(source.classId) || null;
  next.backgroundId = normalizeText(source.backgroundId) || null;
  next.updatedAt = typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt) ? Math.trunc(source.updatedAt) : null;
  return next;
}
export function createHistoryEntry() {
  return {
    sessionId: null,
    outcome: "idle",
    title: "",
    summary: "",
    locationId: null,
    timestamp: null,
    roster: []
  };
}
export function normalizeHistoryEntry(candidate) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const next = createHistoryEntry();
  next.sessionId = normalizeText(source.sessionId) || null;
  next.outcome = normalizeText(source.outcome) || "idle";
  next.title = normalizeText(source.title);
  next.summary = normalizeText(source.summary);
  next.locationId = normalizeText(source.locationId) || null;
  next.timestamp = typeof source.timestamp === "number" && Number.isFinite(source.timestamp) ? Math.trunc(source.timestamp) : null;
  next.roster = Array.isArray(source.roster) ? source.roster.map(function(entry) {
    const member = entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
    return {
      seatId: normalizeText(member.seatId) || null,
      nickname: normalizeText(member.nickname) || null,
      type: normalizeText(member.type) || null
    };
  }).filter(function(entry) {
    return entry.seatId !== null;
  }) : [];
  return next;
}
export function normalizeHistoryState(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }
  return candidate.map(normalizeHistoryEntry).filter(function(entry) {
    return entry.timestamp !== null;
  }).slice(0, FATE_KNOTS_MAX_HISTORY_ENTRIES);
}
export function createSaveSlotState() {
  return {
    hasResumeData: false,
    lastCompletedSessionId: null,
    lastOutcome: null,
    updatedAt: null
  };
}
export function normalizeSaveSlotState(candidate) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const next = createSaveSlotState();
  next.hasResumeData = source.hasResumeData === true;
  next.lastCompletedSessionId = normalizeText(source.lastCompletedSessionId) || null;
  next.lastOutcome = normalizeText(source.lastOutcome) || null;
  next.updatedAt = typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt) ? Math.trunc(source.updatedAt) : null;
  return next;
}
export function createPromptDispatchState() {
  return {
    decisionPromptKeys: {},
    combatPromptKeys: {},
    dmPromptKey: null,
    npcPromptKey: null
  };
}
export function normalizePromptDispatchState(candidate) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const next = createPromptDispatchState();
  ["decisionPromptKeys", "combatPromptKeys"].forEach(function(fieldName) {
    const value = source[fieldName] && typeof source[fieldName] === "object" && Array.isArray(source[fieldName]) === false ? source[fieldName] : {};
    Object.keys(value).forEach(function(seatId) {
      const normalizedSeatId = normalizeText(seatId);
      const promptKey = normalizeText(value[seatId]);
      if (normalizedSeatId !== "" && promptKey !== "") {
        next[fieldName][normalizedSeatId] = promptKey;
      }
    });
  });
  next.dmPromptKey = normalizeText(source.dmPromptKey) || null;
  next.npcPromptKey = normalizeText(source.npcPromptKey) || null;
  return next;
}
export function createTransportState() {
  return {
    localSessionId: null,
    remoteUserId: null
  };
}
export function normalizeTransportState(candidate) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  return {
    localSessionId: normalizeText(source.localSessionId) || null,
    remoteUserId: normalizeText(source.remoteUserId) || null
  };
}
export function createAmbientPacket(kind = "dm") {
  return {
    kind,
    seatId: null,
    phase: null,
    text: "",
    stepId: null,
    encounterId: null,
    turnId: null,
    updatedAt: null
  };
}
export function normalizeAmbientPacket(candidate, kind) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const next = createAmbientPacket(kind);
  next.seatId = normalizeText(candidate.seatId) || null;
  next.phase = normalizeText(candidate.phase) || null;
  next.text = normalizeText(candidate.text);
  next.stepId = normalizeText(candidate.stepId) || null;
  next.encounterId = normalizeText(candidate.encounterId) || null;
  next.turnId = normalizeText(candidate.turnId) || null;
  next.updatedAt = typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt) ? Math.trunc(candidate.updatedAt) : null;
  return next.text !== "" ? next : null;
}
export function normalizeResultState(candidate) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  return {
    outcome: normalizeText(source.outcome) || "idle",
    title: normalizeText(source.title),
    summary: normalizeText(source.summary),
    continueHint: normalizeText(source.continueHint) || "Reset to replay the slice."
  };
}
export function normalizeExcludedSeats(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(function(entry) {
    const source = entry && typeof entry === "object" && Array.isArray(entry) === false ? entry : {};
    return {
      seatId: normalizeText(source.seatId),
      reason: normalizeText(source.reason)
    };
  }).filter(function(entry) {
    return entry.seatId !== "";
  });
}
