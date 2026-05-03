# Plan: Laboratory Phase 4.8 - Execution Commitment Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium-High

## Overview

Laboratory Phase 4.8 adds a passive, UI-scoped "execution commitment" layer at the end of the existing execution-thinking chain:

Selection -> Suggestion -> Preview -> Intent -> Plan -> Simulation -> Readiness -> Payload Preview -> Reflection -> Alternatives -> Candidate -> Commitment

The commitment layer is not execution. It lets the user explicitly mark a resolved, structurally valid candidate as the path they are choosing before any future execution integration exists. The commitment is stored only in transient UI state, is guarded by the active candidate, and is cleared whenever upstream context changes.

Core distinction:

- Intent means "I may want this."
- Candidate means "The system sees this as structurally viable or unstable."
- Commitment means "The user consciously chooses this path."

No run, queue, analysis, export, asset generation, AI call, fetch, async workflow, or persistence is introduced in this phase.

## Current Codebase Context

- `rooms/laboratory/runtime/lab-execution-candidate.ts` already produces the final passive candidate object from the full upstream chain.
- `rooms/laboratory/runtime/lab-selectors.ts` exposes `getActiveExecutionCandidate(state)` and feeds it into the waveform timeline model.
- `rooms/laboratory/runtime/lab-store.ts` currently stores UI-only `activeExecutionIntentId`, `activeSuggestionPreviewId`, `inspectionMode`, `roiFocusActive`, and `activeInspectionSnapshot`.
- `rooms/laboratory/ui/lab-selection-suggestion-binder.ts` already handles passive intent accept/dismiss/queue/clear controls via data attributes.
- `rooms/laboratory/ui/lab-waveform-timeline-render.ts` renders the passive chain panels up to `Execution candidate`.
- `rooms/laboratory/ui/lab-root.ts` persists `state.ui.workspace` but not top-level UI fields like `activeExecutionIntentId`. Phase 4.8 must keep commitment out of persisted state.
- Runtime regression coverage lives mostly in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`.
- UI rendering/passive language coverage lives mostly in `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

## Assumptions

- "button yok" is interpreted as "no execution CTA button." The explicit user action still needs an accessible passive control, likely a small toggle-style `button` or equivalent element handled by the existing binder pattern. It must not say Run, Execute, Apply, Start, or dispatch execution.
- `committedAt` can use `Date.now()` inside the store reducer because the requested model includes a timestamp and the store already uses `Date.now()` for UI/user-action metadata. Tests should assert numeric bounds instead of exact equality.
- The commitment panel can use the word "commitment" as a layer name, but user-facing control copy should prefer softer language like "Choose this path" and "Revoke choice" to avoid execution semantics.
- The installed copy under `data/rooms/laboratory` should be regenerated through `installFromWorkspace("laboratory")`; source of truth remains `rooms/laboratory`.

## Prerequisites

- Work from `rooms/laboratory` source files, not installed `data/rooms/laboratory` copies.
- Do not modify `rooms/laboratory/runtime/lab-run-controller.ts`.
- Do not add persistence fields to `LabPersistedState`, `readPersistableState`, hydrate payloads, or workspace snapshot state.
- Keep event handling synchronous and deterministic except for `committedAt: Date.now()`.
- Maintain existing Phase 4.x passive chain tests.
- Preserve the existing `.lab-execution-candidate` invariant: the candidate panel stays structural and button-free. Commitment controls render in a separate final commitment block.

## Sprint 1: Model And Store Contract

**Goal**: Add the transient commitment type, event contract, store field, and lifecycle clearing primitives without UI rendering yet.

**Demo/Validation**:

- TypeScript accepts the new model and events.
- Store starts with `activeExecutionCommitment: null`.
- Hydrate does not restore any commitment.
- No persistence surface contains commitment.

### Task 1.1: Add Commitment Model Types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabExecutionCommitmentStatus` and `LabExecutionCommitment` near the existing Phase 4.x execution model interfaces.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabExecutionCommitmentStatus` supports `inactive`, `committed`, and `revoked`.
  - `LabExecutionCommitment` includes `id`, `planId`, `status`, `candidateStatus`, `summary`, optional `committedAt`, `notes`, `uncertainties`, and `confidence`.
  - `candidateStatus` references the same status union as `LabExecutionCandidate["status"]` or an equivalent literal union.
  - Stored active commitments use only `status: "committed"` in Phase 4.8.
  - `inactive` and `revoked` remain type-level states for explicit model vocabulary/future UI snapshots, but revoke currently clears `activeExecutionCommitment` to `null` instead of storing a revoked object.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add UI-Scoped Store Field

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add `activeExecutionCommitment: LabExecutionCommitment | null` to `LabStoreUiState` and initialize it to `null` in `createInitialState()`.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Field exists only under `state.ui`.
  - Default state is `null`.
  - Field is not added to `LabPersistedState`.
  - Field is not added under `LabWorkspaceUiState`.
