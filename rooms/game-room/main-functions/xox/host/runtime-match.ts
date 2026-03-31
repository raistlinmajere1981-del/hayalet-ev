import {
  buildBoardStateHash,
  getOpponentInfo,
  getOutcomeForBoard,
  loadState,
  pushRoomState,
  resolveStatusText,
  saveState,
} from "./state.js";
import type { XoxGameState } from "./state-core.js";
import {
  readBoardHashBeforeMove,
  readCell,
  readInviteId,
  readRemoteUserId,
  readTransportMessageId,
  readTurnIndex,
} from "../../../shared/host/command-args.js";
import { loadContext } from "../../../shared/host/context-state.js";
import { FEATURE_ID, ROOM_ID } from "../../../shared/host/feature-meta.js";
import { buildAiTurnMessage, commandMessage } from "./copy.js";
import type {
  GameRoomContextState,
  GameRoomSlotState,
} from "../../../shared/types/room-shell-contracts.js";

export type XoxCommandResult = {
  success: boolean;
  message: string;
};

type XoxDispatchResult =
  | {
      success?: boolean;
    }
  | null
  | undefined;

export interface XoxRuntimeMatchApi {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
  deleteState?(key: string): void;
  getLocale?(): unknown;
  notifyRoom?(event: string, payload: Record<string, unknown>): void;
  dispatchBridge?(options: Record<string, unknown>): Promise<XoxDispatchResult>;
}

function readProviderValue(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }
  const source = payload as { provider?: unknown };
  return typeof source.provider === "string" ? source.provider : "";
}

function readOpponentInfo(context: GameRoomContextState, state: XoxGameState): GameRoomSlotState {
  return getOpponentInfo(context, state);
}

async function sendBridgeMessageSafe(
  api: XoxRuntimeMatchApi,
  options: {
    provider: string;
    page: string;
    text: string;
    protocol?: {
      room: string;
      scenario: string;
      preface?: string | null;
      context: Record<string, unknown>;
    };
  }
): Promise<XoxDispatchResult> {
  if (typeof api.dispatchBridge !== "function") {
    return null;
  }
  return await api.dispatchBridge({
    action: "message.send",
    toSlot: options.provider,
    payload: {
      text: options.text,
      page: options.page,
      ...(options.protocol !== undefined ? { protocol: options.protocol } : {}),
    },
  });
}

export function resolveStateMatchId(state: XoxGameState): string | null {
  return state.matchId || state.inviteId || null;
}

export function isBlocked(state: XoxGameState): boolean {
  return state.result === "blocked" || state.blockedReason !== "";
}

export function blockMatch(
  api: XoxRuntimeMatchApi,
  state: XoxGameState,
  statusKey: string,
  blockedReason: string
): XoxGameState {
  state.active = true;
  state.awaitingMoveFrom = null;
  state.result = "blocked";
  state.winner = "";
  state.statusKey = statusKey;
  state.blockedReason = blockedReason;
  return pushRoomState(api, state);
}

export async function sendAiTurnUpdate(
  api: XoxRuntimeMatchApi,
  state: XoxGameState,
  includeProtocol: boolean
): Promise<XoxCommandResult | XoxDispatchResult> {
  const context = loadContext(api) as GameRoomContextState;
  const opponent = readOpponentInfo(context, state);

  if (opponent.ready !== true) {
    blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
    return { success: false, message: commandMessage(state.locale, "needReadyOpponent") };
  }

  const shouldIncludeProtocol = includeProtocol === true && state.protocolDelivered !== true;
  const messageResult = await sendBridgeMessageSafe(api, {
    provider: state.target,
    page: "ui/index.html",
    text: buildAiTurnMessage(state, context),
    ...(shouldIncludeProtocol
      ? {
          protocol: {
            room: ROOM_ID,
            scenario: state.starter === "ai" ? "xox-ai-start" : "xox-user-start",
            preface: state.protocolPreface || null,
            context: {
              featureId: FEATURE_ID,
              starter: state.starter,
              aiSymbol: state.aiSymbol,
              userSymbol: state.userSymbol,
            },
          },
        }
      : {}),
  });

  if (messageResult && messageResult.success === true) {
    if (shouldIncludeProtocol) {
      state.protocolDelivered = true;
      saveState(api, state);
    }
    pushRoomState(api, state);
    return messageResult;
  }

  blockMatch(
    api,
    state,
    "blockedDispatch",
    shouldIncludeProtocol ? "protocol-dispatch-failed" : "turn-dispatch-failed"
  );
  return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
}

