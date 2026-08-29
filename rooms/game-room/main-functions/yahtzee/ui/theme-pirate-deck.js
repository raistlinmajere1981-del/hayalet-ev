/* global window */

(function (global) {
  "use strict";

  global.GameRoomYahtzeePirateDeckTheme = {
    id: "pirate-deck-hybrid",
    label: "Pirate Deck Hybrid Stage",

    // Paths stay document-relative so workspace and installed room copies resolve identically.
    assets: {
      environment: "../main-functions/yahtzee/assets/hybrid/deck-stage-v3.webp",
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
        beta: 1,
        radius: 12.2,
        target: [0, 1.28, 0.16],
        ease: 2.25,
      },
      match: {
        alpha: -1.57,
        beta: 0.96,
        radius: 11.55,
        target: [0, 1.3, 0.04],
        ease: 2.45,
      },
      turnLeft: {
        alpha: -1.585,
        beta: 0.96,
        radius: 11.52,
        target: [-0.16, 1.3, 0.02],
        ease: 2.55,
      },
      turnRight: {
        alpha: -1.555,
        beta: 0.96,
        radius: 11.52,
        target: [0.16, 1.3, 0.02],
        ease: 2.55,
      },
      roll: {
        alpha: -1.57,
        beta: 0.93,
        radius: 11.24,
        target: [0, 1.35, -0.03],
        ease: 2.9,
        holdMs: 640,
      },
      result: {
        alpha: -1.57,
        beta: 1,
        radius: 12.15,
        target: [0, 1.28, 0.12],
        ease: 2.25,
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
