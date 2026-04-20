# Plan: Laboratory V2 Implementation

**Generated**: 2026-04-20
**Estimated Complexity**: High

## Overview

Extend the existing Laboratory workbench instead of introducing a new room or a parallel analysis system. The implementation should preserve the current guided flow, shared `process/report` model, truthful readiness model, and shared process/report stage UI while adding V2 capability families for visual forensics, visual signal amplification, audio signal recovery, subtitle intelligence, analysis scope, live findings, and preview artifacts.

For V2 mental modeling:

- `media-analysis` remains the transport layer that produces source-derived data, probes, transforms, and base artifacts.
- `visual-analysis` remains the interpretation layer that reads media-derived data and produces higher-level visual findings.
- Cross-modal support in V2 is limited to data-level compatibility only; this plan does **not** include a full correlation engine.

The safest expansion path in this repo is:

1. Map the current Laboratory seams and lock the extension points.
2. Extend shared contracts and persistence first.
3. Add catalog/provider/readiness truth for new capability families.
4. Wire host orchestration and managed runners.
5. Reuse existing workbench panels and side cards for live findings and preview surfaces.
6. Finish with regression coverage and an acceptance report.

## Current Laboratory Pattern Map

- **Room/workbench contract**: `rooms/laboratory/manifest.json`, `rooms/laboratory/models/lab-types.ts`
- **Shared state normalization**: `rooms/laboratory/shared/host/process-report-state.ts`
- **Shared runtime events**: `rooms/laboratory/shared/host/runtime-events.ts`, `rooms/laboratory/shared/host/room-tools-progress.ts`
- **Shared orchestration**: `rooms/laboratory/shared/host/process-composition.ts`, `rooms/laboratory/shared/host/process-runtime.ts`, `rooms/laboratory/shared/host/process-orchestration.ts`, `rooms/laboratory/shared/host/process-delegates.ts`
- **Managed runners**: `rooms/laboratory/shared/host/process-managed-media-runner.ts`, `rooms/laboratory/shared/host/process-managed-audio-runner.ts`, `rooms/laboratory/shared/host/process-managed-subtitle-runner.ts`
- **Existing media/profile readiness seam**:
  - `rooms/laboratory/shared/data/tools/profile-presets.json`
  - `rooms/laboratory/shared/data/tools/profile-capabilities.json`
  - `rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts`
  - `rooms/laboratory/shared/host/process-targeting.ts`
  - `rooms/laboratory/shared/host/preset-edit-runtime.ts`
- **Feature-specific host runtimes**:
  - Media/workbench: `rooms/laboratory/main-functions/media-analysis/host/runtime.ts`
  - Audio: `rooms/laboratory/main-functions/audio-analysis/host/*.ts`
  - Subtitle: `rooms/laboratory/main-functions/subtitle-analysis/host/*.ts`
- **Toolchain/readiness truth**:
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/data/tools/audio-analysis-*.json`
  - `rooms/laboratory/shared/data/tools/subtitle-analysis-*.json`
  - `rooms/laboratory/shared/host/project-config-loader.ts`
  - `rooms/laboratory/shared/host/project-tool-status.ts`
- **Persistence/snapshot/report chain**:
  - `rooms/laboratory/shared/host/project-manifests.ts`
  - `rooms/laboratory/shared/host/project-storage.ts`
  - `rooms/laboratory/shared/host/room-snapshot.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-persistence.ts`
  - `rooms/laboratory/shared/data/tools/project-schema.json`
- **Snapshot/accessor propagation seam**:
  - `rooms/laboratory/ui/bootstrap-state-runtime.ts`
  - `rooms/laboratory/shared/ui/source-snapshot-project-selectors.ts`
  - `rooms/laboratory/ui/view-accessors-runtime.ts`
- **Existing process/report UI shells**:
  - Shared stage UI: `rooms/laboratory/shared/ui/process-stage.ts`, `rooms/laboratory/shared/ui/report-stage.ts`
  - Refactor UI: `rooms/laboratory/ui/stages/process-stage.ts`, `rooms/laboratory/ui/stages/report-stage.ts`
  - Cards/components: `rooms/laboratory/ui/components/event-feed.ts`, `finding-card.ts`, `artifact-item.ts`
  - Feature-stage bridge: `rooms/laboratory/ui/feature-stage-panels.ts`
- **Process parsing and derived findings**:
  - `rooms/laboratory/services/process-output-parser.ts`
  - `rooms/laboratory/services/finding-engine.ts`
- **Current regression style**:
  - Contract/import/room tests under `scripts/tests/laboratory-*-room-regressions.test.ts`
  - Behavior/state/report tests under `scripts/tests/laboratory-*-behavior-regressions.test.ts`
  - Runtime/store truth tests under `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

