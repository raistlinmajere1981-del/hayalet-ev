# Plan: Laboratory Session Pattern Awareness

**Generated**: 2026-04-26
**Estimated Complexity**: Medium

## Overview
Add a session-only pattern awareness layer to Laboratory execution feedback by keeping a small module-scope registry in `lab-selectors.ts`. The registry will observe completed execution results, group them by action type, coarse selection duration, and ROI presence, then feed a deterministic historical signal back into goal evaluation, candidate confidence, and alternatives tone.

The implementation remains selector-driven: no store fields, no dispatch events, no persistence, no async work, and no `lab-run-controller.ts` changes. The main engineering risk is selector side effects, so the plan makes recording idempotent by a stable sample identity before any confidence or summary changes are added.

## Prerequisites
- Existing goal-aware evaluation layer is present in `rooms/laboratory/runtime/lab-selectors.ts`.
- Candidate and alternatives builders already accept `executionGoalEvaluation`.
- Current uncommitted Laboratory goal-aware changes should be treated as the baseline for this phase.
- Workflow mode is terminal/plain text; no Rovo interaction payload is needed.

## Sprint 1: Registry Contract And Idempotent Observation
**Goal**: Create a deterministic in-memory registry that records each completed dispatch once.
**Demo/Validation**:
- Repeated calls to `getActiveExecutionGoalEvaluation(state)` for the same completed dispatch do not change registry counts.
- The first matching execution records history, and later similar executions can read it.

### Task 1.1: Define Pattern Key, Sample Identity, And Signal Helpers
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add local types and helpers for duration buckets, ROI presence, registry keys, stable result signatures, sample identities, and pattern signal classification.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Key format uses `actionType + durationBucket + roi/no-roi`.
  - Duration buckets are coarse and deterministic, for example `short < 1s`, `medium < 5s`, `long < 15s`, `extended >= 15s`.
  - Sample identity uses `dispatchId + stable result signature`, not dispatch id alone.
  - Pattern signal exposes execution count, average coverage, success ratio, failure ratio, and strength.
  - Success and failure ratios are computed from decisive outcomes only, with neutral outcomes counted in execution count but not in the decisive denominator.
- **Validation**:
  - Unit assertions in execution runtime regressions cover threshold buckets, ROI/no-ROI separation, neutral outcome ratio behavior, and two results with the same dispatch id but different stable result signatures.

### Task 1.2: Add Module-Scope Registry With Dispatch Dedupe
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add module-scope registry maps for aggregate stats and recorded sample ids. Recording must happen only when `getActiveExecutionRuntimeContext(state)` is valid and completed.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - No registry data is stored in `state.ui` or any persisted object.
  - A completed sample updates stats exactly once, even when selectors are called many times.
  - Re-running the same deterministic dispatch with a changed result records a distinct sample.
  - The augmented goal evaluation for a sample is cached by sample id, so repeated selector calls return stable text and stable pattern signal.
  - Stale dispatch ids and selection drift do not record anything because runtime context already returns `null`.
- **Validation**:
  - Regression test calls active selectors repeatedly and verifies the next similar execution sees one historical sample, not many.
  - Regression test completes the same dispatch id with a different result signature and verifies it can count as a new sample.

### Task 1.3: Append Pattern Note To Active Goal Evaluation
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Keep `getExecutionGoalEvaluation(result, actionType)` pure, then extend only `getActiveExecutionGoalEvaluation(state)` with pattern-aware summary text and an optional pattern signal.
- **Complexity**: 4/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Existing goal summary is preserved and the pattern note is appended.
  - First execution for a pattern does not claim historical evidence.
  - Weak history can append text like `Historically similar evaluations show low coverage`.
  - Strong history can append text like `Historically similar evaluations usually complete successfully`.
  - Pattern summary propagation into reflection, staging, and the existing process-panel goal line is intentional and covered by expectations.
- **Validation**:
  - Existing pure goal evaluation tests remain stable.
  - New active selector test verifies append-only summary behavior.
  - Existing UI/reflection tests are updated only where the augmented active summary is rendered.

## Sprint 2: Feedback Integration
**Goal**: Let pattern history softly influence existing candidate and alternatives outputs without changing structure or status rules.
**Demo/Validation**:
- Candidate confidence moves by a small additive amount.
- Alternatives summary changes tone when similar historical paths are weak or strong.

### Task 2.1: Add Optional Pattern Signal Type Surface
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add a small optional pattern signal field to `LabExecutionGoalEvaluation` so existing selector plumbing can carry the session signal without new store shape.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Optional field is absent from pure helper results unless active selector augments it.
  - No existing persisted type or store state gains a new field.
- **Validation**:
  - Typecheck passes and current goal evaluation deep-equality tests either remain unchanged or assert absence explicitly.

