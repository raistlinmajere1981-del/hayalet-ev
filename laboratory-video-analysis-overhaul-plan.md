# Plan: Laboratory Video Analysis Overhaul

**Generated**: 2026-03-23
**Estimated Complexity**: High

## Overview
Rebuild the Laboratory room's video analysis feature into a compact desktop-grade workstation without discarding the current room contract. The implementation should preserve the existing room/host/electron pipeline, then extend it with:

- project-based analysis management
- visible source-preparation and analysis process tracking
- simple and advanced settings for download and analysis
- richer image, audio, and video analysis capabilities
- an overlay-based report reader
- fuller i18n coverage and report generation in the selected language

The current codebase already contains a usable foundation: source preparation jobs, analysis jobs, workspace history, source selection, and four report sections. The main work is to reshape that foundation into a clearer product model and a denser desktop UI.

## Assumptions
- V1 remains offline-first and local-only; no cloud analysis service is introduced.
- Each user-started investigation maps to one primary project with one prepared source; optional rerun revisions are secondary and should not complicate the default UX.
- The report reader overlay lives inside the Laboratory room runtime, not the main shell overlay system, unless later integration proves necessary.
- The selected UI locale becomes the default report language.
- Authenticated/cookie-backed downloads are out of scope for the first pass unless explicitly requested later.

## Research Findings
- The current Laboratory runtime already supports `local-file`, `direct-url`, and `youtube-url` sources via `rooms/laboratory/host/index.js`, `electron/laboratory/source-resolver.ts`, and `electron/laboratory/source-job-runner.ts`.
- The current UI is a single dense surface in `rooms/laboratory/ui/index.js` and `rooms/laboratory/ui/style.css`; it mixes intake, progress, preview, history, and reports in one constrained layout.
- Progress exists today, but it is still mostly "percent + summary + detail" and does not expose a richer process console, queue view, or advanced source/test controls.
- Reports are stored durably per workspace via `electron/laboratory/history-store.ts`, which makes projectization an extension of the current model rather than a greenfield feature.
- UI translations are sparse in `rooms/laboratory/i18n/en.json` and `rooms/laboratory/i18n/tr.json`; most copy currently falls back from inline JavaScript strings.
- Report generation is not locale-aware today because `electron/laboratory/report-builder.ts` emits hardcoded English strings and the analysis request contract does not carry locale/report language data.

## UX Reference Patterns
- HandBrake: preset-first workflow, queue visibility, and activity-log style process feedback.
- DaVinci Resolve: left project/media context, center viewer, right inspector layout.
- Topaz Video AI: progressive settings and project-oriented media workflow.
- Amped Authenticate style evidence-led review: readable findings with supporting artifacts close to the report text.

## Prerequisites
- Current local `ffmpeg`, `ffprobe`, and `yt-dlp` support remains available.
- Room assets can be updated or replaced without changing the room installation workflow.
- If the redesign needs new room art, panel backgrounds, or overlay visuals, the asset scope is identified before Sprint 2 implementation starts.
- Sample media fixtures or synthetic clips are available for analyzer validation.
- The team is comfortable extending the installed-room data model under `data/rooms/laboratory`.

## Sprint 1: Contract And Data Model
**Goal**: Define the target Laboratory identity model, persistence boundary, settings schema, progress model, report compatibility rules, and locale-aware contract without breaking current history/workspace reads.
**Demo/Validation**:
- `npm run typecheck`
- Existing Laboratory regressions still pass after type and contract expansion
- Old history entries remain readable after migration-safe storage changes

### Task 1.1: Define identity and state boundaries
- **Location**: `src/types/laboratory.ts`, `rooms/laboratory/host/index.js`, `electron/laboratory/history-store.ts`
- **Description**: Define how `projectId`, `workspaceId`, and any optional `revisionId` relate, then separate persisted project/run data from volatile room/session UI state before broader implementation begins.
- **Complexity**: 7
- **Dependencies**: None
- **Acceptance Criteria**:
  - The plan for `projectId` vs `workspaceId` is explicit and migration-safe
  - Volatile room state and persisted project state have clear ownership boundaries
  - Resume/delete behavior does not depend on ephemeral UI-only data
