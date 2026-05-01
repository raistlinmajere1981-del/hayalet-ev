# Plan: Laboratory Counterfactual Outcome Projection

**Generated**: 2026-04-27
**Estimated Complexity**: Medium

## Overview
Add a deterministic counterfactual outcome projection layer for guided alternatives. When execution feedback exists, Laboratory will estimate what a chosen alternative is expected to change in coverage, alignment, and stability, then append that projection to alternatives guidance and, under high pressure, optionally echo it in the candidate hint.

The implementation remains selector-driven and additive. No store fields, no async work, no execution flow changes, no new events, no persistence, and no mutation of the existing alternatives structure are allowed. Counterfactuals are derived locally from the current completed execution context plus the existing guided-alternative signal.

## Prerequisites
- Guided alternative activation already exists in `rooms/laboratory/runtime/lab-adaptive-decision.ts`.
- `getActiveExecutionResult(state)`, `getActiveExecutionGoalEvaluation(state)`, and `getActiveExecutionResultInterpretation(state)` already exist in `rooms/laboratory/runtime/lab-selectors.ts`.
- Current alternatives/candidate builders do not yet receive the active execution result directly.
- Current workspace is clean except for `config/rooms.json`; implementation should avoid touching unrelated files.
- Current workflow is terminal/plain text based on `mode:status=terminal` and `whereami.effectiveMode=other-provider-cli`.

## Architecture Decision
Do not persist or globally expose projections. Also avoid making pre-execution base selectors render counterfactual text.

Preferred design:
- Extend `rooms/laboratory/runtime/lab-adaptive-decision.ts` with:
  - `buildCounterfactualProjection(alternative, context)`
  - a small local output type for projection state
- Keep projection typing local to the helper unless a model-layer type is clearly needed.
- Thread the active execution result only through the public post-execution selector path:
  - `getActiveExecutionAlternatives(state)`
  - `getActiveExecutionCandidate(state)`
- Do not pass the active result into `getBaseActiveExecutionAlternatives` or `getBaseActiveExecutionCandidate`.
- Reuse the already derived preferred alternative identity via `preferredAlternativeIndex`, then read the alternative from `alternatives[]`; label remains display copy only.
- Treat both `pre-execution` and `running-but-not-completed` states as projection-disabled.

This keeps pre-execution surfaces stable, avoids selector cycles, and confines projection copy to completed-execution feedback paths.

## Sprint 1: Pure Projection Helper
**Goal**: Add a deterministic helper that projects how one alternative would likely change the current outcome.
**Demo/Validation**:
- Helper returns the same output for the same alternative and context.
- No execution result or low-signal context yields neutral or empty projection behavior.

### Task 1.1: Define Local Projection Types
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Add a local counterfactual projection type and context type for deterministic projections.
- **Complexity**: 2/10
- **Dependencies**: Existing guided helper
- **Acceptance Criteria**:
  - Output includes:
    - `expectedCoverage: "increase" | "decrease" | "stable"`
    - `expectedAlignment: "better" | "worse" | "similar"`
    - `expectedStability: "higher" | "lower" | "similar"`
    - `summary: string`
  - Context includes:
    - current execution result
    - goal evaluation
    - pattern signal via goal evaluation
    - interpretation
  - Types remain local unless a shared type is clearly required.
- **Validation**:
  - `npm run typecheck`

### Task 1.2: Implement Deterministic Projection Rules
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Map `alternative.relativeAdvantage` plus execution feedback into projected coverage/alignment/stability outcomes.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - High pressure plus failed goal biases toward `expectedStability: "higher"` and `expectedAlignment: "better"` for safer alternatives.
  - Weak pattern biases `lower-risk`, `more-stable`, and `higher-coverage` alternatives toward safer projections.
  - Deviating alignment biases alternatives toward `expectedAlignment: "better"` when they are `more-stable` or `higher-coverage`.
  - `higher-precision` can improve alignment while leaving stability similar unless the surrounding context is already unstable.
  - Low-signal or mixed contexts can return more neutral outputs such as `stable`, `similar`, `similar`.
  - No randomness, no timestamps, no external state, no mutation.
