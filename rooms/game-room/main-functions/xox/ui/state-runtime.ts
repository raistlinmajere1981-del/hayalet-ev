(function (
  global: typeof globalThis & {
    GameRoomUiFactories?: GameRoomUiFactoriesRegistry;
  }
) {
  type UnknownRecord = Record<string, unknown>;
  type XoxTarget = "ai1" | "ai2" | "us1";
  type XoxStarter = "user" | "ai";
  type XoxInviteStarter = "user" | "opponent";
  type XoxAwaitingMove = "user" | "ai" | null;
  type XoxInviteEntry = {
    roomId: string;
    featureId: string;
    inviteId: string;
    remoteUserId: string;
    nickname: string;
    senderEmail: string;
    note: string;
    starter: XoxInviteStarter;
    localSessionId: string;
    conversationId: string;
    sentAt: number | null;
  };
  type XoxPendingInvite = {
    direction: "incoming" | "outgoing";
    roomId: string;
    featureId: string;
    inviteId: string;
    remoteUserId: string;
    nickname: string;
    note: string;
    starter: XoxInviteStarter;
    localSessionId: string;
    conversationId: string;
  };
  type XoxSlotState = {
    slotId: string;
    nickname: string;
    assigned?: boolean;
    connected?: boolean;
    ready?: boolean;
  };
  type XoxGameState = {
    board: string[];
    boardAscii: string;
    availableCells: number[];
    active: boolean;
    awaitingMoveFrom: XoxAwaitingMove;
    result: string;
    winner: string;
    selectedTarget: XoxTarget;
    starter: XoxStarter;
    userSymbol: "X" | "O";
    aiSymbol: "X" | "O";
    status: string;
    blockedReason: string;
    protocolDelivered: boolean;
    opponentReady: boolean;
    inviteId: string | null;
    localSessionId: string | null;
    remoteUserId: string | null;
    pendingInvite: XoxPendingInvite | null;
    inviteInbox: XoxInviteEntry[];
    opponent: XoxSlotState;
    user: {
      nickname: string;
    };
  };
  type XoxUiState = {
    game: XoxGameState;
    context: {
      slots: Record<XoxTarget, XoxSlotState>;
      user: {
        nickname: string;
      };
    };
    preferences: {
      target: XoxTarget;
      starter: XoxStarter;
      inviteMessage: string;
    };
    lastCommandMessage: string;
    locale: string;
  };
  type XoxUiStateRuntimeDeps = {
    getState: () => XoxUiState;
    roomId: string;
    featureId: string;
    createSlot: (slotId: string) => XoxSlotState;
    createInviteEntry: () => XoxInviteEntry;
    normalizeSlot: (candidate: unknown, slotId: string) => XoxSlotState;
    text: (path: string[]) => string;
    sendRoomCommand: (command: string, payload: UnknownRecord) => void;
  };

  type XoxUiStateRuntime = {
    createGameState: () => XoxGameState;
    sanitizeGameState: (candidate: unknown) => XoxGameState;
    syncPreferencesFromGame: () => void;
    getSlotOrder: () => XoxSlotState[];
    getSlotStatusLabel: (slot: XoxSlotState) => string;
    getSelectedTarget: () => XoxTarget;
    getDisplayOpponent: () => XoxSlotState;
    getCurrentStatus: () => string;
    getResultLabel: () => string;
    getTurnLabel: () => string;
    getSymbolsLabel: () => string;
    getOpenCellsLabel: () => string;
    getBoardCaption: () => string;
    getStarterLabelForCurrentTarget: (value: XoxStarter) => string;
    formatInviteMeta: (invite: XoxInviteEntry) => string;
    onStart: () => void;
    onReset: () => void;
    onCellClick: (index: number) => void;
    onAcceptInvite: (inviteId: string, remoteUserId: string) => void;
    onRejectInvite: (inviteId: string, remoteUserId: string) => void;
  };

  function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }

  function readString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
  }

  function readOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }

  function readTarget(value: unknown): XoxTarget {
    return value === "ai2" || value === "us1" ? value : "ai1";
  }

  function readStarter(value: unknown): XoxStarter {
    return value === "ai" ? "ai" : "user";
  }

  function readInviteStarter(value: unknown): XoxInviteStarter {
    return value === "opponent" ? "opponent" : "user";
  }

  type XoxUiStateRuntimeRegistry = GameRoomUiFactoriesRegistry & {
    createXoxUiStateRuntime?: (deps: XoxUiStateRuntimeDeps) => XoxUiStateRuntime;
  };

  const registry = (global.GameRoomUiFactories ||
    (global.GameRoomUiFactories = {} as GameRoomUiFactoriesRegistry)) as XoxUiStateRuntimeRegistry;

  registry.createXoxUiStateRuntime = function createXoxUiStateRuntime(deps: XoxUiStateRuntimeDeps) {
    const getState = deps.getState;
    const roomId = deps.roomId;
    const featureId = deps.featureId;
    const createSlot = deps.createSlot;
    const createInviteEntry = deps.createInviteEntry;
    const normalizeSlot = deps.normalizeSlot;
    const text = deps.text;
    const sendRoomCommand = deps.sendRoomCommand;

    const EMPTY_BOARD = ["", "", "", "", "", "", "", "", ""];
    const EMPTY_ASCII = "0 | 1 | 2\n---------\n3 | 4 | 5\n---------\n6 | 7 | 8";

    function createGameState(): XoxGameState {
      return {
        board: EMPTY_BOARD.slice(),
        boardAscii: EMPTY_ASCII,
        availableCells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        active: false,
        awaitingMoveFrom: null,
        result: "idle",
        winner: "",
        selectedTarget: "ai1",
        starter: "user",
        userSymbol: "X",
        aiSymbol: "O",
        status: "",
        blockedReason: "",
        protocolDelivered: false,
        opponentReady: false,
        inviteId: null,
        localSessionId: null,
        remoteUserId: null,
        pendingInvite: null,
        inviteInbox: [],
        opponent: createSlot("ai1"),
        user: {
          nickname: "User",
        },
      };
    }

    function normalizeInviteEntry(candidate: unknown): XoxInviteEntry {
      const source = isRecord(candidate) ? candidate : {};
      const entry = createInviteEntry();
      entry.roomId = readString(source["roomId"], roomId);
      entry.featureId = readString(source["featureId"], featureId);
      entry.inviteId = readString(source["inviteId"], "");
      entry.remoteUserId = readString(source["remoteUserId"], "");
      entry.nickname = readString(source["nickname"], readString(source["senderNickname"], "US1"));
      entry.senderEmail = readString(source["senderEmail"], "");
      entry.note = readString(source["note"], "");
      entry.starter = readInviteStarter(source["starter"]);
      entry.localSessionId = readString(source["localSessionId"], "");
      entry.conversationId = readString(source["conversationId"], "");
      entry.sentAt =
        typeof source["sentAt"] === "number" &&
        Number.isFinite(source["sentAt"]) &&
        source["sentAt"] >= 0
          ? Math.trunc(source["sentAt"])
          : null;
      return entry;
    }

    function normalizeInviteInbox(value: unknown): XoxInviteEntry[] {
      if (!Array.isArray(value)) {
        return [];
      }
      return value
        .map(function (entry: unknown) {
          return normalizeInviteEntry(entry);
        })
        .filter(function (entry: XoxInviteEntry) {
          return entry.inviteId !== "" && entry.remoteUserId !== "";
        });
    }

    function normalizePendingInvite(value: unknown): XoxPendingInvite | null {
      if (isRecord(value) === false) {
        return null;
      }
      const entry = normalizeInviteEntry(value);
      if (entry.inviteId === "" || entry.remoteUserId === "") {
        return null;
      }
      return {
        direction: value["direction"] === "incoming" ? "incoming" : "outgoing",
        roomId: entry.roomId,
        featureId: entry.featureId,
        inviteId: entry.inviteId,
        remoteUserId: entry.remoteUserId,
        nickname: entry.nickname,
        note: entry.note,
        starter: entry.starter,
        localSessionId: entry.localSessionId,
        conversationId: entry.conversationId,
      };
    }

    function sanitizeGameState(candidate: unknown): XoxGameState {
      const source = isRecord(candidate) ? candidate : {};
      const next = createGameState();
      if (Array.isArray(source["board"]) && source["board"].length === 9) {
        next.board = source["board"].map(function (value: unknown) {
          return value === "X" || value === "O" ? value : "";
        });
      }
      if (typeof source["boardAscii"] === "string" && source["boardAscii"].trim() !== "") {
        next.boardAscii = source["boardAscii"];
      }
      if (Array.isArray(source["availableCells"])) {
        next.availableCells = source["availableCells"].filter(function (
          value: unknown
        ): value is number {
          return typeof value === "number" && Number.isInteger(value);
        });
      }
      next.active = source["active"] === true;
      next.awaitingMoveFrom =
        source["awaitingMoveFrom"] === "user" || source["awaitingMoveFrom"] === "ai"
          ? source["awaitingMoveFrom"]
          : null;
      next.result = readString(source["result"], "idle");
      next.winner =
        source["winner"] === "user" || source["winner"] === "ai" ? source["winner"] : "";
      next.selectedTarget = readTarget(source["selectedTarget"]);
      next.starter = readStarter(source["starter"]);
      next.userSymbol = source["userSymbol"] === "O" ? "O" : "X";
      next.aiSymbol = source["aiSymbol"] === "X" ? "X" : "O";
      next.status = readString(source["status"], "");
      next.blockedReason = readString(source["blockedReason"], "");
      next.protocolDelivered = source["protocolDelivered"] === true;
      next.opponentReady = source["opponentReady"] === true;
      next.inviteId = readOptionalString(source["inviteId"]);
      next.localSessionId = readOptionalString(source["localSessionId"]);
      next.remoteUserId = readOptionalString(source["remoteUserId"]);
      next.pendingInvite = normalizePendingInvite(source["pendingInvite"]);
      next.inviteInbox = normalizeInviteInbox(source["inviteInbox"]);
      next.opponent = normalizeSlot(source["opponent"], next.selectedTarget);
      if (isRecord(source["user"])) {
        next.user.nickname = readString(source["user"]["nickname"], next.user.nickname);
      }
      return next;
    }

    function getSlotOrder(): XoxSlotState[] {
      const state = getState();
      return [state.context.slots.ai1, state.context.slots.ai2, state.context.slots.us1];
    }

    function getSlotStatusLabel(slot: XoxSlotState): string {
      if (slot.ready === true) {
        return text(["xox", "slotState", "ready"]);
      }
      if (slot.assigned === true && slot.connected !== true) {
        return text(["xox", "slotState", "disconnected"]);
      }
      if (slot.assigned === true) {
        return text(["xox", "slotState", "assigned"]);
      }
      return text(["xox", "slotState", "empty"]);
    }

    function getSelectedTarget(): XoxTarget {
      const state = getState();
      const preferred = state.preferences.target;
      return readTarget(preferred);
    }

    function getDisplayOpponent(): XoxSlotState {
      const state = getState();
      if (state.game.active === true) {
        return state.game.opponent;
      }
      if (state.game.pendingInvite && state.game.pendingInvite.nickname) {
        return {
          slotId: "us1",
          nickname: state.game.pendingInvite.nickname,
        };
      }
      return state.context.slots[getSelectedTarget()];
    }

    function getCurrentStatus(): string {
      const state = getState();
      if (state.game.status && state.game.status.trim() !== "") {
        return state.game.status.trim();
      }
      if (state.lastCommandMessage && state.lastCommandMessage.trim() !== "") {
        return state.lastCommandMessage.trim();
      }
      return text(["xox", "status", "idle"]);
    }

    function getResultLabel(): string {
      const state = getState();
      return text(["xox", "results", state.game.result]);
    }

    function getTurnLabel(): string {
      const state = getState();
      if (state.game.awaitingMoveFrom === "user") {
        return state.game.user.nickname || state.context.user.nickname;
      }
      if (state.game.awaitingMoveFrom === "ai") {
        return state.game.opponent.nickname;
      }
      return text(["xox", "turns", "idle"]);
    }

    function getSymbolsLabel(): string {
      const state = getState();
      const opponent = getDisplayOpponent();
      return (
        (state.game.user.nickname || state.context.user.nickname) +
        " " +
        state.game.userSymbol +
        " / " +
        opponent.nickname +
        " " +
        state.game.aiSymbol
      );
    }

    function getOpenCellsLabel(): string {
      const state = getState();
      return state.game.availableCells.length > 0 ? state.game.availableCells.join(", ") : "-";
    }

    function getBoardCaption(): string {
      const state = getState();
      if (state.game.blockedReason && state.game.blockedReason.trim() !== "") {
        return state.game.blockedReason.trim();
      }
      if (state.game.pendingInvite && state.game.pendingInvite.direction === "outgoing") {
        return getCurrentStatus();
      }
      if (state.game.active !== true) {
        return getCurrentStatus();
      }
      if (state.game.result !== "pending") {
        return getCurrentStatus();
      }
      if (state.game.awaitingMoveFrom === "user") {
        return text(["xox", "board", "cellsLabel"]) + ": " + getOpenCellsLabel();
      }
      return getCurrentStatus();
    }

    function getStarterLabelForCurrentTarget(value: XoxStarter): string {
      if (getSelectedTarget() === "us1") {
        return value === "ai"
          ? text(["xox", "topbar", "starterRemote"])
          : text(["xox", "topbar", "starterUser"]);
      }
      return value === "ai"
        ? text(["xox", "topbar", "starterAi"])
        : text(["xox", "topbar", "starterUser"]);
    }

    function formatInviteMeta(invite: XoxInviteEntry): string {
      const state = getState();
      const starterLabel =
        invite.starter === "opponent"
          ? text(["xox", "invites", "starterRemote"])
          : text(["xox", "invites", "starterUser"]);
      if (invite.sentAt === null) {
        return starterLabel;
      }
      return starterLabel + " • " + new Date(invite.sentAt).toLocaleString(state.locale);
    }

    function onStart() {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxStart", {
        target: getSelectedTarget(),
        starter: state.preferences.starter === "ai" ? "ai" : "user",
        inviteMessage: state.preferences.inviteMessage,
      });
    }

    function onReset() {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxReset", {});
    }

    function onCellClick(index: number) {
      const state = getState();
      if (
        state.game.active !== true ||
        state.game.awaitingMoveFrom !== "user" ||
        state.game.blockedReason
      ) {
        return;
      }
      if (state.game.board[index] !== "") {
        return;
      }
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxUserMove", {
        cell: index,
      });
    }

    function onAcceptInvite(inviteId: string, remoteUserId: string) {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxAcceptInvite", {
        inviteId: inviteId,
        remoteUserId: remoteUserId,
      });
    }

    function onRejectInvite(inviteId: string, remoteUserId: string) {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxRejectInvite", {
        inviteId: inviteId,
        remoteUserId: remoteUserId,
      });
    }

    function syncPreferencesFromGame() {
      const state = getState();
      state.preferences.target = readTarget(state.game.selectedTarget);
      state.preferences.starter = readStarter(state.game.starter);
    }

    return {
      createGameState: createGameState,
      sanitizeGameState: sanitizeGameState,
      syncPreferencesFromGame: syncPreferencesFromGame,
      getSlotOrder: getSlotOrder,
      getSlotStatusLabel: getSlotStatusLabel,
      getSelectedTarget: getSelectedTarget,
      getDisplayOpponent: getDisplayOpponent,
      getCurrentStatus: getCurrentStatus,
      getResultLabel: getResultLabel,
      getTurnLabel: getTurnLabel,
      getSymbolsLabel: getSymbolsLabel,
      getOpenCellsLabel: getOpenCellsLabel,
      getBoardCaption: getBoardCaption,
      getStarterLabelForCurrentTarget: getStarterLabelForCurrentTarget,
      formatInviteMeta: formatInviteMeta,
      onStart: onStart,
      onReset: onReset,
      onCellClick: onCellClick,
      onAcceptInvite: onAcceptInvite,
      onRejectInvite: onRejectInvite,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
