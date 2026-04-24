# Plan: Laboratory Phase 3.1 – Interpretation Layer + Temporal Audio Controls

**Generated**: 2026-04-24  
**Estimated Complexity**: Medium-High

## Overview
This phase adds two preview-only capabilities to Laboratory without touching the analysis pipeline, `lab-run-controller.ts`, or asset generation:

1. Temporal audio controls in the existing `audioFocus` workflow:
   - `playbackRate` (`0.25` → `2.0`)
   - `preservePitch` (`boolean`)
2. A derived, passive interpretation layer that explains the likely meaning of current selection and audio adjustments.

The implementation should stay inside the existing workspace/UI runtime seams:
- `workspace.audioFocus.*` generic field dispatch already exists in `lab-run-controller.ts`, so no controller edit is required if new scalar/checkbox fields are added under `audioFocus`.
- `lab-selectors.ts` already feeds `audioFocus` into the waveform timeline model.
- `lab-waveform-timeline-visualizer.ts` already owns live preview sync and delegates Web Audio work to `lab-audio-visualizer.ts`.
- `lab-waveform-timeline-render.ts` already owns the selection/suggestion/preview panel area, so the new interpretation panel should be added there rather than inventing a second owner seam.

Two explicit scope fences are required to keep the phase implementable:
- In single-preview mode, the visualizer can bind to the main preview media element, including video. That means `playbackRate` is effectively a preview transport control for the bound preview media, not an isolated audio-only transform.
- In dual-preview mode, Phase 3.1 must not attempt to change slave playback rate while preserving master/slave drift correction, because the authoritative sync loop lives in `lab-run-controller.ts`. Temporal controls therefore need a UI/runtime fence while dual preview is active.

## Prerequisites
- Existing preview-only audio graph in [rooms/laboratory/runtime/lab-audio-visualizer.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-audio-visualizer.ts)
- Existing `audioFocus` UI in [rooms/laboratory/ui/workspace-audio-focus.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/workspace-audio-focus.ts)
- Existing waveform timeline model/render path in:
  - [rooms/laboratory/runtime/lab-selectors.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-selectors.ts)
  - [rooms/laboratory/ui/lab-waveform-timeline-types.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-waveform-timeline-types.ts)
  - [rooms/laboratory/ui/lab-waveform-timeline-render.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-waveform-timeline-render.ts)
- Regression surface in [scripts/tests/laboratory-runtime-truth-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/laboratory-runtime-truth-regressions.test.ts)

## Sprint 1: Extend Preview Audio Focus Contract
**Goal**: Add `playbackRate` and `preservePitch` to the preview audio settings contract with the smallest possible state change.  
**Demo/Validation**:
- Workspace state can carry `playbackRate` and `preservePitch`.
- Existing `workspace.audioFocus.*` input path can update them without any `lab-run-controller.ts` change.
- No run/analysis payload starts carrying these values.

### Task 1.1: Extend Audio Focus Types
- **Location**:
  - [rooms/laboratory/models/lab-types.ts](/home/raistlin/hayalet-ev/rooms/laboratory/models/lab-types.ts)
- **Description**:
  - Extend `LabAudioFocusSettings` with:
    - `playbackRate: number`
    - `preservePitch: boolean`
  - Keep the addition local to `workspace.audioFocus`.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - Types compile with the new fields.
  - No run/analysis interfaces are widened.
- **Validation**:
  - `rooms:typecheck`

### Task 1.2: Extract Shared Audio Focus Normalization Contract
- **Location**:
  - [rooms/laboratory/runtime/lab-audio-focus-normalization.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-audio-focus-normalization.ts)
  - [rooms/laboratory/runtime/lab-store.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-store.ts)
  - [rooms/laboratory/runtime/lab-audio-visualizer.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-audio-visualizer.ts)
- **Description**:
  - Extract a shared normalization helper so store hydration, preview playback, and interpretation all consume the same normalized `audioFocus` shape.
  - Add default values to the workspace `audioFocus` seed:
    - `playbackRate: 1`
    - `preservePitch: true`
  - Extend both normalization seams so malformed or missing persisted values are clamped/reset safely.
  - Clamp rules:
    - `playbackRate`: `0.25..2.0`
    - `preservePitch`: boolean fallback `true`
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Hydrate path preserves valid values and repairs invalid ones.
  - Visualizer and interpretation use the same normalized values the store exposes.
  - Existing visualization mode normalization behavior is preserved.
