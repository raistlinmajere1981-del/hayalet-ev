# Game Room — Yahtzee

This document describes the built-in Yahtzee feature under `rooms/game-room/main-functions/yahtzee/`.

## Purpose

Yahtzee is the Game Room's first atmospheric 3D table game. The gameplay contract stays deterministic and host-owned while the browser runtime presents a pirate-ship deck scene using a room-local Babylon.js build.

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

The Babylon scene never decides gameplay outcomes. It only renders the host state and animates transitions between known states.

## Score card

The feature implements the standard 13 categories used by the current engine:

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

## Browser presentation

The main visual files are:

- `ui/runtime.js` — DOM controls, score cards, state rendering and interaction
- `ui/bridge.js` — Game Room runtime integration
- `ui/babylon-scene.js` — Babylon scene lifecycle and 3D state rendering
- `styles.css` and `multiplayer.css` — overlay/fallback presentation

The current 3D scene includes:

- wooden ship deck and table,
- night sky, moon, ocean and fog,
- mast, sail and rigging,
- four low-poly spectator pirates,
- lantern/light flicker,
- five 3D dice with host-state pips and held-state highlighting,
- lightweight ship sway and dice-roll animation.

A CSS fallback remains available if the Babylon runtime cannot be mounted.

## Babylon runtime

The feature self-hosts a trimmed Babylon.js browser runtime under:

`rooms/game-room/main-functions/yahtzee/vendor/`

`@babylonjs/core` is a development dependency. The room-local browser bundle is produced by:

```bash
npm run rooms:vendor:game-room
```

The same vendor build is run before room bundle/workspace builds.

The generated runtime contains only the Babylon APIs imported by `vendor/babylon-runtime-entry.js`; the room does not depend on a CDN at runtime.

The Babylon Apache-2.0 license and notice are kept next to the generated vendor file.

## Performance contract

The scene is intentionally lightweight:

- low-poly/procedural geometry,
- no physics engine,
- no real-time shadow pipeline,
- limited light count,
- hardware scaling on high-DPI displays,
- rendering skips hidden documents,
- `prefers-reduced-motion` disables ship/dice motion where appropriate.

This keeps the feature usable on the same class of machines as the rest of Hayalet Ev while leaving room for later asset upgrades.

## Validation

Useful checks include:

```bash
npm run format:check
npm run check-types
npm run rooms:test:core
```

Feature-focused coverage lives in the Game Room installed-host/UI smoke tests and the Yahtzee room regression test.
