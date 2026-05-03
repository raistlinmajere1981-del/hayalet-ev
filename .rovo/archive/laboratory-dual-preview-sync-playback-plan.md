# Plan: Laboratory Dual Preview Sync Playback

**Generated**: 2026-04-23
**Estimated Complexity**: High

## Overview

Extend the Laboratory workspace preview so a video source can optionally open in a dual-preview mode with a linked extracted audio asset. The implementation should keep the video preview as the dominant surface, render a minimal audio companion pane, and synchronize playback through a single shared transport where video is the master clock and audio is the slave.

This plan builds directly on the linked-audio lineage work that already exists:

- `getLinkedAudioAssets()` can resolve audio children for the current source.
- Audio extract assets already carry `derivedFromSourceId`, `derivedFromAssetId`, `metadata.durationMs`, and `metadata.startOffsetMs`.
- `workspace-surface.ts` already owns the preview markup.
- `lab-run-controller.ts` already owns DOM actions and preview/timeline interaction.
- `lab-root.ts` preserves media DOM nodes when `data-lab-preserve-media` and `src` stay stable, which is important for sync continuity.

The requested `useState(false)` shape is adapted to the real Laboratory architecture:

- The workspace is not React-hook based.
- Dual-preview state should live in `LabWorkspaceUiState` plus reducer events, not as local `useState`.

In scope:

- Add workspace state for dual-preview mode and selected linked audio.
- Add a dual-preview entry action for the active source.
- Render split preview layout: video dominant, audio companion.
- Add a lightweight audio visualization panel in the audio side.
- Add a shared control bar for play, pause, seek, and volume.
- Implement master/slave playback sync with drift correction and offset support.
- Handle linked-audio swaps without breaking the current video timeline.

Out of scope:

- True waveform rendering
- Separate audio-only and video-only transport bars in dual mode
- Timeline editing semantics beyond playback/seek sync
- Multi-audio simultaneous playback
- Real-time DSP or production-grade loudness metering

## Research Notes

- `rooms/laboratory/ui/workspace-surface.ts` renders the current workspace preview as static markup and already exposes a linked-audio bar above the preview.
- `rooms/laboratory/ui/lab-root.ts` performs DOM diffing and preserves media elements when tag name, `data-lab-preserve-media`, and `src` all match. Dual-preview work must respect this behavior or playback state will reset on every render.
- `rooms/laboratory/models/lab-types.ts` and `rooms/laboratory/runtime/lab-store.ts` already persist `ui.workspace.*` state through hydration and local persistence. New dual-preview state can follow the same pattern.
- `rooms/laboratory/runtime/lab-run-controller.ts` already handles preview actions, focus actions, and timeline drag updates; it is the correct seam for media transport orchestration.
- `rooms/laboratory/ui/workspace-audio-focus.ts` already contains a visualization setting and canvas placeholder, but no runtime drawing path is currently wired. A lightweight mock/level-meter style preview can either reuse this concept or add a smaller preview-local visualization for dual mode.
- `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts` is the natural place for incremental dual-preview UI assertions because it already covers the linked-audio preview seam.
- `scripts/tests/laboratory-source-ui-regressions.test.ts` remains unreliable on the current baseline and should not be the only acceptance gate unless separately repaired.

## Assumptions

- Dual preview v1 applies only when the active source kind is `video` and there is at least one linked audio asset.
- The default selected linked audio in dual mode is the first item returned by `getLinkedAudioAssets()`, which is already deterministically ordered.
- `metadata.startOffsetMs` is present on linked audio assets when known; otherwise v1 treats it as `0`.
- In dual mode, the video element remains the master player; the audio element never drives canonical time.
- If the audio element cannot autoplay because of browser policy, the controller should recover by retrying after the user’s next explicit play interaction rather than exiting dual mode.
- The initial audio visualization can be synthetic or metadata-driven. It does not need to read PCM samples.
- When the selected linked audio changes, the new audio element should inherit the current video timeline position and paused/playing state.

## Prerequisites

- Repo workflow for this planning session is `workflow:terminal-mode` because `npm run mode:status` returned `terminal` and `npm run whereami` returned `effectiveMode: other-provider-cli`.
- Use the workspace source files under `rooms/laboratory/...` as the only source of truth.
- Keep `data/rooms/laboratory/...` generated; refresh it only through room build/install flow after implementation.
- Plan acceptance should rely on targeted Laboratory suites, not only on the already-red `laboratory-source-ui-regressions.test.ts`.

## Sprint 1: Workspace State and Selection Seams

**Goal**: Add first-class workspace state for dual preview and linked audio selection so the UI can switch modes without implicit DOM-only hacks.

