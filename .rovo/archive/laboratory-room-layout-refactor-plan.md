# Plan: Laboratory Room Layout Refactor

**Generated**: 2026-05-01
**Estimated Complexity**: Medium

## Overview
Refactor the Laboratory room UI into explicit layout regions while preserving current behavior. The work is structural only: keep existing renderers, selectors, actions, overlays, store events, and runtime logic intact, then wrap and move them into named containers.

The target component tree is:

```text
LaboratoryLayout
  TopBar
  LeftRail
  MainStage
    PreviewArea
    TimelineArea
  ContextPanel
  InspectorPanel
  ProcessStrip
  BootOverlay (inside shell)
  OverlayRoots (external modal roots)
```

`ProcessStrip` is retained even though it is not listed as a new requested container because it is existing functionality. It should not be confused with `TimelineArea`, which remains the waveform/media timeline directly below the preview.

`BootOverlay` must stay inside the shell because `syncBootOverlay()` updates it by querying `.labx-shell`. External modal overlay roots remain outside the shell.

## Research Summary
- Source of truth is `rooms/laboratory`, not `data/rooms/laboratory`.
- Current shell renderer is `rooms/laboratory/ui/lab-layout.ts`.
- Current shell grid is `.labx-shell` with top bar, center panel, right drawer, and process strip.
- Current main workbench is in `rooms/laboratory/ui/workspace-surface.ts`.
- Preview and waveform timeline are already adjacent inside `.labx-media-workbench`.
- Current inspector is rendered by `renderWorkspaceInspectorDrawer()` and is absolutely positioned over the workspace stage.
- Current right drawer is rendered by `renderLabDrawer()` and owns setup, running, result, and explore context.
- Existing tests assert the v2 shell grid and inspector-in-main contract, so tests must be updated alongside the structural move.
- Current CSS and tests target `.labx-media-workbench > .labx-timeline`; adding a separate timeline wrapper requires same-sprint selector/test migration.
- Current incremental render sync in `lab-root.ts` queries old shell regions such as `.labx-center-panel`, `.labx-drawer`, and `.labx-process-strip`.

## Safe Assumptions
- This is not a visual redesign; temporary borders/backgrounds are acceptable only to reveal regions.
- Container names can be implemented as string-renderer functions and semantic classes/data attributes, matching the existing non-React renderer style.
- Existing class names should be kept as compatibility hooks where practical, then augmented with new region classes.
- `renderLabLayout()` should remain the public layout entry point so `lab-root.ts` stays orchestration-focused.
- No installed/runtime copy under `data/rooms/laboratory` should be edited manually.
- Region containers should render predictably even when their content is empty, collapsed, or unavailable. For example, `TimelineArea` can render as an empty/hidden region when no duration is known, while the timeline internals remain absent.
- LeftRail may be narrow and icon-oriented, but labels, titles, accessibility text, and existing action hooks must remain intact to avoid turning this structural refactor into a UX rewrite.

## Prerequisites
- Work from `rooms/laboratory/ui` and `rooms/laboratory/models/lab-types.ts`.
- Preserve all current `data-lab-action`, `data-lab-field`, `data-lab-role`, and overlay roots.
- Keep boot overlay lifecycle inside `.labx-shell`.
- Preserve or intentionally migrate direct-child timeline CSS/test contracts in the same sprint that introduces `TimelineArea`.
- Run targeted Laboratory UI/source tests and room typecheck after implementation.

## DOM Contract Safety Rules
- Do not rename, remove, or move critical `data-lab-action`, `data-lab-field`, `data-lab-role`, or `data-lab-preserve-media` attributes without updating every consumer in the same sprint.
- Do not break selector reachability for controller event delegation, binders, visualizers, DOM sync, or tests.
- Do not change preserved media structure around `[data-lab-preserve-media="workspace-preview"]`; DOM sync depends on this key to avoid media reloads.
- Do not break preview, ROI, timeline, and inspector focus relationships: `.labx-workspace-preview`, `.labx-timeline`, and `[data-lab-workspace-inspector="true"]` are behavior surfaces, not decoration.
- Do not add a wrapper around `.labx-timeline` unless `.labx-media-workbench > .labx-timeline` CSS/test contracts are intentionally migrated in the same sprint.
- Do not move `BootOverlay` out of `.labx-shell`; `syncBootOverlay()` queries the shell.
- Do not let a layout region become unreachable from document-level delegated listeners.
- Every sprint after Sprint 0 must state how it respects the DOM Contract Audit constraints.

## Sprint 0: DOM Contract Audit
**Goal**: Identify, classify, and freeze the functional DOM contracts before any layout restructuring begins.

**Must respect DOM Contract Audit constraints**: This sprint creates those constraints and blocks Sprint 1 until complete.

**Demo/Validation**:
- A contract map exists in the plan and is verified against current source.
- Every contract has risk classification.
- A do-not-break list exists and is referenced by all later sprints.
- No implementation or layout restructuring occurs in this sprint.

