# Plan: Laboratory Subtitle Analysis Feature

**Generated**: 2026-03-25
**Estimated Complexity**: High

## Overview

Add a third feature, `subtitle-analysis`, to the existing `laboratory` room so subtitle-heavy workflows can live beside `media-analysis` and `audio-analysis` without turning the room into a one-off branch.

The feature should support two product layers:

- `v1` ships a real subtitle workbench focused on:
  - local single-subtitle intake
  - local folder intake
  - YouTube subtitle discovery and download
  - metadata-first bulk selection
  - cleanup and formatting
  - structural QC and dataset summaries
- `v2` expands the same contract toward deeper analysis:
  - entity and glossary extraction
  - semantic search and clustering
  - topic modeling
  - tone and sentiment
  - audio-aligned subtitle timing audit

The implementation should stay consistent with the current laboratory architecture:

- room-local UI, host logic, descriptors, and copy stay under `rooms/laboratory/**`
- project data stays under `data/room-storage/laboratory/projects/**`
- generic Electron work remains room-agnostic
- source, edit, process, and report must be honest about implemented vs planned behavior

## Research Notes

- Generic room-page infrastructure already supports more than one feature per room.
- `laboratory` already proves the multi-feature pattern with `media-analysis` and `audio-analysis`.
- `rooms/laboratory/host/index.js` and `rooms/laboratory/ui/index.js` already contain feature-aware branching and shared request-correlation helpers that can be extended instead of replaced.
- The current room source stage already uses:
  - `electronApi.showOpenDialog(...)`
  - `electronApi.readDirectoryFiles(...)`
  - generic `roomToolsCall(...)`
  - yt-dlp / ffmpeg orchestration
- The current source contract is still mostly single-asset oriented, while subtitle analysis needs collection-aware state for:
  - folder imports
  - playlist/channel discovery
  - many selected subtitle files inside one project
- Official yt-dlp documentation confirms the most relevant source-side capabilities for this feature:
  - channel URLs can cover all uploads, including shorts and live
  - subtitle listing/downloading supports `--list-subs`, `--write-subs`, `--write-auto-subs`, and regex-capable `--sub-langs`
  - metadata-only discovery is supported through JSON dump modes
- Official subtitle/timed-text references support a first QC layer around:
  - cue ordering
  - cue timing validity
  - overlap/gap checks
  - line-length and readability heuristics

## Assumptions

- Feature id will be `subtitle-analysis`.
- `laboratory` remains the room id; no new room is created.
- `media-analysis` stays the default feature for now.
- `v1` remains local-first and does not require paid APIs.
- `v1` supports these raw subtitle formats for import:
  - `srt`
  - `vtt`
  - `ass` / `ssa`
- `v1` writes normalized outputs primarily as:
  - `srt`
  - `vtt`
  - optional normalized JSON for internal analysis
- YouTube bulk source flow is metadata-first:
  - discover items
  - filter/select inside the room UI
  - download subtitles only for the selected slice
- Weekday filtering is applied in app logic from persisted publish timestamps, not delegated to yt-dlp directly.
- `v1` analysis avoids heavyweight NLP installs unless a provider is explicitly marked optional or planned.
- If final scene art is not ready, the feature may initially reuse the current lab close-up art with a distinct view id and feature label until dedicated art lands.

## Scope Lock

- In scope for `v1`:
  - third laboratory feature with its own hotspot and close-up view
  - feature-aware source/edit/process/report branching
  - single subtitle, folder, direct URL, and YouTube subtitle source flows
  - YouTube single, playlist, and channel discovery
  - filter UI for language, publish date, weekday, duration, shorts, and selection scope
  - subtitle-only download flow without pulling full media unless explicitly needed later
  - cleanup and formatting recipes
  - structural QC, readability, and batch summary reporting
  - explicit roadmap placeholders for deeper NLP and alignment analyzers
- Out of scope for `v1`:
  - guaranteed login-gated YouTube extraction flows
  - full video/audio download as the main path
  - cloud-only NLP services as required dependencies
  - courtroom-grade linguistic conclusions
  - automatic speaker diarization from subtitle files alone
