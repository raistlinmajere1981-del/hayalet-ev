# Plan: Laboratory Runtime Truth Revision

**Generated**: 2026-04-16
**Estimated Complexity**: High

## Overview

This plan revises the `laboratory` room around one principle: keep the current shell, stop inventing runtime truth.

The room already has a solid base in `ui/lab-root.ts`, `runtime/lab-store.ts`, `runtime/lab-host-bridge.ts`, and the shared host process/report stack. The real problem is not missing UI. The problem is that state, progress, and event meaning still split across host snapshots, reducer-side fallbacks, percent heuristics, and UI-level summaries.

The revision therefore focuses on three patches:

1. `STATE TEKILLESTIRME`
2. `RUNTIME GERCEKLIGI`
3. `LOG -> ANLAM KATMANI`

The implementation must preserve the current room identity and overall layout while making the process and report stages trustworthy.

The requested seven branches:

- `currentStage`
- `source`
- `editConfig`
- `profileConfig`
- `preflight`
- `run`
- `reports`

define the operator-facing truth contract. They do not replace the infrastructure branches the current room already needs, such as `projectIndex`, `workbench`, `toolState`, `profileModels`, `sourceProbeStatus`, `snapshot`, `context`, and `bootReady`.

## Research Summary

Current repository findings that shape this plan:

- The current Laboratory entry already routes through `rooms/laboratory/ui/lab-root.ts`.
- The new room-local renderer/store seam already exists in:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/runtime/lab-host-bridge.ts`
  - `rooms/laboratory/services/pipeline-runner.ts`
- Host authority still lives in the shared host stack:
  - `rooms/laboratory/shared/host/process-runtime.ts`
  - `rooms/laboratory/shared/host/process-orchestration.ts`
  - `rooms/laboratory/shared/host/process-managed-*.ts`
  - `rooms/laboratory/shared/host/runtime-events.ts`
  - `rooms/laboratory/shared/host/process-report-state.ts`
  - `rooms/laboratory/shared/host/reporting-feature-report.ts`
- The current process schema persists `percent`, `modules`, `findings`, and `artifacts`, but it does not yet store a canonical activity event log or explicit empty-report reasons in the process branch.
- Renderer truth is still split:
  - `state.eventFeed` duplicates `run.events`
  - `getCurrentPreflight()` falls back to recomputation from profile config
  - `buildLifecycleEvents()` still translates host payloads into reducer-side guesses
  - module progress bars still render percent when the runtime often only knows coarse milestones
- Tool output already reaches the app through `room-tools:progress`, and `room-tools-progress.ts` already sees `stdout` and `stderr` chunks, so the raw material for semantic events already exists.
- Existing regression coverage is broad and will need deliberate updates rather than incidental fixes:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - installed parity suites touching `ui/lab-root.js`, `ui/components/event-feed.js`, `ui/stages/process-stage.js`, and `runtime/lab-store.js`

## Locked Constraints

- Keep the existing room id, manifest, and entry points:
  - `rooms/laboratory/manifest.json`
  - `rooms/laboratory/ui/index.ts`
  - `rooms/laboratory/host/index.ts`
- UI touch must stay minimal:
  - no redesign
  - no new workbench concept
  - no V2 panels
- Host remains the execution authority.
- Renderer store becomes the only visible truth source.
- The operator-facing seven-branch contract stays primary, while existing infrastructure branches remain explicit support state.
- The plan must preserve a bounded non-run activity feed for source/edit/profile/report actions instead of forcing every visible event into `run.events`.
- Components may keep tiny view-only toggles such as collapse/pagination state, but they may not invent domain progress, preflight, run status, or report content.
- `mode:status` and `whereami` already confirm this work stays in terminal mode, so no mode transition is part of the plan.

## Done Definition

The patch set is only done when all three statements are true:

- The user can say: `su an ne oluyor biliyorum`.
- The UI does not fabricate progress, readiness, or report state.
- A blank report still explains why it is blank.

## Prerequisites

- The Laboratory room must continue building through the current room pipeline.
- Shared host schema and snapshot changes must stay compatible with installed-room parity generation.
- Event storage must be kept bounded to avoid unbounded process snapshot growth.
- Any runtime event parsing must tolerate chunked `stdout` and `stderr` delivery.
- Some Laboratory regression suites assume generated i18n/runtime artifacts, so the validation flow must include the normal pre-test generation/build step when required.

## Sprint 1: Canonical Store Contract

**Goal**: Make one renderer-visible state contract authoritative and remove reducer-side guesswork.

**Demo/Validation**:
- `lab-root` still boots the room and sends the same `roomAPI.ready(...)` payload.
- Process and report screens render from one store shape.
- No selector recomputes preflight or progress from scratch.

### Task 1.1: Freeze the canonical Laboratory domain model
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Redefine the authoritative store contract around the requested operator-facing root branches: `currentStage`, `source`, `editConfig`, `profileConfig`, `preflight`, `run`, and `reports`. Keep infrastructure branches such as `projectIndex`, `workbench`, `toolState`, `profileModels`, `sourceProbeStatus`, `snapshot`, `context`, and `bootReady` explicit rather than implied. Replace duplicate rendering ownership with two clearly separated feeds:
  - a bounded global activity feed for non-run and cross-stage events
  - a run-scoped event timeline for process-specific detail
- **Complexity**: 7
- **Dependencies**: None
- **Acceptance Criteria**:
  - The domain model exposes a single canonical `LabRun`.
  - Global activity feed and run-scoped events have explicit, non-overlapping responsibilities.
  - Infrastructure branches required by the current `lab-root` architecture remain present and documented.
  - Report empty-state messaging has an explicit type/field, not implicit fallback copy.
- **Validation**:
  - `npm run typecheck`
  - targeted grep review for duplicate feed ownership

### Task 1.2: Align persistence and hydration to the single store
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-persistence.ts`
- **Description**: Refactor hydration so persisted state restores canonical branches plus safe infrastructure/view prefs. Running jobs restored from storage must be normalized to non-running terminal states. Add an explicit persistence migration strategy, either:
  - a storage-key bump
  - or a versioned local migration for stale Laboratory snapshots
  Reducer branches that synthesize fake completion or progress must be removed.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Hydration no longer restores a phantom running process.
  - Persistence contains summaries, not duplicated live runtime truth.
  - Old persisted Laboratory payloads cannot silently reintroduce stale truth after the refactor.
  - Store transitions never create progress or completion without host evidence.
