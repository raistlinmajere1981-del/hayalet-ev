/* global document, navigator, window */

(function (global) {
  const registry = global.GameRoomUiRuntime || (global.GameRoomUiRuntime = {});

  registry.createGameRoomUiRuntime = function createGameRoomUiRuntime() {
    const bootstrapFactories = global.GameRoomUiBootstrapRuntime || {};
    const createBootstrapRuntime = bootstrapFactories.createGameRoomUiBootstrapRuntime;
    if (typeof createBootstrapRuntime !== "function") {
      throw new Error("Game Room UI bootstrap runtime is unavailable.");
    }

    const stateMessageFactories = global.GameRoomUiStateMessageRuntime || {};
    const createStateMessageRuntime =
      stateMessageFactories.createGameRoomUiStateMessageRuntime;
    if (typeof createStateMessageRuntime !== "function") {
      throw new Error("Game Room UI state message runtime is unavailable.");
    }

    const bootstrapRuntime = createBootstrapRuntime({
      document: document,
      navigator: navigator,
      render: render,
    });
    const roomId = bootstrapRuntime.roomId;
    const teamTetrisFeatureId = bootstrapRuntime.teamTetrisFeatureId;
    const fateKnotsFeatureId = bootstrapRuntime.fateKnotsFeatureId;
    const contextRuntime = bootstrapRuntime.contextRuntime;
    const scrollRuntime = bootstrapRuntime.scrollRuntime;
    const getState = bootstrapRuntime.getState;
    const xoxUi = bootstrapRuntime.xoxUi;
    const teamTetrisUi = bootstrapRuntime.teamTetrisUi;
    const fateKnotsUi = bootstrapRuntime.fateKnotsUi;
    const bootstrapText = bootstrapRuntime.bootstrapText;
    const applyPresentationMode = bootstrapRuntime.applyPresentationMode;
    const applyLocale = bootstrapRuntime.applyLocale;
    const getActiveFeatureId = bootstrapRuntime.getActiveFeatureId;
    const getFeatureLabel = bootstrapRuntime.getFeatureLabel;
    const stateMessageRuntime = createStateMessageRuntime({
      stateRef: bootstrapRuntime.stateRef,
      xoxUi: xoxUi,
      teamTetrisUi: teamTetrisUi,
      fateKnotsUi: fateKnotsUi,
      render: render,
    });

    function render() {
      const state = getState();
      const root = document.getElementById("app");
      if (!root) {
        return;
      }

      const scrollState = scrollRuntime.capture(root);

      try {
        if (!state.translations) {
          xoxUi.renderBootstrap(root);
          return;
        }

        document.title = state.context.room.name + " - " + getFeatureLabel(getActiveFeatureId());

        if (getActiveFeatureId() === teamTetrisFeatureId) {
          teamTetrisUi.renderTeamTetris(root);
          return;
        }

        if (getActiveFeatureId() === fateKnotsFeatureId) {
          fateKnotsUi.renderFateKnots(root);
          return;
        }

        xoxUi.renderXox(root);
      } finally {
        scrollRuntime.restore(root, scrollState);
      }
    }

    function handleHostMessage(message) {
      const state = getState();
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
        stateMessageRuntime.handleXoxState(message);
        return;
      }

      if (message.type === "team-tetris-state") {
        stateMessageRuntime.handleTeamTetrisState(message);
        return;
      }

      if (message.type === "fate-knots-state") {
        stateMessageRuntime.handleFateKnotsState(message);
        return;
      }

      if (message.type === "command-result") {
        stateMessageRuntime.handleCommandResult(message);
      }
    }

    function start() {
      const state = getState();
      if (global.roomAPI && typeof global.roomAPI.onHostMessage === "function") {
        global.roomAPI.onHostMessage(handleHostMessage);
      } else {
        state.lastCommandMessage = bootstrapText("roomApiUnavailable");
      }

      if (global && typeof global === "object") {
        global.__gameRoomTeamTetrisTest__ = teamTetrisUi.getTestBridge();
      }

      applyPresentationMode(state.presentation);
      applyLocale(state.locale);
      render();

      if (global.roomAPI && typeof global.roomAPI.ready === "function") {
        global.roomAPI.ready({
          room: roomId,
          feature: getActiveFeatureId(),
          stage: "ui-ready",
        });
      }
    }

    return {
      getState: getState,
      handleHostMessage: handleHostMessage,
      render: render,
      start: start,
    };
  };
})(window);
