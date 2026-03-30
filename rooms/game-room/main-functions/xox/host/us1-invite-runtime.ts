import type { XoxGameState } from "./state-core.js";
import type { GameRoomContextState } from "../../../shared/types/room-shell-contracts.js";

interface InviteEntry {
  inviteId: string;
  matchId: string;
  remoteUserId: string;
  nickname: string;
  starter: "user" | "opponent";
  localSessionId: string | null;
  note: string;
  conversationId: string;
  roomId: string;
  featureId: string;
}

interface Us1Api {
  sendUs1Message: (
    msg: Record<string, unknown>
  ) => Promise<{ success: boolean; localSessionId?: string; conversationId?: string }>;
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  deleteState?: (key: string) => void;
  getLocale?: () => unknown;
  notifyRoom?: (event: string, payload: Record<string, unknown>) => void;
}

interface Us1InviteRuntimeDeps {
  FEATURE_ID: string;
  ROOM_ID: string;
  buildInviteId: () => string;
  buildUs1InviteText: (state: XoxGameState, context: GameRoomContextState, note: string) => string;
  buildUs1MoveText: (
    matchId: string,
    turnIndex: number,
    boardHashBeforeMove: string,
    cell: number
  ) => string;
  buildUs1ResetText: (matchId: string) => string;
  commandMessage: (locale: unknown, key: string, params?: Record<string, unknown>) => string;
  createInitialState: (locale: unknown, target: string, starter: string) => XoxGameState;
  createPendingInvite: (
    direction: string,
    inviteEntry: Record<string, unknown>
  ) => Record<string, unknown>;
  getOpponentInfo: (
    context: GameRoomContextState,
    state: XoxGameState
  ) => { remoteUserId?: string | null; nickname: string; ready?: boolean };
  loadContext: (api: Us1Api) => GameRoomContextState;
  loadInviteInbox: (api: Us1Api) => InviteEntry[];
  normalizeInviteInbox: (value: unknown) => InviteEntry[];
  pushRoomState: (api: Us1Api, state: XoxGameState) => XoxGameState;
  readLocale: (api: Us1Api) => "tr" | "en";
  removePendingInvite: (api: Us1Api) => void;
  resolveStateMatchId: (state: XoxGameState) => string | null;
  saveInviteInbox: (api: Us1Api, inbox: InviteEntry[]) => void;
  savePendingInvite: (api: Us1Api, pending: Record<string, unknown>) => void;
}

