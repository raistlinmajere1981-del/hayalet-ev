# Plan: Laboratory Decision Priority Helper

**Generated**: 2026-04-28
**Estimated Complexity**: Medium

## Overview

Add a pure `reorderDecisionSummary` helper in `rooms/laboratory/runtime/lab-decision-priority.ts` that reorders already-built advisory strings according to the decision coherence state.

The implementation should not create advisory content, mutate inputs, import selectors, use stores, or add fields to candidate or alternatives models. Candidate and alternatives builders should keep generating the same descriptor, readiness, bridge, coherence, posture, guidance, and projection text they already generate, then delegate only final ordering/joining to the new helper.

Because the requested helper signature has no separate `baseSummary`, `guidance`, or `counterfactual` slot, implementation must deliberately preserve those existing strings outside the helper. Do not fold non-advisory lead text into the `descriptor` part; `reorderDecisionSummary` should receive only the existing descriptor, readiness, bridge, and coherence advisory strings.

## Prerequisites

- Run `npm run mode:status` and `npm run whereami` before implementation and follow the repo change-approval workflow before code edits.
- Current workflow during planning was `mode: terminal` and `whereami.effectiveMode: other-provider-cli`, so implementation can use terminal/plain-text workflow unless that changes.
- Relevant files are `rooms/laboratory/runtime/lab-execution-candidate.ts`, `rooms/laboratory/runtime/lab-execution-alternatives.ts`, `rooms/laboratory/runtime/lab-decision-coherence.ts`, `rooms/laboratory/runtime/lab-adaptive-decision.ts`, and `scripts/tests/laboratory-execution-runtime-regressions.test.ts`.
- Targeted validation command is `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts`.
- Final validation should include `npm run rooms:typecheck` or `npm run typecheck`.

## Architecture Decision

The new helper is a presentation-order helper, not a signal builder.

It should accept only existing strings and an optional coherence state. It should not import from selectors, model stores, candidate builders, alternatives builders, or coherence builders. The only acceptable logic is selecting an order, filtering absent parts, and joining the surviving strings with stable spacing.

Posture handling should be explicit. Existing `buildDecisionPosture` already exposes `shortLabel`, so candidate and alternatives can pass a posture prefix such as `Proceed:` without introducing new labels or exporting private label helpers. Avoid applying `prependDecisionPostureLabel` after the helper if that would hide whether `posturePrefix` is being tested.

Sub-agent review sharpened the contract: production imports must use `.js` specifiers, test imports can use `.ts`, existing advisory extractors must become marker-order independent, and helper text preservation means no internal rewrite beyond boundary-safe joining.

## Sprint 1: Pure Priority Helper

**Goal**: Add the deterministic helper with direct coverage before touching candidate or alternatives behavior.

**Demo/Validation**:

- Import the helper in the regression helper module or test file.
- Direct tests prove the same input returns the same string every time.
- No runtime builders need to change in this sprint.

### Task 1.1: Add Helper File

- **Location**: `rooms/laboratory/runtime/lab-decision-priority.ts`
- **Description**: Add `reorderDecisionSummary(input)` with the requested shape and supported coherence states.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Function is exported.
  - Function is pure and deterministic.
  - No imports are required.
  - No async, store usage, selector usage, mutation, random values, or date access.
  - `conflicted` uses coherence, readiness, descriptor, bridge order.
  - `mixed` uses descriptor, readiness, coherence, bridge order.
  - `aligned` and undefined use descriptor, readiness, bridge, coherence order.
- **Validation**: Direct helper tests in `scripts/tests/laboratory-execution-runtime-regressions.test.ts`.

### Task 1.2: Implement Safe Filtering And Joining

- **Location**: `rooms/laboratory/runtime/lab-decision-priority.ts`
- **Description**: Filter undefined and empty string parts, preserve non-empty text exactly, and join visible parts with single spaces.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Undefined and empty parts are omitted.
  - Existing text content is not rewritten.
  - Output contains no duplicate spaces introduced by joining.
  - Boundary whitespace may be normalized only to make the join safe; internal text spacing is preserved.
  - Posture prefix, when present, is always first.
  - Input object and nested `summaryParts` object are not mutated.
- **Validation**: Tests use frozen input objects and exact string assertions.

### Task 1.3: Export Helper For Tests

- **Location**: `scripts/tests/laboratory-runtime-truth.helpers.ts`
- **Description**: Re-export `reorderDecisionSummary` if the regression suite continues to import runtime utilities through the shared helper barrel.
- **Complexity**: 1/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Test imports remain consistent with the existing helper pattern.
  - No production barrel or model type changes are added unless already needed.
