# Plan: Laboratory Guided Alternative Activation

**Generated**: 2026-04-27
**Estimated Complexity**: Medium

## Overview
Add guided alternative activation on top of the existing adaptive decision layer. Under high or medium decision pressure, Laboratory will identify a deterministic preferred alternative and mention it in advisory text, while preserving the current candidate, alternatives list, dispatch flow, and commitment rules.

The implementation stays selector-driven and additive. No store fields, dispatch events, persistence, UI redesign, auto-commit, auto-execution, or alternative list mutation are allowed. “Preferred alternative” is a derived local signal, not a globally stored selection.

## Prerequisites
- Existing adaptive decision layer is present in `rooms/laboratory/runtime/lab-adaptive-decision.ts`.
- Candidate builder already receives `executionAlternatives`.
- Alternatives builder already computes `decisionPressure` through the adaptive helper.
- Existing `LabExecutionAlternatives.confidence` is available only as overall alternatives confidence; alternatives do not currently have per-item confidence.
- Current workspace is dirty; implementation must stage only the guided alternative files.
- Current workflow is terminal/plain text based on `mode:status=terminal` and `whereami.effectiveMode=other-provider-cli`.

## Architecture Decision
Do not make any selector or reducer own a preferred alternative. Also avoid making candidate depend on a mutated alternatives shape.

Preferred design:
- Extend `lab-adaptive-decision.ts` with a pure helper, for example `buildGuidedAlternativeSignal(input)`.
- Input includes:
  - `decisionPressure`
  - `goalEvaluation?.patternSignal?.strength`
  - `goalEvaluation?.outcome`
  - `executionResultInterpretation?.alignment`
  - `alternatives`
  - `alternativesConfidence` as an overall guidance gate/intensity signal, not per-item ranking confidence
- Output includes a local derived object:
  - `preferredAlternativeIndex: number | null`
  - `preferredAlternativeLabel: string | null`
  - `guidanceText: string`
- `lab-execution-alternatives.ts` uses this helper while building summary/comparison text.
- `lab-execution-candidate.ts` uses the same helper against `input.executionAlternatives.alternatives` to enrich `adaptiveDecisionHint`.

This keeps the guidance deterministic and avoids selector cycles, persistence, and hidden switching.

## Sprint 1: Pure Guidance Helper
**Goal**: Derive a preferred alternative locally without changing runtime state or alternative ordering.
**Demo/Validation**:
- Helper returns the same preferred index for the same inputs.
- Helper returns `null` when pressure is low or no alternatives exist.
- Alternatives array is not mutated.

### Task 1.1: Add Guided Alternative Types
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Add structural input/output types for guided alternative selection without importing selectors.
- **Complexity**: 2/10
- **Dependencies**: Existing adaptive helper
- **Acceptance Criteria**:
  - Output includes `preferredAlternativeIndex`, `preferredAlternativeLabel`, and `guidanceText`.
  - No model/store type change is required unless TypeScript ergonomics strongly justify it.
  - Helper imports only model-layer types or owns structural types.
  - No external state, dates, timers, randomness, or async.
- **Validation**:
  - `npm run typecheck`

### Task 1.2: Implement Deterministic Alternative Ranking
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Rank existing alternatives with a tiny deterministic score based on pressure context and alternative metadata.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - High pressure prefers lower-risk or more-stable alternatives first.
  - Weak pattern or failed goal boosts `lower-risk`, `higher-coverage`, and `more-stable`.
  - Deviating or partial alignment boosts `more-stable` and `higher-coverage`.
  - Overall alternatives confidence can adjust guidance intensity or gate very weak guidance; it must not be treated as per-alternative confidence.
  - Ties resolve by original array index.
  - Low pressure returns no preferred alternative.
  - The original `alternatives[]` array and items are never mutated.
- **Validation**:
  - Direct helper tests cover high pressure, medium pressure, low pressure, empty alternatives, and tie-by-index.

