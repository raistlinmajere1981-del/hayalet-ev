# Plan: Laboratory Decision Layer Deterministic Intent Model

**Generated**: 2026-05-02
**Revision**: PATCH 5 scope correction applied
**Estimated Complexity**: Medium

## Overview

PATCH 5 adds a deterministic intent backbone to Laboratory.

This is not a new broad debug/observability layer. PATCH 4 already owns region, overlay, fallback, and pipeline diagnostics. PATCH 5 adds a small semantic layer that explains what the current UI state means and can later become the single source that drives UI simplification.

In this patch the snapshot remains observational only:

- It must not change UI behavior.
- It must not change pipeline order.
- It must not add wrapper nodes.
- It must not change controller logic.
- It must match the existing UI state exactly enough to become a future UI decision source.

## Safe Assumptions

- No blocking clarification is needed.
- `resolveDrawerMode(state)` remains the canonical current mode source.
- The decision snapshot is allowed to be future-facing, but this patch must not consume it for behavior.
- `activeBlocks` must come from rendered `.labx-pipeline-block` DOM order.
- The old broad trigger list is intentionally removed.
- The only snapshot signals are:
  - `has-selection`
  - `has-source`
  - `is-running`
  - `has-result`
- The debug panel should be human-simple, not diagnostic-heavy.

## Global Constraints

- Do not rename or remove `data-lab-action`, `data-lab-field`, `data-lab-role`, `data-lab-region`, or `data-lab-preserve-media`.
- Do not change pipeline block render order.
- Do not add a new pipeline wrapper node.
- Do not wrap `.labx-timeline`.
- Do not change `lab-run-controller.ts`.
- Do not make UI behavior depend on the decision snapshot in this patch.
- Keep debug-off console clean.
- Keep PATCH 4 logs as-is; PATCH 5 adds only `[lab][decision]`.

## Sprint 1: Intent Backbone Model

**Goal**: Add the future-facing decision snapshot model and pure mapping helpers.

**Demo/Validation**:

- Typecheck passes.
- Pure tests prove mode/signal to intent mapping.

