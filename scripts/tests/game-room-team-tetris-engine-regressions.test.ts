import test from "node:test";
import assert from "node:assert/strict";
import { loadGameRoomHostModule } from "./helpers/game-room-host-module.ts";

const gameRoomHostModule = await loadGameRoomHostModule();

function loadTeamTetrisEngine() {
  return gameRoomHostModule.teamTetrisEngine as {
    schemaVersion: number;
    moveSchema: Record<string, unknown>;
    createMatch: (options: Record<string, unknown>) => Record<string, unknown>;
    cloneMatch: (match: Record<string, unknown>) => Record<string, unknown>;
    validateMove: (
      match: Record<string, unknown>,
      move: Record<string, unknown>
    ) => Record<string, unknown>;
    applyMove: (
      match: Record<string, unknown>,
      move: Record<string, unknown>
    ) => Record<string, unknown>;
    buildTurnToken: (
      matchId: string,
      turnIndex: number,
      seatId: string,
      teamId: string,
      pieceId: string,
      board: string[][]
    ) => string;
  };
}

function makeZeroRowShifts(count: number): number[] {
  return Array.from({ length: count }, () => 0);
}

function buildValidMoveForCurrentTurn(
  engine: ReturnType<typeof loadTeamTetrisEngine>,
  match: Record<string, unknown>
) {
  const currentTurn = match.currentTurn as Record<string, unknown>;
  const legalRotations = Array.isArray(currentTurn.legalRotations)
    ? (currentTurn.legalRotations as number[])
    : [0];

  for (const rotation of legalRotations) {
    for (let steps = 0; steps <= 19; steps += 1) {
      const move = {
        schemaVersion: 1,
        matchId: match.matchId,
        turnIndex: currentTurn.turnIndex,
        turnToken: currentTurn.turnToken,
        pieceId: currentTurn.pieceId,
        rotation,
        rowShifts: Array.from({ length: steps }, () => 0),
      };
      if (engine.validateMove(match, move).success === true) {
        return move;
      }
    }
  }

  throw new Error("No valid Team Tetris move found for the current turn");
}

function primeMatchWithPiece(
  engine: ReturnType<typeof loadTeamTetrisEngine>,
  match: Record<string, unknown>,
  pieceId: string
): Record<string, unknown> {
  const nextMatch = engine.cloneMatch(match);
  const currentTurn = nextMatch.currentTurn as Record<string, unknown>;
  const teamId = String(currentTurn.teamId);
  const team = nextMatch.teams[teamId] as Record<string, unknown>;
  currentTurn.pieceId = pieceId;
  currentTurn.legalRotations = [0];
  team.nextPieceId = pieceId;
  currentTurn.turnToken = engine.buildTurnToken(
    String(nextMatch.matchId),
    Number(currentTurn.turnIndex),
    String(currentTurn.seatId),
    teamId,
    pieceId,
    team.board as string[][]
  );
  return nextMatch;
}

test("Team Tetris engine freezes the canonical move schema", () => {
  const engine = loadTeamTetrisEngine();

  assert.equal(engine.schemaVersion, 1);
  assert.equal(engine.moveSchema.pathEncoding, "rowShifts");
  assert.deepEqual(engine.moveSchema.rowShiftRange, [-1, 0, 1]);
  assert.equal(engine.moveSchema.seatIdTrust, "derived-by-host");
  assert.deepEqual(engine.moveSchema.rotationEnum, [0, 1, 2, 3]);
});

test("Team Tetris match seeding is deterministic for seats, turn order, and first pieces", () => {
  const engine = loadTeamTetrisEngine();

  const left = engine.createMatch({ seed: "alpha-seed", hiddenPairs: true });
  const right = engine.createMatch({ seed: "alpha-seed", hiddenPairs: true });

  assert.deepEqual(left.seatMap, right.seatMap);
  assert.deepEqual(left.turnLoop, right.turnLoop);
  assert.deepEqual(left.currentTurn, right.currentTurn);
  assert.equal(left.teams["team-a"].nextPieceId, right.teams["team-a"].nextPieceId);
  assert.equal(left.teams["team-b"].nextPieceId, right.teams["team-b"].nextPieceId);
});