### Task 0.1: Identify All DOM Contracts
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/workspace-roi-overlay.ts`, `rooms/laboratory/ui/lab-selection-roi-binder.ts`, `rooms/laboratory/ui/lab-preview-inspection-binder.ts`, `rooms/laboratory/ui/lab-preview-inspection-controller.ts`, `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`, `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Scan every `querySelector`, `querySelectorAll`, `closest`, `getElementById`, `data-lab-*`, timeline/preview ID, and media preservation hook before moving layout.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - All `data-lab-action`, `data-lab-field`, `data-lab-role`, and `data-lab-preserve-media` usages in the listed files are enumerated.
  - Critical IDs such as `app`, `lab-workspace-preview`, `lab-timeline`, `lab-audio-viz`, and overlay roots are enumerated.
  - Selector-based event delegation and DOM sync selectors are enumerated.
- **Validation**:
  - `rg -n "querySelector(All)?\\(|closest\\(|getElementById\\(|data-lab-|id=\\\"lab-" rooms/laboratory/runtime/lab-run-controller.ts rooms/laboratory/ui`

### Task 0.2: Build Contract Map
- **Location**: `.rovo/archive/laboratory-room-layout-refactor-plan.md`
- **Description**: Maintain the following structured contract map and update it if additional contracts are discovered during implementation.
- **Complexity**: 5
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - Each contract lists selector/attribute, usage, dependency, breakage mode, and risk.
  - HIGH contracts are treated as stable API for layout work.
- **Validation**:
  - Manual source readback of every mapped selector.

#### Contract Map
- `.labx-shell`
  - used in: `lab-root.ts`, `lab-theme.css`
  - purpose: shell dataset sync, boot overlay mount/query, top-level grid contract
  - breaks if changed: shell replacement fallback, boot overlay updates, layout tests
  - risk: HIGH
- `.labx-center-panel`
  - used in: `lab-root.ts`, `lab-center-panel.ts`, `lab-theme.css`
  - purpose: incremental main surface DOM sync and scroll preservation
  - breaks if changed: repeated full-shell replacement or stale main surface
  - risk: HIGH until `lab-root.ts` is migrated
- `.labx-top-bar`, `.labx-drawer`, `.labx-process-strip`
  - used in: `lab-root.ts`, renderers, CSS/tests
  - purpose: incremental sync targets for top bar, context drawer, process strip
  - breaks if changed: stale controls, stale drawer state, stale process strip
  - risk: HIGH until new region selectors replace them
- `.labx-overlay-root`, `#lab-asset-preview-overlay-root`, `#lab-report-overlay-root`, `#lab-project-workspace-root`
  - used in: `lab-root.ts`, `lab-layout.ts`
  - purpose: overlay root updates and modal/project workspace mounting
  - breaks if changed: overlays fail to open/update
  - risk: HIGH
- `#app`
  - used in: `lab-root.ts`
  - purpose: Laboratory runtime root
  - breaks if changed: room UI does not start
  - risk: HIGH
- `[data-lab-preserve-media="workspace-preview"]`
  - used in: `lab-root.ts`, `lab-run-controller.ts`, `lab-waveform-timeline-visualizer.ts`, `workspace-surface.ts`
  - purpose: preserve preview media across DOM sync and bind playback/waveform to preview
  - breaks if changed: media reloads, playback controls desync, visualizer cannot bind
  - risk: HIGH
- `.labx-preview-media`
  - used in: `lab-run-controller.ts`, `workspace-surface.ts`
  - purpose: fallback seek target for preview media
  - breaks if changed: timeline seeking may not update preview media
  - risk: HIGH
- `#lab-workspace-preview`, `.labx-workspace-preview`
  - used in: `lab-run-controller.ts`, `workspace-surface.ts`, CSS/tests
  - purpose: source-preview focus/scroll target and preview focus layer detection
  - breaks if changed: focus layer and source-preview jump behavior break
  - risk: HIGH
- `[data-lab-workspace-inspector="true"]`
  - used in: `lab-run-controller.ts`, `workspace-surface.ts`
  - purpose: inspector focus detection and control panel identity
  - breaks if changed: inspector focus state and tab/control handling degrade
  - risk: HIGH
- `[data-open]`, `[data-active-tab]`, `[data-inspector-panel]`
  - used in: `workspace-surface.ts`, tests/CSS
  - purpose: inspector collapsed/open state and tab panel identity
  - breaks if changed: inspector tabs render but state/tests drift
  - risk: MEDIUM
- `#lab-timeline`, `.labx-timeline`, `data-duration`, `data-timeline-locked`
  - used in: `lab-run-controller.ts`, `lab-waveform-timeline-render.ts`, CSS/tests
  - purpose: timeline root, duration source, mutation lock styling/state
  - breaks if changed: drag math, finetune bounds, lock behavior, focus layer
  - risk: HIGH
- `.labx-media-workbench > .labx-timeline`
  - used in: `lab-theme.css`, `laboratory-ui-evaluation-regressions.test.ts`
  - purpose: compact embedded timeline layout contract
  - breaks if changed: timeline spacing/track sizing and structural tests
  - risk: HIGH for wrapper changes
