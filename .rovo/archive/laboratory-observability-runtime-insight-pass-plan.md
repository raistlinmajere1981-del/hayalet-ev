# Plan: Laboratory Observability & Runtime Insight Pass

**Generated**: 2026-05-02
**Estimated Complexity**: Medium

## Overview

PATCH 4 adds debug-only observability to the Laboratory layout runtime without changing DOM contracts, layout hierarchy, pipeline structure, or controller behavior. The implementation will make region lifecycle, pipeline block render order, overlay health, and fallback decisions visible only when the existing debug switch is active: `.labx-shell[data-lab-debug-regions="true"]`.

This is an instrumentation pass. It must not introduce new user-facing behavior, persistent state, controller semantics, or layout wrappers.

## Research Summary

- Region lookup and sync are centralized in `rooms/laboratory/ui/lab-root.ts` through `LAB_REGION_SELECTORS`, `queryRegion`, `syncRegion`, `shouldFallback`, and `syncOverlayRoot`.
- Current debug behavior is limited to `debugLabRegionsSynced(...)`, which logs one aggregate `[lab-root] regions synced` object only when `data-lab-debug-regions="true"`.
- Pipeline rendering is centralized in `rooms/laboratory/ui/laboratory-layout.ts` through `renderPipeline(blocks, mode)`.
- PATCH 3 keeps `.labx-drawer__body` as the pipeline host and renders only `.labx-pipeline-block` wrappers.
- Existing CSS already gates debug outlines under `.labx-shell[data-lab-debug-regions="true"]`.
- Existing regression tests assert selector fallback, region stability, pipeline metadata, debug outline gating, and Electron/CDP smoke paths.

## Clarification Gate

No blocking questions remain.

## Safe Assumptions

- Debug logging can use `console.debug` only, with exact string prefixes such as `[lab][region]`, `[lab][pipeline]`, `[lab][fallback]`, and `[lab][overlay]`.
- `renderPipeline(...)` may call a small debug helper that checks `globalThis.document` for `.labx-shell[data-lab-debug-regions="true"]`; when no document or shell exists, it stays silent.
- Initial full-render pipeline traces are best-effort only. The required trace contract applies after a debug shell exists; renderers must stay silent with no document, no shell, or a non-debug shell.
- The debug panel may be appended directly to `.labx-shell` by `lab-root.ts` and removed when debug is off.
- The debug panel is not a layout wrapper and must use absolute/fixed positioning plus `pointer-events: none`.
- Region `mount` means a region exists after a full shell render or first observed sync; region `update` means an existing region was successfully synced; `missing` means the region selector was not found during incremental sync; `fallback` means critical mass failed and full layout replacement was triggered.
- Full shell replacement must preserve an already-enabled debug session: capture debug-on before replacement, emit fallback diagnostics before replacement, reapply the debug attribute to the new shell, then refresh the debug panel.
- The existing aggregate `[lab-root] regions synced` log should be retired or replaced by the new `[lab][region]` event stream in the same patch, with source tests updated explicitly.

## Prerequisites

- PATCH 1, PATCH 2, and PATCH 3 remain in place.
- Do not edit `rooms/laboratory/runtime/lab-run-controller.ts`.
- Keep these DOM contracts stable:
  - `data-lab-action`
  - `data-lab-field`
  - `data-lab-role`
  - `data-lab-region`
  - `data-lab-preserve-media`
- Do not add `.labx-pipeline` or any new pipeline host wrapper.
- Do not wrap or move `.labx-timeline`.

## Sprint 1: Observability Foundation

**Goal**: Add reusable debug predicates and structured logging helpers while keeping default runtime silent.

**Demo/Validation**:
- Debug off: calling the helpers produces no console output.
- Debug on: helpers emit structured, prefix-stable logs.

### Task 1.1: Add Debug Predicate Helpers

- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Normalize debug detection behind helpers:
  - shell-based predicate in `lab-root.ts`
  - document/global debug predicate usable from `renderPipeline(...)`
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Debug is active only when `.labx-shell[data-lab-debug-regions="true"]` exists.
  - No logs are emitted when debug is off.
  - Helper guards `console`, `document`, and non-browser test contexts.
- **Validation**:
  - Source regression asserts debug predicate names and gating.
  - Runtime test stubs `console.debug` and verifies no output without debug shell.

### Task 1.2: Add Structured Console Helpers

- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Add small helpers for stable debug messages:
  - `[lab][region] <region> -> <event>`
  - `[lab][pipeline] <mode> -> <block-id> (#<index>)`
  - `[lab][fallback] triggered -> regionsFound: <count>`
  - `[lab][overlay] <overlay> -> missing`
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Uses `console.debug` only.
  - Logs include structured object payloads for machine-readable metadata.
  - Message prefixes are stable for tests and CDP inspection.
- **Validation**:
  - Unit/source tests match prefixes and payload fields.

## Sprint 2: Region Lifecycle & Fallback Diagnostics

**Goal**: Make region sync decisions visible without changing sync behavior.

**Demo/Validation**:
- Debug on: region mount/update/missing/fallback decisions are readable in console.
- Debug off: no region logs.
- Fallback still replaces only when `regionsFound < 3`.

### Task 2.1: Extend Region Descriptor Metadata

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Carry a display name for each region from existing `LabRegionKey` values into lifecycle logging.
- **Complexity**: 2/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No selector order changes.
  - No new selectors replace canonical/alias/legacy priority.
  - Region keys remain tied to `LAB_REGION_SELECTORS`.
- **Validation**:
  - Existing selector-priority tests remain passing.

### Task 2.2: Instrument `syncRegion(...)`

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Add optional debug metadata to `syncRegion(...)` input and emit:
  - `missing` if no current element is found
  - `update` after successful sync
  - `mount` only for first observed shell/full render path, not for normal updates
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Region lifecycle logging does not change `innerHTML`, `updateRenderedElement`, or scroll preservation behavior.
  - Missing regions are logged but skipped as today.
  - Existing fallback behavior is unchanged.
- **Validation**:
  - New test covers debug-on update log.
  - New test covers debug-on missing log.
  - Existing `lab-root` shell sync tests pass.

### Task 2.3: Instrument `shouldFallback(...)`

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Keep `shouldFallback(regionsFound)` pure and add a companion diagnostic helper so fallback reasons are emitted before `replaceLabLayout(...)` runs. Diagnostics must use the pre-replacement shell/debug state and include:
  - `regionsFound`
  - missing region keys
- **Complexity**: 4/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Fallback threshold remains `regionsFound < 3`.
  - No hidden full re-render loop is introduced.
  - Missing list is logged only when debug is enabled.
  - Fallback diagnostics are emitted before the old debug shell can be replaced.
- **Validation**:
  - New fallback diagnostic test asserts `regionsFound` and missing keys.
  - Existing PATCH 2 fallback tests remain passing.

### Task 2.4: Preserve Debug State Across Full Shell Replacement

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: When fallback or layout-kind replacement calls `replaceLabLayout(...)`, capture whether the old shell has `data-lab-debug-regions="true"`, perform replacement, then reapply the debug attribute to the new `.labx-shell` and refresh debug panel state.
- **Complexity**: 5/10
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Debug attribute is preserved only if it was active before replacement.
  - Fallback log is emitted before replacement.
  - New shell receives `data-lab-debug-regions="true"` after replacement when appropriate.
  - Debug panel is updated after replacement and removed when debug is off.
- **Validation**:
  - Test fallback replacement with debug enabled.
  - Test layout-kind replacement with debug enabled.
  - Test replacement with debug disabled remains silent and panel-free.

## Sprint 3: Pipeline Block Trace

**Goal**: Trace pipeline block render order without changing `renderPipeline(...)` output.

**Demo/Validation**:
- Debug on: every visible, non-empty block logs mode, id, type, and render order.
- Debug off: no pipeline logs.
- Markup remains byte-compatible except for formatting already controlled by Prettier.

### Task 3.1: Add Pipeline Debug Trace Helper

