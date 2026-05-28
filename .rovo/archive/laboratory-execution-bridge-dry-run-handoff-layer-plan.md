# Plan: Laboratory Phase 4.4 - Execution Bridge Dry-Run Handoff Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview
Phase 4.4 adds a derived-only execution payload preview layer to Laboratory:

`Selection -> Suggestion -> Preview -> Intent -> Plan -> Simulation -> Readiness -> Payload Preview`

The new layer explains how the system would structure an execution-like input if the user later chose to move toward real execution. It does not dispatch anything, does not copy the real run-controller contract, and does not persist any payload object. The payload preview is a deterministic, side-effect-free representation derived from the existing active execution plan, simulation, readiness, selection, inspection mode, and source kind.

## Prerequisites
- Phase 4.1 `LabExecutionPlan` is present and includes `actionType`.
- Phase 4.2 `LabExecutionSimulation` is selector-derived.
- Phase 4.3 `LabExecutionReadiness` is selector-derived.
- `activeExecutionIntentId` remains the only stored execution identity.
- `lab-run-controller.ts`, analysis runners, queue, export, and asset systems stay outside this phase.

## Sprint 1: Model Contract and Bridge Module
**Goal**: Add the payload preview type and a pure runtime module without wiring it into UI yet.
**Demo/Validation**:
- TypeScript can import the new model and bridge module.
- Direct unit-style tests can build a payload preview from a plan, simulation, and readiness.

### Task 1.1: Add `LabExecutionPayloadPreview`
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add a new interface with these fields:
  - `id: string`
  - `planId: string`
  - `actionType: LabActionSuggestion["actionType"] | string`
  - `summary: string`
  - `dryRunShape: { previewInput: Record<string, unknown>; previewParameters: Record<string, unknown>; previewExpectedOutputs: string[] }`
  - `notes?: string[]`
  - `readinessStatus: LabExecutionReadiness["status"]`
  - `readinessPassesPreview: boolean`
- **Complexity**: 2
- **Dependencies**: Existing Phase 4.3 types.
- **Acceptance Criteria**:
  - The type is exported from `lab-types.ts`.
  - No store state field is added.
  - No persistence contract is changed.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Create `lab-execution-bridge.ts`
- **Location**: `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Add `buildExecutionPayloadPreview(input)` as a pure deterministic bridge function.
- **Complexity**: 4
- **Dependencies**: Task 1.1.
- **Acceptance Criteria**:
  - The module has no DOM, fetch, timer, random, storage, or run-controller imports.
  - It imports only types and pure helper-compatible model data.
  - It returns a `LabExecutionPayloadPreview`.
- **Validation**:
  - Direct test import compiles.
  - Source scan confirms no forbidden API usage.

### Task 1.3: Stable ID Helper
- **Location**: `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Use `payload:${executionPlan.id}` as the only payload identity.
- **Complexity**: 1
- **Dependencies**: Task 1.2.
- **Acceptance Criteria**:
  - No timestamp, counter, hash randomization, or independent identity system.
  - Same upstream plan id always yields the same payload id.
- **Validation**:
  - Deterministic output test repeats the same input twice and deep-compares output.

## Sprint 2: Deterministic Payload Mapping
**Goal**: Produce execution-like payloads for known Laboratory suggestion action types while keeping them intentionally decoupled from real execution schemas.
**Demo/Validation**:
- Each major action type returns a readable dry-run shape with preview input, preview parameters, preview expected outputs, and notes.
- Unknown actions produce a safe generic payload.

### Task 2.1: Common Context Serialization
- **Location**: `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Add small pure helpers for selection range, ROI signature, source kind, inspection mode, and readiness fields.
- **Complexity**: 3
- **Dependencies**: Sprint 1.
- **Acceptance Criteria**:
  - Selection input includes `startMs` and `endMs`.
  - ROI input is included only when present.
  - Readiness status and `readinessPassesPreview` are always present.
  - The boolean name avoids presenting the preview as a real execution gate.
- **Validation**:
  - Runtime tests inspect payload shape for time-only and ROI selections.

### Task 2.2: `analyze-segment` Payload
- **Location**: `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Produce an execution-like payload with:
  - preview input: `{ startMs, endMs, sourceKind }`
  - preview parameters: `{ sensitivity, windowSizeMs }`
  - preview expected outputs: `patternMarkers`, `anomalyFlags`, `confidenceSummary`
- **Complexity**: 2
- **Dependencies**: Task 2.1.
- **Acceptance Criteria**:
  - Uses deterministic parameter values based on selection duration and readiness/simulation context.
  - Does not copy any run-controller payload name or shape.
- **Validation**:
  - Runtime test asserts expected action type and structured fields.

