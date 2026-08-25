# Yahtzee Hybrid Stage Art Slots

This directory is reserved for the cinematic 2.5D art pass used by the pirate-deck Yahtzee stage.

The runtime does not require these files to exist. Until art is supplied it uses CSS silhouettes/gradients, so Codex or a local art pass can replace one slot at a time without changing gameplay code.

Recommended room-local files:

- `sky-night.webp` — 1920x1080 or wider, moon/storm sky with a clean horizon zone
- `sea-night.webp` — 1920x700, dark ocean strip suitable for slow horizontal/vertical drift
- `deck-backdrop.webp` — 1920x1080, ship/deck framing that sits behind the real 3D table
- `lightning.webp` — transparent flash/bolt overlay, optional
- `crew-1.webp` … `crew-4.webp` — transparent paper/standee crew characters
- `player-left.webp` / `player-right.webp` — optional body/standee bases for the two player positions

Wire completed assets in `ui/theme-pirate-deck.js` by replacing the corresponding `null` values.

## Composition rules

The stage is intentionally not a free-roam 3D environment.

- Background/weather/crew are 2D or 2.5D art layers.
- The table, dice, lantern and immediate play surface remain Babylon 3D.
- Camera motion is automatic and state-driven.
- Keep the center of the frame readable for the 3D table in the `match` and `roll` shots.
- Keep player/crew art away from the score-card UI zone on the far right.
- Prefer transparent PNG/WebP for standees so they can receive CSS lighting/glow without a rectangular backdrop.

## Camera presets

Camera values are in `ui/theme-pirate-deck.js`:

- `showcase` — distant pre-game composition
- `match` — default play view
- `turnLeft` / `turnRight` — subtle active-player emphasis
- `roll` — temporary dice focus
- `result` — wider end-of-game composition

Tune those values after final art is in place rather than re-enabling orbit controls.
