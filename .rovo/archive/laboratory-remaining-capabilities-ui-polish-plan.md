# Plan: Laboratory Remaining Capabilities And UI Polish

**Generated**: 2026-05-01  
**Estimated Complexity**: High

## Overview

This is a continuation plan for the Laboratory capability split that is already in place. The current baseline has:

- `operation-result` capabilities in `Kontroller > İşlemler`.
- `analysis-report` modules in the right `Analiz Hazırlığı` rail.
- grouped selection guidance for `Önerilen İşlemler` and `Önerilen Analizler`.
- first FFmpeg-backed operation runners for ROI crop and enhanced frame, plus shared operation lineage metadata.

The remaining work should now focus on three tracks:

- **Interaction lifecycle polish**: operation buttons must reflect their own running job, become disabled while active, and show the in-flight operation on the button.
- **Right rail density control**: `Analiz Hazırlığı` intent groups become collapsible drawers, default closed, with targeted auto-open when an analysis suggestion is accepted.
- **Remaining capability scope**: add the next low-risk operation runners, then optional report-oriented providers, then heavier model-backed providers.

## Clarification Gate

No blocking questions remain for planning.

Safe assumptions:

- The right rail defaults all analysis groups closed on fresh source/setup render.
- If a user accepts an `analysis-report` suggestion, the matching analysis group opens automatically even though the default is closed.
- If a user accepts an `operation-result` suggestion, the rail stays visually neutral and `Kontroller > İşlemler` stays focused.
- Operation buttons show only the status for their own mapped `actionId`; one running export does not disable unrelated ready operation cards unless the host job model explicitly blocks concurrent export jobs.
- Group expanded/collapsed state is UI state, not analysis configuration. It must not change selected intents, module toggles, preflight state, or report freshness.
- Analysis group expansion is ephemeral UI state. It defaults closed after hydrate/source/project changes unless the current turn accepts an `analysis-report` suggestion, which can auto-open the relevant group.
- Operation button state must not assume capability `actionId` and tracked host action id are the same. Current capability `actionId` values are UI commands such as `timeline-export-clip`; tracked `LabUserActionEvent.sourceAction` values are host actions such as `export-timeline-clip`.
- External tools remain optional/gated. Tests use fixture payloads first; live binaries are opt-in.

## Current Baseline

