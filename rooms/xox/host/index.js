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
const START_PROTOCOL = [
  "You are playing XOX as O against the user in the xox room.",
  "Board cells are indexed from 0 to 8.",
  "When the room sends a board update, answer with exactly one line in this format:",
  '++cmd:XOXAIMove({"cell":4})',
  "Do not add any other text, markdown, explanation, or code fences.",
].join("\n");
const STATUS_COPY = {
  idle: {
    en: "Open the game with Start and pick the AI slot.",
    tr: "Baslat ile oyunu ac ve AI slotunu sec.",
  },
  gameStarted: {
    en: "Game started. You move first.",
    tr: "Oyun basladi. Once sen oynuyorsun.",
  },
  waitingForAI: {
    en: "Your move was sent. Waiting for the AI reply.",
    tr: "Hamlen gonderildi. AI cevabi bekleniyor.",
  },
  aiMoved: {
    en: "The AI moved. Your turn.",
    tr: "AI hamlesini yapti. Siradaki hamle senin.",
  },
  aiRequestFailed: {
    en: "The AI move could not be requested. Start a new game with Reset.",
    tr: "AI hamlesi istenemedi. Sifirla ile yeni oyun baslat.",
  },
  userWin: {
    en: "You won. The board ended cleanly.",
    tr: "Kazandin. Tahta temiz bir sekilde bitti.",
  },
  aiWin: {
    en: "The AI won. You can start a new game.",
    tr: "AI kazandi. Yeni oyun baslatabilirsin.",
  },
  draw: {
    en: "Draw. All cells are full.",
    tr: "Berabere. Tum hucreler doldu.",
  },
};
const COMMAND_COPY = {
  gameStarted: {
    en: "XOX game started.",
    tr: "XOX oyunu baslatildi.",
  },
  inactiveGame: {
    en: "Game is not active.",
    tr: "Oyun aktif degil.",
  },
  waitingForAITurn: {
    en: "Waiting for the AI move right now.",
    tr: "Su an AI hamlesi bekleniyor.",
  },
  invalidCell: {
    en: "Invalid cell.",
    tr: "Gecersiz hucre.",
  },
  cellFilled: {
    en: "This cell is already filled.",
    tr: "Bu hucre dolu.",
  },
  moveSent: {
    en: "Move sent.",
    tr: "Hamle gonderildi.",
  },
  noActiveGame: {
    en: "There is no active game.",
    tr: "Aktif oyun yok.",
  },
  notAITurn: {
    en: "It is not the AI move turn.",
    tr: "AI hamlesi sirasinda degil.",
  },
  providerMismatch: {
    en: "The move target does not match the selected slot.",
    tr: "Hamle hedef slot ile eslesmiyor.",
  },
  aiInvalidCell: {
    en: "The AI sent an invalid cell.",
    tr: "AI gecersiz hucre gonderdi.",
  },
  aiFilledCell: {
    en: "The AI tried to use a filled cell.",
    tr: "AI dolu hucre secmeye calisti.",
  },
  gameReset: {
    en: "Game reset.",
    tr: "Oyun sifirlandi.",
  },
  stateSynced: {
    en: "Room state synchronized.",
    tr: "Oda durumu senkronize edildi.",
  },
};
const LEGACY_STATUS_KEY_BY_MESSAGE = new Map(
  Object.entries(STATUS_COPY).flatMap(function ([key, translations]) {
    return Object.values(translations).map(function (message) {
      return [message, key];
    });
  })
);

function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

function sanitizeTarget(value) {
  return value === "ai2" ? "ai2" : "ai1";
}

function cloneBoard(board) {
  return Array.isArray(board) ? board.slice(0, 9) : EMPTY_BOARD.slice();
}

function normalizeBoard(board) {
  const next = cloneBoard(board);
  while (next.length < 9) {
    next.push("");
  }
  return next.map((value) => (value === "X" || value === "O" ? value : ""));
}

function translate(locale, group, key) {
  const normalizedLocale = normalizeLocale(locale);
  const entry = group[key];
  if (!entry) {
    return "";
  }
  return entry[normalizedLocale] ?? entry.en;
}

function readCurrentLocale(api) {
  return normalizeLocale(typeof api.getLocale === "function" ? api.getLocale() : api.getState("locale"));
}

