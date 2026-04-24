# Plan: Laboratory Realtime Audio Visualizer

**Generated**: 2026-04-24
**Estimated Complexity**: Medium

## Overview
Attach true realtime audio rendering to the existing Laboratory preview canvas so `#lab-audio-viz` draws live waveform data from the currently bound workspace media element, with a spectrogram-ready frequency path available behind the existing visualization mode switch.

This phase is intentionally visualization-only:
- no analysis pipeline changes
- no artifact generation
- no store writes for render state
- no `userActions` or run execution behavior changes

Current codebase notes:
- the preview canvas already lives in `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, not in `workspace-audio-focus.ts`
- the current binding seam already exists in `rooms/laboratory/runtime/lab-run-controller.ts` via `createLabWaveformTimelineVisualizer(...)`
- `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts` already contains mixed responsibilities:
  - live analyser graph
  - artifact image rendering
  - decoded static waveform fallback
- `workspace-audio-focus.ts` is now only the control panel; it does not own the media element or the canvas mount lifecycle
- the persisted UI mode already uses `AudioVisualizationMode = "none" | "waveform" | "spectrum"`, so realtime frequency rendering should reuse `"spectrum"` instead of inventing a new mode name

## Prerequisites
- Current unified timeline / waveform surface is merged
- Existing preview media preservation contract remains unchanged:
  - `audio[data-lab-preserve-media="workspace-preview"]`
  - `audio[data-lab-preserve-media="workspace-preview-dual-audio"]`
  - `video[data-lab-preserve-media="workspace-preview"]`
- Validation baseline:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:build`
  - installed room sync if source files change before parity-sensitive suites

## Assumptions
- The existing timeline canvas `#lab-audio-viz` remains the only render target in this phase
- The new runtime module will own the whole live branch:
  - realtime drawing
  - analyser lifecycle
  - media-source routing while the live branch owns playback visualization
- Artifact image rendering and decoded static fallback can remain in the timeline visualizer, but the extraction boundary must preserve current source-routing behavior during handoff
- Integration should happen through the existing timeline visualizer/controller seam, not by mounting directly inside `workspace-audio-focus.ts`
- `spectrum` mode is treated as the realtime frequency/spectrogram-ready mode
- Realtime rendering should continue to work for both single-preview and dual-preview linked-audio cases by using the currently bound master/companion media selection logic
- If `AudioContext.resume()` is blocked, the visualizer should fail soft and retry on the next meaningful playback event

## Sprint 1: Runtime Visualizer Contract
**Goal**: Create a dedicated runtime module that owns Web Audio lifecycle and canvas drawing without changing UI state or execution flow.

**Demo/Validation**:
- A standalone controller API exists for a media element and canvas
- Types compile without changing analysis or persistence contracts

### Task 1.1: Add Realtime Visualizer Runtime Module
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Create `createAudioVisualizer(audioElement, canvasElement)` and return a controller with `start()`, `stop()`, and `destroy()`.
- **Complexity**: 4/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - module is pure runtime and does not import store/selectors
  - controller can be constructed with an `HTMLMediaElement` and `HTMLCanvasElement`
  - exported public API stays `start()`, `stop()`, and `destroy()` only
  - controller derives any needed `window` / `document` references from the passed elements instead of requiring store or root-level wiring
  - `destroy()` is idempotent and safe after `stop()`
- **Validation**:
  - `npm run rooms:typecheck`

Implementation note:
- Because the current owner seam is store-driven and the canvas can remount, this public controller API should be paired with a small owner wrapper in `lab-waveform-timeline-visualizer.ts` that decides when a controller instance can be reused vs must be recreated for a new `(media, canvas, mode)` binding epoch.

### Task 1.2: Define Internal Audio Graph Ownership Rules
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Document and implement how `AudioContext`, `AnalyserNode`, and `MediaElementAudioSourceNode` are created, resumed, disconnected, and destroyed.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `fftSize` is fixed at `2048`
  - waveform and frequency buffers are allocated once and reused
  - the media source node is not recreated on every animation frame
  - teardown closes or disconnects graph resources without breaking media playback
- **Validation**:
  - targeted unit-style regression coverage with fake audio/canvas primitives

### Task 1.3: Add Mode-Aware Render Surface
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Support at least two internal draw paths:
  - waveform via `getByteTimeDomainData`
  - frequency heat map via `getByteFrequencyData`
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - waveform path is production-ready in this phase
  - frequency path is available behind a mode switch and produces visible non-empty output
  - no new persisted enum or store field is added
- **Validation**:
  - render-path regression tests for waveform and spectrum modes

## Sprint 2: Extract And Reuse The Existing Live Analyzer Path
**Goal**: Move live realtime drawing responsibility out of the UI visualizer without regressing artifact or static fallback rendering.

**Demo/Validation**:
- Timeline visualizer still renders the same canvas
- Live waveform now comes from the runtime module instead of inline UI logic