- Main operation files:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/workspace-operation-controls.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- Main analysis rail files:
  - `rooms/laboratory/ui/lab-drawer.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- Main regression files:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

External references to consult during implementation:

- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html)
- [Tesseract command line usage](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html)
- [ExifTool](https://exiftool.org/)
- [PySceneDetect docs](https://www.scenedetect.com/docs/latest/)
- [ONNX Runtime docs](https://onnxruntime.ai/docs/)
- [Ultralytics YOLO docs](https://docs.ultralytics.com/)
- [c2patool docs](https://opensource.contentauthenticity.org/docs/c2patool/c2patool-index/)
- [Demucs repository status](https://github.com/facebookresearch/demucs)

## Sprint 1: Operation Button Lifecycle

**Goal**: Make operation buttons communicate active work clearly: when a card action starts, the button becomes disabled and its label/status reflects the running operation.

**Demo/Validation**:

- Click `Clip Export`, `Frame Grab`, `Crop ROI`, or `Enhanced Frame`.
- The clicked card button immediately changes from `Run` to a running label such as `İşleniyor...` or the tracked operation label.
- The active card is disabled until host success/error returns.
- Other cards remain ready unless host concurrency rules block them.
- Tests prove the UI reacts from store state, not direct DOM mutation.

### Task 1.1: Add Operation Action State Projection

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Extend `LabOperationCapabilityProjection` with optional render-state fields:
  - `actionStatus: "idle" | "running" | "success" | "error"`
  - `activeActionLabel`
  - `activeActionMessage`
  - `activeJobId`
  - `activeRequestId`
  - `resultAssetIds`
  - optional `progress` if a future event exposes it.
  Add an explicit mapping from operation capability/UI action id to tracked host source action:
  - `timeline-export-clip` -> `export-timeline-clip`
  - `timeline-grab-frame` -> `export-frame-grab`
  - `workspace-selection-roi-export` -> `export-roi-image`
  - `workspace-enhanced-frame-export` -> `export-enhanced-frame`
  - `timeline-extract-audio` -> `export-audio-track`
  - future operation UI ids -> their tracked host action ids.
- **Complexity**: 5
- **Dependencies**: current `getAvailableOperationCapabilities`, current `LabUserActionEvent`.
- **Acceptance Criteria**:
  - Projection maps capability `actionId` through the explicit UI-action to host-action mapping before comparing with `LabUserActionEvent.sourceAction`.
  - Running action state is scoped by active project.
  - Planned or blocked cards still use readiness/block reason as the primary disabled state.
  - Completed/error state can be displayed without re-enabling stale in-flight UI incorrectly.
  - The mapping is exported or otherwise shared so controller dispatch and selector projection cannot drift silently.
- **Validation**:
  - Add selector assertions to `scripts/tests/laboratory-source-ui-regressions.test.ts`.

### Task 1.2: Render Dynamic Button States

- **Location**:
  - `rooms/laboratory/ui/workspace-operation-controls.ts`
  - `rooms/laboratory/ui/lab-theme.css`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Replace static `Run/Planned` button copy with status-aware copy:
  - ready idle: `Run`
  - queued/running: tracked action label or `İşleniyor...`
  - success: short success label until action drops from visible history
  - error: short retry-safe error label plus title message
  - blocked/planned: current disabled behavior.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Running button has `disabled`, `aria-busy="true"`, and `data-action-status="running"`.
  - Text does not overflow operation cards.
  - Status style is visible but not visually louder than the card title.
  - Error state does not auto-trigger retries.
- **Validation**:
  - Extend `laboratory workspace inspector exposes operation-result controls` test.
  - Add a focused test for running and error button HTML.

### Task 1.3: Preserve Action/Host Event Synchronization

- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-user-actions.ts`
  - `rooms/laboratory/shared/host/action-router.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- **Description**: Verify every operation card action maps through a tracked user action and receives host job events:
  - `export-timeline-clip`
  - `export-frame-grab`
  - `export-roi-image`
  - `export-enhanced-frame`
  - `export-audio-track`
  - future `export-clean-audio`
  - future `export-band-pass-voice`
  - future `export-stem-separation`
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Running and completed job events update the same `LabUserActionEvent`.
  - Request id fallback still marks failed request-result events when no job id arrives.
  - No operation button depends on querying DOM state.
- **Validation**:
  - Extend `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`.
  - Extend `scripts/tests/laboratory-runtime-event-v2-regressions.test.ts` if job event correlation is touched.

## Sprint 2: Collapsible Analysis Preparation Rail

**Goal**: Make right rail analysis groups collapsible, default closed, compact, keyboard-accessible, and safe for high module counts.

**Demo/Validation**:

- On first render, `Visual inspection`, `Audio investigation`, `Detail enhancement`, and `Anomaly detection` are visible as closed headers.
- Clicking a header opens its module list.
- Accepting `audio-inspect` opens `Audio investigation`; accepting `metadata-audit` opens the relevant visual/audio forensic group.
- Module checkboxes only appear inside an open group.

### Task 2.1: Add Analysis Group UI State

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add a small UI-only state container for expanded analysis groups:
  - suggested shape: `ui.workspace.analysisPrepExpandedIntentIds: LabIntentId[]`
  - new event: `analysis-prep-group-toggled`
  - optional event: `analysis-prep-group-expanded` for targeted auto-open.
- **Complexity**: 5
- **Dependencies**: existing `LabIntentId`, `workspace-selection-suggestion-accepted`.
- **Acceptance Criteria**:
  - Default value is empty.
  - Hydration drops invalid intent ids.
  - Hydration/source/project changes reset expansion to empty unless the current accepted analysis suggestion reopens a group.
  - This state is not saved into report, analysis scope, module toggles, or report freshness.
  - `lab-run-controller.ts` routes the new `data-lab-action` for accordion toggles into the store event.
- **Validation**:
  - Add reducer tests in `scripts/tests/laboratory-source-ui-regressions.test.ts` or a runtime store regression file.
  - Add controller coverage for the new `data-lab-action` path.

### Task 2.2: Render Intent Groups As Accordions

- **Location**:
  - `rooms/laboratory/ui/lab-drawer.ts`
  - `rooms/laboratory/ui/lab-theme.css`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Convert each `.labx-drawer__intent-cluster` into an accordion-like group:
  - Header row contains intent checkbox, title, readiness, enabled module count, and chevron.
  - Split the current `renderAnalysisPreparationGroup` into header summary and module body helpers; do not wrap the existing full group markup inside another header.
  - Body contains module rows, blocked reasons, and report outputs only.
  - Closed body is not visually rendered except summary counts.
  - Use `button` or `summary` semantics with `aria-expanded`.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - All groups default closed.
  - The intent checkbox remains usable without accidentally toggling accordion state.
  - Keyboard users can tab to the disclosure control and module checkboxes.
  - Dense module lists no longer dominate the rail in the default state.
- **Validation**:
  - UI snapshot/string tests assert closed default and open state.
  - CSS tests assert accordion classes exist and no old always-open module list is required.

### Task 2.3: Auto-Open Relevant Analysis Suggestion Targets

- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: When accepting an `analysis-report` suggestion, open the intent group(s) that contain the target `analysisCapabilityId`.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `inspect-audio` opens `Audio investigation`.
  - `detect-scenes` opens the visual inspection/motion-related group.
  - `metadata-audit` opens the group that owns the mapped capability for the current source kind.
  - `operation-result` suggestions do not open right rail analysis groups.
- **Validation**:
  - Extend `laboratory analysis suggestion acceptance opens and highlights the preparation rail`.
  - Preserve the existing operation suggestion test that avoids analysis rail highlight.

## Sprint 3: Remaining Low-Risk Operation Runners

**Goal**: Convert the highest-value planned operation cards into real, asset-producing runners while preserving derived-evidence labeling.

**Demo/Validation**:

- User can create a cleaned audio asset from a video/audio source.
- User can create a band-pass voice asset.
- User can create a before/after comparison variant for visual enhancement.
- Stem separation and stabilization remain gated unless their provider is ready.

### Task 3.1: FFmpeg Audio Cleanup Runner

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-user-actions.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/shared/host/action-router.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
- **Description**: Add `export-clean-audio` action using conservative FFmpeg filters such as noise reduction, normalization, and optional high/low pass chains.
- **Complexity**: 7
- **Dependencies**: Sprint 1 button lifecycle.
- **Acceptance Criteria**:
  - Generates a WAV asset.
  - Metadata includes `operationId: "audio-cleanup"`, `flowKind`, `filterPreset`, `sourceRange`, source linkage, and `evidenceRole: "derived"`.
  - Works for both audio source and video source with audio stream.
  - Block reason is explicit when no audio track is available.
- **Validation**:
  - Host action tests for args, lineage metadata, cancelled job behavior, and result asset id.

### Task 3.2: FFmpeg Band-Pass Voice Runner

- **Location**:
  - same files as Task 3.1
- **Description**: Add `export-band-pass-voice` action as a separate operation from generic audio cleanup.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Uses a clear voice-focused preset and records exact filter parameters in metadata.
  - Button label and result asset name distinguish it from generic cleanup.
  - Does not overwrite or replace original audio.
- **Validation**:
  - Host action tests plus operation card readiness test.

### Task 3.3: Before/After Visual Variant Preview

- **Location**:
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  - `rooms/laboratory/ui/lab-asset-preview-overlay.ts`
  - `rooms/laboratory/ui/workspace-operation-controls.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Turn `before-after-variant` into a real derived comparison asset that references original and enhanced output ids.
