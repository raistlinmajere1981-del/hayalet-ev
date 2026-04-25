# Plan: Laboratory Execution Reflection Decision Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview
Phase 4.5 adds a derived-only execution reflection layer to the existing Laboratory chain:

Selection -> Suggestion -> Preview -> Intent -> Plan -> Simulation -> Readiness -> Payload Preview -> Reflection

The reflection layer does not execute anything, dispatch work, enqueue jobs, persist state, or touch `lab-run-controller.ts`. It deterministically evaluates the existing dry-run payload path and produces a passive decision: `proceed`, `review`, or `avoid`.

The implementation should mirror the Phase 4.1-4.4 pattern:

- Add a small model type in `rooms/laboratory/models/lab-types.ts`.
- Add a pure runtime module in `rooms/laboratory/runtime/lab-execution-reflection.ts`.
- Add a selector in `rooms/laboratory/runtime/lab-selectors.ts`.
- Render a passive panel in `rooms/laboratory/ui/lab-waveform-timeline-render.ts`.
- Extend targeted runtime and UI regression tests.
- Refresh installed room copy through the room install/sync flow, not by treating `data/rooms/laboratory` as source.

## Prerequisites
- Existing Phase 4.1-4.4 files are present:
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
  - `rooms/laboratory/runtime/lab-execution-simulator.ts`
  - `rooms/laboratory/runtime/lab-execution-readiness.ts`
  - `rooms/laboratory/runtime/lab-execution-bridge.ts`
- `LabExecutionPayloadPreview` already exists and is selector-derived.
- Current active execution payload selector is `getActiveExecutionPayloadPreview(state)`.
- Implementation must preserve guardrails:
  - No `rooms/laboratory/runtime/lab-run-controller.ts` changes.
  - No analysis runner changes.
  - No queue, dispatch, asset/export, persistence, fetch, AI calls, randomness, or DOM access in runtime reflection.

## Sprint 1: Model And Pure Runtime
**Goal**: Define the reflection contract and implement deterministic decision generation without touching UI or store state.

**Demo/Validation**:
- Import the new runtime module in tests.
- Given fixed plan/simulation/readiness/payload inputs, it returns a stable `LabExecutionReflection`.
- Missing upstream data returns `null` through a resolved-input helper.

### Task 1.1: Add Reflection Model
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabExecutionReflection` near the existing execution-layer models.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Type includes `id`, `planId`, `summary`, `decision`, `reasoning`, optional `tradeoffs`, optional `alternatives`, optional `confidence`.
  - `decision` is exactly `"proceed" | "review" | "avoid"`.
  - No store schema fields are added.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Create Reflection Runtime Module
- **Location**: `rooms/laboratory/runtime/lab-execution-reflection.ts`
- **Description**: Add a pure deterministic builder that accepts:
  - `executionPlan`
  - `executionSimulation`
  - `executionReadiness`
  - `executionPayloadPreview`
  - `activeSelection`
  - `inspectionMode`
  - `sourceKind`
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Exports `buildExecutionReflection(input)`.
  - Exports `buildExecutionReflectionFromResolved(input)` that returns `null` if any upstream object is missing or the selection is invalid.
  - Structural invalidity means missing upstream objects, absent active selection, or `endMs <= startMs`; these cases do not produce a reflection.
  - Valid-but-weak context means an existing positive-duration selection with risky characteristics, such as too short a duration or too small an ROI; these cases produce `review` or `avoid`.
  - `id` is exactly `reflection:${executionPlan.id}`.
  - Uses no async, random, DOM, fetch, storage, events, or side effects.
  - Does not import store or UI modules.
- **Validation**:
  - Direct unit coverage in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`.

### Task 1.3: Encode Decision Rules
- **Location**: `rooms/laboratory/runtime/lab-execution-reflection.ts`
- **Description**: Implement decision mapping from readiness, simulation, payload preview, and selection context.
- **Complexity**: 5/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `proceed` when readiness is `ready`, simulation risk is `low`, payload preview passes readiness, and blockers are absent.
  - `review` when readiness is `needs-review`, simulation warnings exist, `executionPayloadPreview.readinessPassesPreview === false`, `executionPayloadPreview.readinessStatus === "needs-review"`, or confidence is moderate.
  - `avoid` when readiness is `blocked`, simulation risk is `high`, context is invalid/insufficient, or blockers are present.
  - `avoid` does not replace null propagation: missing upstream or non-positive selection duration still returns `null`; `avoid` is for valid selections whose context is too weak or risky to recommend.
  - Decision ordering is conservative: `avoid` outranks `review`, `review` outranks `proceed`.
  - Summary language stays advisory, not operational.
