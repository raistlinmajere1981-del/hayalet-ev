export function createGameRoomXoxUs1InviteRuntime(deps) {
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
    savePendingInvite
  } = deps;
  function matchesInviteEntry(entry, inviteId, remoteUserId) {
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
  function findInviteById(api, inviteId, remoteUserId) {
    return loadInviteInbox(api).find(function(entry) {
      return matchesInviteEntry(entry, inviteId, remoteUserId || null);
    }) || null;
  }
  function syncInviteInboxFromSnapshot(api, roomInviteInbox) {
    const nextInviteInbox = normalizeInviteInbox(roomInviteInbox).filter(function(entry) {
      return entry.roomId === ROOM_ID && entry.featureId === FEATURE_ID && entry.inviteId !== "" && entry.remoteUserId !== "";
    });
    saveInviteInbox(api, nextInviteInbox);
  }
  function removeInviteFromInbox(api, inviteId, remoteUserId) {
    const nextInviteInbox = loadInviteInbox(api).filter(function(entry) {
      return matchesInviteEntry(entry, inviteId, remoteUserId || null) !== true;
    });
    saveInviteInbox(api, nextInviteInbox);
  }
  function applyInviteAcceptedState(api, inviteEntry, starter) {
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
    removeInviteFromInbox(api, inviteEntry.matchId || inviteEntry.inviteId, inviteEntry.remoteUserId);
    return pushRoomState(api, state);
  }
  function readIncomingInviteStarter(inviteEntry) {
    return inviteEntry.starter === "opponent" ? "user" : "ai";
  }
  function readOutgoingInviteStarter(inviteEntry) {
    return inviteEntry.starter === "opponent" ? "ai" : "user";
  }
  async function sendUs1Invite(api, state, inviteNote, syncUs1Mailbox) {
    const context = loadContext(api);
    const matchId = buildInviteId();
    const opponent = getOpponentInfo(context, state);
    const sendResult = await api.sendUs1Message({
      text: buildUs1InviteText(state, context, inviteNote),
      roomEvent: {
        roomId: ROOM_ID,
        featureId: FEATURE_ID,
        inviteId: matchId,
        matchId,
        eventType: "invite",
        starter: state.starter === "ai" ? "opponent" : "user",
        note: inviteNote !== "" ? inviteNote : null
      }
    });
    if (!sendResult || sendResult.success !== true) {
      return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
    }
    state.statusKey = "invitePending";
    state.matchId = matchId;
    state.inviteId = matchId;
    state.turnIndex = 0;
    state.lastRemoteTransportMessageId = null;
    state.lastRemoteTurnIndex = null;
    state.localSessionId = typeof sendResult.localSessionId === "string" ? sendResult.localSessionId : null;
    state.remoteUserId = opponent.remoteUserId || null;
    state.opponentNickname = opponent.nickname;
    savePendingInvite(
      api,
      createPendingInvite("outgoing", {
        inviteId: matchId,
        matchId,
        remoteUserId: state.remoteUserId || opponent.remoteUserId || "us1",
        nickname: opponent.nickname,
        note: inviteNote,
        starter: state.starter === "ai" ? "opponent" : "user",
        localSessionId: state.localSessionId,
        conversationId: typeof sendResult.conversationId === "string" ? sendResult.conversationId : ""
      })
    );
    pushRoomState(api, state);
    await syncUs1Mailbox(api, "invite-sent");
    return { success: true, message: commandMessage(state.locale, "inviteSent") };
  }
  async function sendUs1Move(api, state, moveContext) {
    const context = loadContext(api);
    const opponent = getOpponentInfo(context, state);
    if (opponent.ready !== true || state.remoteUserId === null || opponent.remoteUserId !== null && opponent.remoteUserId !== state.remoteUserId) {
      return { success: false, message: commandMessage(state.locale, "needReadyOpponent") };
    }
    const matchId = resolveStateMatchId(state) || "";
    const rawArgs = JSON.stringify({
      matchId,
      inviteId: matchId,
      turnIndex: moveContext.turnIndex,
      boardHashBeforeMove: moveContext.boardHashBeforeMove,
      cell: moveContext.cell
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
        matchId,
        turnIndex: moveContext.turnIndex,
        boardHashBeforeMove: moveContext.boardHashBeforeMove,
        rawArgs
      }
    });
    if (!sendResult || sendResult.success !== true) {
      return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
    }
    if (typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== "") {
      state.localSessionId = sendResult.localSessionId;
    }
    pushRoomState(api, state);
    return sendResult;
  }
  async function sendUs1Reset(api, resetContext) {
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
        eventType: "reset"
      }
    });
  }
  return {
    applyInviteAcceptedState,
    findInviteById,
    readIncomingInviteStarter,
    readOutgoingInviteStarter,
    removeInviteFromInbox,
    sendUs1Invite,
    sendUs1Move,
    sendUs1Reset,
    syncFromSnapshot: syncInviteInboxFromSnapshot
  };
}
