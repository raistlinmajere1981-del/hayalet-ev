# Plan: Laboratory Controls And Analysis Capability Expansion

**Generated**: 2026-04-30  
**Estimated Complexity**: High

## Overview

Laboratory already has two strong but partially overlapping surfaces:

- The center workspace `Kontroller` drawer is good for immediate preview and output-oriented work.
- The right rail `Analiz Hazırlığı` plus the selection guidance panel is good for intent, scope, analysis modules, and report-oriented work.

This plan splits the capability model into two explicit groups:

- **Operation / Result**: actions that generate a concrete asset such as enhanced frame, cropped ROI, denoised audio, isolated stem, stabilized review clip, extracted clip, or before/after variant.
- **Analysis / Report**: actions that produce findings, evidence, metrics, metadata, OCR text, object/scene markers, provenance notes, confidence summaries, and report sections.

The implementation should first reuse existing tools and flows, then add optional external tools as gated providers. Heavy model tools should not block the base experience.

## Assumptions

- No blocking product decision is needed to create this implementation plan.
- `rooms/laboratory` remains the source of truth; generated `data/rooms/laboratory` is not edited directly.
- First runnable increment uses existing FFmpeg, Whisper.cpp, openSMILE, YAMNet, librosa, Demucs, pyAudioAnalysis surfaces.
- New heavy tools such as Real-ESRGAN, ONNX Runtime, YOLO, MediaPipe, Tesseract, ExifTool, MediaInfo, PySceneDetect, and c2patool are introduced as optional/gated tool descriptors before full runners.
- `Kontroller` gets a third `İşlemler` tab rather than overloading the existing `Ses Odağı` and `Görsel Ayarlar` tabs.
- Analysis preparation keeps the current four high-level intents, but each intent expands into visible module families and tool readiness.
- Operation/result capabilities do not reuse `CapabilityFamilyId` or `selectedCapabilities`; those remain analysis/preflight concepts.

## Prerequisites

- Confirm current room build and test commands still pass before implementation.
- Existing workspace source in `rooms/laboratory/**`.
- Optional external tool research should be pinned to official docs during implementation:
  - FFmpeg filters: https://ffmpeg.org/ffmpeg-filters.html
  - OpenCV docs: https://docs.opencv.org/4.x/
  - Tesseract docs: https://tesseract-ocr.github.io/tessdoc/
  - ExifTool: https://exiftool.org/
  - PySceneDetect: https://www.scenedetect.com/docs/latest/
  - ONNX Runtime: https://onnxruntime.ai/docs/
  - Ultralytics YOLO: https://docs.ultralytics.com/
  - C2PA c2patool: https://opensource.contentauthenticity.org/docs/c2patool/c2patool-index/

## Sprint 1: Capability Contract Split

**Goal**: Create a clean internal contract for `operation-result` and `analysis-report` capabilities without changing behavior yet.

**Demo/Validation**:

- Existing Laboratory UI renders unchanged.
- Selectors can list capabilities by group.
- Current tests for stage decoupling and selection suggestions still pass.

### Task 1.1: Add Capability Group Types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add a capability grouping contract:
  - `LabCapabilityFlowKind = "operation-result" | "analysis-report"`
  - `LabOperationCapabilityId` for operation/result actions such as clip export, frame grab, ROI crop, enhanced frame, clean audio, stem separation, and stabilization.
  - Keep `CapabilityFamilyId` as the analysis/report family type used by preflight and `startDeepAnalysis`.
  - Optional fields on operation metadata: `flowKind`, `outputKinds`, `providerIds`, `toolIds`, `sourceKinds`, `requiresSelection`, `requiresRoi`.
  - Optional fields on `LabActionSuggestion`: `flowKind`, `operationCapabilityId`, `analysisCapabilityId`, `toolIds`, `outputKind`.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Existing action suggestions remain valid.
  - Operation/result entries never mutate `selectedCapabilities`.
  - TypeScript callers do not need immediate updates.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-selection-runtime-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts`

### Task 1.2: Add Capability Registry Metadata

- **Location**:
  - `rooms/laboratory/shared/data/tools/edit-capabilities.json`
  - `rooms/laboratory/shared/data/tools/visual-analysis-catalog.json`
  - `rooms/laboratory/shared/data/tools/audio-analysis-catalog.json`
  - Optional new file: `rooms/laboratory/shared/data/tools/laboratory-capability-groups.json`
- **Description**: Mark existing capabilities by group:
  - Operation/result: clip export, frame grab, ROI crop, visual reveal variant, audio cleanup, stem export.
  - Analysis/report: visual structure, audio signal health, transcription, diarization, prosody, sound events, music descriptors, synthetic/AI artifact detection.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Metadata can answer: source kind, flow kind, tool requirements, expected output.
  - Existing visual/audio catalogs keep backward-compatible module ids.
  - Operation registry can be loaded without projecting operation ids into analysis module ids.
- **Validation**:
  - Add/update tests in `scripts/tests/laboratory-stage-decoupling-regressions.test.ts`.

### Task 1.3: Normalize Tool Readiness By Capability

- **Location**:
  - `rooms/laboratory/shared/host/runtime-bootstrap.ts`
  - `rooms/laboratory/shared/host/room-snapshot.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add selectors that project tool readiness into operation and analysis groups.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - FFmpeg appears in both groups.
  - Whisper/openSMILE/YAMNet/librosa/pyAudioAnalysis appear under analysis/report.
  - Demucs appears in operation/result and analysis/report because it creates isolated tracks and reportable stem evidence.
  - Operation readiness and analysis readiness are exposed through separate selectors.
