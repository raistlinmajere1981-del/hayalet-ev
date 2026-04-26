# Plan: Laboratory Phase F3 - Result Interpretation & Feedback Loop

**Generated**: 2026-04-26
**Estimated Complexity**: Medium

## Overview

Extend the existing F2 execution bridge so a completed local execution does not stop at materialized output. Instead, the completed result is interpreted deterministically and fed back into the passive decision stack: reflection copy gains a short outcome-aware line, candidate confidence is re-weighted, alternatives shift tone, and the process panel shows a tiny “Outcome evaluated” confirmation. The phase stays local, synchronous except for the existing mock dispatcher timer, and isolated from run-controller, persistence, and external systems.

## Assumptions

- F1/F2 runtime clearing rules remain intact, so a completed execution result is cleared when selection or commitment changes.
- `LabExecutionResult` and `getActiveExecutionResult(state)` from F2 already exist and remain the source of completed result content.
- No store contract changes are needed; F3 should work through selectors and existing build functions.
- The listed production files are the primary implementation seam:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/runtime/lab-execution-candidate.ts`
  - `rooms/laboratory/runtime/lab-execution-alternatives.ts`
  - `rooms/laboratory/ui/workspace-process-panel.ts`
- Timeline evaluation surfaces are downstream consumers of the selector outputs even if their render file does not need logic changes.
- Small supporting test and copy updates may still be required to preserve localization and regression coverage.

## Prerequisites

- Existing execution bridge and result materialization:
  - [rooms/laboratory/runtime/lab-selectors.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-selectors.ts)
  - [rooms/laboratory/runtime/lab-execution-dispatcher.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-execution-dispatcher.ts)
  - [rooms/laboratory/runtime/lab-store.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-store.ts)
- Existing passive decision builders:
  - [rooms/laboratory/runtime/lab-execution-reflection.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-execution-reflection.ts)
  - [rooms/laboratory/runtime/lab-execution-alternatives.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-execution-alternatives.ts)
  - [rooms/laboratory/runtime/lab-execution-candidate.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-execution-candidate.ts)
- Existing UI seams:
  - [rooms/laboratory/ui/workspace-process-panel.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/workspace-process-panel.ts)
  - [rooms/laboratory/ui/lab-waveform-timeline-render.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-waveform-timeline-render.ts)
- Relevant regression suites:
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`

## Sprint 1: Interpretation Seam And Reflection Feedback

**Goal**: Add a deterministic interpretation layer on top of completed execution results without creating selector recursion or store changes.
**Demo/Validation**:

- A pure interpretation helper returns stable `coverageLevel`, `anomalyLevel`, and `alignment`.
- Reflection summary gains one appended outcome-aware sentence when a completed result is present.
- No persistence or runtime shape changes appear.

### Task 1.1: Introduce a pure interpretation helper in selectors

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `buildExecutionResultInterpretation(result)` as a pure deterministic helper. To honor the requested inputs without touching store shape, define a local interpretation input that includes:
  - materialized execution result fields
  - stable selection-size context
  - `actionType`
    The helper should bucket:
  - `coverageLevel` from `metrics.coverage` and selection-size expectations
  - `anomalyLevel` from artifact count plus action-specific expectations
  - `alignment` from action type, coverage, artifact density, and selection span
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
  - Mapping is fully deterministic and side-effect free.
  - No randomness, timers, persistence reads, or host calls are introduced.
  - The helper can be called directly from tests with stable expected output.
  - The helper does not require store mutation or run-controller state.
- **Validation**:
  - Add direct runtime regression cases for repeated identical input
  - Add boundary cases for low/medium/high coverage and partial/deviates alignment