- `.labx-timeline__track`
  - used in: `lab-run-controller.ts`, `lab-theme.css`
  - purpose: timeline drag geometry and centering target
  - breaks if changed: timeline selection, seek, and drag interactions
  - risk: HIGH
- `data-lab-action="timeline-interact"`, `"timeline-drag-start"`, `"timeline-drag-end"`, `"timeline-drag-body"`
  - used in: `lab-run-controller.ts`, `lab-waveform-timeline-render.ts`
  - purpose: drag/seek start points for timeline selection
  - breaks if changed: timeline drag and range selection stop working
  - risk: HIGH
- `data-lab-action="timeline-toggle-playback"`, `"timeline-shift-playhead"`, `"timeline-finetune"`, `"timeline-clear"`, `"timeline-seek"`, `"timeline-add-bookmark"`, `"timeline-remove-bookmark"`, `"timeline-toggle-micro-zoom"`
  - used in: `lab-run-controller.ts`, `lab-waveform-timeline-render.ts`
  - purpose: delegated timeline transport, range tuning, bookmark, and zoom commands
  - breaks if changed: timeline controls no longer dispatch
  - risk: HIGH
- `data-lab-role="timeline-playhead"`, `"timeline-playhead-label"`, `"timeline-current-time-label"`, `"timeline-total-duration-label"`, `"timeline-play-toggle-label"`, `"timeline-volume"`, `"timeline-bookmark-note"`
  - used in: `lab-run-controller.ts`, `lab-waveform-timeline-render.ts`
  - purpose: imperative playback UI sync and controlled inputs
  - breaks if changed: playhead/time labels/volume/bookmark input stop syncing
  - risk: HIGH
- `#lab-audio-viz`, `#lab-audio-viz-inspection`, `data-waveform-crop-start`, `data-waveform-crop-end`
  - used in: `lab-waveform-timeline-visualizer.ts`, `lab-waveform-timeline-render.ts`
  - purpose: waveform canvas binding and crop-window rendering
  - breaks if changed: waveform/spectrum visualizer cannot render or crop correctly
  - risk: HIGH
- `[data-lab-selection-roi-stage="true"]`, `[data-lab-selection-roi-controls-reserve]`
  - used in: `lab-selection-roi-binder.ts`, `workspace-surface.ts`
  - purpose: ROI drag coordinate surface and reserved bottom controls zone
  - breaks if changed: ROI drawing coordinates or prevention zone break
  - risk: HIGH
- `[data-lab-selection-roi="true"]`, `[data-lab-selection-roi-ignore="true"]`, `#lab-roi-overlay`, `[data-lab-selection-roi-overlay="true"]`, `[data-roi-id]`
  - used in: `workspace-roi-overlay.ts`, `lab-selection-roi-binder.ts`, `lab-preview-inspection-binder.ts`
  - purpose: ROI overlay identity, ignored controls, double-click focus behavior
  - breaks if changed: ROI controls trigger drawing or focus behavior incorrectly
  - risk: HIGH
- `[data-lab-selection-roi-clear]`, `[data-lab-selection-inspection-mode]`, `[data-lab-selection-roi-focus-toggle]`, `[data-lab-selection-roi-focus-reset]`, `[data-lab-selection-roi-capture]`, `[data-lab-selection-roi-snapshot-clear]`, `[data-lab-selection-roi-frame-step]`
  - used in: `lab-selection-roi-binder.ts`, `lab-preview-inspection-binder.ts`, `workspace-roi-overlay.ts`, `lab-waveform-timeline-render.ts`
  - purpose: delegated ROI clear, inspection mode, focus, capture, snapshot, and frame stepping
  - breaks if changed: ROI/inspection controls become inert
  - risk: HIGH
- `[data-lab-preview-inspection-stage="true"]`, `[data-lab-preview-inspection-content="true"]`, `[data-lab-preview-inspection-topology]`
  - used in: `lab-preview-inspection-controller.ts`, `lab-preview-inspection-binder.ts`, `workspace-surface.ts`
  - purpose: preview inspection transform/crop target and topology reset key
  - breaks if changed: ROI focus transform and snapshot crop logic break
  - risk: HIGH
- Preview inspection DOM relationship: inspection stage contains inspection content, and content contains media with `data-lab-preserve-media`
  - used in: `lab-preview-inspection-controller.ts`
  - purpose: focus transform, media snapshot/crop, topology tracking
  - breaks if changed: controller cannot find content/media or resets incorrectly
  - risk: HIGH
- `[data-lab-selection-panel="true"]`, `[data-lab-selection-intent]`, `data-lab-role="selection-intent-picker"`
  - used in: `lab-preview-inspection-binder.ts`, `lab-waveform-timeline-render.ts`, selection binders/tests
  - purpose: selection panel keyboard arming, intent picking, side panel interaction
  - breaks if changed: selection panel intent and ROI interaction degrade
  - risk: MEDIUM/HIGH depending on moved region
