const EMPTY_BOARD = ["", "", "", "", "", "", "", "", ""];
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
const DEFAULT_TARGET = "ai1";
const DEFAULT_STARTER = "user";
const ROOM_ID = "game-room";
const PAGE_ID = "room:game-room:xox";
const FEATURE_ID = "xox";
const US1_SYNC_INTERVAL_MS = 5000;

const STATUS_COPY = {
  idle: {
    en: "Choose a ready opponent or accept an incoming XOX invite.",
    tr: "Hazir bir rakip sec veya gelen XOX davetlerinden birini kabul et.",
  },
  invitePending: {
    en: "Invite sent to {opponent}. Waiting for a reply.",
    tr: "{opponent} tarafina davet gonderildi. Yanit bekleniyor.",
  },
  userTurn: {
    en: "Your turn. Place your mark on an empty cell.",
    tr: "Sira sende. Bos bir hucreye isaretini yerlestir.",
  },
  aiTurn: {
    en: "Waiting for {opponent} to answer with a move.",
    tr: "{opponent} hamlesini gonderene kadar bekleniyor.",
  },
  userWin: {
    en: "You won the XOX match.",
    tr: "XOX macini sen kazandin.",
  },
  aiWin: {
    en: "{opponent} won the XOX match.",
    tr: "{opponent} XOX macini kazandi.",
  },
  draw: {
    en: "Draw. No cells remain open.",
    tr: "Berabere. Acik hucre kalmadi.",
  },
  inviteRejected: {
    en: "{opponent} rejected the XOX invite.",
    tr: "{opponent} XOX davetini reddetti.",
  },
  remoteReset: {
    en: "{opponent} ended the XOX match.",
    tr: "{opponent} XOX macini sonlandirdi.",
  },
  blockedOpponent: {
    en: "{opponent} disconnected during the match. Reset to begin again.",
    tr: "{opponent} mac sirasinda baglantidan dustu. Yeniden baslamak icin sifirla.",
  },
  blockedDispatch: {
    en: "The latest board update could not be delivered to {opponent}. Reset to try again.",
    tr: "Guncel tahta durumu {opponent} tarafina iletilemedi. Tekrar denemek icin sifirla.",
  },
  blockedInvalidMove: {
    en: "{opponent} returned an invalid XOX move. Reset to start over.",
    tr: "{opponent} gecersiz bir XOX hamlesi dondu. Basa almak icin sifirla.",
  },
};

const COMMAND_COPY = {
  started: {
    en: "XOX match started.",
    tr: "XOX maci baslatildi.",
  },
  inviteSent: {
    en: "XOX invite sent to the remote opponent.",
    tr: "Uzak rakibe XOX daveti gonderildi.",
  },
  reset: {
    en: "XOX match reset.",
    tr: "XOX maci sifirlandi.",
  },
  needReadyOpponent: {
    en: "The selected opponent is not ready.",
    tr: "Secilen rakip hazir degil.",
  },
  pendingInviteExists: {
    en: "There is already a pending remote invite. Reset first if you want to start over.",
    tr: "Bekleyen bir uzak davet zaten var. Basa donmek icin once sifirla.",
  },
  noActiveGame: {
    en: "There is no active XOX match.",
    tr: "Aktif bir XOX maci yok.",
  },
  blockedGame: {
    en: "This match is blocked. Reset to start again.",
    tr: "Bu mac bloke oldu. Yeniden baslamak icin sifirla.",
  },
  notUserTurn: {
    en: "It is not the user's turn.",
    tr: "Sira kullanicida degil.",
  },
  invalidCell: {
    en: "Choose a valid board cell from 0 to 8.",
    tr: "0 ile 8 arasinda gecerli bir tahta hucresi sec.",
  },
  cellFilled: {
    en: "That cell is already filled.",
    tr: "Bu hucre zaten dolu.",
  },
  moveSent: {
    en: "Move applied and sent to the opponent.",
    tr: "Hamle uygulandi ve rakibe gonderildi.",
  },
  aiTurnOnly: {
    en: "The room is not waiting for an opponent move.",
    tr: "Oda su an bir rakip hamlesi beklemiyor.",
  },
  providerMismatch: {
    en: "The move came from a different opponent than the active match.",
    tr: "Hamle aktif mactakinden farkli bir rakipten geldi.",
  },
  inviteMismatch: {
    en: "The invite does not match the active XOX match.",
    tr: "Davet bilgisi aktif XOX maci ile eslesmiyor.",
  },
  aiInvalidMove: {
    en: "The opponent sent an invalid move.",
    tr: "Rakip gecersiz bir hamle gonderdi.",
  },
  aiFilledCell: {
    en: "The opponent tried to play into a filled cell.",
    tr: "Rakip dolu bir hucreye oynamaya calisti.",
  },
  dispatchFailed: {
    en: "The board update could not be sent to the opponent.",
    tr: "Tahta guncellemesi rakibe gonderilemedi.",
  },
  inviteNotFound: {
    en: "The selected invite is no longer available.",
    tr: "Secilen davet artik kullanilabilir degil.",
  },
  inviteAcceptFailed: {
    en: "The invite could not be accepted.",
    tr: "Davet kabul edilemedi.",
  },
  inviteRejectFailed: {
    en: "The invite could not be rejected.",
    tr: "Davet reddedilemedi.",
  },
  inviteAccepted: {
    en: "The invite was accepted and the match is ready.",
    tr: "Davet kabul edildi ve mac hazir.",
  },
  inviteRejected: {
    en: "The invite was rejected.",
    tr: "Davet reddedildi.",
  },
  staleRemoteMove: {
    en: "A stale remote move was ignored.",
    tr: "Gec kalan uzak hamle yoksayildi.",
  },
  duplicateRemoteMove: {
    en: "A duplicate remote move was ignored.",
    tr: "Yinelenen uzak hamle yoksayildi.",
  },
  resetRemoteFailed: {
    en: "Local reset applied, but the remote side could not be notified.",
    tr: "Yerel sifirlama uygulandi, ancak uzak tarafa bildirim gonderilemedi.",
  },
  incomingInviteToast: {
    en: "{opponent} sent a new XOX invite.",
    tr: "{opponent} yeni bir XOX daveti gonderdi.",
  },
};

