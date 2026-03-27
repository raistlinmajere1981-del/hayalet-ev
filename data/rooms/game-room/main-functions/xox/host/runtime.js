import {
  DEFAULT_STARTER,
  DEFAULT_TARGET,
  buildBoardStateHash,
  createInitialState,
  createPendingInvite,
  getOpponentInfo,
  getOutcomeForBoard,
  loadInviteInbox,
  loadPendingInvite,
  loadState,
  normalizeInviteInbox,
  pushRoomState,
  refreshRoomState,
  resolveStatusText,
  saveInviteInbox,
  savePendingInvite,
  saveState,
  clearPendingInvite,
  sanitizeStarter,
  sanitizeTarget,
} from "./state.js";
import {
  readArgs,
  readBoardHashBeforeMove,
  readCell,
  readInviteId,
  readInviteNote,
  readRemoteUserId,
  readTransportMessageId,
  readTurnIndex,
} from "../../../shared/host/command-args.js";
import { getActiveFeatureId, loadContext, readLocale, saveContext } from "../../../shared/host/context-state.js";
import {
  FATE_KNOTS_FEATURE_ID,
  FEATURE_ID,
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID,
} from "../../../shared/host/feature-meta.js";
import { fillTemplate, normalizeText, translate } from "../../../shared/host/text.js";
import {
  blockTeamTetrisMatch,
  dispatchNextTeamTetrisTurn,
  parseTeamTetrisStartEventNote,
  pushActiveFeatureState,
  pushTeamTetrisState,
  resetTeamTetrisState,
} from "../../team-tetris/host/runtime.js";
import { createTeamTetrisMatch } from "../../team-tetris/host/engine.js";
import {
  loadTeamTetrisState,
  saveTeamTetrisState,
} from "../../team-tetris/host/state.js";
import { syncFromContext as fateKnotsSyncFromContext } from "../../fate-knots/host/runtime.js";

const XOX_COMMAND_NAMES = {
  acceptInvite: "GameRoomXoxAcceptInvite",
  aiMove: "GameRoomXoxAiMove",
  rejectInvite: "GameRoomXoxRejectInvite",
  remoteMove: "GameRoomXoxRemoteMove",
  reset: "GameRoomXoxReset",
  start: "GameRoomXoxStart",
  userMove: "GameRoomXoxUserMove",
};

