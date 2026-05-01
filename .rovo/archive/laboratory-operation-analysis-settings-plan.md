# Plan: Laboratory Operation And Analysis Settings

**Generated**: 2026-05-01
**Estimated Complexity**: High

## Overview

Laboratory currently lets the user choose analysis intents, toggle analysis modules, select a timeline range, select an ROI, and adjust live preview controls. Operation cards in the right panel mostly execute immediately through `data-lab-action` handlers, and analysis modules start with catalog/module toggles but no module-specific pre-run settings.

This plan adds a first-class settings layer for every suggested operation and analysis setting while preserving the current one-click default path. The core approach is:

- Add a shared room-local settings schema and defaults for operation and analysis modules.
- Render compact per-card/per-module settings controls in the right-side panels.
- Persist settings in the active project workbench and include them in operation and analysis payloads.
- Teach host runners to honor the settings with guarded defaults and metadata.
- Add targeted regression tests for store, selectors, UI rendering, payload dispatch, and host runner behavior.

## Clarification Gate

No blocking questions remain for planning. The plan uses these safe assumptions:

- "All suggested settings" means all operation and analysis settings listed in the prior analysis are in scope.
- Existing behavior remains the default when users never open or change settings.
- Settings are room-local to `rooms/laboratory`; do not edit `data/rooms/laboratory` as a peer source.
- Settings should be persisted per active project/workbench, not globally.
- Heavy features can be implemented behind "runner connected" readiness where the current runner is still planned.
- No new external dependencies are required unless a later implementation discovers an already-supported local tool option is insufficient.
- Existing dirty worktree changes must be preserved and reviewed before edits to touched files.

## Prerequisites

- Review the current dirty worktree before implementation:
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/workspace-operation-controls.ts`
  - `rooms/laboratory/ui/lab-drawer.ts`
  - `rooms/laboratory/ui/lab-theme.css`
  - related i18n and tests
- Use `rooms/laboratory` as source of truth.
- Keep default action behavior compatible with existing tests.
- Validation baseline:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `npm run typecheck`

## Sprint 1: Settings Contract And Store

**Goal**: Add a stable, typed settings model that can support every operation and analysis module without changing runner behavior yet.

**Demo/Validation**:
- Default settings exist for all supported operation and analysis IDs.
- Store can update/reset individual setting groups.
- Existing runs still start with unchanged defaults.

### Task 1.1: Define operation settings types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add typed settings interfaces for operation capabilities:
  - `clip-export`: format, quality preset, fps mode, include audio, apply ROI crop, scale preset.
  - `frame-grab`: frame mode, burst count, output format, quality, include timestamp label.
  - `roi-crop`: padding, aspect lock, output size preset, format.
  - `enhanced-frame`: preset, strength, apply visual preview settings.
  - `audio-extract`: format, channels, sample rate, timeline-only mode.
  - `audio-cleanup`: denoise strength, high-pass, low-pass, normalize target, compressor toggle.
  - `band-pass-voice`: low frequency, high frequency, Q/width, gain, output channels.
  - `stem-separation`: model, device, stem selection, segment/overlap preset.
  - `segment-stabilization`: shakiness preset, smoothing, crop mode, output quality.
  - `before-after-variant`: comparison layout, reveal preset, strength, output format.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - All operation capability IDs have a default setting object.
  - Types use bounded string unions and numbers that can be clamped.
  - Defaults reproduce current behavior where a runner already exists.
- **Validation**:
  - `npx tsc --noEmit --pretty false` or `npm run typecheck`.

### Task 1.2: Define analysis settings types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add typed settings for analysis capability families and module IDs:
  - Visual structure/forensics: sampling density, frame step, sensitivity, ROI-only, reveal strength.
  - Visual reveal modules: gamma range, contrast range, edge strength, histogram strength, channel mode.
  - Audio signal/recovery: sample window, silence threshold, denoise strength, recovery preset.
  - Transcription: model policy, language, sample duration, translate/transcribe mode, selected range only.
  - Speaker analysis: expected speaker count policy, minimum segment seconds, sensitivity.
  - Prosody/emotion: window size, silence threshold, heuristic sensitivity.
  - Sound classification: top-k, score threshold.
  - Source separation: model, device, selected stems.
  - Music analysis: sample rate, rhythm/tonal focus, Essentia fallback toggle.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - All currently listed audio and visual modules have a settings path or inherit a family default.
  - Gated/planned modules can still expose disabled or future settings metadata.
- **Validation**:
  - Typecheck and unit test defaults.

### Task 1.3: Add normalization and clamping helpers

- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - optional new file `rooms/laboratory/runtime/lab-settings-normalization.ts`
- **Description**: Add pure helpers to normalize persisted settings, clamp numeric ranges, and merge partial patches.
- **Complexity**: 6
- **Dependencies**: Tasks 1.1, 1.2
- **Acceptance Criteria**:
  - Invalid persisted values fall back safely.
  - Unknown setting keys are ignored or preserved only in an explicit `custom` bucket.
  - Numeric settings are clamped to documented ranges.
- **Validation**:
  - Add tests in `scripts/tests/laboratory-store-runtime-regressions.test.ts`.

### Task 1.4: Extend workbench state

- **Location**:
  - `rooms/laboratory/shared/host/runtime-primitives.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-persistence.ts`
- **Description**: Add `operationSettings` and `analysisSettings` to the laboratory workbench state and persisted UI snapshot.
- **Complexity**: 6
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - New projects receive default settings.
  - Existing persisted projects hydrate without errors.
  - Reset actions can reset one tool/module or all settings.
- **Validation**:
  - Store regression tests.
  - Persistence regression test for missing and partial settings.

### Task 1.5: Add store events for settings updates

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add events and controller plumbing for:
  - operation settings patch/reset
  - analysis family/module settings patch/reset
  - settings panel expanded/collapsed state
- **Complexity**: 5
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Updates are ignored or queued safely while active analysis locks relevant workspace mutation.
  - No existing `workspace-setting-adjust` behavior regresses.
- **Validation**:
  - Controller runtime regression tests.

## Sprint 2: Operation Panel Settings UI

**Goal**: Make every operation card configurable before execution, while preserving one-click run.

**Demo/Validation**:
- Each operation card shows a settings affordance.
- Expanded settings update state immediately.
- Run sends settings in payload.
- Default collapsed card still works like today.

### Task 2.1: Add reusable compact settings controls

- **Location**:
  - new `rooms/laboratory/ui/lab-settings-controls.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**: Build small UI helpers for select, toggle, numeric slider, stepper, preset chips, and reset button. Match current lab panel density and avoid nested card styling.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Controls emit `data-lab-field` or `data-lab-action` compatible with the controller.
  - Text fits in compact right-side panel at desktop and narrow widths.
