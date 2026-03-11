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

function createIdleState(target) {
  return {
    board: EMPTY_BOARD.slice(),
    target: sanitizeTarget(target),
    active: false,
    awaitingAI: false,
    currentTurn: "X",
    result: "idle",
    winner: "",
    status: "Baslat ile oyunu ac ve AI slotunu sec.",
  };
}

function loadState(api) {
  const candidate = api.getState("game");
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createIdleState("ai1");
  }

  return {
    board: normalizeBoard(candidate.board),
    target: sanitizeTarget(candidate.target),
    active: candidate.active === true,
    awaitingAI: candidate.awaitingAI === true,
    currentTurn: candidate.currentTurn === "O" ? "O" : "X",
    result: typeof candidate.result === "string" && candidate.result !== "" ? candidate.result : "idle",
    winner: candidate.winner === "O" || candidate.winner === "X" ? candidate.winner : "",
    status:
      typeof candidate.status === "string" && candidate.status.trim() !== ""
        ? candidate.status
        : "Baslat ile oyunu ac ve AI slotunu sec.",
  };
}

function saveState(api, state) {
  api.setState("game", state);
  return state;
}

function serializeState(state) {
  return {
    board: state.board.slice(),
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
  api.notifyRoom("game-state", {
    state: serializeState(state),
  });
  api.notifyRoom("status", {
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
        status: a === "X" ? "Kazandin. Tahta temiz bir sekilde bitti." : "AI kazandi. Yeni oyun baslatabilirsin.",
      };
    }
  }

  if (board.every(function (value) { return value !== ""; })) {
    return {
      finished: true,
      winner: "",
      result: "draw",
      status: "Berabere. Tum hucreler doldu.",
    };
  }

  return {
    finished: false,
    winner: "",
    result: "pending",
    status: "",
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
  state.status = "AI hamlesi istenemedi. Sifirla ile yeni oyun baslat.";
  syncRoom(api, saveState(api, state));
  return result;
}

async function handleStartGame(api, payload) {
  const args = readArgs(payload);
  const target = sanitizeTarget(args.target);
  const state = createIdleState(target);
  state.active = true;
  state.result = "pending";
  state.status = "Oyun basladi. Once sen oynuyorsun.";

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
    message: "XOX oyunu baslatildi.",
  };
}

async function handleUserMove(api, payload) {
  const state = loadState(api);
  const cell = readCell(payload);

  if (state.active !== true) {
    return { success: false, message: "Oyun aktif degil." };
  }
  if (state.awaitingAI === true || state.currentTurn !== "X") {
    return { success: false, message: "Su an AI hamlesi bekleniyor." };
  }
  if (cell === null || cell < 0 || cell > 8) {
    return { success: false, message: "Gecersiz hucre." };
  }
  if (state.board[cell] !== "") {
    return { success: false, message: "Bu hucre dolu." };
  }

  state.board[cell] = "X";
  const outcome = resolveOutcome(state.board);

  if (outcome.finished === true) {
    state.active = false;
    state.awaitingAI = false;
    state.currentTurn = "X";
    state.result = outcome.result;
    state.winner = outcome.winner;
    state.status = outcome.status;
    syncRoom(api, saveState(api, state));
    return {
      success: true,
      message: outcome.status,
    };
  }

  state.currentTurn = "O";
  state.awaitingAI = true;
  state.result = "pending";
  state.status = "Hamlen gonderildi. AI cevabi bekleniyor.";
  syncRoom(api, saveState(api, state));
  await requestAIMove(api, state);

  return {
    success: true,
    message: "Hamle gonderildi.",
  };
}

async function handleAIMove(api, payload) {
  const state = loadState(api);
  const cell = readCell(payload);
  const provider = typeof payload.provider === "string" ? payload.provider : "";

  if (state.active !== true) {
    return { success: false, message: "Aktif oyun yok." };
  }
  if (state.awaitingAI !== true || state.currentTurn !== "O") {
    return { success: false, message: "AI hamlesi sirasinda degil." };
  }
  if (provider !== "" && provider !== state.target) {
    return { success: false, message: "Hamle hedef slot ile eslesmiyor." };
  }
  if (cell === null || cell < 0 || cell > 8) {
    return { success: false, message: "AI gecersiz hucre gonderdi." };
  }
  if (state.board[cell] !== "") {
    return { success: false, message: "AI dolu hucre secmeye calisti." };
  }

  state.board[cell] = "O";
  state.awaitingAI = false;
  const outcome = resolveOutcome(state.board);

  if (outcome.finished === true) {
    state.active = false;
    state.currentTurn = "X";
    state.result = outcome.result;
    state.winner = outcome.winner;
    state.status = outcome.status;
  } else {
    state.currentTurn = "X";
    state.result = "pending";
    state.status = "AI hamlesini yapti. Siradaki hamle senin.";
  }

  syncRoom(api, saveState(api, state));
  return {
    success: true,
    message: state.status,
  };
}

async function handleResetGame(api, payload) {
  const args = readArgs(payload);
  const state = createIdleState(args.target);
  saveState(api, state);
  syncRoom(api, state);
  return {
    success: true,
    message: "Oyun sifirlandi.",
  };
}

async function handleSyncState(api) {
  const state = saveState(api, loadState(api));
  syncRoom(api, state);
  return {
    success: true,
    message: "Oda durumu senkronize edildi.",
  };
}

async function handleShowResult(api, payload) {
  const state = loadState(api);
  const args = readArgs(payload);

  if (typeof args.status === "string" && args.status.trim() !== "") {
    state.status = args.status;
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

module.exports = function activate(api) {
  api.log("info", "XOX room host activated.");

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
      const state = saveState(api, loadState(api));
      syncRoom(api, state);
    },
    dispose: function () {
      api.log("info", "XOX room host disposed.");
    },
  };
};
