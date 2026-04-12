import {
  applyTeamTetrisMove,
  buildTeamTetrisBoardHash,
  createTeamTetrisMatch,
  TEAM_TETRIS_SCHEMA_VERSION
} from "./engine.js";
import {
  loadTeamTetrisState,
  saveTeamTetrisState
} from "./state.js";
import { loadContext, readLocale } from "../../../shared/host/context-state.js";
import {
  ROOM_ID,
  TEAM_TETRIS_FEATURE_ID,
  TEAM_TETRIS_PAGE_ID
} from "../../../shared/host/feature-meta.js";
import {
  normalizeTeamTetrisMoveArgs,
  readTransportMessageId
} from "../../../shared/host/command-args.js";
import {
  buildTeamTetrisAiStartMessage,
  buildTeamTetrisAiTurnMessage,
  buildTeamTetrisAiTurnPacket,
  buildTeamTetrisAsciiBoard,
  buildTeamTetrisProtocolScenario,
  buildTeamTetrisRemoteMoveText,
  parseTeamTetrisStartEventNote,
  resolveTeamTetrisSeatFromProvider,
  teamTetrisCommandMessage
} from "./runtime-protocol.js";
import {
  blockTeamTetrisMatch,
  buildEmptyTeamTetrisRows,
  getTeamTetrisReadiness,
  isTeamTetrisBlocked,
  pushActiveFeatureState,
  pushTeamTetrisState,
  resetTeamTetrisState,
  resolveTeamTetrisStatusText,
  serializeTeamTetrisState
} from "./runtime-sync.js";
import {
  sendTeamTetrisRemoteMove,
  sendTeamTetrisRemoteReset,
  sendTeamTetrisRemoteStart
} from "./runtime-transport.js";
const TEAM_TETRIS_EXPECTED_COMMAND_CAPTURE_STATE_KEY = "room.expectedCommandCapture";
function isRecord(value) {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}
function isManualPartnerSeatId(value) {
  return value === "ai1" || value === "ai2" || value === "us1";
}
function readTeamTetrisProviderSeatId(provider, localSeatId = "user") {
  if (provider === "room-ui") {
    return localSeatId;
  }
  if (provider === "ai1" || provider === "ai2" || provider === "us1") {
    return provider;
  }
  return null;
}
function readTeamTetrisStartArgs(payload) {
  const args = isRecord(payload) && isRecord(payload["roomArgs"]) ? payload["roomArgs"] : {};
  return {
    hiddenPairs: args["hiddenPairs"] !== false,
    seed: typeof args["seed"] === "string" && args["seed"].trim() !== "" ? args["seed"].trim() : "",
    selectedPartnerSeatId: isManualPartnerSeatId(args["selectedPartnerSeatId"]) ? args["selectedPartnerSeatId"] : null
  };
}
function readTeamTetrisRoomCommandName(payload) {
  return isRecord(payload) && typeof payload["roomCommand"] === "string" ? payload["roomCommand"].trim() : "";
}
function readTeamTetrisTestMode(payload) {
  if (isRecord(payload) && payload["testMode"] === true) {
    return true;
  }
  return isRecord(payload) && isRecord(payload["roomArgs"]) && payload["roomArgs"]["testMode"] === true;
}
function clearTeamTetrisExpectedCommandCapture(api) {
  if (typeof api.deleteState === "function") {
    api.deleteState(TEAM_TETRIS_EXPECTED_COMMAND_CAPTURE_STATE_KEY);
    return;
  }
  api.setState(TEAM_TETRIS_EXPECTED_COMMAND_CAPTURE_STATE_KEY, null);
}
function setTeamTetrisExpectedCommandCapture(api, provider) {
  api.setState(TEAM_TETRIS_EXPECTED_COMMAND_CAPTURE_STATE_KEY, {
    provider,
    commandName: "GameRoomTeamTetrisAiMove",
    message: teamTetrisCommandMessage(readLocale(api), "commandCaptureFailed")
  });
}
function buildExpectedTeamTetrisCommandName(seatId) {
  if (seatId === "user") {
    return "GameRoomTeamTetrisUserMove";
  }
  if (seatId === "us1") {
    return "GameRoomTeamTetrisRemoteMove";
  }
  return "GameRoomTeamTetrisAiMove";
}
function surfaceTeamTetrisCommandFailure(api, options) {
  if (options.providerSeatId !== "ai1" && options.providerSeatId !== "ai2" && options.providerSeatId !== "us1") {
    return;
  }
  const message = options.message.trim();
  if (message === "") {
    return;
  }
  if (options.sourceProvider === "room-ui") {
    return;
  }
  const details = [
    `command=${options.commandName}`,
    `provider=${options.providerSeatId}`,
    ...typeof options.failureReason === "string" && options.failureReason.trim() !== "" ? [`reason=${options.failureReason.trim()}`] : [],
    ...typeof options.transportMessageId === "string" && options.transportMessageId.trim() !== "" ? [`transport=${options.transportMessageId.trim()}`] : []
  ].join(", ");
  api.notifyRoom?.("command-result", {
    command: options.commandName,
    result: {
      success: false,
      message,
      ...options.debug ? { debug: options.debug } : {}
    }
  });
  api.showToast?.({
    type: "warning",
    message
  });
  api.log?.("warn", `Team Tetris command ignored (${details}): ${message}`);
}
function buildTeamTetrisFailureDebug(rejectReason, collisionStep = null) {
  return {
    resolvedPath: null,
    finalLockCells: null,
    finalRotation: null,
    rejectReason,
    collisionStep
  };
}
function readTeamTetrisCollisionStep(value) {
  if (isRecord(value) && typeof value["stepIndex"] === "number") {
    return value["stepIndex"];
  }
  return null;
}
function buildTeamTetrisSuccessDebug(move, resolution) {
  return {
    resolvedPath: move.rowShifts.slice(),
    finalLockCells: resolution.cells.map(function(cell) {
      return { x: cell.x, y: cell.y };
    }),
    finalRotation: resolution.rotation,
    rejectReason: null,
    collisionStep: typeof resolution.stepIndex === "number" ? resolution.stepIndex : null
  };
}
async function sendBridgeMessageSafe(api, options) {
  if (typeof api.dispatchBridge !== "function") {
    return null;
  }
  return await api.dispatchBridge({
    action: "message.send",
    toSlot: options.provider,
    payload: {
      text: options.text,
      page: options.page,
      ...options.protocol !== void 0 ? {
        protocol: {
          room: options.protocol.room,
          scenario: options.protocol.scenario,
          context: options.protocol.context
        }
      } : {}
    }
  });
}
async function sendTeamTetrisStartAnnouncements(api, state, options) {
  if (!state.match) {
    return true;
  }
  const currentTurnSeatId = state.match.currentTurn?.seatId || null;
  const context = loadContext(api);
  const targets = ["ai1", "ai2"].filter(function(seatId) {
    return currentTurnSeatId !== seatId;
  });
  const readyTargets = targets.filter(function(seatId) {
    return context.slots[seatId].ready === true;
  });
  const message = buildTeamTetrisAiStartMessage(state.match, options);
  const results = await Promise.all(
    readyTargets.map(function(seatId) {
      return sendBridgeMessageSafe(api, {
        provider: seatId,
        page: TEAM_TETRIS_PAGE_ID,
        text: message
      });
    })
  );
  return results.every(function(result) {
    return result?.success === true;
  });
}
async function dispatchNextTeamTetrisTurn(api, state) {
  clearTeamTetrisExpectedCommandCapture(api);
  if (!state.match || state.match.result !== "pending" || !state.match.currentTurn) {
    pushTeamTetrisState(api, state);
    return { success: true };
  }
  const context = loadContext(api);
  const currentTurn = state.match.currentTurn;
  if (currentTurn.seatId === state.localSeatId) {
    pushTeamTetrisState(api, state);
    return { success: true };
  }
  if (state.localSeatId === "us1") {
    pushTeamTetrisState(api, state);
    return { success: true };
  }
  if (currentTurn.seatId === "user") {
    pushTeamTetrisState(api, state);
    return { success: true };
  }
  if (currentTurn.seatId === "us1") {
    if (context.slots.us1.ready !== true) {
      blockTeamTetrisMatch(api, state, "blockedOpponent", "us1-unavailable");
      return {
        success: false,
        message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed")
      };
    }
    pushTeamTetrisState(api, state);
    return { success: true };
  }
  const slot = currentTurn.seatId === "ai1" ? context.slots.ai1 : context.slots.ai2;
  if (slot.ready !== true) {
    blockTeamTetrisMatch(api, state, "blockedOpponent", "ai-unavailable");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }
  const messageResult = await sendBridgeMessageSafe(api, {
    provider: currentTurn.seatId,
    page: TEAM_TETRIS_PAGE_ID,
    text: buildTeamTetrisAiTurnMessage(state.match, currentTurn.seatId),
    protocol: {
      room: ROOM_ID,
      scenario: buildTeamTetrisProtocolScenario(state.match),
      targets: [currentTurn.seatId],
      context: {
        featureId: TEAM_TETRIS_FEATURE_ID,
        hiddenPairs: state.match.hiddenPairs,
        revealedPairs: state.match.revealedPairs,
        actingRole: currentTurn.role,
        teamId: currentTurn.teamId
      }
    }
  });
  if (!messageResult || messageResult.success !== true) {
    blockTeamTetrisMatch(api, state, "blockedDispatch", "protocol-dispatch-failed");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }
  setTeamTetrisExpectedCommandCapture(api, currentTurn.seatId);
  pushTeamTetrisState(api, state);
  return messageResult;
}
async function handleTeamTetrisStart(api, payload) {
  clearTeamTetrisExpectedCommandCapture(api);
  const context = loadContext(api);
  const readiness = getTeamTetrisReadiness(context);
  if (readiness.ai1 !== true || readiness.ai2 !== true || readiness.us1 !== true) {
    pushTeamTetrisState(api, loadTeamTetrisState(api));
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "needReadySeats") };
  }
  const args = readTeamTetrisStartArgs(payload);
  if (args.hiddenPairs !== true && args.selectedPartnerSeatId === null) {
    pushTeamTetrisState(api, loadTeamTetrisState(api));
    return {
      success: false,
      message: teamTetrisCommandMessage(readLocale(api), "needPartnerSelection")
    };
  }
  const state = loadTeamTetrisState(api);
  state.localSeatId = "user";
  state.hiddenPairs = args.hiddenPairs;
  state.revealPairsOnFinish = true;
  state.statusKey = "ready";
  const nextMatch = createTeamTetrisMatch({
    seed: args.seed || [
      Date.now().toString(36),
      context.user.nickname,
      context.slots.ai1.nickname,
      context.slots.ai2.nickname,
      context.slots.us1.nickname
    ].join("|"),
    hiddenPairs: state.hiddenPairs,
    revealPairsOnFinish: state.revealPairsOnFinish,
    selectedPartnerSeatId: args.selectedPartnerSeatId
  });
  state.match = nextMatch;
  state.matchId = nextMatch.matchId;
  state.active = true;
  state.result = nextMatch.result;
  state.remoteUserId = context.slots.us1.remoteUserId || state.remoteUserId;
  saveTeamTetrisState(api, state);
  pushTeamTetrisState(api, state);
  const announcementResult = await sendTeamTetrisStartAnnouncements(api, state, {
    hiddenPairs: args.hiddenPairs,
    selectedPartnerSeatId: args.selectedPartnerSeatId
  });
  if (announcementResult !== true) {
    blockTeamTetrisMatch(api, state, "blockedDispatch", "start-announcement-dispatch-failed");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }
  const remoteResult = await sendTeamTetrisRemoteStart(api, state, {
    selectedPartnerSeatId: args.selectedPartnerSeatId
  });
  if (remoteResult.success !== true) {
    blockTeamTetrisMatch(api, state, "blockedDispatch", "remote-start-dispatch-failed");
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed") };
  }
  await dispatchNextTeamTetrisTurn(api, state);
  return { success: true, message: teamTetrisCommandMessage(readLocale(api), "started") };
}
function handleTeamTetrisReset(api) {
  clearTeamTetrisExpectedCommandCapture(api);
  const state = loadTeamTetrisState(api);
  if (state.matchId) {
    void sendTeamTetrisRemoteReset(api, state);
  }
  pushTeamTetrisState(api, resetTeamTetrisState(api, "idle"));
  return { success: true, message: teamTetrisCommandMessage(readLocale(api), "reset") };
}
async function handleTeamTetrisMove(api, payload) {
  const state = loadTeamTetrisState(api);
  if (!state.match) {
    pushTeamTetrisState(api, state);
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "noActiveGame") };
  }
  if (isTeamTetrisBlocked(state)) {
    pushTeamTetrisState(api, state);
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "blockedMatch") };
  }
  const currentTurn = state.match.currentTurn;
  if (!currentTurn) {
    pushTeamTetrisState(api, state);
    return { success: false, message: teamTetrisCommandMessage(readLocale(api), "noActiveGame") };
  }
  const provider = isRecord(payload) && typeof payload["provider"] === "string" ? payload["provider"] : "";
  const testMode = readTeamTetrisTestMode(payload);
  const providerSeatId = readTeamTetrisProviderSeatId(provider, state.localSeatId);
  const isRemoteTransportMove = provider === "us1";
  const transportMessageId = readTransportMessageId(payload);
  const roomCommandName = readTeamTetrisRoomCommandName(payload);
  const commandName = roomCommandName || buildExpectedTeamTetrisCommandName(currentTurn.seatId);
  const isMirroredUs1Runtime = state.localSeatId === "us1";
  const isMirroredUs1RelayMove = isMirroredUs1Runtime && provider === "us1" && roomCommandName === "GameRoomTeamTetrisRemoteMove";
  const isMirroredUs1CapturedAiCommand = isMirroredUs1Runtime && provider === "us1" && roomCommandName === "GameRoomTeamTetrisAiMove";
  if (isMirroredUs1CapturedAiCommand) {
    return { success: true };
  }
  const actingSeatId = isMirroredUs1RelayMove ? currentTurn.seatId : providerSeatId;
  if (actingSeatId !== currentTurn.seatId) {
    if (isRemoteTransportMove && state.lastRemoteTransportMessageId && state.lastRemoteTransportMessageId === transportMessageId) {
      const message2 = teamTetrisCommandMessage(readLocale(api), "duplicateRemoteMove");
      surfaceTeamTetrisCommandFailure(api, {
        sourceProvider: provider,
        commandName,
        providerSeatId,
        message: message2,
        failureReason: "duplicate-remote-move",
        transportMessageId,
        ...testMode ? { debug: buildTeamTetrisFailureDebug("duplicate-remote-move") } : {}
      });
      return {
        success: false,
        message: message2,
        ...testMode ? { debug: buildTeamTetrisFailureDebug("duplicate-remote-move") } : {}
      };
    }
    const message = provider === "room-ui" ? teamTetrisCommandMessage(readLocale(api), "notUserTurn") : teamTetrisCommandMessage(readLocale(api), "providerMismatch");
    surfaceTeamTetrisCommandFailure(api, {
      sourceProvider: provider,
      commandName,
      providerSeatId,
      message,
      failureReason: "provider-mismatch",
      transportMessageId,
      ...testMode ? { debug: buildTeamTetrisFailureDebug("provider-mismatch") } : {}
    });
    return {
      success: false,
      message,
      ...testMode ? { debug: buildTeamTetrisFailureDebug("provider-mismatch") } : {}
    };
  }
  if (actingSeatId === "ai1" || actingSeatId === "ai2") {
    clearTeamTetrisExpectedCommandCapture(api);
  }
  const move = normalizeTeamTetrisMoveArgs(
    payload,
    TEAM_TETRIS_SCHEMA_VERSION
  );
  if (isRemoteTransportMove && state.lastRemoteTurnIndex !== null && move.turnIndex !== null && move.turnIndex <= state.lastRemoteTurnIndex) {
    const message = teamTetrisCommandMessage(readLocale(api), "staleRemoteMove");
    surfaceTeamTetrisCommandFailure(api, {
      sourceProvider: provider,
      commandName,
      providerSeatId,
      message,
      failureReason: "stale-remote-move",
      transportMessageId,
      ...testMode ? { debug: buildTeamTetrisFailureDebug("stale-remote-move") } : {}
    });
    return {
      success: false,
      message,
      ...testMode ? { debug: buildTeamTetrisFailureDebug("stale-remote-move") } : {}
    };
  }
  const boardHashBeforeMove = buildTeamTetrisBoardHash(state.match.teams[currentTurn.teamId].board);
  const result = applyTeamTetrisMove(state.match, move);
  if (result.success !== true) {
    const failureReason = typeof result.reason === "string" && result.reason ? result.reason : "invalid-move";
    if (isRemoteTransportMove && (failureReason === "turn-token-mismatch" || failureReason === "turn-index-mismatch")) {
      const message2 = teamTetrisCommandMessage(readLocale(api), "staleRemoteMove");
      surfaceTeamTetrisCommandFailure(api, {
        sourceProvider: provider,
        commandName,
        providerSeatId,
        message: message2,
        failureReason,
        transportMessageId,
        ...testMode ? {
          debug: buildTeamTetrisFailureDebug(
            failureReason,
            readTeamTetrisCollisionStep(result)
          )
        } : {}
      });
      return {
        success: false,
        message: message2,
        ...testMode ? {
          debug: buildTeamTetrisFailureDebug(
            failureReason,
            readTeamTetrisCollisionStep(result)
          )
        } : {}
      };
    }
    if (isRemoteTransportMove && transportMessageId) {
      state.lastRemoteTransportMessageId = transportMessageId;
      saveTeamTetrisState(api, state);
    }
    if (providerSeatId === "ai1" || providerSeatId === "ai2" || isRemoteTransportMove) {
      blockTeamTetrisMatch(api, state, "blockedInvalidMove", failureReason);
      const message2 = teamTetrisCommandMessage(readLocale(api), "invalidMove");
      surfaceTeamTetrisCommandFailure(api, {
        sourceProvider: provider,
        commandName,
        providerSeatId,
        message: message2,
        failureReason,
        transportMessageId,
        ...testMode ? {
          debug: buildTeamTetrisFailureDebug(
            failureReason,
            readTeamTetrisCollisionStep(result)
          )
        } : {}
      });
      return {
        success: false,
        message: message2,
        ...testMode ? {
          debug: buildTeamTetrisFailureDebug(
            failureReason,
            readTeamTetrisCollisionStep(result)
          )
        } : {}
      };
    }
    const message = teamTetrisCommandMessage(readLocale(api), "invalidMove");
    pushTeamTetrisState(api, state);
    return {
      success: false,
      message,
      ...testMode ? {
        debug: buildTeamTetrisFailureDebug(failureReason, readTeamTetrisCollisionStep(result))
      } : {}
    };
  }
  state.match = result.match;
  state.matchId = result.match.matchId;
  state.result = result.match.result;
  state.active = result.match.result === "pending";
  state.blockedReason = "";
  if (isRemoteTransportMove) {
    state.lastRemoteTransportMessageId = transportMessageId;
    state.lastRemoteTurnIndex = move.turnIndex;
  }
  saveTeamTetrisState(api, state);
  pushTeamTetrisState(api, state);
  if (isRemoteTransportMove !== true) {
    const remoteResult = await sendTeamTetrisRemoteMove(api, state, move, boardHashBeforeMove);
    if (remoteResult.success !== true) {
      blockTeamTetrisMatch(api, state, "blockedDispatch", "remote-sync-failed");
      return {
        success: false,
        message: teamTetrisCommandMessage(readLocale(api), "dispatchFailed")
      };
    }
  }
  await dispatchNextTeamTetrisTurn(api, state);
  return {
    success: true,
    message: teamTetrisCommandMessage(readLocale(api), "moveApplied"),
    ...testMode ? { debug: buildTeamTetrisSuccessDebug(move, result.resolution) } : {}
  };
}
export {
  blockTeamTetrisMatch,
  buildEmptyTeamTetrisRows,
  buildTeamTetrisAiTurnMessage,
  buildTeamTetrisAiTurnPacket,
  buildTeamTetrisAsciiBoard,
  buildTeamTetrisProtocolScenario,
  buildTeamTetrisRemoteMoveText,
  dispatchNextTeamTetrisTurn,
  getTeamTetrisReadiness,
  handleTeamTetrisMove,
  handleTeamTetrisReset,
  handleTeamTetrisStart,
  isTeamTetrisBlocked,
  parseTeamTetrisStartEventNote,
  pushActiveFeatureState,
  pushTeamTetrisState,
  resetTeamTetrisState,
  resolveTeamTetrisSeatFromProvider,
  resolveTeamTetrisStatusText,
  sendTeamTetrisRemoteMove,
  sendTeamTetrisRemoteReset,
  sendTeamTetrisRemoteStart,
  serializeTeamTetrisState,
  teamTetrisCommandMessage
};
