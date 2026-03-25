# Plan: Laboratory Media Closeout

**Generated**: 2026-03-25
**Estimated Complexity**: High

## Overview

Close the remaining medium-severity gaps in the `laboratory` room so the media-analysis workflow can move from a strong internal workbench toward a true release candidate.

This closeout plan covers four remaining areas:

- turn `process` from a simulated progress screen into a real room-managed pipeline
- turn `report` from a staged handoff view into a real final-report and export surface
- move `audio-analysis` from plan-only into a real second laboratory feature
- widen room-managed tool portability so required bootstrap paths are not effectively platform-limited

The plan assumes the current `source`, `edit`, and `profile` stages stay intact and are treated as stable foundations.

## Scope Lock

- In scope:
  - real `process` stage host orchestration and UI wiring
  - real `report` stage data model, rendering, and export output
  - `audio-analysis` feature bootstrap and first real local-first implementation slice
  - room-local tool portability matrix expansion
  - parity, exportability, and regression hardening for the new surfaces
- Out of scope:
  - cloud-only analyzers as hard requirements
  - courtroom-grade certainty or definitive authorship claims
  - replacing the existing room-local architecture
- Allowed outside-scope changes:
  - small generic Electron seam extensions for room-managed jobs, exports, model assets, or platform-aware installs

## Success Criteria

- `process` is no longer UI-local fake progress
- `report` can render persisted process outputs and export a real report artifact
- `audio-analysis` is selectable as a working feature with honest implemented vs planned modules
- required room tools have a clearly broader portability story than the current partial matrix
- installed-room parity and export behavior remain green

## Current Baseline

- `source`, `edit`, and `profile` are substantially real
- installed-room parity already exists for `media-analysis`
- the room manifest already includes `audio-analysis`, but the feature does not yet have a complete descriptor/runtime/test surface
- `process` and `report` still rely on staged compatibility behavior inside the UI

## Prerequisites

- Current media-analysis regressions stay green before starting
- Room project schema continues to support backward-compatible upgrades
- Existing toolchain manifest remains the source of truth for room-managed binaries
- `npm run typecheck` and `npm run electron:build` remain required gates per sprint

## Sprint 1: Lock The Closeout Contracts

**Goal**: Freeze the missing contracts before implementing new behavior so later sprints do not invent incompatible state branches.
**Demo/Validation**:

- A documented closeout contract exists for `process`, `report`, `audio-analysis`, and portability
- The room schema and descriptor set can represent the planned behavior without breaking existing projects

### Task 1.1: Extend the project schema for process and report persistence

- **Location**: `rooms/laboratory/tools/project-schema.json`
- **Description**: Add normalized `process` and `report` branches for pipeline runs, module results, report summary cards, export records, artifact references, and backward-compatible defaults.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Existing projects upgrade without losing current `source/edit/profile` data
  - `process` and `report` state can be saved independently of UI-local defaults
  - Export output metadata is represented explicitly
- **Validation**:
  - Manual schema review
  - Regression assertion for default migration behavior

### Task 1.2: Define the real process/report action envelope

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Define `process-run`, `process-cancel`, `report-export`, `report-state`, `report-job`, and `report-action-result` payloads with `requestId`, `jobId`, cancellation, stale-response handling, and artifact/result correlation.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `process` jobs and `report` jobs use the shared room envelope rather than UI-only timers
  - Process completion can hand off to report without implicit UI mutation
  - Export jobs are cancellable or at minimum isolated and observable
- **Validation**:
  - Manual envelope review
  - Regression test for process/report correlated payload handling

### Task 1.3: Lock the audio-analysis feature contract

