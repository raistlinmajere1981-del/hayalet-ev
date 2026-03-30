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

type TeamTetrisBoard = string[][];
type DefaultTeamTetrisSeatId = "user" | "ai1" | "ai2" | "us1";
const DEFAULT_TEAM_TETRIS_PIECE_ID = "I";

interface BagState {
  rngCursor: number;
  bag: string[];
  index: number;
  seed: string;
}

function cloneTeamTetrisPieceSnapshot(snapshot: any) {
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
          .filter(function (cell: any) {
            return (
              cell &&
              typeof cell === "object" &&
              Array.isArray(cell) === false &&
              typeof cell.x === "number" &&
              typeof cell.y === "number"
            );
          })
          .map(function (cell: any) {
            return { x: cell.x, y: cell.y };
          })
      : [],
  };
}

function cloneTeamTetrisBagState(bagState: any): BagState {
  const source =
    bagState && typeof bagState === "object" && Array.isArray(bagState) === false ? bagState : {};
  return {
    rngCursor:
      typeof source.rngCursor === "number" && Number.isInteger(source.rngCursor)
        ? source.rngCursor
        : 0,
    bag: Array.isArray(source.bag)
      ? source.bag.filter(function (pieceId: string) {
          return TEAM_TETRIS_PIECE_IDS.indexOf(pieceId) !== -1;
        })
      : [],
    index: typeof source.index === "number" && Number.isInteger(source.index) ? source.index : 0,
    seed: normalizeText(source.seed),
  };
}

function cloneTeamTetrisTeamState(team: any) {
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

function cloneTeamTetrisTurn(turn: any) {
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
      ? turn.legalRotations.filter(function (value: any) {
          return typeof value === "number" && Number.isInteger(value);
        })
      : [],
  };
}

