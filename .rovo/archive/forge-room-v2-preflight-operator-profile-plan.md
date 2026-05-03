# Plan: Forge Room V2 Preflight + Operator Profile

**Generated**: 2026-04-16  
**Estimated Complexity**: High

## Overview
This plan extends Forge Room with three context-quality layers without changing the current decision engine:

- persistent `Operator Profile`
- one-shot `Preflight Bundle`
- optional task-level `Context Capsule`

The target outcome is a Forge run that starts with less user re-entry, produces sharper AI context, and keeps the UI compact. The current Forge flow must stay intact:

- user defines a goal
- Forge generates a draft
- user approves tasks
- assignments dispatch
- responses synthesize
- handoff exports

V2 only improves context quality, operator-fit, and traceability around that loop.

## Current Architecture Notes
- Forge already has a room-local session model in `rooms/forge-room/shared/types/forge-session.ts` and `rooms/forge-room/host/state/forge-runtime-state.ts`.
- Forge prompt building is already centralized enough to enrich safely:
  - breakdown: `rooms/forge-room/host/forge-breakdown-runtime.ts`
  - task response: `rooms/forge-room/host/forge-task-runtime.ts`
  - synthesis: `rooms/forge-room/host/forge-synthesis-runtime.ts`
- The orchestration boundary already exists in `rooms/forge-room/host/runtime.ts`; V2 should stay inside this host runtime instead of introducing a new global coordinator.
- Room-local persistence already exists under `rooms/forge-room/host/forge-session-storage.ts` and `rooms/forge-room/shared/host/forge-paths.ts`.
- Export shape already exists in `rooms/forge-room/shared/types/forge-handoff.ts` and `rooms/forge-room/host/forge-handoff-export.ts`.
- Forge UI is already stage-aware and panelized:
  - state snapshot: `rooms/forge-room/shared/ui/state.ts`
  - host message sanitization: `rooms/forge-room/shared/ui/host-messages.ts`
  - commands: `rooms/forge-room/shared/ui/request-runtime.ts`
  - panels: `rooms/forge-room/ui/panels/*.ts`
- Laboratory already contains a useful profile/preflight pattern that can be borrowed selectively without copying its full UX:
  - `rooms/laboratory/main-functions/media-analysis/host/profile-state.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/profile-preflight.ts`
  - `rooms/laboratory/services/preflight-service.ts`

## Non-Goals
- No AI-to-AI conversational mesh.
- No replacement of the current breakdown, dispatch, conflict, or synthesis decision rules.
- No Forge room redesign into a bigger multi-stage app.
- No shared/common session model across apps.
- No mandatory context capsule input for every task.
- No broad export target expansion beyond current Forge assumptions.

## Assumptions
- `Operator Profile` is persistent across runs, but it is stored separately from per-session data.
- The persistent operator profile lives in per-account Forge runtime data, never in the editable workspace tree or installed room copy.
- `Run Override` belongs to the current run/session only and never writes back into the persistent profile.
- `Preflight` runs once per run, then becomes stale when key inputs change:
  - goal summary or brief
  - target room
  - goal constraints
  - operator profile
  - run override
- `Context Capsule` is optional and should default to empty.
- `Context Capsule` is a session-local prompt helper and is excluded from export unless a separate compact summary is intentionally derived.
- `Decision Trace` should be compact, capped, and usable as downstream context.
- `Run Signature` should be deterministic and human-readable, but collision-safe if two runs normalize to the same text.
- If `rovoPreAnalysis` proves too expensive or unstable, the bundle must still be valid with that field omitted or `null`.

## Prerequisites
- Existing Forge Room Phase 2 live loop is already present under `rooms/forge-room`.
- Existing Forge regression suite is available under `scripts/tests/forge-room-*.test.ts`.
- Existing room install/sync path must remain valid:
  - `scripts/tests/forge-room-install-sync-regressions.test.ts`
  - `scripts/tests/forge-room-manifest-regressions.test.ts`
