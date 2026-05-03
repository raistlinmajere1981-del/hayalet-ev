# Plan: Laboratory Phase 2 - Selection To Action Suggestion Layer

**Generated**: 2026-04-24
**Estimated Complexity**: Medium

## Overview
Add a lightweight suggestion layer on top of the existing semantic timeline selection so the Laboratory workspace can recommend likely next actions without starting any pipeline work.

This phase must stay strictly passive:
- no run-controller execution wiring
- no user-action creation
- no asset generation
- no analysis pipeline trigger

Current codebase notes:
- `activeSelection` already exists as the semantic timeline entity and carries `intent`
- `getWaveformTimelineModel()` already feeds the selection panel UI
- the real timeline markup owner is `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, while `lab-waveform-timeline.ts` is now only the barrel surface
- current selection-intent click wiring already bypasses `run-controller` via `lab-root.ts` + `lab-selection-intent-binder.ts`
- because of that seam, suggestion clicks should follow the same passive event-bus path rather than introducing new `data-lab-action` handlers
- the selection panel already contains a passive generic action row, and the timeline already contains a live executable action row; Phase 2 must not create a third competing action cluster

## Prerequisites
- Phase 1.5 semantic selection layer is merged
- Phase 1.6 selection intent layer is merged
- validation baseline:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - installed room sync before parity-sensitive suites if the Laboratory source copy changes

## Assumptions
- Suggestions are selector-derived and deterministic; they do not inspect runtime logs, artifacts, or analysis state
- Suggestions are recomputed from `activeSelection`, not stored persistently in workspace state
- Confidence is presentation metadata only in this phase
- A valid selection can show more than one suggestion when that improves guidance
- Clicking a suggestion should only emit a passive event and optionally land in event-bus history; it must not mutate run state
- Suggestion generation is fenced by media context as well as selection intent; `sourceKind` must prevent obviously invalid actions from appearing
- The renderer's synthetic `selection-preview` fallback must not generate suggestions on its own; suggestions should come only from selector-provided data derived from the real store selection

## Sprint 1: Suggestion Contract
**Goal**: Define the suggestion type surface and the passive click event contract without changing execution seams.

**Demo/Validation**:
- Types compile with a first-class suggestion model
- The event union can represent a passive suggestion click without forcing any pipeline action

### Task 1.1: Add Suggestion Model
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabActionSuggestion` with `id`, `label`, optional `description`, `actionType`, and `confidence`.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `actionType` includes:
    - `analyze-segment`
    - `extract-clip`
    - `focus-region`
    - `inspect-audio`
    - `enhance-visual`
  - `confidence` is typed as a normalized numeric score
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add Passive Suggestion Click Event
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Extend `LabStoreEvent` with a passive event such as `workspace-selection-suggestion-clicked` or the requested `selectionSuggestionClicked`, then decide whether the reducer should no-op or record only harmless UI state in this phase.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - event shape carries `suggestionId`
  - reducer handling, if any, is explicitly side-effect free
  - event name is documented so future phases reuse the same contract
- **Validation**:
  - union compiles
  - reducer remains no-op-safe

Recommended decision:
- Prefer a workspace-scoped event name such as `workspace-selection-suggestion-clicked` to match the existing event surface
- If product wording must stay `selectionSuggestionClicked`, document it as an intentional exception
- Do not route this through `userActions` in this phase

## Sprint 2: Pure Suggestion Engine
**Goal**: Produce context-aware action suggestions directly from the active semantic selection.

**Demo/Validation**:
- A valid selection returns deterministic suggestions
- No selection returns an empty list