- `data-lab-action="load-source"`, `"source-probe-retry"`, `"source-youtube-preset"`, `"workspace-toggle-source-intake"`
  - used in: `workspace-surface.ts`, `lab-run-controller.ts`
  - purpose: source loading/retry/preset/source intake controls
  - breaks if changed: source workflow controls stop dispatching
  - risk: HIGH
- `data-lab-field="source.kind"`, `"source.mode"`, `"source.urlInput"`, `"source.youtubeUrl"`, `"source.youtubeCaptureMode"`, `source.youtubeCustom.*`
  - used in: `workspace-surface.ts`, `lab-run-controller.ts`
  - purpose: source draft persistence and source config updates
  - breaks if changed: source form input no longer persists or dispatches
  - risk: HIGH
- `data-lab-field="workspace.previewVolume"`
  - used in: `lab-waveform-timeline-render.ts`, `lab-run-controller.ts`
  - purpose: transport volume input and preview media volume sync
  - breaks if changed: preview/timeline volume control stops working
  - risk: HIGH
- `data-lab-action="workspace-controls-drawer-toggle"`, `"workspace-controls-tab-select"`
  - used in: `workspace-surface.ts`, `lab-run-controller.ts`
  - purpose: inspector drawer open/close and tab selection
  - breaks if changed: inspector controls cannot be opened or switched
  - risk: HIGH
- `data-lab-action="workspace-roi-toggle"`, `"workspace-roi-remove"`, `"workspace-roi-export"`
  - used in: `workspace-roi-overlay.ts`, `lab-run-controller.ts`
  - purpose: legacy ROI region visibility/export/removal
  - breaks if changed: ROI region controls become inert
  - risk: MEDIUM/HIGH
- Generic `[data-lab-action]` delegation
  - used in: `lab-run-controller.ts`
  - purpose: central click command router for Laboratory UI
  - breaks if changed: any moved button without its action becomes inert
  - risk: HIGH
- `[data-lab-action="project-workspace-entity-click"]`, `[data-lab-asset-id]`, project workspace action values
  - used in: `lab-run-controller.ts`
  - purpose: project/entity selection and asset actions from overlays/panels
  - breaks if changed: project workspace selection/actions break
  - risk: MEDIUM for layout refactor, HIGH if moving project workspace roots
- `[data-lab-execution-details-open]`, `[data-lab-execution-details-close]`
  - used in: `lab-root.ts`, `lab-waveform-timeline-render.ts`
  - purpose: execution details overlay open/close
  - breaks if changed: execution details overlay cannot open/close
  - risk: MEDIUM/HIGH
- `[data-lab-collapsible-panel]`, `[data-lab-interpretation-panel]`, `[data-panel-id]`
  - used in: `lab-root.ts`, `lab-waveform-timeline-render.ts`
  - purpose: preserve `<details>` open state through DOM sync
  - breaks if changed: panels lose open/collapsed state on render
  - risk: MEDIUM
- `data-media-viewport-state`, `data-lab-workspace-stage`, `data-lab-media-workbench`, `data-preview-mode`
  - used in: `workspace-surface.ts`, CSS/tests
  - purpose: viewport state, workbench/stage identity, preview mode contract
  - breaks if changed: state styling/tests drift and region assertions fail
  - risk: MEDIUM

### Task 0.3: Classify Risk Levels
- **Location**: `.rovo/archive/laboratory-room-layout-refactor-plan.md`
- **Description**: Use the risk labels in the contract map as the pre-refactor safety gate.
- **Complexity**: 3
- **Dependencies**: Task 0.2
- **Acceptance Criteria**:
  - HIGH contracts are listed in the do-not-break list.
  - MEDIUM contracts have migration notes when moved.
  - LOW contracts are limited to visual/test-only hooks found during audit.
- **Validation**:
  - Manual review confirms every future sprint references these classifications.

#### Risk Classification Summary
- **HIGH**: root/shell sync selectors, overlay roots, media preservation, preview focus target, timeline root/actions/roles/track/canvas, ROI stage/inspection contracts, source action/field contracts, inspector identity/actions, generic `[data-lab-action]` delegation.
- **MEDIUM**: inspector display-state attributes, project workspace entity hooks when not directly moved, details/collapsible state preservation hooks, viewport/stage test hooks.
- **LOW**: temporary region visualization classes and purely additive `data-lab-region` hooks, provided they are not used by runtime code.

### Task 0.4: Define DO NOT BREAK Rules
- **Location**: `.rovo/archive/laboratory-room-layout-refactor-plan.md`
- **Description**: Freeze the stable DOM surface before layout changes.
- **Complexity**: 3
- **Dependencies**: Task 0.3
- **Acceptance Criteria**:
  - The do-not-break list is present and implementation tasks treat it as acceptance criteria.
- **Validation**:
  - Pre-Sprint-1 checklist confirms no HIGH contract is unaccounted for.

