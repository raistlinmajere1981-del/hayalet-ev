import { loadContext } from "../../../shared/host/context-state.js";
import {
  ROOM_ID,
  YAHTZEE_FEATURE_ID,
  YAHTZEE_PAGE_ID,
} from "../../../shared/host/feature-meta.js";
import { buildUs1RoomBridgeCommand } from "../../../shared/host/slot-bridge-command.js";
import type { YahtzeeHostState, YahtzeeStateApi } from "./state.js";
import {
  buildYahtzeeAiTurnMessage,
  buildYahtzeeUs1ResetText,
  buildYahtzeeUs1StartText,
  buildYahtzeeUs1SyncText,
} from "./protocol.js";

interface YahtzeeTransportApi extends YahtzeeStateApi {
  dispatchBridge?(options: Record<string, unknown>): Promise<unknown> | unknown;
}

export interface YahtzeeTransportResult {
  success: boolean;
  localSessionId?: string;
  remoteUserId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeTransportResult(value: unknown): YahtzeeTransportResult {
  if (!isRecord(value)) return { success: false };
  const session = isRecord(value["session"]) ? value["session"] : {};
  const data = isRecord(value["data"]) ? value["data"] : {};
  const localSessionId = readString(session["id"]);
  const remoteUserId = readString(data["remoteUserId"]);
  return {
    success: value["success"] === true,
    ...(localSessionId !== null ? { localSessionId } : {}),
    ...(remoteUserId !== null ? { remoteUserId } : {}),
  };
}

export function buildYahtzeeSyncSnapshot(state: YahtzeeHostState): Record<string, unknown> {
  return {
    schemaVersion: state.schemaVersion,
    mode: "us1",
    matchId: state.matchId,
    revision: state.revision,
    active: state.active,
    complete: state.complete,
    players: state.players.map((player) => ({
      seatId: player.seatId,
      label: player.label,
      card: { scores: { ...player.card.scores } },
    })),
    activePlayerIndex: state.activePlayerIndex,
    activeSeatId: state.activeSeatId,
    turnIndex: state.turnIndex,
    turnToken: state.turnToken,
    turn: {
      dice: state.turn.dice.slice(),
      held: state.turn.held.slice(),
      rollCount: state.turn.rollCount,
    },
    result: state.result,
    winnerSeatId: state.winnerSeatId,
    status: state.status,
  };
}

export async function sendYahtzeeAiTurn(
  api: YahtzeeTransportApi,
  state: YahtzeeHostState
): Promise<YahtzeeTransportResult> {
  if (state.activeSeatId !== "ai1" && state.activeSeatId !== "ai2") {
    return { success: true };
  }
  if (typeof api.dispatchBridge !== "function") return { success: false };

  const context = loadContext(api);
  if (context.slots[state.activeSeatId].dispatchable !== true) {
    return { success: false };
  }

  const rawResult = await api.dispatchBridge({
    action: "message.send",
    toSlot: state.activeSeatId,
    connectPolicy: "ensure",
    payload: {
      text: buildYahtzeeAiTurnMessage(state),
      page: YAHTZEE_PAGE_ID,
      protocol: {
        room: ROOM_ID,
        scenario: "yahtzee-ai-turn",
        context: {
          featureId: YAHTZEE_FEATURE_ID,
          mode: state.mode,
          turnIndex: state.turnIndex,
          turnToken: state.turnToken,
          rollCount: state.turn.rollCount,
        },
      },
    },
  });
  return normalizeTransportResult(rawResult);
}

async function sendUs1Message(
  api: YahtzeeTransportApi,
  state: YahtzeeHostState,
  text: string,
  roomCommand: Record<string, unknown>
): Promise<YahtzeeTransportResult> {
  if (typeof api.dispatchBridge !== "function") return { success: false };
  const context = loadContext(api);
  const remoteUserId = state.remoteUserId || context.slots.us1.remoteUserId;
  if (!remoteUserId || context.slots.us1.dispatchable !== true) {
    return { success: false };
  }

  const rawResult = await api.dispatchBridge({
    action: "message.send",
    toSlot: "us1",
    ...(state.localSessionId
      ? {
          sessionRef: {
            id: state.localSessionId,
          },
        }
      : {}),
    payload: {
      text,
      remoteUserId,
      roomCommand,
    },
  });
  return normalizeTransportResult(rawResult);
}

export async function sendYahtzeeUs1Start(
  api: YahtzeeTransportApi,
  state: YahtzeeHostState
): Promise<YahtzeeTransportResult> {
  return await sendUs1Message(
    api,
    state,
    buildYahtzeeUs1StartText(state),
    buildUs1RoomBridgeCommand({
      roomId: ROOM_ID,
      featureId: YAHTZEE_FEATURE_ID,
      commandName: "GameRoomYahtzeeRemoteStart",
      matchId: state.matchId,
      turnIndex: state.turnIndex,
      turnToken: state.turnToken,
      payload: {
        matchId: state.matchId,
        revision: state.revision,
        snapshot: buildYahtzeeSyncSnapshot(state),
      },
    })
  );
}

export async function sendYahtzeeUs1Sync(
  api: YahtzeeTransportApi,
  state: YahtzeeHostState
): Promise<YahtzeeTransportResult> {
  return await sendUs1Message(
    api,
    state,
    buildYahtzeeUs1SyncText(state),
    buildUs1RoomBridgeCommand({
      roomId: ROOM_ID,
      featureId: YAHTZEE_FEATURE_ID,
      commandName: "GameRoomYahtzeeRemoteSync",
      matchId: state.matchId,
      turnIndex: state.turnIndex,
      turnToken: state.turnToken,
      payload: {
        matchId: state.matchId,
        revision: state.revision,
        snapshot: buildYahtzeeSyncSnapshot(state),
      },
    })
  );
}

export async function sendYahtzeeUs1Reset(
  api: YahtzeeTransportApi,
  state: YahtzeeHostState
): Promise<YahtzeeTransportResult> {
  if (!state.matchId) return { success: true };
  return await sendUs1Message(
    api,
    state,
    buildYahtzeeUs1ResetText(state.matchId),
    buildUs1RoomBridgeCommand({
      roomId: ROOM_ID,
      featureId: YAHTZEE_FEATURE_ID,
      commandName: "GameRoomYahtzeeRemoteReset",
      matchId: state.matchId,
      turnIndex: state.turnIndex,
      turnToken: state.turnToken,
      payload: {
        matchId: state.matchId,
      },
    })
  );
}