- **Validation**:
  - Runtime test asserting initial state is null.
  - Persistence test asserting the key is absent from persisted root and `workspace`.

### Task 1.3: Add Commitment Events

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Extend `LabStoreEvent` with passive commitment events:
  - `workspace-execution-commitment-set` with `planId: string`
  - `workspace-execution-commitment-revoked`
- **Complexity**: 2/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Events are typed alongside the existing V2.3 workspace execution events.
  - No event includes payload details beyond `planId` for set.
- **Validation**:
  - Typecheck catches reducer/binder event shape errors.

### Task 1.4: Add Store Helpers For Commitment Lifecycle

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add small helpers such as `clearExecutionCommitment(state)` and `createExecutionCommitmentFromCandidate(candidate)` or equivalent local logic.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - Clearing sets `state.ui.activeExecutionCommitment = null`.
  - Helper derives `id` as `commitment:${planId}`.
  - Helper copies `candidate.status`, `notes`, `uncertainties`, and `confidence`.
  - Helper produces a short passive summary from candidate status.
- **Validation**:
  - Unit tests for valid commitment object shape through reducer events.

## Sprint 2: Reducer Guards And Lifecycle Rules

**Goal**: Make commitment set/revoke behavior safe, candidate-gated, and automatically cleared by upstream changes.

**Demo/Validation**:

- A valid candidate can be committed.
- A not-viable candidate cannot be committed.
- Stale or mismatched `planId` is ignored.
- Selection, ROI, inspection mode, source/project, and intent changes clear commitment.
- Preview clear and panel refresh do not clear commitment.

### Task 2.1: Import Candidate Selector Into Store Safely

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Use `getActiveExecutionCandidate(state)` from selectors inside reducer guard logic, similar to existing selector imports. Avoid adding a new runtime module unless import cycles appear.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Store can resolve the current candidate during `workspace-execution-commitment-set`.
  - No circular import runtime failure appears in tests.
  - Candidate null blocks commitment.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 2.2: Implement Commitment Set Reducer Case

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Handle `workspace-execution-commitment-set`.
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Trims and validates `event.planId`.
  - Resolves active candidate.
  - Requires `candidate.planId === planId`.
  - Requires `candidate.status !== "not-viable"`.
  - Ignores invalid events without mutating existing state.
  - Creates a commitment with `status: "committed"` and `committedAt: Date.now()`.
- **Validation**:
  - Valid candidate -> commitment created.
  - Not-viable candidate -> commitment remains null.
  - Plan mismatch -> ignored.
  - Missing/blank `planId` -> ignored if type-level test constructs malformed input.

### Task 2.3: Implement Commitment Revoke Reducer Case

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Handle `workspace-execution-commitment-revoked`.
- **Complexity**: 2/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Always clears commitment.
  - Does not clear intent, preview, selection, candidate, or inspection mode.
- **Validation**:
  - Revoke test after valid commitment.
  - Revoke test when already null.

### Task 2.4: Extend Existing Clear Paths

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Ensure commitment clears with the same upstream-changing events that clear execution intent or invalidate candidate.
- **Complexity**: 5/10
- **Dependencies**: Task 2.2, Task 2.3
- **Acceptance Criteria**:
  - `clearExecutionIntent(state)` also clears commitment, or every intent-clear path explicitly clears both.
  - Timeline range changes clear commitment.
  - Selection intent changes clear commitment.
  - ROI update/clear clears commitment.
  - Inspection mode changes clear commitment.
  - Source/project changes clear commitment via existing selection reset paths.
  - Hydrate clears commitment.
  - Preview clear does not clear commitment.
  - `workspace-selection-suggestion-preview-cleared` does not clear commitment.
- **Validation**:
  - Lifecycle regression tests for every required clear/keep rule.