## Assumptions

- `visual-analysis` is **not** a fourth top-level room feature; it is a new capability family inside the existing Laboratory workbench, primarily attached to the current `media-analysis` / shared process flow.
- `media-analysis` is the transport layer and `visual-analysis` is the interpretation layer; visual modules must consume or build on media-derived data instead of becoming a second transport workflow.
- Any visual-analysis catalog/provider layer must remain anchored to the existing media/profile readiness seam instead of becoming a second independent truth source for module selection.
- Existing `queued -> running -> ready|error|cancelled` semantics remain canonical.
- `AnalysisScope` is immutable after process start:
  - Scope can only be modified before the process enters `running`.
  - If the user updates scope during a run, the system must create a new process instance instead of mutating the active one.
  - Each process instance must carry its own frozen scope snapshot.
- Unsupported backends must remain `planned` or `gated`; the plan does not assume new binaries are automatically installable unless the current toolchain already supports that truthfully.
- ROI selection should reuse existing focus-region and preview patterns where possible instead of introducing a new standalone canvas workflow first; the implementation must explicitly define the mapping between edit focus regions, profile target selection, and process-stage analysis scope.
- Runtime event expansion should extend the existing generic `lab-event` transport and downstream store projections rather than creating a second event channel.
- High-frequency modules must follow an event throttling contract:
  - They must not emit raw per-frame, per-sample, or per-chunk events into the user-facing feed.
  - They must aggregate findings before emitting.
  - They must use time/window batching.
  - Example budget: `30fps` video work should emit at most about `2` feed events per second.
- Readiness is two-layered in V2:
  - Tool readiness: existing binary/runtime/model installation truth.
  - Capability readiness: derived truth based on tool availability, model availability, and feature support.
  - UI must display both levels separately.
- UI density remains constrained:
  - At most `1` active preview surface at a time.
  - At most `1` live findings stream at a time.
  - Controls must collapse when not active.
- Because the current turn is in plain terminal mode and `request_user_input` is unavailable in Default mode, this plan proceeds with the contract above rather than pausing for an extra clarification loop.

## Prerequisites

- `npm run typecheck`
- `npm run rooms:test:file -- scripts/tests/<targeted-suite>.test.ts`
- `npm run mcp:build` only if Laboratory MCP metadata or tool surface changes outside room-local code
- Existing Laboratory room-local i18n and regression patterns must stay intact

## Sprint 1: Lock Seams And Shared Contracts

**Goal**: Capture the real Laboratory extension map and add the shared V2 contract surface before host logic changes.
**Demo/Validation**:

- The codebase exposes a single shared analysis-scope contract reused by runtime, process state, reports, and UI.
- No new room feature or alternate workflow is introduced.
- Contract tests compile without changing managed runner behavior yet.

### Task 1.1: Patch 1 - Freeze the current Laboratory seam map

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts`
  - `rooms/laboratory/shared/host/process-composition.ts`
  - `rooms/laboratory/shared/host/process-runtime.ts`
  - `rooms/laboratory/shared/host/process-targeting.ts`
  - `rooms/laboratory/shared/host/project-config-loader.ts`
  - `rooms/laboratory/shared/host/preset-edit-runtime.ts`
  - `rooms/laboratory/ui/feature-stage-panels.ts`
  - `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts`
- **Description**: Document and, where useful, encode the current seams that V2 must reuse: shared state runtime, process/report composition, feature adapters, catalogs/providers, and UI shell slots.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - No ambiguity remains about which files own shared contracts vs feature-specific behavior.
  - The media/profile seam is explicitly identified as the primary readiness/module-selection source for future visual work.
  - Existing tests continue to define the current architecture boundary.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-analysis-room-regressions.test.ts scripts/tests/laboratory-audio-analysis-room-regressions.test.ts scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts`

