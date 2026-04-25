# Plan: Laboratory Micro Analysis Tools Layer

**Generated**: 2026-04-25  
**Estimated Complexity**: High

## Overview
Phase 3.6 extends Laboratory's passive ROI inspection into a deeper preview-only inspection layer. The work stays strictly outside `lab-run-controller.ts`, analysis execution, asset generation, and persistence. The safe implementation path is to add a new preview-inspection seam beside the existing ROI binder/store pipeline:

- keep `activeSelection` as the single semantic source of truth for time + ROI
- keep `inspectionMode` UI-scoped and non-persistent
- add only volatile inspection UI state for focus/zoom and temporary snapshot display
- manipulate preview media elements through a new preview inspection controller/binder owned by `lab-root.ts`
- keep suggestions and interpretations selector-derived
- treat audio micro zoom as an inspection lens, not a mutation of the master timeline contract

Because `run-controller` remains off-limits, frame stepping and preview zoom must not rely on existing timeline drag/seek handlers. They need their own passive DOM/media controller that reads store state but does not mutate timeline or selection.

## Assumptions
- ROI focus is supported for `image` and `video` previews; dual preview fences focus/step/capture to the video pane only.
- ROI snapshot is ephemeral UI memory, not a `LabAsset`, not persisted, and not exported.
- ROI snapshot storage must be latest-only and avoid large store-backed data URLs; prefer controller-owned object URL buffering with only lightweight UI projection state.
- Frame stepping will pause preview media and move only the preview element's `currentTime`; the master timeline/playhead will intentionally stay unchanged in this phase.
- Audio micro zoom will be implemented as a derived inspection view/lens on top of the waveform renderer, not by replacing the primary master-axis interaction model.
- Inspection keybindings must activate only while the preview inspection surface owns focus; global document listeners must not hijack form inputs or timeline interactions.

## Prerequisites
- Existing ROI selection layer from Phase 3.5 is stable:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-selection-roi-binder.ts`
  - `rooms/laboratory/ui/workspace-roi-overlay.ts`
- Existing preview media ownership is stable in:
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/ui/lab-root.ts`
- Existing waveform/audio preview stack is stable in:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
  - `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- Existing derived suggestion and interpretation seams remain the only source for passive guidance:
  - `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`
  - `rooms/laboratory/runtime/lab-interpretation-engine.ts`

## Sprint 1: Volatile Inspection State and Contracts
**Goal**: Introduce the minimum non-persistent UI state and model extensions needed for focus, frame stepping, ROI snapshot preview, and tool hints without changing `activeSelection` ownership.

**Demo/Validation**:
- State can represent focused ROI mode, temporary ROI snapshot, and inspection toolbar affordances without touching persisted workspace payloads.
- Hydrate/source/project reset paths leave the new inspection state empty.

### Task 1.1: Add Volatile Inspection UI State
- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/ui/lab-root.ts`
- **Description**:
  - Add top-level UI-scoped fields such as:
    - `roiFocusActive: boolean`
    - `activeInspectionSnapshot: { objectUrl: string; width: number; height: number; sourceTimeMs?: number | null } | null`
  - Add a minimal event set for focus/snapshot lifecycle, for example:
    - `selection-roi-focus-toggled`
    - `selection-roi-focus-cleared`
    - `selection-roi-snapshot-set`
    - `selection-roi-snapshot-cleared`
  - Keep all of them outside persisted `workspace`.
  - Constrain snapshot ownership to latest-only semantics; revoking/replacing the previous object URL is part of the contract.
- **Complexity**: 5/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - New fields exist only in UI-scoped state.
  - `readPersistableState()` does not round-trip the new inspection fields.
  - Hydrate/source/project reset paths clear focus and snapshot state.
- **Validation**:
  - Add persistence fence tests.
  - Add source/project/hydrate reset tests.

