import {
  TEAM_TETRIS_BOARD_HEIGHT,
  TEAM_TETRIS_BOARD_WIDTH,
  TEAM_TETRIS_PIECES
} from "./engine-schema.js";
const TEAM_TETRIS_PIECE_MAP = TEAM_TETRIS_PIECES;
function createEmptyTeamTetrisBoard() {
  return Array.from({ length: TEAM_TETRIS_BOARD_HEIGHT }, function() {
    return Array.from({ length: TEAM_TETRIS_BOARD_WIDTH }, function() {
      return "";
    });
  });
}
function cloneTeamTetrisBoard(board) {
  if (Array.isArray(board) === false) {
    return createEmptyTeamTetrisBoard();
  }
  const rows = board;
  return Array.from({ length: TEAM_TETRIS_BOARD_HEIGHT }, function(_entry, rowIndex) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    return Array.from({ length: TEAM_TETRIS_BOARD_WIDTH }, function(_cell, columnIndex) {
      const value = row[columnIndex];
      return typeof value === "string" ? value : "";
    });
  });
}
function teamTetrisBoardToRows(board) {
  return cloneTeamTetrisBoard(board).map(function(row) {
    return row.map(function(cell) {
      return cell === "" ? "." : String(cell).charAt(0);
    }).join("");
  });
}
function getPieceRotations(pieceId) {
  return TEAM_TETRIS_PIECE_MAP[pieceId].rotations;
}
function getTeamTetrisLegalRotations(pieceId) {
  return getPieceRotations(pieceId).map(function(_entry, index) {
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
  const shape = shapes[normalizedRotation];
  if (!Array.isArray(shape)) {
    return [];
  }
  return shape.map(function(cell) {
    return {
      x: originX + cell[0],
      y: originY + cell[1]
    };
  });
}
function getTeamTetrisPieceBounds(pieceId, rotation) {
  const cells = getTeamTetrisPieceCells(pieceId, rotation, 0, 0);
  let maxX = -1;
  let maxY = -1;
  cells.forEach(function(cell) {
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
  });
  return {
    width: maxX + 1,
    height: maxY + 1
  };
}
function getTeamTetrisSpawnPosition(pieceId, rotation) {
  const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
  return {
    x: Math.max(0, Math.floor((TEAM_TETRIS_BOARD_WIDTH - bounds.width) / 2)),
    y: 0
  };
}
function isTeamTetrisCellBlocked(board, x, y) {
  if (x < 0 || x >= TEAM_TETRIS_BOARD_WIDTH || y < 0 || y >= TEAM_TETRIS_BOARD_HEIGHT) {
    return true;
  }
  const row = board[y];
  return !row || row[x] !== "";
}
function doesTeamTetrisPieceCollide(board, pieceId, rotation, x, y) {
  const cells = getTeamTetrisPieceCells(pieceId, rotation, x, y);
  if (cells.length === 0) {
    return true;
  }
  return cells.some(function(cell) {
    return isTeamTetrisCellBlocked(board, cell.x, cell.y);
  });
}
function buildTeamTetrisBoardHash(board) {
  return teamTetrisBoardToRows(board).join("|");
}
function replayTeamTetrisPath(board, pieceId, rotation, rowShifts) {
  const normalizedRotation = getNormalizedTeamTetrisRotation(pieceId, rotation);
  if (normalizedRotation === null) {
    return { success: false, reason: "invalid-rotation" };
  }
  if (Array.isArray(rowShifts) === false || rowShifts.some(function(value) {
    return value !== -1 && value !== 0 && value !== 1;
  })) {
    return { success: false, reason: "invalid-row-shifts" };
  }
  const spawn = getTeamTetrisSpawnPosition(pieceId, normalizedRotation);
  if (doesTeamTetrisPieceCollide(board, pieceId, normalizedRotation, spawn.x, spawn.y)) {
    return { success: false, reason: "spawn-collision" };
  }
  let x = spawn.x;
  let y = spawn.y;
  for (let index = 0; index < rowShifts.length; index += 1) {
    const shift = rowShifts[index] ?? 0;
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
    cells: getTeamTetrisPieceCells(pieceId, normalizedRotation, x, y)
  };
}
function clearTeamTetrisLines(board) {
  const rows = cloneTeamTetrisBoard(board);
  const keptRows = rows.filter(function(row) {
    return row.some(function(cell) {
      return cell === "";
    });
  });
  const clearedLines = TEAM_TETRIS_BOARD_HEIGHT - keptRows.length;
  while (keptRows.length < TEAM_TETRIS_BOARD_HEIGHT) {
    keptRows.unshift(
      Array.from({ length: TEAM_TETRIS_BOARD_WIDTH }, function() {
        return "";
      })
    );
  }
  return {
    board: keptRows,
    clearedLines
  };
}
export {
  buildTeamTetrisBoardHash,
  clearTeamTetrisLines,
  cloneTeamTetrisBoard,
  createEmptyTeamTetrisBoard,
  doesTeamTetrisPieceCollide,
  getTeamTetrisLegalRotations,
  getTeamTetrisSpawnPosition,
  replayTeamTetrisPath,
  teamTetrisBoardToRows
};
