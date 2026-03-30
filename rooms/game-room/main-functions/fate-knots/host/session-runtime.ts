import type {
  GameRoomContextState,
  GameRoomSlotState,
} from "../../../shared/types/room-shell-contracts.js";
import {
  FATE_KNOTS_CONTENT_STATE_KEY,
  FATE_KNOTS_MAX_PACKET_TEXT_LENGTH,
  FATE_KNOTS_WAIT_MODES,
  FATE_KNOTS_WAIT_TIMEOUT_MS,
} from "./constants.js";
import { loadFateKnotsContentRegistry } from "./content-loader.js";
import { getCurrentFateKnotsCombatTurn } from "./combat-engine.js";
import {
  createPromptDispatchState,
  createWaitingState,
  type normalizeFateKnotsState,
} from "./models.js";
import { appendFateKnotsHistory, saveFateKnotsSaveSlot } from "./state.js";
import { listPendingDecisionSeats } from "./session-participants.js";

type FateKnotsBaseState = ReturnType<typeof normalizeFateKnotsState>;
type FateKnotsCombatState = Parameters<typeof getCurrentFateKnotsCombatTurn>[0];
type FateKnotsState = Omit<FateKnotsBaseState, "combat"> & {
  combat: FateKnotsCombatState | null;
};
type FateKnotsParticipant = FateKnotsState["participants"][number];
type FateKnotsDecisionSeatState = Parameters<typeof listPendingDecisionSeats>[0];
type FateKnotsSendResult =
  | {
      localSessionId?: unknown;
      remoteUserId?: unknown;
    }
  | null
  | undefined;
type FateKnotsUs1Identity = {
  remoteUserId?: unknown;
};

type FateKnotsContentRegistry = ReturnType<typeof loadFateKnotsContentRegistry>;

