# Plan: Laboratory Phase 4.9 Execution Staging Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview

Phase 4.9 adds a passive execution staging layer to the Laboratory execution-thinking chain:

Selection -> Suggestion -> Preview -> Intent -> Plan -> Simulation -> Readiness -> Payload Preview -> Reflection -> Alternatives -> Candidate -> Commitment -> Staging

The layer answers whether a user-committed path is prepared enough to be staged for future execution, without triggering execution, touching `lab-run-controller.ts`, creating queues, generating assets, or adding persisted state. The implementation should follow the existing passive chain pattern used by execution simulation, readiness, payload preview, reflection, alternatives, and candidate: a pure runtime builder, selector integration, view-model exposure, passive UI rendering, styling, and regression coverage.

## Prerequisites

- Work from the source room only: `rooms/laboratory`.
- Refresh `data/rooms/laboratory` only through `installFromWorkspace("laboratory")`; do not peer-edit installed generated files by hand.
- Preserve Phase 4.8 commitment semantics: `activeExecutionCommitment` remains UI-scoped, explicit user action only, and non-persisted.
- Keep `rooms/laboratory/runtime/lab-run-controller.ts` untouched.
- Do not add execution dispatch, queue integration, analysis pipeline integration, asset/export generation, async behavior, AI calls, fetch, timers, or randomness.

## Assumptions And Clarified Semantics

- `LabExecutionStaging` is selector-derived only. It is not stored in `lab-store.ts` and does not require new events.
- `commitment missing` returns `null`, not `not-staged`.
- `candidate.status === "not-viable"` returns `null`, not `not-staged`.
- `readiness.status === "blocked"` returns `null`, not `not-staged`.
- `not-staged` is reserved for a structurally resolved committed chain that is valid enough to evaluate, but not currently stageable because the payload preview readiness pass is false or an upstream readiness alignment note prevents staging.
- UI forbidden word checks for this phase should be scoped to the staging panel markup, not the entire timeline render, because Phase 4.8 already contains the legitimate term "commitment".
- The model field remains `commitmentStatus`, but the staging panel must not render literal "commit", "committed", or "commitment" copy. Use neutral UI wording such as "User choice" and render `committed` as "Chosen".

## Sprint 1: Model And Runtime Builder

**Goal**: Add the staging type and a deterministic, side-effect-free builder.

**Demo/Validation**:
- Import the new runtime module in a test and construct staging objects from resolved upstream fixtures.
- Verify stable ID, null propagation, status mapping, notes, warnings, and deterministic output.

### Task 1.1: Add Staging Model Types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabExecutionStagingStatus` and `LabExecutionStaging` near the existing execution candidate and commitment models.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabExecutionStagingStatus` is `"staged" | "not-staged"`.
  - `LabExecutionStaging` includes `id`, `planId`, `status`, `summary`, `commitmentStatus`, `candidateStatus`, `readinessStatus`, optional `notes`, optional `warnings`, and optional `confidence`.
  - Types reuse existing status unions where practical to reduce drift.
- **Validation**:
  - `npm run rooms:typecheck`
  - `hev_dev_check_syntax` on `rooms/laboratory/models/lab-types.ts`

### Task 1.2: Create Pure Runtime Staging Module

- **Location**: `rooms/laboratory/runtime/lab-execution-staging.ts`
- **Description**: Add a pure builder module with `buildExecutionStagingFromResolved(input): LabExecutionStaging | null`.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Exports a resolved input type similar to `LabExecutionCandidateResolvedInput`.
  - Accepts `executionPlan`, `executionSimulation`, `executionReadiness`, `executionPayloadPreview`, `executionReflection`, `executionAlternatives`, `executionCandidate`, `executionCommitment`, and `activeSelection`.
  - Returns `null` if any required upstream value is missing.
  - Returns `null` if `executionCommitment.status !== "committed"`.
  - Returns `null` if `executionCandidate.status === "not-viable"`.
  - Returns `null` if `executionReadiness.status === "blocked"`.
  - Returns `null` if `activeSelection.startMs` or `activeSelection.endMs` is not finite, or `activeSelection.endMs <= activeSelection.startMs`.
  - Rejects mismatched plan IDs across plan, simulation, readiness, payload preview, reflection, alternatives, candidate, and commitment.
  - Rejects stale commitment/candidate drift when `executionCommitment.candidateStatus !== executionCandidate.status`.
  - Produces `id = "staging:" + executionPlan.id`.
  - Uses no store access, DOM, fetch, AI, random, timers, controller imports, or side effects.
