# Plan: Laboratory Unified Waveform Timeline

**Generated**: 2026-04-24
**Estimated Complexity**: High

## Overview

Promote the Laboratory waveform from a separate audio-focus companion panel into the primary workspace timeline layer. The end state should give the room one shared time surface where waveform peaks, playhead, selection range, bookmarks, and clip/export actions all sit on the same axis directly below the preview.

This plan stays inside the UI and selector-read boundary:

- keep `ui.workspace.timelineStartMs` / `timelineEndMs` as the current selection source of truth
- keep existing host/export/grab-frame action names and downstream logic unchanged
- avoid asset-registry changes and run/analysis state changes
- move waveform rendering ownership out of `workspace-audio-focus.ts`
- introduce a new UI component at `rooms/laboratory/ui/lab-waveform-timeline.ts`

The implementation should reuse current Laboratory seams instead of inventing a second transport model:

- `workspace-surface.ts` already owns preview placement
- `workspace-timeline.ts` already owns selection overlay markup, controls, numeric inputs, and export buttons
- `lab-run-controller.ts` already owns timeline drag/seek actions
- `workspace-audio-focus.ts` already owns waveform canvas rendering/binding logic

The work therefore is mainly a controlled merge, not a greenfield timeline rewrite.

## Research Notes

- `rooms/laboratory/ui/workspace-surface.ts` currently renders preview, optional dual-preview transport, then `renderWorkspaceTimeline(...)`, then hypothesis/focus/bookmarks.
- `rooms/laboratory/ui/workspace-audio-focus.ts` currently renders the standalone waveform canvas and owns `createWorkspaceAudioVisualizer(...)`.
- `rooms/laboratory/ui/workspace-timeline.ts` already exposes:
  - the selection overlay
  - drag handles and body drag affordances
  - bookmark pins
  - export / clear / frame-grab / extract-audio controls
  - numeric start/end inputs
- `rooms/laboratory/runtime/lab-run-controller.ts` already handles:
  - `timeline-seek`
  - `timeline-interact`
  - handle/body drag
  - `timeline-clear`
  - clip/frame/audio export actions
- Dual-preview already uses a master/slave media model. The unified timeline must keep the same seek authority.
- Existing tests already cover the current waveform canvas selector, linked-audio UI, dual-preview sync, and timeline export actions.

## Assumptions

- V1 does not add new persisted store state for playhead. Playhead should stay DOM-driven and derive from the active media element's `currentTime`.
- Existing selection state remains the only persisted editing state for range operations.
- Old and new interactive timeline/waveform DOM must not coexist with the same ids, classes, or action hooks. If a transition phase is needed, temporary private selectors must be used until the old owner is removed.
- The existing `visualizationMode` setting may remain in state for compatibility, but the old dropdown can be hidden or disabled during this pass.
- Artifact-first waveform parity is the ship blocker. Whole-track peak/downsample decoding is a follow-up enhancement only if the moved renderer does not meet UX needs.
- If a full decode path is unavailable for a given source, the renderer should degrade safely rather than blocking the timeline UI.

## Prerequisites

- Workflow for this planning session is `workflow:terminal-mode` because `npm run mode:status` returned `terminal` and `npm run whereami` returned `effectiveMode: other-provider-cli`.
- Source of truth remains `rooms/laboratory/*`; do not treat `data/rooms/laboratory/*` as a peer edit target.
- Existing timeline action names must remain stable:
  - `timeline-seek`
  - `timeline-clear`
  - `timeline-export-clip`
  - `timeline-grab-frame`
  - `timeline-extract-audio`
- Existing selection reducer event remains stable:
  - `workspace-timeline-updated`
- Existing dual-preview master/slave authority remains stable.

## Sprint 1: Mount the New Timeline Surface

**Goal**: Land the new `lab-waveform-timeline` component under the preview and give it enough read-only data to render a passive waveform/time-axis scaffold without changing the current export or selection semantics.

**Demo/Validation**:

- A new unified timeline block renders directly below the preview shell.
- The new block receives duration, selection, bookmark, and source-kind inputs from one clear seam.
- The old timeline can temporarily coexist during migration, but the new block is visually anchored in the final location.

### Task 1.1: Define the Unified Timeline View Model

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Add a read-only selector or local projection helper that bundles the data the new component needs:
  - duration
  - source kind
  - current selection start/end
  - bookmarks
  - dual-preview active flag
  - selected dual-preview audio asset and selected audio asset id
  - dual-preview audio start offset and audio duration
  - current visualization mode
  - currently preferred visualization artifact, if any
  - explicit master-axis rendering rule for dual preview so waveform content is padded/clipped against the master timeline, not treated as an independent slave timeline
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - `workspace-surface.ts` no longer hand-builds multiple timeline inputs piecemeal.
  - No new persisted fields are introduced.
  - The model is read-only and derived entirely from existing state/selectors.
  - Dual-preview waveform alignment remains correct when linked audio is switched or carries `startOffsetMs`.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - targeted selector inspection