- **Validation**:
  - Tests cover ready/low-risk -> proceed, needs-review/warnings -> review, blocked/high-risk -> avoid.

### Task 1.4: Generate Reasoning, Tradeoffs, And Alternatives
- **Location**: `rooms/laboratory/runtime/lab-execution-reflection.ts`
- **Description**: Add deterministic explanation text for the decision.
- **Complexity**: 4/10
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - `reasoning` is always non-empty.
  - Readiness blockers and simulation warnings become reasoning entries.
  - `review` and `avoid` produce actionable alternatives such as:
    - `Expand selection range`
    - `Reduce playback rate`
    - `Refine ROI boundaries`
    - `Lower preview gain`
  - Tradeoffs explain passive consequences, not execution steps.
  - Output order is stable for identical input.
- **Validation**:
  - Determinism test asserts deep equality for repeated calls with identical input.

## Sprint 2: Selector Integration
**Goal**: Expose reflection through the same derived-only selector path used by plan, simulation, readiness, and payload preview.

**Demo/Validation**:
- Accepted suggestion with valid upstream chain returns reflection.
- Preview-only or queued-only suggestion returns `null`.
- Dismissing intent, changing selection, or invalidating upstream suggestions returns `null`.

### Task 2.1: Import Runtime Builder
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Import `buildExecutionReflectionFromResolved`.
- **Complexity**: 1/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Import stays runtime-only and does not create circular UI/store dependency.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.2: Add `getActiveExecutionReflection`
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add selector after `getActiveExecutionPayloadPreview(state)`.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Returns `null` if plan, simulation, readiness, payload preview, or active selection is missing.
  - Calls existing selectors for upstream values rather than re-implementing resolution.
  - Does not write state or emit events.
  - Uses `getInspectionMode(state)` and `getSourceKind(state)` as reflection context.
- **Validation**:
  - Runtime regression checks null propagation and valid reflection resolution.

### Task 2.3: Add Reflection To Timeline Model
- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add optional `activeExecutionReflection?: LabExecutionReflection | null` to the timeline model and populate it in `getWaveformTimelineModel`.
- **Complexity**: 2/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - UI model remains read-only/derived.
  - Missing reflection renders no panel.
- **Validation**:
  - UI rendering tests can pass the field explicitly.

## Sprint 3: Passive UI Panel
**Goal**: Render the reflection decision as an advisory layer without using execution language or affordances.

**Demo/Validation**:
- Timeline panel shows `Execution reflection`.
- It displays decision badge, summary, reasoning, alternatives, tradeoffs, and confidence.
- UI source contains no `Run`, `Execute`, `Apply`, or `Start` CTA for this panel.

### Task 3.1: Add Render Function
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add `renderExecutionReflection(reflection)` near the existing execution render helpers.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Renders nothing for `null`.
  - Adds `data-lab-execution-reflection="true"`.
  - Shows decision badge with `data-decision`.
  - Uses advisory copy:
    - `This path appears stable`
    - `This path may require additional review`
    - `This path is not recommended in its current form`
  - Escapes all dynamic text.
- **Validation**:
  - UI evaluation regression reads source and render output.

### Task 3.2: Place Panel In Execution Stack
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Render reflection after payload preview, because reflection evaluates the complete dry-run handoff shape.
- **Complexity**: 2/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Panel is visible only when `activeExecutionReflection` exists.
  - Existing plan/simulation/readiness/payload panels continue rendering unchanged.
  - No button or command event is introduced.
- **Validation**:
  - UI test asserts preview-only/queued-only states do not render reflection.

### Task 3.3: Add Reflection Styling
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add a compact technical/advisory visual treatment consistent with prior execution panels.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Decision badge has distinct proceed/review/avoid emphasis.
  - Styling is passive; no primary CTA styling.
  - Layout remains compact and readable in the existing preview panel.
- **Validation**:
  - Manual source inspection and UI render test for required class names.

## Sprint 4: Regression Coverage
**Goal**: Lock the layer as deterministic, derived-only, passive, and non-executing.

**Demo/Validation**:
- Targeted runtime and UI suites pass.
- Typecheck, lint, build, room install/sync, and core room tests pass.

