/* global window */

(function (global) {
  "use strict";

  global.GameRoomYahtzeePirateDeckTheme = {
    id: "pirate-deck-hybrid",
    label: "Pirate Deck Hybrid Stage",

    // Paths stay document-relative so workspace and installed room copies resolve identically.
    assets: {
      environment: "../main-functions/yahtzee/assets/hybrid/deck-stage-v2.webp",
      tableWood: "../main-functions/yahtzee/assets/hybrid/table-mahogany.webp",
      tableFelt: "../main-functions/yahtzee/assets/hybrid/table-felt-burgundy.webp",
      sky: "../main-functions/yahtzee/assets/hybrid/sky-night.webp",
      sea: "../main-functions/yahtzee/assets/hybrid/sea-night.webp",
      deckBackdrop: "../main-functions/yahtzee/assets/hybrid/deck-backdrop.webp",
      lightning: "../main-functions/yahtzee/assets/hybrid/lightning.webp",
      crew: [
        "../main-functions/yahtzee/assets/hybrid/crew-1.webp",
        "../main-functions/yahtzee/assets/hybrid/crew-2.webp",
        "../main-functions/yahtzee/assets/hybrid/crew-3.webp",
        "../main-functions/yahtzee/assets/hybrid/crew-4.webp",
      ],
      playerLeft: "../main-functions/yahtzee/assets/hybrid/player-left.webp",
      playerRight: "../main-functions/yahtzee/assets/hybrid/player-right.webp",
    },

    shots: {
      showcase: {
        alpha: -1.57,
        beta: 1.02,
        radius: 12.7,
        target: [0, 1.3, 0.2],
        ease: 2.7,
      },
      match: {
        alpha: -1.57,
        beta: 0.86,
        radius: 10.65,
        target: [0, 1.34, -0.12],
        ease: 3.4,
      },
      turnLeft: {
        alpha: -1.63,
        beta: 0.88,
        radius: 10.4,
        target: [-0.38, 1.34, -0.18],
        ease: 3.8,
      },
      turnRight: {
        alpha: -1.51,
        beta: 0.88,
        radius: 10.4,
        target: [0.38, 1.34, -0.18],
        ease: 3.8,
      },
      roll: {
        alpha: -1.57,
        beta: 0.76,
        radius: 8.95,
        target: [0, 1.58, -0.38],
        ease: 5.2,
        holdMs: 760,
      },
      result: {
        alpha: -1.57,
        beta: 0.98,
        radius: 11.9,
        target: [0, 1.28, 0],
        ease: 2.8,
      },
    },

    stage: {
      crewCount: 4,
      lightningEnabled: true,
      seaEnabled: true,
      playerStandeesEnabled: true,
    },
  };
})(window);