- **Validation**:
  - UI render snapshot/string assertions.
  - Manual visual smoke in Laboratory workspace.

### Task 2.2: Render operation settings inside operation cards

- **Location**: `rooms/laboratory/ui/workspace-operation-controls.ts`
- **Description**: Extend `renderWorkspaceOperationControls` to receive settings projection and render an expandable settings area for each operation capability.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - All operation IDs render their relevant controls.
  - Planned operations show settings as future-ready but cannot run until runner is connected.
  - Current readiness/status labels remain visible.
- **Validation**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`.

### Task 2.3: Add operation settings selectors

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Project operation capability data with defaulted settings, labels, disabled states, and setting summaries.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - UI receives normalized settings only.
  - Settings summary is available for collapsed cards.
  - Source-kind restrictions can disable irrelevant settings.
- **Validation**:
  - Selector regression tests.

### Task 2.4: Send operation settings in tracked operation payloads

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add current operation settings to payloads for:
  - `export-timeline-clip`
  - `export-frame-grab`
  - `export-roi-image`
  - `export-enhanced-frame`
  - `export-audio-track`
  - `export-clean-audio`
  - `export-band-pass-voice`
  - planned future operations as metadata only
- **Complexity**: 5
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Payload includes `operationSettings` with only the selected operation's normalized settings.
  - Existing payload fields remain backward compatible.
  - Active selection, ROI, and intent IDs still pass through.
- **Validation**:
  - Controller tests assert outgoing payload shape.

### Task 2.5: Add operation settings i18n

- **Location**:
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/runtime/lab-i18n-en.ts`
  - `rooms/laboratory/runtime/lab-i18n-tr.ts`
- **Description**: Add labels, option names, reset text, and setting summaries.
- **Complexity**: 4
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - No visible hardcoded user-facing labels except minimal fallback text.
  - Turkish and English catalogs stay structurally aligned.
