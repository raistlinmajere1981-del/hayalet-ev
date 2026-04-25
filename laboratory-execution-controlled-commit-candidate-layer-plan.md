# Plan: Laboratory Phase 4.7 Execution Bridge Controlled Commit Candidate Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview

Phase 4.7 adds the final passive synthesis layer in the Laboratory execution-thinking chain:

Selection -> Suggestion -> Preview -> Intent -> Plan -> Simulation -> Readiness -> Payload Preview -> Reflection -> Alternatives -> Execution Candidate

The candidate layer answers whether the currently selected path is structurally coherent enough to be handed toward execution later. It does not execute, dispatch, queue, persist, or connect to `lab-run-controller.ts`. The implementation should mirror the existing Phase 4.6 alternatives pattern: model type, pure runtime builder, selector-derived resolution, view-model propagation, passive UI panel, styling, and regression coverage.

The current workspace already contains uncommitted Phase 4.6 alternatives work. This plan assumes that layer is the immediate upstream dependency and should be completed or kept intact before implementing this phase.

## Prerequisites

- Phase 4.6 alternatives source exists and passes validation.
- No changes are made to `rooms/laboratory/runtime/lab-run-controller.ts`.
- No execution queue, analysis runner, asset/export path, persistence, async, AI, fetch, random, DOM, or controller coupling is introduced.
- Workflow must be re-detected at implementation time with `npm run mode:status` and `npm run whereami`; use terminal/plain-text flow when those checks indicate terminal or other-provider CLI mode.
- Existing generated installed room copy under `data/rooms/laboratory` is updated only via `installFromWorkspace("laboratory")` after source changes.

## Sprint 1: Model And Pure Candidate Runtime

**Goal**: Define the candidate contract and add a deterministic runtime builder with no side effects.

**Demo/Validation**:
- The new type is available from `lab-types.ts`.
- The new runtime module can build `candidate:<plan.id>` from a complete resolved chain.
- Missing upstream objects return `null`.
- Guardrail grep shows no DOM, network, randomness, dispatch, or controller references.

### Task 1.1: Add candidate model type

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabExecutionCandidate` with stable identity, status, structural integrity, upstream status mirrors, notes, uncertainties, and confidence.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - `status` is exactly `"viable" | "unstable" | "not-viable"`.
  - `structuralIntegrity` is exactly `"complete" | "partial" | "insufficient"`.
  - `readinessStatus` reuses or matches readiness statuses.
  - `reflectionDecision` reuses or matches reflection decisions.
  - No store or persisted type is extended with a candidate field.
- **Validation**:
  - `npm run rooms:typecheck`
  - Targeted source grep for `LabExecutionCandidate`.

### Task 1.2: Add pure runtime candidate module

- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Add `buildExecutionCandidateFromResolved(input)` and optional internal helpers for status, structural integrity, notes, uncertainties, and confidence.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Input includes `executionPlan`, `executionSimulation`, `executionReadiness`, `executionPayloadPreview`, `executionReflection`, `executionAlternatives`, `activeSelection`, `inspectionMode`, and `sourceKind`.
  - Any missing upstream object returns `null`.
  - Any upstream `planId` mismatch returns `null` before synthesis; `executionSimulation.planId`, `executionReadiness.planId`, `executionPayloadPreview.planId`, `executionReflection.planId`, and `executionAlternatives.planId` must all match `executionPlan.id`.
  - Invalid selection range returns `null` or produces insufficient integrity only if all upstream objects still validly exist; prefer `null` for selector-chain invalidity consistency.
  - ID is exactly `candidate:${executionPlan.id}`.
  - No store, DOM, controller, network, async, Promise, Date, random, fetch, dispatch, emit, timer, animation frame, postMessage, navigator, or `lab-run-controller` usage.
- **Validation**:
  - Source grep:
    - `rg -n "async\\b|Promise\\b|Date\\.|new Date|Math\\.random|crypto\\.randomUUID|fetch\\(|XMLHttpRequest|document\\.|window\\.|navigator\\.|localStorage|sessionStorage|setTimeout|setInterval|queueMicrotask|requestAnimationFrame|postMessage|dispatch|emit\\(|lab-run-controller" rooms/laboratory/runtime/lab-execution-candidate.ts rooms/laboratory/runtime/lab-selectors.ts rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `npm run rooms:typecheck`