- Existing host/runtime prompt boundary through `dispatchBridge` remains the only AI execution seam.
- `npm run typecheck` and `npm run rooms:test:core` remain the baseline verification commands.

## Sprint 1: Define V2 Contracts And Migration Rules
**Goal**: Add the minimum type, command, and schema foundation for V2 without changing runtime behavior yet.  
**Demo/Validation**:
- Forge types compile with V2 additions.
- Existing sessions can still hydrate with safe defaults.
- Manifest/command/protocol surfaces expose the new V2 seams without breaking install sync.

### Task 1.1: Add Shared V2 Context Types
- **Location**: `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/shared/types/forge-workflow.ts`, `rooms/forge-room/shared/types/index.ts`, new `rooms/forge-room/shared/types/forge-preflight.ts`
- **Description**: Define versioned interfaces for `OperatorProfile`, `RunOverride`, `PreflightBundle`, `CapabilityContext`, `ContextCapsule`, `DecisionTrace`, and `RunSignature` support types.
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
  - Shared types exist for all new V2 concepts.
  - Types distinguish persistent profile data from session-only run data.
  - `Context Capsule` is explicitly optional.
  - `Decision Trace` is capped by contract or documented limit.
- **Validation**:
  - `npm run typecheck`

### Task 1.2: Extend Forge Session And Runtime State With Backward-Compatible Defaults
- **Location**: `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/shared/ui/state.ts`
- **Description**: Add V2 fields to the saved session shape and in-memory runtime state, while keeping existing saved sessions loadable.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Existing v2 session files hydrate even if V2 fields are absent.
  - New runtime defaults are deterministic and side-effect free.
  - Session schema version bump is documented if required.
  - No current Forge host/runtime flow test breaks only because fields are missing.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-session-storage-regressions.test.ts`

### Task 1.3: Add Minimal V2 Command And Protocol Surface
- **Location**: `rooms/forge-room/manifest.json`, `rooms/forge-room/shared/forge-constants.ts`, `rooms/forge-room/host/forge-room-commands.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`
- **Description**: Add only the command and protocol entries needed for profile CRUD, run override updates, preflight execution, and context capsule updates.
- **Complexity**: 6
- **Dependencies**: Tasks 1.1-1.2
- **Acceptance Criteria**:
  - New command names are explicit and internal.
  - A dedicated preflight protocol slot exists if `rovoPreAnalysis` is implemented.
  - Existing Forge commands remain unchanged and available.
  - Manifest install/sync still succeeds.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-manifest-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-install-sync-regressions.test.ts`

### Task 1.4: Define Invalidation And Run Signature Rules
- **Location**: new `rooms/forge-room/host/forge-run-signature.ts`, new `rooms/forge-room/host/forge-preflight-invalidation.ts`, `rooms/forge-room/shared/forge-constants.ts`
- **Description**: Define what invalidates preflight, how signature text is generated, and when decision traces are reset or retained.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Preflight invalidation triggers are explicit.
  - A stage-transition matrix exists for late profile or override edits:
    - before first draft generation
    - after draft generation but before approval
    - after approval but before dispatch
    - after dispatch has started
    - after synthesis is selected
  - The matrix explicitly preserves the current Forge flow by forbidding silent mutation of in-flight assignments, conflicts, or selected syntheses.
  - Run signature format is deterministic and sanitized.
  - Collision handling is defined.
  - Reset behavior is clear for new session, load session, goal change, and export.
- **Validation**:
  - targeted unit tests for invalidation and signature normalization

