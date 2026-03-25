# Plan: Laboratory Audio Analysis V2

**Generated**: 2026-03-25
**Estimated Complexity**: High

## Overview

This plan takes the current `laboratory` `audio-analysis` feature from a `v1` shell with shared tooling and placeholder modules to a real `v2` workbench that supports the full nine-analysis catalog:

- signal health
- spectral and acoustic descriptors
- transcription
- speaker diarization
- prosody
- emotion heuristics
- sound events
- source separation
- music / rhythm / tonal analysis

The approach is to keep the existing room-local architecture and shared tool/settings workflow intact, then layer `v2` in four controlled moves:

1. lock storage and result contracts so `v2` does not require a breaking schema reset
2. introduce a descriptor-driven provider runtime instead of one-off host branches
3. light up the deferred analysis families in two rollout waves
4. finish with unified reporting, export, performance hardening, and portability coverage

## Progress Update

- Sprint 1 is implemented in the workspace and installed room copy.
- The project schema now persists a dedicated `audioAnalysis` branch with normalized `results`, `runs`, `capabilityState`, `providerState`, and export metadata.
- The audio report surface now consumes catalog-ordered module envelopes instead of relying only on generic process findings.
- Sprint 1 docs now exist:
  - `.rovo/laboratory-audio-analysis-provider-matrix.md`
  - `.rovo/laboratory-audio-analysis-smoke-matrix.md`
- Sprint 2 currently has an implemented first slice:
  - generic audio module runner registration for the live `v1` modules
  - richer descriptor-backed provider state carried into project snapshots
  - audio settings overlay provider readiness dashboard
  - `spectral-artifacts` upgraded with persisted spectral descriptor summaries
  - planned tool placeholders for `openSMILE` and `YAMNet` now flow through the shared room-tool overlay without pretending to be installable
- Sprint 2 now also has a shared tool-mode follow-up in place:
  - room-tool service can represent `system-command` tools in addition to installable and planned tools
  - `openSMILE` is now modeled as a manual host dependency that can be probed and rechecked from the shared settings overlay
  - the overlay now distinguishes installable tools, manual system tools, and truly planned placeholders without feature-specific branching
- Sprint 2 now has its first deferred-family rollout:
  - `prosody` is promoted from placeholder to an implemented module backed by the manual `openSMILE` tool
  - room-local `openSMILE` config assets are packaged with the room so prosody runs use a stable preset instead of host-specific config discovery
  - the process stage can now emit `prosody-summary-json` and contour CSV artifacts through the same normalized result envelope
- Sprint 2 now also has a second manual-tool rollout on the same seam:
  - `emotion` is promoted into a clearly labeled heuristic module that reuses the `openSMILE` prosody extraction path
  - the module emits an `emotion-summary-json` artifact with explicit disclaimer text and low-confidence defaults
  - shared metrics/report surfaces now expose the heuristic label without pretending it is authoritative
- Sprint 3 now has its first model-backed runtime rollout:
  - `sound-events` is promoted into an implemented module backed by the manual `YAMNet` runtime path
  - the room packages a local helper script while the shared overlay handles host dependency probing for TensorFlow, TensorFlow Hub, NumPy, and SciPy
  - capability state now blocks implemented modules on missing required tool ids instead of assuming a single-provider happy path
- Sprint 3 now also has its first source-separation rollout:
  - `source-separation` is promoted into an implemented module backed by the manual `Demucs` runtime path
  - the host extracts a stable WAV input with `ffmpeg`, runs `python3 -m demucs` on CPU, and persists a stem manifest plus isolated-track artifacts in the project workspace
  - the shared overlay still reports `missing-tool` honestly when the Demucs dependency is absent on the host
- Sprint 3 now also has the music/rhythm rollout:
  - `music-rhythm-tonal` is promoted into an implemented module backed by a room-local `librosa` helper
  - the host extracts a normalized WAV input, persists a music descriptor summary, and keeps the `Essentia` path modeled as a deeper fallback instead of a hard requirement
  - module capability checks now distinguish `requiredToolIds` from the broader prepared tool list so fallback tools stay visible without over-blocking the primary runtime
- The remaining deferred families now have honest manual dependency prep in the shared overlay:
  - `demucs`, `librosa`, and `essentia` are modeled as manual `system-command` tools
  - the `music-rhythm-tonal` descriptor now advertises all prepared tools while still gating execution on the primary `librosa` path