- Allowed outside-scope changes:
  - small generic seam changes for room-managed discovery jobs, large result paging, or room-tool progress

## Success Criteria

- `subtitle-analysis` appears as a working third feature in `laboratory`.
- The source stage can ingest:
  - one local subtitle file
  - a local folder of subtitle files
  - a YouTube URL for single or bulk subtitle acquisition
- The source UI supports advanced selection before download, not just blind yt-dlp execution.
- The edit stage can non-destructively normalize and export subtitle content.
- The process/report stages produce real subtitle-focused QC and summary output, not fake metrics.
- Existing `media-analysis` and `audio-analysis` behavior remains stable.

## Current Baseline

- `laboratory` manifest already supports multi-feature rooms.
- Room tests already cover:
  - `room-page`
  - `scene-debug`
  - `laboratory-media-analysis`
  - `laboratory-audio-analysis`
- yt-dlp is already part of the room-managed source stack.
- Current YouTube support is download-first and video-oriented, not discovery-first and subtitle-oriented.
- Current project schema includes feature-specific `process.records` and `report.records`, which is the right seam for a third feature.
- Current top-level `source` and `edit` shapes will need collection-aware growth to support batch subtitle work cleanly.

## Proposed Product Model

- One subtitle-analysis project may hold:
  - one discovery request
  - zero or more discovered candidate entries
  - zero or more selected source entries
  - zero or more downloaded subtitle assets
  - one active cleanup recipe
  - zero or more normalized edit outputs
  - one latest process/report snapshot
- The user flow should be:
  1. create or reopen a project
  2. choose source mode
  3. discover or import candidate subtitle entries
  4. filter and select the working set
  5. download/import into the project
  6. clean and normalize
  7. run subtitle analysis
  8. export normalized files and reports

## Proposed Room-Local Contract

Lock these contracts early:

- `manifest` contract
  - `laboratory` becomes a stable three-feature room
- `source contract`
  - subtitle feature keeps collection-aware discovery, selection, and acquisition state
- `edit contract`
  - cleanup and formatting stay non-destructive
- `analysis catalog`
  - subtitle analyzers are descriptor-driven and can be `implemented`, `optional`, `planned`, or `unsupported`
- `provider contract`
  - advanced analyzers can remain optional without lying in the UI
- `report contract`
  - report renders from persisted process data and selected dataset slices

## Proposed Runtime Layout

- Existing room-local runtime roots stay primary:
  - `rooms/laboratory/ui/*`
  - `rooms/laboratory/host/*`
  - `rooms/laboratory/tools/*`
  - `rooms/laboratory/i18n/*`
- New descriptor files:
  - `rooms/laboratory/tools/subtitle-source-presets.json`
  - `rooms/laboratory/tools/subtitle-youtube.form.json`
  - `rooms/laboratory/tools/subtitle-edit-presets.json`
  - `rooms/laboratory/tools/subtitle-analysis-catalog.json`
  - `rooms/laboratory/tools/subtitle-analysis-capabilities.json`
  - `rooms/laboratory/tools/subtitle-analysis-providers.json`
- New room asset:
  - `rooms/laboratory/assets/subtitle-analysis-view.webp`
- Persistent project/runtime data:
  - `data/room-storage/laboratory/projects/<projectSlug>/project.json`
  - `data/room-storage/laboratory/projects/<projectSlug>/source/subtitles/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/source/discovery/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/subtitles/edit/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/subtitles/process/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/reports/subtitle-analysis/*`

## Proposed Data Contract

Extend the room project schema in two directions:

- top-level shared stages remain:
  - `source`
  - `edit`
  - `process`
  - `report`
- add a feature-local `subtitleAnalysis` branch for collection-aware state:
  - `workspace`
    - active source mode
    - discovery status
    - filter state
    - selection summary
  - `discovery`
    - source request metadata
    - discovered entry list
    - pagination / cursor / lastFetchedAt
  - `entries`
    - normalized imported/downloaded subtitle records
  - `cleanup`
    - parsing issues
    - recipe stats
    - last apply snapshot
  - `analysis`
    - module readiness
    - dataset aggregates
    - per-entry results
  - `export`
    - normalized subtitle exports
    - report exports