function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function sanitizeTarget(value) {
  if (value === "ai2" || value === "us1") {
    return value;
  }
  return DEFAULT_TARGET;
}

function sanitizeStarter(value) {
  return value === "ai" ? "ai" : DEFAULT_STARTER;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneBoard(board) {
  return Array.isArray(board) ? board.slice(0, 9) : EMPTY_BOARD.slice();
}

function normalizeBoard(board) {
  const next = cloneBoard(board);
  while (next.length < 9) {
    next.push("");
  }
  return next.map(function (value) {
    return value === "X" || value === "O" ? value : "";
  });
}

function getSymbols(starter) {
  return sanitizeStarter(starter) === "ai"
    ? { userSymbol: "O", aiSymbol: "X" }
    : { userSymbol: "X", aiSymbol: "O" };
}

function translate(locale, group, key) {
  const entry = group[key];
  if (!entry) {
    return "";
  }
  const normalizedLocale = normalizeLocale(locale);
  return entry[normalizedLocale] || entry.en || "";
}

function fillTemplate(template, params) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, function (_match, key) {
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : "";
  });
}

function buildBoardAscii(board) {
  const rows = [];
  for (let row = 0; row < 3; row += 1) {
    const values = [];
    for (let column = 0; column < 3; column += 1) {
      const index = row * 3 + column;
      values.push(board[index] === "" ? String(index) : board[index]);
    }
    rows.push(values.join(" | "));
  }
  return rows.join("\n---------\n");
}

function buildBoardStateHash(board) {
  return normalizeBoard(board).map(function (value) {
    return value === "" ? "." : value;
  }).join("");
}

function getAvailableCells(board) {
  return board
    .map(function (value, index) {
      return value === "" ? index : null;
    })
    .filter(function (value) {
      return value !== null;
    });
}

function createSlotState(slotId) {
  return {
    slotId: slotId,
    nickname: slotId.toUpperCase(),
    assigned: false,
    connected: false,
    ready: false,
    state: "empty",
    urlExcluded: false,
    accountId: null,
    remoteUserId: null,
  };
}