#### DO NOT BREAK List
- Keep `.labx-shell` as the shell root and keep `BootOverlay` inside it.
- Keep overlay root IDs stable: `lab-asset-preview-overlay-root`, `lab-report-overlay-root`, and `lab-project-workspace-root`.
- Keep `#lab-workspace-preview`, `.labx-workspace-preview`, `.labx-preview-media`, and `[data-lab-preserve-media="workspace-preview"]` stable.
- Preserve the preview inspection relationship: stage -> inspection content -> preserved media.
- Keep `.labx-timeline`, `#lab-timeline`, `.labx-timeline__track`, `data-duration`, and timeline roles stable unless every consumer is migrated in the same sprint.
- Keep `#lab-audio-viz` and `#lab-audio-viz-inspection` stable for waveform rendering.
- Keep all timeline `data-lab-action` values stable.
- Keep ROI/inspection attributes stable: `data-lab-selection-roi-stage`, `data-lab-selection-roi-controls-reserve`, `data-lab-selection-roi-ignore`, `data-lab-selection-roi-clear`, `data-lab-selection-inspection-mode`, `data-lab-selection-roi-focus-toggle`, `data-lab-selection-roi-focus-reset`, `data-lab-selection-roi-capture`, `data-lab-selection-roi-frame-step`, `data-lab-preview-inspection-stage`, `data-lab-preview-inspection-content`, and `data-lab-preview-inspection-topology`.
- Keep source form `data-lab-field` names stable.
- Keep inspector identity and control actions stable: `[data-lab-workspace-inspector="true"]`, `workspace-controls-drawer-toggle`, and `workspace-controls-tab-select`.
- Keep `[data-lab-action]` on every interactive element that currently routes through `lab-run-controller.ts`.
- Keep details preservation hooks stable: `data-lab-collapsible-panel`, `data-lab-interpretation-panel`, and `data-panel-id`.
- Do not insert layout wrappers that block `closest()` traversal from delegated listeners.
- Do not insert layout wrappers that change timeline direct-child CSS without migrating selectors/tests at the same time.

### Task 0.5: Annotate Refactor Plan
- **Location**: `.rovo/archive/laboratory-room-layout-refactor-plan.md`
- **Description**: Add DOM Contract Audit constraints to every future sprint and require explicit contract checks before implementation proceeds.
- **Complexity**: 2
- **Dependencies**: Tasks 0.1-0.4
- **Acceptance Criteria**:
  - Sprint 1 through Sprint 5 each state `Must respect DOM Contract Audit constraints`.
  - Future implementation tasks include source-readback or tests for the contracts they touch.
- **Validation**:
  - Plan readback confirms each sprint includes the constraint note.

## Sprint 1: Container Skeleton
**Goal**: Add explicit named layout containers without moving behavior yet.

**Must respect DOM Contract Audit constraints**: all new region hooks must be additive and must not rename existing runtime selectors.

**Demo/Validation**:
- Rendered Laboratory markup includes region hooks for the new containers.
- Existing UI still renders with current behavior.
- Targeted tests still pass or have minimal contract updates for new region names.

### Task 1.1: Add Layout Region Renderer Module
- **Location**: `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Create renderer helpers for `LaboratoryLayout`, `MainStage`, `PreviewArea`, `TimelineArea`, `ContextPanel`, `InspectorPanel`, and `LeftRail`. Each helper should accept already-rendered markup and wrap it with semantic classes/data attributes.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Module exports named render functions for all requested containers.
  - Output includes stable hooks such as `data-lab-region="preview-area"`.
  - No store, selector, action, or host runtime logic is introduced.
- **Validation**:
  - `npm run rooms:typecheck`
  - Focused source grep for exported container names.

### Task 1.2: Preserve Compatibility Classes
- **Location**: `rooms/laboratory/ui/laboratory-layout.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Keep existing classes such as `.labx-shell`, `.labx-drawer`, `.labx-workspace-preview`, `.labx-timeline`, and `.labx-workspace-inspector` where consumers/tests rely on them, while adding new region classes.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Existing event delegation selectors still match.
  - Existing CSS-dependent class names remain present in rendered markup.
  - New region classes are additive.
- **Validation**:
  - `rg "labx-drawer|labx-workspace-inspector|labx-timeline" rooms/laboratory/ui`
  - Existing targeted UI tests before deeper moves.

### Task 1.3: Add Temporary Region Visualization Styles
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add restrained temporary borders/background shades for each requested region. Keep them scoped to new region classes and avoid broader design cleanup.
- **Complexity**: 2
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Top bar, left rail, main stage, preview, timeline, context panel, and inspector panel are visually distinguishable.
  - Styles are explicitly temporary in naming or grouping.
- **Validation**:
  - CSS source check for each region class.
  - Manual rendered markup/CSS inspection.

## Sprint 2: Main Stage Restructure
**Goal**: Move preview and waveform timeline into explicit `MainStage`, `PreviewArea`, and `TimelineArea` containers.

**Must respect DOM Contract Audit constraints**: preview media preservation, preview inspection, ROI stage, timeline root, timeline roles, timeline actions, and direct-child timeline CSS must remain valid or migrate atomically.

