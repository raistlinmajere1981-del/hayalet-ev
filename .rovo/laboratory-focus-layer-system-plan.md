# Plan: Laboratory Focus Layer System

**Generated**: 2026-05-01
**Estimated Complexity**: Medium

## Overview
Introduce a small UI-only focus layer state for the Laboratory workspace so the active work area is visually obvious without changing layout, component structure, or analysis behavior. The implementation should add `ui.labFocusLayer`, map the three focus layers to the requested CSS classes, and update focus automatically from existing preview, timeline, and inspector interactions.

## Research Summary
- Laboratory source of truth is `rooms/laboratory`; generated `data/rooms/laboratory` must not be edited directly.
- UI rendering is centered in `rooms/laboratory/ui/workspace-surface.ts`, with the main surface composed as preview, timeline, and inspector inside the existing `.labx-media-workbench` / `.labx-workspace-stage` structure.
- UI state and event contracts live in `rooms/laboratory/models/lab-types.ts`; reducer defaults and event handling live in `rooms/laboratory/runtime/lab-store.ts`.
- Browser interaction wiring lives in `rooms/laboratory/runtime/lab-run-controller.ts`.
- Workspace styling is primarily in `rooms/laboratory/ui/lab-theme.css`.
- Existing tests already cover store, controller, workspace render output, and CSS source contracts under `scripts/tests/laboratory-*.test.ts`.

## Assumptions
- `ui.labFocusLayer` is ephemeral UI state and should not be added to persisted project/workspace snapshots.
- “Do not change logic” means no analysis, media processing, project, selection, or layout behavior changes; a tiny event/reducer path for visual focus is acceptable because the feature explicitly requires UI state.
- Inspector focused state should make the inspector readable at opacity `1.0`, while still keeping it visually less dominant through darker background and area-specific CSS.
- Existing timeline and preview DOM structure should be reused; any new class should be attached to existing elements.
- Automatic focus should be driven by user-originated interactions, not by programmatic media events such as autoplay, host sync, or timeline playback updates.

## Focus Class Mapping
- `labFocusLayer === "preview"`: preview gets `labx-focus-primary`; timeline and inspector get `labx-focus-passive`.
- `labFocusLayer === "timeline"`: timeline gets `labx-focus-secondary`; preview and inspector get `labx-focus-passive`.
- `labFocusLayer === "inspector"`: inspector gets `labx-focus-secondary`; preview and timeline get `labx-focus-passive`.
- CSS should use area-specific selectors such as `.labx-workspace-preview.labx-focus-primary` and `.labx-workspace-inspector.labx-focus-secondary`, so the shared class names express focus role without forcing identical styling across different components.
- If the inspector is collapsed while `labFocusLayer === "inspector"`, the state remains `inspector`; only the collapsed inspector shell/toggle receives the focused styling. The system does not reopen the inspector or revert focus automatically.

## Prerequisites
- No new dependencies.
- Use workspace source files only under `rooms/laboratory`.
- Validate with room test commands and typecheck before considering the implementation complete.

## Sprint 1: State Contract And Render Hooks
**Goal**: Add the focus layer state and expose it in existing markup without visual changes yet.
**Demo/Validation**:
- New store state defaults to `preview`.
- Rendered workspace markup contains one focus class per visible focus area.
- No layout wrappers are introduced.

### Task 1.1: Add Focus Layer Types
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabFocusLayer = "preview" | "timeline" | "inspector"` and add `labFocusLayer: LabFocusLayer` to `LabStoreUiState`.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Type is exported and available to UI/runtime modules.
  - `LabStoreUiState` requires the new field.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add Store Default And Event
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add `lab-focus-layer-changed` event, default `ui.labFocusLayer` to `preview`, and no-op duplicate changes. Even though the event is typed, add a reducer-side runtime guard so malformed events from untyped tests/devtools cannot write invalid focus values.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Initial store state reports `ui.labFocusLayer === "preview"`.
  - Dispatching each valid layer updates only `ui.labFocusLayer`.
  - Duplicate dispatches leave state semantically unchanged.
  - Malformed/untyped focus values are ignored and covered by a regression test.
- **Validation**:
  - Add store assertions to `scripts/tests/laboratory-store-runtime-regressions.test.ts`.

### Task 1.3: Attach Focus Classes To Existing Workspace Elements
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-waveform-timeline-types.ts`, `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add a small helper that maps `state.ui.labFocusLayer` to `labx-focus-primary`, `labx-focus-secondary`, or `labx-focus-passive`, then attach classes to the existing preview, timeline, and inspector elements.
- **Complexity**: 4/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Preview active => preview has `labx-focus-primary`.
  - Timeline active => timeline has `labx-focus-secondary`.
  - Inspector active => inspector has `labx-focus-secondary` and opacity can become `1.0`, while remaining visually darker than the preview.
  - Inactive areas receive `labx-focus-passive`.
  - No extra wrapper alters layout.
- **Validation**:
  - Add markup assertions to `scripts/tests/laboratory-source-ui-regressions.test.ts` or `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