- **Validation**:
  - `npm run typecheck`
  - Add a short state/identity mapping note near the relevant contract changes

### Task 1.2: Extend shared Laboratory types
- **Location**: `src/types/laboratory.ts`, `src/types/index.ts`, `src/js/global.d.ts`
- **Description**: Add typed project entities, latest-analysis summaries, optional revision metadata, simple/advanced settings payloads, richer process events, artifact descriptors, and report locale fields.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Shared types distinguish project metadata from a single analysis run
  - Source preparation options and analysis options support simple and advanced modes
  - Report records can carry UI locale and generation locale separately if needed
- **Validation**:
  - `npm run typecheck`
  - Add/update type-driven regression coverage where Laboratory contracts are asserted

### Task 1.3: Introduce a project-aware storage schema and report versioning
- **Location**: `electron/laboratory/history-store.ts`
- **Description**: Evolve workspace history into a project index with project metadata, last-opened state, latest-analysis state, optional revision metadata, explicit report schema/version fields, backward-read behavior, and migration-safe reads of current records.
- **Complexity**: 8
- **Dependencies**: Tasks 1.1, 1.2
- **Acceptance Criteria**:
  - Existing single-workspace history can be upgraded or read as default projects
  - Projects support resume, delete, and media cleanup without corrupting prior records
  - Old report records remain readable after locale/analyzer section expansion
  - Storage writes stay deterministic and idempotent
- **Validation**:
  - Add targeted tests for read/write/migration behavior
  - Manually inspect generated JSON shape in a temporary fixture run

### Task 1.4: Expand IPC and host state contracts
- **Location**: `electron/handlers/ipc-laboratory-video-analysis.ts`, `rooms/laboratory/host/index.js`
- **Description**: Update request validation and room state notifications so the UI can manage projects, advanced options, richer progress logs, latest-analysis state, and overlay report state, and document a small `UI action -> host event -> persisted effect -> UI refresh` matrix.
- **Complexity**: 7
- **Dependencies**: Tasks 1.2, 1.3
- **Acceptance Criteria**:
  - Host payloads expose project list, active project, latest analysis or optional revision state, and pending process state
  - IPC validation rejects malformed advanced settings cleanly
  - Existing simple flows still map to valid defaults
- **Validation**:
  - `npm run typecheck`
  - Update Laboratory host and IPC regressions

### Task 1.5: Create fixture packs and performance guardrails
- **Location**: `electron/laboratory/`, `scripts/tests/`, supporting fixture locations as needed
- **Description**: Define lightweight sample clips/fixtures early and establish per-mode runtime, artifact-retention, and cancellation/retry guardrails before analyzer expansion starts.
- **Complexity**: 6
- **Dependencies**: Tasks 1.2, 1.3
- **Acceptance Criteria**:
  - Fast/balanced/deep modes have explicit budget expectations
  - Cancellation guarantees are defined for source preparation and analysis jobs
  - Fixture clips exist early enough to validate migration, telemetry, and report rendering work
- **Validation**:
  - Run at least one fixture-backed smoke path before Sprint 2 closes

### Task 1.6: Lock the migration surface with regressions
- **Location**: `scripts/tests/laboratory-room-regressions.test.ts`, new targeted Laboratory storage/report tests as needed
- **Description**: Add regression coverage for the expanded contract before large UI work begins.
- **Complexity**: 5
- **Dependencies**: Tasks 1.3, 1.4, 1.5
- **Acceptance Criteria**:
  - Regressions assert project-aware fields and locale-aware report payload availability
  - Legacy workspace inputs remain accepted
- **Validation**:
  - Run the targeted Laboratory test suite

