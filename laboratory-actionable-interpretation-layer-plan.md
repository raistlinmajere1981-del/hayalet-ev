# Plan: Laboratory Phase 3.2 – Actionable Interpretation Layer

**Generated**: 2026-04-24
**Estimated Complexity**: Medium

## Overview
Add actionable guidance to the existing passive interpretation layer by extending each interpretation item with optional `recommendation` text and a deterministic `severity` level. The system must stay derived-only: no execution, no async work, no AI calls, no store persistence, no suggestion-system coupling, and no `lab-run-controller.ts` changes.

This phase builds on the current Phase 3.1 seams that already exist:
- `buildInterpretationItems(...)` is the canonical rule engine
- `getInterpretationItems(state)` is already selector-derived
- `lab-waveform-timeline-render.ts` already owns interpretation panel markup
- `lab-theme.css` already has interpretation item tone styling

The safest path is to preserve that architecture and only enrich the interpretation contract, engine output, renderer markup, and tests.

## Assumptions
- The malformed request line `Selection: 10s` is interpreted as `selection > 10s`.
- `type` remains the semantic class for icon/label (`info | warning | hint`).
- `severity` is an additional visual emphasis layer and should not replace `type`.
- Recommendation copy is advisory, not imperative; UI should read as guidance, not command.
- Interpretation without an active selection must continue to work for audio-focus-only rules.

## Prerequisites
- Existing Phase 3.1 interpretation layer is present and passing.
- Current interpretation panel remains rendered from `rooms/laboratory/ui/lab-waveform-timeline-render.ts`.
- Current truth suite remains the main verification surface:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

## Sprint 1: Interpretation Contract Enrichment
**Goal**: Extend the interpretation model without altering state shape or persistence behavior.
**Demo/Validation**:
- TypeScript should accept `recommendation` and `severity` on interpretation items.
- No store schema or reducer changes should be required.

### Task 1.1: Extend Interpretation Item Type
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `recommendation?: string` and `severity?: "low" | "medium" | "high"` to `LabInterpretationItem`.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabInterpretationItem` supports both new fields.
  - No unrelated model types change.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Fence Scope Around Derived-Only Interpretations
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Confirm the current selector/store seam does not require any storage changes. Do not add fields to store or hydration.
- **Complexity**: 2/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - No store writes or reducer changes are introduced for interpretations.
  - `getInterpretationItems(state)` remains the only interpretation entry point.
- **Validation**:
  - Source review
  - `npm run rooms:typecheck`

## Sprint 2: Deterministic Rule Upgrade
**Goal**: Enrich the rule engine with severity and recommendation output while preserving deterministic ordering and current rule coverage.
**Demo/Validation**:
- Interpretation engine returns the same item ids in stable order as before when rule conditions match.
- Matching items now also carry recommendation and severity.

### Task 2.1: Upgrade Existing Audio Rules
- **Location**: `rooms/laboratory/runtime/lab-interpretation-engine.ts`
- **Description**: Extend current audio rules to attach deterministic `recommendation` and `severity`:
  - `gain > 1.5` → warning + `high`
  - `playbackRate < 0.5` → hint + `medium`
  - `playbackRate > 1.5` → hint + `medium`
  - `lowpass && cutoff <= 1200` → info + `low`
  - `eqBands.some(gain > 8)` → warning + `high`
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No async logic, randomness, or external calls are added.
  - Existing ids and rule ordering remain stable unless there is a strong reason to change them.
  - Recommendations are worded as guidance, not commands.
- **Validation**:
  - Targeted rule-engine assertions in truth tests

### Task 2.2: Upgrade Selection Rules
- **Location**: `rooms/laboratory/runtime/lab-interpretation-engine.ts`
- **Description**: Add recommendation and severity to selection rules:
  - `duration < 500ms` → hint + `medium`
  - `duration > 10_000ms` → info + `low`
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - No-selection interpretation behavior remains intact for audio-only rules.
  - Selection recommendations are only emitted when the active selection is valid.
- **Validation**:
  - Truth tests for short and wide selection cases

### Task 2.3: Preserve Deterministic Output Contract
- **Location**: `rooms/laboratory/runtime/lab-interpretation-engine.ts`, `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Ensure item ordering, dedupe behavior, and field values stay stable. If helpful, add a compact shared helper inside the engine for constructing interpretation items consistently.
- **Complexity**: 4/10
- **Dependencies**: Tasks 2.1–2.2
- **Acceptance Criteria**:
  - Repeated calls with the same input return equivalent arrays.
  - No duplicate ids appear.
  - Severity and recommendation values are deterministic.
- **Validation**:
  - Deep-equality tests on repeated engine calls with identical input

## Sprint 3: Render Actionable Guidance
**Goal**: Extend the existing interpretation panel so each item can show both meaning and recommended next step without becoming a command UI.
**Demo/Validation**:
- Interpretation panel shows message and secondary recommendation line.
- Existing collapsible behavior still works.

### Task 3.1: Extend Interpretation Panel Markup
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Update interpretation item rendering to include:
  - existing icon
  - existing meta/type line
  - existing message
  - new optional recommendation line
  - new severity attribute for styling
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Recommendation is rendered only when present.
  - Existing no-selection interpretation panel path continues to render.
  - `type` and `severity` are carried separately in markup.
- **Validation**:
  - Markup assertions in truth tests

