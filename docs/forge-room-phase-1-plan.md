# Plan: Forge Room Phase 1 Skeleton

**Generated**: 2026-04-15
**Estimated Complexity**: High

## Overview
Forge Room Phase 1 will add a new TS-first workbench room under `rooms/forge-room` and stop at a runnable skeleton: room packaging, manifest/workbench wiring, domain contracts, room-local session persistence scaffolding, host-side orchestration state, and a minimal UI with real state bindings.

This plan intentionally does **not** implement real AI dispatch, conflict detection, synthesis intelligence, or Repair Room import/export completion. The goal is a stable spine that opens in the app, persists a basic session shape locally, and can accept deeper orchestration work in the next phase without reworking the room boundary.

## Prerequisites
- Scope freeze is already accepted:
  - Forge is a standalone workbench room, not an Analyze/Archive extension.
  - Coordinator is a room-local visible actor, not a new generic `ai0` room slot.
  - `seat / role / persona` separation is mandatory.
  - Repair Room coupling starts only at the handoff package boundary.
- Existing room patterns to reuse:
  - `rooms/laboratory` for workbench, room-local IO, and host/runtime composition.
  - `rooms/game-room` for minimal host entry, internal room commands, and smoke-test patterns.
- Existing registry/build chain to rely on:
  - `rooms/manifest.json -> installed copy -> config/rooms.json -> RoomRegistry.applyInstalledRooms() -> RoomHostRuntime.syncInstalledRooms()`
  - Validation commands: `npm run rooms:typecheck`, `npm run rooms:build`, targeted room smoke tests.

## Sprint 1: Bootstrap The Room Package
**Goal**: Forge Room exists as a workspace room, builds cleanly, is installable, and opens as a minimal workbench page in the app.
**Demo/Validation**:
- `npm run rooms:typecheck`
- `npm run rooms:build`
- Confirm `forge-room` appears in `config/rooms.json` after build/install sync.
- Open the app and verify Forge Room is visible in nav and its page loads without runtime errors.

### Task 1.1: Create The Workspace Room Skeleton
- **Location**: `rooms/forge-room/manifest.json`, `rooms/forge-room/ui/index.html`, `rooms/forge-room/ui/bootstrap.ts`, `rooms/forge-room/ui/index.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/host/index.ts`, `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`, minimal placeholder assets under `rooms/forge-room/shared/assets/` and `rooms/forge-room/main-functions/forge-workbench/assets/`
- **Description**: Add the minimum room package structure with one workbench feature, a classic page shell, and the smallest valid scene footprint required by current workbench validation.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Room id is `forge-room`.
  - `runtime.uiEntry` and `runtime.hostEntry` resolve through the workspace room build.
  - `workbench` is defined with a single feature such as `forge-workbench`.
  - Manifest includes a minimal valid room scene and a `feature.scene` for `workbench.primaryFeatureId` so workbench validation passes.
  - Scene assets may be placeholder-grade in Phase 1, but the validation chain must be satisfied.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:build`

### Task 1.2: Establish Minimal Host Activation
- **Location**: `rooms/forge-room/host/index.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Implement the smallest valid room host export with `activate()`, room ready handling, and host-context reception.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Host module imports cleanly through the room host loader.
  - The host logs activation, stores initial runtime state, and can notify the room UI with a first snapshot.
  - No AI dispatch or external tool logic is introduced yet.
- **Validation**:
  - Add host smoke coverage in Sprint 5.