function cloneTeamTetrisSeatMap(seatMap: any): Record<string, { teamId: string; role: string }> {
  const next: Record<string, { teamId: string; role: string }> = {};
  if (!seatMap || typeof seatMap !== "object" || Array.isArray(seatMap)) {
    return next;
  }
  TEAM_TETRIS_SEAT_IDS.forEach(function (seatId: string) {
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

function cloneTeamTetrisMatch(match: any) {
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

function getTeamTetrisSeatValue(
  seatIds: string[],
  index: number,
  fallback: DefaultTeamTetrisSeatId
): string {
  return normalizeText(seatIds[index]) || fallback;
}

function getTeamTetrisSeatPair(
  seatIds: string[],
  firstFallback: DefaultTeamTetrisSeatId,
  secondFallback: DefaultTeamTetrisSeatId
): [string, string] {
  return [
    getTeamTetrisSeatValue(seatIds, 0, firstFallback),
    getTeamTetrisSeatValue(seatIds, 1, secondFallback),
  ];
}

function buildTeamTetrisTurnToken(
  matchId: string,
  turnIndex: number,
  seatId: string,
  teamId: string,
  pieceId: string,
  board: TeamTetrisBoard
): string {
  const hash = hashString(
    [matchId, turnIndex, seatId, teamId, pieceId, buildTeamTetrisBoardHash(board)].join("|")
  );
  return `tt_${hash.toString(16)}`;
}

function shuffleTeamTetrisBag(seed: string, cursor: number): string[] {
  const rng = createDeterministicRng([seed, cursor].join("|"));
  const bag = TEAM_TETRIS_PIECE_IDS.slice();
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = bag[index];
    const swapValue = bag[swapIndex];
    if (current === undefined || swapValue === undefined) {
      continue;
    }
    bag[index] = swapValue;
    bag[swapIndex] = current;
  }
  return bag;
}

function drawTeamTetrisPiece(bagState: any): string {
  if (!bagState || typeof bagState !== "object") {
    return TEAM_TETRIS_PIECE_IDS[0] || DEFAULT_TEAM_TETRIS_PIECE_ID;
  }
  if (!Array.isArray(bagState.bag) || bagState.index >= bagState.bag.length) {
    bagState.bag = shuffleTeamTetrisBag(bagState.seed || "team-tetris", bagState.rngCursor || 0);
    bagState.index = 0;
    bagState.rngCursor = (bagState.rngCursor || 0) + 1;
  }
  const pieceId = bagState.bag[bagState.index];
  bagState.index += 1;
  return TEAM_TETRIS_PIECE_IDS.indexOf(pieceId) !== -1
    ? pieceId
    : TEAM_TETRIS_PIECE_IDS[0] || DEFAULT_TEAM_TETRIS_PIECE_ID;
}

function buildTeamTetrisSeatMap(
  teamASeats: string[],
  teamBSeats: string[]
): Record<string, { teamId: string; role: string }> {
  const [teamAOpener, teamAFollowup] = getTeamTetrisSeatPair(teamASeats, "user", "ai1");
  const [teamBOpener, teamBFollowup] = getTeamTetrisSeatPair(teamBSeats, "ai2", "us1");
  return {
    [teamAOpener]: { teamId: "team-a", role: "opener" },
    [teamAFollowup]: { teamId: "team-a", role: "followup" },
    [teamBOpener]: { teamId: "team-b", role: "opener" },
    [teamBFollowup]: { teamId: "team-b", role: "followup" },
  };
}

function buildTeamTetrisTeamState(teamId: string, seatIds: string[], seed: string) {
  const [openerSeatId, followupSeatId] = getTeamTetrisSeatPair(
    seatIds,
    teamId === "team-a" ? "user" : "ai2",
    teamId === "team-a" ? "ai1" : "us1"
  );
  const bagState = cloneTeamTetrisBagState({
    seed: `${seed}|${teamId}`,
    rngCursor: 0,
    bag: [],
    index: 0,
  });
  return {
    id: teamId,
    seatIds: [openerSeatId, followupSeatId],
    openerSeatId,
    followupSeatId,
    board: createEmptyTeamTetrisBoard(),
    alive: true,
    bagState,
    nextPieceId: drawTeamTetrisPiece(bagState),
    boardBeforeLastLock: createEmptyTeamTetrisBoard(),
    lastLockedPiece: null as any,
    topOutTurnIndex: null as number | null,
  };
}

function buildTeamTetrisTurn(match: any, turnIndex: number) {
  const turnLoop = Array.isArray(match.turnLoop) && match.turnLoop.length > 0 ? match.turnLoop : [];
  const seatId =
    normalizeText(turnLoop[turnIndex % turnLoop.length]) ||
    normalizeText(TEAM_TETRIS_TURN_LOOP[turnIndex % TEAM_TETRIS_TURN_LOOP.length]);
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
      ? buildTeamTetrisTurnToken(
          match.matchId,
          turnIndex,
          seatId,
          seatInfo.teamId,
          pieceId,
          team.board
        )
      : "",
  };
}

function createTeamTetrisMatch(options: any) {
  const seed = normalizeText(options && options.seed) || `seed_${Date.now().toString(36)}`;
  const rng = createDeterministicRng(`${seed}|teams`);
  const shuffledSeats = TEAM_TETRIS_SEAT_IDS.slice();
  for (let index = shuffledSeats.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = shuffledSeats[index];
    const swapValue = shuffledSeats[swapIndex];
    if (current === undefined || swapValue === undefined) {
      continue;
    }
    shuffledSeats[index] = swapValue;
    shuffledSeats[swapIndex] = current;
  }

  const teamASeats = shuffledSeats.slice(0, 2);
  const teamBSeats = shuffledSeats.slice(2, 4);
  const [teamAOpener, teamAFollowup] = getTeamTetrisSeatPair(teamASeats, "user", "ai1");
  const [teamBOpener, teamBFollowup] = getTeamTetrisSeatPair(teamBSeats, "ai2", "us1");
  const match: any = {
    schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
    matchId: normalizeText(options && options.matchId) || `tt_${hashString(seed).toString(36)}`,
    seed,
    hiddenPairs: !(options && options.hiddenPairs === false),
    revealPairsOnFinish: !(options && options.revealPairsOnFinish === false),
    revealedPairs: options && options.hiddenPairs === false,
    result: "pending",
    winnerTeamId: null as string | null,
    turnIndex: 0,
    turnLoop: [teamAOpener, teamBOpener, teamAFollowup, teamBFollowup],
    seatMap: buildTeamTetrisSeatMap(teamASeats, teamBSeats),
    teams: {
      "team-a": buildTeamTetrisTeamState("team-a", teamASeats, seed),
      "team-b": buildTeamTetrisTeamState("team-b", teamBSeats, seed),
    },
    currentTurn: null as any,
  };
  match.currentTurn = buildTeamTetrisTurn(match, 0);
  return match;
}

function getTeamTetrisTeamIds(): string[] {
  return ["team-a", "team-b"];
}

function getOtherTeamId(teamId: string): string {
  return teamId === "team-b" ? "team-a" : "team-b";
}

function getTeamTetrisSeatInfo(match: any, seatId: string) {
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
