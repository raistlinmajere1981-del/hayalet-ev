import {
  DEFAULT_STARTER,
  DEFAULT_TARGET,
  buildBoardStateHash,
  createInitialState,
  createPendingInvite,
  getOpponentInfo,
  getOutcomeForBoard,
  loadInviteInbox,
  loadPendingInvite,
  loadState,
  normalizeInviteInbox,
  pushRoomState,
  refreshRoomState,
  resolveStatusText,
  saveInviteInbox,
  savePendingInvite,
  clearPendingInvite,
  sanitizeStarter,
  sanitizeTarget,
} from "./state.js";
import {
  readArgs,
  readCell,
  readInviteId,
  readInviteNote,
  readRemoteUserId,
} from "../../../shared/host/command-args.js";
import { loadContext, readLocale } from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_FEATURE_ID,
  FEATURE_ID,
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID,
} from "../../../shared/host/feature-meta.js";
import {
  blockTeamTetrisMatch,
  dispatchNextTeamTetrisTurn,
  parseTeamTetrisStartEventNote,
  pushTeamTetrisState,
  resetTeamTetrisState,
} from "../../team-tetris/host/runtime.js";
import { createTeamTetrisMatch } from "../../team-tetris/host/engine.js";
import {
  loadTeamTetrisState,
  saveTeamTetrisState,
} from "../../team-tetris/host/state.js";
import {
  buildInviteId,
  buildUs1InviteResponseText,
  buildUs1InviteText,
  buildUs1MoveText,
  buildUs1ResetText,
  commandMessage,
} from "./copy.js";
import {
  applyOpponentMove,
  isBlocked,
  resolveStateMatchId,
  sendAiTurnUpdate,
} from "./runtime-match.js";
import { syncFromContext } from "./runtime-sync.js";
import { createGameRoomXoxUs1Runtime } from "./us1-runtime.js";

const XOX_COMMAND_NAMES = {
  acceptInvite: "GameRoomXoxAcceptInvite",
  aiMove: "GameRoomXoxAiMove",
  rejectInvite: "GameRoomXoxRejectInvite",
  remoteMove: "GameRoomXoxRemoteMove",
  reset: "GameRoomXoxReset",
  start: "GameRoomXoxStart",
  userMove: "GameRoomXoxUserMove",
};

const xoxUs1Runtime = createGameRoomXoxUs1Runtime({
  DEFAULT_STARTER: DEFAULT_STARTER,
  FEATURE_ID: FEATURE_ID,
  FATE_KNOTS_FEATURE_ID: FATE_KNOTS_FEATURE_ID,
  ROOM_ID: ROOM_ID,
  TEAM_TETRIS_FEATURE_ID: TEAM_TETRIS_FEATURE_ID,
  blockTeamTetrisMatch: blockTeamTetrisMatch,
  buildInviteId: buildInviteId,
  buildUs1InviteResponseText: buildUs1InviteResponseText,
  buildUs1InviteText: buildUs1InviteText,
  buildUs1MoveText: buildUs1MoveText,
  buildUs1ResetText: buildUs1ResetText,
  commandMessage: commandMessage,
  createInitialState: createInitialState,
  createPendingInvite: createPendingInvite,
  createTeamTetrisMatch: createTeamTetrisMatch,
  dispatchNextTeamTetrisTurn: dispatchNextTeamTetrisTurn,
  getOpponentInfo: getOpponentInfo,
  loadContext: loadContext,
  loadInviteInbox: loadInviteInbox,
  loadPendingInvite: loadPendingInvite,
  loadState: loadState,
  loadTeamTetrisState: loadTeamTetrisState,
  normalizeInviteInbox: normalizeInviteInbox,
  parseTeamTetrisStartEventNote: parseTeamTetrisStartEventNote,
  pushRoomState: pushRoomState,
  pushTeamTetrisState: pushTeamTetrisState,
  readLocale: readLocale,
  refreshRoomState: refreshRoomState,
  removePendingInvite: clearPendingInvite,
  resolveStateMatchId: resolveStateMatchId,
  resetTeamTetrisState: resetTeamTetrisState,
  saveInviteInbox: saveInviteInbox,
  savePendingInvite: savePendingInvite,
  saveTeamTetrisState: saveTeamTetrisState,
});
const {
  applyInviteAcceptedState,
  clearUs1SyncLoop,
  ensureUs1SyncLoop,
  findInviteById,
  processRoomCommands,
  processRoomEvents,
  readIncomingInviteStarter,
  removeInviteFromInbox,
  sendUs1Invite,
  sendUs1Move,
  sendUs1Reset,
  syncUs1Mailbox,
} = xoxUs1Runtime;

type XoxCommandResult = { success: boolean; message: string };
type XoxResetContext = {
  matchId: string;
  localSessionId: string | null;
};
type CommandDispatchResult = { success?: boolean } | null | undefined;
type Us1MessageSendResult = {
  success?: boolean;
  localSessionId?: unknown;
  conversationId?: unknown;
} | null | undefined;