## Sprint 2: Desktop Workstation UI Shell
**Goal**: Replace the current crowded one-surface layout with a compact desktop-oriented workstation that uses space efficiently and keeps long copy out of the main workflow.
**Demo/Validation**:
- Laboratory opens into a new three-zone layout
- Main actions are usable without scrolling on common desktop sizes
- Mobile/narrow widths still degrade cleanly rather than collapsing

### Task 2.1: Produce a shell state-map and low-fidelity wireframe pass
- **Location**: `laboratory-video-analysis-overhaul-plan.md` follow-up notes or implementation notes produced alongside Sprint 2 kickoff
- **Description**: Create a compact state-map and wireframe pass for the desktop shell, project rail, process console, inspector, and report overlay before committing to the final markup/CSS implementation.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The shell layout and core states are agreed before markup churn starts
  - Asset needs are visible early enough to avoid blocking implementation
  - Default, busy, empty, failed, and report-open states are all represented
- **Validation**:
  - Review the wireframe/state-map against the Sprint 2 task list before implementation starts

### Task 2.2: Define the new Laboratory information architecture
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Reorganize the UI into project rail, central stage/process area, and inspector/settings area; demote large hero copy and keep labels compact.
- **Complexity**: 7
- **Dependencies**: Tasks 1.4, 2.1
- **Acceptance Criteria**:
  - The default view feels like a desktop tool, not a landing page
  - Intake, process visibility, and preview stay visible together
  - Reports are no longer squeezed into the main work surface
- **Validation**:
  - Manual visual review in Laboratory room
  - Existing room render regressions updated if markup contracts change

### Task 2.3: Add progressive settings surfaces
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Introduce a simple/advanced toggle or segmented control that reveals advanced source and analysis options without overwhelming the default view.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Simple mode keeps only the essential controls
  - Advanced mode exposes detailed source and analyzer controls
  - Switching modes preserves valid state and defaults
- **Validation**:
  - Manual UI verification for state persistence and control disabling rules

### Task 2.4: Build a dedicated process console panel
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Replace the current lightweight progress card with a richer process panel that can show queue state, current stage, substep messages, warnings, and completion summaries.
- **Complexity**: 6
- **Dependencies**: Tasks 1.4, 2.2
- **Acceptance Criteria**:
  - Source preparation and analysis both surface meaningful process history
  - The user can understand whether the app is downloading, probing, sampling, or writing reports
  - Idle, active, failed, and cancelled states are visually distinct
- **Validation**:
  - Manual run through local file, direct URL, and YouTube flows

### Task 2.5: Polish responsive and density behavior
- **Location**: `rooms/laboratory/ui/style.css`
- **Description**: Tune sizing, overflow behavior, minimum widths, and desktop-first spacing so the UI remains dense but readable across desktop and narrower layouts.
- **Complexity**: 5
- **Dependencies**: Tasks 2.2, 2.3, 2.4
- **Acceptance Criteria**:
  - Common desktop sizes do not require excessive vertical scrolling
  - Narrow layouts still keep controls accessible
  - Preview, project list, and inspector never overlap or trap content
- **Validation**:
  - Manual resize pass
  - Capture before/after screenshots if helpful for review

## Sprint 3: Project Lifecycle And Source Preparation
**Goal**: Turn each analysis into a manageable project with resume/delete flows and better visibility into source acquisition and preparation.
**Demo/Validation**:
- Users can create, reopen, and delete projects
- Project state survives reload and room reopen
- Source preparation exposes richer progress than the current percent-only experience

### Task 3.1: Add project creation, resume, and delete flows
- **Location**: `rooms/laboratory/host/index.js`, `electron/laboratory/history-store.ts`, `rooms/laboratory/ui/index.js`
- **Description**: Implement CRUD-style project management around the existing workspace model, including active-project selection and safe deletion behavior.
- **Complexity**: 7
- **Dependencies**: Sprint 1, Sprint 2 shell
- **Acceptance Criteria**:
  - Users can create a fresh project from any supported source flow
  - Users can reopen prior projects and continue from the latest run
  - Delete removes project records safely and predictably
- **Validation**:
  - Manual create/resume/delete walkthrough
  - Add targeted storage regression coverage