### Task 1.2: Patch 2 - Add the shared analysis scope contract

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - Optional split only if needed: `rooms/laboratory/models/lab-analysis-scope.ts`
  - `rooms/laboratory/shared/data/tools/project-schema.json`
  - `rooms/laboratory/shared/host/process-report-state.ts`
  - `rooms/laboratory/shared/host/project-manifests.ts`
  - `rooms/laboratory/shared/host/room-snapshot.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-persistence.ts`
- **Description**: Introduce `AnalysisScope` plus shared finding/preview metadata types and thread them through normalized process/report state, snapshot payloads, and persisted UI state.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Scope supports `timeRange`, `frameRange`, `region`, `focus`, and `hypothesis`.
  - Missing scope preserves current global behavior.
  - Scope is visible in process/report state and survives snapshot/hydration.
  - Scope becomes immutable after the process enters `running`.
  - Scope edits during an active run result in a new process instance with a new frozen scope snapshot.
  - If persisted process/report payload shape changes, `project-schema.json` stays aligned with the new contract.
- **Validation**:
  - `npm run rooms:typecheck`
  - Add/update a scope-aware store/runtime regression suite

### Task 1.2B: Patch 2B - Add immediate scope contract regressions

- **Location**:
  - `scripts/tests/laboratory-scope-aware-analysis-regressions.test.ts`
  - `scripts/tests/laboratory-state-persistence-v2-regressions.test.ts`
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Lock the new scope lifecycle rules immediately after Patch 2 instead of waiting until the final regression sprint. This regression step should prove immutability, frozen-scope-per-process behavior, and persistence/snapshot compatibility before the host orchestration grows further.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Scope cannot mutate in-place once a process reaches `running`.
  - Mid-run scope updates create a distinct process instance.
  - Hydration/snapshot layers preserve the frozen scope snapshot for each process.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-scope-aware-analysis-regressions.test.ts scripts/tests/laboratory-state-persistence-v2-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 1.3: Patch 3A - Anchor visual-analysis to the existing media/profile seam

- **Location**:
  - `rooms/laboratory/shared/data/tools/profile-presets.json`
  - `rooms/laboratory/shared/data/tools/profile-capabilities.json`
  - `rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts`
  - `rooms/laboratory/shared/host/process-targeting.ts`
  - `rooms/laboratory/shared/host/preset-edit-runtime.ts`
  - `rooms/laboratory/shared/data/tools/visual-analysis-catalog.json`
  - `rooms/laboratory/shared/data/tools/visual-analysis-capabilities.json`
  - `rooms/laboratory/shared/data/tools/visual-analysis-providers.json`
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
- **Description**: Introduce the visual capability family without breaking the current media/profile readiness pattern. If visual catalog/provider files are added, they must remain derived from or explicitly synchronized with the existing media/profile seam so module selection and readiness truth are not duplicated.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - New module IDs exist for the requested visual families.
  - Visual module selection does not bypass or replace the current media/profile readiness seam.
  - Provider descriptors explain real backend dependencies and expected artifacts.
  - Unsupported advanced modules do not claim readiness.
- **Validation**:
  - New/updated room regression verifies that any visual catalog layer is consistent with the media/profile seam

### Task 1.4: Patch 3B - Propagate config into snapshot/bootstrap/accessor seams

- **Location**:
  - `rooms/laboratory/shared/host/project-config-loader.ts`
  - `rooms/laboratory/shared/host/room-snapshot.ts`
  - `rooms/laboratory/ui/bootstrap-state-runtime.ts`
  - `rooms/laboratory/shared/ui/source-snapshot-project-selectors.ts`
  - `rooms/laboratory/ui/view-accessors-runtime.ts`
- **Description**: After loading new visual or scope-related config, propagate it through the existing room snapshot and bootstrap accessor chain so the UI can actually read it.
- **Complexity**: 5
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - New config families loaded into runtime reach the UI snapshot shape.
  - Snapshot selectors/accessors expose the new fields without ad hoc side channels.
- **Validation**:
  - Snapshot/bootstrap regressions cover the new fields end-to-end

## Sprint 2: Extend Process, Report, And Runtime Event Contracts

