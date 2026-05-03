# Plan: Game Room Team Tetris

**Generated**: 2026-03-25
**Estimated Complexity**: High

## Overview

Add a second feature, `team-tetris`, to the existing `game-room` so the room can host a four-seat, turn-based team Tetris variant without breaking the current XOX flow.

The feature should use the existing room system instead of introducing a new room:

- room id stays `game-room`
- XOX remains intact and keeps working beside the new feature
- the new feature becomes a scene-accessible close-up with its own hotspot, commands, protocols, i18n, and tests

The core product shape for `v1` is:

- seats: local user, `ai1`, `ai2`, `us1`
- start is allowed only when `ai1`, `ai2`, and `us1` are all ready
- teams are randomized into two pairs at match start
- hidden-pair mode may hide teammate identities until the game ends
- each team has one real 10x20 Tetris board unless Sprint 1 locks a different size
- no animation race, gravity timer, score, garbage, or speed curve
- turns rotate in this fixed loop:
  - Team A opener
  - Team B opener
  - Team A follower
  - Team B follower
- each acting seat receives one current piece, chooses rotation, and draws a grid path
- the piece follows only that validated path and then locks
- the team that survives longest wins

## Research Notes

- Generic room-page infrastructure already supports multiple features per room via `defaultFeatureId`, feature chips, active-feature context, scene hotspots, and close-up views.
- `game-room` is not feature-aware yet. Its host and UI are hardcoded to `xox`, so the first implementation seam is room-local refactoring, not a platform rewrite.
- The current XOX stack already proves these reusable seams:
  - room-local commands scoped across `room-ui`, `ai-slots`, and `us1`
  - room-local protocol registration
  - host-owned game state with UI serialization
  - US1 transport envelopes carrying `roomEvent` and `roomCommand` metadata
  - stale/duplicate guardrails using `turnIndex` and board hashes
- `laboratory` proves the recommended architecture for a multi-feature room:
  - active feature comes from host context
  - host logic can branch by feature id without changing room-page infrastructure
  - UI can render one runtime while switching feature-specific copy and behavior

## Assumptions

- Feature id will be `team-tetris`.
- `game-room` stays the room id; no new room package is created.
- `xox` remains the default feature until Team Tetris is stable.
- `v1` uses a synchronous live-session model for `us1`; it reuses room command transport metadata but does not reuse XOX's invite/accept/reject flow.
- Hidden-pair mode hides seat identities in the UI, but every seat still knows which team board it acts on.
- Team assignment, opener/follower role inside each team, and which team starts first are all derived from one deterministic match seed.
- `v1` treats "standard Tetris rules" as:
  - 10x20 board
  - 7-bag piece generation
  - SRS-style rotation and wall kicks
  - line clears
  - top-out loss
- `v1` does not include:
  - score
  - garbage attacks
  - lock timer
  - speed progression
  - hold queue
  - next queue / preview queue
- The path contract is intentionally narrow in `v1`:
  - motion can only advance downward
  - each downward advance may optionally shift left by one, stay centered, or shift right by one
  - no upward motion and no multi-cell lateral sweep in one step
- Switching away from an active Team Tetris feature is allowed, but the Team Tetris match does not persist in the background; the host resets Team Tetris match state on feature switch.
- If dedicated scene art is not ready, the feature may temporarily reuse existing `game-room` close-up art with a new hotspot and view id until final assets land.

## Scope Lock

- In scope for `v1`:
  - second `game-room` feature with its own hotspot and close-up
  - four-seat deterministic turn loop
  - team randomization and hidden-pair reveal mode
  - two real team boards
  - per-seat private turn packet
  - mouse-drawn grid path input for the local player
  - `++cmd` path submission for `ai1` and `ai2`
  - room-command submission path for `us1`
  - no-score, last-team-standing win condition
- Out of scope for `v1`:
  - asynchronous invite-based multiplayer
  - animated falling pieces
  - live spectators outside the four active seats
  - ladder/ranking
  - replay export UI
  - generic engine extraction outside `game-room` unless Sprint 2 proves it is necessary

## Success Criteria