- Speaker diarization now has explicit prep instead of a blank placeholder:
  - the room now models `pyAudioAnalysis` as the no-account manual `system-command` dependency for diarization
  - the host packages a room-local diarization helper and can emit speaker timeline summaries when the local package exists
  - the provider and module descriptors keep execution honest by falling back to missing-tool blockers on hosts where the package is absent

## Current Baseline

- `audio-analysis` already exists as a second `laboratory` feature
- room-local audio descriptor files already exist:
  - `rooms/laboratory/tools/audio-analysis-catalog.json`
  - `rooms/laboratory/tools/audio-analysis-capabilities.json`
  - `rooms/laboratory/tools/audio-analysis-presets.json`
  - `rooms/laboratory/tools/audio-analysis-providers.json`
- the settings overlay already reuses the same room-local install/update/model flow as `media-analysis`
- the host and UI already understand active feature context and can expose planned `v2` modules honestly
- what is still missing for `v2`:
  - broader portability and fixture-backed smoke coverage for the new provider modes
  - unified report/export logic across all nine families

## Assumptions

- `v2` stays local-first and does not require paid/cloud inference
- `ffmpeg` and `whisper.cpp` remain first-class providers where they already fit
- heavier analyzers can be added as optional provider families, but they must remain capability-gated and cancellable
- the room keeps using `rooms/laboratory/**` and `data/room-storage/laboratory/**`; no new room is introduced
- emotion outputs remain explicitly heuristic and non-authoritative
- source separation, event classification, and music analysis may require new binaries, scripts, or model downloads, but those are integrated through a generic provider seam rather than hard-coded special cases
- no clarification round is used in this pass; ambiguous points are locked as assumptions so implementation can start without blocking

## Prerequisites

- working `ffmpeg` room-tool integration
- existing `whisper.cpp` room-tool integration and capability detection
- current `audio-analysis` `v1` shell merged and stable
- fixture strategy for manual smoke samples:
  - speech-only clip
  - multi-speaker clip
  - noisy ambient clip
  - music-heavy clip
  - long-form clip

## Sprint 1: Lock The V2 Contracts
**Goal**: Freeze the data, result, and UI contracts that every new analyzer will use.
**Demo/Validation**:
- `audio-analysis` projects can persist a dedicated `audioAnalysis` branch without breaking existing projects
- planned and implemented modules render from the same catalog order
- save/reload works with empty, partial, and fully populated `audioAnalysis` states

### Task 1.1: Extend the project schema with a persistent `audioAnalysis` branch
- **Location**: `rooms/laboratory/tools/project-schema.json`, `rooms/laboratory/host/index.js`
- **Description**: Add a schema branch for `audioAnalysis` source metadata, extracted target metadata, per-module run state, capability state, provider state, result summaries, artifacts, and export metadata. Add migration-safe defaults in the host so existing project files continue to load.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - old projects load with valid default `audioAnalysis` state
  - new projects persist `audioAnalysis` without affecting `media-analysis`
  - schema additions are forward-compatible with partial or planned-only modules
- **Validation**:
  - targeted save/load regression
  - manual reopen smoke test

### Task 1.2: Add a normalized per-analysis result envelope
- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Introduce host factories/helpers so every analysis family writes the same normalized envelope: `status`, `summary`, `signals`, `artifacts`, `warnings`, `provider`, `timing`, `confidence`, and `runMeta`.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - every module can be represented as `planned`, `ready`, `running`, `complete`, `failed`, or `unsupported`
  - partial runs and failed runs still produce valid envelopes
  - report rendering does not need module-specific fallback branches for missing fields
- **Validation**:
  - unit-style regression for result normalization
  - manual inspection of serialized project state

### Task 1.3: Make report/process rendering catalog-driven for all nine families
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Refactor the audio report/process surfaces so module ordering, visibility, and status labels come from the audio catalog instead of ad hoc UI branching. Add stable report cards and blocker copy for every deferred family.
- **Complexity**: 7
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - planned and implemented modules share one rendering path
  - report cards never fabricate metrics for planned modules
  - process UI can show module-by-module progress and partial completion
- **Validation**:
  - targeted UI regression
  - manual roadmap-state smoke test

### Task 1.4: Add migration and fixture coverage for the new contract
- **Location**: `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`, `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`, `scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`, `.rovo/laboratory-audio-analysis-smoke-matrix.md`
- **Description**: Add regressions for schema migration and define the manual fixture matrix needed for `v2` rollout verification.
- **Complexity**: 5
- **Dependencies**: Task 1.1, Task 1.3
- **Acceptance Criteria**:
  - regressions cover old-project fallback and new-project persistence
  - smoke matrix defines one clip per major analysis family
  - installed/workspace parity remains intact
