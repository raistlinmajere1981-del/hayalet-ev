# Plan: Forge Room Control Surface Refinement

**Generated**: 2026-04-17
**Estimated Complexity**: High

## Overview

This pass refines the Forge Room left lane so it feels like a control surface instead of a stacked configuration form.

The target outcome is:

- the operator makes decisions by clicking chips and compact action blocks
- the main view exposes only the minimum always-on controls
- persistent profile editing moves into an edit-on-demand surface
- preflight reads like an explicit step in the run
- the draft feels visually downstream of context decisions, not buried below a long form

The governing rule for this pass is:

- change interaction model and presentation
- do not change host logic, data model, preflight logic, gate logic, or storage contracts

## Current Architecture Notes

- The left plan lane is currently assembled in two parts:
  - `rooms/forge-room/ui/panels/goal-input-panel.ts`
  - `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`
- The goal panel currently owns too much of the vertical stack:
  - goal summary
  - target room
  - brief
  - constraints
  - operator profile access
  - session context
  - run overrides
  - preflight status
- The current UI runtime is still form-driven:
  - `rooms/forge-room/ui/forge-room-ui-runtime.ts` reads values directly from visible DOM inputs such as `forge-goal-*` and `forge-run-override-*`
  - this is the main seam that must be loosened before edit-on-demand UI can work cleanly
- Session context is already isolated at the command level:
  - `ForgeRoomUpdateSessionContext` exists
  - `readSessionContextSelectionInputs()` currently expects checkbox-style DOM
- Operator profile editing is already presentation-local enough to collapse safely:
  - the persistent command remains `ForgeRoomUpdateOperatorProfile`
  - the current drawer lives inside `goal-input-panel.ts`
- Draft is already rendered immediately below the goal panel in the same column:
  - the “too low” feeling mostly comes from the goal panel’s height, verbose copy, and spacing
- Translation-driven copy is centralized in:
  - `rooms/forge-room/i18n/en.json`
  - `rooms/forge-room/i18n/tr.json`
