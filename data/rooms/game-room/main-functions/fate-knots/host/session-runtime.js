import {
  FATE_KNOTS_CONTENT_STATE_KEY,
  FATE_KNOTS_MAX_PACKET_TEXT_LENGTH,
  FATE_KNOTS_WAIT_MODES,
  FATE_KNOTS_WAIT_TIMEOUT_MS
} from "./constants.js";
import { loadFateKnotsContentRegistry } from "./content-loader.js";
import { getCurrentFateKnotsCombatTurn } from "./combat-engine.js";
import {
  createPromptDispatchState,
  createWaitingState
} from "./models.js";
import { appendFateKnotsHistory, saveFateKnotsSaveSlot } from "./state.js";
import { listPendingDecisionSeats } from "./session-participants.js";
function isRecord(value) {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}
function readOptionalString(value) {
  return typeof value === "string" && value !== "" ? value : null;
}
function isContentRegistry(value) {
  return isRecord(value) && value["cardsById"] instanceof Map && Array.isArray(value["errors"]) && value["assetRegistry"] !== void 0;
}
function readContextSlot(context, seatId) {
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
function readAssetErrorCount(contentRegistry) {
  const errors = contentRegistry.assetRegistry.errors;
  return Array.isArray(errors) ? errors.length : 0;
}
function readSendResultString(sendResult, fieldName) {
  if (isRecord(sendResult) === false) {
    return null;
  }
  return readOptionalString(sendResult[fieldName]);
}
export function buildSessionId() {
  return `fateknot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
export function ensureFateKnotsContent(api) {
  const cached = api.getState(FATE_KNOTS_CONTENT_STATE_KEY);
  if (isContentRegistry(cached)) {
    return cached;
  }
  const loaded = loadFateKnotsContentRegistry();
  api.setState(FATE_KNOTS_CONTENT_STATE_KEY, loaded);
  return loaded;
}
export function updateContentSummary(state, contentRegistry) {
  state.contentSummary = {
    assetErrors: readAssetErrorCount(contentRegistry),
    sourceErrors: Array.isArray(contentRegistry.errors) ? contentRegistry.errors.length : 0
  };
  return state;
}
export function resetPromptDispatchState(state) {
  state.dispatch = createPromptDispatchState();
}
export function clearDecisionPromptKey(state, seatId) {
  if (seatId) {
    delete state.dispatch.decisionPromptKeys[seatId];
  }
}
export function clearCombatPromptKey(state, seatId) {
  if (seatId) {
    delete state.dispatch.combatPromptKeys[seatId];
  }
}
export function clearAmbientPromptKeys(state) {
  state.dispatch.dmPromptKey = null;
  state.dispatch.npcPromptKey = null;
}
export function updateTransportFromSendResult(state, sendResult, fallbackRemoteUserId) {
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
export function getUs1RemoteUserId(api, state, context) {
  const identity = typeof api.getUs1Identity === "function" ? api.getUs1Identity() || null : null;
  const identityRemoteUserId = isRecord(identity) ? readOptionalString(identity["remoteUserId"]) : null;
  return context.slots.us1.remoteUserId || state.transport.remoteUserId || identityRemoteUserId;
}
export function sanitizePacketText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\s+/g, " ").trim().slice(0, FATE_KNOTS_MAX_PACKET_TEXT_LENGTH);
}
export function setIdleWaiting(state) {
  state.waiting = createWaitingState(FATE_KNOTS_WAIT_MODES.idle, "", []);
}
export function setDecisionWaiting(state, now) {
  const pendingSeatIds = listPendingDecisionSeats(state);
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
export function setCombatWaiting(state, now) {
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
export function markDesync(state, reason, pendingSeatIds, statusKey, now) {
  state.waiting = createWaitingState(FATE_KNOTS_WAIT_MODES.desync, reason, pendingSeatIds, now, 0);
  state.statusKey = statusKey;
}
function syncParticipantSeatStatus(state, context) {
  state.participants.forEach(function(participant) {
    if (participant.seatId === "user") {
      participant.ready = true;
      participant.connected = true;
      return;
    }
    const slot = readContextSlot(context, participant.seatId);
    participant.ready = slot?.dispatchable === true;
    participant.connected = slot?.connected !== false;
    participant.nickname = slot?.nickname || participant.nickname;
  });
}
export function maybeMarkSeatLossOrTimeout(state, context, now) {
  syncParticipantSeatStatus(state, context);
  if (!state.active) {
    return;
  }
  const missingSeat = state.participants.find(function(participant) {
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
  if (state.waiting.mode !== FATE_KNOTS_WAIT_MODES.idle && state.waiting.mode !== FATE_KNOTS_WAIT_MODES.desync && typeof state.waiting.deadlineAt === "number" && now > state.waiting.deadlineAt && Array.isArray(state.waiting.pendingSeatIds) && state.waiting.pendingSeatIds.length > 0) {
    const statusKey = state.waiting.mode === FATE_KNOTS_WAIT_MODES.decision ? "decisionTimeout" : "combatTimeout";
    markDesync(
      state,
      `${state.waiting.mode}-timeout`,
      state.waiting.pendingSeatIds,
      statusKey,
      now
    );
  }
}
export function persistRunSummary(api, state, outcome, title, summary) {
  appendFateKnotsHistory(api, {
    sessionId: state.sessionId,
    outcome,
    title,
    summary,
    locationId: state.currentLocationId,
    timestamp: Date.now(),
    roster: state.participants.map(function(participant) {
      return {
        seatId: participant.seatId,
        nickname: participant.nickname,
        type: participant.type
      };
    })
  });
  saveFateKnotsSaveSlot(api, {
    hasResumeData: false,
    lastCompletedSessionId: state.sessionId,
    lastOutcome: outcome,
    updatedAt: Date.now()
  });
}
