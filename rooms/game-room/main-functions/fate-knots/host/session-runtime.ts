import {
  FATE_KNOTS_CONTENT_STATE_KEY,
  FATE_KNOTS_MAX_PACKET_TEXT_LENGTH,
  FATE_KNOTS_WAIT_MODES,
  FATE_KNOTS_WAIT_TIMEOUT_MS,
} from "./constants.js";
import { loadFateKnotsContentRegistry } from "./content-loader.js";
import { getCurrentFateKnotsCombatTurn } from "./combat-engine.js";
import { createWaitingState } from "./models.js";
import {
  appendFateKnotsHistory,
  saveFateKnotsSaveSlot,
} from "./state.js";
import {
  listPendingDecisionSeats,
} from "./session-participants.js";

export function buildSessionId() {
  return `fateknot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureFateKnotsContent(api) {
  const cached = api.getState(FATE_KNOTS_CONTENT_STATE_KEY);
  if (cached && typeof cached === "object" && cached.assetRegistry && cached.cardsById instanceof Map) {
    return cached;
  }
  const loaded = loadFateKnotsContentRegistry();
  api.setState(FATE_KNOTS_CONTENT_STATE_KEY, loaded);
  return loaded;
}

export function updateContentSummary(state, contentRegistry) {
  state.contentSummary = {
    assetErrors: Array.isArray(contentRegistry.assetRegistry?.errors)
      ? contentRegistry.assetRegistry.errors.length
      : 0,
    sourceErrors: Array.isArray(contentRegistry.errors) ? contentRegistry.errors.length : 0,
  };
  return state;
}

export function resetPromptDispatchState(state) {
  state.dispatch = {
    decisionPromptKeys: {},
    combatPromptKeys: {},
    dmPromptKey: null,
    npcPromptKey: null,
  };
}

export function clearDecisionPromptKey(state, seatId) {
  if (state.dispatch && state.dispatch.decisionPromptKeys && seatId) {
    delete state.dispatch.decisionPromptKeys[seatId];
  }
}

export function clearCombatPromptKey(state, seatId) {
  if (state.dispatch && state.dispatch.combatPromptKeys && seatId) {
    delete state.dispatch.combatPromptKeys[seatId];
  }
}

export function clearAmbientPromptKeys(state) {
  if (!state.dispatch) {
    resetPromptDispatchState(state);
    return;
  }
  state.dispatch.dmPromptKey = null;
  state.dispatch.npcPromptKey = null;
}

export function updateTransportFromSendResult(state, sendResult, fallbackRemoteUserId) {
  if (!state.transport || typeof state.transport !== "object") {
    state.transport = {
      localSessionId: null,
      remoteUserId: null,
    };
  }
  if (sendResult && typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== "") {
    state.transport.localSessionId = sendResult.localSessionId;
  }
  if (sendResult && typeof sendResult.remoteUserId === "string" && sendResult.remoteUserId !== "") {
    state.transport.remoteUserId = sendResult.remoteUserId;
    return;
  }
  if (fallbackRemoteUserId) {
    state.transport.remoteUserId = fallbackRemoteUserId;
  }
}

export function getUs1RemoteUserId(api, state, context) {
  const identity =
    typeof api.getUs1Identity === "function" && api.getUs1Identity()
      ? api.getUs1Identity()
      : null;
  return (
    context?.slots?.us1?.remoteUserId ||
    state.transport?.remoteUserId ||
    identity?.remoteUserId ||
    null
  );
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
  const turn = getCurrentFateKnotsCombatTurn(state.combat);
  if (!turn || state.combat?.outcome !== "pending") {
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
  state.participants.forEach(function (participant) {
    if (participant.seatId === "user") {
      participant.ready = true;
      participant.connected = true;
      return;
    }
    const slot = context?.slots?.[participant.seatId] || null;
    participant.ready = slot?.ready === true;
    participant.connected = slot?.connected !== false;
    participant.nickname = slot?.nickname || participant.nickname;
  });
}

export function maybeMarkSeatLossOrTimeout(state, context, now) {
  syncParticipantSeatStatus(state, context);
  if (!state.active) {
    return;
  }

  const missingSeat = state.participants.find(function (participant) {
    return participant.seatId !== "user" && participant.ready !== true;
  });
  if (missingSeat) {
    markDesync(state, `seat-unavailable:${missingSeat.seatId}`, [missingSeat.seatId], "seatUnavailable", now);
    return;
  }

  if (
    state.waiting &&
    state.waiting.mode !== FATE_KNOTS_WAIT_MODES.idle &&
    state.waiting.mode !== FATE_KNOTS_WAIT_MODES.desync &&
    typeof state.waiting.deadlineAt === "number" &&
    now > state.waiting.deadlineAt &&
    Array.isArray(state.waiting.pendingSeatIds) &&
    state.waiting.pendingSeatIds.length > 0
  ) {
    const statusKey =
      state.waiting.mode === FATE_KNOTS_WAIT_MODES.decision
        ? "decisionTimeout"
        : "combatTimeout";
    markDesync(state, `${state.waiting.mode}-timeout`, state.waiting.pendingSeatIds, statusKey, now);
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
    roster: state.participants.map(function (participant) {
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