### Task 1.3: Establish Minimal UI Bootstrap Handshake
- **Location**: `rooms/forge-room/ui/index.html`, `rooms/forge-room/ui/bootstrap.ts`, `rooms/forge-room/ui/index.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Wire the UI through an explicit bootstrap entrypoint so `index.html` loads `bootstrap.js`, which then starts the room runtime and binds `window.roomAPI.onHostMessage()` plus `window.roomAPI.ready()`.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - UI renders an app root and subscribes to host messages.
  - UI can render an empty snapshot without throwing.
  - `index.html` loads the compiled bootstrap module using the same pattern as existing rooms.
  - UI sends at least one safe internal room command for smoke verification, such as `ForgeRoomUiReady`.
- **Validation**:
  - Installed UI smoke test in Sprint 5.

### Task 1.4: Verify Registry And Navigation Integration
- **Location**: `config/rooms.json` during verification, build/install runtime outputs under `data/rooms/forge-room`
- **Description**: Verify the new workspace room is picked up by the workspace room build flow and synchronized into the installed room registry.
- **Complexity**: 3
- **Dependencies**: Tasks 1.1-1.3
- **Acceptance Criteria**:
  - `forge-room` resolves into an installed copy under `data/rooms/forge-room`.
  - `RoomRegistry.applyInstalledRooms()` sees the room and syncs commands/protocols/host runtime.
  - The room becomes visible in app nav without bespoke core wiring.
- **Validation**:
  - `npm run rooms:build`
  - App smoke open

### Task 1.5: Verify Install And Startup Sync Path
- **Location**: `scripts/rooms/build-workspace-rooms.ts`, room install/runtime outputs under `data/rooms/forge-room`, `config/rooms.json`
- **Description**: Add an explicit verification step for the install/startup-sync path, because raw workspace build output alone does not make a room appear in nav.
- **Complexity**: 4
- **Dependencies**: Tasks 1.1-1.4
- **Acceptance Criteria**:
  - Forge can be installed from workspace or synchronized during startup into the installed room registry.
  - `config/rooms.json` includes the Forge installed record after the sync path runs.
  - Verification proves the app consumes the installed room record, not just the workspace source tree.
- **Validation**:
  - `npm run rooms:build`
  - Explicit install/startup-sync smoke or regression in Sprint 5

## Sprint 2: Define Forge Domain Contracts And Local Persistence
**Goal**: Forge Room has stable, TS-first domain types, default presets, and a JSON-based local persistence layer shaped for later orchestration.
**Demo/Validation**:
- Host can create an empty session, persist it under room-local storage, list stored sessions, and load one back.
- No archive DB write is required for Phase 1.

### Task 2.1: Define Identity And Role Contracts
- **Location**: `rooms/forge-room/shared/types/forge-identities.ts`, `rooms/forge-room/shared/types/forge-roles.ts`
- **Description**: Define the type layer for `seat`, `role`, and `persona` so the three concepts cannot collapse into one enum later.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Separate types exist for seat refs, role ids, and persona preset ids.
  - `Gök` and `Rovo` are modeled as persona presets, not transport endpoints.
  - Coordinator is represented as a local actor/state concept, not a seat.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.2: Define Workflow, Session, And Handoff Types
- **Location**: `rooms/forge-room/shared/types/forge-goal.ts`, `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/shared/types/forge-handoff.ts`, `rooms/forge-room/shared/types/index.ts`
- **Description**: Add the requested domain types with small, v1-focused shapes:
  - `ForgeGoal`
  - `ForgeTask`
  - `ForgeTaskAssignment`
  - `ForgeAgentRole`
  - `ForgeAgentResponse`
  - `ForgeConflict`
  - `ForgeSynthesis`
  - `ForgeSession`
  - `ForgeEventLog`
  - `ForgeHandoffPackage`
  - `ForgePersonaPreset`
  - `ForgeCoordinatorState`
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Types are split by responsibility instead of one giant `types.ts`.
  - `ForgeHandoffPackage` matches the frozen contract and keeps `selectedSynthesis` required.
  - Optional fields stay minimal; speculative v2 fields are not added.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.3: Add Persona Preset And Role Catalog Skeletons
- **Location**: `rooms/forge-room/shared/data/persona-presets.ts`, `rooms/forge-room/shared/data/role-catalog.ts`
- **Description**: Add v1 default presets and role metadata, including `gok` and `rovo`.
- **Complexity**: 3
- **Dependencies**: Tasks 2.1-2.2
- **Acceptance Criteria**:
  - `gok` and `rovo` exist as exported preset records.
  - Defaults for `architect`, `challenger`, `external-perspective`, and local `coordinator` are defined.
  - No provider- or transport-specific hard-coding leaks into persona data.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.4: Add Room-Local Storage And IO Helpers
- **Location**: `rooms/forge-room/shared/host/electron-bridge.ts`, `rooms/forge-room/shared/host/io-runtime.ts`, `rooms/forge-room/shared/host/forge-paths.ts`
- **Description**: Mirror the safe room-local IO pattern used in Laboratory, but keep it smaller: resolve session file paths from `runtime.paths.storageDir` and support JSON/text reads and writes through the Electron bridge.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Storage root is derived from room-local runtime paths, not hard-coded global paths.
  - Forge reserves a dedicated session subroot such as `storageDir/sessions/` and never scans top-level `storageDir/build/` or top-level room export residue.
  - Session path helpers support:
    - `sessions/<sessionId>/session.json`
    - `sessions/<sessionId>/events.jsonl`
    - `sessions/<sessionId>/exports/`
    - `sessions/<sessionId>/artifacts/`
  - `events.jsonl` append support exists as a primitive, even if replay is not implemented.
- **Validation**:
  - Targeted persistence test in Sprint 5 or host smoke helper assertions.

### Task 2.5: Implement Session Repository Skeleton
- **Location**: `rooms/forge-room/host/forge-session-storage.ts`, optional `rooms/forge-room/host/forge-session-index.ts`
- **Description**: Implement `create / save / load / list / appendEvent` on top of the room-local IO helpers using snapshot JSON and append-only event log writes.
- **Complexity**: 7
- **Dependencies**: Tasks 2.2-2.4
- **Acceptance Criteria**:
  - `saveSession()` writes a normalized `session.json`.
  - `loadSession()` and `listSessions()` can bootstrap the room from stored files.
  - `listSessions()` is scoped to the reserved Forge session subroot and ignores package manager build/export residue.
  - Event append is isolated behind one method so replay can be added later without changing callers.
  - Archive DB remains untouched in Phase 1.
- **Validation**:
  - `npm run rooms:typecheck`
  - Host smoke or targeted storage test

### Task 2.6: Add Handoff Export Boundary Skeleton
- **Location**: `rooms/forge-room/host/forge-handoff-export.ts`
- **Description**: Add a small utility/service that maps host state plus a selected synthesis into a `ForgeHandoffPackage`, but stops short of final export workflow logic.
- **Complexity**: 4
- **Dependencies**: Tasks 2.2, 2.5
- **Acceptance Criteria**:
  - The utility builds the typed export payload shape.
  - A hard guard blocks export when `selectedSynthesis` is missing.
  - Repair Room import logic is not added.
- **Validation**:
  - `npm run rooms:typecheck`

## Sprint 3: Build The Host-Side Orchestration Store
**Goal**: Forge Room host owns a controlled orchestration state with clear transition points and room notifications after each commit.
**Demo/Validation**:
- The host can accept goal edits, task approval, basic response placeholders, and coordinator updates.
- State survives save/load through the session repository.

### Task 3.1: Define The Forge Runtime State Shape
- **Location**: `rooms/forge-room/host/state/forge-runtime-state.ts`
- **Description**: Define the runtime state blocks required by the scope freeze:
  - `currentGoal`
  - `draftTasks`
  - `approvedTasks`
  - `assignments`
  - `responses`
  - `conflicts`
  - `syntheses`
  - `coordinatorState`
  - `activeSessionId`
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The runtime state can be derived from an empty or loaded `ForgeSession`.
  - Local UI-only fields are kept separate from persisted session data where needed.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 3.2: Add Reducer And Action Catalog
- **Location**: `rooms/forge-room/host/state/forge-runtime-actions.ts`, `rooms/forge-room/host/state/forge-runtime-reducer.ts`
- **Description**: Use a reducer-based store so Phase 1 has one controlled mutation path and Phase 2 can layer real orchestration logic on top without hunting implicit state writes.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Reducer supports only Phase 1-safe actions such as:
    - initialize session
    - update goal draft
    - replace draft tasks
    - approve tasks
    - add placeholder response
    - set conflict summary placeholder
    - set synthesis placeholder
    - update coordinator state
    - hydrate from saved session
  - Reducer is pure and returns new state objects.
  - One or two short comments explain why reducer flow is preferred over scattered mutable state.
- **Validation**:
  - Unit-style reducer test or host smoke assertions

### Task 3.3: Add A Small Host Store Wrapper
- **Location**: `rooms/forge-room/host/state/forge-runtime-store.ts`, `rooms/forge-room/host/state/forge-selectors.ts`
- **Description**: Wrap the reducer with simple `getState / dispatch / subscribe / snapshot` helpers and selectors for UI payload shaping.
- **Complexity**: 5
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Host runtime can subscribe to state changes and notify the room UI after commits.
  - Store can emit a minimal room snapshot payload without leaking internal helpers.
  - The wrapper stays local; no shared-core store is introduced.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 3.4: Compose Host Runtime Lifecycle And Commands
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-room-commands.ts`, optional `rooms/forge-room/host/forge-room-notify.ts`
- **Description**: Connect room lifecycle events and internal room commands to the store and persistence repository.
- **Complexity**: 7
- **Dependencies**: Tasks 2.5-2.6, 3.1-3.3
- **Acceptance Criteria**:
  - `onRoomReady` sends an initial snapshot.
  - `host-context` updates are sanitized and stored.
  - Internal room commands exist for Phase 1 flows:
    - create session
    - update goal draft
    - accept draft breakdown
    - request save
    - request load
    - request handoff export guard check
  - Handoff export path contains a guard or TODO so export is blocked without `selectedSynthesis`.
