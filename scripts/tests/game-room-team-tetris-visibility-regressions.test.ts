import test from "node:test";
import assert from "node:assert/strict";
import { loadGameRoomHostModule } from "./helpers/game-room-host-module.ts";

function loadTeamTetrisEngine() {
  return gameRoomHostModule.teamTetrisEngine as {
    createMatch: (options: Record<string, unknown>) => Record<string, unknown>;
    cloneMatch: (match: Record<string, unknown>) => Record<string, unknown>;
    boardToRows: (board: string[][]) => string[];
    buildSeatView: (
      match: Record<string, unknown>,
      seatId: string
    ) => Record<string, unknown> | null;
    buildTurnToken: (
      matchId: string,
      turnIndex: number,
      seatId: string,
      teamId: string,
      pieceId: string,
      board: string[][]
    ) => string;
    applyMove: (
      match: Record<string, unknown>,
      move: Record<string, unknown>
    ) => Record<string, unknown>;
  };
}

const gameRoomHostModule = await loadGameRoomHostModule();

function preparePartnerHistory(
  engine: ReturnType<typeof loadTeamTetrisEngine>,
  hiddenPairs: boolean
) {
  const match = engine.createMatch({ seed: "visibility-seed", hiddenPairs });
  const currentTurn = match.currentTurn as Record<string, unknown>;
  const teamId = String(currentTurn.teamId);
  const team = match.teams[teamId] as Record<string, unknown>;
  currentTurn.pieceId = "O";
  currentTurn.legalRotations = [0];
  team.nextPieceId = "O";
  currentTurn.turnToken = engine.buildTurnToken(
    String(match.matchId),
    Number(currentTurn.turnIndex),
    String(currentTurn.seatId),
    teamId,
    "O",
    team.board as string[][]
  );

  const applied = engine.applyMove(match, {
    schemaVersion: 1,
    matchId: match.matchId,
    turnIndex: currentTurn.turnIndex,
    turnToken: currentTurn.turnToken,
    pieceId: "O",
    rotation: 0,
    rowShifts: Array.from({ length: 18 }, () => 0),
  });

  return {
    match: applied.match as Record<string, unknown>,
    placedBySeatId: String(currentTurn.seatId),
    teamId,
  };
}

test("Team Tetris hidden-pair seat views keep partner identity anonymous", () => {
  const engine = loadTeamTetrisEngine();
  const prepared = preparePartnerHistory(engine, true);
  const team = prepared.match.teams[prepared.teamId] as Record<string, unknown>;
  const partnerSeatId = (team.seatIds as string[]).find(
    (seatId) => seatId !== prepared.placedBySeatId
  )!;

  const partnerView = engine.buildSeatView(prepared.match, partnerSeatId);

  assert.equal(partnerView?.teams, null);
  assert.equal(partnerView?.ownTeam?.partnerLastPiece?.pieceId, "O");
  assert.equal(String(partnerView?.ownTeam?.partnerLastPiece?.placedBySeatId ?? ""), "");
  assert.match(
    String(partnerView?.ownTeam?.partnerLastPiece?.placedByRole ?? ""),
    /opener|followup/
  );
  assert.deepEqual(partnerView?.ownTeam?.partnerLastPiece?.cells ?? null, []);
  assert.equal(partnerView?.pendingTurn, null);
});

test("Team Tetris seat views hide only the partner's latest lock from the receiving teammate", () => {
  const engine = loadTeamTetrisEngine();
  const prepared = preparePartnerHistory(engine, true);
  const team = prepared.match.teams[prepared.teamId] as Record<string, unknown>;
  const partnerSeatId = (team.seatIds as string[]).find(
    (seatId) => seatId !== prepared.placedBySeatId
  )!;

  const actingView = engine.buildSeatView(prepared.match, prepared.placedBySeatId);
  const partnerView = engine.buildSeatView(prepared.match, partnerSeatId);
  const actualBoardRows = engine.boardToRows(team.board as string[][]);
  const boardBeforeLastLockRows = engine.boardToRows(team.boardBeforeLastLock as string[][]);

  assert.deepEqual(actingView?.ownTeam?.boardRows, actualBoardRows);
  assert.deepEqual(partnerView?.ownTeam?.boardRows, boardBeforeLastLockRows);
  assert.deepEqual(partnerView?.ownTeam?.boardBeforePartnerPieceRows, boardBeforeLastLockRows);
  assert.notDeepEqual(partnerView?.ownTeam?.boardRows, actualBoardRows);
  assert.equal(partnerView?.ownTeam?.partnerLastPiece?.pieceId, "O");
  assert.deepEqual(partnerView?.ownTeam?.partnerLastPiece?.cells ?? null, []);
});

test("Team Tetris revealed seat views expose concrete pairings and only the acting seat gets a pending turn", () => {
  const engine = loadTeamTetrisEngine();
  const prepared = preparePartnerHistory(engine, false);
  const actingSeatId = String((prepared.match.currentTurn as Record<string, unknown>).seatId);
  const otherSeatId =
    ["user", "ai1", "ai2", "us1"].find((seatId) => seatId !== actingSeatId) ?? "user";

  const actingView = engine.buildSeatView(prepared.match, actingSeatId);
  const nonActingView = engine.buildSeatView(prepared.match, otherSeatId);

  assert.ok(Array.isArray(actingView?.teams));
  assert.equal(actingView?.pendingTurn?.pieceId !== null, true);
  assert.equal(nonActingView?.pendingTurn, null);
});
