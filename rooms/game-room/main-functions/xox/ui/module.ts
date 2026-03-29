(function (global) {
  type UnknownRecord = Record<string, unknown>;
  type XoxUiStateRuntime = {
    createGameState: () => unknown;
    sanitizeGameState: (candidate: unknown) => unknown;
    syncPreferencesFromGame: () => void;
  };
  type XoxUiRenderRuntime = {
    renderBootstrap: (root: HTMLElement) => void;
    renderXox: (root: HTMLElement) => void;
  };
  type XoxUiModuleDeps = UnknownRecord;

  const registry = (global.GameRoomUiFactories || (global.GameRoomUiFactories = {})) as {
    createXoxUiStateRuntime: (deps: XoxUiModuleDeps) => XoxUiStateRuntime;
    createXoxUiRenderRuntime: (
      deps: XoxUiModuleDeps & {
        stateRuntime: XoxUiStateRuntime;
      },
    ) => XoxUiRenderRuntime;
    createXoxUiModule?: (deps: XoxUiModuleDeps) => unknown;
  };

  registry.createXoxUiModule = function createXoxUiModule(deps: XoxUiModuleDeps) {
    const stateRuntime = registry.createXoxUiStateRuntime(deps);
    const renderRuntime = registry.createXoxUiRenderRuntime({
      ...deps,
      stateRuntime: stateRuntime,
    });

    return {
      createGameState: stateRuntime.createGameState,
      sanitizeGameState: stateRuntime.sanitizeGameState,
      syncPreferencesFromGame: stateRuntime.syncPreferencesFromGame,
      renderBootstrap: renderRuntime.renderBootstrap,
      renderXox: renderRuntime.renderXox,
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
