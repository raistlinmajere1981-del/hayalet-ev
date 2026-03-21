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

const STATUS_COPY = {
  idle: {
    en: "Choose a ready AI opponent, decide who starts, then begin the match.",
    tr: "Hazir bir AI rakibi sec, kimin baslayacagini belirle ve maci baslat.",
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
  reset: {
    en: "XOX match reset.",
    tr: "XOX maci sifirlandi.",
  },
  needReadyOpponent: {
    en: "The selected AI slot is not ready.",
    tr: "Secilen AI slotu hazir degil.",
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
    en: "Move applied and sent to the AI opponent.",
    tr: "Hamle uygulandi ve AI rakibe gonderildi.",
  },
  aiTurnOnly: {
    en: "The room is not waiting for an AI move.",
    tr: "Oda su an bir AI hamlesi beklemiyor.",
  },
  providerMismatch: {
    en: "The move came from a different slot than the selected opponent.",
    tr: "Hamle secili rakipten farkli bir slottan geldi.",
  },
  aiInvalidMove: {
    en: "The AI sent an invalid move.",
    tr: "AI gecersiz bir hamle gonderdi.",
  },
  aiFilledCell: {
    en: "The AI tried to play into a filled cell.",
    tr: "AI dolu bir hucreye oynamaya calisti.",
  },
  dispatchFailed: {
    en: "The board update could not be sent to the AI slot.",
    tr: "Tahta guncellemesi AI slotuna gonderilemedi.",
  },
};

function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function sanitizeTarget(value) {
  return value === "ai2" ? "ai2" : DEFAULT_TARGET;
}

function sanitizeStarter(value) {
  return value === "ai" ? "ai" : DEFAULT_STARTER;
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
  return state;
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

function getOpponentInfo(context, target) {
  if (context && context.slots && context.slots[target]) {
    return context.slots[target];
  }
  return createSlotState(target);
}

function resolveStatusText(state, context) {
  const opponent = getOpponentInfo(context, state.target);
  return fillTemplate(translate(state.locale, STATUS_COPY, state.statusKey), {
    opponent: opponent.nickname,
  });
}

function serializeState(state, context) {
  const opponent = getOpponentInfo(context, state.target);
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
    state: serializeState(savedState, context),
  });
  return savedState;
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

function commandMessage(locale, key, params) {
  return fillTemplate(translate(locale, COMMAND_COPY, key), params || {});
}

function buildAiTurnMessage(state, context) {
  const opponent = getOpponentInfo(context, state.target);
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
  const opponent = getOpponentInfo(context, state.target);

  if (opponent.ready !== true) {
    blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
    return { success: false, message: commandMessage(state.locale, "needReadyOpponent") };
  }

  if (includeProtocol === true && state.protocolDelivered !== true) {
    const protocolResult = await api.sendProtocol({
      room: ROOM_ID,
      scenario: state.starter === "ai" ? "xox-ai-start" : "xox-user-start",
      targets: [state.target],
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

async function handleStart(api, payload) {
  const locale = readLocale(api);
  const args = readArgs(payload);
  const target = sanitizeTarget(args.target);
  const starter = sanitizeStarter(args.starter);
  const context = loadContext(api);
  const opponent = getOpponentInfo(context, target);

  if (opponent.ready !== true) {
    return { success: false, message: commandMessage(locale, "needReadyOpponent") };
  }

  const state = createInitialState(locale, target, starter);
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
  const state = createInitialState(locale, DEFAULT_TARGET, DEFAULT_STARTER);
  pushRoomState(api, state);
  return { success: true, message: commandMessage(locale, "reset") };
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

  state.board[cell] = state.userSymbol;
  const outcome = getOutcomeForBoard(state.board, state);

  if (outcome.finished === true) {
    state.active = false;
    state.awaitingMoveFrom = null;
    state.result = outcome.result;
    state.winner = outcome.winner;
    state.statusKey = outcome.statusKey;
    pushRoomState(api, state);
    return { success: true, message: resolveStatusText(state, loadContext(api)) };
  }

  state.awaitingMoveFrom = "ai";
  state.result = "pending";
  state.statusKey = "aiTurn";
  pushRoomState(api, state);

  const sendResult = await sendAiTurnUpdate(api, state, state.protocolDelivered !== true);
  if (!sendResult || sendResult.success !== true) {
    return { success: false, message: commandMessage(locale, "dispatchFailed") };
  }

  return { success: true, message: commandMessage(locale, "moveSent") };
}

async function handleAiMove(api, payload) {
  const state = loadState(api);
  const locale = state.locale;
  const provider = typeof payload.provider === "string" ? payload.provider : "";
  const cell = readCell(payload);

  if (state.active !== true) {
    return { success: false, message: commandMessage(locale, "noActiveGame") };
  }
  if (isBlocked(state)) {
    return { success: false, message: commandMessage(locale, "blockedGame") };
  }
  if (state.awaitingMoveFrom !== "ai") {
    return { success: false, message: commandMessage(locale, "aiTurnOnly") };
  }
  if (provider !== "" && provider !== state.target) {
    return { success: false, message: commandMessage(locale, "providerMismatch") };
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

function syncFromContext(api, payload) {
  const context = saveContext(api, payload);
  const state = loadState(api);

  state.locale = readLocale(api);
  if (state.active === true && isBlocked(state) !== true) {
    const opponent = getOpponentInfo(context, state.target);
    if (opponent.ready !== true) {
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
    saveState(api, createInitialState(readLocale(api), DEFAULT_TARGET, DEFAULT_STARTER));

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
      },
      onRoomReady: function onRoomReady() {
        pushRoomState(api, loadState(api));
      },
      onRoomEvent: function onRoomEvent(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return;
        }

        if (payload.type === "host-context") {
          syncFromContext(api, payload);
        }
      },
      dispose: function dispose() {
        api.log("info", "Game Room XOX host disposed.");
      },
    };
  },
};