- `game-room` can switch between `xox` and `team-tetris` without breaking either feature.
- A Team Tetris match cannot start until `ai1`, `ai2`, and `us1` are ready.
- Teams are assigned deterministically from a seeded match setup and can be hidden until game over.
- The acting seat receives only the information it is supposed to see.
- The acting seat gets richer private context for its own team board, while the opposing team board is rendered only as the latest public snapshot.
- AI and US1 commands are validated against canonical turn state before mutating the match.
- The host can block or end the match safely when a slot disconnects or a malformed move arrives.
- Existing XOX room tests stay green.

## Recommended Product Decisions

Lock these early to reduce rework:

1. **Feature strategy**
   - Add Team Tetris as a second feature inside `game-room`.
   - Refactor `game-room` host/UI into feature-aware shells before adding Tetris logic.
   - Allow feature switching, but auto-reset an active Team Tetris match when the user leaves the feature.

2. **Move payload shape**
   - Do not send raw mouse pixels.
   - Canonical move payload should be structured JSON and grid-based:
     - `matchId`
     - `turnIndex`
     - `turnToken`
     - `pieceId`
     - `rotation`
     - `rowShifts`
   - `rowShifts` should be the authoritative path contract:
     - one entry per downward advance
     - each entry is `-1`, `0`, or `1`
   - Remove raw `seatId` trust from AI and US1 submissions; the host derives the acting seat from provider plus current turn and may keep `seatId` only as a debug echo if needed.
   - Freeze these details before engine work starts:
     - row order
     - coordinate origin
     - cell encoding
     - piece and rotation enums
     - exact `turnToken` inputs
     - schema versioning

3. **AI payload strategy**
   - Use structured JSON as the primary machine contract and include a short ASCII appendix only for debugging and prompt readability.
   - Recommended private turn packet:
     - `schemaVersion`
     - `matchId`
     - `turnIndex`
     - `turnToken`
     - `teamBoardPrivateRows`
     - `opponentBoardPublicRows`
     - `partnerLastPiece`
     - `teamBoardBeforePartnerPiece`
     - `currentPiece`
     - `legalRotations`
     - `actingRole`
   - The own-team packet is intentionally richer than the opposing-team packet.
   - The opposing team board should expose only the latest public board snapshot.

4. **Hidden-pair model**
   - Hidden mode should hide teammate seat identity, not board ownership.
   - Each seat must still know which board it acts on.
   - AI payloads should use `teamId` and `boardIndex`, not teammate nicknames, unless reveal mode is off.

5. **AI protocol strategy**
   - Freeze the scenario matrix before host wiring:
     - opening seat
     - follow-up seat
     - blocked / no-op
     - hidden-pair wording
     - revealed wording
   - Protocol docs should be generated from that frozen matrix, not invented ad hoc during host implementation.

6. **US1 transport**
   - Reuse room-command envelopes and stale-message guards.
   - Do not reuse XOX invite state for `v1`; the match is live-only and blocks if `us1` disappears.

7. **Tie handling**
   - If both teams top out in the same turn cycle, return a draw instead of inventing a score-based tiebreaker.

## Proposed Runtime Layout

- Existing room package roots remain the source of truth:
  - `rooms/game-room/manifest.json`
  - `rooms/game-room/host/index.js`
  - `rooms/game-room/ui/index.js`
  - `rooms/game-room/ui/style.css`
  - `rooms/game-room/i18n/en.json`
  - `rooms/game-room/i18n/tr.json`
- Recommended new room-local modules:
  - `rooms/game-room/host/features/xox.js`
  - `rooms/game-room/host/features/team-tetris.js`
  - `rooms/game-room/host/team-tetris-engine.js`
  - `rooms/game-room/host/team-tetris-visibility.js`
  - `rooms/game-room/ui/features/xox.js`
  - `rooms/game-room/ui/features/team-tetris.js`
  - `rooms/game-room/ui/team-tetris-board.js`
  - `rooms/game-room/ui/team-tetris-path-drawer.js`
- Recommended new protocol docs:
  - `rooms/game-room/protocols/game-room-team-tetris-ai-opening.md`
  - `rooms/game-room/protocols/game-room-team-tetris-ai-followup.md`
  - `rooms/game-room/protocols/game-room-team-tetris-us1-transport.md`
- Recommended new room asset placeholders:
  - `rooms/game-room/assets/team-tetris-view.webp`
  - optional `rooms/game-room/assets/team-tetris-panel.webp`

## Sprint 1: Feature Contract And Room Refactor

**Goal**: Make `game-room` safely multi-feature before adding any Team Tetris-specific state or UI.

**Demo/Validation**:

