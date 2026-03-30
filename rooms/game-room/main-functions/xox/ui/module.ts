(function (
  global: typeof globalThis & {
    GameRoomUiFactories?: GameRoomUiFactoriesRegistry;
  }
) {
  type XoxUiStateRuntime = {
    createGameState: () => unknown;
    sanitizeGameState: (candidate: unknown) => unknown;
    syncPreferencesFromGame: () => void;
  };
  type XoxUiRenderRuntime = {
    renderBootstrap: (root: HTMLElement) => void;
    renderXox: (root: HTMLElement) => void;
  };
  type XoxUiModuleRegistry = GameRoomUiFactoriesRegistry & {
    createXoxUiStateRuntime: (deps: GameRoomXoxUiModuleDeps) => XoxUiStateRuntime;
    createXoxUiRenderRuntime: (
      deps: GameRoomXoxUiModuleDeps & {
        stateRuntime: XoxUiStateRuntime;
      }
    ) => XoxUiRenderRuntime;
    createXoxUiModule?: (deps: GameRoomXoxUiModuleDeps) => GameRoomXoxUiModule;
  };

  const registry = (global.GameRoomUiFactories ||
    (global.GameRoomUiFactories = {} as GameRoomUiFactoriesRegistry)) as XoxUiModuleRegistry;

  registry.createXoxUiModule = function createXoxUiModule(deps: GameRoomXoxUiModuleDeps) {
    const stateRuntime = registry.createXoxUiStateRuntime(deps);
    const renderRuntime = registry.createXoxUiRenderRuntime({
      ...deps,
      stateRuntime,
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
