# Plan: Laboratory Timeline Phase 1.6 - Selection Intent Layer

**Generated**: 2026-04-24
**Estimated Complexity**: Medium

## Overview
Add a lightweight intent layer to semantic timeline selections so a selection can express why it exists, without starting analysis and without changing the current export/run pipelines.

This phase builds directly on Phase 1.5:
- `activeSelection` already exists as the semantic selection entity
- `timelineStartMs` / `timelineEndMs` still act as the compatibility bridge
- the waveform timeline panel already renders the selection entity

Phase 1.6 should stay narrow:
- no run pipeline changes
- no asset pipeline changes
- no intent-to-analysis mapping yet
- no changes to clip/export/grab-frame behavior

Current codebase note:
- `workspace-surface.ts` composes the workspace surface, but the real timeline markup owner is `rooms/laboratory/ui/lab-waveform-timeline.ts`
- current UI event delegation lives in `rooms/laboratory/runtime/lab-run-controller.ts`
- because `run-controller` is explicitly out of scope, the plan should not assume new timeline intent clicks will be wired there

## Prerequisites
- Phase 1.5 semantic selection layer is already merged
- `LabWorkspaceUiState` persists `activeSelection`
- `getWaveformTimelineModel()` already feeds the timeline panel
- validation baseline:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - installed room sync before parity-sensitive suites

## Assumptions
- New selections default to `intent: "general"`
- Existing persisted selections that do not yet carry an `intent` should hydrate as `general`, not `unknown`
- `unknown` remains the fallback only when no active selection exists or a malformed value is encountered
- Intent affects styling and semantic display only in this phase
- The live action row remains canonical and executable; intent controls remain UI-state only
- Intent picker interaction will need a UI-local dispatch seam outside `run-controller`

## Sprint 1: Model And Store Intent Bridge
**Goal**: Extend the semantic selection entity with intent while preserving the Phase 1.5 additive bridge.

**Demo/Validation**:
- Creating a valid selection produces `activeSelection.intent === "general"`
- Existing behavior for selection range creation, reset, and hydration remains unchanged

### Task 1.1: Add Intent Type Surface
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabSelectionIntent` and extend `LabSelection` with a required `intent` field.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabSelectionIntent` includes `anomaly`, `motion`, `audio`, `visual`, `general`, `unknown`
  - `LabSelection.intent` is required at the type level
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Normalize Intent In Selection Synthesis
- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Extend the selection normalization helpers so selection creation and hydration always produce a valid intent.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - freshly synthesized selections default to `general`
  - malformed or unknown persisted intent values normalize safely
  - legacy persisted selections without `intent` hydrate to `general`
  - invalid timeline ranges still produce `activeSelection: null`
- **Validation**:
  - reducer-focused tests for creation and hydrate normalization

### Task 1.3: Add Intent Update Event To The Store
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add a reducer event for updating only the active selection intent.
- **Complexity**: 3/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - reducer exits safely when no active selection exists
  - reducer updates only `activeSelection.intent`
  - reducer does not mutate `startMs`, `endMs`, `id`, `createdAt`, or pipeline state
- **Validation**:
  - reducer test for no-op-without-selection
  - reducer test for in-place intent update

### Task 1.4: Keep Event Naming Consistent
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Decide whether to keep the task’s `updateSelectionIntent` name verbatim or adopt the existing workspace event convention.
- **Complexity**: 2/10
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - the plan chooses one canonical event name
  - naming is documented to avoid drift in tests and future phases
- **Validation**:
  - event type exists in the `LabStoreEvent` union

Recommended decision:
- Prefer `workspace-selection-intent-updated` for consistency with the current reducer surface
- If exact product wording must remain `updateSelectionIntent`, document it as an intentional naming exception

## Sprint 2: Selector And View-Model Exposure
**Goal**: Make intent readable from selectors and available to the timeline renderer without leaking store internals into the UI.

**Demo/Validation**:
- The UI can read a selection’s current intent via selectors
- Missing selections still produce safe fallback values

### Task 2.1: Add Intent Selector Helper
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add a dedicated intent selector alongside the existing selection helpers.
- **Complexity**: 2/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `getSelectionIntent(state)` returns the active selection’s intent
  - missing selection returns `unknown`
- **Validation**:
  - selector regression test

### Task 2.2: Extend Timeline View Model With Intent Metadata
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Push intent data into `getWaveformTimelineModel()` so the renderer can style the panel and overlay from the same source of truth.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - timeline model includes `activeSelection.intent`
  - no change to playhead/bookmark/waveform timing behavior
- **Validation**:
  - timeline model regression stays green

## Sprint 3: Timeline Intent UI
**Goal**: Add a lightweight, clearly passive intent picker to the existing selection entity panel.

**Demo/Validation**:
- A valid selection shows intent pills in the panel
- Current intent is highlighted
- Panel shows a non-blocking hint that intent will guide future analysis

### Task 3.1: Add Intent Display Helpers
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Add formatting helpers for selection intent labels and stable render defaults for fallback selections.
- **Complexity**: 2/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - fallback selection render does not break if semantic metadata is partially absent
  - display labels are centralized, not duplicated inline
- **Validation**:
  - markup assertions in the regression suite

### Task 3.2: Add Intent Pills To The Selection Panel
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Render the intent row inside the existing selection panel:
  - `Anomaly`
  - `Motion`
  - `Audio`
  - `Visual`
  - `General`
