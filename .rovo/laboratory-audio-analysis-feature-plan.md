# Plan: Laboratory Audio Analysis Feature

**Generated**: 2026-03-25
**Estimated Complexity**: High

## Overview

Add a second feature, `audio-analysis`, to the existing `laboratory` room so it can sit beside the current `media-analysis` feature without replacing it.

The plan is intentionally split into two product levels:

- `v1` ships a real, local-first audio workbench focused on:
  - technical signal health
  - waveform and spectrogram artifacts
  - optional transcript capture
  - speaker timeline / diarization surface
- `v2` expands the same feature surface to cover the full nine-analysis catalog:
  - signal health
  - spectral and acoustic descriptors
  - transcription
  - speaker diarization
  - prosody
  - emotion heuristics
  - sound event classification
  - source separation
  - music / rhythm / tonal analysis

The core strategy is:

- keep the room local-first and honest about capability limits
- reuse the existing `laboratory` room tool/runtime patterns where they already work
- turn deferred analysis families into explicit `planned` surfaces in `v1`, not fake results
- prepare `v2` by locking contracts, storage shapes, result envelopes, and capability states in `v1`

## Research Notes

- Generic room-page infrastructure already supports multiple features and active feature switching.
- `rooms/laboratory/ui/index.js` and `rooms/laboratory/host/index.js` are still hard-coded to one feature: `media-analysis`.
- The current `laboratory` host already contains useful audio seeds:
  - `runAudioStructureProbe(...)`
  - `maybeRunWhisperProfileSample(...)`
- Existing room-managed tools are strongest around `ffmpeg` and `whisper.cpp`.
- `whisper.cpp` support is currently platform-limited in the room tool manifest, so transcript and speaker features must be capability-gated.
- The current machine profile is modest enough that heavy analyzers must remain optional, cancellable, and small-model-first.

## Assumptions

- Feature id will be `audio-analysis`.
- The new feature stays inside `rooms/laboratory/**`; no new room is introduced.
- `v1` remains local-first and avoids paid/cloud inference as a requirement.
- `v1` does not import existing `media-analysis` project assets or derived outputs.
  - cross-feature handoff is deferred until the standalone audio feature is stable
- `v1` may ship speaker analysis as a capability-gated feature:
  - fully working where the chosen provider is available
  - clearly marked unavailable where the provider/runtime is not ready
- `v2` analyzers that need heavier runtimes will plug into a provider registry instead of expanding one-off host branches.
- If final feature art is not ready, `v1` may ship with a placeholder close-up asset plus provisional hotspot/window bounds.
  - scene polish can tighten later without changing the feature contract

## Scope Lock

- In scope for `v1`:
  - second `laboratory` feature with its own hotspot and close-up view
  - feature-aware host and UI branching
  - audio-first source intake for audio files and video-with-audio files
  - derived analysis target preparation
  - technical signal health analysis
  - waveform / spectrogram generation
  - optional transcript flow
  - speaker timeline / diarization surface
  - report surface for real modules and planned placeholders
- Out of scope for `v1`:
  - full prosody scoring
  - emotion classification claims
  - sound event classification
  - stem separation
  - rhythm / tonal / chord analysis
  - heavyweight bundled ML runtime expansion unless required to unlock the chosen speaker provider
- Allowed `v1` runway work:
  - dummy cards and report slots for deferred modules
  - provider catalog and capability registry
  - generic room-tool seam expansion if it remains room-agnostic

## Version Map

- `v1` real modules:
  - `signal-health`
  - `spectral-artifacts`
  - `transcription`
  - `speaker-diarization` (capability-gated)
- `v1` planned placeholders:
  - `prosody`
  - `emotion`
  - `sound-events`
  - `source-separation`
  - `music-rhythm-tonal`
- `v2` target:
  - every placeholder moves to `implemented` without changing the top-level room/feature contract

## Proposed Room-Local Contract

The first release should lock these room-local contracts early:

- `manifest` contract
  - `laboratory` becomes the first real installed room in this repo with more than one feature
- `analysis catalog` contract
  - one descriptor file lists all analysis families, their status, dependencies, artifact kinds, and provider ids
- `capability` contract
  - host reports whether each analysis family is `ready`, `planned`, `unsupported`, `missing-tool`, or `platform-limited`
- `result` contract
  - every analyzer returns:
    - status
    - summary
    - signals
    - artifacts
    - warnings
    - provider metadata
