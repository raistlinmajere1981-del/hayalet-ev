# Plan: Laboratory Audio Visualization Artifact Binding

**Generated**: 2026-04-24
**Estimated Complexity**: Medium

## Overview
Bind analysis-generated audio visualization artifacts to the existing Laboratory audio preview canvas so the workspace can show a generated waveform or spectrogram when one already exists, while falling back to the current live analyser waveform when no artifact is available.

The implementation should stay selector-driven and non-blocking:
- no new backend logic
- no artifact copy merged into UI state
- artifact lookup only through selectors
- canvas rendering should prefer generated artifact output when present
- live analyser remains the fallback path

Current repo seams already support most of the feature:
- `rooms/laboratory/main-functions/audio-analysis/host/process-runner-support.ts` already generates `waveform` and `spectrogram` PNG artifacts.
- `rooms/laboratory/runtime/lab-store.ts` already normalizes run artifacts into `LabArtifactProjection` / `LabPreviewArtifactProjection`.
- `rooms/laboratory/runtime/lab-selectors.ts` already exposes run and preview artifact selectors.
- `rooms/laboratory/ui/workspace-audio-focus.ts` already owns the `#lab-audio-viz` canvas and the live waveform renderer.

The plan therefore focuses on adding a selector-backed artifact preference layer in front of the existing live analyser, not on inventing new data plumbing.

For v1, the safest codebase-aligned assumption is:
- render only artifacts that already arrive with a loadable `previewUrl` / `fileUrl` in the projected run state
- do not invent a new renderer-side file-path loading seam as part of this task
- if a fresh live event carries only a raw filesystem `path`, keep the current fallback canvas behavior until the next snapshot/hydration provides a loadable preview URL

## Prerequisites
- Generated audio visualization artifacts continue to arrive as projected run artifacts with `kind`, `previewUrl`, `path`, `createdAt`, `moduleId`, and `metadata`.
- Current host generation for waveform/spectrogram appears to land in `run.artifacts`; `run.previewArtifacts` should be treated as secondary/future-compatible input unless code inspection proves otherwise during implementation.
- `waveform` and `spectrogram` remain the canonical artifact kinds for this feature.
- The active source can be resolved through the existing source selector chain; no new state fields are introduced for artifact binding.
- Workspace source of truth remains `rooms/laboratory/*`; installed copies under `data/rooms/laboratory/*` are not peer edit targets.
- Live event payloads may expose only raw artifact `path` values before snapshot projection enriches them into loadable `previewUrl`/`fileUrl` values, so immediate renderability must be treated as conditional.

## Sprint 1: Selector Contract for Audio Visualization Artifacts
**Goal**: Expose one deterministic selector that returns the best current visualization artifact for the active source/run without mutating state.
**Demo/Validation**:
- A new selector returns either a single artifact projection or `null`.
- The selector result changes correctly when source, run, or visualization mode changes.
- The selector never writes to state or caches artifact content locally.

