# Plan: Laboratory Media Profile Stage

**Generated**: 2026-03-25
**Estimated Complexity**: High

## Overview

Turn the `profile` stage of the `laboratory` media-analysis room from a visual dummy into a real analysis-profile builder and preflight lab.

This stage should answer a practical user question:

- "What kinds of manipulation, AI residue, effect layering, overdub, metadata drift, or suspicious edits are worth checking on this media?"

The stage will not run the full long-form analysis pipeline yet. Instead, it will:

- choose the active analysis profile for the project
- decide whether downstream analysis should inspect the original source or the latest derived edit output
- verify tool readiness for the selected inspection lanes
- run lightweight preflight probes and sample-based scans
- produce project-owned readiness data, sample artifacts, and estimated downstream runtime

The implementation stays aligned with the existing `source` and `edit` architecture:

- room-specific UI, host logic, presets, and descriptors stay under `rooms/laboratory/**`
- project-owned profile data stays under `data/room-storage/laboratory/projects/**`
- tool installs remain room-local and stage-aware
- shared Electron changes stay generic and room-agnostic

## Review Tightening

This plan now locks three constraints before implementation starts:

- MVP optional tool support must stay compatible with the current manifest-driven GitHub-release installer.
  - `ffmpeg` remains the only required binary tool and `ffprobe` remains its companion executable.
  - `whisper.cpp` is the only optional binary analyzer in MVP scope.
  - `exiftool` is deferred until the generic installer/provider model expands.
- `derived` targeting must be pinned, not implied.
  - `targetAssetMode: derived` must pair with a concrete `targetOutputId` and output signature.
- Optional model downloads must follow a strict policy.
  - model descriptors need checksum, expected bytes, quantization, platform/CPU compatibility, and stale cleanup rules.

## Scope Lock

- In scope:
  - real `profile` stage UI and host state
  - beginner and advanced profile modes
  - project-owned profile persistence
  - stage-aware tool cards and settings overlay expansion
  - lightweight preflight probes for video, audio, and image sources
  - analysis lane selection for authenticity, effects, audio additions, and metadata consistency
  - source-vs-derived handoff targeting from the `edit` stage
- Out of scope:
  - making `process` or `report` fully real
  - definitive "AI generated" verdicts
  - heavyweight cloud inference or paid APIs
  - full-length transcription, diarization, or deepfake classification as MVP requirements
- Allowed outside-scope changes:
  - small generic room-tool seam additions needed for optional model assets, staged preflight artifacts, or room-managed execution

## Product Positioning

This stage should not feel like a "test preset" selector anymore.

It should feel like:

- an investigation desk
- a scope-definition step before deeper processing
- a place where inexperienced users can choose safe presets
- a place where advanced users can tune the exact forensic lenses that will run later

The room should remain honest about what it can and cannot prove:

- the stage can produce risk signals
- the stage can surface suspicious patterns
- the stage can estimate where deeper process time should be spent
- the stage must not claim courtroom-grade certainty from heuristics alone

## Confirmed Product Decisions

- Only the `profile` stage becomes real in this phase
- `process` and `report` remain mostly dummy, with only compatibility adjustments
- Each project keeps one active profile recipe
- Profile stage can target either:
  - the original project source
  - the active derived edit output
- Beginner and advanced modes both exist
- Tool integration follows the same settings-overlay model used in `source` and `edit`
- The room stays local-first and offline-first where possible
- AI/effect detection is presented as "suspicion and consistency analysis", not proof

## Product Strategy

The stage will be built around five analysis lanes:

- `metadata-lineage`
  - inspect container, capture, encode, and timing consistency
- `visual-tamper`
  - inspect frame freezes, abrupt cuts, repeated frames, black intervals, and suspicious cleanup traces
- `audio-tamper`
  - inspect silence insertions, loudness jumps, channel asymmetry, and timing drift
- `speech-overlay`
  - inspect speech presence, transcript density, and signs of dubbing/voice addition when tooling is available
- `synthetic-suspicion`
  - inspect likely AI/effect residue patterns using heuristic-only signals

These lanes will have two user surfaces:

- Beginner mode:
  - safe presets
  - plain-language descriptions
  - limited toggles