### Task 2.1: Identify The Live-Only Slice In The Timeline Visualizer
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
- **Description**: Separate current responsibilities into:
  - realtime analyzer rendering
  - artifact image rendering
  - decoded fallback waveform rendering
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - the file no longer mixes all low-level analyser graph details with markup sync logic
  - artifact rendering behavior remains source-compatible
  - decoded waveform fallback remains source-compatible
- **Validation**:
  - current visualizer regression suite continues to pass

### Task 2.2: Replace Inline Live Analyzer Logic With Runtime Controller Usage
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`, `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Delegate the current live branch to the new runtime controller, including audio graph routing that presently flips between analyser-owned and destination-owned playback paths.
- **Complexity**: 6/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - artifact rendering can still win before live analyzer init
  - decoded fallback waveform can still render before playback when source URL is available
  - live controller activates only when realtime mode should own the canvas
  - live-branch extraction preserves current source reroute behavior during artifact/static handoff
  - no duplicate RAF loop remains in the UI file
- **Validation**:
  - targeted truth regressions around artifact-first and decoded-waveform-first behavior

### Task 2.3: Add Binding-Epoch Reuse Logic In The Owner Seam
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
- **Description**: Track the effective live binding identity `(media element, canvas element, visualization mode branch)` so mode flips, canvas remounts, and source churn do not recreate `MediaElementAudioSourceNode` unnecessarily.
- **Complexity**: 6/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - no destroy/recreate churn on ordinary `sync()` passes
  - controller recreation happens only when binding identity actually changes
  - mode changes between waveform/spectrum can be handled without fragile duplicate source-node creation
- **Validation**:
  - targeted truth regressions around rerender, remount, and mode flip scenarios

### Task 2.4: Keep The Existing Export Surface Stable
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Update the barrel surface only as needed so existing imports remain stable and downstream callers do not need broad rewrites.
- **Complexity**: 2/10
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - existing timeline visualizer import sites continue to compile
  - no unrelated UI render call sites change
- **Validation**:
  - `npm run rooms:typecheck`

## Sprint 3: Performance Guards And Realtime Rendering Behavior
**Goal**: Make the new controller efficient and predictable during playback, pause, seek, hidden-tab, and teardown scenarios.

**Demo/Validation**:
- Waveform moves while audio plays
- Pause stops or heavily throttles rendering
- Seek causes the next visible frame to jump immediately

### Task 3.1: Add RAF Scheduler And Pause Throttling
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Drive rendering with `requestAnimationFrame`, but reduce work when media is paused so the controller does not busy-loop on a static signal.
- **Complexity**: 5/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - playback uses RAF-driven updates
  - paused media does not keep full-speed RAF rendering alive
  - resume returns to smooth rendering without rebuilding the controller
- **Validation**:
  - fake-window regression that asserts RAF behavior across play/pause

### Task 3.2: Add Visibility Guard
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Pause or suspend the render loop when `document.hidden === true`, then resume on visibility restoration if media is still active.
- **Complexity**: 4/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - hidden tab stops unnecessary draw work
  - restoring visibility resumes correctly without duplicate listeners
  - `destroy()` unregisters visibility listeners
- **Validation**:
  - visibilitychange regression with repeated hide/show cycles

### Task 3.3: Make Canvas Sizing DPR-Safe
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`, `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Preserve the current DPR-aware sizing behavior while extracting it into the runtime module cleanly, and add the requested stable CSS hook for full-area fill.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - the canvas markup gets a stable class hook such as `.lab-audio-viz-canvas` in addition to existing timeline classes
  - canvas CSS fills available area
  - backing resolution tracks CSS size and DPR
  - waveform line remains crisp instead of blurry on HiDPI displays
- **Validation**:
  - visual smoke check
  - extend the fake canvas harness so tests can assert backing-store resize and transform behavior explicitly

## Sprint 4: Seam Integration In The Real Owner Path
**Goal**: Wire the controller into the real owner chain for canvas + media binding without introducing the wrong mount seam.

**Demo/Validation**:
- The existing preview surface still owns `#lab-audio-viz`
- The visualizer controller starts and stops with the actual preview media lifecycle