test("Team Tetris manual partner selection keeps USER with the chosen partner", () => {
  const engine = loadTeamTetrisEngine();

  const match = engine.createMatch({
    seed: "manual-pair-seed",
    hiddenPairs: false,
    selectedPartnerSeatId: "us1",
  });
  const userTeam =
    (match.teams["team-a"].seatIds as string[]).includes("user") === true
      ? (match.teams["team-a"].seatIds as string[])
      : (match.teams["team-b"].seatIds as string[]);
  const otherTeam =
    userTeam === match.teams["team-a"].seatIds
      ? (match.teams["team-b"].seatIds as string[])
      : (match.teams["team-a"].seatIds as string[]);

  assert.deepEqual([...userTeam].sort(), ["us1", "user"]);
  assert.deepEqual([...otherTeam].sort(), ["ai1", "ai2"]);
  assert.equal(match.revealedPairs, true);
});

test("Team Tetris move replay locks pieces deterministically and clears filled lines", () => {
  const engine = loadTeamTetrisEngine();

  let match = engine.createMatch({ seed: "line-clear-seed", hiddenPairs: true });
  match = primeMatchWithPiece(engine, match, "O");

  const currentTurn = match.currentTurn as Record<string, unknown>;
  const team = match.teams[String(currentTurn.teamId)] as Record<string, unknown>;
  const board = team.board as string[][];
  [18, 19].forEach((rowIndex) => {
    for (let column = 0; column < 10; column += 1) {
      if (column !== 4 && column !== 5) {
        board[rowIndex][column] = "Z";
      }
    }
  });
  currentTurn.turnToken = engine.buildTurnToken(
    String(match.matchId),
    Number(currentTurn.turnIndex),
    String(currentTurn.seatId),
    String(currentTurn.teamId),
    "O",
    board
  );

  const result = engine.applyMove(match, {
    schemaVersion: 1,
    matchId: match.matchId,
    turnIndex: currentTurn.turnIndex,
    turnToken: currentTurn.turnToken,
    pieceId: "O",
    rotation: 0,
    rowShifts: makeZeroRowShifts(18),
  });

  assert.equal(result.success, true);
  assert.equal(result.clearedLines, 2);
  assert.equal(result.match.turnIndex, 1);
  assert.equal(result.match.result, "pending");
  assert.deepEqual((result.match.teams[String(currentTurn.teamId)].board as string[][]).slice(-2), [
    Array.from({ length: 10 }, () => ""),
    Array.from({ length: 10 }, () => ""),
  ]);
});

test("Team Tetris move validation accepts short intent paths, auto-drops, and still rejects stale turns", () => {
  const engine = loadTeamTetrisEngine();

  let match = engine.createMatch({ seed: "invalid-path-seed", hiddenPairs: true });
  match = primeMatchWithPiece(engine, match, "O");
  const currentTurn = match.currentTurn as Record<string, unknown>;

  const intentPath = engine.validateMove(match, {
    schemaVersion: 1,
    matchId: match.matchId,
    turnIndex: currentTurn.turnIndex,
    turnToken: currentTurn.turnToken,
    pieceId: "O",
    rotation: 0,
    rowShifts: [0],
  });
  const staleTurn = engine.validateMove(match, {
    schemaVersion: 1,
    matchId: match.matchId,
    turnIndex: currentTurn.turnIndex,
    turnToken: "tt_stale",
    pieceId: "O",
    rotation: 0,
    rowShifts: makeZeroRowShifts(18),
  });

  assert.equal(intentPath.success, true);
  if (intentPath.success === true) {
    assert.equal(intentPath.replay.pathComplete, true);
    assert.equal(intentPath.replay.autoDropDistance > 0, true);
  }
  assert.equal(staleTurn.success, false);
  assert.equal(staleTurn.reason, "turn-token-mismatch");
});