- **Complexity**: 4/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - only the active selection renders the picker
  - the active intent is visually highlighted
  - the existing passive action buttons remain present and inert
  - the panel also shows: `This selection will guide future analysis`
- **Validation**:
  - markup regression for pill rendering
  - markup regression for hint text

### Task 3.3: Add Intent Data Attributes For Styling
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Add scoped attributes such as `data-selection-intent` to the overlay and selection panel so CSS can theme them without branching the renderer.
- **Complexity**: 3/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - panel and overlay both expose the same intent token
  - style binding does not rely on brittle text matching
- **Validation**:
  - markup assertions for attributes

## Sprint 4: UI-Local Intent Dispatch Without Run Controller Changes
**Goal**: Make the intent pills update state while respecting the “do not touch run-controller” guard.

**Demo/Validation**:
- Clicking an intent pill updates `activeSelection.intent`
- Timeline range behavior, export controls, and numeric inputs behave exactly as before

### Task 4.1: Define The Dispatch Seam
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-root.ts`, optional new helper under `rooms/laboratory/ui/`
- **Description**: Choose a UI-local event path for intent clicks, because `workspace-surface.ts` itself is render-only and current event delegation for timeline controls lives in `run-controller`.
- **Complexity**: 5/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - the chosen seam does not modify `run-controller`
  - the store can receive the intent update event from UI clicks
  - `workspace-surface.ts` remains a composition layer, not a stateful controller
- **Validation**:
  - targeted UI/runtime regression proving click -> reducer update

Recommended implementation shape:
- `workspace-surface.ts` continues to pass the enriched timeline model into `renderLabWaveformTimeline()`
- a small UI-local binder is attached from `lab-root.ts` or a dedicated helper to listen for intent-pill clicks and emit the store event
- no new `data-lab-action` path is added to `run-controller`

### Task 4.2: Wire Intent Pill Clicks To Store Updates
- **Location**: chosen UI binder from Task 4.1, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: On click, emit the intent update event with the selected intent token.
- **Complexity**: 4/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - clicking a pill updates only selection intent
  - clicking with no active selection is a no-op
  - no analysis or export side effects occur
- **Validation**:
  - regression test for click path and store result

## Sprint 5: Intent-Themed Styling And Safety Coverage
**Goal**: Visually encode intent without making the selection feel noisy or analysis-active.

**Demo/Validation**:
- Each intent subtly changes overlay/panel tone
- Selection still looks like the same Laboratory component family

### Task 5.1: Add Intent Color Tokens
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add subtle intent variants:
  - anomaly -> red-leaning
  - motion -> yellow
  - audio -> violet
  - visual -> blue
  - general -> neutral/cyan-leaning
- **Complexity**: 3/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - overlay border changes by intent
  - selection panel accent changes by intent
  - default/general stays visually closest to the current Phase 1.5 look
- **Validation**:
  - manual visual smoke check

### Task 5.2: Keep Visual Encoding Passive
- **Location**: `rooms/laboratory/ui/lab-theme.css`, `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Ensure styling communicates meaning, not action. The selection should feel tagged, not “armed”.
- **Complexity**: 2/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - no aggressive warning-state styling
  - passive action hints still read as future affordance, not active workflow
- **Validation**:
  - visual review against current Laboratory aesthetic

### Task 5.3: Add Intent Regressions
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests for:
  - default intent = `general`
  - reducer updates intent
  - selector returns intent
  - legacy hydrated selection without intent becomes `general`
  - snapshot/source reset preserves intent reset semantics
  - rendered panel marks the active intent and keeps passive hints inert
- **Complexity**: 4/10
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - regressions cover store, selector, markup, and UI click path
  - no existing Phase 1.5 selection tests regress
- **Validation**:
  - targeted regression suite

## Testing Strategy
- Start with reducer/selector tests before UI click wiring
- Re-run the focused suite after each sprint:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- Before closing the phase:
  - `npm run rooms:typecheck`
  - installed room sync for Laboratory
  - the same laboratory parity/regression pack used in Phase 1.5:
    - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
    - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
    - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
    - `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
    - `scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`
    - `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`

## Potential Risks & Gotchas
- **UI dispatch seam conflict**: the request places intent dispatch in `workspace-surface.ts`, but that file is render-only today. A real click-to-store path needs a small binder elsewhere unless `run-controller` is allowed back into scope.
- **Event naming drift**: `updateSelectionIntent` does not match the existing `workspace-*` reducer vocabulary. Decide once and keep tests aligned.
- **Hydration compatibility**: old Phase 1.5 persisted selections will lack `intent`. If they normalize to `unknown` instead of `general`, the UI will look incomplete after reload.
- **Fallback selection render**: `lab-waveform-timeline.ts` currently creates a fallback semantic object when markup has a valid range but no full selection object. That fallback must include a stable default intent.
- **Style sprawl**: per-intent coloring should hang off one attribute/token, not duplicated CSS branches for panel, overlay, pills, and hint text independently.
- **Future pipeline expectations**: the hint text will imply future behavior. Keep wording explicit that this phase stores intent only and does not launch analysis.

## Rollback Plan
- Remove `LabSelectionIntent` and the `intent` field from `LabSelection`
- Remove the intent update event and selector helper
- Remove intent-pill markup and intent-specific CSS attributes
- Keep Phase 1.5 semantic selection panel intact
- Re-run the Phase 1.5 regression suite to ensure the timeline returns to the previous baseline
