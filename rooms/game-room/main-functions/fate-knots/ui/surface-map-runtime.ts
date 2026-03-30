(function (global: GameRoomUiGlobal) {
  function getFactoryRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  const registry = getFactoryRegistry(global);

  registry.createFateKnotsUiSurfaceMapRuntime = function createFateKnotsUiSurfaceMapRuntime(
    deps: GameRoomFateKnotsUiSurfaceMapRuntimeDeps
  ): GameRoomFateKnotsUiSurfaceMapRuntime {
    const createRegion = deps.createRegion;
    const applyFrameArtwork = deps.applyFrameArtwork;
    const getUiAsset = deps.getUiAsset;

    function createSigil(className: string, texture: unknown, overlay: unknown): HTMLElement {
      const sigil = createRegion("div", className, null);
      applyFrameArtwork(sigil, {
        overlay: overlay || null,
        overlaySize: "contain",
        overlayBlend: "screen",
        texture: texture || null,
        textureSize: "contain",
      });
      return sigil;
    }

    function createMapPathLayer(
      nodes: GameRoomFateKnotsMapNode[],
      currentLocationId: string | null
    ): HTMLElement {
      const pathLayer = createRegion("div", "fk-map-shell__paths", null);
      const list = Array.isArray(nodes) ? nodes : [];
      const nodeById = new Map<string, GameRoomFateKnotsMapNode>();

      list.forEach(function (node: GameRoomFateKnotsMapNode) {
        if (node.id && node.marker) {
          nodeById.set(node.id, node);
        }
      });

      const seenPairs = new Set<string>();
      list.forEach(function (node: GameRoomFateKnotsMapNode) {
        const nodeMarker = node.marker;
        if (!node.id || !nodeMarker || !Array.isArray(node.connections)) {
          return;
        }
        node.connections.forEach(function (otherId: string) {
          const other = nodeById.get(otherId);
          const otherMarker = other?.marker;
          if (!otherMarker) {
            return;
          }
          const pairKey = [node.id, other.id].sort().join(":");
          if (seenPairs.has(pairKey)) {
            return;
          }
          seenPairs.add(pairKey);
          const x1 = (Number(nodeMarker.xPct) || 0) * 16;
          const y1 = (Number(nodeMarker.yPct) || 0) * 9;
          const x2 = (Number(otherMarker.xPct) || 0) * 16;
          const y2 = (Number(otherMarker.yPct) || 0) * 9;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (!Number.isFinite(length) || length <= 0) {
            return;
          }
          const segment = createRegion(
            "div",
            "fk-map-shell__path" +
              (node.id === currentLocationId || other.id === currentLocationId
                ? " fk-map-shell__path--active"
                : ""),
            null
          );
          segment.style.left = String(nodeMarker.xPct || 0) + "%";
          segment.style.top = String(nodeMarker.yPct || 0) + "%";
          segment.style.width = String((length / 1600) * 100) + "%";
          segment.style.transform =
            "translateY(-50%) rotate(" + String((Math.atan2(dy, dx) * 180) / Math.PI) + "deg)";
          applyFrameArtwork(segment, {
            overlay:
              node.id === currentLocationId || other.id === currentLocationId
                ? getUiAsset("selectionGlow")
                : null,
            overlaySize: "100% 100%",
            texture: getUiAsset("pathSegment"),
            textureSize: "auto 100%",
          });
          pathLayer.append(segment);
        });
      });

      return pathLayer;
    }

    return {
      createMapPathLayer: createMapPathLayer,
      createSigil: createSigil,
    };
  };
})(window as unknown as GameRoomUiGlobal);