### Task 2.5: Add Selector Guard

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getActiveExecutionCommitment(state)`.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1, Sprint 2.2
- **Acceptance Criteria**:
  - Returns `null` if stored commitment is null.
  - Resolves active candidate.
  - Returns `null` if candidate is null.
  - Returns `null` if `candidate.planId !== commitment.planId`.
  - Returns `null` if `commitment.status !== "committed"`.
  - Returns `null` if candidate status is `not-viable`.
  - Returns commitment if all guards pass.
- **Validation**:
  - Selector test for valid commitment.
  - Selector test for non-committed stored status returning null.
  - Selector test for stale commitment after selection/candidate drift.

## Sprint 3: Binder And Timeline Model Integration

**Goal**: Wire passive UI controls to commitment events without execution affordances.

**Demo/Validation**:

- Candidate panel can expose a passive "choose this path" toggle when candidate is viable or unstable.
- Not-viable candidate does not expose a set control.
- Revoke control is available when a commitment is active.
- Binder emits only commitment events.

### Task 3.1: Extend Timeline View Model

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-types.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `activeExecutionCommitment?: LabExecutionCommitment | null` to the waveform timeline model and populate it from `getActiveExecutionCommitment(state)`.
- **Complexity**: 3/10
- **Dependencies**: Task 2.5
- **Acceptance Criteria**:
  - Model exposes commitment only through selector guard.
  - UI render can gate on candidate + commitment together.
- **Validation**:
  - Typecheck and render tests.

### Task 3.2: Add Binder Data Attributes

- **Location**: `rooms/laboratory/ui/lab-selection-suggestion-binder.ts`
- **Description**: Extend the click binder with:
  - `data-lab-execution-commitment-set`
  - `data-lab-execution-commitment-revoke`
- **Complexity**: 4/10
- **Dependencies**: Sprint 1 events
- **Acceptance Criteria**:
  - Set control reads plan id and emits `workspace-execution-commitment-set`.
  - Revoke control emits `workspace-execution-commitment-revoked`.
  - Binder does not dispatch run, queue, analysis, asset, or host events.
  - Binder does not require active suggestion preview for commitment set; candidate validity is store-enforced.
  - Binder prevents default for handled passive controls.
- **Validation**:
  - Source grep/test verifies no run-controller or execution dispatch references.
  - Event bus/binder unit-style test if existing test harness supports DOM-like click simulation.

### Task 3.3: Define Passive Control Copy

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Use non-execution copy for set/revoke controls.
- **Complexity**: 2/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Preferred set copy: `Choose this path`.
  - Preferred active copy: `Path chosen`.
  - Preferred revoke copy: `Revoke choice`.
  - Avoid forbidden execution CTA words: Run, Execute, Apply, Start.
  - Avoid "Commit" as a control label even though the model is named commitment.
- **Validation**:
  - UI tests scope forbidden-word checks to commitment panel and controls.

## Sprint 4: Commitment UI Rendering And Styling

**Goal**: Render a passive commitment panel that feels finalized but not executable.

**Demo/Validation**:

- A committed path shows a `data-lab-execution-commitment="true"` panel.
- Panel shows candidate status, relative timestamp, notes, uncertainties, and confidence.
- Panel disappears if candidate becomes invalid.
- Panel has no execution CTA.

### Task 4.1: Render Candidate Commitment Control

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add passive controls in a separate commitment block immediately after the `Execution candidate` panel, based on `activeExecutionCandidate` and `activeExecutionCommitment`.
- **Complexity**: 5/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Do not add buttons, click handlers, or data-action attributes inside `.lab-execution-candidate`.
  - Control appears only when candidate exists and candidate status is not `not-viable`.
  - If no commitment exists, the set control uses `data-lab-execution-commitment-set="${planId}"`.
  - If commitment exists for the active candidate, active state is shown and revoke control uses `data-lab-execution-commitment-revoke="true"`.
  - Not-viable candidates show passive explanatory text instead of a set control.
  - No control uses execution language.
- **Validation**:
  - Render tests for viable, unstable, not-viable, and no-candidate cases.
  - Existing candidate UI tests still assert `.lab-execution-candidate` has no `<button>`.

### Task 4.2: Render Commitment Panel

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add `renderExecutionCommitment(commitment, candidate)` and place it after candidate or as a final block under it.
- **Complexity**: 5/10
- **Dependencies**: Task 3.1, Task 4.1
- **Acceptance Criteria**:
  - Root has `data-lab-execution-commitment="true"`.
  - Shows summary.
  - Shows status badge: committed.
  - Shows candidate status reference.
  - Shows relative or concise timestamp from `committedAt`.
  - Shows notes and uncertainties when present.
  - Shows confidence when present.
  - Renders only when active candidate and guarded commitment both exist.
- **Validation**:
  - UI render tests assert presence and gating.

### Task 4.3: Add Commitment Styles

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add `.lab-execution-commitment*` styles.
- **Complexity**: 3/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Visual tone is "finalized but passive."
  - Uses a stable border/accent distinct from candidate.
  - No CTA emphasis, no oversized primary action treatment.
  - Works inside the existing selection panel width.
- **Validation**:
  - Existing UI tests continue passing.
  - Optional Electron/manual screenshot after install if app smoke is needed.

### Task 4.4: Add Time Formatting Helper

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add a small deterministic-friendly helper for `committedAt`.
- **Complexity**: 2/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Invalid/missing timestamp renders nothing or `Recently chosen`.
  - Valid timestamp renders concise relative copy, e.g. `Chosen recently`, or an absolute local time if existing formatter patterns support it.
  - Helper avoids introducing timers or live refresh loops.
- **Validation**:
  - UI test with fixed timestamp.

## Sprint 5: Runtime And UI Regression Coverage

**Goal**: Lock the passive commitment semantics with tests so future execution integration cannot accidentally cross the boundary.

**Demo/Validation**:

- Targeted runtime and UI tests pass.
- Persistence leak tests cover commitment.
- Guardrail grep confirms no run-controller changes.

### Task 5.1: Runtime Commitment Creation Tests

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests around store events and selector output.
- **Complexity**: 5/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Valid candidate -> commitment created.
  - Commitment id is `commitment:${planId}`.
  - `committedAt` is a finite number and within before/after bounds.
  - Candidate status, notes, uncertainties, and confidence are copied.
  - `getActiveExecutionCommitment(state)` returns the guarded commitment.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.2: Runtime Rejection Tests

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests for invalid set attempts.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Candidate null -> ignored.
  - Not-viable candidate -> ignored.
  - Plan id mismatch -> ignored.
  - Selector returns null for stale stored commitment if candidate drift occurs.
- **Validation**:
  - Targeted runtime suite.

### Task 5.3: Runtime Lifecycle Tests

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Extend existing intent/candidate lifecycle tests.
- **Complexity**: 5/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Selection timeline change clears commitment.
  - ROI update clears commitment.
  - ROI clear clears commitment.
  - Inspection mode change clears commitment.
  - Source/project change clears commitment.
  - Intent clear/change clears commitment.
  - Preview clear preserves commitment.
  - Pause/panel refresh has no commitment-specific mutation.
- **Validation**:
  - Targeted runtime suite.

### Task 5.4: Persistence Leak Tests

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`, `rooms/laboratory/ui/lab-root.ts`
- **Description**: Extend existing persistence leak assertions.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1, Sprint 2
- **Acceptance Criteria**:
  - `activeExecutionCommitment` is absent from persisted root.
  - `activeExecutionCommitment` is absent from persisted `workspace`.
  - Hydrate clears active commitment.
  - No `LabPersistedState` field exists for commitment.