- `game-room` manifest exposes both `xox` and `team-tetris`
- room-page can switch between both feature chips
- existing XOX runtime still boots through the refactored shell

### Task 1.1: Lock the Team Tetris feature contract and asset placeholders

- **Location**: `rooms/game-room/manifest.json`, `rooms/game-room/protocols/`, `rooms/game-room/assets/`
- **Description**: Add `team-tetris` metadata, scene hotspot/view ids, command specs, and protocol specs. Reserve final asset paths even if Sprint 1 uses temporary artwork.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - `manifest.json` validates with two features
  - command names are globally unique
  - protocol keys are globally unique
  - the feature has a deterministic hotspot and close-up view id
- **Validation**:
  - `node --import tsx --test scripts/tests/room-manifest-regressions.test.ts`
  - `node --import tsx --test scripts/tests/room-page-regressions.test.ts`

### Task 1.2: Refactor the room host into a feature-aware dispatcher

- **Location**: `rooms/game-room/host/index.js`, new host-local helpers under `rooms/game-room/host/`
- **Description**: Remove hardcoded XOX boot assumptions from the top-level host and route by active feature id, following the `laboratory` pattern. Keep XOX behavior unchanged.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - host context reads active feature safely
  - XOX commands still resolve correctly
  - Team Tetris can register its own commands without tangling XOX state
- **Validation**:
  - `node --import tsx --test scripts/tests/game-room-xox-host-regressions.test.ts`
  - `node --import tsx --test scripts/tests/room-command-registry-regressions.test.ts`

### Task 1.3: Refactor the room UI into a feature-aware shell

- **Location**: `rooms/game-room/ui/index.js`, `rooms/game-room/ui/index.html`, `rooms/game-room/ui/style.css`
- **Description**: Replace the runtime-wide `FEATURE_ID = "xox"` assumption with active-feature-aware rendering and isolate feature-specific panels into room-local modules.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - the runtime can render XOX and a Team Tetris bootstrap state
  - the active feature name comes from room context, not a constant
  - scene-view and classic mode still work
- **Validation**:
  - `node --import tsx --test scripts/tests/game-room-xox-room-regressions.test.ts`
  - `node --import tsx --test scripts/tests/i18n-remediation-regressions.test.ts`

### Task 1.4: Add baseline regressions for the second feature

- **Location**: new `scripts/tests/game-room-team-tetris-room-regressions.test.ts`, existing `scripts/tests/room-page-regressions.test.ts`, `scripts/tests/scene-debug-room-regressions.test.ts`
- **Description**: Add focused tests that prove the room package now contains a second feature with scene metadata, runtime files, and deterministic feature switching.
- **Complexity**: 5
- **Dependencies**: Task 1.1, Task 1.2, Task 1.3
- **Acceptance Criteria**:
  - the new test suite fails before the feature exists and passes after the contract lands
  - room-page and scene-debug do not regress when a second game is added
- **Validation**:
  - `node --import tsx --test scripts/tests/game-room-team-tetris-room-regressions.test.ts`
  - `node --import tsx --test scripts/tests/room-page-regressions.test.ts scripts/tests/scene-debug-room-regressions.test.ts`

### Task 1.5: Freeze the canonical Team Tetris contracts before engine work

- **Location**: `game-room-team-tetris-plan.md`, new contract notes under `.rovo/` if needed, future Team Tetris host/UI/protocol modules
- **Description**: Lock the canonical move schema, AI turn packet schema, coordinate system, row order, piece enum, rotation enum, `turnToken` definition, hidden-mode anonymous labels, and schema versioning before the engine or protocol implementations diverge. Also lock that `legalRotations` is advisory UI/prompt help only and never replaces host-side rotation validation.
- **Complexity**: 6
- **Dependencies**: Task 1.2, Task 1.3
- **Acceptance Criteria**:
  - one exact move contract exists for local UI, AI, and US1
  - `rowShifts` is the authoritative path encoding
  - `turnToken` is the authoritative stale-move guard
  - AI and US1 payloads do not rely on trusted `seatId`
- **Validation**:
  - add contract fixture coverage to `scripts/tests/game-room-team-tetris-engine-regressions.test.ts`

### Task 1.6: Lock feature-switch and state-isolation behavior

