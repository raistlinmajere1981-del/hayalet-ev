# Plan: Laboratory Phase 4.6 - Alternative / Counterfactual Evaluation Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview

Phase 4.6 adds a passive, derived-only Alternative / Counterfactual Evaluation layer to the existing Laboratory execution-thinking chain:

Selection -> Suggestion -> Preview -> Intent -> Plan -> Simulation -> Readiness -> Payload Preview -> Reflection -> Alternatives.

The layer explains which other viable paths existed, what each path would trade off, and how the currently selected path compares with them. It must not execute anything, dispatch events, persist state, call AI, create assets, touch the run-controller, or integrate with queues/pipelines. When the reflection decision is `proceed`, alternatives can explain why the selected path is stable; when the decision is `review` or `avoid`, alternatives must explain safer or clearer counterfactuals without pretending the selected path is preferred.

The implementation should follow the same pattern as Phases 4.1-4.5: type model, pure runtime builder, selector-derived integration, view-model field, passive UI render, theme styles, targeted runtime/UI regressions, install sync.

## Prerequisites

- Existing Phase 4.1-4.5 chain remains available and green.
- Source-of-truth edits happen under `rooms/laboratory/*`.
- Installed copy under `data/rooms/laboratory/*` is refreshed with `installFromWorkspace("laboratory")`; do not manually peer-edit source and installed copies.
- `lab-run-controller.ts`, analysis runners, asset/export pipeline, queue code, and persistence/hydration contracts stay untouched.
- No clarifying questions are required; the user supplied explicit scope and guardrails.

## Sprint 1: Model And Pure Runtime Builder

**Goal**: Add the structured alternatives model and deterministic builder without touching selectors or UI.
**Demo/Validation**:
- A direct runtime test can call the builder with resolved upstream objects and receive a stable alternatives object.
- Missing upstream objects return `null`.
- Same input produces deeply equal output.

### Task 1.1: Add Alternatives Types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabExecutionAlternative` and `LabExecutionAlternatives` exactly as a derived preview contract. Keep `LabExecutionAlternative.actionType` as `string` so implicit variations such as slower temporal inspection can be represented without expanding executable action enums.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabExecutionAlternative` includes `actionType`, `label`, `summary`, `tradeoff`, and optional `relativeAdvantage`.
  - `LabExecutionAlternatives` includes `id`, `planId`, `summary`, `alternatives`, optional `comparisonNote`, and optional `confidence`.
  - No store, hydrate, snapshot, or run model fields are added.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Create Runtime Module Skeleton

- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Add pure sync functions and input types for resolved and non-null inputs.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Exports `buildExecutionAlternativesFromResolved(input): LabExecutionAlternatives | null`.
  - No DOM, controller, UI, store, fetch, async, random, Date, storage, or event imports.
  - Stable ID is `alternatives:${executionPlan.id}`.
  - Null propagation requires all upstream objects: plan, simulation, readiness, reflection, and valid active selection.
- **Validation**:
  - Static inspection with `rg` for forbidden imports/usages.
  - Targeted runtime tests in Sprint 4.

### Task 1.3: Implement Deterministic Alternative Mapping

- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Generate at most 2-3 alternatives per action using deterministic scope, method, and intensity variations.
- **Complexity**: 5/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `analyze-segment`: can produce `focus-region` when ROI exists, `inspect-audio` when source/intent/inspection mode is audio-oriented, and a precision-oriented narrowed inspection when selection is broad.
  - `focus-region`: can produce `analyze-segment` for wider context, `inspect-motion` for video/motion contexts, and optionally `enhance-visual` for visual clarity.
  - `inspect-audio`: can produce `analyze-segment` and a non-executable slower playback inspection variation.
  - `extract-clip`: can produce `analyze-segment` for semantic review before packaging and `inspect-audio` or `focus-region` when the selected source/context would benefit from pre-extraction inspection.
  - `inspect-motion`: can produce `focus-region` when ROI exists or source is video, plus a temporal clarity variation.
  - `enhance-visual` and `stabilize-segment`: receive explicit deterministic mappings so they do not silently fall into generic fallback.
  - Unknown action types produce generic broader analysis and narrowed inspection alternatives.
  - Each alternative has `summary` and `tradeoff`.
  - `relativeAdvantage` uses only allowed values.
- **Validation**:
  - Runtime tests assert mapping for representative action types and fallback.

### Task 1.4: Add Decision-Aware Summary, Comparison Note, And Confidence

- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Add top-level explanation that compares current path with alternatives without overriding or contradicting the reflection decision.
- **Complexity**: 4/10
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - For `reflection.decision === "proceed"`, summary explains why the selected path is stable and what was sacrificed.
  - For `reflection.decision === "review"`, summary explains that alternatives may reduce uncertainty or improve context.
  - For `reflection.decision === "avoid"`, summary explains that alternatives are safer counterfactuals because the current path is not recommended.
  - Comparison note uses neutral language such as “Compared to the selected path...”.
  - Confidence is deterministic and derived from reflection confidence, readiness status, simulation risk, and alternative count.
  - Output remains stable for identical inputs.
- **Validation**:
  - Deep-equality deterministic test.
  - Assertion that alternatives length is between 1 and 3 when upstream is valid.

## Sprint 2: Selector And View Model Integration

**Goal**: Expose alternatives as selector-derived data without persistence or lifecycle mutations.
**Demo/Validation**:
- `getActiveExecutionAlternatives(state)` returns null for preview-only and queued-only states.
- Accepted valid intent resolves plan -> simulation -> readiness -> payload -> reflection -> alternatives.

### Task 2.1: Add Selector

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Import the alternatives builder and type, then add `getActiveExecutionAlternatives(state)`.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Resolution chain uses existing selectors for plan, simulation, readiness, reflection, selection, inspection mode, and source kind.
  - Any missing upstream returns `null`.
  - Invalid selection returns `null`.
  - No store writes and no events are introduced.
- **Validation**:
  - Runtime tests for valid chain, preview-only, queued-only, and invalid selection.

### Task 2.2: Extend Timeline View Model

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**: Add optional `activeExecutionAlternatives?: LabExecutionAlternatives | null`.
- **Complexity**: 1/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Import `LabExecutionAlternatives`.
  - Field is optional and nullable, matching previous execution layers.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.3: Populate View Model

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `activeExecutionAlternatives: getActiveExecutionAlternatives(state)` to `getWaveformTimelineModel`.
- **Complexity**: 2/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Alternatives remain derived-only.
  - No persistence shape changes.
  - Existing fields remain untouched.
- **Validation**:
  - Runtime persistence leak test extended to assert no alternatives field exists in stored root/workspace state.

## Sprint 3: Passive UI And Styling

**Goal**: Render the alternatives layer as informational comparison only, with no interactions or execution affordances.
**Demo/Validation**:
- The selection panel shows an “Alternative evaluation” block only after reflection exists.
- The block contains summary, alternatives, tradeoffs, optional comparison note, and confidence.
- No CTA text or click handlers are introduced.

### Task 3.1: Add Render Helper

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Import `LabExecutionAlternatives` and add `renderExecutionAlternatives(alternatives)`.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Root element uses `data-lab-execution-alternatives="true"`.
  - Panel heading is distinct from reflection’s existing string-list alternatives, for example `Alternative evaluation`.
  - Each item renders label, summary, tradeoff, and optional relative advantage.
  - Optional comparison note and confidence render when present.
  - Text uses neutral comparison language: “An alternative approach would be...”, “This path would trade...”, “Compared to the selected path...”.
  - No buttons, no click handlers, no selection switching, no execution/action affordance.
- **Validation**:
  - UI source tests assert data attribute and passive copy.

### Task 3.2: Gate Render Ownership

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add local `activeExecutionAlternatives` gating after reflection.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Alternatives render only when semantic selection and `activeExecutionReflection !== null`.
  - Preview-only state does not render alternatives.
  - Queued-only state does not render alternatives.
  - Reflection-missing state does not render alternatives even if a model object is mistakenly supplied.
  - Render order is after reflection and before interpretation, unless the implementation team chooses another nearby passive-readout position with the same gating.
- **Validation**:
  - UI render ownership tests.

### Task 3.3: Add Theme Styles

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add subtle styles for the alternatives layer that visually sit near reflection without CTA emphasis.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - New classes are scoped under `.lab-execution-alternatives`.
  - Styling is distinct but subdued.
  - Relative advantage chips are informational, not button-like.
  - No cursor or hover styling implies interaction.
- **Validation**:
  - UI regression source checks.
  - Manual screenshot smoke if needed after implementation.

## Sprint 4: Regression Tests And Guardrails

**Goal**: Lock down passive, derived-only behavior and prevent drift into execution language.
**Demo/Validation**:
- Runtime and UI tests pass.
- Guardrail grep confirms no `lab-run-controller.ts` diff and no execution CTA language in the new panel.