### Task 1.2: Extend Suggestion Model for Tool Hints
- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`
- **Description**:
  - Extend `LabActionSuggestion` with `toolHint?: string`.
  - Define deterministic ROI-aware hint text for passive tools such as:
    - `Focus region`
    - `Inspect motion`
    - `Enhance clarity`
    - `Stabilize segment`
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - ROI-aware suggestions can carry lightweight hint copy without introducing new action types unless necessary.
  - No execution semantics change.
- **Validation**:
  - Add selector tests that verify `toolHint` presence only in ROI-aware contexts.

### Task 1.3: Define a Dedicated Preview Inspection Owner Seam
- **Location**:
  - New `rooms/laboratory/ui/lab-preview-inspection-binder.ts`
  - New `rooms/laboratory/ui/lab-preview-inspection-controller.ts`
  - `rooms/laboratory/ui/lab-root.ts`
- **Description**:
  - Create a controller/binder pair owned by `lab-root.ts` for:
    - ROI focus activation/deactivation
    - frame stepping
    - ROI snapshot capture
  - It must query preview media elements from the DOM and emit only passive UI events or direct preview-side DOM changes.
  - Explicitly coordinate with:
    - `lab-waveform-timeline-visualizer.ts` for live preview redraw expectations
    - existing dual-preview owner semantics in `workspace-surface.ts`
  - Add an activation/precedence contract for keyboard ownership (`Escape`, left/right arrows) so inspection shortcuts only fire while the inspection surface owns focus.
- **Complexity**: 7/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - New inspection interactions have a home outside `lab-run-controller.ts`.
  - The controller can read current preview context and current semantic ROI.
  - Preview-local pause/seek/frame-step behavior does not require new `lab-run-controller.ts` cases and does not leave live visualizer state ambiguous.
- **Validation**:
  - Add targeted binder/controller unit tests with fake DOM/media stubs.
  - Add keybinding precedence tests against existing document-level binders.

## Sprint 2: ROI Focus Mode and Visual Inspection Surface
**Goal**: Turn ROI into an interactive focusable inspection surface with reversible zoom and stronger preview emphasis.

**Demo/Validation**:
- Double-clicking a valid ROI focuses the selected region.
- Escape or reset exits focus mode.
- Scrim/focus styling clearly communicates the active inspect area.

### Task 2.1: Add ROI Focus Controls to the UI
- **Location**:
  - `rooms/laboratory/ui/workspace-roi-overlay.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  - Add a passive `Focus region` affordance when a valid ROI exists.
  - Add a reset/exit affordance while focus is active.
  - Surface the active focus state in the selection panel and/or preview overlay.
  - Introduce an explicit ROI double-click target with a precedence rule:
    - double-clicking the existing ROI rectangle focuses it
    - ROI authoring binder must ignore this focused ROI target so a double-click does not redraw the region first
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Focus controls appear only when ROI exists and is valid.
  - UI does not add execution-style buttons.
- **Validation**:
  - Render tests for focus CTA visibility and reset affordance.
  - Binder tests for ROI double-click precedence over ROI redraw.

