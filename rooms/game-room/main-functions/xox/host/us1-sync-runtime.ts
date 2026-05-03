import type { TeamTetrisMatch } from "../../team-tetris/host/engine-match.js";
import type { TeamTetrisHostState } from "../../team-tetris/host/state.js";
import type { XoxGameState } from "./state-core.js";

type XoxDispatchRoomCommandPayload = {
  roomPayload?: unknown;
  args?: string;
  remoteUserId?: string | null;
  localSessionId?: string | null;
  transportMessageId?: string | null;
};

type XoxToastPayload = {
  type: "info" | "success" | "warning";
  message: string;
};

type XoxUs1MailboxResult = {
  success?: boolean;
  roomInviteInbox?: unknown;
  roomEvents?: unknown;
  roomCommands?: unknown;
};

type XoxTeamTetrisStartConfig = {
  seed: string;
  hiddenPairs: boolean;
  revealPairsOnFinish: boolean;
  selectedPartnerSeatId: "ai1" | "ai2" | "us1" | null;
};

type XoxRoomCommand = {
  roomId: string;
  featureId: string;
  commandName: string;
  action: string | null;
  roomPayload?: unknown;
  commandArgs: unknown;
  rawArgs: string;
  remoteUserId: string | null;
  localSessionId: string | null;
  transportMessageId: string | null;
};

type XoxRoomEvent = {
  roomId: string;
  featureId: string;
  eventType: string;
  inviteId: string | null;
  matchId: string | null;
  remoteUserId: string | null;
  localSessionId: string | null;
  conversationId: string | null;
  senderNickname: string;
  starter: "user" | "opponent";
  note: unknown;
};

type XoxPendingInvite = {
  direction: "incoming" | "outgoing";
  matchId: string;
  remoteUserId: string;
  localSessionId: string;
  conversationId: string;
  nickname: string;
};

type XoxInviteRuntime = {
  applyInviteAcceptedState: (
    api: XoxUs1SyncApi,
    inviteEntry: XoxPendingInvite,
    starter: "ai" | "user"
  ) => unknown;
  readOutgoingInviteStarter: (inviteEntry: XoxPendingInvite) => "ai" | "user";
  removeInviteFromInbox: (
    api: XoxUs1SyncApi,
    inviteId: string,
    remoteUserId: string | null
  ) => void;
  syncFromSnapshot: (api: XoxUs1SyncApi, roomInviteInbox: unknown) => boolean;
};

export interface XoxUs1SyncApi {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
  deleteState?(key: string): void;
  dispatchBridge?(options: Record<string, unknown>): Promise<unknown>;
  dispatchRoomCommand(commandName: string, payload: XoxDispatchRoomCommandPayload): unknown;
  showToast(payload: XoxToastPayload): void;
  isUs1Connected(): boolean;
  log(level: string, message: string): void;
  getLocale?(): unknown;
  notifyRoom?(event: string, payload: Record<string, unknown>): void;
}