### Task 4.1: Runtime Tests

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests for the alternatives builder and selector chain.
- **Complexity**: 6/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Valid chain produces alternatives.
  - Missing plan/simulation/readiness/reflection/selection returns `null`.
  - Output is deterministic for identical input.
  - ID is `alternatives:${plan.id}`.
  - Representative action mappings are covered: `analyze-segment`, `focus-region`, `inspect-audio`, `extract-clip`, `inspect-motion`, fallback/unknown.
  - Decision-aware summaries are covered for `proceed`, `review`, and `avoid` so alternatives never contradict reflection.
  - Selector returns null for preview-only and queued-only.
  - Selector returns null after selection invalidation.
  - Persisted state has no `activeExecutionAlternatives` at root or workspace.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.2: UI Tests

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Add tests that verify render presence, gating, passive copy, and tradeoff content.
- **Complexity**: 4/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Panel renders only when alternatives exist and reflection chain is complete.
  - Preview-only markup does not render the panel.
  - Reflection-missing markup does not render the panel.
  - Tradeoff text is present.
  - No CTA text or execution language is introduced.
  - CTA grep should be scoped to actual button-like render text to avoid false positives from JSON field names or unrelated copy.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 4.3: Installed Copy Sync

- **Location**: `data/rooms/laboratory/*`, `config/rooms.json`
- **Description**: Run the existing `installFromWorkspace("laboratory")` flow after source changes so installed room output updates from source.
- **Complexity**: 2/10
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - Installed JS copy includes the new alternatives module and selector/render/theme updates.
  - Source remains the editing source of truth.
- **Validation**:
  - Install command exits successfully.
  - `rg` confirms installed copy has expected generated references.

### Task 4.4: Full Validation

- **Location**: Whole repo
- **Description**: Run targeted and broader checks.
- **Complexity**: 4/10
- **Dependencies**: Tasks 4.1-4.3
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:lint` passes.
  - `npm run rooms:build` passes.
  - `npm run rooms:test:core` passes or only retains known skips.
  - Guardrail grep shows no `lab-run-controller.ts` changes.
  - Guardrail grep shows no new CTA terms: `> Run <`, `> Execute <`, `> Apply <`, `Start execution`, and no alternative-panel button handlers.
- **Validation**:
  - Record command outcomes in the implementation report.

## Testing Strategy

- Unit-level runtime tests cover deterministic builder behavior and null propagation.
- Selector tests cover preview-only, queued-only, accepted intent, invalid selection, and persistence leak prevention.
- UI tests cover passive render ownership, neutral language, tradeoff rendering, and no CTA wording.
- Typecheck/lint/build verify integration correctness.
- Install sync verifies generated installed-room output.
- Final guardrail review verifies the phase stayed out of controller, queue, analysis, assets, and persistence.

## Potential Risks & Gotchas

- **Reflection already has `alternatives?: string[]`**: The new `LabExecutionAlternatives` object must not overwrite or semantically replace the reflection field. Treat the reflection list as quick decision remedies and the new panel as structured counterfactual comparison.
- **Decision contradiction risk**: Do not say the selected path is preferred when reflection says `review` or `avoid`. Summary copy must be decision-aware and should frame alternatives as uncertainty-reducing or safer counterfactuals in those cases.
- **Duplicate UI headings**: Avoid another plain `Alternatives` section title directly after reflection. Prefer `Alternative evaluation` or `Counterfactual comparison`.
- **False-positive CTA tests**: Avoid broad `/Run/` style checks across entire source because existing copy may mention non-CTA concepts. Scope checks to button-like text and forbidden execution phrases.
- **Known action coverage**: Existing suggestion action types include `extract-clip`, `enhance-visual`, and `stabilize-segment`; support them explicitly before fallback to keep output useful.
- **Selection invalidity semantics**: Missing or structurally invalid upstream chain returns `null`; valid but risky context is represented inside reflection/readiness and still can produce alternatives.
- **Too many alternatives**: Keep output capped at 2-3 items to prevent the panel from becoming noisy and to preserve deterministic explainability.
- **Language drift into recommendations**: Copy must not say “Try this instead”, “You should”, or “Better option”. Use comparative/advisory phrasing only.
- **Installed copy drift**: Do not hand-edit `data/rooms/laboratory` as a peer source; refresh it via install sync.

## Rollback Plan

- Remove `rooms/laboratory/runtime/lab-execution-alternatives.ts`.
- Remove `LabExecutionAlternative` and `LabExecutionAlternatives` from `rooms/laboratory/models/lab-types.ts`.
- Remove selector import/function and `activeExecutionAlternatives` model field.
- Remove render helper, render call, and CSS classes.
- Remove the added runtime/UI tests.
- Re-run install sync so installed room output matches source.
- Re-run targeted tests, typecheck, lint, build, and core room tests.

## Implementation Notes For The Next AI

- Keep this phase narrow. It adds comparison, not execution.
- Prefer small helper functions in the runtime module for stats and alternative creation.
- Do not introduce new store fields, events, hydrated fields, queue state, or run payload coupling.
- If a choice feels like it needs AI or runtime inspection, leave it deterministic and conservative.
