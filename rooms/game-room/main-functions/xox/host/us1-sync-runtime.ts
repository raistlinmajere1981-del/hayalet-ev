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
  type: "info" | "success";
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
  syncFromSnapshot: (api: XoxUs1SyncApi, roomInviteInbox: unknown) => void;
};

export interface XoxUs1SyncApi {
  getState(key: string): unknown;
  setState(key: string, value: unknown): void;
  deleteState?(key: string): void;
  dispatchRoomCommand(commandName: string, payload: XoxDispatchRoomCommandPayload): unknown;
  showToast(payload: XoxToastPayload): void;
  isUs1Connected(): boolean;
  syncUs1Messages(options: {
    localSessionId: string | null;
  }): Promise<XoxUs1MailboxResult | null | undefined>;
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

  function processRoomCommands(api: XoxUs1SyncApi, roomCommands: XoxRoomCommand[]) {
    for (let index = 0; index < roomCommands.length; index += 1) {
      const command = roomCommands.at(index);
      if (!command) {
        continue;
      }
      if (
        command.roomId !== ROOM_ID ||
        (command.featureId !== "" &&
          command.featureId !== FEATURE_ID &&
          command.featureId !== TEAM_TETRIS_FEATURE_ID &&
          command.featureId !== FATE_KNOTS_FEATURE_ID)
      ) {
        continue;
      }

      void api.dispatchRoomCommand(command.commandName, {
        roomPayload: command.roomPayload ?? command.commandArgs,
        args: command.rawArgs,
        remoteUserId: command.remoteUserId,
        localSessionId: command.localSessionId,
        transportMessageId: command.transportMessageId,
      });
    }
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
              hiddenPairs: state.hiddenPairs,
              revealPairsOnFinish: state.revealPairsOnFinish,
            });
            state.hiddenPairs = config.hiddenPairs;
            state.revealPairsOnFinish = config.revealPairsOnFinish;
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

    if (currentState.active !== true) {
      refreshRoomState(api);
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
      const result = await api.syncUs1Messages({
        localSessionId: state.localSessionId,
      });
      if (!result || result.success !== true) {
        api.log("warn", `US1 XOX sync failed (${reason}).`);
        return;
      }

      syncFromSnapshot(api, result.roomInviteInbox);
      await processRoomEvents(api, readRoomEvents(result.roomEvents));
      processRoomCommands(api, readRoomCommands(result.roomCommands));
      refreshRoomState(api);
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