- **Location**: `rooms/laboratory/manifest.json`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/tools/audio-analysis-capabilities.json`, `rooms/laboratory/tools/audio-analysis-presets.json`, `rooms/laboratory/tools/audio-analysis-providers.json`
- **Description**: Formalize the descriptor files for the second feature and mark every analysis family as `implemented`, `planned`, `unsupported`, or `platform-limited`.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Audio feature contract is descriptor-driven and room-local
  - Implemented vs planned modules are explicit
  - The feature can remain honest about unavailable providers
- **Validation**:
  - Descriptor parse smoke test
  - Regression test for required descriptor presence

### Task 1.4: Lock the portability matrix and binary policy

- **Location**: `rooms/laboratory/tools/toolchain.manifest.json`, `.rovo/laboratory-media-source-smoke.md`, `.rovo/laboratory-media-profile-stage-smoke.md`
- **Description**: Convert the current ad-hoc portability gap into an explicit matrix for `ffmpeg`, `ffprobe`, `yt-dlp`, and `whisper.cpp`, including platform support, fallback policy, and unsupported copy.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Required tools declare intended platform coverage
  - Optional tools declare platform-limited behavior honestly
  - Smoke docs mention platform gaps explicitly until closed
- **Validation**:
  - Manual manifest review
  - Regression check for stage-aware support metadata

## Sprint 2: Make Process Real

**Goal**: Replace the current simulated `process` stage with a real room-managed analysis pipeline that consumes the selected `profile` output and produces persisted process results.
**Demo/Validation**:

- Starting the process stage launches a real host-managed run
- Progress reflects actual module completion instead of UI timers
- Cancelling a process run leaves a coherent persisted snapshot

### Task 2.1: Introduce a process plan builder in the room host

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Build a host-side process plan from `profile` readiness, selected target asset, lane selection, artifact preferences, and tool/model availability.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Process plan is deterministic from persisted project state
  - The host can explain which modules will run and why
  - Blocked lanes remain blocked rather than silently skipped
- **Validation**:
  - Targeted host regression for plan generation
  - Manual snapshot inspection

### Task 2.2: Implement real process jobs and progress aggregation

- **Location**: `rooms/laboratory/host/index.js`, `electron/room-tool-service.ts`
- **Description**: Run the selected process modules through room-managed tools, emit structured progress, and persist per-module results under the project.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Process runs have real `jobId`-scoped lifecycle
  - Progress is derived from host work, not polling-free UI animation
  - Result snapshots survive reload and stage switching
- **Validation**:
  - Regression test for process job lifecycle
  - Manual run/cancel/reload sanity check

### Task 2.3: Replace process-stage dummy UI with host-backed rendering

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Render actual module rows, blockers, warnings, active step state, and post-run summaries from host snapshots instead of UI-local constants.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Process view reflects real host snapshot fields
  - Process restart/cancel actions map to real room actions
  - Empty and blocked states remain honest
- **Validation**:
  - UI regression test for host-backed markers
  - Manual process-stage smoke

### Task 2.4: Persist process artifacts and manifests

- **Location**: `rooms/laboratory/host/index.js`, `data/room-storage/laboratory/projects/<projectSlug>/derived/process/*`
- **Description**: Save process artifacts, normalized module manifests, and run summaries so the report stage does not need to infer final results from transient UI state.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Process outputs live under a stable project-owned root
  - Each run records timestamps, module statuses, warnings, and artifact references
  - Later runs do not corrupt prior results unexpectedly
- **Validation**:
  - Manual file-tree inspection
  - Regression assertion for manifest persistence

## Sprint 3: Make Report Real

**Goal**: Turn `report` into a true final-output surface that renders persisted process results and can export a report artifact instead of only showing a staged handoff.
**Demo/Validation**:

- The report stage reads persisted process/report state
- Export writes a real file into the project
- The stage stays honest when a full process run has not happened yet

### Task 3.1: Build a report composer in the room host

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Convert persisted process results into a normalized report model with summary cards, findings, caveats, evidence references, and export-ready metadata.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Report content is derived from process data, not hardcoded UI fallbacks
  - Findings preserve measured/derived/heuristic distinctions
  - Missing-process cases render as blocked or staged, not as complete
- **Validation**:
  - Targeted host regression for report composition
  - Manual JSON snapshot review

### Task 3.2: Implement report export generation

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `data/room-storage/laboratory/projects/<projectSlug>/reports/*`
- **Description**: Add a real export path for Markdown or JSON report output, store the file in the project, and surface its status/history in the UI.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `export-report` produces a real artifact
  - Export result is persisted and visible after reload
  - Export failure is surfaced clearly
- **Validation**:
  - Manual export smoke
  - Regression test for exported file creation metadata

### Task 3.3: Replace the report-stage handoff-only UI

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Rework the report stage into a final summary view with evidence-backed findings, caveats, export actions, and prior export history while retaining honest empty states.
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - The UI no longer reads like a profile-only handoff shell
  - Findings are tied to real process outputs
  - Export controls reflect real job state and real output history
- **Validation**:
  - UI regression for report markers
  - Manual report-stage smoke

## Sprint 4: Ship Audio-Analysis V1

**Goal**: Turn `audio-analysis` into a real second feature with implemented local-first modules and explicit planned placeholders.
**Demo/Validation**:

- The room can switch between `media-analysis` and `audio-analysis`
- Audio feature state does not leak into media-analysis state
- Implemented audio modules produce real results, while planned modules remain visibly planned

### Task 4.1: Remove remaining single-feature assumptions

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Finish feature-aware branching so `media-analysis` and `audio-analysis` use separate local state factories, snapshots, request correlation, and stage surfaces.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Feature switching does not leak stages, jobs, or last-request tracking
  - Shared room helpers are separated from feature-local behavior
  - `media-analysis` behavior remains unchanged when active
- **Validation**:
  - Regression test for feature switching and state isolation
  - Manual switch-back-and-forth smoke

### Task 4.2: Implement audio-analysis descriptors and feature shell

- **Location**: `rooms/laboratory/tools/audio-analysis-*.json`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/manifest.json`
- **Description**: Add the real catalog, presets, providers, copy, and scene-level feature shell for audio-analysis.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Descriptor files exist and are consumed by the host/UI
  - The feature shows implemented vs planned modules honestly
  - Scene and top-level feature switching remain valid
- **Validation**:
  - Manifest regression
  - Descriptor regression

### Task 4.3: Implement audio-analysis V1 real modules

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Ship the first real audio modules: signal health, spectral artifacts, optional transcript flow, and capability-gated speaker timeline surface. Planned modules remain placeholders with roadmap copy.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Implemented modules produce real artifacts or findings
  - Planned modules never pretend to be real
  - Capability-gated modules explain blockers clearly
- **Validation**:
  - Manual audio feature smoke with at least one local asset
  - Regression test for implemented/planned rendering split

### Task 4.4: Persist audio-analysis runs and reports

- **Location**: `rooms/laboratory/host/index.js`, `data/room-storage/laboratory/projects/<projectSlug>/derived/audio-analysis/*`
- **Description**: Save per-run audio artifacts, module summaries, and report outputs under the project so the feature matches the portability and persistence guarantees of media-analysis.
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - Audio feature results survive reload
  - Exported or saved audio reports stay project-owned
  - Installed-room parity remains intact
- **Validation**:
  - Manual persistence smoke
  - Regression test for audio-analysis parity

## Sprint 5: Widen Tool Portability And Release Hardening

**Goal**: Reduce the remaining platform-risk gap and harden the room for broader internal rollout.
**Demo/Validation**:

- Tool manifests declare a broader portability story
- Unsupported platforms fail clearly, not mysteriously
- The room has closeout smoke coverage for all implemented surfaces

### Task 5.1: Expand the required tool portability matrix

- **Location**: `rooms/laboratory/tools/toolchain.manifest.json`, `electron/room-tool-service.ts`
- **Description**: Add or explicitly gate missing `ffmpeg` platform assets, improve unsupported-platform diagnostics, and ensure `ffprobe` companion resolution remains stable across all declared targets.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Required-tool bootstrap is defined for every intended platform
  - Unsupported targets produce actionable status copy
  - Tool probe/install/update flows stay room-local
- **Validation**:
  - Tool-service regression updates
  - Manual manifest review

### Task 5.2: Expand optional tool/model portability for whisper.cpp

- **Location**: `rooms/laboratory/tools/toolchain.manifest.json`, `rooms/laboratory/tools/profile-models.json`, `rooms/laboratory/host/index.js`
- **Description**: Broaden or explicitly constrain `whisper.cpp` runtime coverage, refine model compatibility logic per platform, and keep the UI honest on unsupported targets.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Optional speech tooling does not appear universally ready when it is not
  - Model descriptors match the actual binary/provider story
  - Cleanup and compatibility policy remain explicit
- **Validation**:
  - Profile regression updates
  - Manual unsupported-platform review

### Task 5.3: Add dedicated closeout regressions and smoke docs

- **Location**: `scripts/tests/laboratory-media-process-*.test.ts`, `scripts/tests/laboratory-media-report-*.test.ts`, `scripts/tests/laboratory-audio-analysis-*.test.ts`, `.rovo/laboratory-media-closeout-smoke.md`
- **Description**: Add the missing dedicated regression coverage for `process`, `report`, and `audio-analysis`, and create a final smoke checklist for the full room.
- **Dependencies**: Sprints 2, 3, 4
- **Acceptance Criteria**:
  - Every previously medium-severity gap has at least one direct regression or smoke validation
  - Installed-room parity is covered for new feature files
  - Full-room smoke steps are documented
- **Validation**:
  - Test run of the new suites
  - Smoke doc review

### Task 5.4: Refresh room copy and release posture

- **Location**: `rooms/laboratory/manifest.json`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Remove stale `dummy/staged shell` language from manifest and room copy so the product description matches the actual implementation state.
- **Dependencies**: Sprints 2, 3, 4
- **Acceptance Criteria**:
  - Manifest and UI copy match the real room status
  - Remaining planned areas are still described honestly
- **Validation**:
  - Manual copy review
  - Regression test update if copy markers are asserted

## Testing Strategy

- Per sprint:
  - `node --check rooms/laboratory/host/index.js`
  - `node --check rooms/laboratory/ui/index.js`
  - `npm run typecheck`
  - `npm run electron:build`
- Existing suites to keep green throughout:
  - `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-media-edit-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-media-profile-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-media-source-portability-regressions.test.ts`
  - `scripts/tests/room-tool-service-regressions.test.ts`
  - `scripts/tests/room-bundle-import-regressions.test.ts`
- New suites expected by closeout:
  - `scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-media-report-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-audio-analysis-installed-parity-regressions.test.ts`

## Potential Risks & Gotchas

- `process` and `report` can drift into another fake shell if they are implemented UI-first instead of host-first.
  - Mitigation: do not build either stage from transient UI state; persist process outputs first.
- `audio-analysis` can bloat the room if feature-local state is not isolated early.
  - Mitigation: finish feature-aware state factories before adding real modules.
- Tool portability can become misleading if manifest coverage expands faster than actual validation.
  - Mitigation: treat unsupported platforms as explicit states, not silent fallbacks.
- Installed-room parity can regress if new descriptor or asset files are only updated in the workspace tree.
  - Mitigation: keep parity regression and installed-copy sync in every sprint exit checklist.
- Report certainty can overstate what the system knows.
  - Mitigation: preserve `measured / derived / heuristic` distinctions in all final report summaries.

## Rollback Plan

- If Sprint 2 destabilizes the room, keep the persisted schema additions but gate the real process runner behind a host capability flag until the orchestration path is fixed.
- If Sprint 3 export generation is unstable, keep the new report composition model but disable export actions while retaining report rendering.
- If Sprint 4 audio-analysis slips, ship the multi-feature manifest and descriptor shell only after feature-state isolation is proven, or keep the feature hidden behind manifest status until ready.
- If Sprint 5 portability work cannot be validated cross-platform, keep unsupported platforms explicit in the manifest and UI rather than pretending broader support.
