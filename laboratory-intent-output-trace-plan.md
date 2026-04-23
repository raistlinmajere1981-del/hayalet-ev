# Plan: Laboratory Intent Output Trace

**Generated**: 2026-04-23
**Estimated Complexity**: Medium

## Overview

Add a non-blocking observation layer to the Laboratory room that compares selected
intent expectations with actual project assets. The Process panel will show an
`INTENT OUTPUT TRACE` section per executed intent, listing expected output groups
and actual assets tagged with that intent.

The implementation should not validate or block the run. It should only observe:

- expected outputs come from a small static intent mapping
- actual outputs come from the existing project asset registry
- asset registry data is read, never mutated, by the trace layer
- source of truth remains `rooms/laboratory/...`
- `data/rooms/laboratory/...` is refreshed by the room build/install flow

## Research Notes

- `rooms/laboratory/models/lab-types.ts` already defines `LabAssetType`,
  `LabAsset`, `LabIntentId`, `LabRun`, and `LabProcessSectionId`.
- `LabAsset.intentIds` already exists as optional lineage metadata.
- `rooms/laboratory/runtime/lab-selectors.ts` already exposes `getAssets`,
  `getCurrentRun`, `getRunSnapshotSummary`, and process panel selectors.
- `rooms/laboratory/ui/workspace-process-panel.ts` already renders the Process
  panel, intent execution map, pipeline, findings, artifacts, and recent actions.
- `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  currently registers output assets with `intentIds` derived from workbench scope
  when no explicit asset intent list exists.
- `rooms/laboratory/runtime/lab-run-controller.ts` starts UI export actions such
  as ROI image, frame grab, timeline clip, and audio track extraction.
- Existing tests already cover project asset hydration, asset selectors,
  intent-scoped run snapshots, and output asset intent lineage.

## Scope Decisions

- The trace is informational only. Missing output means an observation, not an
  error state.
- The first expected-output mapping is static and intentionally incomplete.
- Expected matching uses asset type membership only, not filename or module
  provenance.
- The UI should use the frozen run intent snapshot when a run exists, then fall
  back to selected live intents before a run starts.
- The trace should not create, update, remove, or normalize assets.
- Unmapped executed intents should still render a neutral observation:
  `Bu intent için beklenen çıktı tanımı yok`.
- `getActualOutputs` v1 follows the requested selector contract exactly: filter
  registry assets by `intentIds` only. Source assets are normally untagged; if a
  source asset is intentionally tagged, the selector will include it but it will
  not match expected rows unless a mapping includes `source`.
- Do not hand-edit `data/rooms/laboratory/...`.

## Prerequisites

- Current workflow is terminal/plain text:
  `mode:status = terminal`, `whereami.effectiveMode = other-provider-cli`.
- Implementation should run in `workflow:terminal-mode` unless the mode changes
  before coding starts.
- For any future code-change turn, follow this repo's change approval protocol
  before editing code.
- Use targeted room tests first, then broader room typecheck/build checks.

## Sprint 1: Contract and Selectors

**Goal**: Add the expected-output data contract and pure selector helpers without
touching UI rendering yet.

**Demo/Validation**:

- TypeScript accepts the new expected-output model.
- Selectors return static expectations and intent-scoped actual assets.
- Existing asset selector behavior remains unchanged.

### Task 1.1: Add Expected Output Type

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabExpectedOutput` with `intentId`, `label`, and
  `assetTypes: LabAssetType[]`.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - The type reuses existing `LabAssetType`.
  - The type does not change `LabAsset` or persistence shape.
  - No runtime behavior changes in this task.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add Static Expected Output Mapping

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getExpectedOutputs(intentId)` returning
  `LabExpectedOutput[]`. Start with:
  `visual-inspection` -> frame/image and artifact groups;
  `audio-investigation` -> audio group; default -> empty list.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The function is pure and has no store dependency.
  - Unknown intent ids return an empty array.
  - Labels match the requested first version copy.
- **Validation**:
  - Add focused assertions in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`.

