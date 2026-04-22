import { loadContext, readLocale } from "../../../shared/host/context-state.js";
import { FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { fillTemplate, translate } from "../../../shared/host/text.js";
import type { GameRoomContextSnapshot } from "../../../shared/host/context-state.js";
import type {
  GameRoomContextState,
  GameRoomSlotState,
} from "../../../shared/types/room-shell-contracts.js";
import {
  type XoxGameState,
  type XoxMatchHistoryEntry,
  MATCH_HISTORY_LIMIT,
  TERMINAL_RESULTS,
  buildBoardAscii,
  getAvailableCells,
  normalizeMatchHistory,
  normalizeState,
  STATUS_COPY,
} from "./state-core.js";
import {
  type InviteEntry,
  type PendingInvite,
  normalizeInviteInbox,
  normalizePendingInvite,
} from "./state-invites.js";

interface XoxStateApi {
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  deleteState?: (key: string) => void;
  notifyRoom?: (event: string, payload: Record<string, unknown>) => void;
  getLocale?: () => unknown;
}

interface SerializedXoxState {
  roomId: string;
  featureId: string;
  board: string[];
  boardAscii: string;
  availableCells: number[];
  active: boolean;
  awaitingMoveFrom: XoxGameState["awaitingMoveFrom"];
  result: string;
  winner: XoxGameState["winner"];
  selectedTarget: string;
  starter: XoxGameState["starter"];
  protocolDelivered: boolean;
  blockedReason: string;
  userSymbol: XoxGameState["userSymbol"];
  aiSymbol: XoxGameState["aiSymbol"];
  protocolPreface: string;
  matchId: string | null;
  inviteId: string | null;
  turnIndex: number;
  localSessionId: string | null;
  remoteUserId: string | null;
  lastRemoteTransportMessageId: string | null;
  lastRemoteTurnIndex: number | null;
  pendingInvite: PendingInvite | null;
  inviteInbox: InviteEntry[];
  matchHistory: XoxMatchHistoryEntry[];
  opponent: GameRoomSlotState;
  opponentReady: boolean;
  user: {
    nickname: string;
  };
  status: string;
}

export function loadState(api: XoxStateApi): XoxGameState {
  return normalizeState(api.getState("xox-game"), readLocale(api));
}

export function saveState(api: XoxStateApi, state: XoxGameState): XoxGameState {
  const normalized = normalizeState(state, readLocale(api));
  normalized.locale = readLocale(api);
  api.setState("locale", normalized.locale);
  api.setState("xox-game", normalized);
  return normalized;
}

export function loadInviteInbox(api: XoxStateApi): InviteEntry[] {
  return normalizeInviteInbox(api.getState("xox-invite-inbox"));
}

export function saveInviteInbox(api: XoxStateApi, inviteInbox: unknown): InviteEntry[] {
  const normalized = normalizeInviteInbox(inviteInbox);
  api.setState("xox-invite-inbox", normalized);
  return normalized;
}

export function loadPendingInvite(api: XoxStateApi): PendingInvite | null {
  return normalizePendingInvite(api.getState("xox-pending-invite"));
}

export function savePendingInvite(api: XoxStateApi, pendingInvite: unknown): PendingInvite | null {
  const normalized = normalizePendingInvite(pendingInvite);
  if (normalized === null) {
    api.deleteState?.("xox-pending-invite");
    return null;
  }
  api.setState("xox-pending-invite", normalized);
  return normalized;
}

export function clearPendingInvite(api: XoxStateApi): void {
  api.deleteState?.("xox-pending-invite");
}

export function loadMatchHistory(api: XoxStateApi): XoxMatchHistoryEntry[] {
  return normalizeMatchHistory(api.getState("xox-match-history"));
}

export function saveMatchHistory(
  api: XoxStateApi,
  entries: XoxMatchHistoryEntry[]
): XoxMatchHistoryEntry[] {
  const normalized = normalizeMatchHistory(entries);
  api.setState("xox-match-history", normalized);
  return normalized;
}

export function appendMatchHistory(
  api: XoxStateApi,
  entry: XoxMatchHistoryEntry
): XoxMatchHistoryEntry[] {
  const existing = loadMatchHistory(api);
  const next = [entry, ...existing].slice(0, MATCH_HISTORY_LIMIT);
  return saveMatchHistory(api, next);
}

function buildMatchHistoryEntry(
  state: XoxGameState,
  context: GameRoomContextState | GameRoomContextSnapshot
): XoxMatchHistoryEntry | null {
  const result = state.result;
  if (result !== "user-win" && result !== "ai-win" && result !== "draw") {
    return null;
  }
  const opponent = getOpponentInfo(context, state);
  const id = state.matchId || state.inviteId || "xox-" + state.target + "-" + String(Date.now());
  return {
    id,
    finishedAt: Date.now(),
    target: state.target,
    opponentNickname: opponent.nickname || state.opponentNickname || "Rakip",
    opponentAvatar: opponent.avatar || null,
    userNickname: context.user.nickname || "User",
    userSymbol: state.userSymbol,
    aiSymbol: state.aiSymbol,
    result,
    starter: state.starter,
    board: state.board.slice(),
  };
}

export function createUs1OpponentFallback(state: XoxGameState): GameRoomSlotState {
  return {
    slotId: "us1",
    label: "US1",
    nickname: state.opponentNickname || "US1",
    avatar: null,
    assigned: state.remoteUserId !== null,
    connected: false,
    ready: false,
    dispatchable: state.remoteUserId !== null,
    state: "assigned",
    urlExcluded: false,
    providerId: "us1",
    accountId: null as string | null,
    remoteUserId: state.remoteUserId,
  };
}

export function getOpponentInfo(
  context: GameRoomContextState | GameRoomContextSnapshot,
  state: XoxGameState
): GameRoomSlotState {
  if (state.target === "us1") {
    const us1Slot = context.slots.us1;
    if (state.remoteUserId !== null && us1Slot.remoteUserId === state.remoteUserId) {
      return us1Slot;
    }
    if (state.remoteUserId === null) {
      return us1Slot;
    }
    return createUs1OpponentFallback(state);
  }

  return state.target === "ai2" ? context.slots.ai2 : context.slots.ai1;
}

export function resolveStatusText(
  state: XoxGameState,
  context: GameRoomContextState | GameRoomContextSnapshot
): string {
  const opponent = getOpponentInfo(context, state);
  return fillTemplate(translate(state.locale, STATUS_COPY, state.statusKey), {
    opponent: opponent.nickname,
  });
}

export function serializeState(
  api: XoxStateApi,
  state: XoxGameState,
  context: GameRoomContextState | GameRoomContextSnapshot
): SerializedXoxState {
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
    matchHistory: loadMatchHistory(api),
    opponent: opponent,
    opponentReady: opponent.dispatchable === true,
    user: {
      nickname: context.user.nickname,
    },
    status: resolveStatusText(state, context),
  };
}

export function pushRoomState(api: XoxStateApi, state: XoxGameState): XoxGameState {
  const context = loadContext(api);
  const previousState = loadState(api);
  const savedState = saveState(api, state);
  if (TERMINAL_RESULTS.has(savedState.result) && !TERMINAL_RESULTS.has(previousState.result)) {
    const entry = buildMatchHistoryEntry(savedState, context);
    if (entry !== null) {
      appendMatchHistory(api, entry);
    }
  }
  api.notifyRoom?.("xox-state", {
    state: serializeState(api, savedState, context),
  });
  return savedState;
}

export function refreshRoomState(api: XoxStateApi): XoxGameState {
  return pushRoomState(api, loadState(api));
}