### Task 2.1: Implement Selector-Level Suggestion Rules
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getSelectionSuggestions(state)` as a pure selector that reads `activeSelection.intent` and relevant media context such as `sourceKind`, then returns UI-ready suggestions.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `activeSelection === null` returns `[]`
  - `anomaly` produces an analysis-oriented primary suggestion
  - `motion` produces a motion-check analysis suggestion
  - `audio` produces an audio-inspection suggestion
  - `visual` produces a visual-enhancement suggestion
  - default/general still returns a safe fallback suggestion
  - invalid media/action combinations are suppressed
- **Validation**:
  - selector-focused regression tests

### Task 2.2: Resolve The Single-Vs-Multiple Suggestion Rule
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, plan notes/tests
- **Description**: Reconcile the request inconsistency where the sample engine returns one suggestion but the sample UI shows two buttons.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - the engine has one documented rule for suggestion count
  - duplicate suggestion ids cannot occur
  - ordering is stable across rerenders
- **Validation**:
  - regression for stable ids/order

Recommended decision:
- Return one intent-specific primary suggestion plus one generic secondary fallback when useful
- Example:
  - `anomaly` -> `Anomaliyi analiz et` + `Bu bölümü kes`
  - `audio` -> `Ses detaylarını incele` + `Bu bölümü kes`
  - `general` -> only fallback suggestions unless a second low-confidence helper is clearly justified
- Fence examples:
  - do not suggest `inspect-audio` for image-only sources
  - do not suggest `enhance-visual` for audio-only sources
  - do not suggest clip extraction where the current media context cannot meaningfully support it

### Task 2.3: Add Confidence Presentation Metadata
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Keep confidence thresholds simple and explicit so the UI can render primary vs secondary treatments without embedding ranking logic in markup.
- **Complexity**: 2/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - confidence values stay within `0..1`
  - suggestion order already reflects priority
  - the UI can derive primary/secondary treatment from confidence or rank without extra state
- **Validation**:
  - selector regression for confidence bounds

## Sprint 3: Timeline Suggestion Panel UI
**Goal**: Present selector-generated suggestions inside the existing selection panel without competing with the live timeline action row.

**Demo/Validation**:
- A valid selection shows a `Suggested actions` section
- Suggestions reflect the current selection intent
- No selection means no suggestion panel section

### Task 3.1: Extend Timeline View Model
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**: Feed selection suggestions into the waveform timeline model so the renderer stays selector-driven.
- **Complexity**: 3/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - timeline model includes `selectionSuggestions`
  - `selectionSuggestions` stays optional or safely defaults to `[]` to avoid unnecessary fixture churn
  - renderer does not compute business logic inline
  - no change to playhead, waveform, bookmark, or linked-audio math
- **Validation**:
  - model regression remains green

### Task 3.2: Render Suggested Actions In The Selection Panel
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Replace the current generic passive panel action row with a `Suggested actions` block and render one button per selector-provided suggestion.
- **Complexity**: 4/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - buttons are only shown when a valid active selection exists
  - labels come from the suggestion model
  - optional descriptions can be rendered as secondary copy if present
  - the old `.lab-selection-panel__actions` placeholder row is removed or fully subsumed so the panel does not grow a third action cluster
  - suggestion markup stays visually separate from the live export/grab/extract row
  - suggestion rendering keys off `selectionSuggestions`, not the renderer's local `selection-preview` fallback object
- **Validation**:
  - markup regression assertions

### Task 3.3: Encode Visual Priority
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Mark high-confidence suggestions as primary and lower-confidence suggestions as secondary via data attributes or modifier classes.
- **Complexity**: 3/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - primary and secondary states are driven by suggestion metadata
  - styling does not make suggestions look executable beyond this phase
  - current selection intent styling still wins over suggestion priority styling where they overlap
- **Validation**:
  - markup assertions for priority hooks
  - manual visual smoke check

## Sprint 4: Soft Interaction Wiring
**Goal**: Make suggestion clicks emit passive events without touching run-controller or live action handlers.

**Demo/Validation**:
- Clicking a suggestion emits the passive suggestion event
- No analysis, export, or frame-grab action is triggered

### Task 4.1: Choose The Binder Seam
- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-selection-intent-binder.ts` or new helper under `rooms/laboratory/ui/`
- **Description**: Reuse the current document-level delegated pattern for selection-panel controls instead of wiring through `workspace-surface.ts` or `run-controller`.
- **Complexity**: 4/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - the chosen seam survives rerenders
  - no `data-lab-action` branch is added to `lab-run-controller.ts`
  - the selection panel does not accumulate duplicate click listeners