export function createGameRoomXoxUs1InviteRuntime(deps: Us1InviteRuntimeDeps) {
  const {
    FEATURE_ID,
    ROOM_ID,
    buildInviteId,
    buildUs1InviteText,
    buildUs1MoveText,
    buildUs1ResetText,
    commandMessage,
    createInitialState,
    createPendingInvite,
    getOpponentInfo,
    loadContext,
    loadInviteInbox,
    normalizeInviteInbox,
    pushRoomState,
    readLocale,
    removePendingInvite,
    resolveStateMatchId,
    saveInviteInbox,
    savePendingInvite,
  } = deps;

  function matchesInviteEntry(
    entry: InviteEntry | null,
    inviteId: string,
    remoteUserId: string | null
  ) {
    if (!entry) {
      return false;
    }
    const matchesInviteId = entry.inviteId === inviteId || entry.matchId === inviteId;
    if (matchesInviteId !== true) {
      return false;
    }
    if (remoteUserId === null || remoteUserId === "") {
      return true;
    }
    return entry.remoteUserId === remoteUserId;
  }

  function findInviteById(api: Us1Api, inviteId: string, remoteUserId: string) {
    return (
      loadInviteInbox(api).find(function (entry: InviteEntry) {
        return matchesInviteEntry(entry, inviteId, remoteUserId || null);
      }) || null
    );
  }

  function syncInviteInboxFromSnapshot(api: Us1Api, roomInviteInbox: unknown) {
    const nextInviteInbox = normalizeInviteInbox(roomInviteInbox).filter(function (
      entry: InviteEntry
    ) {
      return (
        entry.roomId === ROOM_ID &&
        entry.featureId === FEATURE_ID &&
        entry.inviteId !== "" &&
        entry.remoteUserId !== ""
      );
    });
    saveInviteInbox(api, nextInviteInbox);
  }

  function removeInviteFromInbox(api: Us1Api, inviteId: string, remoteUserId: string) {
    const nextInviteInbox = loadInviteInbox(api).filter(function (entry: InviteEntry) {
      return matchesInviteEntry(entry, inviteId, remoteUserId || null) !== true;
    });
    saveInviteInbox(api, nextInviteInbox);
  }

  function applyInviteAcceptedState(api: Us1Api, inviteEntry: InviteEntry, starter: "ai" | "user") {
    const state = createInitialState(readLocale(api), "us1", starter);
    state.active = true;
    state.result = "pending";
    state.awaitingMoveFrom = starter === "ai" ? "ai" : "user";
    state.statusKey = starter === "ai" ? "aiTurn" : "userTurn";
    state.matchId = inviteEntry.matchId || inviteEntry.inviteId;
    state.inviteId = inviteEntry.inviteId || inviteEntry.matchId || null;
    state.turnIndex = 0;
    state.localSessionId = inviteEntry.localSessionId || null;
    state.remoteUserId = inviteEntry.remoteUserId;
    state.opponentNickname = inviteEntry.nickname;
    state.protocolDelivered = true;
    removePendingInvite(api);
    removeInviteFromInbox(
      api,
      inviteEntry.matchId || inviteEntry.inviteId,
      inviteEntry.remoteUserId
    );
    return pushRoomState(api, state);
  }

  function readIncomingInviteStarter(inviteEntry: InviteEntry): "ai" | "user" {
    return inviteEntry.starter === "opponent" ? "user" : "ai";
  }

  function readOutgoingInviteStarter(inviteEntry: InviteEntry): "ai" | "user" {
    return inviteEntry.starter === "opponent" ? "ai" : "user";
  }

  async function sendUs1Invite(
    api: Us1Api,
    state: XoxGameState,
    inviteNote: string,
    syncUs1Mailbox: (api: Us1Api, reason: string) => Promise<void>
  ) {
    const context = loadContext(api);
    const matchId = buildInviteId();
    const opponent = getOpponentInfo(context, state);
    const sendResult = await api.sendUs1Message({
      text: buildUs1InviteText(state, context, inviteNote),
      roomEvent: {
        roomId: ROOM_ID,
        featureId: FEATURE_ID,
        inviteId: matchId,
        matchId: matchId,
        eventType: "invite",
        starter: state.starter === "ai" ? "opponent" : "user",
        note: inviteNote !== "" ? inviteNote : null,
      },
    });

    if (sendResult.success !== true) {
      return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
    }

    state.statusKey = "invitePending";
    state.matchId = matchId;
    state.inviteId = matchId;
    state.turnIndex = 0;
    state.lastRemoteTransportMessageId = null;
    state.lastRemoteTurnIndex = null;
    state.localSessionId =
      typeof sendResult.localSessionId === "string" ? sendResult.localSessionId : null;
    state.remoteUserId = opponent.remoteUserId || null;
    state.opponentNickname = opponent.nickname;
    savePendingInvite(
      api,
      createPendingInvite("outgoing", {
        inviteId: matchId,
        matchId: matchId,
        remoteUserId: state.remoteUserId || opponent.remoteUserId || "us1",
        nickname: opponent.nickname,
        note: inviteNote,
        starter: state.starter === "ai" ? "opponent" : "user",
        localSessionId: state.localSessionId,
        conversationId:
          typeof sendResult.conversationId === "string" ? sendResult.conversationId : "",
      })
    );
    pushRoomState(api, state);
    await syncUs1Mailbox(api, "invite-sent");
    return { success: true, message: commandMessage(state.locale, "inviteSent") };
  }

  async function sendUs1Move(
    api: Us1Api,
    state: XoxGameState,
    moveContext: { turnIndex: number; boardHashBeforeMove: string; cell: number }
  ) {
    const context = loadContext(api);
    const opponent = getOpponentInfo(context, state);

    if (
      opponent.ready !== true ||
      state.remoteUserId === null ||
      (opponent.remoteUserId !== null && opponent.remoteUserId !== state.remoteUserId)
    ) {
      return { success: false, message: commandMessage(state.locale, "needReadyOpponent") };
    }

    const matchId = resolveStateMatchId(state) || "";
    const rawArgs = JSON.stringify({
      matchId: matchId,
      inviteId: matchId,
      turnIndex: moveContext.turnIndex,
      boardHashBeforeMove: moveContext.boardHashBeforeMove,
      cell: moveContext.cell,
    });
    const sendResult = await api.sendUs1Message({
      localSessionId: state.localSessionId,
      text: buildUs1MoveText(
        matchId,
        moveContext.turnIndex,
        moveContext.boardHashBeforeMove,
        moveContext.cell
      ),
      roomCommand: {
        roomId: ROOM_ID,
        featureId: FEATURE_ID,
        commandName: "GameRoomXoxRemoteMove",
        matchId: matchId,
        turnIndex: moveContext.turnIndex,
        boardHashBeforeMove: moveContext.boardHashBeforeMove,
        rawArgs: rawArgs,
      },
    });

    if (sendResult.success !== true) {
      return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
    }

    if (typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== "") {
      state.localSessionId = sendResult.localSessionId;
    }

    pushRoomState(api, state);
    return sendResult;
  }

  async function sendUs1Reset(
    api: Us1Api,
    resetContext: { matchId: string; localSessionId?: string | null } | null
  ) {
    if (resetContext === null) {
      return { success: true };
    }

    return await api.sendUs1Message({
      localSessionId: resetContext.localSessionId || null,
      text: buildUs1ResetText(resetContext.matchId),
      roomEvent: {
        roomId: ROOM_ID,
        featureId: FEATURE_ID,
        inviteId: resetContext.matchId,
        matchId: resetContext.matchId,
        eventType: "reset",
      },
    });
  }

  return {
    applyInviteAcceptedState: applyInviteAcceptedState,
    findInviteById: findInviteById,
    readIncomingInviteStarter: readIncomingInviteStarter,
    readOutgoingInviteStarter: readOutgoingInviteStarter,
    removeInviteFromInbox: removeInviteFromInbox,
    sendUs1Invite: sendUs1Invite,
    sendUs1Move: sendUs1Move,
    sendUs1Reset: sendUs1Reset,
    syncFromSnapshot: syncInviteInboxFromSnapshot,
  };
}