- **Location**: `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Add a helper called from `renderPipeline(...)` after visibility and empty-content filtering.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Hidden blocks do not log.
  - Empty-render blocks do not log.
  - Logged index is the final visible order index, not the original array index.
  - `renderPipeline(...)` stays silent with no `globalThis.document`.
  - `renderPipeline(...)` stays silent when a document exists but no debug shell exists.
  - `renderPipeline(...)` starts logging only after a debug shell is present and stops after that shell or attribute is removed.
- **Validation**:
  - Existing `renderPipeline` test still passes.
  - New test stubs debug shell and asserts order: `analysis-prep (#0)`, `preflight (#1)`, etc.
  - New test covers no-document, document-without-shell, debug-shell, and debug-shell-removed cases.

### Task 3.2: Preserve Pipeline Markup Contract

- **Location**: `scripts/tests/laboratory-source-ui-regressions.test.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Expand tests so instrumentation cannot add `.labx-pipeline`, change metadata names, or log hidden/empty blocks.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `.labx-drawer__body` remains the host.
  - `.labx-pipeline-block` wrappers remain the only pipeline wrappers.
  - `data-block-id`, `data-block-type`, and `data-block-mode` stay unchanged.
- **Validation**:
  - Source UI regression test.
  - UI evaluation source contract test.

## Sprint 4: Overlay Health & Debug Panel

**Goal**: Add non-intrusive debug visibility for overlays and runtime counts.

**Demo/Validation**:
- Debug on: a small, non-interactive debug panel appears and stays out of layout flow.
- Debug off: debug panel is absent and console is clean.

### Task 4.1: Instrument `syncOverlayRoot(...)`

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Add overlay names to sync calls and log overlay health without triggering shell replacement:
  - missing current root
  - invalid or empty rendered overlay markup
  - successful append/update may stay silent unless useful for debug panel counts
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Existing append behavior remains unchanged when `render()` returns a valid overlay root.
  - Missing/invalid overlay markup logs only in debug mode.
  - No fallback/full shell replace is introduced by overlay diagnostics.
- **Validation**:
  - New test asserts missing overlay log does not call fallback replacement.
  - New test asserts invalid overlay markup with an existing root is debug-logged and does not trigger fallback.
  - Existing overlay tests pass.

### Task 4.2: Add Debug Panel Lifecycle

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Add/update/remove a single debug node:
  - `data-lab-debug-panel="true"`
  - region count = `shell.querySelectorAll("[data-lab-region]").length`
  - pipeline block count = `shell.querySelectorAll(".labx-pipeline-block").length`
  - active drawer mode = `shell.querySelector("[data-lab-region=\"context-panel\"], .labx-drawer")?.getAttribute("data-drawer-mode") ?? "unknown"`
- **Complexity**: 5/10
- **Dependencies**: Sprint 2, Sprint 3
- **Acceptance Criteria**:
  - Debug panel exists only while shell debug attribute is true.
  - It is appended directly under `.labx-shell`.
  - It does not wrap or move any existing nodes.
  - It is removed when debug turns off.
  - Count semantics use visible DOM queries, not pipeline model arrays or region descriptor counts.
- **Validation**:
  - DOM test asserts panel appears only in debug mode.
  - DOM tests cover full laboratory, collapsed drawer, and import/empty drawer states.
  - Electron/CDP smoke checks panel counts.

### Task 4.3: Add Debug Panel CSS

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add minimal gated styling:
  - absolute or fixed positioning
  - `pointer-events: none`
  - small typography
  - no layout-affecting margins or grid participation
- **Complexity**: 2/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - CSS selector is gated under `.labx-shell[data-lab-debug-regions="true"]`.
  - No default-mode visual change.
  - No card-like UI or nested-card structure is introduced.
  - The panel uses `position: absolute` or `position: fixed`.
  - The panel does not define `grid-area`.
  - The panel has no margin rules that can affect shell grid layout.
- **Validation**:
  - UI evaluation test asserts `pointer-events: none`.
  - UI evaluation test asserts `position`, no `grid-area`, and no layout-affecting margins.
  - Screenshot/CDP smoke checks no layout shift.
  - CDP smoke compares `getBoundingClientRect()` for topbar, main stage, context panel, inspector panel, and process strip before and after enabling debug.

## Sprint 5: Observability Tests & Electron Smoke

**Goal**: Lock observability behavior with automated tests and live debug smoke.

**Demo/Validation**:
- All old tests pass.
- New observability tests pass.
- CDP verifies debug-on logs and debug-off silence.

### Task 5.1: Add Console Capture Test Helpers

- **Location**: relevant `scripts/tests/laboratory-*.test.ts`
- **Description**: Add small test-local helpers to capture `console.debug` safely and restore it after each test. Prefer a focused behavior harness over regex-only tests:
  - either a narrow `__testOnly...` observability export from `lab-root.ts`
  - or a real-enough DOM harness that supports `querySelector`, `querySelectorAll`, `createElement("template")`, `appendChild`, `remove`, `outerHTML`, and attribute reads/writes
- **Complexity**: 3/10
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Console monkeypatch always restores in `finally`.
  - Tests do not leak global `document` stubs.
  - Region, fallback, and overlay behavior tests exercise runtime paths rather than source regex alone.
- **Validation**:
  - Run focused test file twice to catch leaks.

### Task 5.2: Add Debug-Off Clean Console Tests

- **Location**: `scripts/tests/laboratory-source-ui-regressions.test.ts` or a new focused observability regression test
- **Description**: Assert region and pipeline rendering produce no `[lab]` logs without debug shell.
- **Complexity**: 3/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - `renderPipeline(...)` is silent without debug.
  - lab root incremental sync is silent without debug.
- **Validation**:
  - Focused observability test.

### Task 5.3: Add Debug-On Region and Pipeline Tests

- **Location**: `scripts/tests/laboratory-source-ui-regressions.test.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Assert:
  - region update log appears
  - missing region log appears in partial DOM
  - pipeline logs visible blocks in final order
- **Complexity**: 5/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Tests assert exact prefix and structured payload fields.
  - Tests do not rely on brittle full HTML snapshots.
- **Validation**:
  - Focused source UI tests pass.

### Task 5.4: Add Fallback Diagnostic Test

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts` or existing lab-root regression coverage
- **Description**: Create a partial shell with fewer than three regions and assert fallback diagnostic includes count and missing region list before full shell replacement.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Fallback diagnostic is debug-gated.
  - Full shell replacement behavior remains intentional.
  - Debug attribute is preserved on the replacement shell when it was active before fallback.
  - Debug panel is refreshed after replacement.
- **Validation**:
  - Focused test plus existing lab-root sync tests.

### Task 5.5: Add Installed Parity Coverage

- **Location**: no source change
- **Description**: Run installed parity tests that cover active shell/runtime copies after source and CSS changes.
- **Complexity**: 2/10
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Source/runtime parity remains intact.
  - No stale installed laboratory shell artifacts are accepted silently.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`

### Task 5.6: Electron/CDP Smoke

- **Location**: no source change
- **Description**: In an open Laboratory page:
  - enable `data-lab-debug-regions="true"`
  - capture console logs for region/pipeline/fallback where possible
  - verify debug panel DOM
  - compare key region bounding boxes before/after enabling debug
  - disable debug and verify no new `[lab]` logs
- **Complexity**: 4/10
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Debug-on logs are visible.
  - Debug-off logs are absent after disabling.
  - Debug panel count matches DOM query counts.
  - Debug panel does not shift topbar, main stage, context panel, inspector panel, or process strip.
- **Validation**:
  - `hev_send_cdp_command` runtime evaluation.
  - `hev_read_electron_logs` if renderer logs are captured.

## Testing Strategy

- `npm run rooms:typecheck`
- `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-selection-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`
- Add focused observability regression tests to the smallest existing file unless a new test file is cleaner.
- `git diff --check`
- `hev_dev_check_syntax` for every edited TS/CSS test/source file.
- Electron/CDP smoke with debug on/off.

## Potential Risks & Gotchas

- **Pipeline debug from pure renderer**: `renderPipeline(...)` currently has no shell reference. Mitigation: use guarded `globalThis.document` detection and keep the helper silent in non-DOM contexts.
- **Console noise in production**: Any forgotten log would be noisy. Mitigation: all logging goes through debug-gated helpers, and tests assert debug-off silence.
- **Fallback loops**: Fallback diagnostics must not alter fallback threshold or call shell replacement from overlay health checks. Mitigation: keep `shouldFallback` behavior unchanged and test overlay missing separately.
- **Debug state lost on replacement**: `replaceLabLayout(...)` rewrites shell markup. Mitigation: capture debug state before replacement, log before replacement, reapply the debug attribute to the new shell, and refresh the debug panel.
- **Debug panel affecting layout**: A real node can still affect rendering if styled poorly. Mitigation: append only in debug mode, position out of flow, use `pointer-events: none`, and avoid grid participation.
- **Mount vs update semantics**: Existing incremental sync mostly updates existing nodes. Mitigation: define `mount` as full-shell/first-observed lifecycle and `update` as successful incremental sync.
- **Test leakage**: Console/document stubs can contaminate later tests. Mitigation: use `try/finally` restore helpers.
- **String prefix drift**: CDP/debug workflows need stable prefixes. Mitigation: constants for log scopes and tests for exact prefixes.
- **Private helper test fragility**: Runtime observability helpers are private. Mitigation: add either a narrow test-only observability export or a sufficiently real DOM harness; avoid source-regex-only confidence for lifecycle behavior.

## Rollback Plan

- Remove the debug helper functions and calls from `lab-root.ts` and `laboratory-layout.ts`.
- Remove debug panel CSS from `lab-theme.css`.
- Remove observability-specific tests.
- Keep PATCH 1-3 region, layout, pipeline, and selector changes untouched.

## Non-Goals

- No new feature workflow.
- No controller behavior changes.
- No pipeline model changes.
- No new wrappers.
- No timeline parent/child changes.
- No persistent debug setting.
- No user-facing UI beyond the debug-only panel.