**Goal**: Expand the current process/report/event model without breaking the canonical run lifecycle.
**Demo/Validation**:

- Process and report records can hold scope, live findings, preview artifacts, confidence, module trace, variants, and hypothesis summary.
- Existing event feed stays readable, deduped, and batched under high-frequency workloads.
- Existing report composition still works for legacy flows.

### Task 2.1: Patch 4 - Extend process/report state

- **Location**:
  - `rooms/laboratory/shared/data/tools/project-schema.json`
  - `rooms/laboratory/shared/host/process-report-state.ts`
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
  - `rooms/laboratory/services/report-builder.ts`
- **Description**: Add normalized fields for `analysisScope`, `liveFindings`, `previewArtifacts`, `confidence`, `moduleTrace`, `comparisonVariants`, and `hypothesisSummary` to feature process/report records and report projections.
- **Complexity**: 8
- **Dependencies**: Task 1.2, Task 1.3
- **Acceptance Criteria**:
  - Current `findings`, `warnings`, `artifacts`, and `exports` structure is preserved.
  - New findings can carry `code`, `severity`, `confidence`, `sourceModule`, and time/frame/region references.
  - `buildUserReport` and `buildAiReport` remain backward-compatible.
  - Every persisted process record can point back to a frozen scope snapshot rather than a mutable live scope object.
- **Validation**:
  - `npm run rooms:typecheck`
  - Report composition regression suite passes

### Task 2.2: Patch 5 - Extend runtime events without flooding

