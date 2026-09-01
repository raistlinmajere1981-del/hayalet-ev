/* global window */

(function (global) {
  "use strict";

  const registry = global.GameRoomBackgammonStageRuntime;
  if (!registry || typeof registry.createBackgammonStageRuntime !== "function") return;

  const createStageRuntime = registry.createBackgammonStageRuntime;
  const instances = new Set();

  registry.createBackgammonStageRuntime = function createTrackedBackgammonStageRuntime(deps) {
    const instance = createStageRuntime(deps);
    if (instance && typeof instance.destroy === "function") instances.add(instance);
    return instance;
  };

  registry.destroyAll = function destroyAllBackgammonStages() {
    instances.forEach(function (instance) {
      try {
        instance.destroy();
      } catch (_error) {
        /* best effort: feature switches must never strand the room runtime */
      }
    });
  };
})(window);