function commandMessage(locale, key, params) {
  const messages = {
    started: {
      en: "XOX match started.",
      tr: "XOX maci baslatildi.",
    },
    inviteSent: {
      en: "XOX invite sent to the remote opponent.",
      tr: "Uzak rakibe XOX daveti gonderildi.",
    },
    reset: {
      en: "XOX match reset.",
      tr: "XOX maci sifirlandi.",
    },
    needReadyOpponent: {
      en: "The selected opponent is not ready.",
      tr: "Secilen rakip hazir degil.",
    },
    pendingInviteExists: {
      en: "There is already a pending remote invite. Reset first if you want to start over.",
      tr: "Bekleyen bir uzak davet zaten var. Basa donmek icin once sifirla.",
    },
    noActiveGame: {
      en: "There is no active XOX match.",
      tr: "Aktif bir XOX maci yok.",
    },
    blockedGame: {
      en: "This match is blocked. Reset to start again.",
      tr: "Bu mac bloke oldu. Yeniden baslamak icin sifirla.",
    },
    notUserTurn: {
      en: "It is not the user's turn.",
      tr: "Sira kullanicida degil.",
    },
    invalidCell: {
      en: "Choose a valid board cell from 0 to 8.",
      tr: "0 ile 8 arasinda gecerli bir tahta hucresi sec.",
    },
    cellFilled: {
      en: "That cell is already filled.",
      tr: "Bu hucre zaten dolu.",
    },
    moveSent: {
      en: "Move applied and sent to the opponent.",
      tr: "Hamle uygulandi ve rakibe gonderildi.",
    },
    aiTurnOnly: {
      en: "The room is not waiting for an opponent move.",
      tr: "Oda su an bir rakip hamlesi beklemiyor.",
    },
    providerMismatch: {
      en: "The move came from a different opponent than the active match.",
      tr: "Hamle aktif mactakinden farkli bir rakipten geldi.",
    },
    inviteMismatch: {
      en: "The invite does not match the active XOX match.",
      tr: "Davet bilgisi aktif XOX maci ile eslesmiyor.",
    },
    aiInvalidMove: {
      en: "The opponent sent an invalid move.",
      tr: "Rakip gecersiz bir hamle gonderdi.",
    },
    aiFilledCell: {
      en: "The opponent tried to play into a filled cell.",
      tr: "Rakip dolu bir hucreye oynamaya calisti.",
    },
    dispatchFailed: {
      en: "The board update could not be sent to the opponent.",
      tr: "Tahta guncellemesi rakibe gonderilemedi.",
    },
    inviteNotFound: {
      en: "The selected invite is no longer available.",
      tr: "Secilen davet artik kullanilabilir degil.",
    },
    inviteAcceptFailed: {
      en: "The invite could not be accepted.",
      tr: "Davet kabul edilemedi.",
    },
    inviteRejectFailed: {
      en: "The invite could not be rejected.",
      tr: "Davet reddedilemedi.",
    },
    inviteAccepted: {
      en: "The invite was accepted and the match is ready.",
      tr: "Davet kabul edildi ve mac hazir.",
    },
    inviteRejected: {
      en: "The invite was rejected.",
      tr: "Davet reddedildi.",
    },
    staleRemoteMove: {
      en: "A stale remote move was ignored.",
      tr: "Gec kalan uzak hamle yoksayildi.",
    },
    duplicateRemoteMove: {
      en: "A duplicate remote move was ignored.",
      tr: "Yinelenen uzak hamle yoksayildi.",
    },
    resetRemoteFailed: {
      en: "Local reset applied, but the remote side could not be notified.",
      tr: "Yerel sifirlama uygulandi, ancak uzak tarafa bildirim gonderilemedi.",
    },
    incomingInviteToast: {
      en: "{opponent} sent a new XOX invite.",
      tr: "{opponent} yeni bir XOX daveti gonderdi.",
    },
  };
  return fillTemplate(translate(locale, messages, key), params || {});
}

function resolveStateMatchId(state) {
  return state.matchId || state.inviteId || null;
}

function isBlocked(state) {
  return state.result === "blocked" || state.blockedReason !== "";
}

function buildAiTurnMessage(state, context) {
  const opponent = getOpponentInfo(context, state);
  const availableCells = state.board
    .map(function (_cell, index) {
      return state.board[index] === "" ? String(index) : "";
    })
    .filter(Boolean)
    .join(", ");
  const boardAscii = state.board.reduce(function (acc, value, index) {
    const row = Math.floor(index / 3);
    if (!acc[row]) {
      acc[row] = [];
    }
    acc[row].push(value === "" ? String(index) : value);
    return acc;
  }, [])
    .map(function (row) {
      return row.join(" | ");
    })
    .join("\n---------\n");
  const userName = context.user.nickname;
  const starterLabel = state.starter === "ai" ? opponent.nickname : userName;

  return [
    "XOX turn update from the Game Room.",
    "Game: XOX.",
    "Your reply is parsed from only the latest assistant message.",
    'Use exactly one command line in this format: ++cmd:GameRoomXoxAiMove({"cell":4})',
    "Do not add markdown, prose, code fences, or a second command.",
    "",
    "Match setup:",
    "- Opponent: " + userName,
    "- Starter: " + starterLabel,
    "- You are playing as " + state.aiSymbol + ".",
    "- The user is playing as " + state.userSymbol + ".",
    "",
    "Board:",
    boardAscii,
    "",
    "Open cells: " + (availableCells === "" ? "none" : availableCells),
    "Current turn: " + opponent.nickname + " (" + state.aiSymbol + ")",
    "If the board is finished, do not send a command.",
  ].join("\n");
}

