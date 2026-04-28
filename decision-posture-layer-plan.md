# Plan: Laboratory Decision Posture Layer

**Generated**: 2026-04-27
**Estimated Complexity**: Low

## Overview
Introduce a selector-driven Decision Posture helper that compresses goal outcome, pattern strength, result alignment, and existing decision pressure into one deterministic directional cue. The patch should live beside the existing adaptive decision helpers, then prepend a short posture label to candidate and alternatives summaries without changing store state, execution flow, candidate status, or persisted data.

## Prerequisites
- Existing adaptive decision helpers in `rooms/laboratory/runtime/lab-adaptive-decision.ts`.
- Existing candidate and alternatives summary builders in `rooms/laboratory/runtime/lab-execution-candidate.ts` and `rooms/laboratory/runtime/lab-execution-alternatives.ts`.
- Runtime regression helpers in `scripts/tests/laboratory-runtime-truth.helpers.ts`.
- Targeted regression suites:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `npm run typecheck`

## Sprint 1: Pure Posture Helper
**Goal**: Add a deterministic posture mapping that can be tested without store or UI involvement.
**Demo/Validation**:
- Direct helper tests prove the mapping is stable.
- Missing or incomplete input returns `proceed-with-caution`.

### Task 1.1: Add Decision Posture Types
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Add `LabDecisionPosture` and `LabDecisionPostureSignal` types with `posture` and `shortLabel`.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - Posture union is exactly `"proceed" | "proceed-with-caution" | "reconsider"`.
  - Short labels are exact literals: `Proceed`, `Proceed with caution`, and `Reconsider`.
  - Prefix formatting uses exact punctuation: `${shortLabel}: ${summary}`.
- **Validation**:
  - Typecheck validates all exports and imports.

### Task 1.2: Implement `buildDecisionPosture(context)`
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Build a pure helper that maps `goalEvaluation.outcome`, `patternSignal.strength`, `interpretation.alignment`, and the already-computed `decisionPressure` from `buildAdaptiveDecisionSignal` to one posture.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Callers pass `decisionPressure`; the posture helper does not re-derive adaptive pressure internally.
  - Strong pattern + successful goal + `matches-simulation` + low pressure returns `proceed`.
  - Failed goal + weak pattern + `deviates` alignment returns `reconsider`.
  - Missing goal, pattern, or interpretation context returns `proceed-with-caution` even if pressure is low.
  - All other mixed or partial signals return `proceed-with-caution`.
  - Helper has no randomness, async, store access, or side effects.
- **Validation**:
  - Add direct helper assertions to `scripts/tests/laboratory-execution-runtime-regressions.test.ts`.

### Task 1.3: Define No-Duplication Prefix Formatting
- **Location**: `rooms/laboratory/runtime/lab-adaptive-decision.ts`
- **Description**: Add a tiny pure formatter or shared label constant so candidate and alternatives use one posture-prefix rule.
- **Complexity**: 2
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The formatter detects existing leading posture labels from the exact known label set.
  - If the same label already prefixes the summary, the output is unchanged.
  - If a different known posture label already prefixes the summary, only that leading posture label is replaced; the original summary body remains unchanged.
  - The formatter does not inspect or mutate any store state.
- **Validation**:
  - Add direct or integration assertions covering same-label and changed-label idempotency.

### Task 1.4: Export Helper Through Test Truth Module
- **Location**: `scripts/tests/laboratory-runtime-truth.helpers.ts`
- **Description**: Re-export `buildDecisionPosture` and any test-needed posture prefix helper with the existing adaptive decision helper exports so tests use the same production surface.
- **Complexity**: 1
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Regression tests import posture helpers from the shared test helper module.
- **Validation**:
  - Targeted test compile succeeds.

## Sprint 2: Summary Integration
**Goal**: Surface the posture as a small textual cue while preserving existing structures and behavior.
**Demo/Validation**:
- Candidate summary starts with the posture label once.
- Alternatives summary optionally starts with the same label once.
- Candidate status, decision pressure, confidence, and alternatives order do not change because of posture.

### Task 2.1: Prepend Posture To Candidate Summary
- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Call `buildDecisionPosture` after `buildAdaptiveDecisionSignal` and prepend `shortLabel` to the final candidate summary through the shared no-duplication formatter.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Candidate summary format is deterministic, for example `Proceed with caution: This path may require refinement before execution.`
  - Repeated selector renders do not duplicate the label.
  - `candidate.status`, `decisionPressure`, `adaptiveDecisionHint`, and `confidence` logic remain unchanged.
- **Validation**:
  - Add fixed regression assertions for `status`, `decisionPressure`, `adaptiveDecisionHint`, and `confidence` across viable, unstable, and not-viable fixtures.
  - Verify commitment/staging/dispatch eligibility stays governed by the existing status and staging rules, not by posture text.

