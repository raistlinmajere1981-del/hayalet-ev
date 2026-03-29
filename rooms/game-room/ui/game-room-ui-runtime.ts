/* global document, navigator, window */

(function (global) {
  type UnknownRecord = Record<string, unknown>;

  function readRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === "object" && Array.isArray(value) === false
      ? (value as UnknownRecord)
      : null;
  }

  function readString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  const registry = global.GameRoomUiRuntime || (global.GameRoomUiRuntime = {});

  registry.createGameRoomUiRuntime = function createGameRoomUiRuntime() {
    const registryHost = global as unknown as typeof globalThis & Record<string, unknown>;
    const bootstrapFactories =
      (registryHost.GameRoomUiBootstrapRuntime as Record<string, unknown> | undefined) || {};
    const createBootstrapRuntime = bootstrapFactories.createGameRoomUiBootstrapRuntime;
    if (typeof createBootstrapRuntime !== "function") {
      throw new Error("Game Room UI bootstrap runtime is unavailable.");
    }

    const stateMessageFactories =
      (registryHost.GameRoomUiStateMessageRuntime as Record<string, unknown> | undefined) || {};
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

    function handleHostMessage(message: unknown) {
      const state = getState();
      const messageRecord = readRecord(message);
      if (messageRecord === null) {
        return;
      }
      const messageType = readString(messageRecord.type);
      if (messageType === null) {
        return;
      }

      if (messageType === "host-context") {
        const presentation = readRecord(messageRecord.presentation) || {};
        applyPresentationMode(presentation);
        const locale = readString(messageRecord.locale);
        if (locale !== null) {
          applyLocale(locale);
        }
        const translations = readRecord(messageRecord.translations);
        if (translations !== null) {
          state.translations = translations;
        }
        const previousTarget = state.preferences.target;
        state.context = contextRuntime.normalizeContext(messageRecord);
        state.preferences.target =
          previousTarget === "ai1" || previousTarget === "ai2" || previousTarget === "us1"
            ? previousTarget
            : "ai1";
        render();
        return;
      }

      if (messageType === "xox-state") {
        stateMessageRuntime.handleXoxState(messageRecord);
        return;
      }

      if (messageType === "team-tetris-state") {
        stateMessageRuntime.handleTeamTetrisState(messageRecord);
        return;
      }

      if (messageType === "fate-knots-state") {
        stateMessageRuntime.handleFateKnotsState(messageRecord);
        return;
      }

      if (messageType === "command-result") {
        stateMessageRuntime.handleCommandResult(messageRecord);
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
