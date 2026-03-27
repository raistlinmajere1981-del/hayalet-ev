import {
  applyTeamTetrisMove,
  buildTeamTetrisBoardHash,
  buildTeamTetrisSeatView,
  createTeamTetrisMatch,
  getTeamTetrisTeamIds,
  TEAM_TETRIS_BOARD_HEIGHT,
  TEAM_TETRIS_BOARD_WIDTH,
  TEAM_TETRIS_SCHEMA_VERSION,
  TEAM_TETRIS_TURN_LOOP,
} from "./engine.js";
import {
  TEAM_TETRIS_COMMAND_COPY,
  TEAM_TETRIS_STATUS_COPY,
  createInitialTeamTetrisState,
  loadTeamTetrisState,
  saveTeamTetrisState,
} from "./state.js";
import {
  getActiveFeatureId,
  loadContext,
  readLocale,
} from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_FEATURE_ID,
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID,
  TEAM_TETRIS_PAGE_ID,
} from "../../../shared/host/feature-meta.js";
import { fillTemplate, translate } from "../../../shared/host/text.js";
import {
  normalizeTeamTetrisMoveArgs,
  readTransportMessageId,
} from "../../../shared/host/command-args.js";
import { loadState, pushRoomState } from "../../xox/host/state.js";
import { loadFateKnotsState, pushFateKnotsState } from "../../fate-knots/host/state.js";
import { loadFateKnotsContentRegistry } from "../../fate-knots/host/content-loader.js";

function teamTetrisCommandMessage(locale, key, params) {
  return fillTemplate(translate(locale, TEAM_TETRIS_COMMAND_COPY, key), params || {});
}

export function isTeamTetrisBlocked(state) {
  return state.result === "blocked" || state.blockedReason !== "";
}

export function blockTeamTetrisMatch(api, state, statusKey, blockedReason) {
  state.active = false;
  state.result = "blocked";
  state.statusKey = statusKey;
  state.blockedReason = blockedReason;
  return pushTeamTetrisState(api, state);
}

export function resolveTeamTetrisSeatFromProvider(provider) {
  if (provider === "room-ui") {
    return "user";
  }
  if (provider === "ai1" || provider === "ai2" || provider === "us1") {
    return provider;
  }
  return null;
}

export function buildTeamTetrisProtocolScenario(match) {
  const currentTurn = match && match.currentTurn ? match.currentTurn : null;
  return currentTurn && currentTurn.role === "followup"
    ? "team-tetris-ai-followup"
    : "team-tetris-ai-opening";
}

export function buildTeamTetrisAiTurnPacket(match, seatId) {
  const view = buildTeamTetrisSeatView(match, seatId);
  if (!view || !view.pendingTurn) {
    return null;
  }
  return {
    schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
    matchId: view.matchId,
    turnIndex: view.pendingTurn.turnIndex,
    turnToken: view.pendingTurn.turnToken,
    teamId: view.seat.teamId,
    actingRole: view.pendingTurn.actingRole,
    hiddenPairs: view.hiddenPairs,
    revealedPairs: view.revealedPairs,
    teamBoardPrivateRows: view.ownTeam.boardRows.slice(),
    teamBoardBeforePartnerPieceRows: view.ownTeam.boardBeforePartnerPieceRows.slice(),
    partnerLastPiece: view.ownTeam.partnerLastPiece,
    opponentBoardPublicRows: view.opponentTeam.boardRows.slice(),
    currentPiece: view.pendingTurn.pieceId,
    legalRotations: view.pendingTurn.legalRotations.slice(),
  };
}

export function buildTeamTetrisAsciiBoard(rows) {
  return Array.isArray(rows) ? rows.join("\n") : "";
}

export function buildTeamTetrisAiTurnMessage(match, seatId) {
  const packet = buildTeamTetrisAiTurnPacket(match, seatId);
  if (!packet) {
    return "";
  }
  return [
    "Team Tetris turn update from the Game Room.",
    "Game: Team Tetris.",
    "Your reply is parsed from only the latest assistant message.",
    "Use exactly one command line in this format: ++cmd:GameRoomTeamTetrisAiMove({...})",
    "Do not add markdown, prose, code fences, or a second command.",
    "",
    "Turn packet JSON:",
    JSON.stringify(packet, null, 2),
    "",
    "ASCII appendix:",
    "Own team board:",
    buildTeamTetrisAsciiBoard(packet.teamBoardPrivateRows),
    "",
    "Own team board before partner piece:",
    buildTeamTetrisAsciiBoard(packet.teamBoardBeforePartnerPieceRows),
    "",
    "Opponent public board:",
    buildTeamTetrisAsciiBoard(packet.opponentBoardPublicRows),
  ].join("\n");
}