### Task 1.3: Define Guidance Copy
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Produce short advisory text from pressure plus preferred label.
- **Complexity**: 2/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - High pressure text can say `A more stable alternative under current conditions is: {label}`.
  - Medium pressure text can say `A softer alternative to compare next is: {label}`.
  - Low pressure text is empty.
  - Copy must not imply automatic selection, commitment, execution, or dispatch.
- **Validation**:
  - Tests guard against banned auto-action language such as `auto`, `commit`, `dispatch`, `execute`, `run`, `apply`, `switch`, `select`, `activate`, and `choose`.

## Sprint 2: Alternatives Guidance Integration
**Goal**: Mention the preferred alternative inside alternatives text without changing alternatives structure.
**Demo/Validation**:
- High pressure summary includes the preferred label.
- Medium pressure summary includes softer guidance.
- Low pressure summary stays unchanged.
- `alternatives[]` deep equality remains stable.

### Task 2.1: Compute Preferred Alternative In Alternatives Builder
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Use the guided helper after `buildAlternatives(input)` is available and after the same final alternatives confidence value is computed, then pass the local signal into summary/comparison builders.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Summary can reference the preferred alternative label.
  - No `preferredAlternative` field is required on `LabExecutionAlternatives`.
  - Alternatives array order, count, labels, action types, tradeoffs, and relative advantages stay unchanged.
  - Existing high-pressure summary remains advisory but becomes label-aware.
  - `buildExecutionAlternatives` computes `const alternatives = buildAlternatives(input)` and `const confidence = buildConfidence(input, alternatives.length)` before summary/comparison guidance, then returns that same `confidence`.
  - Guidance must not duplicate confidence logic separately inside summary/comparison builders.
- **Validation**:
  - Regression deep-compares `alternatives[]` before and after guidance.

### Task 2.2: Preserve Low-Pressure Behavior
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Ensure low pressure continues through the current summary branches without new guidance text.
- **Complexity**: 2/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Strong pattern plus successful goal does not mention a preferred alternative.
  - Existing passive backup wording remains intact.
  - No existing no-preferred tests are broken except where high/medium pressure intentionally adds guidance.
- **Validation**:
  - Runtime regression asserts low-pressure summary does not contain `more stable alternative` or preferred label text.

## Sprint 3: Candidate Hint Integration
**Goal**: Let the candidate adaptive hint reference the preferred alternative without changing candidate status or execution flow.
**Demo/Validation**:
- High-pressure candidate hint references the selected alternative label.
- Candidate status, structural integrity, plan id, and confidence behavior remain unchanged.

### Task 3.1: Enrich Candidate Adaptive Hint
- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Use the guided helper with `input.executionAlternatives.alternatives` and append label-aware guidance to the existing adaptive hint.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - High pressure hint includes text like `Consider comparing {alternativeLabel} for better stability`.
  - Wording must avoid `switching` unless tests explicitly accept it as non-automatic; safer wording is `comparing`.
  - Medium pressure may include softer comparison guidance.
  - Low pressure keeps the current empty hint.
  - `evaluateStatus`, `evaluateStructuralIntegrity`, `buildConfidence`, commitment, staging, and dispatch logic are unchanged.
- **Validation**:
  - Candidate regression asserts high-pressure hint includes preferred label.
  - Regression asserts status and structural fields are unchanged.

### Task 3.2: Avoid Duplicate Guidance
- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Keep summary append logic idempotent when the same selector is evaluated repeatedly.
- **Complexity**: 2/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Candidate summary contains the preferred label at most once.
  - Repeated selector calls produce deep-equal candidate output.
  - No notes or uncertainties are repurposed to carry preference guidance.
- **Validation**:
  - Runtime regression calls candidate selector twice and deep-compares relevant fields.

