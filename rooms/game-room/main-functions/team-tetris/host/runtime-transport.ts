import { saveTeamTetrisState } from "./state.js";
import { loadContext } from "../../../shared/host/context-state.js";
import { ROOM_ID, TEAM_TETRIS_FEATURE_ID } from "../../../shared/host/feature-meta.js";
import { buildTeamTetrisRemoteMoveText } from "./runtime-protocol.js";

type TeamTetrisRemoteSendResult =
  | {
      success?: boolean;
      localSessionId?: unknown;
      remoteUserId?: unknown;
    }
  | null
  | undefined;

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function isSuccessfulSendResult(
  result: TeamTetrisRemoteSendResult
): result is {
  success: true;
  localSessionId?: unknown;
  remoteUserId?: unknown;
} {
  return !!result && result.success === true;
}

async function sendTeamTetrisRemoteStart(api, state) {
  const context = loadContext(api);
  const remoteUserId = context.slots.us1.remoteUserId || state.remoteUserId;
  if (!state.match || !remoteUserId) {
    return { success: false };
  }
  const selected = await api.selectUs1RemoteUser(remoteUserId);
  if (selected !== true) {
    return { success: false };
  }

  const sendResult = await api.sendUs1Message({
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
        revealPairsOnFinish: state.match.revealPairsOnFinish,
      }),
    },
  });

  if (isSuccessfulSendResult(sendResult)) {
    state.localSessionId = readNonEmptyString(sendResult.localSessionId) || state.localSessionId;
    state.remoteUserId = readNonEmptyString(sendResult.remoteUserId) || remoteUserId;
    saveTeamTetrisState(api, state);
  }
  return sendResult || { success: false };
}

async function sendTeamTetrisRemoteReset(api, state) {
  if (!state.matchId || !state.remoteUserId) {
    return { success: true };
  }
  const selected = await api.selectUs1RemoteUser(state.remoteUserId);
  if (selected !== true) {
    return { success: false };
  }
  return await api.sendUs1Message({
    localSessionId: state.localSessionId,
    text: "Team Tetris match reset.",
    roomEvent: {
      roomId: ROOM_ID,
      featureId: TEAM_TETRIS_FEATURE_ID,
      inviteId: state.matchId,
      matchId: state.matchId,
      eventType: "reset",
    },
  });
}

async function sendTeamTetrisRemoteMove(api, state, movePayload, boardHashBeforeMove) {
  if (!state.remoteUserId) {
    return { success: true };
  }
  const selected = await api.selectUs1RemoteUser(state.remoteUserId);
  if (selected !== true) {
    return { success: false };
  }
  const rawArgs = JSON.stringify(movePayload);
  const sendResult = await api.sendUs1Message({
    localSessionId: state.localSessionId,
    text: buildTeamTetrisRemoteMoveText(movePayload),
    roomCommand: {
      roomId: ROOM_ID,
      featureId: TEAM_TETRIS_FEATURE_ID,
      commandName: "GameRoomTeamTetrisRemoteMove",
      matchId: movePayload.matchId,
      turnIndex: movePayload.turnIndex,
      turnToken: movePayload.turnToken,
      boardHashBeforeMove: boardHashBeforeMove,
      rawArgs: rawArgs,
    },
  });
  if (isSuccessfulSendResult(sendResult)) {
    state.localSessionId = readNonEmptyString(sendResult.localSessionId) || state.localSessionId;
    saveTeamTetrisState(api, state);
  }
  return sendResult || { success: false };
}

export {
  sendTeamTetrisRemoteMove,
  sendTeamTetrisRemoteReset,
  sendTeamTetrisRemoteStart,
};