- **Validation**:
  - Targeted runtime suite.

### Task 5.5: UI Render Tests

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Add commitment panel render and passive language tests.
- **Complexity**: 5/10
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Panel renders only when commitment and valid candidate exist.
  - Preview-only state does not render commitment.
  - Candidate missing does not render commitment.
  - Stale commitment does not render through model gating.
  - Panel shows committed status, candidate status, notes, uncertainties, and confidence.
  - Panel/control copy excludes forbidden execution verbs as CTAs.
  - Controls emit passive data attributes only.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 5.6: Guardrail Tests And Greps

- **Location**: shell validation, optional assertions in tests
- **Description**: Add or run explicit guardrail checks.
- **Complexity**: 3/10
- **Dependencies**: All implementation tasks
- **Acceptance Criteria**:
  - `git diff -- rooms/laboratory/runtime/lab-run-controller.ts` is empty.
  - No queue/analysis/asset/export dispatch added by commitment binder or reducer.
  - No async/fetch/AI/random introduced in commitment-specific runtime logic.
  - No persistence leak in `readPersistableState`.
- **Validation**:
  - `rg` guardrail checks.
  - `git diff --check`.

## Sprint 6: Workspace Install And Full Validation

**Goal**: Refresh the installed room copy and verify the full Laboratory/rooms contract.

**Demo/Validation**:

- Source and installed room copy are in parity.
- Core test suites pass.
- Build/lint/typecheck pass.

### Task 6.1: Regenerate Installed Laboratory Copy

- **Location**: `data/rooms/laboratory`, `config/rooms.json`
- **Description**: Run the existing workspace install flow after source changes.
- **Complexity**: 2/10
- **Dependencies**: Sprint 1-5
- **Acceptance Criteria**:
  - Installed copy includes generated JS/CSS for commitment changes.
  - No manual peer edit is made directly in installed copy.
- **Validation**:
  - `installFromWorkspace("laboratory")`

### Task 6.2: Run Required Validation Suite