- **Validation**:
  - Add readiness assertions to `scripts/tests/laboratory-stage-decoupling-regressions.test.ts`.

## Sprint 2: Controls Drawer Operation Tab

**Goal**: Add operation/result capabilities to the `Kontroller` panel as a third tab while preserving current audio and visual controls.

**Demo/Validation**:

- With a video selection active, `Kontroller > İşlemler` shows clip, frame, ROI, visual enhancement, audio cleanup, and stem actions.
- With an image source, it shows ROI/frame enhancement actions only.
- With an audio source, it shows audio cleanup and stem actions.

### Task 2.1: Extend Workspace Control Tabs

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-persistence.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Change `LabWorkspaceControlTab` from `audio | visual` to `audio | visual | operations`. Update all tab normalization points in one commit:
  - type union
  - store defaults
  - persisted state hydration
  - controller `readWorkspaceControlTab` normalizer
  - invalid persisted tab fallback
  - source-kind change fallback when the active tab is no longer relevant
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Existing `audio` and `visual` tab behavior remains unchanged.
  - `operations` tab only appears when at least one operation capability is relevant.
  - Invalid persisted tab values fall back without throwing or opening an empty drawer.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 2.2: Create Operation Controls Renderer

- **Location**:
  - New: `rooms/laboratory/ui/workspace-operation-controls.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Render operation/result cards grouped by output:
  - Clip: `Export Clip`, `Stabilize Segment` gated.
  - Frame/image: `Grab Frame`, `Enhanced Frame`, `Crop ROI`, `Before/After Variant`.
  - Audio: `Clean Audio`, `Band-pass Voice`, `Extract Audio`.
  - Stems: `Separate Sources` when Demucs is ready.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Cards show tool readiness and whether output creates a project asset.
  - Buttons are disabled with clear reason when source, selection, ROI, or tool is missing.
  - No visible tool-name leakage in primary labels; tool names can appear in readiness detail.
- **Validation**:
  - Add UI assertions to `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 2.3: Wire Operation Actions To Existing Host Actions

- **Location**:
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/shared/host/action-router.ts`
  - `rooms/laboratory/models/lab-user-actions.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-edit.ts`
  - `rooms/laboratory/shared/host/tool-mutations.ts`
- **Description**: Map operation cards to existing or near-existing actions:
  - Clip export uses current export clip path.
  - Frame grab uses current grab frame path.
  - ROI crop/enhanced frame requires new explicit action ids and handlers.
  - Audio cleanup and band-pass voice require new explicit action ids and handlers.
  - Demucs stem export should reuse the source separation runner only after a dedicated operation wrapper exists.
  - Stabilization remains gated until a concrete handler exists.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Every operation either creates a project asset or gives a blocked reason.
  - `LabUserActionType`, user action labels, action router entries, host handler ids, and UI button actions stay aligned.
  - Outputs preserve source lineage and intent ids.
  - User action strip shows operation progress and result asset names.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-media-edit-behavior-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 2.4: Add Before/After Variant Preview

- **Location**:
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-asset-preview-overlay.ts`
- **Description**: Make generated operation variants previewable in-place with original/enhanced comparison metadata.
- **Complexity**: 7
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Enhanced frame/ROI/audio variants can be previewed from the operation tab and asset grid.
  - Comparison variants do not mutate analysis findings.
