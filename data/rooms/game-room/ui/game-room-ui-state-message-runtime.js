(function(global) {
  function readRecord(value) {
    return value && typeof value === "object" && Array.isArray(value) === false ? value : null;
  }
  const registryHost = global;
  const registry = registryHost.GameRoomUiStateMessageRuntime || (registryHost.GameRoomUiStateMessageRuntime = {});
  registry.createGameRoomUiStateMessageRuntime = function createGameRoomUiStateMessageRuntime(options) {
    const runtimeOptions = readRecord(options) || {};
    const stateRef = runtimeOptions.stateRef || {};
    const xoxUi = runtimeOptions.xoxUi;
    const teamTetrisUi = runtimeOptions.teamTetrisUi;
    const fateKnotsUi = runtimeOptions.fateKnotsUi;
    const render = typeof runtimeOptions.render === "function" ? runtimeOptions.render : function() {
    };
    function getState() {
      const current = readRecord(stateRef.current);
      return current;
    }
    function readPayload(message) {
      const source = readRecord(message);
      return readRecord(source?.payload) || {};
    }
    function handleXoxState(message) {
      const state = getState();
      if (state === null) {
        return;
      }
      const payload = readPayload(message);
      state.game = xoxUi.sanitizeGameState(payload.state);
      xoxUi.syncPreferencesFromGame();
      state.lastCommandMessage = "";
      render();
    }
    function handleTeamTetrisState(message) {
      const state = getState();
      if (state === null) {
        return;
      }
      const payload = readPayload(message);
      state.teamTetris = teamTetrisUi.sanitizeTeamTetrisState(payload.state);
      teamTetrisUi.syncTeamTetrisPreferencesFromState();
      teamTetrisUi.syncTeamTetrisDraftFromState();
      state.lastCommandMessage = "";
      render();
    }
    function handleFateKnotsState(message) {
      const state = getState();
      if (state === null) {
        return;
      }
      const payload = readPayload(message);
      state.fateKnots = fateKnotsUi.sanitizeFateKnotsState(payload.state);
      state.lastCommandMessage = "";
      render();
    }
    function handleCommandResult(message) {
      const state = getState();
      if (state === null) {
        return;
      }
      const source = readRecord(message);
      const result = readRecord(source?.result) || {};
      if (typeof result.message === "string" && result.message.trim() !== "") {
        state.lastCommandMessage = result.message.trim();
      }
      render();
    }
    return {
      handleXoxState,
      handleTeamTetrisState,
      handleFateKnotsState,
      handleCommandResult
    };
  };
})(window);
