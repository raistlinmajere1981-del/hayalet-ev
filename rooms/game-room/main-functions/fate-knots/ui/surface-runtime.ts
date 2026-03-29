(function (global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});

  registry.createFateKnotsUiSurfaceRuntime = function createFateKnotsUiSurfaceRuntime(deps) {
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
})(typeof window !== "undefined" ? window : globalThis);