- **Validation**:
  - Host smoke import
  - Minimal command path test

## Sprint 4: Build The Minimal Workbench UI Skeleton
**Goal**: Forge Room renders all required Phase 1 panels with real host-backed state and explicit empty/placeholder states.
**Demo/Validation**:
- Opening the room shows the full panel stack.
- Editing the goal and triggering simple actions updates the visible UI from real host state.

### Task 4.1: Define UI Contracts And Snapshot Sanitizers
- **Location**: `rooms/forge-room/shared/ui/host-messages.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`, `rooms/forge-room/shared/ui/state.ts`
- **Description**: Define the message shapes the UI reads from the host and the safe request payloads it sends back.
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - UI reads one sanitized room snapshot format.
  - UI request helpers map panel actions to internal room commands.
  - No SlotBridge or AI transport actions are introduced yet.
- **Validation**:
  - Installed UI smoke test

### Task 4.2: Add Panel Components
- **Location**:
  - `rooms/forge-room/ui/panels/goal-input-panel.ts`
  - `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`
  - `rooms/forge-room/ui/panels/approved-tasks-panel.ts`
  - `rooms/forge-room/ui/panels/responses-panel.ts`
  - `rooms/forge-room/ui/panels/conflict-summary-panel.ts`
  - `rooms/forge-room/ui/panels/synthesis-panel.ts`
  - `rooms/forge-room/ui/panels/coordinator-panel.ts`
