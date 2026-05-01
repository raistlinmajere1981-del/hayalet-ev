# Plan: Laboratory Phase F2 - Result Materialization Layer

**Generated**: 2026-04-26
**Estimated Complexity**: Medium

## Overview

Upgrade the F1 execution bridge so a completed execution returns deterministic, selection-aware materialized results instead of the current generic mock payload. The phase stays local, mock-only, and reversible by extending the result contract, feeding the dispatcher the exact selection/action context it needs, and rendering a compact textual result summary in the existing process panel.

## Assumptions

- F1 auto-dispatch behavior remains intact: a valid dispatch candidate still triggers a one-shot mock execution keyed by stable `dispatchId`.
- Result enrichment should stay additive to the current bridge. The dispatcher continues to emit `workspace-execution-*` events rather than introducing a new controller or queue.
- `selectionSnapshot` should represent the selection that produced the result, not the mutable live selection after the fact.
- ROI compliance in F2 is represented through deterministic annotation generation plus the returned `selectionSnapshot`; this phase does not invent a new spatial artifact export schema.

## Prerequisites

- Existing F1 execution bridge remains the source seam:
  - [rooms/laboratory/runtime/lab-selectors.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-selectors.ts)
  - [rooms/laboratory/runtime/lab-store.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-store.ts)
  - [rooms/laboratory/runtime/lab-execution-dispatcher.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-execution-dispatcher.ts)
  - [rooms/laboratory/ui/lab-root.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-root.ts)
- Existing selection and plan semantics are already modeled in:
  - [rooms/laboratory/models/lab-types.ts](/home/raistlin/hayalet-ev/rooms/laboratory/models/lab-types.ts)
  - [rooms/laboratory/runtime/lab-execution-planner.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-execution-planner.ts)
  - [rooms/laboratory/runtime/lab-execution-reflection.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-execution-reflection.ts)
- Runtime/UI regression suites remain the safety net:
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`

## Sprint 1: Result Contract And Execution Context

**Goal**: Make execution results structurally rich and ensure the dispatcher receives stable selection-aware input.
**Demo/Validation**:

- Types can represent summary, insights, structured artifacts, metrics, and selection snapshot.
- Dispatch candidate or equivalent dispatcher input contains the active selection context required for deterministic materialization.
- Result selector exposes a completed result only when it still matches the active dispatch identity.

### Task 1.1: Upgrade execution result types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Replace the generic F1 `LabExecutionResult` shape with an explicit result contract: `summary`, `insights`, typed `artifacts`, and typed `metrics`. Introduce small dedicated types such as `LabExecutionArtifact`, `LabExecutionArtifactType`, and a selection-enriched selector return type if helpful.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabExecutionResult` matches the F2 schema.
  - Artifact type is restricted to `"marker" | "segment" | "annotation"`.
  - `metrics.coverage` and `metrics.confidence` are optional numeric fields, not free-form records.
  - No persistence types are widened to include execution results.
- **Validation**:
  - Typecheck on `lab-types.ts`
  - Search confirms `LabPersistedState` remains untouched

### Task 1.2: Carry selection snapshot and action context into the execution bridge

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Extend the dispatch-candidate path so the dispatcher receives a stable selection snapshot and the actionable execution context needed for materialization. Prefer an additive candidate field such as `selectionSnapshot` plus normalized semantic execution inputs already represented by the active payload preview and plan, rather than forcing the dispatcher to re-read mutable store state.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The dispatcher input can determine `actionType`, `startMs`, `endMs`, and ROI presence without consulting external systems.
  - `dispatchId` stays deterministic and should reflect any context that materially changes result generation, especially selection range and ROI-sensitive branches.
  - `dispatchId` derivation uses stable semantic fields only; do not hash full `LabSelection` / `LabExecutionPlan` objects or ephemeral fields such as `selection.id`, `createdAt`, or plan copy text.
  - Selection snapshot is immutable from the dispatcher’s point of view.
  - Existing F1 eligibility rule for committed + staged execution remains unchanged.
- **Validation**:
  - Selector tests cover candidate presence and required execution context fields
  - Identity regression proves semantically identical selection inputs do not change `dispatchId` just because transient fields differ
  - Regression confirms changing selection/ROI changes or invalidates the candidate as expected

### Task 1.3: Enrich the active result selector with `selectionSnapshot`

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Update `getActiveExecutionResult(state)` so it returns a selection-aware view like `{ ...result, selectionSnapshot }` only when the runtime is completed and still aligned with the active dispatch identity. Keep the selector as the gatekeeper for staleness.
- **Complexity**: 5
- **Dependencies**: Tasks 1.1-1.2
- **Acceptance Criteria**:
  - Result remains `null` for stale, reset, or mismatched runtime.
  - Returned `selectionSnapshot` corresponds to the execution context that produced the result.
  - No caller can observe a completed result for a different selection or dispatch.