### Task 1.5: Add Persistence Migration Matrix And Rollout Order
- **Location**: this plan, `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/host/forge-session-storage.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Add a migration matrix that sequences session shape rollout, operator profile storage, preflight persistence, and export metadata so V2 storage changes land in a safe order.
- **Complexity**: 5
- **Dependencies**: Tasks 1.2-1.4
- **Acceptance Criteria**:
  - The matrix covers read/write compatibility for:
    - legacy session files without V2 fields
    - persistent operator profile records
    - saved preflight bundle state
    - export metadata additions
  - Rollout order is explicit:
    - shared types and normalizers
    - storage ownership and file paths
    - session persistence
    - runtime projection
    - UI projection
    - export/archive metadata
  - The plan identifies which layers may safely read missing data and which layers must never require V2 data eagerly.
- **Validation**:
  - targeted migration compatibility tests

## Sprint 2: Add Persistent Operator Profile And Session-Local Run Context
**Goal**: Load a stable operator profile on every Forge session while keeping run-specific overrides isolated.  
**Demo/Validation**:
- Forge loads a persistent profile summary on room boot.
- User can save profile changes.
- Run override changes affect only the active session.

### Task 2.1: Add Room-Local Operator Profile Storage
- **Location**: `rooms/forge-room/shared/host/forge-paths.ts`, new `rooms/forge-room/host/forge-operator-profile-storage.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Add a persistent profile file path and a storage service for reading/writing a versioned operator profile record.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Profile path is outside the session root.
  - The canonical owner is per-account Forge runtime storage under room data, not the installed room copy and not the editable workspace package.
  - Saved profile contains `schemaVersion` and `updatedAt`.
  - Missing profile resolves to safe defaults.
  - Bad profile data is normalized, not trusted blindly.
- **Validation**:
  - targeted storage regression test
  - targeted install/sync safety regression
  - `node --import tsx --test scripts/tests/forge-room-session-storage-regressions.test.ts`

### Task 2.2: Hydrate Profile Into Forge Runtime And Snapshot
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/shared/ui/state.ts`, `rooms/forge-room/shared/ui/host-messages.ts`
- **Description**: Load the persistent profile during Forge hydration and project both an editable record and a compact summary into the UI snapshot/context.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - UI receives profile summary data on room boot.
  - Snapshot shape separates raw editable state from summary display fields where useful.
  - Existing room boot and `ForgeRoomUiReady` remain intact.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`

### Task 2.3: Add Run Override To Active Session Only
- **Location**: `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Add a session-local run context record that holds `runOverride`, preflight status, and derived signature state without mutating the persistent profile.
- **Complexity**: 6
- **Dependencies**: Tasks 2.1-2.2
- **Acceptance Criteria**:
  - Run override persists with the active session.
  - Saving the session does not overwrite the persistent operator profile.
  - Loading an older session restores its override state.
  - Clearing the override falls back to the persistent profile cleanly.
- **Validation**:
  - targeted session save/load regression

### Task 2.4: Add Profile And Run-Context Command Handlers
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`
- **Description**: Add dedicated host commands for updating the profile and run override, keeping these actions separate from goal editing.
- **Complexity**: 5
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Profile update command writes persistent storage.
  - Run override update command writes only to the active session.
  - Command results return normalized saved payloads when useful.
  - Error messages are structured and user-readable.
- **Validation**:
  - targeted runtime command test

## Sprint 3: Build The Preflight Bundle Engine And Capability Selector
**Goal**: Produce a one-shot, decision-free preflight bundle that enriches the run without bloating the prompt.  
**Demo/Validation**:
- Running preflight yields a versioned bundle.
- Bundle includes only relevant capability metadata.
- Bundle becomes stale when critical inputs change.

### Task 3.1: Define Metadata Source Map And Tagging Model
- **Location**: new `rooms/forge-room/host/forge-preflight-metadata.ts`, new `rooms/forge-room/shared/data/forge-capability-tags.ts`
- **Description**: Enumerate the metadata sources for `coreSystemMetadata`, `appArchitectureSummary`, `targetRoomContext`, and capability inventory, then tag them for selector filtering.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Source map distinguishes stable metadata from volatile run data.
  - Tags cover at minimum: `camera`, `image`, `archive`, `relay`, `ui`, `storage`, `protocol`, `repair-room`.
  - Metadata sourcing is curated; raw docs are not dumped directly into prompts.
  - Missing metadata sources degrade gracefully.