- **Location**: `rooms/game-room/host/index.js`, `rooms/game-room/ui/index.js`, future Team Tetris state helpers
- **Description**: Define how `xox` and `team-tetris` state are namespaced, what happens when the user switches features mid-match, and which feature-private state is cleared vs preserved. For `v1`, switching away from Team Tetris should reset only Team Tetris match state and leave XOX intact.
- **Complexity**: 5
- **Dependencies**: Task 1.2, Task 1.3
- **Acceptance Criteria**:
  - feature-local host state keys are explicit
  - feature-local UI state keys are explicit
  - switching away from Team Tetris resets its active match deterministically
  - switching back does not resurrect stale Team Tetris state
- **Validation**:
  - extend `scripts/tests/game-room-team-tetris-room-regressions.test.ts`
  - add a focused cross-feature switching case

### Task 1.7: Freeze the AI scenario matrix and protocol fixture plan

- **Location**: `rooms/game-room/protocols/`, `rooms/game-room/manifest.json`, future protocol fixture tests under `scripts/tests/`
- **Description**: Define the scenario matrix that maps runtime state to protocol scenario key before host orchestration begins:
  - opening seat
  - follow-up seat
  - blocked / no-op
  - hidden-pair copy
  - reveal-mode copy
- **Complexity**: 5
- **Dependencies**: Task 1.5
- **Acceptance Criteria**:
  - every protocol scenario has a deterministic selection rule
  - protocol docs and catcher tests share the same scenario matrix
  - hidden-pair mode does not leak teammate identity through protocol text
- **Validation**:
  - add protocol fixture coverage to Team Tetris host/protocol regression suites

## Sprint 2: Deterministic Team Tetris Engine

**Goal**: Build the pure game engine and visibility model before wiring AI or UI transport.

**Demo/Validation**:

- a seeded match can generate teams, turn order, and pieces deterministically
- legal and illegal moves can be replayed from canonical move payloads
- visibility packets differ per seat without leaking teammate identity in hidden mode

### Task 2.1: Define the canonical match schema

- **Location**: new `rooms/game-room/host/team-tetris-engine.js`, new `rooms/game-room/host/team-tetris-visibility.js`
- **Description**: Model seats, teams, board size, bag seed, turn order, team boards, top-out status, private turn packet, reveal state, and win resolution.
- **Complexity**: 7
- **Dependencies**: Task 1.5, Task 1.6
- **Acceptance Criteria**:
  - one host-owned state shape exists for the entire feature
  - team assignment and piece generation are deterministic from a seed
  - the state distinguishes public, team-private, and seat-private data
- **Validation**:
  - new `scripts/tests/game-room-team-tetris-engine-regressions.test.ts`

### Task 2.2: Implement piece rotation, collision, line clear, and top-out rules

- **Location**: new `rooms/game-room/host/team-tetris-engine.js`
- **Description**: Implement the pure ruleset for piece spawn, SRS rotation, wall kicks, collision, line clearing, and top-out without any UI dependencies.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - every piece type can rotate and collide deterministically
  - line clear behavior is covered
  - top-out state ends that team cleanly
- **Validation**:
  - new `scripts/tests/game-room-team-tetris-engine-regressions.test.ts`

### Task 2.3: Canonicalize path replay and move validation

- **Location**: new `rooms/game-room/host/team-tetris-engine.js`
- **Description**: Define how `rotation` and `rowShifts` replay into a final lock position. Reject ambiguous, impossible, out-of-bounds, or stale paths before mutating state.
- **Complexity**: 9
- **Dependencies**: Task 2.1, Task 2.2
- **Acceptance Criteria**:
  - the host can replay every accepted move exactly
  - malformed or impossible paths fail safely
  - a `turnToken` guard exists for stale submissions
- **Validation**:
  - new `scripts/tests/game-room-team-tetris-engine-regressions.test.ts`
  - add stale/duplicate move cases from day one

### Task 2.4: Implement visibility and lagged-board snapshots

- **Location**: new `rooms/game-room/host/team-tetris-visibility.js`, `rooms/game-room/host/features/team-tetris.js`
- **Description**: Build seat-private payloads that expose:
  - the acting seat's richer own-team board context
  - the opposing team's latest public board snapshot
  - the teammate's last placed piece
  - the board before that teammate piece
  - the current piece to place
- **Complexity**: 9
- **Dependencies**: Task 1.7, Task 2.1, Task 2.3
- **Acceptance Criteria**:
  - private payloads expose exactly the intended information
  - hidden-pair mode removes teammate seat identity from UI- and AI-facing packets
  - no seat receives another seat's unrevealed current piece