- **Validation**:
  - Existing i18n regression test if present, or add one in `scripts/tests/laboratory-i18n-regressions.test.ts`.

## Sprint 3: Analysis Settings UI

**Goal**: Let the user configure selected analysis families/modules before starting analysis.

**Demo/Validation**:
- Analysis preparation groups can expand module settings.
- Selected settings are included in process-run payload/workbench.
- Existing module checkbox behavior remains intact.

### Task 3.1: Add analysis settings projection

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Extend `getAnalysisPreparationGroups` to include defaulted settings, setting summaries, and disabled/future states for each module.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Module setting projections are grouped by capability family and module ID.
  - Disabled modules do not block settings display unless tool readiness makes the setting meaningless.
- **Validation**:
  - Selector regression tests.

### Task 3.2: Render module settings in analysis drawer

- **Location**:
  - `rooms/laboratory/ui/lab-drawer.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add compact settings rows under each analysis module checkbox. Keep high-density layout readable.
- **Complexity**: 7
- **Dependencies**: Tasks 2.1, 3.1
- **Acceptance Criteria**:
  - Visual modules expose sampling, sensitivity, ROI-only, and reveal parameters.
  - Audio modules expose recovery, transcript, diarization, event, stem, and music parameters.
  - Module settings can be reset individually.
- **Validation**:
  - UI regression tests.
  - Manual smoke in setup mode and running mode.

### Task 3.3: Add analysis settings controller handlers

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add input/change handling for `workspace.analysisSettings.*` fields and reset actions.
- **Complexity**: 5
- **Dependencies**: Tasks 1.5, 3.2
- **Acceptance Criteria**:
  - Settings mutate the store before run start.
  - Active analysis locks prevent unsafe mid-run changes or queue reprocess where supported.
  - Settings updates do not accidentally toggle module selection.
- **Validation**:
  - Controller runtime tests.

### Task 3.4: Include analysis settings in deep analysis start

- **Location**:
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/shared/host/runtime-primitives.ts`
  - `rooms/laboratory/host/runtime.ts`
- **Description**: Ensure `startDeepAnalysis` writes normalized `analysisSettings` into workbench context before `process-run` or `audio-process-run`.
- **Complexity**: 5
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Host receives selected settings through active project workbench.
  - Queued interactive reprocess preserves settings.
  - Existing analysis scope fields remain unchanged.
- **Validation**:
  - Host import smoke and controller runtime tests.

### Task 3.5: Add analysis settings i18n

- **Location**:
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
  - runtime i18n TS files
- **Description**: Add labels and summaries for all analysis setting fields and presets.
- **Complexity**: 4
- **Dependencies**: Tasks 3.1, 3.2
- **Acceptance Criteria**:
  - Catalog keys are aligned across English and Turkish.
  - Long labels do not overflow the right panel.
- **Validation**:
  - I18n regression tests.

## Sprint 4: Operation Host Runner Integration

**Goal**: Make existing operation runners honor operation settings and record them in asset metadata.

**Demo/Validation**:
- Running each implemented operation changes output behavior according to settings.
- Created assets include setting metadata.
- Defaults match current output.

### Task 4.1: Normalize operation settings on host

- **Location**:
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  - optional shared host helper `rooms/laboratory/main-functions/media-analysis/host/export-settings.ts`
- **Description**: Add host-side normalization for operation settings so malformed UI payloads cannot produce unsafe ffmpeg args.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Host clamps format, quality, sample rate, frequency, gain, and dimension options.
  - Host defaults match previous hardcoded behavior.
- **Validation**:
  - Host unit tests or focused runtime regression tests.

### Task 4.2: Implement clip export settings

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- **Description**: Honor format, quality/CRF, fps, include audio, ROI crop, and scale settings for `export-timeline-clip`.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - MP4 default remains `libx264` plus AAC.
  - Silent export omits audio.
  - Crop and scale produce valid ffmpeg filter order.
  - Metadata records selected settings.
- **Validation**:
  - Focused export tests using mocked `callRoomTools`.

### Task 4.3: Implement frame and ROI output settings

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- **Description**: Honor frame mode/burst/format/quality and ROI padding/aspect/output size/format.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Existing single PNG frame remains default.
  - Burst mode creates multiple assets or one manifest artifact according to local asset pattern.
  - ROI padding clamps inside source dimensions.
  - Metadata records crop math and settings.