Also extend:

- `process.records`
  - add `subtitle-analysis`
- `report.records`
  - add `subtitle-analysis`

## Initial Analyzer Roadmap

- `v1` real analyzers:
  - `format-qc`
  - `readability-density`
  - `cue-timing-structure`
  - `lexical-frequency`
  - `batch-summary`
- `v1` optional / provider-gated analyzers:
  - `entities-keyphrases`
  - `semantic-search`
- `v2` planned analyzers:
  - `topic-modeling`
  - `tone-sentiment`
  - `audio-alignment`
  - `speaker-attribution-audit`

## Prerequisites

- Current laboratory regressions stay green before starting.
- `npm run typecheck` remains a gate after each sprint.
- Current yt-dlp source install/update flow remains healthy.
- The team accepts that `v1` bulk YouTube work is metadata-first, not instant full acquisition.
- The room can continue to persist project metadata under `data/room-storage/laboratory`.

## Sprint 1: Lock The Subtitle Feature Contract

**Goal**: Freeze manifest, schema, descriptor, and regression seams before deeper source/edit work begins.
**Demo/Validation**:

- `laboratory` validates with three features
- descriptor files exist and parse
- base regressions prove the new feature is visible without breaking the current room

### Task 1.1: Add the subtitle-analysis feature shell to the room manifest
- **Location**: `rooms/laboratory/manifest.json`, `rooms/laboratory/assets/subtitle-analysis-view.webp`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add `subtitle-analysis` with its own hotspot, view id, icon, and feature copy while keeping `media-analysis` as the default feature.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - manifest validation stays green
  - `subtitle-analysis` appears in the room feature strip
  - scene/debug layers can resolve the feature view and hotspot
- **Validation**:
  - `scripts/tests/room-page-regressions.test.ts`
  - `scripts/tests/scene-debug-room-regressions.test.ts`

### Task 1.2: Extend the project schema for subtitle-analysis collection state
- **Location**: `rooms/laboratory/tools/project-schema.json`, `rooms/laboratory/host/index.js`
- **Description**: Add a backward-compatible `subtitleAnalysis` branch and add `subtitle-analysis` records under `process` and `report`.
- **Complexity**: 8
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - existing projects upgrade without corrupting current media/audio state
  - subtitle projects can store many discovery entries and many acquired subtitle files
  - process/report feature records can persist a third feature
- **Validation**:
  - targeted schema regression
  - manual migration review against existing project snapshots

### Task 1.3: Add subtitle-specific descriptor files
- **Location**: `rooms/laboratory/tools/subtitle-source-presets.json`, `rooms/laboratory/tools/subtitle-youtube.form.json`, `rooms/laboratory/tools/subtitle-edit-presets.json`, `rooms/laboratory/tools/subtitle-analysis-catalog.json`, `rooms/laboratory/tools/subtitle-analysis-capabilities.json`, `rooms/laboratory/tools/subtitle-analysis-providers.json`
- **Description**: Create room-local descriptors for source modes, YouTube discovery fields, cleanup presets, implemented analyzers, and planned providers.
- **Complexity**: 7
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - source modes, filters, cleanup operations, and analyzer statuses are data-driven
  - planned analyzers are explicit, not implied in UI conditionals
  - visible copy routes through room-local i18n
- **Validation**:
  - descriptor parse smoke
  - regression test for required file presence

### Task 1.4: Refactor laboratory UI/host to a third feature without state leakage
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Extend current feature-aware helpers so `subtitle-analysis` gets isolated local state, request correlation, and stage branching instead of piggybacking on media/audio state bags.
- **Complexity**: 9
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - switching among all three features does not leak stage state
  - feature-specific descriptor loading is explicit
  - request/result correlation remains stable with `featureId`
- **Validation**:
  - targeted regression for active feature switching
  - manual switch-back-and-forth smoke