function isSuccessfulDispatch(result: CommandDispatchResult): result is { success: true } {
  return !!result && result.success === true;
}

function isSuccessfulUs1MessageSend(
  result: Us1MessageSendResult,
): result is { success: true; localSessionId?: unknown; conversationId?: unknown } {
  return !!result && result.success === true;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

async function handleStart(api, payload: unknown): Promise<XoxCommandResult> {
  const locale = readLocale(api);
  const args = readArgs(payload);
  const target = sanitizeTarget(args.target);
  const starter = sanitizeStarter(args.starter);
  const inviteNote = readInviteNote(payload);
  const context = loadContext(api);
  const opponent =
    target === "us1"
      ? context.slots.us1
      : getOpponentInfo(context, { target: target, remoteUserId: null, opponentNickname: "" });

  if (loadPendingInvite(api) !== null) {
    return { success: false, message: commandMessage(locale, "pendingInviteExists") };
  }

  if (opponent.ready !== true) {
    return { success: false, message: commandMessage(locale, "needReadyOpponent") };
  }

  const state = createInitialState(locale, target, starter);
  state.opponentNickname = opponent.nickname;
  state.remoteUserId = target === "us1" ? opponent.remoteUserId || null : null;
  state.protocolPreface = inviteNote;

  if (target === "us1") {
    return await sendUs1Invite(api, state, inviteNote);
  }

  state.active = true;
  state.awaitingMoveFrom = starter === "ai" ? "ai" : "user";
  state.result = "pending";
  state.statusKey = starter === "ai" ? "aiTurn" : "userTurn";
  pushRoomState(api, state);

  if (starter === "ai") {
    const sendResult = await sendAiTurnUpdate(api, state, true);
    if (isSuccessfulDispatch(sendResult) === false) {
      return { success: false, message: commandMessage(locale, "dispatchFailed") };
    }
  }

  return { success: true, message: commandMessage(locale, "started") };
}

async function handleReset(api): Promise<XoxCommandResult> {
  const locale = readLocale(api);
  const currentState = loadState(api);
  const pendingInvite = loadPendingInvite(api);
  const resetContext: XoxResetContext | null =
    pendingInvite !== null && pendingInvite.direction === "outgoing" && pendingInvite.matchId
      ? {
          matchId: pendingInvite.matchId,
          localSessionId: pendingInvite.localSessionId,
        }
      : currentState.target === "us1" &&
          currentState.remoteUserId !== null &&
          resolveStateMatchId(currentState) !== null
        ? {
            matchId: resolveStateMatchId(currentState),
            localSessionId: currentState.localSessionId,
          }
        : null;

  let remoteResetSent = true;
  if (resetContext !== null) {
    const sendResult = await sendUs1Reset(api, resetContext);
    remoteResetSent = isSuccessfulDispatch(sendResult);
  }

  clearPendingInvite(api);
  const state = createInitialState(locale, DEFAULT_TARGET, DEFAULT_STARTER);
  pushRoomState(api, state);
  return {
    success: remoteResetSent,
    message: commandMessage(locale, remoteResetSent ? "reset" : "resetRemoteFailed"),
  };
}

async function handleUserMove(api, payload: unknown): Promise<XoxCommandResult> {
  const state = loadState(api);
  const locale = state.locale;
  const cell = readCell(payload);

  if (state.active !== true) {
    return { success: false, message: commandMessage(locale, "noActiveGame") };
  }
  if (isBlocked(state)) {
    return { success: false, message: commandMessage(locale, "blockedGame") };
  }
  if (state.awaitingMoveFrom !== "user") {
    return { success: false, message: commandMessage(locale, "notUserTurn") };
  }
  if (cell === null || cell < 0 || cell > 8) {
    return { success: false, message: commandMessage(locale, "invalidCell") };
  }
  if (state.board[cell] !== "") {
    return { success: false, message: commandMessage(locale, "cellFilled") };
  }

  const outboundTurnIndex = state.turnIndex;
  const boardHashBeforeMove = buildBoardStateHash(state.board);

  state.board[cell] = state.userSymbol;
  state.turnIndex += 1;
  const outcome = getOutcomeForBoard(state.board, state);

  if (outcome.finished === true) {
    state.active = false;
    state.awaitingMoveFrom = null;
    state.result = outcome.result;
    state.winner = outcome.winner;
    state.statusKey = outcome.statusKey;
  } else {
    state.awaitingMoveFrom = "ai";
    state.result = "pending";
    state.statusKey = "aiTurn";
  }

  if (state.target === "us1") {
    const sendResult = await sendUs1Move(api, state, {
      cell: cell,
      turnIndex: outboundTurnIndex,
      boardHashBeforeMove: boardHashBeforeMove,
    });
    if (isSuccessfulDispatch(sendResult) === false) {
      return { success: false, message: commandMessage(locale, "dispatchFailed") };
    }
    return {
      success: true,
      message:
        outcome.finished === true
          ? resolveStatusText(state, loadContext(api))
          : commandMessage(locale, "moveSent"),
    };
  }

  if (outcome.finished === true) {
    pushRoomState(api, state);
    return { success: true, message: resolveStatusText(state, loadContext(api)) };
  }

  pushRoomState(api, state);

  const sendResult = await sendAiTurnUpdate(api, state, state.protocolDelivered !== true);
  if (isSuccessfulDispatch(sendResult) === false) {
    return { success: false, message: commandMessage(locale, "dispatchFailed") };
  }

  return { success: true, message: commandMessage(locale, "moveSent") };
}

async function handleAiMove(api, payload: unknown): Promise<XoxCommandResult> {
  const state = loadState(api);
  return await applyOpponentMove(api, payload, state.target, false);
}

async function handleRemoteMove(api, payload: unknown): Promise<XoxCommandResult> {
  return await applyOpponentMove(api, payload, "us1", true);
}

async function handleAcceptInvite(api, payload: unknown): Promise<XoxCommandResult> {
  const matchId = readInviteId(payload);
  const remoteUserId = readRemoteUserId(payload);
  const inviteEntry = matchId !== null ? findInviteById(api, matchId, remoteUserId) : null;
  if (inviteEntry === null) {
    return { success: false, message: commandMessage(readLocale(api), "inviteNotFound") };
  }

  if (loadPendingInvite(api) !== null || loadState(api).active === true) {
    return { success: false, message: commandMessage(readLocale(api), "pendingInviteExists") };
  }

  const selected = await api.selectUs1RemoteUser(inviteEntry.remoteUserId);
  if (selected !== true) {
    return { success: false, message: commandMessage(readLocale(api), "inviteAcceptFailed") };
  }

  const sendResult = (await api.sendUs1Message({
    localSessionId: inviteEntry.localSessionId || null,
    text: buildUs1InviteResponseText("accept", inviteEntry),
    roomEvent: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: inviteEntry.inviteId,
      matchId: inviteEntry.matchId || inviteEntry.inviteId,
      eventType: "accept",
      starter: inviteEntry.starter,
      note: inviteEntry.note || null,
    },
  })) as Us1MessageSendResult;

  if (isSuccessfulUs1MessageSend(sendResult) === false) {
    return { success: false, message: commandMessage(readLocale(api), "inviteAcceptFailed") };
  }

  inviteEntry.localSessionId = readNonEmptyString(sendResult.localSessionId) || inviteEntry.localSessionId;
  inviteEntry.conversationId = readNonEmptyString(sendResult.conversationId) || inviteEntry.conversationId;
  applyInviteAcceptedState(api, inviteEntry, readIncomingInviteStarter(inviteEntry));
  await syncUs1Mailbox(api, "invite-accepted");
  return { success: true, message: commandMessage(readLocale(api), "inviteAccepted") };
}