- **Validation**:
  - new `scripts/tests/game-room-team-tetris-visibility-regressions.test.ts`

## Sprint 3: Match Host, AI Protocols, And US1 Transport

**Goal**: Wire the deterministic engine into room commands, AI prompts, and US1 move delivery.

**Demo/Validation**:

- a live match can start only when all required seats are ready
- AI1, AI2, and US1 can all submit valid moves through room contracts
- invalid or stale moves block or reject cleanly without corrupting state

### Task 3.1: Implement Team Tetris host orchestration

- **Location**: new `rooms/game-room/host/features/team-tetris.js`, `rooms/game-room/host/index.js`
- **Description**: Register start/reset/local-user move/AI move/US1 move commands, load and save feature state, advance turns, and resolve match end states.
- **Complexity**: 8
- **Dependencies**: Task 1.6, Task 2.1, Task 2.3, Task 2.4
- **Acceptance Criteria**:
  - start is rejected unless `ai1`, `ai2`, and `us1` are ready
  - turn order is deterministic
  - match end blocks extra moves
  - disconnections transition the match into a defined blocked state
- **Validation**:
  - new `scripts/tests/game-room-team-tetris-host-regressions.test.ts`

### Task 3.2: Define role-specific AI protocols

- **Location**: `rooms/game-room/protocols/game-room-team-tetris-ai-opening.md`, `rooms/game-room/protocols/game-room-team-tetris-ai-followup.md`, `rooms/game-room/manifest.json`
- **Description**: Materialize room-local protocol docs from the frozen scenario matrix for:
  - an opening seat with no teammate move yet
  - a follow-up seat that must infer teammate placement
  - blocked / no-op behavior
  - exact `++cmd` syntax
  - latest-assistant-message parsing rule
- **Complexity**: 6
- **Dependencies**: Task 1.7, Task 2.4
- **Acceptance Criteria**:
  - the protocol names map cleanly to actual turn phases
  - AI instructions are deterministic and machine-catchable
  - hidden-pair mode text does not leak teammate identity
- **Validation**:
  - `node --import tsx --test scripts/tests/room-protocol-registry-regressions.test.ts`
  - extend room-specific host tests to assert correct scenario selection

### Task 3.3: Add Team Tetris AI command contracts

- **Location**: `rooms/game-room/manifest.json`, new `rooms/game-room/host/features/team-tetris.js`, existing catcher-related suites under `scripts/tests/`
- **Description**: Register exact commands such as:
  - `GameRoomTeamTetrisStart`
  - `GameRoomTeamTetrisReset`
  - `GameRoomTeamTetrisUserMove`
  - `GameRoomTeamTetrisAiMove`
  - `GameRoomTeamTetrisRemoteMove`
- **Complexity**: 6
- **Dependencies**: Task 3.1, Task 3.2
- **Acceptance Criteria**:
  - AI slot submissions only apply when provider and turn match
  - the host derives acting seat from provider plus current turn instead of trusting client `seatId`
  - malformed command bodies fail safely
  - command naming cannot collide with XOX
- **Validation**:
  - `node --import tsx --test scripts/tests/room-command-registry-regressions.test.ts`
  - extend `scripts/tests/catch-manager-regressions.test.ts`

### Task 3.4: Reuse US1 room-command transport without invite state

- **Location**: new Team Tetris host logic, `electron/us1-conversation-service.ts`, `scripts/tests/us1-conversation-service-regressions.test.ts`
- **Description**: Reuse room-event and room-command envelope metadata for Team Tetris turns, but keep the lifecycle synchronous and live-session-only.
- **Complexity**: 8
- **Dependencies**: Task 3.1, Task 3.3
- **Acceptance Criteria**:
  - US1 move envelopes include match id, turn index, `turnToken`, and canonical move args
  - duplicate or stale remote moves are ignored
  - remote disconnect blocks the match instead of silently continuing
- **Validation**:
  - extend `scripts/tests/us1-conversation-service-regressions.test.ts`
  - extend Team Tetris host regressions with remote stale/duplicate cases

## Sprint 4: Team Tetris UI And Input Model

**Goal**: Build a playable room UI for the local user while preserving private/public visibility rules.

**Demo/Validation**:

- the Team Tetris feature renders two boards, current-turn controls, and hidden-pair status
- the local user can rotate a piece, draw a valid path, and submit it
- the UI shows the intended lagged and private information without leaking hidden data

### Task 4.1: Build the Team Tetris room surface

- **Location**: `rooms/game-room/ui/index.html`, `rooms/game-room/ui/style.css`, new `rooms/game-room/ui/features/team-tetris.js`
- **Description**: Add the feature shell with:
  - two team boards
  - turn banner
  - seat roster
  - hidden-pair status
  - teammate reveal panel for post-game
  - reset/start controls
- **Complexity**: 7
- **Dependencies**: Task 1.3, Task 3.1
- **Acceptance Criteria**:
  - the feature looks intentional in classic and scene mode
  - the room still fits the existing `game-room` close-up shell
  - no XOX markup leaks into Team Tetris mode
- **Validation**:
  - extend `scripts/tests/game-room-team-tetris-room-regressions.test.ts`

### Task 4.2: Implement local path drawing and piece preview

- **Location**: new `rooms/game-room/ui/team-tetris-board.js`, new `rooms/game-room/ui/team-tetris-path-drawer.js`, `rooms/game-room/ui/features/team-tetris.js`
- **Description**: Let the local user rotate the current piece, draw a board-snapped downward path, preview the resulting lock position, and submit the canonical move payload as `rowShifts`.
- **Complexity**: 9
- **Dependencies**: Task 2.3, Task 4.1
- **Acceptance Criteria**:
  - path drawing is grid-snapped and deterministic
  - each downward step allows only `-1`, `0`, or `1` horizontal shift
  - invalid paths are blocked before submit
  - submit payload matches the host replay contract exactly
- **Validation**:
  - new `scripts/tests/game-room-team-tetris-ui-path-regressions.test.ts`

### Task 4.3: Render public and private board states correctly

- **Location**: `rooms/game-room/ui/features/team-tetris.js`
- **Description**: Render:
  - richer private own-team board context for the current user
  - the opposing team's latest public board snapshot
  - teammate's last piece
  - board-before-teammate-piece
  - current piece preview
- **Complexity**: 8
- **Dependencies**: Task 2.4, Task 4.1
- **Acceptance Criteria**:
  - the UI never shows forbidden future information
  - hidden-pair mode hides teammate identity labels until the end
  - post-game reveal shows randomized pairs when enabled
- **Validation**:
  - new `scripts/tests/game-room-team-tetris-visibility-regressions.test.ts`

### Task 4.4: Add room-local i18n and copy parity