### Task 2.2: Implement ROI Zoom Rendering
- **Location**:
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/ui/workspace-roi-overlay.ts`
  - `rooms/laboratory/ui/lab-theme.css`
  - New `rooms/laboratory/ui/lab-preview-inspection-controller.ts`
- **Description**:
  - Apply focus zoom to the preview stage via CSS transform and transform-origin derived from `activeSelection.roi`.
  - Hide non-ROI area visually while preserving preview ownership.
  - Maintain aspect ratio; do not mutate selection data.
  - Fence dual-preview support to the video pane only.
  - Define focus-state topology rules:
    - single video/image can focus
    - dual preview focuses video pane only
    - topology changes immediately clear stale focus state
- **Complexity**: 7/10
- **Dependencies**: Task 2.1, Task 1.3
- **Acceptance Criteria**:
  - Focused ROI visually expands to fill the preview stage.
  - Image and single-video preview support zoom.
  - Dual preview supports zoom only on the video pane.
  - Invalid/small ROI is ignored.
- **Validation**:
  - UI render tests for focus-active class/data attributes.
  - Controller tests for dual-preview fencing and Esc exit.
  - Topology transition tests for single video ↔ dual preview ↔ image.

### Task 2.3: Tighten ROI Scrim and Hit Testing
- **Location**:
  - `rooms/laboratory/ui/workspace-roi-overlay.ts`
  - `rooms/laboratory/ui/lab-theme.css`
  - `rooms/laboratory/ui/lab-selection-roi-binder.ts`
- **Description**:
  - Keep outside-region dimming active in both normal and focused modes.
  - Ensure the scrim does not swallow control clicks or break ROI clear / inspection mode pills.
  - Optionally add safe resize-handle placeholders if they can be rendered without introducing resize behavior yet.
- **Complexity**: 5/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Scrim remains visual emphasis, not an interaction trap.
  - Existing ROI draw/clear controls still work.
- **Validation**:
  - Hit-testing regression tests.
  - Overlay markup assertions for focus mask and active focus state.

## Sprint 3: Frame-Level Inspection and Preview Snapshot
**Goal**: Add deeper video/image inspection actions without mutating timeline or assets.

**Demo/Validation**:
- Frame step buttons and keyboard shortcuts move preview media frame-by-frame while paused.
- Capture region produces a temporary ROI crop preview.

### Task 3.1: Add Passive Frame Step Controls
- **Location**:
  - `rooms/laboratory/ui/workspace-roi-overlay.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  - Add `Step back` / `Step forward` affordances in the ROI inspection surface for video previews.
  - Show them only where frame stepping is supported.
  - Add a small local hint/readout explaining this is preview inspection, not timeline edit.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Controls render only for video preview contexts.
  - No timeline buttons or run actions are reused.
- **Validation**:
  - UI rendering tests for single-video and dual-preview fencing.

### Task 3.2: Implement Frame Step Preview Controller
- **Location**:
  - New `rooms/laboratory/ui/lab-preview-inspection-controller.ts`
  - New `rooms/laboratory/ui/lab-preview-inspection-binder.ts`
  - `rooms/laboratory/ui/lab-root.ts`
- **Description**:
  - Pause the preview media on first step.
  - Move `currentTime` by `frameDuration`.
  - Use best-effort frame duration lookup:
    - future-ready metadata field if present
    - fallback to `1 / 30`
  - Support arrow key stepping while the preview inspection surface is active.
  - Coordinate preview-local stepping with the existing live waveform/visualizer seam so preview redraw stays in sync even though the master timeline/playhead remains unchanged.
- **Complexity**: 8/10
- **Dependencies**: Task 3.1, Task 1.3
- **Acceptance Criteria**:
  - Stepping does not dispatch timeline updates.
  - ROI remains anchored.
  - Playback pause/resume and stepping keep ROI intact.
- **Validation**:
  - Controller unit tests for:
    - pause on first step
    - forward/backward stepping
    - no selection mutation
    - no timeline mutation
    - visualizer redraw stability after preview-local stepping

### Task 3.3: Add Preview-Only ROI Snapshot Capture
- **Location**:
  - New `rooms/laboratory/ui/lab-preview-inspection-controller.ts`
  - `rooms/laboratory/ui/workspace-roi-overlay.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  - Add `Capture region` affordance for valid ROI on image/video preview.
  - Use an offscreen canvas to crop from the current frame/image using ROI ratios.
  - Store the result in volatile UI memory only; show it as a temporary preview card or inline panel.
  - Use latest-only object URL ownership (or equivalent controller-local buffering), revoking the previous snapshot when a new one is created or cleared.
- **Complexity**: 7/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Snapshot is visible in the UI but not added to `assets`.
  - No export/download wiring is introduced.
  - Source/project/hydrate resets clear the snapshot.
  - Preview topology changes also clear or rebuild snapshot ownership safely.
- **Validation**:
  - Canvas crop correctness tests with deterministic pixel fixtures or mock draw calls.
  - Persistence fence tests.

## Sprint 4: Audio Micro Zoom and ROI-Aware Tool Hints
**Goal**: Deepen inspection by making waveform detail responsive to the current selection and by turning ROI-aware guidance into a richer passive tool surface.

**Demo/Validation**:
- A valid time selection reveals a more detailed waveform inspection view.
- ROI-aware tool hints render and remain passive.

### Task 4.1: Add Derived Audio Micro Zoom Window
- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
- **Description**:
  - Introduce a dedicated derived inspection-lens namespace based on the current valid selection.
  - Do not reuse `waveformCrop*` or `waveformWindow*` fields that already describe the master-axis/shared timeline contract.
  - Preserve the master timeline axis and selection semantics.
  - Render a denser waveform inspection view or inset that visually zooms into the selection range.
- **Complexity**: 8/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No timeline or selection state is mutated.
  - Selection-based waveform detail becomes more granular.
  - Existing unified timeline interaction remains intact.
  - Master waveform axis fields remain untouched; inspection lens data is clearly separate in the view model.
- **Validation**:
  - Selector tests for dedicated inspection-lens values.
  - Visualizer/render tests for zoom crop accuracy.

### Task 4.2: Extend ROI-Aware Tool Hint Surface
- **Location**:
  - `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  - Evolve ROI-related suggestions into a clearly labeled passive tool-hint area.
  - Render hint icon/buttons for:
    - Focus region
    - Inspect motion
    - Enhance clarity
    - Stabilize segment
  - Clicking still routes only to preview explanation / dry-run affordance.