## Sprint 2: Auto Focus Interaction Rules
**Goal**: Update focus state from existing user interactions, with no change to the underlying actions.
**Demo/Validation**:
- Clicking or using preview media sets preview focus.
- Scrubbing or using timeline controls sets timeline focus.
- Interacting with inspector controls sets inspector focus.

### Task 2.1: Add Controller Focus Helper
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add `setLabFocusLayer(layer)` helper that dispatches `lab-focus-layer-changed` only when the target layer differs.
- **Complexity**: 2/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Helper is local to controller and does not call host APIs.
  - Helper prevents unnecessary render churn.
- **Validation**:
  - Covered by controller tests in later tasks.

### Task 2.2: Preview Interaction Focus
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Detect user-originated pointer and keyboard/focus interactions on the existing workspace preview media/container and set focus to `preview`; do not use plain media `play`/`timeupdate` events as focus signals.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - User interaction with `video[data-lab-preserve-media="workspace-preview"]` sets preview focus.
  - User interaction with the preview container also sets preview focus for image/audio preview surfaces.
  - Programmatic playback or timeline sync updates do not steal focus back to preview.
  - The rule also works for the current preview container without changing media playback behavior.
- **Validation**:
  - Add controller regression using existing fake document/event helpers in `scripts/tests/laboratory-controller-runtime-regressions.test.ts`.

### Task 2.3: Timeline Scrub Focus
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Set focus to `timeline` at the start of timeline scrub/drag/seek interactions and for direct timeline controls that alter playhead or selection.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `timeline-interact`, `timeline-drag-start`, `timeline-drag-end`, and `timeline-drag-body` set timeline focus.
  - Finetune, clear, playhead shift, and timeline volume interactions also make timeline visibly active.
  - Locked timeline paths do not accidentally imply successful editing, but may still focus the attempted area.
- **Validation**:
  - Extend controller tests around timeline mouse/action handling.

### Task 2.4: Inspector Interaction Focus
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Set focus to `inspector` for `focusin`, click, input, and change events inside `[data-lab-workspace-inspector="true"]`.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Right panel tab clicks and setting adjustments focus inspector.
  - Existing setting updates still dispatch their original events.
  - Collapsed inspector toggle can focus inspector without forcing layout changes or reopening the drawer unless the existing toggle behavior already does so.
  - When collapsed and focused, the inspector shell/toggle receives the focused visual state.
- **Validation**:
  - Add controller regression for inspector input/click focus.

## Sprint 3: Visual Hierarchy Styling
**Goal**: Implement the requested visual emphasis using only state classes and existing layout boxes.
**Demo/Validation**:
- At a glance, preview/timeline/inspector dominance matches current focus.
- Opacity, brightness, border, glow, track, and playhead states transition smoothly.
- No layout jump occurs when focus changes.

### Task 3.1: Define Base Focus Transitions
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add shared transition declarations for `.labx-focus-primary`, `.labx-focus-secondary`, and `.labx-focus-passive`.
- **Complexity**: 2/10
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Transitions use:
    `opacity 140ms ease-out, filter 140ms ease-out, box-shadow 160ms ease-out`.
  - Existing hover/control transitions are not removed.
  - Add a `prefers-reduced-motion: reduce` rule that effectively disables these focus transitions.
