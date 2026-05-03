# Plan: Game Room Team Tetris Two-Stage Move UX

**Generated**: 2026-04-22
**Estimated Complexity**: High

## Overview
This work targets the existing `game-room` main function `team-tetris`, not a new room. The goal is to replace the current single-stage local-user move drafting flow with a two-stage interaction:

1. Stage 1: the current piece appears in a new preparation area above the board, and the user positions and rotates it with mouse plus left/right and CW/CCW controls.
2. Stage 2: the user defines the descent as either a straight drop or a single-kink `L` route with a one-cell left/right bend, then submits the move.

The safest implementation path is to keep the host move contract unchanged. The host and transport layers already accept `rowShifts`, so the new UI should compile the two-stage planner into canonical `rowShifts` rather than introducing a new command schema in the first pass.

## Scope And Assumptions
- Scope is limited to the local user move UX for `team-tetris`.
- AI, US1, host transport, and protocol payloads keep using the existing `rowShifts` move contract unless validation gaps force a small host-side adjustment.
- No new external art assets are required; the new preparation area is built with DOM/CSS.
- The new local planner exposes only two route shapes for MVP:
  - straight drop
  - single-kink `L` path with exactly one sideways step of `-1` or `+1`
- Existing richer host support for arbitrary `rowShifts` remains intact for AI and remote paths.
- Stage 1 completion should be explicit in the UX, even if the final UI label is adjusted later. A dedicated confirm action keeps the two-stage boundary deterministic and testable.

## Current-State Findings
- The current local UX is board-driven and single-stage:
  - `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`
- The host already resolves move legality from `rowShifts` and auto-drops after the explicit route ends:
  - `rooms/game-room/main-functions/team-tetris/host/engine.ts`
  - `rooms/game-room/main-functions/team-tetris/host/engine-board.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime.ts`
- The UI already has preview, blocked-path messaging, and board overlay rendering that can be reused instead of rewritten from scratch.
- The room runtime sync path already pushes `team-tetris-state`, while `teamTetrisDraft` remains UI-local state:
  - `rooms/game-room/main-functions/team-tetris/host/runtime-sync.ts`
  - `rooms/game-room/ui/game-room-ui-state-message-runtime.ts`

## Prerequisites
- Keep workspace source of truth under `rooms/game-room/...`; do not hand-edit `data/rooms/game-room/...`.
- Reuse the existing UI runtime registration pattern and keep `index.html` / room package regressions green if any runtime file boundaries change.
- Preserve the installed-room smoke expectations in `scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`.
- Run targeted Team Tetris regressions plus `npm run typecheck` before considering the feature complete.

## Sprint 1: Planner Model And Contract Freeze
**Goal**: Define the two-stage planner state and canonical compilation rules without breaking the current host command contract.
**Demo/Validation**:
- Local draft state can represent stage, staged piece position, rotation, and stage-2 route intent.
- A pure planner helper can compile that intent to `rowShifts`.
- Existing engine validation still accepts the compiled payloads.

### Task 1.1: Define The Two-Stage Draft State
- **Location**: `rooms/game-room/ui/game-room-ui-runtime-contracts.d.ts`, `rooms/game-room/main-functions/team-tetris/ui/state-shape-runtime.ts`
- **Description**: Expand `teamTetrisDraft` so it can express:
  - current stage (`positioning` / `route`)
  - staged entry origin
  - selected rotation
  - route mode (`straight` / `bend-left` / `bend-right`)
  - bend row or equivalent route anchor
  - compiled preview metadata
- **Complexity**: 5/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Draft state initializes cleanly for a new turn.
  - Draft state resets cleanly when `turnToken` changes.
  - No host message contract changes are required for this task.
- **Validation**:
  - Typecheck for runtime contract updates.
  - UI-state regression adjustments where shape expectations are asserted.

### Task 1.2: Add A Canonical Planner Compiler
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`
- **Description**: Add pure helpers that convert:
  - stage-1 staged entry position
  - stage-2 route choice
  into canonical `rowShifts` that the host already understands.
- **Complexity**: 7/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Straight routes compile to zero-shift or minimal-shift arrays.
  - Single-kink routes compile to arrays with at most one non-zero sideways step for the route editor portion.
  - Rotation and board bounds are respected for all seven pieces.
- **Validation**:
  - Add or update unit-style UI regressions that assert compiled payloads for representative pieces (`O`, `T`, `I`, `L`).

### Task 1.3: Reuse Existing Replay/Preview Logic
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`, `rooms/game-room/main-functions/team-tetris/ui/state-view-runtime.ts`
- **Description**: Route the new planner output through the existing replay pipeline so blocked routes, preview cells, and status text continue to come from one canonical source.
- **Complexity**: 6/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `preview`, `errorKey`, and submit enablement still come from replay results.
  - Blocked paths still surface the current validation copy rather than introducing duplicate logic.
- **Validation**:
  - Existing blocked-preview tests can be adapted instead of replaced.