- **Location**:
  - `rooms/laboratory/shared/host/runtime-events.ts`
  - `rooms/laboratory/shared/host/room-tools-progress.ts`
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-host-bridge.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-event-bus.ts`
  - `rooms/laboratory/services/process-output-parser.ts`
  - `rooms/laboratory/services/finding-engine.ts`
- **Description**: Add canonical event semantics for `analysis-scope-updated`, `live-finding`, `preview-artifact`, `module-progress`, `module-warning`, `module-artifact`, and `interactive-adjustment-applied` by extending the existing generic `lab-event` transport, parser/finding flow, and downstream store projections.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - New event types map into the existing run/feed model.
  - Canonical feed and raw-log handling stay separated.
  - Dedupe logic prevents noisy per-frame spam.
  - High-frequency modules do not emit raw per-unit feed events.
  - Feed emission uses aggregation and time/window batching.
  - A `30fps`-class visual module targets no more than roughly `2` visible feed events per second.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - Add runtime-event regression suite for new event types

## Sprint 3: Host Orchestration, Managed Runners, And Readiness Truth

**Goal**: Add real V2 capability execution and readiness gating through existing shared orchestration.
**Demo/Validation**:

- Selected V2 modules can be queued, run, produce findings/artifacts, and flow into reports.
- Visual, audio-recovery, and subtitle-intelligence modules respect truthful dependency status.
- Cross-modal payload surfaces remain data-compatible without introducing a full correlation engine.

### Task 3.1: Patch 6A - Extend shared orchestration and feature runtimes

- **Location**:
  - `rooms/laboratory/shared/host/process-composition.ts`
  - `rooms/laboratory/shared/host/process-runtime.ts`
  - `rooms/laboratory/shared/host/process-orchestration.ts`
  - `rooms/laboratory/shared/host/process-targeting.ts`
  - `rooms/laboratory/shared/host/process-managed-runners.ts`
  - `rooms/laboratory/shared/host/analysis-artifact-runtime.ts`
  - `rooms/laboratory/host/feature-runtimes.ts`
  - `rooms/laboratory/host/feature-adapters.ts`
- **Description**: Extend the shared orchestration path so V2 modules are queued and executed through the same managed-runner flow. Introduce scope-aware targeting, module traces, comparison variants, and preview artifact generation hooks.
- **Complexity**: 9
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `runFeatureProcess` and `runManagedProcess` can carry scope and hypothesis metadata.
  - Process startup freezes the scope snapshot carried by that process instance.
  - Mid-run scope changes fork a new process instance instead of mutating the active run.
  - Media/visual modules stay inside the existing workbench flow instead of branching to a new feature workflow.
  - Cross-modal data carriers stay limited to data-level compatibility between visual, audio, and subtitle outputs.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - Add host behavior regression for scope-aware execution

### Task 3.2: Patch 6B - Add visual-analysis host modules under the existing media/workbench path

- **Location**:
  - `rooms/laboratory/shared/data/tools/profile-presets.json`
  - `rooms/laboratory/shared/data/tools/profile-capabilities.json`
  - New host files under `rooms/laboratory/main-functions/media-analysis/host/`
    - `visual-analysis-catalog.ts`
    - `visual-analysis-projection.ts`
    - `visual-analysis-runners.ts`
    - `visual-analysis-runner-support.ts`
  - Existing media host seam files:
    - `rooms/laboratory/main-functions/media-analysis/host/runtime.ts`
    - `rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts`
    - `rooms/laboratory/main-functions/media-analysis/host/profile-models.ts`
- **Description**: Implement visual forensics and visual signal amplification as module families attached to the existing media/workbench host flow. Treat `media-analysis` as the transport layer and `visual-analysis` as the interpretation layer, reuse current FFmpeg/media probe pipelines first, keep readiness/module-selection anchored to the profile seam, and mark advanced backends as gated when they need extra runtime support.
- **Complexity**: 9
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Visual module descriptors include requested IDs such as `frame-consistency`, `lighting-consistency`, `ai-artifact-detection`, `visual-signal-amplification`, `gamma-scan`, and `hidden-detail-reveal`.
  - Visual modules consume media-derived data/artifacts instead of duplicating transport/probe responsibilities.
  - Findings and preview artifacts can reference frame/time/region.
  - Interactive adjustment payloads can produce comparison variants without replacing the current workbench.
- **Validation**:
  - New visual-analysis room regression suite
  - Media process behavior regressions updated

### Task 3.3: Patch 6C - Expand audio-analysis with signal recovery

- **Location**:
  - `rooms/laboratory/main-functions/audio-analysis/host/process-runners.ts`
  - `rooms/laboratory/main-functions/audio-analysis/host/process-local-runners.ts`
  - `rooms/laboratory/main-functions/audio-analysis/host/process-model-runners.ts`
  - New focused runners as needed under `rooms/laboratory/main-functions/audio-analysis/host/`
  - `rooms/laboratory/shared/data/tools/audio-analysis-catalog.json`
  - `rooms/laboratory/shared/data/tools/audio-analysis-capabilities.json`
  - `rooms/laboratory/shared/data/tools/audio-analysis-providers.json`
- **Description**: Add `signal-recovery`, `frequency-shift-reversal`, `band-pass-exploration`, `spectrogram-guided-recovery`, `hidden-pattern-extraction`, and `phase-recovery-experiment` through the same audio module catalog/provider/result pattern already used by current audio modules.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Audio recovery modules appear in catalog/result projection with truthful provider readiness.
  - Low-cost spectrogram and preview artifacts reuse the current audio artifact pipeline.
  - Unsupported experiments remain planned/gated instead of pretending to run.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
  - Add audio recovery behavior regression suite

### Task 3.4: Patch 7 - Preserve readiness/dependency truth

- **Location**:
  - `rooms/laboratory/shared/host/project-tool-status.ts`
  - `rooms/laboratory/shared/host/runtime-bootstrap.ts`
  - `rooms/laboratory/shared/host/project-config-loader.ts`
  - `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
  - `rooms/laboratory/shared/data/tools/visual-analysis-providers.json`
  - `rooms/laboratory/shared/data/tools/audio-analysis-providers.json`
  - `rooms/laboratory/shared/data/tools/subtitle-analysis-providers.json`
- **Description**: Wire V2 capability families into the existing readiness truth model. If a module depends on an external binary or model, expose exact blockers and CTA hints through provider/tool descriptors rather than silent warnings.
- **Complexity**: 7
- **Dependencies**: Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - Managed vs external tool distinction remains explicit.
  - Tool readiness and capability readiness are modeled separately.
  - Capability readiness is derived from tool availability, model availability, and feature support.
  - Blocked modules surface a real unmet dependency or unsupported runtime reason.
  - UI can show honest tool readiness and capability readiness for each new capability family.
- **Validation**:
  - New dependency-truth regression suite
  - Existing room/tool regressions still pass

