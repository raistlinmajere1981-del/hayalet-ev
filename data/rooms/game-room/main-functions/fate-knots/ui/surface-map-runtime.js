(function(global) {
  const registry = global.GameRoomUiFactories || (global.GameRoomUiFactories = {});
  registry.createFateKnotsUiSurfaceMapRuntime = function createFateKnotsUiSurfaceMapRuntime(deps) {
    const createRegion = deps.createRegion;
    const applyFrameArtwork = deps.applyFrameArtwork;
    const getUiAsset = deps.getUiAsset;
    function createSigil(className, texture, overlay) {
      const sigil = createRegion("div", className, null);
      applyFrameArtwork(sigil, {
        overlay: overlay || null,
        overlaySize: "contain",
        overlayBlend: "screen",
        texture: texture || null,
        textureSize: "contain"
      });
      return sigil;
    }
    function createMapPathLayer(nodes, currentLocationId) {
      const pathLayer = createRegion("div", "fk-map-shell__paths", null);
      const list = Array.isArray(nodes) ? nodes : [];
      const nodeById = /* @__PURE__ */ new Map();
      list.forEach(function(node) {
        if (node && node.id && node.marker) {
          nodeById.set(node.id, node);
        }
      });
      const seenPairs = /* @__PURE__ */ new Set();
      list.forEach(function(node) {
        if (!node || !node.id || !node.marker || !Array.isArray(node.connections)) {
          return;
        }
        node.connections.forEach(function(otherId) {
          const other = nodeById.get(otherId);
          if (!other || !other.marker) {
            return;
          }
          const pairKey = [node.id, other.id].sort().join(":");
          if (seenPairs.has(pairKey)) {
            return;
          }
          seenPairs.add(pairKey);
          const x1 = (Number(node.marker.xPct) || 0) * 16;
          const y1 = (Number(node.marker.yPct) || 0) * 9;
          const x2 = (Number(other.marker.xPct) || 0) * 16;
          const y2 = (Number(other.marker.yPct) || 0) * 9;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (!Number.isFinite(length) || length <= 0) {
            return;
          }
          const segment = createRegion(
            "div",
            "fk-map-shell__path" + (node.id === currentLocationId || other.id === currentLocationId ? " fk-map-shell__path--active" : ""),
            null
          );
          segment.style.left = String(node.marker.xPct || 0) + "%";
          segment.style.top = String(node.marker.yPct || 0) + "%";
          segment.style.width = String(length / 1600 * 100) + "%";
          segment.style.transform = "translateY(-50%) rotate(" + String(Math.atan2(dy, dx) * 180 / Math.PI) + "deg)";
          applyFrameArtwork(segment, {
            overlay: node.id === currentLocationId || other.id === currentLocationId ? getUiAsset("selectionGlow") : null,
            overlaySize: "100% 100%",
            texture: getUiAsset("pathSegment"),
            textureSize: "auto 100%"
          });
          pathLayer.append(segment);
        });
      });
      return pathLayer;
    }
    return {
      createMapPathLayer,
      createSigil
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