- **Complexity**: 8
- **Dependencies**: existing enhanced frame runner.
- **Acceptance Criteria**:
  - Comparison metadata links original source asset and generated enhanced asset.
  - Preview overlay can show original/enhanced side by side.
  - Comparison asset is never treated as raw evidence.
- **Validation**:
  - Asset lineage tests.
  - Preview overlay UI tests.

### Task 3.4: Gate Stabilization And Stem Separation Properly

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/data/tools/laboratory-capability-groups.json`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Keep stabilization and Demucs stem separation planned unless provider readiness is trustworthy.
- **Complexity**: 5
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - Demucs readiness notes account for the upstream repository archive status and local install reality.
  - Stabilization states whether it needs FFmpeg `vidstab` availability or another runner.
  - Planned cards explain the concrete missing runner, not a generic blocked state.
- **Validation**:
  - Readiness projection tests for installed/missing/planned tool states.

## Sprint 4: Report-Oriented Provider Runners

**Goal**: Add the first optional analysis/report providers that create structured report evidence without blocking the base Laboratory experience.

**Demo/Validation**:

- If optional binaries are missing, modules are blocked as unavailable.
- If fixture outputs are supplied in tests, parsers produce report artifacts.
- Reports display OCR, metadata/provenance, and scene boundary sections.

### Task 4.1: Provider Manifest And Probe Policy

- **Location**:
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/data/tools/laboratory-capability-groups.json`
  - `rooms/laboratory/shared/host/project-tool-status.ts`
  - `rooms/laboratory/shared/host/runtime-bootstrap.ts`
