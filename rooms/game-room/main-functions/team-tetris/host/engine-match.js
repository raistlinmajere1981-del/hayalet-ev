import {
  TEAM_TETRIS_PIECE_IDS,
  TEAM_TETRIS_SCHEMA_VERSION,
  TEAM_TETRIS_SEAT_IDS,
  TEAM_TETRIS_TURN_LOOP,
  createDeterministicRng,
  hashString,
  normalizeText,
} from "./engine-schema.js";
import {
  buildTeamTetrisBoardHash,
  cloneTeamTetrisBoard,
  createEmptyTeamTetrisBoard,
  getTeamTetrisLegalRotations,
} from "./engine-board.js";

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

export {
  buildTeamTetrisTurn,
  buildTeamTetrisTurnToken,
  cloneTeamTetrisMatch,
  createTeamTetrisMatch,
  drawTeamTetrisPiece,
  getOtherTeamId,
  getTeamTetrisSeatInfo,
  getTeamTetrisTeamIds,
};
