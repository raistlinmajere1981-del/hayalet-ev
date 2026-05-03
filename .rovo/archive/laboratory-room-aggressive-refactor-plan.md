# Plan: Laboratory Room Aggressive Refactor

**Generated**: 2026-04-16  
**Estimated Complexity**: High

## Overview

This plan rebuilds the `laboratory` room as a dense desktop workbench driven by the provided `lab.png` screenshot, a deterministic runtime model, and a strict five-stage operating contract:

`source -> edit -> profile -> process -> report`

This is a breaking refactor. The goal is not to patch the current shell, spacing, or panel stack. The goal is to replace the current Laboratory UI/runtime composition with a room-local architecture that:

- uses one authoritative store for all visible state
- routes all runtime transitions through an event bus
- exposes only real process state and measurable progress
- generates two distinct report outputs from structured run data
- matches the screenshot structure with minimal decorative slack

The room ID, manifest entry points, feature IDs, installed-room contract, and real host processing capabilities remain externally compatible unless a task explicitly says otherwise.

## Research Summary

Current repository facts that shape this plan:

- The current Laboratory room is spread across `rooms/laboratory/ui`, `rooms/laboratory/shared/ui`, `rooms/laboratory/shared/host`, and `rooms/laboratory/main-functions/**`.
- The current shell is assembled from `rooms/laboratory/ui/laboratory-ui-runtime.ts`, `rooms/laboratory/ui/shell-composition.ts`, `rooms/laboratory/shared/ui/shell-frame.ts`, and shared CSS files.
- The current room already has real host-side processing, reporting, persistence, and room event plumbing in:
  - `rooms/laboratory/host/runtime.ts`
  - `rooms/laboratory/shared/host/process-*.ts`
  - `rooms/laboratory/shared/host/reporting*.ts`
  - `rooms/laboratory/shared/host/runtime-events.ts`
  - `rooms/laboratory/shared/host/project-*.ts`
- Saved project records already persist `source`, `edit`, `profile`, `audioAnalysis`, `subtitleAnalysis`, `process`, `report`, and optional `workbench` branches through `rooms/laboratory/shared/data/tools/project-schema.json` and host storage runtimes.
- The room build currently targets `*.ts` files only. `rooms/tsconfig.rooms.json` does not include `*.tsx`, and the repo does not currently expose React usage inside `rooms/`.
- Existing Laboratory regression coverage is already broad, including UI, source, edit, profile, process, report, host import, and installed parity tests under `scripts/tests/laboratory-*.test.ts`.
- Installed parity and UI smoke coverage already hard-code runtime file lists and the initial `roomAPI.ready({ feature: "media-analysis", room: "laboratory", stage: "ui-ready" })` bootstrap handshake, so shell migration cannot treat boot and parity as implied behavior.

## Scope

In scope:

- Full Laboratory room UI shell rebuild for all five stages
- New room-local store, selectors, and event bus
- New run controller and deterministic runtime transition model
- New preflight service and run pipeline orchestration surface
- Dual report output model: `UserReport` and `AiWorkReport`
- Screenshot-driven desktop layout replication
- Removal or retirement of redundant legacy Laboratory UI surfaces
- Persistence and recovery rules for source, configs, run summaries, and reports
- Regression updates for room-local and installed-copy behavior

Out of scope:

- Changing `rooms/laboratory/manifest.json` room identity or room ID
- Rewriting the underlying media/audio/subtitle engines if they already provide real output
- Introducing fake demo-only states to satisfy the mockup
- Spreading Laboratory-specific logic into unrelated rooms

## Assumptions And Hard Decisions

### Decision 1: Keep the current room build substrate

The user contract proposes `.tsx` modules and allows Zustand or RxJS. The repo currently has neither a React room runtime nor `*.tsx` support in `rooms/tsconfig.rooms.json`.

Recommended implementation path for this refactor:

- Build the requested structure as room-local `*.ts` renderer/runtime modules
- Keep the conceptual module map from the contract
- Use an internal observable store plus selectors instead of React component state
- Avoid a React/TSX platform migration inside the same breaking refactor

Normalized file map:

```text
rooms/laboratory/
  ui/
    lab-root.ts
    lab-layout.ts
    lab-left-rail.ts
    lab-center-panel.ts
    lab-right-panel.ts

    stages/
      source-stage.ts
      edit-stage.ts
      profile-stage.ts
      process-stage.ts
      report-stage.ts

    components/
      stage-header.ts
      primary-cta.ts
      compact-card.ts
      status-chip.ts
      empty-state.ts
      event-feed.ts
      module-row.ts
      finding-card.ts
      artifact-item.ts

  runtime/
    lab-store.ts
    lab-selectors.ts
    lab-event-bus.ts
    lab-run-controller.ts
    lab-persistence.ts
    lab-host-bridge.ts

  models/
    lab-types.ts
    lab-report-types.ts

  services/
    preflight-service.ts
    pipeline-runner.ts
    report-builder.ts
```