- **Validation**:
  - Add/adjust hydrate normalization assertions in truth regressions.

### Task 1.3: Expose Playback Controls in Audio Focus UI
- **Location**:
  - [rooms/laboratory/ui/workspace-audio-focus.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/workspace-audio-focus.ts)
- **Description**:
  - Add preview-only controls:
    - playback rate range/select UI
    - preserve pitch checkbox/toggle
  - Present them as analysis aids, not destructive editing tools.
  - Suggested copy direction:
    - “Slow down to inspect”
    - “Speed up to detect patterns”
  - When dual preview is active, disable or fence the temporal controls with explanatory copy rather than silently applying unsupported behavior.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Controls emit `workspace.audioFocus.playbackRate`
  - Controls emit `workspace.audioFocus.preservePitch`
  - Existing Gain/Filter/EQ controls are unchanged
- **Validation**:
  - Markup assertions in targeted UI/runtime truth tests

## Sprint 2: Bind Temporal Controls Into Preview Playback
**Goal**: Make playback speed and pitch settings audibly affect preview playback without rebuilding the graph or breaking preview sync.  
**Demo/Validation**:
- Changing speed changes audible playback immediately.
- Preserve-pitch toggle changes how playback speed sounds.
- Gain/filter/EQ updates still work.
- Dual preview does not regress because temporal controls are explicitly fenced there for Phase 3.1.

### Task 2.1: Add Playback Config Normalization and Signature
- **Location**:
  - [rooms/laboratory/runtime/lab-audio-visualizer.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-audio-visualizer.ts)
- **Description**:
  - Extend normalized audio focus settings and signature generation to include:
    - normalized `playbackRate`
    - normalized `preservePitch`
  - Keep the existing idempotent “same signature → no-op” pattern.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Repeated `sync()` calls with unchanged playback config do not reapply element properties or param ramps.
  - Shared normalization output is the only source used for playback config application.
- **Validation**:
  - Runtime regression for unchanged playback config no-op

### Task 2.2: Apply Preview Playback Rate and Pitch Flags
- **Location**:
  - [rooms/laboratory/runtime/lab-audio-visualizer.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-audio-visualizer.ts)
- **Description**:
  - Bind normalized `playbackRate` to `mediaElement.playbackRate`.
  - Bind pitch preservation via browser-supported properties:
    - `preservesPitch`
    - `mozPreservesPitch`
    - `webkitPreservesPitch`
  - Do not introduce DSP or rebuild the node graph on rate/pitch changes.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Live preview rate updates apply without graph recreation.
  - Natural pitch shift is allowed when `preservePitch === false`.
  - Unsupported pitch properties fail soft.
  - Single-preview video binding is treated as acceptable preview transport behavior, not a bug.
- **Validation**:
  - Direct runtime unit-style tests with mocked media element

### Task 2.3: Explicitly Fence Dual Preview Temporal Controls
- **Location**:
  - [rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts)
  - [rooms/laboratory/runtime/lab-audio-visualizer.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-audio-visualizer.ts)
  - [rooms/laboratory/runtime/lab-selectors.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-selectors.ts)
  - [rooms/laboratory/ui/workspace-audio-focus.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/workspace-audio-focus.ts)
- **Description**:
  - Add an explicit Phase 3.1 fence for `playbackRate` / `preservePitch` when dual preview is active.
  - Keep gain/filter/EQ preview processing available in dual preview.
  - Surface a lightweight explanation in the UI or selector/view-model so users understand that temporal controls are single-preview analysis aids in this phase.
  - Do not try to solve master/slave rate sync without touching `lab-run-controller.ts`.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Existing drift correction behavior remains unchanged.
  - Dual preview cannot accidentally apply divergent slave playback rates.
  - Single-preview pause/play/seek keep the chosen playback settings.
