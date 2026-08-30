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

## Presentation V2

The second presentation pass removes the old "render a classic DOM game, then promote it into a cinematic stage" path.

The active presentation is now direct:

1. **Integrated art backdrop** — one room-local cinematic deck image supplies the ship, sea and night environment.
2. **Babylon play surface** — table, lantern and five interactive dice remain true 3D.
3. **Direct HUD** — pre-game setup, player portrait frames, score sheets, status and roll controls are created once and updated in place.

The old `hybrid-stage.js`, `stage-template-bridge.js`, `multiplayer.css`, `hybrid-stage.css` and `diegetic-stage.css` files are no longer loaded by `ui/index.html`. They are temporarily retained in the source tree as rollback/reference material until the V2 pass has completed local live testing.

### Player identity

Full-body player standees are no longer part of the active stage. Each player is represented by a compact portrait frame attached to the score sheet.

For `user`, `ai1`, `ai2` and `us1`, the Game Room context bridge supplies the configured account avatar when available. Local second-player mode keeps an initials fallback.

This makes identity presentation cheaper to render and much easier to keep visually consistent across different account images.

### Score previews

Unused score rows become directly selectable after a roll. The UI previews the deterministic score the current dice would produce for each unused category.

The preview is presentation-only. The host still validates and applies the actual score.

### Held dice rack

The five brass wells on the right side of the 3D table are now functional. Clicking a die after a roll sends the normal host-owned hold command; when the host state marks that die as held, the 3D die moves into its corresponding rack position.

Clicking a held die before the final roll returns it to the play surface through the same host command path.

## Camera contract

The camera is not user-controlled. Orbit, wheel zoom and drag navigation remain disabled.

`ui/theme-pirate-deck.js` defines these shots:

- `showcase` — distant pre-game composition
- `match` — closer normal play composition
- `turnLeft` / `turnRight` — controlled active-player emphasis
- `roll` — a clearly closer temporary dice shot
- `result` — wider end-of-game composition

The roll shot is intentionally more visible than in the first cinematic pass; it still returns automatically to the correct match/turn shot.

## Performance contract

Presentation V2 is intentionally biased toward low-end systems.

The active path now:

- creates the Yahtzee HUD once instead of rebuilding and re-parenting the old DOM on every state update,
- removes the active 2.5D crew/player layer and its continuous CSS animations,
- avoids `backdrop-filter` in the Yahtzee UI,
- uses a single integrated environment image behind the Babylon canvas,
- keeps only the immediate play surface in 3D,
- removes unnecessary table decoration meshes,
- disables Babylon's continuous mesh-under-pointer update,
- increases hardware scaling slightly to reduce fill cost,
- caps Babylon rendering at about 15 fps while idle/result, 30 fps during normal play and 45 fps only while dice are visibly rolling,
- skips rendering while the document is hidden,
- respects `prefers-reduced-motion` for nonessential motion.

No physics engine or real-time shadow pipeline is used.

## Main presentation files

- `ui/runtime.js` — persistent direct HUD, score previews, stage actions and Babylon/audio coordination
- `ui/theme-pirate-deck.js` — art slots and camera presets
- `ui/camera-director.js` — automatic state-driven camera transitions
- `ui/babylon-scene.js` — transparent 3D table, held-dice rack and render throttling
- `ui/audio-runtime.js` — procedural ambient/interaction audio
- `styles.css` — active Yahtzee presentation styles

A non-Babylon fallback keeps the integrated deck artwork and the normal HUD visible if the 3D runtime cannot mount.

## Art slots

Room-local image slots remain under:

`rooms/game-room/main-functions/yahtzee/assets/hybrid/`

The current runtime actively consumes:

- `deck-stage-v3.webp` — integrated 16:9 deck environment
- `table-mahogany-v2.webp` — table wood texture
- `table-felt-burgundy-v2.webp` — inset felt texture

Other retained art files are currently legacy/reference assets and are not loaded by the active presentation.

## Babylon runtime

The feature self-hosts a trimmed Babylon.js browser runtime under:

`rooms/game-room/main-functions/yahtzee/vendor/`

`@babylonjs/core` is a development dependency. The room-local browser bundle is produced by:

```bash
npm run rooms:vendor:game-room
```

The generated runtime contains only the Babylon APIs imported by `vendor/babylon-runtime-entry.js`, including the ray-picking extension required by interactive dice; the room does not depend on a CDN at runtime.

The Babylon Apache-2.0 license and notice are kept next to the generated vendor file.

## Next local art/tuning pass

The architecture-heavy work should stay in the repository. A local Codex/art pass is a better use of interactive tuning time for:

- final table proportions against the real window size,
- final camera preset numbers after live inspection,
- dice trajectory feel and timing,
- optional replacement of procedural interaction sounds with room-local recorded samples,
- final typography/spacing corrections at the user's actual desktop resolution,
- eventual removal of the parked legacy hybrid presentation files after rollback is no longer useful.

## Validation

Useful checks include:

```bash
npm run format:check
npm run check-types
npm run rooms:test:core
```

Feature-focused coverage lives in the Game Room installed-host/UI smoke tests, the Yahtzee room regression test and the presentation regression test.
