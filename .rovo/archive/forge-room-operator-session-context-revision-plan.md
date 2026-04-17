# Plan: Forge Room Operator And Session Context Revision

**Generated**: 2026-04-17
**Estimated Complexity**: High

## Overview

This evolution pass refines the existing Forge Room baseline without changing its core orchestration model.

The target outcome is:

- `Operator Profile` becomes persistent, editable, and visually decoupled from the main goal flow.
- `Session Context` becomes an explicit per-run selection layer instead of an implicit merge of all operator data.
- `Preflight` continues to act as the context compiler, but it only compiles user-selected truth.
- The current gate logic, dispatch flow, synthesis flow, and runtime orchestration remain intact.

The governing rule for the implementation is:

- user decides context
- system does not assume

## Current Architecture Notes

- Forge already separates persistent operator data from session storage at the host level:
  - operator profile storage: `rooms/forge-room/host/forge-operator-profile-storage.ts`
  - session storage: `rooms/forge-room/host/forge-session-storage.ts`
- The current UI does not reflect that separation well:
  - the full operator profile editor is embedded inline in `rooms/forge-room/ui/panels/goal-input-panel.ts`
  - run-local data is mixed into the same vertical flow
- Preflight is already centralized enough to evolve safely:
  - invalidation: `rooms/forge-room/host/forge-preflight-invalidation.ts`
  - metadata + derived constraints: `rooms/forge-room/host/forge-preflight-metadata.ts`
  - bundle rendering: `rooms/forge-room/host/forge-preflight-runtime.ts`
  - run signature: `rooms/forge-room/host/forge-run-signature.ts`
- The host runtime already supports the requested auto-refresh model in spirit:
  - goal/profile/override edits can invalidate preflight
  - the next AI step can refresh preflight automatically through existing runtime flow in `rooms/forge-room/host/runtime.ts`
- Existing shared types and UI snapshots are stable enough to extend incrementally:
  - `rooms/forge-room/shared/types/forge-preflight.ts`
  - `rooms/forge-room/shared/types/forge-session.ts`
  - `rooms/forge-room/shared/ui/state.ts`
  - `rooms/forge-room/shared/ui/host-messages.ts`
- Existing smoke/regression coverage already protects the most important seams:
  - `scripts/tests/forge-room-preflight-v2-regressions.test.ts`
  - `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`

## Scope And Non-Goals

### In Scope

- Move `Operator Profile` editing out of the inline goal flow.
- Add a compact goal-panel profile summary plus `Manage profile` entrypoint.
- Add a new `Session Context` block inside the goal panel.
- Make session context selection drive preflight and prompt context.
- Keep run overrides, but visually separate them from profile and session selection.
- Add visible preflight status and manual trigger controls.
- Reduce vertical density and clean up labels/helper copy.

### Out Of Scope

- No redesign of the overall Forge three-lane control flow.
- No change to breakdown, dispatch, synthesis, or export algorithms.
- No change to gate logic semantics.
- No new orchestration layer, no new room, no new global modal system requirement.
- No broad export contract rewrite.

## Assumptions

- The implementation should stay evolutionary and prefer extending existing types over replacing the Forge data model wholesale.
- The persistent operator schema should remain compatible with the current canonical Forge fields:
  - skills: `level`, `soldering`, `measurement`, `mechanical`
  - equipment/tools: `multimeter`, `solderingIron`, `hotAir`, `benchPowerSupply`, `magnification`
  - preferences: `mode`, `riskTolerance`
- The requested list-based editor is primarily a UI/presentation refactor in this pass, not a forced replacement of the underlying canonical field model.
- `Add skill` and `Add equipment` should initially operate against Forge’s bounded capability catalog unless a later pass explicitly introduces arbitrary custom profile entries.
- `Session Context` should be stored separately from `runOverride` because they serve different meanings:
  - `sessionContext`: selected persistent truths for this run
  - `runOverride`: temporary run-only conditions and notes
- The plan adopts one canonical selected-truth model to avoid preflight leakage:
  - runtime/session state stores raw `sessionContextSelection`
  - preflight bundle stores a derived `selectedOperatorProfile` projection
  - preflight helpers consume `selectedOperatorProfile` rather than the full persistent profile
- Visible preflight status can map to simplified UI labels:
  - `idle` -> `idle`
  - `fresh` or `warning` -> `ready`
  - `stale` -> `stale`
    while preserving current host/runtime enums to avoid gate logic drift.
- Because this is an evolution pass, a Forge-local drawer or overlay is safer than wiring Forge room directly into the shared app modal manager.

## Prerequisites

