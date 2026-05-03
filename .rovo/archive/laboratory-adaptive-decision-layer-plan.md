# Plan: Laboratory Adaptive Decision Layer

**Generated**: 2026-04-27
**Estimated Complexity**: Medium

## Overview
Introduce a selector-driven adaptive decision layer that uses the existing execution interpretation, goal evaluation, and session pattern signal to influence candidate and alternatives messaging without overriding any decision state.

The patch should be additive and small. `LabExecutionCandidate` gains two derived fields: `adaptiveDecisionHint` and `decisionPressure`. Candidate `summary` receives append-only text when the adaptive signal is meaningful. Alternatives reuse the same pure signal to make summary wording more directive for high pressure and more passive for low pressure.

No candidate auto-switching, no new dispatch events, no store fields, no persistence, no UI redesign, and no `lab-run-controller.ts` changes are allowed.

## Prerequisites
- The goal-aware evaluation layer exists and exposes `LabExecutionGoalEvaluation`.
- The session pattern layer exists and may attach `patternSignal` to active goal evaluation.
- Candidate and alternatives builders already receive `executionGoalEvaluation` and `executionResultInterpretation`.
- Current workspace contains unrelated dirty files; implementation must stage only intended Laboratory files.
- Current workflow is terminal/plain text based on `mode:status=terminal` and `whereami.effectiveMode=other-provider-cli`.

## Architecture Decision
Do not make alternatives read the final candidate output. Candidate derivation depends on alternatives, so that would create a selector cycle.

Instead, add a small shared pure helper:

- **Preferred location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Purpose**: derive `{ decisionPressure, adaptiveDecisionHint }` from:
  - `goalEvaluation?.patternSignal?.strength`
  - `goalEvaluation?.outcome`
  - `executionResultInterpretation?.alignment`
- **Type boundary**:
  - The helper must not import from `lab-selectors.ts`.
  - It should either own small structural input types or use model-layer types from `lab-types.ts`.
  - This avoids a runtime dependency cycle because selectors already import candidate and alternatives builders.
- **Consumers**:
  - `lab-execution-candidate.ts` appends hint and exposes fields.
  - `lab-execution-alternatives.ts` adjusts summary/comparison tone using the same pressure.

This keeps the layer deterministic, selector-driven, and isolated from store/runtime mutation.

## Sprint 1: Shared Adaptive Signal Contract
**Goal**: Add the derived signal type and pure mapping without changing existing behavior yet.
**Demo/Validation**:
- The helper can be tested directly.
- Same inputs always produce the same pressure and hint.
- Missing execution feedback produces low or neutral passive output without throwing.

### Task 1.1: Add Adaptive Decision Types
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabExecutionDecisionPressure = "low" | "medium" | "high"` and extend `LabExecutionCandidate` with required derived fields.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabExecutionCandidate.decisionPressure` is required and defaults to `"low"` when no adaptive pressure exists.
  - `LabExecutionCandidate.adaptiveDecisionHint` is required and defaults to `""` when no hint should be appended.
  - Existing candidate status/readiness/reflection fields remain unchanged.
  - No store, persistence, hydrate, or dispatch types are modified.
- **Validation**:
  - `npm run typecheck`.

### Task 1.2: Implement Pure Adaptive Helper
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Add a pure helper, for example `buildAdaptiveDecisionSignal(input)`, that accepts only interpretation and goal evaluation-like data.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Weak pattern plus failed goal returns `high`.
  - Weak pattern plus partial alignment returns `medium`.
  - Strong pattern plus successful goal returns `low`.
  - Failed goal plus deviating alignment returns `high`, even if pattern is neutral.
  - Mixed signals return `medium`.
  - Missing pattern signal is treated as neutral history, not as an automatic `low`; current failed/deviating evidence can still produce pressure.
  - No goal evaluation and no interpretation returns passive `low`.
  - The helper owns structural interpretation input typing or imports only model-layer types, never selector-layer types.
  - No randomness, date access, async, external calls, or state mutation.
- **Validation**:
  - Add direct helper tests in `scripts/tests/laboratory-execution-runtime-regressions.test.ts` or a nearby runtime regression file.