### Task 1.5: Add first-class subtitle-analysis regressions
- **Location**: `scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts`, `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`, `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
- **Description**: Add a dedicated subtitle-analysis regression file and update existing laboratory tests to assert three-feature behavior instead of two-feature assumptions.
- **Complexity**: 7
- **Dependencies**: Task 1.1, Task 1.4
- **Acceptance Criteria**:
  - tests cover manifest, feature strip, view ids, descriptor presence, and host/UI seams
  - existing media/audio tests stay green with no behavioral downgrade
- **Validation**:
  - targeted node test run
  - `npm run typecheck`

## Sprint 2: Build The Metadata-First Source Workspace

**Goal**: Replace a download-first source flow with a subtitle discovery workspace that can preview candidates before acquisition.
**Demo/Validation**:

- source stage renders subtitle-specific modes and filters
- a project can hold discovered candidates before download
- selection state survives reloads

### Task 2.1: Define subtitle source modes and UI copy
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/tools/subtitle-source-presets.json`
- **Description**: Build source modes for:
  - local single subtitle
  - local folder
  - direct URL subtitle
  - YouTube single
  - YouTube playlist
  - YouTube channel
  - YouTube tab-specific URL when the operator wants only `videos`, `shorts`, or another visible slice instead of the whole channel
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - each mode exposes only relevant controls
  - the UI clearly separates discovery from acquisition
  - source copy stays room-local and subtitle-specific
- **Validation**:
  - manual mode-switch smoke
  - UI regression for expected source markers

### Task 2.2: Add collection-aware source workspace state
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Persist discovery results, active filters, selection toggles, and selected dataset slices inside the project.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - the project can hold many candidates without immediately downloading them
  - filter state survives reload
  - selection counts and bulk actions render from persisted state
- **Validation**:
  - targeted host regression
  - manual reload sanity check

### Task 2.3: Build the advanced filter panel and result table
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/tools/subtitle-youtube.form.json`
- **Description**: Add filter and selection UI for:
  - subtitle language
  - published from / to
  - weekday
  - min / max duration
  - shorts only / exclude shorts
  - live include / exclude
  - title include / exclude
  - bulk select / clear
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - results can be filtered client-side without rerunning every action
  - filter chips and table rows remain usable on narrow widths
  - UI shows selected count and total count clearly
- **Validation**:
  - manual table filter smoke
  - UI regression markers

### Task 2.4: Add source-stage request envelopes for discovery and selection
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Define correlated actions such as:
  - `subtitle-discover`
  - `subtitle-discovery-cancel`
  - `subtitle-filter-update`
  - `subtitle-selection-update`
  - `subtitle-acquire-selected`
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - discovery jobs and acquisition jobs do not overwrite each other
  - stale responses are isolated by request/job ids
  - project switching during a job remains coherent
- **Validation**:
  - envelope review
  - regression for stale-response handling

## Sprint 3: Implement Real Subtitle Acquisition

**Goal**: Make local imports and YouTube subtitle downloads produce stable, project-owned subtitle assets and metadata.
**Demo/Validation**:

- local single and folder ingest work
- YouTube discovery returns candidates without downloading media
- selected subtitle files download into the project

### Task 3.1: Implement local single-subtitle import
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/subtitle-source-presets.json`
- **Description**: Reuse the existing open-file pattern to import one subtitle file, normalize its metadata, and add it to the project entry list.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `srt`, `vtt`, and `ass/ssa` imports are recognized
  - imported file is copied into the project
  - source entry metadata is persisted
- **Validation**:
  - manual single-file import
  - targeted host regression

### Task 3.2: Implement local folder scan and bulk import
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Use `showOpenDialog({ properties: ["openDirectory"] })` plus directory scanning to discover eligible subtitle files, preview the count, and import the chosen set.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - folder mode can scan at least one directory level cleanly
  - unsupported file types are skipped with visible warnings
  - bulk import records partial failures honestly
- **Validation**:
  - manual folder import smoke
  - regression for extension filtering and warning counts