- **Validation**: The targeted regression file imports cleanly.

## Sprint 2: Candidate Integration

**Goal**: Replace candidate manual advisory concatenation with priority-aware helper usage while preserving all existing text.

**Demo/Validation**:

- Candidate summary contains every previously generated segment exactly once.
- Conflicted coherence can be placed before readiness and descriptor while posture remains first.
- Candidate output shape does not gain descriptor, readiness, coherence, or priority fields.

### Task 2.1: Build Candidate Advisory Parts Separately

- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Refactor the current nested `appendDescriptorAdvisory`, `appendReadinessSignalAdvisory`, `appendExecutionBridgeAdvisory`, and `appendDecisionCoherenceAdvisory` flow into local string variables before final summary assembly.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Descriptor advisory wording is generated by the existing descriptor formatter.
  - Readiness advisory wording is generated by the existing readiness formatter.
  - Bridge advisory wording is generated by the existing bridge formatter.
  - Coherence advisory wording is generated by existing `buildDecisionCoherence`.
  - Existing structural summary, adaptive hint, guided alternative text, and counterfactual summary are preserved exactly once outside the helper.
- **Validation**: Existing candidate summary assertions still pass after expected ordering updates.

### Task 2.2: Pass Coherence State Into Priority Helper

- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Keep the built coherence object or state long enough to pass `coherenceState` to `reorderDecisionSummary`.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - No new candidate fields are introduced.
  - Coherence state is used only for local ordering.
  - Coherence summary text remains the existing formatter output.
  - No selector import is added.
- **Validation**: Regression proves candidate object does not expose `coherenceState`, `coherence`, `dominantAxis`, or `coherenceConfidence`.

### Task 2.3: Preserve Candidate Posture Prefix First

- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`
- **Description**: Keep the existing idempotent `prependDecisionPostureLabel` production path unless final helper ownership is explicitly needed; cover the helper `posturePrefix` contract with direct tests.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `Proceed:`, `Proceed with caution:`, or `Reconsider:` remains at the very start when present.
  - No duplicate posture label is introduced.
  - Existing posture label wording is unchanged.
- **Validation**: Candidate tests assert prefix position and single occurrence.

## Sprint 3: Alternatives Integration

**Goal**: Apply the same priority-aware ordering to alternatives summaries without changing alternatives content, count, order, confidence, or comparison notes.

**Demo/Validation**:

- Alternatives summary contains every previously generated segment exactly once.
- Ordering follows coherence state.
- Alternatives object shape remains unchanged.

### Task 3.1: Build Alternatives Advisory Parts Separately

- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Replace the current suffix array concatenation with explicit advisory part variables passed to `reorderDecisionSummary`.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Base summary is not removed and remains outside the helper.
  - Guided alternative guidance text is not removed and remains outside the helper.
  - Counterfactual summary is not removed and remains outside the helper.
  - Descriptor, readiness, bridge, and coherence advisory wording remains unchanged.
  - Alternatives array generation and ranking are untouched.
- **Validation**: Existing alternatives tests continue to pass after expected ordering updates.

### Task 3.2: Preserve Conditional Posture Behavior

- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Preserve the existing rule that alternatives receive a posture prefix only when execution feedback context exists.
- **Complexity**: 2/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - No posture prefix appears for alternatives without feedback context.
  - Existing feedback-context summaries keep posture first.
  - The helper handles missing `posturePrefix` correctly.
- **Validation**: Regression covers both prefixed and unprefixed alternatives summaries.

### Task 3.3: Route Coherence State Without Model Changes

- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Keep the built coherence object or state locally and pass only the state to the priority helper.
- **Complexity**: 2/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - No new alternatives fields are introduced.
  - Existing `comparisonNote`, `confidence`, and alternatives list are unchanged.
  - No persistence, selector, or UI code changes.
- **Validation**: Regression asserts no leaked coherence or priority keys on alternatives.

## Sprint 4: Regression Coverage

**Goal**: Encode the requested behavior directly and update old order assumptions to reflect priority-aware ordering.

**Demo/Validation**:

- The targeted test file passes.
- Tests prove content preservation, ordering, posture position, and no mutation.

### Task 4.1: Add Direct Helper Ordering Tests

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add focused tests for deterministic ordering, conflicted, mixed, aligned, undefined state, missing parts, and posture prefix behavior.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Conflicted output starts with posture prefix when provided, then coherence before readiness, descriptor, and bridge.
  - Mixed output places coherence after readiness and before bridge.
  - Aligned and undefined preserve base descriptor, readiness, bridge, coherence order.
  - Missing parts do not create extra spaces.
  - Frozen input proves no mutation.
- **Validation**: Targeted regression test command.

### Task 4.2: Add No Duplication And Text Mutation Tests

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Assert exact occurrence counts and exact substring preservation for all supplied parts.
- **Complexity**: 3/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Each non-empty part appears exactly once.
  - No provided part text is trimmed internally or rewritten.
  - Output has no duplicated join spaces.
  - Empty strings and undefined fields are skipped.
- **Validation**: Targeted regression test command.

### Task 4.3: Update Candidate And Alternatives Ordering Assertions

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Update existing descriptor/readiness/bridge/coherence order assertions so they reflect priority ordering instead of always expecting coherence last.
- **Complexity**: 4/10
- **Dependencies**: Sprints 2 and 3
- **Acceptance Criteria**:
  - Candidate conflicted integration test proves coherence appears first among priority-managed parts.
  - Alternatives mixed integration test proves coherence appears after readiness.
  - Aligned integration test preserves previous order.
  - Existing forbidden execution-wording assertions remain.
  - Existing no-field-leak assertions remain.
- **Validation**: Targeted regression test command.

### Task 4.3a: Make Advisory Extraction Order-Independent

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Update advisory extractors so each marker stops at the nearest later advisory marker, regardless of priority order.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `Coherence view:` extraction stops before `Readiness view:`, `Descriptor view:`, or `Execution bridge:` when coherence appears first.
  - `Readiness view:` and `Execution bridge:` extraction stop on every other advisory marker.
  - Existing exact advisory assertions remain meaningful after reordering.
- **Validation**: Targeted regression test command.

### Task 4.4: Add Append-Only Integration Guard

- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Add candidate and alternatives assertions that all existing pre-priority strings remain present after reordering.
- **Complexity**: 3/10
- **Dependencies**: Sprints 2 and 3
- **Acceptance Criteria**:
  - Structural candidate summary remains present.
  - Adaptive decision hint remains present when generated.
  - Guided alternative guidance remains present when generated.
  - Counterfactual projection summary remains present when generated.
  - Descriptor, readiness, bridge, and coherence advisories remain present exactly once.
- **Validation**: Targeted regression test command.

## Testing Strategy

- Run `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts` after each integration sprint.
- Run `npm run rooms:typecheck` after helper and integration changes.
- Run `npm run typecheck` before final handoff if time permits.
- Use exact string tests for the pure helper and marker-order tests for integration.
- Keep existing `DESCRIPTOR_EXECUTION_VERB_PATTERN` checks active for descriptor, readiness, bridge, and coherence advisories.

## Potential Risks & Gotchas

- The helper signature does not include a separate base summary slot. Mitigation: preserve current base/guidance/counterfactual text outside the helper, and add append-only tests.
- Existing extraction helpers assume descriptor before readiness before bridge before coherence. Mitigation: update extraction logic so each advisory can be extracted regardless of priority order.
- Existing `append*` functions dedupe by checking whether the growing summary includes the advisory. Mitigation: after refactor, use explicit one-time variables and occurrence-count tests instead of implicit dedupe.
- Passing a posture prefix with trailing whitespace could force trimming or duplicate spaces. Mitigation: pass a prefix without trailing whitespace, such as `Proceed:`, and let the helper join with one space.
- Direct helper tests may need a new export from `scripts/tests/laboratory-runtime-truth.helpers.ts`. Mitigation: follow existing helper re-export style and avoid broad runtime barrels.
- Coherence state must be obtained from the existing coherence builder without adding model fields. Mitigation: keep the coherence object local, use `.summary` for content and `.state` for ordering.
- Reordering may intentionally break old assertions that coherence is last. Mitigation: update tests to assert state-specific order rather than fixed legacy order.
- Integration fixtures may not naturally produce every coherence state. Mitigation: use direct helper tests for exact aligned/mixed/conflicted ordering and keep integration assertions focused on preserving content plus the state actually produced by the fixture.

## Rollback Plan

- Remove `rooms/laboratory/runtime/lab-decision-priority.ts`.
- Revert candidate summary assembly to the previous nested append flow.
- Revert alternatives summary assembly to the previous suffix array flow.
- Remove helper exports and new priority-order tests.
- Restore previous fixed-order assertions if priority-aware ordering is abandoned.