### Task 1.3: Add Actual Output Selector

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getActualOutputs(state, intentId)` that reads
  `getAssets(state)` and filters assets whose `intentIds` include `intentId`.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Missing `intentIds` never matches.
  - The returned list is a derived array consistent with `getAssets(state)`.
  - The selector does not inspect `run.artifacts`.
  - Source assets are not specially excluded in v1; matching is driven only by
    `intentIds`.
- **Validation**:
  - Extend the existing asset selector test to cover intent-scoped actual assets.
  - Include a negative case for assets without `intentIds`.
  - Include a documented source-asset case so future output-vs-source semantics
    are an explicit product change, not an accidental regression.

### Task 1.4: Add Match Helper or Local Matching Rule

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts` or
  `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Centralize or locally implement the requested matching rule:
  an expected output is matched when any actual asset has a type included in the
  expected output's `assetTypes`.
- **Complexity**: 2
- **Dependencies**: Tasks 1.2 and 1.3
- **Acceptance Criteria**:
  - Matching is boolean and informational only.
  - The rule ignores asset names, metadata, and file existence.
  - If centralized, the helper remains pure.
- **Validation**:
  - Selector test covers a matched frame/image expectation and an unmatched
    artifact expectation.

## Sprint 2: Intent Lineage Enforcement

**Goal**: Ensure newly created assets have intent lineage tied to the run scope
whenever a current run snapshot exists.

**Demo/Validation**:

- Assets created during/after a scoped run carry run intent ids.
- Existing fallback behavior still works when there is no current run.
- Asset creation remains project-registry compatible.

### Task 2.1: Find the UI Asset Creation Boundary

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Identify the asset creation or action payload boundary that
  the existing implementation uses for UI-triggered asset creation. Confirm
  whether `currentRun?.analysisScope.intentIds` should be sent in action payloads
  or applied at a local asset construction point.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - The implementation point is documented in the code review notes.
  - No duplicate asset lineage sources are introduced.
  - The change does not make source assets require intent lineage.
- **Validation**:
  - Static inspection plus targeted regression after Task 2.2.

### Task 2.2: Attach Current Run Intent IDs to Created Assets

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: When a non-source output asset is created or requested from
  the UI side, include `intentIds` from `currentRun?.analysisScope?.intentIds`
  in the relevant action payload when available. Cover ROI image, frame grab,
  timeline clip, and audio extraction actions. Keep a fallback to existing
  workbench intent derivation for cases without a run snapshot.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Run-scoped output assets prefer frozen run intent ids.
  - Empty or missing run intent ids do not create invalid lineage.
  - Existing host-side fallback still covers non-run exports.
  - The system remains non-blocking when no intent ids exist.
- **Validation**:
  - Extend `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
    or add a controller-level test that proves run intent ids reach output assets.

### Task 2.3: Thread Intent IDs Through Host Export Handlers

- **Location**:
  `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- **Description**: Read payload `intentIds` in each durable output path and pass
  normalized non-empty ids into `registerOutputAsset`. Cover
  `exportROIImage`, `exportFrameGrab`, `exportTimelineClip`, and
  `exportAudioTrack`.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Explicit payload ids reach the durable project asset record.
  - Empty payload id arrays are treated as missing and trigger fallback behavior.
  - Each export handler uses the same normalization rule.
  - The change does not alter file generation or job lifecycle behavior.
- **Validation**:
  - Extend host action runtime tests for at least frame and audio output paths.
  - Add static or unit coverage for the normalization helper if it is shared.

### Task 2.4: Tighten Host Fallback for Output Assets

- **Location**:
  `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- **Description**: Verify `registerOutputAsset` still fills `intentIds` when
  caller payload does not provide them. If run-scope lineage arrives from the UI,
  preserve it instead of replacing it with live workbench intent ids.
- **Complexity**: 3
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Explicit `assetInput.intentIds` wins.
  - Existing fallback to project workbench scope remains.
  - Empty explicit ids do not persist `[]`; they fall back or omit lineage.
  - Existing output asset lineage tests still pass.
