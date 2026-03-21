# Plan: Game Room XOX Refresh

**Generated**: 2026-03-21
**Estimated Complexity**: High

## Overview

Repurpose the existing `game-room` package into a clean single-game XOX room, keep the current room contract as the foundation, and add only the smallest platform extensions needed to support a strong room-authoring flow.

Current research says a full room-platform rewrite is **not** required before implementation:

- Installed room manifests already support multi-feature rooms, commands, protocols, i18n, scene assets, packaging, and scene registration.
- Room hosts can already send protocols and direct messages to `ai1` and `ai2`.
- Room commands already flow into `ServerCommands`, so AI-originated `++cmd:` messages can trigger room handlers.
- Installed rooms already appear in classic navigation and `scene:debug` room options when `scene` metadata exists.

The main gaps are feature-specific, not architectural:

- The current `rooms/game-room` content is demo-only and must be cleaned.
- The room UI needs a real management topbar and 3x3 XOX board.
- The XOX host loop, turn rules, and AI prompt flow do not exist yet.
- The UI-to-host contract and selected-slot disconnect behavior still need to be defined explicitly for XOX.
- The current command catcher expects `++cmd:Name(...)` syntax and only scans the latest assistant reply.
- Room hosts can already send protocols and follow-up messages; add a reusable composition helper only if XOX proves the current API too repetitive.

## Assumptions

- First release scope is **user vs one selected AI opponent**. The user can choose either `AI1` or `AI2` as the opponent, but this plan does not add AI-vs-AI autoplay inside the room.
- The room id stays `game-room`, while the content becomes XOX-first.
- XOX AI commands will use exact parenthesized syntax such as `++cmd:GameRoomXoxAiMove(...)` to stay compatible with the current catcher unless Sprint 1 proves a parser seam must be widened.
- The AI protocol will explicitly require the move command to appear in the final/latest assistant message, ideally without extra competing commands.
- The provided assets at `rooms/games_main_bg.webp` and `rooms/games_xox.webp` will be copied into the room package so the room remains installable and bundle-safe.
- No new protocol-composition helper will be added unless XOX implementation proves the existing `sendProtocol` + `sendMessage` path is not sufficient.
- Turn state will live inside the room host first. A generic turn-based engine should only be extracted if repeated patterns appear during implementation.

## Prerequisites

- Keep the existing room packaging/install path as the source of truth:
  `rooms/game-room` -> package -> install -> auto-register.
- Treat room-scoped i18n as `rooms.<roomId>.*`.
- Keep command names and protocol keys globally unique across all rooms.
- Use existing room and scene regression suites as guardrails before and after each sprint.

## Sprint 1: Fit Audit And Contract Cleanup

**Goal**: Confirm the current room system can host XOX cleanly, remove demo-only contract noise, and add only thin platform seams if a concrete blocker appears.

**Demo/Validation**:

- `game-room` manifest contains only XOX-facing contract items.
- Required assets and protocol metadata live inside the room package.
- Existing room/package/protocol regressions stay green.

### Task 1.1: Lock the room-fit decision before any generic rewrite

- **Location**: `rooms/game-room/manifest.json`, `src/js/modules/rooms/room-host-runtime.ts`, `src/js/modules/rooms/room-command-registry.ts`, `src/js/modules/protocol-handler.ts`
- **Description**: Validate that the current room contract already covers: single selected AI opponent, room UI -> host move dispatch, AI slot -> room command dispatch, room protocol registration, classic room listing, and scene room registration. Only promote platform work if a specific XOX requirement cannot fit without duplication or brittle hacks.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - There is a clear implementation decision: "use existing room contract" or "add one thin seam first."
  - No generic room rewrite is started without a concrete, named blocker.
- **Validation**:
  - Review against `scripts/tests/room-manifest-regressions.test.ts`
  - Review against `scripts/tests/room-command-registry-regressions.test.ts`
  - Review against `scripts/tests/room-protocol-registry-regressions.test.ts`

### Task 1.2: Stage packaged assets correctly before manifest and install smoke