- Advanced mode:
  - explicit lane toggles
  - sensitivity/depth controls
  - artifact generation settings
  - optional analyzer enablement

## Toolchain Direction

The profile stage should reuse the current room-tool architecture and extend it with stage-aware support:

- Required core tools:
  - `ffmpeg`
  - `ffprobe` companion executable shipped with the managed `ffmpeg` install
- Optional advanced tools in MVP:
  - `whisper.cpp`
    - speech transcript and timestamp sampling
- Deferred post-MVP extension:
  - `exiftool`
    - deeper metadata lineage once the generic installer/provider model supports it safely

Model policy:

- `whisper.cpp` binary readiness and model readiness are separate concerns
- model descriptors should stay room-local
- downloaded models should stay under room storage, not inside the portable room package

Tool policy:

- Required tools gate the stage
- Optional tools unlock deeper lanes without blocking beginner usage
- Settings overlay must clearly show:
  - required vs optional
  - installed vs missing
  - binary version
  - model readiness where relevant

## Why These Tools

- `ffmpeg` plus its bundled `ffprobe` companion already exist in the room and cover most MVP preflight needs:
  - duration and stream structure
  - frame extraction
  - scene-change heuristics
  - silence/loudness analysis
  - spectrogram and waveform artifact generation
- `whisper.cpp` enables local speech sampling without introducing a remote API dependency

## Honest Capability Model

The UI and data model must distinguish between:

- `measured`
  - direct probe result from a tool
- `derived`
  - summary computed from measured signals
- `heuristic`
  - suspicion score inferred from multiple weak signals

Every surfaced risk should carry:

- confidence band
- source lane
- supporting artifact count
- a short explanation of why the signal appeared

## Proposed Runtime Layout

- Room-local source:
  - `rooms/laboratory/ui/*`
  - `rooms/laboratory/host/*`
  - `rooms/laboratory/tools/*`
  - `rooms/laboratory/i18n/*`
