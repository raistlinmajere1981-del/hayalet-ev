(function () {
  const ROOM_ID = "game-room";
  const FEATURE_ID = "xox";
  const EMPTY_BOARD = ["", "", "", "", "", "", "", "", ""];
  const EMPTY_ASCII = "0 | 1 | 2\n---------\n3 | 4 | 5\n---------\n6 | 7 | 8";

  const BOOTSTRAP_COPY = {
    en: {
      roomTitle: "Game Room",
      loadingTitle: "Loading Game Room",
      loadingBody: "Waiting for room context and translations.",
      userLabel: "User",
      roomApiUnavailable: "Room API bridge is not connected.",
      commandSendFailed: "The command could not be sent to the room host.",
    },
    tr: {
      roomTitle: "Oyun Odasi",
      loadingTitle: "Oyun Odasi Yukleniyor",
      loadingBody: "Oda baglami ve ceviriler bekleniyor.",
      userLabel: "Kullanici",
      roomApiUnavailable: "Room API koprusu bagli degil.",
      commandSendFailed: "Komut oda host'una gonderilemedi.",
    },
  };

  function resolveLocale(value) {
    return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
  }

  function createSlot(slotId) {
    return {
      slotId: slotId,
      nickname: slotId.toUpperCase(),
      assigned: false,
      connected: false,
      ready: false,
      state: "empty",
      urlExcluded: false,
      remoteUserId: null,
    };
  }

  function createInviteEntry() {
    return {
      roomId: ROOM_ID,
      featureId: FEATURE_ID,
      inviteId: "",
      remoteUserId: "",
      nickname: "US1",
      senderEmail: "",
      note: "",
      starter: "user",
      localSessionId: "",
      conversationId: "",
      sentAt: null,
    };
  }

  function createContext() {
    return {
      room: {
        id: ROOM_ID,
        name: BOOTSTRAP_COPY.en.roomTitle,
      },
      user: {
        nickname: BOOTSTRAP_COPY.en.userLabel,
      },
      slots: {
        ai1: createSlot("ai1"),
        ai2: createSlot("ai2"),
        us1: createSlot("us1"),
      },
    };
  }

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
        nickname: "User",
      },
    };
  }

  const state = {
    locale: resolveLocale(document.documentElement.lang || navigator.language),
    translations: null,
    context: createContext(),
    game: createGameState(),
    presentation: {
      mode: "scene-view",
    },
    preferences: {
      target: "ai1",
      starter: "user",
      inviteMessage: "",
    },
    lastCommandMessage: "",
  };

  function readPath(source, path) {
    let current = source;
    for (let index = 0; index < path.length; index += 1) {
      const key = path[index];
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = current[key];
    }
    return typeof current === "string" ? current : undefined;
  }

  function text(path) {
    return readPath(state.translations, path) || path.join(".");
  }

  function bootstrapText(key) {
    return (
      readPath(BOOTSTRAP_COPY[state.locale], [key]) ||
      readPath(BOOTSTRAP_COPY.en, [key]) ||
      key
    );
  }

  function normalizePresentationMode(value) {
    return value === "scene-view" ? "scene-view" : "classic";
  }

  function applyPresentationMode(mode) {
    state.presentation.mode = normalizePresentationMode(mode);
    document.body.dataset.presentationMode = state.presentation.mode;
    document.documentElement.dataset.presentationMode = state.presentation.mode;
  }

  function statusText(key) {
    return (
      readPath(state.translations, ["xox", "status", key]) ||
      bootstrapText(key === "roomApiUnavailable" ? "roomApiUnavailable" : "commandSendFailed")
    );
  }

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (textContent !== undefined) {
      element.textContent = textContent;
    }
    return element;
  }

  function normalizeSlot(candidate, slotId) {
    const source =
      candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
    return {
      slotId: slotId,
      nickname:
        typeof source.nickname === "string" && source.nickname.trim() !== ""
          ? source.nickname.trim()
          : slotId.toUpperCase(),
      assigned: source.assigned === true,
      connected: source.connected === true,
      ready:
        source.ready === true ||
        (source.assigned === true && source.connected === true && source.urlExcluded !== true),
      state:
        typeof source.state === "string" && source.state.trim() !== "" ? source.state.trim() : "empty",
      urlExcluded: source.urlExcluded === true,
      remoteUserId:
        typeof source.remoteUserId === "string" && source.remoteUserId.trim() !== ""
          ? source.remoteUserId.trim()
          : null,
    };
  }

  function normalizeInviteEntry(candidate) {
    const source =
      candidate && typeof candidate === "object" && Array.isArray(candidate) === false
        ? candidate
        : {};
    const entry = createInviteEntry();
    entry.roomId =
      typeof source.roomId === "string" && source.roomId.trim() !== ""
        ? source.roomId.trim()
        : ROOM_ID;
    entry.featureId =
      typeof source.featureId === "string" && source.featureId.trim() !== ""
        ? source.featureId.trim()
        : FEATURE_ID;
    entry.inviteId =
      typeof source.inviteId === "string" && source.inviteId.trim() !== ""
        ? source.inviteId.trim()
        : "";
    entry.remoteUserId =
      typeof source.remoteUserId === "string" && source.remoteUserId.trim() !== ""
        ? source.remoteUserId.trim()
        : "";
    entry.nickname =
      typeof source.nickname === "string" && source.nickname.trim() !== ""
        ? source.nickname.trim()
        : typeof source.senderNickname === "string" && source.senderNickname.trim() !== ""
          ? source.senderNickname.trim()
          : "US1";
    entry.senderEmail =
      typeof source.senderEmail === "string" && source.senderEmail.trim() !== ""
        ? source.senderEmail.trim()
        : "";
    entry.note =
      typeof source.note === "string" && source.note.trim() !== "" ? source.note.trim() : "";
    entry.starter = source.starter === "opponent" ? "opponent" : "user";
    entry.localSessionId =
      typeof source.localSessionId === "string" && source.localSessionId.trim() !== ""
        ? source.localSessionId.trim()
        : "";
    entry.conversationId =
      typeof source.conversationId === "string" && source.conversationId.trim() !== ""
        ? source.conversationId.trim()
        : "";
    entry.sentAt =
      typeof source.sentAt === "number" && Number.isFinite(source.sentAt) && source.sentAt >= 0
        ? Math.trunc(source.sentAt)
        : null;
    return entry;
  }

  function normalizeInviteInbox(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(function (entry) {
        return normalizeInviteEntry(entry);
      })
      .filter(function (entry) {
        return entry.inviteId !== "" && entry.remoteUserId !== "";
      });
  }

  function normalizePendingInvite(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const entry = normalizeInviteEntry(value);
    if (entry.inviteId === "" || entry.remoteUserId === "") {
      return null;
    }
    return {
      direction: value.direction === "incoming" ? "incoming" : "outgoing",
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

  function normalizeContext(payload) {
    const source =
      payload && typeof payload === "object" && Array.isArray(payload) === false ? payload : {};
    const slotsSource =
      source.slots && typeof source.slots === "object" && Array.isArray(source.slots) === false
        ? source.slots
        : {};
    const roomSource =
      source.room && typeof source.room === "object" && Array.isArray(source.room) === false
        ? source.room
        : {};
    const userSource =
      source.user && typeof source.user === "object" && Array.isArray(source.user) === false
        ? source.user
        : {};

    return {
      room: {
        id: typeof roomSource.id === "string" && roomSource.id.trim() !== "" ? roomSource.id.trim() : ROOM_ID,
        name:
          typeof roomSource.name === "string" && roomSource.name.trim() !== ""
            ? roomSource.name.trim()
            : bootstrapText("roomTitle"),
      },
      user: {
        nickname:
          typeof userSource.nickname === "string" && userSource.nickname.trim() !== ""
            ? userSource.nickname.trim()
            : bootstrapText("userLabel"),
      },
      slots: {
        ai1: normalizeSlot(slotsSource.ai1, "ai1"),
        ai2: normalizeSlot(slotsSource.ai2, "ai2"),
        us1: normalizeSlot(slotsSource.us1, "us1"),
      },
    };
  }

  function sanitizeGameState(candidate) {
    const source =
      candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
    const next = createGameState();
    if (Array.isArray(source.board) && source.board.length === 9) {
      next.board = source.board.map(function (value) {
        return value === "X" || value === "O" ? value : "";
      });
    }
    if (typeof source.boardAscii === "string" && source.boardAscii.trim() !== "") {
      next.boardAscii = source.boardAscii;
    }
    if (Array.isArray(source.availableCells)) {
      next.availableCells = source.availableCells.filter(function (value) {
        return typeof value === "number" && Number.isInteger(value);
      });
    }
    next.active = source.active === true;
    next.awaitingMoveFrom =
      source.awaitingMoveFrom === "user" || source.awaitingMoveFrom === "ai"
        ? source.awaitingMoveFrom
        : null;
    next.result =
      typeof source.result === "string" && source.result.trim() !== "" ? source.result.trim() : "idle";
    next.winner = source.winner === "user" || source.winner === "ai" ? source.winner : "";
    next.selectedTarget =
      source.selectedTarget === "ai2" || source.selectedTarget === "us1" ? source.selectedTarget : "ai1";
    next.starter = source.starter === "ai" ? "ai" : "user";
    next.userSymbol = source.userSymbol === "O" ? "O" : "X";
    next.aiSymbol = source.aiSymbol === "X" ? "X" : "O";
    next.status =
      typeof source.status === "string" && source.status.trim() !== ""
        ? source.status.trim()
        : "";
    next.blockedReason =
      typeof source.blockedReason === "string" && source.blockedReason.trim() !== ""
        ? source.blockedReason.trim()
        : "";
    next.protocolDelivered = source.protocolDelivered === true;
    next.opponentReady = source.opponentReady === true;
    next.inviteId =
      typeof source.inviteId === "string" && source.inviteId.trim() !== "" ? source.inviteId.trim() : null;
    next.localSessionId =
      typeof source.localSessionId === "string" && source.localSessionId.trim() !== ""
        ? source.localSessionId.trim()
        : null;
    next.remoteUserId =
      typeof source.remoteUserId === "string" && source.remoteUserId.trim() !== ""
        ? source.remoteUserId.trim()
        : null;
    next.pendingInvite = normalizePendingInvite(source.pendingInvite);
    next.inviteInbox = normalizeInviteInbox(source.inviteInbox);
    next.opponent = normalizeSlot(source.opponent, next.selectedTarget);
    if (source.user && typeof source.user === "object" && Array.isArray(source.user) === false) {
      next.user.nickname =
        typeof source.user.nickname === "string" && source.user.nickname.trim() !== ""
          ? source.user.nickname.trim()
          : next.user.nickname;
    }
    return next;
  }

  function applyLocale(nextLocale) {
    state.locale = resolveLocale(nextLocale);
    document.documentElement.lang = state.locale;
  }

  function getSlotOrder() {
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
    const preferred = state.preferences.target;
    if (preferred === "ai1" || preferred === "ai2" || preferred === "us1") {
      return preferred;
    }
    return "ai1";
  }

  function getDisplayOpponent() {
    if (state.game.active === true) {
      return state.game.opponent;
    }
    if (state.game.pendingInvite && state.game.pendingInvite.nickname) {
      return {
        slotId: "us1",
        nickname: state.game.pendingInvite.nickname,
      };
    }
    return state.context.slots[getSelectedTarget()] || state.context.slots.ai1;
  }

  function getCurrentStatus() {
    if (state.game.status && state.game.status.trim() !== "") {
      return state.game.status.trim();
    }
    if (state.lastCommandMessage && state.lastCommandMessage.trim() !== "") {
      return state.lastCommandMessage.trim();
    }
    return text(["xox", "status", "idle"]);
  }

  function getResultLabel() {
    return text(["xox", "results", state.game.result]);
  }

  function getTurnLabel() {
    if (state.game.awaitingMoveFrom === "user") {
      return state.game.user.nickname || state.context.user.nickname;
    }
    if (state.game.awaitingMoveFrom === "ai") {
      return state.game.opponent.nickname;
    }
    return text(["xox", "turns", "idle"]);
  }

  function getSymbolsLabel() {
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

  function getOpenCellsLabel() {
    return state.game.availableCells.length > 0 ? state.game.availableCells.join(", ") : "-";
  }

  function getBoardCaption() {
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
      return value === "ai"
        ? text(["xox", "topbar", "starterRemote"])
        : text(["xox", "topbar", "starterUser"]);
    }
    return value === "ai"
      ? text(["xox", "topbar", "starterAi"])
      : text(["xox", "topbar", "starterUser"]);
  }

  function formatInviteMeta(invite) {
    const starterLabel =
      invite.starter === "opponent"
        ? text(["xox", "invites", "starterRemote"])
        : text(["xox", "invites", "starterUser"]);
    if (invite.sentAt === null) {
      return starterLabel;
    }
    return starterLabel + " • " + new Date(invite.sentAt).toLocaleString(state.locale);
  }

  function isRoomApiAvailable() {
    return !!(window.roomAPI && typeof window.roomAPI.sendCommand === "function");
  }

  function sendRoomCommand(command, payload) {
    if (!isRoomApiAvailable()) {
      state.lastCommandMessage = statusText("roomApiUnavailable");
      render();
      return;
    }

    const sent = window.roomAPI.sendCommand(command, payload || {});
    if (sent !== true) {
      state.lastCommandMessage = statusText("commandSendFailed");
      render();
    }
  }

  function onStart() {
    state.lastCommandMessage = "";
    sendRoomCommand("GameRoomXoxStart", {
      target: getSelectedTarget(),
      starter: state.preferences.starter === "ai" ? "ai" : "user",
      inviteMessage: state.preferences.inviteMessage,
    });
  }

  function onReset() {
    state.lastCommandMessage = "";
    sendRoomCommand("GameRoomXoxReset", {});
  }

  function onCellClick(index) {
    if (state.game.active !== true || state.game.awaitingMoveFrom !== "user" || state.game.blockedReason) {
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

  function onAcceptInvite(inviteId, remoteUserId) {
    state.lastCommandMessage = "";
    sendRoomCommand("GameRoomXoxAcceptInvite", {
      inviteId: inviteId,
      remoteUserId: remoteUserId,
    });
  }

  function onRejectInvite(inviteId, remoteUserId) {
    state.lastCommandMessage = "";
    sendRoomCommand("GameRoomXoxRejectInvite", {
      inviteId: inviteId,
      remoteUserId: remoteUserId,
    });
  }

  function syncPreferencesFromGame() {
    state.preferences.target =
      state.game.selectedTarget === "ai2" || state.game.selectedTarget === "us1"
        ? state.game.selectedTarget
        : "ai1";
    state.preferences.starter = state.game.starter === "ai" ? "ai" : "user";
  }

  function createStatCard(label, value) {
    const card = createElement("div", "xox-stat", "");
    card.append(createElement("span", "xox-stat__label", label), createElement("strong", "xox-stat__value", value));
    return card;
  }

  function createChoiceButton(title, meta, selected, disabled) {
    const button = createElement("button", "xox-choice-button", "");
    button.type = "button";
    button.disabled = disabled;
    button.dataset.selected = selected ? "true" : "false";
    button.append(createElement("span", "xox-choice-button__title", title));
    if (meta && meta.trim() !== "") {
      button.append(createElement("span", "xox-choice-button__meta", meta));
    }
    return button;
  }

  function createSeatCard(label, name, symbol, current) {
    const card = createElement("div", "xox-seat", "");
    card.dataset.current = current ? "true" : "false";
    card.dataset.tone = symbol === "O" ? "o" : "x";
    card.append(
      createElement("span", "xox-seat__label", label),
      createElement("strong", "xox-seat__name", name),
      createElement("span", "xox-seat__symbol", symbol)
    );
    return card;
  }

  function renderBootstrap(root) {
    const app = createElement("main", "xox-shell xox-shell--bootstrap", "");
    app.dataset.presentationMode = state.presentation.mode;
    const surface = createElement("section", "xox-surface xox-surface--bootstrap", "");
    const brand = createElement("div", "xox-brand", "");
    brand.append(
      createElement("div", "xox-brand__eyebrow", bootstrapText("roomTitle")),
      createElement("h1", "xox-brand__title", bootstrapText("loadingTitle")),
      createElement(
        "p",
        "xox-brand__subtitle",
        state.lastCommandMessage && state.lastCommandMessage.trim() !== ""
          ? state.lastCommandMessage.trim()
          : bootstrapText("loadingBody")
      )
    );
    surface.append(brand);
    app.append(surface);
    document.title = bootstrapText("roomTitle");
    root.replaceChildren(app);
  }

  function renderInviteInbox(canRespond) {
    const panel = createElement("section", "xox-panel xox-panel--invites", "");
    panel.append(createElement("p", "xox-panel__label", text(["xox", "invites", "title"])));

    if (state.game.pendingInvite && state.game.pendingInvite.direction === "outgoing") {
      const pending = createElement("div", "xox-invite-card xox-invite-card--pending", "");
      pending.append(
        createElement("strong", "xox-invite-card__title", state.game.pendingInvite.nickname),
        createElement("p", "xox-invite-card__meta", text(["xox", "invites", "pendingOutgoing"])),
        createElement(
          "p",
          "xox-invite-card__message",
          state.game.pendingInvite.note || text(["xox", "invites", "messageFallback"])
        )
      );
      panel.append(pending);
    }

    if (state.game.inviteInbox.length === 0) {
      panel.append(createElement("p", "xox-panel__empty", text(["xox", "invites", "empty"])));
      return panel;
    }

    const list = createElement("div", "xox-invite-list", "");
    state.game.inviteInbox.forEach(function (invite) {
      const card = createElement("article", "xox-invite-card", "");
      const actions = createElement("div", "xox-invite-card__actions", "");
      const acceptButton = createElement("button", "xox-button xox-button--primary", text(["xox", "invites", "accept"]));
      acceptButton.type = "button";
      acceptButton.disabled = !canRespond;
      acceptButton.addEventListener("click", function () {
        onAcceptInvite(invite.inviteId, invite.remoteUserId);
      });
      const rejectButton = createElement("button", "xox-button xox-button--ghost", text(["xox", "invites", "reject"]));
      rejectButton.type = "button";
      rejectButton.disabled = !canRespond;
      rejectButton.addEventListener("click", function () {
        onRejectInvite(invite.inviteId, invite.remoteUserId);
      });
      actions.append(acceptButton, rejectButton);
      card.append(
        createElement("strong", "xox-invite-card__title", invite.nickname),
        createElement("p", "xox-invite-card__meta", formatInviteMeta(invite)),
        createElement(
          "p",
          "xox-invite-card__message",
          invite.note || text(["xox", "invites", "messageFallback"])
        ),
        actions
      );
      list.append(card);
    });
    panel.append(list);
    return panel;
  }

  function render() {
    const root = document.getElementById("app");
    if (!root) {
      return;
    }

    if (!state.translations) {
      renderBootstrap(root);
      return;
    }

    document.title = state.context.room.name + " - " + text(["features", FEATURE_ID]);

    const selectedTarget = getSelectedTarget();
    const selectedSlot = state.context.slots[selectedTarget] || state.context.slots.ai1;
    const displayOpponent = getDisplayOpponent();
    const hasPendingOutgoingInvite =
      !!state.game.pendingInvite && state.game.pendingInvite.direction === "outgoing";
    const canStart = selectedSlot.ready === true && state.game.active !== true && !hasPendingOutgoingInvite;
    const canReset = isRoomApiAvailable();
    const canUserMove =
      state.game.active === true && state.game.awaitingMoveFrom === "user" && !state.game.blockedReason;
    const canRespondToInvites = state.game.active !== true && !hasPendingOutgoingInvite;

    const app = createElement("main", "xox-shell", "");
    app.dataset.presentationMode = state.presentation.mode;
    const surface = createElement("section", "xox-surface", "");

    const arena = createElement("section", "xox-arena", "");
    const rail = createElement("aside", "xox-rail", "");

    const opponentPanel = createElement("section", "xox-panel", "");
    opponentPanel.append(createElement("p", "xox-panel__label", text(["xox", "topbar", "opponentLabel"])));
    const opponentChoices = createElement("div", "xox-choice-grid", "");
    getSlotOrder().forEach(function (slot) {
      const button = createChoiceButton(
        slot.nickname,
        slot.slotId.toUpperCase() + " / " + getSlotStatusLabel(slot),
        slot.slotId === selectedTarget,
        state.game.active === true || hasPendingOutgoingInvite
      );
      button.addEventListener("click", function () {
        state.preferences.target = slot.slotId;
        render();
      });
      opponentChoices.append(button);
    });
    opponentPanel.append(opponentChoices);

    const starterPanel = createElement("section", "xox-panel", "");
    starterPanel.append(createElement("p", "xox-panel__label", text(["xox", "topbar", "starterLabel"])));
    const starterChoices = createElement("div", "xox-toggle-row", "");
    [
      { value: "user", label: getStarterLabelForCurrentTarget("user") },
      { value: "ai", label: getStarterLabelForCurrentTarget("ai") },
    ].forEach(function (entry) {
      const button = createChoiceButton(
        entry.label,
        "",
        state.preferences.starter === entry.value,
        state.game.active === true || hasPendingOutgoingInvite
      );
      button.addEventListener("click", function () {
        state.preferences.starter = entry.value === "ai" ? "ai" : "user";
        render();
      });
      starterChoices.append(button);
    });
    starterPanel.append(starterChoices);

    const actionPanel = createElement("section", "xox-panel xox-panel--actions", "");
    actionPanel.append(createElement("p", "xox-panel__label", text(["xox", "topbar", "featureLabel"])));
    const featurePill = createElement("div", "xox-feature-pill", text(["features", FEATURE_ID]));
    const inviteFieldLabel = createElement("label", "xox-field", "");
    inviteFieldLabel.append(createElement("span", "xox-field__label", text(["xox", "topbar", "inviteMessageLabel"])));
    const inviteField = document.createElement("textarea");
    inviteField.className = "xox-textarea";
    inviteField.rows = 4;
    inviteField.placeholder = text(["xox", "topbar", "inviteMessagePlaceholder"]);
    inviteField.value = state.preferences.inviteMessage;
    inviteField.disabled = state.game.active === true || hasPendingOutgoingInvite;
    inviteField.addEventListener("input", function () {
      state.preferences.inviteMessage = inviteField.value;
    });
    inviteFieldLabel.append(inviteField);
    const actionHint = createElement(
      "p",
      "xox-panel__hint",
      selectedTarget === "us1"
        ? text(["xox", "topbar", "inviteMessageHintUs1"])
        : text(["xox", "topbar", "inviteMessageHintAi"])
    );
    const actionGroup = createElement("div", "xox-actions", "");
    const startButton = createElement(
      "button",
      "xox-button xox-button--primary",
      selectedTarget === "us1"
        ? text(["xox", "topbar", "sendInvite"])
        : text(["xox", "topbar", "start"])
    );
    startButton.type = "button";
    startButton.disabled = !canStart;
    startButton.addEventListener("click", onStart);
    const resetButton = createElement("button", "xox-button xox-button--ghost", text(["xox", "topbar", "reset"]));
    resetButton.type = "button";
    resetButton.disabled = !canReset;
    resetButton.addEventListener("click", onReset);
    actionGroup.append(startButton, resetButton);
    actionPanel.append(featurePill, inviteFieldLabel, actionHint, actionGroup);

    rail.append(opponentPanel, starterPanel, actionPanel, renderInviteInbox(canRespondToInvites));

    const stage = createElement("section", "xox-stage", "");
    const scorebar = createElement("div", "xox-scorebar", "");
    scorebar.append(
      createStatCard(text(["xox", "board", "statusLabel"]), getCurrentStatus()),
      createStatCard(text(["xox", "board", "turnLabel"]), getTurnLabel()),
      createStatCard(text(["xox", "board", "resultLabel"]), getResultLabel()),
      createStatCard(text(["xox", "board", "symbolsLabel"]), getSymbolsLabel())
    );

    const boardWrap = createElement("div", "xox-board-wrap", "");
    boardWrap.append(
      createSeatCard(
        text(["xox", "turns", "user"]),
        state.game.user.nickname || state.context.user.nickname,
        state.game.userSymbol,
        state.game.awaitingMoveFrom === "user"
      )
    );

    const boardShell = createElement("div", "xox-board-shell", "");
    const board = createElement("div", "xox-board", "");
    state.game.board.forEach(function (symbol, index) {
      const cell = createElement("button", "xox-cell", symbol);
      cell.type = "button";
      cell.dataset.index = String(index);
      cell.dataset.symbol = symbol;
      cell.dataset.empty = symbol === "" ? "true" : "false";
      cell.disabled = !canUserMove || symbol !== "";
      cell.addEventListener("click", function () {
        onCellClick(index);
      });
      board.append(cell);
    });
    boardShell.append(board);
    boardWrap.append(boardShell);

    boardWrap.append(
      createSeatCard(
        text(["xox", "turns", "ai"]),
        displayOpponent.nickname,
        state.game.aiSymbol,
        state.game.awaitingMoveFrom === "ai"
      )
    );

    const footer = createElement("div", "xox-stage-footer", "");
    footer.append(
      createElement("p", "xox-stage-footer__message", getBoardCaption()),
      createElement(
        "p",
        "xox-stage-footer__meta",
        text(["xox", "board", "cellsLabel"]) + ": " + getOpenCellsLabel()
      )
    );

    stage.append(scorebar, boardWrap, footer);
    arena.append(rail, stage);
    surface.append(arena);
    app.append(surface);
    root.replaceChildren(app);
  }

  function handleHostMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    if (message.type === "host-context") {
      const presentation =
        message.presentation && typeof message.presentation === "object" && Array.isArray(message.presentation) === false
          ? message.presentation
          : {};
      applyPresentationMode(presentation.mode);
      if (typeof message.locale === "string") {
        applyLocale(message.locale);
      }
      if (message.translations && typeof message.translations === "object" && Array.isArray(message.translations) === false) {
        state.translations = message.translations;
      }
      const previousTarget = state.preferences.target;
      state.context = normalizeContext(message);
      state.preferences.target =
        previousTarget === "ai1" || previousTarget === "ai2" || previousTarget === "us1"
          ? previousTarget
          : getSelectedTarget();
      render();
      return;
    }

    if (message.type === "xox-state") {
      const payload =
        message.payload && typeof message.payload === "object" && Array.isArray(message.payload) === false
          ? message.payload
          : {};
      state.game = sanitizeGameState(payload.state);
      syncPreferencesFromGame();
      state.lastCommandMessage = "";
      render();
      return;
    }

    if (message.type === "command-result") {
      const result =
        message.result && typeof message.result === "object" && Array.isArray(message.result) === false
          ? message.result
          : {};
      if (typeof result.message === "string" && result.message.trim() !== "") {
        state.lastCommandMessage = result.message.trim();
      }
      render();
    }
  }

  if (window.roomAPI && typeof window.roomAPI.onHostMessage === "function") {
    window.roomAPI.onHostMessage(handleHostMessage);
  } else {
    state.lastCommandMessage = bootstrapText("roomApiUnavailable");
  }

  applyPresentationMode(state.presentation.mode);
  applyLocale(state.locale);
  render();

  if (window.roomAPI && typeof window.roomAPI.ready === "function") {
    window.roomAPI.ready({
      room: ROOM_ID,
      feature: FEATURE_ID,
      stage: "ui-ready",
    });
  }
})();