### Task 3.2: Enrich source preparation telemetry
- **Location**: `electron/laboratory/source-job-runner.ts`, `electron/laboratory/source-resolver.ts`, `rooms/laboratory/host/index.js`
- **Description**: Emit richer source-preparation substeps such as URL validation, dependency preflight, download progress, probe, preview generation, and failure hints.
- **Complexity**: 7
- **Dependencies**: Tasks 1.1, 1.3
- **Acceptance Criteria**:
  - YouTube and direct URL flows expose more than a single summary line
  - Dependency failures are actionable
  - Cancellation and retry states are explicit
- **Validation**:
  - Manual test against local file, direct URL, and a supported YouTube URL
  - Update related source-preparation regressions if added

### Task 3.3: Add simple and advanced source settings
- **Location**: `src/types/laboratory.ts`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`, `electron/laboratory/source-resolver.ts`
- **Description**: Add user-facing controls for source preparation such as quality preset, preview generation behavior, download limits, and retry/format preferences with sensible defaults.
- **Complexity**: 8
- **Dependencies**: Tasks 1.1, 3.2
- **Acceptance Criteria**:
  - Simple mode offers a minimal preset-based flow
  - Advanced mode exposes bounded, validated download/preparation controls
  - Unsafe or unsupported settings are blocked with clear errors
- **Validation**:
  - `npm run typecheck`
  - Manual validation of state mapping from UI to resolver

### Task 3.4: Surface project timeline and latest-analysis history
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `electron/laboratory/history-store.ts`
- **Description**: Replace the current flat workspace history card with a project-oriented list that shows project identity, last run status, duration, risk snapshot, and quick actions.
- **Complexity**: 6
- **Dependencies**: Tasks 3.1, 2.1
- **Acceptance Criteria**:
  - Users can distinguish projects from individual runs
  - The current project and latest run are obvious at a glance
  - Cleanup/delete actions are separated to avoid accidental loss
- **Validation**:
  - Manual multi-project smoke pass

## Sprint 4: Analysis Capability Expansion
**Goal**: Grow the Laboratory pipeline from a fixed basic heuristic set into a richer multimodal analyzer system with clearer controls and reusable artifacts.
**Demo/Validation**:
- New analysis controls are visible in advanced mode
- New artifacts and report sections appear after a run
- Local analysis still completes without remote services

### Task 4.1: Refactor the analysis worker into clearer analyzer stages
- **Location**: `electron/laboratory/analysis-worker.cjs`, new helper files under `electron/laboratory/` if needed
- **Description**: Separate the monolithic worker into maintainable analyzer stages or modules so new capability work does not keep compounding inside one file.
- **Complexity**: 8
- **Dependencies**: Sprint 1 contracts
- **Acceptance Criteria**:
  - Analyzer stage boundaries are explicit
  - Existing metadata, motion, visual, and audio outputs remain functionally intact
  - New analyzers can be added without destabilizing the worker entrypoint
- **Validation**:
  - Run targeted analysis smoke checks on known clips
  - Preserve existing worker path contract in regressions

### Task 4.2: Add richer image and video forensic signals
- **Location**: `electron/laboratory/analysis-worker.cjs`, `electron/laboratory/report-builder.ts`
- **Description**: Add deeper visual/video analysis such as scene-cut irregularity, cadence anomalies, duplicate-frame detection, ROI still sampling, and stronger evidence capture.
- **Complexity**: 9
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - At least one new image-focused signal and one new video-timeline signal are available
  - New findings produce timestamped or artifact-backed evidence where possible
  - Report summaries stay readable despite added depth
- **Validation**:
  - Targeted analyzer fixture tests
  - Manual review of generated evidence artifacts

### Task 4.3: Expand audio analysis beyond continuity checks
- **Location**: `electron/laboratory/analysis-worker.cjs`, `electron/laboratory/report-builder.ts`
- **Description**: Introduce richer audio analysis such as spectrogram-oriented artifacts, silence/jump detection improvements, and settings that control sample density.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Audio analysis can produce more than loudness jump findings
  - No-audio and unsupported cases remain clearly represented
  - Advanced settings can tune audio analysis depth safely
- **Validation**:
  - Run audio-present and no-audio fixture checks

### Task 4.4: Add advanced analysis settings and artifact persistence
- **Location**: `src/types/laboratory.ts`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`, `electron/laboratory/job-runner.ts`, `electron/laboratory/history-store.ts`
- **Description**: Let advanced users control sampling density, ROI behavior, artifact generation, and analyzer toggles while storing reusable outputs per run.
- **Complexity**: 8
- **Dependencies**: Tasks 4.2, 4.3
- **Acceptance Criteria**:
  - Advanced settings map cleanly to worker behavior
  - Generated artifacts are stored predictably per run
  - Simple mode still launches with one-click defaults
