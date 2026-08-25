/* global window, document */

(function (global) {
  "use strict";

  function createAudioRuntime() {
    let enabled = true;
    let context = null;
    let master = null;
    let ambience = null;
    let creakTimer = null;
    let visibilityBound = false;
    const interactionTimers = new Set();

    function clearTimer(timer) {
      if (timer === null || timer === undefined) return;
      global.clearTimeout(timer);
      interactionTimers.delete(timer);
    }

    function safeStop(node) {
      if (!node || typeof node.stop !== "function") return;
      try {
        node.stop();
      } catch (_error) {
        /* already stopped */
      }
    }

    function ensureContext() {
      if (!enabled) return null;
      if (context) return context;
      const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
      if (typeof AudioContextCtor !== "function") return null;

      context = new AudioContextCtor();
      master = context.createGain();
      master.gain.value = document.hidden ? 0.08 : 0.62;
      master.connect(context.destination);

      if (!visibilityBound) {
        document.addEventListener("visibilitychange", handleVisibilityChange);
        visibilityBound = true;
      }
      return context;
    }

    function resumeContext(ctx) {
      if (!ctx || ctx.state !== "suspended" || typeof ctx.resume !== "function") return;
      void ctx.resume().catch(function () {
        /* A later user gesture can resume the context. */
      });
    }

    function handleVisibilityChange() {
      if (!context || !master) return;
      const target = document.hidden ? 0.08 : 0.62;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(target, context.currentTime, 0.18);
    }

    function createNoiseBuffer(ctx, seconds) {
      const duration = Math.max(1, Number(seconds) || 2);
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      let previous = 0;
      for (let index = 0; index < length; index += 1) {
        const white = Math.random() * 2 - 1;
        previous = previous * 0.86 + white * 0.14;
        channel[index] = previous;
      }
      return buffer;
    }

    function createNoiseLayer(ctx, options) {
      const source = ctx.createBufferSource();
      source.buffer = createNoiseBuffer(ctx, 2.4);
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = options.filterType;
      filter.frequency.value = options.frequency;
      filter.Q.value = options.q || 0.5;

      const gain = ctx.createGain();
      gain.gain.value = options.gain;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.value = options.lfoFrequency;
      lfoGain.gain.value = options.lfoDepth;

      source.connect(filter).connect(gain).connect(master);
      lfo.connect(lfoGain).connect(gain.gain);
      source.start();
      lfo.start();
      return { source: source, lfo: lfo };
    }

    function playCreak() {
      const ctx = ensureContext();
      if (!ctx || !master || !ambience || !enabled) return;
      resumeContext(ctx);

      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(78 + Math.random() * 24, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        38 + Math.random() * 12,
        ctx.currentTime + 0.62
      );
      filter.type = "lowpass";
      filter.frequency.value = 320;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.012, ctx.currentTime + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.72);
      oscillator.connect(filter).connect(gain).connect(master);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.74);
    }

    function scheduleCreak() {
      if (!ambience || !enabled) return;
      if (creakTimer !== null) global.clearTimeout(creakTimer);
      creakTimer = global.setTimeout(
        function () {
          creakTimer = null;
          playCreak();
          scheduleCreak();
        },
        4200 + Math.random() * 5200
      );
    }

    function startAmbience() {
      if (!enabled || ambience) return;
      const ctx = ensureContext();
      if (!ctx || !master) return;
      resumeContext(ctx);

      const ocean = createNoiseLayer(ctx, {
        filterType: "lowpass",
        frequency: 430,
        q: 0.42,
        gain: 0.026,
        lfoFrequency: 0.085,
        lfoDepth: 0.009,
      });
      const wind = createNoiseLayer(ctx, {
        filterType: "bandpass",
        frequency: 880,
        q: 0.62,
        gain: 0.012,
        lfoFrequency: 0.052,
        lfoDepth: 0.005,
      });
      const hull = ctx.createOscillator();
      const hullGain = ctx.createGain();
      hull.type = "sine";
      hull.frequency.value = 43;
      hullGain.gain.value = 0.0032;
      hull.connect(hullGain).connect(master);
      hull.start();

      ambience = {
        ocean: ocean,
        wind: wind,
        hull: hull,
      };
      scheduleCreak();
    }

    function stopAmbience() {
      if (creakTimer !== null) {
        global.clearTimeout(creakTimer);
        creakTimer = null;
      }
      if (!ambience) return;
      safeStop(ambience.ocean.source);
      safeStop(ambience.ocean.lfo);
      safeStop(ambience.wind.source);
      safeStop(ambience.wind.lfo);
      safeStop(ambience.hull);
      ambience = null;
    }

    function playWoodClick(frequency, level) {
      const ctx = ensureContext();
      if (!ctx || !master) return;
      resumeContext(ctx);
      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = Number(frequency) || 150;
      filter.type = "lowpass";
      filter.frequency.value = 780;
      gain.gain.setValueAtTime(typeof level === "number" ? level : 0.065, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.095);
      oscillator.connect(filter).connect(gain).connect(master);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
    }

    function playDice() {
      if (!enabled) return;
      const ctx = ensureContext();
      if (!ctx) return;
      resumeContext(ctx);
      for (let index = 0; index < 5; index += 1) {
        const timer = global.setTimeout(
          function () {
            interactionTimers.delete(timer);
            playWoodClick(112 + Math.random() * 88, 0.045 + Math.random() * 0.018);
          },
          index * 31 + Math.floor(Math.random() * 16)
        );
        interactionTimers.add(timer);
      }
    }

    function setEnabled(nextEnabled) {
      enabled = nextEnabled !== false;
      if (!enabled) {
        stopAmbience();
        for (const timer of Array.from(interactionTimers)) clearTimer(timer);
      }
    }

    function dispose() {
      stopAmbience();
      for (const timer of Array.from(interactionTimers)) clearTimer(timer);
      if (visibilityBound) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        visibilityBound = false;
      }
      if (context && typeof context.close === "function") {
        void context.close().catch(function () {
          /* best effort */
        });
      }
      context = null;
      master = null;
    }

    return {
      setEnabled: setEnabled,
      startAmbience: startAmbience,
      stopAmbience: stopAmbience,
      playWoodClick: playWoodClick,
      playDice: playDice,
      dispose: dispose,
    };
  }

  global.GameRoomYahtzeeAudioRuntime = {
    create: createAudioRuntime,
  };
})(window);
