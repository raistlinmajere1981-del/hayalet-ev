/* global document, navigator, window */

(function (global: GameRoomUiGlobal) {
  type UnknownRecord = GameRoomUnknownRecord;

  function getRuntimeRegistry(host: GameRoomUiGlobal): GameRoomUiRuntimeRegistry {
    return host.GameRoomUiRuntime || (host.GameRoomUiRuntime = {});
  }

  function readRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === "object" && Array.isArray(value) === false
      ? (value as UnknownRecord)
      : null;
  }

  function readString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  const registry = getRuntimeRegistry(global);

  registry.createGameRoomUiRuntime = function createGameRoomUiRuntime(): GameRoomUiRuntimeHandle {
    const bootstrapFactories = global.GameRoomUiBootstrapRuntime || {};
    const createBootstrapRuntime = bootstrapFactories.createGameRoomUiBootstrapRuntime;
    if (typeof createBootstrapRuntime !== "function") {
      throw new Error("Game Room UI bootstrap runtime is unavailable.");
    }

    const stateMessageFactories = global.GameRoomUiStateMessageRuntime || {};
    const createStateMessageRuntime = stateMessageFactories.createGameRoomUiStateMessageRuntime;
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

    function isRenderableRoot(value: unknown): value is HTMLElement {
      return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as { append?: unknown }).append === "function"
      );
    }

    function render(): void {
      const state = getState();
      const root = document.getElementById("app");
      if (!isRenderableRoot(root)) {
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
      const messageType = readString(messageRecord["type"]);
      if (messageType === null) {
        return;
      }

      if (messageType === "host-context") {
        const presentation = readRecord(messageRecord["presentation"]) || {};
        applyPresentationMode(presentation);
        const locale = readString(messageRecord["locale"]);
        if (locale !== null) {
          applyLocale(locale);
        }
        const translations = readRecord(messageRecord["translations"]);
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

    function start(): void {
      const state = getState();
      const roomApi = global.roomAPI;
      if (roomApi && typeof roomApi.onHostMessage === "function") {
        roomApi.onHostMessage(handleHostMessage);
      } else {
        state.lastCommandMessage = bootstrapText("roomApiUnavailable");
      }

      global.__gameRoomTeamTetrisTest__ = teamTetrisUi.getTestBridge();

      applyPresentationMode(state.presentation);
      applyLocale(state.locale);
      render();

      if (roomApi && typeof roomApi.ready === "function") {
        roomApi.ready({
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
})(window as unknown as GameRoomUiGlobal);