### Task 1.1: Audit the Existing Artifact Projection Chain
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/models/lab-types.ts`
- **Description**: Confirm where waveform/spectrogram artifacts live today:
  - `run.artifacts`
  - `run.previewArtifacts`
  - projection fields such as `kind`, `previewUrl`, `path`, `createdAt`, `moduleId`, `reference`, and `metadata`

  Record how active source identity is resolved so selector matching stays scoped to the current workspace source.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - The implementation path explicitly identifies which artifact collection is the primary source of truth.
  - The plan documents how active source/run scoping will be enforced.
- **Validation**:
  - Targeted code inspection
  - Optional selector regression fixture review

### Task 1.2: Add `getAudioVisualizationArtifact(state)`
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Implement a selector that returns the best artifact for the current workspace audio visualization. Recommended selection order:
  1. Resolve the current visualization mode from `state.ui.workspace.audioFocus.visualizationMode`
     - if mode is `none`, return `null`
  2. Resolve the active source/run context
  3. Filter candidate artifacts to `kind === "waveform"` and/or `kind === "spectrogram"`
     - for v1 renderability, prefer candidates that already expose `previewUrl` or `fileUrl` through projection
  4. Prefer the artifact kind that matches the current visualization mode:
     - `waveform` mode -> prefer waveform
     - `spectrum` mode -> prefer spectrogram
  5. If the preferred kind is missing, fall back to the other supported kind
  6. Break ties primarily by latest `createdAt`, then by explicit `active === true` hints if they differ, then by stable artifact order

  The selector should return only existing projected artifact objects; it must not derive or persist a new artifact shape into state.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Returns `null` when no eligible visualization artifact exists.
  - Returns `null` when workspace visualization mode is `none`.
  - Ignores unrelated artifact kinds.
  - Treats raw `path`-only artifacts as non-renderable in v1 unless an already-supported loadable URL is present in projection.
  - Uses only selector/state reads; no reducer or store-shape change is introduced.
  - Deterministic preference rules are documented in code/tests.
- **Validation**:
  - Add targeted selector tests in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 1.3: Lock the Selector with Source/Run Relevance Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add focused cases that prove the selector:
  - chooses the latest waveform for waveform mode
  - chooses the latest spectrogram for spectrum mode
  - falls back cleanly when the preferred artifact kind is absent
  - prefers loadable projected artifacts over raw `path`-only candidates
  - scopes to the current run and current visualization mode contract without assuming new cross-run or per-source state seams that do not exist today
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Tests fail if selection order becomes ambiguous within the current run contract.
  - Tests cover both waveform and spectrogram preferences.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

## Sprint 2: Artifact-First Canvas Rendering
**Goal**: Teach the audio focus canvas to render a generated artifact before attempting live analyser playback.
**Demo/Validation**:
- If a visualization artifact exists, the canvas shows it.
- Live waveform initialization is skipped while artifact rendering is active.
- The UI remains responsive and does not block on image loading.

### Task 2.1: Extend the Audio Visualizer Helper Contract
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Expand the existing visualizer helper contract so it can read the currently selected artifact through a callback supplied by the controller, for example:
  - `getVisualizationArtifact(): LabArtifactProjection | LabPreviewArtifactProjection | null`

  Keep the existing controller-owned sync loop intact; only add the minimum callback/data needed for artifact-first behavior.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `workspace-audio-focus.ts` does not pull store state directly.
  - The controller remains the integration seam that passes selector-derived values into the visualizer.
  - No backend or reducer changes are introduced.
- **Validation**:
  - Diff review of helper/controller responsibilities

### Task 2.2: Render Artifact Imagery into `#lab-audio-viz`
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`
- **Description**: Add a non-blocking artifact render path ahead of the live analyser path. For v1, the most realistic source is artifact image rendering via `previewUrl` or `path` because current generated waveform/spectrogram outputs are PNG files.

  Suggested behavior:
  - Resolve the current artifact via callback
  - If artifact exists and already has a loadable `previewUrl` / `fileUrl`, start async image loading
  - When the image finishes loading, draw it into the prepared canvas
  - Preserve current canvas sizing and HiDPI handling
  - If a candidate exists but has only raw `path`, treat it as not yet renderable and leave fallback behavior in place until projection supplies a loadable URL
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Artifact rendering does not block attach/sync paths.
  - Canvas draw uses async image loading rather than synchronous file reads.
  - The rendered artifact respects current canvas dimensions.
  - The helper can handle both waveform and spectrogram image artifacts.
  - V1 does not add a new path-to-URL bridge in the renderer just to draw raw artifact files.
- **Validation**:
  - Focused helper/controller tests with fake image loading and canvas assertions

### Task 2.3: Disable Live Analyser While Artifact Rendering Is Active
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`
- **Description**: When a valid artifact is available for the current mode/source, short-circuit the live analyser path:
  - do not initialize `AudioContext`
  - do not create the media source node
  - do not schedule the waveform animation loop

  This should apply both on initial sync and on subsequent store updates while the artifact remains the chosen display source.
- **Complexity**: 4
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Artifact presence prevents live analyser startup.
  - Existing analyser resources are stopped/cleared when switching from live mode to artifact mode.
  - No audible playback regression is introduced when the artifact path is active.
- **Validation**:
  - Regression coverage proving zero `AudioContext` construction when a selector-supplied artifact is present

### Task 2.4: Reconcile the Spectrum Copy and Test Contract
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Update the current UI copy/test contract so `spectrum` no longer implies waveform-only behavior once spectrogram artifacts are actually supported. Options should be decided explicitly:
  - keep fallback-oriented wording only when no spectrogram artifact is renderable
  - or update the label/hint to artifact-aware wording and adjust the existing regression accordingly

  The plan should not leave the current `Spectrum (Waveform Preview)` contract ambiguous.
- **Complexity**: 3
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - UI copy matches real runtime behavior.
  - Existing spectrum-copy regression is updated intentionally rather than breaking as collateral damage.
- **Validation**:
  - Targeted UI regression update in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

## Sprint 3: Fallback and Update Lifecycle
**Goal**: Keep the feature resilient as artifacts appear later, disappear, or fail to load.
**Demo/Validation**:
- Missing artifact -> existing live waveform fallback still works.
- New artifact arriving on a later run/store update replaces live waveform with artifact rendering.
- Stale or failed artifact loads do not paint the wrong source onto the canvas.

