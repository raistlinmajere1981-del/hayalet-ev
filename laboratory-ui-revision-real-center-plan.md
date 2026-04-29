# Plan: Laboratory UI Revision - Real Center

**Generated**: 2026-04-29
**Estimated Complexity**: Medium
**Workflow Context**: `mode:status=terminal`, `whereami.effectiveMode=other-provider-cli`; planning only, no app or ghost transition required.

## Overview
Phase 1 focuses on one perception shift: Media and Timeline must feel like one working object, not two stacked cards. The implementation should keep the scope intentionally narrow:

- enlarge the media viewport so it owns at least 60% of the unified media workbench height on desktop smoke;
- remove the separate-card feeling between media and timeline;
- attach the timeline directly under the media in the same center container;
- add first-version selection-to-video sync for finalized selection start/end changes.

Realtime preview while dragging is explicitly out of scope for this phase. The success criterion is experiential: the user should feel, "I am working on this video," because the timeline behaves like an attached editing surface under the viewport.

## Current State Summary
- `rooms/laboratory/ui/workspace-surface.ts` renders the center source bar, linked audio bar, media preview, optional dual-preview transport, timeline, hypothesis, focus controls, and bookmarks.
- The media preview and timeline are currently siblings inside `.labx-workspace-main`.
- `rooms/laboratory/ui/lab-theme.css` gives `.labx-workspace-main` a vertical gap, `.labx-workspace-preview` a bordered rounded container, and `.labx-timeline` its own bordered rounded container.
- `rooms/laboratory/runtime/lab-run-controller.ts` already distinguishes click-to-seek from drag-to-select and currently seeks to the selection start after completed drags.
- Selection state lives in `state.ui.workspace.timelineStartMs` and `timelineEndMs`; numeric inputs and drag handles both dispatch `workspace-timeline-updated`.
- Existing targeted tests live mainly in `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`, and `scripts/tests/laboratory-controller-runtime-regressions.test.ts`.

## Prerequisites
- Before implementation, rerun `npm run mode:status` and `npm run whereami`, then follow the repo change-approval protocol.
- Keep edits in source copy under `rooms/laboratory`; do not manually edit `data/rooms/laboratory`.
- Preserve media node reuse behavior in `lab-root.ts`; video/audio nodes must not remount on normal re-render.
- Preserve locked timeline behavior during active runs.
- Keep visible copy changes room-local through existing i18n patterns if new text is needed.

## Sprint 1: Merge Media and Timeline Structure
**Goal**: Make media preview, dual-preview transport, and timeline render as one center-stage unit.

**Demo/Validation**:
- Render a ready video source.
- Preview, optional dual-preview transport, and timeline are siblings inside `.labx-media-workbench`.
- Source bar and linked audio bar stay outside the workbench.
- Timeline still hides when duration is unavailable or viewport is not active.

### Task 1.1: Introduce a Center Workbench Wrapper
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Wrap `.labx-workspace-preview`, optional dual-preview transport, and `renderLabWaveformTimeline(timelineModel)` in one semantic container, for example `.labx-media-workbench`.
- **Complexity**: 4/10
- **Dependencies**: None
- **Parallelizable**: No; this sets the markup shape for CSS and tests.
- **Acceptance Criteria**:
  - Source bar and linked audio bar remain outside the workbench.
  - Preview, transport, and timeline are adjacent children inside the same workbench.
  - Timeline is still rendered only when `durationMs > 0`.
  - Existing `data-lab-preserve-media` markup remains unchanged inside the preview media node.
- **Validation**:
  - Add source/markup assertions in `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.
  - Run `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 1.2: Preserve Dual Preview Ordering
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Keep dual-preview transport inside the same workbench as an inline toolbar, not as a separate card between media and timeline.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Parallelizable**: Yes, after wrapper shape is agreed.
- **Acceptance Criteria**:
  - Single preview order is media then timeline with no intervening element.
  - Dual preview order is media, inline transport toolbar, then timeline.
  - Dual transport has no external margin/gap or standalone card styling that breaks the attached workbench feel.
  - Transport remains functionally tied to dual preview and does not render for single preview.
- **Validation**:
  - Existing dual-preview tests in `scripts/tests/laboratory-workspace-runtime-regressions.test.ts` still pass.
  - Markup/CSS assertions confirm dual transport is scoped under `.labx-media-workbench`.

## Sprint 2: Give the Viewport Real Vertical Authority
**Goal**: The media viewport takes at least 60% of the center work area and stops reading as a small card.