### Task 3.2: Keep Guidance Tone Soft
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Adjust copy labels or markup structure so recommendations read as guidance. Avoid CTA-like phrasing or button-like affordances.
- **Complexity**: 2/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The panel remains informational, not actionable.
  - No events, buttons, or bindings are added.
- **Validation**:
  - Render snapshot/markup review

### Task 3.3: Preserve Existing Interpretation Panel State Behavior
- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Verify the existing `<details>` open-state preservation still works after markup expansion. Only adjust if the added nested structure breaks diff preservation.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The panel can still stay open/closed across rerenders.
  - No new UI state is introduced.
- **Validation**:
  - Add explicit truth coverage for embedded interpretation panel rerender preserving `<details>.open`
  - Add explicit truth coverage for standalone interpretation panel rerender preserving `<details>.open`

## Sprint 4: Severity-Driven Styling
**Goal**: Add secondary recommendation styling and severity emphasis while preserving the existing type-based tone language.
**Demo/Validation**:
- Recommendation lines appear visually secondary.
- Severity is visually distinguishable without overwhelming the panel.

### Task 4.1: Add Recommendation Text Styling
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add a dedicated recommendation text class with lower opacity, slightly smaller typography, and comfortable spacing under the main interpretation message.
- **Complexity**: 3/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Recommendation text is readable but clearly secondary.
  - Existing message typography remains primary.
- **Validation**:
  - Visual inspection
  - Markup/CSS class assertions if needed

### Task 4.2: Layer Severity Styling Without Replacing Type Tone
- **Location**: `rooms/laboratory/ui/lab-theme.css`, `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Introduce a separate `data-severity` styling layer:
  - `low` → subtle emphasis
  - `medium` → accent emphasis
  - `high` → warning/error emphasis
  Keep existing `data-tone` usage for `type`.
- **Complexity**: 5/10
- **Dependencies**: Tasks 3.1, 4.1
- **Acceptance Criteria**:
  - Severity styling does not collapse the semantic difference between `info`, `warning`, and `hint`.
  - CSS selectors remain scoped to interpretation items.
- **Validation**:
  - Render markup assertions for `data-severity`
  - Manual visual review

## Sprint 5: Regression Coverage and Final Verification
**Goal**: Prove the new interpretation layer remains deterministic, derived-only, and presentation-safe.
**Demo/Validation**:
- Rule engine emits recommendation and severity correctly.
- No store or runtime execution surfaces changed.

### Task 5.1: Extend Rule-Engine Truth Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests covering:
  - recommendation presence for each upgraded rule family
  - severity mapping per rule
  - repeated engine calls return stable output
- **Complexity**: 5/10
- **Dependencies**: Sprints 1–2
- **Acceptance Criteria**:
  - Tests assert ids plus recommendation/severity fields.
  - Deterministic output is checked with deep equality.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.2: Extend Render-Level Interpretation Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add or expand render assertions so the interpretation panel includes recommendation markup and severity attributes in both selection and no-selection paths.
- **Complexity**: 4/10
- **Dependencies**: Sprints 3–4
- **Acceptance Criteria**:
  - Panel markup includes recommendation line when expected.
  - Severity and type attributes are both present when expected.
  - Both embedded and standalone interpretation panels keep their `<details>.open` state across rerenders.
- **Validation**:
  - Targeted truth suite

### Task 5.3: Final Safety Sweep
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Verify this phase did not add execution hooks, store persistence, suggestion coupling, or run-controller dependencies.
- **Complexity**: 2/10
- **Dependencies**: Entire plan
- **Acceptance Criteria**:
  - No store writes for interpretation state.
  - No event emissions or clickable controls added to the interpretation panel.
  - No changes required in `lab-run-controller.ts`.
- **Validation**:
  - Diff review
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`

## Testing Strategy
- Start with targeted truth tests for engine and render output.
- Run `npm run rooms:typecheck` after model and engine updates.
- Run `npm run rooms:lint` after render/CSS changes.
- Run the Laboratory truth suite at minimum:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- If markup or selector drift is larger than expected, escalate to the broader Laboratory parity/regression pack.

## Potential Risks & Gotchas
- **Type vs severity drift**: Reusing `type` for severity styling would blur semantics. Mitigation: keep `data-tone` for `type` and add a separate `data-severity`.
- **Selection-less interpretation regression**: The current panel already supports audio-only guidance without a selection. Mitigation: explicitly test the no-selection path.
- **Recommendation tone becoming imperative**: Guidance copy could read like commands. Mitigation: phrase recommendations as advisory secondary text.
- **Output order instability**: Adding helper abstractions could accidentally change interpretation item order. Mitigation: preserve current push order and lock it with tests.
- **Overcoupling with suggestions**: `relatedAction` already exists, but this phase must not piggyback on suggestion execution. Mitigation: no new events, no buttons, no suggestion dispatch wiring.
- **Rerender behavior**: Expanding the panel markup could break preserved `<details>` open-state. Mitigation: verify existing diff-preservation still holds.
- **Standalone vs embedded divergence**: The panel exists in both selection-bound and no-selection paths. Mitigation: test `<details>` state preservation in both render variants, not only one.

## Rollback Plan
- Revert `LabInterpretationItem` to its previous shape.
- Remove recommendation/severity output from `lab-interpretation-engine.ts`.
- Remove recommendation/severity markup and styling from the interpretation panel.
- Revert truth tests to the Phase 3.1 interpretation contract.
- Rebuild/install the Laboratory room again if generated files were refreshed during implementation.