- **Validation**:
  - `npm run rooms:typecheck`
  - `hev_dev_check_syntax` on `rooms/laboratory/runtime/lab-execution-staging.ts`

### Task 1.3: Implement Status, Notes, Warnings, And Confidence Rules

- **Location**: `rooms/laboratory/runtime/lab-execution-staging.ts`
- **Description**: Encode deterministic staging synthesis.
- **Complexity**: 4/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `staged` when commitment is committed, candidate is viable or unstable, readiness is not blocked, and `executionPayloadPreview.readinessPassesPreview === true`.
  - `not-staged` when commitment is committed and the chain is coherent, but payload preview readiness does not pass.
  - Summary uses passive copy:
    - Staged: "This path is prepared and can be staged for execution."
    - Not staged: "This path is not currently in a staged state."
  - `commitmentStatus` is `"committed"` for returned staging objects.
  - `candidateStatus` mirrors candidate status.
  - `readinessStatus` mirrors readiness status.
  - Notes include `needs-review` readiness and meaningful alternative pressure.
  - Warnings include unstable candidate, payload preview readiness mismatch, simulation warnings, and candidate uncertainties where present.
  - Confidence is derived deterministically from commitment, candidate, readiness, reflection, simulation, alternatives, and payload context; clamp to a stable range and round consistently.
- **Validation**:
  - Runtime tests added in Sprint 4.

## Sprint 2: Selector And View Model Integration

**Goal**: Expose staging through the existing derived selector chain and timeline view model without adding store state.

**Demo/Validation**:
- A committed valid chain resolves to `getActiveExecutionStaging(state)`.
- Missing commitment or stale upstream resolves to `null`.

### Task 2.1: Add Selector Import And `getActiveExecutionStaging`

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Import the new builder and add `getActiveExecutionStaging(state): LabExecutionStaging | null`.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Resolves all required upstream selectors:
    - `getActiveExecutionPlan`
    - `getActiveExecutionSimulation`
    - `getActiveExecutionReadiness`
    - `getActiveExecutionPayloadPreview`
    - `getActiveExecutionReflection`
    - `getActiveExecutionAlternatives`
    - `getActiveExecutionCandidate`
    - `getActiveExecutionCommitment`
    - `getActiveSelection`
  - Calls `buildExecutionStagingFromResolved`.
  - Any missing upstream returns `null`.
  - No store mutation and no event emission.
- **Validation**:
  - `npm run rooms:typecheck`
  - Selector runtime tests in Sprint 4

### Task 2.2: Add Staging To Timeline View Model

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**: Add `activeExecutionStaging?: LabExecutionStaging | null`.
- **Complexity**: 2/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Import `LabExecutionStaging`.
  - Extend the timeline model type without changing existing fields.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.3: Wire Staging Into `getWaveformTimelineModel`

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `activeExecutionStaging: getActiveExecutionStaging(state)` to the model builder.
- **Complexity**: 2/10
- **Dependencies**: Task 2.1 and Task 2.2
- **Acceptance Criteria**:
  - Timeline render model receives staging only as derived data.
  - No persistence or hydrate changes.
- **Validation**:
  - `npm run rooms:typecheck`
  - Existing UI evaluation tests still compile and run.

## Sprint 3: Passive UI Rendering And Styling

**Goal**: Render the staging panel only when staging exists, with calm passive copy and no execution affordance.

**Demo/Validation**:
- The staging panel appears under the existing commitment/candidate chain when a staged committed path exists.
- The panel does not render for preview-only, missing commitment, not-viable candidate, or blocked readiness cases.

### Task 3.1: Add Staging Renderer

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Import `LabExecutionStaging` and add `renderExecutionStaging(staging)`.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Renders `<div class="lab-execution-staging" data-lab-execution-staging="true">`.
  - Shows summary.
  - Shows status badge for `staged` or `not-staged`.
  - Shows user choice state, candidate status, and readiness status.
  - Does not render literal `commit`, `committed`, or `commitment` wording inside the staging panel; map `commitmentStatus: "committed"` to neutral visible copy such as "Chosen".
  - Shows notes list when present.
  - Shows warnings list when present.
  - Shows confidence when present.
  - Uses `escapeHtml` for all dynamic text.
  - Does not include buttons, click handlers, dispatch attributes, or CTA styling hooks.