### Task 1.2: Add a selector-safe interpretation context path

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Build a small selector-layer helper that can derive interpretation input without calling back into `getExecutionDispatchCandidate()` or `getActiveExecutionCandidate()`. The safest path is to factor a shared, lower-level completed-runtime validation seam that both `getActiveExecutionResult()` and the new interpretation path can use, so F3 preserves F2’s active-result contract while still avoiding selector recursion.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The interpretation path does not create a selector cycle.
  - Completed result interpretation is only exposed when runtime is completed and the recomputed active execution identity still matches both `dispatchId` and `planId`, consistent with F2.
  - The helper relies only on stable current seams already cleared by F1/F2 invalidation rules.
  - `getActiveExecutionResult(state)` either keeps its current implementation or is refactored onto the same shared validation helper without weakening dispatch-gated semantics.
- **Validation**:
  - Regression test proves selector calls do not recurse and still resolve on completed execution
  - Existing dispatch/result gating tests keep passing

### Task 1.3: Append interpretation feedback to the active reflection summary

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Keep the base reflection builder in `lab-execution-reflection.ts` unchanged. Instead, augment the selector-returned reflection summary when interpreted execution output exists by appending one short line such as:
  - `Result shows limited coverage`
  - `Output aligns with simulated expectations`
  - `Detected structure differs from initial simulation`
    The original reflection summary remains intact and comes first.
- **Complexity**: 4
- **Dependencies**: Tasks 1.1-1.2
- **Acceptance Criteria**:
  - Reflection summary is appended, never replaced.
  - No reflection decision/status semantics change.
  - When no execution result exists, reflection output is byte-for-byte equivalent to the current behavior.
- **Validation**:
  - UI evaluation regression or selector test asserts appended copy only appears after completed execution
  - Baseline reflection regression stays unchanged when no result exists

### Task 1.4: Keep Sprint 1 runnable without expanding persistence surface

- **Location**:
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-runtime-truth.helpers.ts` if new selector exports need test access
- **Description**: Add or adapt tests needed to exercise the interpretation helper and confirm no execution feedback leaks into persistence or hydrate. This locks in the new seam before candidate/alternatives re-weighting lands.
- **Complexity**: 4
- **Dependencies**: Tasks 1.1-1.3
- **Acceptance Criteria**:
  - Sprint 1 is runnable and testable without waiting for UI changes.
  - No new persisted field appears in execution snapshots.
  - Helper exports are available to tests without changing runtime behavior.
- **Validation**:
  - Targeted runtime suite passes
  - Persistence leak regression remains green

## Sprint 2: Feed Interpreted Outcomes Back Into Candidate And Alternatives

**Goal**: Re-weight the passive decision system using interpreted result signals while keeping status and structure stable.
**Demo/Validation**:

- Candidate confidence changes deterministically after completed execution.
- Alternatives summary/comparison tone shifts based on interpreted outcome quality.
- Candidate status and alternatives structure remain unchanged.

### Task 2.1: Extend candidate input with optional interpreted result context

- **Location**:
  - `rooms/laboratory/runtime/lab-execution-candidate.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Extend the resolved input contract so the candidate builder can receive a small optional interpretation object:
  - `coverageLevel`
  - `anomalyLevel`
  - `alignment`
    Keep this as a local inline shape or lightweight exported type to avoid widening global model contracts unnecessarily.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No candidate builder caller is forced to provide interpretation; pre-execution behavior remains unchanged.
  - The new input does not alter `status` or `structuralIntegrity` logic.
  - Existing plan/readiness/reflection dependencies stay intact.
- **Validation**:
  - Typecheck confirms optional compatibility
  - Existing candidate regressions still pass pre-result scenarios

### Task 2.2: Apply deterministic confidence adjustment rules to the active candidate