### Task 3.3: Implement direct URL subtitle acquisition
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/subtitle-source-presets.json`
- **Description**: Fetch a subtitle file from a direct URL, infer or validate the format, and add the result into the project-owned subtitle entry list.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - direct URL mode can store one remote subtitle file without forcing yt-dlp
  - filename and extension inference remains stable when headers are incomplete
  - unsupported or mismatched responses fail with a readable error
- **Validation**:
  - manual direct URL smoke
  - regression for filename and mime normalization

### Task 3.4: Add yt-dlp metadata-only discovery for single, playlist, and channel sources
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/subtitle-youtube.form.json`, `rooms/laboratory/tools/toolchain.manifest.json`
- **Description**: Run yt-dlp in simulate/JSON mode so the room can discover items, publish dates, durations, URLs, and subtitle availability before acquisition.
- **Complexity**: 9
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - single-video discovery returns one normalized candidate
  - playlist/channel discovery returns normalized candidate entries
  - channel discovery keeps shorts/live items visible for filtering
- **Validation**:
  - manual discovery smoke with one video, one playlist, one channel
  - regression for normalized discovery envelopes

### Task 3.5: Add subtitle-availability enrichment and language listing
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/subtitle-youtube.form.json`
- **Description**: Enrich discovered candidates with available subtitle languages and auto-subtitle availability using staged yt-dlp queries so the user can filter by actual subtitle coverage.
- **Complexity**: 8
- **Dependencies**: Task 3.4
- **Acceptance Criteria**:
  - language filters can use real availability data where fetched
  - large channel discovery does not force availability lookups for every row at once
  - the UI distinguishes unknown vs confirmed-unavailable subtitle state
- **Validation**:
  - manual availability smoke
  - regression for normalized subtitle language fields

### Task 3.6: Download selected subtitles without pulling full video by default
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Add a selected-row acquisition flow that uses yt-dlp subtitle options and stores raw subtitle files plus infojson under the project.
- **Complexity**: 9
- **Dependencies**: Task 3.5
- **Acceptance Criteria**:
  - acquisition can request normal subtitles, auto subtitles, or both
  - selected entries download into stable project-owned paths
  - download failures remain row-scoped where possible
- **Validation**:
  - manual selected-download smoke
  - regression for yt-dlp argument building and stored result normalization

## Sprint 4: Build The Subtitle Cleanup And Formatting Stage

**Goal**: Turn the edit stage into a non-destructive subtitle cleanup workspace instead of a media transform panel.
**Demo/Validation**:

- imported subtitle files can be previewed, cleaned, and exported
- cleanup presets are reversible and tracked per project
- original raw files stay untouched

### Task 4.1: Define a normalized subtitle document model
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Create an internal cue model that can ingest `srt`, `vtt`, and `ass/ssa` into one normalized structure for preview, cleanup, and export.
- **Complexity**: 8
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - parsed cue records preserve timing and text payload
  - format-specific metadata can be preserved where needed
  - parse errors are persisted as non-fatal warnings when possible
- **Validation**:
  - targeted parser regression set
  - manual import/export sanity check

### Task 4.2: Add subtitle cleanup presets and advanced toggles
- **Location**: `rooms/laboratory/tools/subtitle-edit-presets.json`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Define beginner and advanced cleanup controls for:
  - whitespace normalization
  - punctuation cleanup
  - HTML/tag stripping
  - hearing-impaired tag cleanup
  - speaker label normalization
  - repeated cue dedupe
  - long line splitting
  - short cue merge / hold adjustments
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - beginner mode exposes safe defaults
  - advanced mode can fine-tune timing/text cleanup
  - recipe copy explains why a transform exists, not just what it does
- **Validation**:
  - descriptor review
  - UI regression for preset rendering

### Task 4.3: Implement preview and apply flows for subtitle cleanup
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Reuse the room’s preview/apply model so users can inspect changed cue counts, warnings, and sample diffs before producing normalized outputs.
- **Complexity**: 8
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - preview shows derived stats without replacing the original entry
  - apply writes a stable normalized output under the project
  - cleanup changes remain correlated to the active recipe
- **Validation**:
  - manual preview/apply smoke
  - regression for output manifest persistence

### Task 4.4: Export normalized outputs as SRT and VTT
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Write normalized exports in at least `srt` and `vtt`, and optionally retain an internal JSON export for analysis modules.
- **Complexity**: 6
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - export format choice is explicit
  - line endings and encoding are stable
  - the project records which cleaned output is the current process target
- **Validation**:
  - manual export smoke
  - parser roundtrip regression where practical

## Sprint 5: Implement Real Subtitle QC And Reporting

**Goal**: Make process/report meaningful for subtitle work with honest, persisted subtitle-focused findings.
**Demo/Validation**:

- process runs real subtitle analyzers
- report renders persisted findings
- dataset summaries work for one file and many files

### Task 5.1: Implement structural subtitle QC analyzers
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/subtitle-analysis-catalog.json`
- **Description**: Build analyzers for:
  - invalid cue order
  - negative or zero durations
  - overlap/gap detection
  - empty cues
  - duplicate cues
  - parse loss warnings