- **Validation**:
  - Existing output asset test continues to pass.
  - Add a second assertion for explicit intent id preservation if missing today.
  - Add a drift regression: freeze run ids, change live workbench ids, export an
    output, and assert the output asset uses frozen run ids.

## Sprint 3: Process Panel Trace UI

**Goal**: Render `INTENT OUTPUT TRACE` inside the Process panel using selectors
from Sprint 1 and lineage from Sprint 2.

**Demo/Validation**:

- Running or completed visual intent shows expected rows and actual assets.
- Matched expected rows show success; unmatched rows show missing.
- If an intent has no actual assets, the UI says it produced no output.

### Task 3.1: Import Trace Selectors and Asset Types

- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Import `getExpectedOutputs`, `getActualOutputs`, and any
  needed types. Reuse existing `getExecutionIntentIds(state)` to decide which
  intents to render.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The trace uses frozen run intent ids when available.
  - No duplicate intent resolution logic is introduced.
  - Unknown or unmapped intents render a neutral `Beklenen çıktı tanımı yok`
    observation instead of disappearing.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 3.2: Add Trace Renderer

- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Add a small renderer for `INTENT OUTPUT TRACE`. For each
  intent, render the intent label, expected output rows, check/missing icons, and
  a produced asset list using asset names.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Expected rows use the requested `some(asset.type)` matching rule.
  - Actual output list uses project assets filtered by `intentIds`.
  - Empty actual output list shows: `Bu intent herhangi bir çıktı üretmedi`.
  - Mapped intents with no expected rows show:
    `Bu intent için beklenen çıktı tanımı yok`.
  - The section does not alter pipeline, findings, artifacts, or registry state.
- **Validation**:
  - Add UI render assertions in `scripts/tests/laboratory-source-ui-regressions.test.ts`.
  - Check visual inspection renders a matched frame and unmatched artifact.
  - Check `detail-enhancement` or another unmapped intent renders the neutral
    no-definition observation.

### Task 3.3: Position Trace in the Process Panel

- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Insert the trace after `Intent -> Execution Map` and before
  Pipeline so the user sees expectation vs output before step details.
- **Complexity**: 2
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Idle panel may omit the trace or show only after a run exists.
  - Active/completed run panel shows the trace when there are execution intents.
  - The trace does not use collapsible section state unless a new section id is
    intentionally added.
- **Validation**:
  - UI render test confirms section ordering around snapshot/map/pipeline.
  - UI render test confirms live selected-intent drift does not change trace
    intent rows while a frozen run snapshot exists.

### Task 3.4: Add Trace Styling

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add compact styles that match existing process section and
  intent map density. Use restrained success/missing tones and stable spacing.
- **Complexity**: 3
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - No nested card-in-card layout.
  - Text wraps cleanly at narrow widths.
  - Check/missing markers do not resize rows or overlap content.
- **Validation**:
  - Manual responsive smoke in the Laboratory room.
  - Optional screenshot/DOM smoke if the app is available.

## Sprint 4: Regression Coverage and Build Parity

**Goal**: Lock the trace behavior with tests and ensure the workspace room build
keeps installed-copy parity.

**Demo/Validation**:

- Targeted tests pass.
- Room typecheck passes.
- Workspace room build refreshes generated installed output.

### Task 4.1: Selector Regressions

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests for static expected outputs, actual output filtering,
  and type-based expected matching.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `visual-inspection` returns frame/image and artifact expectations.
  - `audio-investigation` returns audio expectation.
  - Unknown intent returns empty expectations.
  - Actual outputs include only assets whose `intentIds` include the target id.
  - A tagged source asset is included by the selector contract but does not match
    expected visual/audio rows unless the expected mapping includes `source`.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.2: UI Render Regressions

