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
  let activeRoot = null;

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
    if (shell) shell.classList.add("is-hybrid-stage", "is-diegetic-table");

    if (!hybridHandle) {
      const runtime = global.GameRoomYahtzeeHybridStage;
      if (runtime && typeof runtime.mount === "function") {
        hybridHandle = runtime.mount(nextScene, global.GameRoomYahtzeePirateDeckTheme);
      }
    }
  }

  function getState() {
    return typeof ui.getState === "function" ? ui.getState() : null;
  }

  function findLegacyDieButton(index) {
    if (!activeRoot || !activeRoot.querySelector) return null;
    return activeRoot.querySelector('.yahtzee-die[data-die-index="' + String(index) + '"]');
  }

  const stageActions = {
    canToggleDie: function (index) {
      const button = findLegacyDieButton(index);
      return Boolean(button && button.disabled !== true);
    },
    toggleDie: function (index) {
      const button = findLegacyDieButton(index);
      if (!button || button.disabled === true || typeof button.click !== "function") return false;
      button.click();
      return true;
    },
  };

  global.GameRoomYahtzeeStageActions = stageActions;

  function createStageInterface(overlay) {
    const stageInterface = document.createElement("div");
    stageInterface.className = "yahtzee-stage-interface";

    const statusDock = document.createElement("div");
    statusDock.className = "yahtzee-stage-status-dock";

    const actionBar = document.createElement("div");
    actionBar.className = "yahtzee-stage-action-bar";

    stageInterface.append(statusDock, actionBar);
    overlay.append(stageInterface);
    return { stageInterface: stageInterface, statusDock: statusDock, actionBar: actionBar };
  }

  function promoteDiegeticUi(root) {
    if (!root || !root.querySelector) return;
    activeRoot = root;

    const overlay = root.querySelector(".yahtzee-overlay");
    if (!overlay) return;

    const controls = overlay.querySelector(".yahtzee-controls");
    const playArea = overlay.querySelector(".yahtzee-play-area");
    const dicePanel = playArea ? playArea.querySelector(".yahtzee-dice-panel") : null;
    const diceRow = dicePanel ? dicePanel.querySelector(".yahtzee-dice-row") : null;
    const status = dicePanel ? dicePanel.querySelector(".yahtzee-status") : null;
    const rollMeta = dicePanel ? dicePanel.querySelector(".yahtzee-roll-meta") : null;
    const scoreStack = playArea ? playArea.querySelector(".yahtzee-score-stack") : null;
    const rollButton = controls ? controls.querySelector("button.primary") : null;
    const state = getState() || {};
    const players = Array.isArray(state.players) ? state.players : [];
    const playerCount = Math.max(1, players.length || 1);

    const parts = createStageInterface(overlay);
    parts.stageInterface.dataset.playerCount = String(playerCount);
    parts.stageInterface.dataset.activePlayer = String(Number(state.activePlayerIndex) || 0);
    parts.stageInterface.classList.toggle("is-match-active", state.active === true);
    parts.stageInterface.classList.toggle("is-result", state.complete === true);

    if (diceRow) {
      diceRow.hidden = true;
      diceRow.classList.add("is-stage-proxy");
    }

    if (status) {
      parts.statusDock.append(status);
      parts.statusDock.hidden = state.active !== true && state.complete !== true;
    } else {
      parts.statusDock.hidden = true;
    }

    if (rollButton) {
      rollButton.classList.add("yahtzee-stage-roll-button");
      rollButton.hidden = state.active !== true || state.complete === true;
      parts.actionBar.append(rollButton);
    }

    if (rollMeta) {
      rollMeta.classList.add("yahtzee-stage-roll-meta");
      rollMeta.hidden = state.active !== true || state.complete === true;
      parts.actionBar.append(rollMeta);
    }
    parts.actionBar.hidden = state.active !== true || state.complete === true;

    if (scoreStack) {
      scoreStack.classList.add("is-diegetic");
      scoreStack.dataset.playerCount = String(playerCount);
      scoreStack.hidden = state.active !== true && state.complete !== true;
      Array.from(scoreStack.querySelectorAll(".yahtzee-score-card")).forEach(function (card, index) {
        card.dataset.seatIndex = String(index);
      });
      parts.stageInterface.append(scoreStack);
    }

    if (dicePanel) dicePanel.remove();
    if (playArea) playArea.remove();
  }

  function syncStage() {
    if (!sceneElement) return;
    const state = getState();
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
    promoteDiegeticUi(root);
    syncStage();
    return result;
  };

  ui.handleState = function (message) {
    const result = originalHandleState(message);
    syncStage();
    return result;
  };

  ui.dispose = function () {
    activeRoot = null;
    disposeHybrid();
    if (originalDispose) originalDispose();
  };
})(window);