- **Validation**:
  - Extend `scripts/tests/laboratory-source-ui-regressions.test.ts` and `scripts/tests/laboratory-project-workspace-regressions.test.ts`.

## Sprint 3: Analysis Preparation Panel Expansion

**Goal**: Make the right `Analiz Hazırlığı` panel explicitly show analysis/report capability groups, module toggles, readiness, and report impact.

**Demo/Validation**:

- Selecting `Visual inspection` shows visual structure and visual forensics modules.
- Selecting `Audio investigation` shows audio signal, recovery, speaker, and transcription readiness.
- Selecting `Anomaly detection` shows visual forensics, sound events, prosody/emotion, and music analysis.

### Task 3.1: Build Analysis Capability Selector Model

- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/runtime/selectors/lab-source-selectors.ts`
  - `rooms/laboratory/models/lab-types.ts`
- **Description**: Add a selector that returns analysis modules grouped under active workspace intents with:
  - module id
  - display label
  - flow kind
  - required tools
  - readiness state
  - report section target
  - stale/preflight warnings
  - ownership boundary: `lab-drawer.ts` owns analysis preparation; `workspace-surface.ts` owns selection guidance through `surface.side`
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Existing intent-derived capability logic remains authoritative.
  - Module readiness changes when tool state changes.
  - Existing `workbench.moduleToggles` remains the toggle source; no parallel module state is introduced.
- **Validation**:
  - Add selector tests to `scripts/tests/laboratory-stage-decoupling-regressions.test.ts`.

### Task 3.2: Render Analysis Modules In Right Rail

- **Location**:
  - likely `rooms/laboratory/ui/lab-drawer.ts`
  - `rooms/laboratory/ui/lab-center-panel.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Replace the plain intent checklist with an expandable structure:
  - Top: selected high-level intents.
  - Middle: analysis/report modules under each intent.
  - Bottom: preflight/readiness warnings and expected report outputs.
  - Early report-section preview for each module, so the rail does not promise modules that report grouping cannot display.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The existing `Analizi Başlat` CTA still works.
  - Module toggles update `workbench.moduleToggles`.
  - Tool readiness is visible without making the UI feel like a settings page.
  - New or planned module ids are mapped into `CAPABILITY_MODULE_GROUPS` and report grouping before being shown as report-producing modules.
- **Validation**:
  - Extend `scripts/tests/laboratory-source-ui-regressions.test.ts`.

### Task 3.3: Add New Optional Analysis Providers As Gated Modules

- **Location**:
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/data/tools/visual-analysis-catalog.json`
  - `rooms/laboratory/shared/data/tools/audio-analysis-catalog.json`
  - `rooms/laboratory/shared/data/tools/visual-analysis-providers.json`
  - `rooms/laboratory/shared/data/tools/audio-analysis-providers.json`
- **Description**: Add metadata-only providers for:
  - Metadata/provenance: ExifTool, MediaInfo, c2patool.
  - OCR: Tesseract.
  - Scene segmentation: PySceneDetect.
  - Object/pose/region intelligence: OpenCV, YOLO, MediaPipe, ONNX Runtime.
  - AI/synthetic artifact model lane: ONNX Runtime-backed planned provider.
  - Advanced diarization: pyannote.audio as optional future upgrade.
  - Keep planned providers in provider catalogs where possible; add to `toolchain.manifest.json` only when lifecycle/probe behavior is intentionally supported.
- **Complexity**: 6
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - New providers appear as planned/gated unless installed and runner-backed.
  - Current base analysis remains available without these tools.
  - Tool Manager does not start noisy probes for metadata-only planned providers.
  - `availability`, `plannedReason`, `system-command`, and probe behavior are explicit for every new tool id.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/room-tool-service-regressions.test.ts scripts/tests/laboratory-stage-decoupling-regressions.test.ts`

### Task 3.4: Add Report Section Mapping

- **Location**:
  - `rooms/laboratory/shared/host/reporting.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
  - `rooms/laboratory/ui/report-overlay.ts`
  - `rooms/laboratory/services/report-builder.ts`
- **Description**: Map new analysis modules into report sections:
  - Technical metadata
  - Provenance
  - OCR/text evidence
  - Scene boundaries
  - Object/person/pose tracks
  - Visual forensics
  - Audio signal and speech
- **Complexity**: 7
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Reports group findings by intent and module.
  - Gated modules show as unavailable, not failed.
  - Operation outputs can be referenced as evidence but are not counted as analysis findings by default.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-report-composition-v2-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts`

