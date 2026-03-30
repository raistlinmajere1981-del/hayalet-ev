export function createGameRoomXoxUs1SyncRuntime(deps: any) {
  const {
    DEFAULT_STARTER,
    FEATURE_ID,
    FATE_KNOTS_FEATURE_ID,
    ROOM_ID,
    TEAM_TETRIS_FEATURE_ID,
    commandMessage,
    createInitialState,
    createTeamTetrisMatch,
    dispatchNextTeamTetrisTurn,
    loadPendingInvite,
    loadState,
    loadTeamTetrisState,
    parseTeamTetrisStartEventNote,
    pushRoomState,
    pushTeamTetrisState,
    readLocale,
    refreshRoomState,
    resetTeamTetrisState,
    saveTeamTetrisState,
  } = deps;
  const {
    applyInviteAcceptedState,
    readOutgoingInviteStarter,
    removeInviteFromInbox,
    syncFromSnapshot,
  } = deps.inviteRuntime;

  function processRoomCommands(api: any, roomCommands: any) {
    for (let index = 0; index < roomCommands.length; index += 1) {
      const command = roomCommands[index];
      if (
        !command ||
        command.roomId !== ROOM_ID ||
        (command.featureId &&
          command.featureId !== FEATURE_ID &&
          command.featureId !== TEAM_TETRIS_FEATURE_ID &&
          command.featureId !== FATE_KNOTS_FEATURE_ID)
      ) {
        continue;
      }

      void api.dispatchRoomCommand(command.commandName, {
        roomPayload: command.commandArgs,
        args: command.rawArgs || "",
        remoteUserId: command.remoteUserId,
        localSessionId: command.localSessionId,
        transportMessageId: command.transportMessageId,
      });
    }
  }

  async function processRoomEvents(api: any, roomEvents: any) {
    const currentState = loadState(api);
    const pendingInvite = loadPendingInvite(api);
    const currentMatchId = deps.resolveStateMatchId(currentState);

    for (let index = 0; index < roomEvents.length; index += 1) {
      const event = roomEvents[index];
      if (!event || event.roomId !== ROOM_ID) {
        continue;
      }

      if (event.featureId === TEAM_TETRIS_FEATURE_ID) {
        if (event.eventType === "start") {
          const config = parseTeamTetrisStartEventNote(event.note);
          if (config) {
            const state = loadTeamTetrisState(api);
            state.hiddenPairs = config.hiddenPairs !== false;
            state.revealPairsOnFinish = config.revealPairsOnFinish !== false;
            state.match = createTeamTetrisMatch({
              seed: config.seed,
              matchId: event.matchId || event.inviteId,
              hiddenPairs: state.hiddenPairs,
              revealPairsOnFinish: state.revealPairsOnFinish,
            });
            state.matchId = state.match.matchId;
            state.remoteUserId = event.remoteUserId || state.remoteUserId;
            state.localSessionId = event.localSessionId || state.localSessionId;
            state.active = true;
            state.result = state.match.result;
            saveTeamTetrisState(api, state);
            pushTeamTetrisState(api, state);
            // eslint-disable-next-line no-await-in-loop -- NOTE: room events apply in arrival order.
            await dispatchNextTeamTetrisTurn(api, state);
          }
          continue;
        }

        if (
          event.eventType === "reset" &&
          (event.matchId || event.inviteId) &&
          loadTeamTetrisState(api).matchId === (event.matchId || event.inviteId)
        ) {
          pushTeamTetrisState(api, resetTeamTetrisState(api, "idle"));
        }
        continue;
      }

      if (event.featureId !== FEATURE_ID) {
        continue;
      }

      if (event.eventType === "invite") {
        api.showToast({
          type: "info",
          message: commandMessage(readLocale(api), "incomingInviteToast", {
            opponent: event.senderNickname || event.remoteUserId,
          }),
        });
        continue;
      }

      if (event.eventType === "accept") {
        if (
          pendingInvite !== null &&
          pendingInvite.direction === "outgoing" &&
          pendingInvite.matchId === (event.matchId || event.inviteId) &&
          pendingInvite.remoteUserId === event.remoteUserId
        ) {
          pendingInvite.localSessionId = event.localSessionId;
          pendingInvite.conversationId = event.conversationId;
          applyInviteAcceptedState(api, pendingInvite, readOutgoingInviteStarter(pendingInvite));
          api.showToast({
            type: "success",
            message: commandMessage(readLocale(api), "inviteAccepted"),
          });
        }
        continue;
      }

      if (
        event.eventType === "reject" &&
        pendingInvite !== null &&
        pendingInvite.direction === "outgoing" &&
        pendingInvite.matchId === (event.matchId || event.inviteId) &&
        pendingInvite.remoteUserId === event.remoteUserId
      ) {
        const state = loadState(api);
        state.active = false;
        state.awaitingMoveFrom = null;
        state.result = "idle";
        state.statusKey = "inviteRejected";
        state.matchId = null;
        state.inviteId = null;
        state.turnIndex = 0;
        state.localSessionId = null;
        state.remoteUserId = pendingInvite.remoteUserId;
        state.opponentNickname = pendingInvite.nickname;
        state.lastRemoteTransportMessageId = null;
        state.lastRemoteTurnIndex = null;
        deps.removePendingInvite(api);
        pushRoomState(api, state);
        api.showToast({
          type: "info",
          message: commandMessage(readLocale(api), "inviteRejected"),
        });
        continue;
      }

      if (
        event.eventType === "reset" &&
        ((pendingInvite !== null &&
          pendingInvite.direction === "outgoing" &&
          pendingInvite.matchId === (event.matchId || event.inviteId) &&
          pendingInvite.remoteUserId === event.remoteUserId) ||
          (currentState.target === "us1" &&
            currentMatchId !== null &&
            currentMatchId === (event.matchId || event.inviteId) &&
            currentState.remoteUserId === event.remoteUserId))
      ) {
        deps.removePendingInvite(api);
        removeInviteFromInbox(api, event.matchId || event.inviteId, event.remoteUserId || null);
        const resetState = createInitialState(readLocale(api), "us1", DEFAULT_STARTER);
        resetState.statusKey = "remoteReset";
        resetState.remoteUserId = event.remoteUserId;
        resetState.opponentNickname = event.senderNickname || event.remoteUserId;
        pushRoomState(api, resetState);
      }
    }

    if (currentState.active !== true) {
      refreshRoomState(api);
    }
  }

  function ensureUs1SyncLoop(api: any, syncUs1Mailbox: any) {
    const currentTimer = api.getState("xox-us1-sync-timer");
    if (currentTimer) {
      return;
    }

    const timerId = setInterval(function () {
      void syncUs1Mailbox(api, "poll");
    }, 5000);
    if (timerId && typeof timerId.unref === "function") {
      timerId.unref();
    }
    api.setState("xox-us1-sync-timer", timerId);
  }

  function clearUs1SyncLoop(api: any) {
    const currentTimer = api.getState("xox-us1-sync-timer");
    if (currentTimer) {
      clearInterval(currentTimer);
    }
    api.deleteState("xox-us1-sync-timer");
  }

  async function syncUs1Mailbox(api: any, reason: any) {
    if (api.isUs1Connected() !== true) {
      return;
    }
    if (api.getState("xox-us1-syncing") === true) {
      return;
    }

    api.setState("xox-us1-syncing", true);
    try {
      const state = loadState(api);
      const result = await api.syncUs1Messages({
        localSessionId: state.localSessionId,
      });
      if (!result || result.success !== true) {
        api.log("warn", `US1 XOX sync failed (${reason}).`);
        return;
      }

      syncFromSnapshot(api, result.roomInviteInbox);
      await processRoomEvents(api, Array.isArray(result.roomEvents) ? result.roomEvents : []);
      processRoomCommands(api, Array.isArray(result.roomCommands) ? result.roomCommands : []);
      refreshRoomState(api);
    } finally {
      api.deleteState("xox-us1-syncing");
    }
  }

  return {
    clearUs1SyncLoop: clearUs1SyncLoop,
    ensureUs1SyncLoop: ensureUs1SyncLoop,
    processRoomCommands: processRoomCommands,
    processRoomEvents: processRoomEvents,
    syncUs1Mailbox: syncUs1Mailbox,
  };
}