### Task 1.3: Implement structural integrity mapping

- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Evaluate selection validity, ROI validity when action requires ROI, payload completeness, plan coherence, and upstream status agreement.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `complete` when selection is valid, plan has steps and expected outputs, payload has action type, input, parameters, expected outputs, and upstream status is coherent.
  - Payload completeness is checked against the Phase 4.4 preview shape: `dryRunShape.previewInput`, `dryRunShape.previewParameters`, and non-empty `dryRunShape.previewExpectedOutputs`.
  - Payload coherence requires matching `planId`, matching or explainable `actionType`, and `readinessPassesPreview !== false` for a complete candidate.
  - `partial` when minor uncertainty exists, such as non-critical warnings, low confidence, review state, or material alternative pressure.
  - `insufficient` when selection is invalid, required ROI is absent/invalid for region-focused action, payload preview shape is empty/incomplete, plan has no steps, upstream `planId` values disagree, or readiness/reflection says blocked/avoid with critical gaps.
- **Validation**:
  - Runtime tests for each structural integrity branch.

### Task 1.4: Implement status mapping and narrative fields

- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Synthesize `viable`, `unstable`, or `not-viable` from readiness, reflection, simulation warnings, payload validity, and structural integrity.
- **Complexity**: 4
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - `viable` requires readiness `ready`, reflection `proceed`, valid payload preview, no critical warnings, and structural integrity `complete`.
  - Plain alternatives do not automatically make a candidate `unstable`; Phase 4.6 always produces alternatives, so only material alternative pressure counts.
  - Material alternative pressure means alternatives reveal meaningful divergence in the context of warnings, review/avoid decisions, blocked readiness, low confidence, or a high-impact tradeoff that directly contradicts the selected path.
  - `unstable` is used for readiness `needs-review`, reflection `review`, simulation warnings, material alternative pressure, low-to-medium confidence, or partial integrity.
  - `not-viable` is used for readiness `blocked`, reflection `avoid`, high risk, or insufficient integrity.
  - Summary is descriptive, not directive.
  - Notes and uncertainties explain structural state without telling the user to execute.
- **Validation**:
  - Runtime tests for status mapping and deterministic output.

## Sprint 2: Selector And View Model Integration

**Goal**: Make the candidate derived-only through the existing selector chain and expose it to timeline rendering without storing it.

**Demo/Validation**:
- `getActiveExecutionCandidate(state)` returns a candidate only when the full chain is complete.
- Persisted/hydrated state does not contain candidate data.
- The timeline model includes `activeExecutionCandidate`.

### Task 2.1: Add selector import and resolver

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Import the candidate type and builder, then add `getActiveExecutionCandidate(state)`.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Resolution chain calls existing selectors for plan, simulation, readiness, payload preview, reflection, and alternatives.
  - Any missing upstream returns `null`.
  - Any mismatched upstream `planId` returns `null`.
  - Preview-only, queued-only, stale intent, and invalid selection paths return `null` through the existing selector contract.
  - No store mutation or event emission is introduced.
- **Validation**:
  - Runtime selector tests.
  - `npm run rooms:typecheck`

### Task 2.2: Add view-model field

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**: Add `activeExecutionCandidate?: LabExecutionCandidate | null`.
- **Complexity**: 2
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Type import is added.
  - Existing optional pattern is preserved.
  - No UI state persistence is added.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.3: Populate timeline model

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `activeExecutionCandidate: getActiveExecutionCandidate(state)` to `getWaveformTimelineModel`.
- **Complexity**: 2
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Existing execution layer fields remain intact.
  - Candidate is computed after upstream selectors are available.
- **Validation**:
  - Runtime tests for model propagation.

## Sprint 3: Passive Candidate UI And Styling

**Goal**: Render a non-interactive execution candidate panel that communicates structural viability without using execution CTA language.