### Task 3.1: Preserve Existing Live Waveform as the Fallback Path
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`
- **Description**: If selector returns `null`, or if the artifact cannot be rendered because no usable projected preview URL is available, continue with the current live analyser implementation unchanged. Also define the re-entry rule for the already-playing case:
  - initial live analyser creation still stays gated by user playback
  - if artifact mode exits while the same media is still playing and the session has already been user-activated, the helper may perform a safe catch-up activation during sync so the canvas does not stay frozen waiting for another `play` event
- **Complexity**: 3
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - No artifact means no behavior regression versus the current implementation.
  - Artifact load failure does not leave the canvas blank forever; the helper reverts to idle or live waveform as appropriate.
  - Artifact removal while media is already playing can recover to live waveform without requiring a manual replay toggle.
- **Validation**:
  - Helper regression tests for missing/invalid artifact cases

### Task 3.2: Re-render on Artifact Arrival Without New State Fields
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/workspace-audio-focus.ts`
- **Description**: Leverage the existing store subscription in the controller so that when a new artifact is projected into the active run, the visualizer helper sees the updated selector result and re-renders the canvas. Scope this carefully to current code reality:
  - immediate re-render is guaranteed only when the projected artifact already exposes a loadable `previewUrl` / `fileUrl`
  - if a live event adds only a raw `path`, the helper should continue fallback behavior until a later snapshot/hydration exposes a loadable URL

  Do this without adding any new `ui.workspace` or run-level artifact binding fields.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - A later arriving loadable artifact replaces the live waveform on the next sync cycle.
  - No dedicated artifact cache field is added to store state.
  - Switching source/run clears obsolete artifact render state.
- **Validation**:
  - Controller regression that simulates artifact arrival after initial fallback-to-live mode

### Task 3.3: Guard Against Async Race Conditions
- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`
- **Description**: Protect the canvas from stale async image loads. If source, mode, or selected artifact changes while an image is still loading, the old load completion must not overwrite the newer canvas state.
- **Complexity**: 5
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Stale image loads are ignored safely.
  - Switching from spectrogram to waveform mode (or vice versa) does not briefly paint the wrong artifact.
  - Cleanup remains non-blocking.
- **Validation**:
  - Targeted race-condition helper tests with delayed image completion

## Sprint 4: Regression Safety and Final Verification
**Goal**: Prove artifact-first behavior without destabilizing the current live waveform path.
**Demo/Validation**:
- Selector tests prove correct artifact preference rules.
- Controller/helper tests prove artifact-first behavior and live fallback.
- Typecheck and targeted tests pass.

### Task 4.1: Add End-to-End Controller-Level Regression Coverage
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Extend the current controller harness to verify:
  - artifact present at attach time -> canvas renders artifact, no live analyser init
  - no artifact at attach time -> live path remains available after play
  - artifact arrives after initial live fallback -> artifact render replaces live loop on sync when a loadable projected URL is present
  - artifact mode exits or load fails while media is already playing -> live waveform can resume without a second manual play event
- **Complexity**: 5
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - Tests cover real controller wiring, not just helper internals.
  - No-analysis fallback and artifact-first path both stay green.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.2: Final Non-Blocking and No-State-Expansion Verification
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/ui/workspace-audio-focus.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Confirm the implementation still respects the request:
  - selector-only reads for artifact choice
  - no artifact merged into store/UI state
  - no blocking fetch/read path in the sync loop
  - live analyser preserved only as fallback
- **Complexity**: 2
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - No store shape change is required.
  - No reducer changes are needed solely for artifact binding.
  - Sync/render logic remains responsive.
- **Validation**:
  - `npm run rooms:typecheck`
  - Targeted diff review of selector/helper/controller seams

## Testing Strategy
- Start with selector tests because artifact preference rules drive the rest of the feature.
- Reuse the existing controller and visualizer test harness instead of building a separate UI-only suite.
- Add image-loading fakes/mocks rather than introducing real file I/O into tests.
- Budget explicit harness work for `Image` / `drawImage` behavior because current fake canvas coverage is waveform-only.
- Keep verification targeted:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:typecheck`
- If runtime/manual validation becomes necessary later, verify both:
  - artifact exists -> generated image is shown
  - artifact missing -> live waveform still works after play

## Potential Risks & Gotchas
- The requested selector has no explicit mode parameter, so it must intentionally read visualization mode from state to avoid returning a spectrogram while waveform mode is active.
- Host-generated artifacts currently appear to be PNG files, so “render image/data into canvas” should likely start with image rendering rather than inventing a new metadata payload shape.
- Artifact collections may live in both `run.artifacts` and `run.previewArtifacts`; implementation should explicitly prefer `run.artifacts` for generated analysis output unless inspection uncovers a stronger existing contract.
- Artifact `path` may exist without a browser-loadable `previewUrl`; the plan should assume `previewUrl` is preferred and treat raw filesystem paths as non-renderable in v1 unless the room runtime already has a safe existing URL seam.
- Async image loading can race with source swaps or later artifacts; stale load completions must be ignored.
- The feature must not silently reintroduce artifact data into state through cached canvas payloads or selector memo state.
- If artifact rendering fully replaces the canvas while playback is active, the UI should still remain understandable when audio is playing but no live waveform is visible.
- The current live analyser lifecycle is play-gated, so artifact-to-live fallback while media is already playing needs an explicit catch-up rule rather than an implicit assumption.

## Rollback Plan
- Revert the new selector in `rooms/laboratory/runtime/lab-selectors.ts`.
- Remove artifact-first logic from `rooms/laboratory/ui/workspace-audio-focus.ts`.
- Restore controller wiring so the canvas only uses the existing live waveform path.
- Remove artifact-specific regressions if the feature is backed out completely.
