(function () {
  const EMPTY_BOARD = ["", "", "", "", "", "", "", "", ""];
  const COPY = {
    en: {
      roomTitle: "XOX Room",
      heroBadge: "Room Runtime",
      heroTitle: "XOX Room",
      heroSubtitle:
        "The user plays X, the AI plays O. Room and host coordination happens only through room-scoped ++cmd commands and host messages.",
      boardTitle: "Board",
      controlsTitle: "Controls",
      note: 'Use 0-8 cell indexes when sending ++cmd:XOXAIMove({"cell":N}).',
      labels: {
        turn: "Turn",
        result: "Result",
        target: "AI Slot",
        opponent: "Opponent AI slot",
      },
      results: {
        idle: "Idle",
        pending: "In progress",
        "user-win": "User won",
        "ai-win": "AI won",
        draw: "Draw",
      },
      actions: {
        start: "Start",
        reset: "Reset",
      },
      status: {
        idle: "Open the game with Start and pick the AI slot.",
        roomApiUnavailable: "Room API is not connected.",
        commandSendFailed: "The command could not be sent to the host.",
      },
    },
    tr: {
      roomTitle: "XOX Odasi",
      heroBadge: "Oda Runtime",
      heroTitle: "XOX Odasi",
      heroSubtitle:
        "Kullanici X, AI ise O oynar. Oda ve host koordinasyonu yalnizca room-scoped ++cmd komutlari ve host mesajlari ile kurulur.",
      boardTitle: "Tahta",
      controlsTitle: "Kontroller",
      note: '++cmd:XOXAIMove({"cell":N}) gonderirken 0-8 hucre indekslerini kullanin.',
      labels: {
        turn: "Sira",
        result: "Sonuc",
        target: "AI Slot",
        opponent: "Rakip AI slotu",
      },
      results: {
        idle: "Bekliyor",
        pending: "Devam ediyor",
        "user-win": "Kullanici kazandi",
        "ai-win": "AI kazandi",
        draw: "Berabere",
      },
      actions: {
        start: "Baslat",
        reset: "Sifirla",
      },
      status: {
        idle: "Baslat ile oyunu ac ve AI slotunu sec.",
        roomApiUnavailable: "Room API bagli degil.",
        commandSendFailed: "Komut host tarafina gonderilemedi.",
      },
    },
  };

  function resolveLocale(value) {
    return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
  }

  function getCopy(locale) {
    return COPY[resolveLocale(locale)];
  }

  function createInitialState(locale) {
    const normalizedLocale = resolveLocale(locale);
    return {
      board: EMPTY_BOARD.slice(),
      locale: normalizedLocale,
      target: "ai1",
      active: false,
      awaitingAI: false,
      currentTurn: "X",
      result: "idle",
      winner: "",
      status: getCopy(normalizedLocale).status.idle,
    };
  }

  function sanitizeState(candidate) {
    const source =
      candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
    const next = createInitialState(source.locale);

    if (Array.isArray(source.board) && source.board.length === 9) {
      next.board = source.board.map((value) => (value === "X" || value === "O" ? value : ""));
    }
    if (source.target === "ai2") {
      next.target = "ai2";
    }
    if (typeof source.active === "boolean") {
      next.active = source.active;
    }
    if (typeof source.awaitingAI === "boolean") {
      next.awaitingAI = source.awaitingAI;
    }
    if (source.currentTurn === "O") {
      next.currentTurn = "O";
    }
    if (typeof source.result === "string" && source.result.trim() !== "") {
      next.result = source.result;
    }
    if (typeof source.winner === "string") {
      next.winner = source.winner;
    }
    if (typeof source.status === "string" && source.status.trim() !== "") {
      next.status = source.status;
    }

    return next;
  }

  function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);
    if (typeof className === "string" && className !== "") {
      element.className = className;
    }
    if (typeof textContent === "string") {
      element.textContent = textContent;
    }
    return element;
  }

  function createButton(className, onClick) {
    const button = createElement("button", className, "");
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  function applyLocale(nextLocale) {
    activeLocale = resolveLocale(nextLocale);
    document.documentElement.lang = activeLocale;
  }

  function sendRoomCommand(command, payload) {
    if (!window.roomAPI || typeof window.roomAPI.sendCommand !== "function") {
      setStatus(getCopy(activeLocale).status.roomApiUnavailable);
      return;
    }

    const sent = window.roomAPI.sendCommand(command, payload || {});
    if (sent !== true) {
      setStatus(getCopy(activeLocale).status.commandSendFailed);
    }
  }

  function setStatus(message) {
    if (typeof message !== "string" || message.trim() === "") {
      return;
    }

    state.status = message;
    render();
  }

  function onStart() {
    sendRoomCommand("XOXStartGame", {
      target: targetSelect.value,
    });
  }

  function onReset() {
    sendRoomCommand("XOXResetGame", {
      target: targetSelect.value,
    });
  }

  function onCellClick(index) {
    if (state.active !== true || state.awaitingAI === true || state.currentTurn !== "X") {
      return;
    }
    if (state.board[index] !== "") {
      return;
    }

    sendRoomCommand("XOXUserMove", {
      cell: index,
    });
  }

  function handleHostMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    if (message.type === "host-context") {
      const payload = message.room && typeof message.room === "object" ? message : message;
      if (typeof payload.locale === "string") {
        applyLocale(payload.locale);
        render();
      }
      return;
    }

    if (message.type === "game-state") {
      const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
      state = sanitizeState(payload.state);
      applyLocale(state.locale);
      render();
      return;
    }

    if (message.type === "status") {
      const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
      if (typeof payload.message === "string") {
        setStatus(payload.message);
      }
      return;
    }

    if (message.type === "command-result") {
      const result = message.result && typeof message.result === "object" ? message.result : {};
      if (typeof result.message === "string" && result.message.trim() !== "") {
        setStatus(result.message);
      }
    }
  }

  function renderStaticCopy(copy) {
    document.title = copy.roomTitle;
    heroBadge.textContent = copy.heroBadge;
    heroTitle.textContent = copy.heroTitle;
    heroSubtitle.textContent = copy.heroSubtitle;
    boardTitle.textContent = copy.boardTitle;
    controlsTitle.textContent = copy.controlsTitle;
    turnLabel.textContent = copy.labels.turn;
    resultLabel.textContent = copy.labels.result;
    targetStatLabel.textContent = copy.labels.target;
    targetFieldLabel.textContent = copy.labels.opponent;
    note.textContent = copy.note;
    startButton.textContent = copy.actions.start;
    resetButton.textContent = copy.actions.reset;
  }

  function render() {
    const copy = getCopy(activeLocale);
    renderStaticCopy(copy);

    targetSelect.value = state.target;
    targetSelect.disabled = state.active === true;

    turnValue.textContent = state.currentTurn;
    resultValue.textContent = copy.results[state.result] ?? state.result;
    targetValue.textContent = state.target.toUpperCase();
    statusValue.textContent = state.status;

    startButton.disabled = state.active === true;
    resetButton.disabled = false;

    boardButtons.forEach((button, index) => {
      const symbol = state.board[index];
      button.textContent = symbol;
      button.dataset.symbol = symbol;
      button.dataset.empty = symbol === "" ? "true" : "false";
      button.disabled =
        state.active !== true ||
        state.awaitingAI === true ||
        state.currentTurn !== "X" ||
        symbol !== "";
    });
  }

  const app = document.getElementById("app");
  let activeLocale = resolveLocale(document.documentElement.lang || navigator.language);
  let state = createInitialState(activeLocale);

  if (!app) {
    return;
  }

  const root = createElement("main", "xox-app", "");

  const hero = createElement("section", "xox-hero", "");
  const heroBadge = createElement("div", "xox-badge", "");
  const heroTitle = createElement("h1", "", "");
  const heroSubtitle = createElement("p", "", "");
  hero.append(heroBadge, heroTitle, heroSubtitle);

  const layout = createElement("section", "xox-layout", "");

  const boardPanel = createElement("section", "xox-panel", "");
  const boardTitle = createElement("h2", "", "");
  const meta = createElement("div", "xox-meta", "");

  function createStat() {
    const stat = createElement("div", "xox-stat", "");
    const labelEl = createElement("span", "xox-stat-label", "");
    const valueEl = createElement("span", "xox-stat-value", "");
    stat.append(labelEl, valueEl);
    meta.append(stat);
    return { labelEl, valueEl };
  }

  const turnStat = createStat();
  const resultStat = createStat();
  const targetStat = createStat();
  const turnLabel = turnStat.labelEl;
  const turnValue = turnStat.valueEl;
  const resultLabel = resultStat.labelEl;
  const resultValue = resultStat.valueEl;
  const targetStatLabel = targetStat.labelEl;
  const targetValue = targetStat.valueEl;

  const statusValue = createElement("div", "xox-status", "");
  const board = createElement("div", "xox-board", "");
  const boardButtons = Array.from({ length: 9 }, function (_value, index) {
    const button = createElement("button", "xox-cell", "");
    button.type = "button";
    button.dataset.index = String(index);
    button.dataset.empty = "true";
    button.addEventListener("click", function () {
      onCellClick(index);
    });
    board.append(button);
    return button;
  });
  const note = createElement("p", "xox-note", "");

  boardPanel.append(boardTitle, meta, statusValue, board, note);

  const controlsPanel = createElement("section", "xox-panel", "");
  const controlsTitle = createElement("h2", "", "");
  const controls = createElement("div", "xox-controls", "");
  const targetField = createElement("div", "xox-field", "");
  const targetFieldLabel = createElement("label", "", "");
  const targetSelect = createElement("select", "xox-select", "");
  targetSelect.id = "xox-target-select";
  targetFieldLabel.htmlFor = targetSelect.id;
  targetSelect.innerHTML = ['<option value="ai1">AI1</option>', '<option value="ai2">AI2</option>'].join(
    ""
  );
  targetSelect.addEventListener("change", function () {
    state.target = targetSelect.value === "ai2" ? "ai2" : "ai1";
    render();
  });
  targetField.append(targetFieldLabel, targetSelect);

  const actions = createElement("div", "xox-actions", "");
  const startButton = createButton("xox-button", onStart);
  const resetButton = createButton("xox-button xox-button--ghost", onReset);
  actions.append(startButton, resetButton);

  controls.append(targetField, actions);
  controlsPanel.append(controlsTitle, controls);

  layout.append(boardPanel, controlsPanel);
  root.append(hero, layout);
  app.replaceChildren(root);

  if (window.roomAPI && typeof window.roomAPI.onHostMessage === "function") {
    window.roomAPI.onHostMessage(handleHostMessage);
  } else {
    setStatus(getCopy(activeLocale).status.roomApiUnavailable);
  }

  render();

  if (window.roomAPI && typeof window.roomAPI.ready === "function") {
    window.roomAPI.ready({
      stage: "ui-ready",
      room: "xox",
    });
  }
})();