- **Validation**:
  - targeted node/tsx tests
  - `npm run typecheck`

### Task 1.5: Lock a provider selection matrix and fallback policy
- **Location**: `.rovo/laboratory-audio-analysis-provider-matrix.md`, `rooms/laboratory/tools/audio-analysis-providers.json`, `rooms/laboratory/tools/audio-analysis-catalog.json`
- **Description**: Decide and document the primary and fallback provider strategy for the five deferred families plus the upgraded spectral/acoustic descriptor path. Capture installability, platform limits, expected artifacts, and whether each path is binary-backed, model-backed, or script-backed.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - every `v2` family has a named primary provider path and fallback status
  - provider decisions are reflected in room-local descriptors
  - unsupported families can remain planned without blocking the other rollout waves
- **Validation**:
  - manual review against descriptor files
  - provider matrix completeness check

## Sprint 2: Add The Generic Analyzer Runtime
**Goal**: Replace placeholder module metadata with a real provider/runtime seam that can power heavy `v2` analyzers safely.
**Demo/Validation**:
- settings overlay can describe installable, gated, and planned providers without special cases
- long-running analyzers are cancellable and artifact-aware
- heavy modules can be added through descriptor + host wiring rather than new Electron-specific branches
- the upgraded spectral/acoustic module can emit descriptor-rich output through the same shared runtime

### Task 2.1: Introduce a descriptor-driven analyzer-provider registry
- **Location**: `rooms/laboratory/tools/audio-analysis-providers.json`, `rooms/laboratory/host/index.js`, `src/types/room-tools.ts`, `electron/room-tool-service.ts`
- **Description**: Generalize provider definitions so a provider can represent a binary tool, a model-backed runtime, a future script runner, or a non-installable planned dependency. Keep Electron shared code room-agnostic.
- **Complexity**: 9
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - provider descriptors cover installability, model/runtime readiness, artifact policy, and platform limits
  - shared Electron code stays room-neutral
  - the host can resolve provider metadata without hard-coding analyzer-specific branches into shared services
- **Validation**:
  - regression for room-tool neutrality
  - descriptor parse smoke test

### Task 2.2: Add per-analysis job orchestration, cancellation, and artifact ownership
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Add generic job helpers for windowing, per-module working dirs, correlated `jobId/requestId/featureId` tracking, cancellation, timeout policy, and artifact cleanup rules.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - every module run is cancellable
  - artifacts are written under project-owned `audio-analysis` directories
  - canceled or failed jobs do not leave the project in an invalid state
- **Validation**:
  - job lifecycle regression
  - manual cancel-mid-run smoke test

### Task 2.3: Expand the settings overlay into a real provider readiness dashboard
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Extend the audio settings overlay so it can show provider type, install/update status, model readiness, runtime policy, and why a module is still gated or planned.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - one overlay can explain `ready`, `missing-tool`, `missing-model`, `platform-limited`, `planned`, and `unsupported`
  - the same overlay still works for the original `media-analysis` tool surface
  - provider cards remain descriptor-driven
- **Validation**:
  - targeted UI regression
  - manual settings overlay smoke test

### Task 2.4: Add portable smoke coverage for provider descriptors and installed copies
- **Location**: `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`, `scripts/tests/laboratory-media-source-portability-regressions.test.ts`, `data/rooms/laboratory/.room-install-files.json`
- **Description**: Extend portability coverage so the new provider descriptors and runtime metadata survive workspace/install/export cycles.
- **Complexity**: 5
- **Dependencies**: Task 2.1, Task 2.3
- **Acceptance Criteria**:
  - installed/workspace parity includes all audio-analysis descriptors
  - export/import flows do not silently drop provider metadata
  - runtime-only payloads remain excluded from workspace exports
- **Validation**:
  - targeted portability regression
  - manual installed-room diff check