function resolveStatusText(state, locale) {
  const normalizedLocale = normalizeLocale(locale ?? state.locale);
  if (state.statusKey === "custom") {
    return typeof state.statusOverride === "string" && state.statusOverride.trim() !== ""
      ? state.statusOverride.trim()
      : translate(normalizedLocale, STATUS_COPY, "idle");
  }

  const translated = translate(normalizedLocale, STATUS_COPY, state.statusKey);
  if (translated !== "") {
    return translated;
  }

  if (typeof state.status === "string" && state.status.trim() !== "") {
    return state.status.trim();
  }

  return translate(normalizedLocale, STATUS_COPY, "idle");
}

function setStatusKey(state, locale, statusKey) {
  state.locale = normalizeLocale(locale);
  state.statusKey = statusKey;
  state.statusOverride = "";
  state.status = resolveStatusText(state, state.locale);
}

function setCustomStatus(state, locale, status) {
  state.locale = normalizeLocale(locale);
  state.statusKey = "custom";
  state.statusOverride = typeof status === "string" ? status.trim() : "";
  state.status = resolveStatusText(state, state.locale);
}

function createIdleState(target, locale) {
  const normalizedLocale = normalizeLocale(locale);
  const state = {
    board: EMPTY_BOARD.slice(),
    locale: normalizedLocale,
    target: sanitizeTarget(target),
    active: false,
    awaitingAI: false,
    currentTurn: "X",
    result: "idle",
    winner: "",
    statusKey: "idle",
    statusOverride: "",
    status: "",
  };
  state.status = resolveStatusText(state, normalizedLocale);
  return state;
}

function loadState(api) {
  const candidate = api.getState("game");
  const locale = normalizeLocale(api.getState("locale") ?? readCurrentLocale(api));
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createIdleState("ai1", locale);
  }

  const next = createIdleState(candidate.target, candidate.locale ?? locale);
  next.board = normalizeBoard(candidate.board);
  next.target = sanitizeTarget(candidate.target);
  next.active = candidate.active === true;
  next.awaitingAI = candidate.awaitingAI === true;
  next.currentTurn = candidate.currentTurn === "O" ? "O" : "X";
  next.result =
    typeof candidate.result === "string" && candidate.result !== "" ? candidate.result : "idle";
  next.winner = candidate.winner === "O" || candidate.winner === "X" ? candidate.winner : "";

  if (typeof candidate.statusKey === "string" && Object.hasOwn(STATUS_COPY, candidate.statusKey)) {
    next.statusKey = candidate.statusKey;
    next.statusOverride = "";
  } else if (candidate.statusKey === "custom") {
    next.statusKey = "custom";
    next.statusOverride =
      typeof candidate.statusOverride === "string" && candidate.statusOverride.trim() !== ""
        ? candidate.statusOverride.trim()
        : typeof candidate.status === "string"
          ? candidate.status.trim()
          : "";
  } else if (typeof candidate.status === "string" && candidate.status.trim() !== "") {
    const legacyKey = LEGACY_STATUS_KEY_BY_MESSAGE.get(candidate.status.trim());
    if (typeof legacyKey === "string") {
      next.statusKey = legacyKey;
      next.statusOverride = "";
    } else {
      next.statusKey = "custom";
      next.statusOverride = candidate.status.trim();
    }
  }

  next.status = resolveStatusText(next, next.locale);
  return next;
}

function saveState(api, state) {
  const locale = readCurrentLocale(api);
  api.setState("locale", locale);
  state.locale = locale;
  state.status = resolveStatusText(state, locale);
  api.setState("game", state);
  return state;
}

function serializeState(state) {
  return {
    board: state.board.slice(),
    locale: state.locale,
    target: state.target,
    active: state.active,
    awaitingAI: state.awaitingAI,
    currentTurn: state.currentTurn,
    result: state.result,
    winner: state.winner,
    status: state.status,
    availableCells: state.board
      .map(function (value, index) {
        return value === "" ? index : null;
      })
      .filter(function (value) {
        return value !== null;
      }),
  };
}

function syncRoom(api, state) {
  state.locale = readCurrentLocale(api);
  state.status = resolveStatusText(state, state.locale);

  api.notifyRoom("game-state", {
    state: serializeState(state),
  });
  api.notifyRoom("status", {
    locale: state.locale,
    message: state.status,
  });
}

