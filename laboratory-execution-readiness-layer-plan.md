# Plan: Laboratory Execution Readiness Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview
Add a preview-only execution readiness layer on top of the existing:

`selection -> suggestion -> preview -> intent -> plan -> simulation`

The new layer will tell the user whether the currently accepted plan appears ready, needs review, or is blocked, without starting any execution. The readiness layer must stay fully derived:
- no new store state
- no persistence
- no `lab-run-controller.ts` edits
- no execution / analysis / asset / export side effects
- no async, fetch, AI, DOM, randomness, or timers

Readiness is not execution gating. It is a deterministic evaluation of the current passive chain.

## Assumptions
- `request_user_input` is unavailable in this session, so the plan resolves ambiguities conservatively instead of asking follow-up questions.
- Phase 4.2 is the canonical base:
  - `activeExecutionIntentId` stays the only stored execution identity
  - `getActiveExecutionPlan(state)` is already selector-derived
  - `getActiveExecutionSimulation(state)` is already selector-derived
  - preview close may leave accepted intent, plan, and simulation alive
  - selection / ROI / inspection / source / project mutations clear the upstream intent, so plan, simulation, and readiness collapse to `null`
- Readiness should derive from both active plan and active simulation.
  - If plan is `null`, readiness is `null`
  - If simulation is `null`, readiness is also `null`
  - This phase will not invent a synthetic `blocked` state simply because upstream derived data is missing
- Readiness should prefer simulation warnings/metrics as its risk source, then layer selection/ROI/source validity on top.
- `readiness.id` must remain a deterministic namespaced transform of `executionPlan.id`; no second drifting identity contract is allowed.

## Prerequisites
- Existing execution-plan layer:
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- Existing execution-simulation layer:
  - `rooms/laboratory/runtime/lab-execution-simulator.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- Existing derived-only lifecycle fences:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`

## Sprint 1: Readiness Contract
**Goal**: Introduce the readiness model and pure evaluator seam without changing runtime behavior yet.
**Demo/Validation**:
- New types compile cleanly.
- Readiness module exists with deterministic signatures only.

### Task 1.1: Add execution readiness model
- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
- **Description**:
  - Add `LabExecutionReadiness` with:
    - `id`
    - `planId`
    - `status`
    - `summary`
    - optional `blockers[]`
    - optional `notes[]`
    - optional `confidence`
  - Keep it runtime/UI-only.
  - Do not add it to store state or persistence payloads.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Type is available to readiness evaluator, selectors, and render model.
  - No persisted schema changes are introduced.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Create deterministic readiness module
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-readiness.ts`
- **Description**:
  - Add a pure entry point, for example:
    - `buildExecutionReadiness({ executionPlan, executionSimulation, activeSelection, inspectionMode, sourceKind })`
  - Keep it sync, deterministic, side-effect free, and store-independent.
  - Accept already-resolved plan/simulation objects rather than ids.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Evaluator has no store imports.
  - Evaluator has no DOM, fetch, timer, controller, or asset coupling.
- **Validation**:
  - Targeted readiness coverage via regression suite

## Sprint 2: Deterministic Readiness Rules
**Goal**: Encode stable `ready / needs-review / blocked` evaluation rules from plan + simulation context.
**Demo/Validation**:
- Valid passive chain resolves to a readiness result.
- Missing or unsuitable context resolves to predictable outcomes.

### Task 2.1: Add canonical readiness status rules
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-readiness.ts`
- **Description**:
  - Encode deterministic status rules using:
    - simulation warnings
    - simulation metrics risk/confidence
    - selection duration
    - ROI validity/size
    - inspection mode
    - source kind suitability
  - Suggested baseline:
    - `ready`: low/medium risk, valid context, no critical blockers
    - `needs-review`: warnings, low confidence, ROI edge cases, aggressive preview context
    - `blocked`: invalid selection, invalid ROI, clearly unsuitable context, or high-risk simulation outcome
- **Complexity**: 6/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Rule outcomes are deterministic and explainable.
  - Status never implies execution has started.
- **Validation**:
  - Runtime regressions per status family