### Task 2.5: Upgrade `spectral-artifacts` into descriptor-grade spectral/acoustic output
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/ui/index.js`
- **Description**: Expand the current waveform/spectrogram module so it can also emit stable spectral/acoustic descriptors such as centroid/rolloff, energy trends, and similar summary signals without changing the outer report contract.
- **Complexity**: 7
- **Dependencies**: Task 2.2, Task 2.3
- **Acceptance Criteria**:
  - the existing module keeps its artifact outputs
  - descriptor summaries fit the normalized result envelope
  - report cards can show richer spectral output without special-case layout rewrites
- **Validation**:
  - manual descriptor smoke test
  - report rendering regression

## Sprint 3: Advanced Analysis Rollout A
**Goal**: Ship the first three deferred families without changing the locked contracts.
**Demo/Validation**:
- prosody, emotion, and sound events move from `planned` to real results on supported setups
- unsupported setups degrade to honest capability states
- existing `v1` modules remain unaffected

### Task 3.1: Implement prosody analysis
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/tools/audio-analysis-providers.json`
- **Description**: Add speech-rate, pause-density, pitch-contour, and loudness-contour analysis using the generic provider/runtime seam and normalized result envelope.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - prosody results fit the common envelope
  - long clips are windowed and bounded by policy
  - contour outputs reference generated artifacts rather than giant inline payloads
- **Validation**:
  - manual speech sample smoke test
  - result normalization regression

### Task 3.2: Implement emotion heuristic analysis with strict disclaimers
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add a cautious emotion/arousal surface that exposes confidence, disclaimer metadata, and non-authoritative language.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - UI never presents emotion outputs as fact
  - results expose confidence and disclaimer fields explicitly
  - unsupported or low-confidence runs degrade to warning-rich output rather than false certainty
- **Validation**:
  - copy review
  - manual emotion-surface smoke test

### Task 3.3: Implement sound-event classification
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/tools/audio-analysis-providers.json`
- **Description**: Add event tagging for supported ambient classes such as applause, alarms, crowd, laughter, or similar labels, with time ranges and confidence.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - event outputs match the normalized result envelope
  - event labels, confidence, and time ranges persist consistently
  - event analysis can be disabled without affecting other modules
- **Validation**:
  - manual labeled-sample smoke test
  - persistence regression

### Task 3.4: Add cross-module report cards for Rollout A outputs
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Turn the planned report cards for prosody, emotion, and sound events into real cards that can show summary metrics, warnings, and artifact links while still honoring partial runs.
- **Complexity**: 6
- **Dependencies**: Task 3.1, Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - report cards render with real data or explicit unavailable states
  - partial runs do not break card order or layout
  - warning-heavy modules remain readable and clearly labeled
- **Validation**:
  - targeted report rendering regression
  - manual partial-run smoke test

## Sprint 4: Advanced Analysis Rollout B
**Goal**: Complete the remaining deferred families and harden speaker/transcript workflows into a real `v2` desk.
**Demo/Validation**:
- source separation and music analysis are real
- speaker/transcript alignment is more trustworthy than the `v1` gated surface
- the report can enumerate every family in one consistent model

### Task 4.1: Implement source separation
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-providers.json`, `rooms/laboratory/tools/audio-analysis-catalog.json`
- **Description**: Add project-owned stem or layer separation with explicit artifact records and runtime policies for heavier runs.
- **Complexity**: 9
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - separation outputs persist as explicit artifacts
  - artifact cleanup and cancellation rules are defined for heavy runs
  - report cards can reference separated outputs without custom one-off logic
- **Validation**:
  - manual separation smoke test
  - artifact cleanup regression

### Task 4.2: Implement music / rhythm / tonal analysis
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add BPM, beat, rhythm density, and tonal/key-oriented summaries for music-heavy or soundtrack-heavy sources.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - outputs fit the common result envelope
  - speech-only sources are skipped or downplayed cleanly
  - heuristic/confidence metadata remains explicit
- **Validation**:
  - manual music-clip smoke test
  - report regression