function buildInviteId() {
  return `xox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildUs1InviteText(state, context, note) {
  const opponent = getOpponentInfo(context, state);
  const starterLabel = state.starter === "ai" ? opponent.nickname : context.user.nickname;
  const parts = [];

  if (note !== "") {
    parts.push(note, "");
  }

  parts.push(
    "XOX invite from the Game Room.",
    "Opponent: " + context.user.nickname,
    "Starter: " + starterLabel,
    "Accept or reject the invite from the Game Room UI."
  );

  return parts.join("\n");
}

function buildUs1InviteResponseText(type, inviteEntry) {
  const opener = type === "accept" ? "XOX invite accepted." : "XOX invite rejected.";
  return [opener, "Match ID: " + (inviteEntry.matchId || inviteEntry.inviteId)].join("\n");
}

function buildUs1ResetText(matchId) {
  return ["XOX match reset.", "Match ID: " + matchId].join("\n");
}

function buildUs1MoveText(matchId, turnIndex, boardHashBeforeMove, cell) {
  return `++cmd:GameRoomXoxRemoteMove(${JSON.stringify({
    matchId: matchId,
    inviteId: matchId,
    turnIndex: turnIndex,
    boardHashBeforeMove: boardHashBeforeMove,
    cell: cell,
  })})`;
}

function blockMatch(api, state, statusKey, blockedReason) {
  state.active = true;
  state.awaitingMoveFrom = null;
  state.result = "blocked";
  state.winner = "";
  state.statusKey = statusKey;
  state.blockedReason = blockedReason;
  return pushRoomState(api, state);
}

async function sendAiTurnUpdate(api, state, includeProtocol) {
  const context = loadContext(api);
  const opponent = getOpponentInfo(context, state);

  if (opponent.ready !== true) {
    blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
    return { success: false, message: commandMessage(state.locale, "needReadyOpponent") };
  }

  if (includeProtocol === true && state.protocolDelivered !== true) {
    const protocolResult = await api.sendProtocol({
      room: ROOM_ID,
      scenario: state.starter === "ai" ? "xox-ai-start" : "xox-user-start",
      targets: [state.target],
      preface: state.protocolPreface || null,
      context: {
        featureId: FEATURE_ID,
        starter: state.starter,
        aiSymbol: state.aiSymbol,
        userSymbol: state.userSymbol,
      },
    });

    if (!protocolResult || protocolResult.success !== true) {
      blockMatch(api, state, "blockedDispatch", "protocol-dispatch-failed");
      return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
    }

    state.protocolDelivered = true;
    saveState(api, state);
  }

  const messageResult = await api.sendMessage({
    provider: state.target,
    page: "ui/index.html",
    text: buildAiTurnMessage(state, context),
  });

  if (messageResult && messageResult.success === true) {
    pushRoomState(api, state);
    return messageResult;
  }

  blockMatch(api, state, "blockedDispatch", "turn-dispatch-failed");
  return { success: false, message: commandMessage(state.locale, "dispatchFailed") };
}

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
  return (
    loadInviteInbox(api).find(function (entry) {
      return matchesInviteEntry(entry, inviteId, remoteUserId || null);
    }) || null
  );
}

function syncInviteInboxFromSnapshot(api, roomInviteInbox) {
  const nextInviteInbox = normalizeInviteInbox(roomInviteInbox).filter(function (entry) {
    return (
      entry.roomId === ROOM_ID &&
      entry.featureId === FEATURE_ID &&
      entry.inviteId !== "" &&
      entry.remoteUserId !== ""
    );
  });
  saveInviteInbox(api, nextInviteInbox);
}

function removeInviteFromInbox(api, inviteId, remoteUserId) {
  const nextInviteInbox = loadInviteInbox(api).filter(function (entry) {
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
  clearPendingInvite(api);
  removeInviteFromInbox(api, inviteEntry.matchId || inviteEntry.inviteId, inviteEntry.remoteUserId);
  return pushRoomState(api, state);
}

function readIncomingInviteStarter(inviteEntry) {
  return inviteEntry.starter === "opponent" ? "user" : "ai";
}

function readOutgoingInviteStarter(inviteEntry) {
  return inviteEntry.starter === "opponent" ? "ai" : "user";
}

async function sendUs1Invite(api, state, inviteNote) {
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

  if (!sendResult || sendResult.success !== true) {
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

async function sendUs1Move(api, state, moveContext) {
  const context = loadContext(api);
  const opponent = getOpponentInfo(context, state);

  if (
    opponent.ready !== true ||
    state.remoteUserId === null ||
    (opponent.remoteUserId !== null && opponent.remoteUserId !== state.remoteUserId)
  ) {
    blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
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

  if (!sendResult || sendResult.success !== true) {
    blockMatch(api, state, "blockedDispatch", "turn-dispatch-failed");
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
      eventType: "reset",
    },
  });
}

function processRoomCommands(api, roomCommands) {
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

async function processRoomEvents(api, roomEvents) {
  const currentState = loadState(api);
  const pendingInvite = loadPendingInvite(api);
  const currentMatchId = resolveStateMatchId(currentState);

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
      clearPendingInvite(api);
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
      clearPendingInvite(api);
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

function ensureUs1SyncLoop(api) {
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

function clearUs1SyncLoop(api) {
  const currentTimer = api.getState("xox-us1-sync-timer");
  if (currentTimer) {
    clearInterval(currentTimer);
  }
  api.deleteState("xox-us1-sync-timer");
}

function syncFromContext(api, payload) {
  const previousContext = loadContext(api);
  const previousActiveFeatureId = getActiveFeatureId(previousContext);
  const context = saveContext(api, payload);
  const activeFeatureId = getActiveFeatureId(context);
  fateKnotsSyncFromContext(api, {
    context: context,
    previousActiveFeatureId: previousActiveFeatureId,
    activeFeatureId: activeFeatureId,
  });
  const state = loadState(api);
  const teamTetrisState = loadTeamTetrisState(api);
  if (
    previousActiveFeatureId === TEAM_TETRIS_FEATURE_ID &&
    activeFeatureId !== TEAM_TETRIS_FEATURE_ID
  ) {
    resetTeamTetrisState(api, "activeFeatureReset");
  }

  state.locale = readLocale(api);
  if (state.active === true && isBlocked(state) !== true) {
    const opponent = getOpponentInfo(context, state);
    const readyForActiveMatch =
      opponent.ready === true &&
      (state.target !== "us1" ||
        state.remoteUserId === null ||
        opponent.remoteUserId === state.remoteUserId);
    if (readyForActiveMatch !== true) {
      blockMatch(api, state, "blockedOpponent", "opponent-unavailable");
      return;
    }
  }

  saveState(api, state);
  if (teamTetrisState.match && teamTetrisState.result !== "blocked") {
    const readiness = {
      ai1: !!(context.slots.ai1 && context.slots.ai1.ready === true),
      ai2: !!(context.slots.ai2 && context.slots.ai2.ready === true),
      us1: !!(context.slots.us1 && context.slots.us1.ready === true),
    };
    if (readiness.ai1 !== true || readiness.ai2 !== true || readiness.us1 !== true) {
      blockTeamTetrisMatch(api, teamTetrisState, "blockedOpponent", "required-seat-unavailable");
      return;
    }
  }
  pushActiveFeatureState(api);
}

async function syncUs1Mailbox(api, reason) {
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

    syncInviteInboxFromSnapshot(api, result.roomInviteInbox);
    await processRoomEvents(api, Array.isArray(result.roomEvents) ? result.roomEvents : []);
    processRoomCommands(api, Array.isArray(result.roomCommands) ? result.roomCommands : []);
    refreshRoomState(api);
  } finally {
    api.deleteState("xox-us1-syncing");
  }
}

async function handleStart(api, payload) {
  const locale = readLocale(api);
  const args = readArgs(payload);
  const target = sanitizeTarget(args.target);
  const starter = sanitizeStarter(args.starter);
  const inviteNote = readInviteNote(payload);
  const context = loadContext(api);
  const opponent =
    target === "us1"
      ? context.slots.us1
      : getOpponentInfo(context, { target: target, remoteUserId: null, opponentNickname: "" });

  if (loadPendingInvite(api) !== null) {
    return { success: false, message: commandMessage(locale, "pendingInviteExists") };
  }

  if (opponent.ready !== true) {
    return { success: false, message: commandMessage(locale, "needReadyOpponent") };
  }

  const state = createInitialState(locale, target, starter);
  state.opponentNickname = opponent.nickname;
  state.remoteUserId = target === "us1" ? opponent.remoteUserId || null : null;
  state.protocolPreface = inviteNote;

  if (target === "us1") {
    return await sendUs1Invite(api, state, inviteNote);
  }

  state.active = true;
  state.awaitingMoveFrom = starter === "ai" ? "ai" : "user";
  state.result = "pending";
  state.statusKey = starter === "ai" ? "aiTurn" : "userTurn";
  pushRoomState(api, state);

  if (starter === "ai") {
    const sendResult = await sendAiTurnUpdate(api, state, true);
    if (!sendResult || sendResult.success !== true) {
      return { success: false, message: commandMessage(locale, "dispatchFailed") };
    }
  }

  return { success: true, message: commandMessage(locale, "started") };
}

async function handleReset(api) {
  const locale = readLocale(api);
  const currentState = loadState(api);
  const pendingInvite = loadPendingInvite(api);
  const resetContext =
    pendingInvite !== null && pendingInvite.direction === "outgoing" && pendingInvite.matchId
      ? {
          matchId: pendingInvite.matchId,
          localSessionId: pendingInvite.localSessionId,
        }
      : currentState.target === "us1" &&
          currentState.remoteUserId !== null &&
          resolveStateMatchId(currentState) !== null
        ? {
            matchId: resolveStateMatchId(currentState),
            localSessionId: currentState.localSessionId,
          }
        : null;

  let remoteResetSent = true;
  if (resetContext !== null) {
    const sendResult = await sendUs1Reset(api, resetContext);
    remoteResetSent = !!sendResult && sendResult.success === true;
  }

  clearPendingInvite(api);
  const state = createInitialState(locale, DEFAULT_TARGET, DEFAULT_STARTER);
  pushRoomState(api, state);
  return {
    success: remoteResetSent,
    message: commandMessage(locale, remoteResetSent ? "reset" : "resetRemoteFailed"),
  };
}

async function handleUserMove(api, payload) {
  const state = loadState(api);
  const locale = state.locale;
  const cell = readCell(payload);

  if (state.active !== true) {
    return { success: false, message: commandMessage(locale, "noActiveGame") };
  }
  if (isBlocked(state)) {
    return { success: false, message: commandMessage(locale, "blockedGame") };
  }
  if (state.awaitingMoveFrom !== "user") {
    return { success: false, message: commandMessage(locale, "notUserTurn") };
  }
  if (cell === null || cell < 0 || cell > 8) {
    return { success: false, message: commandMessage(locale, "invalidCell") };
  }
  if (state.board[cell] !== "") {
    return { success: false, message: commandMessage(locale, "cellFilled") };
  }

  const outboundTurnIndex = state.turnIndex;
  const boardHashBeforeMove = buildBoardStateHash(state.board);

  state.board[cell] = state.userSymbol;
  state.turnIndex += 1;
  const outcome = getOutcomeForBoard(state.board, state);

  if (outcome.finished === true) {
    state.active = false;
    state.awaitingMoveFrom = null;
    state.result = outcome.result;
    state.winner = outcome.winner;
    state.statusKey = outcome.statusKey;
  } else {
    state.awaitingMoveFrom = "ai";
    state.result = "pending";
    state.statusKey = "aiTurn";
  }

  if (state.target === "us1") {
    const sendResult = await sendUs1Move(api, state, {
      cell: cell,
      turnIndex: outboundTurnIndex,
      boardHashBeforeMove: boardHashBeforeMove,
    });
    if (!sendResult || sendResult.success !== true) {
      return { success: false, message: commandMessage(locale, "dispatchFailed") };
    }
    return {
      success: true,
      message:
        outcome.finished === true
          ? resolveStatusText(state, loadContext(api))
          : commandMessage(locale, "moveSent"),
    };
  }

  if (outcome.finished === true) {
    pushRoomState(api, state);
    return { success: true, message: resolveStatusText(state, loadContext(api)) };
  }

  pushRoomState(api, state);

  const sendResult = await sendAiTurnUpdate(api, state, state.protocolDelivered !== true);
  if (!sendResult || sendResult.success !== true) {
    return { success: false, message: commandMessage(locale, "dispatchFailed") };
  }

  return { success: true, message: commandMessage(locale, "moveSent") };
}

async function applyOpponentMove(api, payload, expectedProvider, requireInviteMatch) {
  const state = loadState(api);
  const locale = state.locale;
  const provider = typeof payload.provider === "string" ? payload.provider : "";
  const cell = readCell(payload);
  const matchId = readInviteId(payload);
  const turnIndex = readTurnIndex(payload);
  const boardHashBeforeMove = readBoardHashBeforeMove(payload);
  const transportMessageId = readTransportMessageId(payload);
  const remoteUserId = readRemoteUserId(payload);
  const currentMatchId = resolveStateMatchId(state);

  if (state.active !== true) {
    return { success: false, message: commandMessage(locale, "noActiveGame") };
  }
  if (isBlocked(state)) {
    return { success: false, message: commandMessage(locale, "blockedGame") };
  }
  if (provider !== "" && provider !== expectedProvider) {
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  if (
    expectedProvider === "us1" &&
    (remoteUserId === null || state.remoteUserId === null || remoteUserId !== state.remoteUserId)
  ) {
    return { success: false, message: commandMessage(locale, "providerMismatch") };
  }
  if (
    expectedProvider === "us1" &&
    transportMessageId !== null &&
    state.lastRemoteTransportMessageId !== null &&
    transportMessageId === state.lastRemoteTransportMessageId
  ) {
    return { success: false, message: commandMessage(locale, "duplicateRemoteMove") };
  }
  if (requireInviteMatch === true && currentMatchId !== null && matchId !== currentMatchId) {
    return { success: false, message: commandMessage(locale, "inviteMismatch") };
  }
  if (
    expectedProvider === "us1" &&
    ((turnIndex !== null && turnIndex !== state.turnIndex) ||
      (boardHashBeforeMove !== null && boardHashBeforeMove !== buildBoardStateHash(state.board)))
  ) {
    return { success: false, message: commandMessage(locale, "staleRemoteMove") };
  }
  if (state.awaitingMoveFrom !== "ai") {
    return { success: false, message: commandMessage(locale, "aiTurnOnly") };
  }
  if (cell === null || cell < 0 || cell > 8) {
    blockMatch(api, state, "blockedInvalidMove", "ai-invalid-cell");
    return { success: false, message: commandMessage(locale, "aiInvalidMove") };
  }
  if (state.board[cell] !== "") {
    blockMatch(api, state, "blockedInvalidMove", "ai-filled-cell");
    return { success: false, message: commandMessage(locale, "aiFilledCell") };
  }

  state.board[cell] = state.aiSymbol;
  state.turnIndex += 1;
  if (expectedProvider === "us1") {
    state.lastRemoteTransportMessageId = transportMessageId;
    state.lastRemoteTurnIndex = turnIndex;
  }
  const outcome = getOutcomeForBoard(state.board, state);

  if (outcome.finished === true) {
    state.active = false;
    state.awaitingMoveFrom = null;
    state.result = outcome.result;
    state.winner = outcome.winner;
    state.statusKey = outcome.statusKey;
  } else {
    state.awaitingMoveFrom = "user";
    state.result = "pending";
    state.statusKey = "userTurn";
  }

  pushRoomState(api, state);
  return { success: true, message: resolveStatusText(state, loadContext(api)) };
}

async function handleAiMove(api, payload) {
  const state = loadState(api);
  return await applyOpponentMove(api, payload, state.target, false);
}

async function handleRemoteMove(api, payload) {
  return await applyOpponentMove(api, payload, "us1", true);
}

async function handleAcceptInvite(api, payload) {
  const matchId = readInviteId(payload);
  const remoteUserId = readRemoteUserId(payload);
  const inviteEntry = matchId !== null ? findInviteById(api, matchId, remoteUserId) : null;
  if (inviteEntry === null) {
    return { success: false, message: commandMessage(readLocale(api), "inviteNotFound") };
  }

  if (loadPendingInvite(api) !== null || loadState(api).active === true) {
    return { success: false, message: commandMessage(readLocale(api), "pendingInviteExists") };
  }

  const selected = await api.selectUs1RemoteUser(inviteEntry.remoteUserId);
  if (selected !== true) {
    return { success: false, message: commandMessage(readLocale(api), "inviteAcceptFailed") };
  }

  const sendResult = await api.sendUs1Message({
    localSessionId: inviteEntry.localSessionId || null,
    text: buildUs1InviteResponseText("accept", inviteEntry),
    roomEvent: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: inviteEntry.inviteId,
      matchId: inviteEntry.matchId || inviteEntry.inviteId,
      eventType: "accept",
      starter: inviteEntry.starter,
      note: inviteEntry.note || null,
    },
  });

  if (!sendResult || sendResult.success !== true) {
    return { success: false, message: commandMessage(readLocale(api), "inviteAcceptFailed") };
  }

  inviteEntry.localSessionId =
    typeof sendResult.localSessionId === "string" && sendResult.localSessionId !== ""
      ? sendResult.localSessionId
      : inviteEntry.localSessionId;
  inviteEntry.conversationId =
    typeof sendResult.conversationId === "string" && sendResult.conversationId !== ""
      ? sendResult.conversationId
      : inviteEntry.conversationId;
  applyInviteAcceptedState(api, inviteEntry, readIncomingInviteStarter(inviteEntry));
  await syncUs1Mailbox(api, "invite-accepted");
  return { success: true, message: commandMessage(readLocale(api), "inviteAccepted") };
}

async function handleRejectInvite(api, payload) {
  const matchId = readInviteId(payload);
  const remoteUserId = readRemoteUserId(payload);
  const inviteEntry = matchId !== null ? findInviteById(api, matchId, remoteUserId) : null;
  if (inviteEntry === null) {
    return { success: false, message: commandMessage(readLocale(api), "inviteNotFound") };
  }

  const selected = await api.selectUs1RemoteUser(inviteEntry.remoteUserId);
  if (selected !== true) {
    return { success: false, message: commandMessage(readLocale(api), "inviteRejectFailed") };
  }

  const sendResult = await api.sendUs1Message({
    localSessionId: inviteEntry.localSessionId || null,
    text: buildUs1InviteResponseText("reject", inviteEntry),
    roomEvent: {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: inviteEntry.inviteId,
      matchId: inviteEntry.matchId || inviteEntry.inviteId,
      eventType: "reject",
      starter: inviteEntry.starter,
      note: inviteEntry.note || null,
    },
  });

  if (!sendResult || sendResult.success !== true) {
    return { success: false, message: commandMessage(readLocale(api), "inviteRejectFailed") };
  }

  removeInviteFromInbox(api, inviteEntry.matchId || inviteEntry.inviteId, inviteEntry.remoteUserId);
  refreshRoomState(api);
  await syncUs1Mailbox(api, "invite-rejected");
  return { success: true, message: commandMessage(readLocale(api), "inviteRejected") };
}

export {
  XOX_COMMAND_NAMES,
  handleAcceptInvite,
  handleAiMove,
  handleRejectInvite,
  handleRemoteMove,
  handleReset,
  handleStart,
  handleUserMove,
  clearUs1SyncLoop,
  ensureUs1SyncLoop,
  processRoomCommands,
  processRoomEvents,
  syncFromContext,
  syncUs1Mailbox,
};
