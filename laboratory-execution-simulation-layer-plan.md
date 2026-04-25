# Plan: Laboratory Execution Simulation Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview
Add a preview-only execution simulation layer on top of the existing:

`selection -> suggestion -> preview -> intent -> plan`

The new layer will let the user see what would likely happen if the accepted plan were applied, without starting any real execution. The simulation must stay fully derived:
- no new store state
- no persistence
- no `lab-run-controller.ts` edits
- no execution / analysis / asset / export side effects
- no async, fetch, AI, DOM, randomness, or timers

The simulation is not “plan execution.” It is a deterministic outcome forecast derived from the active execution plan and current preview context.

## Assumptions
- `request_user_input` is unavailable in this session, so the plan resolves ambiguities conservatively instead of asking follow-up questions.
- Phase 4.1 is the canonical base:
  - `activeExecutionIntentId` stays the only stored execution identity
  - `getActiveExecutionPlan(state)` is already selector-derived
  - preview close may leave accepted intent and execution plan alive
  - selection / ROI / inspection / source / project mutations clear the underlying intent, so both plan and simulation collapse to `null`
- `audioFocus` is available through existing selectors and may be passed into the simulator, but no new audio-focus persistence or store wiring will be added.
- To honor the requested stable simulation id contract, `audioFocus` may influence deterministic wording and warnings, but the canonical simulation id will remain derived only from:
  - `plan.id`
  - selection range
  - ROI signature
  - `inspectionMode`
  - `sourceKind`
- If `audioFocus` is used as simulation input, it must come from `getEffectivePreviewAudioFocusSettings(state)` rather than raw workspace state so dual-preview tempo fencing stays truthful.
- `audioFocus` may change simulation copy or metrics, but it must never become a visibility gate, persistence concern, or id input in this phase.

## Prerequisites
- Existing execution-plan layer:
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- Existing preview context:
  - `activeSelection`
  - `inspectionMode`
  - `sourceKind`
  - effective preview `audioFocus`
- Existing derived-only lifecycle fences:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`

## Sprint 1: Simulation Contract
**Goal**: Introduce the simulation model and pure simulator seam without changing runtime behavior yet.
**Demo/Validation**:
- New types compile cleanly.
- Simulator module exists with deterministic signatures only.

### Task 1.1: Add execution simulation model
- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
- **Description**:
  - Add `LabExecutionSimulation` with:
    - `id`
    - `planId`
    - `summary`
    - `predictedEffects[]`
    - optional `warnings[]`
    - optional `metrics { intensity, risk, confidence }`
  - Keep the type runtime/UI-only.
  - Do not add it to store state or persistence payloads.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Type is available to simulator, selectors, and render model.
  - No persisted schema changes are introduced.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Create deterministic simulator module
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-simulator.ts`
- **Description**:
  - Add a pure entry point, for example:
    - `buildExecutionSimulation({ executionPlan, activeSelection, inspectionMode, sourceKind, audioFocus })`
  - Keep it sync, deterministic, side-effect free, and store-independent.
  - Accept already-resolved plan objects instead of ids.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Simulator has no store imports.
  - Simulator has no DOM, fetch, timer, controller, or asset coupling.
- **Validation**:
  - Targeted simulator coverage via regression suite

## Sprint 2: Deterministic Outcome Mapping
**Goal**: Encode stable “what would happen” forecasts per plan/action type.
**Demo/Validation**:
- A valid execution plan resolves to a concrete simulation.
- Unknown actions fall back safely.

### Task 2.1: Add action-specific simulation mappings
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-simulator.ts`
- **Description**:
  - Implement deterministic mappings for current execution-plan actions:
    - `analyze-segment`
    - `inspect-audio`
    - `extract-clip`
    - `focus-region`
    - `inspect-motion`
    - `enhance-visual`
    - `stabilize-segment`
  - For each action, derive:
    - `summary`
    - `predictedEffects[]`
    - optional `warnings[]`
    - `metrics`
- **Complexity**: 6/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Every currently planned action type yields a meaningful simulation.
  - Output tone stays predictive, not executory.
- **Validation**:
  - Runtime regressions per action type

### Task 2.2: Add context-sensitive warnings and metrics
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-simulator.ts`
- **Description**:
  - Derive warnings and metrics from:
    - selection width
    - ROI presence / absence
    - ROI area extremes
    - inspection mode emphasis
    - source kind suitability
    - normalized effective preview `audioFocus` where helpful
  - Keep the output deterministic and explainable.
  - Use `audioFocus` conservatively so simulation content remains stable and phase-safe.
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Same inputs always yield the same warnings/metrics.
  - No warning implies execution has already started.