## Sprint 4: Minimal UI Integration On Existing Workbench Slots

**Goal**: Add V2 controls and live surfaces by extending current workbench panels and cards, not by redesigning Laboratory.
**Demo/Validation**:

- Users can set analysis scope, hypothesis, and module toggles within the current step flow.
- Live findings and preview artifacts appear during processing in existing process/report surfaces.
- Preview rendering is gated, lightweight, and density-limited.

### Task 4.1: Patch 8A - Add interactive analysis controls

- **Location**:
  - `rooms/laboratory/ui/feature-stage-panels.ts`
  - `rooms/laboratory/shared/ui/process-stage.ts`
  - `rooms/laboratory/shared/ui/report-stage.ts`
  - `rooms/laboratory/ui/stages/process-stage.ts`
  - `rooms/laboratory/ui/stages/report-stage.ts`
  - `rooms/laboratory/shared/host/preset-edit-runtime.ts`
  - `rooms/laboratory/shared/ui/action-router-events.ts`
  - `rooms/laboratory/shared/ui/action-router-actions.ts`
  - `rooms/laboratory/shared/ui/request-runtime.ts`
- **Description**: Add scope controls for time range, frame range, ROI/focus region, hypothesis, and module toggles by reusing current form/action routing patterns. Avoid a new full-screen panel and explicitly map ROI ownership between edit focus regions, profile target selection, and process-stage scope.
- **Complexity**: 7
- **Dependencies**: Task 2.2, Task 3.1
- **Acceptance Criteria**:
  - Controls are stage-local and do not disturb the existing five-stage flow.
  - Scope/hypothesis changes emit canonical scope/update events.
  - ROI selection reuses existing focus-region semantics where available.
  - Scope controls are disabled or redirected to a new process instance once a run is already `running`.
  - Inactive controls collapse by default to avoid persistent panel bloat.
- **Validation**:
  - UI behavior regression for scope controls
  - Manual smoke checklist in Laboratory process stage

### Task 4.2: Patch 8B - Add live findings stream and preview surfaces

- **Location**:
  - `rooms/laboratory/ui/components/event-feed.ts`
  - `rooms/laboratory/ui/components/finding-card.ts`
  - `rooms/laboratory/ui/components/artifact-item.ts`
  - New UI helpers as needed under `rooms/laboratory/ui/components/`
  - `rooms/laboratory/ui/stages/process-stage.ts`
  - `rooms/laboratory/ui/stages/report-stage.ts`
  - `rooms/laboratory/shared/ui/media-preview.ts`
- **Description**: Reuse the current event/finding/artifact cards to show live findings, frame previews, transform previews, spectrogram previews, and subtitle chunk previews while keeping expensive previews optional.
- **Complexity**: 7
- **Dependencies**: Task 4.1, Task 3.2, Task 3.3, Task 3.4
- **Acceptance Criteria**:
  - At most one preview surface is active at a time.
  - At most one live findings stream is active at a time.
  - Process side panel can show live findings and preview artifacts during runs.
  - Report side panel can show stable preview artifacts after completion.
  - Preview generation is gated by actual runner output; no fake placeholders.
- **Validation**:
  - Process/report UI regression update
  - Runtime event regression confirms preview/live-finding wiring

### Task 4.3: Patch 8C - Add feature-specific minimal panels without new workflows

- **Location**:
  - Audio UI: `rooms/laboratory/main-functions/audio-analysis/ui/catalog-runtime.ts`, `result-runtime.ts`
  - Subtitle UI: `rooms/laboratory/main-functions/subtitle-analysis/ui/runtime.ts`
  - Media/workbench UI helpers under `rooms/laboratory/main-functions/media-analysis/ui/`
  - Room-local i18n: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Expose V2 module copy, readiness notes, control labels, and preview labels in the existing feature panels and result cards. Keep right-panel density controlled.
- **Complexity**: 6
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Visual exploration controls appear under the existing workbench/media flow.
  - Audio recovery and subtitle intelligence stay within their current panel families.
  - All visible copy lives in room-local i18n.
  - Feature panels collapse inactive sections so the right panel does not become a dense dashboard again.
- **Validation**:
  - Existing audio/subtitle room regressions updated
  - Localized copy regressions added where useful

