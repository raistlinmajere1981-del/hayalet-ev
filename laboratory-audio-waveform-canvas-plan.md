# Plan: Laboratory Audio Waveform Canvas

**Generated**: 2026-04-24
**Estimated Complexity**: Medium

## Overview
Add a lightweight real-time waveform for the existing Laboratory audio preview by wiring the current `workspace-preview` audio element to the existing `#lab-audio-viz` canvas. The change must stay fully client-side, avoid the analysis pipeline, avoid new backend logic, and avoid adding new store/state fields.

The current codebase already gives us two key anchors:
- `rooms/laboratory/ui/workspace-audio-focus.ts` owns the canvas markup and visualization mode selector.
- `rooms/laboratory/runtime/lab-run-controller.ts` already contains a working `AudioContext` + `AnalyserNode` + waveform draw loop for the same canvas/audio pairing.

The implementation plan therefore focuses on reusing or relocating the existing runtime-only waveform behavior so the final ownership matches the requested `workspace-audio-focus.ts` target without widening scope.

## Prerequisites
- Existing preview audio selector remains `audio[data-lab-preserve-media="workspace-preview"]`.
- Existing canvas remains `#lab-audio-viz`.
- Theme colors continue to come from `rooms/laboratory/ui/lab-theme.css` custom properties such as `--labx-accent`, `--labx-border`, and `--labx-text-dim`.
- Workspace source of truth remains `rooms/laboratory/*`; installed/runtime copies under `data/rooms/laboratory/*` should not be treated as peer edit targets.
- No new host/runtime backend messages, pipeline hooks, or persisted fields are introduced.

## Sprint 1: Lock the Integration Seam
**Goal**: Decide the smallest safe place to host the waveform binding logic while keeping `workspace-audio-focus.ts` as the feature owner.
**Demo/Validation**:
- We can point to one clear module that owns:
  - audio element lookup
  - canvas lookup
  - play/pause/end lifecycle
  - visualizer cleanup on source replacement
- No new state shape or host bridge contract is required.

### Task 1.1: Audit the Existing UI/Runtime Ownership
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Confirm how the preview audio element is rendered, how the canvas is rendered, and where DOM listeners currently belong. Record the current selector contract and note that `workspace-audio-focus.ts` is presently render-only.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - The plan explicitly names the current audio element selector and canvas selector.
  - The plan captures whether `workspace-audio-focus.ts` needs a small exported binder/helper in addition to markup rendering.
- **Validation**:
  - Local code inspection
  - Optional `rg`/targeted file reads for selector parity

### Task 1.2: Choose the Minimal Ownership Pattern
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, optionally `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Pick one of these implementation-safe paths before coding:
  - move the existing visualizer helper functions next to `workspace-audio-focus.ts` and expose a tiny binder API
  - keep the runtime controller as the listener owner but make `workspace-audio-focus.ts` the canonical UI owner only if that better matches the existing architecture

  The decision must minimize churn and avoid duplicated waveform logic.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - One module owns the waveform behavior.
  - No duplicate `AudioContext`/draw-loop implementations remain.
  - The chosen seam still satisfies the request to connect the existing audio element to the existing canvas.
  - The existing `visualizationMode` contract is handled explicitly, without expanding scope into a real spectrum renderer.
- **Validation**:
  - Diff review against the current controller helpers

## Sprint 2: Wire the Existing Audio Element to the Canvas
**Goal**: Bind the current audio preview element to a lightweight analyser graph that starts only after user playback.
**Demo/Validation**:
- Playing the preview initializes/resumes the audio graph.
- Pausing or ending playback stops the draw loop.
- Replacing the preview source tears down the old media node safely.

### Task 2.1: Resolve the Audio and Canvas References
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Use the existing `workspace-preview` audio element and `#lab-audio-viz` canvas as the only binding points. Avoid introducing parallel preview elements or hidden clones.
- **Complexity**: 2
- **Dependencies**: Sprint 1 decision
- **Acceptance Criteria**:
  - Only the existing preview audio element is used as the waveform source.
  - The canvas lookup tolerates re-renders without stale references.
- **Validation**:
  - Local smoke test with audio source loaded
  - Targeted DOM selector assertions if a regression test exists

### Task 2.2: Create the Audio Graph Lazily on First Play
- **Location**: Chosen owner module from Sprint 1
- **Description**: On first user play interaction, create or resume:
  - `audioContext`
  - `analyserNode` with `fftSize` around `2048`
  - `sourceNode` from `createMediaElementSource(audioElement)`

  Wire `sourceNode -> analyserNode -> destination` and guard against repeated `createMediaElementSource` calls for the same element.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - No eager initialization before playback.
  - Repeated play events do not create duplicate source nodes.
  - The graph remains independent from the analysis pipeline.
- **Validation**:
  - Manual browser/Electron playback smoke test
  - Runtime truth test coverage for lazy init if harness support already exists

### Task 2.3: Add Lifecycle Cleanup for Pause, End, and Source Changes
- **Location**: Chosen owner module from Sprint 1
- **Description**: Start the visualizer loop on `play`, stop it on `pause` and `ended`, and disconnect/reset the source node when the bound audio element changes due to workspace rerender or source swap.
- **Complexity**: 4
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `requestAnimationFrame` is not left running while media is paused.
  - Source replacement does not throw graph reuse errors.
  - Idle canvas rendering is restored when playback is inactive or visualization mode is `none`.