### Decision 2: Split persistence into renderer working-set and host authority

The contract asks for local persistence. The room already has host-side project storage and report persistence.

Recommended persistence model:

- `localStorage` stores the renderer working set:
  - `currentStage`
  - `source`
  - `editConfig`
  - `profileConfig`
  - lightweight `lastRun` summary
  - lightweight `reports` summary
- Host project storage remains the authority for heavy artifacts, exports, and recoverable process outputs
- On reload, the new store hydrates from local persistence first, then reconciles against host snapshot state
- Any restored run must be normalized to `completed`, `failed`, or `cancelled`, never `running`

### Decision 3: Reuse only deterministic host capabilities

Existing host-side process, report, and storage code can stay only when it maps cleanly into the new state model. Any legacy UI-derived labels, duplicated summaries, or guessed readiness state must be removed.

### Decision 4: Host remains the canonical runtime and report authority

The new renderer store is not the authority for process execution, cancellation, hydration, or export persistence.

Required authority split:

- host-side runtime remains canonical for:
  - process execution
  - cancellation
  - project hydration
  - report persistence
  - report export
- renderer-side store becomes the canonical view projection only
- the new renderer event bus is a normalized subscription layer fed by host-side runtime events, not a replacement process authority
- any new run/report model must be serialized through host-side project records and export seams before the UI treats it as durable state

## Current Architecture Risks

- Existing UI responsibilities are split across many Laboratory files, which increases migration drift risk.
- The current room already derives process/report state in multiple places, so duplicate-data regressions are likely unless the new store becomes the only renderer source.
- Existing tests likely encode pieces of current markup and copy shape, so installed parity regressions must be updated deliberately, not patched opportunistically.
- The screenshot pushes the room toward a denser shell than the current layout system was built for; panel ownership must be simplified before styling.

## Prerequisites

- `lab.png` in repo root is the visual source of truth for desktop structure.
- Existing room runtime entry points stay stable:
  - `rooms/laboratory/ui/index.html`
  - `rooms/laboratory/ui/index.ts`
  - `rooms/laboratory/host/index.ts`
- The bootstrap contract must remain stable during migration:
  - `roomAPI.ready({ feature: "media-analysis", room: "laboratory", stage: "ui-ready" })`
- Compatibility must be tracked explicitly for all shipped Laboratory feature paths:
  - `media-analysis`
  - `audio-analysis`
  - `subtitle-analysis`
- New room-local modules are created under `rooms/laboratory/{ui,runtime,models,services}`.
- Core regression suites to keep green by the end:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-host-import-smoke-regressions.test.ts`
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-media-source-portability-regressions.test.ts`
  - `scripts/tests/laboratory-media-edit-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-media-profile-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-media-report-behavior-regressions.test.ts`
  - installed parity suites for media/profile/edit where applicable

## Acceptance Contract

The refactor is only done when all of the following are true:

- The user can answer at all times:
  - `su an ne oluyor?`
  - `hangi asamadayim?`
  - `ne uretilecek?`
- No visible UI state exists without store-backed runtime data.
- Each stage has exactly one primary CTA.
- Source metadata, run summary, preflight, events, artifacts, and reports each have one clear ownership surface.
- User report and AI report are different outputs derived from the same structured run.
- Progress bars only move from real measurable runtime signals.
- Every blocked action explains why it is blocked.
- The resulting shell matches the screenshot structure closely enough that differences are styling polish, not layout architecture.
- The room still emits the current `roomAPI.ready` bootstrap payload on first paint.

## Sprint 1: Room Ownership Reset And Shell Skeleton

**Goal**: Establish the new room-local module ownership, replace the old shell entry with a minimal three-zone skeleton, and keep the room boot contract intact without doing final visual styling yet.

**Demo/Validation**:

- Laboratory still boots from `ui/index.html`.
- The room renders a new left / center / right skeleton from the new root module.
- Stage switching is store-driven even if the stage contents are still placeholders.
- The old Laboratory shell no longer owns the main composition path.

### Task 1.1: Create the new room-local module map and migration seam

- **Location**: `rooms/laboratory/ui/index.ts`, `rooms/laboratory/ui/laboratory-ui-runtime.ts`, new files under `rooms/laboratory/{ui,runtime,models,services}`
- **Description**: Add the new room-local module structure, keep `ui/index.ts` as the public entry, and turn `laboratory-ui-runtime.ts` into a thin delegator or retirement seam instead of the real composition owner.
- **Complexity**: 7
- **Dependencies**: None
- **Acceptance Criteria**:
  - The new root runtime has a single entry path.
  - Legacy shell files are no longer the architectural center.
  - The room still mounts under the existing runtime contract.
- **Validation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - manual boot smoke in the built room copy