export async function applyOpponentMove(
  api: XoxRuntimeMatchApi,
  payload: unknown,
  expectedProvider: string,
  requireInviteMatch: boolean
): Promise<XoxCommandResult> {
  const state = loadState(api);
  const locale = state.locale;
  const provider = readProviderValue(payload);
  const cell = readCell(payload);
  const matchId = readInviteId(payload);
  const turnIndex = readTurnIndex(payload);
  const boardHashBeforeMove = readBoardHashBeforeMove(payload);
  const transportMessageId = readTransportMessageId(payload);
  const remoteUserId = readRemoteUserId(payload);
  const currentMatchId = resolveStateMatchId(state);

  if (state.active !== true) {
    return { success: false, message: commandMessage(locale, "noActiveGame") };
  }
  if (isBlocked(state)) {
    return { success: false, message: commandMessage(locale, "blockedGame") };
  }
  if (provider !== "" && provider !== expectedProvider) {
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  if (
    expectedProvider === "us1" &&
    (remoteUserId === null || state.remoteUserId === null || remoteUserId !== state.remoteUserId)
  ) {
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  if (
    expectedProvider === "us1" &&
    transportMessageId !== null &&
    state.lastRemoteTransportMessageId !== null &&
    transportMessageId === state.lastRemoteTransportMessageId
  ) {
    return { success: false, message: commandMessage(locale, "duplicateRemoteMove") };
  }
  if (requireInviteMatch === true && currentMatchId !== null && matchId !== currentMatchId) {
    return { success: false, message: commandMessage(locale, "inviteMismatch") };
  }
  if (
    expectedProvider === "us1" &&
    ((turnIndex !== null && turnIndex !== state.turnIndex) ||
      (boardHashBeforeMove !== null && boardHashBeforeMove !== buildBoardStateHash(state.board)))
  ) {
    return { success: false, message: commandMessage(locale, "staleRemoteMove") };
  }
  if (state.awaitingMoveFrom !== "ai") {
    return { success: false, message: commandMessage(locale, "aiTurnOnly") };
  }
  if (cell === null || cell < 0 || cell > 8) {
    blockMatch(api, state, "blockedInvalidMove", "ai-invalid-cell");
    return { success: false, message: commandMessage(locale, "aiInvalidMove") };
  }
  if (state.board[cell] !== "") {
    blockMatch(api, state, "blockedInvalidMove", "ai-filled-cell");
    return { success: false, message: commandMessage(locale, "aiFilledCell") };
  }

  state.board[cell] = state.aiSymbol;
  state.turnIndex += 1;
  if (expectedProvider === "us1") {
    state.lastRemoteTransportMessageId = transportMessageId;
    state.lastRemoteTurnIndex = turnIndex;
  }
  const outcome = getOutcomeForBoard(state.board, state);

  if (outcome.finished === true && "winner" in outcome && "statusKey" in outcome) {
    state.active = false;
    state.awaitingMoveFrom = null;
    state.result = outcome.result || "draw";
    state.winner = (outcome.winner || "") as typeof state.winner;
    state.statusKey = outcome.statusKey || "draw";
  } else {
    state.awaitingMoveFrom = "user";
    state.result = "pending";
    state.statusKey = "userTurn";
  }

  pushRoomState(api, state);
  return {
    success: true,
    message: resolveStatusText(state, loadContext(api) as GameRoomContextState),
  };
}