### Task 2.2: Add action-sensitive readiness mappings
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-readiness.ts`
- **Description**:
  - Layer action-sensitive thresholds onto the generic status rules:
    - `inspect-audio`
      - high gain elevates from review to blocked
    - `focus-region`
      - extremely small ROI moves from review to blocked
    - `analyze-segment`
      - very short duration blocks, short duration needs review
    - `inspect-motion`
      - aggressive preview cadence needs review or blocks if future thresholds are exceeded
  - Use current simulation output as the primary signal, not a second independent policy tree disconnected from simulation.
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Readiness remains coherent with the simulation layer rather than contradicting it.
  - Each supported action type can reach a justified status.
- **Validation**:
  - Action-specific readiness regressions

### Task 2.3: Add notes, blockers, and confidence rules
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-readiness.ts`
- **Description**:
  - Derive:
    - `summary`
    - optional `blockers[]`
    - optional `notes[]`
    - optional `confidence`
  - Keep wording passive:
    - “This looks ready to carry forward”
    - “This should be reviewed before any execution step”
    - “This is not yet in a safe execution-ready state”
  - Avoid imperative run language.
  - Treat `blocked` as a passive evaluation label, not a hard execution gate or controller decision.
- **Complexity**: 4/10
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - `blocked` states always explain why.
  - `needs-review` states provide review-oriented notes rather than pseudo-errors.
  - Visible copy never reads like the system has granted or denied real execution.
  - Confidence stays deterministic and bounded.
- **Validation**:
  - Same-input/same-output regression

### Task 2.4: Add stable readiness id generation
- **Location**:
  - `rooms/laboratory/runtime/lab-execution-readiness.ts`
- **Description**:
  - Implement canonical `LabExecutionReadiness.id` as:
    - `readiness:${executionPlan.id}`
  - Explicitly forbid timestamps, random ids, or secondary per-render counters.
- **Complexity**: 2/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Same plan context always yields the same readiness id.
  - Readiness identity stays aligned with plan identity.
- **Validation**:
  - Stable-id regression

## Sprint 3: Derived Selector Integration
**Goal**: Resolve active readiness from active plan + simulation without storing readiness objects.
**Demo/Validation**:
- Active plan + simulation resolve to readiness through selectors only.
- Missing upstream derived data yields `null`.

### Task 3.1: Add active readiness selector
- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  - Add `getActiveExecutionReadiness(state)`.
  - Flow:
    - resolve `activeExecutionPlan`
    - resolve `activeExecutionSimulation`
    - if either is `null`, return `null`
    - otherwise call readiness evaluator with:
      - plan
      - simulation
      - `activeSelection`
      - `inspectionMode`
      - `sourceKind`
  - Keep selector independent from preview visibility.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Valid upstream chain yields readiness.
  - No plan or no simulation yields `null`.
  - Preview-cleared-but-plan+simulation-active still yields readiness.
- **Validation**:
  - Selector regressions for valid, null, and preview-cleared cases

### Task 3.2: Extend waveform timeline view-model
- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**:
  - Add `activeExecutionReadiness` to the timeline model.
  - Keep it nullable and derived-only.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - UI receives readiness data without store changes.
- **Validation**:
  - Typecheck + render regression

## Sprint 4: Passive Readiness UI
**Goal**: Show execution-readiness state without any execution CTA.
**Demo/Validation**:
- Accepted plan/simulation show a readiness block.
- No upstream chain means no readiness block.

### Task 4.1: Render execution readiness block
- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**:
  - Add an `Execution readiness` section below the simulation block.
  - Render:
    - summary
    - status badge (`Ready`, `Needs review`, `Blocked`)
    - optional blockers
    - optional notes
    - optional confidence
  - Keep the copy passive:
    - `Execution readiness looks stable`
    - `This path needs review before any execution step`
    - `This path is not yet execution-ready`
  - Explicitly avoid:
    - `Run`
    - `Execute`
    - `Start`
- **Complexity**: 6/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Readiness appears only when `activeExecutionReadiness` resolves.
  - The block reads as an evaluation, not a trigger.
  - `blocked` styling/copy still feels like passive assessment, not a hard platform gate.
- **Validation**:
  - UI evaluation regression

### Task 4.2: Add styling for the readiness layer
- **Location**:
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  - Style readiness as a deeper layer than simulation:
    - clear status badge hierarchy
    - visible blockers/notes separation
    - passive, review-oriented tone
  - Keep it visually distinct from:
    - execution plan
    - simulation
    - interpretation
    - execution-intent strip