- Existing UI smoke coverage already protects the room-level shell:
  - `scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
  - `scripts/tests/forge-room-host-import-smoke-regressions.test.ts`

## Scope And Non-Goals

### In Scope

- Recompose the left lane into a compact goal block, a primary context block, and a lighter temporary-conditions block.
- Replace visible checkbox list behavior with chip-style toggle controls.
- Collapse operator profile into a background system with modal/drawer-only editing.
- Move non-critical goal details out of the always-visible surface.
- Reframe preflight as an explicit micro-step.
- Tighten spacing, padding, and card height across the Forge workbench.
- Compress noisy instructional copy and strengthen action labels.

### Out Of Scope

- No host runtime algorithm changes in `rooms/forge-room/host/**`.
- No changes to shared Forge data contracts or storage shape.
- No changes to preflight generation rules or invalidation semantics.
- No changes to dispatch, response, synthesis, or export logic.
- No new global modal manager requirement.
- No room install/sync lifecycle changes.

## Assumptions

- `Goal` remains the only always-visible editable text input in the main surface.
- `targetRoomId` stays visible as a compact display value and remains `repair-room` by default.
- `brief` and `constraints` remain supported by the existing payload, but they move into an edit-on-demand goal details surface instead of staying in the main lane.
- Session context remains multi-select and zero-selection remains a valid, intentional state.
- Context chips represent run selection, not persistent editing.
- If an operator fact is unset, the main surface should show that as a projection state rather than exposing an inline form control.
- Run overrides keep the current command shape:
  - `notes: string`
  - `enableRovoPreAnalysis: boolean`
  - `tools.hotAir?: boolean`
- Because the run-override model is unchanged, any “temporary conditions” mini-composer will serialize back into the existing `notes` string rather than introducing a new array field.
- The current profile drawer can become the modal/drawer-only editor for this pass; a new shared modal system is not required.

## Prerequisites

- Forge room workspace copy remains the source of truth:
  - `rooms/forge-room/**`
- Existing command surface remains unchanged:
  - `ForgeRoomUpdateGoal`
  - `ForgeRoomUpdateOperatorProfile`
  - `ForgeRoomUpdateSessionContext`
  - `ForgeRoomUpdateRunOverride`
  - `ForgeRoomRunPreflight`
  - `ForgeRoomGenerateDraft`
- Baseline verification remains available:
  - `npm run typecheck`
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`

## Sprint 1: Reframe The UI State Around Decisions

**Goal**: Remove the hard dependency on always-visible form inputs so the surface can become chip-driven and edit-on-demand without touching host logic.

**Demo/Validation**:

- The UI can keep goal details, temporary conditions, and panel open state even when those controls are not always visible.
- Save goal and generate draft still send the same payload shape to the host.

### Task 1.1: Isolate Main-Surface Draft State From Visible DOM

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Introduce UI-local draft state for goal details and temporary condition composition so the runtime no longer depends on long-lived visible textareas.
- **Complexity**: 7
- **Dependencies**: None
- **Acceptance Criteria**:
  - Goal payload fields can be edited through a compact surface plus an edit-on-demand details surface.
  - Closing a details surface does not discard unsaved local values unintentionally.
  - The existing room commands still receive the same payload structure.
- **Validation**:
  - `npm run typecheck`
  - targeted interaction assertions in `scripts/tests/forge-room-ui-smoke-regressions.test.ts`

### Task 1.2: Replace Checkbox-Centric Session Context Binding With Control-Surface Binding

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/panels/goal-input-panel.ts`
- **Description**: Refactor session context event handling so chip presses, not visible checkbox rows, are the primary source of truth for `ForgeRoomUpdateSessionContext`.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Session context updates no longer depend on a visible checkbox list.
  - Zero selection still serializes as an empty valid state.
  - Selection toggles remain immediate and do not mutate operator profile data.
- **Validation**:
  - `npm run typecheck`
  - targeted UI smoke coverage for selection toggles

### Task 1.3: Define View-State Rules For Edit-On-Demand Surfaces

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/panels/goal-input-panel.ts`
- **Description**: Formalize local state for the goal details editor, operator editor visibility, and temporary-condition inline composer so the render layer can stay compact without becoming fragile.
- **Complexity**: 5
- **Dependencies**: Tasks 1.1-1.2
- **Acceptance Criteria**:
  - Operator editor visibility remains local and does not leak into saved session records.
  - Goal details editor and temporary-condition composer can open and close independently.
  - Render cycles do not collapse these surfaces unexpectedly.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-host-import-smoke-regressions.test.ts`
  - targeted UI smoke assertions for open/close behavior

## Sprint 2: Transform The Left Lane Into A Three-Zone Control Surface

**Goal**: Replace the current single stacked block with a compact goal block, a primary context block, and a lighter temporary-conditions block.

**Demo/Validation**:

- The top of the plan lane reads as a control console, not a form.
- The context block becomes the dominant interaction surface.
- The operator profile is collapsed and no inline profile fields remain in the main view.

### Task 2.1: Compress Goal Into A Two-Line Control Block

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Replace the current goal field grid with a compact block that keeps only the always-visible goal input and target display in the main surface.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Main view shows a compact `Goal` input and a compact `Target` display.
  - `brief` and `constraints` no longer consume main-lane height.
  - The goal block reads as operational setup, not a mini form.
- **Validation**:
  - `npm run typecheck`
  - UI smoke coverage for rendered compact goal block

### Task 2.2: Move Goal Details Into Edit-On-Demand UI

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Move non-primary goal fields such as brief and constraints into a drawer/modal-like details surface that can be opened only when needed.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Main surface no longer exposes large textareas for brief and constraints.
  - The user can still edit and persist those fields without changing payload shape.
  - Save goal and generate draft continue to include details fields.
- **Validation**:
  - targeted smoke coverage for opening goal details and saving payload

### Task 2.3: Replace Session Context Rows With Toggle Chips

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Rebuild the current context block into grouped chip controls for `Skills`, `Equipment`, and `General`, using active, inactive, and unset visual states instead of checkbox rows.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Visible checkbox-list presentation is removed.
  - Chips support multi-select.
  - Inactive chips are dim and active chips are clearly highlighted.
  - Unset projections are visually distinct without looking like editable form fields.
  - An unset projection does not become selected truth by accident; it must route the user toward profile editing instead.
  - Clicking a chip feels like a run decision, not a settings change.
- **Validation**:
  - `npm run typecheck`
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`

### Task 2.4: Collapse Operator Profile Into A Background Summary

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Reduce operator profile presence in the main lane to a compact summary such as `Operator: <name> [Edit]`, and remove inline profile fields from the main surface.
- **Complexity**: 6
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Main view shows only compact operator identity plus edit entrypoint.
  - Inline profile fields are fully absent from the main surface.
  - The main lane no longer exposes the full persistent profile.
- **Validation**:
  - `npm run typecheck`
  - smoke coverage for collapsed operator summary

### Task 2.5: Keep Profile Editing Drawer-Only

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Tighten the existing profile editor so all persistent profile edits happen in the dedicated editor surface only, with no inline duplication in the main lane.
- **Complexity**: 5
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - The edit trigger reliably opens the profile editor.
  - All persistent profile edits still flow through `ForgeRoomUpdateOperatorProfile`.
  - The main lane behaves as a projection layer, not a profile form.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`

## Sprint 3: Simplify Overrides And Turn Preflight Into A Step

**Goal**: Make the remaining setup actions feel like lightweight decisions instead of configuration chores.

**Demo/Validation**:

- Temporary conditions become compact and lightweight.
- Preflight reads as a clear step with before/after states.
- Draft feels visually attached to context decisions.

### Task 3.1: Convert Run Overrides Into A Temporary-Conditions Micro Surface

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Replace the current dense run-override block with a compact `Temporary conditions` surface that uses lightweight decisions and a `+ Add condition` inline mini composer.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Large run-override textarea is removed from the main surface.
  - Checkbox clutter is removed from the visible UI.
  - Existing boolean overrides are exposed as lightweight decision chips instead of a checkbox grid.
  - `+ Add condition` reveals a compact inline input.
  - The UI still serializes back into the unchanged `runOverride` command payload.
- **Validation**:
  - `npm run typecheck`
  - targeted UI smoke coverage for adding and removing a temporary condition

### Task 3.2: Trigger Override Updates On Decisions Instead Of Passive Save Forms

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Shift run-override interactions from “fill fields then save” toward discrete decision commits that call the existing command when a chip is toggled or a condition is committed.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The main surface no longer depends on a standalone `Save run overrides` button as the primary interaction.
  - Toggle-style override decisions can commit through the existing command surface.
  - Free-text condition drafting does not spam commands on every keystroke.
- **Validation**:
  - targeted interaction coverage for toggle and condition commit behavior

### Task 3.3: Recast Preflight As An Explicit Micro-Flow

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Replace the current passive preflight strip with a clearer step block that can read as `Context ready` -> `Run Preflight` -> `Preflight complete`, while still reflecting stale states from existing logic.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Preflight reads as a step, not a background status row.
  - Existing stale/idle/fresh semantics remain intact under the hood.
  - The CTA stays correctly gated when the goal is missing.
- **Validation**:
  - `npm run typecheck`
  - UI smoke coverage for idle, stale, and complete render states

### Task 3.4: Pull The Draft Panel Closer To The Context Surface

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Reduce the visual separation between context decisions and the draft output by tightening spacing, rebalancing the plan column stack, and ensuring the draft reads like the next immediate surface.
- **Complexity**: 5
- **Dependencies**: Tasks 2.1-2.5, 3.1-3.3
- **Acceptance Criteria**:
  - Draft panel appears immediately downstream of the decision surface.
  - No low-priority vertical bulk pushes draft visually out of reach.
  - Approved-task mode remains compatible with the same column structure.
- **Validation**:
  - manual desktop/mobile smoke check
  - installed UI smoke update if structural selectors change

## Sprint 4: Compress Copy, Tighten Visual Density, And Re-Verify The Lane

**Goal**: Finish the transformation by reducing noise, strengthening action language, and verifying that the new surface still behaves like Forge.

**Demo/Validation**:

- Main lane has materially less dead space and text noise.
- Primary action reads as a strong operational instruction.
- Existing Forge lane gating still works visually.

### Task 4.1: Replace Passive Copy With Control-Surface Copy

- **Location**: `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`
- **Description**: Remove verbose instructional noise and replace it with short operational labels such as `REQUIRES: GOAL`, `REQUIRES: RESPONSES`, and `SAVE GOAL -> START`.
- **Complexity**: 5
- **Dependencies**: Sprints 2-3
- **Acceptance Criteria**:
  - Long explanatory helper text is removed from the main surface where it does not serve a gate.
  - Primary action language is stronger and more direct.
  - Required-state messaging remains explicit but shorter.
- **Validation**:
  - translation key review
  - manual scan of left-lane copy in both locales

### Task 4.2: Apply A Full Visual Compression Pass

- **Location**: `rooms/forge-room/ui/style.css`
- **Description**: Reduce paddings, gaps, card heights, and oversized empty zones across the Forge shell by roughly the requested 25 percent while preserving readability and mobile behavior.
- **Complexity**: 6
- **Dependencies**: Sprints 2-3
- **Acceptance Criteria**:
  - Goal, context, draft, and coordinator surfaces occupy visibly less vertical space.
  - Card density improves without creating overlap or cramped mobile layouts.
  - Desktop and mobile breakpoints remain stable.
- **Validation**:
  - `npm run typecheck`
  - manual responsive smoke check

### Task 4.3: Update Regression Coverage For The New Interaction Model

- **Location**: `scripts/tests/forge-room-ui-smoke-regressions.test.ts`, `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
- **Description**: Update UI smoke coverage to reflect chip-driven context controls, drawer-only profile editing, temporary-condition composition, stronger action labels, and the new preflight step language.
- **Complexity**: 6
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - Smoke tests cover the new left-lane structure.
  - Tests avoid brittle selectors tied only to spacing or pure styling.
  - Installed-copy UI smoke remains aligned with workspace behavior.
- **Validation**:
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-host-import-smoke-regressions.test.ts`

## Testing Strategy

- Use `npm run typecheck` after each sprint-sized implementation slice.
- Keep smoke coverage focused on behavior, not on exact padding values.
- Verify these key flows manually after the UI pass:
  - save a compact goal
  - open goal details and confirm brief/constraints survive save/generate
  - toggle session context chips with zero-selection still valid
  - open profile editor only from the edit entrypoint
  - add and remove a temporary condition
  - run preflight from the explicit step block
  - confirm draft appears visually downstream of context
  - confirm approved-task mode still renders in the same lane
- Re-check desktop and mobile breakpoints after the compression pass.

## Potential Risks & Gotchas

- The biggest implementation risk is still DOM-coupled payload collection:
  - if hidden or modal-only fields are not backed by stable local state, `Save goal` and `Generate draft` can silently lose brief or constraint data
- Unset profile projections need a deliberate UI rule:
  - selecting an unset truth must not imply that the truth exists
  - the safe default is to show unset explicitly and route editing through the profile editor
- Temporary conditions are constrained by the existing `runOverride` model:
  - multiple visual conditions must still serialize into the unchanged notes string
  - free-text interaction needs a commit boundary to avoid noisy command traffic
- Draft proximity is mostly a composition problem, not a data-flow problem:
  - avoid solving it by leaking draft logic into the goal panel
- Copy compression can accidentally remove required gate clarity:
  - keep short blocker labels, especially `REQUIRES:*` and hard blockers
- UI smoke tests may currently assume checkbox or inline-field structures:
  - selectors should be moved toward stable action/data attributes instead of raw DOM order

## Rollback Plan

- Revert UI-only changes under `rooms/forge-room/ui/**` and translation updates under `rooms/forge-room/i18n/**`.
- Keep host/runtime logic untouched so rollback does not require session migrations.
- If the temporary-condition micro surface proves too lossy for the unchanged notes model, restore the current run-override save surface while keeping the other control-surface gains.