function normalizeSlot(candidate, slotId) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const nickname =
    typeof source.nickname === "string" && source.nickname.trim() !== ""
      ? source.nickname.trim()
      : slotId.toUpperCase();
  const assigned = source.assigned === true;
  const connected = source.connected === true;
  const urlExcluded = source.urlExcluded === true;
  const ready = source.ready === true || (assigned && connected && urlExcluded !== true);

  return {
    slotId: slotId,
    nickname: nickname,
    assigned: assigned,
    connected: connected,
    ready: ready,
    state: typeof source.state === "string" && source.state.trim() !== "" ? source.state.trim() : "empty",
    urlExcluded: urlExcluded,
    accountId: typeof source.accountId === "string" && source.accountId.trim() !== "" ? source.accountId.trim() : null,
    remoteUserId:
      typeof source.remoteUserId === "string" && source.remoteUserId.trim() !== ""
        ? source.remoteUserId.trim()
        : null,
  };
}

function sanitizeContext(payload) {
  const source =
    payload && typeof payload === "object" && Array.isArray(payload) === false ? payload : {};
  const slotsSource =
    source.slots && typeof source.slots === "object" && Array.isArray(source.slots) === false
      ? source.slots
      : {};
  const userSource =
    source.user && typeof source.user === "object" && Array.isArray(source.user) === false
      ? source.user
      : {};

  return {
    room:
      source.room && typeof source.room === "object" && Array.isArray(source.room) === false
        ? source.room
        : { id: ROOM_ID },
    presentation:
      source.presentation && typeof source.presentation === "object" && Array.isArray(source.presentation) === false
        ? source.presentation
        : { mode: "classic" },
    user: {
      nickname:
        typeof userSource.nickname === "string" && userSource.nickname.trim() !== ""
          ? userSource.nickname.trim()
          : "User",
    },
    slots: {
      ai1: normalizeSlot(slotsSource.ai1, "ai1"),
      ai2: normalizeSlot(slotsSource.ai2, "ai2"),
      us1: normalizeSlot(slotsSource.us1, "us1"),
    },
  };
}

function createInitialState(locale, target, starter) {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedTarget = sanitizeTarget(target);
  const normalizedStarter = sanitizeStarter(starter);
  const symbols = getSymbols(normalizedStarter);

  return {
    locale: normalizedLocale,
    target: normalizedTarget,
    starter: normalizedStarter,
    board: EMPTY_BOARD.slice(),
    active: false,
    awaitingMoveFrom: null,
    result: "idle",
    winner: "",
    statusKey: "idle",
    protocolDelivered: false,
    blockedReason: "",
    userSymbol: symbols.userSymbol,
    aiSymbol: symbols.aiSymbol,
    protocolPreface: "",
    matchId: null,
    inviteId: null,
    turnIndex: 0,
    localSessionId: null,
    remoteUserId: null,
    opponentNickname: "",
    lastRemoteTransportMessageId: null,
    lastRemoteTurnIndex: null,
  };
}

function normalizeInviteEntry(candidate) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const inviteId = normalizeText(source.inviteId) || normalizeText(source.matchId);
  const matchId = normalizeText(source.matchId) || inviteId;
  return {
    roomId: normalizeText(source.roomId),
    featureId: normalizeText(source.featureId),
    inviteId: inviteId,
    matchId: matchId,
    remoteUserId: normalizeText(source.remoteUserId),
    nickname: normalizeText(source.nickname) || normalizeText(source.senderNickname) || "US1",
    senderEmail: normalizeText(source.senderEmail),
    note: normalizeText(source.note),
    starter: source.starter === "opponent" ? "opponent" : "user",
    localSessionId: normalizeText(source.localSessionId),
    conversationId: normalizeText(source.conversationId),
    transportMessageId: normalizeText(source.transportMessageId),
    sentAt:
      typeof source.sentAt === "number" && Number.isFinite(source.sentAt) && source.sentAt >= 0
        ? Math.trunc(source.sentAt)
        : null,
  };
}

function normalizeInviteInbox(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(function (entry) {
      return normalizeInviteEntry(entry);
    })
    .filter(function (entry) {
      return entry.matchId !== "" && entry.remoteUserId !== "";
    });
}

function normalizePendingInvite(value) {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value;
  const matchId = normalizeText(source.matchId) || normalizeText(source.inviteId);
  const remoteUserId = normalizeText(source.remoteUserId);
  if (matchId === "" || remoteUserId === "") {
    return null;
  }

  return {
    direction: source.direction === "incoming" ? "incoming" : "outgoing",
    inviteId: matchId,
    matchId: matchId,
    remoteUserId: remoteUserId,
    nickname: normalizeText(source.nickname) || "US1",
    note: normalizeText(source.note),
    starter: source.starter === "opponent" ? "opponent" : "user",
    localSessionId: normalizeText(source.localSessionId),
    conversationId: normalizeText(source.conversationId),
  };
}

