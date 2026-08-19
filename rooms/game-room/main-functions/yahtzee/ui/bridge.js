/* global window, document */

(function (global) {
  const runtimeRegistry = global.GameRoomUiRuntime;
  if (!runtimeRegistry || typeof runtimeRegistry.createGameRoomUiRuntime !== "function") return;

  const createBaseRuntime = runtimeRegistry.createGameRoomUiRuntime;
  runtimeRegistry.createGameRoomUiRuntime = function createYahtzeeAwareGameRoomUiRuntime() {
    const base = createBaseRuntime();

    function isYahtzeeActive() {
      const state = typeof base.getState === "function" ? base.getState() : null;
      return Boolean(state && state.context && state.context.activeFeature && state.context.activeFeature.id === "yahtzee");
    }

    function render() {
      if (isYahtzeeActive() && global.GameRoomYahtzeeUi && typeof global.GameRoomYahtzeeUi.render === "function") {
        const root = document.getElementById("app");
        if (root) global.GameRoomYahtzeeUi.render(root);
        return;
      }
      base.render();
    }

    function handleHostMessage(message) {
      if (message && typeof message === "object" && message.type === "yahtzee-state") {
        if (global.GameRoomYahtzeeUi && typeof global.GameRoomYahtzeeUi.handleState === "function") {
          global.GameRoomYahtzeeUi.handleState(message);
        }
        render();
        return;
      }

      base.handleHostMessage(message);
      if (isYahtzeeActive()) render();
    }

    function start() {
      base.start();
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