### Task 2.2: Bias Candidate Confidence Additively
- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Read `executionGoalEvaluation.patternSignal` and apply a small confidence delta after existing interpretation and goal outcome rules.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Strong pattern adds at most a small boost, for example `+0.02`.
  - Weak pattern subtracts at most a small penalty, for example `-0.03`.
  - Strength is derived from decisive success/failure ratio and average coverage, not from string-matching summary text.
  - Candidate `status`, structural integrity, notes, and uncertainty rules are unchanged.
- **Validation**:
  - Regression compares weak/strong seeded history against the same current result and verifies only confidence changes.

### Task 2.3: Refine Alternatives Tone With Pattern Strength
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Reuse the optional pattern signal to adjust summary/comparison copy while preserving alternative list structure.
- **Complexity**: 4/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Weak history strengthens alternatives language.
  - Strong history makes alternatives less assertive unless the current goal failed.
  - `alternatives[]` content, ordering, and count remain unchanged.
- **Validation**:
  - Regression checks summary/comparison wording for weak and strong history.

## Sprint 3: Regression Coverage And Safety Checks
**Goal**: Prove the layer is deterministic, session-only, and isolated from persistence.
**Demo/Validation**:
- Targeted Laboratory tests pass.
- Typecheck passes.
- Lint passes if touched files introduce lint-sensitive changes.

### Task 3.1: Add Test Reset Hook For Module-Scope Registry
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `scripts/tests/laboratory-runtime-truth.helpers.ts`
- **Description**: Add a test-only reset export so registry state does not leak between test cases.
- **Complexity**: 2/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Reset helper clears aggregate stats, recorded sample ids, and cached augmented evaluations.
  - Helper is used only by tests.
- **Validation**:
  - Runtime regression tests can run in any order without pattern-history flakes.

### Task 3.2: Extend Execution Runtime Regressions
- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add tests for deterministic recording, historical note append, ROI/key separation, and candidate/alternatives influence.
- **Complexity**: 5/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Similar second execution gets the expected pattern note.
  - ROI presence changes the key and does not reuse non-ROI history.
  - Repeated selector calls for one dispatch do not increase history count.
  - A changed result signature under the same dispatch id can be counted as a separate sample.
  - Boundary selections at exact bucket thresholds are assigned deterministically.
  - Neutral outcomes affect execution count and average coverage but not decisive success/failure ratios.
  - Candidate confidence and alternatives tone respond to weak/strong history.
- **Validation**:
  - Run the targeted execution runtime suite.

### Task 3.3: Extend Persistence Leak Guards
- **Location**: `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
- **Description**: Extend existing no-persistence assertions to include pattern registry and pattern signal names.
- **Complexity**: 2/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Persisted state does not contain pattern registry, pattern signal, or historical stats.
  - A fresh-session simulation via registry reset before hydrate does not reconstruct pattern history from persisted state.
  - After hydrate and registry reset, a similar completed execution behaves like the first sample and has no historical note.
- **Validation**:
  - Run targeted persistence regression suite.

## Testing Strategy
- Run targeted tests:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
- Run UI-adjacent tests only if rendered goal summary expectations change:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- Run `npm run typecheck`.
- Run `npm run lint` after the targeted suites because the change touches shared TypeScript modules.

## Potential Risks & Gotchas
- Selector side effects can inflate counts if recording is not deduped by sample identity. Mitigation: cache recorded sample ids and return the same augmented evaluation for the same sample.
- Dispatch ids are deterministic for plan/selection/staging and are not unique attempt ids. Mitigation: dedupe and cache by `dispatchId + stable result signature`.
- Pattern summary intentionally flows into reflection/staging/UI through the existing goal evaluation path. Mitigation: update rendered-output expectations without adding new UI sections.
- Pattern notes can become self-referential if the current result is included before summary generation. Mitigation: build the historical signal from prior stats, then record the current result.
- Candidate and alternatives could overreact to one sample. Mitigation: apply pattern strength only after at least two prior similar executions or keep one-sample influence neutral.
- Optional pattern fields can accidentally appear in pure helper outputs. Mitigation: keep augmentation inside `getActiveExecutionGoalEvaluation` only.
- Module-scope state can leak between tests. Mitigation: add a test-only reset helper and call it around new tests.
- Current dirty baseline includes prior goal-aware changes. Mitigation: implementation should avoid touching unrelated files and should not modify `config/rooms.json`.

## Rollback Plan
- Remove the module-scope registry helpers and test reset export from `lab-selectors.ts`.
- Remove the optional pattern signal type field from `LabExecutionGoalEvaluation`.
- Remove the confidence delta from `lab-execution-candidate.ts`.
- Remove pattern-aware wording branches from `lab-execution-alternatives.ts`.
- Revert the new or updated regression assertions for pattern awareness.