- **Location**: project root
- **Description**: Run the same validation gate used for Phase 4.7.
- **Complexity**: 4/10
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:lint` passes.
  - `npm run rooms:build` passes.
  - Targeted runtime test file passes.
  - Targeted UI test file passes.
  - `npm run rooms:test:core` passes.
  - `git diff --check` passes.
- **Validation**:
  - Record exact pass/fail results in final implementation report.

### Task 6.3: Final Conformance Review

- **Location**: sub-agent review prompt, source files
- **Description**: Ask a sub-agent to compare the Phase 4.8 plan against the final implementation and report findings without questions.
- **Complexity**: 3/10
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - Review checks guardrails, persistence, lifecycle, UI copy, candidate gating, and test coverage.
  - Any actionable findings are fixed.
  - Re-run impacted validation after fixes.
- **Validation**:
  - Final report includes sub-agent findings and fixes.

## Testing Strategy

- Runtime truth tests should own store behavior, lifecycle cleanup, selector guard behavior, and persistence leak prevention.
- UI evaluation tests should own render gating, passive copy, data attributes, and no execution affordance.
- Typecheck should catch event/model drift.
- Lint/build should catch generated/import shape errors.
- Installed parity should be maintained only through `installFromWorkspace("laboratory")`.

Suggested command order:

Source-only validation before installed-copy refresh:

1. `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
2. `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
3. `npm run rooms:typecheck`
4. `npm run rooms:lint`
5. `npm run rooms:build`

Installed-copy and full validation after source checks:

6. `installFromWorkspace("laboratory")`
7. `npm run rooms:test:core`
8. `git diff --check`
9. `git diff -- rooms/laboratory/runtime/lab-run-controller.ts`

## Potential Risks And Gotchas

- **Store importing selectors can expose a cycle**: `lab-store.ts` already imports `deriveLegacyStage` from selectors, so adding `getActiveExecutionCandidate` may work, but this should be watched. If a cycle appears, extract a narrow validator helper or guard using existing suggestion/plan primitives.
- **Explicit action vs no button language is contradictory**: The plan treats this as no execution CTA, not no accessible UI control. If strict no `<button>` is required, use a keyboard-accessible passive toggle element and update binder tests accordingly, but this is less semantically ideal.
- **Commitment status can look inconsistent if revoke stores null**: Phase 4.8 stores only active committed objects. Revoke clears the object. Selector tests must reject any non-`committed` status if malformed state is ever present.
- **Candidate panel must remain structural**: Commitment controls must not be embedded in `.lab-execution-candidate`; keep them in a sibling commitment block so existing passive candidate tests remain meaningful.
- **Commitment should not be selector-derived**: The object must be set by explicit event and stored in UI state. The selector only guards stale state; it must not create a commitment.
- **Commitment must not survive candidate drift**: Both reducer clear paths and selector guard are needed. Reducer clearing handles normal lifecycle; selector guard handles any stale edge case.
- **`committedAt` is nondeterministic**: Tests should check numeric bounds or fixed helper output through render model fixtures, not exact time equality.
- **Persistence via workspace is easy to leak**: Do not put commitment under `state.ui.workspace`, because `readPersistableState` persists the whole workspace object.
- **Not-viable candidates must not be selectable**: Enforce this in both UI render and reducer guard. UI alone is not enough.
- **Preview clear should not revoke commitment**: Existing preview clear behavior is intentionally softer than selection/intent/candidate changes.
- **Future execution wording can creep into UI**: Scope forbidden-word tests to commitment panel and controls so existing unrelated timeline labels like `Start` do not create false positives.
- **Plan id mismatch is a safety boundary**: Set event must be checked against active candidate plan id, not trusted from DOM.

## Rollback Plan

- Remove `LabExecutionCommitment` model types and event variants.
- Remove `activeExecutionCommitment` from `LabStoreUiState` and `createInitialState()`.
- Remove reducer cases and lifecycle clear additions.
- Remove `getActiveExecutionCommitment` and waveform timeline model field.
- Remove binder data attribute handling.
- Remove commitment render helpers and CSS.
- Remove commitment tests.
- Re-run `installFromWorkspace("laboratory")` to refresh installed copy.
- Re-run typecheck, lint, build, targeted tests, and core suite.

## Definition Of Done

- User can explicitly choose a viable or unstable execution candidate as a commitment.
- Not-viable candidates cannot be committed.
- Commitment is visible as a passive, finalized UI state.
- Commitment can be revoked.
- Commitment clears when selection/ROI/inspection/source/project/intent/candidate context changes.
- Commitment survives preview clear and UI refresh within the same runtime state.
- Commitment is not persisted and does not hydrate back.
- No execution, run-controller coupling, queue, analysis, asset/export, async/fetch/AI, or automatic trigger exists.
- Validation and sub-agent conformance review are complete.