### Task 1.2: Create `lab-waveform-timeline.ts` With a Read-Only Render Contract

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Add the new component file and define a render API that can own the timeline shell markup. V1 should include:
  - waveform track container
  - playhead slot
  - bookmark slot
  - selection overlay slot
  - controls / numeric field area
  - data attributes and roles needed for later controller wiring
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The new component can render without touching run/analysis state.
  - The component contract is explicit enough to absorb the old `workspace-timeline.ts` responsibilities later.
  - It introduces stable DOM anchors for later playhead and drag wiring.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - markup snapshot/assertion update if needed

### Task 1.3: Mount the New Timeline Below the Preview Surface

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Render the new component immediately below:
  - single preview shell
  - or dual-preview shell + transport bar

  Keep preview dominance intact and avoid moving hypothesis/process/focus panels yet.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The waveform timeline lives below the preview in both audio-only and video workflows.
  - Dual-preview still renders its transport bar and media panes correctly.
  - Existing preview DOM preservation rules remain intact.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - manual surface inspection

## Sprint 2: Migrate Rendering Ownership With Artifact-First Parity

**Goal**: Move waveform rendering ownership into `lab-waveform-timeline.ts` without changing the renderer model first. Ship parity with the current artifact/live-analyser behavior before considering a whole-track decoder.

**Demo/Validation**:

- Opening an audio or video source shows waveform content in the new timeline block.
- The old bottom waveform panel is no longer required for waveform visibility.
- Existing artifact-first behavior and live fallback still work after the move.

### Task 2.1: Extract Visualization Ownership Out of `workspace-audio-focus.ts`

- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, `rooms/laboratory/ui/lab-waveform-timeline.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Move the waveform canvas lookup, lifecycle helpers, and render-sync ownership out of `workspace-audio-focus.ts`. The new timeline component should become the canonical owner of waveform rendering APIs and DOM selectors.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `workspace-audio-focus.ts` no longer contains the primary waveform render path.
  - The controller no longer imports the waveform binder from `workspace-audio-focus.ts`.
  - Only one waveform renderer remains authoritative.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 2.2: Re-home the Existing Artifact-First and Live-Fallback Renderer

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Preserve the current rendering hierarchy in the new component:
  - preferred waveform/spectrogram artifact path first
  - live analyser fallback second

  Do not make full-source decode a prerequisite for the first ship pass. The goal of this task is safe ownership transfer plus location unification.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The new timeline component reproduces current artifact/live rendering behavior in the new location.
  - No new decode/cancel/cache subsystem is required to ship Sprint 2.
  - The controller can bind/unbind the new renderer without ambiguous selectors.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`

### Task 2.3: Define an Optional Whole-Track Peak/Downsample Follow-up

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Design, and only implement if still necessary after parity, a minimal renderer that produces timeline-friendly peaks rather than a live oscilloscope trace. If taken, V2 should:
  - derive a whole-track sample summary for the active source
  - downsample aggressively to a bounded peak count
  - render a simple mirrored or centerline waveform
  - cache by stable source key so rerenders do not recompute needlessly

  If source decoding is not possible for a given asset, define a safe fallback path such as:
  - latest waveform artifact read path
  - or an explicit low-fidelity placeholder state

  This task is optional and should not block the first unified timeline cutover if artifact-first parity already meets acceptance.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - The timeline can show waveform content before any range selection is created.
  - Peak generation is bounded and does not scale linearly with raw sample count at render time.
  - Failures do not break timeline controls.
  - The task is skipped entirely if parity rendering already satisfies UX and risk budget.
- **Validation**:
  - manual smoke test with at least one audio file and one video file
  - targeted runtime truth coverage for cache/reset behavior where practical

### Task 2.4: Remove Legacy Waveform Canvas Placement From Audio Focus and Dual Preview

- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Remove the old standalone waveform panel from:
  - the audio-focus panel
  - the dual-preview audio pane

  The shared timeline below preview becomes the only waveform surface.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - The old separate waveform block is gone.
  - Dual preview no longer renders a duplicate audio visualization panel.
  - Audio focus remains usable for gain/filter/EQ without timeline duplication.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - manual DOM inspection for duplicate canvas removal

## Sprint 3: Merge Selection and Clip Operations Into the Waveform Layer

**Goal**: Replace the old timeline rail with the waveform itself so selection overlays, drag handles, bookmarks, numeric fields, and clip actions all live on the same time axis.

**Demo/Validation**:

- Selection is drawn on top of the waveform rather than on a separate rail.
- Drag handles and body drag still update `timelineStartMs` / `timelineEndMs`.
- Export / grab-frame / extract-audio controls still operate through the existing action names.