### Task 1.2: Define canonical Laboratory runtime and report types

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/models/lab-report-types.ts`
- **Description**: Create the authoritative stage, source, config, run, module, event, artifact, finding, preflight, and dual-report types. These files become the contract consumed by UI, runtime, and services.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `LabStore`, `LabRun`, `ModuleState`, `LabEvent`, `LabArtifact`, `LabFinding`, `PreflightResult`, `UserReport`, and `AiWorkReport` are defined in one place.
  - Finding classification includes `measured`, `derived`, and `heuristic`.
  - Status names are normalized and language-neutral.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.3: Mount an unstyled three-zone layout shell

- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-layout.ts`, `rooms/laboratory/ui/lab-left-rail.ts`, `rooms/laboratory/ui/lab-center-panel.ts`, `rooms/laboratory/ui/lab-right-panel.ts`
- **Description**: Render a minimal structural shell that reflects the screenshot's column logic without spending effort on polish before runtime exists.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The room renders one left rail, one center panel, and one right panel.
  - Stage routing happens from a single root path.
  - No legacy bottom info strip is carried forward.
- **Validation**:
  - targeted UI smoke under minimal room stubs

### Task 1.4: Create stage placeholders and a single-CTA shell contract

- **Location**: `rooms/laboratory/ui/stages/*.ts`, `rooms/laboratory/ui/components/stage-header.ts`, `rooms/laboratory/ui/components/primary-cta.ts`, `rooms/laboratory/ui/components/empty-state.ts`
- **Description**: Build placeholder stage modules with a consistent title, subtitle, empty-state, and one-primary-action rule so stage behavior can be filled in sprint by sprint.
- **Complexity**: 5
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Every stage module exports the same basic render contract.
  - Each stage renders at most one primary CTA.
  - Empty-state component exists and is reusable.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.5: Preserve boot handshake, feature compatibility, and parity guardrails

- **Location**: `rooms/laboratory/ui/index.ts`, `rooms/laboratory/ui/laboratory-ui-runtime.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, installed parity regression files under `scripts/tests/laboratory-*-installed-parity-regressions.test.ts`
- **Description**: Lock the current `roomAPI.ready` handshake and define a compatibility matrix for `media-analysis`, `audio-analysis`, and `subtitle-analysis` before large file churn begins. Update the test guardrails in lockstep with root-shell migration instead of after legacy deletion.
- **Complexity**: 6
- **Dependencies**: Tasks 1.1, 1.3
- **Acceptance Criteria**:
  - First paint still emits `roomAPI.ready({ feature: "media-analysis", room: "laboratory", stage: "ui-ready" })`.
  - The plan of record includes which new modules own each existing feature path.
  - Installed parity file lists and boot smoke expectations are treated as tracked migration seams, not cleanup leftovers.
- **Validation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - targeted installed parity tests touched by entry-point churn

## Sprint 2: Deterministic Store, Event Bus, And Persistence

**Goal**: Replace view-driven state with a host-canonical runtime plus a single deterministic renderer projection store, event bus routing, and reload-safe persistence.

**Demo/Validation**:

- The Laboratory shell reads all visible state from one store.
- Host-side runtime remains the authority for run, cancellation, hydration, and durable reports.
- Runtime transitions go through `emitEvent(event)`.
- Reload restores source and configs without reviving a `running` state.
- The shell can render stage and status text without host-side guessing.

### Task 2.1: Build the store and selector layer

- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Create an internal observable store for `LabStore`, immutable update helpers, and memoized selectors so stage panels do not re-render from unrelated events.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `currentStage`, `run`, `source`, `editConfig`, `profileConfig`, `preflight`, and `reports` live in one store.
  - Core render surfaces consume selectors, not ad hoc object reads.
  - Local per-component state is limited to ephemeral DOM-only concerns.
- **Validation**:
  - `npm run rooms:typecheck`
  - targeted selector tests if added

### Task 2.2: Implement the event bus contract

- **Location**: `rooms/laboratory/runtime/lab-event-bus.ts`
- **Description**: Add `emitEvent(event)` plus subscription and replay utilities. All state transitions from probes, preview, preflight, process, cancellation, and report generation must enter through this bus.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The UI no longer mutates process state directly.
  - Event severity, timestamp, and message shape are normalized.
  - The event log can be sourced directly from store-backed events.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.3: Add store hydration and persistence reconciliation

- **Location**: `rooms/laboratory/runtime/lab-persistence.ts`
- **Description**: Persist the renderer working set to local storage, restore it on boot, and reconcile against host-provided room snapshot data.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Source, edit config, profile config, last run summary, and report summaries persist across reload.
  - Restored run state is never `running`.
  - Persisted data versioning is explicit.
- **Validation**:
  - reload smoke check
  - `npm run rooms:typecheck`

### Task 2.4: Build the host-to-store bridge

- **Location**: `rooms/laboratory/runtime/lab-host-bridge.ts`, `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/host/runtime.ts`, `rooms/laboratory/shared/host/process-runtime.ts`, `rooms/laboratory/shared/host/process-coordination.ts`, `rooms/laboratory/shared/host/runtime-events.ts`
- **Description**: Pin the host as the canonical authority for runtime transitions, then translate host messages, snapshots, and normalized process/report events into renderer event-bus inputs and store patches. The renderer becomes a deterministic subscriber instead of a second runtime.
- **Complexity**: 8
- **Dependencies**: Tasks 2.2, 2.3
- **Acceptance Criteria**:
  - Existing room host messages feed the new event path.
  - Canonical run/report authority remains on the host side.
  - The renderer does not guess current stage, run state, or report readiness.
  - The bridge is room-local and does not leak into unrelated rooms.
- **Validation**:
  - `scripts/tests/laboratory-host-import-smoke-regressions.test.ts`
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 2.5: Add project schema migration and compatibility reconciliation

- **Location**: `rooms/laboratory/shared/data/tools/project-schema.json`, `rooms/laboratory/shared/host/project-storage.ts`, `rooms/laboratory/shared/host/project-lifecycle.ts`, `rooms/laboratory/shared/host/runtime-storage.ts`, `rooms/laboratory/runtime/lab-persistence.ts`
- **Description**: Define how the new store slices map onto existing project branches for `source`, `edit`, `profile`, `audioAnalysis`, `subtitleAnalysis`, `process`, `report`, and `workbench`. Add any required migration helpers so older saved projects remain readable and writable during the refactor.
- **Complexity**: 8
- **Dependencies**: Tasks 2.1, 2.3, 2.4
- **Acceptance Criteria**:
  - Existing saved projects remain schema-compatible.
  - Renderer working-set persistence and host project storage have a documented authority boundary.
  - Audio and subtitle branches are explicitly covered, not implied by media-analysis defaults.
- **Validation**:
  - `npm run rooms:typecheck`
  - targeted storage or hydration regression coverage if added

## Sprint 3: Source Stage Rebuild

**Goal**: Deliver a deterministic source stage with compact intake, real probe lifecycle, stage gating, and a right-side source summary panel mapped directly from source state.

**Demo/Validation**:

- User can select file or URL, set alias, review scope summary, and run `Kaynagi Hazirla`.
- Probe lifecycle visibly emits started, progress, completed, or failed events.
- Next stage is disabled until probe completes successfully.
- The right panel reflects the active source state only.

### Task 3.1: Define source model and probe statuses

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add source records, probe statuses, blocking reasons, and module-scope summary shape so the source stage can render without touching legacy source-stage helpers.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Source state includes identity, alias, kind, probe status, metadata, and error fields.
  - Next-stage gating rules are encoded in selectors, not inline UI conditionals.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 3.2: Implement source probe service and events

- **Location**: `rooms/laboratory/services/pipeline-runner.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add source probe orchestration that emits `source_probe_started`, optional progress, and terminal success or failure events using real probe output only.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Probe completion is based on actual source inspection.
  - Failures emit visible error state.
  - No optimistic next-stage enablement occurs before completion.
