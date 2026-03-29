/* global window */

(function (global) {
  const registry =
    global.GameRoomUiStateMessageRuntime || (global.GameRoomUiStateMessageRuntime = {});

  registry.createGameRoomUiStateMessageRuntime =
    function createGameRoomUiStateMessageRuntime(options) {
      const runtimeOptions =
        options && typeof options === "object" && Array.isArray(options) === false ? options : {};
      const stateRef = runtimeOptions.stateRef;
      const xoxUi = runtimeOptions.xoxUi;
      const teamTetrisUi = runtimeOptions.teamTetrisUi;
      const fateKnotsUi = runtimeOptions.fateKnotsUi;
      const render = runtimeOptions.render;

      function getState() {
        return stateRef.current;
      }

      function readPayload(message) {
        return message && message.payload && typeof message.payload === "object" && Array.isArray(message.payload) === false
          ? message.payload
          : {};
      }

      function handleXoxState(message) {
        const state = getState();
        const payload = readPayload(message);
        state.game = xoxUi.sanitizeGameState(payload.state);
        xoxUi.syncPreferencesFromGame();
        state.lastCommandMessage = "";
        render();
      }

      function handleTeamTetrisState(message) {
        const state = getState();
        const payload = readPayload(message);
        state.teamTetris = teamTetrisUi.sanitizeTeamTetrisState(payload.state);
        teamTetrisUi.syncTeamTetrisPreferencesFromState();
        teamTetrisUi.syncTeamTetrisDraftFromState();
        state.lastCommandMessage = "";
        render();
      }

      function handleFateKnotsState(message) {
        const state = getState();
        const payload = readPayload(message);
        state.fateKnots = fateKnotsUi.sanitizeFateKnotsState(payload.state);
        state.lastCommandMessage = "";
        render();
      }

      function handleCommandResult(message) {
        const state = getState();
        const result =
          message && message.result && typeof message.result === "object" && Array.isArray(message.result) === false
            ? message.result
            : {};
        if (typeof result.message === "string" && result.message.trim() !== "") {
          state.lastCommandMessage = result.message.trim();
        }
        render();
      }

      return {
        handleXoxState: handleXoxState,
        handleTeamTetrisState: handleTeamTetrisState,
        handleFateKnotsState: handleFateKnotsState,
        handleCommandResult: handleCommandResult,
      };
    };
})(window);