**Demo/Validation**:

- The store can toggle dual preview on/off.
- The selected linked audio asset id persists through render cycles and hydration.
- Turning dual preview off falls back to the current single-preview surface.
- Project/source churn clears stale dual-preview state before it reaches the UI.

### Task 1.1: Extend Workspace UI State for Dual Preview

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/ui/lab-root.ts`
- **Description**: Add new persisted workspace state such as:
  - `dualPreviewEnabled: boolean`
  - `dualPreviewAudioAssetId: string | null`
  - optional shared transport state if the UI needs it later, but keep v1 minimal and DOM-driven when possible
  Update initial state, hydrate flow, and persistence read/write so the new fields survive rerenders and session restore.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Workspace state supports dual mode without local component state.
  - Hydration does not drop the new fields.
  - Older persisted state still loads safely.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-state-persistence-v2-regressions.test.ts`
  - targeted reducer assertions in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 1.2: Add Reducer Events for Dual Preview and Linked Audio Selection

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add atomic events for:
  - enabling/disabling dual preview
  - selecting the active linked audio asset
  - optionally forcing dual preview off when the source changes or no linked audio remains
  Wire controller actions so the UI can toggle the mode explicitly instead of coupling mode changes to render-only conditions.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Toggle and selection events are independently dispatchable.
  - Invalid linked audio ids degrade to `null` or close dual mode safely.
  - Source changes can clear stale linked selection when needed.
- **Validation**:
  - reducer tests in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 1.3: Add Selectors for Active Dual Preview Audio Resolution

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add selector helpers that resolve:
  - whether dual preview is available for the current source
  - the currently selected linked audio asset
  - the fallback/default linked audio asset when a stored selection is stale
  Keep resolution logic centralized so `workspace-surface.ts` and the controller do not duplicate lineage checks.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Selectors return `null` cleanly when the source is not video or no linked audio exists.
  - A stale selected id falls back deterministically to the first linked audio asset.
  - UI code can render dual preview decisions without custom asset filtering.
- **Validation**:
  - selector coverage in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 1.4: Heal Dual Preview State During Snapshot and Source Churn

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Update the snapshot/source normalization paths so dual-preview state does not survive invalid project or source transitions. Cover:
  - `syncCanonicalStateFromSnapshot(...)`
  - `source-config-patched`
  - any source-ready/source-failed transitions that should force dual mode off or clear stale selected audio ids
- **Complexity**: 6
- **Dependencies**: Tasks 1.1, 1.2
- **Acceptance Criteria**:
  - Switching projects or sources cannot leave an orphaned dual-preview audio selection behind.
  - Dual mode closes automatically when the current source is no longer eligible.
  - Valid selections are retained only when they still belong to the active source.
- **Validation**:
  - reducer/hydrate coverage in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - project/source churn coverage in `scripts/tests/laboratory-project-management-regressions.test.ts`

## Sprint 2: Dual Preview Layout and Entry UX

**Goal**: Make dual mode discoverable and render a stable split layout that keeps the video visually dominant.

**Demo/Validation**:

- A source with linked audio shows `Ses ile birlikte aç`.
- Enabling dual mode switches the preview into a split layout.
- The left video pane remains the dominant surface; the right audio pane is smaller and more minimal.

### Task 2.1: Add Dual Preview Entry Actions to the Linked-Audio Surface

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Extend the existing linked-audio bar with a dedicated action such as `workspace-open-dual-preview`. The action should use the resolved default linked audio asset and enable dual mode explicitly.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The trigger renders only for eligible video sources with linked audio.
  - The action does not reuse `asset-preview`, because dual preview is an in-workspace mode, not an external open action.
  - Clicking the trigger enables dual preview and resolves a selected linked audio asset id.
- **Validation**:
  - UI assertions in `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - controller action regression in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 2.2: Render a Split Preview Shell

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Refactor preview rendering so `renderWorkspaceSurface()` can render:
  - current single-preview mode
  - dual-preview mode with a structured split shell
  The split shell should include:
  - dominant video pane
  - minimal audio pane
  - stable element keys / `data-lab-preserve-media` usage so both media nodes survive rerenders when sources do not change
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The layout is responsive and remains usable on narrower screens.
  - Video remains visually primary.
  - Single-preview mode markup remains intact for non-dual states.
- **Validation**:
  - targeted UI markup checks in `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`

### Task 2.3: Add Linked Audio Switching UI Inside Dual Mode

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: When multiple linked audio assets exist, add a compact selector or chip row in the audio pane so the user can swap the active audio asset without leaving dual mode.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Single linked audio asset does not show unnecessary switching UI.
  - Selecting another audio asset updates workspace state, not just DOM.
  - Selection changes do not replace the active video preview.
- **Validation**:
  - UI regression coverage in `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - reducer/controller coverage in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 2.4: Re-scope ROI Overlay to the Video Pane

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/workspace-roi-overlay.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Refactor ROI overlay placement so it binds to a dedicated video-pane container instead of assuming the full `#lab-workspace-preview` area. This keeps ROI affordances aligned after the preview splits into video/audio panes.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - ROI overlay remains aligned only over the video pane in dual mode.
  - Single-preview ROI behavior remains unchanged.
  - Audio pane never receives ROI hit targets or overlay chrome.