### Task 1.3: Define Hint Copy
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Keep hint strings deterministic and short.
- **Complexity**: 2/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - High pressure hint uses wording like `This path has historically underperformed under similar conditions.`
  - Medium pressure hint uses wording like `Alternative strategies may yield more stable results.`
  - Low pressure hint uses passive wording or an empty string, based on the least disruptive candidate summary behavior.
  - Hint is not localized in this phase because no UI redesign or new UI surface is requested.
- **Validation**:
  - Tests assert exact hint for high and medium pressure.

## Sprint 2: Candidate Integration
**Goal**: Expose adaptive decision fields and append hint text without changing candidate viability.
**Demo/Validation**:
- Candidate status remains exactly the same for the same upstream chain.
- Candidate summary gains one adaptive sentence only when the signal calls for it.
- Confidence logic remains as currently implemented by goal and pattern layers unless explicitly adjusted in a later phase.

### Task 2.1: Compute Signal In Candidate Builder
- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Import the shared helper and compute the adaptive signal inside `buildExecutionCandidate`.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Candidate output includes `decisionPressure`.
  - Candidate output includes `adaptiveDecisionHint`.
  - Signal computation uses only the already supplied `executionGoalEvaluation` and `executionResultInterpretation`.
  - `evaluateStatus`, `evaluateStructuralIntegrity`, and `hasMaterialAlternativePressure` are not changed.
- **Validation**:
  - Candidate regression proves status is unchanged before and after adaptive fields.

### Task 2.2: Append Hint To Candidate Summary
- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Replace the current `summary: buildSummary(status)` assignment with an append-only summary builder that includes the adaptive hint if present.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Original summary sentence remains first.
  - Adaptive hint is appended once.
  - Empty low-pressure hint does not add extra spacing or punctuation.
  - No notes or uncertainties are repurposed to carry the hint.
- **Validation**:
  - Regression asserts summary starts with the original structural summary.
  - Regression asserts exact appended hint for high pressure.

### Task 2.3: Guard Against Silent Overrides
- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add focused tests to prove the adaptive layer is advisory only.
- **Complexity**: 4/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - High pressure does not change `status`.
  - High pressure does not alter `structuralIntegrity`.
  - High pressure does not switch plan id, candidate id, or alternatives.
  - Low pressure does not erase existing goal or pattern confidence behavior.
- **Validation**:
  - Targeted runtime regression suite.

## Sprint 3: Alternatives Linkage
**Goal**: Make alternatives wording respond to the same decision pressure without adding structure or UI.
**Demo/Validation**:
- High pressure alternatives summary becomes directive.
- Low pressure alternatives remain passive backup routes.
- `alternatives[]` content, count, ordering, and relative advantages remain unchanged.

### Task 3.1: Reuse Adaptive Helper In Alternatives
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Import the shared helper and derive pressure from the same goal/interpretation inputs used by candidate.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No import from selectors.
  - No dependency on final candidate output.
  - No selector cycle is introduced.
  - Existing pattern/goal branches keep their structural precedence unless high pressure needs stronger wording.
- **Validation**:
  - Typecheck and runtime tests.

### Task 3.2: Adjust Summary And Comparison Tone
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Add small pressure-aware branches to `buildSummary` and optionally `buildComparisonNote`.
- **Complexity**: 4/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - High pressure summary is directive, for example `Adaptive decision pressure is high; alternatives should be evaluated before continuing this route.`
  - Medium pressure keeps comparative language.
  - Low pressure keeps alternatives passive.
  - Existing failed-goal and weak-pattern wording is not contradicted.
  - Directive wording remains advisory and does not imply automatic switching or execution.
  - `buildAlternatives(input)` output remains unchanged.
- **Validation**:
  - Regression asserts high pressure summary wording.
  - Regression guards against auto-switching language such as `switch`, `replace`, `execute`, `run`, or `apply` in high-pressure summaries.
  - Regression deep-compares `alternatives[]` before and after pressure-sensitive wording.

## Sprint 4: Regression And Safety Verification
**Goal**: Prove the layer is deterministic, additive, and isolated.
**Demo/Validation**:
- Targeted Laboratory runtime tests pass.
- Typecheck and lint pass.
- No persistence or UI drift appears.

