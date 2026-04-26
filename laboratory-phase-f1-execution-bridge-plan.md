# Plan: Laboratory Phase F1 - Execution Bridge

**Generated**: 2026-04-26
**Estimated Complexity**: Medium

## Overview

Add a controlled execution activation layer on top of the existing Laboratory selection -> plan -> staging chain without touching real run machinery. The phase stays UI-scoped, deterministic, reversible, and isolated by introducing a dispatch candidate selector, an ephemeral execution runtime state, and a mock dispatcher that auto-triggers only when a committed staged path exists.

## Assumptions

- Auto-dispatch means a one-shot trigger when a valid dispatch candidate first appears and there is no active/completed runtime for the same stable dispatch identity.
- The new mock flow must not reuse `lab-run-controller.ts` or the real run pipeline; it lives beside them.
- Visibility is satisfied by a small inline process-panel indicator plus selector-readable runtime/result state, not by a new panel or CTA.

## Prerequisites

- Existing passive chain remains the source of truth: `activeExecutionCommitment` + `activeExecutionStaging`.
- Existing persistence contract in [rooms/laboratory/ui/lab-root.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-root.ts) stays authoritative for what is saved.
- Existing runtime regression suites remain the primary safety net:
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`

## Sprint 1: State And Selector Bridge

**Goal**: Make execution dispatchable in state without performing execution yet.
**Demo/Validation**:

- A staged committed path produces a dispatch candidate.
- Store can represent `idle -> running -> completed` in UI-only state.
- Hydrate/persist snapshots do not carry the new runtime state.

### Task 1.1: Define execution runtime types and events

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `ExecutionResult`-style room-local types, `ui.executionRuntime`, and new event contracts for dispatch/progress/completion/reset. Keep the runtime state inside `LabStoreUiState`, not `LabPersistedState`.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - `executionRuntime` supports `idle | running | completed`, `activePlanId`, `progress`, and `result`.
  - Runtime/event types can carry a stable dispatch identity in addition to `activePlanId` so stale completions can be ignored.
  - `workspace-execution-dispatch` exists as an event type.
  - Persistence types remain unchanged except for explicitly excluding the new runtime.
- **Validation**:
  - Typecheck on `lab-types.ts`
  - Search confirms no runtime field was added to `LabPersistedState`

### Task 1.2: Add selector-level dispatch and result derivation

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getExecutionDispatchCandidate(state)` and `getActiveExecutionResult(state)`. Candidate should resolve only from a live commitment + staged staging chain and carry the required `{ planId, payloadPreview, staging }` data, plus a stable dispatch identity if implemented as an additive field. If the selector shape must stay exact, provide a helper that derives the same identity from those fields.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Candidate returns `null` when commitment is missing, stale, or staging is not `staged`.
  - Candidate pulls the current payload preview rather than duplicating payload-building logic.
  - Dispatch identity is derived from the full active chain, including payload preview content or an equivalent deterministic signature, not only `planId`.
  - Active result returns only when runtime is `completed` and the stored dispatch identity still matches the active candidate/commitment chain.
- **Validation**:
  - Add selector regression tests for valid and invalid candidate cases
  - Confirm stale commitment/selection drift clears the selector output

### Task 1.3: Wire store reducers for ephemeral execution runtime

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Initialize `ui.executionRuntime`, handle dispatch/progress/completion/reset events, and clear runtime on the exact invalidation edges that already clear execution intent/commitment.
- **Complexity**: 6
- **Dependencies**: Tasks 1.1-1.2
- **Acceptance Criteria**:
  - `workspace-execution-dispatch` sets `running`, `activePlanId`, and resets prior result/progress.
  - Progress and completion events update only the matching active plan.
  - Progress and completion events also verify dispatch identity before mutating state.
  - Runtime clears on hydrate and on upstream selection/commitment invalidation.
- **Required Clear Cases**:
  - `hydrate`
  - `source-config-patched` when the source reset clears execution intent
  - `workspace-timeline-updated` when the active selection range changes
  - `workspace-selection-intent-updated`
  - `workspace-selection-suggestion-accepted` when the accepted suggestion changes
  - `workspace-selection-suggestion-dismissed` when it clears the active intent
  - `workspace-execution-intent-cleared`
  - `workspace-execution-commitment-set` when it creates a new commitment
  - `workspace-execution-commitment-revoked`
  - `selection-roi-updated`
  - `selection-roi-cleared`
  - `selection-inspection-mode-updated`
- **Validation**:
  - Store lifecycle tests for `idle -> running -> completed`
  - Regression asserting completion is cleared after each required invalidation edge above

## Sprint 2: Controlled Mock Dispatcher

**Goal**: Turn a valid staged commitment into a deterministic mock execution lifecycle without touching the real run controller.
**Demo/Validation**:

- With a valid candidate, the dispatcher starts automatically once.
- Progress advances deterministically to 100 over about 1.5 seconds.
- Completion produces a stable mock result and can be reset/invalidated safely.

### Task 2.1: Create isolated dispatcher runtime

- **Location**: `rooms/laboratory/runtime/lab-execution-dispatcher.ts` (new)
- **Description**: Implement a small dispatcher module that accepts a dispatch candidate, emits store events, and simulates progress on fixed timer steps before emitting completion with deterministic result data. Inject timer functions and emit hooks as deps so runtime behavior is easy to unit test.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No external API, host, queue, or persistence usage.
  - Timer schedule is deterministic and testable.
  - Timer and cleanup behavior is dependency-injected rather than hidden behind raw globals.
  - Result payload is stable and shaped like `{ summary, artifacts: [], metrics: {} }`.