- **Validation**:
  - Truth regressions covering dual preview fence + single-preview playback rate + seek

## Sprint 3: Build Deterministic Interpretation Engine
**Goal**: Produce passive interpretation items from selection + audio focus + source context, derived only.  
**Demo/Validation**:
- Interpretation items appear for matching rules.
- No state persistence or side effects are added.

### Task 3.1: Add Interpretation Types
- **Location**:
  - [rooms/laboratory/models/lab-types.ts](/home/raistlin/hayalet-ev/rooms/laboratory/models/lab-types.ts)
- **Description**:
  - Add `LabInterpretationItem` with:
    - `id`
    - `type: "info" | "warning" | "hint"`
    - `message`
    - `confidence`
    - `relatedAction?`
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - Shared UI/runtime types can consume interpretation items cleanly.
- **Validation**:
  - `rooms:typecheck`

### Task 3.2: Implement Rule-Based Interpretation Engine
- **Location**:
  - [rooms/laboratory/runtime/lab-interpretation-engine.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-interpretation-engine.ts)
- **Description**:
  - Create a pure deterministic builder that accepts:
    - `activeSelection`
    - normalized `audioFocus`
    - `sourceKind`
  - Implement the requested rules:
    - high gain warning
    - slow playback hint
    - fast playback hint
    - lowpass + low cutoff info
    - extreme EQ boost warning
    - short selection hint
    - long selection info
  - Deduplicate and order items deterministically.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Same input always returns the same ordered interpretation list.
  - No store writes, emits, or persistence.
- **Validation**:
  - Direct rule tests in truth regressions

### Task 3.3: Integrate Derived Selector Output
- **Location**:
  - [rooms/laboratory/runtime/lab-selectors.ts](/home/raistlin/hayalet-ev/rooms/laboratory/runtime/lab-selectors.ts)
  - [rooms/laboratory/ui/lab-waveform-timeline-types.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-waveform-timeline-types.ts)
- **Description**:
  - Add `getInterpretationItems(state)`.
  - Feed `interpretationItems` into the waveform timeline model.
  - Keep the data fully derived; do not add store state.
- **Complexity**: 4
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Interpretation updates automatically when selection or audio focus changes.
  - No persisted snapshot changes are introduced.
  - Interpretation uses the shared normalized audio focus contract rather than raw store values.
- **Validation**:
  - Selector-focused truth regressions

## Sprint 4: Render a Passive Interpretation Panel
**Goal**: Show lightweight, collapsible interpretation feedback inside the existing timeline panel stack.  
**Demo/Validation**:
- User sees “what this means” beneath the preview/suggestion area.
- Panel stays passive and non-blocking.

### Task 4.1: Add Interpretation Panel Markup
- **Location**:
  - [rooms/laboratory/ui/lab-waveform-timeline-render.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-waveform-timeline-render.ts)
- **Description**:
  - Render an interpretation block in the timeline render owner seam, not gated strictly on valid selection.
  - When a valid selection exists, the block can live in the existing selection/preview stack.
  - When there is no valid selection but audio-focus-only rules fire, render a compact interpretation block in the timeline body so the requested audio guidance still appears.
  - Make it collapsible with lightweight default-open behavior using native `<details>` / `<summary>` style markup to avoid introducing new UI state.
  - Show:
    - severity icon/label
    - message
    - confidence-aware emphasis if useful
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Panel renders whenever there is at least one interpretation item, even if no active selection exists.
  - No buttons or emits are introduced.
- **Validation**:
  - Markup assertions in truth regressions

### Task 4.2: Style the Interpretation Surface
- **Location**:
  - [rooms/laboratory/ui/lab-theme.css](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-theme.css)
- **Description**:
  - Add subtle styles for:
    - info / warning / hint tones
    - collapsible header
    - lightweight stacked-card feel
  - Keep it visually secondary to selection and preview.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Interpretation panel reads as guidance, not modal or alert spam.
  - Warning state is noticeable but not alarming.
- **Validation**:
  - Visual smoke via rendered markup class coverage

## Sprint 5: Regression Closure and Installed-Room Parity
**Goal**: Lock the phase down with direct regressions and shipped-room sync.  
**Demo/Validation**:
- Full targeted Laboratory suite passes.
- Installed room copy stays in parity with source workspace.