### Task 1.4: Lock The Backward-Compatibility Boundary
- **Location**: `rooms/game-room/main-functions/team-tetris/host/engine.ts`, `rooms/game-room/main-functions/team-tetris/host/runtime.ts`, `scripts/tests/game-room-team-tetris-engine-regressions.test.ts`
- **Description**: Verify whether any host change is actually needed. Only patch host code if the new UI reveals an ambiguity in short canonical `rowShifts`.
- **Complexity**: 4/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Host remains backward compatible with old and new local payload shapes.
  - No AI or US1 behavior regresses.
- **Validation**:
  - Existing engine and host regressions remain green.

## Sprint 2: Stage 1 Positioning Area
**Goal**: Replace board-first local placement with a dedicated preparation area above the board.
**Demo/Validation**:
- On the local user's turn, the current piece appears in a new preparation area above the Tetris field.
- The user can move it left/right and rotate it with mouse and buttons.
- The user can explicitly complete Stage 1 and proceed to route authoring.

### Task 2.1: Build The Preparation Area Shell
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`, `rooms/game-room/main-functions/team-tetris/styles/layout.css`, `rooms/game-room/main-functions/team-tetris/styles/presentation.css`
- **Description**: Add a new layout block above the interactive board that visually hosts the active piece and stage-specific controls.
- **Complexity**: 6/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The new area is visually tied to the board width.
  - Desktop and constrained-width layouts still fit without clipping critical controls.
  - The old board-only first action is no longer the primary entry point for local users.
- **Validation**:
  - UI path regressions updated for new DOM landmarks.
  - Manual smoke in app mode for layout fit.

### Task 2.2: Add Left/Right/CW/CCW Controls
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`, `rooms/game-room/main-functions/team-tetris/ui/state-runtime.ts`, `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`
- **Description**: Replace the single `Rotate CW` action with a fuller control set:
  - move left
  - move right
  - rotate clockwise
  - rotate counter-clockwise
- **Complexity**: 6/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Every control mutates only UI-local draft state until submit.
  - Controls clamp to legal columns and legal rotations.
  - Counter-clockwise rotation is available without requiring multi-click cycling.
- **Validation**:
  - Regression tests simulate button clicks and verify draft state / preview updates.

### Task 2.3: Add Mouse-Based Positioning In The Preparation Area
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.ts`, `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`
- **Description**: Support direct pointer interaction in the new top area so the piece can be shifted with the mouse, without relying on the board grid as the primary drafting surface.
- **Complexity**: 7/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Mouse movement updates the staged entry position.
  - Piece bounds remain legal for the selected rotation.
  - The interaction works without requiring drag across the full 20-row board.
- **Validation**:
  - UI regressions simulate mouse-driven positioning.

### Task 2.4: Add Explicit Stage Transition
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`, `rooms/game-room/main-functions/team-tetris/ui/state-view-runtime.ts`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Add an explicit `Confirm Position` step so Stage 1 can end deterministically and Stage 2 can start with a stable staged entry configuration.
- **Complexity**: 5/10
- **Dependencies**: Tasks 2.2, 2.3
- **Acceptance Criteria**:
  - Stage 2 controls stay disabled until Stage 1 is confirmed.
  - Status copy clearly tells the user which stage they are in.
  - Changing rotation or position after confirmation either reopens Stage 1 or triggers a clear, intentional reset.
- **Validation**:
  - UI regressions cover stage gating and reset behavior.

## Sprint 3: Stage 2 Route Editor And Submission
**Goal**: Let the user define a straight or single-kink drop route in the same interaction zone and submit the resulting move.
**Demo/Validation**:
- Stage 2 shows a route editor tied to the staged piece.
- The user can choose straight drop or a one-cell left/right kink.
- The board mirrors the compiled path and piece overlay.
- Submit sends a valid `GameRoomTeamTetrisUserMove` payload.

### Task 3.1: Design The Stage 2 Route Editor
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`, `rooms/game-room/main-functions/team-tetris/styles/layout.css`, `rooms/game-room/main-functions/team-tetris/styles/board.css`
- **Description**: Render a route-authoring UI in the same top interaction area. The MVP editor should let the user:
  - keep the route straight
  - choose a bend row
  - choose bend direction left or right
- **Complexity**: 7/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The route editor is visually understandable without reading the protocol text.
  - A straight route requires fewer clicks than today.
  - A one-cell `L` path is available without freehand board drawing.
- **Validation**:
  - DOM-based UI regressions for stage-2 controls and selected state.

### Task 3.2: Compile Stage 2 Choices Into Preview And Payload
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`
- **Description**: Translate route-editor intent into compiled `rowShifts`, then feed the existing replay/preview path builder.
- **Complexity**: 8/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Straight and bent routes compile deterministically.
  - Invalid bends produce blocked previews and disabled submit.
  - The generated payload remains canonical and compact.
- **Validation**:
  - UI path regressions assert the exact payload emitted by `GameRoomTeamTetrisUserMove`.