**Demo/Validation**:
- On desktop, the ready media viewport height is at least 60% of the `.labx-media-workbench` inner height.
- On mobile/narrow layouts, the viewport remains usable without pushing timeline controls into broken overflow.
- The workbench has one outer surface; preview, transport, and timeline do not read as separate cards.

### Task 2.1: Define Workbench Layout CSS
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add `.labx-media-workbench` styles that own the unified surface. Move the dominant border/background/radius to this wrapper and reduce preview/timeline internal framing.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - `.labx-media-workbench` owns the single outer border, background, and radius.
  - `.labx-workspace-preview`, `.labx-dual-preview-transport`, and `.labx-timeline` do not carry outer shadows that make them read as separate cards.
  - The workbench uses `gap: 0` or equivalent so preview, transport, and timeline touch without external spacing.
  - Timeline top edge aligns directly to the media or inline transport bottom edge.
  - No card-inside-card look is introduced.
- **Validation**:
  - Add CSS source assertions for wrapper ownership, zero internal gap, reduced shadows, and attached timeline placement.
  - Run `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 2.2: Enforce Minimum Viewport Height
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Give the preview zone a responsive height rule that can be measured as at least 60% of `.labx-media-workbench` inner height on desktop after source and linked-audio bars are excluded.
- **Complexity**: 6/10
- **Dependencies**: Task 2.1
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Desktop smoke computes `previewRect.height / workbenchRect.height >= 0.6` for ready video in single-preview mode.
  - The CSS rule is constrained so source bar, timeline, and bottom controls stay accessible.
  - Video and image media keep `object-fit: contain`.
  - Audio-only and empty/error viewport states remain visually valid.
  - A formula that looks like 60% in source but fails the computed ratio does not pass.
- **Validation**:
  - Add CSS assertions for the 60% viewport intent.
  - Run desktop screenshot or DOM measurement smoke when the app is available; if Electron is unavailable, record the smoke as blocked, not passed.

### Task 2.3: Tune Responsive Behavior
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add or adjust media queries so the unified workbench remains useful on narrow screens and with the drawer collapsed or visible.
- **Complexity**: 4/10
- **Dependencies**: Task 2.2
- **Parallelizable**: Yes, after primary desktop rule exists.
- **Acceptance Criteria**:
  - Dual preview still stacks correctly below the existing `max-width: 960px` breakpoint.
  - Timeline controls wrap without overlapping selection labels.
  - The workbench does not trap scrolling in the center panel.
- **Validation**:
  - CSS source assertions plus mandatory narrow screenshot or DOM smoke when the app is available; if Electron is unavailable, record the smoke as blocked, not passed.

## Sprint 3: Attach Timeline Interaction to Video
**Goal**: Selection changes perform first-version video sync without realtime drag preview.

**Demo/Validation**:
- Click-to-seek still seeks without creating a selection.
- Starting a new drag selection seeks once to the selection anchor.
- Dragging a selection does not seek continuously while moving.
- Releasing a new drag selection seeks once to the finalized selection end.
- Changing the start numeric input seeks to the new start.
- Changing the end numeric input seeks to the new end.
- Dragging a start handle seeks to the finalized start on release.
- Dragging an end handle seeks to the finalized end on release.

### Task 3.1: Seek on Selection Start and Final Edge
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Extend timeline drag state so the controller seeks once when a selection starts and once when the edited edge is finalized.
- **Complexity**: 5/10
- **Dependencies**: None
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Rail selection seeks to the anchor when the drag crosses the selection threshold.
  - Rail selection release seeks to the finalized selection end.
  - Start-handle release seeks to finalized start.
  - End-handle release seeks to finalized end.
  - Body drag release seeks to the moved selection start; body move does not introduce realtime preview.
  - No continuous seeking occurs during `mousemove`; the threshold-crossing anchor seek is a one-time selection-start sync.
- **Validation**:
  - Extend `scripts/tests/laboratory-controller-runtime-regressions.test.ts`.

### Task 3.2: Seek on Numeric Start and End Changes
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Use the current `workspaceField` branch as explicit edge context. After a valid `workspace.timelineStartMs` or `workspace.timelineEndMs` input dispatch, call timeline seek for that edited edge only.
- **Complexity**: 4/10
- **Dependencies**: None
- **Parallelizable**: Yes, with Task 3.1 if edits stay scoped.
- **Acceptance Criteria**:
  - Editing start seeks to the entered start value.
  - Editing end seeks to the entered end value.
  - The controller does not infer the edited edge from store diff alone; it uses the input field context.
  - Clearing either field does not seek.
  - Invalid or locked timeline input remains no-op.
  - Dual-preview seek path is respected when dual preview is active.
- **Validation**:
  - Add controller tests covering single preview and, if practical, dual-preview seek path.

### Task 3.3: Keep Existing Click-to-Seek Threshold Intact
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
- **Description**: Ensure the current pending-seek threshold still separates a click from a drag selection after selection-edge seek changes.
- **Complexity**: 3/10
- **Dependencies**: Tasks 3.1 and 3.2
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Existing click-to-seek test remains valid.
  - Drag creation does not overwrite click seek behavior.
  - Shift-click extension behavior remains explicit and covered if changed.
- **Validation**:
  - Run `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`.

## Sprint 4: Focused Regression and Visual Smoke
**Goal**: Prove the phase is complete without broad rewrites.

**Demo/Validation**:
- User opens Laboratory with a video and sees one continuous media/timeline workbench.
- Selection start/end sync is visible immediately.
- No unrelated drawer, process strip, or report behavior changes.

### Task 4.1: Add Contract Tests for Attached Workbench
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, optionally `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
- **Description**: Add tests that protect the workbench wrapper, timeline placement, and media preserve markers.
- **Complexity**: 4/10
- **Dependencies**: Sprints 1 and 2
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Tests fail if timeline moves outside the media workbench.
  - Tests fail if preview media preserve key disappears.
  - Tests check the CSS intent for unified surface and 60% viewport ownership.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`

### Task 4.2: Run Targeted Runtime Regressions
- **Location**: `scripts/tests/laboratory-controller-runtime-regressions.test.ts`, `scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
- **Description**: Run focused tests that cover timeline interaction, media preservation, dual preview seek, and workspace rendering.
- **Complexity**: 2/10
- **Dependencies**: Sprint 3
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Timeline interaction regressions pass.
  - Workspace runtime regressions pass.
  - No test expectation depends on realtime drag preview.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts`

### Task 4.3: Run Typecheck and Visual Smoke
- **Location**: project root, app runtime if available
- **Description**: Run typecheck and, when app workflow is available, perform a short visual smoke pass with measured desktop and narrow checks.
- **Complexity**: 3/10
- **Dependencies**: Tasks 4.1 and 4.2
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - Desktop smoke confirms `previewRect.height / workbenchRect.height >= 0.6`, attached timeline, and selection seek.
  - Narrow smoke confirms no overlap or inaccessible timeline controls.
  - If Electron/app smoke is unavailable, the final implementation report calls that out explicitly.
- **Validation**:
  - `npm run rooms:typecheck`
  - CDP screenshot/manual app smoke when Electron is available.

## Testing Strategy
- Start with source-level UI tests for markup and CSS intent because the first two sprints are mostly structural and visual.
- Add controller tests for selection-edge seek behavior before touching broader runtime tests.
- Run the focused suite after each sprint:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
- Finish with `npm run rooms:typecheck`.
- Use Electron/CDP screenshot or DOM-measurement smoke as a required implementation check when the active workflow can run the app safely; if blocked, document the limitation explicitly.

## Potential Risks & Gotchas
- The existing worktree is dirty in the same Laboratory files. Implementation must inspect current diffs before editing and preserve unrelated user changes.
- A 60vh-style rule can accidentally ignore the fixed top bar, source bar, drawer, and process strip. Prefer a constrained workbench-relative rule and prove it with a computed ratio.
- Moving timeline markup can break tests that assert source strings or media preservation. Keep the media element subtree stable.
- Dual preview has a separate transport path; treat transport as an inline toolbar inside the workbench and keep dual-preview seek logic intact.
- Selection-end seeking changes a subtle behavior: current drag release generally seeks to selection start. Tests should make the new start-anchor and end-final sync explicit.
- The selection panel floats above the timeline and may collide with a larger viewport or center scroll position. Visual smoke should include an active selection.
- Timeline numeric input can dispatch invalid ranges where the store normalizes one side to null. Use input field context for the edited edge and seek only when the raw value is finite enough to represent a real edge.

## Rollback Plan
- Revert the workbench wrapper and CSS changes in `workspace-surface.ts` and `lab-theme.css` to restore separate preview/timeline siblings.
- Revert selection-edge seek changes in `lab-run-controller.ts` to the current release-to-start behavior.
- Remove only the new regression assertions added for this phase.
- Leave unrelated Laboratory worktree changes untouched.

## Implementation Boundaries
- In scope: center media viewport, timeline attachment, first-version selection edge seek, targeted tests.
- Out of scope: realtime drag preview, waveform redesign, drawer/result redesign, new media controls, persistence model changes, installed copy edits under `data/rooms`.
