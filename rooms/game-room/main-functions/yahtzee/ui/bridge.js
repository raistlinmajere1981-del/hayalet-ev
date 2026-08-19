/* global window, document */

(function (global) {
  const runtimeRegistry = global.GameRoomUiRuntime;
  if (!runtimeRegistry || typeof runtimeRegistry.createGameRoomUiRuntime !== "function") return;

  const createBaseRuntime = runtimeRegistry.createGameRoomUiRuntime;
  runtimeRegistry.createGameRoomUiRuntime = function createYahtzeeAwareGameRoomUiRuntime() {
    const base = createBaseRuntime();

    function isYahtzeeActive() {
      const state = typeof base.getState === "function" ? base.getState() : null;
      return Boolean(
        state &&
        state.context &&
        state.context.activeFeature &&
        state.context.activeFeature.id === "yahtzee"
      );
    }

    function render() {
      if (
        isYahtzeeActive() &&
        global.GameRoomYahtzeeUi &&
        typeof global.GameRoomYahtzeeUi.render === "function"
      ) {
        const root = document.getElementById("app");
        const baseState = typeof base.getState === "function" ? base.getState() : null;
        if (typeof global.GameRoomYahtzeeUi.setTranslations === "function") {
          global.GameRoomYahtzeeUi.setTranslations(baseState && baseState.translations);
        }
        if (root) global.GameRoomYahtzeeUi.render(root);
        return;
      }
      const root = document.getElementById("app");
      if (root) root.classList.remove("yahtzee-root");
      if (global.GameRoomYahtzeeUi && typeof global.GameRoomYahtzeeUi.dispose === "function") {
        global.GameRoomYahtzeeUi.dispose();
      }
      base.render();
    }

    function handleHostMessage(message) {
      if (message && typeof message === "object" && message.type === "yahtzee-state") {
        if (
          global.GameRoomYahtzeeUi &&
          typeof global.GameRoomYahtzeeUi.handleState === "function"
        ) {
          global.GameRoomYahtzeeUi.handleState(message);
        }
        render();
        return;
      }

      base.handleHostMessage(message);
      if (isYahtzeeActive()) render();
    }

    function start() {
      const roomApi = global.roomAPI;

      base.start();

      if (roomApi && typeof roomApi.onHostMessage === "function") {
        if (typeof roomApi.offHostMessage === "function") {
          roomApi.offHostMessage(base.handleHostMessage);
        }
        roomApi.onHostMessage(handleHostMessage);
      }

      if (isYahtzeeActive()) render();
    }

    return {
      getState: base.getState,
      handleHostMessage: handleHostMessage,
      render: render,
      start: start,
    };
  };
})(window);
