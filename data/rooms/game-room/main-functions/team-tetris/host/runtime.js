import {
  applyTeamTetrisMove,
  buildTeamTetrisBoardHash,
  createTeamTetrisMatch,
  TEAM_TETRIS_SCHEMA_VERSION
} from "./engine.js";
import { loadTeamTetrisState, saveTeamTetrisState } from "./state.js";
import { loadContext, readLocale } from "../../../shared/host/context-state.js";
import { ROOM_ID, TEAM_TETRIS_FEATURE_ID, TEAM_TETRIS_PAGE_ID } from "../../../shared/host/feature-meta.js";
import {
  normalizeTeamTetrisMoveArgs,
  readTransportMessageId
} from "../../../shared/host/command-args.js";
import {
  buildTeamTetrisAiTurnMessage,
  buildTeamTetrisAiTurnPacket,
  buildTeamTetrisAsciiBoard,
  buildTeamTetrisProtocolScenario,
  buildTeamTetrisRemoteMoveText,
  parseTeamTetrisStartEventNote,
  resolveTeamTetrisSeatFromProvider,
  teamTetrisCommandMessage
} from "./runtime-protocol.js";
import {
  blockTeamTetrisMatch,
  buildEmptyTeamTetrisRows,
  getTeamTetrisReadiness,
  isTeamTetrisBlocked,
  pushActiveFeatureState,
  pushTeamTetrisState,
  resetTeamTetrisState,
  resolveTeamTetrisStatusText,
  serializeTeamTetrisState
} from "./runtime-sync.js";
import {
  sendTeamTetrisRemoteMove,
  sendTeamTetrisRemoteReset,
  sendTeamTetrisRemoteStart
} from "./runtime-transport.js";
async function dispatchNextTeamTetrisTurn(api, state) {
  if (!state.match || state.match.result !== "pending" || !state.match.currentTurn) {
    pushTeamTetrisState(api, state);
    return { success: true };
  }
  const context = loadContext(api);
  const currentTurn = state.match.currentTurn;
  if (currentTurn.seatId === "user") {
    pushTeamTetrisState(api, state);
    return { success: true };
  }
  if (currentTurn.seatId === "us1") {
    if (context.slots.us1.ready !== true) {
      blockTeamTetrisMatch(api, state, "blockedOpponent", "us1-unavailable");
      return {
        success: false,
        message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed")
      };
    }
    pushTeamTetrisState(api, state);
    return { success: true };
  }
  const slot = context.slots[currentTurn.seatId];
  if (!slot || slot.ready !== true) {
    blockTeamTetrisMatch(api, state, "blockedOpponent", "ai-unavailable");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }
  const protocolResult = await api.sendProtocol({
    room: ROOM_ID,
    scenario: buildTeamTetrisProtocolScenario(state.match),
    targets: [currentTurn.seatId],
    context: {
      featureId: TEAM_TETRIS_FEATURE_ID,
      hiddenPairs: state.match.hiddenPairs,
      revealedPairs: state.match.revealedPairs,
      actingRole: currentTurn.role,
      teamId: currentTurn.teamId
    }
  });
  if (!protocolResult || protocolResult.success !== true) {
    blockTeamTetrisMatch(api, state, "blockedDispatch", "protocol-dispatch-failed");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }
  const messageResult = await api.sendMessage({
    provider: currentTurn.seatId,
    page: TEAM_TETRIS_PAGE_ID,
    text: buildTeamTetrisAiTurnMessage(state.match, currentTurn.seatId)
  });
  if (!messageResult || messageResult.success !== true) {
    blockTeamTetrisMatch(api, state, "blockedDispatch", "turn-dispatch-failed");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }
  pushTeamTetrisState(api, state);
  return messageResult;
}
async function handleTeamTetrisStart(api, payload) {
  const context = loadContext(api);
  const readiness = getTeamTetrisReadiness(context);
  if (readiness.ai1 !== true || readiness.ai2 !== true || readiness.us1 !== true) {
    pushTeamTetrisState(api, loadTeamTetrisState(api));
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "needReadySeats") };
  }
  const args = payload && typeof payload === "object" ? payload.roomArgs || {} : {};
  const state = loadTeamTetrisState(api);
  state.hiddenPairs = args.hiddenPairs !== false;
  state.revealPairsOnFinish = true;
  state.statusKey = "ready";
  state.match = createTeamTetrisMatch({
    seed: (typeof args.seed === "string" && args.seed.trim() !== "" ? args.seed.trim() : "") || [
      Date.now().toString(36),
      context.user.nickname,
      context.slots.ai1.nickname,
      context.slots.ai2.nickname,
      context.slots.us1.nickname
    ].join("|"),
    hiddenPairs: state.hiddenPairs,
    revealPairsOnFinish: state.revealPairsOnFinish
  });
  state.matchId = state.match.matchId;
  state.active = true;
  state.result = state.match.result;
  state.remoteUserId = context.slots.us1.remoteUserId || state.remoteUserId;
  saveTeamTetrisState(api, state);
  pushTeamTetrisState(api, state);
  const remoteResult = await sendTeamTetrisRemoteStart(api, state);
  if (!remoteResult || remoteResult.success !== true) {
    blockTeamTetrisMatch(api, state, "blockedDispatch", "remote-start-dispatch-failed");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }
  await dispatchNextTeamTetrisTurn(api, state);
  return { success: true, message: teamTetrisCommandMessage(readLocale(api), "started") };
}
function handleTeamTetrisReset(api) {
  const state = loadTeamTetrisState(api);
  if (state.matchId) {
    void sendTeamTetrisRemoteReset(api, state);
  }
  pushTeamTetrisState(api, resetTeamTetrisState(api, "idle"));
  return { success: true, message: teamTetrisCommandMessage(readLocale(api), "reset") };
}
async function handleTeamTetrisMove(api, payload) {
  const state = loadTeamTetrisState(api);
  if (!state.match) {
    pushTeamTetrisState(api, state);
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "noActiveGame") };
  }
  if (isTeamTetrisBlocked(state)) {
    pushTeamTetrisState(api, state);
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "blockedMatch") };
  }
  const currentTurn = state.match.currentTurn;
  if (!currentTurn) {
    pushTeamTetrisState(api, state);
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "noActiveGame") };
  }
  const providerSeatId = resolveTeamTetrisSeatFromProvider(
    typeof payload.provider === "string" ? payload.provider : ""
  );
  if (providerSeatId !== currentTurn.seatId) {
    if (providerSeatId === "us1" && state.lastRemoteTransportMessageId && state.lastRemoteTransportMessageId === readTransportMessageId(payload)) {
      return {
        success: false,
        message: teamTetrisCommandMessage(readLocale(api), "duplicateRemoteMove")
      };
    }
    return {
      success: false,
      message: providerSeatId === "user" ? teamTetrisCommandMessage(readLocale(api), "notUserTurn") : teamTetrisCommandMessage(readLocale(api), "providerMismatch")
    };
  }
  const move = normalizeTeamTetrisMoveArgs(payload, TEAM_TETRIS_SCHEMA_VERSION);
  if (providerSeatId === "us1" && state.lastRemoteTurnIndex !== null && move.turnIndex !== null && move.turnIndex <= state.lastRemoteTurnIndex) {
    return {
      success: false,
      message: teamTetrisCommandMessage(readLocale(api), "staleRemoteMove")
    };
  }
  const boardHashBeforeMove = buildTeamTetrisBoardHash(state.match.teams[currentTurn.teamId].board);
  const result = applyTeamTetrisMove(state.match, move);
  if (!("match" in result)) {
    const failureReason = typeof result.reason === "string" && result.reason ? result.reason : "invalid-move";
    if (providerSeatId === "us1" && (failureReason === "turn-token-mismatch" || failureReason === "turn-index-mismatch")) {
      return {
        success: false,
        message: teamTetrisCommandMessage(readLocale(api), "staleRemoteMove")
      };
    }
    if (providerSeatId === "us1" && readTransportMessageId(payload)) {
      state.lastRemoteTransportMessageId = readTransportMessageId(payload);
      saveTeamTetrisState(api, state);
    }
    if (providerSeatId === "ai1" || providerSeatId === "ai2" || providerSeatId === "us1") {
      blockTeamTetrisMatch(api, state, "blockedInvalidMove", failureReason);
      return { success: false, message: teamTetrisCommandMessage(readLocale(api), "invalidMove") };
    }
    pushTeamTetrisState(api, state);
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "invalidMove") };
  }
  state.match = result.match;
  state.matchId = result.match.matchId;
  state.result = result.match.result;
  state.active = result.match.result === "pending";
  state.blockedReason = "";
  if (providerSeatId === "us1") {
    state.lastRemoteTransportMessageId = readTransportMessageId(payload);
    state.lastRemoteTurnIndex = move.turnIndex;
  }
  saveTeamTetrisState(api, state);
  pushTeamTetrisState(api, state);
  if (providerSeatId !== "us1") {
    const remoteResult = await sendTeamTetrisRemoteMove(api, state, move, boardHashBeforeMove);
    if (!remoteResult || remoteResult.success !== true) {
      blockTeamTetrisMatch(api, state, "blockedDispatch", "remote-sync-failed");
      return {
        success: false,
        message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed")
      };
    }
  }
  await dispatchNextTeamTetrisTurn(api, state);
  return { success: true, message: teamTetrisCommandMessage(readLocale(api), "moveApplied") };
}
export {
  blockTeamTetrisMatch,
  buildEmptyTeamTetrisRows,
  buildTeamTetrisAiTurnMessage,
  buildTeamTetrisAiTurnPacket,
  buildTeamTetrisAsciiBoard,
  buildTeamTetrisProtocolScenario,
  buildTeamTetrisRemoteMoveText,
  dispatchNextTeamTetrisTurn,
  getTeamTetrisReadiness,
  handleTeamTetrisMove,
  handleTeamTetrisReset,
  handleTeamTetrisStart,
  isTeamTetrisBlocked,
  parseTeamTetrisStartEventNote,
  pushActiveFeatureState,
  pushTeamTetrisState,
  resetTeamTetrisState,
  resolveTeamTetrisSeatFromProvider,
  resolveTeamTetrisStatusText,
  sendTeamTetrisRemoteMove,
  sendTeamTetrisRemoteReset,
  sendTeamTetrisRemoteStart,
  serializeTeamTetrisState,
  teamTetrisCommandMessage
};
