/* global window, document */

(function (global) {
  "use strict";

  function createElement(className, parent) {
    const element = document.createElement("div");
    element.className = className;
    if (parent) parent.append(element);
    return element;
  }

  function safeImage(element, src) {
    if (!element) return false;
    if (typeof src === "string" && src.trim() !== "") {
      element.style.backgroundImage = "url(" + JSON.stringify(src) + ")";
      element.classList.add("has-art");
      return true;
    }
    element.style.removeProperty("background-image");
    element.classList.remove("has-art");
    return false;
  }

  function initials(label) {
    return (
      String(label || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (part) {
          return part.charAt(0).toUpperCase();
        })
        .join("") || "?"
    );
  }

  function readAvatar(player) {
    if (!player || typeof player !== "object") return null;
    return player.avatarSrc || player.avatar || player.imageSrc || null;
  }

  function createActor(parent, side) {
    const actor = createElement(`yahtzee-stage-player is-${side}`, parent);
    actor.dataset.side = side;
    const art = createElement("yahtzee-stage-player-art", actor);
    const face = createElement("yahtzee-stage-player-face", art);
    const label = createElement("yahtzee-stage-player-label", actor);
    return { root: actor, art: art, face: face, label: label };
  }

  function mount(sceneElement, theme) {
    if (!sceneElement) return null;
    const resolvedTheme = theme || global.GameRoomYahtzeePirateDeckTheme || {};
    const assets = resolvedTheme.assets || {};

    const backdrop = sceneElement.querySelector(".yahtzee-hybrid-backdrop");
    const fx = sceneElement.querySelector(".yahtzee-hybrid-fx");
    if (!backdrop || !fx) return null;

    backdrop.innerHTML = "";
    fx.innerHTML = "";

    const sky = createElement("yahtzee-stage-sky", backdrop);
    const sea = createElement("yahtzee-stage-sea", backdrop);
    const environment = createElement("yahtzee-stage-environment", backdrop);
    const deckBackdrop = createElement("yahtzee-stage-deck-backdrop", backdrop);
    createElement("yahtzee-stage-horizon-fog", backdrop);
    const crewLayer = createElement("yahtzee-stage-crew", backdrop);
    const playerLayer = createElement("yahtzee-stage-players", backdrop);
    createElement("yahtzee-stage-lantern-bloom", backdrop);
    const lightning = createElement("yahtzee-stage-lightning", fx);
    createElement("yahtzee-stage-rain-haze", fx);

    const hasIntegratedEnvironment = safeImage(environment, assets.environment);
    const hasEnvironmentArt = hasIntegratedEnvironment
      ? true
      : [
          safeImage(sky, assets.sky),
          safeImage(sea, assets.sea),
          safeImage(deckBackdrop, assets.deckBackdrop),
        ].some(Boolean);
    safeImage(lightning, assets.lightning);
    sceneElement.classList.toggle("has-hybrid-art", hasEnvironmentArt);
    sceneElement.classList.toggle("has-integrated-environment", hasIntegratedEnvironment);

    const crewCount = Math.max(
      0,
      Number(resolvedTheme.stage && resolvedTheme.stage.crewCount) || 4
    );
    for (let index = 0; index < crewCount; index += 1) {
      const standee = createElement(`yahtzee-stage-crew-member crew-${index + 1}`, crewLayer);
      standee.dataset.crewIndex = String(index);
      safeImage(standee, Array.isArray(assets.crew) ? assets.crew[index] : null);
    }
    crewLayer.hidden = crewCount === 0;

    const leftActor = createActor(playerLayer, "left");
    const rightActor = createActor(playerLayer, "right");
    safeImage(leftActor.art, assets.playerLeft);
    safeImage(rightActor.art, assets.playerRight);
    playerLayer.hidden = Boolean(
      resolvedTheme.stage && resolvedTheme.stage.playerStandeesEnabled === false
    );

    let disposed = false;

    function updateActor(actor, player, active, fallbackArt) {
      if (!actor) return;
      actor.root.hidden = !player;
      if (!player) return;
      actor.root.dataset.seatId = String(player.seatId || "");
      actor.root.classList.toggle("is-active", active === true);
      actor.label.textContent = player.label || player.seatId || "Player";
      const avatar = readAvatar(player);
      safeImage(actor.face, avatar);
      actor.face.textContent = avatar ? "" : initials(player.label || player.seatId);
      if (!avatar) safeImage(actor.art, fallbackArt);
    }

    function update(state) {
      if (disposed) return;
      const source = state && typeof state === "object" ? state : {};
      const players = Array.isArray(source.players) ? source.players : [];
      const activeIndex = Number(source.activePlayerIndex) || 0;
      const phase =
        source.complete === true ? "result" : source.active === true ? "match" : "showcase";
      const pan = phase === "match" && players.length > 1 ? (activeIndex === 1 ? -0.18 : 0.18) : 0;

      sceneElement.dataset.yahtzeeStagePhase = phase;
      sceneElement.dataset.yahtzeeActivePlayer = String(activeIndex);
      sceneElement.style.setProperty("--yahtzee-stage-pan-x", pan + "%");
      sceneElement.classList.toggle("has-two-players", players.length > 1);
      fx.classList.toggle(
        "lightning-enabled",
        Boolean(resolvedTheme.stage && resolvedTheme.stage.lightningEnabled !== false)
      );
      sea.classList.toggle(
        "sea-enabled",
        Boolean(resolvedTheme.stage && resolvedTheme.stage.seaEnabled !== false)
      );

      updateActor(
        leftActor,
        players[0] || null,
        source.active === true && activeIndex === 0,
        assets.playerLeft
      );
      updateActor(
        rightActor,
        players[1] || null,
        source.active === true && activeIndex === 1,
        assets.playerRight
      );
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      backdrop.innerHTML = "";
      fx.innerHTML = "";
      delete sceneElement.dataset.yahtzeeStagePhase;
      delete sceneElement.dataset.yahtzeeActivePlayer;
      sceneElement.style.removeProperty("--yahtzee-stage-pan-x");
      sceneElement.classList.remove(
        "has-hybrid-art",
        "has-integrated-environment",
        "has-two-players"
      );
    }

    return {
      update: update,
      dispose: dispose,
    };
  }

  global.GameRoomYahtzeeHybridStage = {
    mount: mount,
  };
})(window);
