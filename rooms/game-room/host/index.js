import {
  TEAM_TETRIS_BOARD_HEIGHT,
  TEAM_TETRIS_BOARD_WIDTH,
  TEAM_TETRIS_MOVE_SCHEMA,
  TEAM_TETRIS_PIECE_IDS,
  TEAM_TETRIS_SCHEMA_VERSION,
  TEAM_TETRIS_SEAT_IDS,
  TEAM_TETRIS_TURN_LOOP,
  applyTeamTetrisMove,
  buildTeamTetrisBoardHash,
  buildTeamTetrisSeatView,
  buildTeamTetrisTurnToken,
  cloneTeamTetrisMatch,
  createTeamTetrisMatch,
  getTeamTetrisLegalRotations,
  getTeamTetrisSpawnPosition,
  getTeamTetrisTeamIds,
  replayTeamTetrisPath,
  teamTetrisBoardToRows,
  teamTetrisEngine,
  validateTeamTetrisMove,
} from "../main-functions/team-tetris/host/engine.js";
import {
  TEAM_TETRIS_COMMAND_COPY,
  TEAM_TETRIS_STATUS_COPY,
  createInitialTeamTetrisState,
  loadTeamTetrisState,
  saveTeamTetrisState,
} from "../main-functions/team-tetris/host/state.js";
import {
  COMMAND_COPY,
  DEFAULT_STARTER,
  DEFAULT_TARGET,
  STATUS_COPY,
  US1_SYNC_INTERVAL_MS,
  buildBoardAscii,
  buildBoardStateHash,
  createInitialState,
  createPendingInvite,
  getAvailableCells,
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
  saveState,
  clearPendingInvite,
  sanitizeStarter,
  sanitizeTarget,
} from "../main-functions/xox/host/state.js";
import {
  createSlotState,
  getActiveFeatureId,
  loadContext,
  readLocale,
  saveContext,
} from "../shared/host/context-state.js";
import {
  FEATURE_ID,
  PAGE_ID,
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID,
  TEAM_TETRIS_PAGE_ID,
} from "../shared/host/feature-meta.js";
import { fillTemplate, normalizeText, translate } from "../shared/host/text.js";

function readArgs(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  if (
    payload.roomArgs &&
    typeof payload.roomArgs === "object" &&
    Array.isArray(payload.roomArgs) === false
  ) {
    return payload.roomArgs;
  }
  return {};
}

