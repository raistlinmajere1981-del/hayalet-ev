# Plan: Laboratory Preview Audio Focus Playback

**Generated**: 2026-04-24
**Estimated Complexity**: High

## Overview
Bind the existing Audio Focus controls to preview playback only, so `Gain`, `Filter`, `Cutoff`, `Resonance`, and the existing EQ band sliders change what the user hears in the Laboratory preview without affecting analysis, export, artifact generation, or persisted run behavior.

This phase is intentionally preview-only:
- no analysis pipeline changes
- no asset/export behavior changes
- no new store fields
- no `run-controller` edits

Current codebase notes:
- input controls already write to `workspace-audio-updated` and persist in `ui.workspace.audioFocus`
- `lab-run-controller.ts` already calls `workspaceAudioVisualizer.sync()` on every store update, so preview param updates can piggyback on the existing owner seam
- realtime preview audio currently routes as `mediaElementSource -> analyser -> destination`
- the repo already has a 5-band parametric EQ state shape in `LabAudioFocusSettings.eqBands`; this plan should reuse that instead of inventing a new 3-band store contract
- the current live-preview owner is `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`, not `workspace-audio-focus.ts`

## Prerequisites
- Current realtime visualizer phase is already merged
- Existing preview media preservation contract remains unchanged:
  - `audio[data-lab-preserve-media="workspace-preview"]`
  - `audio[data-lab-preserve-media="workspace-preview-dual-audio"]`
  - `video[data-lab-preserve-media="workspace-preview"]`
- Existing truth suite already covers the live visualizer runtime and owner seam

## Assumptions
- Preview param updates will be pulled via the existing `sync()` loop, not pushed through a new event bus path
- `LabWaveformTimelineModel` may be extended to carry an `audioFocus` snapshot because that is selector/view-model data, not persisted store shape
- The public runtime controller surface can remain `start()`, `stop()`, and `destroy()`; preview settings can arrive through constructor options or internal owner-driven refresh logic
- `filterType: "none"` must not force graph rebuild churn; it should be represented as a neutral/bypassable state inside the existing graph ownership model
- EQ should use the existing `eqBands` array and clamp/apply it per band, rather than collapsing state into a lossy low/mid/high abstraction

## Sprint 1: Expose Preview Audio Focus To The Owner Seam
**Goal**: Make the existing preview owner seam aware of current audio focus settings without touching `run-controller`.

**Demo/Validation**:
- Timeline model contains the active preview audio focus snapshot
- No playback behavior changes yet
- Types compile without changing store persistence or run logic