- **Description**: Add explicit provider metadata for Tesseract, ExifTool, MediaInfo, c2patool, PySceneDetect, ONNX Runtime, YOLO/OpenCV/MediaPipe shells.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Providers can be `planned`, `optional`, `blocked`, or `ready`.
  - Metadata-only planned providers do not trigger noisy probes.
  - System-command providers have clear probe commands and platform notes.
- **Validation**:
  - Tool manifest tests and stage decoupling tests.

### Task 4.2: Minimal Report Artifact Contract For New Providers

- **Location**:
  - `rooms/laboratory/shared/host/reporting.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
  - `rooms/laboratory/services/report-builder.ts`
  - `rooms/laboratory/ui/report-overlay.ts`
- **Description**: Before runner work, add the minimal report section/artifact contract needed by metadata, provenance, OCR, and scene outputs.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - New provider artifacts can declare section id, provider id, module id, artifact id, and evidence role.
  - Gated/unavailable modules can render as unavailable without pretending a runner failed.
  - Operation outputs can be referenced as derived evidence without becoming analysis findings.
- **Validation**:
  - Report composition tests with fixture artifact records.

### Task 4.3: Metadata And Provenance Runner

- **Location**:
  - new host runner under `rooms/laboratory/shared/host/`
  - `rooms/laboratory/main-functions/media-analysis/host/source-metadata.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
  - `rooms/laboratory/ui/report-overlay.ts`
- **Description**: Add optional ExifTool/MediaInfo/c2patool-backed parsing.
- **Complexity**: 8
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - FFprobe remains fallback.
  - ExifTool/MediaInfo enrich technical metadata when available.
  - c2patool reports provenance as verified, missing, invalid, or unavailable.
  - Report separates factual metadata from interpretation.
- **Validation**:
  - Fixture parser tests.
  - Report composition tests.

### Task 4.4: Tesseract OCR Runner

- **Location**:
  - new host runner under `rooms/laboratory/main-functions/media-analysis/host/`
  - `rooms/laboratory/shared/host/analysis-artifact-runtime.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
- **Description**: Prepare selected frame/ROI with FFmpeg, run Tesseract, parse text and confidence where available, and emit report evidence.
- **Complexity**: 8
- **Dependencies**: Task 4.2 and ROI/frame export paths.
- **Acceptance Criteria**:
  - OCR only runs for image/video frame or ROI contexts.
  - Missing Tesseract produces blocked/unavailable, not failed analysis.
  - OCR artifact stores source frame/ROI lineage.
- **Validation**:
  - Fixture parser tests.
  - UI/report tests for OCR evidence section.

### Task 4.5: PySceneDetect Scene Boundary Runner

- **Location**:
  - new host runner under `rooms/laboratory/main-functions/media-analysis/host/`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
- **Description**: Add optional scene boundary analysis for video sources.
- **Complexity**: 8
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Scene list contains start/end timestamps and confidence/threshold metadata where available.
  - Timeline can render scene markers without confusing them with user selections.
  - Report includes scene boundary table.
- **Validation**:
  - Parser fixture tests.
  - Timeline marker hydration tests.

## Sprint 5: Model Provider Shell And Heavy Capabilities

**Goal**: Add model-backed capabilities only after low-risk operations and report providers are stable.

**Demo/Validation**:

- Model providers can appear as optional/gated modules.
- No model downloads occur implicitly.
- Fixture outputs can drive UI/report tests without live inference.

### Task 5.1: Generic Model Provider Runtime

- **Location**:
  - new `rooms/laboratory/shared/host/model-provider-runtime.ts`
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/host/project-tool-status.ts`
- **Description**: Add a generic wrapper for ONNX Runtime or command-based model providers.
- **Complexity**: 8
- **Dependencies**: Sprint 4 provider manifest work.
- **Acceptance Criteria**:
  - Provider readiness distinguishes package missing, model missing, unsupported platform, and ready.
  - Model path is explicit and user-controlled.
  - Runner outputs use common artifact schema.