### Task 1.1: Add Decision Types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add additive exported types:
  - `LabDecisionIntent`
  - `LabDecisionSignal`
  - `LabDecisionState`
  - `LabDecisionSnapshot`
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabDecisionSignal` is exactly `has-selection | has-source | is-running | has-result`.
  - `LabDecisionState` is exactly `idle | ready | running | done`.
  - `LabDecisionSnapshot` keeps `mode`, `intent`, `triggers`, `activeBlocks`, `timestamp`.
  - `LabDecisionSnapshot` may also include `state` if needed for panel/backbone clarity.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add Dedicated Decision Layer Helper

- **Location**: `rooms/laboratory/ui/lab-decision-layer.ts`
- **Description**: Add pure helpers for signal derivation, intent mapping, state mapping, DOM block reading, and snapshot building.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `lab-root.ts` only wires helpers into render/debug panel flow.
  - Pure helpers do not mutate state or DOM.
  - No controller imports or controller changes.
- **Validation**:
  - Focused tests import helper directly.

## Sprint 2: Deterministic Signals and Intent Mapping

**Goal**: Collapse trigger logic into four durable UI simplification signals.

**Demo/Validation**:

- Each signal maps to exact read-only state facts.
- Intent is the summary of current UI state.

### Task 2.1: Derive Four Signals

- **Location**: `rooms/laboratory/ui/lab-decision-layer.ts`
- **Description**: Derive `triggers` as the four compact signals.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `has-selection`: active selection exists.
  - `has-source`: source is ready in the same sense as the UI media viewport (`active`), including source/mode route compatibility.
  - `is-running`: run is queued/running.
  - `has-result`: an actual report/result payload exists; `explore` mode alone must not imply this signal.
  - Stable order is exactly:
    1. `has-selection`
    2. `has-source`
    3. `is-running`
    4. `has-result`
  - Signals are labels only; they are not consumed by dispatch/render decisions.
- **Validation**:
  - Pure unit tests for empty, source-only, selection-only, ready, running, result, and explore states.

### Task 2.2: Map Intent From Mode and Signals

- **Location**: `rooms/laboratory/ui/lab-decision-layer.ts`
- **Description**: Implement deterministic mapping:
  - `setup + has-selection + has-source` -> `ready-to-run`
  - `setup` with anything missing -> `preparing-analysis`
  - `running` -> `running-analysis`
  - `result` -> `reviewing-results`
  - `explore` -> `exploring-alternatives`
  - unknown/unsafe -> `idle`
- **Complexity**: 3
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Mapping is covered by tests.
  - Intent remains a summary of UI state, not a behavior driver.
- **Validation**:
  - Direct helper tests.

### Task 2.3: Map Short Decision State

- **Location**: `rooms/laboratory/ui/lab-decision-layer.ts`
- **Description**: Derive simple panel state:
  - `running-analysis` -> `running`
  - `reviewing-results` / `exploring-alternatives` -> `done`
  - `ready-to-run` -> `ready`
  - everything else -> `idle`
- **Complexity**: 2
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Panel state is intentionally short.
  - Panel does not show trigger/signal list.
- **Validation**:
  - Direct helper tests.

## Sprint 3: Snapshot Wiring

**Goal**: Build snapshots from the live UI without changing behavior.

**Demo/Validation**:

- Snapshot active blocks match rendered pipeline DOM.
- Snapshot is built after current render/sync work.

### Task 3.1: Read Active Blocks From Rendered DOM

- **Location**: `rooms/laboratory/ui/lab-decision-layer.ts`
- **Description**: Read `data-block-id` from `.labx-pipeline-block` scoped to current `.labx-shell`.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Preserve DOM order exactly.
  - Ignore missing/blank block IDs.
  - Do not add or query a wrapper node.
  - Do not dedupe duplicates unless a future contract requires that.
- **Validation**:
  - DOM harness test.

### Task 3.2: Build Snapshot During Render

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: After region/overlay sync, build `LabDecisionSnapshot` from mode, signals, DOM active blocks, and timestamp.
- **Complexity**: 4
- **Dependencies**: Sprint 2 and Task 3.1
- **Acceptance Criteria**:
  - Snapshot is built after `.labx-pipeline-block` nodes exist.
  - Snapshot does not dispatch events.
  - Snapshot does not mutate store.
  - Snapshot does not change render branching.
  - Fallback path re-reads the fresh shell after `replaceLabLayout(...)` before decision/debug panel sync, avoiding stale shell references.
- **Validation**:
  - Runtime DOM harness test.
  - Mounted fallback render test.

### Task 3.3: Control Decision Log Noise

- **Location**: `rooms/laboratory/ui/lab-root.ts` or `lab-decision-layer.ts`
- **Description**: Log only meaningful decision changes while debug is enabled.
- **Complexity**: 3
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Only `[lab][decision]` is added by PATCH 5.
  - Log payload may include signals/triggers.
  - Repeated identical snapshots are deduped by stable fields excluding `timestamp`.
  - A timestamp-only change must not create a new log.
  - Turning debug off resets the decision dedupe key so turning it back on emits the current decision once.
- **Validation**:
  - Debug log count tests.

## Sprint 4: Debug Panel Simplification

**Goal**: Show only the semantic backbone, not a diagnostic dump.

**Demo/Validation**:

- Panel is simple and future-UI oriented.
- Trigger list is not shown in panel.

### Task 4.1: Extend Debug Panel With Simple Decision Summary

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Update existing debug panel content to include:
  - `mode`
  - `intent`
  - `blocks` count
  - `state`
- **Complexity**: 3
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Panel does not show trigger/signal list.
  - Existing region/pipeline counts may remain if needed by PATCH 4, but PATCH 5-facing text must emphasize mode/intent/blocks/state.
  - Existing insert, update, and remove paths are covered.
  - `pointer-events: none` and non-intrusive positioning remain.
- **Validation**:
  - UI evaluation tests.
  - CSS source assertions.

### Task 4.2: Console Decision Log

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Emit concise debug log:
  - `[lab][decision] mode=<mode> intent=<intent>`
  - Payload includes `triggers`, `activeBlocks`, `state`, `timestamp`.
- **Complexity**: 2
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Debug-off console remains clean.
  - No new region/overlay/pipeline log category is introduced.
  - Existing PATCH 4 logs remain untouched.
- **Validation**:
  - Console capture tests for debug on/off.

## Sprint 5: Regression, Build, Smoke, and Review

**Goal**: Prove the backbone is additive and aligned with current UI.

**Demo/Validation**:

- Existing tests pass.
- New decision tests pass.
- Live smoke confirms the simple state appears when debug is enabled.

### Task 5.1: Decision Regression Tests

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts` and, if useful, `scripts/tests/laboratory-source-ui-regressions.test.ts`
- **Description**: Add tests for mapping, signals, block order, panel text, and debug log gating.
- **Complexity**: 4
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Mode/intent mapping covered.
  - Four-signal list covered.
  - Panel hides trigger list.
  - Active blocks match rendered DOM order.
  - Runtime path test exercises actual render or mounted render path, not helper-only coverage.