- **Validation**:
  - `npm run typecheck`
  - Manual run comparison between simple and advanced settings

## Sprint 5: Overlay Report Reader And Localization
**Goal**: Move report reading into a dedicated overlay reader and ensure UI/report output honor the selected language.
**Demo/Validation**:
- Reports open in a dedicated reader overlay
- Switching locale changes visible Laboratory UI strings
- Generated user-facing report text follows the selected language

### Task 5.1: Implement an in-room report reader overlay
- **Location**: `rooms/laboratory/ui/index.html`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Create an overlay reader with report navigation, evidence sections, copy/export actions, and room-friendly keyboard/close behavior.
- **Complexity**: 7
- **Dependencies**: Sprint 2 shell, Sprint 4 report richness
- **Acceptance Criteria**:
  - Reports open without consuming the main workstation layout
  - The reader supports both user and technical views cleanly
  - Closing the reader returns the user to the same project context
- **Validation**:
  - Manual open/close/navigation pass
  - Add overlay-focused Laboratory regressions if markup contracts warrant it

### Task 5.2: Replace fallback-heavy UI copy with complete room i18n
- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/ui/index.js`
- **Description**: Move the majority of Laboratory-visible UI strings into room translation files and reduce dependence on large inline fallback dictionaries.
- **Complexity**: 6
- **Dependencies**: Sprint 2 layout finalization
- **Acceptance Criteria**:
  - The main Laboratory workflow is covered in both English and Turkish
  - New project/process/report UI strings are translation-driven
  - Fallback strings remain minimal and deliberate
- **Validation**:
  - Manual locale switch test
  - Regression updates for expected translated strings if applicable

### Task 5.3: Make report generation locale-aware
- **Location**: `src/types/laboratory.ts`, `rooms/laboratory/host/index.js`, `electron/laboratory/job-runner.ts`, `electron/laboratory/report-builder.ts`
- **Description**: Thread locale/report-language information into the report pipeline so generated headlines, section titles, summaries, and caveats honor the selected language.
- **Complexity**: 7
- **Dependencies**: Task 5.2, Sprint 1 contract expansion
- **Acceptance Criteria**:
  - User report language matches the selected locale
  - Technical report titles and boilerplate are localized
  - Existing saved reports retain their original generation language
- **Validation**:
  - Add report-builder tests for `en` and `tr`
  - Manual generation pass in both locales

### Task 5.4: Add export and reading ergonomics
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `electron/preload.cjs` if new export bridge calls are needed
- **Description**: Improve report reader usability with export/copy options, section jump links, evidence drill-down, and compact desktop reading controls.
- **Complexity**: 5
- **Dependencies**: Tasks 5.1, 5.3
- **Acceptance Criteria**:
  - The reader supports copy/export actions without crowding the main UI
  - Evidence and findings are easier to scan than in the current inline report block
- **Validation**:
  - Manual usability pass with multiple runs and both locales

## Sprint 6: Hardening, Regression Coverage, And Install Flow
**Goal**: Stabilize the new Laboratory feature set, verify migrations, and ensure the room package still installs and renders correctly.
**Demo/Validation**:
- Targeted Laboratory regressions pass
- Room package/install regressions pass
- Typecheck succeeds

### Task 6.1: Refresh Laboratory regression coverage
- **Location**: `scripts/tests/laboratory-room-regressions.test.ts`, `scripts/tests/room-overlay-regressions.test.ts`, other targeted tests created during earlier sprints
- **Description**: Update room, manifest, host, IPC, and overlay regressions for the new project/report/localization contracts.
- **Complexity**: 6
- **Dependencies**: Sprints 1-5
- **Acceptance Criteria**:
  - New flows are protected by targeted tests
  - Existing room/package assumptions stay valid unless intentionally changed
- **Validation**:
  - Run the targeted Laboratory and room regression suites

### Task 6.2: Verify packaging and installed-room behavior
- **Location**: `scripts/tests/room-bundle-import-regressions.test.ts`, `config/rooms.json` generated/install outputs as applicable
- **Description**: Confirm the Laboratory room still installs, updates, and resolves runtime paths correctly after the UI and asset changes.
- **Complexity**: 5
- **Dependencies**: Sprint 5 complete
- **Acceptance Criteria**:
  - Room bundle/import behavior still works
  - Installed-room artifacts reflect the updated UI package
- **Validation**:
  - Run the relevant room bundle/install regressions

### Task 6.3: Execute a focused smoke matrix
- **Location**: Manual verification checklist tracked alongside implementation
- **Description**: Run a smoke matrix covering locale switch, project resume/delete, local file analysis, YouTube preparation, direct URL preparation, cancellation, overlay reading, and no-audio clips.
- **Complexity**: 4
- **Dependencies**: Tasks 6.1, 6.2
- **Acceptance Criteria**:
  - The highest-risk user paths are exercised once end-to-end
  - Retry, restart, and cancel paths are exercised for both source preparation and analysis jobs
  - Known limitations are documented before merge
- **Validation**:
  - Manual smoke checklist completion

## Testing Strategy
- Run `npm run typecheck` after each sprint that changes contracts or shared types.
- Keep `scripts/tests/laboratory-room-regressions.test.ts` current as the minimum Laboratory safety net.
- Add focused tests for:
  - project storage migration
  - locale-aware report generation
  - new source-preparation request validation
  - analyzer output and artifact persistence
  - overlay report-reader behavior where feasible
  - source-preparation retry/cancel/restart flows
  - analysis retry/cancel/restart flows
- Maintain a small manual smoke pack for:
  - local file flow
  - YouTube flow
  - direct URL flow
  - project resume/delete
  - source-preparation retry/cancel/restart
  - analysis retry/cancel/restart
  - locale switch
  - report reader overlay
  - clips with and without audio

## Potential Risks And Gotchas
- The current worker is monolithic; adding capabilities without refactoring first will make the pipeline fragile.
- Projectizing the history model can break legacy reads if migration rules are not explicit and well tested.
- Richer telemetry can flood the UI unless process messages are batched or grouped intentionally.
- Derived artifacts can increase storage size quickly; retention and cleanup rules must stay obvious.
- New analyzer depth should prefer existing local tooling first; avoid adding heavy native dependencies unless the benefit is clear and the packaging cost is accepted.
- Locale-aware report generation must preserve old saved reports instead of silently rewriting their language.
- Reusing the main app overlay system inside the room may create unnecessary coupling; an in-room overlay is lower risk for v1.
- Advanced download options can create unsafe or confusing states; settings should stay bounded and validated.
- YouTube support remains partially dependent on external tool freshness; dependency preflight and user guidance are mandatory.

## Rollback Plan
- Keep storage migration additive first; do not delete legacy fields until the new project model is proven stable.
- Land the overhaul in vertical slices so each sprint can be reverted independently if needed.
- Preserve the current one-click simple analysis path until the advanced workflow is stable.
- Avoid deleting existing report files during migration; generate new records beside legacy ones when necessary.
- If the overlay reader proves unstable, fall back temporarily to the inline report view while keeping the new project and settings model intact.
