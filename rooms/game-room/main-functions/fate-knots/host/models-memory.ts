import { normalizeText } from "../../../shared/host/text.js";
import { FATE_KNOTS_MAX_HISTORY_ENTRIES } from "./constants.js";

interface FateKnotsMemoryRecord extends Record<string, unknown> {
  avatarId?: unknown;
  classId?: unknown;
  backgroundId?: unknown;
  updatedAt?: unknown;
  sessionId?: unknown;
  outcome?: unknown;
  title?: unknown;
  summary?: unknown;
  locationId?: unknown;
  timestamp?: unknown;
  roster?: unknown;
  seatId?: unknown;
  nickname?: unknown;
  type?: unknown;
  hasResumeData?: unknown;
  lastCompletedSessionId?: unknown;
  lastOutcome?: unknown;
  decisionPromptKeys?: unknown;
  combatPromptKeys?: unknown;
  dmPromptKey?: unknown;
  npcPromptKey?: unknown;
  localSessionId?: unknown;
  remoteUserId?: unknown;
  phase?: unknown;
  text?: unknown;
  stepId?: unknown;
  encounterId?: unknown;
  turnId?: unknown;
  continueHint?: unknown;
  reason?: unknown;
}

export function createResultState() {
  return {
    outcome: "idle",
    title: "",
    summary: "",
    continueHint: "Reset to replay the slice.",
  };
}

export function createProfileState() {
  return {
    avatarId: null as string | null,
    classId: null as string | null,
    backgroundId: null as string | null,
    updatedAt: null as number | null,
  };
}

export function normalizeProfileState(candidate: unknown) {
  const source: FateKnotsMemoryRecord =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? (candidate as FateKnotsMemoryRecord)
      : {};
  const next = createProfileState();
  next.avatarId = normalizeText(source.avatarId) || null;
  next.classId = normalizeText(source.classId) || null;
  next.backgroundId = normalizeText(source.backgroundId) || null;
  next.updatedAt =
    typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt)
      ? Math.trunc(source.updatedAt)
      : null;
  return next;
}

export function createHistoryEntry() {
  return {
    sessionId: null as string | null,
    outcome: "idle",
    title: "",
    summary: "",
    locationId: null as string | null,
    timestamp: null as number | null,
    roster: [] as Array<{
      seatId: string | null;
      nickname: string | null;
      type: string | null;
    }>,
  };
}

export function normalizeHistoryEntry(candidate: unknown) {
  const source: FateKnotsMemoryRecord =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? (candidate as FateKnotsMemoryRecord)
      : {};
  const next = createHistoryEntry();
  next.sessionId = normalizeText(source.sessionId) || null;
  next.outcome = normalizeText(source.outcome) || "idle";
  next.title = normalizeText(source.title);
  next.summary = normalizeText(source.summary);
  next.locationId = normalizeText(source.locationId) || null;
  next.timestamp =
    typeof source.timestamp === "number" && Number.isFinite(source.timestamp)
      ? Math.trunc(source.timestamp)
      : null;
  next.roster = Array.isArray(source.roster)
    ? source.roster
        .map(function (entry: unknown) {
          const member: FateKnotsMemoryRecord =
            entry && typeof entry === "object" && Array.isArray(entry) === false
              ? (entry as FateKnotsMemoryRecord)
              : {};
          return {
            seatId: normalizeText(member.seatId) || null,
            nickname: normalizeText(member.nickname) || null,
            type: normalizeText(member.type) || null,
          };
        })
        .filter(function (entry: { seatId: string | null }) {
          return entry.seatId !== null;
        })
    : [];
  return next;
}

export function normalizeHistoryState(candidate: unknown) {
  if (!Array.isArray(candidate)) {
    return [];
  }
  return candidate
    .map(normalizeHistoryEntry)
    .filter(function (entry: ReturnType<typeof normalizeHistoryEntry>) {
      return entry.timestamp !== null;
    })
    .slice(0, FATE_KNOTS_MAX_HISTORY_ENTRIES);
}

