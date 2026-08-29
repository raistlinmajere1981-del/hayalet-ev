# Game Room — Yahtzee

This document describes the built-in Yahtzee feature under `rooms/game-room/main-functions/yahtzee/`.

## Purpose

Yahtzee is the Game Room's cinematic table game. Gameplay stays deterministic and host-owned while the browser runtime presents a pirate-ship setting with a lightweight integrated art backdrop and a focused Babylon 3D play surface.

The current feature supports:

- solo play,
- two local players on the same computer,
- local user vs AI1,
- local user vs AI2,
- local user vs connected US1.

## Host authority

The Game Room host owns all gameplay state and validation.

The host controls:

- dice generation,
- reroll limits,
- held dice state,
- active player/seat,
- score cards,
- category scoring,
- match completion and winner resolution,
- AI legal action lists,
- US1 revision ordering.

The presentation layer never decides gameplay outcomes. It only renders host state, previews deterministic score values for the user and animates transitions between known states.

## Score card

The feature implements the current 13 categories:

- ones
- twos
- threes
- fours
- fives
- sixes
- three-kind
- four-kind
- full-house
- small-straight
- large-straight
- yahtzee
- chance

The upper-section bonus is `35` points when the upper subtotal reaches `63`.

This ruleset does not currently add extra Yahtzee bonus/joker rules.

## Turn model

Each turn begins with five dice and allows at most three rolls.

After a roll, the locally controlled player may:

- toggle held dice before the final roll,
- reroll all non-held dice while rolls remain,
- score the current dice in one unused category.

Scoring ends the current player's turn and advances to the next seat. A two-player match ends when both score cards are complete.

## AI1 / AI2 contract

AI opponents do not return dice results. They receive host-generated state and a finite list of `legalActionId` values.

Two action forms are used:

- `reroll:10101` — five-bit hold mask (`1` keep, `0` reroll)
- `score:<category>` — commit the current dice to one unused category

The required command is:

```text
++cmd:SlotBridge({"action":"room.command","payload":{"commandName":"GameRoomYahtzeeAiAction","legalActionId":"<LEGAL_ACTION_ID>","turnToken":"<TURN_TOKEN>","turnIndex":<TURN_INDEX>}})
```

The host validates provider, active seat, token, turn index and exact legal-action membership before applying the action.

See `rooms/game-room/main-functions/yahtzee/protocols/game-room-yahtzee-ai-turn.md`.

## US1 transport

US1 currently uses direct connected-room synchronization rather than a separate invite/accept screen.

The transport surface is:

- `GameRoomYahtzeeRemoteStart`
- `GameRoomYahtzeeRemoteSync`
- `GameRoomYahtzeeRemoteReset`

Live matches use a `matchId` plus monotonically increasing `revision`. Older or duplicate snapshots are rejected. The synchronized snapshot mirrors the two score cards, active seat, turn token/index, dice, held flags, roll count and result state.

See `rooms/game-room/main-functions/yahtzee/protocols/game-room-yahtzee-us1-transport.md`.

## Presentation V3

The active presentation is direct and intentionally narrow:

1. **Integrated art backdrop** — one room-local cinematic deck image supplies the ship, sea and night environment.
2. **Babylon play surface** — table, lantern and five interactive dice remain true 3D.
3. **Direct HUD** — pre-game setup, player portrait frames, score sheets, status and roll controls are created once and updated in place.

The earlier hybrid promotion path has now been removed from the source tree. `hybrid-stage.js`, `stage-template-bridge.js`, `multiplayer.css`, `hybrid-stage.css` and `diegetic-stage.css` are no longer shipped.

### Player identity

Full-body player standees are no longer part of the active stage. Each player is represented by a compact portrait frame attached to the score sheet.

For `user`, `ai1`, `ai2` and `us1`, the Game Room context bridge supplies the configured account avatar when available. Local second-player mode keeps an initials fallback.

This makes identity presentation cheaper to render and much easier to keep visually consistent across different account images.

### Score previews

Unused score rows become directly selectable after a roll. The UI previews the deterministic score the current dice would produce for each unused category.

The preview is presentation-only. The host still validates and applies the actual score.

### Held dice rack

The five brass wells on the right side of the 3D table are functional. Clicking a die after a roll sends the normal host-owned hold command; when the host state marks that die as held, the 3D die moves into its corresponding rack slot.

Presentation V3 gives held dice their own scale, position and orientation targets. Held dice are smaller than play dice and are slightly fanned across the rack, which prevents four or five held dice from visually merging into one long block in perspective.

Clicking a held die before the final roll returns it to the play surface through the same host command path.

## Art-tuning contract

