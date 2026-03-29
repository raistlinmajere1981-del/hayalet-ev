/* global document, navigator, window */

(function (global) {
  const registry = global.GameRoomUiBootstrapRuntime || (global.GameRoomUiBootstrapRuntime = {});

  registry.createGameRoomUiBootstrapRuntime = function createGameRoomUiBootstrapRuntime(options) {
    const runtimeOptions =
      options && typeof options === "object" && Array.isArray(options) === false ? options : {};
    const documentRef = runtimeOptions.document || document;
    const navigatorRef = runtimeOptions.navigator || navigator;
    const render = typeof runtimeOptions.render === "function" ? runtimeOptions.render : function () {};

    const featureContract = global.GameRoomUiFeatureContract || {};
    const roomId = featureContract.ROOM_ID || "game-room";
    const featureId = featureContract.FEATURE_ID || "xox";
    const teamTetrisFeatureId = featureContract.TEAM_TETRIS_FEATURE_ID || "team-tetris";
    const fateKnotsFeatureId = featureContract.FATE_KNOTS_FEATURE_ID || "fate-knots";
    const bootstrapCopy =
      typeof featureContract.getBootstrapCopy === "function"
        ? featureContract.getBootstrapCopy()
        : {
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
    const featureRecords =
      typeof featureContract.getFeatureRecords === "function"
        ? featureContract.getFeatureRecords()
        : [
            { id: featureId, name: "XOX", description: "" },
            { id: teamTetrisFeatureId, name: "Team Tetris", description: "" },
            { id: fateKnotsFeatureId, name: "Fate Knots", description: "" },
          ];

    const contextFactories = global.GameRoomUiContextRuntime || {};
    const contextRuntimeFactory = contextFactories.createGameRoomUiContextRuntime;
    if (typeof contextRuntimeFactory !== "function") {
      throw new Error("Game Room UI context runtime is unavailable.");
    }

    const scrollRuntimeFactories = global.GameRoomUiScrollRuntime || {};
    const createScrollRuntime = scrollRuntimeFactories.createGameRoomUiScrollRuntime;
    if (typeof createScrollRuntime !== "function") {
      throw new Error("Game Room UI scroll runtime is unavailable.");
    }

    const contextRuntime = contextRuntimeFactory({
      roomId: roomId,
      featureId: featureId,
      bootstrapCopy: bootstrapCopy,
      featureRecords: featureRecords,
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
      return (
        contextRuntime.readPath(bootstrapCopy[state.locale], [key]) ||
        contextRuntime.readPath(bootstrapCopy.en, [key]) ||
        key
      );
    }

    function formatScaleFactor(value) {
      return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    }

    function applyPresentationMode(nextPresentation) {
      const state = getState();
      const presentation =
        nextPresentation && typeof nextPresentation === "object" && Array.isArray(nextPresentation) === false
          ? nextPresentation
          : { mode: nextPresentation };
      state.presentation.mode = contextRuntime.normalizePresentationMode(presentation.mode);
      state.presentation.uiScale = contextRuntime.normalizeUiScale(presentation.uiScale);
      const scaleFactor = formatScaleFactor(state.presentation.uiScale / 100);
      if (documentRef.body && documentRef.body.dataset) {
        documentRef.body.dataset.presentationMode = state.presentation.mode;
        documentRef.body.dataset.roomUiScale = String(state.presentation.uiScale);
        if (documentRef.body.style && typeof documentRef.body.style.setProperty === "function") {
          documentRef.body.style.setProperty("--room-runtime-ui-scale-factor", scaleFactor);
        }
      }
      if (documentRef.documentElement && documentRef.documentElement.dataset) {
        documentRef.documentElement.dataset.presentationMode = state.presentation.mode;
        documentRef.documentElement.dataset.roomUiScale = String(state.presentation.uiScale);
        if (
          documentRef.documentElement.style &&
          typeof documentRef.documentElement.style.setProperty === "function"
        ) {
          documentRef.documentElement.style.setProperty("--room-runtime-ui-scale-factor", scaleFactor);
        }
      }
    }

    function statusText(key) {
      return (
        contextRuntime.readPath(getState().translations, ["xox", "status", key]) ||
        bootstrapText(key === "roomApiUnavailable" ? "roomApiUnavailable" : "commandSendFailed")
      );
    }

    function applyLocale(nextLocale) {
      const state = getState();
      state.locale = contextRuntime.resolveLocale(nextLocale);
      if (documentRef.documentElement) {
        documentRef.documentElement.lang = state.locale;
      }
    }

    function getActiveFeatureId() {
      const state = getState();
      const activeFeatureId =
        state.context &&
        state.context.activeFeature &&
        typeof state.context.activeFeature.id === "string"
          ? state.context.activeFeature.id
          : featureId;
      return featureRecords.some(function (feature) {
        return feature.id === activeFeatureId;
      })
        ? activeFeatureId
        : featureId;
    }

    function getFeatureLabel(activeFeatureId) {
      const state = getState();
      const feature = Array.isArray(state.context.features)
        ? state.context.features.find(function (entry) {
            return entry.id === activeFeatureId;
          })
        : null;
      if (feature && feature.name) {
        return feature.name;
      }
      return text(["features", activeFeatureId]);
    }

    function isRoomApiAvailable() {
      return !!(global.roomAPI && typeof global.roomAPI.sendCommand === "function");
    }

    function sendRoomCommand(command, payload) {
      const state = getState();
      if (!isRoomApiAvailable()) {
        state.lastCommandMessage = statusText("roomApiUnavailable");
        render();
        return;
      }

      const sent = global.roomAPI.sendCommand(command, payload || {});
      if (sent !== true) {
        state.lastCommandMessage = statusText("commandSendFailed");
        render();
      }
    }

    const factories = global.GameRoomUiFactories || {};
    const xoxUi = factories.createXoxUiModule({
      getState: getState,
      roomId: roomId,
      featureId: featureId,
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
      getState: getState,
      featureId: teamTetrisFeatureId,
      createSlot: contextRuntime.createSlot,
      createElement: contextRuntime.createElement,
      text: text,
      render: render,
      sendRoomCommand: sendRoomCommand,
      getFeatureLabel: getFeatureLabel,
    });
    const fateKnotsUi = factories.createFateKnotsUiModule({
      getState: getState,
      featureId: fateKnotsFeatureId,
      createElement: contextRuntime.createElement,
      sendRoomCommand: sendRoomCommand,
      getFeatureLabel: getFeatureLabel,
      text: text,
    });

    const documentLocale =
      documentRef.documentElement && typeof documentRef.documentElement.lang === "string"
        ? documentRef.documentElement.lang
        : "";

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

    return {
      roomId: roomId,
      featureId: featureId,
      teamTetrisFeatureId: teamTetrisFeatureId,
      fateKnotsFeatureId: fateKnotsFeatureId,
      contextRuntime: contextRuntime,
      scrollRuntime: scrollRuntime,
      stateRef: stateRef,
      getState: getState,
      xoxUi: xoxUi,
      teamTetrisUi: teamTetrisUi,
      fateKnotsUi: fateKnotsUi,
      bootstrapText: bootstrapText,
      applyPresentationMode: applyPresentationMode,
      applyLocale: applyLocale,
      getActiveFeatureId: getActiveFeatureId,
      getFeatureLabel: getFeatureLabel,
    };
  };
})(window);