- **Location**: `rooms/games_main_bg.webp`, `rooms/games_xox.webp`, `rooms/game-room/assets/`
- **Description**: Move or copy the provided root-level assets into the room package and remove any packaging-invalid references that escape the room root before manifest, bundle, and install validation begins.
- **Complexity**: 2
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The room can be packaged without depending on files outside `rooms/game-room/`.
  - The installed room record points to real packaged asset files.
- **Validation**:
  - `node --test scripts/tests/room-package-manager-bootstrap-regressions.test.ts`
  - Manual package/import smoke if needed

### Task 1.3: Replace demo manifest content with XOX-first room metadata

- **Location**: `rooms/game-room/manifest.json`, `rooms/game-room/assets/`, `rooms/game-room/protocols/`
- **Description**: Remove chess/checkers/backgammon contract noise. Define a single `xox` main function, update `defaultFeatureId`, register XOX command specs and protocol specs, and switch the scene configuration to the staged XOX assets.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The room exposes exactly one main function: `xox`.
  - Scene asset paths are room-local relative paths.
  - Protocol specs and command specs are uniquely named and clearly scoped.
- **Validation**:
  - `node --test scripts/tests/room-manifest-regressions.test.ts`
  - `node --test scripts/tests/room-bundle-import-regressions.test.ts`

### Task 1.4: Add only the missing shared seam if XOX needs one

- **Location**: `src/js/modules/rooms/room-host-runtime.ts`, `src/js/modules/rooms/room-protocol-registry.ts`, `src/js/pages/room-page.ts`
- **Description**: If the audit shows XOX cannot cleanly deliver "protocol + dynamic board state", the required room topbar behavior, or the intended `scene:debug` scope through existing APIs, add one thin reusable seam instead of baking the workaround into `game-room`. Lock the scene/debug decision here: confirm whether XOX ships with current active-feature close-up editing only, or also needs editable room background and panel art support.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Any platform change is generic, opt-in, and small.
  - Existing installed rooms still render and register correctly.
  - The XOX `scene:debug` scope is explicitly decided before Sprint 3 starts.
- **Validation**:
  - `node --test scripts/tests/room-page-regressions.test.ts`
  - `node --test scripts/tests/room-ui-regressions.test.ts`

## Sprint 2: XOX Host State And AI Command Loop

**Goal**: Build the full game loop in the room host so the selected AI can play valid XOX turns against the user.

**Demo/Validation**:

- A started game has deterministic state.
- User-start and AI-start flows both work.
- AI slot responses are applied only through registered XOX commands.

### Task 2.1: Define the canonical XOX room state and payload contract

- **Location**: `rooms/game-room/host/index.js` and any new host-local helpers under `rooms/game-room/host/`
- **Description**: Model board cells, mark ownership, selected opponent slot, starter, active turn, game status, winner/draw state, last dispatch token, and room-to-UI serialization shape. Define an explicit runtime message matrix with exact names:
  `roomAPI.sendCommand("GameRoomXoxStart", ...)`,
  `roomAPI.sendCommand("GameRoomXoxReset", ...)`,
  `roomAPI.sendCommand("GameRoomXoxUserMove", ...)`,
  AI reply command `++cmd:GameRoomXoxAiMove(...)`,
  host -> UI messages such as `xox-state`, `xox-error`, and `xox-opponent-status`,
  plus any minimal `room-event` messages like `xox-ui-ready` if needed.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The room has one canonical source of truth for game state.
  - The UI -> host and host -> UI message names are explicitly documented before coding branches multiply.
  - Invalid moves, occupied cells, wrong-turn actions, and post-game actions are explicitly handled.
  - Selected opponent disconnects mid-game transition the room into a defined blocked or recoverable state, and the UI receives an explicit update.
- **Validation**:
  - New targeted state tests under `scripts/tests/`

### Task 2.2: Implement host orchestration for game start, move apply, and turn transitions

- **Location**: `rooms/game-room/host/index.js`
- **Description**: Register room-side commands for start/reset/user move and AI-slot commands for AI move submission. Apply moves, switch turns, detect win/draw, and stop outbound AI messaging when the game is complete.
- **Complexity**: 7
- **Dependencies**: Task 2.1, Task 1.4 if a shared seam is added
- **Acceptance Criteria**:
  - Starting a game initializes all state from the selected settings.
  - User moves are validated before state mutates.
  - AI moves only apply when they come from the selected opponent slot and it is truly the AI turn.
  - Game-over state prevents extra moves until reset/restart.