- **Complexity**: 5/10
- **Dependencies**: Task 1.2, Sprint 2
- **Acceptance Criteria**:
  - Hints appear only in ROI-aware contexts.
  - No execution event or analysis trigger is added.
- **Validation**:
  - Suggestion/render tests verifying tool-hint presence and passive behavior.

### Task 4.3: Thread Temporary ROI Snapshot into the Passive Preview Surface
- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-theme.css`
  - `rooms/laboratory/runtime/lab-selectors.ts` or a lightweight UI projection helper
- **Description**:
  - Optionally surface the most recent ROI snapshot inside the selection preview/inspection block.
  - Keep it clearly labeled as temporary inspect output, not a saved asset.
- **Complexity**: 4/10
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Snapshot presentation is ephemeral and dismissible.
  - No asset or export vocabulary is used.
- **Validation**:
  - Render tests for temporary snapshot visibility and clear behavior.

## Sprint 5: Spatial Interpretation Extension and Final Integration
**Goal**: Expand interpretation to reflect deeper spatial inspection and harden lifecycle/UX behavior across all preview-only tools.

**Demo/Validation**:
- Interpretation reacts to ROI area/aspect ratio and playback ambiguity.
- All micro-inspection features survive pause/resume and frame stepping, but reset on source/project/timeline changes as required.

### Task 5.1: Extend Interpretation Rules with Spatial Geometry
- **Location**:
  - `rooms/laboratory/runtime/lab-interpretation-engine.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  - Add deterministic rules for:
    - ROI area < 5% → very limited context
    - ROI area > 60% → consider narrowing focus
    - extreme ROI aspect ratio → framing distortion hint
    - ROI + high playbackRate → motion ambiguity risk
  - Keep messages recommendation-style, not command-style.
- **Complexity**: 5/10
- **Dependencies**: Sprint 2, Sprint 3
- **Acceptance Criteria**:
  - Interpretation remains deterministic and derived-only.
  - No async, no AI calls, no store persistence.
- **Validation**:
  - Rule coverage tests for area thresholds, aspect ratio, and playback interaction.

### Task 5.2: Lock Down Lifecycle Semantics
- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/ui/lab-preview-inspection-controller.ts`
  - `rooms/laboratory/ui/lab-root.ts`
- **Description**:
  - Enforce:
    - ROI resets on timeline/source/project change
    - focus/snapshot reset when ROI disappears or becomes invalid
    - ROI persists across frame stepping, zooming, and pause/resume
  - Ensure dual preview fences remain respected.
  - Cover preview-topology churn:
    - single video ↔ dual preview
    - video ↔ image
    - media owner replacement inside the same stage shell
- **Complexity**: 6/10
- **Dependencies**: Sprint 3, Sprint 4
- **Acceptance Criteria**:
  - Lifecycle rules exactly match the phase contract.
  - No stale focus/snapshot survives source churn.
- **Validation**:
  - Targeted store/controller tests for reset and persistence rules.

### Task 5.3: Final UX Polish and Accessibility Sweep
- **Location**:
  - `rooms/laboratory/ui/workspace-roi-overlay.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  - Normalize wording so all controls read like inspection aids, not execution tools.
  - Ensure keyboard affordances:
    - `Escape` exits focus
    - arrow keys step frames only in valid contexts
  - Ensure preview focus indicators and buttons remain visually consistent with the lab aesthetic.