### Task 4.1: Runtime Mapping Tests
- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add direct adaptive helper coverage and integrated candidate/alternatives cases.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - Weak pattern plus failed goal maps to high pressure.
  - Weak pattern plus partial alignment maps to medium pressure.
  - Strong pattern plus successful goal maps to low pressure.
  - Mixed signals map to medium pressure.
  - Repeated helper calls are deep-equal.
  - Integrated candidate fields match helper output.
  - Integrated alternatives tone responds to high and low pressure.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`

### Task 4.2: Persistence And UI Non-Regression Checks
- **Location**: `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`, UI regression files only if existing snapshots observe candidate summary
- **Description**: Confirm no new state/persistence/UI surface leaks from the derived fields.
- **Complexity**: 3/10
- **Dependencies**: Sprints 2-3
- **Acceptance Criteria**:
  - Persisted state does not include `adaptiveDecisionHint` or `decisionPressure` as stored UI/runtime fields.
  - Hydrate does not reconstruct an adaptive decision object from persistence.
  - No process panel output changes are introduced.
  - Timeline or existing candidate text tests are updated only if they already render candidate summary.
  - Keep this phase surgical: prefer one helper mapping test, two integrated candidate/alternatives tests, and small persistence negative assertions unless existing UI snapshots fail.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - Run UI regression files only if candidate summary render expectations change.

### Task 4.3: Final Verification
- **Location**: Project root
- **Description**: Run final local checks after implementation.
- **Complexity**: 3/10
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - `lab-run-controller.ts` remains untouched.
  - No store shape, reducer event, or persistence pipeline changes exist.
  - No UI panels, buttons, or action handlers are added.
  - Only intended Laboratory files and tests are staged.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `git diff --check`

## Testing Strategy
- Start with pure helper tests so the adaptive matrix is locked before integration.
- Add candidate integration tests that compare status, structural integrity, plan id, and candidate id against a pre-adaptive baseline.
- Add alternatives integration tests that deep-compare the alternatives array while allowing summary/comparison text to change.
- Run persistence checks because the new candidate fields are derived output and must not become stored state.
- Run UI regressions only if existing candidate rendering snapshots observe the appended summary.

## Potential Risks & Gotchas
- Alternatives cannot depend on final candidate output because candidate already depends on alternatives. Mitigation: shared pure helper.
- Adding required fields to `LabExecutionCandidate` may require updating test fixture literals. Mitigation: either make fields optional or update helper factories centrally.
- Required candidate fields should still stay derived-only. Mitigation: assign `"low"` and `""` defaults in the candidate builder and avoid reducer/store changes.
- High-pressure wording could accidentally sound like auto-switching. Mitigation: keep language advisory and avoid verbs like `switch`, `replace`, or `execute`.
- Candidate summary is rendered in existing surfaces. Mitigation: append short text only; no new layout or interaction.
- Pattern signal may be absent on first execution. Mitigation: helper treats missing pattern as neutral history while still honoring current failed/deviating evidence.
- Weak pattern plus successful current result is a mixed signal. Mitigation: map to medium, not high.
- Strong pattern plus failed current result is a mixed signal. Mitigation: map to medium or high only when alignment also deviates.
- Importing selector-local interpretation types can create a cycle. Mitigation: keep helper input structural or move shared interpretation type to the model layer.
- Existing confidence logic already uses goal and pattern. Mitigation: this phase should not add another confidence delta unless explicitly requested later.
- Dirty workspace has unrelated files. Mitigation: stage only the adaptive decision plan/implementation files when committing.
- The requested 100-150 LOC target is tight. Mitigation: avoid UI changes, avoid broad fixture rewrites, and limit tests to the smallest set that proves the contract.

## Rollback Plan
- Remove `lab-adaptive-decision.ts`.
- Remove `decisionPressure` and `adaptiveDecisionHint` from `LabExecutionCandidate`.
- Restore candidate summary assignment to `buildSummary(status)`.
- Remove pressure-aware branches from alternatives summary/comparison builders.
- Revert the adaptive helper and integration regression tests.