- **Validation**:
  - Focused test commands.

### Task 5.2: Build and Parity

- **Location**: generated room runtime via lifecycle command
- **Description**: Run room build and parity checks after source edits.
- **Complexity**: 2
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Generated runtime aligns with source.
  - Installed parity tests pass.
- **Validation**:
  - `npm run rooms:build`
  - Installed parity tests.

### Task 5.3: Electron/CDP Smoke

- **Location**: live app when available
- **Description**: Verify debug-off and debug-on behavior.
- **Complexity**: 3
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
- Debug off: no `[lab][decision]` logs, no debug panel.
- Debug off -> on: current `[lab][decision]` log appears once even when the semantic snapshot did not change while debug was disabled.
  - Debug on: decision log appears and panel shows mode/intent/blocks/state.
  - Debug cleanup removes attribute/panel afterward.
- **Validation**:
  - CDP `Runtime.evaluate`.
  - Screenshot if app is running.

### Task 5.4: Final Sub-Agent Review

- **Location**: whole patch
- **Description**: Ask a sub-agent to compare the final implementation against this revised plan.
- **Complexity**: 2
- **Dependencies**: Tasks 5.1-5.3
- **Acceptance Criteria**:
  - Findings are fixed before closeout.
  - Final report includes changes, validation, live smoke status, and broken dependency status.
- **Validation**:
  - Sub-agent review result.

## Testing Strategy

Run:

1. `npm run rooms:typecheck`
2. `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`
3. `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
4. `npm run rooms:test:file -- scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-selection-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
5. `npm run rooms:build`
6. `npm run rooms:test:file -- scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`
7. `git diff --check`
8. Electron/CDP smoke when available

## Potential Risks & Mitigations

- **Risk**: Snapshot becomes a behavior source too early.
  - **Mitigation**: This patch only builds/logs/displays it; no render or controller decisions consume it.
- **Risk**: Signals become too diagnostic again.
  - **Mitigation**: Only four signals are allowed.
- **Risk**: Debug panel gets noisy.
  - **Mitigation**: Panel shows mode, intent, block count, and short state only.
- **Risk**: Snapshot drifts from current UI.
  - **Mitigation**: Active blocks are read from rendered DOM; mode comes from `resolveDrawerMode(state)`.
- **Risk**: Fallback creates stale snapshot/panel.
  - **Mitigation**: Re-read fresh shell after fallback replacement.
- **Risk**: Decision logs spam debug console.
  - **Mitigation**: Dedupe stable snapshot fields excluding timestamp.

## Rollback Plan

- Remove decision types.
- Remove `lab-decision-layer.ts`.
- Remove lab-root decision wiring and panel additions.
- Remove decision-specific tests.
- Re-run focused suites, build, parity, and `git diff --check`.

## Acceptance Checklist

- Decision snapshot exists as future UI intent backbone.
- Signals are exactly `has-selection`, `has-source`, `is-running`, `has-result`.
- Intent mapping follows the revised rules.
- Panel shows mode, intent, blocks count, and short state.
- Trigger/signal list is not shown in panel.
- Only `[lab][decision]` is added by PATCH 5 logging.
- Snapshot changes no behavior in this patch.
- Pipeline order and DOM contracts remain intact.
- Final sub-agent review has no open actionable findings.