- **Validation**:
  - `scripts/tests/laboratory-media-source-portability-regressions.test.ts`

### Task 3.3: Build the new source stage UI

- **Location**: `rooms/laboratory/ui/stages/source-stage.ts`, `rooms/laboratory/ui/components/compact-card.ts`, `rooms/laboratory/ui/lab-right-panel.ts`
- **Description**: Render the dense source stage layout from the screenshot: project selector, file/URL intake, alias, scope summary, one primary CTA, and right-side source state summary.
- **Complexity**: 7
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Source metadata appears in one right-side ownership surface only.
  - The stage has exactly one primary CTA.
  - Empty state explains why the next stage is unavailable.
- **Validation**:
  - UI smoke
  - `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`

### Task 3.4: Remove legacy source UI dependencies from the main shell path

- **Location**: `rooms/laboratory/ui/source-stage-composition.ts`, `rooms/laboratory/shared/ui/source-stage*.ts`, `rooms/laboratory/shared/ui/source-snapshot-*.ts`
- **Description**: Retire or isolate old source-stage composition from the main render path so there is only one active source-stage implementation.
- **Complexity**: 7
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - The new source stage owns rendering.
  - Legacy source helpers are either deleted, wrapped, or clearly marked as compatibility-only.
  - Duplicate source summaries are gone.
- **Validation**:
  - `npm run rooms:typecheck`
  - source stage smoke regression

## Sprint 4: Edit Stage Rebuild

**Goal**: Deliver a compact edit stage with real preview lifecycle, collapsed advanced controls, explicit source-reference selection, and no fake completion behavior.

**Demo/Validation**:

- The stage shows only core controls first.
- Advanced controls stay collapsed by default.
- Preview creation emits real lifecycle events.
- The user can switch between `original` and `preview` output reference.

