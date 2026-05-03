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
  normalizeWaitingState,
} from "./models-roster.js";
import {
  createPromptDispatchState,
  createResultState,
  createTransportState,
  normalizeAmbientPacket,
  normalizeExcludedSeats,
  normalizePromptDispatchState,
  normalizeResultState,
  normalizeTransportState,
} from "./models-memory.js";

interface FateKnotsStateRecord extends Record<string, unknown> {
  schemaVersion?: unknown;
  locale?: unknown;
  active?: unknown;
  phase?: unknown;
  statusKey?: unknown;
  compatibility?: unknown;
  mode?: unknown;
  reason?: unknown;
  sessionId?: unknown;
  participantMode?: unknown;
  rosterLocked?: unknown;
  participants?: unknown;
  excludedSeats?: unknown;
  waiting?: unknown;
  scenarioLog?: unknown;
  currentLocationId?: unknown;
  currentStepId?: unknown;
  decision?: unknown;
  combat?: unknown;
  result?: unknown;
  dmNarration?: unknown;
  npcBanter?: unknown;
  dispatch?: unknown;
  transport?: unknown;
  contentSummary?: unknown;
  assetErrors?: unknown;
  sourceErrors?: unknown;
  startedAt?: unknown;
  updatedAt?: unknown;
}

export function createInitialFateKnotsState(locale: unknown) {
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
    sessionId: null as string | null,
    participantMode: "user-plus-ready-ai",
    rosterLocked: false,
    participants: [] as ReturnType<typeof createParticipant>[],
    excludedSeats: [] as ReturnType<typeof normalizeExcludedSeats>,
    waiting: createWaitingState(),
    scenarioLog: [] as string[],
    currentLocationId: null as string | null,
    currentStepId: null as string | null,
    decision: null as ReturnType<typeof normalizeDecisionState>,
    combat: null as Record<string, unknown> | null,
    result: createResultState(),
    dmNarration: null as ReturnType<typeof normalizeAmbientPacket>,
    npcBanter: null as ReturnType<typeof normalizeAmbientPacket>,
    dispatch: createPromptDispatchState(),
    transport: createTransportState(),
    contentSummary: {
      assetErrors: 0,
      sourceErrors: 0,
    },
    startedAt: null as number | null,
    updatedAt: null as number | null,
  };
}

export function normalizeFateKnotsState(candidate: unknown, localeFallback: unknown) {
  const initial = createInitialFateKnotsState(localeFallback);
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? (candidate as FateKnotsStateRecord)
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
    source.compatibility &&
    typeof source.compatibility === "object" &&
    Array.isArray(source.compatibility) === false
      ? (function () {
          const compat = source.compatibility as FateKnotsStateRecord;
          return {
            mode: normalizeText(compat.mode) || "fresh",
            reason: normalizeText(compat.reason),
          };
        })()
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
  initial.combat =
    source.combat && typeof source.combat === "object" && Array.isArray(source.combat) === false
      ? (source.combat as FateKnotsStateRecord)
      : null;
  initial.result = normalizeResultState(source.result);
  initial.dmNarration = normalizeAmbientPacket(source.dmNarration, "dm");
  initial.npcBanter = normalizeAmbientPacket(source.npcBanter, "npc");
  initial.dispatch = normalizePromptDispatchState(source.dispatch);
  initial.transport = normalizeTransportState(source.transport);
  initial.contentSummary =
    source.contentSummary &&
    typeof source.contentSummary === "object" &&
    Array.isArray(source.contentSummary) === false
      ? (function () {
          const summary = source.contentSummary as FateKnotsStateRecord;
          return {
            assetErrors:
              typeof summary.assetErrors === "number" && Number.isFinite(summary.assetErrors)
                ? Math.trunc(summary.assetErrors)
                : 0,
            sourceErrors:
              typeof summary.sourceErrors === "number" && Number.isFinite(summary.sourceErrors)
                ? Math.trunc(summary.sourceErrors)
                : 0,
          };
        })()
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

export { createDecisionState, createParticipant, createWaitingState };