- **Validation**:
  - New `scripts/tests/game-room-xox-host-regressions.test.ts`

### Task 2.3: Add room-scoped XOX protocol definitions for AI start and response behavior

- **Location**: `rooms/game-room/protocols/*.md`, `rooms/game-room/manifest.json`
- **Description**: Add room protocol docs that explain: this is XOX, which slot is the opponent, which mark the AI owns, exact `++cmd` syntax, legal move expectations, how board snapshots are formatted, and how the game should proceed after each move.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - At least the required start scenarios are represented by room protocol specs.
  - Protocol text clearly instructs the AI to return a machine-catchable XOX command.
  - Protocol text explicitly says the valid XOX command must appear in the final/latest assistant message.
  - The protocol body is reusable for both AI-start and user-start flows.
- **Validation**:
  - `node --test scripts/tests/room-protocol-registry-regressions.test.ts`
  - Manual prompt review for clarity and determinism

### Task 2.4: Send protocol and board snapshots at the correct turn boundaries

- **Location**: `rooms/game-room/host/index.js`
- **Description**: When the selected AI should act, send the room protocol and the latest board snapshot in the correct order. For user-start flows, wait until the user completes the first move. For AI-start flows, send immediately with the empty board snapshot. After every valid user move, send the updated board text plus turn summary.
- **Complexity**: 6
- **Dependencies**: Task 2.2, Task 2.3
- **Acceptance Criteria**:
  - User-start flow does not message the AI before the user move.
  - AI-start flow sends on game start with the empty board.
  - Each outbound AI prompt includes a deterministic board rendering and explicit "whose turn is it" text.
- **Validation**:
  - Host-level regression tests for start order and follow-up dispatches

### Task 2.5: Register catcher-facing XOX AI commands and harden syntax rules

- **Location**: `rooms/game-room/manifest.json`, `rooms/game-room/host/index.js`, optionally `src/js/modules/catch-manager.ts`
- **Description**: Register globally unique room commands such as the AI move command. If the existing `++cmd:Name(...)` parser is sufficient, keep it and document the exact required syntax in the protocol. If it is not sufficient, widen the parser only enough to support the approved XOX format.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The selected AI can emit a valid XOX move command that lands in the room host.
  - Tests cover malformed syntax, prose-wrapped syntax, multiple commands in one reply, and the "latest assistant message only" catcher rule.
  - Wrong syntax fails safely and logs clearly.
  - Command collisions with other rooms are impossible by naming convention.
- **Validation**:
  - Extend `scripts/tests/room-command-registry-regressions.test.ts`
  - Extend `scripts/tests/catch-manager-regressions.test.ts`
  - Add a focused catcher regression if the parser changes

## Sprint 3: XOX Room UI, I18n, And Scene Surfaces

**Goal**: Replace the demo room UI with a usable XOX experience in both classic and scene presentations.

**Demo/Validation**:

- The room page shows a management topbar, a playable 3x3 board, and clear status.
- Classic rooms listing shows XOX as the only main function.
- Scene mode opens the room and the XOX close-up using the provided assets.

### Task 3.1: Replace the demo runtime UI with a real XOX interface

- **Location**: `rooms/game-room/ui/index.html`, `rooms/game-room/ui/index.js`, `rooms/game-room/ui/style.css`
- **Description**: Build a room runtime with a management topbar, 3x3 board, turn status, move feedback, restart/reset controls, and in-room help text. Remove all demo chess/checkers/backgammon language and visuals.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - No irrelevant demo content remains.
  - The board reflects host state and updates after every accepted move.
  - Controls are correctly enabled or disabled based on connection state and game state.
- **Validation**:
  - Manual room smoke
  - Add or extend a room UI regression where practical

### Task 3.2: Add the room management topbar and opponent selection flow

