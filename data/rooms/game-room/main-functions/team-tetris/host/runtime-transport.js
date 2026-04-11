import { saveTeamTetrisState } from "./state.js";
import { loadContext } from "../../../shared/host/context-state.js";
import { ROOM_ID, TEAM_TETRIS_FEATURE_ID } from "../../../shared/host/feature-meta.js";
import { buildTeamTetrisRemoteMoveText } from "./runtime-protocol.js";
import { buildUs1RoomBridgeCommand } from "../../../shared/host/slot-bridge-command.js";
function readNonEmptyString(value) {
  return typeof value === "string" && value !== "" ? value : null;
}
function isSuccessfulSendResult(result) {
  return !!result && result.success === true;
}
async function selectUs1RemoteUserSafe(api, remoteUserId) {
  if (typeof api.selectUs1RemoteUser !== "function") {
    return false;
  }
  return await api.selectUs1RemoteUser(remoteUserId);
}
async function sendUs1MessageSafe(api, options) {
  if (typeof api.sendUs1Message !== "function") {
    return null;
  }
  return await api.sendUs1Message(options);
}
async function sendTeamTetrisRemoteStart(api, state) {
  const context = loadContext(api);
  const remoteUserId = context.slots.us1.remoteUserId || state.remoteUserId;
  if (!state.match || !remoteUserId) {
    return { success: false };
  }
  const selected = await selectUs1RemoteUserSafe(api, remoteUserId);
  if (selected !== true) {
    return { success: false };
  }
  const sendResult = await sendUs1MessageSafe(api, {
    localSessionId: state.localSessionId,
    text: "Team Tetris match started.",
    roomEvent: {
      roomId: ROOM_ID,
      featureId: TEAM_TETRIS_FEATURE_ID,
      inviteId: state.match.matchId,
      matchId: state.match.matchId,
      eventType: "start",
      note: JSON.stringify({
        seed: state.match.seed,
        hiddenPairs: state.match.hiddenPairs,
        revealPairsOnFinish: state.match.revealPairsOnFinish
      })
    }
  });
  if (isSuccessfulSendResult(sendResult)) {
    state.localSessionId = readNonEmptyString(sendResult.localSessionId) || state.localSessionId;
    state.remoteUserId = readNonEmptyString(sendResult.remoteUserId) || remoteUserId;
    saveTeamTetrisState(api, state);
    return sendResult;
  }
  return sendResult || { success: false };
}
async function sendTeamTetrisRemoteReset(api, state) {
  if (!state.matchId || !state.remoteUserId) {
    return { success: true };
  }
  const selected = await selectUs1RemoteUserSafe(api, state.remoteUserId);
  if (selected !== true) {
    return { success: false };
  }
  const sendResult = await sendUs1MessageSafe(api, {
    localSessionId: state.localSessionId,
    text: "Team Tetris match reset.",
    roomEvent: {
      roomId: ROOM_ID,
      featureId: TEAM_TETRIS_FEATURE_ID,
      inviteId: state.matchId,
      matchId: state.matchId,
      eventType: "reset"
    }
  });
  return sendResult || { success: false };
}
async function sendTeamTetrisRemoteMove(api, state, movePayload, boardHashBeforeMove) {
  if (!state.remoteUserId) {
    return { success: true };
  }
  const selected = await selectUs1RemoteUserSafe(api, state.remoteUserId);
  if (selected !== true) {
    return { success: false };
  }
  const sendResult = await sendUs1MessageSafe(api, {
    localSessionId: state.localSessionId,
    text: buildTeamTetrisRemoteMoveText(movePayload),
    roomCommand: buildUs1RoomBridgeCommand({
      roomId: ROOM_ID,
      featureId: TEAM_TETRIS_FEATURE_ID,
      commandName: "GameRoomTeamTetrisRemoteMove",
      matchId: movePayload.matchId,
      turnIndex: movePayload.turnIndex,
      turnToken: movePayload.turnToken,
      boardHashBeforeMove,
      payload: movePayload
    })
  });
  if (isSuccessfulSendResult(sendResult)) {
    state.localSessionId = readNonEmptyString(sendResult.localSessionId) || state.localSessionId;
    saveTeamTetrisState(api, state);
    return sendResult;
  }
  return sendResult || { success: false };
}
export { sendTeamTetrisRemoteMove, sendTeamTetrisRemoteReset, sendTeamTetrisRemoteStart };