function normalizeState(candidate, localeFallback) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const state = createInitialState(
    source.locale || localeFallback,
    source.target,
    source.starter
  );

  state.board = normalizeBoard(source.board);
  state.active = source.active === true;
  state.awaitingMoveFrom =
    source.awaitingMoveFrom === "ai" || source.awaitingMoveFrom === "user"
      ? source.awaitingMoveFrom
      : null;
  state.result =
    typeof source.result === "string" && source.result.trim() !== "" ? source.result.trim() : "idle";
  state.winner = source.winner === "ai" || source.winner === "user" ? source.winner : "";
  state.statusKey =
    typeof source.statusKey === "string" && Object.prototype.hasOwnProperty.call(STATUS_COPY, source.statusKey)
      ? source.statusKey
      : "idle";
  state.protocolDelivered = source.protocolDelivered === true;
  state.blockedReason =
    typeof source.blockedReason === "string" && source.blockedReason.trim() !== ""
      ? source.blockedReason.trim()
      : "";
  state.protocolPreface = normalizeText(source.protocolPreface);
  state.matchId = normalizeText(source.matchId) || normalizeText(source.inviteId) || null;
  state.inviteId = normalizeText(source.inviteId) || null;
  state.turnIndex =
    typeof source.turnIndex === "number" && Number.isInteger(source.turnIndex) && source.turnIndex >= 0
      ? source.turnIndex
      : 0;
  state.localSessionId = normalizeText(source.localSessionId) || null;
  state.remoteUserId = normalizeText(source.remoteUserId) || null;
  state.opponentNickname = normalizeText(source.opponentNickname);
  state.lastRemoteTransportMessageId = normalizeText(source.lastRemoteTransportMessageId) || null;
  state.lastRemoteTurnIndex =
    typeof source.lastRemoteTurnIndex === "number" &&
    Number.isInteger(source.lastRemoteTurnIndex) &&
    source.lastRemoteTurnIndex >= 0
      ? source.lastRemoteTurnIndex
      : null;
  return state;
}

function createPendingInvite(direction, inviteEntry) {
  const matchId = inviteEntry.matchId || inviteEntry.inviteId;
  return {
    direction: direction === "incoming" ? "incoming" : "outgoing",
    roomId: inviteEntry.roomId || ROOM_ID,
    featureId: inviteEntry.featureId || FEATURE_ID,
    inviteId: matchId,
    matchId: matchId,
    remoteUserId: inviteEntry.remoteUserId,
    nickname: inviteEntry.nickname,
    note: inviteEntry.note,
    starter: inviteEntry.starter,
    localSessionId: inviteEntry.localSessionId,
    conversationId: inviteEntry.conversationId,
  };
}

function getOutcomeForBoard(board, state) {
  for (let index = 0; index < WIN_LINES.length; index += 1) {
    const line = WIN_LINES[index];
    const first = board[line[0]];
    const second = board[line[1]];
    const third = board[line[2]];

    if (first !== "" && first === second && second === third) {
      if (first === state.userSymbol) {
        return { finished: true, result: "user-win", winner: "user", statusKey: "userWin" };
      }
      return { finished: true, result: "ai-win", winner: "ai", statusKey: "aiWin" };
    }
  }

  if (board.every(function (value) { return value !== ""; })) {
    return { finished: true, result: "draw", winner: "", statusKey: "draw" };
  }

  return { finished: false };
}

function readLocale(api) {
  return normalizeLocale(typeof api.getLocale === "function" ? api.getLocale() : api.getState("locale"));
}

function loadContext(api) {
  return sanitizeContext(api.getState("xox-context"));
}

function saveContext(api, payload) {
  const context = sanitizeContext(payload);
  api.setState("xox-context", context);
  return context;
}

function loadState(api) {
  return normalizeState(api.getState("xox-game"), readLocale(api));
}

function saveState(api, state) {
  const normalized = normalizeState(state, readLocale(api));
  normalized.locale = readLocale(api);
  api.setState("locale", normalized.locale);
  api.setState("xox-game", normalized);
  return normalized;
}

function loadInviteInbox(api) {
  return normalizeInviteInbox(api.getState("xox-invite-inbox"));
}

function saveInviteInbox(api, inviteInbox) {
  const normalized = normalizeInviteInbox(inviteInbox);
  api.setState("xox-invite-inbox", normalized);
  return normalized;
}