### Task 1.1: Extend The Timeline View Model With Audio Focus Snapshot
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-types.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add an optional `audioFocus` field to `LabWaveformTimelineModel` and populate it from existing `state.ui.workspace.audioFocus`.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - no store schema changes
  - no reducer changes
  - `getWaveformTimelineModel(state)` returns the current audio focus snapshot
  - existing render callers continue to compile
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Keep The Preview Control Panel As A Pure UI Surface
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`
- **Description**: Verify the control panel remains render-only and does not become a graph owner or media binder.
- **Complexity**: 1/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - no media binding logic moves into the panel component
  - no direct audio node logic is introduced in this file
- **Validation**:
  - code review against current render-only role

## Sprint 2: Expand The Runtime Preview Audio Graph
**Goal**: Upgrade the runtime visualizer from analyser-only routing into a stable preview-processing chain that can be parameter-updated without rebuilding the graph.

**Demo/Validation**:
- The runtime controller can apply gain/filter/EQ params to the live preview chain
- Playback graph is stable across param changes

### Task 2.1: Add Stable Processing Nodes To The Shared Audio Graph
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Extend the cached graph to include:
  - `GainNode`
  - one primary `BiquadFilterNode`
  - a reusable EQ filter chain derived from existing `eqBands`
  - `AnalyserNode`
- **Complexity**: 6/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - graph creation still happens once per media element binding epoch
  - no per-frame node allocation
  - `MediaElementAudioSourceNode` reuse rules stay intact
  - node disconnect/teardown remains idempotent
- **Validation**:
  - targeted runtime tests with fake node graph primitives

### Task 2.2: Replace The Live Route With A Preview Processing Chain
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Change the live path from `source -> analyser -> destination` to a stable preview chain such as:
  - `source -> gain -> filter -> eqBand1 -> eqBand2 -> ... -> analyser -> destination`
- **Complexity**: 7/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - preview audio is heard through the processing chain
  - waveform/spectrum rendering still samples from the processed preview path
  - no duplicate/double-audio route is introduced
  - fallback destination routing still exists for teardown/release
- **Validation**:
  - runtime tests for graph connection order
  - manual smoke: preview remains audible after graph activation

### Task 2.3: Define Neutral/Bypass Behavior Without Rebuilding Nodes
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Represent disabled processing states without graph recreation:
  - `gain` neutral at `1`
  - `filterType: "none"` mapped to a neutral filter state or bypassable routing policy that does not recreate the graph on every toggle
  - EQ band `gain: 0` acts as neutral
- **Complexity**: 6/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - switching filter type or disabling filter does not recreate the controller
  - neutral states do not leave stale audible coloration
  - no new store field is introduced to represent bypass
- **Validation**:
  - targeted regression tests for `none -> lowpass -> highpass -> none`

## Sprint 3: Map Existing Workspace Audio Focus State Into Live Node Params
**Goal**: Apply the already-persisted audio focus state to the existing live preview instance in real time.

**Demo/Validation**:
- Moving sliders audibly changes preview playback
- Existing preview instance stays alive across param changes

### Task 3.1: Add Audio Focus Param Normalization And Clamp Helpers
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Implement runtime-only clamp helpers for preview application:
  - gain: `0..3`
  - frequency: `20..20000`
  - Q: `0.1..20`
  - EQ band gain and Q clamped to safe preview ranges derived from the existing UI contract
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - invalid values fail soft and clamp before touching `AudioParam`
  - runtime clamp logic does not mutate store state
- **Validation**:
  - targeted unit-style regression tests

### Task 3.2: Add Smoothed AudioParam Updates
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Apply current focus settings with smoothing:
  - `gainNode.gain.setTargetAtTime(...)`
  - `filterNode.frequency.setTargetAtTime(...)`
  - `filterNode.Q.setTargetAtTime(...)`
  - EQ band node params updated with the same smoothing strategy
- **Complexity**: 5/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - audible zippering/jumps are minimized
  - updates use `audioContext.currentTime`
  - updating params does not schedule graph rebuilds
- **Validation**:
  - runtime tests assert `setTargetAtTime` usage via fake param objects
  - manual smoke: rapid slider drags do not click/pop heavily

### Task 3.3: Feed Audio Focus Snapshot Into The Runtime Controller
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`, `rooms/laboratory/runtime/lab-audio-visualizer.ts`, `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**: Update the owner seam so the current live controller sees the latest `audioFocus` snapshot from the timeline model and refreshes node params on `sync()` without recreating the instance.
- **Complexity**: 7/10
- **Dependencies**: Tasks 1.1, 3.2
- **Acceptance Criteria**:
  - no `run-controller` change is required
  - no new event listener path is added
  - slider updates are reflected by the existing live controller instance
  - source/canvas/media identity reuse still works
  - param application is idempotent across the existing `store.subscribe -> sync()` seam
  - the live controller or owner seam caches the last-applied `audioFocus` snapshot and no-ops unrelated store churn
  - unrelated state updates do not keep rescheduling `setTargetAtTime(...)` ramps or retriggering audible changes
- **Validation**:
  - owner-seam regression tests proving param update does not destroy/recreate the controller
  - owner-seam regression tests proving unrelated store updates do not re-apply unchanged params

## Sprint 4: Preserve Existing Preview Lifecycle And Fallback Semantics
**Goal**: Ensure preview-audio processing does not regress current playback ownership, artifact fallback, or dual-preview behavior.

**Demo/Validation**:
- Playback and fallback behavior matches current expectations
- Preview processing only affects the actively bound preview media

### Task 4.1: Keep Playback Lifecycle Stable Across Pause/Play/Seek
- **Location**: `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Preserve the current controller behavior while keeping processing params active:
  - pause should stop continuous render work
  - play should resume with the current focus settings
  - seek should keep the current focus settings and realtime loop continuity
- **Complexity**: 5/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - playback state preserves current audio focus effect
  - pausing does not reset preview params
  - seeking does not revert to neutral settings
- **Validation**:
  - direct runtime regressions for play/pause/seek with non-default params

### Task 4.2: Preserve Artifact-First And Decoded Fallback Behavior
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
- **Description**: Keep the existing paused/pre-live rendering semantics intact while ensuring preview audio processing only runs when the live branch owns playback.
- **Complexity**: 5/10
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - artifact-first paused fallback is unchanged
  - decoded waveform fallback is unchanged
  - preview audio processing does not spill into static artifact rendering branches
- **Validation**:
  - existing truth regressions around artifact-first and decoded fallback remain green

