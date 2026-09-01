/* global window, document */

(function (global) {
  const runtimeRegistry = global.GameRoomUiRuntime;
  if (!runtimeRegistry || typeof runtimeRegistry.createGameRoomUiRuntime !== "function") return;

  const createBaseRuntime = runtimeRegistry.createGameRoomUiRuntime;
  const FATE_KNOTS_FEATURE_ID = "fate-knots";

  runtimeRegistry.createGameRoomUiRuntime = function createFateKnotsAwareGameRoomUiRuntime() {
    const base = createBaseRuntime();

    function getBaseState() {
      return typeof base.getState === "function" ? base.getState() : null;
    }

    function getFateKnotsUi() {
      return global.GameRoomFateKnotsUi;
    }

    function syncFateKnotsContext() {
      const fateKnotsUi = getFateKnotsUi();
      const baseState = getBaseState();
      if (
        fateKnotsUi &&
        typeof fateKnotsUi.setContext === "function" &&
        baseState &&
        baseState.context
      ) {
        fateKnotsUi.setContext(baseState.context);
      }
    }

    function isFateKnotsActive() {
      const state = getBaseState();
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
        syncFateKnotsContext();
        const root = document.getElementById("app");
        const fateKnotsUi = getFateKnotsUi();
        if (root && fateKnotsUi && typeof fateKnotsUi.render === "function") {
          fateKnotsUi.render(root);
        }
        return;
      }

      const fateKnotsUi = getFateKnotsUi();
      if (fateKnotsUi && typeof fateKnotsUi.dispose === "function") {
        fateKnotsUi.dispose();
      }
      base.render();
    }

    function isFateKnotsCommandResult(message) {
      return Boolean(
        message &&
        typeof message === "object" &&
        message.type === "command-result" &&
        typeof message.command === "string" &&
        message.command.startsWith("GameRoomFateKnots")
      );
    }

    function handoffGameplayState(message) {
      const gameplayUi = global.GameRoomFateKnotsGameplayUi;
      if (gameplayUi && typeof gameplayUi.handleState === "function") {
        gameplayUi.handleState(message);
      }

      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(
          new global.CustomEvent("fate-knots-gameplay-state", {
            detail: message,
          })
        );
      }
    }

    function handleHostMessage(message) {
      if (message && typeof message === "object" && message.type === "fate-knots-hub-state") {
        const fateKnotsUi = getFateKnotsUi();
        if (fateKnotsUi && typeof fateKnotsUi.handleState === "function") {
          fateKnotsUi.handleState(message);
        }
        if (isFateKnotsActive()) render();
        return;
      }

      if (message && typeof message === "object" && message.type === "fate-knots-gameplay-state") {
        handoffGameplayState(message);
        return;
      }

      if (isFateKnotsCommandResult(message)) {
        const fateKnotsUi = getFateKnotsUi();
        if (fateKnotsUi && typeof fateKnotsUi.handleCommandResult === "function") {
          fateKnotsUi.handleCommandResult(message);
        }
        if (isFateKnotsActive()) render();
        return;
      }

      base.handleHostMessage(message);
      if (
        isFateKnotsActive() &&
        message &&
        typeof message === "object" &&
        message.type === "host-context"
      ) {
        syncFateKnotsContext();
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

      if (isFateKnotsActive()) {
        syncFateKnotsContext();
        render();
      }
    }

    return {
      getState: base.getState,
      handleHostMessage: handleHostMessage,
      render: render,
      start: start,
    };
  };
})(window);
