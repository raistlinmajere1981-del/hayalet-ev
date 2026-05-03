# Plan: Laboratory Layout Preflight Stabilization

**Generated**: 2026-05-01
**Estimated Complexity**: Medium

## Overview
Prepare the Laboratory UI for the upcoming layout refactor without changing behavior, DOM hierarchy, or layout. This patch only adds backward-compatible region hooks, dual-selector lookup support, an explicit timeline strategy lock, and optional gated debug outlines.

This is a preflight stabilization patch, not the layout refactor itself.

## Scope Boundaries
- No layout restructuring.
- No DOM hierarchy changes.
- No class renames.
- No CSS grid/flex layout changes.
- No inspector relocation.
- No timeline wrapper.
- No event delegation rewrites.
- Only additive attributes, selector compatibility helpers, and optional non-layout debug outlines.

## Prerequisites
- Existing DOM Contract Audit rules from `laboratory-room-layout-refactor-plan.md` are binding.
- Source of truth remains `rooms/laboratory`, not `data/rooms/laboratory`.
- Existing class-based selectors must continue to work.
- New region selectors must be additive and tried before old selectors in `lab-root.ts`.
- Patch 1 supersedes any earlier wrapper option for timeline layout: `TimelineArea` is always the existing `.labx-timeline` node, and no wrapper is allowed in this refactor path.

## Safe Assumptions
- `TimelineArea` is the existing `.labx-timeline` node, not a wrapper.
- `main-stage` maps to the existing `.labx-center-panel` for shell-level sync.
- `main-stage-inner` maps to the existing `.labx-media-workbench`.
- `left-rail-source` maps to the current top-bar mode controls container `.labx-top-bar__center` for now.
- Import-only mode can still render `.labx-center-panel` with `data-lab-region="main-stage"`; other lab-only regions remain absent.

## Sprint 1: Region Hook Preflight
**Goal**: Add non-structural region attributes to existing DOM nodes.

**Demo/Validation**:
- Rendered markup contains all applicable `data-lab-region` hooks in states that render those nodes.
- Existing classes and DOM hierarchy remain unchanged.
- No layout shift is introduced.

### Task 1.1: Add Top-Level Region Hooks
- **Location**: `rooms/laboratory/ui/lab-center-panel.ts`, `rooms/laboratory/ui/lab-top-bar.ts`, `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/lab-process-strip.ts`
- **Description**: Add region attributes to existing shell-level nodes.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - `.labx-top-bar` has `data-lab-region="topbar"`.
  - `.labx-top-bar__center` has `data-lab-region="left-rail-source"`.
  - `.labx-center-panel` has `data-lab-region="main-stage"`.
  - Every rendered `.labx-drawer` has `data-lab-region="context-panel"`.
  - `.labx-process-strip` has `data-lab-region="process-strip"`.
  - No existing class or attribute is removed.
- **Validation**:
  - Source grep for each new region hook.
  - `npm run rooms:typecheck`.

### Task 1.2: Add Workspace Region Hooks
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Add region attributes to existing workspace nodes without wrapping, moving, or splitting markup.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `.labx-media-workbench` has `data-lab-region="main-stage-inner"`.
  - `.labx-workspace-preview` has `data-lab-region="preview-area"`.
  - `.labx-workspace-inspector` has `data-lab-region="inspector-panel"`.
  - Existing `data-lab-workspace-inspector`, `data-lab-media-workbench`, `data-preview-mode`, and preview IDs remain unchanged.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`.

### Task 1.3: Add Timeline Region Hook
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add `data-lab-region="timeline-area"` directly to the existing `.labx-timeline` root.
- **Complexity**: 2
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `.labx-timeline` itself is the timeline area.
  - No wrapper is introduced.
  - `#lab-timeline`, `data-duration`, `data-waveform-mode`, `data-timeline-locked`, and `.labx-media-workbench > .labx-timeline` remain intact.
- **Validation**:
  - Source grep confirms no new timeline wrapper.
  - Existing timeline UI tests still pass through the source/UI suites.
  - Rendered markup asserts `.labx-media-workbench > .labx-timeline[data-lab-region="timeline-area"]`.

## Sprint 2: Dual-Selector Compatibility
**Goal**: Make `lab-root.ts` selector-agnostic while preserving old selectors.

**Demo/Validation**:
- `lab-root.ts` resolves new region selectors first.
- Old class selectors remain as fallback.
- Incremental DOM sync behavior is unchanged.

### Task 2.1: Add Region Query Helper
- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Add a small local helper for region-first lookup, such as `queryRegion(root, region, fallbackSelector)`, without changing render logic.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Helper tries `[data-lab-region="..."]` first.
  - Helper falls back to the old selector.
  - Helper is local to `lab-root.ts` and does not touch event delegation.
- **Validation**:
  - Typecheck.
  - Source readback of helper usage.