### Task 3.3: Mirror The Route On The Main Board
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`, `rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.ts`
- **Description**: Keep the current board overlay and trace rendering, but drive it from the new two-stage planner instead of board drag targets.
- **Complexity**: 5/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - The board still shows the candidate lock cells.
  - Straight routes render as a single vertical trace.
  - Bent routes render as a vertical trace plus one turn marker / one-cell horizontal kink.
- **Validation**:
  - Update the existing trace-shape regression to the new planner flow.

### Task 3.4: Submit And Reset Flow
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`, `rooms/game-room/ui/game-room-ui-state-message-runtime.ts`
- **Description**: Wire submit, success reset, blocked reset, and turn-change reset so the planner never leaks stale stage state into the next turn.
- **Complexity**: 6/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Submit only fires in Stage 2 with a valid preview.
  - A fresh host turn resets the planner to Stage 1.
  - Command-result messages do not leave the UI in a half-confirmed planner state.
- **Validation**:
  - UI regressions for submit, host push, and turn-token refresh behavior.

## Sprint 4: Regression Safety, Copy, And Packaging
**Goal**: Make the new UX safe for room packaging, runtime loading, and future maintenance.
**Demo/Validation**:
- Targeted Team Tetris tests pass.
- The room package / installed-copy expectations still pass.
- Typecheck is clean.

### Task 4.1: Refresh Copy And Validation Messaging
- **Location**: `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`, `rooms/game-room/main-functions/team-tetris/ui/state-view-runtime.ts`
- **Description**: Rewrite local-user guidance from the old single-stage “draw the route” flow to the new two-stage model.
- **Complexity**: 4/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Stage 1 and Stage 2 instructions are explicit.
  - Validation copy still maps to replay outcomes instead of UI-only heuristics.
- **Validation**:
  - Translation-driven UI tests verify key labels and state text.

### Task 4.2: Update Room/UI Regression Coverage
- **Location**: `scripts/tests/game-room-team-tetris-ui-path-regressions.test.ts`, `scripts/tests/game-room-team-tetris-room-regressions.test.ts`, `scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`
- **Description**: Rewrite the UI-path tests around the new interaction model and update any room smoke expectations affected by DOM or runtime wiring changes.
- **Complexity**: 7/10
- **Dependencies**: Sprints 2 and 3
- **Acceptance Criteria**:
  - Tests no longer depend on the old board-click-first drafting flow.
  - Installed-copy regressions still validate the room bundle shape.
- **Validation**:
  - Targeted test run for Team Tetris UI and room suites.

### Task 4.3: Final Verification Pass
- **Location**: repo root command flow plus touched Team Tetris files
- **Description**: Run the final verification checklist and capture any residual risk before merging.
- **Complexity**: 3/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - `npm run typecheck` passes.
  - Targeted Team Tetris tests pass.
  - No manual edits were made in installed-copy paths.
- **Validation**:
  - `npm run typecheck`
  - targeted `node --test` or project test command for Team Tetris regressions

## Testing Strategy
- Start with compiler-focused assertions before large DOM rewrites.
- Keep host and engine tests green to prove the UI compiler preserves the move contract.
- Expand UI-path regressions to cover:
  - stage-1 move left/right
  - CW and CCW rotation
  - explicit stage transition
  - straight route
  - one-cell left bend
  - one-cell right bend
  - blocked bend
  - turn-token reset
  - submit payload shape
- Run room-level regressions that validate bundle shape and runtime script registration.
- Finish with `npm run typecheck` plus a quick in-app smoke on desktop and constrained width.

## Potential Risks And Gotchas
- The current host move model has no explicit “entry column” field. Stage 1 must compile to `rowShifts` cleanly, or the UI and host will disagree.
- Wide pieces (`I`, `J`, `L`, `T`) can become awkward near side walls after rotation; clamping rules must be consistent between the staging area and preview compiler.
- If Stage 1 and Stage 2 share too much mutable state, small control changes may accidentally invalidate the compiled route without obvious UI feedback.
- Existing tests assume the board is the primary drafting surface; this suite will need meaningful rewrites, not just text updates.
- Mobile or narrow-width layouts may suffer if the new prep area and route editor are added without rebalancing the stage/sidebar proportions.
- If the route editor is too abstract, the UX may feel more complex than the current board click flow. The board mirror must stay visually in sync.
- If implementation later needs AI and US1 to follow the same simplified path language, that should be a separate protocol decision, not a hidden side effect of this UI change.

## Suggested Decision Gates Before Coding
- Confirm whether Stage 1 should use an explicit `Confirm Position` button or auto-advance after any valid placement.
- Confirm whether Stage 2 should allow exactly one sideways bend total, or whether the MVP may allow more than one bend if the same UI can support it cheaply.
- Confirm whether the board should remain lightly interactive in Stage 2 as a helper mirror, or become preview-only once the top planner exists.

## Rollback Plan
- Keep the host command schema and transport untouched unless strictly necessary.
- Implement the planner in UI-local state first so rollback can be isolated to Team Tetris UI files.
- If the two-stage UX proves unstable, revert the Team Tetris UI runtime and style files only:
  - `rooms/game-room/main-functions/team-tetris/ui/*.ts`
  - `rooms/game-room/main-functions/team-tetris/styles/*.css`
  - related Team Tetris UI regressions
- Preserve host, engine, and protocol behavior unless a verified bug requires a host-side patch.
