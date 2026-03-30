import {
  TEAM_TETRIS_BOARD_HEIGHT,
  TEAM_TETRIS_BOARD_WIDTH,
  TEAM_TETRIS_PIECES,
} from "./engine-schema.js";

type TeamTetrisBoard = string[][];
export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type PieceCell = number[];

function createEmptyTeamTetrisBoard(): TeamTetrisBoard {
  return Array.from({ length: TEAM_TETRIS_BOARD_HEIGHT }, function () {
    return Array.from({ length: TEAM_TETRIS_BOARD_WIDTH }, function () {
      return "";
    });
  });
}

function cloneTeamTetrisBoard(board: TeamTetrisBoard): TeamTetrisBoard {
  return Array.isArray(board)
    ? board.map(function (row: string[]) {
        return Array.isArray(row)
          ? row.slice()
          : Array.from({ length: TEAM_TETRIS_BOARD_WIDTH }, function () {
              return "";
            });
      })
    : createEmptyTeamTetrisBoard();
}

function teamTetrisBoardToRows(board: TeamTetrisBoard): string[] {
  return cloneTeamTetrisBoard(board).map(function (row: string[]) {
    return row
      .map(function (cell: string) {
        return cell === "" ? "." : String(cell).charAt(0);
      })
      .join("");
  });
}

function getPieceRotations(pieceId: PieceId): PieceCell[][] {
  const piece = TEAM_TETRIS_PIECES[pieceId];
  return piece ? piece.rotations : [];
}

function getTeamTetrisLegalRotations(pieceId: PieceId): number[] {
  return getPieceRotations(pieceId).map(function (_entry: PieceCell[], index: number) {
    return index;
  });
}

function getNormalizedTeamTetrisRotation(pieceId: PieceId, rotation: number): number | null {
  const legalRotations = getTeamTetrisLegalRotations(pieceId);
  return legalRotations.indexOf(rotation) !== -1 ? rotation : null;
}

function getTeamTetrisPieceCells(
  pieceId: PieceId,
  rotation: number,
  originX: number,
  originY: number
): { x: number; y: number }[] {
  const normalizedRotation = getNormalizedTeamTetrisRotation(pieceId, rotation);
  const shapes = getPieceRotations(pieceId);
  if (normalizedRotation === null || shapes.length === 0) {
    return [];
  }
  const shape = shapes[normalizedRotation];
  if (!Array.isArray(shape)) {
    return [];
  }
  return shape.map(function (cell: PieceCell) {
    return {
      x: originX + (cell[0] ?? 0),
      y: originY + (cell[1] ?? 0),
    };
  });
}

function getTeamTetrisPieceBounds(
  pieceId: PieceId,
  rotation: number
): { width: number; height: number } {
  const cells = getTeamTetrisPieceCells(pieceId, rotation, 0, 0);
  const xs = cells.map(function (cell: { x: number; y: number }) {
    return cell.x;
  });
  const ys = cells.map(function (cell: { x: number; y: number }) {
    return cell.y;
  });
  return {
    width: xs.length > 0 ? Math.max.apply(null, xs) + 1 : 0,
    height: ys.length > 0 ? Math.max.apply(null, ys) + 1 : 0,
  };
}

function getTeamTetrisSpawnPosition(pieceId: PieceId, rotation: number): { x: number; y: number } {
  const bounds = getTeamTetrisPieceBounds(pieceId, rotation);
  return {
    x: Math.max(0, Math.floor((TEAM_TETRIS_BOARD_WIDTH - bounds.width) / 2)),
    y: 0,
  };
}

function isTeamTetrisCellBlocked(board: TeamTetrisBoard, x: number, y: number): boolean {
  if (x < 0 || x >= TEAM_TETRIS_BOARD_WIDTH || y < 0 || y >= TEAM_TETRIS_BOARD_HEIGHT) {
    return true;
  }
  const row = cloneTeamTetrisBoard(board)[y];
  return !row || row[x] !== "";
}

function doesTeamTetrisPieceCollide(
  board: TeamTetrisBoard,
  pieceId: PieceId,
  rotation: number,
  x: number,
  y: number
): boolean {
  const cells = getTeamTetrisPieceCells(pieceId, rotation, x, y);
  if (cells.length === 0) {
    return true;
  }
  return cells.some(function (cell: { x: number; y: number }) {
    return isTeamTetrisCellBlocked(board, cell.x, cell.y);
  });
}

function buildTeamTetrisBoardHash(board: TeamTetrisBoard): string {
  return teamTetrisBoardToRows(board).join("|");
}

function replayTeamTetrisPath(
  board: TeamTetrisBoard,
  pieceId: PieceId,
  rotation: number,
  rowShifts: number[]
):
  | { success: false; reason: string; stepIndex?: number }
  | { success: true; x: number; y: number; rotation: number; cells: { x: number; y: number }[] } {
  const normalizedRotation = getNormalizedTeamTetrisRotation(pieceId, rotation);
  if (normalizedRotation === null) {
    return { success: false, reason: "invalid-rotation" };
  }
  if (
    !Array.isArray(rowShifts) ||
    rowShifts.some(function (value: number) {
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
    cells: getTeamTetrisPieceCells(pieceId, normalizedRotation, x, y),
  };
}

function clearTeamTetrisLines(board: TeamTetrisBoard): {
  board: TeamTetrisBoard;
  clearedLines: number;
} {
  const rows = cloneTeamTetrisBoard(board);
  const keptRows = rows.filter(function (row: any) {
    return row.some(function (cell: any) {
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

export {
  buildTeamTetrisBoardHash,
  clearTeamTetrisLines,
  cloneTeamTetrisBoard,
  createEmptyTeamTetrisBoard,
  doesTeamTetrisPieceCollide,
  getTeamTetrisLegalRotations,
  getTeamTetrisSpawnPosition,
  replayTeamTetrisPath,
  teamTetrisBoardToRows,
};
