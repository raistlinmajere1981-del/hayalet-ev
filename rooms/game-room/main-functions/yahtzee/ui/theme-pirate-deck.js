/* global window */

(function (global) {
  "use strict";

  global.GameRoomYahtzeePirateDeckTheme = {
    id: "pirate-deck-v3",
    label: "Pirate Deck Presentation V3",

    // Paths stay document-relative so workspace and installed room copies resolve identically.
    assets: {
      environment: "../main-functions/yahtzee/assets/hybrid/deck-stage-v3.webp",
      tableWood: "../main-functions/yahtzee/assets/hybrid/table-mahogany-v2.webp",
      tableFelt: "../main-functions/yahtzee/assets/hybrid/table-felt-burgundy-v2.webp",
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
        beta: 1.01,
        radius: 12.4,
        target: [0, 1.26, 0.12],
        ease: 2.5,
      },
      match: {
        alpha: -1.57,
        beta: 0.94,
        radius: 10.7,
        target: [0, 1.36, 0],
        ease: 2.9,
      },
      turnLeft: {
        alpha: -1.6,
        beta: 0.94,
        radius: 10.66,
        target: [-0.24, 1.36, 0],
        ease: 3.1,
      },
      turnRight: {
        alpha: -1.54,
        beta: 0.94,
        radius: 10.66,
        target: [0.24, 1.36, 0],
        ease: 3.1,
      },
      roll: {
        alpha: -1.57,
        beta: 0.87,
        radius: 9.62,
        target: [0, 1.48, -0.05],
        ease: 3.8,
        holdMs: 720,
      },
      result: {
        alpha: -1.57,
        beta: 1.01,
        radius: 11.9,
        target: [0, 1.3, 0.08],
        ease: 2.6,
      },
    },

    stageConfig: {
      root: {
        position: [0, -0.08, 0.12],
      },
      table: {
        position: [0, 0, 0],
        footprintScale: 1,
        width: 6.86,
        height: 0.34,
        depth: 3.74,
        topY: 0.91,
        insetWidth: 5.28,
        insetHeight: 0.06,
        insetDepth: 3,
        insetX: -0.42,
        insetY: 1.11,
        outerTrimInset: 0.18,
        outerTrimThickness: 0.16,
        outerTrimHeight: 0.12,
        outerTrimY: 1.17,
        innerRailThickness: 0.09,
        innerRailHeight: 0.075,
        innerRailY: 1.165,
        apronWidth: 6.44,
        apronHeight: 0.48,
        apronDepth: 0.2,
        apronY: 0.66,
        apronAccentHeight: 0.055,
        rackBedWidth: 0.68,
        rackBedHeight: 0.055,
        rackBedDepth: 3.18,
        rackDividerWidth: 0.065,
        darkWoodTextureScale: [2.2, 1.2],
        woodTextureScale: [1.8, 1.12],
        feltTextureScale: [1.65, 1.65],
      },
      dice: {
        size: 0.8,
        chamfer: 0.105,
        scale: 0.9,
        heldScale: 0.65,
        baseY: 1.5,
        pipRadius: 0.082,
        pipLift: 0.006,
        pipTessellation: 12,
        layout: [
          [-1.3, -0.66, -0.08],
          [-0.02, -0.77, 0.045],
          [1.27, -0.64, -0.045],
          [-0.66, 0.24, 0.075],
          [0.68, 0.24, -0.065],
        ],
        moveEase: 0.016,
        rollDurationMs: 540,
        rollDurationStepMs: 30,
        rollLateral: 0.13,
        rollLateralStep: 0.012,
        rollLift: 0.5,
        rollLiftStep: 0.016,
        rollDepth: 0.09,
      },
      rack: {
        x: 2.69,
        y: 1.4,
        zSlots: [-1.2, -0.6, 0, 0.6, 1.2],
        yawSlots: [-0.06, -0.03, 0, 0.03, 0.06],
        wellY: 1.17,
        wellRadius: 0.23,
        ringDiameter: 0.58,
        ringThickness: 0.05,
        tessellation: 18,
      },
      lantern: {
        position: [-2.72, 1.12, 1.42],
        scale: 0.68,
        lightIntensity: 1.48,
        lightRange: 7.6,
      },
      lighting: {
        moonIntensity: 0.9,
        warmIntensity: 0.56,
        warmRange: 10.5,
      },
      performance: {
        hardwareScalingFloor: 1.15,
        pixelRatioDivisor: 1.2,
        rollingFps: 45,
        activeFps: 30,
        idleFps: 15,
      },
    },

    stage: {
      integratedEnvironment: true,
      playerFrames: true,
      heldDiceRack: true,
    },
  };
})(window);
