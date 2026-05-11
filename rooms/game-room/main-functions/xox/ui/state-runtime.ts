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
  type LegacyXoxCell = "X" | "O" | "";
  type BackgammonOwner = "user" | "ai" | "";
  type BackgammonPoint = {
    point: number;
    owner: BackgammonOwner;
    count: number;
  };
  type BackgammonSubMove = {
    from: { type: "bar"; seat: "user" | "ai" } | { type: "point"; point: number };
    to: { type: "off" } | { type: "point"; point: number };
    die: number;
    hit: boolean;
  };
  type BackgammonLegalMove = {
    id: string;
    label: string;
    moves: BackgammonSubMove[];
    diceUsed: number[];
    pass?: boolean;
  };
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
  type XoxPendingInvite = XoxInviteEntry & {
    direction: "incoming" | "outgoing";
  };
  type XoxSlotState = {
    slotId: XoxTarget;
    nickname: string;
    avatar?: string | null;
    assigned?: boolean;
    connected?: boolean;
    ready?: boolean;
    dispatchable?: boolean;
  };
  type XoxMatchHistoryEntry = {
    id: string;
    finishedAt: number;
    target: string;
    opponentNickname: string;
    opponentAvatar: string | null;
    userNickname: string;
    result: "user-win" | "ai-win";
    starter: "ai" | "user";
    scorePoints: number;
    boardHash: string;
  };
  type XoxGameState = {
    board: BackgammonPoint[];
    legacyBoard: LegacyXoxCell[] | null;
    availableCells: number[];
    boardAscii: string;
    boardHash: string;
    bar: Record<"user" | "ai", number>;
    off: Record<"user" | "ai", number>;
    dice: number[];
    legalMoves: BackgammonLegalMove[];
    active: boolean;
    awaitingMoveFrom: XoxAwaitingMove;
    result: string;
    winner: string;
    selectedTarget: XoxTarget;
    starter: XoxStarter;
    status: string;
    blockedReason: string;
    protocolDelivered: boolean;
    opponentReady: boolean;
    inviteId: string | null;
    matchId: string | null;
    turnIndex: number;
    turnToken: string;
    localSessionId: string | null;
    remoteUserId: string | null;
    pendingInvite: XoxPendingInvite | null;
    inviteInbox: XoxInviteEntry[];
    matchHistory: XoxMatchHistoryEntry[];
    opponent: XoxSlotState;
    user: {
      nickname: string;
    };
    scorePoints: number;
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
    getDiceLabel: () => string;
    getBearOffLabel: () => string;
    getBarLabel: () => string;
    getStarterLabelForCurrentTarget: (value: XoxStarter) => string;
    formatInviteMeta: (invite: XoxInviteEntry) => string;
    onStart: () => void;
    onReset: () => void;
    onLegalMove: (moveId: string) => void;
    onCellClick: (index: number) => void;
    onAcceptInvite: (inviteId: string, remoteUserId: string) => void;
    onRejectInvite: (inviteId: string, remoteUserId: string) => void;
    onCancelOutgoingInvite: () => void;
    getMatchHistory: () => XoxMatchHistoryEntry[];
    getMatchHistoryResultLabel: (entry: XoxMatchHistoryEntry) => string;
    getMatchHistoryResultTone: (entry: XoxMatchHistoryEntry) => string;
    formatMatchHistoryDate: (entry: XoxMatchHistoryEntry) => string;
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

  function readCounter(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
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

  function createDefaultBoard(): BackgammonPoint[] {
    const board: BackgammonPoint[] = [];
    for (let point = 1; point <= 24; point += 1) {
      board.push({ point, owner: "", count: 0 });
    }
    [
      [24, "user", 2],
      [13, "user", 5],
      [8, "user", 3],
      [6, "user", 5],
      [1, "ai", 2],
      [12, "ai", 5],
      [17, "ai", 3],
      [19, "ai", 5],
    ].forEach(function (entry) {
      const point = entry[0] as number;
      board[point - 1] = {
        point,
        owner: entry[1] as BackgammonOwner,
        count: entry[2] as number,
      };
    });
    return board;
  }

  function normalizePoint(candidate: unknown, fallbackPoint: number): BackgammonPoint {
    const source = isRecord(candidate) ? candidate : {};
    const point =
      typeof source["point"] === "number" &&
      Number.isInteger(source["point"]) &&
      source["point"] >= 1 &&
      source["point"] <= 24
        ? source["point"]
        : fallbackPoint;
    const owner = source["owner"] === "user" || source["owner"] === "ai" ? source["owner"] : "";
    const count = readCounter(source["count"]);
    return {
      point,
      owner: count > 0 ? owner : "",
      count: owner === "" ? 0 : count,
    };
  }

  function normalizeBoard(value: unknown): BackgammonPoint[] {
    const fallback = createDefaultBoard();
    if (Array.isArray(value) === false) {
      return fallback;
    }
    const emptyOwner: BackgammonOwner = "";
    const board: BackgammonPoint[] = fallback.map(function (point) {
      return { point: point.point, owner: emptyOwner, count: 0 };
    });
    value.slice(0, 24).forEach(function (entry, index) {
      const point = normalizePoint(entry, index + 1);
      board[point.point - 1] = point;
    });
    return board;
  }

  function normalizeLegacyBoard(value: unknown): LegacyXoxCell[] | null {
    if (Array.isArray(value) === false || value.length !== 9) {
      return null;
    }
    return value.map(function (entry): LegacyXoxCell {
      return entry === "X" || entry === "O" ? entry : "";
    });
  }

  function normalizeAvailableCells(value: unknown): number[] {
    if (Array.isArray(value) === false) {
      return [];
    }
    const cells: number[] = [];
    value.forEach(function (entry) {
      if (
        typeof entry === "number" &&
        Number.isInteger(entry) &&
        entry >= 0 &&
        entry <= 8 &&
        cells.includes(entry) === false
      ) {
        cells.push(entry);
      }
    });
    return cells;
  }

  function normalizeCounters(value: unknown): Record<"user" | "ai", number> {
    const source = isRecord(value) ? value : {};
    return {
      user: readCounter(source["user"]),
      ai: readCounter(source["ai"]),
    };
  }

  function normalizeDice(value: unknown): number[] {
    return Array.isArray(value)
      ? value.filter(function (entry): entry is number {
          return typeof entry === "number" && Number.isInteger(entry) && entry >= 1 && entry <= 6;
        })
      : [];
  }

  function normalizeLegalMoves(value: unknown): BackgammonLegalMove[] {
    if (Array.isArray(value) === false) {
      return [];
    }
    return value
      .map(function (entry): BackgammonLegalMove | null {
        if (isRecord(entry) === false) {
          return null;
        }
        const id = readString(entry["id"], "");
        if (id === "") {
          return null;
        }
        return {
          id,
          label: readString(entry["label"], id),
          moves: Array.isArray(entry["moves"]) ? (entry["moves"] as BackgammonSubMove[]) : [],
          diceUsed: normalizeDice(entry["diceUsed"]),
          pass: entry["pass"] === true,
        };
      })
      .filter(function (entry): entry is BackgammonLegalMove {
        return entry !== null;
      });
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
    const legacyXoxCommandNames = {
      acceptInvite: "GameRoomXoxAcceptInvite",
      reset: "GameRoomXoxReset",
      rejectInvite: "GameRoomXoxRejectInvite",
      start: "GameRoomXoxStart",
      userMove: "GameRoomXoxUserMove",
    };
    const xoxCommandNames = {
      ...legacyXoxCommandNames,
      acceptInvite: "GameRoomBackgammonAcceptInvite",
      reset: "GameRoomBackgammonReset",
      rejectInvite: "GameRoomBackgammonRejectInvite",
      start: "GameRoomBackgammonStart",
      userMove: "GameRoomBackgammonUserMove",
    };

    function sendXoxCommand(commandKey: keyof typeof xoxCommandNames, payload: UnknownRecord) {
      sendRoomCommand(xoxCommandNames[commandKey], payload);
    }

    function createGameState(): XoxGameState {
      return {
        board: createDefaultBoard(),
        legacyBoard: null,
        availableCells: [],
        boardAscii: "",
        boardHash: "",
        bar: { user: 0, ai: 0 },
        off: { user: 0, ai: 0 },
        dice: [],
        legalMoves: [],
        active: false,
        awaitingMoveFrom: null,
        result: "idle",
        winner: "",
        selectedTarget: "ai1",
        starter: "user",
        status: "",
        blockedReason: "",
        protocolDelivered: false,
        opponentReady: false,
        inviteId: null,
        matchId: null,
        turnIndex: 0,
        turnToken: "",
        localSessionId: null,
        remoteUserId: null,
        pendingInvite: null,
        inviteInbox: [],
        matchHistory: [],
        opponent: createSlot("ai1"),
        user: {
          nickname: "User",
        },
        scorePoints: 1,
      };
    }

    function normalizeInviteEntry(candidate: unknown): XoxInviteEntry {
      const source = isRecord(candidate) ? candidate : {};
      const entry = createInviteEntry();
      entry.roomId = readString(source["roomId"], roomId);
      entry.featureId = readString(source["featureId"], featureId);
      entry.inviteId = readString(source["inviteId"], readString(source["matchId"], ""));
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
      return Array.isArray(value)
        ? value
            .map(normalizeInviteEntry)
            .filter((entry) => entry.inviteId !== "" && entry.remoteUserId !== "")
        : [];
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
        ...entry,
        direction: value["direction"] === "incoming" ? "incoming" : "outgoing",
      };
    }

    function normalizeMatchHistory(value: unknown): XoxMatchHistoryEntry[] {
      if (Array.isArray(value) === false) {
        return [];
      }
      return value
        .map(function (entry): XoxMatchHistoryEntry | null {
          if (isRecord(entry) === false) {
            return null;
          }
          const id = readString(entry["id"], "");
          const result = entry["result"];
          if (id === "" || (result !== "user-win" && result !== "ai-win")) {
            return null;
          }
          return {
            id,
            finishedAt: readCounter(entry["finishedAt"]),
            target: readString(entry["target"], "ai1"),
            opponentNickname: readString(entry["opponentNickname"], "Rakip"),
            opponentAvatar: readOptionalString(entry["opponentAvatar"]),
            userNickname: readString(entry["userNickname"], "User"),
            result,
            starter: entry["starter"] === "ai" ? "ai" : "user",
            scorePoints: readCounter(entry["scorePoints"]) || 1,
            boardHash: readString(entry["boardHash"], ""),
          };
        })
        .filter((entry): entry is XoxMatchHistoryEntry => entry !== null)
        .slice(0, 20);
    }

    function sanitizeGameState(candidate: unknown): XoxGameState {
      const source = isRecord(candidate) ? candidate : {};
      const next = createGameState();
      next.board = normalizeBoard(source["board"]);
      next.legacyBoard = normalizeLegacyBoard(source["board"]);
      next.availableCells = normalizeAvailableCells(source["availableCells"]);
      next.boardAscii = readString(source["boardAscii"], "");
      next.boardHash = readString(source["boardHash"], "");
      next.bar = normalizeCounters(source["bar"]);
      next.off = normalizeCounters(source["off"]);
      next.dice = normalizeDice(source["dice"]);
      next.legalMoves = normalizeLegalMoves(source["legalMoves"]);
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
      next.status = readString(source["status"], "");
      next.blockedReason = readString(source["blockedReason"], "");
      next.protocolDelivered = source["protocolDelivered"] === true;
      next.opponentReady = source["opponentReady"] === true;
      next.inviteId = readOptionalString(source["inviteId"]);
      next.matchId = readOptionalString(source["matchId"]);
      next.turnIndex = readCounter(source["turnIndex"]);
      next.turnToken = readString(source["turnToken"], "");
      next.localSessionId = readOptionalString(source["localSessionId"]);
      next.remoteUserId = readOptionalString(source["remoteUserId"]);
      next.pendingInvite = normalizePendingInvite(source["pendingInvite"]);
      next.inviteInbox = normalizeInviteInbox(source["inviteInbox"]);
      next.matchHistory = normalizeMatchHistory(source["matchHistory"]);
      next.opponent = normalizeSlot(source["opponent"], next.selectedTarget);
      next.scorePoints = readCounter(source["scorePoints"]) || 1;
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
      return readTarget(getState().preferences.target);
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
      return (
        readString(state.lastCommandMessage, "") ||
        readString(state.game.status, "") ||
        text(["xox", "status", "idle"])
      );
    }

    function getResultLabel(): string {
      const state = getState();
      if (state.game.result === "user-win") {
        return text(["xox", "results", "user-win"]);
      }
      if (state.game.result === "ai-win") {
        return text(["xox", "results", "ai-win"]);
      }
      if (state.game.result === "blocked") {
        return text(["xox", "results", "blocked"]);
      }
      return state.game.active === true
        ? text(["xox", "results", "pending"])
        : text(["xox", "results", "idle"]);
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

    function getDiceLabel(): string {
      const dice = getState().game.dice;
      return dice.length > 0 ? dice.join(" - ") : "-";
    }

    function getBearOffLabel(): string {
      const off = getState().game.off;
      return "User " + off.user + " / Opponent " + off.ai;
    }

    function getBarLabel(): string {
      const bar = getState().game.bar;
      return "User " + bar.user + " / Opponent " + bar.ai;
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
      const starterLabel =
        invite.starter === "opponent"
          ? text(["xox", "invites", "starterRemote"])
          : text(["xox", "invites", "starterUser"]);
      return invite.sentAt === null
        ? starterLabel
        : starterLabel + " - " + new Date(invite.sentAt).toLocaleString(getState().locale);
    }

    function onStart() {
      const state = getState();
      state.lastCommandMessage = "";
      sendXoxCommand("start", {
        target: getSelectedTarget(),
        starter: state.preferences.starter === "ai" ? "ai" : "user",
        inviteMessage: state.preferences.inviteMessage,
      });
    }

    function onReset() {
      getState().lastCommandMessage = "";
      sendXoxCommand("reset", {});
    }

    function onLegalMove(moveId: string) {
      const state = getState();
      if (
        state.game.active !== true ||
        state.game.awaitingMoveFrom !== "user" ||
        state.game.blockedReason
      ) {
        return;
      }
      getState().lastCommandMessage = "";
      sendXoxCommand("userMove", {
        legalMoveId: moveId,
        turnToken: state.game.turnToken,
        turnIndex: state.game.turnIndex,
      });
    }

    function onCellClick(_index: number) {
      const firstMove = getState().game.legalMoves[0];
      if (firstMove) {
        onLegalMove(firstMove.id);
      }
    }

    function onAcceptInvite(inviteId: string, remoteUserId: string) {
      getState().lastCommandMessage = "";
      sendRoomCommand("GameRoomBackgammonAcceptInvite", { inviteId, remoteUserId });
    }

    function onRejectInvite(inviteId: string, remoteUserId: string) {
      getState().lastCommandMessage = "";
      sendRoomCommand("GameRoomBackgammonRejectInvite", { inviteId, remoteUserId });
    }

    function onCancelOutgoingInvite() {
      getState().lastCommandMessage = "";
      sendXoxCommand("reset", {});
    }

    function getMatchHistory(): XoxMatchHistoryEntry[] {
      return getState().game.matchHistory;
    }

    function getMatchHistoryResultLabel(entry: XoxMatchHistoryEntry): string {
      return entry.result === "user-win"
        ? text(["xox", "history", "win"])
        : text(["xox", "history", "loss"]);
    }

    function getMatchHistoryResultTone(entry: XoxMatchHistoryEntry): string {
      return entry.result === "user-win" ? "win" : "loss";
    }

    function formatMatchHistoryDate(entry: XoxMatchHistoryEntry): string {
      if (!entry.finishedAt || entry.finishedAt <= 0) {
        return "";
      }
      try {
        return new Date(entry.finishedAt).toLocaleString(getState().locale);
      } catch (_error) {
        return "";
      }
    }

    function syncPreferencesFromGame() {
      const state = getState();
      if (
        state.game.active !== true &&
        state.game.pendingInvite === null &&
        state.game.inviteId === null &&
        state.game.remoteUserId === null
      ) {
        return;
      }
      state.preferences.target = state.game.selectedTarget;
      state.preferences.starter = state.game.starter;
    }

    return {
      createGameState,
      sanitizeGameState,
      syncPreferencesFromGame,
      getSlotOrder,
      getSlotStatusLabel,
      getSelectedTarget,
      getDisplayOpponent,
      getCurrentStatus,
      getResultLabel,
      getTurnLabel,
      getDiceLabel,
      getBearOffLabel,
      getBarLabel,
      getStarterLabelForCurrentTarget,
      formatInviteMeta,
      onStart,
      onReset,
      onLegalMove,
      onCellClick,
      onAcceptInvite,
      onRejectInvite,
      onCancelOutgoingInvite,
      getMatchHistory,
      getMatchHistoryResultLabel,
      getMatchHistoryResultTone,
      formatMatchHistoryDate,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
