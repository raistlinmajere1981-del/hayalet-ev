import {
  buildTeamTetrisSeatView,
  TEAM_TETRIS_SCHEMA_VERSION,
  type TeamTetrisMatch,
  type TeamTetrisSeatId,
} from "./engine.js";
import { TEAM_TETRIS_COMMAND_COPY } from "./state.js";
import { fillTemplate, translate } from "../../../shared/host/text.js";
import { buildRoomBridgeCommand } from "../../../shared/host/slot-bridge-command.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function teamTetrisCommandMessage(
  locale: unknown,
  key: string,
  params: Record<string, unknown> = {}
) {
  return fillTemplate(translate(locale, TEAM_TETRIS_COMMAND_COPY, key), params);
}

function resolveTeamTetrisSeatFromProvider(provider: unknown): TeamTetrisSeatId | null {
  if (provider === "room-ui") {
    return "user";
  }
  if (provider === "ai1" || provider === "ai2" || provider === "us1") {
    return provider;
  }
  return null;
}

function buildTeamTetrisProtocolScenario(match: TeamTetrisMatch | null | undefined) {
  const currentTurn = match?.currentTurn ?? null;
  return currentTurn?.role === "followup" ? "team-tetris-ai-followup" : "team-tetris-ai-opening";
}

function buildTeamTetrisAiTurnPacket(
  match: TeamTetrisMatch | null | undefined,
  seatId: TeamTetrisSeatId
) {
  const view = buildTeamTetrisSeatView(match, seatId);
  if (!view || !view.pendingTurn) {
    return null;
  }
  return {
    schemaVersion: TEAM_TETRIS_SCHEMA_VERSION,
    matchId: view.matchId,
    turnIndex: view.pendingTurn.turnIndex,
    turnToken: view.pendingTurn.turnToken,
    teamId: view.seat.teamId,
    actingRole: view.pendingTurn.actingRole,
    hiddenPairs: view.hiddenPairs,
    revealedPairs: view.revealedPairs,
    teamBoardPrivateRows: view.ownTeam.boardRows.slice(),
    teamBoardBeforePartnerPieceRows: view.ownTeam.boardBeforePartnerPieceRows.slice(),
    partnerLastPiece: view.ownTeam.partnerLastPiece,
    opponentBoardPublicRows: view.opponentTeam.boardRows.slice(),
    currentPiece: view.pendingTurn.pieceId,
    legalRotations: view.pendingTurn.legalRotations.slice(),
  };
}

function buildTeamTetrisAsciiBoard(rows: string[] | null | undefined) {
  return Array.isArray(rows) ? rows.join("\n") : "";
}

function buildTeamTetrisAiTurnMessage(
  match: TeamTetrisMatch | null | undefined,
  seatId: TeamTetrisSeatId
) {
  const packet = buildTeamTetrisAiTurnPacket(match, seatId);
  if (!packet) {
    return "";
  }
  return [
    "Team Tetris turn update from the Game Room.",
    "Game: Team Tetris.",
    "Your reply is parsed from only the latest assistant message.",
    `Use exactly one command line in this format: ${buildRoomBridgeCommand(
      "GameRoomTeamTetrisAiMove",
      { pieceId: "<piece-id>" }
    )}`,
    "Do not add markdown, prose, code fences, or a second command.",
    "",
    "Turn packet JSON:",
    JSON.stringify(packet, null, 2),
    "",
    "ASCII appendix:",
    "Own team board:",
    buildTeamTetrisAsciiBoard(packet.teamBoardPrivateRows),
    "",
    "Own team board before partner piece:",
    buildTeamTetrisAsciiBoard(packet.teamBoardBeforePartnerPieceRows),
    "",
    "Opponent public board:",
    buildTeamTetrisAsciiBoard(packet.opponentBoardPublicRows),
  ].join("\n");
}

function buildTeamTetrisRemoteMoveText(movePayload: Record<string, unknown>) {
  return buildRoomBridgeCommand("GameRoomTeamTetrisRemoteMove", movePayload);
}

function parseTeamTetrisStartEventNote(note: unknown): Record<string, unknown> | null {
  if (typeof note !== "string" || note.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(note);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export {
  buildTeamTetrisAiTurnMessage,
  buildTeamTetrisAiTurnPacket,
  buildTeamTetrisAsciiBoard,
  buildTeamTetrisProtocolScenario,
  buildTeamTetrisRemoteMoveText,
  parseTeamTetrisStartEventNote,
  resolveTeamTetrisSeatFromProvider,
  teamTetrisCommandMessage,
};
