# Game Room — Yahtzee

This document describes the built-in Yahtzee feature under `rooms/game-room/main-functions/yahtzee/`.

## Purpose

Yahtzee is the Game Room's first cinematic table game. Gameplay stays deterministic and host-owned while the browser runtime presents a pirate-ship setting through a hybrid stage: a Babylon 3D play surface layered over art-driven 2D/2.5D scenery.

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

The presentation layer never decides gameplay outcomes. It only renders the host state and animates transitions between known states.

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

This first ruleset does not add extra Yahtzee bonus/joker rules.

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

## Hybrid cinematic stage

The Yahtzee presentation deliberately avoids a free-roam 3D world.

The stage is split into three layers:

1. **Art backdrop** — an integrated cinematic deck environment with layered weather and crew standees.
2. **Babylon gameplay layer** — the textured mahogany/felt play surface, lantern and five interactive dice.
3. **UI layer** — game controls, dice/hold controls and score cards.

The main files are:

- `ui/theme-pirate-deck.js` — theme and camera preset contract
- `ui/camera-director.js` — automatic state-driven camera transitions
- `ui/hybrid-stage.js` — 2D/2.5D backdrop, weather, crew and player standees
- `ui/stage-template-bridge.js` — connects full Yahtzee state to the stage without changing host rules
- `ui/babylon-scene.js` — transparent Babylon gameplay layer
- `ui/audio-runtime.js` — procedural ambient/interaction audio
- `styles.css`, `multiplayer.css`, `hybrid-stage.css` — overlay and stage presentation

A CSS fallback remains available if Babylon cannot mount.

## Camera contract

The camera is not user-controlled. Orbit, wheel zoom and drag navigation are intentionally disabled.

`ui/theme-pirate-deck.js` defines these shots:

- `showcase` — distant pre-game view
- `match` — normal play composition
- `turnLeft` / `turnRight` — subtle active-player emphasis
- `roll` — temporary dice focus
- `result` — wider end-of-game view

The director interpolates automatically between these presets from game state. Local and remote rolls can briefly request the `roll` shot before returning to the correct match shot.

Do not re-enable free orbit controls during the art pass; tune the presets instead.

## Art slots

Final art is intentionally separated from gameplay code. The current pass uses an integrated realistic deck backdrop while retaining the separate sky, sea and deck slots as fallbacks.

Room-local image slots are documented under:

`rooms/game-room/main-functions/yahtzee/assets/hybrid/README.md`

The intended art pass can provide:

- a realistic/stylized storm sky,
- a separate ocean layer,
- a deck/background framing image,
- an integrated 16:9 deck environment with an empty center dais,
- tileable mahogany and oxblood felt table materials,
- optional lightning overlay,
- four transparent paper/standee crew characters,
- optional left/right player standee bases.

Completed files are wired by replacing `null` values in `ui/theme-pirate-deck.js`.

Player standees are avatar-ready pirate body templates with an open head area. The UI presentation bridge maps the active Game Room account avatars into `avatarSrc` by seat (`user`, `ai1`, `ai2`, `us1`); local second-player mode keeps the compact initial-based fallback because it has no separate account identity.

## Babylon runtime

The feature self-hosts a trimmed Babylon.js browser runtime under:

`rooms/game-room/main-functions/yahtzee/vendor/`

`@babylonjs/core` is a development dependency. The room-local browser bundle is produced by:

```bash
npm run rooms:vendor:game-room
```

The same vendor build is run before room bundle/workspace builds.

The generated runtime contains only the Babylon APIs imported by `vendor/babylon-runtime-entry.js`, including the ray-picking extension required by the interactive dice; the room does not depend on a CDN at runtime.

The Babylon Apache-2.0 license and notice are kept next to the generated vendor file.

## Performance contract

The hybrid stage is intentionally lightweight:

- background and crew art are 2D/2.5D rather than full 3D geometry,
- only the immediate play surface stays Babylon 3D,
- no physics engine,
- no real-time shadow pipeline,
- limited light count,
- hardware scaling on high-DPI displays,
- hidden documents skip rendering,
- `prefers-reduced-motion` disables nonessential movement.

This keeps the feature usable on the same class of machines as the rest of Hayalet Ev while making the visual result easier to art-direct from a fixed composition.

## Local art/tuning handoff

The next local Codex/art pass should concentrate on presentation rather than architecture:

- generate/choose the final sky, sea and deck images,
- create transparent crew/player standees,
- wire those asset paths into `theme-pirate-deck.js`,
- tune the six camera presets after the final images are visible,
- adjust Babylon table scale/position to match the art,
- tune lightning, wave, crew and sound levels.

The hybrid-stage contract should stay intact while doing that work.

## Validation

Useful checks include:

```bash
npm run format:check
npm run check-types
npm run rooms:test:core
```

Feature-focused coverage lives in the Game Room installed-host/UI smoke tests and the Yahtzee room regression test.