### Task 2.2: Migrate Incremental Sync Lookups
- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Replace direct sync target queries with dual-selector lookups.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `.labx-center-panel` lookup becomes `main-stage` first, `.labx-center-panel` fallback.
  - `.labx-top-bar` lookup becomes `topbar` first, `.labx-top-bar` fallback.
  - `.labx-drawer` lookup becomes `context-panel` first, `.labx-drawer` fallback.
  - `.labx-process-strip` lookup becomes `process-strip` first, `.labx-process-strip` fallback.
  - `lab-root.ts` must provide `inspector-panel` first, `.labx-workspace-inspector` fallback compatibility for any current or future inspector lookup.
  - Existing overlay root lookups remain unchanged.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.
  - Verify import-only layout still updates through `main-stage`/center fallback.

### Task 2.3: Preserve Replacement Fallback Behavior
- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Confirm the existing full-layout replacement path still triggers only when required regions are missing.
- **Complexity**: 2
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - No render loop is introduced.
  - Scroll preservation stays enabled for center and drawer updates.
  - Boot overlay sync remains inside `.labx-shell`.
- **Validation**:
  - UI evaluation regression tests.
  - Manual source readback around `replaceLabLayout`, `syncShellState`, and `syncBootOverlay`.

## Sprint 3: Timeline Strategy Lock
**Goal**: Freeze the no-wrapper timeline decision before the larger refactor.

**Demo/Validation**:
- Timeline direct-child CSS contract is still true.
- Timeline seek, drag, playback, bookmarks, volume, and micro-zoom contracts remain untouched.

### Task 3.1: Assert Timeline Root Contract in Tests
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, optionally `scripts/tests/laboratory-source-ui-regressions.test.ts`
- **Description**: Add or update assertions that `.labx-timeline` contains `data-lab-region="timeline-area"` and remains under `.labx-media-workbench` without a wrapper.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Tests encode that `TimelineArea` is `.labx-timeline`.
  - Tests do not require a new wrapper.
  - Existing `labx-media-workbench > .labx-timeline` expectations remain compatible.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 3.2: Verify Timeline Interaction Contracts
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Source-read only in this patch: confirm no timeline action, role, ID, or direct-child relationship changed while adding the region hook.
- **Complexity**: 2
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `data-lab-action="timeline-*"` hooks remain unchanged.
  - `data-lab-role="timeline-*"` hooks remain unchanged.
  - `#lab-timeline` and `#lab-audio-viz` remain unchanged.