### Task 3.1: Fold `workspace-timeline.ts` Markup Responsibilities Into the New Component

- **Location**: `rooms/laboratory/ui/workspace-timeline.ts`, `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Migrate the old timeline responsibilities into the new component:
  - selection overlay
  - drag handles
  - selection duration label
  - bookmarks
  - time labels
  - numeric start/end inputs
  - clip/export/frame/audio actions

  Keep action names stable so downstream runtime behavior does not drift.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - There is one timeline markup owner.
  - Existing button/action contracts still exist after the migration.
  - The waveform surface visually carries the selection overlay.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - UI markup assertions

### Task 3.2: Rework Pointer Semantics So Click Seeks and Drag Selects

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: The current timeline starts range creation on normal click. The unified waveform timeline needs a richer pointer model:
  - click on waveform seeks playhead
  - drag on empty waveform creates or reshapes selection
  - drag handles/body preserve the current selection editing behavior
  - optional shift-extend behavior survives if still valuable

  This likely requires a pointer-threshold session instead of immediate click-to-selection.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - A simple click updates media time without accidentally creating a zero-width selection.
  - Drag gestures still create and modify selection ranges.
  - Existing range body/edge editing remains functional.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - manual drag/click smoke test

### Task 3.3: Preserve Selection-Driven Clip Operations Without Touching Host Logic

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Confirm that the new unified surface still drives:
  - `export-timeline-clip`
  - `export-frame-grab`
  - `export-audio-track`

  via the same workspace selection fields and action paths, with no host-side contract changes.
- **Complexity**: 4
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Clip export still uses `timelineStartMs` / `timelineEndMs`.
  - Frame grab still derives seek position from the current timeline selection rules.
  - No host router or action schema changes are required.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts`

## Sprint 4: Add Playhead Sync and Shared Media Authority

**Goal**: Make the waveform timeline feel live by syncing playhead position to the active media clock and routing waveform seeks back through the correct media authority.

**Demo/Validation**:

- Playhead visibly advances while media plays.
- Clicking waveform positions seeks the active preview.
- Single-preview and dual-preview modes share the same timeline authority rules.

### Task 4.1: Add a DOM-Driven Playhead Layer

- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Render a dedicated playhead marker and, if helpful, a subtle played-region treatment. Keep this DOM-driven instead of adding new persisted store state.
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - The playhead has a stable DOM hook and style contract.
  - The waveform remains legible when the playhead is active.
  - Styling works for both narrow and wide timelines.
- **Validation**:
  - visual inspection
  - targeted UI markup assertions

### Task 4.2: Add Explicit Playhead Listener Lifecycle for Active Media

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add explicit bind/unbind lifecycle for playhead sync rather than assuming a pre-existing single-preview sync loop. The controller should:
  - bind to the active single-preview media element in audio/video mode
  - bind to the dual-preview master element in dual-preview mode
  - update playhead position from `timeupdate`, seek, play, pause, ended, and source-swap events
  - cooperate with preserved-media reuse in `lab-root.ts` so reused DOM nodes are not double-bound
  - teardown and rebind cleanly on preview-mode toggles and source changes
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Playhead tracks `video.currentTime` or `audio.currentTime` without adding reducer churn.
  - Dual-preview playhead follows the master timeline, not the slave audio drift.
  - Timeline updates do not break existing dual-preview transport UI.
  - Source swaps and preserved-node reuse do not leave stale listeners behind.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - manual smoke test in single and dual preview

### Task 4.3: Route Waveform Seeks Through Existing Media Authority

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Ensure waveform click/seek uses the same authority that the old timeline used:
  - single-preview updates the preview media element(s)
  - dual-preview routes through `seekDualPreviewToMs(...)`

  Keep `timeline-seek` as the stable action seam unless a strictly local wrapper is clearer.
- **Complexity**: 4
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Waveform seek does not bypass dual-preview offset handling.
  - Single-preview seek remains immediate.
  - Old bookmark pins and new waveform seek share the same target time semantics.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - targeted manual seek verification

## Sprint 5: Remove Legacy UI and Lock Regressions

**Goal**: Ship the unified timeline as the only timeline/waveform surface and protect the new contract with targeted tests.

**Demo/Validation**:

- The old bottom waveform panel is fully removed.
- The old timeline rail is fully replaced by the waveform timeline.
- Acceptance scenarios pass for audio-only, video-only, and dual-preview flows.

### Task 5.1: Disable or Remove the Old Visualization Dropdown

- **Location**: `rooms/laboratory/ui/workspace-audio-focus.ts`
- **Description**: Remove or temporarily disable the old visualization mode dropdown so the UI no longer implies a separate waveform/spectrum companion panel. Preserve state compatibility only as long as needed for safe migration.
- **Complexity**: 3
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Audio focus UI no longer advertises the old companion-visualization model.
  - The room does not expose two competing waveform concepts.
  - Hidden/disabled state is intentional and documented in code if temporary.