- **Location**:
  - `rooms/laboratory/runtime/lab-execution-candidate.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Adjust candidate confidence only when interpreted execution output exists:
  - high coverage + aligned => increase confidence, capped at the current confidence ceiling
  - low coverage or deviation => decrease confidence
  - medium/partial => apply a small nudge
    Preserve the current upstream confidence stack as the base, then apply a small deterministic post-adjustment.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Candidate `status` stays exactly as before.
  - Confidence adjustments are capped and stable across repeated runs.
  - The existing confidence clamp contract is preserved unless the implementation deliberately updates every dependent consumer in the same sprint.
  - No feedback path changes commitment or staging eligibility indirectly through status drift.
- **Validation**:
  - Runtime regression asserts exact confidence outputs for aligned, partial, and deviating interpretations
  - Regression confirms candidate status is unchanged after feedback

### Task 2.3: Re-weight alternatives summary and comparison tone

- **Location**:
  - `rooms/laboratory/runtime/lab-execution-alternatives.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Extend alternatives resolved input with the same optional interpretation context and update only textual framing:
  - low coverage or deviation => emphasize that alternative paths may yield better outcomes
  - high coverage and aligned => emphasize current-path stability
    Keep `alternatives[]` entries structurally identical; only `summary` and `comparisonNote` should shift tone. Because staging notes currently copy `executionAlternatives.comparisonNote`, the plan should treat that downstream staging copy drift as an intentional side effect to validate, not an accident.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No new fields are added to `LabExecutionAlternatives`.
  - Alternatives list count/order is unchanged by result interpretation.
  - Any resulting staging-note copy drift is limited to mirrored wording changes from `comparisonNote`; no staging status or shape changes occur.
  - Pre-execution behavior is unchanged when no result exists.
- **Validation**:
  - Runtime regression asserts summary/comparison text changes by interpretation bucket
  - Regression or fixture update acknowledges staging-note wording when `comparisonNote` changes
  - Existing alternatives structure assertions still pass

### Task 2.4: Preserve dispatch and staging identity after confidence feedback

- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Confirm the new candidate/alternatives feedback does not accidentally perturb the dispatch identity path. Candidate confidence and alternatives tone may change after completion, but `dispatchId`, candidate status, commitment validity, and staging status must stay stable.
- **Complexity**: 4
- **Dependencies**: Tasks 2.2-2.3
- **Acceptance Criteria**:
  - Completed result remains readable after candidate confidence is re-weighted.
  - `getExecutionDispatchCandidate(state)` does not flap because of post-result confidence changes.
  - Existing F1/F2 commitment and staging guardrails remain intact.
- **Validation**:
  - Regression compares dispatch candidate identity before and after completion
  - Completed result selector still resolves after feedback

## Sprint 3: Minimal Process Feedback And Regression Lock-In

**Goal**: Surface the interpreted outcome with the smallest possible UI addition and lock in deterministic behavior.
**Demo/Validation**:

- Process panel shows the existing result plus one small evaluated-outcome line.
- Runtime, UI, and persistence regressions prove the feedback loop remains passive.
- No new panel, button, async source, or persistence seam appears.

### Task 3.1: Add the minimal process-panel evaluation line

- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Extend the completed execution block so it renders one small line beneath the existing result content:
  - `Outcome evaluated`
  - Turkish equivalent via the existing copy system
    Keep this inline within the current runtime snippet; do not add a new section heading or interaction surface. Because the current result renderer short-circuits when both insights and artifact labels are empty, this task should explicitly choose one of two safe approaches:
  - render the evaluation line through a small interpretation-aware wrapper even when the nested result body is empty
  - or relax the empty-result short-circuit just enough to preserve the minimal line without expanding the UI
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The line appears only for completed execution with an interpretable result.
  - Running-state markup remains unchanged.
  - No button, CTA, or new action hook is introduced.
- **Validation**:
  - Source/UI regression checks for evaluated-outcome text and absence of controls
  - Completed-state test uses a real committed/completed execution chain that satisfies active-result gating instead of a manually stubbed runtime object

### Task 3.2: Add the smallest necessary copy support

- **Location**:
  - `rooms/laboratory/ui/workspace-process-panel.ts`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: If the process panel uses `copy.t(...)` consistently, add a single translation key for the evaluated-outcome line rather than hardcoding a language-specific fallback. Keep the change tightly scoped to the existing `executionRuntime` copy block.