- **Validation**:
  - targeted UI markup/assertion coverage in `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`

## Sprint 3: Shared Transport and Sync Engine

**Goal**: Implement a single transport where video is the master timeline and linked audio is kept in sync for play, pause, seek, and swap flows.

**Demo/Validation**:

- Play starts both media elements together from the same timeline.
- Pause stops both.
- Seek updates audio to the corresponding timeline with offset.
- Drift over the tolerance threshold is corrected automatically.

### Task 3.1: Introduce a Preview Media Resolver in the Controller

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add controller helpers that locate and safely cast the active dual-preview video and audio elements. Use explicit DOM selectors or `data-lab-role` attributes so media orchestration does not depend on brittle tree structure.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Controller can resolve master/slave media elements or fail safely.
  - Missing elements surface warnings or no-ops, not crashes.
  - Resolver logic is reusable across play, pause, seek, and drift correction.
- **Validation**:
  - controller-focused assertions in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 3.2: Implement Master/Slave Sync Math With Offset Support

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, optionally `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Centralize sync math:
  - master = video current time
  - slave target = `video.currentTime + startOffsetMs / 1000`
  - drift tolerance = `0.2s`
  Add a helper that applies seek/resync only when drift exceeds tolerance or when a forced sync event occurs.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Offset is applied consistently in seconds.
  - Missing offset metadata behaves as zero.
  - Small drift does not cause constant corrective jitter.
  - Large drift triggers a deterministic resync path.
- **Validation**:
  - runtime/controller regressions in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 3.3: Wire Play, Pause, Seek, and Timeupdate Sync Events

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Attach DOM listeners for:
  - play / pause
  - seeking / seeked
  - timeupdate
  - loadedmetadata
  - ended
  Ensure video remains the only source of authoritative transport intent, while audio mirrors state.
- **Complexity**: 8
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Video play starts audio playback after syncing target time.
  - Video pause pauses audio.
  - Seek updates audio current time immediately.
  - Metadata load on either element does not race into invalid seeks.
  - Ended state does not leave the paired element playing.
- **Validation**:
  - DOM/controller regressions in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 3.4: Handle Linked Audio Swaps Without Timeline Breakage

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: When the selected linked audio changes in dual mode:
  - set the new audio `src`
  - wait for metadata readiness if needed
  - sync audio to the current video timeline plus offset
  - preserve paused/playing state from the master video
- **Complexity**: 6
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Swapping audio does not reset or replace the video element.
  - The new audio snaps to the current video time.
  - If the master video is paused, the new audio stays paused after resync.
- **Validation**:
  - controller regression coverage in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 3.5: Fence the Existing Analysis Timeline Seek Path in Dual Mode

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Update the current `timeline-seek` path so it no longer blindly sets `currentTime` on every `.labx-preview-media` element during dual mode. Decide and implement one of these v1-safe behaviors:
  - ignore analysis timeline seeks for transport in dual mode
  - or route timeline seeks through the master/slave sync helper with offset-aware audio resync
  The key is to prevent offsetless direct seeks from bypassing the sync engine.
- **Complexity**: 6
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Dual mode cannot accidentally seek audio and video independently through the old broad selector path.
  - Analysis timeline semantics stay distinct from the shared transport bar.
  - Single-preview timeline behavior remains intact outside dual mode.
- **Validation**:
  - controller regression coverage in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

## Sprint 4: Shared Control Bar and Lightweight Audio Visualization

**Goal**: Replace split native transport behavior in dual mode with a shared control surface and a minimal audio identity panel.

**Demo/Validation**:

- Dual mode shows one control bar for play/pause, seek, and volume.
- The audio pane shows a simple visualization that reinforces “separate audio, same timeline”.
- The control bar operates on the video master and updates the audio slave implicitly.

### Task 4.1: Add a Shared Dual-Preview Control Bar

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Render a dedicated dual-mode control bar with:
  - play/pause toggle
  - shared scrub/seek control
  - shared volume control
  In dual mode, prefer the shared transport instead of exposing two competing native control clusters. Keep this control bar separate from the existing workspace analysis timeline so playback seek does not silently mutate the analysis selection range.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Only one transport bar is visible in dual mode.
  - Transport actions route through controller logic that targets the master video.
  - Volume behavior is defined clearly for v1, ideally controlling the audio slave and optionally muting master video audio if product direction requires it.
- **Validation**:
  - UI/controller tests in `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.2: Add Lightweight Audio Visualization to the Audio Pane

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-theme.css`, optionally `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add a minimal visualization such as static or gently animated level bars. Keep it lightweight:
  - no waveform generation
  - no PCM analysis requirement
  - acceptable to seed from fixed bar values or metadata-derived styling
  The visualization should function as an audio identity cue, not as an analysis instrument.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Visualization renders only in dual mode or where explicitly intended.
  - No heavy runtime dependency is introduced.
  - If animation is used, it degrades safely when the tab or media is paused.
