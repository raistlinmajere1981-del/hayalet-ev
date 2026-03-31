(function(global) {
  function isRecord(value) {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }
  function readString(value, fallback) {
    return typeof value === "string" && value !== "" ? value : fallback;
  }
  function readRuntimeOptions(value) {
    return isRecord(value) ? value : {};
  }
  function readFeatureContract(value) {
    return isRecord(value) ? value : {};
  }
  function readRoomApi(value) {
    return isRecord(value) && typeof value["sendCommand"] === "function" ? value : null;
  }
  function getBootstrapRegistry(host) {
    return host.GameRoomUiBootstrapRuntime || (host.GameRoomUiBootstrapRuntime = {});
  }
  const registry = getBootstrapRegistry(global);
  registry.createGameRoomUiBootstrapRuntime = function createGameRoomUiBootstrapRuntime(options) {
    const runtimeOptions = readRuntimeOptions(options);
    const documentRef = runtimeOptions.document || document;
    const navigatorRef = runtimeOptions.navigator || navigator;
    const render = typeof runtimeOptions.render === "function" ? runtimeOptions.render : function() {
    };
    const featureContract = readFeatureContract(global.GameRoomUiFeatureContract);
    const roomId = readString(featureContract.ROOM_ID, "game-room");
    const featureId = readString(featureContract.FEATURE_ID, "xox");
    const teamTetrisFeatureId = readString(featureContract.TEAM_TETRIS_FEATURE_ID, "team-tetris");
    const fateKnotsFeatureId = readString(featureContract.FATE_KNOTS_FEATURE_ID, "fate-knots");
    const bootstrapCopy = typeof featureContract.getBootstrapCopy === "function" ? featureContract.getBootstrapCopy() : {
      en: {
        roomTitle: "Game Room",
        loadingTitle: "Loading Game Room",
        loadingBody: "Waiting for room context and translations.",
        userLabel: "User",
        roomApiUnavailable: "Room API bridge is not connected.",
        commandSendFailed: "The command could not be sent to the room host."
      },
      tr: {
        roomTitle: "Oyun Odasi",
        loadingTitle: "Oyun Odasi Yukleniyor",
        loadingBody: "Oda baglami ve ceviriler bekleniyor.",
        userLabel: "Kullanici",
        roomApiUnavailable: "Room API koprusu bagli degil.",
        commandSendFailed: "Komut oda host'una gonderilemedi."
      }
    };
    const featureRecords = typeof featureContract.getFeatureRecords === "function" ? featureContract.getFeatureRecords() : [
      { id: featureId, name: "XOX", description: "" },
      { id: teamTetrisFeatureId, name: "Team Tetris", description: "" },
      { id: fateKnotsFeatureId, name: "Fate Knots", description: "" }
    ];
    const contextRuntimeFactory = (global.GameRoomUiContextRuntime || {}).createGameRoomUiContextRuntime;
    if (typeof contextRuntimeFactory !== "function") {
      throw new Error("Game Room UI context runtime is unavailable.");
    }
    const createScrollRuntime = (global.GameRoomUiScrollRuntime || {}).createGameRoomUiScrollRuntime;
    if (typeof createScrollRuntime !== "function") {
      throw new Error("Game Room UI scroll runtime is unavailable.");
    }
    const contextRuntime = contextRuntimeFactory({
      roomId,
      featureId,
      bootstrapCopy,
      featureRecords
    });
    const scrollRuntime = createScrollRuntime();
    const stateRef = { current: null };
    function getState() {
      return stateRef.current;
    }
    function text(path) {
      return contextRuntime.readPath(getState().translations, path) || path.join(".");
    }
    function bootstrapText(key) {
      const state = getState();
      return contextRuntime.readPath(bootstrapCopy[state.locale], [key]) || contextRuntime.readPath(bootstrapCopy["en"], [key]) || key;
    }
    function formatScaleFactor(value) {
      return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    }
    function setRuntimeScaleFactor(target, scaleFactor) {
      const style = target?.style;
      if (!style) {
        return;
      }
      const styleRecord = style;
      if (typeof styleRecord.setProperty === "function") {
        styleRecord.setProperty("--room-runtime-ui-scale-factor", scaleFactor);
        return;
      }
      style["--room-runtime-ui-scale-factor"] = scaleFactor;
    }
    function applyPresentationMode(nextPresentation) {
      const state = getState();
      const presentation = isRecord(nextPresentation) ? nextPresentation : { mode: nextPresentation };
      state.presentation.mode = contextRuntime.normalizePresentationMode(presentation["mode"]);
      state.presentation.uiScale = contextRuntime.normalizeUiScale(presentation["uiScale"]);
      const scaleFactor = formatScaleFactor(state.presentation.uiScale / 100);
      const body = documentRef.body;
      body.dataset["presentationMode"] = state.presentation.mode;
      body.dataset["roomUiScale"] = String(state.presentation.uiScale);
      setRuntimeScaleFactor(body, scaleFactor);
      const documentElement = documentRef.documentElement;
      documentElement.dataset["presentationMode"] = state.presentation.mode;
      documentElement.dataset["roomUiScale"] = String(state.presentation.uiScale);
      setRuntimeScaleFactor(documentElement, scaleFactor);
    }
    function statusText(key) {
      return contextRuntime.readPath(getState().translations, ["xox", "status", key]) || bootstrapText(key === "roomApiUnavailable" ? "roomApiUnavailable" : "commandSendFailed");
    }
    function applyLocale(nextLocale) {
      const state = getState();
      state.locale = contextRuntime.resolveLocale(nextLocale);
      documentRef.documentElement.lang = state.locale;
    }
    function getActiveFeatureId() {
      const state = getState();
      const activeFeatureId = typeof state.context.activeFeature?.id === "string" ? state.context.activeFeature.id : featureId;
      return featureRecords.some(function(feature) {
        return feature.id === activeFeatureId;
      }) ? activeFeatureId : featureId;
    }
    function getFeatureLabel(activeFeatureId) {
      const state = getState();
      const feature = Array.isArray(state.context.features) ? state.context.features.find(function(entry) {
        return entry.id === activeFeatureId;
      }) || null : null;
      if (feature?.name) {
        return feature.name;
      }
      return text(["features", activeFeatureId]);
    }
    function isRoomApiAvailable() {
      return readRoomApi(global.roomAPI) !== null;
    }
    function sendRoomCommand(command, payload) {
      const state = getState();
      const roomApi = readRoomApi(global.roomAPI);
      if (roomApi === null || typeof roomApi.sendCommand !== "function") {
        state.lastCommandMessage = statusText("roomApiUnavailable");
        render();
        return;
      }
      const normalizedPayload = isRecord(payload) ? payload : {};
      const sent = roomApi.sendCommand(command, normalizedPayload);
      if (sent !== true) {
        state.lastCommandMessage = statusText("commandSendFailed");
        render();
      }
    }
    const factories = global.GameRoomUiFactories || {};
    const createXoxUiModule = factories.createXoxUiModule;
    const createTeamTetrisUiModule = factories.createTeamTetrisUiModule;
    const createFateKnotsUiModule = factories.createFateKnotsUiModule;
    if (typeof createXoxUiModule !== "function") {
      throw new Error("XOX UI module is unavailable.");
    }
    if (typeof createTeamTetrisUiModule !== "function") {
      throw new Error("Team Tetris UI module is unavailable.");
    }
    if (typeof createFateKnotsUiModule !== "function") {
      throw new Error("Fate Knots UI module is unavailable.");
    }
    const xoxUi = createXoxUiModule({
      getState,
      roomId,
      featureId,
      createSlot: contextRuntime.createSlot,
      createInviteEntry: contextRuntime.createInviteEntry,
      normalizeSlot: contextRuntime.normalizeSlot,
      bootstrapText,
      text,
      statusText,
      createElement: contextRuntime.createElement,
      render,
      sendRoomCommand,
      isRoomApiAvailable,
      getFeatureLabel
    });
    const teamTetrisUi = createTeamTetrisUiModule({
      getState,
      featureId: teamTetrisFeatureId,
      createSlot: contextRuntime.createSlot,
      createElement: contextRuntime.createElement,
      text,
      render,
      sendRoomCommand,
      getFeatureLabel
    });
    const fateKnotsUi = createFateKnotsUiModule({
      getState,
      featureId: fateKnotsFeatureId,
      createElement: contextRuntime.createElement,
      sendRoomCommand,
      getFeatureLabel,
      text
    });
    const documentLocale = documentRef.documentElement.lang;
    stateRef.current = {
      locale: contextRuntime.resolveLocale(documentLocale || navigatorRef.language),
      translations: null,
      context: contextRuntime.createContext(),
      game: xoxUi.createGameState(),
      teamTetris: teamTetrisUi.createTeamTetrisState(),
      teamTetrisDraft: teamTetrisUi.createTeamTetrisDraft(),
      fateKnots: fateKnotsUi.createFateKnotsState(),
      presentation: {
        mode: "classic",
        uiScale: 100
      },
      preferences: {
        target: "ai1",
        starter: "user",
        inviteMessage: "",
        teamTetrisHiddenPairs: true
      },
      lastCommandMessage: ""
    };
    return {
      roomId,
      featureId,
      teamTetrisFeatureId,
      fateKnotsFeatureId,
      contextRuntime,
      scrollRuntime,
      stateRef,
      getState,
      xoxUi,
      teamTetrisUi,
      fateKnotsUi,
      bootstrapText,
      applyPresentationMode,
      applyLocale,
      getActiveFeatureId,
      getFeatureLabel
    };
  };
})(window);