- **Validation**:
  - Mocked ffmpeg args tests.
  - Asset registration tests.

### Task 4.4: Implement enhanced and before-after visual outputs

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- **Description**: Honor enhanced-frame preset/strength/apply-preview settings and connect `before-after-variant` if feasible.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Default enhanced frame uses existing clarity filter.
  - Presets map to bounded ffmpeg filter graphs.
  - Before/after variant is either connected to a runner or remains planned with settings persisted.
- **Validation**:
  - Filter graph tests.
  - UI readiness test for planned vs connected state.

### Task 4.5: Implement audio export and cleanup settings

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- **Description**: Honor audio format, channels, sample rate, timeline-only, cleanup filters, voice band-pass range, Q/width, and gain.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Default audio extract remains WAV 48k stereo.
  - Cleanup default matches existing filter chain.
  - Band-pass defaults match existing voice-focused pass.
  - Frequency ranges are validated and cannot invert.
- **Validation**:
  - Mocked ffmpeg args tests.

### Task 4.6: Plan or connect stem and stabilization runners

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  - `rooms/laboratory/main-functions/audio-analysis/host/process-model-source-separation.ts`
- **Description**: Decide whether `stem-separation`, `segment-stabilization`, and `before-after-variant` become connected operation runners or remain planned with visible settings.
- **Complexity**: 8
- **Dependencies**: Tasks 4.1, 4.4, 4.5
- **Acceptance Criteria**:
  - If connected, operation cards move from blocked/planned to ready when tools are installed.
  - If deferred, UI clearly preserves settings but labels action as planned.
- **Validation**:
  - Readiness selector tests.
  - Manual tool readiness smoke.

## Sprint 5: Analysis Host Runner Integration

**Goal**: Make analysis process runners honor analysis settings and include them in reports/artifact metadata.

**Demo/Validation**:
- Analysis settings change generated probes, filters, thresholds, and model args.
- Reports and artifacts record settings used.

### Task 5.1: Add host-side analysis settings resolver

- **Location**:
  - `rooms/laboratory/shared/host/process-targeting.ts`
  - `rooms/laboratory/shared/host/process-orchestration.ts`
  - optional new `rooms/laboratory/shared/host/analysis-settings.ts`
- **Description**: Resolve normalized analysis settings from project workbench for media and audio process runners.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Media and audio runners receive only normalized settings.
  - Missing settings reproduce current behavior.
  - Process module metadata includes settings summary.
- **Validation**:
  - Host runtime tests.

### Task 5.2: Apply visual structure and reveal settings

- **Location**: `rooms/laboratory/shared/host/process-managed-media-runner.ts`
- **Description**: Apply sampling density/frame step/sensitivity/ROI-only to structure probes and reveal strength/channel/gamma/contrast/edge/histogram settings to reveal filter graphs.
- **Complexity**: 8
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Default probe behavior remains unchanged.
  - Reveal modules use settings-specific bounded filter graphs.
  - ROI-only setting uses active ROI when available and falls back safely.
- **Validation**:
  - Managed media runner tests with mocked tool calls.

### Task 5.3: Apply audio recovery and signal settings

- **Location**: `rooms/laboratory/main-functions/audio-analysis/host/process-local-runners.ts`
- **Description**: Apply sample window, silence threshold, recovery preset, denoise strength, band-pass ranges, phase mode, and gain to ffmpeg filter chains.
- **Complexity**: 8
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Default recovery filters remain current hardcoded values.
  - Filter graph construction is bounded and deterministic.
  - Warnings mention aggressive settings when applicable.
- **Validation**:
  - Filter graph tests and process runner tests.

### Task 5.4: Apply transcription settings

- **Location**:
  - `rooms/laboratory/main-functions/audio-analysis/host/process-local-runners.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/profile-preflight.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/profile-models.ts`
- **Description**: Use selected model policy, language, transcript sample duration, translate/transcribe mode, and selected-range-only where supported by current transcript runtime.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Default transcript sample remains 45 seconds for audio analysis.
  - Unsupported options degrade with a warning instead of failing.
  - Artifact metadata records language/model policy.
- **Validation**:
  - Mocked transcript runtime tests.

### Task 5.5: Apply speaker, prosody, and emotion settings