- **Validation**:
  - Deterministic repeated-output regressions

### Task 2.3: Add safe fallback simulation
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-simulator.ts`
- **Description**:
  - Add a generic fallback for unknown or future-safe action types.
  - Include:
    - conservative summary
    - 2-3 generic predicted effects
    - a limited-confidence warning path
- **Complexity**: 2/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Simulator never throws on unknown action types.
  - Fallback remains preview-only and non-executing.
- **Validation**:
  - Unknown-action regression

### Task 2.4: Add stable simulation id generation
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-simulator.ts`
- **Description**:
  - Implement canonical `LabExecutionSimulation.id` as a deterministic namespaced transform of `executionPlan.id`.
  - Do not create a second independent identity contract that can drift from the plan id boundary.
  - If extra context is encoded, centralize it behind a shared helper used by both planner/simulator seams rather than duplicating lifecycle fields by hand.
  - Explicitly forbid timestamps, random ids, or render counters.
  - Keep `audioFocus` out of the id unless the scope is explicitly renegotiated in a future phase.
- **Complexity**: 3/10
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - Same plan/context produces the same id.
  - Simulation id is stable across re-renders and preview clears.
- **Validation**:
  - Stable-id regression

## Sprint 3: Derived Selector Integration
**Goal**: Resolve active simulation from active execution plan without storing simulation objects.
**Demo/Validation**:
- `activeExecutionPlan` resolves to a simulation through selectors only.
- No plan means no simulation.

### Task 3.1: Add active simulation selector
- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  - Add `getActiveExecutionSimulation(state)`.
  - Flow:
    - resolve `activeExecutionPlan`
    - if `null`, return `null`
    - otherwise call the simulator with:
      - plan
      - `activeSelection`
      - `inspectionMode`
      - `sourceKind`
      - effective preview `audioFocus`
  - Keep the selector independent from preview visibility.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Valid active plan yields a simulation.
  - No plan yields `null`.
  - Preview-cleared-but-plan-active still yields a simulation.
  - Dual preview uses effective preview audio settings, not raw stored playback transport values.
- **Validation**:
  - Selector regressions for valid, null, and preview-cleared states

### Task 3.2: Extend waveform timeline view-model
- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**:
  - Add `activeExecutionSimulation` to the timeline model.
  - Keep it nullable and derived-only.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - UI receives simulation data without store changes.
- **Validation**:
  - Typecheck + render regression

## Sprint 4: Passive Simulation UI
**Goal**: Show a deeper “what would happen” layer without any execution tone.
**Demo/Validation**:
- Accepted plan shows a simulation block.
- No plan means no simulation block.

### Task 4.1: Render simulation preview block
- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**:
  - Add a `Simulation preview` section below the execution plan.
  - Treat the label as presentation only; render ownership must stay tied to `activeExecutionPlan`, not preview visibility or queue state.
  - Render:
    - summary
    - predicted effects
    - warnings
    - optional metrics / confidence
  - Keep the copy passive, for example:
    - `What would happen`
    - `Expected outcome`
    - `If applied, you would observe`
  - Explicitly avoid:
    - `Run`
    - `Apply`
    - `Execute`
- **Complexity**: 6/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Simulation appears only when `activeExecutionPlan` resolves.
  - Simulation disappears automatically when selector resolves `null`.
  - The block reads as a forecast, not an action trigger.
- **Validation**:
  - UI evaluation regression

### Task 4.2: Add styling for the simulation layer
- **Location**:
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  - Style simulation as a deeper layer than execution plan:
    - visually structured
    - non-modal
    - reflective / thinking tone
  - Separate it from:
    - suggestion preview
    - execution-intent strip
    - execution plan block
    - interpretation panel
- **Complexity**: 4/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Simulation is easy to scan and clearly non-executing.
  - No execution CTA styling leaks in.
- **Validation**:
  - CSS/render smoke via existing UI suite