- **Validation**:
  - Manual source-switch smoke test
  - Targeted runtime/controller regression assertions

## Sprint 3: Draw the Waveform Cleanly and Safely
**Goal**: Render a simple theme-aligned waveform without heavy visuals or blocking behavior.
**Demo/Validation**:
- The waveform line animates during playback.
- The canvas uses existing Laboratory theme tokens.
- The UI remains responsive and behaves correctly when no analysis has been run.

### Task 3.1: Implement the Draw Loop
- **Location**: Chosen owner module from Sprint 1
- **Description**: Build a `requestAnimationFrame` loop that:
  - sizes the canvas for current CSS dimensions and device pixel ratio
  - reads `analyser.getByteTimeDomainData(buffer)`
  - clears the frame
  - draws a subtle guide/midline
  - draws a clean waveform line across the canvas

  Keep the visual language minimal; no spectrum bars, glow-heavy effects, or analysis-derived overlays.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - The waveform updates continuously only while audio is playing.
  - The line stays legible across common canvas widths.
  - No blocking loops or synchronous heavy work are introduced.
- **Validation**:
  - Manual playback check in Laboratory audio source mode
  - Visual spot check at standard and HiDPI scaling

### Task 3.2: Use Existing Theme Colors and Preserve the Idle State
- **Location**: `rooms/laboratory/ui/lab-theme.css`, chosen owner module from Sprint 1
- **Description**: Read existing CSS custom properties from the canvas/computed style for waveform, guide, and idle rendering. Reuse the current idle treatment or simplify it, but do not add a new visual theme branch.
- **Complexity**: 3
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Visualizer colors come from existing Laboratory theme variables.
  - The canvas still looks intentional when no playback is active.
  - No extra state field is introduced just to drive styling.
  - If `visualizationMode === "spectrum"` remains selectable, it is handled by an explicit fallback decision rather than a new spectrum implementation.
- **Validation**:
  - Manual theme inspection
  - Diff review against `lab-theme.css`

## Sprint 4: Regression Safety and Delivery Check
**Goal**: Prove the feature works in the intended no-analysis path and does not destabilize existing Laboratory preview behavior.
**Demo/Validation**:
- The waveform works for regular audio preview playback without running analysis.
- Existing Laboratory preview UI still renders the same selectors and controls.
- Typecheck or targeted tests pass for touched areas.

### Task 4.1: Add or Update Focused Regression Coverage
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, and/or `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
- **Description**: Add the lightest regression coverage that protects:
  - the existing `workspace-preview` audio selector contract
  - presence of `#lab-audio-viz`
  - start/stop listener binding semantics where the current test harness allows it

  Prefer targeted assertions over a full media-emulation rewrite unless the current harness already supports these events.
- **Complexity**: 4
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - Tests cover the DOM contract and at least one lifecycle seam.
  - Coverage does not depend on the analysis pipeline.
- **Validation**:
  - Run targeted Laboratory regression files

### Task 4.2: Final No-Analysis Smoke Verification
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Verify the intended user path:
  - open Laboratory with an audio source
  - play the existing preview audio
  - confirm waveform renders immediately
  - pause/end playback and confirm loop stops
  - change source and confirm no stale waveform or console errors
- **Complexity**: 2
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Feature works with zero analysis run.
  - No console/runtime errors appear during source changes.
  - Audio playback remains audible after analyser insertion.
- **Validation**:
  - Manual smoke test
  - Optional Electron log check if needed

## Testing Strategy
- Start with selector and ownership verification before moving code.
- Reuse the existing waveform/analyser helpers where possible instead of re-deriving the Web Audio setup.
- Prefer targeted Laboratory tests over broad suite runs:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
- Run project-level typecheck if the touched module boundary changes materially.
- Finish with a manual no-analysis smoke pass using a plain audio source.

## Potential Risks & Gotchas
- `workspace-audio-focus.ts` currently renders HTML strings and may not be the natural home for DOM listeners; forcing all runtime behavior into it could fight the existing architecture.
- `createMediaElementSource()` can only be created once per media element/context pairing; repeated binding must reuse or safely reconnect the existing node.
- Rerenders may replace the audio element instance, so source-node teardown must happen before rebinding.
- The existing visualization mode includes `spectrum`, but the requested scope is waveform-only. The implementation should avoid expanding this task into a full spectrum feature.
- Laboratory rooms have both workspace and installed copies; implementation should modify only `rooms/laboratory/*` and let sync/build flows refresh installed copies later if needed.
- Connecting through the analyser must not mute or double-route playback unexpectedly; the audible path still needs to reach `destination`.
- Canvas sizing must handle CSS size vs backing-buffer size so the line does not look blurry on HiDPI displays.
- Manual verification should cover the “analysis never ran” path explicitly because that is a hard requirement, not an implied one.

## Rollback Plan
- Revert the waveform-binding changes in the chosen owner module.
- Keep the existing canvas markup in `workspace-audio-focus.ts` intact.
- Restore the previous idle-only visualization behavior if the live waveform causes playback or lifecycle regressions.