## Sprint 4: Selection Guidance Split

**Goal**: Split the right selection guidance panel into operation suggestions and analysis/report suggestions.

**Demo/Validation**:

- A selected clip shows operation actions such as `Bu bölümü kes`, `Enhanced Frame`, `Clean Audio`.
- The same selection shows analysis suggestions such as `Hareket tutarlılığını incele`, `OCR tara`, `Metadata/provenance kontrolü`.
- Accepting a suggestion still goes through the passive execution planning chain before any real action.

### Task 4.1: Extend Suggestion Taxonomy

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`
- **Description**: Add suggestion flow kind and new action types:
  - Operation: `enhance-frame`, `crop-region`, `clean-audio`, `separate-stems`, `stabilize-segment`, `extract-clip`.
  - Analysis: `analyze-segment`, `inspect-motion`, `inspect-audio`, `ocr-region`, `metadata-audit`, `detect-scenes`, `detect-objects`.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Existing action types remain compatible.
  - Suggestions are source-kind aware and ROI-aware.
- **Validation**:
  - Extend `scripts/tests/laboratory-selection-runtime-regressions.test.ts`.

### Task 4.2: Render Grouped Selection Suggestions

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Split selection panel suggestion rendering into:
  - `Önerilen İşlemler`
  - `Önerilen Analizler`
  - optional `Gated / araç gerekli` hints
  - Keep the selection guidance panel separate from `Analiz Hazırlığı`; it recommends context-aware next steps, while the right rail owns run configuration.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Current screenshot’s recommendation area becomes clearer without growing into a noisy tool list.
  - Tool hints remain secondary.
- **Validation**:
  - Extend `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 4.3: Update Passive Execution Chain

- **Location**:
  - `rooms/laboratory/runtime/lab-execution-descriptor.ts`
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
  - `rooms/laboratory/runtime/lab-execution-bridge.ts`
  - `rooms/laboratory/runtime/lab-execution-payload-preview.ts`
  - `rooms/laboratory/runtime/lab-execution-reflection.ts`
  - `rooms/laboratory/runtime/lab-execution-alternatives.ts`
- **Description**: Add descriptor/plan/payload mappings for new operation and analysis actions.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Every new suggestion has dry-run plan, simulation, readiness, payload preview, reflection, and alternatives.
  - No action directly executes from the passive selection suggestion panel.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`

### Task 4.4: Connect Accepted Suggestions To Correct UI Surface

- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: When a suggestion is accepted:
  - Operation/result suggestions focus `Kontroller > İşlemler`.
  - Analysis/report suggestions focus the right `Analiz Hazırlığı` module group.
  - Existing selection and ROI remain untouched.
  - Acceptance only focuses or stages the relevant surface; it must not start an operation, run analysis, or bypass the current preview-before-accept chain.
- **Complexity**: 6
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - Accepting `enhance-frame` opens operations tab with the matching card highlighted.
  - Accepting `metadata-audit` highlights the matching analysis module in the right rail.
- **Validation**:
  - Add controller tests to `scripts/tests/laboratory-controller-runtime-regressions.test.ts`.

## Sprint 5: First Real New Runners

**Goal**: Implement the highest-value new capabilities with low dependency risk.

**Demo/Validation**:

- User can generate an enhanced frame/ROI asset from `Kontroller`.
- User can run metadata/OCR/scene analysis modules when optional tools are ready.

### Task 5.1: FFmpeg Enhanced Frame And ROI Output

- **Location**:
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/edit-artifacts.ts`
  - `rooms/laboratory/shared/host/project-records.ts`
- **Description**: Add operation outputs using existing FFmpeg filters:
  - enhanced frame
  - ROI crop
  - reveal variant pack
  - normalized ROI to pixel crop conversion
  - source-dimension lookup from metadata/ffprobe
  - clamp to source bounds
  - integer and even-dimension handling for video encoders
  - separate image and video crop paths
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Output assets are registered with lineage.
  - Each output records `operationId`, `flowKind`, filter preset, source range, ROI, original asset id, `evidenceRole: "derived"`, and source dimensions used for crop conversion.
  - Operation outputs do not change `selectedCapabilities`, analysis preflight state, report freshness, or analysis dirty state unless explicitly attached as evidence later.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-asset-lineage-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 5.2: Tesseract OCR Runner