### Task 4.1: Correct The Requested Mount Seam
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`, plan note/tests
- **Description**: Preserve `workspace-audio-focus.ts` as a control panel and implement the actual mount in the timeline visualizer where the canvas and media lookup already live.
- **Complexity**: 3/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - no direct media/canvas lifecycle code is added to `workspace-audio-focus.ts`
  - the implementation note is explicit so future work does not split ownership incorrectly
  - any copy or comments that mention the preview relationship stay accurate
- **Validation**:
  - code review
  - no new runtime imports inside `workspace-audio-focus.ts`

### Task 4.2: Integrate Controller With Existing Media Selection Logic
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
- **Description**: Reuse the current logic that picks the correct workspace preview media for single-preview and dual-preview scenarios, then hand the bound media + canvas to the runtime controller.
- **Complexity**: 5/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - single preview audio/video continues to work
  - dual preview linked-audio selection still binds to the correct media element
  - source churn tears down the previous controller cleanly
- **Validation**:
  - existing dual-preview visualizer regressions
  - added seek/play/pause coverage

### Task 4.3: Preserve Controller Ownership In `lab-run-controller.ts`
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Keep the controller creation seam stable from the run controller perspective so playback sync and preview binding remain orchestrated in one place.
- **Complexity**: 3/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - `lab-run-controller.ts` still instantiates one workspace visualizer owner
  - no analysis or store event behavior changes
  - preview playhead sync remains untouched
- **Validation**:
  - existing timeline/playhead regressions remain green

## Sprint 5: Realtime Spectrum Readiness And Regression Closure
**Goal**: Make `"spectrum"` mode actually render frequency-based output and close the phase with regression-safe validation.

**Demo/Validation**:
- `waveform` mode shows time-domain motion
- `spectrum` mode shows frequency-driven vertical heat map or bar-strip output
- seek and pause update immediately in both modes

### Task 5.1: Implement Spectrum Draw Path
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Use `getByteFrequencyData` to render a vertical spectrogram-ready heat map or banded frequency surface without introducing artifacts or new persistence.
- **Complexity**: 6/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - when the live branch owns the canvas and no spectrogram artifact/static fallback is currently winning, `"spectrum"` no longer falls back to waveform
  - output is frequency-shaped, not merely recolored waveform
  - the draw path is cheap enough for realtime preview usage
- **Validation**:
  - targeted spectrum-mode regression with fake analyser data

### Task 5.2: Expand Laboratory Truth Regressions
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add coverage for:
  - live waveform draw during playback
  - paused/throttled rendering
  - visibility pause/resume
  - seek refresh behavior
  - spectrum-mode render path
  - destroy cleanup and listener teardown
- **Complexity**: 6/10
- **Dependencies**: Sprints 2-5
- **Acceptance Criteria**:
  - regressions protect the new runtime controller behavior
  - artifact-first and decoded-waveform fallback tests keep passing where their contract is unchanged
  - spectrum-specific tests that currently encode waveform fallback semantics are intentionally updated only for the live-branch path
  - no store-state assertions are added for runtime-only render internals
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.3: Close Build And Parity Loop
- **Location**: `data/rooms/laboratory/*`, `config/rooms.json` via build/install sync
- **Description**: Refresh generated/shipped Laboratory outputs and rerun parity-sensitive suites.
- **Complexity**: 3/10
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - workspace build output matches source changes
  - installed room parity is restored after runtime module addition
  - no unexpected drift appears in unrelated Laboratory packages
- **Validation**:
  - `npm run rooms:build`
  - `installFromWorkspace('laboratory')`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`

## Testing Strategy
- Keep the existing visualizer truth suite as the primary regression surface
- Add unit-style fake `AudioContext` / `AnalyserNode` / `CanvasRenderingContext2D` coverage instead of relying on browser-only smoke tests
- Validate both source kinds:
  - audio source
  - video source with embedded audio
- Validate both preview modes:
  - single preview
  - dual preview linked audio
- Validate both visualization modes:
  - `waveform`
  - `spectrum`
- Validate teardown scenarios:
  - source change
  - destroy after stop
  - repeated play/pause cycles
  - hidden-tab transitions

## Potential Risks & Gotchas
- `workspace-audio-focus.ts` is not the true owner seam. Implementing there would split lifecycle ownership and likely miss rerender-safe media lookup.
- `createMediaElementSource()` is sensitive to reuse. The controller must avoid accidental duplicate source-node creation during rerenders or source churn.
- A minimal public controller API is fine, but only if the owner seam explicitly tracks binding epochs and decides when controller recreation is safe.
- The current timeline visualizer already handles artifact image rendering and decoded static waveform fallback. Replacing too much at once risks regressing artifact-first behavior.
- The live branch currently owns audio-source rerouting as well as drawing. If extraction moves only pixels and not routing, artifact/static handoff can regress even while the canvas still paints.
- `spectrum` already exists as a persisted UI mode. Renaming it to `spectrogram` in this phase would create unnecessary hydrate and compatibility churn.
- Selector-level artifact preference for `"spectrum"` can stay unchanged. The intended behavior shift is only in the live fallback branch when no renderable spectrogram artifact is winning.
- Hidden-tab and pause throttling must not leave the controller permanently stalled after resume.
- The render loop must stay runtime-only. Do not leak frame ids, analyser buffers, or visibility flags into store state.
- Build/parity drift is likely after adding the new runtime file. The generated room output and installed room copy must be refreshed before parity conclusions are trusted.

## Rollback Plan
- Keep the extraction incremental so the old live analyzer path can be restored by reverting:
  - `rooms/laboratory/runtime/lab-audio-visualizer.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
  - any minimal export wiring updates in `lab-waveform-timeline.ts`
- If spectrum mode destabilizes the phase, keep the runtime module merged with waveform-only support and leave `spectrum` routed to a safe fallback temporarily
- If parity/build output drifts unexpectedly, revert source changes first, then regenerate installed outputs from the restored workspace copy
