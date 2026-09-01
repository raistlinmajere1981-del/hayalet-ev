/* global window, document */

(function (global) {
  const runtimeRegistry = global.GameRoomUiRuntime;
  if (!runtimeRegistry || typeof runtimeRegistry.createGameRoomUiRuntime !== "function") return;

  const createBaseRuntime = runtimeRegistry.createGameRoomUiRuntime;
  const FATE_KNOTS_FEATURE_ID = "fate-knots";

  runtimeRegistry.createGameRoomUiRuntime = function createFateKnotsAwareGameRoomUiRuntime() {
    const base = createBaseRuntime();

    function isFateKnotsActive() {
      const state = typeof base.getState === "function" ? base.getState() : null;
      return Boolean(
        state &&
          state.context &&
          state.context.activeFeature &&
          state.context.activeFeature.id === FATE_KNOTS_FEATURE_ID
      );
    }

    function disposeOtherFeatureUi() {
      const yahtzeeUi = global.GameRoomYahtzeeUi;
      if (yahtzeeUi && typeof yahtzeeUi.dispose === "function") {
        yahtzeeUi.dispose();
      }
    }

    function render() {
      if (isFateKnotsActive()) {
        disposeOtherFeatureUi();
        const root = document.getElementById("app");
        const fateKnotsUi = global.GameRoomFateKnotsUi;
        if (root && fateKnotsUi && typeof fateKnotsUi.render === "function") {
          fateKnotsUi.render(root);
        }
        return;
      }

      const fateKnotsUi = global.GameRoomFateKnotsUi;
      if (fateKnotsUi && typeof fateKnotsUi.dispose === "function") {
        fateKnotsUi.dispose();
      }
      base.render();
    }

    function handleHostMessage(message) {
      if (message && typeof message === "object" && message.type === "fate-knots-hub-state") {
        const fateKnotsUi = global.GameRoomFateKnotsUi;
        if (fateKnotsUi && typeof fateKnotsUi.handleState === "function") {
          fateKnotsUi.handleState(message);
        }
        if (isFateKnotsActive()) render();
        return;
      }

      base.handleHostMessage(message);
      if (isFateKnotsActive() && message && typeof message === "object" && message.type === "host-context") {
        render();
      }
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

      if (isFateKnotsActive()) render();
    }

    return {
      getState: base.getState,
      handleHostMessage: handleHostMessage,
      render: render,
      start: start,
    };
  };
})(window);