- **Location**:
  - New host runner under `rooms/laboratory/main-functions/media-analysis/host/`
  - Tool metadata in `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - Report mapping in `rooms/laboratory/shared/host/reporting-feature-report.ts`
- **Description**: Add optional OCR for selected frame or ROI. Use FFmpeg to prepare image input, then Tesseract to produce text and confidence summary.
- **Complexity**: 8
- **Dependencies**: Sprint 3 and Task 5.1
- **Acceptance Criteria**:
  - OCR module is blocked when Tesseract is unavailable.
  - OCR text becomes a report artifact and evidence section.
- **Validation**:
  - Add tests in `scripts/tests/laboratory-execution-runtime-regressions.test.ts` and `scripts/tests/laboratory-report-composition-v2-regressions.test.ts`.

### Task 5.3: Metadata And Provenance Runner

- **Location**:
  - New host runner under `rooms/laboratory/shared/host/`
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/host/source-metadata.ts`
  - `rooms/laboratory/services/report-builder.ts`
- **Description**: Add optional ExifTool, MediaInfo, and c2patool-backed analysis.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - FFprobe remains the fallback.
  - ExifTool/MediaInfo enrich metadata when available.
  - c2patool provenance result is reported as verified, missing, invalid, or unavailable.
- **Validation**:
  - Add fixture-driven parser tests; avoid requiring binaries in CI.

### Task 5.4: Scene Detection Runner

- **Location**:
  - New host runner under `rooms/laboratory/main-functions/media-analysis/host/`
  - `rooms/laboratory/shared/data/tools/visual-analysis-catalog.json`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add optional PySceneDetect scene boundary analysis for video.
- **Complexity**: 8
- **Dependencies**: Sprint 3 and Sprint 4
- **Acceptance Criteria**:
  - Scene boundaries can appear as timeline markers.
  - Report includes scene cut list and relevant timestamps.
- **Validation**:
  - Tests cover parser output and timeline marker hydration.

## Sprint 6: Model-Based Expansion

**Goal**: Add heavier optional ML-backed capabilities after the shell, contracts, and low-risk runners are stable.

**Demo/Validation**:

- Optional model providers appear under readiness.
- When installed, model-backed operations or analysis modules produce real artifacts.

### Task 6.1: ONNX Runtime Provider Shell

- **Location**:
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - New `rooms/laboratory/shared/host/model-provider-runtime.ts`
  - `rooms/laboratory/shared/host/project-tool-status.ts`
- **Description**: Add a generic ONNX provider wrapper for local inference modules.
- **Complexity**: 8
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Provider can be probed, blocked, or ready.
  - No model download happens implicitly.
- **Validation**:
  - Unit tests with stubbed provider responses.

### Task 6.2: Object And Pose Analysis

- **Location**:
  - New runners under `rooms/laboratory/main-functions/media-analysis/host/`
  - Analysis catalogs and report mapper
- **Description**: Add YOLO/MediaPipe/OpenCV-backed object, person, pose, or region tracking as optional analysis/report modules.
- **Complexity**: 9
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Outputs include object labels, frame/time spans, confidence, and optional bounding boxes.
  - Report separates model inference from evidence interpretation.
- **Validation**:
  - Fixture JSON parser tests and UI rendering tests.

### Task 6.3: Super-Resolution / Deblur Operation

- **Location**:
  - Operation controls renderer
  - New model-backed operation runner
  - Asset lineage and preview overlay
- **Description**: Add Real-ESRGAN or ONNX-backed enhancement for selected frame/ROI/image.
- **Complexity**: 9
- **Dependencies**: Task 6.1 and Sprint 2
- **Acceptance Criteria**:
  - Enhanced outputs are clearly marked as derived, not original evidence.
  - Before/after view is default.
- **Validation**:
  - Asset lineage tests and UI comparison tests.

### Task 6.4: Advanced Speaker Diarization

- **Location**:
  - Audio analysis provider metadata
  - Optional model runner under `rooms/laboratory/main-functions/audio-analysis/host/`
- **Description**: Add pyannote.audio as an optional advanced diarization provider while keeping pyAudioAnalysis fallback.
- **Complexity**: 8
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Provider readiness distinguishes local package, model access, and fallback mode.
  - Report labels diarization confidence and limitations.
- **Validation**:
  - Tests use fixture outputs, not live model execution.

## Sprint 7: UI Polish, Accessibility, And Regression Pass

**Goal**: Make the expanded Laboratory feel intentional rather than crowded.

**Demo/Validation**:

- Screenshot-level smoke: center preview, `Kontroller`, right rail, selection panel, and timeline remain readable at 1920x1080 and smaller widths.
- No text overlap in operation cards or analysis module rows.

### Task 7.1: Layout Polish

- **Location**:
  - `rooms/laboratory/ui/styles/*.css`
  - `rooms/laboratory/ui/style.css`
- **Description**: Add dense but readable grouping, status chips, disabled reasons, and compact output labels.
- **Complexity**: 6
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Controls drawer does not cover critical timeline controls more than current layout.
  - Right rail remains scan-friendly with several modules active.
- **Validation**:
  - Playwright/Electron screenshot checks if available.

### Task 7.2: I18n Completeness

- **Location**:
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Add all new user-facing copy in both languages.
- **Complexity**: 4
- **Dependencies**: Sprints 2-6
- **Acceptance Criteria**:
  - No new visible copy is hardcoded in renderers except minimal fallback.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-project-workspace-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 7.3: Full Room Regression

- **Location**: test suite and room build scripts
- **Description**: Run focused and broad validation:
  - host import smoke
  - UI evaluation
  - selection runtime
  - execution runtime
  - report composition
  - stage decoupling
  - typecheck
- **Complexity**: 5
- **Dependencies**: All previous sprints
- **Acceptance Criteria**:
  - All targeted tests pass.
  - `npm run typecheck` passes.
  - No generated installed-room drift is committed manually.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-selection-runtime-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-report-composition-v2-regressions.test.ts scripts/tests/laboratory-stage-decoupling-regressions.test.ts`
  - `npm run typecheck`

## Testing Strategy

- Contract tests first: capability grouping, readiness, action types, and selector output.
- UI tests second: controls drawer tab rendering, right rail grouped modules, selection guidance grouping.
- Runtime tests third: operation dispatch, asset lineage, report mapping.
- External tool tests use fixture payloads by default; live binary execution should be opt-in.
- Existing source/import/project workspace tests must continue passing because the new controls depend on source readiness and asset lineage.
- Add persistence/hydration tests for `operations` tab, including invalid persisted tab values and source-kind changes.
- Add ROI conversion tests for normalized ROI to FFmpeg pixel arguments, including clamping and even dimension behavior.
- Add regression tests proving operation/result actions do not mutate analysis preflight, report freshness, or analysis dirty state.
- Add Tool Manager/probe tests for planned and system-command provider metadata.
- Run UI screenshot smoke immediately after Sprint 2 and Sprint 3, not only in Sprint 7.

## Potential Risks & Gotchas

- The controls drawer can become too crowded. Mitigation: keep `Ses Odağı`, `Görsel Ayarlar`, and `İşlemler` separated, and show only relevant cards.
- Operation outputs can be mistaken for forensic evidence. Mitigation: derived assets must carry lineage and a visible derived/enhanced label.
- Heavy ML tools may fail install or be too slow. Mitigation: metadata-only gated providers first, fixture tests, no implicit downloads.
- Right rail can duplicate selection guidance. Mitigation: right rail owns analysis preparation; selection panel owns context-sensitive recommendation and routing.
- Current passive execution chain is deliberately non-executing. Mitigation: keep suggestion acceptance separate from actual run/apply buttons.
- Module toggles and intent-derived capabilities can drift. Mitigation: selectors should derive visible modules from active intents and store only explicit user overrides.
- OCR/object detection/provenance tools may have platform differences. Mitigation: tool manifest should expose platform support and blocked reasons.
- Operation capabilities can accidentally pollute analysis capability state. Mitigation: keep `LabOperationCapabilityId` and operation registry separate from `CapabilityFamilyId` and `selectedCapabilities`.
- ROI crop output can be wrong if normalized UI coordinates are sent directly to FFmpeg. Mitigation: convert through source dimensions and clamp before building filter args.
- Adding many planned tools can make Tool Manager noisy. Mitigation: separate planned provider metadata from probeable toolchain entries until a real lifecycle exists.

## Rollback Plan

- Sprint 1 rollback: remove capability flow metadata and selectors; existing catalogs remain intact.
- Sprint 2 rollback: remove `operations` tab and keep current audio/visual control tabs.
- Sprint 3 rollback: hide grouped module UI while preserving existing intent checklist.
- Sprint 4 rollback: render suggestions in the existing flat list and ignore `flowKind`.
- Sprint 5+ rollback: disable individual provider metadata and runners without removing base Laboratory flows.
