# Yahtzee Presentation Art Slots

This directory contains room-local artwork used by the pirate-deck Yahtzee presentation and a small set of retained reference assets from the earlier hybrid-stage pass.

## Active Presentation V3 assets

The current runtime actively consumes:

- `deck-stage-v3.webp` — integrated 16:9 cinematic environment with a continuous flat center deck aligned to the Babylon table
- `table-mahogany-v2.webp` — lower-red, fine-grain mahogany texture for the Babylon table body
- `table-felt-burgundy-v2.webp` — low-contrast oxblood baize texture for the inset dice surface

The integrated environment is deliberately static in the active path. Continuous sky/sea/crew CSS animation is no longer part of the shipped presentation, keeping the default render path inexpensive on low-end systems.

## Art-tuning contract

`ui/theme-pirate-deck.js` now owns the presentation numbers that a local art pass is expected to tune.

The `stageConfig` object groups:

- table position, scale, top/inset/apron/trim sizes,
- dice size, normal scale, held scale and five play positions,
- roll timing and motion amplitudes,
- five held-rack slots and brass-well geometry,
- lantern position/scale/light values,
- idle, active and rolling render budgets.

The Babylon implementation reads this contract at runtime. Prefer changing `stageConfig` during visual tuning instead of scattering new numeric constants through `babylon-scene.js`.

The five held-rack slots use six values each:

`[x, y, z, yawOffset, pitch, roll]`

Held dice are intentionally smaller than play dice and slightly fanned. This keeps four or five simultaneously held dice visually separate in perspective.

## Retained reference assets

The following files are not loaded by the active V3 presentation, but remain available for later art experiments or reuse:

- `sky-night.webp`
- `sea-night.webp`
- `deck-backdrop.webp`
- `lightning.webp`
- `crew-1.webp` … `crew-4.webp`
- `player-left.webp`
- `player-right.webp`
- `table-mahogany.webp`
- `table-felt-burgundy.webp`

Player identity is rendered by compact portrait frames in the direct HUD rather than full-body standees.

## Composition rules

- Keep the center deck readable for the Babylon table in `match` and `roll` shots.
- The backdrop must not contain a baked-in game table in the interactive center zone.
- Keep strong visual detail away from the left/right score-sheet zones.
- Table textures should tile cleanly and avoid baked directional lighting that fights the Babylon lights.
- Dice art should remain readable at both normal scale and the smaller held-rack scale.
- The presentation remains fixed-camera and state-directed; do not design art around free-orbit navigation.

## Local Codex/art handoff

The preferred next pass is visual rather than architectural:

1. Replace/refine table and dice geometry while preserving the existing host/UI contracts.
2. Generate the final wood, felt, brass and die-surface assets directly for the chosen theme.
3. Tune table/dice/rack values through `stageConfig` while looking at the live 1920×1080 composition.
4. Tune camera presets only after the final table silhouette is stable.
5. Keep the current render-budget values unless live profiling shows a clear reason to raise them.

## Camera presets

Camera values live in `ui/theme-pirate-deck.js`:

- `showcase` — distant pre-game composition
- `match` — default play view
- `turnLeft` / `turnRight` — active-player emphasis
- `roll` — temporary close dice shot
- `result` — wider end-of-game composition

Tune those values against the final live desktop composition rather than re-enabling orbit controls.