- `report` contract
  - the report UI always renders from the catalog order
  - `planned` modules show roadmap copy, not fake metrics

## Proposed Runtime Layout

- Existing room-local runtime roots stay primary:
  - `rooms/laboratory/ui/*`
  - `rooms/laboratory/host/*`
  - `rooms/laboratory/tools/*`
  - `rooms/laboratory/i18n/*`
- New `audio-analysis` descriptor files:
  - `rooms/laboratory/tools/audio-analysis-catalog.json`
  - `rooms/laboratory/tools/audio-analysis-capabilities.json`
  - `rooms/laboratory/tools/audio-analysis-presets.json`
  - `rooms/laboratory/tools/audio-analysis-providers.json`
- New room asset:
  - `rooms/laboratory/assets/audio-analysis-view.webp`
- Persistent project/runtime data:
  - `data/room-storage/laboratory/projects/<projectSlug>/project.json`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/audio-analysis/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/audio-analysis/reports/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/audio-analysis/artifacts/*`

## Proposed Data Contract

Extend the room project schema with an `audioAnalysis` branch instead of inventing a parallel storage root:

- `source`
  - selected file kind
  - original path inside the project
  - extracted audio target path when the source is video
- `analysisCatalog`
  - enabled analysis ids
  - available analysis ids
  - planned analysis ids
- `capabilityState`
  - per-analysis readiness and blocker list
- `runs`
  - last run metadata per analysis family
- `report`
  - normalized summary cards and artifact references
- `providerState`
  - provider install/model/runtime readiness

This avoids a schema reset when `v2` modules arrive.

## Performance Budget

`v1` should lock explicit budgets instead of relying on best effort:

- default signal-health sample window: `<= 60s`
- default transcript sample window: `<= 45s`
- default artifact budget per run: `<= 4`
- long-running jobs must be cancellable and correlated by:
  - `featureId`
  - `requestId`
  - `jobId`
- small-model-first behavior is the default on modest hardware

## Sprint 1: Split Laboratory Into a Real Multi-Feature Room
**Goal**: Make `laboratory` capable of hosting `media-analysis` and `audio-analysis` without state leakage or scene/runtime confusion.
**Demo/Validation**:
- Room manifest validates with two features
- Room page shows a working feature strip for `laboratory`
- Switching features changes the active close-up view and runtime context cleanly

### Task 1.1: Add the second feature manifest and scene shell
- **Location**: `rooms/laboratory/manifest.json`, `rooms/laboratory/assets/audio-analysis-view.webp`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add `audio-analysis` to the room manifest with its own hotspot, view id, icon, label copy, and scene background asset while preserving `media-analysis` as the default feature for now.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - `validateRoomManifest` accepts the updated manifest
  - `media-analysis` remains the default feature
  - `audio-analysis` has a stable scene hotspot and close-up view id
- **Validation**:
  - Targeted manifest regression
  - Manual room-page feature switching smoke test

### Task 1.2: Remove single-feature assumptions from the laboratory runtime
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Replace hard-coded `FEATURE_ID = "media-analysis"` assumptions with feature-aware context handling, lock a two-feature action/event payload matrix, and refactor the known bootstrap seams that still hard-wire the runtime to `media-analysis` such as `window.roomAPI.ready(...)`, `buildMediaSnapshot(...)`, and `normalizeContext(...)`.
- **Complexity**: 8
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - UI and host both honor `host-context.activeFeature`
  - A written payload matrix exists for:
    - UI -> host action names
    - host -> UI state/result/job events
    - stale-response correlation keys including `featureId`
  - Switching features does not leak stage state, project state, or last-request ids across features
  - `media-analysis` behavior remains unchanged when selected
- **Validation**:
  - Targeted regression for `host-context` branching
  - Manual switch-back-and-forth smoke test

### Task 1.3: Extract room-shared helpers before feature growth
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Isolate room-shared tool/status helpers, project persistence helpers, and feature-local state factories so the second feature does not pile directly onto one undifferentiated state bag.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Shared helpers are clearly separated from feature-local state branches
  - Feature-local state factories exist for both `media-analysis` and `audio-analysis`
  - The refactor can stay in the same files, but the ownership boundaries are explicit
- **Validation**:
  - Manual code review
  - Targeted regression for no state leakage

### Task 1.4: Define the audio-analysis catalog and provider registry
- **Location**: `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/tools/audio-analysis-capabilities.json`, `rooms/laboratory/tools/audio-analysis-presets.json`, `rooms/laboratory/tools/audio-analysis-providers.json`
- **Description**: Create descriptor files that enumerate all nine analysis families, their rollout status (`implemented`, `planned`, `unsupported`), provider ids, artifact kinds, and UI visibility rules.
- **Complexity**: 6
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - All nine analysis families exist in one catalog
  - Deferred `v2` families are visible as planned, not hidden
  - Catalog descriptors are room-local and portable
- **Validation**:
  - Descriptor parse smoke test
  - Regression test for required descriptor files

### Task 1.5: Add first-class multi-feature regression coverage for laboratory
- **Location**: `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`, `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`, `scripts/tests/room-page-regressions.test.ts`, `scripts/tests/scene-debug-room-regressions.test.ts`
- **Description**: Add regressions for two-feature `laboratory` behavior and update existing `media-analysis` tests so they assert compatibility rather than a one-feature room.
- **Complexity**: 7
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - Tests cover two features, default feature stability, and room-page chip rendering
  - Scene debug helpers continue to resolve feature views and hotspots correctly
  - Existing media-analysis regressions still pass with no behavioral downgrade
- **Validation**:
  - Targeted node test run
  - `npm run typecheck`

### Task 1.6: Add installed-room and portability parity coverage
- **Location**: `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`, `scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`, `scripts/tests/laboratory-media-source-portability-regressions.test.ts`, `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
- **Description**: Extend workspace-vs-installed and export/import parity coverage so new audio-analysis assets, descriptors, and package files remain portable after install/export cycles.
- **Complexity**: 7
- **Dependencies**: Task 1.1, Task 1.4
- **Acceptance Criteria**:
  - Installed room mirrors every required audio-analysis file
  - Export/import keeps the feature package complete
  - Any `.room-install-files.json` expectations are updated if the new files become tracked
- **Validation**:
  - Targeted portability/parity regression run
  - Manual install/export sanity check

## Sprint 2: Build The Audio Analysis Workbench Shell
**Goal**: Create a feature-local workbench that can ingest audio or video-with-audio and prepare a deterministic analysis target for later analyzers.
**Demo/Validation**:
- `audio-analysis` opens to a distinct workbench
- User can load a source and see a normalized analysis target summary
- The feature shows real tool readiness plus planned-module cards

### Task 2.1: Extend the project schema for audio-analysis runs
- **Location**: `rooms/laboratory/tools/project-schema.json`, `rooms/laboratory/host/index.js`
- **Description**: Add an `audioAnalysis` branch to the existing project schema for source metadata, extracted audio target info, analysis runs, provider state, report summaries, and artifact references.
- **Complexity**: 6
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Schema can persist both `media-analysis` and `audio-analysis` data without collisions
  - Audio-analysis data can be invalidated independently when source changes
  - Deferred `v2` modules already have reserved result slots
- **Validation**:
  - Schema review
  - Project save/load regression

### Task 2.2: Add audio-first source intake and target preparation
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/source-presets.json`
- **Description**: Build a source flow for local audio and local video files, then prepare an analysis target by extracting/normalizing an audio working copy when needed.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Audio files can be analyzed directly
  - Video files produce a stable extracted audio target
  - The extracted target keeps provenance metadata linking back to the original source
- **Validation**:
  - Manual smoke test with one audio file and one video file
  - Project metadata regression

### Task 2.3: Build the workbench UI and planned-module cards
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add a feature-local shell with source summary, waveform/spectrogram viewport, v1 analysis cards, and disabled/planned cards for deferred `v2` modules.
- **Complexity**: 7
- **Dependencies**: Task 1.2, Task 2.2
- **Acceptance Criteria**:
  - `audio-analysis` looks distinct from `media-analysis`
  - Real modules and planned modules share one catalog-driven visual language
  - Planned modules display blockers and roadmap copy, not synthetic numbers
- **Validation**:
  - Manual desktop and narrow-width UI check
  - String/regression test for planned-card markup

### Task 2.4: Add settings and capability surfaces for v1 and v2 providers
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/toolchain.manifest.json`
- **Description**: Expand the settings surface for the real `v1` binary tools (`ffmpeg`, `whisper.cpp`) and show deferred `v2` providers only as non-installable catalog/capability summaries until the generic provider registry lands.
- **Complexity**: 7
- **Dependencies**: Task 1.4, Task 2.3
- **Acceptance Criteria**:
  - Real binary tools still use the current room-tool patterns
  - Deferred providers appear only as roadmap/capability summaries, not install buttons
  - Platform limitations are explicit
- **Validation**:
  - Manual settings smoke test with missing-tool state
  - Regression test for capability rendering

### Task 2.5: Lock the diarization runner decision before implementation
- **Location**: `rooms/laboratory/tools/audio-analysis-providers.json`, `rooms/laboratory/host/index.js`
- **Description**: Make an explicit go/no-go decision for the `v1` speaker runner family so Sprint 3 is not blocked by an undefined provider path.
- **Complexity**: 5
- **Dependencies**: Task 1.4, Task 2.4
- **Acceptance Criteria**:
  - The plan chooses one of:
    - packaged binary
    - generic script runner
    - dummy-only speaker lane on unsupported platforms
  - Fallback behavior is documented per platform
  - The chosen path fits the project hardware and portability constraints
- **Validation**:
  - Design review
  - Provider descriptor review

## Sprint 3: Ship The V1 Real Analysis Core
**Goal**: Deliver the actual `v1` feature set: signal health, spectral artifacts, transcript, and speaker surface.
**Demo/Validation**:
- Running `audio-analysis` produces a real report for the supported modules
- Artifacts are persisted into the project folder
- Unsupported modules remain clearly marked as planned

### Task 3.1: Implement the signal-health analyzer
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/tools/audio-analysis-presets.json`
- **Description**: Reuse and expand the existing audio probe seeds to measure silence pockets, loudness spread, clipping risk, peak/headroom, and basic noise-floor or spectral-balance summaries.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Analyzer emits structured signals, warnings, and summary metrics
  - Outputs are derived from tool results, not hard-coded heuristics only
  - Results stay within the locked `v1` sample and artifact budgets
- **Validation**:
  - Manual run on clean speech and noisy speech samples
  - Targeted host regression for result normalization

### Task 3.2: Implement waveform, spectrogram, and spectral artifact generation
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Persist waveform/spectrogram artifacts and add a compact spectral summary panel that can feed future descriptor-heavy analyzers without changing the report contract.
- **Complexity**: 7
- **Dependencies**: Task 2.2, Task 2.3
- **Acceptance Criteria**:
  - Artifacts are written into project-owned directories
  - UI can render artifacts for the latest run
  - The stored result envelope can later carry richer spectral descriptors in `v2`
  - Artifact count stays inside the locked `v1` budget
- **Validation**:
  - Manual artifact generation smoke test
  - Project artifact-path regression

### Task 3.3: Implement transcript capture as an optional local analyzer
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/toolchain.manifest.json`, `rooms/laboratory/tools/profile-models.json`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Reuse the existing Whisper model patterns for `audio-analysis`, prefer broadening room-local binary support where practical, and keep transcript results capability-gated anywhere platform/runtime support is still missing.
- **Complexity**: 8
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Transcript output includes text, timestamps or segment hints when available, and provider metadata
  - Missing/unsupported platforms show an explicit blocker state
  - Transcript absence does not block signal-health analysis
  - Default transcript runs stay inside the locked `v1` sample window
- **Validation**:
  - Manual transcript smoke test on a supported platform
  - Unsupported-platform regression for blocker messaging

### Task 3.4: Implement the speaker timeline and diarization adapter
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/audio-analysis-providers.json`, `rooms/laboratory/tools/audio-analysis-catalog.json`
- **Description**: Add a provider-backed speaker timeline contract that can represent speech segments, speaker turns, overlaps, and explicit fallback states when a diarization runtime is unavailable.
- **Complexity**: 9
- **Dependencies**: Task 2.5, Task 3.3
- **Acceptance Criteria**:
  - Report can render `who spoke when` data where supported
  - Unsupported providers still preserve a reserved result slot and blocker explanation
  - Speaker analysis never pretends to have run when it did not
  - Long-running speaker jobs are cancellable
- **Validation**:
  - Manual smoke test with a two-speaker sample where supported
  - Regression test for fallback/result-state honesty

### Task 3.5: Assemble the v1 report surface
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Build the feature report from the catalog order so technical health, spectral artifacts, transcript, speaker timeline, and planned modules all share one summary surface.
- **Complexity**: 6
- **Dependencies**: Task 3.1, Task 3.2, Task 3.3, Task 3.4
- **Acceptance Criteria**:
  - Report clearly separates measured, derived, heuristic, and planned sections
  - Artifacts link back to project-owned files
  - Planned modules occupy stable slots for `v2`
- **Validation**:
  - Manual report smoke test
  - UI regression for section ordering

## Sprint 4: Lock The V2 Runway Without Shipping The Heavy Modules Yet
**Goal**: Prepare `v2` expansion by adding provider seams, dummy-ready result slots, and runtime policies now.
**Demo/Validation**:
- Deferred modules appear as planned and capability-aware
- Provider metadata can evolve without changing the main project schema
- Electron/shared seams remain generic

### Task 4.1: Add a generic analyzer-provider registry seam
- **Location**: `rooms/laboratory/tools/audio-analysis-providers.json`, `rooms/laboratory/host/index.js`, `src/types/room-tools.ts`, `electron/room-tool-service.ts`
- **Description**: Introduce a generic provider model that can represent binary tools, model downloads, future script runners, and non-installable planned providers without baking `laboratory` rules into shared Electron code.
- **Complexity**: 9
- **Dependencies**: Task 1.3, Task 2.4
- **Acceptance Criteria**:
  - Shared Electron code stays room-agnostic
  - Room host can describe both installable and planned providers
  - Future analyzers can be added by descriptor + host wiring rather than by redesigning the result schema
- **Validation**:
  - Regression for generic room-tool neutrality
  - Descriptor-driven provider parse smoke test

### Task 4.2: Add planned-module report sections for v2 analyses
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Render stable report cards for prosody, emotion, sound events, source separation, and music/rhythm/tonal so `v2` can light them up without redesigning the report.
- **Complexity**: 5
- **Dependencies**: Task 3.5
- **Acceptance Criteria**:
  - Planned cards show scope and blockers
  - Cards do not display fabricated metrics
  - Ordering is catalog-driven
- **Validation**:
  - UI regression
  - Manual roadmap-state smoke test

### Task 4.3: Reserve persistent outputs for deferred analyzers
- **Location**: `rooms/laboratory/tools/project-schema.json`, `rooms/laboratory/host/index.js`
- **Description**: Add empty-but-valid storage shapes for future analyzer outputs so `v2` does not require a breaking project migration.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Project schema can persist planned analyzer branches
  - `v1` can write `planned` states without pretending the analyzer ran
  - Future runs can fill the same branches in place
- **Validation**:
  - Save/load regression
  - Manual project re-open check

## Sprint 5: V2 Advanced Analysis Family Rollout A
**Goal**: Turn the first deferred families real without changing the workbench contract.
**Demo/Validation**:
- Planned cards for prosody, emotion, and sound events move to implemented on supported setups
- Existing v1 modules remain untouched

### Task 5.1: Implement prosody analysis
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/tools/audio-analysis-providers.json`
- **Description**: Add speech-rate, pause-density, pitch-contour, and loudness-contour outputs using the locked provider/result contracts.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Output fits the predeclared report slots
  - Long clips remain windowed and cancellable
  - Results are clearly labeled heuristic where appropriate
- **Validation**:
  - Manual speech sample smoke test
  - Result normalization regression

### Task 5.2: Implement emotion heuristic analysis
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add a deliberately cautious emotion/arousal surface that exposes confidence, disclaimers, and non-authoritative wording.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - UI language never presents emotion outputs as fact
  - Results expose confidence and disclaimer metadata
  - Unsupported runs degrade to planned or unavailable states
- **Validation**:
  - Copy review
  - Manual smoke test

### Task 5.3: Implement sound-event classification
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/tools/audio-analysis-providers.json`
- **Description**: Add event tagging for notable ambient classes such as applause, laughter, alarms, crowd, or other supported labels.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Result format matches the predeclared event report slot
  - Labels, confidence, and time ranges are stored consistently
  - Event analysis can be disabled without affecting v1 modules
- **Validation**:
  - Manual labeled-sample smoke test
  - Persistence regression

## Sprint 6: V2 Advanced Analysis Family Rollout B
**Goal**: Finish the remaining deferred families and harden the feature into the full nine-analysis catalog.
**Demo/Validation**:
- Source separation and music analysis are real
- Speaker analysis is hardened beyond the v1 capability-gated foundation
- The final report covers all nine analysis families

### Task 6.1: Implement source separation
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-providers.json`, `rooms/laboratory/tools/audio-analysis-catalog.json`
- **Description**: Add stem or layer separation with project-owned outputs and a report surface that can connect separated stems back to transcript and event workflows.
- **Complexity**: 9
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Separation outputs are persisted as explicit artifacts
  - Report can preview or reference generated stems
  - Storage and cancellation rules are defined for heavy runs
- **Validation**:
  - Manual separation smoke test
  - Artifact cleanup regression

### Task 6.2: Implement music / rhythm / tonal analysis
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/audio-analysis-catalog.json`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add BPM, beat, rhythm density, and tonal/key-oriented summaries for music-heavy or soundtrack-heavy sources.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Output fits the predeclared music report slots
  - Music analysis is skipped or downplayed when the source is speech-only
  - Heuristic or confidence metadata remains explicit
- **Validation**:
  - Manual music-clip smoke test
  - Report rendering regression

### Task 6.3: Harden speaker diarization and transcript alignment
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Upgrade the `v1` speaker surface into a more reliable diarization + transcript-alignment workflow without changing the outward report contract.
- **Complexity**: 8
- **Dependencies**: Task 3.4, Task 6.1
- **Acceptance Criteria**:
  - Speaker turns and transcript segments align to one report model
  - Overlap cases are represented explicitly
  - The feature remains honest when alignment confidence is low
- **Validation**:
  - Manual multi-speaker sample smoke test
  - Regression for overlap rendering

### Task 6.4: Finalize the full nine-analysis report and export hooks
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Finalize a unified report/export surface that can enumerate every implemented module, preserve provenance, and remain stable when some modules are disabled.
- **Complexity**: 6
- **Dependencies**: Task 6.2, Task 6.3
- **Acceptance Criteria**:
  - One report contract covers all nine families
  - Exported summaries retain provider and artifact provenance
  - Partial runs do not break report rendering
- **Validation**:
  - Manual report export smoke test
  - Persistence and reload regression

## Testing Strategy

- Add a dedicated laboratory audio-analysis regression file:
  - manifest and descriptor presence
  - two-feature room assumptions
  - catalog-driven planned-card rendering
- Expand room-page regressions because `laboratory` becomes the first real installed room with multiple features.
- Keep scene-debug regressions in scope because the room now has more than one feature view.
- Treat performance and cancellation limits as explicit acceptance checks, not just risk notes.
- Add fixture-backed manual smoke coverage for:
  - clean speech audio
  - noisy speech audio
  - two-speaker clip
  - music-heavy clip
  - ambience / event-rich clip
  - video file with extractable audio
- Run at minimum:
  - targeted `node --test scripts/tests/...`
  - `npm run typecheck`
- Add honest unsupported-platform checks for transcript / speaker providers.
- Verify:
  - default sample windows respect the locked `v1` budget
  - artifact counts stay bounded
  - long-running analysis actions can be cancelled cleanly

## Potential Risks & Gotchas

- `rooms/laboratory/ui/index.js` and `rooms/laboratory/host/index.js` are monoliths today.
  - Adding a second feature without explicit state namespacing will cause leakage.
- `whisper.cpp` platform support is currently narrow in the room tool manifest.
  - Transcript and speaker features must not be treated as universally available.
- The current room-tool install path is strongest for GitHub release binaries.
  - `v2` analyzers may need model downloads, runner scripts, or new provider types.
- The current hardware profile is modest.
  - Default runs must stay bounded, artifact budgets must stay small, and heavy analyzers must be cancellable.
- `planned` cards are useful only if they remain truthful.
  - Never show fake metrics, confidence, or timestamps for unimplemented analyzers.
- No installed room in the repo currently exercises a real two-feature runtime.
  - `laboratory` will become the proving ground for this path.

## Rollback Plan

- Revert `laboratory` manifest, asset, and i18n changes for `audio-analysis`.
- Remove audio-analysis descriptor files and schema branches.
- Revert laboratory UI/host feature branching if the multi-feature pivot proves too destabilizing.
- Keep generic room-page or room-tool improvements only if:
  - they remain room-agnostic
  - regression coverage proves no room-specific coupling
  - they are still valuable without `audio-analysis`