**Demo/Validation**:
- The panel appears only when a candidate exists and the active reflection chain is present.
- The panel contains status, integrity, readiness, reflection decision, notes, uncertainties, and confidence.
- No buttons, click handlers, dispatch, or forbidden execution words are present in the candidate panel.

### Task 3.1: Add render helper and gating

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Import `LabExecutionCandidate`, add formatting helpers, and render `data-lab-execution-candidate="true"` after alternatives.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Candidate panel is gated by a semantic selection, active reflection, active alternatives, and `activeExecutionCandidate`.
  - Panel title uses neutral language, such as `Execution candidate`.
  - Copy uses allowed language: `structurally ready`, `appears viable`, `may require refinement`, `not structurally suitable`.
  - Forbidden visible CTA words are avoided inside the panel: `Run`, `Execute`, `Apply`, `Start`, `Commit`.
  - No interactive elements are added.
- **Validation**:
  - UI source grep and render tests.

### Task 3.2: Add passive candidate styles

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add `.lab-execution-candidate*` styles that feel slightly more solid than reflection while remaining passive.
- **Complexity**: 3
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Visual hierarchy is clear but not CTA-like.
  - Status badges support viable, unstable, and not-viable.
  - Notes and uncertainties are readable and subdued.
  - No hover or pointer affordance suggests action.
- **Validation**:
  - UI render test snapshot/string checks.
  - Manual smoke through generated markup if needed.

## Sprint 4: Regression Tests And Install Sync

**Goal**: Prove the layer is deterministic, derived-only, passive, and included in the installed room copy.

**Demo/Validation**:
- Targeted runtime and UI suites pass.
- Full room validation passes.
- Installed copy is refreshed from workspace.
- Final sub-agent review confirms plan/implementation alignment before closing implementation.

### Task 4.1: Extend runtime regressions

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add helper fixtures and candidate-specific tests.
- **Complexity**: 6
- **Dependencies**: Sprints 1 and 2
- **Acceptance Criteria**:
  - Complete chain produces candidate.
  - Missing upstream returns `null`.
  - Mismatched upstream `planId` returns `null`.
  - Output is deterministic for identical input.
  - Stable ID is `candidate:${plan.id}`.
  - Status mapping covers viable, unstable, and not-viable.
  - Structural integrity mapping covers complete, partial, and insufficient.
  - Plain alternatives on an otherwise stable proceed/ready chain do not prevent `viable`.
  - Material alternative pressure can produce `unstable`.
  - Payload shape coverage includes empty `dryRunShape.previewInput`, empty `dryRunShape.previewParameters`, empty `dryRunShape.previewExpectedOutputs`, `readinessPassesPreview === false`, and action/plan mismatch behavior.
  - Persisted and hydrated state do not contain candidate fields.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.2: Extend UI regressions

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Add source and render tests for the candidate panel.
- **Complexity**: 4
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Panel renders only when candidate exists.
  - Preview-only and reflection-missing paths do not render the panel.
  - Forbidden execution words do not appear inside the extracted candidate panel markup.
  - Status, structural integrity, notes, uncertainties, and confidence can render.
  - No button, click-handler, or CTA-like affordance is introduced inside the candidate panel.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 4.3: Run full validation and refresh installed copy

- **Location**:
  - `rooms/laboratory`
  - `data/rooms/laboratory`
  - `config/rooms.json`