- **Complexity**: 7
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - findings are derived from real cue data
  - per-entry and aggregate counts are both available
  - process can mark `ready`, `warning`, or `error` honestly
- **Validation**:
  - targeted process regression
  - manual fixture smoke

### Task 5.2: Implement readability and density metrics
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/subtitle-analysis-catalog.json`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add metrics such as:
  - characters per line
  - characters per second
  - average cue duration
  - line count distribution
  - cue density per minute
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - report cards expose the most useful readability signals
  - thresholds are configurable or descriptor-driven
  - results distinguish heuristic thresholds from hard parse failures
- **Validation**:
  - regression with known fixture thresholds
  - manual report review

### Task 5.3: Add lexical and dataset summary analyzers
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/subtitle-analysis-catalog.json`, `rooms/laboratory/tools/subtitle-analysis-capabilities.json`
- **Description**: Add lightweight text analysis for:
  - word frequency
  - repeated phrases
  - vocabulary spread
  - top entries by cue count / duration / coverage
  - per-language and per-date batch summaries
- **Complexity**: 7
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - summary works for single-entry and multi-entry projects
  - report cards remain understandable without pretending NLP certainty
  - outputs are cheap enough for local-first use
- **Validation**:
  - targeted regression on small fixture sets
  - manual dataset report smoke

### Task 5.4: Add provider placeholders for deeper NLP and alignment
- **Location**: `rooms/laboratory/tools/subtitle-analysis-providers.json`, `rooms/laboratory/tools/subtitle-analysis-capabilities.json`, `rooms/laboratory/host/index.js`
- **Description**: Register planned or optional providers for:
  - `entities-keyphrases`
  - `semantic-search`
  - `topic-modeling`
  - `tone-sentiment`
  - `audio-alignment`
- **Complexity**: 5
- **Dependencies**: Task 5.3
- **Acceptance Criteria**:
  - the UI can show roadmap modules without fake results
  - capability state clearly says `planned`, `optional`, `unsupported`, or `ready`
  - later analyzers can plug in without schema churn
- **Validation**:
  - descriptor regression
  - manual capability-state inspection

### Task 5.5: Replace report-stage placeholders with subtitle-backed rendering
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Render real summary cards, per-entry findings, aggregate warnings, export history, and planned module placeholders from persisted subtitle process data.
- **Complexity**: 7
- **Dependencies**: Task 5.1, Task 5.2, Task 5.3
- **Acceptance Criteria**:
  - report no longer reads like a media-analysis placeholder when subtitle-analysis is active
  - findings separate hard failures, warnings, and heuristic observations
  - export and report history survive reloads
- **Validation**:
  - manual report-stage smoke
  - UI regression for subtitle-analysis report markers

## Sprint 6: Hardening, Parity, And Rollout Closure

**Goal**: Make the feature portable, testable, and honest enough to live beside the existing laboratory workflows.
**Demo/Validation**:

- workspace and installed-room parity remain healthy
- smoke docs exist for manual verification
- performance limits are explicit