- **Complexity**: 2
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - English and Turkish labels are both defined.
  - No unrelated i18n churn is introduced.
  - If implementation chooses inline fallback instead, the plan must justify why it does not violate the room’s localization pattern.
- **Validation**:
  - UI regression or string lookup assertion for both locales

### Task 3.3: Expand runtime and UI regression coverage

- **Location**:
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
- **Description**: Extend tests to cover:
  - stable interpretation mapping
  - reflection summary augmentation
  - candidate confidence adjustment
  - alternatives summary/comparison tone shift
  - process-panel evaluated-outcome line
  - no persistence leak
    `laboratory-ui-evaluation-regressions.test.ts` should be treated as a first-class affected suite because reflection summary, alternatives tone, and candidate confidence all render there through selector-fed data.
- **Complexity**: 7
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - The requested runtime and UI regressions are covered without weakening F1/F2 guardrails.
  - Reflection/candidate/alternatives UI stays passive and advisory.
  - Persistence and hydrate behavior remain unchanged.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `npm run typecheck`

## Testing Strategy

- Selector/unit coverage:
  - `buildExecutionResultInterpretation(result)` returns stable buckets for identical input
  - selector-safe interpretation path avoids recursion and only activates for completed matching runtime
- Decision feedback coverage:
  - reflection summary appends exactly one interpretation line
  - candidate confidence increases/decreases per requested rules
  - candidate status does not change
  - alternatives structure does not change, only summary/comparison tone
- UI coverage:
  - process panel keeps existing result rendering
  - completed state also shows evaluated-outcome text
  - no new buttons, handlers, or DOM action hooks appear
- Persistence coverage:
  - `executionRuntime` still does not leak into persisted state
  - interpretation feedback introduces no new persisted surface

## Potential Risks & Gotchas

- **Selector recursion risk**: `getActiveExecutionResult()` already depends on the commitment/candidate/staging chain. If reflection/candidate/alternatives try to call it directly, they can recurse. F3 should use a lower-level interpretation context seam instead of wiring the result selector back into the decision stack.
- **Active-result gating risk**: F3 should not loosen F2’s contract from `dispatchId + planId` matching down to `activePlanId` matching alone. Any shared validation helper must preserve the stricter identity gate.
- **Dispatch identity drift**: Candidate confidence and alternatives tone will change after completion. That must not leak into dispatch identity or invalidate the active completed result unexpectedly.
- **Confidence ceiling drift**: Candidate and alternatives builders currently clamp to `0.98`. F3 should preserve that ceiling unless it intentionally broadens the confidence contract across the entire evaluation stack.
- **Reflection UI test impact**: Reflection summary text is rendered through the timeline evaluation UI, not the process panel. Even though the requested production files do not include `lab-waveform-timeline-render.ts`, existing UI regression fixtures should be treated as a primary affected surface because selector-fed summary and confidence text changes will flow there.
- **Staging copy ripple**: Alternatives `comparisonNote` already propagates into staging notes. F3 can change that wording, but the plan should validate it intentionally so staging copy drift does not look like an unplanned regression.
- **Localization seam**: The new `Outcome evaluated` line ideally uses the same i18n block as the rest of `executionRuntime`. If implementation skips i18n, it should do so intentionally and minimally.
- **Selection-size interpretation input**: The interpretation mapping depends on selection size. F3 should normalize that input once so tests do not accidentally depend on mutable or transient selection fields.

## Rollback Plan

- Revert selector-only interpretation plumbing first:
  - remove interpretation helper and selector augmentation
  - remove candidate/alternatives optional interpretation input
- Restore current passive decision outputs:
  - candidate confidence formula back to upstream-only
  - alternatives summary/comparison back to reflection-only logic
  - reflection summary back to base builder output
- Remove the tiny process-panel evaluated-outcome line and corresponding copy key if added
- Re-run the targeted execution/runtime/UI suites plus `npm run typecheck` to confirm the codebase is back to F2 behavior
