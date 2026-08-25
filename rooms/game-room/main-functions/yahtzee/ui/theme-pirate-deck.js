/* global window */

(function (global) {
  "use strict";

  global.GameRoomYahtzeePirateDeckTheme = {
    id: "pirate-deck-hybrid",
    label: "Pirate Deck Hybrid Stage",

    // Paths stay document-relative so workspace and installed room copies resolve identically.
    assets: {
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
        beta: 1.08,
        radius: 14.8,
        target: [0, 1.05, 0.2],
        ease: 2.7,
      },
      match: {
        alpha: -1.57,
        beta: 0.84,
        radius: 11.4,
        target: [0, 1.05, -0.15],
        ease: 3.4,
      },
      turnLeft: {
        alpha: -1.63,
        beta: 0.86,
        radius: 11.15,
        target: [-0.38, 1.02, -0.2],
        ease: 3.8,
      },
      turnRight: {
        alpha: -1.51,
        beta: 0.86,
        radius: 11.15,
        target: [0.38, 1.02, -0.2],
        ease: 3.8,
      },
      roll: {
        alpha: -1.57,
        beta: 0.74,
        radius: 9.65,
        target: [0, 1.45, -0.42],
        ease: 5.2,
        holdMs: 760,
      },
      result: {
        alpha: -1.57,
        beta: 0.98,
        radius: 13.2,
        target: [0, 1.02, 0],
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