- **Complexity**: 4/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - `ready / needs-review / blocked` are visually scannable.
  - No CTA styling leaks in.
- **Validation**:
  - CSS/render smoke via existing UI suite

## Sprint 5: Regression Closure
**Goal**: Lock the readiness layer behind deterministic tests and persistence fences.
**Demo/Validation**:
- Full readiness suite passes.
- Readiness never leaks into store or persisted state.

### Task 5.1: Add readiness runtime regressions
- **Location**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**:
  - Add coverage for:
    - valid plan+simulation -> readiness
    - high risk -> `blocked`
    - medium risk -> `needs-review`
    - valid case -> `ready`
    - deterministic repeated output
    - plan/simulation changes update readiness
    - preview clear preserves readiness while accepted intent + plan + simulation remain valid
    - selection/ROI/inspection/source/project invalidations collapse readiness to `null`
  - Include explicit negative paths:
    - preview-only -> no readiness
    - queued-only -> no readiness
    - no plan -> no readiness
    - no simulation -> no readiness
- **Complexity**: 7/10
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Lifecycle matches the upstream derived chain.
  - Readiness never becomes a store-backed object.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.2: Add UI evaluation regressions
- **Location**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**:
  - Assert readiness panel renders:
    - heading
    - status badge
    - blockers
    - notes
  - Assert passive tone:
    - no `Run`
    - no `Execute`
    - no `Start`
  - Add explicit ownership negatives:
    - preview-only state -> readiness panel does not render
    - queued-only state -> readiness panel does not render
    - simulation-missing state -> readiness panel does not render
- **Complexity**: 4/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Readiness panel copy stays evaluative, not executory.
  - Render ownership stays tied to `activeExecutionReadiness`, not preview or queue presence alone.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 5.3: Add persistence fence coverage
- **Location**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**:
  - Extend persistence/hydrate coverage to assert:
    - `activeExecutionReadiness` is never written to persisted state
    - no readiness object appears under `workspace` or top-level UI payload
    - hydrate still resets the upstream execution intent, so readiness resolves to `null`
- **Complexity**: 3/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Readiness remains purely derived and ephemeral.
- **Validation**:
  - Runtime truth regressions

## Testing Strategy
- Start with pure readiness-evaluator regression coverage before render work.
- Keep selector tests focused on upstream lifecycle truth rather than DOM behavior.
- Lock passive copy in UI tests so readiness does not drift into run semantics.
- Run full verification at the end:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - `installFromWorkspace('laboratory')`
  - targeted truth + UI suites
  - broader Laboratory parity/regression sweep if generated/install surfaces change

## Potential Risks & Gotchas
- **Simulation-null ambiguity**:
  - The request says readiness is shown when a plan exists, but selector flow says readiness depends on both plan and simulation.
  - Mitigation:
    - keep readiness ownership tied to `activeExecutionReadiness`, not plan alone
    - if upstream simulation is `null`, readiness is also `null`
    - document this explicitly in tests
- **Status inflation into fake execution gating**:
  - `blocked` can read like an actual enforcement gate.
  - Mitigation:
    - keep wording passive and explanatory
    - treat `blocked` as readiness evaluation only, never as a controller/permission decision
    - do not introduce buttons, queue behavior, or controller hooks
- **Rule drift from simulation layer**:
  - Readiness can become a separate policy engine that contradicts simulation.
  - Mitigation:
    - use simulation warnings/metrics as primary readiness inputs
    - only layer context validation on top
- **Stable-id drift**:
  - A second bespoke readiness identity could diverge from plan/simulation lifecycle.
  - Mitigation:
    - `readiness:${executionPlan.id}` only
- **UI density**:
  - Selection card already carries preview, intent, plan, and simulation layers.
  - Mitigation:
    - keep readiness concise
    - emphasize status + summary first, details second

## Rollback Plan
- Remove `LabExecutionReadiness` from `lab-types.ts`
- Delete `rooms/laboratory/runtime/lab-execution-readiness.ts`
- Remove `getActiveExecutionReadiness(state)` and timeline-model wiring
- Remove readiness render block and related CSS
- Revert readiness-specific regressions
- Rebuild and reinstall the Laboratory room package to restore installed/runtime parity