- **Location**:
  - `rooms/laboratory/main-functions/audio-analysis/host/process-model-speaker-diarization.ts`
  - `rooms/laboratory/main-functions/audio-analysis/host/process-local-runners.ts`
  - openSMILE helper paths under `rooms/laboratory/shared/data/tools/opensmile`
- **Description**: Apply expected speaker policy, min segment seconds, sensitivity, prosody window size, silence threshold, and emotion heuristic sensitivity.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Existing diarization fallback remains available.
  - Settings are reflected in result summaries and warnings.
  - openSMILE config remains path-loaded and safe.
- **Validation**:
  - Mocked model/process tests.

### Task 5.6: Apply sound event, source separation, and music settings

- **Location**:
  - `rooms/laboratory/main-functions/audio-analysis/host/process-model-sound-events.ts`
  - `rooms/laboratory/main-functions/audio-analysis/host/process-model-source-separation.ts`
  - `rooms/laboratory/main-functions/audio-analysis/host/process-model-music-rhythm.ts`
  - `rooms/laboratory/shared/data/tools/yamnet/yamnet_infer.py`
  - `rooms/laboratory/shared/data/tools/music/librosa_music_analysis.py`
- **Description**: Pass top-k/threshold to YAMNet, model/device/stem settings to Demucs, and sample-rate/focus/fallback settings to music analysis.
- **Complexity**: 8
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - YAMNet defaults remain top-k 8 and threshold 0.15.
  - Demucs default remains `htdemucs` on CPU.
  - Music default remains 22050 Hz mono with Essentia fallback if available.
  - CLI helper args remain backward compatible.
- **Validation**:
  - Python helper argument tests where available.
  - Mocked process runner tests.

## Sprint 6: Reporting, Artifacts, And Workspace Feedback

**Goal**: Make settings visible after execution so outputs are auditable.

**Demo/Validation**:
- Generated assets show setting summaries.
- Reports can explain which settings produced each artifact/finding.
- Project workspace can group or filter setting-derived outputs.

### Task 6.1: Record settings metadata on assets and findings

- **Location**:
  - export handlers
  - process runners
  - `rooms/laboratory/shared/host/reporting-audio.ts`
  - report projection files
- **Description**: Add sanitized `settingsUsed` metadata to assets, findings, and process module summaries.
- **Complexity**: 6
- **Dependencies**: Sprints 4 and 5
- **Acceptance Criteria**:
  - Metadata is concise and non-sensitive.
  - Reports can display a human-readable setting summary.
- **Validation**:
  - Report regression tests.

### Task 6.2: Add setting summaries to project assets panel

- **Location**:
  - `rooms/laboratory/ui/lab-project-assets-panel.ts`
  - `rooms/laboratory/ui/project-workspace-overlay.ts`
  - `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Display derived output settings in asset detail/preview contexts.
- **Complexity**: 5
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Summary is scannable and does not overcrowd asset rows.
  - Existing asset actions remain unchanged.
- **Validation**:
  - UI tests and manual asset preview smoke.

### Task 6.3: Add run summary of active settings

- **Location**:
  - `rooms/laboratory/ui/lab-process-strip.ts`
  - `rooms/laboratory/ui/report-overlay.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Show a compact settings summary for active/completed runs.
- **Complexity**: 5
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Summary appears for running and completed runs.
  - Stale report state handles setting changes.
- **Validation**:
  - Process strip/report overlay tests.

## Sprint 7: Regression Coverage And Manual Smoke

**Goal**: Lock down the new settings lifecycle end to end.

**Demo/Validation**:
- Full targeted test suite passes.
- Manual smoke covers each operation group and analysis family.

### Task 7.1: Store and selector regression tests

- **Location**:
  - `scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Cover defaults, patch/reset, clamping, persistence hydration, and selected capability projections.
- **Complexity**: 6
- **Dependencies**: Sprints 1 to 3
- **Acceptance Criteria**:
  - Every operation and analysis settings bucket has at least one default and one patch assertion.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts`

### Task 7.2: Controller and payload regression tests

- **Location**:
  - `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-selection-runtime-regressions.test.ts`
- **Description**: Assert that UI input patches settings, run actions include settings, and active lock behavior is safe.
- **Complexity**: 6
- **Dependencies**: Sprints 2 and 3
- **Acceptance Criteria**:
  - Operation payload settings are asserted for all implemented operations.
  - Deep analysis writes analysis settings before run.