export interface XoxUs1SyncRuntimeDeps {
  DEFAULT_STARTER: string;
  FEATURE_ID: string;
  FATE_KNOTS_FEATURE_ID: string;
  ROOM_ID: string;
  TEAM_TETRIS_FEATURE_ID: string;
  commandMessage: (locale: unknown, key: string, params?: Record<string, unknown>) => string;
  createInitialState: (locale: unknown, target: string, starter: string) => XoxGameState;
  createTeamTetrisMatch: (config: {
    seed: string;
    matchId?: string | null;
    hiddenPairs: boolean;
    revealPairsOnFinish: boolean;
    selectedPartnerSeatId?: "ai1" | "ai2" | "us1" | null;
  }) => TeamTetrisMatch;
  dispatchNextTeamTetrisTurn: (api: XoxUs1SyncApi, state: TeamTetrisHostState) => Promise<unknown>;
  loadPendingInvite: (api: XoxUs1SyncApi) => XoxPendingInvite | null;
  loadState: (api: XoxUs1SyncApi) => XoxGameState;
  loadTeamTetrisState: (api: XoxUs1SyncApi) => TeamTetrisHostState;
  parseTeamTetrisStartEventNote: (note: unknown) => unknown;
  pushRoomState: (api: XoxUs1SyncApi, state: XoxGameState) => XoxGameState;
  pushTeamTetrisState: (api: XoxUs1SyncApi, state: TeamTetrisHostState) => unknown;
  readLocale: (api: XoxUs1SyncApi) => "tr" | "en";
  refreshRoomState: (api: XoxUs1SyncApi) => unknown;
  removePendingInvite: (api: XoxUs1SyncApi) => void;
  resolveStateMatchId: (state: XoxGameState) => string | null;
  resetTeamTetrisState: (api: XoxUs1SyncApi, statusKey: string) => TeamTetrisHostState;
  saveTeamTetrisState: (api: XoxUs1SyncApi, state: TeamTetrisHostState) => TeamTetrisHostState;
  inviteRuntime: XoxInviteRuntime;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function normalizeMailboxResult(value: unknown): XoxUs1MailboxResult | null {
  if (isRecord(value) === false) {
    return null;
  }

  const data = isRecord(value["data"]) ? value["data"] : {};
  return {
    success: value["success"] === true,
    roomInviteInbox: data["roomInviteInbox"],
    roomEvents: data["roomEvents"],
    roomCommands: data["roomCommands"],
  };
}

function normalizeRoomCommand(candidate: unknown): XoxRoomCommand | null {
  if (isRecord(candidate) === false) {
    return null;
  }

  return {
    roomId: readString(candidate["roomId"]),
    featureId: readString(candidate["featureId"]),
    commandName: readString(candidate["commandName"]),
    action: readOptionalString(candidate["action"]),
    roomPayload: candidate["roomPayload"],
    commandArgs: candidate["commandArgs"],
    rawArgs: readString(candidate["rawArgs"]),
    remoteUserId: readOptionalString(candidate["remoteUserId"]),
    localSessionId: readOptionalString(candidate["localSessionId"]),
    transportMessageId: readOptionalString(candidate["transportMessageId"]),
  };
}

function readRoomCommands(value: unknown): XoxRoomCommand[] {
  if (Array.isArray(value) === false) {
    return [];
  }

  return value
    .map(normalizeRoomCommand)
    .filter((command): command is XoxRoomCommand => command !== null && command.commandName !== "");
}

function readCommandResultCandidates(value: unknown): Record<string, unknown>[] {
  if (isRecord(value) === false) {
    return [];
  }

  const candidates: Record<string, unknown>[] = [];
  const data = value["data"];
  if (isRecord(data)) {
    const nestedResult = data["result"];
    if (isRecord(nestedResult)) {
      candidates.push(nestedResult);
    }
    candidates.push(data);
  }
  candidates.push(value);
  return candidates;
}

function readCommandSuccess(value: unknown): boolean | null {
  const candidates = readCommandResultCandidates(value);
  for (const candidate of candidates) {
    if (candidate["success"] === true) {
      return true;
    }
    if (candidate["success"] === false) {
      return false;
    }
  }
  return null;
}

function readCommandMessage(value: unknown): string {
  const candidates = readCommandResultCandidates(value);
  for (let index = 0; index < candidates.length; index += 1) {
    const message = readString(candidates[index]?.["message"]).trim();
    if (message !== "") {
      return message;
    }
  }
  return "";
}

function buildRoomCommandFailureMessage(
  commandName: string,
  result: unknown,
  error?: unknown
): string {
  const resultMessage = readCommandMessage(result);
  if (resultMessage !== "") {
    return resultMessage;
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error.trim();
  }
  return `Incoming ${commandName} update could not be applied.`;
}

function surfaceRoomCommandFailure(
  api: XoxUs1SyncApi,
  command: XoxRoomCommand,
  message: string
): void {
  const details = [
    `command=${command.commandName}`,
    ...(command.transportMessageId !== null ? [`transport=${command.transportMessageId}`] : []),
    ...(command.remoteUserId !== null ? [`remote=${command.remoteUserId}`] : []),
  ].join(", ");

  api.notifyRoom?.("command-result", {
    command: command.commandName,
    result: {
      success: false,
      message,
    },
  });
  api.showToast({
    type: "warning",
    message,
  });
  api.log("warn", `US1 room command ignored (${details}): ${message}`);
}

function shouldProcessRoomCommand(
  command: XoxRoomCommand,
  roomId: string,
  featureId: string,
  teamTetrisFeatureId: string,
  fateKnotsFeatureId: string
): boolean {
  if (command.roomId !== roomId) {
    return false;
  }

  return (
    command.featureId === "" ||
    command.featureId === featureId ||
    command.featureId === teamTetrisFeatureId ||
    command.featureId === fateKnotsFeatureId
  );
}

function normalizeRoomEvent(candidate: unknown): XoxRoomEvent | null {
  if (isRecord(candidate) === false) {
    return null;
  }

  return {
    roomId: readString(candidate["roomId"]),
    featureId: readString(candidate["featureId"]),
    eventType: readString(candidate["eventType"]),
    inviteId: readOptionalString(candidate["inviteId"]),
    matchId: readOptionalString(candidate["matchId"]),
    remoteUserId: readOptionalString(candidate["remoteUserId"]),
    localSessionId: readOptionalString(candidate["localSessionId"]),
    conversationId: readOptionalString(candidate["conversationId"]),
    senderNickname: readString(candidate["senderNickname"]),
    starter: candidate["starter"] === "opponent" ? "opponent" : "user",
    note: candidate["note"],
  };
}

function readRoomEvents(value: unknown): XoxRoomEvent[] {
  if (Array.isArray(value) === false) {
    return [];
  }

  return value
    .map(normalizeRoomEvent)
    .filter((event): event is XoxRoomEvent => event !== null && event.eventType !== "");
}

function readEventMatchId(event: XoxRoomEvent): string | null {
  return event.matchId || event.inviteId;
}

function readTeamTetrisStartConfig(candidate: unknown): XoxTeamTetrisStartConfig | null {
  if (isRecord(candidate) === false) {
    return null;
  }

  return {
    seed: readString(candidate["seed"]),
    hiddenPairs: candidate["hiddenPairs"] !== false,
    revealPairsOnFinish: candidate["revealPairsOnFinish"] !== false,
    selectedPartnerSeatId:
      candidate["selectedPartnerSeatId"] === "ai1" ||
      candidate["selectedPartnerSeatId"] === "ai2" ||
      candidate["selectedPartnerSeatId"] === "us1"
        ? candidate["selectedPartnerSeatId"]
        : null,
  };
}

function readTimerHandle(value: unknown): ReturnType<typeof setInterval> | null {
  if (typeof value === "number") {
    return value as unknown as ReturnType<typeof setInterval>;
  }
  if (typeof value === "object" && value !== null) {
    return value as ReturnType<typeof setInterval>;
  }
  return null;
}

export function createGameRoomXoxUs1SyncRuntime(deps: XoxUs1SyncRuntimeDeps) {
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

  async function processRoomCommands(api: XoxUs1SyncApi, roomCommands: XoxRoomCommand[]) {
    await roomCommands.reduce<Promise<void>>(async (previous, command) => {
      await previous;
      if (
        shouldProcessRoomCommand(
          command,
          ROOM_ID,
          FEATURE_ID,
          TEAM_TETRIS_FEATURE_ID,
          FATE_KNOTS_FEATURE_ID
        ) === false
      ) {
        return;
      }

      try {
        const result = await api.dispatchRoomCommand(command.commandName, {
          roomPayload: command.roomPayload ?? command.commandArgs,
          args: command.rawArgs,
          remoteUserId: command.remoteUserId,
          localSessionId: command.localSessionId,
          transportMessageId: command.transportMessageId,
        });
        if (readCommandSuccess(result) === false) {
          surfaceRoomCommandFailure(
            api,
            command,
            buildRoomCommandFailureMessage(command.commandName, result)
          );
        }
      } catch (error) {
        surfaceRoomCommandFailure(
          api,
          command,
          buildRoomCommandFailureMessage(command.commandName, null, error)
        );
      }
    }, Promise.resolve());
  }

  async function processRoomEvents(api: XoxUs1SyncApi, roomEvents: XoxRoomEvent[]) {
    const currentState = loadState(api);
    const pendingInvite = loadPendingInvite(api);
    const currentMatchId = deps.resolveStateMatchId(currentState);

    for (let index = 0; index < roomEvents.length; index += 1) {
      const event = roomEvents.at(index);
      if (!event) {
        continue;
      }
      if (event.roomId !== ROOM_ID) {
        continue;
      }

      if (event.featureId === TEAM_TETRIS_FEATURE_ID) {
        const eventMatchId = readEventMatchId(event);
        if (event.eventType === "start") {
          const config = readTeamTetrisStartConfig(parseTeamTetrisStartEventNote(event.note));
          if (config !== null) {
            const state = loadTeamTetrisState(api);
            const match = createTeamTetrisMatch({
              seed: config.seed,
              matchId: eventMatchId,
              hiddenPairs: config.hiddenPairs,
              revealPairsOnFinish: config.revealPairsOnFinish,
              selectedPartnerSeatId: config.selectedPartnerSeatId,
            });
            state.hiddenPairs = config.hiddenPairs;
            state.revealPairsOnFinish = config.revealPairsOnFinish;
            state.localSeatId = "us1";
            state.match = match;
            state.matchId = match.matchId;
            state.remoteUserId = event.remoteUserId || state.remoteUserId;
            state.localSessionId = event.localSessionId || state.localSessionId;
            state.active = true;
            state.result = match.result;
            saveTeamTetrisState(api, state);
            pushTeamTetrisState(api, state);
            // eslint-disable-next-line no-await-in-loop -- NOTE: room events apply in arrival order.
            await dispatchNextTeamTetrisTurn(api, state);
          }
          continue;
        }

        if (
          event.eventType === "reset" &&
          eventMatchId !== null &&
          loadTeamTetrisState(api).matchId === eventMatchId
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
          pendingInvite.matchId === readEventMatchId(event) &&
          pendingInvite.remoteUserId === event.remoteUserId
        ) {
          pendingInvite.localSessionId = event.localSessionId || pendingInvite.localSessionId;
          pendingInvite.conversationId = event.conversationId || pendingInvite.conversationId;
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
        pendingInvite.matchId === readEventMatchId(event) &&
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
          pendingInvite.matchId === readEventMatchId(event) &&
          pendingInvite.remoteUserId === event.remoteUserId) ||
          (currentState.target === "us1" &&
            currentMatchId !== null &&
            currentMatchId === readEventMatchId(event) &&
            currentState.remoteUserId === event.remoteUserId))
      ) {
        deps.removePendingInvite(api);
        removeInviteFromInbox(api, readEventMatchId(event) || "", event.remoteUserId);
        const resetState = createInitialState(readLocale(api), "us1", DEFAULT_STARTER);
        resetState.statusKey = "remoteReset";
        resetState.remoteUserId = event.remoteUserId;
        resetState.opponentNickname = event.senderNickname || event.remoteUserId || "";
        pushRoomState(api, resetState);
      }
    }
  }

