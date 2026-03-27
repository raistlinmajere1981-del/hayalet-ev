/* global document, navigator, window */

(function () {
  const ROOM_ID = "game-room";
  const FEATURE_ID = "xox";
  const TEAM_TETRIS_FEATURE_ID = "team-tetris";
  const FATE_KNOTS_FEATURE_ID = "fate-knots";
  const FEATURE_RECORDS = [
    {
      id: FEATURE_ID,
      name: "XOX",
      description: "",
    },
    {
      id: TEAM_TETRIS_FEATURE_ID,
      name: "Team Tetris",
      description: "",
    },
    {
      id: FATE_KNOTS_FEATURE_ID,
      name: "Fate Knots",
      description: "",
    },
  ];

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

  let state = null;

  const contextFactories = window.GameRoomUiContextRuntime || {};
  const contextRuntimeFactory = contextFactories.createGameRoomUiContextRuntime;
  if (typeof contextRuntimeFactory !== "function") {
    throw new Error("Game Room UI context runtime is unavailable.");
  }
  const contextRuntime = contextRuntimeFactory({
    roomId: ROOM_ID,
    featureId: FEATURE_ID,
    bootstrapCopy: BOOTSTRAP_COPY,
    featureRecords: FEATURE_RECORDS,
  });

  function text(path) {
    return contextRuntime.readPath(state.translations, path) || path.join(".");
  }

  function bootstrapText(key) {
    return (
      contextRuntime.readPath(BOOTSTRAP_COPY[state.locale], [key]) ||
      contextRuntime.readPath(BOOTSTRAP_COPY.en, [key]) ||
      key
    );
  }

  function formatScaleFactor(value) {
    return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }

  function applyPresentationMode(nextPresentation) {
    const presentation =
      nextPresentation && typeof nextPresentation === "object" && Array.isArray(nextPresentation) === false
        ? nextPresentation
        : { mode: nextPresentation };
    state.presentation.mode = contextRuntime.normalizePresentationMode(presentation.mode);
    state.presentation.uiScale = contextRuntime.normalizeUiScale(presentation.uiScale);
    const scaleFactor = formatScaleFactor(state.presentation.uiScale / 100);
    if (document.body && document.body.dataset) {
      document.body.dataset.presentationMode = state.presentation.mode;
      document.body.dataset.roomUiScale = String(state.presentation.uiScale);
      if (document.body.style && typeof document.body.style.setProperty === "function") {
        document.body.style.setProperty("--room-runtime-ui-scale-factor", scaleFactor);
      }
    }
    if (document.documentElement && document.documentElement.dataset) {
      document.documentElement.dataset.presentationMode = state.presentation.mode;
      document.documentElement.dataset.roomUiScale = String(state.presentation.uiScale);
      if (
        document.documentElement.style &&
        typeof document.documentElement.style.setProperty === "function"
      ) {
        document.documentElement.style.setProperty("--room-runtime-ui-scale-factor", scaleFactor);
      }
    }
  }

  function statusText(key) {
    return (
      contextRuntime.readPath(state.translations, ["xox", "status", key]) ||
      bootstrapText(key === "roomApiUnavailable" ? "roomApiUnavailable" : "commandSendFailed")
    );
  }

  function applyLocale(nextLocale) {
    state.locale = contextRuntime.resolveLocale(nextLocale);
    document.documentElement.lang = state.locale;
  }

  function getActiveFeatureId() {
    const activeFeatureId =
      state.context &&
      state.context.activeFeature &&
      typeof state.context.activeFeature.id === "string"
        ? state.context.activeFeature.id
        : FEATURE_ID;
    return FEATURE_RECORDS.some(function (feature) {
      return feature.id === activeFeatureId;
    })
      ? activeFeatureId
      : FEATURE_ID;
  }

  function getFeatureLabel(featureId) {
    const feature = Array.isArray(state.context.features)
      ? state.context.features.find(function (entry) {
          return entry.id === featureId;
        })
      : null;
    if (feature && feature.name) {
      return feature.name;
    }
    return text(["features", featureId]);
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

  const factories = window.GameRoomUiFactories || {};
  const xoxUi = factories.createXoxUiModule({
    getState: function () {
      return state;
    },
    roomId: ROOM_ID,
    featureId: FEATURE_ID,
    createSlot: contextRuntime.createSlot,
    createInviteEntry: contextRuntime.createInviteEntry,
    normalizeSlot: contextRuntime.normalizeSlot,
    bootstrapText: bootstrapText,
    text: text,
    statusText: statusText,
    createElement: contextRuntime.createElement,
    render: render,
    sendRoomCommand: sendRoomCommand,
    isRoomApiAvailable: isRoomApiAvailable,
    getFeatureLabel: getFeatureLabel,
  });
  const teamTetrisUi = factories.createTeamTetrisUiModule({
    getState: function () {
      return state;
    },
    featureId: TEAM_TETRIS_FEATURE_ID,
    createSlot: contextRuntime.createSlot,
    createElement: contextRuntime.createElement,
    text: text,
    render: render,
    sendRoomCommand: sendRoomCommand,
    getFeatureLabel: getFeatureLabel,
  });
  const fateKnotsUi = factories.createFateKnotsUiModule({
    getState: function () {
      return state;
    },
    featureId: FATE_KNOTS_FEATURE_ID,
    createElement: contextRuntime.createElement,
    sendRoomCommand: sendRoomCommand,
    getFeatureLabel: getFeatureLabel,
    text: text,
  });

  state = {
    locale: contextRuntime.resolveLocale(document.documentElement.lang || navigator.language),
    translations: null,
    context: contextRuntime.createContext(),
    game: xoxUi.createGameState(),
    teamTetris: teamTetrisUi.createTeamTetrisState(),
    teamTetrisDraft: teamTetrisUi.createTeamTetrisDraft(),
    fateKnots: fateKnotsUi.createFateKnotsState(),
    presentation: {
      mode: "scene-view",
      uiScale: 100,
    },
    preferences: {
      target: "ai1",
      starter: "user",
      inviteMessage: "",
      teamTetrisHiddenPairs: true,
    },
    lastCommandMessage: "",
  };

  function render() {
    const root = document.getElementById("app");
    if (!root) {
      return;
    }

    if (!state.translations) {
      xoxUi.renderBootstrap(root);
      return;
    }

    document.title = state.context.room.name + " - " + getFeatureLabel(getActiveFeatureId());

    if (getActiveFeatureId() === TEAM_TETRIS_FEATURE_ID) {
      teamTetrisUi.renderTeamTetris(root);
      return;
    }

    if (getActiveFeatureId() === FATE_KNOTS_FEATURE_ID) {
      fateKnotsUi.renderFateKnots(root);
      return;
    }

    xoxUi.renderXox(root);
  }

  function handleHostMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    if (message.type === "host-context") {
      const presentation =
        message.presentation &&
        typeof message.presentation === "object" &&
        Array.isArray(message.presentation) === false
          ? message.presentation
          : {};
      applyPresentationMode(presentation);
      if (typeof message.locale === "string") {
        applyLocale(message.locale);
      }
      if (
        message.translations &&
        typeof message.translations === "object" &&
        Array.isArray(message.translations) === false
      ) {
        state.translations = message.translations;
      }
      const previousTarget = state.preferences.target;
      state.context = contextRuntime.normalizeContext(message);
      state.preferences.target =
        previousTarget === "ai1" || previousTarget === "ai2" || previousTarget === "us1"
          ? previousTarget
          : "ai1";
      render();
      return;
    }

    if (message.type === "xox-state") {
      const payload =
        message.payload &&
        typeof message.payload === "object" &&
        Array.isArray(message.payload) === false
          ? message.payload
          : {};
      state.game = xoxUi.sanitizeGameState(payload.state);
      xoxUi.syncPreferencesFromGame();
      state.lastCommandMessage = "";
      render();
      return;
    }

    if (message.type === "team-tetris-state") {
      const payload =
        message.payload &&
        typeof message.payload === "object" &&
        Array.isArray(message.payload) === false
          ? message.payload
          : {};
      state.teamTetris = teamTetrisUi.sanitizeTeamTetrisState(payload.state);
      teamTetrisUi.syncTeamTetrisPreferencesFromState();
      teamTetrisUi.syncTeamTetrisDraftFromState();
      state.lastCommandMessage = "";
      render();
      return;
    }

    if (message.type === "fate-knots-state") {
      const payload =
        message.payload &&
        typeof message.payload === "object" &&
        Array.isArray(message.payload) === false
          ? message.payload
          : {};
      state.fateKnots = fateKnotsUi.sanitizeFateKnotsState(payload.state);
      state.lastCommandMessage = "";
      render();
      return;
    }

    if (message.type === "command-result") {
      const result =
        message.result &&
        typeof message.result === "object" &&
        Array.isArray(message.result) === false
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

  if (window && typeof window === "object") {
    window.__gameRoomTeamTetrisTest__ = teamTetrisUi.getTestBridge();
  }

  applyPresentationMode(state.presentation);
  applyLocale(state.locale);
  render();

  if (window.roomAPI && typeof window.roomAPI.ready === "function") {
    window.roomAPI.ready({
      room: ROOM_ID,
      feature: getActiveFeatureId(),
      stage: "ui-ready",
    });
  }
})();
