# Plan: Laboratory Execution Goal-Aware Evaluation

**Generated**: 2026-04-26
**Estimated Complexity**: Medium

## Overview
Add a deterministic goal-aware evaluation layer on top of the existing Laboratory execution feedback loop. The layer will derive whether the completed execution met the active action goal, feed that evaluation into reflection, candidate confidence, alternatives tone, and the existing process panel inline result area.

The implementation stays selector-driven: no new store fields, no persistence, no new events, no run-controller changes, no async systems. The active result remains gated by the existing dispatch identity, and goal evaluation is derived from the completed result plus the active dispatch action type and dispatch selection snapshot. The helper keeps the requested two-argument shape, but the `result` argument must explicitly carry the selection snapshot when ROI-sensitive evaluation is needed.

Goal evaluation is an additive feedback layer, not a structural override. It may influence summary tone and confidence weighting, but it must not rewrite interpretation fields, candidate status, dispatch inputs, or any `getBase*` selector output.

## Prerequisites
- Existing Phase F3 feedback loop remains intact.
- `lab-run-controller.ts` is untouched.
- `executionRuntime.result` remains ephemeral UI state only.
- The active execution result remains tied to `dispatchId` and active dispatch candidate.
- Validation uses targeted Laboratory runtime/UI regressions plus typecheck and lint.

## Sprint 1: Goal Evaluation Selector Layer
**Goal**: Add the pure evaluation helper and active selector without changing store shape.
**Demo/Validation**:
- Runtime tests can call the pure helper directly.
- Active selector returns `null` without a completed, identity-matched result.
- Active selector returns stable output for repeated calls with the same result.

### Task 1.1: Define Goal Evaluation Types
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, optionally `rooms/laboratory/models/lab-types.ts` if a shared model type avoids runtime import coupling
- **Description**: Add `LabExecutionGoalEvaluation` with `outcome`, `goalAlignment`, and `summary`, plus a helper input contract that can include `selectionSnapshot`.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Outcome is exactly `"successful" | "neutral" | "failed"`.
  - `goalAlignment` is clamped to `0..1`.
  - Type is exported or mirrored safely for downstream builders/tests without creating a selector import cycle.
  - ROI-sensitive evaluation has an explicit `selectionSnapshot` input path.
- **Validation**:
  - TypeScript compile.

### Task 1.2: Add Pure Helper
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Implement `getExecutionGoalEvaluation(result, actionType)` as a pure deterministic helper. The first argument must be a result-like object that may include `selectionSnapshot`; the helper must never read mutable current selection state.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `analyze-segment`: high coverage plus anomaly present returns successful.
  - `analyze-segment`: low coverage returns failed.
  - `focus-region`: ROI plus high coverage returns successful.
  - `focus-region`: ROI plus low coverage returns failed.
  - `focus-region`: no ROI returns neutral.
  - `inspect-audio`: multiple artifacts plus confidence `>= 0.6` returns successful.
  - `inspect-audio`: confidence `< 0.6` returns failed.
  - Fallback action returns neutral.
  - No randomness, dates, timers, or external state.
  - Missing `selectionSnapshot` is treated as no ROI, not as an implicit current-selection lookup.
- **Validation**:
  - Add helper-level runtime tests for every action mapping.
  - Add repeated-call determinism assertions.