- **Location**: `rooms/game-room/ui/index.js`, `rooms/game-room/ui/style.css`, optionally `src/js/pages/room-page.ts`
- **Description**: Add the requested topbar with: main function list (currently only `XOX`), connected AI opponent selector, starter selector, and a start button that only activates when the room has enough valid state to begin.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The user can choose `AI1` or `AI2` when connected.
  - The start button is disabled until a valid opponent and starter are selected.
  - The topbar leaves room for future functions such as tavla and dama.
- **Validation**:
  - Manual classic-mode smoke
  - Regression coverage if a generic room shell seam was added

### Task 3.3: Localize all room-facing copy in English and Turkish

- **Location**: `rooms/game-room/i18n/tr.json`, `rooms/game-room/i18n/en.json`, `rooms/game-room/ui/index.js`
- **Description**: Replace XOX-facing UI strings with room-local catalogs under the room namespace. Cover topbar labels, board status, errors, prompts, and help copy.
- **Complexity**: 3
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The room runtime has no Turkish-only or English-only hardcoded visible text except documented fallbacks.
  - EN/TR catalogs are structurally aligned.
- **Validation**:
  - `node --test scripts/tests/i18n-ui-regressions.test.ts`
  - `node --test scripts/tests/i18n-language-loader-regressions.test.ts`

### Task 3.4: Wire XOX into classic rooms listing and room scene rendering

- **Location**: `rooms/game-room/manifest.json`, `src/js/pages/rooms.ts`, `src/js/pages/room-page.ts`
- **Description**: Ensure classic mode shows only XOX in the room feature list and scene mode uses `games_main_bg.webp` for the room view and `games_xox.webp` for the XOX close-up. Verify the room remains auto-registered in `scene:debug`.
- **Complexity**: 4
- **Dependencies**: Task 1.2, Task 1.3
- **Acceptance Criteria**:
  - The classic room card shows XOX as the room's main function.
  - Scene mode opens the room view and feature close-up correctly.
  - The `scene:debug` integration scope locked in Sprint 1 is satisfied, not deferred ambiguously.
  - The installed room appears in the scene editor room options without manual registry hacks.
- **Validation**:
  - `node --test scripts/tests/rooms-scene-page-regressions.test.ts`
  - `node --test scripts/tests/scene-debug-room-regressions.test.ts`

### Task 3.5: Implement the explicit scene:debug editing scope locked in Sprint 1

- **Location**: `src/js/pages/room-page.ts`, related scene editor helpers if needed
- **Description**: Complete the exact `scene:debug` scope chosen in Sprint 1. If active-feature close-up editing is enough, verify and document that the room is complete with current bindings. If room-background or panel-art editing is part of the accepted XOX scope, extend the installed-room asset binding surface carefully without breaking other rooms.
- **Complexity**: 5
- **Dependencies**: Task 1.4, Task 3.4
- **Acceptance Criteria**:
  - The accepted XOX `scene:debug` scope is complete rather than postponed.
  - Any new asset binding is generic to installed rooms.
  - Existing room scene debug flows keep working.
- **Validation**:
  - `node --test scripts/tests/scene-debug-room-regressions.test.ts`
  - `node --test scripts/tests/scene-shell-contract-regressions.test.ts`

## Sprint 4: AGENTS Workflow And Final Validation

**Goal**: Document repeatable room-authoring processes and close the loop with regression and smoke coverage.

**Demo/Validation**:

- `AGENTS.md` explains room creation and room-main-function addition clearly.
- The XOX room has focused regression coverage.
- Smoke notes exist for both start flows and both selectable AI slots.

### Task 4.1: Add AGENTS.md workflow for adding a new room

- **Location**: `AGENTS.md`
- **Description**: Add a short, assistant-followable process covering room scope definition, room vs main-function separation, discovery questions, prerequisite planning, asset request guidance, and which AGENTS workflow rules must be applied.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The process is easy for future assistants to follow.
  - It explicitly tells assistants to help the user prepare missing assets early.
  - It does not contradict the existing approval and mode workflows.
- **Validation**:
  - Manual doc consistency review against current AGENTS sections

### Task 4.2: Add AGENTS.md workflow for adding a main function into an existing room

