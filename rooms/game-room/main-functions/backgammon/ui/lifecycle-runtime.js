/* global window */

(function (global) {
  "use strict";

  const factories = global.GameRoomUiFactories;
  if (!factories || typeof factories.createBackgammonStageRuntime !== "function") return;

  const createStageRuntime = factories.createBackgammonStageRuntime;
  const instances = new Set();
  const lifecycleRegistry =
    global.GameRoomBackgammonStageRuntime || (global.GameRoomBackgammonStageRuntime = {});

  factories.createBackgammonStageRuntime = function createTrackedBackgammonStageRuntime(deps) {
    const instance = createStageRuntime(deps);
    if (instance && typeof instance.destroy === "function") instances.add(instance);
    return instance;
  };

  lifecycleRegistry.destroyAll = function destroyAllBackgammonStages() {
    instances.forEach(function (instance) {
      try {
        instance.destroy();
      } catch (_error) {
        /* best effort: feature switches must never strand the room runtime */
      }
    });
  };
})(window);
