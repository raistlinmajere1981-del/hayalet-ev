/* global window */

(function (global: any) {
  type UnknownRecord = Record<string, unknown>;
  type UiStateRef = { current?: unknown };
  type XoxUiModule = {
    sanitizeGameState: (candidate: unknown) => unknown;
    syncPreferencesFromGame: () => void;
  };
  type TeamTetrisUiModule = {
    sanitizeTeamTetrisState: (candidate: unknown) => unknown;
    syncTeamTetrisPreferencesFromState: () => void;
    syncTeamTetrisDraftFromState: () => void;
  };
  type FateKnotsUiModule = {
    sanitizeFateKnotsState: (candidate: unknown) => unknown;
  };
  type RenderHandler = () => void;

  function readRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === "object" && Array.isArray(value) === false
      ? (value as UnknownRecord)
      : null;
  }

  const registryHost = global as unknown as typeof globalThis & Record<string, unknown>;
  const registry =
    (registryHost["GameRoomUiStateMessageRuntime"] as Record<string, unknown> | undefined) ||
    ((registryHost["GameRoomUiStateMessageRuntime"] = {}) as Record<string, unknown>);

  registry["createGameRoomUiStateMessageRuntime"] = function createGameRoomUiStateMessageRuntime(
    options: unknown
  ) {
    const runtimeOptions = readRecord(options) || {};
    const stateRef = (runtimeOptions["stateRef"] as UiStateRef | undefined) || {};
    const xoxUi = runtimeOptions["xoxUi"] as XoxUiModule;
    const teamTetrisUi = runtimeOptions["teamTetrisUi"] as TeamTetrisUiModule;
    const fateKnotsUi = runtimeOptions["fateKnotsUi"] as FateKnotsUiModule;
    const render =
      typeof runtimeOptions["render"] === "function"
        ? (runtimeOptions["render"] as RenderHandler)
        : function () {};

    function getState() {
      const current = readRecord(stateRef["current"]);
      return current;
    }

    function readPayload(message: unknown): UnknownRecord {
      const source = readRecord(message);
      return readRecord(source?.["payload"]) || {};
    }

    function handleXoxState(message: unknown) {
      const state = getState();
      if (state === null) {
        return;
      }
      const payload = readPayload(message);
      state["game"] = xoxUi.sanitizeGameState(payload["state"]);
      xoxUi.syncPreferencesFromGame();
      state["lastCommandMessage"] = "";
      render();
    }

    function handleTeamTetrisState(message: unknown) {
      const state = getState();
      if (state === null) {
        return;
      }
      const payload = readPayload(message);
      state["teamTetris"] = teamTetrisUi.sanitizeTeamTetrisState(payload["state"]);
      teamTetrisUi.syncTeamTetrisPreferencesFromState();
      teamTetrisUi.syncTeamTetrisDraftFromState();
      state["lastCommandMessage"] = "";
      render();
    }

    function handleFateKnotsState(message: unknown) {
      const state = getState();
      if (state === null) {
        return;
      }
      const payload = readPayload(message);
      state["fateKnots"] = fateKnotsUi.sanitizeFateKnotsState(payload["state"]);
      state["lastCommandMessage"] = "";
      render();
    }

    function handleCommandResult(message: unknown) {
      const state = getState();
      if (state === null) {
        return;
      }
      const source = readRecord(message);
      const result = readRecord(source?.["result"]) || {};
      if (typeof result["message"] === "string" && result["message"].trim() !== "") {
        state["lastCommandMessage"] = result["message"].trim();
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