- **Location**: `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Add Team Tetris strings for setup, turn phases, hidden-pair mode, validation errors, disconnect states, win/draw copy, and post-game reveal text.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - EN/TR catalogs stay structurally aligned
  - Team Tetris copy is room-local and feature-scoped
  - no visible hardcoded copy remains in the runtime
- **Validation**:
  - `node --import tsx --test scripts/tests/i18n-remediation-regressions.test.ts`

## Sprint 5: Resilience, Scene Finish, And Install Parity

**Goal**: Close the feature with resilience, packaging parity, and a reproducible smoke checklist.

**Demo/Validation**:

- disconnects and malformed moves fail safely
- scene hotspot and close-up work with final or placeholder art
- room install/export parity stays intact

### Task 5.1: Harden disconnect, malformed-move, and blocked-match flows

- **Location**: Team Tetris host/UI modules, `scripts/tests/game-room-team-tetris-host-regressions.test.ts`
- **Description**: Cover AI slot mismatch, US1 disconnect, stale `turnToken`, duplicate move, impossible path, top-out on both teams, and hidden-pair reveal timing.
- **Complexity**: 7
- **Dependencies**: Task 3.1, Task 3.4, Task 4.3
- **Acceptance Criteria**:
  - every failure path has an explicit result state
  - the room never corrupts match state after a rejected move
  - draw and simultaneous elimination rules are deterministic
- **Validation**:
  - extend `scripts/tests/game-room-team-tetris-host-regressions.test.ts`

### Task 5.2: Finish scene integration and asset parity

- **Location**: `rooms/game-room/manifest.json`, `rooms/game-room/assets/`, `scripts/tests/scene-debug-room-regressions.test.ts`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Finalize the Team Tetris hotspot/view art and ensure install/export flows preserve all new room files.
- **Complexity**: 5
- **Dependencies**: Task 1.1, Task 4.1
- **Acceptance Criteria**:
  - feature hotspot and close-up are stable in scene mode
  - install/export keeps the new assets and protocol files
  - no room bundle parity regression appears
- **Validation**:
  - `node --import tsx --test scripts/tests/room-bundle-import-regressions.test.ts`
  - `node --import tsx --test scripts/tests/scene-debug-room-regressions.test.ts`

### Task 5.3: Add a smoke matrix and final validation batch

- **Location**: new `.rovo/game-room-team-tetris-smoke.md`, targeted suites under `scripts/tests/`
- **Description**: Create a concise smoke matrix for:
  - all seats ready vs not ready
  - visible vs hidden pairs
  - opening seat vs follow-up seat
  - local user, AI, and US1 move submission
  - disconnect and malformed command paths
- **Complexity**: 4
- **Dependencies**: Task 5.1, Task 5.2
- **Acceptance Criteria**:
  - one operator can run a short repeatable smoke pass
  - targeted automated suites are listed beside manual checks
- **Validation**:
  - `npm run typecheck`
  - `node --import tsx --test scripts/tests/game-room-team-tetris-*.test.ts`
  - targeted regression batch covering room, protocol, i18n, and US1 transport

## Testing Strategy

- Keep existing XOX suites green throughout:
  - `node --import tsx --test scripts/tests/game-room-xox-host-regressions.test.ts`
  - `node --import tsx --test scripts/tests/game-room-xox-room-regressions.test.ts`
- Add new focused suites early instead of relying on one giant end-state test:
  - `scripts/tests/game-room-team-tetris-room-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-engine-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-visibility-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-host-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-ui-path-regressions.test.ts`
  - protocol fixture cases for scenario selection and hidden-pair redaction
  - catcher negative cases for prose, multiple `++cmd` lines, and pretty-printed JSON
  - cross-feature switching cases with an active Team Tetris match
- Re-run shared guardrails whenever contract files change:
  - `node --import tsx --test scripts/tests/room-manifest-regressions.test.ts`
  - `node --import tsx --test scripts/tests/room-command-registry-regressions.test.ts`
  - `node --import tsx --test scripts/tests/room-protocol-registry-regressions.test.ts`
  - `node --import tsx --test scripts/tests/room-page-regressions.test.ts`
  - `node --import tsx --test scripts/tests/i18n-remediation-regressions.test.ts`
  - `node --import tsx --test scripts/tests/us1-conversation-service-regressions.test.ts`
- Run `npm run typecheck` before calling the feature done.

## Potential Risks & Gotchas

- The current `game-room` runtime is XOX-first. If Sprint 1 skips the feature-router refactor, every later task becomes harder to test and rollback.
- Hidden-pair mode can leak teammate identity through payload keys, debug text, host logs, or UI labels even if the main board looks correct.
- Mouse path drawing becomes ambiguous immediately if `rowShifts`, row order, and coordinate origin are not frozen before engine and UI work branch apart.
- "Standard Tetris rules" is broader than the current product shape. Sprint 1 must explicitly lock exact wall-kick behavior and keep `hold` and `next queue` out of scope.
- The deduction mechanic depends on precise visibility rules. If the host and UI disagree about richer own-team context vs opposing public snapshot, the feature will feel unfair.
- US1 transport latency can cause stale turns. `turnToken`-based replay guards are mandatory from the first remote prototype.
- Feature switching can corrupt room state unless Team Tetris reset-on-switch behavior is implemented before the feature is playable.
- Two-team elimination may produce edge-case draws. Draw rules should be written before implementation, not inferred afterward.
- If final art is delayed, the feature can still land with placeholder scene assets, but asset paths must be final so install/export parity does not churn later.

## Rollback Plan

- Keep `xox` as the default feature until Team Tetris passes its own host, room, and visibility suites.
- Land the work in slices:
  - feature contract
  - host router
  - pure engine
  - transport
  - UI
  - scene/polish
- If Team Tetris destabilizes the room:
  - disable `team-tetris` in `rooms/game-room/manifest.json`
  - leave the refactored host/UI shell in place if XOX remains green
  - remove only Team Tetris command specs, protocols, assets, and tests
- If install/export parity breaks:
  - revert the new feature files from the room package
  - reinstall the workspace room
  - re-run the room bundle/import suites before reopening the feature branch