type RoomApi = Parameters<typeof appendFateKnotsHistory>[0] & {
  getUs1Identity?: () => FateKnotsUs1Identity | null | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function isContentRegistry(value: unknown): value is FateKnotsContentRegistry {
  return (
    isRecord(value) &&
    value["cardsById"] instanceof Map &&
    Array.isArray(value["errors"]) &&
    value["assetRegistry"] !== undefined
  );
}

function readContextSlot(context: GameRoomContextState, seatId: string): GameRoomSlotState | null {
  if (seatId === "ai1") {
    return context.slots.ai1;
  }
  if (seatId === "ai2") {
    return context.slots.ai2;
  }
  if (seatId === "us1") {
    return context.slots.us1;
  }
  return null;
}

function readAssetErrorCount(contentRegistry: FateKnotsContentRegistry): number {
  const errors = contentRegistry.assetRegistry.errors;
  return Array.isArray(errors) ? errors.length : 0;
}

function readSendResultString(
  sendResult: FateKnotsSendResult,
  fieldName: "localSessionId" | "remoteUserId"
): string | null {
  if (isRecord(sendResult) === false) {
    return null;
  }
  return readOptionalString(sendResult[fieldName]);
}

export function buildSessionId() {
  return `fateknot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureFateKnotsContent(api: RoomApi): FateKnotsContentRegistry {
  const cached = api.getState(FATE_KNOTS_CONTENT_STATE_KEY);
  if (isContentRegistry(cached)) {
    return cached;
  }

  const loaded: FateKnotsContentRegistry = loadFateKnotsContentRegistry();
  api.setState(FATE_KNOTS_CONTENT_STATE_KEY, loaded);
  return loaded;
}

export function updateContentSummary(
  state: FateKnotsState,
  contentRegistry: FateKnotsContentRegistry
) {
  state.contentSummary = {
    assetErrors: readAssetErrorCount(contentRegistry),
    sourceErrors: Array.isArray(contentRegistry.errors) ? contentRegistry.errors.length : 0,
  };
  return state;
}

export function resetPromptDispatchState(state: FateKnotsState) {
  state.dispatch = createPromptDispatchState();
}

export function clearDecisionPromptKey(state: FateKnotsState, seatId: string) {
  if (seatId) {
    delete state.dispatch.decisionPromptKeys[seatId];
  }
}

export function clearCombatPromptKey(state: FateKnotsState, seatId: string) {
  if (seatId) {
    delete state.dispatch.combatPromptKeys[seatId];
  }
}

export function clearAmbientPromptKeys(state: FateKnotsState) {
  state.dispatch.dmPromptKey = null;
  state.dispatch.npcPromptKey = null;
}

export function updateTransportFromSendResult(
  state: FateKnotsState,
  sendResult: FateKnotsSendResult,
  fallbackRemoteUserId: string | null | undefined
) {
  const localSessionId = readSendResultString(sendResult, "localSessionId");
  const remoteUserId = readSendResultString(sendResult, "remoteUserId");

  if (localSessionId !== null) {
    state.transport.localSessionId = localSessionId;
  }
  if (remoteUserId !== null) {
    state.transport.remoteUserId = remoteUserId;
    return;
  }
  if (fallbackRemoteUserId) {
    state.transport.remoteUserId = fallbackRemoteUserId;
  }
}

export function getUs1RemoteUserId(
  api: RoomApi,
  state: FateKnotsState,
  context: GameRoomContextState
) {
  const identity = typeof api.getUs1Identity === "function" ? api.getUs1Identity() || null : null;
  const identityRemoteUserId = isRecord(identity)
    ? readOptionalString(identity["remoteUserId"])
    : null;

  return context.slots.us1.remoteUserId || state.transport.remoteUserId || identityRemoteUserId;
}

export function sanitizePacketText(text: unknown) {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\s+/g, " ").trim().slice(0, FATE_KNOTS_MAX_PACKET_TEXT_LENGTH);
}

export function setIdleWaiting(state: FateKnotsState) {
  state.waiting = createWaitingState(FATE_KNOTS_WAIT_MODES.idle, "", []);
}

export function setDecisionWaiting(state: FateKnotsState, now: number) {
  const pendingSeatIds = listPendingDecisionSeats(state as unknown as FateKnotsDecisionSeatState);
  if (pendingSeatIds.length === 0) {
    setIdleWaiting(state);
    return;
  }
  if (pendingSeatIds.length === 1 && pendingSeatIds[0] === "us1") {
    state.statusKey = "remotePending";
  }
  state.waiting = createWaitingState(
    FATE_KNOTS_WAIT_MODES.decision,
    "",
    pendingSeatIds,
    now,
    FATE_KNOTS_WAIT_TIMEOUT_MS
  );
}

export function setCombatWaiting(state: FateKnotsState, now: number) {
  const combat = state.combat;
  const turn = combat ? getCurrentFateKnotsCombatTurn(combat) : null;
  if (!combat || !turn || combat.outcome !== "pending") {
    setIdleWaiting(state);
    return;
  }
  if (turn.side === "party" && turn.seatId !== "user") {
    state.statusKey = turn.seatId === "us1" ? "combatTurnRemote" : "combatTurnAi";
    state.waiting = createWaitingState(
      FATE_KNOTS_WAIT_MODES.combat,
      "",
      [turn.seatId],
      now,
      FATE_KNOTS_WAIT_TIMEOUT_MS
    );
    return;
  }
  setIdleWaiting(state);
}

export function markDesync(
  state: FateKnotsState,
  reason: string,
  pendingSeatIds: string[],
  statusKey: string,
  now: number
) {
  state.waiting = createWaitingState(FATE_KNOTS_WAIT_MODES.desync, reason, pendingSeatIds, now, 0);
  state.statusKey = statusKey;
}

function syncParticipantSeatStatus(state: FateKnotsState, context: GameRoomContextState) {
  state.participants.forEach(function (participant: FateKnotsParticipant) {
    if (participant.seatId === "user") {
      participant.ready = true;
      participant.connected = true;
      return;
    }
    const slot = readContextSlot(context, participant.seatId);
    participant.ready = slot?.ready === true;
    participant.connected = slot?.connected !== false;
    participant.nickname = slot?.nickname || participant.nickname;
  });
}

export function maybeMarkSeatLossOrTimeout(
  state: FateKnotsState,
  context: GameRoomContextState,
  now: number
) {
  syncParticipantSeatStatus(state, context);
  if (!state.active) {
    return;
  }

  const missingSeat =
    state.participants.find(function (participant: FateKnotsParticipant) {
      return participant.seatId !== "user" && participant.ready !== true;
    }) || null;
  if (missingSeat) {
    markDesync(
      state,
      `seat-unavailable:${missingSeat.seatId}`,
      [missingSeat.seatId],
      "seatUnavailable",
      now
    );
    return;
  }

  if (
    state.waiting.mode !== FATE_KNOTS_WAIT_MODES.idle &&
    state.waiting.mode !== FATE_KNOTS_WAIT_MODES.desync &&
    typeof state.waiting.deadlineAt === "number" &&
    now > state.waiting.deadlineAt &&
    Array.isArray(state.waiting.pendingSeatIds) &&
    state.waiting.pendingSeatIds.length > 0
  ) {
    const statusKey =
      state.waiting.mode === FATE_KNOTS_WAIT_MODES.decision ? "decisionTimeout" : "combatTimeout";
    markDesync(
      state,
      `${state.waiting.mode}-timeout`,
      state.waiting.pendingSeatIds,
      statusKey,
      now
    );
  }
}

export function persistRunSummary(
  api: RoomApi,
  state: FateKnotsState,
  outcome: string,
  title: string,
  summary: string
) {
  appendFateKnotsHistory(api, {
    sessionId: state.sessionId,
    outcome,
    title,
    summary,
    locationId: state.currentLocationId,
    timestamp: Date.now(),
    roster: state.participants.map(function (participant: FateKnotsParticipant) {
      return {
        seatId: participant.seatId,
        nickname: participant.nickname,
        type: participant.type,
      };
    }),
  });
  saveFateKnotsSaveSlot(api, {
    hasResumeData: false,
    lastCompletedSessionId: state.sessionId,
    lastOutcome: outcome,
    updatedAt: Date.now(),
  });
}