### Task 2.3: `inspect-audio` Payload
- **Location**: `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Produce an audio segment payload with:
  - preview input: active audio window
  - preview parameters: `bandFocus`, `transientScan`, optional preview focus hints
  - preview expected outputs: `frequencyClusters`, `transientPeaks`, `noiseFloorEstimate`
- **Complexity**: 3
- **Dependencies**: Task 2.1.
- **Acceptance Criteria**:
  - High-gain or readiness warnings appear as notes, not blockers.
  - No audio graph or analysis runner is touched.
- **Validation**:
  - Runtime test covers audio suggestion and readiness mapping.

### Task 2.4: ROI and Motion Payloads
- **Location**: `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Add mappings for:
  - `focus-region`
  - `inspect-motion`
  - `enhance-visual`
  - `stabilize-segment`
- **Complexity**: 4
- **Dependencies**: Task 2.1.
- **Acceptance Criteria**:
  - ROI payloads include ROI geometry when present.
  - Motion payloads include time range plus ROI if present.
  - Missing ROI results in notes, not execution or mutation.
- **Validation**:
  - Runtime tests cover ROI and non-ROI variants.

### Task 2.5: `extract-clip` and Fallback Payloads
- **Location**: `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Add a preview-only clip-like payload and a generic fallback for unknown action types.
- **Complexity**: 3
- **Dependencies**: Task 2.1.
- **Acceptance Criteria**:
  - `extract-clip` preview does not touch asset/export code.
  - Unknown action produces a generic payload with limited-accuracy notes.
- **Validation**:
  - Runtime tests cover unknown action through a casted suggestion/plan fixture.

## Sprint 3: Selector Integration
**Goal**: Expose the payload preview through selectors and the timeline view model while preserving derived-only behavior.
**Demo/Validation**:
- Accepted intent with plan, simulation, and readiness yields payload preview.
- Missing upstream layer yields `null`.
- A deliberately missing readiness object is covered as a render-model negative test, because the real selector derives readiness whenever plan, simulation, and a valid selection exist.

### Task 3.1: Add `getActiveExecutionPayloadPreview`
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Resolve active execution plan, simulation, readiness, and active selection, then call the bridge.
- **Complexity**: 4
- **Dependencies**: Sprint 2.
- **Acceptance Criteria**:
  - `plan === null` returns `null`.
  - `simulation === null` returns `null`.
  - `readiness === null` returns `null` in the resolved-object helper or render-model path.
  - Invalid selection returns `null`.
  - Uses existing selector-derived objects instead of reading store-only shortcut data.
- **Validation**:
  - Runtime selector tests for valid, preview-only, and queued-only paths.
  - A small pure helper or render-model fixture covers the missing-readiness negative path without forcing impossible store state.

### Task 3.2: Add View Model Field
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-types.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `activeExecutionPayloadPreview?: LabExecutionPayloadPreview | null` to the timeline model.
- **Complexity**: 2
- **Dependencies**: Task 3.1.
- **Acceptance Criteria**:
  - Render layer receives payload only through model.
  - No store schema or persisted state update.
- **Validation**:
  - Typecheck and UI render tests.

### Task 3.3: Persistence Fence Test
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Assert payload preview is absent from persisted state and hydration does not restore it.
- **Complexity**: 2
- **Dependencies**: Task 3.1.
- **Acceptance Criteria**:
  - No `activeExecutionPayloadPreview` field in persisted top-level or workspace state.
  - After hydrate, selector returns `null` unless upstream intent is rebuilt by normal user action.
- **Validation**:
  - Target runtime truth suite.

## Sprint 4: Passive Payload Preview UI
**Goal**: Render a technical but passive payload preview panel under the existing plan/simulation/readiness layers.
**Demo/Validation**:
- The UI shows summary, action type, structured dry-run shape, readiness badge, and preview expected outputs.
- There is no execution-language CTA.

### Task 4.1: Render Payload Preview Panel
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add `renderExecutionPayloadPreview(payload)` and mount it after readiness.
- **Complexity**: 5
- **Dependencies**: Sprint 3.
- **Acceptance Criteria**:
  - Panel heading: `Execution payload (preview)`.
  - Copy includes `This is how the system would structure the execution input`.
  - Copy includes `No execution is performed`.
  - Structured content is escaped and stable.
  - No `Run`, `Execute`, `Apply`, or `Start` language.
- **Validation**:
  - UI evaluation suite asserts presence and forbidden copy absence.

### Task 4.2: Structured Payload Formatting
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Format `dryRunShape.previewInput` and `dryRunShape.previewParameters` in a JSON-like readonly block without exposing unsafe HTML.
- **Complexity**: 3
- **Dependencies**: Task 4.1.
- **Acceptance Criteria**:
  - Values are deterministic and escaped.
  - Large nested structures remain readable.
  - The formatting does not require runtime code evaluation.
- **Validation**:
  - UI test asserts structured keys appear.
  - Lint/typecheck.

### Task 4.3: Styling
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add styles for payload preview panel, structured blocks, readiness signal badge, and notes.
- **Complexity**: 3
- **Dependencies**: Task 4.1.
- **Acceptance Criteria**:
  - The panel reads as more technical than readiness but remains non-modal.
  - Status badge aligns with readiness status.
  - No button-like execution affordance is introduced.
- **Validation**:
  - Source/UI evaluation assertions.

### Task 4.4: Render Ownership Negative Tests
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Add real render tests proving payload panel is owned only by `activeExecutionPayloadPreview`.
- **Complexity**: 3
- **Dependencies**: Task 4.1.
- **Acceptance Criteria**:
  - Preview-only markup has no payload panel.
  - Queued-only markup has no payload panel.
  - Readiness-missing markup has no payload panel.
  - Payload-present markup renders the panel.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

## Sprint 5: Full Regression and Guardrail Sweep
**Goal**: Close the phase with deterministic tests, scope checks, install sync, and conformance review.
**Demo/Validation**:
- All targeted and broad Laboratory suites pass.
- No execution integration was introduced.

### Task 5.1: Runtime Regression Coverage
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests for:
  - plan + simulation + readiness -> payload
  - missing upstream -> `null`
  - deterministic output
  - stable id
  - readiness status and `readinessPassesPreview`
  - ROI payload shape
  - fallback payload
  - persistence leak absence
- **Complexity**: 5
- **Dependencies**: Sprint 3.
- **Acceptance Criteria**:
  - Tests prove payload is derived-only.
  - Tests prove readiness status maps to `readinessPassesPreview`.
  - Tests prove missing plan/simulation/readiness does not invent a payload.
- **Validation**:
  - Target runtime truth suite.

### Task 5.2: Guardrail Source Scan
- **Location**: Repository-wide check
- **Description**: Confirm forbidden surfaces were not modified or coupled.
- **Complexity**: 2
- **Dependencies**: All implementation tasks.
- **Acceptance Criteria**:
  - No Phase 4.4 diff in `rooms/laboratory/runtime/lab-run-controller.ts`.
  - No import from bridge into controller, queue, analysis runners, or asset/export modules.
  - No store event or persisted field for payload preview.
- **Validation**:
  - `git diff -- rooms/laboratory/runtime/lab-run-controller.ts`
  - `rg "ExecutionPayload|PayloadPreview|lab-execution-bridge" rooms/laboratory`

### Task 5.3: Validation Commands
- **Location**: Project root
- **Description**: Run the normal Laboratory validation chain.
- **Complexity**: 3
- **Dependencies**: All implementation tasks.
- **Acceptance Criteria**:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - installed room sync via existing `installFromWorkspace("laboratory")` command
  - targeted runtime suite
  - targeted UI evaluation suite
  - broad Laboratory/core regression package used in recent phases
- **Validation**:
  - All commands complete without failing tests.

### Task 5.4: Final Conformance Review
- **Location**: Plan + diff
- **Description**: Ask a sub-agent to compare the final implementation against this plan if the user explicitly requests sub-agent review for the implementation pass.
- **Complexity**: 2
- **Dependencies**: Validation complete.
- **Acceptance Criteria**:
  - Findings are fixed before final report.
  - If no sub-agent is requested in the current turn, note that review is deferred instead of inventing delegation.
- **Validation**:
  - Final report includes review status.

## Testing Strategy
- **Runtime truth**: Focus on selector derivation, deterministic bridge output, upstream null behavior, readiness mapping, ROI payloads, fallback payloads, and persistence fence.
- **UI evaluation**: Focus on panel ownership, structured content, passive language, forbidden execution words, and negative render paths.
- **Type/lint/build**: Run full room-level checks because this touches shared model and timeline render contracts.
- **Install sync**: Rebuild and install the Laboratory room so `data/rooms/laboratory/*` and `config/rooms.json` stay aligned with source.

## Potential Risks & Gotchas
- **Risk: payload accidentally becomes the real run contract.**
  - Mitigation: keep field names descriptive and execution-like, but do not import or mirror run-controller payload types.
- **Risk: readiness preview status reads like a real gate.**
  - Mitigation: use `readinessPassesPreview` instead of `safeToExecute`, and keep UI copy framed as a dry-run signal only.
- **Risk: payload appears for preview-only or queued-only states.**
  - Mitigation: selector requires plan, simulation, readiness, and active selection; UI render tests cover negative ownership.
- **Risk: readiness missing path invents a blocked payload.**
  - Mitigation: selector returns `null` when readiness is missing in the resolved-object helper path; UI render tests cover model-level absence.
- **Risk: structured payload rendering introduces unsafe HTML.**
  - Mitigation: stringify or format through escaped text only.
- **Risk: action mapping drifts from planner action type.**
  - Mitigation: read `executionPlan.actionType`, never parse ids.
- **Risk: ROI geometry is duplicated into state.**
  - Mitigation: payload reads current `activeSelection.roi`; no payload persistence or mutation.
- **Risk: broad suite fails from installed copy drift.**
  - Mitigation: always run `rooms:build` and installed room sync before final broad tests.

## Rollback Plan
- Remove `LabExecutionPayloadPreview` from `lab-types.ts`.
- Delete `rooms/laboratory/runtime/lab-execution-bridge.ts`.
- Remove `getActiveExecutionPayloadPreview` and view-model wiring from selectors/types.
- Remove payload preview render and CSS blocks.
- Remove Phase 4.4 tests.
- Rebuild and reinstall Laboratory room from source.