### Task 6.1: Add installed-room parity and export/import checks
- **Location**: `scripts/tests/laboratory-media-source-portability-regressions.test.ts`, `scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts`, `scripts/tests/room-page-regressions.test.ts`
- **Description**: Verify that subtitle-analysis descriptors, assets, and manifest entries survive install/export/import flows cleanly.
- **Complexity**: 6
- **Dependencies**: All prior sprints
- **Acceptance Criteria**:
  - installed room mirrors every required subtitle-analysis file
  - feature view and copy survive packaging
  - portability checks do not silently skip new files
- **Validation**:
  - targeted parity regression run
  - manual installed-room sanity check if needed

### Task 6.2: Add source/edit/process/report behavior regressions for subtitle-analysis
- **Location**: `scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts`, new `scripts/tests/laboratory-subtitle-analysis-behavior-regressions.test.ts`
- **Description**: Cover the highest-signal workflows:
  - local single import
  - folder import
  - YouTube discovery normalization
  - cleanup preview/apply
  - report rendering
- **Complexity**: 8
- **Dependencies**: All prior sprints
- **Acceptance Criteria**:
  - the new feature has dedicated regression coverage, not only shared room tests
  - high-risk source/edit/report seams are covered
- **Validation**:
  - targeted node test run
  - `npm run typecheck`

### Task 6.3: Write smoke docs and operator checklist
- **Location**: `.rovo/laboratory-subtitle-analysis-smoke.md`, `.rovo/laboratory-subtitle-analysis-source-matrix.md`
- **Description**: Add manual verification docs for supported source modes, expected warnings, and known limitations.
- **Complexity**: 4
- **Dependencies**: Sprint 6
- **Acceptance Criteria**:
  - smoke docs cover single, folder, playlist, and channel cases
  - known limitations are explicit
  - planned analyzers are documented as planned
- **Validation**:
  - document review
  - smoke execution on at least one local and one YouTube scenario

## Testing Strategy

- Keep `scripts/tests/laboratory-media-analysis-room-regressions.test.ts` and `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts` green throughout.
- Add a dedicated `scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts` early in Sprint 1.
- Add behavior regressions once the feature stops being descriptor-only:
  - discovery normalization
  - yt-dlp arg building
  - parser normalization
  - cleanup preview/apply state
  - report rendering markers
- Run `npm run typecheck` after every sprint.
- Re-run room-page and scene-debug regressions whenever manifest/view ids or feature-strip behavior changes.

## Potential Risks & Gotchas

- The current top-level `source` and `edit` branches are still biased toward one active asset.
  - Mitigation: lock the `subtitleAnalysis` collection branch before source/edit UI work grows.
- Channel discovery can return too many items for one UI render.
  - Mitigation: normalize paging/chunking early and avoid eager subtitle-availability lookups for every row.
- Weekday filtering can become ambiguous because upload timestamps and user locale timezones differ.
  - Mitigation: persist raw publish timestamp plus normalized UTC date and explicitly document which timezone the weekday filter uses.
- Shorts detection is not perfectly universal across every source.
  - Mitigation: use a clear `shorts | not-shorts | unknown` tri-state instead of a fake boolean certainty.
- Subtitle availability for many videos may be slow or rate-limited.
  - Mitigation: two-phase discovery:
    - candidate discovery first
    - per-row or selected-slice subtitle enrichment second
- Subtitle formats carry very different styling semantics.
  - Mitigation: keep an internal normalized cue model and preserve raw originals separately.
- Advanced NLP analyzers can pull the room into heavy dependency growth too early.
  - Mitigation: keep `v1` implemented analyzers lightweight and descriptor-honest; gate advanced providers.
- Bulk source intake may bloat project storage.
  - Mitigation: make selection explicit before acquisition and keep cleanup/process outputs under feature-specific derived roots.

## Rollback Plan

- Revert `rooms/laboratory/manifest.json`, `rooms/laboratory/i18n/*`, and feature asset changes for `subtitle-analysis`.
- Remove subtitle-specific descriptor files under `rooms/laboratory/tools/`.
- Remove `subtitleAnalysis` project-schema branches and `subtitle-analysis` process/report records.
- Remove subtitle-analysis-specific tests and smoke docs.
- Keep any generic room-tool or paging seam additions only if they remain useful to existing laboratory features; otherwise revert them with the feature.