- **Description**: Create the required Phase 1 panels with empty states and minimal controls.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - All required panels render:
    - Goal Input Panel
    - Draft Breakdown Panel
    - Approved Tasks Panel
    - Responses Panel
    - Conflict Summary Panel
    - Synthesis Panel
    - Coordinator Panel
  - Placeholder text is explicit; runtime data is not faked in production flow.
  - Coordinator panel visibly shows:
    - plan status
    - assignment queue summary
    - conflict summary
    - synthesis status
- **Validation**:
  - Installed UI smoke test

### Task 4.3: Compose The Workbench Layout
- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`, optional `rooms/forge-room/ui/layout.ts`
- **Description**: Compose the panel components into a simple workbench layout with a left/right or stacked rail that can grow later.
- **Complexity**: 5
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Layout is minimal but readable on desktop.
  - No animation-heavy or design-system-expansion work is added.
  - State wiring is real: empty arrays and placeholders come from host state, not hard-coded mock objects.
- **Validation**:
  - Manual app smoke

### Task 4.4: Add Minimal User Actions For The Skeleton
- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`
- **Description**: Support only the actions needed to prove end-to-end wiring:
  - create session
  - edit goal text
  - save session
  - load most recent session
  - acknowledge draft approval placeholder
- **Complexity**: 4
- **Dependencies**: Tasks 3.4, 4.1-4.3
- **Acceptance Criteria**:
  - Goal panel can submit to host state.
  - Save/load actions round-trip through the repository.
  - Coordinator panel reflects queue and status changes from host state.
- **Validation**:
  - Manual app smoke
  - Installed UI smoke test

## Sprint 5: Verification, Guards, And Regression Coverage
**Goal**: The new room is protected by the same baseline checks used for other rooms and has enough validation to support the next implementation phase.
**Demo/Validation**:
- The room passes targeted smoke tests and the standard room build/typecheck flow.
- The app can open Forge Room without manual patching.