- Existing Forge room package under `rooms/forge-room` remains the source of truth.
- The installed copy continues to be generated from the workspace room package; no direct installed-copy edits are part of this plan.
- The current command surface remains available:
  - `ForgeRoomUpdateOperatorProfile`
  - `ForgeRoomUpdateRunOverride`
  - `ForgeRoomRunPreflight`
  - `ForgeRoomGenerateDraft`
  - `ForgeRoomDispatchAssignments`
  - `ForgeRoomGenerateSynthesis`
- Baseline verification commands remain:
  - `npm run typecheck`
  - `npm run rooms:test:core`

## Sprint 1: Extend Contracts For Explicit Session Context

**Goal**: Add the minimum shared and host-side contracts needed to distinguish persistent profile data from explicit per-run context selection, without changing the current workflow behavior yet.

**Demo/Validation**:

- Existing Forge sessions still hydrate.
- Runtime can represent a blank profile plus an empty selection state cleanly.
- Preflight invalidation rules include session context selection changes.

### Task 1.1: Add Session Context Selection Types

- **Location**: `rooms/forge-room/shared/types/forge-preflight.ts`, `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/shared/types/index.ts`
- **Description**: Add shared types for explicit session context selection and for the derived selected-truth projection that preflight should consume.
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
  - A dedicated type exists for per-run selected context.
  - A dedicated derived type exists for the filtered operator truth that preflight consumes.
  - Session context is clearly distinct from persistent operator profile and from run overrides.
  - Empty selection is a first-class valid state.
  - The plan makes one canonical choice about where raw selection lives versus where filtered truth lives.
  - The contract is backward-compatible for older sessions missing the new field.
- **Validation**:
  - `npm run typecheck`

### Task 1.2: Extend Runtime And UI Snapshot State With Backward-Compatible Defaults

- **Location**: `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/host/state/forge-runtime-actions.ts`, `rooms/forge-room/host/state/forge-runtime-reducer.ts`, `rooms/forge-room/shared/ui/state.ts`, `rooms/forge-room/shared/ui/host-messages.ts`
- **Description**: Add the new session context selection field to runtime state, reducer/action plumbing, and UI snapshot projection with safe defaults during hydration and save/load.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Existing saved sessions continue to load without errors.
  - Empty sessions project `sessionContext` as empty instead of `null` ambiguity where possible.
  - Runtime action/reducer plumbing exists for mutating session context without overloading run override state.
  - UI snapshot carries enough data to render profile summary, selection state, and preflight display state without reaching into host-only logic.
  - Save/load regression explicitly covers missing and present `sessionContextSelection` fields.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-session-storage-regressions.test.ts`

### Task 1.3: Add Session Context Command Surface

- **Location**: `rooms/forge-room/shared/forge-constants.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`, `rooms/forge-room/host/forge-room-commands.ts`, `rooms/forge-room/manifest.json`, `rooms/forge-room/host/runtime.ts`
- **Description**: Add a dedicated command for updating per-run session context selection instead of overloading `runOverride`, and wire the host-side execution path that applies it.
- **Complexity**: 5
- **Dependencies**: Tasks 1.1-1.2
- **Acceptance Criteria**:
  - Session context updates have a distinct room command.
  - Existing profile and run override commands remain unchanged.
  - Manifest/command surfaces stay explicit and readable.
  - Host runtime applies the command, updates session context state, invalidates preflight when needed, and persists the active session.
  - The new command does not mutate the persistent operator profile.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-manifest-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-install-sync-regressions.test.ts`

### Task 1.4: Extend Preflight Invalidation And Signature Rules To Include Selection

- **Location**: `rooms/forge-room/host/forge-preflight-invalidation.ts`, `rooms/forge-room/host/forge-run-signature.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Include session context selection changes in stale detection, invalidation messages, and run signature generation while preserving the current AI-step auto-refresh flow.
- **Complexity**: 6
- **Dependencies**: Tasks 1.1-1.3
- **Acceptance Criteria**:
  - Goal edits, session context edits, profile edits, and run override edits all mark preflight stale in a predictable way.
  - The next AI step still auto-refreshes preflight rather than blocking the whole workflow.
  - Run signatures change when selected truth changes.
- **Validation**:
  - targeted invalidation and signature assertions in `scripts/tests/forge-room-preflight-v2-regressions.test.ts`

## Sprint 2: Extract Operator Profile Into A Managed Editor

**Goal**: Remove the large inline operator block from the goal flow and replace it with a compact summary plus a managed editor surface that feels persistent but non-intrusive.

**Demo/Validation**:

- Goal panel shows only a compact operator summary and manage button.
- Profile editor opens in a Forge-local drawer or overlay.
- Empty profile state is explicit and contains no auto-filled assumptions.

### Task 2.1: Add Forge-Local Profile Editor Overlay State

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Add local UI state for opening/closing a profile editor surface without changing persisted Forge session data.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - UI rerenders do not close the editor unexpectedly.
  - The editor state remains presentation-local and does not leak into saved session records.
  - The implementation can support either a modal-style overlay or right-side drawer, with drawer preferred for this pass.
- **Validation**:
  - targeted UI smoke assertion for the manage-profile control and editor visibility state

### Task 2.2: Replace Inline Goal-Panel Profile Grid With Compact Summary

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Remove the large embedded profile form and replace it with a compact operator summary block and `Manage profile` trigger.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The inline profile grid is removed from the goal panel.
  - The goal panel shows only compact profile summary data.
  - Empty profile state renders the requested “no operator profile defined” posture.
  - No profile defaults are implied in UI copy.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`