- **Validation**:
  - targeted metadata source test

### Task 3.2: Implement Capability Selector With Size Budget
- **Location**: new `rooms/forge-room/host/forge-capability-selector.ts`
- **Description**: Filter capability metadata by goal, target room, and run context so the preflight bundle stays relevant and small.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Selector filters by tags and target room.
  - Unrelated metadata is excluded.
  - Bundle budget or max-item cap is explicit.
  - Selector is deterministic for the same inputs.
  - Selector output exposes enough size metadata to support final rendered-prompt budget assertions downstream.
- **Validation**:
  - targeted selector tests for include/exclude cases
  - targeted rendered-prompt budget tests for selected bundle summaries

### Task 3.3: Implement Preflight Bundle Builder
- **Location**: new `rooms/forge-room/host/forge-preflight-runtime.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Build the versioned `preflightBundle` with Level 1, Level 2, and optional Level 3 sections while keeping the pass decision-free.
- **Complexity**: 8
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - Level 1 always includes:
    - `coreSystemMetadata`
    - `appArchitectureSummary`
    - `operatorProfile`
    - `constraints`
  - Level 2 conditionally includes:
    - `capabilityContext`
    - `targetRoomContext`
  - Level 3 optionally includes `rovoPreAnalysis`.
  - Builder does not create tasks, choose solutions, or mutate approved tasks.
  - Core bundle-build failure degrades to minimal context plus warning state instead of blocking the run by itself.
- **Validation**:
  - targeted preflight bundle test
  - targeted base-preflight fallback regression
  - runtime flow test with preflight enabled

### Task 3.4: Add Optional `rovoPreAnalysis` With Guardrails
- **Location**: `rooms/forge-room/manifest.json`, `rooms/forge-room/shared/forge-constants.ts`, new protocol file set under `rooms/forge-room/main-functions/forge-workbench/protocols/`
- **Description**: Add an optional pre-analysis pass that only emits contextual observations, missing info, and warnings, never tasks or final decisions.
- **Complexity**: 8
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Protocol contract forbids task breakdown and decision output.
  - Failure or timeout keeps preflight valid without `rovoPreAnalysis`.
  - Output is capped and summary-only.
  - AI-to-AI interaction is not introduced.
  - Tests explicitly reject task candidates, solution recommendations, and ordering hints from this pass.
  - Protocol assets and installed-room sync are validated as soon as these files are introduced.
- **Validation**:
  - targeted protocol/parse regression
  - `node --import tsx --test scripts/tests/forge-room-manifest-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-install-sync-regressions.test.ts`

### Task 3.5: Persist Preflight Result And Staleness
- **Location**: `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-preflight-invalidation.ts`
- **Description**: Store the last preflight bundle, status, staleness markers, and signature derivation data on the active session.
- **Complexity**: 6
- **Dependencies**: Tasks 3.3-3.4
- **Acceptance Criteria**:
  - Session load restores the last preflight result.
  - Goal/profile/override changes mark preflight stale.
  - Export and synthesis can read the last valid bundle.
  - Existing session persistence behavior remains stable.
- **Validation**:
  - session persistence regression

## Sprint 4: Inject Preflight And Capsules Into Prompt Runtime Without Changing Decision Logic
**Goal**: Improve prompt quality for breakdown, task response, and synthesis while preserving the current control flow and gating.  
**Demo/Validation**:
- Breakdown prompt includes preflight summary.
- Task prompt optionally includes context capsule.
- Synthesis produces lightweight decision trace lines.

### Task 4.1: Extend Breakdown Prompt Builder With Preflight Context
- **Location**: `rooms/forge-room/host/forge-breakdown-runtime.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Add a compact preflight section to the breakdown prompt that includes relevant operator fit, capability constraints, and target-room context, then wire `ForgeRoomGenerateDraft` so a fresh preflight exists before the first AI-bound breakdown call.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - `ForgeRoomGenerateDraft` checks for a fresh preflight before dispatching the breakdown request.
  - Missing or stale preflight is regenerated once at the host boundary before the breakdown prompt is sent.
  - If core preflight generation fails, draft generation continues with minimal context and a visible warning rather than hard-failing the run.
  - Level 3 `rovoPreAnalysis` failure degrades to warning-only behavior; it does not abort the run by itself.
  - Breakdown prompt references operator skill/tool reality.
  - Prompt excludes irrelevant capability data.
  - Output contract for breakdown remains unchanged.
  - Retry behavior still works with validator feedback.
