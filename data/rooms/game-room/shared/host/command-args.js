import { normalizeText } from "./text.js";
function isRecord(value) {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}
export function readArgs(payload) {
  if (isRecord(payload) === false) {
    return {};
  }
  if (isRecord(payload.roomArgs)) {
    return payload.roomArgs;
  }
  return {};
}
export function readCell(payload) {
  if (isRecord(payload) && typeof payload.roomArgs === "number" && Number.isInteger(payload.roomArgs)) {
    return payload.roomArgs;
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
export function readInviteId(payload) {
  const args = readArgs(payload);
  if (typeof args.matchId === "string" && args.matchId.trim() !== "") {
    return args.matchId.trim();
  }
  if (typeof args.inviteId === "string" && args.inviteId.trim() !== "") {
    return args.inviteId.trim();
  }
  return null;
}
export function readTurnIndex(payload) {
  const args = readArgs(payload);
  if (typeof args.turnIndex === "number" && Number.isInteger(args.turnIndex) && args.turnIndex >= 0) {
    return args.turnIndex;
  }
  if (typeof args.turnIndex === "string" && args.turnIndex.trim() !== "") {
    const parsed = Number.parseInt(args.turnIndex, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}
export function readBoardHashBeforeMove(payload) {
  const args = readArgs(payload);
  if (typeof args.boardHashBeforeMove === "string" && args.boardHashBeforeMove.trim() !== "") {
    return args.boardHashBeforeMove.trim();
  }
  return null;
}
export function readTransportMessageId(payload) {
  if (isRecord(payload) && typeof payload.transportMessageId === "string" && payload.transportMessageId.trim() !== "") {
    return payload.transportMessageId.trim();
  }
  return null;
}
export function readRemoteUserId(payload) {
  if (isRecord(payload) && typeof payload.remoteUserId === "string" && payload.remoteUserId.trim() !== "") {
    return payload.remoteUserId.trim();
  }
  const args = readArgs(payload);
  if (typeof args.remoteUserId === "string" && args.remoteUserId.trim() !== "") {
    return args.remoteUserId.trim();
  }
  return null;
}
export function readInviteNote(payload) {
  const args = readArgs(payload);
  return normalizeText(args.inviteMessage);
}
export function parseIntegerValue(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}
export function normalizeTeamTetrisMoveArgs(payload, defaultSchemaVersion) {
  const args = readArgs(payload);
  return {
    schemaVersion: parseIntegerValue(args.schemaVersion) || defaultSchemaVersion,
    matchId: normalizeText(args.matchId),
    turnIndex: parseIntegerValue(args.turnIndex),
    turnToken: normalizeText(args.turnToken),
    pieceId: normalizeText(args.pieceId),
    rotation: parseIntegerValue(args.rotation) || 0,
    rowShifts: Array.isArray(args.rowShifts) ? args.rowShifts.map((value) => parseIntegerValue(value)).filter((value) => value === -1 || value === 0 || value === 1) : []
  };
}
