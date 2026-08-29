# Yahtzee Presentation Art Slots

This directory contains room-local artwork used by the pirate-deck Yahtzee presentation and retained assets from the earlier hybrid-stage pass.

## Active Presentation V2 assets

The current runtime actively consumes:

- `deck-stage-v3.webp` — integrated 16:9 cinematic environment with a continuous flat center deck aligned to the Babylon table
- `table-mahogany.webp` — tileable mahogany texture for the Babylon table body
- `table-felt-burgundy.webp` — tileable oxblood felt texture for the inset dice surface

The integrated environment is deliberately static in the active path. Continuous sky/sea/crew CSS animation was removed from the default runtime to reduce rendering cost on low-end systems.

## Retained legacy/reference assets

The following files are currently kept for rollback, later art experiments or reuse, but are not loaded by the active V2 stage:

- `sky-night.webp`
- `sea-night.webp`
- `deck-backdrop.webp`
- `lightning.webp`
- `crew-1.webp` … `crew-4.webp`
- `player-left.webp`
- `player-right.webp`

Player identity is now rendered by compact portrait frames in the direct HUD rather than full-body standees.

## Composition rules

- Keep the center deck readable for the Babylon table in `match` and `roll` shots.
- The backdrop must not contain a baked-in game table in the interactive center zone.
- Keep strong visual detail away from the left/right score-sheet zones.
- Table textures should tile cleanly and avoid baked directional lighting that fights the Babylon lights.
- The presentation remains fixed-camera and state-directed; do not design art around free-orbit navigation.

## Camera presets

Camera values live in `ui/theme-pirate-deck.js`:

- `showcase` — distant pre-game composition
- `match` — default play view
- `turnLeft` / `turnRight` — active-player emphasis
- `roll` — temporary close dice shot
- `result` — wider end-of-game composition

Tune those values against the final live desktop composition rather than re-enabling orbit controls.
