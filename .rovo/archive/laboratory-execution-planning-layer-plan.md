# Plan: Laboratory Execution Planning Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview
Add a preview-only execution planning layer on top of the existing `selection -> suggestion -> preview -> intent` flow. The new layer will let the user see how the system would approach an accepted suggestion without starting any execution. The plan must stay derived-only: the store keeps `activeExecutionIntentId`, while the full execution plan is resolved from selectors at render time.

This phase stays strictly passive:
- no `lab-run-controller.ts` edits
- no analysis execution
- no asset/export creation
- no async, fetch, AI, or randomness
- no execution plan object persisted in store

## Assumptions
- `request_user_input` is unavailable in this session, so the plan resolves scope ambiguities conservatively instead of asking questions.
- The current soft-intent contract from Phase 4.0 remains the base:
  - store keeps only `activeExecutionIntentId`
  - selectors resolve the current suggestion object
  - stale ids collapse to `null`
- An accepted intent may outlive the suggestion preview being open, so the execution plan should derive from active intent, not from preview visibility.
- Current Phase 4.0 lifecycle remains canonical:
  - preview close may leave a valid accepted intent behind, so the plan may remain visible
  - selection intent / ROI / inspection mode / source / project mutations clear `activeExecutionIntentId`, so the plan becomes `null` rather than “re-deriving” across those seams

## Prerequisites
- Existing suggestion truth source:
  - `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`
- Existing soft-intent layer:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-selection-suggestion-binder.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- Existing preview/inspection context already available:
  - `activeSelection`
  - `inspectionMode`
  - `sourceKind`
  - ROI-aware suggestion / interpretation logic

## Sprint 1: Execution Plan Contract
**Goal**: Introduce the execution-plan model and planner seam without changing runtime behavior yet.
**Demo/Validation**:
- New types compile cleanly.
- Planner module exists with deterministic signatures only.

### Task 1.1: Add execution plan model
- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
- **Description**:
  - Add `LabExecutionPlan`:
    - `id`
    - `suggestionId`
    - `title`
    - `steps[]`
    - `expectedOutputs[]`
    - optional `riskNotes[]`
    - optional `confidence`
  - Require `LabExecutionPlan.id` to be canonical and deterministic, derived from stable context only:
    - accepted `suggestionId`
    - action type
    - minimal selection/ROI context signature as needed
  - Explicitly forbid timestamps, random ids, or per-render counters.
  - Keep it UI/runtime-only; do not add it to store state.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Type is available to planner, selectors, and UI.
  - No new persisted schema is introduced.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Create deterministic planner module
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
- **Description**:
  - Add a pure planner entry point, for example:
    - `buildExecutionPlan({ suggestion, activeSelection, inspectionMode, sourceKind })`
  - Keep it sync, deterministic, and side-effect free.
  - Accept only already-resolved suggestion objects rather than raw ids.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Planner has no store imports.
  - Planner has no DOM, fetch, timer, or controller coupling.
- **Validation**:
  - Targeted planner unit coverage through regression suite

## Sprint 2: Deterministic Mapping Rules
**Goal**: Encode stable per-action execution plans that explain what the system would do.
**Demo/Validation**:
- Valid accepted intent resolves to a concrete plan.
- Unknown actions fall back to a safe generic plan.

### Task 2.1: Add action-specific mappings
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
- **Description**:
  - Implement deterministic plan builders for:
    - `analyze-segment`
    - `inspect-audio`
    - `extract-clip`
    - `focus-region`
    - existing ROI-aware actions such as `inspect-motion`, `enhance-visual`, `stabilize-segment`
  - Reuse current selection / ROI context to adjust wording and expected outputs.
- **Complexity**: 6/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Every currently emitted suggestion action type returns a meaningful plan.
  - Plans stay descriptive, not imperative.
- **Validation**:
  - Planner regressions for each action type

