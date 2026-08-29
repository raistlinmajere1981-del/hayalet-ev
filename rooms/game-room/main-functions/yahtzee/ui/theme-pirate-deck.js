/* global window */

(function (global) {
  "use strict";

  global.GameRoomYahtzeePirateDeckTheme = {
    id: "pirate-deck-v3",
    label: "Pirate Deck Presentation V3",

    // Paths stay document-relative so workspace and installed room copies resolve identically.
    assets: {
      environment: "../main-functions/yahtzee/assets/hybrid/deck-stage-v3.webp",
      tableWood: "../main-functions/yahtzee/assets/hybrid/table-mahogany.webp",
      tableFelt: "../main-functions/yahtzee/assets/hybrid/table-felt-burgundy.webp",
      lightning: "../main-functions/yahtzee/assets/hybrid/lightning.webp",
    },

    // Art-tuning contract. Keep the host/game rules out of this object: these values only
    // describe presentation geometry, animation feel and render budget. The local art pass
    // can tune them without editing the Babylon scene implementation.
    stageConfig: {
      table: {
        position: [0, 0, 0.08],
        scale: [0.95, 1, 0.95],
        top: { size: [7.05, 0.32, 3.86], position: [0, 0.92, 0] },
        inset: { size: [5.56, 0.06, 3.14], position: [-0.37, 1.112, 0] },
        apron: { size: [6.42, 0.46, 0.18], position: [0, 0.68, -1.86] },
        trim: [
          { size: [6.84, 0.12, 0.14], position: [0, 1.17, -1.86] },
          { size: [6.84, 0.12, 0.14], position: [0, 1.17, 1.86] },
          { size: [0.14, 0.12, 3.66], position: [-3.39, 1.17, 0] },
          { size: [0.14, 0.12, 3.66], position: [3.39, 1.17, 0] },
        ],
      },
      dice: {
        size: 0.78,
        scale: 0.9,
        heldScale: 0.56,
        y: 1.47,
        pipRadius: 0.075,
        layout: [
          [-1.28, -0.7, -0.08],
          [0, -0.8, 0.05],
          [1.28, -0.68, -0.04],
          [-0.64, 0.2, 0.08],
          [0.67, 0.19, -0.07],
        ],
        roll: {
          durationMs: 560,
          durationStepMs: 32,
          bounce: 0.52,
          bounceStep: 0.018,
          lateral: 0.13,
          lateralStep: 0.012,
          depthWobble: 0.1,
        },
      },
      rack: {
        wellX: 2.91,
        wellY: 1.228,
        wellZ: [-1.18, -0.6, 0, 0.6, 1.18],
        wellRadius: 0.16,
        ringDiameter: 0.4,
        ringThickness: 0.05,
        // x, y, z, yaw offset, pitch, roll. Held dice are intentionally smaller and
        // slightly fanned so four/five held dice remain visibly separate in perspective.
        slots: [
          [2.66, 1.45, -1.18, -0.24, -0.045, 0.025],
          [2.62, 1.45, -0.6, -0.12, -0.025, 0.012],
          [2.59, 1.45, 0, 0, 0, 0],
          [2.62, 1.45, 0.6, 0.12, 0.025, -0.012],
          [2.66, 1.45, 1.18, 0.24, 0.045, -0.025],
        ],
      },
      lantern: {
        position: [2.3, 1.13, 0.86],
        scale: 0.76,
        lightIntensity: 1.58,
        lightRange: 8.2,
      },
      performance: {
        hardwareScalingFloor: 1.15,
        pixelRatioDivisor: 1.2,
        idleFps: 15,
        activeFps: 30,
        rollFps: 45,
      },
    },

    shots: {
      showcase: {
        alpha: -1.57,
        beta: 1.0,
        radius: 12.65,
        target: [0, 1.28, 0.16],
        ease: 2.4,
      },
      match: {
        alpha: -1.57,
        beta: 0.95,
        radius: 10.85,
        target: [0, 1.34, 0.02],
        ease: 2.8,
      },
      turnLeft: {
        alpha: -1.605,
        beta: 0.95,
        radius: 10.78,
        target: [-0.28, 1.34, 0.02],
        ease: 3.0,
      },
      turnRight: {
        alpha: -1.535,
        beta: 0.95,
        radius: 10.78,
        target: [0.28, 1.34, 0.02],
        ease: 3.0,
      },
      roll: {
        alpha: -1.57,
        beta: 0.88,
        radius: 9.55,
        target: [0, 1.43, -0.08],
        ease: 3.7,
        holdMs: 760,
      },
      result: {
        alpha: -1.57,
        beta: 1.0,
        radius: 12.15,
        target: [0, 1.3, 0.12],
        ease: 2.5,
      },
    },

    stage: {
      integratedEnvironment: true,
      playerFrames: true,
      heldDiceRack: true,
    },
  };
})(window);