export function buildTeamTetrisRemoteMoveText(movePayload) {
  return `++cmd:GameRoomTeamTetrisRemoteMove(${JSON.stringify(movePayload)})`;
}

export function parseTeamTetrisStartEventNote(note) {
  if (typeof note !== "string" || note.trim() === "") {
    return null;
  }
  try {
    const parsed = JSON.parse(note);
    return parsed && typeof parsed === "object" && Array.isArray(parsed) === false ? parsed : null;
  } catch {
    return null;
  }
}

export async function sendTeamTetrisRemoteStart(api, state) {
  const context = loadContext(api);
  const remoteUserId = context.slots.us1.remoteUserId || state.remoteUserId;
  if (!state.match || !remoteUserId) {
    return { success: false };
  }
  const selected = await api.selectUs1RemoteUser(remoteUserId);
  if (selected !== true) {
    return { success: false };
  }

  const sendResult = await api.sendUs1Message({
    localSessionId: state.localSessionId,
    text: "Team Tetris match started.",
    roomEvent: {
      roomId: ROOM_ID,
      featureId: TEAM_TETRIS_FEATURE_ID,
      inviteId: state.match.matchId,
      matchId: state.match.matchId,
      eventType: "start",
      note: JSON.stringify({
        seed: state.match.seed,
        hiddenPairs: state.match.hiddenPairs,
        revealPairsOnFinish: state.match.revealPairsOnFinish,
      }),
    },
  });

  if (sendResult && sendResult.success === true) {
    state.localSessionId =
      typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== ""
        ? sendResult.localSessionId
        : state.localSessionId;
    state.remoteUserId =
      typeof sendResult.remoteUserId === "string" && sendResult.remoteUserId !== ""
        ? sendResult.remoteUserId
        : remoteUserId;
    saveTeamTetrisState(api, state);
  }
  return sendResult || { success: false };
}

export async function sendTeamTetrisRemoteReset(api, state) {
  if (!state.matchId || !state.remoteUserId) {
    return { success: true };
  }
  const selected = await api.selectUs1RemoteUser(state.remoteUserId);
  if (selected !== true) {
    return { success: false };
  }
  return await api.sendUs1Message({
    localSessionId: state.localSessionId,
    text: "Team Tetris match reset.",
    roomEvent: {
      roomId: ROOM_ID,
      featureId: TEAM_TETRIS_FEATURE_ID,
      inviteId: state.matchId,
      matchId: state.matchId,
      eventType: "reset",
    },
  });
}

export async function sendTeamTetrisRemoteMove(api, state, movePayload, boardHashBeforeMove) {
  if (!state.remoteUserId) {
    return { success: true };
  }
  const selected = await api.selectUs1RemoteUser(state.remoteUserId);
  if (selected !== true) {
    return { success: false };
  }
  const rawArgs = JSON.stringify(movePayload);
  const sendResult = await api.sendUs1Message({
    localSessionId: state.localSessionId,
    text: buildTeamTetrisRemoteMoveText(movePayload),
    roomCommand: {
      roomId: ROOM_ID,
      featureId: TEAM_TETRIS_FEATURE_ID,
      commandName: "GameRoomTeamTetrisRemoteMove",
      matchId: movePayload.matchId,
      turnIndex: movePayload.turnIndex,
      turnToken: movePayload.turnToken,
      boardHashBeforeMove: boardHashBeforeMove,
      rawArgs: rawArgs,
    },
  });
  if (sendResult && sendResult.success === true) {
    state.localSessionId =
      typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== ""
        ? sendResult.localSessionId
        : state.localSessionId;
    saveTeamTetrisState(api, state);
  }
  return sendResult || { success: false };
}

export function getTeamTetrisReadiness(context) {
  const slots = context && context.slots ? context.slots : {};
  return {
    ai1: !!(slots.ai1 && slots.ai1.ready === true),
    ai2: !!(slots.ai2 && slots.ai2.ready === true),
    us1: !!(slots.us1 && slots.us1.ready === true),
  };
}