### Task 4.3: Harden speaker diarization and transcript alignment
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/audio-analysis-providers.json`
- **Description**: Upgrade the existing speaker surface into a more reliable diarization + transcript-alignment workflow with overlap handling, low-confidence behavior, and artifact-backed speaker timelines.
- **Complexity**: 8
- **Dependencies**: Task 2.2, Task 4.1
- **Acceptance Criteria**:
  - speaker turns and transcript segments align to one report model
  - overlap cases are represented explicitly
  - low-confidence alignment remains honest and warning-rich
- **Validation**:
  - manual multi-speaker smoke test
  - overlap rendering regression

### Task 4.4: Add cross-module linking for separated stems, events, and transcripts
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Add optional linkage between source separation outputs, event tags, and transcript/speaker segments so the final report can explain provenance across modules.
- **Complexity**: 7
- **Dependencies**: Task 4.1, Task 4.3
- **Acceptance Criteria**:
  - cross-links remain optional and do not block single-module results
  - provenance survives save/reload
  - the UI can render linked artifacts without assuming all modules ran
- **Validation**:
  - manual linked-artifact smoke test
  - persistence regression

## Sprint 5: Final Report, Export, And Hardening
**Goal**: Finish the full nine-family workbench with stable export, reload, and performance behavior.
**Demo/Validation**:
- one report/export contract covers all nine families
- partial runs, reloads, and unsupported modules remain stable
- `audio-analysis` is ready for broader iterative use without schema churn

### Task 5.1: Finalize the unified nine-family report and export envelope
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Finalize one report/export shape that enumerates every module, preserves provider and artifact provenance, and remains stable when some modules are disabled or unsupported.
- **Complexity**: 7
- **Dependencies**: Task 3.4, Task 4.2, Task 4.3
- **Acceptance Criteria**:
  - one export contract covers all nine families
  - provider provenance and artifact references survive export
  - partial runs do not break report rendering
- **Validation**:
  - manual export smoke test
  - persistence/reload regression

### Task 5.2: Add performance budgets, cancellation policy, and cleanup guards
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-capabilities.json`, `rooms/laboratory/tools/audio-analysis-presets.json`
- **Description**: Formalize runtime budgets, model-size defaults, cancellation thresholds, temporary artifact retention, and cleanup behavior for heavy analyzers.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - default policies exist for short clips, long clips, and heavy analyzers
  - cancellation and cleanup are consistent across all modules
  - settings UI can explain why a run was downscaled or blocked
- **Validation**:
  - manual long-clip smoke test
  - cleanup regression

### Task 5.3: Close the portability and regression matrix
- **Location**: `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`, `scripts/tests/laboratory-media-source-portability-regressions.test.ts`, `scripts/tests/room-page-regressions.test.ts`
- **Description**: Finalize the regression suite so manifest, storage migration, provider readiness, report rendering, export, and installed/workspace parity all stay covered.
- **Complexity**: 6
- **Dependencies**: Task 5.1, Task 5.2
- **Acceptance Criteria**:
  - the v2 feature has dedicated regression coverage for schema, provider, report, and export paths
  - room-page/runtime feature switching remains stable
  - installed/workspace parity still passes after the full v2 rollout
- **Validation**:
  - targeted node/tsx suite
  - `npm run typecheck`

## Testing Strategy

- keep a small targeted automated suite for:
  - manifest and descriptor presence
  - project migration and persistence
  - provider registry parsing
  - report rendering
  - installed/workspace parity
- use `npx tsx --test` for TS-based room-page/runtime tests
- keep a manual smoke matrix with at least:
  - speech-only clip
  - multi-speaker clip
  - noisy ambient clip
  - music-heavy clip
  - long-form clip
- require `npm run typecheck` at the end of every sprint
- treat cancellation, partial-run recovery, and reload behavior as first-class validations, not optional smoke steps

## Potential Risks & Gotchas

- Heavy analyzers may introduce model downloads or runtime footprints that do not fit the current machine profile.
  - Mitigation: keep providers optional, descriptor-driven, and small-model-first.
- `audioAnalysis` schema growth can silently break old project reloads.
  - Mitigation: lock migration defaults in Sprint 1 and add old-project reload regressions immediately.
- Emotion analysis can create misleading UX if copy is too confident.
  - Mitigation: require disclaimer metadata and explicit heuristic wording before implementation.
- Source separation and diarization can create large artifacts and long runtimes.
  - Mitigation: formalize retention, cleanup, and cancellation policies before broad rollout.
- Cross-module linking can become brittle if one module fails.
  - Mitigation: keep provenance optional and render partial results safely.
- Shared tool/settings work can drift away from `media-analysis`.
  - Mitigation: keep overlay/provider rendering descriptor-driven and regression-covered for both features.
- Room-page and installed-room parity may regress as the descriptor surface grows.
  - Mitigation: extend parity and portability coverage in every sprint, not only at the end.

## Rollback Plan

- keep each task atomic and committable so provider/runtime additions can be reverted independently
- if a new analyzer destabilizes the host, revert the provider wiring first and leave the catalog entry in `planned` state
- if schema persistence causes reload issues, revert the new `audioAnalysis` sub-branches while keeping descriptor files intact
- if a report/export surface becomes unstable, fall back to the last stable envelope while preserving stored artifacts on disk
- if a heavy provider proves impractical on target hardware, retain its catalog slot as `planned` or `unsupported` without changing the outer feature contract