- **Validation**:
  - UI tests in Sprint 4
  - Manual markup review for forbidden action words scoped to staging panel.

### Task 3.2: Insert Staging Panel Into Timeline Render

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Resolve `activeExecutionStaging` from the model only when a semantic selection and active commitment exist, then render it after the commitment panel.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Rendering order remains:
    - alternatives
    - candidate
    - commitment
    - staging
  - Staging is not rendered if `activeExecutionStaging` is `null`.
  - Staging does not change candidate or commitment interaction behavior.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 3.3: Add Staging Styles

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add `.lab-execution-staging`, `.lab-execution-staging__badge`, `.lab-execution-staging__notes`, and related passive visual styles.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Visual tone is calmer than candidate and more ready-state than reflection.
  - No CTA emphasis.
  - Warning styling is visible but not alarming unless needed.
  - Styles do not disturb existing commitment/candidate panels.
- **Validation**:
  - `npm run rooms:lint`
  - Visual smoke through installed room if needed.

## Sprint 4: Runtime And UI Regression Coverage

**Goal**: Prove staging is passive, derived, deterministic, and non-persistent.

**Demo/Validation**:
- Runtime and UI tests pass with staging-specific assertions.
- Full room validation passes after installation refresh.

### Task 4.1: Add Runtime Tests For Staging Builder

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add direct builder tests, using existing execution chain fixtures where possible.
- **Complexity**: 5/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - committed + viable -> staged
  - committed + unstable -> staged
  - committed + not-viable -> null
  - missing commitment -> null
  - inactive commitment -> null
  - revoked commitment -> null
  - blocked readiness -> null
  - payload readiness mismatch -> not-staged
  - planId mismatch -> null
  - candidate status drift from commitment snapshot -> null
  - invalid selection range -> null
  - deterministic output for same input
  - stable `id = "staging:" + plan.id`
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.2: Add Selector And Persistence Tests

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add selector tests and ensure staging never leaks into persisted state.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2 and Task 4.1
- **Acceptance Criteria**:
  - `getActiveExecutionStaging(state)` returns staging only for a committed valid chain.
  - Selector returns `null` for missing commitment, stale commitment, stale candidate, blocked readiness, or invalid selection.
  - `readPersistableState()` has no `activeExecutionStaging`.
  - Hydrate does not restore staging.
  - Existing commitment persistence tests remain green.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.3: Add UI Evaluation Tests

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Add staging panel render assertions and passive-copy checks.
- **Complexity**: 4/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Staging panel renders when `activeExecutionStaging` exists.
  - Missing upstream does not render the staging panel.
  - Preview-only does not render the staging panel.
  - The staging panel markup does not contain forbidden action words:
    - Run
    - Execute
    - Apply
    - Start
    - Commit
    - Queue
  - The forbidden-word assertion is scoped to `data-lab-execution-staging="true"` markup.
  - The staging panel uses neutral copy for choice state and does not visibly print `commitmentStatus` values verbatim.
  - Passive tone appears: "prepared", "staged", or "not currently staged".
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

## Sprint 5: Install Refresh And Guardrail Validation

**Goal**: Refresh installed Laboratory assets and verify the implementation stayed within passive boundaries.

**Demo/Validation**:
- Source and installed room copies are aligned through install.
- Guardrail checks show no controller, execution, queue, persistence, async, or network coupling.

### Task 5.1: Run Source Validation

- **Location**: Project root
- **Description**: Run source-level validations before install.
- **Complexity**: 3/10
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Typecheck passes.
  - Lint passes.
  - Build passes.
  - Targeted runtime and UI tests pass.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 5.2: Refresh Installed Laboratory Copy

- **Location**: `data/rooms/laboratory`, `config/rooms.json`
- **Description**: Run `installFromWorkspace("laboratory")` through the existing room package manager flow.
- **Complexity**: 2/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Generated `data/rooms/laboratory` files include the compiled staging module and updated UI/runtime copies.
  - No manual edits are made directly to generated installed room files.
- **Validation**:
  - Install command succeeds.
  - `git status --short` reflects source changes plus generated install refresh.

### Task 5.3: Run Full Regression And Guardrail Checks

