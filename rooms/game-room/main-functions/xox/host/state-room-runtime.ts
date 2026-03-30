import { createSlotState, loadContext, readLocale } from "../../../shared/host/context-state.js";
import { FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { fillTemplate, translate } from "../../../shared/host/text.js";
import {
  type XoxGameState,
  buildBoardAscii,
  getAvailableCells,
  normalizeState,
  STATUS_COPY,
} from "./state-core.js";
import { normalizeInviteInbox, normalizePendingInvite } from "./state-invites.js";

export function loadState(api: any) {
  return normalizeState(api.getState("xox-game"), readLocale(api));
}

export function saveState(api: any, state: XoxGameState) {
  const normalized = normalizeState(state, readLocale(api));
  normalized.locale = readLocale(api);
  api.setState("locale", normalized.locale);
  api.setState("xox-game", normalized);
  return normalized;
}

export function loadInviteInbox(api: any) {
  return normalizeInviteInbox(api.getState("xox-invite-inbox"));
}

export function saveInviteInbox(api: any, inviteInbox: unknown) {
  const normalized = normalizeInviteInbox(inviteInbox);
  api.setState("xox-invite-inbox", normalized);
  return normalized;
}

export function loadPendingInvite(api: any) {
  return normalizePendingInvite(api.getState("xox-pending-invite"));
}

export function savePendingInvite(api: any, pendingInvite: unknown) {
  const normalized = normalizePendingInvite(pendingInvite);
  if (normalized === null) {
    api.deleteState("xox-pending-invite");
    return null;
  }
  api.setState("xox-pending-invite", normalized);
  return normalized;
}

export function clearPendingInvite(api: any) {
  api.deleteState("xox-pending-invite");
}

export function createUs1OpponentFallback(state: XoxGameState) {
  return {
    slotId: "us1",
    nickname: state.opponentNickname || "US1",
    assigned: state.remoteUserId !== null,
    connected: false,
    ready: false,
    state: "assigned",
    urlExcluded: false,
    accountId: null as string | null,
    remoteUserId: state.remoteUserId,
  };
}

export function getOpponentInfo(context: any, state: XoxGameState) {
  if (state.target === "us1") {
    const slot = context && context.slots ? context.slots.us1 : null;
    if (slot && state.remoteUserId !== null && slot.remoteUserId === state.remoteUserId) {
      return slot;
    }
    if (slot && state.remoteUserId === null) {
      return slot;
    }
    return createUs1OpponentFallback(state);
  }

  if (context && context.slots && context.slots[state.target]) {
    return context.slots[state.target];
  }
  return createSlotState(state.target);
}

export function resolveStatusText(state: XoxGameState, context: any) {
  const opponent = getOpponentInfo(context, state);
  return fillTemplate(translate(state.locale, STATUS_COPY, state.statusKey), {
    opponent: opponent.nickname,
  });
}

export function serializeState(api: any, state: XoxGameState, context: any) {
  const opponent = getOpponentInfo(context, state);
  return {
    roomId: ROOM_ID,
    featureId: FEATURE_ID,
    board: state.board.slice(),
    boardAscii: buildBoardAscii(state.board),
    availableCells: getAvailableCells(state.board),
    active: state.active,
    awaitingMoveFrom: state.awaitingMoveFrom,
    result: state.result,
    winner: state.winner,
    selectedTarget: state.target,
    starter: state.starter,
    protocolDelivered: state.protocolDelivered,
    blockedReason: state.blockedReason,
    userSymbol: state.userSymbol,
    aiSymbol: state.aiSymbol,
    protocolPreface: state.protocolPreface,
    matchId: state.matchId,
    inviteId: state.inviteId,
    turnIndex: state.turnIndex,
    localSessionId: state.localSessionId,
    remoteUserId: state.remoteUserId,
    lastRemoteTransportMessageId: state.lastRemoteTransportMessageId,
    lastRemoteTurnIndex: state.lastRemoteTurnIndex,
    pendingInvite: loadPendingInvite(api),
    inviteInbox: loadInviteInbox(api),
    opponent: opponent,
    opponentReady: opponent.ready === true,
    user: {
      nickname: context.user.nickname,
    },
    status: resolveStatusText(state, context),
  };
}

export function pushRoomState(api: any, state: XoxGameState) {
  const context = loadContext(api);
  const savedState = saveState(api, state);
  api.notifyRoom("xox-state", {
    state: serializeState(api, savedState, context),
  });
  return savedState;
}

export function refreshRoomState(api: any) {
  return pushRoomState(api, loadState(api));
}