### Task 4.4: Patch 9 - Add subtitle intelligence payload and export format

- **Location**:
  - `rooms/laboratory/main-functions/subtitle-analysis/host/process-analysis.ts`
  - `rooms/laboratory/shared/host/process-managed-subtitle-runner.ts`
  - `rooms/laboratory/shared/host/reporting-subtitle.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
  - `rooms/laboratory/shared/data/tools/subtitle-analysis-catalog.json`
  - `rooms/laboratory/shared/data/tools/subtitle-analysis-capabilities.json`
  - `rooms/laboratory/shared/data/tools/subtitle-analysis-providers.json`
  - New export/payload helpers under `rooms/laboratory/main-functions/subtitle-analysis/host/`
- **Description**: Finalize subtitle intelligence as a structured archive/export path after the shared host and UI groundwork is in place. The implementation should emit AI-ready payload artifacts for logical consistency, contradiction, narrative drift, repetition structure, semantic coherence, and channel-batch analysis without changing the existing subtitle workflow.
- **Complexity**: 8
- **Dependencies**: Task 3.1, Task 3.4, Task 4.3
- **Acceptance Criteria**:
  - Subtitle intelligence outputs remain inside the current subtitle process/report branch.
  - Batch archive export yields structured AI payload artifacts instead of ad hoc strings.
  - Contradiction/coherence findings and payload exports appear in the existing report/export model.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-subtitle-analysis-behavior-regressions.test.ts scripts/tests/laboratory-subtitle-report-behavior-regressions.test.ts`

## Sprint 5: Regression Coverage And Acceptance Closure

**Goal**: Lock Laboratory V2 into the existing regression philosophy and deliver an explicit acceptance result.
**Demo/Validation**:

- Contract, behavior, runtime-event, persistence, report, scope-aware, and dependency-truth suites exist.
- Acceptance report can be produced without manual archaeology.

### Task 5.1: Patch 10 - Add and update regression suites

- **Location**:
  - New tests:
    - `scripts/tests/laboratory-visual-analysis-room-regressions.test.ts`
    - `scripts/tests/laboratory-scope-aware-analysis-regressions.test.ts`
    - `scripts/tests/laboratory-runtime-event-v2-regressions.test.ts`
    - `scripts/tests/laboratory-state-persistence-v2-regressions.test.ts`
    - `scripts/tests/laboratory-report-composition-v2-regressions.test.ts`
    - `scripts/tests/laboratory-dependency-truth-v2-regressions.test.ts`
- Updated tests:
  - `scripts/tests/laboratory-host-import-smoke-regressions.test.ts`
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
  - `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-subtitle-analysis-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-subtitle-report-behavior-regressions.test.ts`
- **Description**: Add the exact regression families requested by the contract and extend current suites instead of replacing them.
- **Complexity**: 8
- **Dependencies**: Sprint 1 through Sprint 4
- **Acceptance Criteria**:
  - New tests cover contract regression, behavior regression, runtime events, persistence, report composition, scope awareness, and readiness truth.
  - Existing test naming and command structure stay consistent with the repo.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-visual-analysis-room-regressions.test.ts scripts/tests/laboratory-scope-aware-analysis-regressions.test.ts scripts/tests/laboratory-runtime-event-v2-regressions.test.ts scripts/tests/laboratory-state-persistence-v2-regressions.test.ts scripts/tests/laboratory-report-composition-v2-regressions.test.ts scripts/tests/laboratory-dependency-truth-v2-regressions.test.ts`
  - `npm run rooms:typecheck`

### Task 5.2: Patch 11 - Produce an acceptance report

- **Location**:
  - `.rovo/laboratory-v2-acceptance-report.md`
  - Optional checklist source: `.rovo/laboratory-v2-smoke-checklist.md`
- **Description**: Produce a final acceptance report using the format requested in the contract, grounded in implemented files, test outcomes, readiness truth, and remaining risks.
- **Complexity**: 3
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Report includes `Files changed`, `New files added`, `Capability map`, `Runtime/state impacts`, `UI surfaces added`, `Test files added/updated`, `Remaining risks`, and `Acceptance result`.
  - Acceptance checklist explicitly marks PASS or FAIL for each requested item.
- **Validation**:
  - Manual review against the implementation contract
  - Keep the report in repo for follow-up turns

## Testing Strategy

- Use `npm run rooms:typecheck` after each sprint that changes shared contracts or UI wiring.
- Run scope lifecycle regressions immediately after Patch 2; do not defer the first scope regression pass to Sprint 5.
- Use `npm run rooms:test:file -- <suite>` for targeted Laboratory regressions after each patch cluster.
- Preserve current regression categories:
  - Contract/import/room boundary tests for new catalogs, runtime bootstrap fields, and manifest wiring.
  - Behavior tests for managed runner flow and report composition.
  - Runtime truth tests for event flow, store hydration, and live findings.
  - Persistence tests for project manifests, snapshots, and local UI state.
- Keep existing room-native packaging/UI/parity suites in the validation loop when shared Laboratory seams move:
  - `scripts/tests/laboratory-host-import-smoke-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