- **Validation**:
  - Focused room tests.

### Task 7.3: Host runner regression tests

- **Location**:
  - existing host/process tests under `scripts/tests`
  - add focused tests if no matching file exists
- **Description**: Mock `callRoomTools` and assert ffmpeg/model args for key settings.
- **Complexity**: 7
- **Dependencies**: Sprints 4 and 5
- **Acceptance Criteria**:
  - Clip, frame, enhanced frame, audio extract, cleanup, voice band, YAMNet, Demucs, and transcript settings are covered.
- **Validation**:
  - `npm run rooms:test:file -- <new-or-existing-host-tests>`

### Task 7.4: UI and i18n regression tests

- **Location**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-i18n-regressions.test.ts`
- **Description**: Ensure settings controls render, no obvious catalog drift, and labels remain localized.
- **Complexity**: 5
- **Dependencies**: Sprints 2 and 3
- **Acceptance Criteria**:
  - English/Turkish setting key coverage is checked.
  - Rendered HTML includes expected controls without duplicating card nesting.
- **Validation**:
  - Focused UI/i18n tests.

### Task 7.5: Manual smoke checklist

- **Location**: Document in final implementation PR or `rooms/laboratory/README.md` if the repo prefers persistent smoke docs.
- **Description**: Run through:
  - Video source: clip, frame, ROI, enhanced frame.
  - Audio/video source with audio: extract, cleanup, voice band.
  - Analysis: visual inspection, audio investigation, transcription, sound events, source separation, music.
  - Reset settings and reload project.
- **Complexity**: 3
- **Dependencies**: Sprints 4 to 6
- **Acceptance Criteria**:
  - Smoke checklist completed with observed outputs.
- **Validation**:
  - Manual verification plus targeted tests.

## Testing Strategy

- Start with typecheck after Sprint 1 because the type surface is broad.
- Run focused room tests after each sprint rather than waiting for full completion.
- Add host runner tests with mocked tool calls before changing ffmpeg args.
- Use manual smoke only after mocked tests show stable payloads.
- Required final validation:
  - `npm run typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - Any new host runner and i18n regression test files.

## Potential Risks And Gotchas

- **Settings explosion**: The right panel can become too dense. Mitigation: collapsed summaries by default, compact controls, and per-module reset.
- **Current preview settings vs run settings**: Visual/audio preview controls currently affect inspection, not necessarily exported outputs. Mitigation: add explicit "apply preview settings" toggles instead of silently binding preview to output.
- **Unsafe ffmpeg construction**: User settings must never become raw filter strings. Mitigation: map bounded presets and clamped numbers to generated filter graphs.
- **Planned operations**: `segment-stabilization`, `before-after-variant`, and `stem-separation` may not all have ready operation runners. Mitigation: settings can exist before runner connection, but readiness must remain honest.
- **Host/UI drift**: UI could expose a setting the host ignores. Mitigation: host tests assert every exposed setting has either behavior or a documented warning.
- **Persistence compatibility**: Existing projects have no settings object. Mitigation: normalization defaults every missing bucket.
- **Tool availability**: Some settings depend on optional tools like Demucs, YAMNet, openSMILE, Essentia, or Whisper. Mitigation: readiness selectors and host fallback warnings.
- **Long-running jobs**: More variants and higher quality settings can increase runtime. Mitigation: show estimates/warnings and preserve cancel behavior.
- **Dirty worktree conflicts**: Several target files are already modified. Mitigation: inspect current diffs before implementation and avoid reverting unrelated changes.

## Rollback Plan

- Settings schema is additive, so rollback can disable UI exposure first while leaving persisted settings inert.
- Revert host runner behavior by ignoring `operationSettings` and `analysisSettings`, preserving default hardcoded paths.
- If persistence causes issues, normalize settings to defaults and keep unknown persisted settings unused.
- If a specific module is unstable, mark its settings as future-ready and hide run-affecting controls behind readiness.

## Implementation Order Summary

1. Add contracts, defaults, normalization, and store events.
2. Add operation UI and payload plumbing.
3. Add analysis UI and process-run plumbing.
4. Apply settings in operation export runners.
5. Apply settings in analysis process runners.
6. Surface settings in assets/reports.
7. Complete regression and manual smoke coverage.
