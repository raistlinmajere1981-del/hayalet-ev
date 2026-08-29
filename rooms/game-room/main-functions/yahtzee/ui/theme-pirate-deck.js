/* global window */

(function (global) {
  "use strict";

  global.GameRoomYahtzeePirateDeckTheme = {
    id: "pirate-deck-v2",
    label: "Pirate Deck Presentation V2",

    // Paths stay document-relative so workspace and installed room copies resolve identically.
    assets: {
      environment: "../main-functions/yahtzee/assets/hybrid/deck-stage-v3.webp",
      tableWood: "../main-functions/yahtzee/assets/hybrid/table-mahogany.webp",
      tableFelt: "../main-functions/yahtzee/assets/hybrid/table-felt-burgundy.webp",
      lightning: "../main-functions/yahtzee/assets/hybrid/lightning.webp",
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