- **Location**: `scripts/tests/laboratory-source-ui-regressions.test.ts`
- **Description**: Add Process panel render tests for visual and no-output cases.
- **Complexity**: 4
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - HTML includes `INTENT OUTPUT TRACE`.
  - Visual inspection shows the requested expected labels.
  - A frame asset name appears in produced outputs.
  - The no-output copy appears for an intent with no actual assets.
  - An unmapped executed intent shows the neutral no-definition observation.
  - Trace intent rows use frozen run snapshot ids even if live workspace
    selected intents changed.
  - The trace does not remove existing Pipeline/Artifacts sections.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`

### Task 4.3: Asset Lineage Regression

- **Location**:
  `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`,
  optionally `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add or extend a regression proving generated output assets
  keep intent ids from the frozen run scope where applicable.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Frame/image/audio output asset lineage uses frozen run ids for scoped runs.
  - Explicit caller intent ids are preserved.
  - Explicit empty ids fall back without persisting `[]`.
  - Existing fallback still works when run scope is absent.
  - Live workbench intent drift after run start does not override frozen run
    intent ids.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 4.4: Room Build and Parity

- **Location**: generated output under `data/rooms/laboratory/...`
- **Description**: Run the room build after source changes so installed JS/CSS is
  regenerated from workspace source. Do not hand-edit installed files.
- **Complexity**: 2
- **Dependencies**: Sprints 1 through 3
- **Acceptance Criteria**:
  - Generated installed files reflect source changes.
  - Existing active shell parity coverage includes `ui/workspace-process-panel.js`
    and `ui/lab-theme.css`; update parity expectations only if a new generated
    UI/CSS file is introduced.
  - Parity tests do not report stale installed copy drift.
- **Validation**:
  - `npm run rooms:build`
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`

### Task 4.5: Final Verification

- **Location**: repo root
- **Description**: Run the focused and broad room validation sequence.
- **Complexity**: 2
- **Dependencies**: Task 4.4
- **Acceptance Criteria**:
  - All targeted Laboratory tests pass.
  - Room typecheck passes.
  - Manual smoke confirms the requested visual intent scenario.
- **Validation**:
  - `npm run rooms:typecheck`
  - targeted test commands from Tasks 4.1 through 4.4
  - manual smoke: select visual intent, run analysis, confirm frame output and trace

## Testing Strategy

- Unit-level selector tests cover expected mapping and actual asset filtering.
- UI render tests cover markup, copy, matched/missing status, and empty output copy.
- Host/action tests cover output asset lineage from run scope and fallback behavior.
- Build parity tests ensure source-only edits regenerate the installed room copy.
- Manual smoke covers the requested scenario:
  visual intent selected, analysis run started, frame produced, expected row matched,
  produced assets listed.

## Potential Risks & Gotchas

- `lab-run-controller.ts` may not directly create durable assets. The actual
  durable write currently happens host-side, so implementation must first confirm
  the correct UI-to-host lineage boundary.
- Current host fallback reads live workbench scope. If the user changes intents
  after a run starts, live scope may differ from the frozen run snapshot. Prefer
  frozen run intent ids when available.
- `LabExpectedOutput.intentId` is a string in the requested model. Do not narrow
  it too aggressively if future dynamic mappings may include external intent ids.
- `run.artifacts` and project `assets` are different surfaces. The trace must read
  project assets only, even when run artifacts contain similar files.
- Static expected mapping will be incomplete for `detail-enhancement` and
  `anomaly-detection` at first. Empty mapping should not look like a failure.
- Adding a new collapsible process section would require extending
  `LabProcessSectionId` and persisted UI state. Prefer a non-collapsible trace
  block unless product explicitly wants collapse behavior.
- Installed copy drift is easy to create if `data/rooms/laboratory/...` is edited
  by hand. Build from `rooms/laboratory/...` instead.

## Rollback Plan

- Revert the selector/type/UI commits for the trace layer.
- Keep asset registry data untouched; the trace does not mutate registry state.
- If lineage enforcement causes issues, revert only the payload/lineage change and
  leave the read-only expected/actual trace hidden or behind a short-term guard.
- Re-run `npm run rooms:build` after rollback to refresh installed room output.