function loadPendingInvite(api) {
  return normalizePendingInvite(api.getState("xox-pending-invite"));
}

function savePendingInvite(api, pendingInvite) {
  const normalized = normalizePendingInvite(pendingInvite);
  if (normalized === null) {
    api.deleteState("xox-pending-invite");
    return null;
  }
  api.setState("xox-pending-invite", normalized);
  return normalized;
}

function clearPendingInvite(api) {
  api.deleteState("xox-pending-invite");
}

function createUs1OpponentFallback(state) {
  return {
    slotId: "us1",
    nickname: state.opponentNickname || "US1",
    assigned: state.remoteUserId !== null,
    connected: false,
    ready: false,
    state: "assigned",
    urlExcluded: false,
    accountId: null,
    remoteUserId: state.remoteUserId,
  };
}

function getOpponentInfo(context, state) {
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

function resolveStatusText(state, context) {
  const opponent = getOpponentInfo(context, state);
  return fillTemplate(translate(state.locale, STATUS_COPY, state.statusKey), {
    opponent: opponent.nickname,
  });
}

function serializeState(api, state, context) {
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

function pushRoomState(api, state) {
  const context = loadContext(api);
  const savedState = saveState(api, state);
  api.notifyRoom("xox-state", {
    state: serializeState(api, savedState, context),
  });
  return savedState;
}

function refreshRoomState(api) {
  return pushRoomState(api, loadState(api));
}

function readArgs(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  if (payload.roomArgs && typeof payload.roomArgs === "object" && Array.isArray(payload.roomArgs) === false) {
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
  if (typeof args.turnIndex === "number" && Number.isInteger(args.turnIndex) && args.turnIndex >= 0) {
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
  return [
    opener,
    "Match ID: " + (inviteEntry.matchId || inviteEntry.inviteId),
  ].join("\n");
}

function buildUs1ResetText(matchId) {
  return [
    "XOX match reset.",
    "Match ID: " + matchId,
  ].join("\n");
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
  state.localSessionId = typeof sendResult.localSessionId === "string" ? sendResult.localSessionId : null;
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
      conversationId: typeof sendResult.conversationId === "string" ? sendResult.conversationId : "",
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
    opponent.remoteUserId !== null && opponent.remoteUserId !== state.remoteUserId
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
  return loadInviteInbox(api).find(function (entry) {
    return matchesInviteEntry(entry, inviteId, remoteUserId || null);
  }) || null;
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
  const opponent = target === "us1" ? context.slots.us1 : getOpponentInfo(context, { target: target, remoteUserId: null, opponentNickname: "" });

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
    (
      (turnIndex !== null && turnIndex !== state.turnIndex) ||
      (boardHashBeforeMove !== null && boardHashBeforeMove !== buildBoardStateHash(state.board))
    )
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
    if (!event || event.roomId !== ROOM_ID || event.featureId !== FEATURE_ID) {
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
      (
        (pendingInvite !== null &&
          pendingInvite.direction === "outgoing" &&
          pendingInvite.matchId === (event.matchId || event.inviteId) &&
          pendingInvite.remoteUserId === event.remoteUserId) ||
        (currentState.target === "us1" &&
          currentMatchId !== null &&
          currentMatchId === (event.matchId || event.inviteId) &&
          currentState.remoteUserId === event.remoteUserId)
      )
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
    if (!command || command.roomId !== ROOM_ID || command.featureId !== FEATURE_ID) {
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
  const context = saveContext(api, payload);
  const state = loadState(api);

  state.locale = readLocale(api);
  if (state.active === true && isBlocked(state) !== true) {
    const opponent = getOpponentInfo(context, state);
    const readyForActiveMatch =
      opponent.ready === true &&
      (state.target !== "us1" || state.remoteUserId === null || opponent.remoteUserId === state.remoteUserId);
    if (readyForActiveMatch !== true) {
      blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
      return;
    }
  }

  pushRoomState(api, state);
}

module.exports = {
  activate: function activate(api) {
    api.log("info", "Game Room XOX host activated.");
    saveContext(api, {});
    saveInviteInbox(api, []);
    clearPendingInvite(api);
    saveState(api, createInitialState(readLocale(api), DEFAULT_TARGET, DEFAULT_STARTER));
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
      },
      onRoomReady: function onRoomReady() {
        pushRoomState(api, loadState(api));
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
