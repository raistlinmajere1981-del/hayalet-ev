/* global window */

(function (global) {
  "use strict";

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * clamp01(amount);
  }

  function normalizeShot(theme, name) {
    const shots = theme && theme.shots ? theme.shots : {};
    return shots[name] || shots.match || shots.showcase || null;
  }

  function create(camera, B, theme, options) {
    if (!camera || !B || !theme) return null;

    const reduceMotion = Boolean(options && options.reduceMotion);
    let currentName = "showcase";
    let targetShot = normalizeShot(theme, currentName);
    let returnShotName = null;
    let temporaryUntil = 0;
    let disposed = false;
    const currentTarget = new B.Vector3(0, 1, 0);

    function readCameraTarget() {
      if (camera.target && typeof camera.target.clone === "function") {
        return camera.target.clone();
      }
      return currentTarget.clone();
    }

    function applyImmediate(shot) {
      if (!shot) return;
      camera.alpha = Number(shot.alpha);
      camera.beta = Number(shot.beta);
      camera.radius = Number(shot.radius);
      const target = Array.isArray(shot.target) ? shot.target : [0, 1, 0];
      currentTarget.set(Number(target[0]) || 0, Number(target[1]) || 0, Number(target[2]) || 0);
      camera.setTarget(currentTarget);
    }

    function setShot(name, options) {
      if (disposed) return;
      const next = normalizeShot(theme, name);
      if (!next) return;
      currentName = name;
      targetShot = next;
      const settings = options || {};
      if (settings.immediate === true || reduceMotion) {
        applyImmediate(next);
      }
      if (settings.temporary === true) {
        returnShotName = settings.returnTo || "match";
        temporaryUntil =
          Date.now() + Math.max(0, Number(next.holdMs) || Number(settings.holdMs) || 700);
      } else {
        returnShotName = null;
        temporaryUntil = 0;
      }
    }

    function stateShot(state) {
      if (!state || typeof state !== "object") return "showcase";
      if (state.complete === true) return "result";
      if (state.active !== true) return "showcase";
      if (Number(state.activePlayerIndex) === 1) return "turnRight";
      if (Array.isArray(state.players) && state.players.length > 1) return "turnLeft";
      return "match";
    }

    function syncState(state) {
      if (temporaryUntil > Date.now()) return;
      setShot(stateShot(state));
    }

    function focusRoll(state) {
      if (disposed) return;
      const returnTo = stateShot(state);
      if (reduceMotion) {
        setShot(returnTo, { immediate: true });
        return;
      }
      setShot("roll", { temporary: true, returnTo: returnTo });
    }

    function tick(deltaMs) {
      if (disposed || !targetShot) return;

      if (temporaryUntil > 0 && Date.now() >= temporaryUntil) {
        const fallback = returnShotName || "match";
        returnShotName = null;
        temporaryUntil = 0;
        setShot(fallback);
      }

      const seconds = Math.max(0, Math.min(0.05, Number(deltaMs) / 1000 || 0));
      const ease = Math.max(0.1, Number(targetShot.ease) || 3);
      const amount = 1 - Math.exp(-ease * seconds);

      camera.alpha = lerp(camera.alpha, Number(targetShot.alpha), amount);
      camera.beta = lerp(camera.beta, Number(targetShot.beta), amount);
      camera.radius = lerp(camera.radius, Number(targetShot.radius), amount);

      const desired = Array.isArray(targetShot.target) ? targetShot.target : [0, 1, 0];
      const source = readCameraTarget();
      currentTarget.set(
        lerp(source.x, Number(desired[0]) || 0, amount),
        lerp(source.y, Number(desired[1]) || 0, amount),
        lerp(source.z, Number(desired[2]) || 0, amount)
      );
      camera.setTarget(currentTarget);
    }

    function dispose() {
      disposed = true;
      returnShotName = null;
      temporaryUntil = 0;
    }

    applyImmediate(targetShot);

    return {
      setShot: setShot,
      syncState: syncState,
      focusRoll: focusRoll,
      tick: tick,
      dispose: dispose,
      getShot: function () {
        return currentName;
      },
    };
  }

  global.GameRoomYahtzeeCameraDirector = {
    create: create,
  };
})(window);