### Task 4.1: Define edit config and preview state

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Model edit config, preview job state, preview error state, and `activeSourceRef`.
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - `editConfig` becomes a first-class store slice.
  - Preview state is not inferred from UI visibility.
  - `activeSourceRef` is centralized.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 4.2: Implement preview job orchestration

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/services/pipeline-runner.ts`
- **Description**: Add `startPreviewJob(editConfig)` and emit `preview_started`, optional progress, `preview_completed`, or `preview_failed`.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Preview completion only occurs when a real preview result exists.
  - Failure is visible and actionable.
  - Preview state survives rerenders and reload reconciliation.
- **Validation**:
  - `scripts/tests/laboratory-media-edit-behavior-regressions.test.ts`

### Task 4.3: Build the new edit stage and preview ownership surfaces

- **Location**: `rooms/laboratory/ui/stages/edit-stage.ts`, `rooms/laboratory/ui/lab-center-panel.ts`, `rooms/laboratory/ui/lab-right-panel.ts`
- **Description**: Render compact edit controls, a dense workspace, advanced section collapse behavior, preview output surface, and one primary CTA.
- **Complexity**: 8
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Core controls render first and stay dense.
  - Advanced controls are closed by default.
  - Preview summary and active source reference are explicit.
- **Validation**:
  - `scripts/tests/laboratory-media-edit-behavior-regressions.test.ts`
  - installed parity regression for edit if affected

### Task 4.4: Retire duplicated edit summaries and non-runtime labels

- **Location**: current edit-related files under `rooms/laboratory/main-functions/media-analysis/ui/*`
- **Description**: Remove duplicated summary cards, fake completion phrasing, and any static labels that do not map to actual preview state.
- **Complexity**: 6
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - There is one preview summary surface.
  - No static `calisiyor` or success state survives without runtime backing.
  - The stage remains dense and non-redundant.
- **Validation**:
  - edit regression suite

## Sprint 5: Profile Stage And Deterministic Preflight

**Goal**: Deliver a profile stage that translates profile config and source state into a real preflight result with blocking, warning, and readiness behavior.

**Demo/Validation**:

- User can configure profile inputs in one compact stage.
- Running preflight yields a real `PreflightResult`.
- Blocking rules disable the next stage when appropriate.
- The profile banner maps directly from `preflight.status`.

### Task 5.1: Build the preflight service contract

- **Location**: `rooms/laboratory/services/preflight-service.ts`, `rooms/laboratory/models/lab-types.ts`
- **Description**: Implement `runPreflight(profileConfig, source)` returning `status`, `missingDependencies`, `warnings`, `estimatedRuntime`, and `enabledModules`.
- **Complexity**: 8
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Preflight status is deterministic.
  - Missing dependencies and warnings are structured, not embedded in prose.
  - Enabled modules are derived once and reused downstream.
- **Validation**:
  - `npm run rooms:typecheck`
  - targeted preflight tests if added

### Task 5.2: Integrate preflight into the controller and event bus

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/runtime/lab-event-bus.ts`
- **Description**: Emit preflight lifecycle events and reconcile the resulting `PreflightResult` into the store.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Preflight start, success, warning, and failure are event-driven.
  - Stage gating uses store selectors only.
  - Preflight can be re-run after config changes.
- **Validation**:
  - `scripts/tests/laboratory-media-profile-behavior-regressions.test.ts`

### Task 5.3: Build the new profile stage UI

- **Location**: `rooms/laboratory/ui/stages/profile-stage.ts`, `rooms/laboratory/ui/components/status-chip.ts`
- **Description**: Render compact profile controls, a preflight banner, module readiness summary, and one primary CTA.
- **Complexity**: 7
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Banner tone maps from `preflight.status`, not guessed strings.
  - Missing dependencies and warnings are visible before process start.
  - Blocking preflight disables the primary CTA for the next stage.
- **Validation**:
  - profile behavior regression suite

### Task 5.4: Reconcile existing profile-model and tool-state storage

- **Location**: `rooms/laboratory/host/feature-runtimes.ts`, `rooms/laboratory/shared/host/runtime-storage.ts`, `rooms/laboratory/runtime/lab-persistence.ts`
- **Description**: Ensure the new profile store and preflight logic reuse existing persisted tool/profile state where reliable, without leaking legacy renderer assumptions into the new stage.
- **Complexity**: 7
- **Dependencies**: Tasks 5.1, 5.2
- **Acceptance Criteria**:
  - Persisted tool/profile model data still hydrates.
  - The new stage does not duplicate host persistence responsibilities.
  - Reloaded profile state produces the same preflight result from the same inputs.
- **Validation**:
  - profile installed parity regression

## Sprint 6: Pipeline Runtime, Module Lifecycle, And Process Stage

**Goal**: Deliver the real run pipeline, event feed, module rows, cancellation flow, and process stage surfaces using only real runtime state.

**Demo/Validation**:

- Starting a run creates a `LabRun`.
- Enabled modules execute in sequence or documented orchestration order.
- Module rows reflect only `store.run.modules[moduleName]`.
- Event feed reflects the event bus.
- Cancellation transitions are visible and durable.

### Task 6.1: Implement the `LabRun` lifecycle model

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Create run IDs, lifecycle states, module-state tracking, findings, artifacts, timestamps, and cancellation semantics.
- **Complexity**: 8
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - A run object exists before module execution starts.
  - Module state and run state are normalized in one place.
  - Cancellation and terminal states are explicit.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 6.2: Build the pipeline runner around enabled modules

- **Location**: `rooms/laboratory/services/pipeline-runner.ts`, existing host process composition files under `rooms/laboratory/shared/host/process-*.ts`
- **Description**: Orchestrate module execution by consuming `enabledModules` from preflight and emitting `module_started`, measurable `module_progress`, and terminal finish/fail/skip events.
- **Complexity**: 9
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Fake progress increments are prohibited.
  - Module progress is emitted only when measurable.
  - Existing host runners are reused only through the new controller boundary.
- **Validation**:
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - related audio/subtitle room regressions if shared runners are touched

### Task 6.3: Build event feed, module row, and process summary components

- **Location**: `rooms/laboratory/ui/components/event-feed.ts`, `rooms/laboratory/ui/components/module-row.ts`, `rooms/laboratory/ui/stages/process-stage.ts`
- **Description**: Render the process stage from the store using compact module rows, event feed entries, run summary, and one primary CTA for start or cancel depending on state.
- **Complexity**: 8
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - Module row status comes from centralized `mapStatus`.
  - The event feed shows timestamp, message, and severity from the store.
  - Run summary is owned by the process right panel only.
- **Validation**:
  - process behavior regression suite

### Task 6.4: Add event-feed virtualization and artifact lazy rendering

- **Location**: `rooms/laboratory/ui/components/event-feed.ts`, `rooms/laboratory/ui/components/artifact-item.ts`, selector layer
- **Description**: Prevent full-stage rerenders and heavy DOM growth when events exceed 200 or artifacts grow large.
- **Complexity**: 7
- **Dependencies**: Task 6.3
- **Acceptance Criteria**:
  - Event feed virtualizes or window-renders beyond 200 events.
  - Artifact list lazy-renders.
  - Stage rendering is selector-driven, not whole-store repainting.
- **Validation**:
  - manual long-run smoke
  - `npm run rooms:typecheck`

### Task 6.5: Implement `cancelRun(runId)` semantics

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/services/pipeline-runner.ts`
- **Description**: Support cancellation that marks the current module cancelled, transitions the run to `cancelled`, and emits `run_cancelled`.
- **Complexity**: 7
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - Cancellation is visible in both module state and run state.
  - Cancellation survives reload as a terminal state.
  - Silent cancellation failure is not allowed.
- **Validation**:
  - process behavior regression suite

## Sprint 7: Dual Reports And Report Stage

**Goal**: Generate two structured report outputs from the same run and render them in a dense report stage that stays faithful to the screenshot language.

**Demo/Validation**:

- Process completion produces both user and AI reports.
- User report is concise and evidence-linked.
- AI report contains the full technical work record.
- Report stage clearly distinguishes the two without duplicating content.

### Task 7.1: Implement user report builder

- **Location**: `rooms/laboratory/services/report-builder.ts`, `rooms/laboratory/models/lab-report-types.ts`
- **Description**: Add `buildUserReport(run)` that selects up to three top findings, summary, confidence, and linked evidence without raw logs.
- **Complexity**: 7
- **Dependencies**: Sprint 6
- **Acceptance Criteria**:
  - Raw logs are excluded.
  - Findings are evidence-linked.
  - Output is concise and user-oriented.
- **Validation**:
  - `scripts/tests/laboratory-media-report-behavior-regressions.test.ts`

### Task 7.2: Implement AI work report builder

- **Location**: `rooms/laboratory/services/report-builder.ts`, `rooms/laboratory/models/lab-report-types.ts`
- **Description**: Add `buildAiReport(run)` with manifest, findings, artifacts, warnings, errors, degraded conditions, and classified finding kinds.
- **Complexity**: 7
- **Dependencies**: Task 7.1
- **Acceptance Criteria**:
  - AI report contains full work record.
  - Each finding includes `kind`.
  - Degraded conditions and warnings are explicit.
- **Validation**:
  - report behavior regression suite

### Task 7.3: Reconcile existing reporting/export seams

- **Location**: `rooms/laboratory/shared/host/reporting.ts`, `rooms/laboratory/shared/host/reporting-feature-report.ts`, `rooms/laboratory/shared/host/reporting-export.ts`
- **Description**: Rewire host-side reporting so dual outputs are serialized, persisted, and exported before the new report-stage UI binds to them. This includes updating `composeFeatureReport`, markdown generation, and export record persistence so `UserReport` and `AiWorkReport` do not collapse back into one output bottleneck.
- **Complexity**: 8
- **Dependencies**: Tasks 7.1, 7.2
- **Acceptance Criteria**:
  - Existing export flows still work or are intentionally replaced.
  - Both user-facing and AI-facing outputs are serialized and persisted through host-side report records.
  - User and AI report outputs remain separate.
  - Report persistence maps back to room authority cleanly.
- **Validation**:
  - report regression suites
  - installed parity tests for report-sensitive stages

### Task 7.4: Build the new report stage UI

- **Location**: `rooms/laboratory/ui/stages/report-stage.ts`, `rooms/laboratory/ui/components/finding-card.ts`, `rooms/laboratory/ui/components/artifact-item.ts`
- **Description**: Render the final stage with dual report surfaces, evidence-linked findings, artifact list, empty state, and one primary CTA for export or follow-up action.
- **Complexity**: 8
- **Dependencies**: Task 7.3
- **Acceptance Criteria**:
  - User report and AI report are visibly distinct.
  - Empty state exists when no run/report is available.
  - Artifact list and findings are dense and readable.
- **Validation**:
  - report regression suite

## Sprint 8: Screenshot Fidelity, Dense Styling, And UI Rule Enforcement

**Goal**: Apply the final visual system so the rebuilt runtime shell matches the provided screenshot structure and spacing discipline.

**Demo/Validation**:

- Source, edit, and process visually map to the screenshot frames.
- Profile and report inherit the same workbench language.
- Dead space, redundant panels, and oversized actions are gone.
- Stage hierarchy is readable at a glance.

### Task 8.1: Replace the current Laboratory style system with room-local shell styles

- **Location**: `rooms/laboratory/ui/style.css`, optionally new room-local component/style partials under `rooms/laboratory/ui` or `rooms/laboratory/shared/styles`
- **Description**: Rebuild spacing, layout, surface, typography, radius, border, and highlight rules around the screenshot instead of refining the current roomy shell.
- **Complexity**: 8
- **Dependencies**: Sprint 7
- **Acceptance Criteria**:
  - Left rail is compact and tool-like.
  - Center and right panels use tighter rhythm and denser grouping.
  - Decorative empty zones are removed.
- **Validation**:
  - manual screenshot comparison at desktop sizes

### Task 8.2: Map screenshot structure per stage

- **Location**: `rooms/laboratory/ui/stages/*.ts`, related component files
- **Description**: Align source, edit, and process stages to the screenshot composition and extend the same chrome to profile and report without inventing a separate language.
- **Complexity**: 8
- **Dependencies**: Task 8.1
- **Acceptance Criteria**:
  - Source reflects the first screenshot frame.
  - Edit reflects the second screenshot frame.
  - Process reflects the third screenshot frame.
  - Profile/report remain visually coherent within the same system.
- **Validation**:
  - manual stage-by-stage comparison with `lab.png`

### Task 8.3: Enforce no-duplication and single-CTA rules in UI composition

- **Location**: `rooms/laboratory/ui/lab-left-rail.ts`, `rooms/laboratory/ui/lab-center-panel.ts`, `rooms/laboratory/ui/lab-right-panel.ts`, stage modules
- **Description**: Audit and remove duplicated summaries, multi-primary layouts, decorative giant buttons, and mixed-language runtime labels.
- **Complexity**: 6
- **Dependencies**: Task 8.2
- **Acceptance Criteria**:
  - Each stage has exactly one primary CTA.
  - Each data point has one ownership surface.
  - Static mixed TR/EN labels are gone.
- **Validation**:
  - manual UI audit
  - targeted smoke checks

### Task 8.4: Add empty-state, blocked-reason, and failure-surface coverage

- **Location**: stage modules and shared components
- **Description**: Ensure every no-source, no-preview, no-run, blocked-preflight, and failed-process path has a visible explanation.
- **Complexity**: 6
- **Dependencies**: Task 8.3
- **Acceptance Criteria**:
  - Every blocked primary action has a visible reason.
  - Every failure path is visible in-stage.
  - Silent failures are eliminated.
- **Validation**:
  - manual failure-path smoke

## Sprint 9: Legacy Retirement, Regression Closure, And Release Readiness

**Goal**: Remove obsolete Laboratory shell code from the main path, update regressions, and leave the room in a stable post-refactor state.

**Demo/Validation**:

- New shell and runtime are the only active Laboratory path.
- Obsolete legacy composition files are deleted or reduced to compatibility wrappers.
- Typecheck and targeted Laboratory regression suites pass.

### Task 9.1: Retire legacy UI composition paths

- **Location**: legacy Laboratory files under `rooms/laboratory/ui` and `rooms/laboratory/shared/ui`
- **Description**: Delete or freeze old shell composition files that are no longer used after the new root is fully active.
- **Complexity**: 7
- **Dependencies**: Sprint 8
- **Acceptance Criteria**:
  - There is one active Laboratory UI path.
  - Legacy files no longer shadow new behavior.
  - Removal does not break room bootstrap.
- **Validation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-host-import-smoke-regressions.test.ts`

### Task 9.2: Refresh installed-copy and room parity regressions

- **Location**: `scripts/tests/laboratory-*.test.ts`
- **Description**: Update tests that relied on old markup, old summary layouts, hard-coded installed-copy file lists, and the current boot-ready handshake so they assert the new deterministic store-backed shell without silently dropping parity coverage.
- **Complexity**: 8
- **Dependencies**: Task 9.1
- **Acceptance Criteria**:
  - Installed copy parity suites reflect the new shell.
  - Hard-coded file lists are updated intentionally to the new active runtime path.
  - Boot smoke assertions still verify the expected ready payload.
  - Room import and UI evaluation tests target the new architecture.
  - Behavior regressions still cover source, edit, profile, process, and report.
- **Validation**:
  - run targeted Laboratory test suites

### Task 9.3: Run final typecheck and room regression sweep

- **Location**: whole room
- **Description**: Validate type safety and end-to-end Laboratory behavior with the room-specific suites and any new targeted tests introduced during the refactor.
- **Complexity**: 5
- **Dependencies**: Task 9.2
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - Targeted Laboratory regression suites pass.
  - No known duplicate-state or fake-progress issues remain.
- **Validation**:
  - `npm run rooms:typecheck`
  - targeted `node --test` or project test command for Laboratory suites

### Task 9.4: Leave a short migration note for future room work

- **Location**: `rooms/laboratory/` comments or a room-local note if needed
- **Description**: Document the new ownership boundaries, deterministic runtime rules, and non-negotiable UI rules so future changes do not reintroduce duplicated state or decorative shell drift.
- **Complexity**: 3
- **Dependencies**: Task 9.3
- **Acceptance Criteria**:
  - Future contributors can identify the new root runtime and store boundaries quickly.
  - The note explains why the new shell resists scattered UI additions.
- **Validation**:
  - manual review

## Testing Strategy

- Keep each sprint demoable and bootable from the normal room entry points.
- Prefer targeted Laboratory suites after each sprint rather than waiting for one large final pass.
- Mandatory end-state checks:
  - `npm run rooms:typecheck`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - source, edit, profile, process, and report Laboratory behavior regressions
  - installed parity regressions impacted by shell or markup changes

Recommended validation cadence:

1. After Sprint 1-2:
   - UI evaluation regression
   - host import smoke
   - boot-ready handshake assertion
   - typecheck
2. After Sprint 3-5:
   - source/edit/profile suites
   - typecheck
3. After Sprint 6-7:
   - process/report suites
   - dual export/report persistence checks
   - installed parity where relevant
4. After Sprint 8-9:
   - full targeted Laboratory sweep
   - installed-copy file-list parity sweep

## Potential Risks And Gotchas

- **TSX mismatch**: The requested `.tsx` module list does not match the current room toolchain.  
  Mitigation: keep this refactor on `*.ts` room-local render modules unless a separate platform migration is approved.

- **Legacy host/report coupling**: Existing report export and process orchestration may assume old view-layer summary shapes.  
  Mitigation: add explicit compatibility adapters at the new runtime boundary and update report regressions early.

- **Duplicate state drift during migration**: Old stage accessors and new store may both exist temporarily.  
  Mitigation: retire old composition from the active shell as early as possible and make the new store the only renderer source in Sprint 2.

- **Installed-room parity drift**: Built-room copies may still reference retired files.  
  Mitigation: keep entry points stable and refresh installed parity tests before deleting compatibility wrappers.

- **Performance regression from event-heavy runs**: Dense UI plus many events can trigger repaint storms.  
  Mitigation: selector-driven subscriptions, event-feed virtualization, and artifact lazy rendering are mandatory.

- **Mixed persistence authority**: Renderer local storage and host room storage can diverge.  
  Mitigation: define host authority vs renderer working set explicitly and reconcile at boot.

- **Screenshot overfitting without runtime clarity**: Blindly matching the image can create attractive but opaque flows.  
  Mitigation: follow priority order `real state > visual animation`, `clarity > decoration`, `structured data > free text`, `fewer panels > more panels`.

## Rollback Plan

- Keep `rooms/laboratory/ui/index.ts` as the stable room entry throughout the refactor.
- Until Sprint 9, preserve the old shell behind wrappers or branch history so the room can be reverted by switching the root import path back.
- Land the work in sprint-sized commits so any regression can be rolled back to the last working stage without discarding the entire refactor.
- Do not delete legacy files until the new root path boots, typechecks, and passes the targeted Laboratory regression suites.

## Recommended Execution Order

Implementation should follow this order:

1. Shell skeleton and room-local ownership reset
2. Global store and event bus
3. Source stage
4. Edit stage
5. Profile stage and preflight
6. Run controller and pipeline runtime
7. Process stage UI
8. Report builders
9. Report stage UI
10. Screenshot fidelity and dense styling
11. Legacy cleanup and regression closure

This preserves the user-requested priority order while respecting the hard rule that final styling should not start before the runtime model exists.