- **Location**: `AGENTS.md`
- **Description**: Add a second process focused on extending an existing room with a new main function. Cover manifest updates, scene object/hotspot planning, protocol/command additions, i18n updates, and user asset collection expectations.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - The process clearly distinguishes room-wide work from feature-only work.
  - It makes future tavla/dama additions follow the same contract as XOX.
- **Validation**:
  - Manual doc review for overlap, clarity, and missing steps

### Task 4.3: Add focused regression coverage for XOX behavior

- **Location**: `scripts/tests/game-room-xox-host-regressions.test.ts` and touched existing room/command/protocol/i18n tests
- **Description**: Add tests for starter selection, opponent routing, board serialization, invalid move rejection, win/draw detection, game-over lockout, and AI command acceptance.
- **Complexity**: 6
- **Dependencies**: Task 2.5, Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - Core XOX loop has direct regression coverage.
  - Touched shared room surfaces remain covered by existing suites.
- **Validation**:
  - Run the new targeted suite plus touched shared suites

### Task 4.4: Run final smoke validation in classic and scene flows

- **Location**: App runtime, room page, rooms page, scene mode
- **Description**: Perform a final smoke pass: open the room, select `AI1`, start with user; reset; select `AI2`, start with AI; confirm command catch, board updates, end-state handling, and scene open/close behavior.
- **Complexity**: 5
- **Dependencies**: All previous tasks
- **Acceptance Criteria**:
  - Both selectable opponent slots are validated.
  - Both start-order branches are validated.
  - Any residual limitations are recorded explicitly.
- **Validation**:
  - Manual smoke checklist
  - `npm run check-types` if available
  - Touched `node --test` suites

## Testing Strategy

- Use the existing room regression suite as the shared safety net:
  - `scripts/tests/room-manifest-regressions.test.ts`
  - `scripts/tests/room-command-registry-regressions.test.ts`
  - `scripts/tests/room-protocol-registry-regressions.test.ts`
  - `scripts/tests/catch-manager-regressions.test.ts`
  - `scripts/tests/room-page-regressions.test.ts`
  - `scripts/tests/room-ui-regressions.test.ts`
  - `scripts/tests/rooms-scene-page-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`
- Add a new XOX-focused host/game-state regression suite instead of relying only on manifest tests.
- Re-run i18n regressions after room copy changes.
- Prefer deterministic tests for board serialization, slot disconnect handling, and command syntax, then finish with manual smoke for full AI routing.

## Potential Risks And Gotchas

- The current catcher only recognizes `++cmd:Name(...)` from the latest assistant message. Protocol text must teach that exact format unless the parser is intentionally expanded.
- Because the catcher scans only the latest assistant reply, a valid XOX command can be lost if the AI emits it in an earlier message or buries it under a later narrative reply.
- Room command names and protocol keys are global across installed rooms. XOX names must be prefixed clearly to avoid collisions.
- The selected AI slot may disconnect after game start. The host and UI must agree on whether the game pauses, fails, or requires restart.
- The current room-host API can send a protocol and a dynamic follow-up message, but a new helper should only be added if two-step delivery proves too brittle or repetitive in practice.
- The provided assets currently sit outside the room package root. They must be moved or copied into `rooms/game-room/assets/` before packaging.
- Installed-room scene asset bindings currently prioritize the active feature close-up. If room-background or panel-art editing is required inside `scene:debug`, it must be added deliberately and early.
- If room UI state and host state drift, the board can look valid while the host rejects moves. Host state must remain the source of truth, with the UI rendered from host snapshots.
- If AI prompts are too permissive, the model may answer narratively without a valid command. The protocol should include exact success and failure examples.

## Rollback Plan

- Restore the previous `rooms/game-room` package from git if the XOX rewrite regresses packaging or rendering.
- Remove new XOX command specs, protocol specs, and test files if shared room systems become unstable.
- If a generic room-shell or room-host seam causes cross-room regressions, revert the shared seam and keep the XOX experience self-contained inside the room package.
- If scene asset binding changes prove risky, keep XOX scene support limited to manifest-wired rendering and defer editor-level asset editing to a follow-up.