  function ensureUs1SyncLoop(
    api: XoxUs1SyncApi,
    syncUs1MailboxFn: (api: XoxUs1SyncApi, reason: string) => Promise<void>
  ) {
    const currentTimer = readTimerHandle(api.getState("xox-us1-sync-timer"));
    if (currentTimer !== null) {
      return;
    }

    const timerId = setInterval(function () {
      void syncUs1MailboxFn(api, "poll");
    }, 5000);
    if (typeof timerId.unref === "function") {
      timerId.unref();
    }
    api.setState("xox-us1-sync-timer", timerId);
  }

  function clearUs1SyncLoop(api: XoxUs1SyncApi) {
    const currentTimer = readTimerHandle(api.getState("xox-us1-sync-timer"));
    if (currentTimer !== null) {
      clearInterval(currentTimer);
    }
    api.deleteState?.("xox-us1-sync-timer");
  }

  async function syncUs1Mailbox(api: XoxUs1SyncApi, reason: string) {
    if (api.isUs1Connected() !== true) {
      return;
    }
    if (api.getState("xox-us1-syncing") === true) {
      return;
    }

    api.setState("xox-us1-syncing", true);
    try {
      const state = loadState(api);
      const result =
        typeof api.dispatchBridge === "function"
          ? normalizeMailboxResult(
              await api.dispatchBridge({
                action: "session.sync",
                toSlot: "us1",
                ...(typeof state.localSessionId === "string" && state.localSessionId !== ""
                  ? {
                      sessionRef: {
                        id: state.localSessionId,
                      },
                    }
                  : {}),
                payload: {
                  consumeRoomCommands: true,
                },
              })
            )
          : null;
      if (!result || result.success !== true) {
        api.log("warn", `US1 XOX sync failed (${reason}).`);
        return;
      }

      const inviteInboxChanged = syncFromSnapshot(api, result.roomInviteInbox);
      await processRoomEvents(api, readRoomEvents(result.roomEvents));
      await processRoomCommands(api, readRoomCommands(result.roomCommands));
      if (inviteInboxChanged === true) {
        refreshRoomState(api);
      }
    } finally {
      api.deleteState?.("xox-us1-syncing");
    }
  }

  return {
    clearUs1SyncLoop,
    ensureUs1SyncLoop,
    processRoomCommands,
    processRoomEvents,
    syncUs1Mailbox,
  };
}