function readCell(payload) {
  if (payload && typeof payload.roomArgs === "number" && Number.isInteger(payload.roomArgs)) {
    return payload.roomArgs;
  }

  const args = readArgs(payload);
  if (typeof args.cell === "number" && Number.isInteger(args.cell)) {
    return args.cell;
  }
  if (typeof args.cell === "string" && args.cell.trim() !== "") {
    const parsed = Number.parseInt(args.cell, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function readInviteId(payload) {
  const args = readArgs(payload);
  if (typeof args.matchId === "string" && args.matchId.trim() !== "") {
    return args.matchId.trim();
  }
  if (typeof args.inviteId === "string" && args.inviteId.trim() !== "") {
    return args.inviteId.trim();
  }
  return null;
}

function readTurnIndex(payload) {
  const args = readArgs(payload);
  if (
    typeof args.turnIndex === "number" &&
    Number.isInteger(args.turnIndex) &&
    args.turnIndex >= 0
  ) {
    return args.turnIndex;
  }
  if (typeof args.turnIndex === "string" && args.turnIndex.trim() !== "") {
    const parsed = Number.parseInt(args.turnIndex, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function readBoardHashBeforeMove(payload) {
  const args = readArgs(payload);
  if (typeof args.boardHashBeforeMove === "string" && args.boardHashBeforeMove.trim() !== "") {
    return args.boardHashBeforeMove.trim();
  }
  return null;
}

function readTransportMessageId(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray(payload) === false &&
    typeof payload.transportMessageId === "string" &&
    payload.transportMessageId.trim() !== ""
  ) {
    return payload.transportMessageId.trim();
  }
  return null;
}

function readRemoteUserId(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray(payload) === false &&
    typeof payload.remoteUserId === "string" &&
    payload.remoteUserId.trim() !== ""
  ) {
    return payload.remoteUserId.trim();
  }
  const args = readArgs(payload);
  if (typeof args.remoteUserId === "string" && args.remoteUserId.trim() !== "") {
    return args.remoteUserId.trim();
  }
  return null;
}

function readInviteNote(payload) {
  const args = readArgs(payload);
  return normalizeText(args.inviteMessage);
}

function resolveStateMatchId(state) {
  return state.matchId || state.inviteId || null;
}

function commandMessage(locale, key, params) {
  return fillTemplate(translate(locale, COMMAND_COPY, key), params || {});
}

function teamTetrisCommandMessage(locale, key, params) {
  return fillTemplate(translate(locale, TEAM_TETRIS_COMMAND_COPY, key), params || {});
}

function parseIntegerValue(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTeamTetrisMoveArgs(payload) {
  const args = readArgs(payload);
  return {
    schemaVersion: parseIntegerValue(args.schemaVersion) || TEAM_TETRIS_SCHEMA_VERSION,
    matchId: normalizeText(args.matchId),
    turnIndex: parseIntegerValue(args.turnIndex),
    turnToken: normalizeText(args.turnToken),
    pieceId: normalizeText(args.pieceId),
    rotation: parseIntegerValue(args.rotation) || 0,
    rowShifts: Array.isArray(args.rowShifts)
      ? args.rowShifts
          .map(function (value) {
            return parseIntegerValue(value);
          })
          .filter(function (value) {
            return value === -1 || value === 0 || value === 1;
          })
      : [],
  };
}

function isTeamTetrisBlocked(state) {
  return state.result === "blocked" || state.blockedReason !== "";
}

function blockTeamTetrisMatch(api, state, statusKey, blockedReason) {
  state.active = false;
  state.result = "blocked";
  state.statusKey = statusKey;
  state.blockedReason = blockedReason;
  return pushTeamTetrisState(api, state);
}

function resolveTeamTetrisSeatFromProvider(provider) {
  if (provider === "room-ui") {
    return "user";
  }
  if (provider === "ai1" || provider === "ai2" || provider === "us1") {
    return provider;
  }
  return null;
}

function buildTeamTetrisProtocolScenario(match) {
  const currentTurn = match && match.currentTurn ? match.currentTurn : null;
  return currentTurn && currentTurn.role === "followup"
    ? "team-tetris-ai-followup"
    : "team-tetris-ai-opening";
}

function buildTeamTetrisAiTurnPacket(match, seatId) {
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

function buildTeamTetrisAsciiBoard(rows) {
  return Array.isArray(rows) ? rows.join("\n") : "";
}

function buildTeamTetrisAiTurnMessage(match, seatId) {
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

function buildTeamTetrisRemoteMoveText(movePayload) {
  return `++cmd:GameRoomTeamTetrisRemoteMove(${JSON.stringify(movePayload)})`;
}

function parseTeamTetrisStartEventNote(note) {
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

async function sendTeamTetrisRemoteStart(api, state) {
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

async function sendTeamTetrisRemoteReset(api, state) {
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

async function sendTeamTetrisRemoteMove(api, state, movePayload, boardHashBeforeMove) {
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

function buildAiTurnMessage(state, context) {
  const opponent = getOpponentInfo(context, state);
  const availableCells = getAvailableCells(state.board).join(", ");
  const boardAscii = buildBoardAscii(state.board);
  const userName = context.user.nickname;
  const starterLabel = state.starter === "ai" ? opponent.nickname : userName;

  return [
    "XOX turn update from the Game Room.",
    "Game: XOX.",
    "Your reply is parsed from only the latest assistant message.",
    'Use exactly one command line in this format: ++cmd:GameRoomXoxAiMove({"cell":4})',
    "Do not add markdown, prose, code fences, or a second command.",
    "",
    "Match setup:",
    "- Opponent: " + userName,
    "- Starter: " + starterLabel,
    "- You are playing as " + state.aiSymbol + ".",
    "- The user is playing as " + state.userSymbol + ".",
    "",
    "Board:",
    boardAscii,
    "",
    "Open cells: " + (availableCells === "" ? "none" : availableCells),
    "Current turn: " + opponent.nickname + " (" + state.aiSymbol + ")",
    "If the board is finished, do not send a command.",
  ].join("\n");
}

function buildInviteId() {
  return `xox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildUs1InviteText(state, context, note) {
  const opponent = getOpponentInfo(context, state);
  const starterLabel = state.starter === "ai" ? opponent.nickname : context.user.nickname;
  const parts = [];

  if (note !== "") {
    parts.push(note, "");
  }

  parts.push(
    "XOX invite from the Game Room.",
    "Opponent: " + context.user.nickname,
    "Starter: " + starterLabel,
    "Accept or reject the invite from the Game Room UI."
  );

  return parts.join("\n");
}

function buildUs1InviteResponseText(type, inviteEntry) {
  const opener = type === "accept" ? "XOX invite accepted." : "XOX invite rejected.";
  return [opener, "Match ID: " + (inviteEntry.matchId || inviteEntry.inviteId)].join("\n");
}

function buildUs1ResetText(matchId) {
  return ["XOX match reset.", "Match ID: " + matchId].join("\n");
}

function buildUs1MoveText(matchId, turnIndex, boardHashBeforeMove, cell) {
  return `++cmd:GameRoomXoxRemoteMove(${JSON.stringify({
    matchId: matchId,
    inviteId: matchId,
    turnIndex: turnIndex,
    boardHashBeforeMove: boardHashBeforeMove,
    cell: cell,
  })})`;
}

function isBlocked(state) {
  return state.result === "blocked" || state.blockedReason !== "";
}

function getTeamTetrisReadiness(context) {
  const slots = context && context.slots ? context.slots : {};
  return {
    ai1: !!(slots.ai1 && slots.ai1.ready === true),
    ai2: !!(slots.ai2 && slots.ai2.ready === true),
    us1: !!(slots.us1 && slots.us1.ready === true),
  };
}

function buildEmptyTeamTetrisRows() {
  return Array.from({ length: TEAM_TETRIS_BOARD_HEIGHT }, function () {
    return ".".repeat(TEAM_TETRIS_BOARD_WIDTH);
  });
}

function resolveTeamTetrisStatusText(state, context) {
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

function serializeTeamTetrisState(api, state, context) {
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

function pushTeamTetrisState(api, state) {
  const context = loadContext(api);
  api.notifyRoom("team-tetris-state", {
    state: serializeTeamTetrisState(api, state, context),
  });
  return loadTeamTetrisState(api);
}

function resetTeamTetrisState(api, statusKey) {
  const nextState = createInitialTeamTetrisState(readLocale(api));
  if (
    typeof statusKey === "string" &&
    Object.prototype.hasOwnProperty.call(TEAM_TETRIS_STATUS_COPY, statusKey)
  ) {
    nextState.statusKey = statusKey;
  }
  return saveTeamTetrisState(api, nextState);
}

function pushActiveFeatureState(api) {
  const context = loadContext(api);
  if (getActiveFeatureId(context) === TEAM_TETRIS_FEATURE_ID) {
    return pushTeamTetrisState(api, loadTeamTetrisState(api));
  }
  return pushRoomState(api, loadState(api));
}

function blockMatch(api, state, statusKey, blockedReason) {
  state.active = true;
  state.awaitingMoveFrom = null;
  state.result = "blocked";
  state.winner = "";
  state.statusKey = statusKey;
  state.blockedReason = blockedReason;
  return pushRoomState(api, state);
}

async function sendAiTurnUpdate(api, state, includeProtocol) {
  const context = loadContext(api);
  const opponent = getOpponentInfo(context, state);

  if (opponent.ready !== true) {
    blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
    return { success: false, message: commandMessage(state.locale, "needReadyOpponent") };
  }

  if (includeProtocol === true && state.protocolDelivered !== true) {
    const protocolResult = await api.sendProtocol({
      room: ROOM_ID,
      scenario: state.starter === "ai" ? "xox-ai-start" : "xox-user-start",
      targets: [state.target],
      preface: state.protocolPreface || null,
      context: {
        featureId: FEATURE_ID,
        starter: state.starter,
        aiSymbol: state.aiSymbol,
        userSymbol: state.userSymbol,
      },
    });

    if (!protocolResult || protocolResult.success !== true) {
      blockMatch(api, state, "blockedDispatch", "protocol-dispatch-failed");
      return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
    }

    state.protocolDelivered = true;
    saveState(api, state);
  }

  const messageResult = await api.sendMessage({
    provider: state.target,
    page: PAGE_ID,
    text: buildAiTurnMessage(state, context),
  });

  if (messageResult && messageResult.success === true) {
    pushRoomState(api, state);
    return messageResult;
  }

  blockMatch(api, state, "blockedDispatch", "turn-dispatch-failed");
  return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
}

async function handleTeamTetrisStart(api, payload) {
  const context = loadContext(api);
  const readiness = getTeamTetrisReadiness(context);
  if (readiness.ai1 !== true || readiness.ai2 !== true || readiness.us1 !== true) {
    pushTeamTetrisState(api, loadTeamTetrisState(api));
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "needReadySeats") };
  }

  const args = readArgs(payload);
  const state = loadTeamTetrisState(api);
  state.hiddenPairs = args.hiddenPairs !== false;
  state.revealPairsOnFinish = true;
  state.statusKey = "ready";
  state.match = createTeamTetrisMatch({
    seed:
      normalizeText(args.seed) ||
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

function handleTeamTetrisReset(api) {
  const state = loadTeamTetrisState(api);
  if (state.matchId) {
    void sendTeamTetrisRemoteReset(api, state);
  }
  pushTeamTetrisState(api, resetTeamTetrisState(api, "idle"));
  return { success: true, message: teamTetrisCommandMessage(readLocale(api), "reset") };
}

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

  const providerSeatId = resolveTeamTetrisSeatFromProvider(normalizeText(payload.provider));
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

  const move = normalizeTeamTetrisMoveArgs(payload);
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

async function sendUs1Invite(api, state, inviteNote) {
  const context = loadContext(api);
  const matchId = buildInviteId();
  const opponent = getOpponentInfo(context, state);
  const sendResult = await api.sendUs1Message({
    text: buildUs1InviteText(state, context, inviteNote),
    roomEvent: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: matchId,
      matchId: matchId,
      eventType: "invite",
      starter: state.starter === "ai" ? "opponent" : "user",
      note: inviteNote !== "" ? inviteNote : null,
    },
  });

  if (!sendResult || sendResult.success !== true) {
    return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
  }

  state.statusKey = "invitePending";
  state.matchId = matchId;
  state.inviteId = matchId;
  state.turnIndex = 0;
  state.lastRemoteTransportMessageId = null;
  state.lastRemoteTurnIndex = null;
  state.localSessionId =
    typeof sendResult.localSessionId === "string" ? sendResult.localSessionId : null;
  state.remoteUserId = opponent.remoteUserId || null;
  state.opponentNickname = opponent.nickname;
  savePendingInvite(
    api,
    createPendingInvite("outgoing", {
      inviteId: matchId,
      matchId: matchId,
      remoteUserId: state.remoteUserId || opponent.remoteUserId || "us1",
      nickname: opponent.nickname,
      note: inviteNote,
      starter: state.starter === "ai" ? "opponent" : "user",
      localSessionId: state.localSessionId,
      conversationId:
        typeof sendResult.conversationId === "string" ? sendResult.conversationId : "",
    })
  );
  pushRoomState(api, state);
  await syncUs1Mailbox(api, "invite-sent");
  return { success: true, message: commandMessage(state.locale, "inviteSent") };
}

async function sendUs1Move(api, state, moveContext) {
  const context = loadContext(api);
  const opponent = getOpponentInfo(context, state);

  if (
    opponent.ready !== true ||
    state.remoteUserId === null ||
    (opponent.remoteUserId !== null && opponent.remoteUserId !== state.remoteUserId)
  ) {
    blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
    return { success: false, message: commandMessage(state.locale, "needReadyOpponent") };
  }

  const matchId = resolveStateMatchId(state) || "";
  const rawArgs = JSON.stringify({
    matchId: matchId,
    inviteId: matchId,
    turnIndex: moveContext.turnIndex,
    boardHashBeforeMove: moveContext.boardHashBeforeMove,
    cell: moveContext.cell,
  });
  const sendResult = await api.sendUs1Message({
    localSessionId: state.localSessionId,
    text: buildUs1MoveText(
      matchId,
      moveContext.turnIndex,
      moveContext.boardHashBeforeMove,
      moveContext.cell
    ),
    roomCommand: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      commandName: "GameRoomXoxRemoteMove",
      matchId: matchId,
      turnIndex: moveContext.turnIndex,
      boardHashBeforeMove: moveContext.boardHashBeforeMove,
      rawArgs: rawArgs,
    },
  });

  if (!sendResult || sendResult.success !== true) {
    blockMatch(api, state, "blockedDispatch", "turn-dispatch-failed");
    return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
  }

  if (typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== "") {
    state.localSessionId = sendResult.localSessionId;
  }

  pushRoomState(api, state);
  return sendResult;
}

async function sendUs1Reset(api, resetContext) {
  if (resetContext === null) {
    return { success: true };
  }

  return await api.sendUs1Message({
    localSessionId: resetContext.localSessionId || null,
    text: buildUs1ResetText(resetContext.matchId),
    roomEvent: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: resetContext.matchId,
      matchId: resetContext.matchId,
      eventType: "reset",
    },
  });
}

function matchesInviteEntry(entry, inviteId, remoteUserId) {
  if (!entry) {
    return false;
  }
  const matchesInviteId = entry.inviteId === inviteId || entry.matchId === inviteId;
  if (matchesInviteId !== true) {
    return false;
  }
  if (remoteUserId === null || remoteUserId === "") {
    return true;
  }
  return entry.remoteUserId === remoteUserId;
}

function findInviteById(api, inviteId, remoteUserId) {
  return (
    loadInviteInbox(api).find(function (entry) {
      return matchesInviteEntry(entry, inviteId, remoteUserId || null);
    }) || null
  );
}

function syncInviteInboxFromSnapshot(api, roomInviteInbox) {
  const nextInviteInbox = normalizeInviteInbox(roomInviteInbox).filter(function (entry) {
    return (
      entry.roomId === ROOM_ID &&
      entry.featureId === FEATURE_ID &&
      entry.inviteId !== "" &&
      entry.remoteUserId !== ""
    );
  });
  saveInviteInbox(api, nextInviteInbox);
}

function removeInviteFromInbox(api, inviteId, remoteUserId) {
  const nextInviteInbox = loadInviteInbox(api).filter(function (entry) {
    return matchesInviteEntry(entry, inviteId, remoteUserId || null) !== true;
  });
  saveInviteInbox(api, nextInviteInbox);
}

function applyInviteAcceptedState(api, inviteEntry, starter) {
  const state = createInitialState(readLocale(api), "us1", starter);
  state.active = true;
  state.result = "pending";
  state.awaitingMoveFrom = starter === "ai" ? "ai" : "user";
  state.statusKey = starter === "ai" ? "aiTurn" : "userTurn";
  state.matchId = inviteEntry.matchId || inviteEntry.inviteId;
  state.inviteId = inviteEntry.inviteId || inviteEntry.matchId || null;
  state.turnIndex = 0;
  state.localSessionId = inviteEntry.localSessionId || null;
  state.remoteUserId = inviteEntry.remoteUserId;
  state.opponentNickname = inviteEntry.nickname;
  state.protocolDelivered = true;
  clearPendingInvite(api);
  removeInviteFromInbox(api, inviteEntry.matchId || inviteEntry.inviteId, inviteEntry.remoteUserId);
  return pushRoomState(api, state);
}

function readIncomingInviteStarter(inviteEntry) {
  return inviteEntry.starter === "opponent" ? "user" : "ai";
}

function readOutgoingInviteStarter(inviteEntry) {
  return inviteEntry.starter === "opponent" ? "ai" : "user";
}

async function handleStart(api, payload) {
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
    if (!sendResult || sendResult.success !== true) {
      return { success: false, message: commandMessage(locale, "dispatchFailed") };
    }
  }

  return { success: true, message: commandMessage(locale, "started") };
}

async function handleReset(api) {
  const locale = readLocale(api);
  const currentState = loadState(api);
  const pendingInvite = loadPendingInvite(api);
  const resetContext =
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
    remoteResetSent = !!sendResult && sendResult.success === true;
  }

  clearPendingInvite(api);
  const state = createInitialState(locale, DEFAULT_TARGET, DEFAULT_STARTER);
  pushRoomState(api, state);
  return {
    success: remoteResetSent,
    message: commandMessage(locale, remoteResetSent ? "reset" : "resetRemoteFailed"),
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
    if (!sendResult || sendResult.success !== true) {
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
  if (!sendResult || sendResult.success !== true) {
    return { success: false, message: commandMessage(locale, "dispatchFailed") };
  }

  return { success: true, message: commandMessage(locale, "moveSent") };
}

async function applyOpponentMove(api, payload, expectedProvider, requireInviteMatch) {
  const state = loadState(api);
  const locale = state.locale;
  const provider = typeof payload.provider === "string" ? payload.provider : "";
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

  if (outcome.finished === true) {
    state.active = false;
    state.awaitingMoveFrom = null;
    state.result = outcome.result;
    state.winner = outcome.winner;
    state.statusKey = outcome.statusKey;
  } else {
    state.awaitingMoveFrom = "user";
    state.result = "pending";
    state.statusKey = "userTurn";
  }

  pushRoomState(api, state);
  return { success: true, message: resolveStatusText(state, loadContext(api)) };
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

  const sendResult = await api.sendUs1Message({
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
  });

  if (!sendResult || sendResult.success !== true) {
    return { success: false, message: commandMessage(readLocale(api), "inviteAcceptFailed") };
  }

  inviteEntry.localSessionId =
    typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== ""
      ? sendResult.localSessionId
      : inviteEntry.localSessionId;
  inviteEntry.conversationId =
    typeof sendResult.conversationId === "string" && sendResult.conversationId !== ""
      ? sendResult.conversationId
      : inviteEntry.conversationId;
  applyInviteAcceptedState(api, inviteEntry, readIncomingInviteStarter(inviteEntry));
  await syncUs1Mailbox(api, "invite-accepted");
  return { success: true, message: commandMessage(readLocale(api), "inviteAccepted") };
}

async function handleRejectInvite(api, payload) {
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

  const sendResult = await api.sendUs1Message({
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
  });

  if (!sendResult || sendResult.success !== true) {
    return { success: false, message: commandMessage(readLocale(api), "inviteRejectFailed") };
  }

  removeInviteFromInbox(api, inviteEntry.matchId || inviteEntry.inviteId, inviteEntry.remoteUserId);
  refreshRoomState(api);
  await syncUs1Mailbox(api, "invite-rejected");
  return { success: true, message: commandMessage(readLocale(api), "inviteRejected") };
}

async function processRoomEvents(api, roomEvents) {
  const currentState = loadState(api);
  const pendingInvite = loadPendingInvite(api);
  const currentMatchId = resolveStateMatchId(currentState);

  for (let index = 0; index < roomEvents.length; index += 1) {
    const event = roomEvents[index];
    if (!event || event.roomId !== ROOM_ID) {
      continue;
    }

    if (event.featureId === TEAM_TETRIS_FEATURE_ID) {
      if (event.eventType === "start") {
        const config = parseTeamTetrisStartEventNote(event.note);
        if (config) {
          const state = loadTeamTetrisState(api);
          state.hiddenPairs = config.hiddenPairs !== false;
          state.revealPairsOnFinish = config.revealPairsOnFinish !== false;
          state.match = createTeamTetrisMatch({
            seed: config.seed,
            matchId: event.matchId || event.inviteId,
            hiddenPairs: state.hiddenPairs,
            revealPairsOnFinish: state.revealPairsOnFinish,
          });
          state.matchId = state.match.matchId;
          state.remoteUserId = event.remoteUserId || state.remoteUserId;
          state.localSessionId = event.localSessionId || state.localSessionId;
          state.active = true;
          state.result = state.match.result;
          saveTeamTetrisState(api, state);
          pushTeamTetrisState(api, state);
          await dispatchNextTeamTetrisTurn(api, state);
        }
        continue;
      }

      if (
        event.eventType === "reset" &&
        (event.matchId || event.inviteId) &&
        loadTeamTetrisState(api).matchId === (event.matchId || event.inviteId)
      ) {
        pushTeamTetrisState(api, resetTeamTetrisState(api, "idle"));
      }
      continue;
    }

    if (event.featureId !== FEATURE_ID) {
      continue;
    }

    if (event.eventType === "invite") {
      api.showToast({
        type: "info",
        message: commandMessage(readLocale(api), "incomingInviteToast", {
          opponent: event.senderNickname || event.remoteUserId,
        }),
      });
      continue;
    }

    if (event.eventType === "accept") {
      if (
        pendingInvite !== null &&
        pendingInvite.direction === "outgoing" &&
        pendingInvite.matchId === (event.matchId || event.inviteId) &&
        pendingInvite.remoteUserId === event.remoteUserId
      ) {
        pendingInvite.localSessionId = event.localSessionId;
        pendingInvite.conversationId = event.conversationId;
        applyInviteAcceptedState(api, pendingInvite, readOutgoingInviteStarter(pendingInvite));
        api.showToast({
          type: "success",
          message: commandMessage(readLocale(api), "inviteAccepted"),
        });
      }
      continue;
    }

    if (
      event.eventType === "reject" &&
      pendingInvite !== null &&
      pendingInvite.direction === "outgoing" &&
      pendingInvite.matchId === (event.matchId || event.inviteId) &&
      pendingInvite.remoteUserId === event.remoteUserId
    ) {
      const state = loadState(api);
      state.active = false;
      state.awaitingMoveFrom = null;
      state.result = "idle";
      state.statusKey = "inviteRejected";
      state.matchId = null;
      state.inviteId = null;
      state.turnIndex = 0;
      state.localSessionId = null;
      state.remoteUserId = pendingInvite.remoteUserId;
      state.opponentNickname = pendingInvite.nickname;
      state.lastRemoteTransportMessageId = null;
      state.lastRemoteTurnIndex = null;
      clearPendingInvite(api);
      pushRoomState(api, state);
      api.showToast({
        type: "info",
        message: commandMessage(readLocale(api), "inviteRejected"),
      });
      continue;
    }

    if (
      event.eventType === "reset" &&
      ((pendingInvite !== null &&
        pendingInvite.direction === "outgoing" &&
        pendingInvite.matchId === (event.matchId || event.inviteId) &&
        pendingInvite.remoteUserId === event.remoteUserId) ||
        (currentState.target === "us1" &&
          currentMatchId !== null &&
          currentMatchId === (event.matchId || event.inviteId) &&
          currentState.remoteUserId === event.remoteUserId))
    ) {
      clearPendingInvite(api);
      removeInviteFromInbox(api, event.matchId || event.inviteId, event.remoteUserId || null);
      const resetState = createInitialState(readLocale(api), "us1", DEFAULT_STARTER);
      resetState.statusKey = "remoteReset";
      resetState.remoteUserId = event.remoteUserId;
      resetState.opponentNickname = event.senderNickname || event.remoteUserId;
      pushRoomState(api, resetState);
    }
  }

  if (currentState.active !== true) {
    refreshRoomState(api);
  }
}

async function processRoomCommands(api, roomCommands) {
  for (let index = 0; index < roomCommands.length; index += 1) {
    const command = roomCommands[index];
    if (
      !command ||
      command.roomId !== ROOM_ID ||
      (command.featureId &&
        command.featureId !== FEATURE_ID &&
        command.featureId !== TEAM_TETRIS_FEATURE_ID)
    ) {
      continue;
    }

    await api.dispatchRoomCommand(command.commandName, {
      roomPayload: command.commandArgs,
      args: command.rawArgs || "",
      remoteUserId: command.remoteUserId,
      localSessionId: command.localSessionId,
      transportMessageId: command.transportMessageId,
    });
  }
}

async function syncUs1Mailbox(api, reason) {
  if (api.isUs1Connected() !== true) {
    return;
  }
  if (api.getState("xox-us1-syncing") === true) {
    return;
  }

  api.setState("xox-us1-syncing", true);
  try {
    const state = loadState(api);
    const result = await api.syncUs1Messages({
      localSessionId: state.localSessionId,
    });
    if (!result || result.success !== true) {
      api.log("warn", `US1 XOX sync failed (${reason}).`);
      return;
    }

    syncInviteInboxFromSnapshot(api, result.roomInviteInbox);
    await processRoomEvents(api, Array.isArray(result.roomEvents) ? result.roomEvents : []);
    await processRoomCommands(api, Array.isArray(result.roomCommands) ? result.roomCommands : []);
    refreshRoomState(api);
  } finally {
    api.deleteState("xox-us1-syncing");
  }
}

function ensureUs1SyncLoop(api) {
  const currentTimer = api.getState("xox-us1-sync-timer");
  if (currentTimer) {
    return;
  }

  const timerId = setInterval(function () {
    void syncUs1Mailbox(api, "poll");
  }, US1_SYNC_INTERVAL_MS);
  if (timerId && typeof timerId.unref === "function") {
    timerId.unref();
  }
  api.setState("xox-us1-sync-timer", timerId);
}

function clearUs1SyncLoop(api) {
  const currentTimer = api.getState("xox-us1-sync-timer");
  if (currentTimer) {
    clearInterval(currentTimer);
  }
  api.deleteState("xox-us1-sync-timer");
}

function syncFromContext(api, payload) {
  const previousContext = loadContext(api);
  const previousActiveFeatureId = getActiveFeatureId(previousContext);
  const context = saveContext(api, payload);
  const activeFeatureId = getActiveFeatureId(context);
  const state = loadState(api);
  const teamTetrisState = loadTeamTetrisState(api);
  if (
    previousActiveFeatureId === TEAM_TETRIS_FEATURE_ID &&
    activeFeatureId !== TEAM_TETRIS_FEATURE_ID
  ) {
    resetTeamTetrisState(api, "activeFeatureReset");
  }

  state.locale = readLocale(api);
  if (state.active === true && isBlocked(state) !== true) {
    const opponent = getOpponentInfo(context, state);
    const readyForActiveMatch =
      opponent.ready === true &&
      (state.target !== "us1" ||
        state.remoteUserId === null ||
        opponent.remoteUserId === state.remoteUserId);
    if (readyForActiveMatch !== true) {
      blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
      return;
    }
  }

  saveState(api, state);
  if (teamTetrisState.match && teamTetrisState.result !== "blocked") {
    const readiness = getTeamTetrisReadiness(context);
    if (readiness.ai1 !== true || readiness.ai2 !== true || readiness.us1 !== true) {
      blockTeamTetrisMatch(api, teamTetrisState, "blockedOpponent", "required-seat-unavailable");
      return;
    }
  }
  pushActiveFeatureState(api);
}

const gameRoomHost = {
  activate: function activate(api) {
    api.log("info", "Game Room XOX host activated.");
    saveContext(api, {});
    saveInviteInbox(api, []);
    clearPendingInvite(api);
    saveState(api, createInitialState(readLocale(api), DEFAULT_TARGET, DEFAULT_STARTER));
    saveTeamTetrisState(api, createInitialTeamTetrisState(readLocale(api)));
    ensureUs1SyncLoop(api);

    return {
      commands: {
        GameRoomXoxStart: function (payload) {
          return handleStart(api, payload || {});
        },
        GameRoomXoxReset: function () {
          return handleReset(api);
        },
        GameRoomXoxUserMove: function (payload) {
          return handleUserMove(api, payload || {});
        },
        GameRoomXoxAiMove: function (payload) {
          return handleAiMove(api, payload || {});
        },
        GameRoomXoxRemoteMove: function (payload) {
          return handleRemoteMove(api, payload || {});
        },
        GameRoomXoxAcceptInvite: function (payload) {
          return handleAcceptInvite(api, payload || {});
        },
        GameRoomXoxRejectInvite: function (payload) {
          return handleRejectInvite(api, payload || {});
        },
        GameRoomTeamTetrisStart: function (payload) {
          return handleTeamTetrisStart(api, payload || {});
        },
        GameRoomTeamTetrisReset: function () {
          return handleTeamTetrisReset(api);
        },
        GameRoomTeamTetrisUserMove: function (payload) {
          return handleTeamTetrisMove(api, payload || {});
        },
        GameRoomTeamTetrisAiMove: function (payload) {
          return handleTeamTetrisMove(api, payload || {});
        },
        GameRoomTeamTetrisRemoteMove: function (payload) {
          return handleTeamTetrisMove(api, payload || {});
        },
      },
      onRoomReady: function onRoomReady() {
        pushActiveFeatureState(api);
        void syncUs1Mailbox(api, "room-ready");
      },
      onRoomEvent: function onRoomEvent(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return;
        }

        if (payload.type === "host-context") {
          syncFromContext(api, payload);
          void syncUs1Mailbox(api, "context");
        }
      },
      dispose: function dispose() {
        clearUs1SyncLoop(api);
        api.log("info", "Game Room XOX host disposed.");
      },
    };
  },
};

export { teamTetrisEngine };
export default gameRoomHost;
