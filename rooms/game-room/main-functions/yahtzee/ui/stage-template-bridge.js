/* global window, document */

(function (global) {
  "use strict";

  const ui = global.GameRoomYahtzeeUi;
  if (!ui || typeof ui.render !== "function" || typeof ui.handleState !== "function") return;

  const originalRender = ui.render.bind(ui);
  const originalHandleState = ui.handleState.bind(ui);
  const originalDispose = typeof ui.dispose === "function" ? ui.dispose.bind(ui) : null;
  let hybridHandle = null;
  let sceneElement = null;

  function disposeHybrid() {
    if (hybridHandle && typeof hybridHandle.dispose === "function") {
      try {
        hybridHandle.dispose();
      } catch (_error) {
        /* best effort */
      }
    }
    hybridHandle = null;
    sceneElement = null;
  }

  function ensureStage(root) {
    const nextScene = root && root.querySelector ? root.querySelector(".yahtzee-scene") : null;
    if (!nextScene) return;

    if (sceneElement !== nextScene) {
      disposeHybrid();
      sceneElement = nextScene;
    }

    let backdrop = nextScene.querySelector(".yahtzee-hybrid-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "yahtzee-hybrid-backdrop";
      nextScene.prepend(backdrop);
    }

    let fx = nextScene.querySelector(".yahtzee-hybrid-fx");
    if (!fx) {
      fx = document.createElement("div");
      fx.className = "yahtzee-hybrid-fx";
      const vignette = nextScene.querySelector(".yahtzee-vignette");
      if (vignette) nextScene.insertBefore(fx, vignette);
      else nextScene.append(fx);
    }

    const shell = nextScene.closest(".yahtzee-shell");
    if (shell) shell.classList.add("is-hybrid-stage");

    if (!hybridHandle) {
      const runtime = global.GameRoomYahtzeeHybridStage;
      if (runtime && typeof runtime.mount === "function") {
        hybridHandle = runtime.mount(nextScene, global.GameRoomYahtzeePirateDeckTheme);
      }
    }
  }

  function syncStage() {
    if (!sceneElement) return;
    const state = typeof ui.getState === "function" ? ui.getState() : null;
    if (hybridHandle && typeof hybridHandle.update === "function") {
      hybridHandle.update(state);
    }
    const sceneRuntime = global.GameRoomYahtzeeBabylonScene;
    if (sceneRuntime && typeof sceneRuntime.syncState === "function") {
      sceneRuntime.syncState(state);
    }
  }

  ui.render = function (root) {
    const result = originalRender(root);
    ensureStage(root);
    syncStage();
    return result;
  };

  ui.handleState = function (message) {
    const result = originalHandleState(message);
    syncStage();
    return result;
  };

  ui.dispose = function () {
    disposeHybrid();
    if (originalDispose) originalDispose();
  };
})(window);
