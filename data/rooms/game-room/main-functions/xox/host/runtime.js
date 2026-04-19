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
  sanitizeTarget
} from "./state.js";
import {
  readArgs,
  readCell,
  readInviteId,
  readInviteNote,
  readRemoteUserId
} from "../../../shared/host/command-args.js";
import { loadContext, readLocale } from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_FEATURE_ID,
  FEATURE_ID,
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID
} from "../../../shared/host/feature-meta.js";
import {
  dispatchNextTeamTetrisTurn,
  parseTeamTetrisStartEventNote,
  pushTeamTetrisState,
  resetTeamTetrisState
} from "../../team-tetris/host/runtime.js";
import { createTeamTetrisMatch } from "../../team-tetris/host/engine.js";
import { loadTeamTetrisState, saveTeamTetrisState } from "../../team-tetris/host/state.js";
import {
  buildInviteId,
  buildUs1InviteResponseText,
  buildUs1InviteText,
  buildUs1MoveText,
  buildUs1ResetText,
  commandMessage
} from "./copy.js";
import {
  applyOpponentMove,
  isBlocked,
  resolveStateMatchId,
  sendAiTurnUpdate
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
  userMove: "GameRoomXoxUserMove"
};
const xoxUs1Runtime = createGameRoomXoxUs1Runtime({
  DEFAULT_STARTER,
  FEATURE_ID,
  FATE_KNOTS_FEATURE_ID,
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID,
  buildInviteId,
  buildUs1InviteText,
  buildUs1MoveText,
  buildUs1ResetText,
  commandMessage,
  createInitialState,
  createPendingInvite,
  createTeamTetrisMatch,
  dispatchNextTeamTetrisTurn,
  getOpponentInfo,
  loadContext,
  loadInviteInbox,
  loadPendingInvite,
  loadState,
  loadTeamTetrisState,
  normalizeInviteInbox,
  parseTeamTetrisStartEventNote,
  pushRoomState,
  pushTeamTetrisState,
  readLocale,
  refreshRoomState,
  removePendingInvite: clearPendingInvite,
  resolveStateMatchId,
  resetTeamTetrisState,
  saveInviteInbox,
  savePendingInvite,
  saveTeamTetrisState,
  toInviteApi: toUs1InviteApi
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
  syncUs1Mailbox
} = xoxUs1Runtime;
function isSuccessfulDispatch(result) {
  return !!result && result.success === true;
}
function isSuccessfulUs1MessageSend(result) {
  return !!result && result.success === true;
}
function readNonEmptyString(value) {
  return typeof value === "string" && value !== "" ? value : null;
}
async function dispatchUs1BridgeMessage(api, msg) {
  if (typeof api.dispatchBridge !== "function") {
    return null;
  }
  const localSessionId = typeof msg["localSessionId"] === "string" && msg["localSessionId"].trim() !== "" ? msg["localSessionId"].trim() : null;
  const remoteUserId = typeof msg["remoteUserId"] === "string" && msg["remoteUserId"].trim() !== "" ? msg["remoteUserId"].trim() : null;
  const bridgeResultRaw = await api.dispatchBridge({
    action: "message.send",
    toSlot: "us1",
    ...localSessionId !== null ? {
      sessionRef: {
        id: localSessionId
      }
    } : {},
    payload: {
      ...typeof msg["text"] === "string" ? { text: msg["text"] } : {},
      ...remoteUserId !== null ? { remoteUserId } : {},
      ...msg["roomEvent"] !== void 0 ? { roomEvent: msg["roomEvent"] } : {},
      ...msg["roomCommand"] !== void 0 ? { roomCommand: msg["roomCommand"] } : {}
    }
  });
  const bridgeResult = bridgeResultRaw !== null && typeof bridgeResultRaw === "object" && Array.isArray(bridgeResultRaw) === false ? bridgeResultRaw : null;
  if (bridgeResult === null || bridgeResult["success"] !== true) {
    return bridgeResult;
  }
  const data = bridgeResult["data"] !== null && typeof bridgeResult["data"] === "object" && Array.isArray(bridgeResult["data"]) === false ? bridgeResult["data"] : {};
  const session = bridgeResult["session"] !== null && typeof bridgeResult["session"] === "object" && Array.isArray(bridgeResult["session"]) === false ? bridgeResult["session"] : {};
  return {
    success: true,
    ...typeof session["id"] === "string" ? { localSessionId: session["id"] } : {},
    ...typeof session["conversationId"] === "string" ? { conversationId: session["conversationId"] } : {},
    ...typeof data["remoteUserId"] === "string" ? { remoteUserId: data["remoteUserId"] } : {}
  };
}
function toUs1InviteApi(api) {
  const inviteApi = {
    getState(key) {
      return api.getState(key);
    },
    dispatchUs1BridgeMessage: async function(msg) {
      const result = await dispatchUs1BridgeMessage(api, msg);
      const response = {
        success: result?.success === true
      };
      const localSessionId = readNonEmptyString(result?.localSessionId);
      const conversationId = readNonEmptyString(result?.conversationId);
      if (localSessionId !== null) {
        response.localSessionId = localSessionId;
      }
      if (conversationId !== null) {
        response.conversationId = conversationId;
      }
      return response;
    },
    setState(key, value) {
      api.setState(key, value);
    }
  };
  if (typeof api.deleteState === "function") {
    inviteApi.deleteState = function(key) {
      api.deleteState?.(key);
    };
  }
  if (typeof api.getLocale === "function") {
    inviteApi.getLocale = function() {
      return api.getLocale?.();
    };
  }
  if (typeof api.notifyRoom === "function") {
    inviteApi.notifyRoom = function(event, payload) {
      api.notifyRoom?.(event, payload);
    };
  }
  return inviteApi;
}
function createUs1OpponentFallback(remoteUserId, opponentNickname) {
  return {
    slotId: "us1",
    label: "US1",
    nickname: opponentNickname || "US1",
    avatar: null,
    assigned: remoteUserId !== null,
    connected: false,
    ready: false,
    dispatchable: remoteUserId !== null,
    state: remoteUserId === null ? "empty" : "assigned",
    urlExcluded: false,
    providerId: "us1",
    accountId: null,
    remoteUserId
  };
}
function readOpponentSlot(context, target, remoteUserId, opponentNickname) {
  if (target === "us1") {
    if (remoteUserId !== null && context.slots.us1.remoteUserId === remoteUserId) {
      return context.slots.us1;
    }
    if (remoteUserId === null) {
      return context.slots.us1;
    }
    return createUs1OpponentFallback(remoteUserId, opponentNickname);
  }
  return context.slots[target];
}
async function handleStart(api, payload) {
  const locale = readLocale(api);
  const args = readArgs(payload);
  const target = sanitizeTarget(typeof args["target"] === "string" ? args["target"] : "");
  const starter = sanitizeStarter(typeof args["starter"] === "string" ? args["starter"] : "");
  const inviteNote = readInviteNote(payload);
  const context = loadContext(api);
  const opponent = readOpponentSlot(context, target, null, "");
  if (loadPendingInvite(api) !== null) {
    return { success: false, message: commandMessage(locale, "pendingInviteExists") };
  }
  if (opponent.dispatchable !== true) {
    return { success: false, message: commandMessage(locale, "needReadyOpponent") };
  }
  const state = createInitialState(locale, target, starter);
  state.opponentNickname = opponent.nickname;
  state.remoteUserId = target === "us1" ? opponent.remoteUserId || null : null;
  state.protocolPreface = inviteNote;
  if (target === "us1") {
    if (state.remoteUserId === null) {
      return { success: false, message: commandMessage(locale, "needReadyOpponent") };
    }
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
async function handleReset(api) {
  const locale = readLocale(api);
  const currentState = loadState(api);
  const pendingInvite = loadPendingInvite(api);
  const currentMatchId = resolveStateMatchId(currentState);
  const resetRemoteUserId = pendingInvite !== null && pendingInvite.direction === "outgoing" ? pendingInvite.remoteUserId || null : currentState.target === "us1" ? currentState.remoteUserId : null;
  const resetContext = pendingInvite !== null && pendingInvite.direction === "outgoing" && pendingInvite.matchId ? {
    matchId: pendingInvite.matchId,
    localSessionId: pendingInvite.localSessionId,
    remoteUserId: pendingInvite.remoteUserId
  } : currentState.target === "us1" && currentState.remoteUserId !== null && currentMatchId !== null ? {
    matchId: currentMatchId,
    localSessionId: currentState.localSessionId,
    remoteUserId: currentState.remoteUserId
  } : null;
  let remoteResetSent = true;
  if (resetContext !== null) {
    if (resetRemoteUserId === null) {
      remoteResetSent = false;
    } else {
      const sendResult = await sendUs1Reset(toUs1InviteApi(api), resetContext);
      remoteResetSent = isSuccessfulDispatch(sendResult);
    }
  }
  clearPendingInvite(api);
  const state = createInitialState(locale, DEFAULT_TARGET, DEFAULT_STARTER);
  pushRoomState(api, state);
  return {
    success: remoteResetSent,
    message: commandMessage(locale, remoteResetSent ? "reset" : "resetRemoteFailed")
  };
}
async function handleUserMove(api, payload) {
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
  if (state.target === "us1") {
    if (state.remoteUserId === null) {
      return { success: false, message: commandMessage(locale, "needReadyOpponent") };
    }
  }
  const outboundTurnIndex = state.turnIndex;
  const boardHashBeforeMove = buildBoardStateHash(state.board);
  state.board[cell] = state.userSymbol;
  state.turnIndex += 1;
  const outcome = getOutcomeForBoard(state.board, state);
  if (outcome.finished === true && "winner" in outcome && "statusKey" in outcome) {
    state.active = false;
    state.awaitingMoveFrom = null;
    state.result = outcome.result || "draw";
    state.winner = outcome.winner || "";
    state.statusKey = outcome.statusKey || "draw";
  } else {
    state.awaitingMoveFrom = "ai";
    state.result = "pending";
    state.statusKey = "aiTurn";
  }
  if (state.target === "us1") {
    const sendResult2 = await sendUs1Move(toUs1InviteApi(api), state, {
      cell,
      turnIndex: outboundTurnIndex,
      boardHashBeforeMove
    });
    if (isSuccessfulDispatch(sendResult2) === false) {
      return { success: false, message: commandMessage(locale, "dispatchFailed") };
    }
    return {
      success: true,
      message: outcome.finished === true ? resolveStatusText(state, loadContext(api)) : commandMessage(locale, "moveSent")
    };
  }
  if (outcome.finished === true) {
    pushRoomState(api, state);
    return {
      success: true,
      message: resolveStatusText(state, loadContext(api))
    };
  }
  pushRoomState(api, state);
  const sendResult = await sendAiTurnUpdate(api, state, state.protocolDelivered !== true);
  if (isSuccessfulDispatch(sendResult) === false) {
    return { success: false, message: commandMessage(locale, "dispatchFailed") };
  }
  return { success: true, message: commandMessage(locale, "moveSent") };
}
async function handleAiMove(api, payload) {
  const state = loadState(api);
  return await applyOpponentMove(api, payload, state.target, false);
}
async function handleRemoteMove(api, payload) {
  return await applyOpponentMove(api, payload, "us1", true);
}
async function handleAcceptInvite(api, payload) {
  const matchId = readInviteId(payload);
  const remoteUserId = readRemoteUserId(payload);
  const inviteEntry = matchId !== null ? findInviteById(api, matchId, remoteUserId || "") : null;
  if (inviteEntry === null) {
    return { success: false, message: commandMessage(readLocale(api), "inviteNotFound") };
  }
  if (loadPendingInvite(api) !== null || loadState(api).active === true) {
    return { success: false, message: commandMessage(readLocale(api), "pendingInviteExists") };
  }
  const sendResult = await dispatchUs1BridgeMessage(api, {
    localSessionId: inviteEntry.localSessionId || null,
    remoteUserId: inviteEntry.remoteUserId,
    text: buildUs1InviteResponseText("accept", inviteEntry),
    roomEvent: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: inviteEntry.inviteId,
      matchId: inviteEntry.matchId || inviteEntry.inviteId,
      eventType: "accept",
      starter: inviteEntry.starter,
      note: inviteEntry.note || null
    }
  });
  if (isSuccessfulUs1MessageSend(sendResult) === false) {
    return { success: false, message: commandMessage(readLocale(api), "inviteAcceptFailed") };
  }
  inviteEntry.localSessionId = readNonEmptyString(sendResult.localSessionId) || inviteEntry.localSessionId;
  inviteEntry.conversationId = readNonEmptyString(sendResult.conversationId) || inviteEntry.conversationId;
  applyInviteAcceptedState(api, inviteEntry, readIncomingInviteStarter(inviteEntry));
  await syncUs1Mailbox(api, "invite-accepted");
  return { success: true, message: commandMessage(readLocale(api), "inviteAccepted") };
}
async function handleRejectInvite(api, payload) {
  const matchId = readInviteId(payload);
  const remoteUserId = readRemoteUserId(payload);
  const inviteEntry = matchId !== null ? findInviteById(api, matchId, remoteUserId || "") : null;
  if (inviteEntry === null) {
    return { success: false, message: commandMessage(readLocale(api), "inviteNotFound") };
  }
  const sendResult = await dispatchUs1BridgeMessage(api, {
    localSessionId: inviteEntry.localSessionId || null,
    remoteUserId: inviteEntry.remoteUserId,
    text: buildUs1InviteResponseText("reject", inviteEntry),
    roomEvent: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: inviteEntry.inviteId,
      matchId: inviteEntry.matchId || inviteEntry.inviteId,
      eventType: "reject",
      starter: inviteEntry.starter,
      note: inviteEntry.note || null
    }
  });
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
  syncUs1Mailbox
};