### Task 2.2: Prepend Posture To Alternatives Summary
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Prepend the same posture label to alternatives summary only when execution feedback context exists, using the same no-duplication rule.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Execution feedback context is explicit: prefix alternatives only when `executionGoalEvaluation` or `executionResultInterpretation` is present.
  - `executionResult` alone is not enough to prefix alternatives; counterfactuals may still use it separately.
  - Alternatives summary remains structurally the same string field.
  - No alternatives list/order changes.
  - Missing-data alternatives keep the current summary text without a posture prefix.
  - Label is not duplicated if summary is recomputed.
- **Validation**:
  - Add regression checks for high, low, and missing-data contexts, including the explicit no-prefix behavior for missing-data alternatives.

## Sprint 3: Guardrail Regression Coverage
**Goal**: Prove the new posture layer stays ephemeral, selector-driven, and behaviorally additive.
**Demo/Validation**:
- Targeted suites pass.
- Persistence checks confirm posture terms are not stored.

### Task 3.1: Add Mapping And Integration Tests
- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add tests for pure mapping, candidate summary prefixing, alternatives summary prefixing, no duplication, immutability, and unchanged status behavior.
- **Complexity**: 3
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `proceed`, `proceed-with-caution`, and `reconsider` paths are each covered.
  - Missing-data behavior is explicitly covered.
  - Re-render/no-duplication behavior is covered by direct formatter assertions or equivalent integration checks for same-label and changed-label already-prefixed summaries.
  - Viable, unstable, and not-viable fixtures keep the same status, pressure, hint, confidence, and dispatch eligibility after posture text is added.
  - Candidate and alternatives inputs are deep-cloned or frozen before builder calls and asserted unchanged afterward.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`

### Task 3.2: Extend Persistence Leak Tests
- **Location**: `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
- **Description**: Add negative persistence assertions for posture keys and posture label text.
- **Complexity**: 2
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Persistable state does not include the posture helper output at root or workspace level.
  - A recursive persisted-key scan confirms nested keys such as `posture`, `decisionPosture`, `shortLabel`, and `decisionPostureSignal` do not appear anywhere in the serialized persistable state.
  - A recursive serialized-state check confirms labels such as `Proceed`, `Proceed with caution`, and `Reconsider` do not leak through persisted summaries or snapshots.
  - Existing adaptive decision persistence checks continue to pass.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`

### Task 3.3: Run Final Validation
- **Location**: Repository root
- **Description**: Run the targeted runtime suites, TypeScript check, and lint if the implementation touches lint-sensitive formatting.
- **Complexity**: 2
- **Dependencies**: Tasks 3.1 and 3.2
- **Acceptance Criteria**:
  - Targeted runtime tests pass.
  - `npm run typecheck` passes.
  - `npm run lint` passes if run time is acceptable; otherwise report that it was not run.
- **Validation**:
  - Record the exact commands and outcomes in the final implementation report.

## Testing Strategy
- Pure helper tests should cover all posture mapping branches without constructing store state.
- Integration tests should use existing candidate and alternatives builders so the posture layer is verified at the same boundaries users indirectly see.
- Persistence tests should assert absence of posture fields in persisted snapshots, matching the existing adaptive decision and counterfactual guardrails.
- The implementation should avoid UI tests because this phase has no UI redesign and changes only selector-derived summary strings.

## Potential Risks & Gotchas
- The current `buildAdaptiveDecisionSignal({})` returns low pressure, but the new posture rule requires missing data to produce `proceed-with-caution`; the helper must detect missing goal/interpretation/pattern context before relying on pressure.
- `decisionPressure` must be passed from the already-computed adaptive decision result. Recomputing it inside the posture helper could drift from candidate and alternatives logic.
- Prepending posture labels can create brittle exact-string tests. Keep exact assertions for pure helper labels and formatter idempotency, but prefer targeted `startsWith` or regex assertions for long candidate and alternatives summaries.
- Candidate summary already appends adaptive hints. The posture formatter should wrap the final summary string after existing hint assembly so existing append-only logic remains intact.
- Alternatives summary already appends guided alternative and counterfactual projection text. The posture formatter should run after `buildSummary` builds the full text, apply one no-duplication prefix only when execution feedback exists, and leave pre-execution/missing-data alternatives unchanged.
- The alternatives prefix gate should not rely on `executionResult`, because goal evaluation and interpretation are already the selector-level feedback signals used by alternatives.
- Adding posture to summary fields is intentionally not a structure change. Do not add `decisionPosture`, `posture`, or `shortLabel` to `LabExecutionCandidate` or `LabExecutionAlternatives` model interfaces.
- The word `reconsider` should remain advisory text only; it must not change candidate status, dispatch candidacy, staging, or execution behavior.

## Rollback Plan
- Remove the `buildDecisionPosture` helper and related exports from `lab-adaptive-decision.ts`.
- Remove candidate and alternatives summary prefix calls.
- Remove the posture-specific regression assertions and persistence negative checks.
- Re-run the targeted runtime suites and `npm run typecheck` to confirm the system returns to the previous adaptive decision behavior.