### Task 5.1: Expand Truth Regressions
- **Location**:
  - [scripts/tests/laboratory-runtime-truth-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/laboratory-runtime-truth-regressions.test.ts)
- **Description**:
  - Add explicit coverage for:
    - playbackRate normalization/clamp
    - preservePitch mapping
    - unchanged playback config no-op
    - gain/filter/EQ + playback controls coexisting
    - dual preview temporal-control fence
    - single-preview video binding compatibility
    - interpretation rule correctness
    - interpretation visibility with and without active selection
    - interpretation selector derivation
    - no interpretation persistence
- **Complexity**: 6
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Phase-specific behavior is covered without relying on manual testing alone.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.2: Build and Installed Sync
- **Location**:
  - Generated outputs under `data/rooms/laboratory/*`
  - [config/rooms.json](/home/raistlin/hayalet-ev/config/rooms.json)
- **Description**:
  - Refresh built/install artifacts after source changes.
  - Keep workspace source as the only edit source; update installed copies via build/install flow.
- **Complexity**: 3
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Installed room reflects the new preview controls and interpretation panel.
- **Validation**:
  - `npm run rooms:build`
  - `TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx --input-type=module --eval "import { join } from 'node:path'; import { initPaths } from './electron/paths.ts'; import { getRoomPackageManager } from './electron/room-package-manager.ts'; initPaths(join(process.cwd(), 'electron')); const result = await getRoomPackageManager().installFromWorkspace('laboratory'); if (result.success !== true) { console.error(result.error ?? 'install failed'); process.exit(1); } console.log(result.room?.installedDir ?? 'ok');"`

## Testing Strategy
- Start narrow with pure runtime assertions:
  - audio focus normalization
  - interpretation rule generation
  - playback element property mapping
- Then verify owner seam behavior:
  - `lab-waveform-timeline-visualizer.ts` still reuses the same live controller
  - unrelated store churn does not retrigger unchanged playback config
- Finish with parity validation:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - targeted truth regressions
  - broader Laboratory parity pack if the phase touches shared selection/timeline seams

## Potential Risks & Gotchas
- **Store extension is technically unavoidable**:
  `LabAudioFocusSettings` currently has no rate/pitch fields, so the minimal safe change is to add them under `workspace.audioFocus` only.
- **`workspace.audioFocus.*` generic dispatch is already available**:
  The existing `lab-run-controller.ts` field router already forwards unknown scalar/checkbox `audioFocus` keys, so the plan must not add bespoke controller handling.
- **Dual preview sync can become jittery**:
  Applying a non-1.0 `playbackRate` to the audio slave would interact poorly with master drift correction because that loop lives in `lab-run-controller.ts`. Phase 3.1 should fence temporal controls in dual preview rather than attempt a partial fix.
- **Pitch preservation is browser-property based**:
  `preservesPitch` support varies; the runtime should soft-fallback rather than assume every property exists.
- **Interpretation spam risk**:
  If every rule fires at once, the panel will become noisy. The engine should cap, order, or dedupe items to keep the UI readable.
- **No-selection interpretation is required for audio-only rules**:
  The requested audio hints must still surface when the user changes gain/EQ/rate without a valid selection.
- **Interpretation must stay derived-only**:
  No `state.ui.activeInterpretation*`, no persistence, no host events.
- **Render ownership matters**:
  The interpretation panel belongs in `lab-waveform-timeline-render.ts`, not `workspace-audio-focus.ts`, so the “meaning” stays close to selection/preview context.
- **Shared normalization prevents drift**:
  If store, playback, and interpretation each normalize `audioFocus` separately, “what you hear” and “what it means” will diverge on malformed values.

## Rollback Plan
- Remove `playbackRate` / `preservePitch` from `LabAudioFocusSettings` and workspace defaults.
- Remove playback element binding from `lab-audio-visualizer.ts`.
- Delete `lab-interpretation-engine.ts`.
- Remove selector/model/render plumbing for interpretation items.
- Rebuild and reinstall the Laboratory room to restore shipped parity.
