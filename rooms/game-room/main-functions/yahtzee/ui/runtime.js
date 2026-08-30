/* global window, document */

(function (global) {
  "use strict";

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
    kicker: "GAME ROOM · NIGHT WATCH",
    title: "Pirate Deck Yahtzee",
    subtitle: "Five carved dice, thirteen choices, one score sheet by lantern light.",
    start: "Start Game",
    reset: "Reset",
    roll: "Roll Dice",
    score: "Score",
    mode: "Game Mode",
    turn: "Turn",
    winner: "Winner",
    draw: "Draw",
    total: "Total",
    upperBonus: "Upper Bonus",
    rolls: "Roll",
    sound: "Sound",
    soundOn: "On",
    soundOff: "Off",
    babylonMissing: "3D table unavailable; lightweight stage fallback is active.",
    modes: {
      solo: "Solo",
      local2: "2 Players Local",
      ai1: "vs AI1",
      ai2: "vs AI2",
      us1: "vs US1 Online",
    },
    status: {
      ready: "The table is ready.",
      firstRoll: "The first dice are on the table.",
      chooseDiceOrScore: "Hold dice or choose a score.",
      finalRoll: "Final roll complete. Choose a score.",
      newTurn: "A new turn begins.",
      complete: "Score card complete.",
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
  let audioRuntime = null;
  let babylonHandle = null;
  let mountedRoot = null;
  let refs = null;
  let pendingRollAnimation = false;
  let localRollAnimationStartedAt = 0;

  function createPlayer(seatId, label) {
    return {
      seatId: seatId,
      label: label,
      avatarSrc: null,
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
      turnToken: "",
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
      : [createPlayer("user", "Player 1")];
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

  function turnState() {
    const turn = state.turn && typeof state.turn === "object" ? state.turn : {};
    return {
      dice: Array.isArray(turn.dice) ? turn.dice : [1, 1, 1, 1, 1],
      held: Array.isArray(turn.held) ? turn.held : [false, false, false, false, false],
      rollCount: Number(turn.rollCount) || 0,
    };
  }

  function didRoll(previousState, nextState) {
    if (!nextState || typeof nextState !== "object") return false;
    const previousTurn =
      previousState && previousState.turn && typeof previousState.turn === "object"
        ? previousState.turn
        : {};
    const nextTurn = nextState.turn && typeof nextState.turn === "object" ? nextState.turn : {};
    const previousCount = Number(previousTurn.rollCount) || 0;
    const nextCount = Number(nextTurn.rollCount) || 0;
    const previousTurnIndex = Number(previousState && previousState.turnIndex) || 0;
    const nextTurnIndex = Number(nextState.turnIndex) || 0;
    return nextCount > previousCount || (nextTurnIndex !== previousTurnIndex && nextCount > 0);
  }

  function getAudioRuntime() {
    if (audioRuntime) return audioRuntime;
    const registry = global.GameRoomYahtzeeAudioRuntime;
    if (!registry || typeof registry.create !== "function") return null;
    audioRuntime = registry.create();
    if (audioRuntime && typeof audioRuntime.setEnabled === "function") {
      audioRuntime.setEnabled(audioEnabled);
    }
    return audioRuntime;
  }

  function playWoodClick(frequency) {
    const audio = getAudioRuntime();
    if (audio && typeof audio.playWoodClick === "function") audio.playWoodClick(frequency);
  }

  function playDiceSound() {
    const audio = getAudioRuntime();
    if (audio && typeof audio.playDice === "function") audio.playDice();
  }

  function ensureAmbience() {
    if (!audioEnabled) return;
    const audio = getAudioRuntime();
    if (audio && typeof audio.startAmbience === "function") audio.startAmbience();
  }

  function stopAmbience() {
    if (audioRuntime && typeof audioRuntime.stopAmbience === "function") {
      audioRuntime.stopAmbience();
    }
  }

  function disposeAudio() {
    if (!audioRuntime) return;
    try {
      if (typeof audioRuntime.dispose === "function") audioRuntime.dispose();
    } catch (_error) {
      /* best effort */
    }
    audioRuntime = null;
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

  function countDice(dice) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach(function (die) {
      const value = Number(die);
      if (Number.isInteger(value) && value >= 1 && value <= 6) counts[value] += 1;
    });
    return counts;
  }

  function hasStraight(dice, length) {
    const unique = Array.from(new Set(dice.map(Number))).sort(function (a, b) {
      return a - b;
    });
    let run = unique.length > 0 ? 1 : 0;
    for (let index = 1; index < unique.length; index += 1) {
      if (unique[index] === unique[index - 1] + 1) {
        run += 1;
        if (run >= length) return true;
      } else {
        run = 1;
      }
    }
    return run >= length;
  }

  function previewScore(category, dice) {
    if (!Array.isArray(dice) || dice.length !== 5) return 0;
    const counts = countDice(dice);
    const total = dice.reduce(function (sum, die) {
      return sum + Number(die || 0);
    }, 0);

    switch (category) {
      case "ones":
        return counts[1] * 1;
      case "twos":
        return counts[2] * 2;
      case "threes":
        return counts[3] * 3;
      case "fours":
        return counts[4] * 4;
      case "fives":
        return counts[5] * 5;
      case "sixes":
        return counts[6] * 6;
      case "three-kind":
        return counts.some(function (count) {
          return count >= 3;
        })
          ? total
          : 0;
      case "four-kind":
        return counts.some(function (count) {
          return count >= 4;
        })
          ? total
          : 0;
      case "full-house":
        return counts.includes(3) && counts.includes(2) ? 25 : 0;
      case "small-straight":
        return hasStraight(dice, 4) ? 30 : 0;
      case "large-straight":
        return hasStraight(dice, 5) ? 40 : 0;
      case "yahtzee":
        return counts.includes(5) ? 50 : 0;
      case "chance":
        return total;
      default:
        return 0;
    }
  }

  function initials(label) {
    return (
      String(label || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (part) {
          return part.charAt(0).toUpperCase();
        })
        .join("") || "?"
    );
  }

  function createElement(tagName, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    return element;
  }

  function createScoreCard(side) {
    const panel = createElement("aside", "yahtzee-player-panel is-" + side);
    const identity = createElement("div", "yahtzee-player-identity");
    const portrait = createElement("div", "yahtzee-player-portrait");
    const portraitImage = createElement("img", "yahtzee-player-portrait-image");
    portraitImage.alt = "";
    const portraitFallback = createElement("span", "yahtzee-player-portrait-fallback");
    portrait.append(portraitImage, portraitFallback);

    const identityCopy = createElement("div", "yahtzee-player-copy");
    const name = createElement("h2", "yahtzee-player-name");
    const total = createElement("div", "yahtzee-player-total");
    identityCopy.append(name, total);
    identity.append(portrait, identityCopy);
    panel.append(identity);

    const rows = new Map();
    const scoreList = createElement("div", "yahtzee-score-list");
    CATEGORIES.forEach(function (category) {
      const row = createElement("button", "yahtzee-score-row");
      row.type = "button";
      row.dataset.category = category;
      const label = createElement("span", "yahtzee-score-label");
      const value = createElement("strong", "yahtzee-score-value");
      row.append(label, value);
      row.addEventListener("click", function () {
        if (row.disabled) return;
        playWoodClick(105);
        command("GameRoomYahtzeeScore", { category: category });
      });
      rows.set(category, { row: row, label: label, value: value });
      scoreList.append(row);
    });
    panel.append(scoreList);

    const footer = createElement("div", "yahtzee-score-footer");
    const bonus = createElement("span", "yahtzee-score-bonus");
    const footerTotal = createElement("strong", "yahtzee-score-grand-total");
    footer.append(bonus, footerTotal);
    panel.append(footer);

    return {
      root: panel,
      portraitImage: portraitImage,
      portraitFallback: portraitFallback,
      name: name,
      total: total,
      rows: rows,
      bonus: bonus,
      footerTotal: footerTotal,
    };
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

  function setBackdrop(backdrop) {
    const theme = global.GameRoomYahtzeePirateDeckTheme || {};
    const assets = theme.assets || {};
    const src = typeof assets.environment === "string" ? assets.environment.trim() : "";
    if (src) {
      backdrop.style.backgroundImage = "url(" + JSON.stringify(src) + ")";
      backdrop.classList.add("has-art");
    } else {
      backdrop.style.removeProperty("background-image");
      backdrop.classList.remove("has-art");
    }
  }

  function mountBabylon(canvas) {
    const sceneRuntime = global.GameRoomYahtzeeBabylonScene;
    if (!sceneRuntime || typeof sceneRuntime.mount !== "function") return false;
    babylonHandle = sceneRuntime.mount(canvas, state);
    return Boolean(babylonHandle);
  }

  function createSceneShell(root) {
    disposeBabylon();
    root.innerHTML = "";
    root.classList.add("yahtzee-root");

    const shell = createElement("section", "yahtzee-shell");
    const scene = createElement("div", "yahtzee-scene");
    const backdrop = createElement("div", "yahtzee-stage-art");
    setBackdrop(backdrop);
    const canvas = createElement("canvas", "yahtzee-babylon-canvas");
    const atmosphere = createElement("div", "yahtzee-stage-atmosphere");
    const vignette = createElement("div", "yahtzee-vignette");
    scene.append(backdrop, canvas, atmosphere, vignette);

    const overlay = createElement("div", "yahtzee-overlay");

    const pregame = createElement("section", "yahtzee-pregame");
    const kicker = createElement("span", "yahtzee-kicker");
    const title = createElement("h1", "yahtzee-title");
    const subtitle = createElement("p", "yahtzee-subtitle");
    const setup = createElement("div", "yahtzee-setup");
    const modeWrap = createElement("label", "yahtzee-mode-select");
    const modeLabel = createElement("span", "yahtzee-mode-label");
    const modeSelect = createElement("select", "yahtzee-mode-control");
    MODES.forEach(function (mode) {
      const option = document.createElement("option");
      option.value = mode;
      modeSelect.append(option);
    });
    modeSelect.addEventListener("change", function () {
      selectedMode = MODES.includes(modeSelect.value) ? modeSelect.value : "solo";
    });
    modeWrap.append(modeLabel, modeSelect);
    const startButton = createElement("button", "yahtzee-start-button");
    startButton.type = "button";
    startButton.addEventListener("click", function () {
      ensureAmbience();
      playWoodClick(135);
      command("GameRoomYahtzeeStart", { mode: selectedMode });
    });
    setup.append(modeWrap, startButton);
    pregame.append(kicker, title, subtitle, setup);

    const utilityBar = createElement("div", "yahtzee-utility-bar");
    const soundButton = createElement("button", "yahtzee-utility-button is-sound");
    soundButton.type = "button";
    soundButton.addEventListener("click", function () {
      audioEnabled = !audioEnabled;
      const audio = getAudioRuntime();
      if (audio && typeof audio.setEnabled === "function") audio.setEnabled(audioEnabled);
      if (audioEnabled) ensureAmbience();
      else stopAmbience();
      render(root);
    });
    const resetButton = createElement("button", "yahtzee-utility-button is-reset");
    resetButton.type = "button";
    resetButton.textContent = "↻";
    resetButton.addEventListener("click", function () {
      playWoodClick(125);
      command("GameRoomYahtzeeReset", {});
    });
    const closeButton = createElement("button", "yahtzee-utility-button is-close");
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", function () {
      if (global.roomAPI && typeof global.roomAPI.close === "function") global.roomAPI.close();
    });
    utilityBar.append(soundButton, resetButton, closeButton);

    const matchHud = createElement("section", "yahtzee-match-hud");
    const leftCard = createScoreCard("left");
    const rightCard = createScoreCard("right");
    const center = createElement("div", "yahtzee-center-dock");
    const status = createElement("div", "yahtzee-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    const actionRow = createElement("div", "yahtzee-action-row");
    const rollButton = createElement("button", "yahtzee-roll-button");
    rollButton.type = "button";
    rollButton.addEventListener("click", function () {
      if (rollButton.disabled) return;
      ensureAmbience();
      playDiceSound();
      if (babylonHandle && typeof babylonHandle.beginRoll === "function") {
        babylonHandle.beginRoll();
        localRollAnimationStartedAt = Date.now();
      }
      command("GameRoomYahtzeeRoll", {});
    });
    const rollMeta = createElement("span", "yahtzee-roll-meta");
    const resultResetButton = createElement("button", "yahtzee-result-button");
    resultResetButton.type = "button";
    resultResetButton.addEventListener("click", function () {
      playWoodClick(125);
      command("GameRoomYahtzeeReset", {});
    });
    actionRow.append(rollButton, rollMeta, resultResetButton);
    center.append(status, actionRow);
    matchHud.append(leftCard.root, rightCard.root, center);

    const runtimeNote = createElement("div", "yahtzee-runtime-note");

    overlay.append(pregame, utilityBar, matchHud, runtimeNote);
    shell.append(scene, overlay);
    root.append(shell);

    const babylonActive = mountBabylon(canvas);
    shell.classList.toggle("is-babylon-active", babylonActive);
    canvas.hidden = !babylonActive;
    runtimeNote.hidden = babylonActive;

    refs = {
      shell: shell,
      scene: scene,
      backdrop: backdrop,
      canvas: canvas,
      pregame: pregame,
      kicker: kicker,
      title: title,
      subtitle: subtitle,
      setup: setup,
      modeLabel: modeLabel,
      modeSelect: modeSelect,
      startButton: startButton,
      utilityBar: utilityBar,
      soundButton: soundButton,
      resetButton: resetButton,
      closeButton: closeButton,
      matchHud: matchHud,
      leftCard: leftCard,
      rightCard: rightCard,
      center: center,
      status: status,
      rollButton: rollButton,
      rollMeta: rollMeta,
      resultResetButton: resultResetButton,
      runtimeNote: runtimeNote,
    };
    mountedRoot = root;
  }

  function ensureSceneShell(root) {
    if (mountedRoot !== root || !refs || !refs.shell || !root.contains(refs.shell)) {
      createSceneShell(root);
    }
  }

  function updatePortrait(cardRefs, player) {
    const avatar =
      player && typeof player.avatarSrc === "string" && player.avatarSrc.trim() !== ""
        ? player.avatarSrc.trim()
        : null;
    if (avatar) {
      cardRefs.portraitImage.src = avatar;
      cardRefs.portraitImage.hidden = false;
      cardRefs.portraitFallback.hidden = true;
    } else {
      cardRefs.portraitImage.removeAttribute("src");
      cardRefs.portraitImage.hidden = true;
      cardRefs.portraitFallback.hidden = false;
      cardRefs.portraitFallback.textContent = initials(player && (player.label || player.seatId));
    }
  }

  function updateScoreCard(cardRefs, player, playerIndex) {
    if (!player) {
      cardRefs.root.hidden = true;
      return;
    }
    cardRefs.root.hidden = false;
    const isActive = state.active && playerIndex === state.activePlayerIndex;
    const canScore = isActive && isLocalTurn() && turnState().rollCount > 0;
    const scores = player.card && player.card.scores ? player.card.scores : {};
    const dice = turnState().dice;

    cardRefs.root.classList.toggle("is-active", isActive);
    cardRefs.root.classList.toggle("is-local-turn", canScore);
    cardRefs.name.textContent = player.label || player.seatId || "Player";
    cardRefs.total.textContent = t("total") + " " + String(player.total || 0);
    updatePortrait(cardRefs, player);

    CATEGORIES.forEach(function (category) {
      const rowRefs = cardRefs.rows.get(category);
      if (!rowRefs) return;
      const used = typeof scores[category] === "number";
      const selectable = !used && canScore;
      rowRefs.label.textContent = t(category);
      rowRefs.value.textContent = used
        ? String(scores[category])
        : selectable
          ? String(previewScore(category, dice))
          : "—";
      rowRefs.row.disabled = !selectable;
      rowRefs.row.classList.toggle("is-used", used);
      rowRefs.row.classList.toggle("is-preview", selectable);
      rowRefs.row.title = selectable ? t("score") : "";
    });

    cardRefs.bonus.textContent = t("upperBonus") + " " + String(player.upperBonus || 0);
    cardRefs.footerTotal.textContent = t("total") + " " + String(player.total || 0);
  }

  function updateModeOptions() {
    if (!refs) return;
    const options = Array.from(refs.modeSelect.options || []);
    options.forEach(function (option) {
      option.textContent = t("modes." + option.value);
    });
    const effectiveMode =
      state.active || state.complete ? state.mode || selectedMode : selectedMode;
    refs.modeSelect.value = MODES.includes(effectiveMode) ? effectiveMode : "solo";
  }

  function updateUtilityButtons() {
    if (!refs) return;
    refs.soundButton.textContent =
      t("sound") + ": " + (audioEnabled ? t("soundOn") : t("soundOff"));
    refs.soundButton.title = refs.soundButton.textContent;
    refs.resetButton.hidden = !state.active && !state.complete;
    refs.resetButton.title = t("reset");
    refs.closeButton.title = "Close";
  }

  function updateStageClasses() {
    if (!refs) return;
    const phase = state.complete ? "result" : state.active ? "match" : "showcase";
    refs.shell.dataset.phase = phase;
    refs.shell.classList.toggle("is-match-active", state.active === true);
    refs.shell.classList.toggle("is-result", state.complete === true);
    refs.shell.classList.toggle("has-two-players", getPlayers().length > 1);
  }

  function render(root) {
    ensureSceneShell(root);
    if (!refs) return;

    document.title = t("title");
    updateStageClasses();
    updateModeOptions();
    updateUtilityButtons();

    refs.kicker.textContent = t("kicker");
    refs.title.textContent = t("title");
    refs.subtitle.textContent = t("subtitle");
    refs.modeLabel.textContent = t("mode");
    refs.startButton.textContent = t("start");
    refs.runtimeNote.textContent = t("babylonMissing");

    const players = getPlayers();
    const showMatchHud = state.active || state.complete;
    refs.pregame.hidden = showMatchHud;
    refs.matchHud.hidden = !showMatchHud;

    updateScoreCard(refs.leftCard, players[0] || null, 0);
    updateScoreCard(refs.rightCard, players[1] || null, 1);

    refs.status.textContent = statusText();
    const turn = turnState();
    refs.rollButton.textContent = t("roll");
    refs.rollButton.disabled = !isLocalTurn() || turn.rollCount >= 3;
    refs.rollButton.hidden = state.complete || !state.active;
    refs.rollMeta.textContent = t("rolls") + " " + String(turn.rollCount) + "/3";
    refs.rollMeta.hidden = state.complete || !state.active;
    refs.resultResetButton.textContent = t("reset");
    refs.resultResetButton.hidden = !state.complete;

    if (babylonHandle && typeof babylonHandle.update === "function") {
      babylonHandle.update(state, { animate: pendingRollAnimation });
    }
    pendingRollAnimation = false;
  }

  const stageActions = {
    canToggleDie: function (index) {
      const turn = turnState();
      return Boolean(
        Number.isInteger(Number(index)) &&
        Number(index) >= 0 &&
        Number(index) < 5 &&
        isLocalTurn() &&
        turn.rollCount > 0 &&
        turn.rollCount < 3
      );
    },
    toggleDie: function (index) {
      const normalized = Number(index);
      if (!stageActions.canToggleDie(normalized)) return false;
      playWoodClick(190);
      command("GameRoomYahtzeeToggleHold", { index: normalized });
      return true;
    },
  };

  global.GameRoomYahtzeeStageActions = stageActions;

  function handleState(message) {
    const payload =
      message &&
      typeof message === "object" &&
      message.payload &&
      typeof message.payload === "object"
        ? message.payload
        : {};
    if (payload.state && typeof payload.state === "object") {
      const rolled = didRoll(state, payload.state);
      const localAnimationIsFresh =
        localRollAnimationStartedAt > 0 && Date.now() - localRollAnimationStartedAt < 1200;
      pendingRollAnimation = rolled && !localAnimationIsFresh;
      if (rolled && localAnimationIsFresh) localRollAnimationStartedAt = 0;
      if (localRollAnimationStartedAt > 0 && Date.now() - localRollAnimationStartedAt >= 1600) {
        localRollAnimationStartedAt = 0;
      }
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
      disposeAudio();
      if (mountedRoot) mountedRoot.classList.remove("yahtzee-root");
      mountedRoot = null;
      refs = null;
      pendingRollAnimation = false;
      localRollAnimationStartedAt = 0;
    },
  };
})(window);