function readArgs(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return payload.roomArgs && typeof payload.roomArgs === "object" && !Array.isArray(payload.roomArgs)
    ? payload.roomArgs
    : {};
}

function readCell(payload) {
  const roomArgs = payload && payload.roomArgs;
  if (typeof roomArgs === "number" && Number.isInteger(roomArgs)) {
    return roomArgs;
  }

  if (typeof roomArgs === "string" && roomArgs.trim() !== "") {
    const parsed = Number.parseInt(roomArgs, 10);
    return Number.isInteger(parsed) ? parsed : null;
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

function buildBoardText(board) {
  const rows = [];

  for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
    const row = [];
    for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
      const index = rowIndex * 3 + columnIndex;
      row.push(board[index] === "" ? String(index) : board[index]);
    }
    rows.push(row.join(" | "));
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

function resolveOutcome(board) {
  for (let index = 0; index < WIN_LINES.length; index += 1) {
    const line = WIN_LINES[index];
    const a = board[line[0]];
    const b = board[line[1]];
    const c = board[line[2]];
    if (a !== "" && a === b && b === c) {
      return {
        finished: true,
        winner: a,
        result: a === "X" ? "user-win" : "ai-win",
        statusKey: a === "X" ? "userWin" : "aiWin",
      };
    }
  }

  if (board.every(function (value) { return value !== ""; })) {
    return {
      finished: true,
      winner: "",
      result: "draw",
      statusKey: "draw",
    };
  }

  return {
    finished: false,
    winner: "",
    result: "pending",
    statusKey: "",
  };
}

async function requestAIMove(api, state) {
  const boardText = buildBoardText(state.board);
  const openCells = getAvailableCells(state.board);
  const result = await api.sendMessage({
    provider: state.target,
    page: "room:xox",
    text: [
      "XOX game update.",
      "You are O.",
      'Reply with exactly one line in this format: ++cmd:XOXAIMove({"cell":N})',
      "",
      "Board:",
      boardText,
      "",
      "Available cells: " + openCells.join(", "),
      "Choose one valid cell and do not add anything else.",
    ].join("\n"),
  });

  if (result && result.success === true) {
    return result;
  }

  state.awaitingAI = false;
  setStatusKey(state, readCurrentLocale(api), "aiRequestFailed");
  syncRoom(api, saveState(api, state));
  return result;
}

async function handleStartGame(api, payload) {
  const args = readArgs(payload);
  const locale = readCurrentLocale(api);
  const target = sanitizeTarget(args.target);
  const state = createIdleState(target, locale);
  state.active = true;
  state.result = "pending";
  setStatusKey(state, locale, "gameStarted");

  saveState(api, state);
  syncRoom(api, state);

  await api.sendProtocol({
    room: "xox",
    scenario: "start",
    targets: [target],
    context: {
      board: state.board.slice(),
      target,
      symbol: "O",
    },
  });

  return {
    success: true,
    message: translate(locale, COMMAND_COPY, "gameStarted"),
  };
}

async function handleUserMove(api, payload) {
  const locale = readCurrentLocale(api);
  const state = loadState(api);
  const cell = readCell(payload);

  if (state.active !== true) {
    return { success: false, message: translate(locale, COMMAND_COPY, "inactiveGame") };
  }
  if (state.awaitingAI === true || state.currentTurn !== "X") {
    return { success: false, message: translate(locale, COMMAND_COPY, "waitingForAITurn") };
  }
  if (cell === null || cell < 0 || cell > 8) {
    return { success: false, message: translate(locale, COMMAND_COPY, "invalidCell") };
  }
  if (state.board[cell] !== "") {
    return { success: false, message: translate(locale, COMMAND_COPY, "cellFilled") };
  }

  state.board[cell] = "X";
  const outcome = resolveOutcome(state.board);

  if (outcome.finished === true) {
    state.active = false;
    state.awaitingAI = false;
    state.currentTurn = "X";
    state.result = outcome.result;
    state.winner = outcome.winner;
    setStatusKey(state, locale, outcome.statusKey);
    syncRoom(api, saveState(api, state));
    return {
      success: true,
      message: state.status,
    };
  }

  state.currentTurn = "O";
  state.awaitingAI = true;
  state.result = "pending";
  setStatusKey(state, locale, "waitingForAI");
  syncRoom(api, saveState(api, state));
  await requestAIMove(api, state);

  return {
    success: true,
    message: translate(locale, COMMAND_COPY, "moveSent"),
  };
}

async function handleAIMove(api, payload) {
  const locale = readCurrentLocale(api);
  const state = loadState(api);
  const cell = readCell(payload);
  const provider = typeof payload.provider === "string" ? payload.provider : "";

  if (state.active !== true) {
    return { success: false, message: translate(locale, COMMAND_COPY, "noActiveGame") };
  }
  if (state.awaitingAI !== true || state.currentTurn !== "O") {
    return { success: false, message: translate(locale, COMMAND_COPY, "notAITurn") };
  }
  if (provider !== "" && provider !== state.target) {
    return { success: false, message: translate(locale, COMMAND_COPY, "providerMismatch") };
  }
  if (cell === null || cell < 0 || cell > 8) {
    return { success: false, message: translate(locale, COMMAND_COPY, "aiInvalidCell") };
  }
  if (state.board[cell] !== "") {
    return { success: false, message: translate(locale, COMMAND_COPY, "aiFilledCell") };
  }

  state.board[cell] = "O";
  state.awaitingAI = false;
  const outcome = resolveOutcome(state.board);

  if (outcome.finished === true) {
    state.active = false;
    state.currentTurn = "X";
    state.result = outcome.result;
    state.winner = outcome.winner;
    setStatusKey(state, locale, outcome.statusKey);
  } else {
    state.currentTurn = "X";
    state.result = "pending";
    setStatusKey(state, locale, "aiMoved");
  }

  syncRoom(api, saveState(api, state));
  return {
    success: true,
    message: state.status,
  };
}

async function handleResetGame(api, payload) {
  const args = readArgs(payload);
  const locale = readCurrentLocale(api);
  const state = createIdleState(args.target, locale);
  saveState(api, state);
  syncRoom(api, state);
  return {
    success: true,
    message: translate(locale, COMMAND_COPY, "gameReset"),
  };
}

async function handleSyncState(api) {
  const state = saveState(api, loadState(api));
  syncRoom(api, state);
  return {
    success: true,
    message: translate(readCurrentLocale(api), COMMAND_COPY, "stateSynced"),
  };
}

async function handleShowResult(api, payload) {
  const locale = readCurrentLocale(api);
  const state = loadState(api);
  const args = readArgs(payload);

  if (typeof args.status === "string" && args.status.trim() !== "") {
    setCustomStatus(state, locale, args.status);
  }
  if (typeof args.result === "string" && args.result.trim() !== "") {
    state.result = args.result;
  }
  if (args.winner === "X" || args.winner === "O") {
    state.winner = args.winner;
  }
  if (typeof args.active === "boolean") {
    state.active = args.active;
  }
  if (typeof args.awaitingAI === "boolean") {
    state.awaitingAI = args.awaitingAI;
  }

  syncRoom(api, saveState(api, state));
  return {
    success: true,
    message: state.status,
  };
}

function syncLocalizedState(api, locale) {
  api.setState("locale", normalizeLocale(locale));
  const state = saveState(api, loadState(api));
  syncRoom(api, state);
}

module.exports = function activate(api) {
  api.log("info", "XOX room host activated.");
  api.setState("locale", readCurrentLocale(api));

  return {
    protocols: {
      "xox-start": START_PROTOCOL,
    },
    commands: {
      XOXStartGame: function (payload) {
        return handleStartGame(api, payload || {});
      },
      XOXUserMove: function (payload) {
        return handleUserMove(api, payload || {});
      },
      XOXAIMove: function (payload) {
        return handleAIMove(api, payload || {});
      },
      XOXResetGame: function (payload) {
        return handleResetGame(api, payload || {});
      },
      XOXSyncState: function () {
        return handleSyncState(api);
      },
      XOXShowResult: function (payload) {
        return handleShowResult(api, payload || {});
      },
    },
    onRoomReady: function () {
      syncLocalizedState(api, readCurrentLocale(api));
    },
    onRoomEvent: function (payload) {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return;
      }

      if (payload.type === "host-context") {
        syncLocalizedState(api, payload.locale);
      }
    },
    dispose: function () {
      api.log("info", "XOX room host disposed.");
    },
  };
};