export function createSaveSlotState() {
  return {
    hasResumeData: false,
    lastCompletedSessionId: null as string | null,
    lastOutcome: null as string | null,
    updatedAt: null as number | null,
  };
}

export function normalizeSaveSlotState(candidate: unknown) {
  const source: FateKnotsMemoryRecord =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? (candidate as FateKnotsMemoryRecord)
      : {};
  const next = createSaveSlotState();
  next.hasResumeData = source.hasResumeData === true;
  next.lastCompletedSessionId = normalizeText(source.lastCompletedSessionId) || null;
  next.lastOutcome = normalizeText(source.lastOutcome) || null;
  next.updatedAt =
    typeof source.updatedAt === "number" && Number.isFinite(source.updatedAt)
      ? Math.trunc(source.updatedAt)
      : null;
  return next;
}

export function createPromptDispatchState() {
  return {
    decisionPromptKeys: {} as Record<string, string>,
    combatPromptKeys: {} as Record<string, string>,
    dmPromptKey: null as string | null,
    npcPromptKey: null as string | null,
  };
}

export function normalizePromptDispatchState(candidate: unknown) {
  const source: FateKnotsMemoryRecord =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? (candidate as FateKnotsMemoryRecord)
      : {};
  const next = createPromptDispatchState();
  (["decisionPromptKeys", "combatPromptKeys"] as const).forEach(function (fieldName) {
    const rawValue = source[fieldName];
    const value: Record<string, unknown> =
      rawValue && typeof rawValue === "object" && Array.isArray(rawValue) === false
        ? (rawValue as FateKnotsMemoryRecord)
        : {};
    Object.keys(value).forEach(function (seatId: string) {
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
    localSessionId: null as string | null,
    remoteUserId: null as string | null,
  };
}

export function normalizeTransportState(candidate: unknown) {
  const source: FateKnotsMemoryRecord =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? (candidate as FateKnotsMemoryRecord)
      : {};
  return {
    localSessionId: normalizeText(source.localSessionId) || null,
    remoteUserId: normalizeText(source.remoteUserId) || null,
  };
}

export function createAmbientPacket(kind: string = "dm") {
  return {
    kind,
    seatId: null as string | null,
    phase: null as string | null,
    text: "",
    stepId: null as string | null,
    encounterId: null as string | null,
    turnId: null as string | null,
    updatedAt: null as number | null,
  };
}

export function normalizeAmbientPacket(candidate: unknown, kind: string) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const payload = candidate as FateKnotsMemoryRecord;
  const next = createAmbientPacket(kind);
  next.seatId = normalizeText(payload.seatId) || null;
  next.phase = normalizeText(payload.phase) || null;
  next.text = normalizeText(payload.text);
  next.stepId = normalizeText(payload.stepId) || null;
  next.encounterId = normalizeText(payload.encounterId) || null;
  next.turnId = normalizeText(payload.turnId) || null;
  next.updatedAt =
    typeof payload.updatedAt === "number" && Number.isFinite(payload.updatedAt)
      ? Math.trunc(payload.updatedAt)
      : null;
  return next.text !== "" ? next : null;
}

export function normalizeResultState(candidate: unknown) {
  const source: FateKnotsMemoryRecord =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? (candidate as FateKnotsMemoryRecord)
      : {};
  return {
    outcome: normalizeText(source.outcome) || "idle",
    title: normalizeText(source.title),
    summary: normalizeText(source.summary),
    continueHint: normalizeText(source.continueHint) || "Reset to replay the slice.",
  };
}

export function normalizeExcludedSeats(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function (entry: unknown) {
      const source: FateKnotsMemoryRecord =
        entry && typeof entry === "object" && Array.isArray(entry) === false
          ? (entry as FateKnotsMemoryRecord)
          : {};
      return {
        seatId: normalizeText(source.seatId),
        reason: normalizeText(source.reason),
      };
    })
    .filter(function (entry: { seatId: string; reason: string }) {
      return entry.seatId !== "";
    });
}