**Demo/Validation**:
- Preview remains visually dominant.
- Timeline remains directly below preview.
- Timeline controls, bookmarks, selection overlay, ROI overlay, and preview media controls still work.

### Task 2.1: Extract PreviewArea Markup
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Wrap the existing preview markup and ROI/inspection viewport in `PreviewArea` using the new helper. Preserve `id="lab-workspace-preview"`, preview focus classes, and all ROI data attributes.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Preview area contains the existing media preview and ROI overlay.
  - Preview focus class behavior remains unchanged.
  - Native media controls remain suppressed where currently suppressed.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`
  - Assert rendered markup still contains preview media, ROI hooks, and focus classes.

### Task 2.2: Extract TimelineArea Markup
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Introduce `TimelineArea` without silently breaking `.labx-media-workbench > .labx-timeline`. Preferred first pass: add region hooks to the existing timeline root. If a wrapper is used, update CSS selectors and tests in the same task.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Timeline region renders immediately below preview.
  - Timeline internals render when `durationMs > 0`; empty/hidden region state is explicit when no duration is known.
  - Timeline action/data hooks remain unchanged.
  - Selection panel placement remains `"side"` until ContextPanel migration.
  - Direct-child CSS/test contracts are either preserved or intentionally migrated.
- **Validation**:
  - Timeline source/UI regression tests pass.
  - Markup shows `PreviewArea` before `TimelineArea`.
  - Source check covers `.labx-media-workbench > .labx-timeline` selector migration or preservation.

### Task 2.3: Replace Media Workbench Wrapper With MainStage Wrapper
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Keep `.labx-media-workbench` for compatibility, but introduce `MainStage` as the structural wrapper around preview and timeline.
- **Complexity**: 4
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Existing `.labx-media-workbench` contract survives or is intentionally updated in tests.
  - Main stage height/min-width/min-height constraints preserve non-overflow behavior.
  - Preview remains the primary row and timeline remains secondary.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts`

## Sprint 3: Side Region Split
**Goal**: Split the right side into `ContextPanel` and `InspectorPanel`, and add the fixed narrow `LeftRail`.

**Must respect DOM Contract Audit constraints**: moved context/inspector/rail controls must remain reachable through document-level delegated listeners and keep existing `data-lab-action` values.

**Demo/Validation**:
- The right side visibly has two separate columns.
- Existing drawer modes still work.
- Inspector tabs and controls still work.
- Left rail appears as a narrow icon/action column.

### Task 3.1: Extend Surface Contract for Inspector Markup
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Add an optional `inspector` field to `LabWorkspaceSurface`. Return inspector markup separately from `renderWorkspaceSurface()` while preserving `main` and `side`.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `surface.main` contains main stage only.
  - `surface.inspector` contains the existing workspace inspector markup.
  - Existing callers that only read `main`/`side` still compile.
- **Validation**:
  - `npm run rooms:typecheck`
  - Update tests that currently expect inspector markup in `surface.main`.

### Task 3.2: Move Workspace Inspector Into InspectorPanel
- **Location**: `rooms/laboratory/ui/lab-layout.ts`, `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-root.ts`
- **Description**: Render `surface.inspector` through `InspectorPanel` from the shell-level layout instead of absolutely positioning it inside `.labx-workspace-stage`.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `data-lab-workspace-inspector="true"` still exists.
  - `workspace-controls-drawer-toggle` and `workspace-controls-tab-select` still work.
  - Focus layer class mapping still applies to inspector.
  - Collapsed inspector still hides body content.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`
  - Update layout tests for shell-level inspector.

### Task 3.3: Wrap Existing Drawer as ContextPanel
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/lab-layout.ts`
- **Description**: Keep `renderLabDrawer()` behavior but wrap or rename it into `ContextPanel` markup. Preserve `.labx-drawer` as a compatibility class during this refactor.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Setup, running, result, and explore drawer modes render unchanged.
  - `surface.side` selection panel continues to appear in setup context when available.
  - Drawer collapse behavior still removes/hides the context panel consistently.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts`

### Task 3.4: Add LeftRail
- **Location**: `rooms/laboratory/ui/lab-top-bar.ts`, `rooms/laboratory/ui/lab-layout.ts`, `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Move the existing source/analyze/results mode controls out of the top bar center into `LeftRail` using the same `data-lab-action` values. Keep accessible labels/titles and avoid new behavior or copy changes.
- **Complexity**: 5
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Left rail is fixed/narrow/icon-oriented.
  - Existing topbar pill actions still dispatch from the rail.
  - Top bar remains full width and keeps project/tool/drawer controls.
  - No duplicate competing controls remain unless intentionally kept for a transitional sprint.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - Markup assertions for `topbar-pill-source`, `topbar-pill-analyze`, and `topbar-pill-results`.