- **Validation**:
  - Direct helper tests cover failed/high-pressure, weak-pattern, deviating-alignment, and neutral scenarios.

### Task 1.3: Define Projection Summary Copy
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Convert the projected coverage/alignment/stability tuple into a short advisory summary string.
- **Complexity**: 2/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Summary is short and deterministic.
  - High-pressure failed-goal cases emphasize better alignment or higher stability.
  - Copy stays advisory and avoids action language such as `commit`, `execute`, `switch`, `apply`.
  - Empty or neutral conditions may return an empty string if no useful projection exists.
- **Validation**:
  - Tests guard against banned action verbs and assert exact copy for at least one strong scenario.

## Sprint 2: Post-Execution Context Threading
**Goal**: Make the current execution result available only where counterfactual feedback is valid.
**Demo/Validation**:
- Public post-execution selectors can build projections.
- Pre-execution base selectors remain unchanged and do not emit projection text.

### Task 2.1: Extend Resolved Builder Inputs With Optional Execution Result
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`, `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Add optional `executionResult` input to the resolved input types and builder inputs used only for post-execution feedback.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `executionResult` is optional and nullable.
  - No store type changes are required.
  - Builders still return stable pre-execution results when `executionResult` is absent.
- **Validation**:
  - Runtime tests confirm existing pre-execution scenarios are unchanged.

### Task 2.2: Pass Active Result Only Through Public Selectors
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Thread `getActiveExecutionResult(state)` into `getActiveExecutionAlternatives(state)` and `getActiveExecutionCandidate(state)` only.
- **Complexity**: 4/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `getBaseActiveExecutionAlternatives` and `getBaseActiveExecutionCandidate` do not receive `executionResult`.
  - Counterfactual projection is unavailable before a completed execution result exists.
  - Counterfactual projection is unavailable while execution is `running` and `getActiveExecutionResult(state)` is still `null`.
  - Existing selector identity gating for completed execution remains intact.
- **Validation**:
  - Runtime regression asserts review/avoid pre-execution alternatives still do not render preferred/projection copy.
  - Runtime regression asserts “dispatched but not completed” alternatives/candidate surfaces do not render projection copy.

## Sprint 3: Alternatives And Candidate Integration
**Goal**: Append counterfactual projection where it adds value, without changing structure or flow.
**Demo/Validation**:
- Alternatives summary includes projected outcome text for the preferred alternative after execution feedback exists.
- Candidate hint optionally echoes the same projection only under high pressure.

### Task 3.1: Append Projection Summary To Alternatives Guidance
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Once guided alternative selection exists and the active result is present, resolve the preferred alternative by `preferredAlternativeIndex`, build one shared projection object for that alternative, and append its summary to alternatives guidance.
- **Complexity**: 4/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Alternatives array order, count, and item contents remain unchanged.
  - Projection summary is appended only when a preferred alternative index resolves and current execution result exists.
  - Low-pressure or pre-execution paths keep the current summary behavior.
  - Summary text remains additive and idempotent.
- **Validation**:
  - Runtime regression deep-compares `alternatives[]` while asserting summary includes projection text only in the intended completed-execution cases.

### Task 3.2: Optionally Echo Projection In High-Pressure Candidate Hint
- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Under high pressure, append the same shared projection object’s summary or a deterministic shortened phrase into the candidate adaptive hint.
- **Complexity**: 3/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Hint is appended only for high pressure and completed execution feedback.
  - Medium pressure may keep the existing guidance-only hint.
  - Candidate `status`, `structuralIntegrity`, `confidence`, `planId`, and execution flow are unchanged.
  - Hint remains advisory and avoids auto-action wording.
- **Validation**:
  - Runtime regression asserts high-pressure candidate hint includes projection semantics while status and structural fields stay unchanged.
  - Runtime regression asserts candidate and alternatives agree on the same projected directions, not only the same preferred alternative label.

### Task 3.3: Keep Guidance And Projection Copy From Duplicating Each Other
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`, `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Ensure preferred-alternative guidance text and projection text do not append the same sentence twice.
- **Complexity**: 2/10
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - Summary and hint remain readable, not repetitive.
  - Repeated selector calls produce deep-equal outputs.
  - Existing append helpers remain idempotent.