- **Complexity**: 4/10
- **Dependencies**: All previous sprints
- **Acceptance Criteria**:
  - Micro-analysis tools feel cohesive and non-destructive.
  - No UI wording suggests export, save, or run.
- **Validation**:
  - UI markup assertions.
  - Manual smoke checklist.

## Testing Strategy
- Extend `scripts/tests/laboratory-runtime-truth-regressions.test.ts` for:
  - non-persistent volatile inspection state
  - ROI focus activation/deactivation
  - frame stepping pause-and-step behavior
  - ROI snapshot crop correctness
  - waveform zoom derivation and render window correctness
  - ROI-aware tool hint differences
  - spatial interpretation rules
  - dual preview focus/step fencing
  - lifecycle reset/persist rules
  - keybinding precedence against existing document-level binders
  - preview-topology transitions while focus/snapshot is active
- Extend relevant UI suites:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-stage-decoupling-regressions.test.ts`
- Run the normal Laboratory verification chain:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - `installFromWorkspace('laboratory')`
  - targeted Laboratory regression pack

## Potential Risks & Gotchas
- **Run-controller constraint vs frame stepping**:
  - Existing master transport and playhead live in `lab-run-controller.ts`.
  - Phase 3.6 must not mutate them.
  - Mitigation: frame stepping is preview-local only, with explicit UI wording and local readout if needed.

- **Audio micro zoom vs master-axis timeline**:
  - Replacing the primary waveform rail would conflict with current interactive timeline logic.
  - Mitigation: implement micro zoom as a derived inspection lens/inset, not as a new master axis.

- **Ephemeral ROI snapshot memory growth**:
  - Data URLs can become large.
  - Mitigation: keep only the latest snapshot, clear on lifecycle resets, and avoid persistence entirely.

- **Dual preview ambiguity**:
  - Audio/video split preview can create confusing ownership for focus and stepping.
  - Mitigation: fence ROI focus and frame stepping to the video pane/master preview only.

- **Double-click ROI can conflict with ROI authoring**:
  - Existing ROI binder currently begins authoring on `mousedown` anywhere on the stage.
  - Mitigation: add an explicit focused-ROI target/ignore contract and regression tests so double-click focus wins over redraw.

- **ROI focus on tiny regions**:
  - Tiny ROI values can create extreme transforms or meaningless captures.
  - Mitigation: reuse the existing minimum ROI guard and explicitly ignore focus/capture on invalid/small regions.

- **Keyboard shortcuts leaking globally**:
  - Left/right/Escape should not hijack unrelated inputs.
  - Mitigation: bind only when the preview inspection surface is active and ignore form fields.

- **Store-backed snapshot churn**:
  - Large `data:` URLs would interact poorly with the current full-root diff/render cycle in `lab-root.ts`.
  - Mitigation: keep snapshot ownership latest-only and prefer object URLs or controller-local buffering over large persisted-like strings.

## Rollback Plan
- Remove the new preview inspection binder/controller and detach them from `lab-root.ts`.
- Remove volatile ROI focus / snapshot UI state and events from `lab-types.ts` and `lab-store.ts`.
- Remove focus/snapshot/tool-hint markup from:
  - `workspace-roi-overlay.ts`
  - `lab-waveform-timeline-render.ts`
  - `lab-theme.css`
- Restore waveform rendering to the current master-axis-only view if the micro zoom lens proves too risky.
- Re-run Laboratory parity/regression suites and installed-room sync to confirm the room is back to the Phase 3.5 baseline.