- **Validation**:
  - markup/style assertions in `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`

### Task 4.3: Clarify the Dominant/Companion Visual Hierarchy

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Tune layout ratios, padding, and typography so the UX communicates:
  - “You are still working on the video”
  - “The audio is separately inspectable”
  Keep the audio pane intentionally lighter in visual weight than the video pane.
- **Complexity**: 3
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Video remains visually dominant on desktop.
  - On mobile/narrow widths, the stack order still preserves video priority.
  - Dual mode does not feel like two equal players fighting for attention.
- **Validation**:
  - responsive CSS review plus targeted UI snapshots/assertions where feasible

### Task 4.4: Resolve the Existing AUDIO FOCUS Panel Role

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/workspace-audio-focus.ts`, optionally `rooms/laboratory/ui/lab-theme.css`
- **Description**: Decide how the existing `AUDIO FOCUS` surface behaves when dual preview is active. Options may include:
  - keeping it as advanced processing controls below the preview
  - hiding duplicate visualization/transport affordances in dual mode
  - reusing its lightweight visualization language inside the dual audio pane
  The plan outcome should avoid two competing audio surfaces.
- **Complexity**: 4
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Dual mode has one clear audio companion surface.
  - Existing audio-focus controls do not duplicate the new shared transport.
  - The relationship between preview-level audio UI and advanced processing controls is unambiguous.
- **Validation**:
  - targeted UI assertions in `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`

## Sprint 5: Regression Safety, Build, and Installed Parity

**Goal**: Lock the feature down with targeted regressions and ensure workspace-installed parity still holds.

**Demo/Validation**:

- Targeted runtime, UI, and persistence suites pass.
- Laboratory room build succeeds.
- Installed parity remains green after syncing the built room.

### Task 5.1: Build a Media Test Harness for Controller Sync Coverage

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts` and shared local test helpers if needed
- **Description**: Extend the current controller test setup with fake media elements or a richer DOM harness that can model:
  - `currentTime`
  - `paused`
  - `play()`
  - `pause()`
  - `loadedmetadata`
  - `seeking` / `seeked`
  - `timeupdate`
  This harness work should land before trying to assert sync behavior in depth.
- **Complexity**: 7
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Controller tests can simulate media lifecycle events credibly.
  - Sync assertions no longer rely on a document stub that only records listeners.
  - The harness is reusable for later Laboratory preview features.
- **Validation**:
  - targeted controller test runs

### Task 5.2: Add Dedicated Runtime and UI Regression Coverage

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`, `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`, optionally a new dedicated dual-preview suite if clarity demands it
- **Description**: Cover:
  - dual-preview toggle/select reducers
  - selector fallback behavior
  - dual-preview trigger markup
  - split layout markup
  - ROI video-pane scoping
  - controller sync math
  - play/pause/seek wiring
  - timeline-seek dual-mode fencing
  - linked audio swap continuity
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - All feature-critical seams have automated coverage.
  - Baseline-unrelated red tests are not used as the sole gate.
  - Runtime tests assert failure-safe behavior as well as happy path.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`