### Task 4.3: Respect Single And Dual Preview Media Ownership
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`, `rooms/laboratory/runtime/lab-audio-visualizer.ts`
- **Description**: Ensure processing attaches only to the currently selected preview media element, including the dual-preview linked-audio case.
- **Complexity**: 6/10
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - single preview continues to process its active media
  - dual preview continues to bind to the companion audio element when selected
  - no stray processing remains on a stale media element after source churn
- **Validation**:
  - owner-seam regressions for single-preview and dual-preview switching

## Sprint 5: Regression Coverage And Manual Audible Validation
**Goal**: Lock the new preview-only audio behavior behind direct runtime tests, owner-seam tests, and parity validation.

**Demo/Validation**:
- Sliders audibly change preview playback
- All Laboratory regressions remain green

### Task 5.1: Extend Direct Runtime Controller Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add direct `createAudioVisualizer()` coverage for:
  - gain smoothing updates
  - filter type/frequency/Q mapping
  - EQ band node updates
  - clamp behavior
  - pause/play preserving current focus state
- **Complexity**: 6/10
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - direct runtime tests fail if params stop applying to the live graph
  - seek/pause regressions remain covered
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.2: Extend Owner Seam And Preview Integration Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add integration-style coverage proving that `workspace-audio-updated` driven state changes alter preview processing without controller recreation.
- **Complexity**: 6/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - tests show `sync()` updates the active controller params
  - tests cover source churn and dual-preview rebinding
  - tests prove artifact fallback is unaffected while paused
  - tests prove unrelated store updates do not re-apply unchanged preview params
- **Validation**:
  - targeted truth suite

### Task 5.3: Rebuild Installed Copy And Run Laboratory Parity Suite
- **Location**: `data/rooms/laboratory/*`, `config/rooms.json`
- **Description**: Rebuild the workspace room, sync the installed copy, and rerun the existing Laboratory parity/regression set.
- **Complexity**: 3/10
- **Dependencies**: Tasks 5.1, 5.2
- **Acceptance Criteria**:
  - source and installed room copies stay in sync
  - no parity drift remains
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - installed room sync via the existing tsx shell flow that initializes paths, then calls `getRoomPackageManager().installFromWorkspace("laboratory")`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`

### Task 5.4: Manual Audible Smoke Checklist
- **Location**: Laboratory room runtime
- **Description**: Perform a short audible validation pass after tests.
- **Complexity**: 2/10
- **Dependencies**: Task 5.3
- **Acceptance Criteria**:
  - gain slider changes volume immediately
  - cutoff produces an audible filter sweep
  - resonance changes filter character
  - EQ band changes audibly color the preview
  - pause/play resumes with the same focus settings
- **Validation**:
  - manual smoke in the Laboratory workspace

## Testing Strategy
- Start with direct runtime graph tests because this feature’s biggest risk is silent regressions inside the audio node chain
- Keep owner-seam tests focused on:
  - controller reuse
  - param refresh without recreation
  - idempotent no-op behavior on unrelated store churn
  - fallback branch stability
- Reuse the existing truth suite as the main integration safety net
- Finish with the existing 6-file Laboratory parity/regression package and a manual audible smoke pass

## Potential Risks & Gotchas
- `filterType: "none"` has no native `BiquadFilterNode` equivalent.
  - Mitigation: represent it as a neutral preview state or stable bypass strategy without rebuilding the graph on every toggle.
- Reconnecting the source chain on every slider move could cause audible glitches or duplicate audio.
  - Mitigation: keep graph topology stable and update only `AudioParam` values during normal control changes.
- The repo already stores 5 EQ bands, while the request mentioned an optional 3-band EQ.
  - Mitigation: use the existing 5-band state directly and avoid store/schema drift.
- Preview audio processing must not leak into analysis/export expectations.
  - Mitigation: keep all logic inside the preview runtime visualizer and owner seam only.
- Dual preview can bind to a different media element than single preview.
  - Mitigation: preserve the existing media selection order and add rebinding regressions.
- AudioContext resume and smoothing calls can fail softly in browser/autoplay edge cases.
  - Mitigation: retain current fail-soft behavior and retry on the next meaningful playback event.

## Rollback Plan
- Revert `rooms/laboratory/runtime/lab-audio-visualizer.ts` to analyser-only routing
- Remove the `audioFocus` snapshot from `LabWaveformTimelineModel`
- Revert owner-seam changes in `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
- Revert test additions in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- Rebuild the installed Laboratory copy so `data/rooms/laboratory/*` and `config/rooms.json` return to the previous state