### Task 2.2: Add safe fallback plan
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
- **Description**:
  - Add a generic 2-3 step fallback for unknown or future-safe action types.
  - Include low-confidence wording and safe outputs.
- **Complexity**: 2/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Planner never throws on an unknown action type.
  - Fallback stays preview-only and non-executing.
- **Validation**:
  - Unknown action regression

### Task 2.3: Add context-sensitive risk/confidence notes
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
- **Description**:
  - Derive optional `riskNotes` / `confidence` from:
    - short vs long selection windows
    - ROI presence / absence
    - inspection mode emphasis
    - source kind mismatches or reduced context
  - Keep the logic deterministic and lightweight.
- **Complexity**: 4/10
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - Confidence remains explainable and stable for the same inputs.
  - Risk notes never imply execution has started.
- **Validation**:
  - Same-input/same-output regression

### Task 2.4: Cover ROI-first tool-hint plan mappings
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
  - `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`
- **Description**:
  - Make ROI-first accepted intents explicit planning inputs, especially current tool-hint suggestions such as:
    - `inspect-region`
    - `inspect-motion-region`
    - `stabilize-region`
  - Ensure accepted ROI-oriented suggestions resolve to dedicated plans, not generic non-ROI fallbacks.
- **Complexity**: 4/10
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - Accepted ROI tool-hint suggestions resolve to meaningful plans.
  - ROI-aware accepted intents remain deterministic and preview-only.
- **Validation**:
  - ROI tool-hint planner regressions

## Sprint 3: Derived Selector Integration
**Goal**: Resolve execution plans from active intent without storing plan objects.
**Demo/Validation**:
- `activeExecutionIntentId` resolves to a plan through selectors only.
- Stale ids return `null`.
- Preview close may keep a valid plan alive, but selection/ROI/inspection/source/project mutations drop the intent and therefore the plan.

### Task 3.1: Add active plan selector
- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  - Add `getActiveExecutionPlan(state)`.
  - Flow:
    - resolve `activeExecutionIntentId`
    - resolve current suggestion via `getActiveExecutionIntent(state)`
    - if no valid suggestion or no valid selection, return `null`
    - otherwise call the planner
  - Ensure the selector does not depend on preview visibility.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Valid intent yields a plan.
  - Invalid/stale intent yields `null`.
  - Preview-cleared-but-intent-active still yields a plan.
  - Selection/ROI/inspection/source/project mutations do not “re-derive” a new plan; they clear the underlying intent, so the selector returns `null`.
- **Validation**:
  - Selector regressions for valid, stale, and preview-cleared cases

### Task 3.2: Extend waveform timeline view-model
- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**:
  - Add `activeExecutionPlan` to the timeline model.
  - Keep it derived-only and nullable.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - UI receives plan data without any store schema expansion.
- **Validation**:
  - Typecheck + render regression

## Sprint 4: Execution Plan UI Layer
**Goal**: Render the plan as a deeper, passive thinking layer.
**Demo/Validation**:
- Accepted intent shows a plan.
- No plan appears when no valid intent exists.

### Task 4.1: Render execution plan block
- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**:
  - Add an `Execution plan` section with:
    - title
    - ordered or structured steps
    - expected outputs
    - optional risk notes
    - optional confidence
  - Prefer rendering directly below the preview block when preview is open.
  - If preview is closed but accepted intent still exists, render the same plan below the execution-intent strip so the intent remains understandable.
- **Complexity**: 6/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Plan is visible for accepted intents.
  - Plan disappears automatically when selector resolves `null`.
  - Tone reads as “this is how the system would approach it,” not “running now.”
- **Validation**:
  - UI evaluation regression

### Task 4.2: Add styling for the deeper planning layer
- **Location**:
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  - Style the plan as one layer deeper than preview:
    - stronger structure
    - still non-modal
    - “thinking layer” feel
  - Keep the plan visually separate from:
    - suggestion preview
    - execution-intent strip
    - interpretation panel