- **Location**: Project root
- **Description**: Complete full validation after install refresh.
- **Complexity**: 4/10
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Full core room regression passes.
  - `lab-run-controller.ts` remains unchanged.
  - No execution dispatch, queue, asset/export, analysis runner, async, fetch, or persistence coupling is introduced by staging.
  - No staging state, staging events, or staging binder handlers are added to `lab-store.ts` or `lab-selection-suggestion-binder.ts`.
  - `git diff --check` is clean.
- **Validation**:
  - `npm run rooms:test:core`
  - `git diff -- rooms/laboratory/runtime/lab-run-controller.ts`
  - `rg -n "activeExecutionStaging|LabExecutionStaging|lab-execution-staging" rooms/laboratory data/rooms/laboratory scripts/tests`
  - `rg -n "run-controller|dispatch|fetch|async|setTimeout|Date\\.now|Math\\.random" rooms/laboratory/runtime/lab-execution-staging.ts`
  - `rg -n "activeExecutionStaging|workspace-execution-staging|data-lab-execution-staging" rooms/laboratory/runtime/lab-store.ts rooms/laboratory/ui/lab-selection-suggestion-binder.ts`
  - `git diff --check`

## Testing Strategy

- Runtime truth tests cover the staging builder, selector null propagation, identity stability, deterministic behavior, and persistence leak prevention.
- UI evaluation tests cover panel rendering, no-render states, passive tone, and forbidden action words scoped to the staging panel.
- Existing Phase 4.6-4.8 tests remain the baseline for alternatives, candidate, and commitment behavior.
- Full validation sequence:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `installFromWorkspace("laboratory")`
  - `npm run rooms:test:core`

## Potential Risks & Gotchas

- **`not-staged` can become unreachable if the builder returns null for every non-staged path.**
  - Mitigation: reserve `not-staged` for committed coherent chains where `readinessPassesPreview` is false, while missing commitment, not-viable candidate, and blocked readiness still return null.
- **Forbidden word checks can falsely fail because Phase 4.8 uses "commitment".**
  - Mitigation: scope forbidden word assertions to the staging panel markup only and render the staging choice state as neutral visible copy such as "User choice: Chosen".
- **Selector recomputation can produce inconsistent upstream objects if plan IDs drift.**
  - Mitigation: runtime builder must verify plan ID consistency across every upstream layer and return null on mismatch.
- **A commitment can become stale if the candidate status changes after it was chosen.**
  - Mitigation: runtime builder must reject `executionCommitment.candidateStatus !== executionCandidate.status`, matching the existing selector guard.
- **Invalid selection ranges can slip into direct builder tests even if selectors usually filter them.**
  - Mitigation: runtime builder must reject non-finite or non-positive selection ranges directly.
- **Staging might accidentally become stored state.**
  - Mitigation: do not add staging to `LabStoreUiState`, events, reducer, hydrate, binder handlers, or persistence; expose only through `getActiveExecutionStaging`.
- **The UI could imply execution readiness too strongly.**
  - Mitigation: use passive copy and no CTA controls; avoid forbidden words in the staging panel.
- **Generated installed copy drift can occur if files are edited manually under `data/rooms/laboratory`.**
  - Mitigation: edit only `rooms/laboratory`, then run `installFromWorkspace("laboratory")`.
- **Guardrail greps can overmatch words like "analysis" in passive documentation text.**
  - Mitigation: inspect matches manually and focus on imports/calls that create coupling, not harmless test descriptions.

## Rollback Plan

- Remove `LabExecutionStaging` model additions from `rooms/laboratory/models/lab-types.ts`.
- Delete `rooms/laboratory/runtime/lab-execution-staging.ts`.
- Remove `getActiveExecutionStaging` and the timeline model field from `rooms/laboratory/runtime/lab-selectors.ts`.
- Remove `activeExecutionStaging` from `rooms/laboratory/ui/lab-waveform-timeline-types.ts`.
- Remove staging renderer and render insertion from `rooms/laboratory/ui/lab-waveform-timeline-render.ts`.
- Remove `.lab-execution-staging*` styles from `rooms/laboratory/ui/lab-theme.css`.
- Remove staging tests from the runtime and UI regression files.
- Rerun `installFromWorkspace("laboratory")` to refresh generated installed files.
- Rerun typecheck, lint, build, targeted tests, and core regression.