- **Validation**:
  - CSS source assertions in `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 3.2: Style Preview Primary And Inactive States
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Give `.labx-workspace-preview.labx-focus-primary` the accent border/glow and full brightness, while inactive preview uses brightness `0.85` and opacity `0.85`.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Active preview uses `border: 1px solid var(--labx-accent)`.
  - Active preview uses:
    `box-shadow: 0 0 0 1px var(--labx-accent-soft), 0 0 24px rgba(0,0,0,0.35)`.
  - Active preview uses `filter: brightness(1)` and `scale: 1.0`.
  - Inactive preview uses `filter: brightness(0.85)` and `opacity: 0.85`.
  - Inactive preview dims without breaking existing interactive preview filters.
  - A transparent base border prevents focus-change layout shift.
  - Dimmed preview media controls remain reachable and readable.
- **Validation**:
  - CSS source assertions plus manual visual smoke.

### Task 3.3: Style Timeline Secondary State
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Use `.labx-timeline.labx-focus-secondary` for opacity `1`, stronger waveform/track highlight, and more visible playhead; inactive timeline opacity becomes `0.7`.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Active timeline has stronger track/window emphasis.
  - Active playhead is brighter and easier to read.
  - Active timeline uses `opacity: 1`.
  - Inactive timeline uses `opacity: 0.7`.
  - Inactive timeline controls remain readable and clickable.
- **Validation**:
  - CSS source assertions plus timeline render test.

### Task 3.4: Style Inspector Passive And Focused States
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Darken the inspector background, set default opacity `0.65`, and raise it to `1.0` only when inspector is focused.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Inspector remains less visually dominant than preview.
  - Focused inspector is readable at opacity `1.0`.
  - Passive/open inspector defaults to `opacity: 0.65`.
  - Inspector background is darker than the main preview area.
  - Collapsed inspector remains usable and does not disappear.
  - Control text remains readable in focused and passive states.
- **Validation**:
  - CSS source assertions plus manual collapsed/open smoke.

## Sprint 4: Final Smoke And Typecheck
**Goal**: Run the complete focused validation set after store, render, controller, and CSS coverage has been added alongside the implementation sprints.
**Demo/Validation**:
- Store, render, controller, and CSS tests pass.
- Manual UI smoke confirms the success criterion: “Where am I working right now?”

### Task 4.1: Store Regression
- **Location**: `scripts/tests/laboratory-store-runtime-regressions.test.ts`
- **Description**: Confirm the store regression added during Sprint 1 passes in the combined final run.
- **Complexity**: 2/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Default is `preview`.
  - Valid events switch to `timeline` and `inspector`.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 4.2: Render/CSS Contract Regression
- **Location**: `scripts/tests/laboratory-source-ui-regressions.test.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Confirm the render and CSS regressions added during Sprints 1 and 3 pass in the combined final run.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1, Sprint 3
- **Acceptance Criteria**:
  - Markup reflects each focus layer without changing the expected workspace ordering.
  - CSS contains the required class selectors and transition timings.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 4.3: Controller Interaction Regression
- **Location**: `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
- **Description**: Confirm the controller regressions added during Sprint 2 pass in the combined final run.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Preview interaction changes state to `preview`.
  - Timeline scrub/control interaction changes state to `timeline`.
  - Inspector control interaction changes state to `inspector`.
  - Original action effects still happen in the same test scenario where practical.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`

### Task 4.4: Final Validation
- **Location**: Repository root
- **Description**: Run focused tests and typecheck.
- **Complexity**: 2/10
- **Dependencies**: Tasks 4.1-4.3
- **Acceptance Criteria**:
  - Focused regression tests pass.
  - Typecheck passes.
  - Manual smoke shows no layout shift and clear active area.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:typecheck`

## Testing Strategy
- Unit/store: verify state default and event transitions.
- Render contract: verify class placement without new layout wrappers.
- Controller: verify automatic focus from preview, timeline, and inspector events.
- CSS source tests: verify required selectors, transitions, and key style values.
- Manual smoke: with a loaded video source, interact with preview, scrub timeline, then adjust inspector and confirm the visually dominant/focused area changes immediately.

## Potential Risks & Gotchas
- Existing inline preview filters could conflict with brightness dimming if the dimming is applied directly to the media node. Mitigation: apply focus dimming to the preview container or inspection content so the existing filter string remains intact.
- Changing `border: 0` to `border: 1px` can cause a visual shift. Mitigation: establish a transparent `1px` base border and only change `border-color`.
- Timeline markup is generated in `lab-waveform-timeline-render.ts`, not directly in `workspace-surface.ts`. Mitigation: add an optional focus class field to the timeline model instead of wrapping the timeline.
- Inspector is absolutely positioned and may be collapsed. Mitigation: keep collapsed toggle opacity high enough to remain discoverable even when passive.
- Event-based focus changes can cause extra renders during drag. Mitigation: only dispatch focus changes when the target layer differs.
- Persisting focus could reopen old sessions in a misleading visual state. Mitigation: do not persist `labFocusLayer`.

## Rollback Plan
- Remove `LabFocusLayer`, `ui.labFocusLayer`, and the `lab-focus-layer-changed` event from `lab-types.ts` and `lab-store.ts`.
- Remove focus helper/event wiring from `lab-run-controller.ts`.
- Remove focus class injection from `workspace-surface.ts` and timeline render/type files.
- Remove `.labx-focus-*` CSS rules from `lab-theme.css`.
- Remove the focused regression tests added for this feature.
