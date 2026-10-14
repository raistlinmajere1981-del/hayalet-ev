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

    function getFateKnotsGameplayUi() {
      return global.GameRoomFateKnotsGameplayUi;
    }

    function getFateKnotsUs1MirrorUi() {
      return global.GameRoomFateKnotsUs1MirrorUi;
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

    function renderFateKnots(root) {
      const mirrorUi = getFateKnotsUs1MirrorUi();
      if (
        mirrorUi &&
        typeof mirrorUi.hasMirrorState === "function" &&
        mirrorUi.hasMirrorState() &&
        typeof mirrorUi.render === "function"
      ) {
        mirrorUi.render(root);
        return;
      }

      const gameplayUi = getFateKnotsGameplayUi();
      if (
        gameplayUi &&
        typeof gameplayUi.hasGameplayState === "function" &&
        gameplayUi.hasGameplayState() &&
        typeof gameplayUi.render === "function"
      ) {
        gameplayUi.render(root);
        return;
      }

      const fateKnotsUi = getFateKnotsUi();
      if (fateKnotsUi && typeof fateKnotsUi.render === "function") {
        fateKnotsUi.render(root);
      }
    }

    function render() {
      if (isFateKnotsActive()) {
        disposeOtherFeatureUi();
        syncFateKnotsContext();
        const root = document.getElementById("app");
        if (root) renderFateKnots(root);
        return;
      }

      const fateKnotsUi = getFateKnotsUi();
      if (fateKnotsUi && typeof fateKnotsUi.dispose === "function") {
        fateKnotsUi.dispose();
      }
      const gameplayUi = getFateKnotsGameplayUi();
      if (gameplayUi && typeof gameplayUi.dispose === "function") {
        gameplayUi.dispose();
      }
      const mirrorUi = getFateKnotsUs1MirrorUi();
      if (mirrorUi && typeof mirrorUi.dispose === "function") {
        mirrorUi.dispose();
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

    function dispatchFateKnotsEvent(eventName, message) {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(
          new global.CustomEvent(eventName, {
            detail: message,
          })
        );
      }
    }

    function handoffGameplayState(message) {
      const gameplayUi = getFateKnotsGameplayUi();
      if (gameplayUi && typeof gameplayUi.handleState === "function") {
        gameplayUi.handleState(message);
      }
      dispatchFateKnotsEvent("fate-knots-gameplay-state", message);
    }

    function handoffUs1MirrorState(message) {
      const mirrorUi = getFateKnotsUs1MirrorUi();
      if (mirrorUi && typeof mirrorUi.handleState === "function") {
        mirrorUi.handleState(message);
      }
      dispatchFateKnotsEvent("fate-knots-us1-mirror-state", message);
    }

    function handoffRunSetupSeatState(message) {
      const fateKnotsUi = getFateKnotsUi();
      if (fateKnotsUi && typeof fateKnotsUi.handleRunSetupSeatState === "function") {
        fateKnotsUi.handleRunSetupSeatState(message);
      }
      dispatchFateKnotsEvent("fate-knots-run-setup-seat-state", message);
    }

    function handoffCombatDiscussionState(message) {
      const gameplayUi = getFateKnotsGameplayUi();
      if (gameplayUi && typeof gameplayUi.handleCombatDiscussionState === "function") {
        gameplayUi.handleCombatDiscussionState(message);
      }
      dispatchFateKnotsEvent("fate-knots-combat-discussion-state", message);
    }

    function handoffExplorationConsensusState(message) {
      const gameplayUi = getFateKnotsGameplayUi();
      if (gameplayUi && typeof gameplayUi.handleExplorationConsensusState === "function") {
        gameplayUi.handleExplorationConsensusState(message);
      }
      dispatchFateKnotsEvent("fate-knots-exploration-consensus-state", message);
    }

    function handoffCampState(message) {
      const gameplayUi = getFateKnotsGameplayUi();
      if (gameplayUi && typeof gameplayUi.handleCampState === "function") {
        gameplayUi.handleCampState(message);
      }
      dispatchFateKnotsEvent("fate-knots-camp-state", message);
    }

    function handoffNpcDialogueState(message) {
      const gameplayUi = getFateKnotsGameplayUi();
      if (gameplayUi && typeof gameplayUi.handleNpcDialogueState === "function") {
        gameplayUi.handleNpcDialogueState(message);
      }
      dispatchFateKnotsEvent("fate-knots-npc-dialogue-state", message);
    }

    function handoffLootState(message) {
      const gameplayUi = getFateKnotsGameplayUi();
      if (gameplayUi && typeof gameplayUi.handleLootState === "function") {
        gameplayUi.handleLootState(message);
      }
      dispatchFateKnotsEvent("fate-knots-loot-state", message);
    }

    function handoffCommandResult(message) {
      const mirrorUi = getFateKnotsUs1MirrorUi();
      const mirrorHandled = Boolean(
        mirrorUi &&
          typeof mirrorUi.handleCommandResult === "function" &&
          mirrorUi.handleCommandResult(message)
      );
      if (mirrorHandled) return;

      const gameplayUi = getFateKnotsGameplayUi();
      const gameplayHandled = Boolean(
        gameplayUi &&
          typeof gameplayUi.handleCommandResult === "function" &&
          gameplayUi.handleCommandResult(message)
      );
      if (gameplayHandled) return;

      const fateKnotsUi = getFateKnotsUi();
      if (fateKnotsUi && typeof fateKnotsUi.handleCommandResult === "function") {
        fateKnotsUi.handleCommandResult(message);
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

      if (
        message &&
        typeof message === "object" &&
        message.type === "fate-knots-us1-mirror-state"
      ) {
        handoffUs1MirrorState(message);
        if (isFateKnotsActive()) render();
        return;
      }

      if (
        message &&
        typeof message === "object" &&
        message.type === "fate-knots-run-setup-seat-state"
      ) {
        handoffRunSetupSeatState(message);
        if (isFateKnotsActive()) render();
        return;
      }

      if (message && typeof message === "object" && message.type === "fate-knots-gameplay-state") {
        handoffGameplayState(message);
        if (isFateKnotsActive()) render();
        return;
      }

      if (
        message &&
        typeof message === "object" &&
        message.type === "fate-knots-combat-discussion-state"
      ) {
        handoffCombatDiscussionState(message);
        if (isFateKnotsActive()) render();
        return;
      }

      if (
        message &&
        typeof message === "object" &&
        message.type === "fate-knots-exploration-consensus-state"
      ) {
        handoffExplorationConsensusState(message);
        if (isFateKnotsActive()) render();
        return;
      }

      if (message && typeof message === "object" && message.type === "fate-knots-camp-state") {
        handoffCampState(message);
        if (isFateKnotsActive()) render();
        return;
      }

      if (
        message &&
        typeof message === "object" &&
        message.type === "fate-knots-npc-dialogue-state"
      ) {
        handoffNpcDialogueState(message);
        if (isFateKnotsActive()) render();
        return;
      }

      if (message && typeof message === "object" && message.type === "fate-knots-loot-state") {
        handoffLootState(message);
        if (isFateKnotsActive()) render();
        return;
      }

      if (isFateKnotsCommandResult(message)) {
        handoffCommandResult(message);
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