## Sprint 4: Safety And Regression Coverage
**Goal**: Prove guided activation is advisory, deterministic, and non-persistent.
**Demo/Validation**:
- Targeted Laboratory tests pass.
- Typecheck and lint pass.
- No store/UI/event/run-controller changes are present.

### Task 4.1: Runtime Regression Tests
- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`, `scripts/tests/laboratory-runtime-truth.helpers.ts`
- **Description**: Export helper if needed and add focused tests for preferred alternative selection and integration.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - High pressure selects the expected lower-risk or more-stable alternative.
  - Medium pressure emits soft suggestion.
  - Low pressure emits no preferred guidance.
  - Ties resolve by index.
  - Empty alternatives return no preferred alternative.
  - Candidate and alternatives integration agree on the same label.
  - `alternatives[]` deep equality proves list/order unchanged.
  - No auto-action wording appears, including `switch`, `select`, `activate`, `choose`, `commit`, `dispatch`, `execute`, `run`, or `apply`.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`

### Task 4.2: Persistence And UI Non-Regression
- **Location**: `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
- **Description**: Add minimal negative assertions only if a named derived field is introduced.
- **Complexity**: 2/10
- **Dependencies**: Sprints 2-3
- **Acceptance Criteria**:
  - No `preferredAlternative`, `preferredAlternativeIndex`, or `preferredAlternativeLabel` key is written to persisted state.
  - No process panel, button, action handler, or new UI section is added.
  - UI regression files are touched only if existing rendered candidate/alternative text expectations require updates.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - Run UI regressions only if rendered text assertions change.

### Task 4.3: Final Verification
- **Location**: Project root
- **Description**: Run final checks after implementation.
- **Complexity**: 3/10
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - `lab-run-controller.ts` has no diff.
  - No reducer/store/action/hydrate changes exist.
  - No alternative list mutation exists.
  - Only intended Laboratory files and tests are staged.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `git diff --check`

## Testing Strategy
- Start with pure helper tests because selection ranking must be deterministic and easy to reason about.
- Add integration tests in alternatives and candidate builders using the same scenario, then assert both mention the same preferred label.
- Deep-compare `alternatives[]` to prove guidance did not reorder or mutate alternatives.
- Add persistence negative assertions only for field names that could otherwise leak.
- Run UI regressions only if existing candidate or alternatives copy assertions fail.

## Potential Risks & Gotchas
- Candidate depends on alternatives, so alternatives must not depend on candidate output. Mitigation: compute guidance through a shared pure helper in both places.
- The user example says `Consider switching to {alternativeLabel}` but constraints say no auto-switching. Mitigation: prefer safer advisory copy such as `Consider comparing {label}` or `A more stable alternative...`.
- Existing tests may assert no `preferred` text under pre-execution alternatives. Mitigation: guidance should appear only under medium/high adaptive pressure after execution feedback exists.
- `LabExecutionAlternatives.confidence` is overall confidence, not per-alternative confidence. Mitigation: use it only as guidance intensity/gating, while item ranking comes from `relativeAdvantage` and stable index.
- Alternatives confidence is currently returned after summary/comparison construction. Mitigation: compute `confidence` before guidance text and return the same value to avoid duplicated confidence logic.
- Adding a `preferredAlternative` field to `LabExecutionAlternatives` could look like structure drift. Mitigation: keep it local unless implementation proves a field is necessary.
- High-pressure wording can accidentally imply command execution. Mitigation: regression guard for banned action verbs.
- Dirty workspace includes unrelated files. Mitigation: stage only guided alternative implementation files.
- The requested ~100 LOC patch is tight. Mitigation: avoid UI changes, avoid new model fields, and keep tests focused.

## Rollback Plan
- Remove guided helper additions from `lab-adaptive-decision.ts`.
- Restore alternatives summary/comparison builders to pressure-only wording.
- Restore candidate adaptive hint to pressure-only wording.
- Remove guided alternative regression tests and persistence negative assertions.
