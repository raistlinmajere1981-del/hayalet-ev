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
      ready: source.ready === true || (source.assigned === true && source.connected === true && source.urlExcluded !== true),
      state:
        typeof source.state === "string" && source.state.trim() !== "" ? source.state.trim() : "empty",
      urlExcluded: source.urlExcluded === true,
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
    next.selectedTarget = source.selectedTarget === "ai2" ? "ai2" : "ai1";
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
    return [state.context.slots.ai1, state.context.slots.ai2];
  }

  function getSlotStatusLabel(slot) {
    if (slot.ready === true) {
      return text(["xox", "slotState", "ready"]);
    }
    if (slot.connected === true || slot.state === "connected" || slot.state === "connecting") {
      return text(["xox", "slotState", "disconnected"]);
    }
    if (slot.assigned === true) {
      return text(["xox", "slotState", "assigned"]);
    }
    return text(["xox", "slotState", "empty"]);
  }

  function getSelectedTarget() {
    const current = state.preferences.target === "ai2" ? "ai2" : "ai1";
    const targetSlot = state.context.slots[current];
    if (targetSlot && (targetSlot.ready || targetSlot.assigned)) {
      return current;
    }

    const readySlot = getSlotOrder().find(function (slot) {
      return slot.ready === true;
    });
    if (readySlot) {
      return readySlot.slotId;
    }

    const assignedSlot = getSlotOrder().find(function (slot) {
      return slot.assigned === true;
    });
    return assignedSlot ? assignedSlot.slotId : current;
  }

  function getDisplayOpponent() {
    if (state.game.active === true) {
      return state.game.opponent;
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

  function syncPreferencesFromGame() {
    state.preferences.target = state.game.selectedTarget === "ai2" ? "ai2" : "ai1";
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
    const canStart = selectedSlot.ready === true && state.game.active !== true;
    const canReset = isRoomApiAvailable();
    const canUserMove =
      state.game.active === true && state.game.awaitingMoveFrom === "user" && !state.game.blockedReason;

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
        state.game.active === true
      );
      button.addEventListener("click", function () {
        state.preferences.target = slot.slotId === "ai2" ? "ai2" : "ai1";
        render();
      });
      opponentChoices.append(button);
    });
    opponentPanel.append(opponentChoices);

    const starterPanel = createElement("section", "xox-panel", "");
    starterPanel.append(createElement("p", "xox-panel__label", text(["xox", "topbar", "starterLabel"])));
    const starterChoices = createElement("div", "xox-toggle-row", "");
    [
      { value: "user", label: text(["xox", "topbar", "starterUser"]) },
      { value: "ai", label: text(["xox", "topbar", "starterAi"]) },
    ].forEach(function (entry) {
      const button = createChoiceButton(
        entry.label,
        "",
        state.preferences.starter === entry.value,
        state.game.active === true
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
    const actionGroup = createElement("div", "xox-actions", "");
    const startButton = createElement("button", "xox-button xox-button--primary", text(["xox", "topbar", "start"]));
    startButton.type = "button";
    startButton.disabled = !canStart;
    startButton.addEventListener("click", onStart);
    const resetButton = createElement("button", "xox-button xox-button--ghost", text(["xox", "topbar", "reset"]));
    resetButton.type = "button";
    resetButton.disabled = !canReset;
    resetButton.addEventListener("click", onReset);
    actionGroup.append(startButton, resetButton);
    actionPanel.append(featurePill, actionGroup);

    rail.append(opponentPanel, starterPanel, actionPanel);

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
      state.context = normalizeContext(message);
      state.preferences.target = getSelectedTarget();
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
