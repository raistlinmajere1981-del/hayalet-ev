const TEAM_TETRIS_BOARD_WIDTH = 10;
const TEAM_TETRIS_BOARD_HEIGHT = 20;
const TEAM_TETRIS_SCHEMA_VERSION = 1;
const TEAM_TETRIS_PIECE_IDS = ["I", "O", "T", "S", "Z", "J", "L"];
const TEAM_TETRIS_SEAT_IDS = ["user", "ai1", "ai2", "us1"];
const TEAM_TETRIS_ROTATIONS = [0, 1, 2, 3];
const TEAM_TETRIS_TURN_LOOP = [
  "team-a-opener",
  "team-b-opener",
  "team-a-followup",
  "team-b-followup",
];

const TEAM_TETRIS_MOVE_SCHEMA = {
  schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
  rotationEnum: TEAM_TETRIS_ROTATIONS.slice(),
  pieceIds: TEAM_TETRIS_PIECE_IDS.slice(),
  pathEncoding: "rowShifts",
  rowShiftRange: [-1, 0, 1],
  rowOrder: "top-to-bottom",
  origin: "top-left",
  seatIdTrust: "derived-by-host",
};

const TEAM_TETRIS_PIECES = {
  I: {
    rotations: [
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
    ],
  },
  O: {
    rotations: [
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
    ],
  },
  T: {
    rotations: [
      [
        [1, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [0, 2],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [1, 1],
      ],
      [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
    ],
  },
  S: {
    rotations: [
      [
        [1, 0],
        [2, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
    ],
  },
  Z: {
    rotations: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
      [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
      ],
    ],
  },
  J: {
    rotations: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [0, 2],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
      ],
      [
        [1, 0],
        [1, 1],
        [0, 2],
        [1, 2],
      ],
    ],
  },
  L: {
    rotations: [
      [
        [2, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
    ],
  },
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hashString(value) {
  let hash = 2166136261;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createDeterministicRng(seed) {
  let state = hashString(seed) || 1;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let candidate = state;
    candidate = Math.imul(candidate ^ (candidate >>> 15), candidate | 1);
    candidate ^= candidate + Math.imul(candidate ^ (candidate >>> 7), candidate | 61);
    return ((candidate ^ (candidate >>> 14)) >>> 0) / 4294967296;
  };
}

function createEmptyTeamTetrisBoard() {
  return Array.from({ length: TEAM_TETRIS_BOARD_HEIGHT }, function () {
    return Array.from({ length: TEAM_TETRIS_BOARD_WIDTH }, function () {
      return "";
    });
  });
}

function cloneTeamTetrisBoard(board) {
  return Array.isArray(board)
    ? board.map(function (row) {
        return Array.isArray(row)
          ? row.slice()
          : Array.from({ length: TEAM_TETRIS_BOARD_WIDTH }, function () {
              return "";
            });
      })
    : createEmptyTeamTetrisBoard();
}

function cloneTeamTetrisPieceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  return {
    pieceId: normalizeText(snapshot.pieceId),
    rotation:
      typeof snapshot.rotation === "number" && Number.isInteger(snapshot.rotation)
        ? snapshot.rotation
        : 0,
    turnIndex:
      typeof snapshot.turnIndex === "number" && Number.isInteger(snapshot.turnIndex)
        ? snapshot.turnIndex
        : 0,
    placedBySeatId: normalizeText(snapshot.placedBySeatId),
    cells: Array.isArray(snapshot.cells)
      ? snapshot.cells
          .filter(function (cell) {
            return (
              cell &&
              typeof cell === "object" &&
              Array.isArray(cell) === false &&
              typeof cell.x === "number" &&
              typeof cell.y === "number"
            );
          })
          .map(function (cell) {
            return { x: cell.x, y: cell.y };
          })
      : [],
  };
}

function cloneTeamTetrisBagState(bagState) {
  const source =
    bagState && typeof bagState === "object" && Array.isArray(bagState) === false ? bagState : {};
  return {
    rngCursor:
      typeof source.rngCursor === "number" && Number.isInteger(source.rngCursor)
        ? source.rngCursor
        : 0,
    bag: Array.isArray(source.bag)
      ? source.bag.filter(function (pieceId) {
          return TEAM_TETRIS_PIECE_IDS.indexOf(pieceId) !== -1;
        })
      : [],
    index: typeof source.index === "number" && Number.isInteger(source.index) ? source.index : 0,
    seed: normalizeText(source.seed),
  };
}

function cloneTeamTetrisTeamState(team) {
  const source = team && typeof team === "object" && Array.isArray(team) === false ? team : {};
  return {
    id: normalizeText(source.id),
    seatIds: Array.isArray(source.seatIds) ? source.seatIds.slice() : [],
    openerSeatId: normalizeText(source.openerSeatId),
    followupSeatId: normalizeText(source.followupSeatId),
    board: cloneTeamTetrisBoard(source.board),
    alive: source.alive !== false,
    bagState: cloneTeamTetrisBagState(source.bagState),
    nextPieceId: normalizeText(source.nextPieceId),
    boardBeforeLastLock: cloneTeamTetrisBoard(source.boardBeforeLastLock),
    lastLockedPiece: cloneTeamTetrisPieceSnapshot(source.lastLockedPiece),
    topOutTurnIndex:
      typeof source.topOutTurnIndex === "number" && Number.isInteger(source.topOutTurnIndex)
        ? source.topOutTurnIndex
        : null,
  };
}

function cloneTeamTetrisTurn(turn) {
  if (!turn || typeof turn !== "object" || Array.isArray(turn)) {
    return null;
  }
  return {
    turnIndex:
      typeof turn.turnIndex === "number" && Number.isInteger(turn.turnIndex) ? turn.turnIndex : 0,
    seatId: normalizeText(turn.seatId),
    teamId: normalizeText(turn.teamId),
    role: normalizeText(turn.role),
    pieceId: normalizeText(turn.pieceId),
    turnToken: normalizeText(turn.turnToken),
    legalRotations: Array.isArray(turn.legalRotations)
      ? turn.legalRotations.filter(function (value) {
          return typeof value === "number" && Number.isInteger(value);
        })
      : [],
  };
}

function cloneTeamTetrisSeatMap(seatMap) {
  const next = {};
  if (!seatMap || typeof seatMap !== "object" || Array.isArray(seatMap)) {
    return next;
  }
  TEAM_TETRIS_SEAT_IDS.forEach(function (seatId) {
    const entry = seatMap[seatId];
    if (entry && typeof entry === "object" && Array.isArray(entry) === false) {
      next[seatId] = {
        teamId: normalizeText(entry.teamId),
        role: normalizeText(entry.role),
      };
    }
  });
  return next;
}

function cloneTeamTetrisMatch(match) {
  if (!match || typeof match !== "object" || Array.isArray(match)) {
    return null;
  }
  return {
    schemaVersion:
      typeof match.schemaVersion === "number" && Number.isInteger(match.schemaVersion)
        ? match.schemaVersion
        : TEAM_TETRIS_SCHEMA_VERSION,
    matchId: normalizeText(match.matchId),
    seed: normalizeText(match.seed),
    hiddenPairs: match.hiddenPairs !== false,
    revealPairsOnFinish: match.revealPairsOnFinish !== false,
    revealedPairs: match.revealedPairs === true,
    result: normalizeText(match.result) || "pending",
    winnerTeamId: normalizeText(match.winnerTeamId) || null,
    turnIndex:
      typeof match.turnIndex === "number" && Number.isInteger(match.turnIndex)
        ? match.turnIndex
        : 0,
    turnLoop: Array.isArray(match.turnLoop)
      ? match.turnLoop.slice()
      : TEAM_TETRIS_TURN_LOOP.slice(),
    seatMap: cloneTeamTetrisSeatMap(match.seatMap),
    teams: {
      "team-a": cloneTeamTetrisTeamState(match.teams && match.teams["team-a"]),
      "team-b": cloneTeamTetrisTeamState(match.teams && match.teams["team-b"]),
    },
    currentTurn: cloneTeamTetrisTurn(match.currentTurn),
  };
}

function teamTetrisBoardToRows(board) {
  return cloneTeamTetrisBoard(board).map(function (row) {
    return row
      .map(function (cell) {
        return cell === "" ? "." : String(cell).charAt(0);
      })
      .join("");
  });
}

function getPieceRotations(pieceId) {
  const piece = TEAM_TETRIS_PIECES[pieceId];
  return piece ? piece.rotations : [];
}

function getTeamTetrisLegalRotations(pieceId) {
  return getPieceRotations(pieceId).map(function (_entry, index) {
    return index;
  });
}

function getNormalizedTeamTetrisRotation(pieceId, rotation) {
  const legalRotations = getTeamTetrisLegalRotations(pieceId);
  return legalRotations.indexOf(rotation) !== -1 ? rotation : null;
}

function getTeamTetrisPieceCells(pieceId, rotation, originX, originY) {
  const normalizedRotation = getNormalizedTeamTetrisRotation(pieceId, rotation);
  const shapes = getPieceRotations(pieceId);
  if (normalizedRotation === null || shapes.length === 0) {
    return [];
  }
  return shapes[normalizedRotation].map(function (cell) {
    return {
      x: originX + cell[0],
      y: originY + cell[1],
    };
  });
}

function getTeamTetrisPieceBounds(pieceId, rotation) {
  const cells = getTeamTetrisPieceCells(pieceId, rotation, 0, 0);
  const xs = cells.map(function (cell) {
    return cell.x;
  });
  const ys = cells.map(function (cell) {
    return cell.y;
  });
  return {
    width: xs.length > 0 ? Math.max.apply(null, xs) + 1 : 0,
    height: ys.length > 0 ? Math.max.apply(null, ys) + 1 : 0,
  };
}

function getTeamTetrisSpawnPosition(pieceId, rotation) {
  const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
  return {
    x: Math.max(0, Math.floor((TEAM_TETRIS_BOARD_WIDTH - bounds.width) / 2)),
    y: 0,
  };
}

function isTeamTetrisCellBlocked(board, x, y) {
  if (x < 0 || x >= TEAM_TETRIS_BOARD_WIDTH || y < 0 || y >= TEAM_TETRIS_BOARD_HEIGHT) {
    return true;
  }
  return cloneTeamTetrisBoard(board)[y][x] !== "";
}

function doesTeamTetrisPieceCollide(board, pieceId, rotation, x, y) {
  const cells = getTeamTetrisPieceCells(pieceId, rotation, x, y);
  if (cells.length === 0) {
    return true;
  }
  return cells.some(function (cell) {
    return isTeamTetrisCellBlocked(board, cell.x, cell.y);
  });
}

function buildTeamTetrisBoardHash(board) {
  return teamTetrisBoardToRows(board).join("|");
}

function buildTeamTetrisTurnToken(matchId, turnIndex, seatId, teamId, pieceId, board) {
  const hash = hashString(
    [matchId, turnIndex, seatId, teamId, pieceId, buildTeamTetrisBoardHash(board)].join("|")
  );
  return `tt_${hash.toString(16)}`;
}

function shuffleTeamTetrisBag(seed, cursor) {
  const rng = createDeterministicRng([seed, cursor].join("|"));
  const bag = TEAM_TETRIS_PIECE_IDS.slice();
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = bag[index];
    bag[index] = bag[swapIndex];
    bag[swapIndex] = current;
  }
  return bag;
}

function drawTeamTetrisPiece(bagState) {
  if (!bagState || typeof bagState !== "object") {
    return TEAM_TETRIS_PIECE_IDS[0];
  }
  if (!Array.isArray(bagState.bag) || bagState.index >= bagState.bag.length) {
    bagState.bag = shuffleTeamTetrisBag(bagState.seed || "team-tetris", bagState.rngCursor || 0);
    bagState.index = 0;
    bagState.rngCursor = (bagState.rngCursor || 0) + 1;
  }
  const pieceId = bagState.bag[bagState.index];
  bagState.index += 1;
  return TEAM_TETRIS_PIECE_IDS.indexOf(pieceId) !== -1 ? pieceId : TEAM_TETRIS_PIECE_IDS[0];
}

function buildTeamTetrisSeatMap(teamASeats, teamBSeats) {
  return {
    [teamASeats[0]]: { teamId: "team-a", role: "opener" },
    [teamASeats[1]]: { teamId: "team-a", role: "followup" },
    [teamBSeats[0]]: { teamId: "team-b", role: "opener" },
    [teamBSeats[1]]: { teamId: "team-b", role: "followup" },
  };
}

function buildTeamTetrisTeamState(teamId, seatIds, seed) {
  const bagState = cloneTeamTetrisBagState({
    seed: `${seed}|${teamId}`,
    rngCursor: 0,
    bag: [],
    index: 0,
  });
  return {
    id: teamId,
    seatIds: seatIds.slice(0, 2),
    openerSeatId: seatIds[0],
    followupSeatId: seatIds[1],
    board: createEmptyTeamTetrisBoard(),
    alive: true,
    bagState,
    nextPieceId: drawTeamTetrisPiece(bagState),
    boardBeforeLastLock: createEmptyTeamTetrisBoard(),
    lastLockedPiece: null,
    topOutTurnIndex: null,
  };
}

function buildTeamTetrisTurn(match, turnIndex) {
  const seatId = match.turnLoop[turnIndex % match.turnLoop.length];
  const seatInfo = match.seatMap[seatId];
  const team = seatInfo ? match.teams[seatInfo.teamId] : null;
  const pieceId = team ? team.nextPieceId : "";
  return {
    turnIndex,
    seatId,
    teamId: seatInfo ? seatInfo.teamId : "",
    role: seatInfo ? seatInfo.role : "",
    pieceId,
    legalRotations: getTeamTetrisLegalRotations(pieceId),
    turnToken: team
      ? buildTeamTetrisTurnToken(match.matchId, turnIndex, seatId, seatInfo.teamId, pieceId, team.board)
      : "",
  };
}

function createTeamTetrisMatch(options) {
  const seed = normalizeText(options && options.seed) || `seed_${Date.now().toString(36)}`;
  const rng = createDeterministicRng(`${seed}|teams`);
  const shuffledSeats = TEAM_TETRIS_SEAT_IDS.slice();
  for (let index = shuffledSeats.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = shuffledSeats[index];
    shuffledSeats[index] = shuffledSeats[swapIndex];
    shuffledSeats[swapIndex] = current;
  }

  const teamASeats = shuffledSeats.slice(0, 2);
  const teamBSeats = shuffledSeats.slice(2, 4);
  const match = {
    schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
    matchId: normalizeText(options && options.matchId) || `tt_${hashString(seed).toString(36)}`,
    seed,
    hiddenPairs: !(options && options.hiddenPairs === false),
    revealPairsOnFinish: !(options && options.revealPairsOnFinish === false),
    revealedPairs: options && options.hiddenPairs === false,
    result: "pending",
    winnerTeamId: null,
    turnIndex: 0,
    turnLoop: [teamASeats[0], teamBSeats[0], teamASeats[1], teamBSeats[1]],
    seatMap: buildTeamTetrisSeatMap(teamASeats, teamBSeats),
    teams: {
      "team-a": buildTeamTetrisTeamState("team-a", teamASeats, seed),
      "team-b": buildTeamTetrisTeamState("team-b", teamBSeats, seed),
    },
    currentTurn: null,
  };
  match.currentTurn = buildTeamTetrisTurn(match, 0);
  return match;
}

function getTeamTetrisTeamIds() {
  return ["team-a", "team-b"];
}

function getOtherTeamId(teamId) {
  return teamId === "team-b" ? "team-a" : "team-b";
}

function getTeamTetrisSeatInfo(match, seatId) {
  return match && match.seatMap ? match.seatMap[seatId] || null : null;
}

function replayTeamTetrisPath(board, pieceId, rotation, rowShifts) {
  const normalizedRotation = getNormalizedTeamTetrisRotation(pieceId, rotation);
  if (normalizedRotation === null) {
    return { success: false, reason: "invalid-rotation" };
  }
  if (
    !Array.isArray(rowShifts) ||
    rowShifts.some(function (value) {
      return value !== -1 && value !== 0 && value !== 1;
    })
  ) {
    return { success: false, reason: "invalid-row-shifts" };
  }

  const spawn = getTeamTetrisSpawnPosition(pieceId, normalizedRotation);
  if (doesTeamTetrisPieceCollide(board, pieceId, normalizedRotation, spawn.x, spawn.y)) {
    return { success: false, reason: "spawn-collision" };
  }

  let x = spawn.x;
  let y = spawn.y;
  for (let index = 0; index < rowShifts.length; index += 1) {
    const shift = rowShifts[index];
    if (shift !== 0) {
      if (doesTeamTetrisPieceCollide(board, pieceId, normalizedRotation, x + shift, y)) {
        return { success: false, reason: "horizontal-collision", stepIndex: index };
      }
      x += shift;
    }
    if (doesTeamTetrisPieceCollide(board, pieceId, normalizedRotation, x, y + 1)) {
      return { success: false, reason: "downward-collision", stepIndex: index };
    }
    y += 1;
  }

  if (!doesTeamTetrisPieceCollide(board, pieceId, normalizedRotation, x, y + 1)) {
    return { success: false, reason: "incomplete-path" };
  }

  return {
    success: true,
    x,
    y,
    rotation: normalizedRotation,
    cells: getTeamTetrisPieceCells(pieceId, normalizedRotation, x, y),
  };
}

function clearTeamTetrisLines(board) {
  const rows = cloneTeamTetrisBoard(board);
  const keptRows = rows.filter(function (row) {
    return row.some(function (cell) {
      return cell === "";
    });
  });
  const clearedLines = TEAM_TETRIS_BOARD_HEIGHT - keptRows.length;
  while (keptRows.length < TEAM_TETRIS_BOARD_HEIGHT) {
    keptRows.unshift(
      Array.from({ length: TEAM_TETRIS_BOARD_WIDTH }, function () {
        return "";
      })
    );
  }
  return {
    board: keptRows,
    clearedLines,
  };
}

function validateTeamTetrisMove(match, move) {
  const source = move && typeof move === "object" && Array.isArray(move) === false ? move : {};
  if (!match || match.result !== "pending" || !match.currentTurn) {
    return { success: false, reason: "match-not-active" };
  }
  const currentTurn = match.currentTurn;
  if (normalizeText(source.matchId) !== match.matchId) {
    return { success: false, reason: "match-id-mismatch" };
  }
  if (source.schemaVersion !== TEAM_TETRIS_SCHEMA_VERSION) {
    return { success: false, reason: "schema-version-mismatch" };
  }
  if (source.turnIndex !== currentTurn.turnIndex) {
    return { success: false, reason: "turn-index-mismatch" };
  }
  if (normalizeText(source.turnToken) !== currentTurn.turnToken) {
    return { success: false, reason: "turn-token-mismatch" };
  }
  if (normalizeText(source.pieceId) !== currentTurn.pieceId) {
    return { success: false, reason: "piece-mismatch" };
  }
  const team = match.teams[currentTurn.teamId];
  if (!team || team.alive !== true) {
    return { success: false, reason: "team-not-alive" };
  }
  const replay = replayTeamTetrisPath(team.board, currentTurn.pieceId, source.rotation, source.rowShifts);
  if (replay.success !== true) {
    return replay;
  }
  return {
    success: true,
    turn: currentTurn,
    replay,
  };
}

function resolveTeamTetrisResult(match) {
  const teamAAlive = match.teams["team-a"].alive === true;
  const teamBAlive = match.teams["team-b"].alive === true;
  if (!teamAAlive && !teamBAlive) {
    match.result = "draw";
    match.winnerTeamId = null;
    return;
  }
  if (!teamAAlive) {
    match.result = "team-b-win";
    match.winnerTeamId = "team-b";
    return;
  }
  if (!teamBAlive) {
    match.result = "team-a-win";
    match.winnerTeamId = "team-a";
    return;
  }
  match.result = "pending";
  match.winnerTeamId = null;
}

function applyTeamTetrisMove(match, move) {
  const validation = validateTeamTetrisMove(match, move);
  if (validation.success !== true) {
    return validation;
  }

  const nextMatch = cloneTeamTetrisMatch(match);
  const currentTurn = nextMatch.currentTurn;
  const team = nextMatch.teams[currentTurn.teamId];
  const boardBefore = cloneTeamTetrisBoard(team.board);
  validation.replay.cells.forEach(function (cell) {
    team.board[cell.y][cell.x] = currentTurn.pieceId;
  });
  const clearResult = clearTeamTetrisLines(team.board);
  team.board = clearResult.board;
  team.boardBeforeLastLock = boardBefore;
  team.lastLockedPiece = {
    pieceId: currentTurn.pieceId,
    rotation: validation.replay.rotation,
    turnIndex: currentTurn.turnIndex,
    placedBySeatId: currentTurn.seatId,
    cells: validation.replay.cells,
  };
  team.nextPieceId = drawTeamTetrisPiece(team.bagState);
  const spawn = getTeamTetrisSpawnPosition(
    team.nextPieceId,
    getTeamTetrisLegalRotations(team.nextPieceId)[0] || 0
  );
  if (doesTeamTetrisPieceCollide(team.board, team.nextPieceId, 0, spawn.x, spawn.y)) {
    team.alive = false;
    team.topOutTurnIndex = currentTurn.turnIndex;
  }

  resolveTeamTetrisResult(nextMatch);
  if (nextMatch.result === "pending") {
    nextMatch.turnIndex = currentTurn.turnIndex + 1;
    nextMatch.currentTurn = buildTeamTetrisTurn(nextMatch, nextMatch.turnIndex);
  } else {
    nextMatch.currentTurn = null;
    if (nextMatch.hiddenPairs === true && nextMatch.revealPairsOnFinish === true) {
      nextMatch.revealedPairs = true;
    }
  }

  return {
    success: true,
    match: nextMatch,
    clearedLines: clearResult.clearedLines,
    lockedCells: validation.replay.cells,
  };
}

function buildTeamTetrisSeatView(match, seatId) {
  const source = cloneTeamTetrisMatch(match);
  const seatInfo = getTeamTetrisSeatInfo(source, seatId);
  if (!source || !seatInfo) {
    return null;
  }
  const ownTeam = source.teams[seatInfo.teamId];
  const opponentTeam = source.teams[getOtherTeamId(seatInfo.teamId)];
  const partnerSeatId =
    ownTeam.seatIds.find(function (candidate) {
      return candidate !== seatId;
    }) || null;
  const partnerInfo = partnerSeatId ? getTeamTetrisSeatInfo(source, partnerSeatId) : null;
  const identityVisible = source.hiddenPairs !== true || source.revealedPairs === true;
  const partnerSnapshot =
    ownTeam.lastLockedPiece && ownTeam.lastLockedPiece.placedBySeatId === partnerSeatId
      ? {
          pieceId: ownTeam.lastLockedPiece.pieceId,
          rotation: ownTeam.lastLockedPiece.rotation,
          cells: ownTeam.lastLockedPiece.cells.slice(),
          placedByRole: partnerInfo ? partnerInfo.role : "opener",
          ...(identityVisible === true && partnerSeatId ? { placedBySeatId: partnerSeatId } : {}),
        }
      : null;

  return {
    schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
    matchId: source.matchId,
    seat: {
      seatId,
      teamId: seatInfo.teamId,
      role: seatInfo.role,
    },
    hiddenPairs: source.hiddenPairs,
    revealedPairs: source.revealedPairs,
    result: source.result,
    winnerTeamId: source.winnerTeamId,
    teams:
      identityVisible === true
        ? getTeamTetrisTeamIds().map(function (teamId) {
            const team = source.teams[teamId];
            return {
              teamId,
              seatIds: team.seatIds.slice(),
            };
          })
        : null,
    ownTeam: {
      teamId: ownTeam.id,
      boardRows: teamTetrisBoardToRows(ownTeam.board),
      boardBeforePartnerPieceRows: partnerSnapshot
        ? teamTetrisBoardToRows(ownTeam.boardBeforeLastLock)
        : teamTetrisBoardToRows(ownTeam.board),
      partnerLastPiece: partnerSnapshot,
    },
    opponentTeam: {
      teamId: opponentTeam.id,
      boardRows: teamTetrisBoardToRows(opponentTeam.board),
    },
    pendingTurn:
      source.currentTurn && source.currentTurn.seatId === seatId
        ? {
            turnIndex: source.currentTurn.turnIndex,
            turnToken: source.currentTurn.turnToken,
            pieceId: source.currentTurn.pieceId,
            legalRotations: source.currentTurn.legalRotations.slice(),
            actingRole: source.currentTurn.role,
          }
        : null,
  };
}

const teamTetrisEngine = {
  schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
  moveSchema: TEAM_TETRIS_MOVE_SCHEMA,
  pieceIds: TEAM_TETRIS_PIECE_IDS.slice(),
  createMatch: createTeamTetrisMatch,
  cloneMatch: cloneTeamTetrisMatch,
  validateMove: validateTeamTetrisMove,
  applyMove: applyTeamTetrisMove,
  buildSeatView: buildTeamTetrisSeatView,
  boardToRows: teamTetrisBoardToRows,
  getLegalRotations: getTeamTetrisLegalRotations,
  replayPath: replayTeamTetrisPath,
  buildTurnToken: buildTeamTetrisTurnToken,
};

export {
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
  getOtherTeamId,
  getTeamTetrisLegalRotations,
  getTeamTetrisSeatInfo,
  getTeamTetrisSpawnPosition,
  getTeamTetrisTeamIds,
  replayTeamTetrisPath,
  teamTetrisBoardToRows,
  teamTetrisEngine,
  validateTeamTetrisMove,
};