### Task 5.3: Add Dedicated Workspace UI Persistence Coverage

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`, `scripts/tests/laboratory-project-management-regressions.test.ts`, and a new dedicated workspace-ui persistence suite if existing files become too noisy
- **Description**: Add or extend regressions for:
  - workspace hydrate merge of dual-preview fields
  - `readPersistableState()` / local persistence coverage if a direct seam is extracted
  - persisted dual-preview state
  - stale selected audio cleanup
  - source change collapsing dual mode when no valid linked audio remains
- **Complexity**: 5
- **Dependencies**: Sprint 1, Sprint 3
- **Acceptance Criteria**:
  - Restored UI state does not point at orphaned audio selections.
  - Invalid dual-preview state heals without crashes.
  - New source selection does not accidentally keep the previous audio slave attached.
- **Validation**:
  - targeted workspace-persistence and hydrate suite runs

### Task 5.4: Build, Sync, and Run Installed Parity

- **Location**: room build/install workflow, installed parity suites
- **Description**: After implementation:
  - run `npm run rooms:typecheck`
  - run targeted Laboratory tests
  - run `npm run rooms:build`
  - sync via `installFromWorkspace('laboratory')`
  - rerun installed parity suites that cover Laboratory UI/runtime bundles
- **Complexity**: 4
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Workspace and installed copies behave consistently.
  - Generated artifacts are refreshed through the supported workflow only.
- **Validation**:
  - `npm run rooms:typecheck`
  - targeted Laboratory suites
  - `npm run rooms:build`
  - installed parity suites currently used for Laboratory room verification

## Testing Strategy

- Favor focused Laboratory suites over global test runs.
- Add reducer/selector tests first so the architectural seams are stable before transport wiring lands.
- Build the media test harness before relying on controller-level DOM tests for sync math and event handling.
- Use controller-level DOM tests for media sync math and event handling instead of relying only on string-markup assertions.
- Keep UI regression coverage separate from the already-red `laboratory-source-ui-regressions.test.ts` baseline unless that file is explicitly repaired in the same effort.
- Cover source/project churn explicitly so dual-preview state healing is not left to incidental snapshot behavior.
- After room build, refresh the installed Laboratory copy and rerun parity suites so generated runtime code does not drift from workspace behavior.

## Potential Risks & Gotchas

- The request uses React `useState`, but Laboratory preview state lives in the store. Implementing local-only state would drift from persistence and controller architecture.
- Source/project churn already rewrites canonical state through snapshot sync and `source-config-patched`. If the feature does not explicitly heal workspace-local dual-preview fields there, stale linked audio state will leak across projects.
- `data-lab-preserve-media` reuse is source-sensitive. If dual-mode markup changes the media tag identity or `src` unexpectedly, the DOM diff layer will replace elements and lose playback state.
- Native media controls are convenient but conflict with the “single control point” UX. The plan should treat them as a fallback outside dual mode, not as the dual-mode primary transport.
- The existing workspace timeline represents analysis selection, not transport position. Reusing it as the dual-player seek bar would blur semantics and create regressions in analysis workflows.
- The current timeline seek action already sets `currentTime` on every `.labx-preview-media` node. Dual mode must explicitly fence or reroute that path, or offset-aware sync will be bypassed.
- ROI overlay currently assumes one full preview rectangle. Split preview requires a pane-scoped overlay container, not just CSS tweaks.
- Browser autoplay restrictions can block slave audio playback after programmatic sync. The controller should treat the user’s play action as the authoritative retry point.
- `startOffsetMs` is in milliseconds while DOM media APIs use seconds. Unit conversion mistakes would create subtle sync drift.
- Frequent `timeupdate` resync can cause audible jitter if correction is too aggressive. The 0.2-second tolerance must be applied consistently.
- Audio swaps can race `loadedmetadata`; trying to seek before metadata is ready can throw or silently fail on some runtimes.
- Dual-mode listener setup must be idempotent. If rerenders or re-attach paths bind duplicate media listeners, play/pause/seek actions can fire twice and create false drift corrections.
- Existing `AUDIO FOCUS` controls already claim part of the audio UX surface. Dual preview needs an explicit relationship to that panel or the room will grow duplicate audio interfaces.
- Volume semantics need an explicit v1 decision. If both video and audio stay audible at full volume, the result may double playback. The implementation should decide whether the shared volume targets the slave only, or whether the master video audio is muted in dual mode.
- Existing persistence suites do not fully cover `LabWorkspaceUiState` local persistence boundaries, so a dedicated workspace persistence gate may be necessary.
- Responsive layout can collapse into “two equal players” unless the CSS intentionally preserves video dominance.

## Rollback Plan

- Revert dual-preview state/event additions from `lab-types.ts`, `lab-store.ts`, and `lab-run-controller.ts`.
- Revert split preview markup/CSS and fall back to the current single-preview surface plus linked-audio bar.
- Remove dedicated dual-preview regressions if the feature is abandoned before release, or keep them skipped only if a temporary rollback is needed during stabilization.
- Regenerate the installed Laboratory copy through the standard room build/install workflow after any rollback so `data/rooms/laboratory` matches workspace source again.
