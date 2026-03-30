(function (global: GameRoomUiGlobal) {
  function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  const registry = getFactoryRegistry(global);

  registry.createFateKnotsUiSurfaceRuntime = function createFateKnotsUiSurfaceRuntime(
    deps: GameRoomFateKnotsUiSurfaceRuntimeDeps
  ): GameRoomFateKnotsUiSurfaceRuntime {
    const createFateKnotsUiSurfaceAssetsRuntime = registry.createFateKnotsUiSurfaceAssetsRuntime;
    if (typeof createFateKnotsUiSurfaceAssetsRuntime !== "function") {
      throw new Error("createFateKnotsUiSurfaceAssetsRuntime is unavailable.");
    }

    const createFateKnotsUiSurfacePrimitivesRuntime =
      registry.createFateKnotsUiSurfacePrimitivesRuntime;
    if (typeof createFateKnotsUiSurfacePrimitivesRuntime !== "function") {
      throw new Error("createFateKnotsUiSurfacePrimitivesRuntime is unavailable.");
    }

    const createFateKnotsUiSurfaceMapRuntime = registry.createFateKnotsUiSurfaceMapRuntime;
    if (typeof createFateKnotsUiSurfaceMapRuntime !== "function") {
      throw new Error("createFateKnotsUiSurfaceMapRuntime is unavailable.");
    }

    const fateKnotsUiSurfaceAssetsRuntime = createFateKnotsUiSurfaceAssetsRuntime({
      createDefaultAsset: deps.createDefaultAsset,
      getCurrentState: deps.getCurrentState,
      sanitizeAssetLink: deps.sanitizeAssetLink,
    });
    const fateKnotsUiSurfacePrimitivesRuntime = createFateKnotsUiSurfacePrimitivesRuntime({
      createElement: deps.createElement,
      getUiAsset: fateKnotsUiSurfaceAssetsRuntime.getUiAsset,
      sanitizeAssetLink: deps.sanitizeAssetLink,
    });
    const fateKnotsUiSurfaceMapRuntime = createFateKnotsUiSurfaceMapRuntime({
      applyFrameArtwork: fateKnotsUiSurfacePrimitivesRuntime.applyFrameArtwork,
      createRegion: fateKnotsUiSurfacePrimitivesRuntime.createRegion,
      getUiAsset: fateKnotsUiSurfaceAssetsRuntime.getUiAsset,
    });

    return {
      ...fateKnotsUiSurfaceAssetsRuntime,
      ...fateKnotsUiSurfacePrimitivesRuntime,
      ...fateKnotsUiSurfaceMapRuntime,
    };
  };
})(window as unknown as GameRoomUiGlobal);