- **Validation**:
  - Stubbed provider tests.

### Task 5.2: Object / Person / Region Analysis

- **Location**:
  - new runners under `rooms/laboratory/main-functions/media-analysis/host/`
  - `rooms/laboratory/shared/data/tools/visual-analysis-catalog.json`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
- **Description**: Add YOLO/OpenCV/MediaPipe/ONNX-backed object and region evidence as optional modules.
- **Complexity**: 9
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Output includes labels, confidence, bounding boxes, frame/time span, and model id.
  - Report clearly labels model inference as derived analysis.
  - ROI-limited inference is supported when ROI exists.
- **Validation**:
  - Fixture JSON parser tests.
  - Report and overlay rendering tests.

### Task 5.3: Super-Resolution / Deblur Operation

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/ui/workspace-operation-controls.ts`
  - new model-backed operation runner
  - `rooms/laboratory/ui/lab-asset-preview-overlay.ts`
- **Description**: Add Real-ESRGAN or ONNX-backed image/frame enhancement as an optional operation.
- **Complexity**: 9
- **Dependencies**: Task 5.1 and Sprint 3 comparison preview.
- **Acceptance Criteria**:
  - Output is visibly marked as derived/enhanced.
  - Before/after preview is the default inspection surface.
  - Original evidence is never overwritten.
- **Validation**:
  - Asset lineage tests.
  - Preview overlay comparison tests.

## Sprint 6: Report Integration And Evidence Boundaries

**Goal**: Make all new operation outputs and analysis artifacts appear in reports with explicit evidence roles and no ambiguity between derived assets and findings.

**Demo/Validation**:

- Operation outputs can be attached as supporting evidence.
- Analysis findings remain grouped under analysis/report modules.
- Report freshness reacts only to report-affecting changes.

### Task 6.1: Full Report Section UI And Export Polish

- **Location**:
  - `rooms/laboratory/shared/host/reporting.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
  - `rooms/laboratory/services/report-builder.ts`
  - `rooms/laboratory/ui/report-overlay.ts`
- **Description**: Expand the minimal Sprint 4 report artifact contract into the final user-facing report UI/export structure for metadata, provenance, OCR, scene boundaries, object/region evidence, derived operation outputs, and model inference notes.
- **Complexity**: 7
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Each section declares source module, provider, artifact id, and evidence role.
  - Gated modules render as unavailable when selected but missing.
  - Derived operation assets are referenced, not counted as original evidence.
- **Validation**:
  - Report composition tests.
  - Overlay rendering tests.

### Task 6.2: Evidence Attachment Policy

- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-project-assets-panel.ts`
  - `rooms/laboratory/ui/report-overlay.ts`
- **Description**: Decide how a user attaches operation outputs to report evidence without automatic pollution.
- **Complexity**: 7
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Operation outputs default to `derived` and unattached.
  - User can explicitly attach/detach a derived asset to a report section.
  - Attachment changes report freshness intentionally.
- **Validation**:
  - Store and UI tests for attach/detach.

## Sprint 7: UX, Accessibility, And Full Regression Pass

**Goal**: Keep the expanded Laboratory usable at the density shown in the screenshot.

**Demo/Validation**:

- At 1920x1080, the center preview, operations drawer, right rail, timeline, and process strip remain readable.
- At narrower widths, no button text or module row overlaps.

### Task 7.1: Dense UI Polish

- **Location**:
  - `rooms/laboratory/ui/lab-theme.css`
  - `rooms/laboratory/ui/workspace-operation-controls.ts`
  - `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Polish operation cards and right rail accordions:
  - fixed button min-width
  - progress/status chips
  - compact module counts
  - clear disabled reasons
  - no nested card-in-card visual clutter.
- **Complexity**: 5
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Buttons do not resize cards when label changes.
  - Accordion headers remain scannable when all groups are closed.
  - Focus rings are visible.
- **Validation**:
  - UI string tests and, if available, Electron screenshot smoke.

### Task 7.2: I18n And Copy Audit

- **Location**:
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/ui/lab-runtime-i18n.ts`
- **Description**: Move new visible labels out of hardcoded fallbacks where practical.
- **Complexity**: 4
- **Dependencies**: all UI tasks.
- **Acceptance Criteria**:
  - English/Turkish catalog parity holds.
  - Button lifecycle labels, accordion labels, provider blocked reasons, and report section names are localized.
- **Validation**:
  - Existing i18n parity test.

### Task 7.3: Full Room Validation

- **Location**:
  - test suite
  - room build scripts
- **Description**: Run focused and broad validation after all changes.
- **Complexity**: 5
- **Dependencies**: all previous sprints.
- **Acceptance Criteria**:
  - Targeted Laboratory suites pass.
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:lint` passes.
  - `git diff --check` passes.
  - No installed-room generated copy is manually edited.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `git diff --check`

## Testing Strategy

- Start with selector/store tests for button lifecycle and accordion state.
- Then add UI rendering assertions for button labels, disabled states, `aria-busy`, `aria-expanded`, default closed groups, and targeted auto-open.
- Then add host runtime tests for new operation runners and lineage metadata.
- Provider runner tests must be fixture-based and must not require live binaries in CI.
- Use live local tool execution only as an optional smoke once fixture tests pass.
- Keep operation/result actions separate from selected analysis capabilities in every test.

## Potential Risks And Gotchas

- **Button state drift**: host job events can arrive after the local action event. Mitigation: key by `requestId` first, then `jobId`, and keep request-result fallback.
- **Concurrent export ambiguity**: current host export jobs cancel prior export jobs. Mitigation: operation selector should show the action that actually remains active and not imply parallel export support.
- **Accordion checkbox conflict**: clicking the intent checkbox could accidentally open/close the group. Mitigation: separate checkbox and disclosure controls.
- **Default closed hiding warnings**: closed groups may hide blocked module details. Mitigation: header shows readiness, blocked count, and short warning summary.
- **Derived evidence ambiguity**: enhanced or cleaned assets can be mistaken for originals. Mitigation: preserve `evidenceRole: "derived"` and show derived labels in preview/report.
- **External provider churn**: Demucs upstream is archived, and heavy ML providers vary by platform. Mitigation: keep providers optional, fixture tested, and explicit about local installation.
- **Noisy probes**: metadata-only planned providers can slow startup if probed automatically. Mitigation: probe only installed/system-command providers with explicit manifest support.
- **Report pollution**: operation outputs should not become findings automatically. Mitigation: add explicit attach/detach policy before report integration.

## Rollback Plan

- Sprint 1 rollback: remove action state fields from operation projections and revert button renderer to static labels.
- Sprint 2 rollback: keep analysis group rendering always open and remove `analysisPrepExpandedIntentIds` from store state.
- Sprint 3 rollback: set newly added operation capabilities back to `planned: true` and remove action router entries for unstable runners.
- Sprint 4 rollback: mark optional providers as planned metadata-only and disable host runner dispatch.
- Sprint 5 rollback: remove model provider runner registrations while preserving fixture parser code if harmless.
- Sprint 6 rollback: hide new report sections behind feature/provider availability and keep operation outputs visible only in project assets.