## Sprint 5: Regression Closure
**Goal**: Lock the simulation layer behind deterministic tests and persistence fences.
**Demo/Validation**:
- Full simulation suite passes.
- Simulation never leaks into store or persisted state.

### Task 5.1: Add simulator and selector regressions
- **Location**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**:
  - Add coverage for:
    - valid plan -> simulation
    - no plan -> `null`
    - deterministic repeated output
    - ROI/source/project/inspection invalidations collapse simulation to `null` through the upstream intent/plan chain
    - audioFocus-only updates may change simulation wording/metrics without changing simulation visibility
    - dual-preview effective audioFocus fencing is respected
    - selection-invalidating lifecycle collapses simulation through intent/plan clearing
    - preview clear preserves simulation while active intent + plan remain valid
    - unknown action fallback
  - Include explicit negative paths:
    - accepted intent missing -> no plan -> no simulation
    - queued-only state -> no simulation
    - dismissed intent -> simulation disappears
    - source-config invalidation -> simulation disappears
    - project switch/hydrate reset -> simulation disappears
- **Complexity**: 7/10
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Lifecycle matches Phase 4.0 / 4.1 truth:
    - preview clear may keep simulation alive
    - selection / ROI / inspection / source / project mutations remove it indirectly by clearing the intent/plan chain
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.2: Add UI evaluation regressions
- **Location**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**:
  - Assert the simulation panel renders:
    - summary
    - predicted effects
    - warnings
  - Assert selector ownership at the UI boundary:
    - preview-cleared + accepted plan => simulation still renders
    - preview-only or queued-only => no simulation panel
  - Assert passive tone:
    - no `Run`
    - no `Execute`
    - no direct execution CTA
- **Complexity**: 4/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Simulation panel copy is visible and non-executing.
  - UI copy does not regress into run semantics.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 5.3: Add persistence fence checks
- **Location**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**:
  - Extend persistence/hydrate coverage to assert:
    - `activeExecutionSimulation` is never written to persisted state
    - no simulation object appears under `workspace` or top-level UI payload
    - hydrate still resets the upstream execution intent, so simulation resolves to `null`
- **Complexity**: 3/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Simulation remains purely derived and ephemeral.
- **Validation**:
  - Runtime truth regressions

## Testing Strategy
- Start with pure simulator regression coverage before render work.
- Keep selector tests focused on lifecycle truth rather than DOM behavior.
- Lock passive UI copy in evaluation tests so simulation does not drift toward execution language.
- Run full verification at the end:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - `installFromWorkspace('laboratory')`
  - targeted truth + UI suites
  - broader Laboratory parity/regression sweep if phase scope touches generated/install surfaces

## Potential Risks & Gotchas
- **Audio-focus vs stable-id tension**:
  - The request allows `audioFocus` input but also fixes a stable id contract that excludes audio-focus signature.
  - Mitigation:
    - use `audioFocus` conservatively for deterministic wording/warnings
    - route simulation input through `getEffectivePreviewAudioFocusSettings(state)` so dual-preview transport fencing remains canonical
    - do not expand the canonical id in this phase unless scope changes
    - add tests that lock deterministic output for fixed audio-focus inputs
    - add a direct regression that audio-focus-only updates can adjust copy/metrics while leaving the stable simulation id unchanged
- **Lifecycle drift across layers**:
  - Simulation is derived from plan, which is derived from active intent.
  - Mitigation:
    - keep selector chain explicit
    - test preview-clear survival separately from selection/ROI/source invalidation
- **Copy drifting into execution semantics**:
  - A simulation block can easily look like a run confirmation.
  - Mitigation:
    - forbid `Run` / `Apply` / `Execute` copy in UI tests
- **Overlapping preview / plan / simulation panels**:
  - Another layer can make the selection card too dense.
  - Mitigation:
    - keep the simulation block concise
    - visually separate it as a deeper passive layer
- **Unknown future actions**:
  - New action types may appear before dedicated simulation mappings are added.
  - Mitigation:
    - safe fallback simulation path

## Rollback Plan
- Remove `LabExecutionSimulation` from `lab-types.ts`
- Delete `rooms/laboratory/runtime/lab-execution-simulator.ts`
- Remove `getActiveExecutionSimulation(state)` and timeline-model wiring
- Remove simulation render block and related CSS
- Revert simulation-specific regressions
- Rebuild and reinstall the Laboratory room package to restore installed/runtime parity