### Task 2.3: Build List-Based Profile Editor Presentation

- **Location**: new `rooms/forge-room/ui/panels/operator-profile-editor.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Implement the persistent profile editor as a list-oriented surface grouped into skills, equipment, and general fields instead of a dense grid of selects.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Skills and equipment render as list rows instead of form-grid tiles.
  - The editor supports inline edit affordances and remove affordances.
  - Quick actions exist for `Add skill` and `Add equipment`, even if they initially operate on a bounded Forge catalog.
  - General fields such as mode/risk remain editable but visually secondary to skills/equipment.
- **Validation**:
  - targeted UI smoke assertions for editor rows and action triggers

### Task 2.4: Preserve Existing Storage And Save Semantics Behind The New UI

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`, `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-operator-profile-storage.ts`
- **Description**: Keep the current persistent operator profile storage flow, but adapt the new editor UI to save normalized canonical payloads.
- **Complexity**: 5
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Profile save still writes the existing persistent storage record.
  - The editor UI can remain list-based without forcing a full storage schema rewrite.
  - A blank saved profile remains truly blank after reload.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-preflight-v2-regressions.test.ts`

## Sprint 3: Make Session Context The Only Selected Truth For The Run

**Goal**: Add a dedicated session context block inside the goal panel and ensure preflight/prompt context only use selected operator truths plus explicit run overrides.

**Demo/Validation**:

- Goal panel contains a visible `Session Context` section.
- Selecting skills/tools changes what preflight compiles.
- Selecting nothing produces zero assumptions.
- Run overrides remain separate and clearly labeled.

### Task 3.1: Add Goal-Panel Session Context Selection UI

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Add a selection-based session context block with explicit skill and equipment checkboxes plus compact expand-on-select details.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `Session Context` appears inside the goal panel as a high-priority block.
  - Built-in skill/equipment items reflect the persistent profile catalog.
  - Checked items receive a subtle visual highlight.
  - Expanded details appear only when an item is selected.
- **Validation**:
  - UI smoke assertions for session context block and selected state markers

### Task 3.2: Separate Run Overrides Visually And Semantically

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/shared/types/forge-preflight.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Keep temporary conditions and notes, but move them into a visually separate `Run Overrides` subsection and preserve their existing session-local behavior.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Run overrides are no longer visually mixed with persistent profile editing or session context selection.
  - Existing temporary hot-air, pre-analysis toggle, and run-note behavior still works.
  - Override data remains session-local and does not modify the persistent profile.
- **Validation**:
  - targeted host/runtime command assertions for run override persistence

### Task 3.3: Compile Preflight From Selected Session Context Only

- **Location**: `rooms/forge-room/host/forge-preflight-metadata.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Update summary generation, derived constraints, and prompt rendering so only selected operator truths contribute to the run context, while unselected profile data stays out of preflight.
- **Complexity**: 8
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - Unselected persistent profile fields do not influence derived constraints or prompt context.
  - Selected tools/skills do influence the bundle and prompt context.
  - If nothing is selected, prompt context falls back to the explicit zero-assumption posture.
  - Preflight helpers consume the derived `selectedOperatorProfile` projection instead of the full persistent profile.
  - Existing task-level context capsule behavior remains unchanged.
- **Validation**:
  - extend `scripts/tests/forge-room-preflight-v2-regressions.test.ts` with selection-sensitive prompt and constraint assertions