### Task 1.3: Add Active Goal Evaluation Selector
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getActiveExecutionGoalEvaluation(state)` using `getActiveExecutionRuntimeContext`.
- **Complexity**: 3/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Returns `null` when active result is missing, running, stale, or dispatch identity does not match.
  - Uses `dispatchCandidate.actionType`, not a persisted action field.
  - Uses the dispatch `selectionSnapshot`, including ROI, from the active result context.
  - Result becomes `null` after ROI or timeline mutation invalidates the active dispatch identity.
- **Validation**:
  - Extend execution runtime lifecycle tests for stale/null behavior.
  - Ensure no persistence/hydrate test expects or stores this selector output.
  - Ensure the selector is only consumed from public post-runtime selectors, never from `getBaseActiveExecutionReflection`, `getBaseActiveExecutionAlternatives`, `getBaseActiveExecutionCandidate`, or `getBaseExecutionDispatchCandidate`.

## Sprint 2: Feedback Integration
**Goal**: Feed goal evaluation into the existing selector-driven reflection, candidate, and alternatives outputs.
**Demo/Validation**:
- Completed execution summary shows interpretation feedback followed by goal evaluation feedback.
- Candidate status stays unchanged while confidence responds to goal outcome.
- Alternatives keep the same structure while summary/comparison tone changes.

### Task 2.1: Reflection Append
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Extend the existing reflection feedback append path so the goal evaluation summary is appended after interpretation feedback.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Original reflection summary is preserved.
  - Interpretation line remains first.
  - Goal evaluation line is appended after interpretation.
  - Repeated selector calls do not duplicate the same line.
  - Goal feedback does not rewrite `coverageLevel`, `anomalyLevel`, `alignment`, or the existing interpretation sentence.
- **Validation**:
  - Add reflection append test with completed result.
  - Add a selector-path test for a case where interpretation is divergent but goal outcome is successful.

### Task 2.2: Candidate Confidence Upgrade
- **Location**: `rooms/laboratory/runtime/lab-execution-candidate.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Pass goal evaluation into candidate builder and apply deterministic confidence deltas.
- **Complexity**: 5/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Successful goal outcome applies a stronger boost than the existing interpretation-only boost.
  - Failed goal outcome reduces confidence significantly.
  - Neutral goal outcome applies no meaningful change.
  - Precedence is explicit: goal outcome may offset or amplify interpretation-driven confidence deltas, but it does not erase interpretation or change candidate status.
  - Existing `status`, `structuralIntegrity`, notes, and uncertainty rules are unchanged.
  - Confidence remains clamped by the existing clamp helper.
  - Candidate and alternatives builders either receive a shared model type or local structural-compatible input type; they do not import selectors in a way that creates a runtime cycle.
  - Public selector output changes do not feed back into base dispatch identity.
- **Validation**:
  - Add candidate tests comparing base, successful, failed, and neutral outcomes.
  - Assert status remains unchanged for the same upstream chain.

### Task 2.3: Alternatives Tone Refinement
- **Location**: `rooms/laboratory/runtime/lab-execution-alternatives.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Pass goal evaluation into alternatives builder and refine only summary/comparison copy.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Failed goal outcome produces more assertive alternative wording.
  - Successful goal outcome de-emphasizes alternatives as backup routes.
  - Neutral goal outcome preserves existing interpretation-based tone.
  - Precedence is explicit for mixed signals: when interpretation says the result deviates but goal outcome is successful, summary tone acknowledges goal success while still noting deviation risk.
  - `alternatives[]` count, order, action types, and tradeoffs do not change.
  - Failed goal wording is more assertive only in `summary` and `comparisonNote`.
- **Validation**:
  - Extend alternatives re-weighting tests.
  - Assert deep equality for `alternatives[]` before and after goal feedback.

## Sprint 3: Minimal Process Panel Output
**Goal**: Show goal evaluation inline under the existing evaluated outcome line.
**Demo/Validation**:
- Process panel renders `Goal evaluation: {summary}` only for completed active results with evaluation.
- No new panel, button, or interaction appears.

### Task 3.1: Render Goal Evaluation Line
- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Import active goal evaluation selector and pass the summary into the existing execution result renderer.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The line appears beneath the existing evaluated outcome line.
  - Running and idle states do not render the line.
  - The existing result sections remain unchanged.
  - No buttons, action attributes, or new layout panels are added.
- **Validation**:
  - Extend process panel source/UI regression tests.

### Task 3.2: Add Localized Copy
- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add small i18n strings for the inline goal evaluation label only. Goal summaries emitted by selectors remain deterministic English technical copy, matching the current reflection/timeline pattern and avoiding new summary-key plumbing in this phase.
- **Complexity**: 2/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - English output supports `Goal evaluation: {summary}`.
  - Turkish output supports the existing TR process panel path.
  - Goal summary text remains selector-owned deterministic English in reflection/timeline output for this phase.
  - Fallback text remains useful if translations are unavailable.
- **Validation**:
  - Add English and Turkish render assertions.

## Sprint 4: Regression Coverage And Verification
**Goal**: Lock the selector-only contract and prevent persistence or UI creep.
**Demo/Validation**:
- Targeted Laboratory runtime/UI tests pass.
- Typecheck and lint pass.
- Working tree only contains intended plan/implementation files after future implementation.

### Task 4.1: Runtime Tests
- **Location**: `scripts/tests/laboratory-execution-runtime-regressions.test.ts`, `scripts/tests/laboratory-runtime-truth.helpers.ts`
- **Description**: Export and cover the new helper/selector through the runtime test helper.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Determinism test covers repeated helper calls.
  - Action-specific mapping test covers `analyze-segment`, `focus-region`, `inspect-audio`, and fallback.
  - Reflection append order is asserted.
  - Candidate confidence response is asserted.
  - Alternatives structure stability is asserted.
  - Dispatch candidate `dispatchId` remains stable after interpretation and goal feedback are applied.
  - Completed result and goal evaluation return `null` after ROI/timeline mutation invalidates the dispatch snapshot.
  - Mixed-signal precedence is covered: a successful goal evaluation can coexist with a divergent interpretation without changing candidate status or dispatch identity.
- **Validation**:
  - Run targeted runtime regression file.

### Task 4.2: UI Regression Tests
- **Location**: `scripts/tests/laboratory-source-ui-regressions.test.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Assert process panel and timeline-visible selector feedback stays passive and inline.
- **Complexity**: 4/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Process panel includes the goal evaluation line after completion.
  - Turkish copy resolves.
  - No execution buttons or action attributes appear.
  - Timeline/reflection feedback includes goal summary when result is completed.
  - Timeline/reflection tests explicitly treat goal summary strings as deterministic English technical copy in this phase.