- **Validation**:
  - targeted breakdown prompt test
  - targeted preflight-fallback runtime regression
  - `node --import tsx --test scripts/tests/forge-room-breakdown-runtime-regressions.test.ts`

### Task 4.2: Extend Task Prompt Builder With Preflight And Context Capsule
- **Location**: `rooms/forge-room/host/forge-task-runtime.ts`, `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Let each approved task optionally carry a `contextCapsule` and merge it with preflight context at dispatch time.
- **Complexity**: 7
- **Dependencies**: Tasks 3.5, 4.1
- **Acceptance Criteria**:
  - Task prompts include preflight context summary.
  - Capsule content is appended only when present.
  - Capsule does not repeat preflight fields.
  - Dispatch assignment logic and conflict grouping stay unchanged.
  - Fully rendered task prompts stay under an explicit budget even when preflight, capsule, and retry feedback are combined.
- **Validation**:
  - targeted task prompt test
  - targeted rendered-task-prompt budget regression
  - `node --import tsx --test scripts/tests/forge-room-task-runtime-regressions.test.ts`

### Task 4.3: Extend Synthesis Contract To Produce Decision Trace
- **Location**: `rooms/forge-room/host/forge-synthesis-runtime.ts`, `rooms/forge-room/main-functions/forge-workbench/protocols/forge-room-synthesis.md`, `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Extend the synthesis response contract so the returned synthesis can carry `decisionTrace` lines that explain choices through the profile/preflight lens.
- **Complexity**: 7
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - Decision trace is limited to 1-3 short lines.
  - Trace references operator profile or tool constraints when relevant.
  - Parser validates and normalizes the field.
  - Fallback deterministic synthesis still works if the AI omits the field.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-synthesis-runtime-regressions.test.ts`

### Task 4.4: Preserve Current Decision Gates And Export Guards
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-handoff-export.ts`
- **Description**: Ensure V2 remains context-only: current approval, dispatch, conflict, synthesis, and export gates still decide the run.
- **Complexity**: 5
- **Dependencies**: Tasks 4.1-4.3
- **Acceptance Criteria**:
  - Preflight does not auto-approve or auto-resolve anything.
  - Context capsule does not bypass blocked states.
  - Export still requires selected synthesis and resolved conflicts.
  - Existing host flow tests remain green.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-handoff-regressions.test.ts`

## Sprint 5: Add Compact UI For Profile, Preflight, Capsule, Trace, And Signature
**Goal**: Expose V2 features in Forge UI without turning the room into a heavier control panel.  
**Demo/Validation**:
- Goal/start surface shows profile and preflight summary.
- Advanced mode reveals capsule editing only when needed.
- Synthesis/export surfaces show trace and run signature.

### Task 5.1: Add Compact Operator Profile Summary And Edit Surface
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/shared/ui/state.ts`
- **Description**: Add a small editable profile block near the run start surface, with an emphasis on skill level, tools, and working preferences.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Empty profile is allowed.
  - Summary is visible without expanding a large panel.
  - Edit flow remains low-friction.
  - Profile UI does not displace the existing goal flow.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`

### Task 5.2: Add Run Override And Preflight Summary Strip
- **Location**: `rooms/forge-room/ui/panels/coordinator-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Show the active override, preflight status, stale state, and a concise preflight summary in the coordinator/start strip.
- **Complexity**: 6
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - User can tell whether preflight is fresh or stale.
  - Override summary is visible but compact.
  - Preflight rerun action is discoverable.
  - No large diagnostic wall appears in the default UI.
