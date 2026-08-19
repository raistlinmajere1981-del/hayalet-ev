/* global window, document */

(function (global) {
  const CATEGORIES = [
    "ones",
    "twos",
    "threes",
    "fours",
    "fives",
    "sixes",
    "three-kind",
    "four-kind",
    "full-house",
    "small-straight",
    "large-straight",
    "yahtzee",
    "chance",
  ];

  const MODES = ["solo", "local2", "ai1", "ai2", "us1"];

  const FALLBACK_LABELS = {
    title: "Yahtzee",
    start: "Start",
    reset: "Reset",
    roll: "Roll",
    score: "Score",
    mode: "Game",
    turn: "Turn",
    winner: "Winner",
    draw: "Draw",
    modes: {
      solo: "Solo",
      local2: "2 players local",
      ai1: "vs AI1",
      ai2: "vs AI2",
      us1: "vs US1 online",
    },
    status: {
      ready: "Ready.",
      waitOpponent: "Waiting for the other player.",
      aiThinking: "AI is choosing an action.",
      blockedOpponent: "Opponent is unavailable.",
      syncFailed: "Remote synchronization failed.",
    },
  };

  let translations = null;
  let state = createState();
  let selectedMode = "solo";
  let audioEnabled = true;
  let audioContext = null;
  let ambienceNode = null;
  let babylonHandle = null;
  let mountedRoot = null;
  let mountedShell = null;
  let mountedOverlay = null;
  let pendingRollAnimation = false;

  function createPlayer(seatId, label) {
    return {
      seatId: seatId,
      label: label,
      card: { scores: {} },
      upperSubtotal: 0,
      upperBonus: 0,
      total: 0,
      complete: false,
    };
  }

  function createState() {
    const player = createPlayer("user", "Player 1");
    return {
      mode: "solo",
      localSeatId: "user",
      active: false,
      complete: false,
      players: [player],
      activePlayerIndex: 0,
      activeSeatId: "user",
      turnIndex: 0,
      turn: { dice: [1, 1, 1, 1, 1], held: [false, false, false, false, false], rollCount: 0 },
      card: player.card,
      upperSubtotal: 0,
      upperBonus: 0,
      total: 0,
      winnerSeatId: null,
      status: "ready",
    };
  }

  function readPath(source, path) {
    let current = source;
    for (const segment of path) {
      if (!current || typeof current !== "object") return "";
      current = current[segment];
    }
    return typeof current === "string" && current.trim() !== "" ? current : "";
  }

  function t(key) {
    const path = String(key).split(".");
    return (
      readPath(translations && translations.yahtzee, path) || readPath(FALLBACK_LABELS, path) || key
    );
  }

  function setTranslations(nextTranslations) {
    translations =
      nextTranslations && typeof nextTranslations === "object" ? nextTranslations : null;
  }

  function command(name, roomArgs) {
    if (!global.roomAPI || typeof global.roomAPI.sendCommand !== "function") return;
    global.roomAPI.sendCommand(name, roomArgs || {});
  }

  function getPlayers() {
    return Array.isArray(state.players) && state.players.length > 0
      ? state.players
      : [
          {
            seatId: "user",
            label: "Player 1",
            card: state.card || { scores: {} },
            upperBonus: state.upperBonus || 0,
            total: state.total || 0,
          },
        ];
  }

  function activePlayer() {
    const players = getPlayers();
    return players[state.activePlayerIndex] || players[0];
  }

  function isLocalTurn() {
    if (!state.active || state.complete) return false;
    if (state.mode === "local2") {
      return state.activeSeatId === "user" || state.activeSeatId === "local2";
    }
    return state.activeSeatId === (state.localSeatId || "user");
  }

  function getAudioContext() {
    if (!audioEnabled) return null;
    if (audioContext) return audioContext;
    const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
    if (typeof AudioContextCtor !== "function") return null;
    audioContext = new AudioContextCtor();
    return audioContext;
  }

  function playWoodClick(frequency) {
    const context = getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency || 150;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  }

  function playDiceSound() {
    const context = getAudioContext();
    if (!context) return;
    for (let index = 0; index < 5; index += 1) {
      global.setTimeout(function () {
        playWoodClick(115 + Math.random() * 95);
      }, index * 34);
    }
  }

  function ensureAmbience() {
    const context = getAudioContext();
    if (!context || ambienceNode) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 43;
    gain.gain.value = 0.006;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    ambienceNode = { oscillator: oscillator, gain: gain };
  }

  function stopAmbience() {
    if (!ambienceNode) return;
    try {
      ambienceNode.oscillator.stop();
    } catch (_error) {
      /* already stopped */
    }
    ambienceNode = null;
  }

  function disposeBabylon() {
    if (!babylonHandle) return;
    try {
      babylonHandle.dispose();
    } catch (_error) {
      /* best effort */
    }
    babylonHandle = null;
  }

  function turnVisualState() {
    const turn = state.turn && typeof state.turn === "object" ? state.turn : {};
    return {
      dice: Array.isArray(turn.dice) ? turn.dice : [1, 1, 1, 1, 1],
      held: Array.isArray(turn.held) ? turn.held : [false, false, false, false, false],
      rollCount: Number(turn.rollCount) || 0,
    };
  }

  function didRoll(previousTurn, nextTurn) {
    if (!nextTurn || typeof nextTurn !== "object") return false;
    const previousCount =
      previousTurn && typeof previousTurn === "object" ? Number(previousTurn.rollCount) || 0 : 0;
    const nextCount = Number(nextTurn.rollCount) || 0;
    return nextCount > previousCount;
  }

  function mountBabylon(canvas) {
    const sceneRuntime = global.GameRoomYahtzeeBabylonScene;
    if (!sceneRuntime || typeof sceneRuntime.mount !== "function") return false;
    babylonHandle = sceneRuntime.mount(canvas, turnVisualState());
    return Boolean(babylonHandle);
  }

  function renderDice(container) {
    const dice = state.turn && Array.isArray(state.turn.dice) ? state.turn.dice : [1, 1, 1, 1, 1];
    const held =
      state.turn && Array.isArray(state.turn.held)
        ? state.turn.held
        : [false, false, false, false, false];
    const localTurn = isLocalTurn();
    dice.forEach(function (value, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "yahtzee-die" + (held[index] ? " is-held" : "");
      button.disabled = !localTurn || state.turn.rollCount >= 3;
      button.setAttribute("aria-pressed", held[index] ? "true" : "false");
      button.dataset.dieIndex = String(index);
      button.innerHTML =
        '<span class="yahtzee-die-value">' +
        String(value) +
        '</span><span class="yahtzee-die-hold">' +
        (held[index] ? t("held") : t("hold")) +
        "</span>";
      button.addEventListener("click", function () {
        playWoodClick(190);
        command("GameRoomYahtzeeToggleHold", { index: index });
      });
      container.append(button);
    });
  }

  function renderScores(container, player, isActive) {
    const scores = player && player.card && player.card.scores ? player.card.scores : {};
    const localTurn = isLocalTurn();
    CATEGORIES.forEach(function (category) {
      const row = document.createElement("div");
      row.className = "yahtzee-score-row";
      const used = typeof scores[category] === "number";
      const value = used ? String(scores[category]) : "—";
      row.innerHTML = "<span>" + t(category) + "</span><strong>" + value + "</strong>";
      if (!used && isActive && localTurn && state.turn.rollCount > 0) {
        const scoreButton = document.createElement("button");
        scoreButton.type = "button";
        scoreButton.textContent = t("score");
        scoreButton.addEventListener("click", function () {
          playWoodClick(105);
          command("GameRoomYahtzeeScore", { category: category });
        });
        row.append(scoreButton);
      }
      container.append(row);
    });
  }

  function renderScoreCard(player, index) {
    const card = document.createElement("aside");
    const isActive = index === state.activePlayerIndex && state.active;
    card.className = "yahtzee-score-card" + (isActive ? " is-active" : "");
    const cardTitle = document.createElement("h2");
    cardTitle.textContent = player.label || player.seatId || t("scoreCard");
    card.append(cardTitle);
    if (isActive) {
      const turnBadge = document.createElement("div");
      turnBadge.className = "yahtzee-turn-badge";
      turnBadge.textContent = t("turn");
      card.append(turnBadge);
    }
    renderScores(card, player, isActive);
    const totals = document.createElement("div");
    totals.className = "yahtzee-score-totals";
    totals.innerHTML =
      "<span>" +
      t("upperBonus") +
      " <strong>" +
      String(player.upperBonus || 0) +
      "</strong></span><span>" +
      t("total") +
      " <strong>" +
      String(player.total || 0) +
      "</strong></span>";
    card.append(totals);
    return card;
  }

  function statusText() {
    if (state.complete && getPlayers().length > 1) {
      if (!state.winnerSeatId) return t("draw");
      const winner = getPlayers().find(function (player) {
        return player.seatId === state.winnerSeatId;
      });
      return t("winner") + ": " + (winner ? winner.label : state.winnerSeatId);
    }
    const base = t("status." + (state.status || "ready"));
    if (!state.active) return base;
    const current = activePlayer();
    return base + " · " + t("turn") + ": " + (current ? current.label : state.activeSeatId);
  }

  function createSceneShell(root) {
    disposeBabylon();
    root.innerHTML = "";
    const shell = document.createElement("section");
    shell.className = "yahtzee-shell";
    shell.innerHTML =
      '<div class="yahtzee-scene"><canvas class="yahtzee-babylon-canvas"></canvas><div class="yahtzee-fallback-art"><div class="yahtzee-moon"></div><div class="yahtzee-mast"></div><div class="yahtzee-pirate p1"></div><div class="yahtzee-pirate p2"></div><div class="yahtzee-pirate p3"></div><div class="yahtzee-pirate p4"></div><div class="yahtzee-table"></div><div class="yahtzee-candle"></div></div><div class="yahtzee-vignette"></div></div>';

    const overlay = document.createElement("div");
    overlay.className = "yahtzee-overlay";
    shell.append(overlay);

    const note = document.createElement("div");
    note.className = "yahtzee-runtime-note";
    shell.append(note);

    root.append(shell);
    mountedRoot = root;
    mountedShell = shell;
    mountedOverlay = overlay;

    const canvas = shell.querySelector(".yahtzee-babylon-canvas");
    const fallback = shell.querySelector(".yahtzee-fallback-art");
    const babylonActive = Boolean(canvas && mountBabylon(canvas));
    shell.classList.toggle("is-babylon-active", babylonActive);
    if (canvas) canvas.hidden = !babylonActive;
    if (fallback) fallback.hidden = babylonActive;
    note.hidden = babylonActive;
  }

  function ensureSceneShell(root) {
    if (mountedRoot !== root || !mountedShell || !mountedOverlay || !root.contains(mountedShell)) {
      createSceneShell(root);
    }
  }

  function render(root) {
    ensureSceneShell(root);
    root.classList.add("yahtzee-root");
    const shell = mountedShell;
    const overlay = mountedOverlay;
    if (!shell || !overlay) return;

    overlay.innerHTML =
      '<header class="yahtzee-header"><div><span class="yahtzee-kicker">' +
      t("kicker") +
      "</span><h1>" +
      t("title") +
      "</h1><p>" +
      t("subtitle") +
      "</p></div></header>";

    const controls = document.createElement("div");
    controls.className = "yahtzee-controls";

    const modeWrap = document.createElement("label");
    modeWrap.className = "yahtzee-mode-select";
    const modeLabel = document.createElement("span");
    modeLabel.textContent = t("mode");
    const modeSelect = document.createElement("select");
    MODES.forEach(function (mode) {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = t("modes." + mode);
      modeSelect.append(option);
    });
    const effectiveMode =
      state.active || state.complete ? state.mode || selectedMode : selectedMode;
    modeSelect.value = MODES.includes(effectiveMode) ? effectiveMode : "solo";
    modeSelect.disabled = state.active || state.complete;
    modeSelect.addEventListener("change", function () {
      selectedMode = MODES.includes(modeSelect.value) ? modeSelect.value : "solo";
    });
    modeWrap.append(modeLabel, modeSelect);
    controls.append(modeWrap);

    const start = document.createElement("button");
    start.type = "button";
    start.textContent = state.active || state.complete ? t("reset") : t("start");
    start.addEventListener("click", function () {
      ensureAmbience();
      playWoodClick(135);
      if (state.active || state.complete) {
        command("GameRoomYahtzeeReset", {});
      } else {
        command("GameRoomYahtzeeStart", { mode: selectedMode });
      }
    });
    controls.append(start);

    const roll = document.createElement("button");
    roll.type = "button";
    roll.className = "primary";
    roll.textContent = t("roll");
    roll.disabled = !isLocalTurn() || state.turn.rollCount >= 3;
    roll.addEventListener("click", function () {
      ensureAmbience();
      playDiceSound();
      if (babylonHandle && typeof babylonHandle.beginRoll === "function") {
        babylonHandle.beginRoll();
      }
      command("GameRoomYahtzeeRoll", {});
    });
    controls.append(roll);

    const sound = document.createElement("button");
    sound.type = "button";
    sound.textContent = t("sound") + ": " + (audioEnabled ? t("soundOn") : t("soundOff"));
    sound.addEventListener("click", function () {
      audioEnabled = !audioEnabled;
      if (audioEnabled) ensureAmbience();
      else stopAmbience();
      render(root);
    });
    controls.append(sound);
    overlay.append(controls);

    const playArea = document.createElement("div");
    playArea.className = "yahtzee-play-area";
    const dicePanel = document.createElement("div");
    dicePanel.className = "yahtzee-dice-panel";
    const status = document.createElement("div");
    status.className = "yahtzee-status";
    status.textContent = statusText();
    dicePanel.append(status);
    const diceRow = document.createElement("div");
    diceRow.className = "yahtzee-dice-row";
    renderDice(diceRow);
    dicePanel.append(diceRow);
    const rollMeta = document.createElement("div");
    rollMeta.className = "yahtzee-roll-meta";
    rollMeta.textContent = t("rolls") + ": " + String(state.turn.rollCount) + "/3";
    dicePanel.append(rollMeta);
    playArea.append(dicePanel);

    const scoreStack = document.createElement("div");
    scoreStack.className = "yahtzee-score-stack";
    getPlayers().forEach(function (player, index) {
      scoreStack.append(renderScoreCard(player, index));
    });
    playArea.append(scoreStack);
    overlay.append(playArea);

    const note = shell.querySelector(".yahtzee-runtime-note");
    if (note) note.textContent = t("babylonMissing");
    if (babylonHandle && typeof babylonHandle.update === "function") {
      babylonHandle.update(turnVisualState(), { animate: pendingRollAnimation });
    }
    pendingRollAnimation = false;
  }

  function handleState(message) {
    const payload =
      message &&
      typeof message === "object" &&
      message.payload &&
      typeof message.payload === "object"
        ? message.payload
        : {};
    if (payload.state && typeof payload.state === "object") {
      pendingRollAnimation = didRoll(state.turn, payload.state.turn);
      state = payload.state;
      if (!state.active && !state.complete && MODES.includes(state.mode)) {
        selectedMode = state.mode;
      }
    }
  }

  global.GameRoomYahtzeeUi = {
    render: render,
    handleState: handleState,
    setTranslations: setTranslations,
    getState: function () {
      return state;
    },
    dispose: function () {
      disposeBabylon();
      stopAmbience();
      if (mountedRoot) mountedRoot.classList.remove("yahtzee-root");
      mountedRoot = null;
      mountedShell = null;
      mountedOverlay = null;
      pendingRollAnimation = false;
    },
  };
})(window);
