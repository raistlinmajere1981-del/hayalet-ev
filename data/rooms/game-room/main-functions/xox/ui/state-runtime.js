(function(global) {
  function isRecord(value) {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }
  function readString(value, fallback) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
  }
  function readOptionalString(value) {
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  }
  function readTarget(value) {
    return value === "ai2" || value === "us1" ? value : "ai1";
  }
  function readStarter(value) {
    return value === "ai" ? "ai" : "user";
  }
  function readInviteStarter(value) {
    return value === "opponent" ? "opponent" : "user";
  }
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createXoxUiStateRuntime = function createXoxUiStateRuntime(deps) {
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
    function createGameState() {
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
          nickname: "User"
        }
      };
    }
    function normalizeInviteEntry(candidate) {
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
      entry.sentAt = typeof source["sentAt"] === "number" && Number.isFinite(source["sentAt"]) && source["sentAt"] >= 0 ? Math.trunc(source["sentAt"]) : null;
      return entry;
    }
    function normalizeInviteInbox(value) {
      if (!Array.isArray(value)) {
        return [];
      }
      return value.map(function(entry) {
        return normalizeInviteEntry(entry);
      }).filter(function(entry) {
        return entry.inviteId !== "" && entry.remoteUserId !== "";
      });
    }
    function normalizePendingInvite(value) {
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
        conversationId: entry.conversationId
      };
    }
    function sanitizeGameState(candidate) {
      const source = isRecord(candidate) ? candidate : {};
      const next = createGameState();
      if (Array.isArray(source["board"]) && source["board"].length === 9) {
        next.board = source["board"].map(function(value) {
          return value === "X" || value === "O" ? value : "";
        });
      }
      if (typeof source["boardAscii"] === "string" && source["boardAscii"].trim() !== "") {
        next.boardAscii = source["boardAscii"];
      }
      if (Array.isArray(source["availableCells"])) {
        next.availableCells = source["availableCells"].filter(function(value) {
          return typeof value === "number" && Number.isInteger(value);
        });
      }
      next.active = source["active"] === true;
      next.awaitingMoveFrom = source["awaitingMoveFrom"] === "user" || source["awaitingMoveFrom"] === "ai" ? source["awaitingMoveFrom"] : null;
      next.result = readString(source["result"], "idle");
      next.winner = source["winner"] === "user" || source["winner"] === "ai" ? source["winner"] : "";
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
    function getSlotOrder() {
      const state = getState();
      return [state.context.slots.ai1, state.context.slots.ai2, state.context.slots.us1];
    }
    function getSlotStatusLabel(slot) {
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
    function getSelectedTarget() {
      const state = getState();
      const preferred = state.preferences.target;
      return readTarget(preferred);
    }
    function getDisplayOpponent() {
      const state = getState();
      if (state.game.active === true) {
        return state.game.opponent;
      }
      if (state.game.pendingInvite && state.game.pendingInvite.nickname) {
        return {
          slotId: "us1",
          nickname: state.game.pendingInvite.nickname
        };
      }
      return state.context.slots[getSelectedTarget()];
    }
    function getCurrentStatus() {
      const state = getState();
      if (state.game.status && state.game.status.trim() !== "") {
        return state.game.status.trim();
      }
      if (state.lastCommandMessage && state.lastCommandMessage.trim() !== "") {
        return state.lastCommandMessage.trim();
      }
      return text(["xox", "status", "idle"]);
    }
    function getResultLabel() {
      const state = getState();
      return text(["xox", "results", state.game.result]);
    }
    function getTurnLabel() {
      const state = getState();
      if (state.game.awaitingMoveFrom === "user") {
        return state.game.user.nickname || state.context.user.nickname;
      }
      if (state.game.awaitingMoveFrom === "ai") {
        return state.game.opponent.nickname;
      }
      return text(["xox", "turns", "idle"]);
    }
    function getSymbolsLabel() {
      const state = getState();
      const opponent = getDisplayOpponent();
      return (state.game.user.nickname || state.context.user.nickname) + " " + state.game.userSymbol + " / " + opponent.nickname + " " + state.game.aiSymbol;
    }
    function getOpenCellsLabel() {
      const state = getState();
      return state.game.availableCells.length > 0 ? state.game.availableCells.join(", ") : "-";
    }
    function getBoardCaption() {
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
    function getStarterLabelForCurrentTarget(value) {
      if (getSelectedTarget() === "us1") {
        return value === "ai" ? text(["xox", "topbar", "starterRemote"]) : text(["xox", "topbar", "starterUser"]);
      }
      return value === "ai" ? text(["xox", "topbar", "starterAi"]) : text(["xox", "topbar", "starterUser"]);
    }
    function formatInviteMeta(invite) {
      const state = getState();
      const starterLabel = invite.starter === "opponent" ? text(["xox", "invites", "starterRemote"]) : text(["xox", "invites", "starterUser"]);
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
        inviteMessage: state.preferences.inviteMessage
      });
    }
    function onReset() {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxReset", {});
    }
    function onCellClick(index) {
      const state = getState();
      if (state.game.active !== true || state.game.awaitingMoveFrom !== "user" || state.game.blockedReason) {
        return;
      }
      if (state.game.board[index] !== "") {
        return;
      }
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxUserMove", {
        cell: index
      });
    }
    function onAcceptInvite(inviteId, remoteUserId) {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxAcceptInvite", {
        inviteId,
        remoteUserId
      });
    }
    function onRejectInvite(inviteId, remoteUserId) {
      const state = getState();
      state.lastCommandMessage = "";
      sendRoomCommand("GameRoomXoxRejectInvite", {
        inviteId,
        remoteUserId
      });
    }
    function hasAuthoritativeGamePreferences() {
      const state = getState();
      return state.game.active === true || state.game.pendingInvite !== null || state.game.result !== "idle" || state.game.inviteId !== null || state.game.remoteUserId !== null;
    }
    function syncPreferencesFromGame() {
      const state = getState();
      if (hasAuthoritativeGamePreferences() !== true) {
        return;
      }
      state.preferences.target = readTarget(state.game.selectedTarget);
      state.preferences.starter = readStarter(state.game.starter);
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
      getSymbolsLabel,
      getOpenCellsLabel,
      getBoardCaption,
      getStarterLabelForCurrentTarget,
      formatInviteMeta,
      onStart,
      onReset,
      onCellClick,
      onAcceptInvite,
      onRejectInvite
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