- **Validation**:
  - Run targeted UI regression files.

### Task 4.3: Full Local Verification
- **Location**: Project root
- **Description**: Run the final verification set after implementation.
- **Complexity**: 3/10
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - Targeted Laboratory tests pass.
  - `npm run typecheck` passes.
  - `npm run lint` passes.
  - No changes touch `rooms/laboratory/runtime/lab-run-controller.ts`.
  - Persistence regression explicitly confirms no `activeExecutionGoalEvaluation` or `executionGoalEvaluation` key is written to persisted state.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `npm run typecheck`
  - `npm run lint`

## Testing Strategy
- Test the pure helper first so goal mapping is deterministic and easy to debug.
- Test active selector gating with completed, stale, running, and missing result states.
- Test reflection feedback with exact append order.
- Test candidate confidence as relative behavior and clamp-safe exact values.
- Test alternatives summaries without allowing structural changes to alternatives.
- Test process panel render output in English and Turkish.
- Test dispatch identity stability before and after goal-aware feedback.
- Test stale result clearing/null behavior after selection range or ROI changes.
- Test mixed-signal precedence where goal success and interpretation deviation coexist.
- Test persistence leakage with explicit negative assertions for likely goal-evaluation keys.
- Keep existing persistence leak tests passing; this phase should not add persisted fields.

## Potential Risks & Gotchas
- The requested helper name starts with `get`, but it should remain pure and not read store state.
- `analyze-segment` depends on anomaly level, so the helper should reuse the existing interpretation logic instead of inventing a second anomaly heuristic.
- `analyze-segment` can legitimately produce a successful goal outcome while interpretation still flags deviation; the plan must keep that dual signal explicit instead of forcing a fake single verdict.
- `focus-region` must read ROI from the execution result selection snapshot, not from current mutable selection state.
- `LabExecutionResult` alone does not include `selectionSnapshot`; the helper input contract must make snapshot availability explicit while preserving the requested function shape.
- Missing confidence for `inspect-audio` should not accidentally become failed unless the rule explicitly sees low numeric confidence.
- Candidate confidence may receive both interpretation and goal deltas; tests should lock intended layering so the boost/reduction does not drift.
- Alternatives must change only copy tone, not the array shape.
- Process panel must stay inline and passive; no new button/action markup should appear.
- Goal-aware selectors must stay out of `getBase*` selector paths so runtime-context lookup cannot recurse or invalidate dispatch identity.
- Type ownership can drift if selector-owned types are imported by runtime builders; prefer model/shared structural types or local type aliases to avoid cycles.
- Goal summary localization is intentionally limited in this phase: summaries stay deterministic English technical copy, while process-panel labels are localized.
- Existing uncommitted `config/rooms.json` should be treated as unrelated during future implementation unless explicitly scoped in.

## Rollback Plan
- Revert the goal evaluation helper and active selector additions in `lab-selectors.ts`.
- Remove optional goal evaluation inputs from candidate and alternatives builders.
- Remove the inline process panel goal evaluation render and i18n keys.
- Remove the added tests.
- Confirm `lab-run-controller.ts` remains untouched and targeted tests return to the previous F3 baseline.