- Reserve full `npm run typecheck` for milestone checks after Sprint 2, Sprint 4, and Sprint 5.

## Potential Risks & Gotchas

- **Risk**: Treating `visual-analysis` as a fourth room feature would fork the workbench model.
  - **Mitigation**: Keep visual modules inside current `media-analysis` / shared process flow and only add new catalogs/providers/modules.
- **Risk**: Scope data is added only to runtime, then disappears in snapshot/report/export.
  - **Mitigation**: Thread scope through `process-report-state`, `project-manifests`, `room-snapshot`, `lab-store`, and report builders in one sprint.
- **Risk**: Live findings become noisy because runner output is emitted per frame or per chunk.
  - **Mitigation**: Reuse canonical event/feed routing, aggregate module progress, emit only meaningful finding deltas, and enforce time/window batching budgets.
- **Risk**: Scope mutates during a run and corrupts report/state attribution.
  - **Mitigation**: Freeze scope at process start and fork a new process instance on mid-run scope edits.
- **Risk**: UI turns into a second dashboard and breaks current stage clarity.
  - **Mitigation**: Reuse existing cards/panels, allow only one active preview surface and one live findings stream, and collapse inactive controls by default.
- **Risk**: Advanced visual/audio recovery modules claim readiness without real backend support.
  - **Mitigation**: Put truth in catalog/provider/tool manifest first; leave unsupported modules as `planned` or `gated`.
- **Risk**: Visual-analysis JSON files drift from the existing media/profile seam and become a second readiness truth source.
  - **Mitigation**: Treat any visual catalog/provider layer as derived metadata or keep an explicit synchronization rule with profile/process targeting.
- **Risk**: ROI selection becomes a new bespoke editor.
  - **Mitigation**: Start from existing focus-region and preview patterns; only add richer selection UX if the current region model proves insufficient.
- **Risk**: Event planning sounds more typed than the repo transport actually is.
  - **Mitigation**: Keep host transport generic via `lab-event` and implement new semantics as normalized payload shapes plus store projections.
- **Risk**: Subtitle intelligence export drifts away from current report/export model.
  - **Mitigation**: Keep AI payloads as report artifacts/exports produced by the existing reporting branch.
- **Risk**: Cross-modal analysis scope balloons into a new engine before the primitives are ready.
  - **Mitigation**: Keep V2 cross-modal support at data-level compatibility only and explicitly defer any full correlation engine.

## Rollback Plan

- Revert in reverse dependency order:
  1. Remove V2 UI panels/cards and i18n keys.
  2. Remove V2 runner wiring from shared process composition/runtime.
  3. Remove new catalogs/providers/capabilities and runtime bootstrap fields.
  4. Remove scope/live-finding contract fields only after the host/UI callers are reverted.
- Keep regression suites until the rollback is confirmed so the boundary remains documented.
- If a sprint partially lands, disable new modules by catalog/provider status instead of deleting shared contract fields mid-stream.

## Review Notes

- This plan intentionally skips subagent review because the current request did not explicitly authorize delegation or parallel subagents.
- Highest-risk implementation seams are:
  - `rooms/laboratory/shared/host/process-runtime.ts`
  - `rooms/laboratory/shared/host/process-report-state.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/shared/host/project-config-loader.ts`
  - `rooms/laboratory/ui/stages/process-stage.ts`