- **Complexity**: 4/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Plan is scannable and clearly passive.
  - No “run now” visual semantics leak in.
- **Validation**:
  - CSS/render smoke via existing UI suite

## Sprint 5: Regression Closure
**Goal**: Lock the new planning layer behind deterministic tests and persistence fences.
**Demo/Validation**:
- Full plan resolution suite passes.
- Plan never leaks into persisted state.

### Task 5.1: Add planner and selector regressions
- **Location**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**:
  - Add tests for:
    - valid intent -> plan
    - invalid intent -> `null`
    - preview exists but no accepted intent -> no plan
    - preview-cleared + intent-active still resolves plan
    - dismissed intent -> plan disappears immediately
    - queued suggestion does not produce a plan
    - suggestion/context change -> plan changes only while the accepted intent remains valid
    - `selection-inspection-mode-updated` -> plan becomes `null`
    - ROI mutation / clear -> plan becomes `null`
    - ROI-aware plan variance
    - accepted ROI tool-hint intent resolves to a plan
    - fallback plan
    - deterministic repeated output
- **Complexity**: 6/10
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Planner output is stable and predictable.
  - Active plan follows current suggestion context only.
- **Validation**:
  - Targeted truth regressions

### Task 5.2: Add persistence fence coverage
- **Location**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**:
  - Assert that:
    - execution plans are not stored in state
    - persisted workspace payload does not include a plan object
    - hydrate never recreates a plan directly
  - Keep the test aligned with existing soft-intent ephemeral rules.
- **Complexity**: 4/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Plan remains selector-derived only.
- **Validation**:
  - Persist/hydrate regression

### Task 5.3: Add UI evaluation coverage
- **Location**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**:
  - Add markup assertions for:
    - `Execution plan`
    - step list
    - expected outputs
    - absence when no active intent
    - passive wording rather than “Run”
- **Complexity**: 3/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - UI contract stays stable for downstream phases.
- **Validation**:
  - UI evaluation suite

## Testing Strategy
- Run targeted truth regressions first:
  - planner mapping
  - selector resolution
  - persistence fence
- Run UI evaluation coverage for plan rendering.
- Then run:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
- Refresh installed room copy after source changes and confirm parity.

## Potential Risks & Gotchas
- **Preview vs plan drift**:
  - Risk: the preview copy and the execution plan copy describe conflicting workflows.
  - Mitigation: keep preview as “what would happen” summary and planner as “how it would be approached,” not two separate truth sources about results.

- **Plan disappearing unexpectedly when preview closes**:
  - Risk: tying plan visibility to preview would make accepted intent feel brittle.
  - Mitigation: derive the plan from active intent, not active preview.

- **Action mapping drift as suggestion types grow**:
  - Risk: new `actionType` values get added to suggestions but not to the planner.
  - Mitigation: keep a mandatory fallback branch and cover all currently emitted action types in tests.

- **Accidental store leakage**:
  - Risk: it becomes tempting to cache plan objects in store for convenience.
  - Mitigation: keep the planner selector-only and explicitly test persistence exclusion.

- **Too-execution-like UX tone**:
  - Risk: plan copy could feel like execution already started.
  - Mitigation: keep labels passive:
    - “Execution plan”
    - “The system would approach this by…”
    - avoid “Run”, “Start now”, or “Executing”.

- **ROI/context mismatches**:
  - Risk: ROI-aware actions render generic plans even when region context exists.
  - Mitigation: pass full `activeSelection` through the planner and explicitly branch on ROI presence.

## Rollback Plan
- Remove `LabExecutionPlan` from model types.
- Delete `rooms/laboratory/runtime/lab-execution-planner.ts`.
- Remove `getActiveExecutionPlan(state)` and view-model wiring.
- Remove execution-plan UI block and related CSS.
- Drop associated tests and regenerate installed room output.