- **Validation**:
  - UI markup review
  - targeted regression update

### Task 5.2: Retire or Shrink `workspace-timeline.ts`

- **Location**: `rooms/laboratory/ui/workspace-timeline.ts`, import sites
- **Description**: After the new component fully owns the timeline, either:
  - delete `workspace-timeline.ts`
  - or reduce it to a thin helper if some formatting logic still belongs there

  Avoid leaving duplicate timeline implementations in the room.
- **Complexity**: 4
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - There is a single canonical timeline implementation.
  - Import graph is simpler than the pre-migration state.
  - No dead DOM selectors or CSS rules remain attached to the old rail-only timeline.
- **Validation**:
  - `npm run rooms:typecheck`
  - `rg` sanity pass for stale timeline-only selectors

### Task 5.3: Update Focused Regressions and Run the Acceptance Matrix

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`, `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, optionally `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
- **Description**: Update or add focused regressions for:
  - unified timeline render location
  - absence of old waveform panel
  - playhead DOM contract
  - waveform seek behavior
  - selection overlay on waveform
  - dual-preview master/slave seek behavior remaining intact
  - linked-audio switching plus offset-aligned waveform placement
  - bookmark seek pins
  - numeric input null semantics and direct range edits
  - finetune and clear-to-null behavior
  - visualization mode compatibility after the old dropdown is hidden or removed
  - installed-copy parity expectations already covered by current Laboratory parity suites
- **Complexity**: 7
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Tests assert the new unified contract instead of the old separate-panel contract.
  - Old waveform-specific selector assumptions are either removed or intentionally remapped.
  - Coverage includes at least one single-preview and one dual-preview path.
  - Coverage includes the old timeline affordances that remain user-visible after the merge.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
  - `npm run rooms:typecheck`

## Testing Strategy

- Keep the verification surface targeted to Laboratory room tests instead of broad repo suites first.
- Validate migration in this order:
  1. selector/view-model integrity
  2. artifact/live rendering parity in the new location
  3. UI markup placement
  4. controller click/drag semantics
  5. dual-preview seek authority and offset alignment
  6. export/clip action stability
- Primary automated gates:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
- Manual smoke checklist:
  - open an audio file and confirm waveform appears in the timeline
  - open a video file and confirm waveform shares the same timeline axis
  - click waveform and confirm seek updates preview time
  - drag to create a selection and confirm overlay/inputs update
  - drag selection body and handles
  - switch linked audio in dual preview and confirm waveform alignment still honors offset
  - test bookmark pin seek, numeric start/end edits, fine-tune buttons, and clear
  - export clip / grab frame / extract audio from the same unified surface
  - verify dual-preview playhead tracks the master media correctly

## Potential Risks & Gotchas

- The current waveform logic is live-playback oriented, not whole-track-timeline oriented. Reusing it blindly will not satisfy the “waveform = timeline” goal.
- The current room is artifact-first and only falls back to live analyser rendering. Any plan that assumes full-source decode is already available will create hidden implementation scope.
- Click-to-seek and drag-to-select conflict with the current immediate drag-selection behavior. This is a real interaction redesign, not just a markup move.
- Full-source decoding for waveform peaks may fail for some preview URLs or media formats. A fallback path is needed so the timeline never becomes blank-and-broken.
- `lab-root.ts` preserves media elements only when tag, `data-lab-preserve-media`, and `src` remain stable. Timeline work must not accidentally destabilize preview preservation.
- Dual-preview already has a transport loop. Adding playhead sync to the unified timeline must not introduce a second competing sync loop.
- Dual-preview waveform placement must stay on the master time axis and honor selected linked-audio `startOffsetMs`; otherwise switching linked audio will visually desync the waveform.
- Existing tests currently assert the presence of `#lab-audio-viz` in old locations. Those expectations will need intentional rewrites, not blanket deletions.
- Removing the old visualization dropdown too early could hide a fallback path before the new timeline renderer is stable.
- CSS cleanup can easily leave stale `.labx-timeline__rail` or old audio-viz rules behind; a selector audit is needed at the end.

## Rollback Plan

- Revert `workspace-surface.ts` to render the old `renderWorkspaceTimeline(...)` and old audio-focus waveform block.
- Restore waveform binder ownership to `workspace-audio-focus.ts` if the new component destabilizes playback or rerender behavior.
- Keep controller action names and reducer events unchanged during the migration so rollback remains local to UI modules.
- If whole-track peak rendering proves too risky for the first pass, fall back to shipping the new placement with a simpler renderer while keeping the selection/playhead unification work behind the same component boundary.