- **Validation**:
  - targeted unit coverage for hydration normalization
  - migration smoke using a stale persisted payload fixture or captured old localStorage shape
  - manual reload smoke of Laboratory UI

### Task 1.3: Remove selector-level truth fabrication
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Replace speculative selectors such as recomputed preflight fallbacks with strict host-backed selectors. If data is absent, selectors must return `idle`, `unknown`, or explicit blocked reasons instead of manufacturing ready-like state.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `getCurrentPreflight()` stops deriving truth from profile config alone.
  - Stage guards depend on canonical host-fed state.
  - Hidden fallback logic becomes explicit `missing` or `idle` states.
- **Validation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - targeted selector assertions if a new test file is added

### Task 1.4: Keep UI rendering store-only
- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/stages/*.ts`, `rooms/laboratory/ui/components/*.ts`
- **Description**: Audit stage renderers so they render only selector output from the canonical store. Keep expansion, paging, and tab toggles if needed, but remove any UI-generated progress narratives or state reconstruction.
- **Complexity**: 5
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Components do not compute their own lifecycle truth.
  - Process and report stages read from selectors only.
  - No UI copy implies completion unless the store says so.
- **Validation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - built-room smoke import

## Sprint 2: Runtime Truth Pipeline

**Goal**: Make the host emit one truthful run model instead of percent-heavy summaries.

**Demo/Validation**:
- Starting a run creates one canonical run record.
- Module transitions are visible as lifecycle events.
- Progress bars are absent unless the runtime has genuine measurable progress.

### Task 2.1: Expand the process schema for canonical run truth
- **Location**: `rooms/laboratory/shared/data/tools/project-schema.json`, `rooms/laboratory/shared/host/process-report-state.ts`, `rooms/laboratory/shared/host/room-snapshot.ts`
- **Description**: Extend the process record to persist the final canonical run shape needed by the renderer: `state`, `modules`, `events`, `artifacts`, `findings`, and explicit error/empty-reason fields. Keep snapshot output bounded and serializable. The schema should store run-local activity without forcing source/edit/preflight/report-export events into the process branch when they belong to the global activity feed.
- **Complexity**: 8
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Process records can serialize activity events without breaking snapshot build.
  - Snapshot payloads expose one run truth model per feature.
  - Installed parity file generation remains valid after schema changes.
- **Validation**:
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 2.2: Introduce a host-side `emitEvent` runtime
- **Location**: `rooms/laboratory/shared/host/runtime-events.ts`, `rooms/laboratory/shared/host/process-runtime.ts`, `rooms/laboratory/shared/host/process-orchestration.ts`, `rooms/laboratory/shared/host/job-runtime.ts`, `rooms/laboratory/shared/host/tool-mutations.ts`, `rooms/laboratory/shared/host/reporting-export.ts`, `rooms/laboratory/shared/host/action-router.ts`, `rooms/laboratory/runtime/lab-host-bridge.ts`, `rooms/laboratory/services/pipeline-runner.ts`
- **Description**: Add a canonical host helper such as `emitEvent({ kind, message, module, ts, ...meta })` and use it for process lifecycle, cancellation, tool output, report synthesis, and action/result publication. Move the renderer bridge and lifecycle mapper from inference to direct consumption so `lab-host-bridge` and `pipeline-runner` stop reconstructing state from partial payloads, and so the current `pushJobState` / `pushActionResult` emit points do not remain as a second truth path.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Run lifecycle can be reconstructed directly from host-emitted events.
  - Reducer-side `buildLifecycleEvents()` becomes thin or is retired.
  - Action/result events and module events share one event shape.
  - Existing host emit points no longer bypass the canonical event model.
- **Validation**:
  - targeted runtime event tests
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 2.3: Normalize managed runners away from fake completion progress
- **Location**: `rooms/laboratory/shared/host/process-managed-media-runner.ts`, `rooms/laboratory/shared/host/process-managed-audio-runner.ts`, `rooms/laboratory/shared/host/process-managed-subtitle-runner.ts`
- **Description**: Replace coarse `30 -> 100` progress storytelling with truthful module lifecycle updates and semantic summaries. Keep percent only when it comes from bytes, frame counts, or a real tool-reported ratio.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - No module jumps to a fabricated-looking completed state without emitted evidence.
  - Non-measurable modules show phase/state text instead of empty bars.
  - Managed runners still produce findings/artifacts as before.
- **Validation**:
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - targeted host process smoke tests

### Task 2.4: Upgrade room tool progress ingestion
- **Location**: `rooms/laboratory/shared/host/room-tools-progress.ts`, `rooms/laboratory/shared/host/job-runtime.ts`
- **Description**: Buffer chunked `stdout` and `stderr` into parseable lines, preserve raw lines for debug, and emit semantic runtime events from tool progress instead of only pushing percent/status.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Chunked command output is line-safe before parsing.
  - Raw tool output is preserved for debug inspection.
  - Percent extraction remains available only as a secondary signal.
- **Validation**:
  - new regression for chunked tool output parsing
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`

## Sprint 3: Log To Meaning Layer

**Goal**: Convert raw process output into readable activity and evidence-driven findings.

**Demo/Validation**:
- The process screen shows readable activity text while a run is active.
- Raw logs are still inspectable behind a collapsed debug surface.
- Findings can be derived even when the final report is sparse.

### Task 3.1: Add a semantic process output parser
- **Location**: `rooms/laboratory/services/process-output-parser.ts` (new), `rooms/laboratory/shared/host/room-tools-progress.ts`
- **Description**: Implement `parseProcessOutput(line) -> LabEvent`. Cover the known runtime families already present in the room: ffmpeg/ffprobe, yt-dlp, subtitle import/discovery, and managed process module boundaries. Map raw lines like `blackdetect=...` to operator-readable activity such as `Siyah sahne tespiti calisiyor`.
- **Complexity**: 8
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Parser returns semantic events for known tool patterns.
  - Unknown lines fall back to raw-log-only storage instead of broken activity copy.
  - Event messages stay short, readable, and stage/module aware.
- **Validation**:
  - new parser-focused regression file
  - representative sample fixtures for ffmpeg and yt-dlp lines

### Task 3.2: Add a finding extraction engine
- **Location**: `rooms/laboratory/services/finding-engine.ts` (new), `rooms/laboratory/services/report-builder.ts`, `rooms/laboratory/shared/host/reporting-feature-report.ts`
- **Description**: Implement `extractFindings(events) -> LabFinding[]` and unify it with existing host-generated findings. The engine must support positive findings, `no anomaly detected`, and `report empty because ...` outcomes. Treat this as additive evidence synthesis, not a replacement for existing audio/subtitle feature-specific report composition.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Findings can be synthesized from event evidence, not only end-of-run summaries.
  - Empty finding sets carry an explicit reason.
  - User and AI reports can explain sparse or empty output.
- **Validation**:
  - new finding-engine regression file
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`

### Task 3.3: Split activity feed from raw log with minimal UI change
- **Location**: `rooms/laboratory/ui/stages/process-stage.ts`, `rooms/laboratory/ui/components/event-feed.ts`, `rooms/laboratory/ui/components/module-row.ts`, `rooms/laboratory/ui/stages/report-stage.ts`
- **Description**: Reuse the existing compact-card layout, but split the visible feed into:
  - Activity Feed
  - Raw Log behind collapse/debug affordance
  Remove empty progress bars and textual placeholders like generic `calisiyor...` where no real detail exists.
- **Complexity**: 6
- **Dependencies**: Task 3.1, Task 3.2
- **Acceptance Criteria**:
  - The process stage shows readable activity by default.
  - Raw log remains accessible for debugging without dominating the screen.
  - Module rows prefer counts, states, and latest meaningful event over decorative percent bars.
- **Validation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - manual Laboratory process-stage smoke

## Sprint 4: Empty Report Clarity And Hardening

**Goal**: Make report output trustworthy even when the run is sparse, blocked, or empty.

**Demo/Validation**:
- Report stage explains why content is empty.
- Exported report content mirrors the same reasons shown in the UI.
- Regression coverage guards against future fake-progress regressions.

### Task 4.1: Make report builders explain blank outcomes
- **Location**: `rooms/laboratory/services/report-builder.ts`, `rooms/laboratory/shared/host/reporting-feature-report.ts`, `rooms/laboratory/shared/host/reporting-markdown.ts`
- **Description**: Extend report generation so `userReport` and `aiReport` surface explicit causes for blank or thin outputs, such as blocked preflight, skipped module set, zero anomalies found, or unavailable evidence.
- **Complexity**: 7
- **Dependencies**: Sprint 3 complete
- **Acceptance Criteria**:
  - Blank report states produce explicit reason text.
  - Markdown export carries the same reason, not generic absence text only.
  - User report and AI report remain distinct outputs from the same run truth.
- **Validation**:
  - `scripts/tests/laboratory-media-report-behavior-regressions.test.ts`
  - markdown export assertions if needed

### Task 4.2: Remove remaining fake-progress affordances
- **Location**: `rooms/laboratory/ui/stages/process-stage.ts`, `rooms/laboratory/ui/components/module-row.ts`, any touched Laboratory room-local CSS only if required
- **Description**: Sweep the new room-local process UI for percent bars, idle placeholders, and status language that still implies fabricated certainty. Keep style changes strictly local and minimal.
- **Complexity**: 4
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - No instant full progress presentation remains in the process surface.
  - `running` copy is replaced by meaningful activity or explicit waiting reasons.
  - UI changes stay within the current shell and card layout.
- **Validation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - manual visual smoke

### Task 4.3: Add targeted regression coverage for truthfulness
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`, `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`, optional new runtime/parser regression files
- **Description**: Lock down the new truth model with tests covering:
  - canonical store ownership
  - semantic event parsing
  - raw log fallback
  - empty report reasons
  - absence of fabricated progress UI
- **Complexity**: 7
- **Dependencies**: Task 4.1, Task 4.2
- **Acceptance Criteria**:
  - The three requested patches are represented in regression coverage.
  - Installed parity tests still pass after schema/runtime changes.
  - A future duplicate event feed or fake progress reintroduction is caught.
- **Validation**:
  - full targeted Laboratory regression run

## Testing Strategy

- Run targeted Laboratory regressions after each sprint, not only at the end.
- Run any required generation/build step first when a suite depends on generated room or i18n artifacts.
- Prefer validating one seam at a time:
  - schema/state
  - host event emission
  - parser/finding engine
  - process/report UI
- Mandatory end-state checks:
  - `npm run typecheck`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-media-report-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`
  - `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
  - any directly impacted Laboratory room parity/runtime suite if schema or built file lists change
- Add fixture-based tests for raw output parsing so ffmpeg/yt-dlp line changes do not silently break readable activity.

## Potential Risks & Gotchas

- The current process schema does not yet persist canonical events, so snapshot and installed parity drift is the biggest migration risk.
- The current room relies on a global activity feed outside the process run, so collapsing every visible event into `run.events` would break source/edit/profile/report-export visibility.
- `stdout` and `stderr` arrive in chunks, not guaranteed lines. Parsing before buffering will create broken activity events.
- Media, audio, and subtitle features do not expose identical runtime evidence today. The event contract must support partial capability, not assume symmetry.
- The reducer currently knows how to fake continuity when host data is missing. Removing those fallbacks may temporarily expose more `idle` and `unknown` states until host emission is complete.
- Report builders currently rely heavily on end-state process records. Introducing event-derived reasoning without duplicating findings logic will require a clear precedence rule.
- Local persistence can accidentally resurrect stale run context unless running states are normalized on load.

## Mitigation Notes

- Migrate schema and host snapshot first before changing renderer expectations.
- Introduce semantic event parsing behind a bounded raw-log store so unknown lines remain debuggable.
- Keep one precedence rule for findings:
  - host-measured findings first
  - derived event findings second
  - explicit no-finding reason last
- Gate UI cleanup behind tests that prove the renderer still reflects host truth after fallbacks are removed.

## Rollback Plan

- Revert the new process schema fields and host snapshot additions first if installed parity or hydration breaks.
- Restore the previous reducer/selectors while keeping any isolated parser tests if host event rollout proves incomplete.
- Keep UI cleanup commits separate from host event/schema commits so truth-model regressions can roll back without losing safe presentation tweaks.