- **Validation**:
  - Add selector regression tests for matched vs stale completed runtime
  - Assert returned snapshot values match the dispatch context, not an unrelated later selection

### Task 1.4: Keep Sprint 1 runnable while the result contract changes

- **Location**:
  - `rooms/laboratory/runtime/lab-execution-dispatcher.ts`
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - Any helper/fixture file that constructs `LabExecutionResult` directly
- **Description**: Update the existing mock result constructor and direct test fixtures to the new F2 result shape as part of the contract sprint, so Sprint 1 remains demoable and type-safe before full action-aware materialization lands.
- **Complexity**: 4
- **Dependencies**: Tasks 1.1-1.3
- **Acceptance Criteria**:
  - The branch still typechecks after the type upgrade even before Sprint 2 materialization logic is complete.
  - Existing tests that construct completed execution runtime data use the new schema with minimal placeholder content.
  - Sprint 1 can still demonstrate a completed execution result, even if the content is temporarily generic.
- **Validation**:
  - `npm run typecheck`
  - Focused runtime/UI tests still pass with placeholder F2-shaped result fixtures

## Sprint 2: Deterministic Result Materialization

**Goal**: Make mock execution completion produce meaningful, action-aware, selection-bounded results.
**Demo/Validation**:

- `analyze-segment`, `focus-region`, and `inspect-audio` each materialize distinct deterministic outputs.
- Artifacts stay inside the selection range.
- Repeating the same execution context yields the same result every time.

### Task 2.1: Build deterministic materialization helpers inside the dispatcher

- **Location**: `rooms/laboratory/runtime/lab-execution-dispatcher.ts`
- **Description**: Add small pure helpers to derive result content from `selectionSnapshot` and `actionType`. Use stable math such as `selection.startMs % N` to vary counts, labels, offsets, and metric values within approved ranges without introducing randomness.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No randomness, external processing, AI, or host calls are introduced.
  - Helper outputs are pure for the same input.
  - Result generation logic is readable enough to unit test per action type.
  - Existing progress timing behavior remains unchanged unless a test requires a small shared helper refactor.
- **Validation**:
  - Dispatcher-level tests that repeat the same input and assert identical outputs
  - Tests for marker counts and metrics staying inside expected deterministic ranges

### Task 2.2: Implement action-specific result mapping

- **Location**: `rooms/laboratory/runtime/lab-execution-dispatcher.ts`
- **Description**: Materialize action-aware completion results:
  - `analyze-segment`: summary plus 2-3 markers inside the selection, structural/anomaly insights, coverage/confidence in the requested ranges
  - `focus-region`: ROI-aware annotation result plus localized-activity insight; when ROI is absent, return a deterministic segment-scoped focus result instead of fabricating ROI output
  - `inspect-audio`: 1-2 time-based markers plus frequency-cluster insight
  - fallback: minimal generic result for unsupported action types
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - All time-based artifacts fall within `selectionSnapshot.startMs..endMs`.
  - `focus-region` respects ROI presence and does not pretend to generate ROI output when ROI is absent.
  - The no-ROI `focus-region` branch has one explicit deterministic contract: segment-scoped annotation/insight output with no fabricated ROI claims.
  - Metrics are deterministic and clamped to the requested windows.
  - Unsupported or future action types degrade to a safe minimal result rather than throwing.
- **Validation**:
  - Unit tests per action type
  - Explicit assertions that artifact `timeRange` boundaries never escape the selection
  - ROI/no-ROI tests for `focus-region` with exact expected branch behavior

### Task 2.3: Preserve lifecycle semantics during result replacement

- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/runtime/lab-execution-dispatcher.ts`
- **Description**: Ensure a new execution clears the previous result immediately, selection changes still invalidate the runtime, and late completion/progress events cannot resurrect stale materialized results.
- **Complexity**: 5
- **Dependencies**: Tasks 2.1-2.2
- **Acceptance Criteria**:
  - Starting a new dispatch resets prior result content before completion.
  - Selection change, new commitment, hydrate, and upstream invalidation edges still clear active result visibility, reusing the existing F1 invalidation matrix instead of creating a second clearing policy.
  - Stale timer callbacks remain harmless because result identity is still dispatch-gated.
- **Validation**:
  - Lifecycle regression extending existing F1 tests
  - Invalidation test that fires late timer callbacks after reset and still observes `null`

## Sprint 3: Minimal Result Visibility And Safety Net

**Goal**: Let the user see meaningful returned content without redesigning the Laboratory UI.
**Demo/Validation**:

- Process panel shows status plus simple textual “Insights” and “Detected elements” after completion.
- No new panel, CTA, export system, or persistence schema appears.
- Regression coverage locks in determinism and local-only behavior.

### Task 3.1: Extend the process panel result rendering

- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Keep the existing inline runtime indicator and extend the completed state with compact text render for:
  - `Insights`: bullet/list style render from `result.insights`
  - `Detected elements`: artifact label list from `result.artifacts`
    Use the selector output instead of reading raw runtime state directly when rendering result content.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - No new panel or button is added.
  - Result content appears only when a valid active completed result exists.
  - Running-state UI remains small and unchanged in spirit.
- **Validation**:
  - UI regression asserting insights and artifact labels appear in markup
  - String/snapshot assertions confirming no new action controls were added

### Task 3.2: Add the smallest necessary copy and styling support

- **Location**:
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/ui/lab-theme.css` if a tiny spacing/list style is needed
- **Description**: Add only minimal labels such as “Insights” and “Detected elements”, plus optional lightweight styling if the current process-panel markup needs spacing or list treatment.
- **Complexity**: 2
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Copy keys remain symmetric in English and Turkish.
  - Styling changes stay local to the process-panel result snippet.
  - No broader theme or layout churn is introduced.
- **Validation**:
  - Focused UI/string regression coverage
  - Targeted visual markup inspection

### Task 3.3: Expand regression coverage for determinism, mapping, and persistence safety

- **Location**:
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-runtime-truth.helpers.ts` if new helpers need re-export
- **Description**: Add regression coverage for:
  - actionType -> result mapping
  - deterministic output for repeated identical inputs
  - artifact boundaries inside selection
  - result clearing on selection change and new execution
  - selector returning `selectionSnapshot`
  - persistence/hydrate leak prevention
- **Complexity**: 7
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - F2 requirements are covered without weakening F1 guardrail assertions.
  - Tests prove no persistence leak for the richer result shape.
  - Source-level regression still confirms dispatcher ownership remains in `lab-root.ts`, not `lab-run-controller.ts`.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `npm run typecheck`

## Testing Strategy

- Selector tests:
  - `getExecutionDispatchCandidate` still gates on commitment + staged readiness
  - `getActiveExecutionResult` returns `selectionSnapshot` only for the active completed dispatch
- Dispatcher tests:
  - same input -> same output
  - per-action materialization shape and copy
  - artifact range clamping inside selection
  - ROI-aware focus behavior
- Store lifecycle tests:
  - new dispatch clears old result
  - selection mutation and commitment replacement clear result visibility
  - late completion after reset is ignored
- UI tests:
  - process panel renders running/completed status
  - completed results show insight rows and artifact labels
  - no new panel/button/export markup appears
- Persistence tests:
  - `executionRuntime` still excluded from `readPersistableState`
  - richer result content does not leak through hydrate or persisted workspace state

## Potential Risks & Gotchas

- `LabExecutionResult` currently uses broad `LabRecord` placeholders. Replacing it with strict structured types may ripple through tests; plan for test fixture updates rather than widening back to generic records.
- The dispatcher currently only receives `LabExecutionDispatchCandidate`. F2 needs more context than F1; decide this explicitly instead of quietly reaching back into live store state, and prefer normalized payload-preview semantics over raw selection objects.
- If result generation depends on `selection.startMs % N`, dispatch identity must remain selection-sensitive or the bridge can reuse the wrong completed result for a changed selection.
- `selectionSnapshot` should be captured at execution time. Deriving it from current live selection in the selector is fragile if the user changes selection near completion.
- Artifact schema does not include spatial ROI coordinates. Do not silently add ROI export fields in this phase; satisfy ROI consistency through annotation semantics and returned selection snapshot.
- `focus-region` can be requested when ROI is missing in broader planning flows. Keep that branch deterministic and segment-scoped instead of inventing fake region output.
- Keep metric values deterministic and clamped. “Interesting” output is welcome, but not if it behaves like hidden randomness.
- Preserve F1 timing/cleanup behavior. Result materialization is a content upgrade, not a lifecycle rewrite.
- Do not move any of this into `lab-run-controller.ts` or the real processing pipeline.

## Rollback Plan

- Revert the `LabExecutionResult` type back to the F1 placeholder contract.
- Remove any added selection snapshot/context fields from the dispatch/result selector path.
- Restore the dispatcher to generic mock completion output.
- Remove result-detail rendering from the process panel and any added copy/styling.
- Re-run the Laboratory runtime/UI regression suites to confirm the room returns to the simpler F1 execution bridge behavior.