- Project-owned persistence:
  - `data/room-storage/laboratory/projects/<projectSlug>/project.json`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/profile/preflight/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/profile/manifest.json`
- Room-managed optional tool/model assets:
  - `data/rooms/laboratory/tools/runtime/<platform>/*`
  - `data/room-storage/laboratory/models/whisper/*`
  - `data/room-storage/laboratory/tool-cache/*`

## Proposed Data Contract

Extend the project record with a `profile` branch:

- `mode`
  - `beginner | advanced`
- `activePresetId`
  - current selected profile preset
- `targetAssetMode`
  - `source | derived`
- `targetOutputId`
  - concrete derived output id when `targetAssetMode` is `derived`
- `targetAssetSignature`
  - source or derived asset fingerprint used to invalidate stale preflight results
- `dirty`
  - whether current profile differs from the last successful preflight
- `laneSelection`
  - enabled lanes by id
- `depth`
  - `quick | balanced | deep`
- `sensitivity`
  - normalized risk sensitivity value
- `readiness`
  - tool/model readiness, blockers, warnings
- `estimate`
  - predicted process runtime and artifact count
- `preflight`
  - last run summary, timestamps, status, warnings
- `signals`
  - normalized risk signals from the last preflight
- `artifacts`
  - sample frame strips, spectrograms, metadata dumps, transcript snippets

## Proposed Artifact Types

The profile stage should be able to produce small, inspectable artifacts:

- frame strip images
- freeze/cut event lists
- spectrogram images
- waveform summaries
- metadata JSON dumps
- transcript snippets with timestamps
- readiness manifest JSON

Artifacts are intentionally lightweight because full processing belongs to the later `process` stage.

## Proposed User Experience

### Beginner Surface

Preset-first layout with simple language:

- `Quick Authenticity Check`
- `Dialogue / Overdub Check`
- `Visual Tamper Sweep`
- `Balanced Forensic Pass`

Each preset explains:

- what it checks
- what it ignores
- how long it may take later

### Advanced Surface

Advanced mode exposes:

- per-lane toggles
- target asset selection
- depth and sensitivity controls
- optional analyzer usage
- artifact generation flags
- transcript sample length and frame sample density

### Center Panel

The main work area should show:

- active source or derived asset summary
- lane cards
- preflight progress
- sample artifacts
- console-like findings feed

### Right Panel

The side panel should show:

- profile summary
- target asset
- tool readiness
- blockers and warnings
- estimated downstream runtime
- signal counts by lane

## Prerequisites

- `source` and `edit` stages remain stable
- manifest-driven room tool registry stays healthy
- stage-aware settings overlay from `edit` is already working
- `npm run typecheck` is green before implementation begins

## Sprint 1: Lock The Profile Contract

**Goal**: Define the profile-stage state, presets, lane descriptors, and tool requirements before replacing the dummy UI.
**Demo/Validation**:

- Room-local profile descriptors exist and parse cleanly
- Project schema supports a persisted `profile` branch
- Tool manifest clearly shows profile-stage requirements

### Task 1.1: Lock tool packaging, model policy, and target pinning

- **Location**: `.rovo/laboratory-media-profile-stage-plan.md`, `rooms/laboratory/tools/toolchain.manifest.json`, `rooms/laboratory/tools/profile-models.json`
- **Description**: Freeze the MVP packaging rules around the current installer shape: `ffmpeg` as the required tool, bundled `ffprobe` as companion only, `whisper.cpp` as the only optional binary analyzer in scope, and explicit model-download policy for speech models. Write the derived-target pinning contract so `targetOutputId` and asset signatures are mandatory when using derived handoff.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - MVP optional tools stay limited to installer-compatible packages
  - `ffprobe` is treated as a companion executable, not a standalone tool
  - `targetAssetMode: derived` requires `targetOutputId` and invalidation rules
  - Model policy includes checksum, expected bytes, quantization, compatibility, and cleanup rules
- **Validation**:
  - Manual policy review
  - Follow-up plan review or regression notes update

### Task 1.2: Extend the project schema with profile state

- **Location**: `rooms/laboratory/tools/project-schema.json`
- **Description**: Add the `profile` branch with mode, preset, target asset selection, lane selection, readiness, estimate, preflight, signals, and artifact summaries.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Existing projects can upgrade with safe defaults
  - `source` and `edit` data remain backward-compatible
  - Schema supports both required and optional analyzers
  - Derived targeting can be pinned to a specific output id and signature
- **Validation**:
  - Manual schema review
  - Regression assertion for new profile defaults

### Task 1.3: Add room-local profile presets, lane descriptors, and model descriptors

- **Location**: `rooms/laboratory/tools/profile-presets.json`, `rooms/laboratory/tools/profile-capabilities.json`, `rooms/laboratory/tools/profile-models.json`
- **Description**: Define beginner presets, advanced controls, lane metadata, default sensitivity/depth, media compatibility, and the local model catalog for speech sampling.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Beginner presets exist for video, audio, and image
  - Lane descriptors explain media compatibility and tool dependency
  - Model descriptors define safe default speech models, storage targets, checksums, and compatibility rules
  - Descriptor files remain room-local and portable
- **Validation**:
  - Parseability check
  - Regression test for descriptor presence

### Task 1.4: Expand the tool manifest for the profile stage

- **Location**: `rooms/laboratory/tools/toolchain.manifest.json`, `rooms/laboratory/tools/profile-capabilities.json`
- **Description**: Add `profile` stage support metadata for required and optional tools while staying inside the current installer model.
- **Complexity**: 6
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - `ffmpeg` is marked required for `profile`
  - `ffprobe` remains modeled as a companion executable of the `ffmpeg` install
  - `whisper.cpp` is the only optional binary analyzer in MVP scope and is capability-gated
  - Settings overlay can distinguish required vs optional for the current stage
- **Validation**:
  - Manifest review
  - Regression test for stage-aware support matrix

### Task 1.5: Define the profile action and job envelope

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Extend the shared media envelope with `profile` action domains for config updates, preflight runs, cancellation, artifact refresh, and readiness refresh.
- **Complexity**: 7
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Profile actions use isolated request domains
  - Preflight jobs and config updates do not cross wires
  - Cancellation and stale-response rules are explicit
- **Validation**:
  - Manual envelope review
  - Regression test for profile request isolation

### Task 1.6: Add confidence language and heuristic disclaimers

- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/tools/profile-capabilities.json`
- **Description**: Define consistent copy for measured vs derived vs heuristic outputs so the UI does not overstate certainty.
- **Complexity**: 4
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Every risk lane has plain-language explanatory copy
  - UI copy differentiates blockers, warnings, and suspicion
  - No preset claims definitive AI-proofing
- **Validation**:
  - Manual copy review
  - Snapshot/string regression for the main labels

## Sprint 2: Host Foundations And Stage-Aware Readiness

**Goal**: Make the host aware of profile state, target asset routing, lane capability gating, and preflight persistence.
**Demo/Validation**:

- Host can save/load normalized profile state
- Host can resolve whether profile targets source or derived asset
- UI receives real readiness snapshots

### Task 2.1: Add profile defaults and migrations in the room host

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Add normalized default profile state and migration helpers for older projects.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Loading an old project yields valid profile defaults
  - Profile state survives save/reload cycles
  - Resetting source or edit output invalidates stale profile state when appropriate
- **Validation**:
  - Targeted host regression
  - Manual persistence review

### Task 2.2: Resolve the active profile target asset

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Add host helpers that choose between source media and the active derived edit output as the analysis target.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Profile stage can target `source` or `derived`
  - Missing or stale derived output falls back safely and visibly
  - Derived targeting pins `targetOutputId` and a signature instead of following whichever output becomes active later
  - Preflight and later downstream estimates use the same target asset semantics
- **Validation**:
  - Regression test for target resolution
  - Manual source-vs-derived switch smoke check

### Task 2.3: Build profile readiness snapshots

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Compute required-tool blockers, optional-tool availability, media compatibility, and lane readiness for the active project.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Required blockers are explicit
  - Optional tools downgrade lanes gracefully instead of breaking the stage
  - UI can render readiness without running preflight
- **Validation**:
  - Host regression for readiness states
  - Manual missing-tool scenario review

### Task 2.4: Create project-owned profile artifact directories and manifest

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Add helpers that create and persist `derived/profile/preflight/*` and a profile manifest file per project.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Preflight artifacts live under the project
  - Manifest persists last run metadata and artifact pointers
  - Re-running preflight updates the manifest cleanly
- **Validation**:
  - File layout regression
  - Manual manifest inspection

### Task 2.5: Add optional model readiness and download orchestration

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/profile-models.json`
- **Description**: Add host-side readiness tracking and room-managed download/update flows for optional speech models using room storage rather than portable room package paths.
- **Complexity**: 7
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Binary readiness and model readiness are surfaced separately
  - Missing models do not block the whole stage unless the user explicitly enables speech-only advanced lanes that require them
  - Model files are stored under room storage and survive reloads
  - Model downloads verify checksum and expected size before being marked ready
  - Model descriptors encode quantization and compatibility constraints for the local runtime
  - Stale model cleanup rules are explicit and reversible
- **Validation**:
  - Host regression for model readiness states
  - Manual missing-model vs installed-model review

## Sprint 3: Replace The Dummy Profile UI

**Goal**: Turn the current preset-only dummy profile view into a real stage with presets, lane cards, readiness, model/tool state, and artifact surfaces.
**Demo/Validation**:

- The profile page no longer depends on local dummy-only state
- Beginner and advanced mode both work
- Tool readiness and lane blockers are visible

### Task 3.1: Replace dummy profile state with project-backed profile state

- **Location**: `rooms/laboratory/ui/index.js`
- **Description**: Remove local dummy profile toggles and bind the stage to the shared media snapshot from the host.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Profile preset and focus state come from project data
  - UI survives project switching and reloads
  - Stage no longer depends on dummy-only local mutations
- **Validation**:
  - UI regression test
  - Manual project-switch sanity check

### Task 3.2: Build the beginner preset console

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add beginner preset cards with plain-language descriptions, expected checks, estimated intensity, and compatibility notes.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Beginner mode feels approachable for non-expert users
  - Each preset clearly states what it checks
  - The preset updates summary and readiness immediately
- **Validation**:
  - String/markup regression
  - Manual visual review

### Task 3.3: Build the advanced lane matrix

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Add advanced controls for lane toggles, depth, sensitivity, target asset selection, and artifact preferences.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Lane cards clearly show status, tool need, and media compatibility
  - Advanced controls are form-based, not raw CLI arguments
  - Unsupported lanes disable cleanly for the current media type
- **Validation**:
  - UI regression test
  - Manual advanced-mode interaction check

### Task 3.4: Add readiness, estimate, and summary side panels

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Replace the dummy side summary with real readiness, target asset, estimated runtime, and lane count summaries.
- **Complexity**: 5
- **Dependencies**: Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - Required blockers are visible
  - Optional analyzer absence is visible but non-fatal
  - Runtime estimate changes when depth and lane selection change
- **Validation**:
  - Manual summary review
  - Snapshot regression

### Task 3.5: Add profile-stage settings integration

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Extend the settings overlay so the current stage highlights profile tools and optional analyzer lanes, including model readiness for speech analysis.
- **Complexity**: 6
- **Dependencies**: Task 3.4
- **Acceptance Criteria**:
  - Current-stage tools for `profile` are highlighted correctly
  - Optional analyzers are separated from required blockers
  - Whisper model readiness can be shown distinctly from binary readiness
  - Model actions follow the same guarded UX principles as tool actions
- **Validation**:
  - Manual settings smoke
  - UI regression for support labels

## Sprint 4: Real Preflight Analysis Pipeline

**Goal**: Run lightweight, project-owned probes that generate useful signals and artifacts without pretending to be the final process stage.
**Demo/Validation**:

- A preflight run produces real artifacts in the project folder
- The UI shows measured signals and heuristic summaries
- Cancellation works cleanly

### Task 4.1: Implement ffprobe/ffmpeg metadata and structure probes

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Build required core probes for stream structure, duration consistency, keyframe sampling, scene transitions, silence intervals, loudness patterns, and spectrogram generation.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Video, audio, and image all produce at least one measured signal set
  - Artifacts are stored under `derived/profile/preflight`
  - Preflight status and warnings persist to the project manifest
- **Validation**:
  - Host regression test
  - Manual artifact inspection

### Task 4.2: Add metadata lineage inspection lane

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/profile-capabilities.json`
- **Description**: Use core metadata and `ffprobe`-driven inspection for MVP. Summarize capture/encode anomalies, missing tags, and suspicious metadata gaps without depending on a new metadata binary provider.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Lane is fully useful with the existing core toolchain
  - The result shape leaves room for future metadata enrichers without changing the contract
  - Findings are labeled as measured vs heuristic
- **Validation**:
  - Core-tool regression path
  - Manual metadata-diff inspection

### Task 4.3: Add speech and overdub preflight lane

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/profile-capabilities.json`
- **Description**: Use waveform/silence/loudness signals as the baseline. When `whisper.cpp` and a compatible model are ready, add transcript sampling and timestamp density summaries.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Audio-only projects still get useful baseline results without speech tooling
  - Whisper-dependent insights appear only when binary and model are ready
  - UI clearly distinguishes "speech lane unavailable" from "speech lane found nothing suspicious"
- **Validation**:
  - Host regression for optional tool/model path
  - Manual transcript sample review

### Task 4.4: Add synthetic/effect suspicion aggregation

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/profile-capabilities.json`
- **Description**: Aggregate weak signals from visual cleanup traces, abrupt cadence changes, metadata gaps, and audio irregularities into bounded suspicion summaries.
- **Complexity**: 7
- **Dependencies**: Task 4.1, Task 4.2, Task 4.3
- **Acceptance Criteria**:
  - Suspicion summaries are derived from explicit supporting signals
  - UI shows confidence bands and supporting evidence count
  - No result copy claims definitive AI detection
- **Validation**:
  - Regression test for result shape
  - Manual copy review for honesty and clarity

### Task 4.5: Support cancellation, rerun, and stale artifact invalidation

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Ensure profile preflight jobs can be canceled, rerun safely, and invalidated when source or edit output changes.
- **Complexity**: 6
- **Dependencies**: Sprint 2, Task 4.1
- **Acceptance Criteria**:
  - Cancelling a preflight job does not corrupt prior completed results
  - Source replacement or edit-output changes mark profile state stale
  - UI surfaces stale profile state clearly
- **Validation**:
  - Behavior regression for cancellation and stale-state handling
  - Manual rerun smoke

## Sprint 5: Portability, Process Compatibility, And QA

**Goal**: Make the profile stage portable, testable, and aligned with future `process` and `report` work.
**Demo/Validation**:

- Installed room copy mirrors the workspace room package
- Optional tool/model states are documented and smoke-tested
- Dummy downstream stages can at least read the new profile contract

### Task 5.1: Add process/report compatibility shims

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Keep `process` and `report` mostly dummy, but let them reflect that a real profile exists, including target asset choice and preflight completion status.
- **Complexity**: 5
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Downstream dummy views do not misrepresent profile status
  - Users can tell whether preflight has run
  - No later stage implies full analysis already happened
- **Validation**:
  - Manual downstream smoke
  - UI regression strings

### Task 5.2: Add regression coverage for profile behavior

- **Location**: `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`, `scripts/tests/laboratory-media-profile-behavior-regressions.test.ts`
- **Description**: Add tests for profile descriptors, request isolation, readiness gating, target asset selection, and cancellation semantics.
- **Complexity**: 6
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Shared room regressions cover the new files and UI markers
  - Behavior regressions cover stale-response handling and cancellation
  - Target asset resolution has regression coverage
- **Validation**:
  - `npx tsx --test ...`

### Task 5.3: Add portability and installed-room parity tests

- **Location**: `scripts/tests/laboratory-media-source-portability-regressions.test.ts`, `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
- **Description**: Extend portability assertions for profile descriptors, optional model descriptors, and installed-room parity.
- **Complexity**: 5
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Workspace and installed room copies stay aligned
  - Exportable room files include new profile descriptors
  - Runtime binaries and local models are still excluded from portable package expectations
- **Validation**:
  - Installed parity regression
  - Portability regression

### Task 5.4: Add a profile-stage smoke checklist

- **Location**: `.rovo/laboratory-media-profile-stage-smoke.md`
- **Description**: Write the manual smoke flow for preset selection, advanced lane selection, tool readiness, preflight artifact generation, cancellation, optional analyzer absence, and source-vs-derived targeting.
- **Complexity**: 3
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Smoke checklist covers required and optional tool cases
  - Checklist covers cancellation
  - Checklist covers installed-room parity after sync/reinstall
- **Validation**:
  - Manual doc review

## Testing Strategy

- Per sprint:
  - keep `npm run typecheck` green
  - run targeted room regressions
  - keep installed-room parity current after workspace edits
- Profile-specific behavior coverage:
  - profile request isolation
  - preflight cancellation
  - target asset resolution
  - readiness gating
  - optional analyzer downgrade paths
- Manual smoke coverage:
  - beginner preset flow
  - advanced lane flow
  - required tool missing vs installed
  - optional tool missing vs installed
  - stale-state after source/edit changes

## Potential Risks & Gotchas

- Whisper model management is separate from binary management.
  - Mitigation: treat models as room-managed assets under storage, not part of the exportable room package.
- Users may read "AI suspicion" as proof.
  - Mitigation: force confidence/disclaimer copy into the data contract and UI.
- Optional analyzers can create confusing mixed states.
  - Mitigation: represent readiness as `required blocker`, `optional unavailable`, or `ready`.
- Preflight artifact generation can grow too large.
  - Mitigation: cap sample counts, clip durations, and artifact sizes in the profile descriptors.
- Derived output can go stale after edit changes.
  - Mitigation: invalidate profile readiness and preflight status when the selected target asset changes.
- Tool install/update and model download can drift.
  - Mitigation: keep binary install and model readiness as separate status rows.
- Process/report may appear more real than they are.
  - Mitigation: explicitly surface "profile complete, full process pending" copy in downstream compatibility shims.

## Rollback Plan

- Revert room-local profile descriptor files and schema updates
- Revert host profile-state and preflight helpers
- Restore the dummy profile UI rendering path
- Remove profile-stage regressions and smoke files
- Re-sync `data/rooms/laboratory/` from the restored workspace copy if needed