- **Validation**:
  - Runtime regression invokes the same selector multiple times and deep-compares the result.

## Sprint 4: Regression Coverage And Verification
**Goal**: Prove projection logic is deterministic, post-execution-only, and non-persistent.
**Demo/Validation**:
- Targeted runtime and persistence tests pass.
- Typecheck and lint pass.
- No store, UI, or execution flow drift appears.

### Task 4.1: Helper And Integration Runtime Tests
- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`, `scripts/tests/laboratory-runtime-truth.helpers.ts`
- **Description**: Export the new helper if needed and add focused projection scenarios.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - High-pressure failed-goal case projects better alignment and higher stability for the safer preferred alternative.
  - Weak pattern biases toward safer projections.
  - Deviating alignment projects better alignment for the relevant alternative types.
  - Low-signal or low-pressure cases keep neutral or empty projection summaries.
  - Pre-execution review/avoid chains still do not render projection or preferred wording.
  - Running-but-not-completed chains still do not render projection copy.
  - Candidate and alternatives surfaces remain aligned on the same preferred alternative and the same projected direction tuple.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`

### Task 4.2: Persistence And Non-Regression Checks
- **Location**: `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
- **Description**: Add minimal negative assertions only if new projection field names could accidentally leak.
- **Complexity**: 2/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - No `counterfactualProjection`, `expectedCoverage`, `expectedAlignment`, or `expectedStability` key is persisted.
  - No UI panels, buttons, actions, or dispatch behavior changes appear.
  - UI regressions are only rerun if copy assertions require it.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - Run UI regressions only if rendered text assertions change.

### Task 4.3: Final Verification
- **Location**: Project root
- **Description**: Run final checks after implementation.
- **Complexity**: 3/10
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - No `lab-run-controller.ts` changes.
  - No reducer/store/hydrate/event changes.
  - No alternatives array mutation or reorder.
  - Only intended Laboratory files and tests are staged.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `git diff --check`

## Testing Strategy
- Start with pure projection helper tests because they lock the deterministic mapping cleanly.
- Add post-execution integration tests in alternatives and candidate builders using the same completed execution scenario.
- Keep pre-execution regression checks explicit so review/avoid surfaces remain unchanged.
- Add persistence negative assertions only for names that could plausibly leak.
- Rerun UI regressions only if counterfactual copy is surfaced in already-rendered summaries.

## Potential Risks & Gotchas
- Current builders do not receive the active execution result. Mitigation: thread `executionResult` only through public post-execution selectors, not base selectors.
- Public selectors stay live during the `running` window before completion. Mitigation: add explicit negative regressions for “dispatched but not completed” so projection copy cannot leak early.
- Candidate depends on alternatives, so alternatives must not depend on candidate output. Mitigation: compute counterfactuals through a shared pure helper.
- Projection copy can easily become repetitive with existing guidance copy. Mitigation: append only when the summary string is distinct and useful.
- The request mentions current execution result in helper context; pre-execution surfaces do not have one. Mitigation: treat missing result as “no projection”, not as an inferred fallback.
- Existing tests explicitly assert no `preferred` text in pre-execution review/avoid alternatives. Mitigation: preserve those cases and limit projection to completed execution feedback paths.
- Preferred alternative display labels are not the strongest identity seam. Mitigation: resolve projections by `preferredAlternativeIndex` and use the label only for rendered copy.
- High-pressure phrasing can accidentally imply execution changes. Mitigation: regression guards against `switch`, `commit`, `dispatch`, `execute`, `run`, `apply`, `select`, or `activate`.
- The requested patch target is small. Mitigation: keep projection types local, avoid model/store changes, and reuse current guided helper seams.

## Rollback Plan
- Remove `buildCounterfactualProjection` and its local types from `lab-adaptive-decision.ts`.
- Remove optional `executionResult` threading from alternatives/candidate builders and selectors.
- Restore alternatives summary and candidate hint logic to guided-alternative behavior only.
- Revert the added counterfactual runtime and persistence regression assertions.