export function buildEmptyTeamTetrisRows() {
  return Array.from({ length: TEAM_TETRIS_BOARD_HEIGHT }, function () {
    return ".".repeat(TEAM_TETRIS_BOARD_WIDTH);
  });
}

export function resolveTeamTetrisStatusText(state, context) {
  if (state.blockedReason) {
    return state.blockedReason;
  }
  if (state.match && state.match.result === "pending" && state.match.currentTurn) {
    return "";
  }
  const readiness = getTeamTetrisReadiness(context);
  const canStart = readiness.ai1 && readiness.ai2 && readiness.us1;
  const statusKey = canStart && state.statusKey === "idle" ? "ready" : state.statusKey;
  return translate(state.locale, TEAM_TETRIS_STATUS_COPY, statusKey);
}

export function serializeTeamTetrisState(api, state, context) {
  const readiness = getTeamTetrisReadiness(context);
  const canStart = readiness.ai1 && readiness.ai2 && readiness.us1;
  const savedState = saveTeamTetrisState(api, state);
  const userView = savedState.match ? buildTeamTetrisSeatView(savedState.match, "user") : null;
  const boardSnapshots =
    userView !== null
      ? [
          {
            teamId: userView.ownTeam.teamId,
            visibility: "private",
            rows: userView.ownTeam.boardRows.slice(),
            boardBeforePartnerPieceRows: userView.ownTeam.boardBeforePartnerPieceRows.slice(),
            partnerLastPiece: userView.ownTeam.partnerLastPiece,
          },
          {
            teamId: userView.opponentTeam.teamId,
            visibility: "public",
            rows: userView.opponentTeam.boardRows.slice(),
          },
        ]
      : [
          {
            teamId: "team-a",
            visibility: "private",
            rows: buildEmptyTeamTetrisRows(),
            boardBeforePartnerPieceRows: buildEmptyTeamTetrisRows(),
            partnerLastPiece: null,
          },
          {
            teamId: "team-b",
            visibility: "public",
            rows: buildEmptyTeamTetrisRows(),
          },
        ];
  return {
    roomId: ROOM_ID,
    featureId: TEAM_TETRIS_FEATURE_ID,
    schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
    active:
      savedState.result === "blocked"
        ? false
        : savedState.match
          ? savedState.match.result === "pending"
          : savedState.active,
    result:
      savedState.result === "blocked"
        ? "blocked"
        : savedState.match
          ? savedState.match.result
          : savedState.result,
    hiddenPairs: savedState.hiddenPairs,
    revealPairsOnFinish: savedState.revealPairsOnFinish,
    blockedReason: savedState.blockedReason,
    matchId: savedState.match ? savedState.match.matchId : savedState.matchId,
    localSessionId: savedState.localSessionId,
    remoteUserId: savedState.remoteUserId,
    lastRemoteTransportMessageId: savedState.lastRemoteTransportMessageId,
    lastRemoteTurnIndex: savedState.lastRemoteTurnIndex,
    canStart: canStart,
    requiredSlots: readiness,
    board: {
      width: TEAM_TETRIS_BOARD_WIDTH,
      height: TEAM_TETRIS_BOARD_HEIGHT,
      seedLabel: "contract-frozen",
    },
    boards: boardSnapshots,
    turnLoop: TEAM_TETRIS_TURN_LOOP.slice(),
    currentTurn:
      savedState.match && savedState.match.currentTurn ? { ...savedState.match.currentTurn } : null,
    teams:
      savedState.match &&
      savedState.revealPairsOnFinish === true &&
      savedState.match.revealedPairs === true
        ? getTeamTetrisTeamIds().map(function (teamId) {
            return {
              teamId: teamId,
              seatIds: savedState.match.teams[teamId].seatIds.slice(),
            };
          })
        : null,
    userView: userView,
    status: resolveTeamTetrisStatusText(savedState, context),
  };
}

export function pushTeamTetrisState(api, state) {
  const context = loadContext(api);
  api.notifyRoom("team-tetris-state", {
    state: serializeTeamTetrisState(api, state, context),
  });
  return loadTeamTetrisState(api);
}

export function resetTeamTetrisState(api, statusKey) {
  const nextState = createInitialTeamTetrisState(readLocale(api));
  if (
    typeof statusKey === "string" &&
    Object.prototype.hasOwnProperty.call(TEAM_TETRIS_STATUS_COPY, statusKey)
  ) {
    nextState.statusKey = statusKey;
  }
  return saveTeamTetrisState(api, nextState);
}