- **Validation**:
  - installed UI smoke update

### Task 5.3: Add Optional Advanced Context Capsule Editing
- **Location**: `rooms/forge-room/ui/panels/approved-tasks-panel.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`, `rooms/forge-room/shared/ui/state.ts`
- **Description**: Add an advanced-only edit surface for task-level context capsules on approved tasks.
- **Complexity**: 7
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Capsule UI is hidden by default.
  - Capsule fields cover only summary, relevant modules, and constraints.
  - Empty capsule is valid.
  - Updating a capsule does not disturb task approval state.
  - UI copy makes it explicit that capsules are prompt helpers for the current session, not exported payload fields.
- **Validation**:
  - targeted UI interaction test

### Task 5.4: Show Decision Trace And Run Signature In Synthesis/Export Surface
- **Location**: `rooms/forge-room/ui/panels/synthesis-panel.ts`, `rooms/forge-room/ui/panels/coordinator-panel.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Surface the latest decision trace and run signature where the user reviews synthesis and export readiness.
- **Complexity**: 5
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Trace is readable in 1-3 lines.
  - Run signature is visible and copyable.
  - Export view makes it obvious which signature was exported.
  - UI remains compact on desktop and usable on narrow screens.
- **Validation**:
  - installed UI smoke update

## Sprint 6: Persist To Session, Export, And Archive Surfaces; Then Lock With Regressions
**Goal**: Make V2 data durable and test-backed across save/load, export, and downstream audit surfaces.  
**Demo/Validation**:
- Saving/loading a session retains profile summary, run override, preflight, trace, and signature.
- Export carries signature and context metadata.
- Regression suite protects the new seams.

### Task 6.1: Extend Session Save/Load And Event Logging
- **Location**: `rooms/forge-room/host/forge-session-storage.ts`, `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/shared/types/forge-session.ts`
- **Description**: Persist the new run-context fields safely and add event log entries around profile updates, preflight runs, capsule updates, and signature changes.
- **Complexity**: 7
- **Dependencies**: Sprints 2-5
- **Acceptance Criteria**:
  - Session JSON contains the new V2 fields.
  - Event log includes key V2 state transitions.
  - Loading older sessions remains safe.
  - Session list behavior is unchanged.
- **Validation**:
  - session persistence regression
  - host runtime flow regression

### Task 6.2: Extend Export And Archive Metadata
- **Location**: `rooms/forge-room/shared/types/forge-handoff.ts`, `rooms/forge-room/host/forge-handoff-export.ts`, `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Add run signature and a compact context summary to export-ready surfaces so handoff consumers and archives can identify the run context later.
- **Complexity**: 6
- **Dependencies**: Tasks 4.3, 6.1
- **Acceptance Criteria**:
  - Export package includes `runSignature`.
  - Export metadata includes compact operator/preflight provenance, not the full raw bundle.
  - Raw `contextCapsule` payloads remain excluded from export and archive metadata unless a separate intentionally-derived summary field is added.
  - Archive-facing references can identify which run produced the export.
  - Existing handoff import assumptions are not broken accidentally.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-handoff-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-handoff-guard-regressions.test.ts`

### Task 6.3: Add Dedicated V2 Regression Coverage
- **Location**: new targeted tests under `scripts/tests/`
- **Description**: Add focused tests for profile storage, override isolation, preflight selection, capsule prompt enrichment, decision trace parsing, and signature persistence.
- **Complexity**: 8
- **Dependencies**: Tasks 6.1-6.2
- **Acceptance Criteria**:
  - Dedicated regressions exist for each new V2 seam.
  - Existing smoke tests are updated only where behavior is intentionally changed.
  - Install-sync and installed-copy coverage still pass.
- **Validation**:
  - `npm run rooms:test:core`

### Task 6.4: Run Manual Smoke And Rollout Checklist
- **Location**: this plan, implementation PR notes, optional docs follow-up
- **Description**: Verify the human-facing flow before calling V2 done.
- **Complexity**: 4
- **Dependencies**: Tasks 6.1-6.3
- **Acceptance Criteria**:
  - Smoke covers:
    - empty profile
    - profile saved and reused
    - temporary run override
    - preflight fresh vs stale
    - advanced capsule edit
    - synthesis with decision trace
    - export with signature
    - reopen latest session
  - Known gaps are recorded explicitly.
- **Validation**:
  - manual smoke checklist

## Testing Strategy
- Keep the current Forge end-to-end host flow as the primary safety net:
  - `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