### Task 3.4: Add Visible Preflight Status Alias And Trigger Rules

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/shared/ui/state.ts`
- **Description**: Present simplified visible preflight status (`idle | ready | stale`) and keep the manual `Run preflight` trigger while preserving auto-stale and next-AI-step refresh behavior.
- **Complexity**: 5
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Goal panel clearly shows visible preflight status.
  - Manual preflight trigger remains available.
  - Goal or session context changes mark preflight stale.
  - The next AI step refreshes stale preflight automatically through existing orchestration.
  - Internal `warning` handling remains intact even if the user-facing label is `ready`.
- **Validation**:
  - host runtime regression for stale marking and auto-refresh path

## Sprint 4: Reduce Vertical Load, Clean Labels, And Lock In Regressions

**Goal**: Finish the evolution pass with compact spacing, shorter labels, improved hierarchy, and explicit regression coverage for the new selection-driven model.

**Demo/Validation**:

- Goal panel is visibly denser than before.
- Draft panel empty state is simplified as requested.
- Locked surfaces look intentionally dimmed.
- Checkbox interactions feel responsive but restrained.

### Task 4.1: Rebalance Goal-Panel Density And Visual Hierarchy

- **Location**: `rooms/forge-room/ui/style.css`, `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`
- **Description**: Reduce padding, tighten panel rhythm, and visually prioritize goal input plus session context over secondary copy.
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Goal panel and draft panel use less vertical space.
  - Goal input and session context read as primary.
  - Run overrides read as secondary.
  - Locked panels remain slightly dimmed without becoming unreadable.
- **Validation**:
  - manual desktop scan plus UI smoke snapshot text assertions

### Task 4.2: Clean Copy And Empty States

- **Location**: `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`, `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`
- **Description**: Remove verbose helper copy, shorten labels, and update the draft empty state to the requested minimal guidance.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Verbose helper text such as “Optional context for this skill” and “Session-local overrides and preflight refresh” is removed or replaced with shorter labels.
  - Draft panel empty state reads:
    - `No draft yet.`
    - `Save goal to generate the first structure.`
  - Copy remains consistent in both locales.
- **Validation**:
  - UI smoke text assertions for the new empty-state strings

### Task 4.3: Add Micro-UX Polish For Selection And Lock States

- **Location**: `rooms/forge-room/ui/style.css`
- **Description**: Add subtle hover glow for checkboxes, soft highlight for selected items, and small polish around dimmed/locked surfaces.
- **Complexity**: 3
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Checkbox hover is visible but subtle.
  - Selected rows have a soft highlight.
  - Locked or monitor-like states remain visually consistent with existing Forge styling.
- **Validation**:
  - manual UI review

### Task 4.4: Expand Regression Coverage For Selection-Only Truth

- **Location**: `scripts/tests/forge-room-preflight-v2-regressions.test.ts`, `scripts/tests/forge-room-ui-smoke-regressions.test.ts`, `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
- **Description**: Add regression coverage for empty profile behavior, selection-only prompt behavior, stale invalidation on selection changes, and the new goal-panel controls.
- **Complexity**: 7
- **Dependencies**: Tasks 4.1-4.3
- **Acceptance Criteria**:
  - Tests cover `nothing selected -> zero assumptions`.
  - Tests cover `selection changed -> preflight stale`.
  - UI smoke verifies `Manage profile`, `Session Context`, `Run Overrides`, and visible preflight status.
  - Installed UI smoke still validates the shipped room package.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-preflight-v2-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`

## Testing Strategy

- Start with narrow tests on shared contracts and preflight behavior:
  - session-context types
  - invalidation logic
  - prompt context rendering
- Then update UI smoke coverage to pin the visible behavior:
  - compact profile summary in goal panel
  - profile editor trigger
  - session context block
  - simplified preflight label
  - updated draft empty state
- Finish with broad Forge verification:
  - `npm run typecheck`
  - `npm run rooms:test:core`

## Potential Risks And Gotchas

- The biggest semantic risk is accidentally letting unselected profile data continue to influence derived constraints through existing helper functions in `forge-preflight-metadata.ts`.
- The biggest UX risk is overbuilding the profile editor into a mini-app; this pass should keep it lightweight and room-local.
- `Add skill` and `Add equipment` are the least precise part of the request:
  - if implemented as truly arbitrary free-form entries, the profile schema and preflight compiler expand significantly
  - if implemented against the existing bounded catalog, the pass stays evolutionary
  - this plan assumes the bounded-catalog version first
- The user-facing preflight label wants `ready`, but the runtime currently has `fresh` and `warning`.
  - The safest path is a UI alias rather than a core enum replacement.
- Installed-copy and smoke tests can fail if the UI introduces new required selectors or text without updating the test harness.
- The profile editor overlay should stay Forge-local unless there is a clear reason to depend on shared app modal infrastructure.
- If session context is stored as part of `runOverride`, the conceptual separation becomes muddy and future regressions will be harder to reason about.

## Rollback Plan

- Revert the new session context type additions first if schema drift causes load/save issues.
- Revert UI extraction next by restoring the previous inline operator profile block in `goal-input-panel.ts`.
- Revert selection-aware preflight compilation separately from the UI if the new compiler semantics create prompt regressions.
- Keep regression tests grouped so the rollback can be staged:
  - contract/state layer
  - UI layer
  - preflight compiler layer

## Recommended Implementation Order

1. Shared types and runtime/session defaults
2. New session-context command and invalidation updates
3. Goal-panel profile extraction
4. Forge-local profile editor
5. Session context selection UI
6. Selection-aware preflight compilation
7. Density/copy polish
8. Regression updates and full verification