### Task 4.1: Runtime Reflection Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Extend runtime regressions with direct builder and selector tests.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - `ready` + low risk -> `proceed`.
  - `needs-review` or warnings -> `review`.
  - `blocked` or high risk -> `avoid`.
  - Stable id is `reflection:${plan.id}`.
  - Repeated identical inputs produce deep-equal output.
  - Missing upstream values return `null`.
  - Preview-only and queued-only suggestion paths return `null`.
  - Accepted intent returns reflection.
  - Dismiss/selection change invalidates reflection through upstream null propagation.
  - Persisted/hydrated state does not contain reflection.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.2: UI Reflection Tests
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Extend UI regressions for panel source and render ownership.
- **Complexity**: 4/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Source contains `Execution reflection` and `data-lab-execution-reflection="true"`.
  - Render output includes decision badge and alternatives for review/avoid.
  - Missing reflection renders no panel.
  - Execution language checks reject CTA words:
    - `>Run<`
    - `>Execute<`
    - `>Apply<`
    - `Start execution`
  - The panel does not emit events or include command buttons.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 4.3: Guardrail And Full Validation
- **Location**: Repository root
- **Description**: Run focused and broad validation after implementation.
- **Complexity**: 4/10
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - `git diff -- rooms/laboratory/runtime/lab-run-controller.ts` is empty.
  - `rg "LabExecutionReflection|lab-execution-reflection|getActiveExecutionReflection" rooms/laboratory scripts/tests data/rooms/laboratory` shows only expected references.
  - `rg ">\\s*(Run|Execute|Apply)\\s*<|Start execution" rooms/laboratory/ui/lab-waveform-timeline-render.ts` confirms no new CTA language in reflection/payload panels without matching technical identifiers such as `dryRunShape`.
  - UI test files may contain these words only as negative assertions; do not treat those assertion strings as source-language failures.
  - Room installed copy is refreshed from source through the package manager.
- **Validation Commands**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - `npm run rooms:test:core`

## Testing Strategy
- Use direct runtime builder tests for deterministic decision logic.
- Use selector tests to ensure the whole chain remains derived-only and null-propagating.
- Use persistence/hydration tests to prove reflection does not leak into stored state.
- Use UI source checks to prevent accidental execution language.
- Use UI render ownership tests to prove the panel appears only from `activeExecutionReflection`.
- Run broad room validation only after targeted suites are green.

## Potential Risks & Gotchas
- **Risk**: Reflection duplicates readiness instead of evaluating the whole path.
  - **Mitigation**: Require payload preview and simulation as upstream inputs, and generate reasoning from all three layers.
- **Risk**: `proceed` sounds like an execution permission.
  - **Mitigation**: UI copy must say "path appears stable", not "run", "start", or "execute".
- **Risk**: Decision becomes a hidden gate.
  - **Mitigation**: Store no gate state, dispatch no events, and expose only a derived selector.
- **Risk**: High-risk simulation and `needs-review` readiness conflict.
  - **Mitigation**: Conservative precedence: `avoid` outranks `review`, `review` outranks `proceed`.
- **Risk**: Alternatives imply automatic actions.
  - **Mitigation**: Phrase alternatives as user guidance, e.g. "Reduce playback rate", not "System will reduce playback rate".
- **Risk**: Source and installed room copies drift.
  - **Mitigation**: Edit only `rooms/laboratory`, then refresh `data/rooms/laboratory` via room package install/sync during validation.
- **Risk**: Reflection confidence appears too authoritative.
  - **Mitigation**: Treat confidence as a passive assessment score derived from readiness/simulation confidence, clamped and displayed as advisory.

## Rollback Plan
- Remove `rooms/laboratory/runtime/lab-execution-reflection.ts`.
- Remove `LabExecutionReflection` from `rooms/laboratory/models/lab-types.ts`.
- Remove `getActiveExecutionReflection` import/selector/model field from `rooms/laboratory/runtime/lab-selectors.ts`.
- Remove `activeExecutionReflection` from `rooms/laboratory/ui/lab-waveform-timeline-types.ts`.
- Remove reflection render function, render call, and styles.
- Remove reflection-specific test cases.
- Refresh installed room copy from source after rollback if implementation had already synced it.

## Implementation Notes For The Next AI
- This is the first layer that "decides", but it must remain passive and advisory.
- Do not add accept/reject/confirm buttons in this phase.
- Do not map reflection to a queue, runner, or command contract.
- Keep the runtime module small and boring; the interesting part is the conservative decision precedence and clear reasoning text.
- The correct mental model is: "The system reflects on whether its own dry-run path looks stable", not "The system authorizes execution."