- Add narrow unit/regression tests around each new deterministic seam:
  - profile storage
  - base preflight fallback
  - preflight selector
  - rendered prompt budget
  - invalidation
  - signature normalization
  - synthesis trace parsing
  - export metadata
- Refresh UI smoke for the installed room copy so V2 remains package-safe:
  - `scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
- Run package-sensitive regressions as soon as new protocol assets or storage paths land, not only at the end of the feature.
- Run at minimum:
  - `npm run typecheck`
  - `npm run rooms:test:core`

## Potential Risks & Gotchas
- **Schema drift risk**: session, runtime snapshot, export package, and UI snapshot can drift if updated independently.
  - Mitigation: land type changes first, then host/runtime projection, then UI.
- **Storage ownership risk**: operator profile storage can accidentally land in workspace or installed-room paths and break sync assumptions.
  - Mitigation: define one per-account runtime owner/path early and lock it with install/sync tests.
- **Prompt bloat risk**: preflight can become too verbose and hurt response quality.
  - Mitigation: capability selector budget, compact summaries, strict size caps, and rendered-prompt budget regressions.
- **Profile misuse risk**: persistent profile could accidentally overwrite run overrides or vice versa.
  - Mitigation: separate storage boundaries and dedicated commands.
- **Stale preflight risk**: preflight may look valid after goal/profile changes.
  - Mitigation: explicit invalidation matrix and visible stale indicator.
- **Late-edit semantics risk**: profile or override edits after approval or dispatch can accidentally alter active work.
  - Mitigation: define a stage-transition matrix that marks later state stale without mutating in-flight assignments automatically.
- **Decision-system creep**: `rovoPreAnalysis` or capsules could start acting like hidden task planning.
  - Mitigation: strict protocol contract and review tests that assert no task output, no recommendations, and no ordering hints.
- **UI sprawl risk**: adding five new concepts can overwhelm the start surface.
  - Mitigation: compact summaries by default, advanced controls behind toggles.
- **Backward-compat risk**: old session files may miss newly required fields.
  - Mitigation: normalize-on-load and regression coverage for older shapes.
- **Export compatibility risk**: extending handoff metadata may accidentally break downstream consumers.
  - Mitigation: prefer additive optional fields and lock handoff regressions early.

## Rollback Plan
- Revert UI-only changes first if V2 context is correct but the surface feels too heavy.
- Keep export metadata additive so downstream consumers can ignore V2 fields during rollback.
- Preserve session normalizers so older sessions remain readable even if V2 writing is rolled back.
- Gate optional `rovoPreAnalysis` behind a feature flag or tolerant null-path so it can be disabled independently.
- If prompt quality regresses, keep the persistent profile and preflight storage but stop injecting optional sections until selector budgets are tuned.