### Task 3.5: Update Incremental DOM Sync Targets
- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Update the mounted render path to query and update the new left rail, context panel, and inspector panel regions. Keep full layout replacement only as a recovery path when a region is missing.
- **Complexity**: 5
- **Dependencies**: Tasks 3.2-3.4
- **Acceptance Criteria**:
  - Subsequent renders update `TopBar`, `LeftRail`, `MainStage`, `ContextPanel`, `InspectorPanel`, and `ProcessStrip` without unnecessarily replacing the whole shell.
  - Scroll preservation remains enabled for scrollable context/inspector regions.
  - Collapsed context panel and import-only layout do not trigger render loops.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - Manual source readback of `lab-root.ts` selectors.

## Sprint 4: Shell Grid Contract
**Goal**: Update the shell grid to match the target multi-region structure and remove inspector overlay positioning.

**Must respect DOM Contract Audit constraints**: shell, boot overlay, overlay roots, incremental sync selectors, and direct-child timeline contracts must be preserved or migrated in the same sprint.

**Demo/Validation**:
- Top bar spans full width.
- Left rail is narrow and fixed.
- Main stage occupies the central primary region.
- Context panel and inspector panel are separate right-side columns.
- Timeline remains below preview.

### Task 4.1: Update LaboratoryLayout Shell Grid
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Replace the old two-column shell grid with a multi-region grid. Suggested areas: `topbar topbar topbar topbar`, `rail main context inspector`, and a retained process/status row. Keep `BootOverlay` as shell content, not as an external overlay root.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - `.labx-shell` defines columns for rail, main, context, and inspector.
  - Top bar spans all columns.
  - Drawer collapsed state handles context panel width/removal without hiding inspector.
  - Import-only layout remains single-region and does not render lab-only side regions.
  - Boot overlay still mounts inside `.labx-shell` and `syncBootOverlay()` still works.
- **Validation**:
  - Update `laboratory theme defines the v2 shell grid` regression to the new contract.
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 4.2: Convert Inspector From Overlay to Grid Region
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Remove or override absolute positioning for `.labx-workspace-inspector` in the new `InspectorPanel`; make it fill the far-right grid cell.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Inspector no longer overlaps the preview.
  - Open/closed state remains functional.
  - Existing inspector panel internals keep scroll behavior.
- **Validation**:
  - CSS assertions update from `position: absolute` to panel-region positioning.
  - Source UI tests for inspector open/closed and active tab pass.

### Task 4.3: Keep Main Stage Dominance
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Set grid ratios and min constraints so the main stage remains the largest area. Keep this structural, not decorative.
- **Complexity**: 3
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Main stage has the largest flexible column.
  - Timeline row is secondary height.
  - Right panels have clear separation but do not crowd preview below usable size.
- **Validation**:
  - Manual responsive inspection.
  - CSS source check for grid/minmax constraints.

### Task 4.4: Preserve Narrow View Behavior
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add a structural responsive fallback for narrower widths so right-side panels stack or collapse predictably without overlapping preview/timeline.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Preview and timeline remain readable on constrained widths.
  - Context and inspector panels do not overlap each other or the main stage.
  - Temporary visualization styles remain visible but do not force overflow.
- **Validation**:
  - CSS media-query source check.
  - Manual desktop/narrow viewport smoke check.

## Sprint 5: Tests and Contract Updates
**Goal**: Update regression tests to assert the new structure and protect old functionality.

**Must respect DOM Contract Audit constraints**: tests must verify HIGH contracts still exist and are reachable after layout restructuring.

**Demo/Validation**:
- Targeted Laboratory tests pass.
- Updated tests describe the new layout containers.
- No source/runtime logic tests need behavioral changes.

### Task 5.1: Update UI Evaluation Layout Contracts
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Replace v2 shell grid assertions with multi-region layout assertions. Update inspector placement expectations from `surface.main` to shell-level `InspectorPanel` where relevant.
- **Complexity**: 5
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Tests assert all requested region names/classes.
  - Tests assert preview before timeline.
  - Tests assert context and inspector are separate right-side regions.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 5.2: Update Source UI Surface Tests
- **Location**: `scripts/tests/laboratory-source-ui-regressions.test.ts`
- **Description**: Update tests that currently expect inspector markup inside `surface.main`. Assert `surface.inspector` or full layout markup instead.
- **Complexity**: 4
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Preview/timeline assertions remain on `surface.main`.
  - Inspector tab/control assertions move to `surface.inspector` or rendered layout.
  - `surface.side` selection panel behavior remains covered.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts`

### Task 5.3: Update Wireframe and Layout Contract Tests
- **Location**: `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`, `scripts/tests/room-layout-contract-regressions.test.ts`
- **Description**: Update naming from v2 wireframe/layout contract where necessary, while preserving tests for locks, drawer modes, process strip, and source retry behavior.
- **Complexity**: 3
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Tests do not encode obsolete grid assumptions.
  - Behavioral assertions remain unchanged.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts scripts/tests/room-layout-contract-regressions.test.ts`