test("Team Tetris applies blocked intent paths by locking at the last reached step", () => {
  const engine = loadTeamTetrisEngine();

  let match = engine.createMatch({ seed: "blocked-intent-seed", hiddenPairs: true });
  match = primeMatchWithPiece(engine, match, "O");
  const currentTurn = match.currentTurn as Record<string, unknown>;
  const team = match.teams[String(currentTurn.teamId)] as Record<string, unknown>;
  const board = team.board as string[][];
  board[0][6] = "Z";
  currentTurn.turnToken = engine.buildTurnToken(
    String(match.matchId),
    Number(currentTurn.turnIndex),
    String(currentTurn.seatId),
    String(currentTurn.teamId),
    "O",
    board
  );

  const validation = engine.validateMove(match, {
    schemaVersion: 1,
    matchId: match.matchId,
    turnIndex: currentTurn.turnIndex,
    turnToken: currentTurn.turnToken,
    pieceId: "O",
    rotation: 0,
    rowShifts: [1],
  });

  assert.equal(validation.success, true);
  if (validation.success === true) {
    assert.equal(validation.replay.pathComplete, false);
    assert.equal(validation.replay.blockedReason, "horizontal-collision");
    assert.deepEqual(validation.replay.cells, [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]);
  }

  const result = engine.applyMove(match, {
    schemaVersion: 1,
    matchId: match.matchId,
    turnIndex: currentTurn.turnIndex,
    turnToken: currentTurn.turnToken,
    pieceId: "O",
    rotation: 0,
    rowShifts: [1],
  });

  assert.equal(result.success, true);
  if (result.success === true) {
    assert.deepEqual(result.lockedCells, [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]);
  }
});

test("Team Tetris top-out resolves the surviving team as the winner", () => {
  const engine = loadTeamTetrisEngine();

  let match = engine.createMatch({ seed: "topout-seed", hiddenPairs: true });
  match = primeMatchWithPiece(engine, match, "O");

  const currentTurn = match.currentTurn as Record<string, unknown>;
  const teamId = String(currentTurn.teamId);
  const team = match.teams[teamId] as Record<string, unknown>;
  const board = team.board as string[][];
  board[2][4] = "J";
  board[2][5] = "J";
  (team.bagState as Record<string, unknown>).bag = ["I"];
  (team.bagState as Record<string, unknown>).index = 0;
  currentTurn.turnToken = engine.buildTurnToken(
    String(match.matchId),
    Number(currentTurn.turnIndex),
    String(currentTurn.seatId),
    teamId,
    "O",
    board
  );

  const result = engine.applyMove(match, {
    schemaVersion: 1,
    matchId: match.matchId,
    turnIndex: currentTurn.turnIndex,
    turnToken: currentTurn.turnToken,
    pieceId: "O",
    rotation: 0,
    rowShifts: [],
  });

  assert.equal(result.success, true);
  assert.equal(result.match.result, teamId === "team-a" ? "team-b-win" : "team-a-win");
  assert.equal(result.match.currentTurn, null);
  assert.equal(result.match.teams[teamId].alive, false);
});

test("Team Tetris opener and followup share the same team piece before the bag advances", () => {
  const engine = loadTeamTetrisEngine();

  let match = engine.createMatch({ seed: "shared-team-piece-seed", hiddenPairs: true });
  match = primeMatchWithPiece(engine, match, "O");

  const openingTurn = match.currentTurn as Record<string, unknown>;
  const teamId = String(openingTurn.teamId);
  const openerResult = engine.applyMove(match, buildValidMoveForCurrentTurn(engine, match));

  assert.equal(openerResult.success, true);
  assert.equal(openerResult.match.teams[teamId].nextPieceId, "O");

  const afterOpponentOpening = engine.applyMove(
    openerResult.match,
    buildValidMoveForCurrentTurn(engine, openerResult.match)
  );
  assert.equal(afterOpponentOpening.success, true);
  assert.equal((afterOpponentOpening.match.currentTurn as Record<string, unknown>).teamId, teamId);
  assert.equal((afterOpponentOpening.match.currentTurn as Record<string, unknown>).pieceId, "O");

  const followupTeam = afterOpponentOpening.match.teams[teamId] as Record<string, unknown>;
  const followupBagState = followupTeam.bagState as Record<string, unknown>;
  followupBagState.bag = ["J"];
  followupBagState.index = 0;

  const followupResult = engine.applyMove(
    afterOpponentOpening.match,
    buildValidMoveForCurrentTurn(engine, afterOpponentOpening.match)
  );

  assert.equal(followupResult.success, true);
  assert.equal(followupResult.match.teams[teamId].nextPieceId, "J");
});