- **Validation**:
  - Unit-style runtime test using timer mocks
  - Assert same input yields same output on repeated runs

### Task 2.2: Orchestrate auto-dispatch from root without touching `lab-run-controller.ts`

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Instantiate the dispatcher in the lab root and subscribe it to store changes or event flow. Trigger only on dispatch identity transitions and ignore rerenders or repeated subscriptions for the same already-running/completed candidate.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `lab-run-controller.ts` stays unchanged.
  - Dispatch is one-shot per dispatch identity unless upstream state resets.
  - Any pending timer is cleaned up when the candidate becomes invalid.
  - Teardown is explicit: wire dispatcher `dispose()` to `beforeunload` or a root cleanup handle, since `startLaboratoryLabRoot()` does not currently return a disposer.
- **Validation**:
  - Root/controller regression test covering single auto-trigger behavior
  - Test that repeated renders/subscriptions do not spawn duplicate mock runs
  - Test that invalidation or unload cleanup prevents late completion events

## Sprint 3: Minimal Visibility And Guardrail Coverage

**Goal**: Expose execution state in the existing process UI and lock in the non-persistence contract.
**Demo/Validation**:

- Process panel shows a small inline execution status during run and after completion.
- No new panel, button, queue, or persistence surface appears.
- Regression suite covers dispatch candidate, lifecycle, clearing, and persistence leak prevention.

### Task 3.1: Add a minimal inline execution indicator

- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Extend the existing process panel rendering with a compact inline message sourced from `ui.executionRuntime`, using copy similar to “Executing plan...” and “Execution complete”. Keep layout unchanged.
- **Complexity**: 3
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Indicator appears only for `running` or `completed`.
  - No new CTA, panel, or redesign is introduced.
  - Existing process summary/journey UI keeps working.
- **Validation**:
  - UI regression test matching the new inline copy in process panel markup
  - Snapshot/string assertions confirm no button/action markup was added
  - Existing regression that keeps `workspace-surface.ts` separate from process-panel rendering remains valid

### Task 3.2: Add i18n keys only if needed by the existing surface

- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add compact strings only if the indicator is wired through normal copy lookup. Reuse existing wording style and avoid creating a broader execution vocabulary.
- **Complexity**: 2
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - English and Turkish keys stay symmetric.
  - No unrelated copy churn.
- **Validation**:
  - Focused string assertions in UI regressions

### Task 3.3: Extend regression coverage and persistence leak checks

- **Location**:
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-controller-runtime-regressions.test.ts` or another targeted runtime suite if orchestration tests fit better there
  - `scripts/tests/laboratory-runtime-truth.helpers.ts` if new selector/dispatcher helpers must be re-exported for tests
- **Description**: Add tests for dispatch candidate validity, runtime lifecycle, result clearing, auto-dispatch idempotence, and persistence exclusion via `readPersistableState` + hydrate.
- **Complexity**: 6
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - Candidate-only-when-valid is covered.
  - `executionRuntime` lifecycle is covered.
  - Result reset on selection/new commitment is covered.
  - Persisted snapshot excludes `executionRuntime`, and hydrate resets it to idle.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts`

## Testing Strategy

- Selector tests:
  - Candidate nullability across missing commitment, non-staged staging, and stale plan chains
  - Result selector returns only for matching completed runtime
- Store tests:
  - Dispatch/progress/completion/reset lifecycle
  - Clearing behavior on selection timeline changes, ROI changes, hydrate, and commitment replacement
- Dispatcher tests:
  - Deterministic timer schedule
  - No duplicate dispatch for same dispatch identity
  - Completion emits stable result payload
  - Cleanup prevents late completion after invalidation/unload
- UI tests:
  - Process panel shows inline running/completed indicator
  - No redesign or new action controls appear
- Persistence tests:
  - `readPersistableState` excludes `executionRuntime`
  - `hydrate` restores idle runtime even if upstream staged data exists

## Potential Risks & Gotchas

- `rooms/laboratory/runtime/lab-execution-bridge.ts` already exists and currently means payload preview logic. Do not overload that file; keep real activation logic in `lab-execution-dispatcher.ts`.
- Keep new reducer events workspace-scoped and UI-only. Avoid event names that imply host-run integration or queue semantics in this phase.
- Store subscriptions in `lab-root.ts` rerun often. Auto-dispatch must be keyed by a stable dispatch identity to avoid infinite re-dispatch.
- Upstream resets already clear intent/commitment in several reducer paths. `executionRuntime` must follow the exact invalidation cases listed in Task 1.3 or the UI will show stale “complete” state for the wrong selection.
- Completion state can outlive the active staged chain if the user changes selection immediately after timers finish. `getActiveExecutionResult` must verify dispatch identity, not just `status === completed` or `activePlanId`.
- Timer cleanup matters for test determinism and for preventing late completion events after a reset.
- Keep `LabPersistedState` and `readPersistableState()` clean; this phase must not silently create a new persistence schema need.
- Avoid expanding `LabGlobalProcessSummary` unless strictly necessary. The inline indicator can satisfy observability without reworking existing process-state semantics.
- The process-panel renderer is `workspace-process-panel.ts`; do not accidentally add the indicator to `workspace-surface.ts` unless the intent changes to the global process summary.

## Rollback Plan

- Delete `lab-execution-dispatcher.ts` and remove its instantiation from `lab-root.ts`.
- Remove `executionRuntime` state/events/selectors from `lab-types.ts`, `lab-store.ts`, and `lab-selectors.ts`.
- Remove the inline process indicator and any new i18n keys.
- Re-run the Laboratory runtime/UI regression suites to confirm the room returns to passive staging-only behavior.