### Task 5.4: Final Validation Pack
- **Location**: `rooms/laboratory`, `scripts/tests`
- **Description**: Run the Laboratory validation shortlist for UI/source scope.
- **Complexity**: 4
- **Dependencies**: Tasks 5.1-5.3
- **Acceptance Criteria**:
  - Typecheck passes.
  - UI/source regressions pass.
  - No generated installed copy is manually edited.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`

## Updated Component Tree
```text
renderLabLayout()
  renderLaboratoryLayout()
    renderLabTopBar()
    renderLeftRail()
      existing mode controls:
        topbar-pill-source
        topbar-pill-analyze
        topbar-pill-results
    renderMainStage()
      renderPreviewArea()
        existing preview media
        ROI overlay
        preview inspection viewport
        viewport empty/loading/error states
      renderTimelineArea()
        renderLabWaveformTimeline()
    renderContextPanel()
      renderLabDrawer()
        setup/running/result/explore context
        surface.side selection panel when present
    renderInspectorPanel()
      existing workspace inspector
        audio focus controls
        visual controls
        operation controls
    renderLabProcessStrip()
    renderLabBootOverlay() inside shell when active
    external overlay roots
      tool management
      asset preview
      report
      project workspace
```

## List of Moved Components
- Existing top bar mode controls move to `LeftRail` with the same `data-lab-action` values.
- Existing preview media viewport and ROI overlay move into `PreviewArea`.
- Existing waveform timeline moves into `TimelineArea`.
- Existing `.labx-media-workbench` content becomes `MainStage`, keeping compatibility hooks.
- Existing `renderLabDrawer()` becomes the content of `ContextPanel`.
- Existing workspace inspector moves from an absolute overlay inside workspace stage to `InspectorPanel`.
- Existing `surface.side` selection panel remains context-side content and should not be moved into the main preview/timeline area.
- Existing `renderLabProcessStrip()` remains functional as a retained process/status region.
- Existing boot overlay stays inside `.labx-shell`; it is not moved into the external overlay root set.

## Known Broken Dependencies Before Implementation
No already-broken dependency was found during research. Expected contract churn during implementation:

- `scripts/tests/laboratory-ui-evaluation-regressions.test.ts` currently asserts the v2 shell grid and inspector overlay placement.
- `scripts/tests/laboratory-source-ui-regressions.test.ts` currently asserts inspector markup inside `surface.main`.
- `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts` may need naming/contract updates but should retain behavioral assertions.
- CSS rules currently position `.labx-workspace-inspector` absolutely inside the stage.
- `LabWorkspaceSurface` currently has only `main` and `side`; a separate inspector region needs an optional field or a wrapper-level rendering path.
- `lab-root.ts` incremental sync currently queries old region selectors and must be updated to avoid repeated full-shell replacement.
- Timeline CSS/tests currently depend on `.labx-media-workbench > .labx-timeline`; a timeline wrapper requires explicit selector migration.
- Boot overlay lifecycle currently depends on being inside `.labx-shell`; moving it to external overlay roots would break readiness/update behavior.

## Testing Strategy
- Keep behavior tests focused on existing interactions: source retry, run/cancel, drawer modes, timeline selection, inspector tab controls, ROI locks, and process strip.
- Keep structural tests focused on region existence/order, not detailed visual polish.
- Use typecheck to catch contract drift after adding `surface.inspector`.
- Do not update installed `data/rooms/laboratory` manually; rely on build/sync lifecycle when an implementation PR requires it.

## Potential Risks & Gotchas
- Moving inspector out of `surface.main` can break tests and any code that assumes inspector markup is inside the stage. Mitigation: add `surface.inspector` as optional and update callers/tests in the same sprint.
- Removing top bar mode controls without replacing their `data-lab-action` hooks would break mode navigation. Mitigation: move the same actions into LeftRail before deleting topbar-center markup.
- Wrapping timeline with an extra element can break direct-child styling. Mitigation: prefer making the existing `.labx-timeline` element the `TimelineArea` region, or migrate selectors/tests in the same task.
- Moving boot overlay out of the shell can break boot readiness. Mitigation: keep it inside `.labx-shell` and cover it in UI evaluation tests.
- Drawer collapse currently changes shell columns. Mitigation: preserve drawer collapse semantics for `ContextPanel` and keep `InspectorPanel` independent.
- Import-only mode currently renders only the center panel. Mitigation: keep import-only layout separate and avoid rendering LeftRail/ContextPanel/InspectorPanel there unless explicitly required later.
- CSS region changes can cause preview/timeline overflow. Mitigation: preserve existing `min-height: 0`, `min-width: 0`, and scroll constraints on every new grid/flex boundary.
- Temporary borders/backgrounds can become accidental design polish. Mitigation: group them under a clearly named temporary region visualization block.

## Rollback Plan
- Remove `rooms/laboratory/ui/laboratory-layout.ts` if introduced.
- Revert `LabWorkspaceSurface` back to `main` and `side` only.
- Move inspector markup back inside `renderWorkspaceSurface()` main output.
- Restore `.labx-shell` v2 grid rules and old inspector absolute positioning.
- Restore topbar center mode controls if they were moved to LeftRail.
- Re-run the original Laboratory UI/source regression tests to verify rollback.