- **Validation**:
  - Source grep.
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`.

## Sprint 4: Optional Debug Visibility
**Goal**: Add removable, non-layout debug outlines for region visibility without changing default UI appearance.

**Demo/Validation**:
- Regions are faintly visible only when the debug gate is explicitly enabled.
- No layout metrics are changed.

### Task 4.1: Add Region Debug Outline Block
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add a clearly labeled temporary CSS block for `[data-lab-region]` outlines behind a debug gate such as `[data-lab-debug-regions="true"]`.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Default UI has no region outlines unless the debug gate is present.
  - Gated `[data-lab-region]` gets only an `outline`.
  - Optional region-specific outline colors are low opacity.
  - No margin, padding, display, position, grid, flex, width, height, or overflow rules are added.
  - Block is labeled as temporary/removable.
- **Validation**:
  - CSS source readback.
  - UI/source regression tests to catch accidental selector effects.

## Sprint 5: Validation and Closeout
**Goal**: Prove the preflight patch is behavior-neutral.

**Demo/Validation**:
- Typecheck passes.
- Targeted UI regressions pass.
- Manual checklist is completed before moving to the real layout refactor.

### Task 5.1: Automated Validation
- **Location**: project root
- **Description**: Run the requested validation commands.
- **Complexity**: 3
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts` passes.
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts` passes.
- **Validation**:
  - Command output recorded in implementation summary.

### Task 5.2: Manual Behavior Checklist
- **Location**: running Laboratory UI, if available
- **Description**: Verify there is no visual or behavioral change.
- **Complexity**: 2
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - UI renders the same as before.
  - Timeline seek, drag, playback, bookmarks, volume, and micro-zoom work.
  - Inspector tabs and toggle work.
  - Drawer works in setup, running, result, and explore modes.
  - ROI and preview inspection remain functional.
  - No layout shift is observed.
- **Validation**:
  - Manual smoke notes in implementation summary.

## Region Hook Map
| Existing Element | Additive Attribute |
| --- | --- |
| `.labx-top-bar` | `data-lab-region="topbar"` |
| `.labx-top-bar__center` | `data-lab-region="left-rail-source"` |
| `.labx-center-panel` | `data-lab-region="main-stage"` |
| `.labx-media-workbench` | `data-lab-region="main-stage-inner"` |
| `.labx-workspace-preview` | `data-lab-region="preview-area"` |
| `.labx-timeline` | `data-lab-region="timeline-area"` |
| `.labx-drawer` | `data-lab-region="context-panel"` |
| `.labx-workspace-inspector` | `data-lab-region="inspector-panel"` |
| `.labx-process-strip` | `data-lab-region="process-strip"` |

## Dual-Selector Map
| Old Selector | New Selector |
| --- | --- |
| `.labx-center-panel` | `[data-lab-region="main-stage"]` |
| `.labx-top-bar` | `[data-lab-region="topbar"]` |
| `.labx-drawer` | `[data-lab-region="context-panel"]` |
| `.labx-workspace-inspector` | `[data-lab-region="inspector-panel"]` |
| `.labx-process-strip` | `[data-lab-region="process-strip"]` |

## Testing Strategy
- Start with source-level assertions for additive hooks and dual selectors.
- Run typecheck after region and selector changes.
- Run UI evaluation regressions for shell, boot, and incremental sync coverage.
- Run source UI regressions for preview, timeline, inspector, source form, and ROI coverage.
- Use manual smoke only after automated tests pass.

## Potential Risks & Gotchas
- Adding `data-lab-region` to collapsed drawer markup is easy to miss because `renderLabDrawer()` returns an empty string when collapsed. Mitigation: add attributes to every actual drawer render path and keep collapse behavior unchanged.
- Querying by region first can accidentally find nested future regions if scopes are too broad. Mitigation: only use specific region names and keep old fallback.
- Debug outlines can accidentally affect perceived layout if implemented with borders. Mitigation: use `outline` only, never `border`.
- Debug outlines can conflict with no-visual-change validation if always enabled. Mitigation: gate them behind an explicit debug attribute and keep the gate disabled by default.
- Conditional nodes can make region hook checks look incomplete. Mitigation: verify hooks on all applicable render states instead of requiring absent collapsed/empty nodes.
- Timeline wrapper language in older planning can conflict with Patch 1. Mitigation: treat Patch 1 as the current contract: `.labx-timeline` is the timeline area.
- Tests that assert exact source regex may need additive updates. Mitigation: update only tests whose contract is intentionally expanded by region hooks.
- Import-only mode uses the center panel but not the full lab surface. Mitigation: keep `main-stage` on `.labx-center-panel` for both modes.

## Rollback Plan
- Remove added `data-lab-region` attributes.
- Revert `lab-root.ts` dual-selector helper and restore direct class queries.
- Remove the debug outline CSS block.
- Remove any added test assertions for region hooks.
- Re-run the same validation commands to confirm original behavior.

## Implementation Closeout Report
**Completed**: 2026-05-01

### Implemented Scope
- Added additive `data-lab-region` hooks to the existing top bar, left-rail source, main stage, main-stage inner workbench, preview area, timeline area, context panel, inspector panel, and process strip nodes.
- Kept all existing classes, IDs, data action hooks, data field hooks, data role hooks, preserved media hooks, and event delegation contracts intact.
- Added a local `LAB_REGION_SELECTORS` map and `queryLabRegion()` helper in `lab-root.ts`.
- Updated current incremental sync lookups to resolve region selectors first with legacy class fallbacks for main stage, topbar, context panel, and process strip.
- Added inspector-panel compatibility to the selector map; no current root-level inspector sync lookup existed to migrate.
- Locked the timeline strategy by placing `data-lab-region="timeline-area"` directly on the existing `.labx-timeline#lab-timeline` node.
- Added gated debug region outlines in `lab-theme.css`; default UI remains unchanged unless `.labx-shell[data-lab-debug-regions="true"]` is explicitly present.
- Expanded targeted regression tests to cover region hooks, region-first selector compatibility, debug outline gating, and the no-wrapper timeline contract.

### Files Changed
- `rooms/laboratory/ui/lab-center-panel.ts`
- `rooms/laboratory/ui/lab-top-bar.ts`
- `rooms/laboratory/ui/lab-drawer.ts`
- `rooms/laboratory/ui/lab-process-strip.ts`
- `rooms/laboratory/ui/workspace-surface.ts`
- `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- `rooms/laboratory/ui/lab-root.ts`
- `rooms/laboratory/ui/lab-theme.css`
- `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- `scripts/tests/laboratory-source-ui-regressions.test.ts`

### Validation Results
- `npm run rooms:typecheck` passed.
- `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts` passed: 37/37 tests.
- `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts` passed: 30/30 tests.
- Syntax checks passed for every edited source/test/CSS/plan file checked during implementation.

### Final Sub-Agent Review
- Reviewer: `Lagrange`
- Result: No findings.
- Summary: Implementation matches the plan and constraints; region hooks are additive, timeline remains the existing `.labx-timeline` node with no wrapper, selector fallbacks are preserved, and debug CSS is gated.

### Residual Risk
- Browser-level visual smoke was not run because no Electron app instance was active in this terminal workflow. Automated tests cover the DOM/source contracts, but a later manual UI smoke should still confirm no perceived layout shift.