### Task 5.1: Add Forge Host Import Smoke Test
- **Location**: `scripts/tests/forge-room-host-import-smoke-regressions.test.ts`
- **Description**: Mirror the existing Laboratory host smoke coverage to prove the built and installed host module imports cleanly.
- **Complexity**: 4
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Built artifact host import passes.
  - Installed copy host import passes.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-host-import-smoke-regressions.test.ts`

### Task 5.2: Add Forge Manifest And Install Sync Regression Coverage
- **Location**: `scripts/tests/forge-room-manifest-regressions.test.ts`, `scripts/tests/forge-room-install-sync-regressions.test.ts`
- **Description**: Add regressions that specifically protect the Phase 1 room seams most likely to break: workbench scene validation and installed-room sync into registry/nav.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - A regression proves the Forge manifest satisfies workbench + feature.scene validation.
  - A regression proves Forge reaches the installed room registry through install/startup sync, not only through workspace build.
- **Validation**:
  - Targeted `node --import tsx --test ...` run

### Task 5.3: Add Forge Installed UI Smoke Test
- **Location**: `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
- **Description**: Add a lightweight DOM/runtime smoke test that loads the installed UI bundle, injects host messages, and asserts the panel skeleton renders.
- **Complexity**: 6
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Test asserts panel titles or stable data attributes for all required panels.
  - Test proves host message handling updates the rendered state.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`

### Task 5.4: Add Session Round-Trip And Handoff Guard Tests
- **Location**: `scripts/tests/forge-room-session-storage-regressions.test.ts`, `scripts/tests/forge-room-handoff-guard-regressions.test.ts`
- **Description**: Protect the new persistence seam and the `selectedSynthesis` export guard before Phase 2 adds real orchestration behavior.
- **Complexity**: 5
- **Dependencies**: Sprints 2-3
- **Acceptance Criteria**:
  - A session can be created, saved, listed, and loaded from the reserved Forge session storage root.
  - Handoff export fails cleanly when `selectedSynthesis` is missing.
- **Validation**:
  - Targeted `node --import tsx --test ...` run

### Task 5.5: Wire Forge Tests Into The Room Test Surface
- **Location**: `package.json`, optional additional test helpers under `scripts/tests/helpers/`
- **Description**: Extend the existing room test command so Forge smoke tests are not orphaned.
- **Complexity**: 3
- **Dependencies**: Tasks 5.1-5.4
- **Acceptance Criteria**:
  - Forge smoke tests are reachable through the room regression command set or a clearly named targeted script.
  - Phase 1 verification steps are documented in the room plan or implementation notes.
- **Validation**:
  - `npm run rooms:test:core` or targeted Forge room test script

## Testing Strategy
- Baseline static validation:
  - `npm run rooms:typecheck`
  - `npm run rooms:build`
- Targeted smoke validation:
  - Forge host import smoke
  - Forge manifest/workbench validation regression
  - Forge install/startup-sync regression
  - Forge installed UI smoke
  - Forge session round-trip regression
  - Forge handoff guard regression
- Manual validation in app:
  - Forge Room appears in nav after install/startup sync
  - Room page opens
  - Goal panel edits state
  - Save/load works against room-local session storage
  - Coordinator panel reflects state changes

## Potential Risks & Gotchas
  - **Workbench + scene coupling**: Current validation requires at least one `feature.scene` when `workbench` is enabled, and specifically for `workbench.primaryFeatureId`. Phase 1 needs a minimal valid scene, not a scene-free room.
  - **Registry visibility**: Adding `rooms/forge-room` is not enough on its own; the installed copy and `config/rooms.json` sync path must be exercised during verification.
  - **Host export drift**: Existing rooms mix host entry conventions. Host import smoke should be added early to catch loader/export mismatches.
  - **UI bootstrap drift**: Existing rooms rely on an explicit bootstrap module from `index.html`; skipping that entrypoint can leave the page visually present but non-functional.
  - **AI0 scope creep**: Coordinator must remain a room-local actor in Phase 1. Do not widen shared room runtime slot context to include `ai0`.
  - **Persistence seam choice**: Forge should reuse room-local IO/Electron bridge patterns and `runtime.paths.storageDir`, but it must reserve a dedicated session subroot so repository listing does not collide with package manager build/export residue.
  - **Mock data leakage**: UI should use empty state placeholders from host state. Test fixtures may use mock snapshots, but production runtime should not boot with fake orchestration data.
  - **Phase bleed**: Do not let SlotBridge fan-out, conflict logic, synthesis logic, or Repair import logic slip into this phase.

## Rollback Plan
- Remove `rooms/forge-room` source files.
- Remove any Forge-specific smoke tests and package script references.
- Remove installed/generated outputs for Forge from:
  - `data/rooms/forge-room`
  - `data/room-storage/forge-room`
  - `config/rooms.json` if it was updated during verification
- Re-run room registry/build verification to ensure the room is no longer surfaced.
