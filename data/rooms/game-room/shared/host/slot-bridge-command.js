const SLOT_BRIDGE_COMMAND = "SlotBridge";
function buildRoomBridgeEnvelope(commandName, payload = {}) {
  return {
    action: "room.command",
    payload: {
      commandName,
      ...payload
    }
  };
}
function readOptionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function readOptionalInteger(value) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
export function buildRoomBridgeCommand(commandName, payload = {}) {
  return `++cmd:${SLOT_BRIDGE_COMMAND}(${JSON.stringify(buildRoomBridgeEnvelope(commandName, payload))})`;
}
export function buildUs1RoomBridgeCommand(options) {
  const roomPayload = options.payload !== void 0 ? { ...options.payload } : {};
  const matchId = readOptionalString(options.matchId) ?? readOptionalString(roomPayload["matchId"]);
  const turnIndex = readOptionalInteger(options.turnIndex) ?? readOptionalInteger(roomPayload["turnIndex"]);
  const turnToken = readOptionalString(options.turnToken) ?? readOptionalString(roomPayload["turnToken"]);
  const boardHashBeforeMove = readOptionalString(options.boardHashBeforeMove) ?? readOptionalString(roomPayload["boardHashBeforeMove"]);
  return {
    roomId: options.roomId,
    featureId: options.featureId,
    action: "room.command",
    commandName: options.commandName,
    roomPayload,
    ...matchId !== null ? { matchId } : {},
    ...turnIndex !== null ? { turnIndex } : {},
    ...turnToken !== null ? { turnToken } : {},
    ...boardHashBeforeMove !== null ? { boardHashBeforeMove } : {},
    rawArgs: JSON.stringify(roomPayload)
  };
}
