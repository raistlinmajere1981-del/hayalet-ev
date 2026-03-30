import {
  TEAM_TETRIS_BOARD_HEIGHT,
  TEAM_TETRIS_BOARD_WIDTH,
  TEAM_TETRIS_MOVE_SCHEMA,
  TEAM_TETRIS_PIECE_IDS,
  TEAM_TETRIS_SCHEMA_VERSION,
  TEAM_TETRIS_SEAT_IDS,
  TEAM_TETRIS_TURN_LOOP,
  buildTeamTetrisBoardHash,
  buildTeamTetrisTurn,
  buildTeamTetrisTurnToken,
  clearTeamTetrisLines,
  cloneTeamTetrisBoard,
  cloneTeamTetrisMatch,
  createTeamTetrisMatch,
  doesTeamTetrisPieceCollide,
  drawTeamTetrisPiece,
  getOtherTeamId,
  getTeamTetrisLegalRotations,
  getTeamTetrisSeatInfo,
  getTeamTetrisSpawnPosition,
  getTeamTetrisTeamIds,
  replayTeamTetrisPath,
  teamTetrisBoardToRows,
} from "./engine-helpers.js";
import type { PieceId } from "./engine-board.js";

function normalizeText(value: any) {
  return typeof value === "string" ? value.trim() : "";
}

function validateTeamTetrisMove(match: any, move: any) {
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
  const replay = replayTeamTetrisPath(
    team.board,
    currentTurn.pieceId,
    source.rotation,
    source.rowShifts
  );
  if (replay.success !== true) {
    return replay;
  }
  return {
    success: true,
    turn: currentTurn,
    replay,
  };
}

function resolveTeamTetrisResult(match: any) {
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

function applyTeamTetrisMove(match: any, move: any) {
  const validation = validateTeamTetrisMove(match, move);
  if (!("replay" in validation)) {
    return validation;
  }

  const nextMatch = cloneTeamTetrisMatch(match);
  if (!nextMatch || !nextMatch.currentTurn) {
    return { success: false, reason: "match-not-active" };
  }
  const currentTurn = nextMatch.currentTurn;
  const team = nextMatch.teams[currentTurn.teamId as keyof typeof nextMatch.teams];
  const boardBefore = cloneTeamTetrisBoard(team.board);
  const replay = validation.replay;
  if (!replay) {
    return { success: false, reason: "invalid-move" };
  }
  replay.cells.forEach(function (cell: any) {
    const row = team.board[cell.y];
    if (row) {
      row[cell.x] = currentTurn.pieceId;
    }
  });
  const clearResult = clearTeamTetrisLines(team.board);
  team.board = clearResult.board;
  team.boardBeforeLastLock = boardBefore;
  team.lastLockedPiece = {
    pieceId: currentTurn.pieceId,
    rotation: replay.rotation,
    turnIndex: currentTurn.turnIndex,
    placedBySeatId: currentTurn.seatId,
    cells: replay.cells,
  };
  const drawnNext = drawTeamTetrisPiece(team.bagState) as PieceId;
  team.nextPieceId = drawnNext;
  const spawn = getTeamTetrisSpawnPosition(
    drawnNext,
    getTeamTetrisLegalRotations(drawnNext)[0] || 0
  );
  if (doesTeamTetrisPieceCollide(team.board, drawnNext, 0, spawn.x, spawn.y)) {
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
    lockedCells: replay.cells,
  };
}

function buildTeamTetrisSeatView(match: any, seatId: any) {
  const source = cloneTeamTetrisMatch(match);
  if (!source) {
    return null;
  }
  const seatInfo = getTeamTetrisSeatInfo(source, seatId);
  if (!seatInfo) {
    return null;
  }
  const ownTeam = source.teams[seatInfo.teamId as keyof typeof source.teams];
  const opponentTeam = source.teams[getOtherTeamId(seatInfo.teamId) as keyof typeof source.teams];
  const partnerSeatId =
    ownTeam.seatIds.find(function (candidate: any) {
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
        ? getTeamTetrisTeamIds().map(function (teamId: any) {
            const team = source.teams[teamId as keyof typeof source.teams];
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