- **Description**: Run the required validation commands, then refresh the installed room copy from workspace.
- **Complexity**: 4
- **Dependencies**: Tasks 4.1 and 4.2
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:lint` passes.
  - `npm run rooms:build` passes.
  - `installFromWorkspace("laboratory")` succeeds.
  - Full regression suite passes.
  - Generated installed copy changes are source-derived.
- **Validation**:
  - `npm run rooms:test:core` or the repository's full room regression command currently used by the project.

### Task 4.4: Final guardrail and sub-agent review

- **Location**: Whole repository
- **Description**: Verify no forbidden coupling exists and ask a sub-agent to compare the implemented result against this plan.
- **Complexity**: 3
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - `git diff -- rooms/laboratory/runtime/lab-run-controller.ts` is empty.
  - Candidate runtime has no DOM/network/random/dispatch side-effect markers.
  - Sub-agent reports no blocking conformance issues, or any findings are fixed before final report.
- **Validation**:
  - Guardrail grep commands.
  - Sub-agent final review.

## Testing Strategy

- **Runtime truth regression**: Use `scripts/tests/laboratory-runtime-truth-regressions.test.ts` to verify pure candidate generation, selector null propagation, deterministic output, status/integrity mapping, and no persistence leakage.
- **UI evaluation regression**: Use `scripts/tests/laboratory-ui-evaluation-regressions.test.ts` to verify passive rendering, panel gating, forbidden CTA language absence, and no interaction affordances. Forbidden-word assertions should extract only the `data-lab-execution-candidate="true"` panel markup to avoid false positives from unrelated timeline controls.
- **Build-level validation**: Run `npm run rooms:typecheck`, `npm run rooms:lint`, and `npm run rooms:build`.
- **Installed-copy validation**: Run `installFromWorkspace("laboratory")` after source validation so `data/rooms/laboratory` is regenerated from source.
- **Full regression validation**: Run `npm run rooms:test:core` unless the project has a broader room suite available and current constraints allow it.

## Potential Risks & Gotchas

- **Risk**: The word `Commit` is part of the phase name, but the UI must not show it as an action.
  - **Mitigation**: Use `Execution candidate` and structural language in UI; keep phase-name wording only in docs/tests where appropriate.
- **Risk**: Candidate status could accidentally override reflection/readiness decisions.
  - **Mitigation**: Treat candidate as synthesis only. It mirrors upstream statuses and never writes state or blocks behavior.
- **Risk**: Meaningful alternatives could make every candidate `unstable`, even when the path is otherwise strong.
  - **Mitigation**: Only mark alternatives as uncertainty when they include meaningful divergence plus review/warning/low-confidence context, or when tradeoffs are material.
- **Risk**: Upstream objects could be manually combined with mismatched `planId` values in tests or future selectors.
  - **Mitigation**: Candidate builder must verify every upstream `planId` against `executionPlan.id` before producing an object.
- **Risk**: Payload preview validation could accidentally check the wrong shape.
  - **Mitigation**: Validate the actual Phase 4.4 fields: `dryRunShape.previewInput`, `dryRunShape.previewParameters`, `dryRunShape.previewExpectedOutputs`, and `readinessPassesPreview`.
- **Risk**: ROI requirements vary by action type.
  - **Mitigation**: Require ROI only for region-centered actions such as `focus-region`; do not penalize audio or broad segment actions for missing ROI.
- **Risk**: Payload completeness checks become too coupled to future real execution schemas.
  - **Mitigation**: Validate only the preview payload fields already defined in Phase 4.4, not any run-controller contract.
- **Risk**: Selector recomputation calls upstream selectors multiple times.
  - **Mitigation**: Keep logic simple for now; if needed, localize upstream values inside `getActiveExecutionCandidate` without adding memoization or store state.
- **Risk**: Dirty Phase 4.6 worktree changes make attribution unclear.
  - **Mitigation**: Implement 4.7 on top of 4.6, keep plan and implementation commits separate where possible, and avoid reverting existing changes.

## Rollback Plan

- Remove `rooms/laboratory/runtime/lab-execution-candidate.ts`.
- Remove `LabExecutionCandidate` from `rooms/laboratory/models/lab-types.ts`.
- Remove `getActiveExecutionCandidate` and timeline-model propagation from `rooms/laboratory/runtime/lab-selectors.ts`.
- Remove `activeExecutionCandidate` from `rooms/laboratory/ui/lab-waveform-timeline-types.ts`.
- Remove candidate render helper and render call from `rooms/laboratory/ui/lab-waveform-timeline-render.ts`.
- Remove `.lab-execution-candidate*` styles from `rooms/laboratory/ui/lab-theme.css`.
- Remove candidate-specific runtime/UI tests.
- Re-run typecheck, lint, build, targeted tests, and install sync to ensure the previous Phase 4.6 state remains healthy.
