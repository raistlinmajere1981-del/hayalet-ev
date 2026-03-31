(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createXoxUiModule = function createXoxUiModule(deps) {
    const stateRuntime = registry.createXoxUiStateRuntime(deps);
    const renderRuntime = registry.createXoxUiRenderRuntime({
      ...deps,
      stateRuntime
    });
    return {
      createGameState: stateRuntime.createGameState,
      sanitizeGameState: stateRuntime.sanitizeGameState,
      syncPreferencesFromGame: stateRuntime.syncPreferencesFromGame,
      renderBootstrap: renderRuntime.renderBootstrap,
      renderXox: renderRuntime.renderXox
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