export function pushActiveFeatureState(api) {
  const context = loadContext(api);
  if (getActiveFeatureId(context) === TEAM_TETRIS_FEATURE_ID) {
    return pushTeamTetrisState(api, loadTeamTetrisState(api));
  }
  if (getActiveFeatureId(context) === FATE_KNOTS_FEATURE_ID) {
    return pushFateKnotsState(api, loadFateKnotsState(api), loadFateKnotsContentRegistry());
  }
  return pushRoomState(api, loadState(api));
}

export async function dispatchNextTeamTetrisTurn(api, state) {
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
        message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed"),
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
      teamId: currentTurn.teamId,
    },
  });
  if (!protocolResult || protocolResult.success !== true) {
    blockTeamTetrisMatch(api, state, "blockedDispatch", "protocol-dispatch-failed");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }

  const messageResult = await api.sendMessage({
    provider: currentTurn.seatId,
    page: TEAM_TETRIS_PAGE_ID,
    text: buildTeamTetrisAiTurnMessage(state.match, currentTurn.seatId),
  });
  if (!messageResult || messageResult.success !== true) {
    blockTeamTetrisMatch(api, state, "blockedDispatch", "turn-dispatch-failed");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }

  pushTeamTetrisState(api, state);
  return messageResult;
}

export async function handleTeamTetrisStart(api, payload) {
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
    seed:
      (typeof args.seed === "string" && args.seed.trim() !== "" ? args.seed.trim() : "") ||
      [
        Date.now().toString(36),
        context.user.nickname,
        context.slots.ai1.nickname,
        context.slots.ai2.nickname,
        context.slots.us1.nickname,
      ].join("|"),
    hiddenPairs: state.hiddenPairs,
    revealPairsOnFinish: state.revealPairsOnFinish,
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

export function handleTeamTetrisReset(api) {
  const state = loadTeamTetrisState(api);
  if (state.matchId) {
    void sendTeamTetrisRemoteReset(api, state);
  }
  pushTeamTetrisState(api, resetTeamTetrisState(api, "idle"));
  return { success: true, message: teamTetrisCommandMessage(readLocale(api), "reset") };
}

export async function handleTeamTetrisMove(api, payload) {
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
    if (
      providerSeatId === "us1" &&
      state.lastRemoteTransportMessageId &&
      state.lastRemoteTransportMessageId === readTransportMessageId(payload)
    ) {
      return {
        success: false,
        message: teamTetrisCommandMessage(readLocale(api), "duplicateRemoteMove"),
      };
    }
    return {
      success: false,
      message:
        providerSeatId === "user"
          ? teamTetrisCommandMessage(readLocale(api), "notUserTurn")
          : teamTetrisCommandMessage(readLocale(api), "providerMismatch"),
    };
  }

  const move = normalizeTeamTetrisMoveArgs(payload, TEAM_TETRIS_SCHEMA_VERSION);
  if (
    providerSeatId === "us1" &&
    state.lastRemoteTurnIndex !== null &&
    move.turnIndex !== null &&
    move.turnIndex <= state.lastRemoteTurnIndex
  ) {
    return {
      success: false,
      message: teamTetrisCommandMessage(readLocale(api), "staleRemoteMove"),
    };
  }
  const boardHashBeforeMove = buildTeamTetrisBoardHash(state.match.teams[currentTurn.teamId].board);
  const result = applyTeamTetrisMove(state.match, move);
  if (result.success !== true) {
    if (
      providerSeatId === "us1" &&
      (result.reason === "turn-token-mismatch" || result.reason === "turn-index-mismatch")
    ) {
      return {
        success: false,
        message: teamTetrisCommandMessage(readLocale(api), "staleRemoteMove"),
      };
    }
    if (providerSeatId === "us1" && readTransportMessageId(payload)) {
      state.lastRemoteTransportMessageId = readTransportMessageId(payload);
      saveTeamTetrisState(api, state);
    }
    if (providerSeatId === "ai1" || providerSeatId === "ai2" || providerSeatId === "us1") {
      blockTeamTetrisMatch(api, state, "blockedInvalidMove", result.reason || "invalid-move");
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
        message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed"),
      };
    }
  }

  await dispatchNextTeamTetrisTurn(api, state);
  return { success: true, message: teamTetrisCommandMessage(readLocale(api), "moveApplied") };
}