`ui/theme-pirate-deck.js` owns the numbers expected to change during local art direction.

The `stageConfig` object contains:

- table position, scale and component geometry,
- dice size, normal scale, held scale and five play positions,
- roll timing and motion amplitudes,
- five held-rack slots and brass-well geometry,
- lantern placement and light values,
- idle, active and rolling render budgets.

`ui/babylon-scene.js` reads this object with safe defaults. The goal is to keep the Babylon implementation stable while the local Codex/art pass changes proportions, materials and composition through one compact contract.

The five held-rack slot entries use:

```text
[x, y, z, yawOffset, pitch, roll]
```

This is a presentation-only contract. It does not alter host-owned held state or any gameplay rule.

## Camera contract

The camera is not user-controlled. Orbit, wheel zoom and drag navigation remain disabled.

`ui/theme-pirate-deck.js` defines these shots:

- `showcase` — distant pre-game composition
- `match` — closer normal play composition
- `turnLeft` / `turnRight` — controlled active-player emphasis
- `roll` — a clearly closer temporary dice shot
- `result` — wider end-of-game composition

The roll shot returns automatically to the correct match/turn shot.

## Performance contract

Presentation V3 remains intentionally biased toward low-end systems.

The active path:

- creates the Yahtzee HUD once instead of rebuilding and re-parenting a second DOM presentation on every state update,
- has no active 2.5D crew/player animation layer,
- avoids `backdrop-filter` in the Yahtzee UI,
- uses a single integrated environment image behind the Babylon canvas,
- keeps only the immediate play surface in 3D,
- avoids unnecessary table decoration meshes,
- disables Babylon's continuous mesh-under-pointer update,
- uses a configurable hardware scaling floor,
- targets about 15 fps while idle/result, 30 fps during normal play and 45 fps only while dice are visibly rolling,
- skips rendering while the document is hidden,
- respects `prefers-reduced-motion` for nonessential motion.

The render-budget values now live under `stageConfig.performance`, so profiling changes can be made without editing the scene runtime.

No physics engine or real-time shadow pipeline is used.

## Main presentation files

- `ui/runtime.js` — persistent direct HUD, score previews, stage actions and Babylon/audio coordination
- `ui/theme-pirate-deck.js` — art slots, stage tuning contract and camera presets
- `ui/camera-director.js` — automatic state-driven camera transitions
- `ui/babylon-scene.js` — transparent 3D table, configurable held-dice rack and render throttling
- `ui/audio-runtime.js` — procedural ambient/interaction audio
- `styles.css` — active Yahtzee presentation styles

A non-Babylon fallback keeps the integrated deck artwork and the normal HUD visible if the 3D runtime cannot mount.

## Art slots

Room-local image slots remain under:

`rooms/game-room/main-functions/yahtzee/assets/hybrid/`

The active runtime consumes:

- `deck-stage-v3.webp` — integrated 16:9 deck environment
- `table-mahogany.webp` — table wood texture
- `table-felt-burgundy.webp` — inset felt texture

Other retained image assets are reference/experimental material and are not loaded by the active presentation.

See `rooms/game-room/main-functions/yahtzee/assets/hybrid/README.md` for the local art handoff contract.

## Babylon runtime

The feature self-hosts a trimmed Babylon.js browser runtime under:

`rooms/game-room/main-functions/yahtzee/vendor/`

`@babylonjs/core` is a development dependency. The room-local browser bundle is produced by:

```bash
npm run rooms:vendor:game-room
```

The generated runtime contains only the Babylon APIs imported by `vendor/babylon-runtime-entry.js`, including the ray-picking extension required by interactive dice; the room does not depend on a CDN at runtime.

The Babylon Apache-2.0 license and notice are kept next to the generated vendor file.

## Next local Codex/art pass

The architecture-heavy cleanup is complete enough that the next pass should concentrate on visible game assets and live tuning:

- redesign the table silhouette and proportions for the pirate-deck theme,
- redesign the dice with better edges/material response while preserving the five-die interaction contract,
- generate/replace the final wood, felt, brass and die-surface art,
- tune table/dice/rack values through `stageConfig`,
- tune camera preset numbers only after the final table silhouette is stable,
- tune dice trajectory feel and timing against the live window,
- optionally replace procedural interaction sounds with room-local recorded samples,
- finish typography/spacing corrections at the actual desktop resolution.

The host engine, scoring logic, AI legal-action contract and US1 transport should remain outside that art pass unless a real gameplay defect is found.

## Validation

Useful checks include:

```bash
npm run format:check
npm run check-types
npm run rooms:test:core
```

Feature-focused coverage lives in the Game Room installed-host/UI smoke tests, the Yahtzee room regression test and the presentation regression test.