- **Validation**:
  - targeted click-path regression

Recommended implementation shape:
- Either widen the existing selection-intent binder into a shared selection-panel binder, or add a dedicated suggestion binder alongside it
- Bind from `lab-root.ts` through `eventBus.emit`
- Keep the event passive and reducer-safe

### Task 4.2: Emit Suggestion Click Events
- **Location**: chosen binder, `rooms/laboratory/models/lab-types.ts`, optional store no-op case
- **Description**: On suggestion click, emit the passive suggestion event with `suggestionId` and prevent default where needed.
- **Complexity**: 3/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - event history records the click
  - state does not enter a run or create assets
  - existing selection intent click behavior continues to work
- **Validation**:
  - regression for click -> eventBus history
  - regression proving no interference with `workspace-selection-intent-updated`

## Sprint 5: Styling, Safety, And Regression Coverage
**Goal**: Lock the suggestion layer in as a passive guidance system before any future execution phase.

**Demo/Validation**:
- The suggestion block matches the Laboratory aesthetic
- Regression coverage protects both engine and click wiring

### Task 5.1: Add Suggestion Styling
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add scoped styles for suggestion list, suggestion buttons, and primary/secondary priority states.
- **Complexity**: 3/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - high-confidence suggestions read as preferred but still passive
  - low-confidence suggestions remain visible but secondary
  - styles stay contained to the selection panel
- **Validation**:
  - manual visual smoke check

### Task 5.2: Add Selector And Click Regressions
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests for:
  - no selection -> empty suggestions
  - default/general fallback suggestion
  - intent-specific suggestion generation
  - media-kind fencing for audio/image/video contexts
  - stable ordering/ids if multiple suggestions are emitted
  - passive click event emission
  - passive suggestion section replaces the old generic panel action row
  - no suggestions render from synthetic fallback-only selection markup
  - fence from analysis intent and run execution
- **Complexity**: 5/10
- **Dependencies**: Sprint 2, Sprint 4
- **Acceptance Criteria**:
  - tests cover selector output for each intent family
  - tests prove suggestion clicks do not trigger pipeline work
  - tests keep existing selection intent behavior intact
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.3: Run Broader Laboratory Safety Checks
- **Location**: repository root validation commands
- **Description**: Re-run the normal Laboratory type and parity safety checks after the feature is in place.
- **Complexity**: 2/10
- **Dependencies**: Sprint 5.2
- **Acceptance Criteria**:
  - Laboratory source copy remains shippable
  - generated installed copy is refreshed if needed
- **Validation**:
  - `npm run rooms:typecheck`
  - relevant Laboratory parity/regression suite

## Testing Strategy
- Keep suggestion generation pure and selector-based so most coverage stays in runtime regression tests
- Add markup assertions for suggestion panel rendering in the same timeline render tests that already cover selection entity markup
- Add delegated-click tests similar to the current selection-intent binder tests
- Re-run broader Laboratory parity after source changes to avoid installed/source drift

## Potential Risks And Gotchas
- The request points to `lab-waveform-timeline.ts`, but the real render owner is `lab-waveform-timeline-render.ts`; planning against the barrel file would create confusion
- The request points click dispatch at `workspace-surface.ts`, but the current codebase uses `lab-root.ts` + delegated binders for passive selection-panel interactions
- If suggestion ranking logic leaks into the renderer, future intent/scope changes will become harder to test
- If suggestion ids are too generic, multiple suggestions can collide in event history or future analytics
- If the passive suggestion buttons visually resemble the live action row too closely, users may assume they already execute work
- If the reducer mutates state on suggestion clicks today, Phase 3 execution wiring will be harder to reason about later

## Rollback Plan
- Remove `LabActionSuggestion` and the passive suggestion-click event from `lab-types.ts`
- Remove `getSelectionSuggestions()` and timeline model wiring
- Remove suggestion markup and CSS from the selection panel
- Remove the binder seam for suggestion clicks
- Refresh the installed Laboratory copy if room source files were synced during implementation