async function handleRejectInvite(api, payload: unknown): Promise<XoxCommandResult> {
  const matchId = readInviteId(payload);
  const remoteUserId = readRemoteUserId(payload);
  const inviteEntry = matchId !== null ? findInviteById(api, matchId, remoteUserId) : null;
  if (inviteEntry === null) {
    return { success: false, message: commandMessage(readLocale(api), "inviteNotFound") };
  }

  const selected = await api.selectUs1RemoteUser(inviteEntry.remoteUserId);
  if (selected !== true) {
    return { success: false, message: commandMessage(readLocale(api), "inviteRejectFailed") };
  }

  const sendResult = (await api.sendUs1Message({
    localSessionId: inviteEntry.localSessionId || null,
    text: buildUs1InviteResponseText("reject", inviteEntry),
    roomEvent: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: inviteEntry.inviteId,
      matchId: inviteEntry.matchId || inviteEntry.inviteId,
      eventType: "reject",
      starter: inviteEntry.starter,
      note: inviteEntry.note || null,
    },
  })) as Us1MessageSendResult;

  if (isSuccessfulUs1MessageSend(sendResult) === false) {
    return { success: false, message: commandMessage(readLocale(api), "inviteRejectFailed") };
  }

  removeInviteFromInbox(api, inviteEntry.matchId || inviteEntry.inviteId, inviteEntry.remoteUserId);
  refreshRoomState(api);
  await syncUs1Mailbox(api, "invite-rejected");
  return { success: true, message: commandMessage(readLocale(api), "inviteRejected") };
}

export {
  XOX_COMMAND_NAMES,
  handleAcceptInvite,
  handleAiMove,
  handleRejectInvite,
  handleRemoteMove,
  handleReset,
  handleStart,
  handleUserMove,
  clearUs1SyncLoop,
  ensureUs1SyncLoop,
  processRoomCommands,
  processRoomEvents,
  syncFromContext,
  syncUs1Mailbox,
};
