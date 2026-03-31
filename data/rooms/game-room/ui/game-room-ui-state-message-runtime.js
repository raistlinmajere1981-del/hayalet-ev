(function(global) {
  function readRecord(value) {
    return value && typeof value === "object" && Array.isArray(value) === false ? value : null;
  }
  function readRuntimeOptions(value) {
    return readRecord(value) ? value : null;
  }
  function getStateMessageRegistry(host) {
    return host.GameRoomUiStateMessageRuntime || (host.GameRoomUiStateMessageRuntime = {});
  }
  const registry = getStateMessageRegistry(global);
  registry.createGameRoomUiStateMessageRuntime = function createGameRoomUiStateMessageRuntime(options) {
    const runtimeOptions = readRuntimeOptions(options);
    if (!runtimeOptions) {
      throw new Error("Game Room UI state message runtime options are invalid.");
    }
    const stateRef = runtimeOptions.stateRef;
    const xoxUi = runtimeOptions.xoxUi;
    const teamTetrisUi = runtimeOptions.teamTetrisUi;
    const fateKnotsUi = runtimeOptions.fateKnotsUi;
    const render = runtimeOptions.render;
    function getState() {
      return stateRef.current;
    }
    function readPayload(message) {
      const source = readRecord(message);
      return readRecord(source?.["payload"]) || {};
    }
    function handleXoxState(message) {
      const state = getState();
      if (state === null) {
        return;
      }
      const payload = readPayload(message);
      state.game = xoxUi.sanitizeGameState(payload["state"]);
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
      state.teamTetris = teamTetrisUi.sanitizeTeamTetrisState(payload["state"]);
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
      state.fateKnots = fateKnotsUi.sanitizeFateKnotsState(payload["state"]);
      state.lastCommandMessage = "";
      render();
    }
    function handleCommandResult(message) {
      const state = getState();
      if (state === null) {
        return;
      }
      const source = readRecord(message);
      const result = readRecord(source?.["result"]) || {};
      if (typeof result["message"] === "string" && result["message"].trim() !== "") {
        state.lastCommandMessage = result["message"].trim();
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
