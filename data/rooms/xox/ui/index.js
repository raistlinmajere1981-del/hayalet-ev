(function () {
  const EMPTY_BOARD = ["", "", "", "", "", "", "", "", ""];

  function createInitialState() {
    return {
      board: EMPTY_BOARD.slice(),
      target: "ai1",
      active: false,
      awaitingAI: false,
      currentTurn: "X",
      result: "idle",
      winner: "",
      status: "Baslat ile oyunu ac ve AI slotunu sec.",
    };
  }

  function sanitizeState(candidate) {
    const next = createInitialState();
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return next;
    }

    const source = candidate;
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

  function createButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function sendRoomCommand(command, payload) {
    if (!window.roomAPI || typeof window.roomAPI.sendCommand !== "function") {
      setStatus("Room API bagli degil.");
      return;
    }

    const sent = window.roomAPI.sendCommand(command, payload || {});
    if (sent !== true) {
      setStatus("Komut host tarafina gonderilemedi.");
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

    if (message.type === "game-state") {
      const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
      state = sanitizeState(payload.state);
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

  function render() {
    targetSelect.value = state.target;
    targetSelect.disabled = state.active === true;

    turnValue.textContent = state.currentTurn;
    resultValue.textContent = state.result;
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
  let state = createInitialState();

  if (!app) {
    return;
  }

  const root = document.createElement("main");
  root.className = "xox-app";

  const hero = document.createElement("section");
  hero.className = "xox-hero";
  hero.innerHTML = [
    '<div class="xox-badge">Room Runtime</div>',
    "<h1>XOX Room</h1>",
    "<p>Kullanici X, AI ise O oynar. Oda ile host iletisimi yalnizca room-scoped ++cmd komutlari ve host mesajlari ile kurulur.</p>",
  ].join("");

  const layout = document.createElement("section");
  layout.className = "xox-layout";

  const boardPanel = document.createElement("section");
  boardPanel.className = "xox-panel";
  boardPanel.innerHTML = "<h2>Tahta</h2>";

  const meta = document.createElement("div");
  meta.className = "xox-meta";

  function createStat(label) {
    const stat = document.createElement("div");
    stat.className = "xox-stat";
    const labelEl = document.createElement("span");
    labelEl.className = "xox-stat-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "xox-stat-value";
    stat.append(labelEl, valueEl);
    meta.append(stat);
    return valueEl;
  }

  const turnValue = createStat("Sira");
  const resultValue = createStat("Sonuc");
  const targetValue = createStat("AI Slot");

  const statusValue = document.createElement("div");
  statusValue.className = "xox-status";

  const board = document.createElement("div");
  board.className = "xox-board";

  const boardButtons = Array.from({ length: 9 }, function (_value, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "xox-cell";
    button.dataset.index = String(index);
    button.dataset.empty = "true";
    button.addEventListener("click", function () {
      onCellClick(index);
    });
    board.append(button);
    return button;
  });

  const note = document.createElement("p");
  note.className = "xox-note";
  note.textContent =
    "Bos hucreler indeks etiketi ile gosterilir. AI cevabi tek satirlik ++cmd:XOXAIMove({\"cell\":N}) formunda beklenir.";

  boardPanel.append(meta, statusValue, board, note);

  const controlsPanel = document.createElement("section");
  controlsPanel.className = "xox-panel";
  controlsPanel.innerHTML = "<h2>Kontroller</h2>";

  const controls = document.createElement("div");
  controls.className = "xox-controls";

  const targetField = document.createElement("div");
  targetField.className = "xox-field";
  const targetLabel = document.createElement("label");
  targetLabel.textContent = "Rakip AI slotu";
  const targetSelect = document.createElement("select");
  targetSelect.className = "xox-select";
  targetSelect.innerHTML = [
    '<option value="ai1">AI1</option>',
    '<option value="ai2">AI2</option>',
  ].join("");
  targetSelect.addEventListener("change", function () {
    state.target = targetSelect.value === "ai2" ? "ai2" : "ai1";
    render();
  });
  targetField.append(targetLabel, targetSelect);

  const actions = document.createElement("div");
  actions.className = "xox-actions";

  const startButton = createButton("Baslat", "xox-button", onStart);
  const resetButton = createButton("Sifirla", "xox-button xox-button--ghost", onReset);
  actions.append(startButton, resetButton);

  controls.append(targetField, actions);
  controlsPanel.append(controls);

  layout.append(boardPanel, controlsPanel);
  root.append(hero, layout);
  app.replaceChildren(root);

  if (window.roomAPI && typeof window.roomAPI.onHostMessage === "function") {
    window.roomAPI.onHostMessage(handleHostMessage);
  } else {
    setStatus("Room API bagli degil.");
  }

  render();

  if (window.roomAPI && typeof window.roomAPI.ready === "function") {
    window.roomAPI.ready({
      stage: "ui-ready",
      room: "xox",
    });
  }
})();
