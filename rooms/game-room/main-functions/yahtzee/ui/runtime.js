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

  const FALLBACK_LABELS = {
    title: "Yahtzee",
    start: "Start",
    reset: "Reset",
    roll: "Roll",
    score: "Score",
    status: { ready: "Ready." },
  };

  let translations = null;
  let state = createState();
  let audioEnabled = true;
  let audioContext = null;
  let ambienceNode = null;
  let babylonHandle = null;

  function createState() {
    return {
      active: false,
      complete: false,
      turnIndex: 0,
      turn: { dice: [1, 1, 1, 1, 1], held: [false, false, false, false, false], rollCount: 0 },
      card: { scores: {} },
      upperSubtotal: 0,
      upperBonus: 0,
      total: 0,
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
    global.roomAPI.sendCommand(name, { roomArgs: roomArgs || {} });
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
      babylonHandle.engine.dispose();
    } catch (_error) {
      /* best effort */
    }
    babylonHandle = null;
  }

  function createPirate(B, scene, x, z, scale, material) {
    const body = B.MeshBuilder.CreateCylinder(
      "pirate-body",
      {
        height: 1.7 * scale,
        diameterTop: 0.62 * scale,
        diameterBottom: 0.78 * scale,
        tessellation: 8,
      },
      scene
    );
    body.position = new B.Vector3(x, 1.15 * scale, z);
    body.material = material;
    const head = B.MeshBuilder.CreateSphere(
      "pirate-head",
      { diameter: 0.58 * scale, segments: 8 },
      scene
    );
    head.position = new B.Vector3(x, 2.18 * scale, z);
    head.material = material;
    const hat = B.MeshBuilder.CreateCylinder(
      "pirate-hat",
      { height: 0.18 * scale, diameter: 0.9 * scale, tessellation: 3 },
      scene
    );
    hat.position = new B.Vector3(x, 2.53 * scale, z);
    hat.rotation.y = Math.PI / 2;
    hat.material = material;
  }

  function mountBabylon(canvas) {
    const B = global.BABYLON;
    if (!B || typeof B.Engine !== "function" || typeof B.Scene !== "function") return false;

    disposeBabylon();
    const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
    const scene = new B.Scene(engine);
    scene.clearColor = new B.Color4(0.008, 0.012, 0.028, 1);
    const camera = new B.ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      1.08,
      12.2,
      new B.Vector3(0, 0.65, 0),
      scene
    );
    camera.lowerRadiusLimit = 9.5;
    camera.upperRadiusLimit = 14;
    camera.attachControl(canvas, true);

    const moon = new B.HemisphericLight("moon", new B.Vector3(0, 1, -0.3), scene);
    moon.intensity = 0.22;
    const candle = new B.PointLight("candle", new B.Vector3(0, 3.2, -0.2), scene);
    candle.diffuse = new B.Color3(1, 0.56, 0.2);
    candle.intensity = 1.9;
    candle.range = 13;

    const wood = new B.StandardMaterial("wood", scene);
    wood.diffuseColor = new B.Color3(0.19, 0.075, 0.027);
    wood.specularColor = new B.Color3(0.08, 0.05, 0.03);
    const darkWood = new B.StandardMaterial("dark-wood", scene);
    darkWood.diffuseColor = new B.Color3(0.07, 0.025, 0.014);
    const pirateMat = new B.StandardMaterial("pirate", scene);
    pirateMat.diffuseColor = new B.Color3(0.12, 0.09, 0.07);

    const deck = B.MeshBuilder.CreateGround(
      "deck",
      { width: 18, height: 13, subdivisions: 1 },
      scene
    );
    deck.material = wood;
    const table = B.MeshBuilder.CreateBox("table", { width: 7.3, depth: 4.3, height: 0.42 }, scene);
    table.position.y = 0.66;
    table.material = darkWood;

    for (let index = 0; index < 5; index += 1) {
      const die = B.MeshBuilder.CreateBox("die-" + index, { size: 0.72 }, scene);
      die.position = new B.Vector3(-2.15 + index * 1.08, 1.24, 0.15 + (index % 2) * 0.16);
      const dieMat = new B.StandardMaterial("die-mat-" + index, scene);
      dieMat.diffuseColor = new B.Color3(0.35, 0.18, 0.07);
      die.material = dieMat;
    }

    createPirate(B, scene, -4.2, 1.8, 0.86, pirateMat);
    createPirate(B, scene, 4.25, 1.95, 0.92, pirateMat);
    createPirate(B, scene, -2.8, 3.7, 0.72, pirateMat);
    createPirate(B, scene, 2.75, 3.85, 0.76, pirateMat);

    const mast = B.MeshBuilder.CreateCylinder(
      "mast",
      { height: 8, diameter: 0.5, tessellation: 12 },
      scene
    );
    mast.position = new B.Vector3(6.8, 3.4, 2.6);
    mast.material = darkWood;

    let sway = 0;
    scene.onBeforeRenderObservable.add(function () {
      sway += engine.getDeltaTime() * 0.00035;
      camera.target.y = 0.65 + Math.sin(sway) * 0.035;
      candle.intensity = 1.72 + Math.sin(sway * 17) * 0.16 + Math.sin(sway * 7) * 0.08;
    });

    engine.runRenderLoop(function () {
      scene.render();
    });
    const resize = function () {
      engine.resize();
    };
    global.addEventListener("resize", resize);
    babylonHandle = { engine: engine, scene: scene, resize: resize };
    return true;
  }

  function renderDice(container) {
    const dice = state.turn && Array.isArray(state.turn.dice) ? state.turn.dice : [1, 1, 1, 1, 1];
    const held =
      state.turn && Array.isArray(state.turn.held)
        ? state.turn.held
        : [false, false, false, false, false];
    dice.forEach(function (value, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "yahtzee-die" + (held[index] ? " is-held" : "");
      button.disabled = !state.active || state.turn.rollCount >= 3;
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

  function renderScores(container) {
    const scores = state.card && state.card.scores ? state.card.scores : {};
    CATEGORIES.forEach(function (category) {
      const row = document.createElement("div");
      row.className = "yahtzee-score-row";
      const used = typeof scores[category] === "number";
      const value = used ? String(scores[category]) : "—";
      row.innerHTML = "<span>" + t(category) + "</span><strong>" + value + "</strong>";
      if (!used && state.active && state.turn.rollCount > 0) {
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

  function render(root) {
    disposeBabylon();
    root.innerHTML = "";
    root.classList.add("yahtzee-root");

    const shell = document.createElement("section");
    shell.className = "yahtzee-shell";
    shell.innerHTML =
      '<div class="yahtzee-scene"><canvas class="yahtzee-babylon-canvas"></canvas><div class="yahtzee-fallback-art"><div class="yahtzee-moon"></div><div class="yahtzee-mast"></div><div class="yahtzee-pirate p1"></div><div class="yahtzee-pirate p2"></div><div class="yahtzee-pirate p3"></div><div class="yahtzee-pirate p4"></div><div class="yahtzee-table"></div><div class="yahtzee-candle"></div></div><div class="yahtzee-vignette"></div></div>';

    const overlay = document.createElement("div");
    overlay.className = "yahtzee-overlay";
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
    const start = document.createElement("button");
    start.type = "button";
    start.textContent = state.active || state.complete ? t("reset") : t("start");
    start.addEventListener("click", function () {
      ensureAmbience();
      playWoodClick(135);
      command(state.active || state.complete ? "GameRoomYahtzeeReset" : "GameRoomYahtzeeStart", {});
    });
    controls.append(start);

    const roll = document.createElement("button");
    roll.type = "button";
    roll.className = "primary";
    roll.textContent = t("roll");
    roll.disabled = !state.active || state.turn.rollCount >= 3;
    roll.addEventListener("click", function () {
      ensureAmbience();
      playDiceSound();
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
    status.textContent = t("status." + (state.status || "ready"));
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

    const card = document.createElement("aside");
    card.className = "yahtzee-score-card";
    const cardTitle = document.createElement("h2");
    cardTitle.textContent = t("scoreCard");
    card.append(cardTitle);
    renderScores(card);
    const totals = document.createElement("div");
    totals.className = "yahtzee-score-totals";
    totals.innerHTML =
      "<span>" +
      t("upperBonus") +
      " <strong>" +
      String(state.upperBonus || 0) +
      "</strong></span><span>" +
      t("total") +
      " <strong>" +
      String(state.total || 0) +
      "</strong></span>";
    card.append(totals);
    playArea.append(card);
    overlay.append(playArea);

    shell.append(overlay);
    root.append(shell);

    const canvas = shell.querySelector(".yahtzee-babylon-canvas");
    const fallback = shell.querySelector(".yahtzee-fallback-art");
    if (canvas && mountBabylon(canvas)) {
      fallback.hidden = true;
    } else {
      const note = document.createElement("div");
      note.className = "yahtzee-runtime-note";
      note.textContent = t("babylonMissing");
      shell.append(note);
    }
  }

  function handleState(message) {
    const payload =
      message &&
      typeof message === "object" &&
      message.payload &&
      typeof message.payload === "object"
        ? message.payload
        : {};
    if (payload.state && typeof payload.state === "object") state = payload.state;
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
    },
  };
})(window);
