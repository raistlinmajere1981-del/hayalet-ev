# Plan: Laboratory Media Edit Stage

**Generated**: 2026-03-25
**Estimated Complexity**: High

## Overview

Turn the `edit` stage of the `laboratory` room from a visual dummy panel into a real analysis-prep workspace. The stage should help inexperienced users prepare media safely while still exposing deeper control for advanced users.

The implementation stays aligned with the existing `source` stage architecture:

- room-specific UI, host logic, presets, and tool descriptors stay under `rooms/laboratory/**`
- project data stays under `data/room-storage/laboratory/projects/**`
- generated edit outputs stay under each project's `derived` root
- shared Electron work outside the room remains generic and room-agnostic

This is not a creative editor. The `edit` stage prepares project-owned media for downstream analysis.

## Review Tightening

This plan incorporates sub-agent review feedback and locks three early constraints before implementation starts:

- The laboratory host must move from hardcoded tool ids to a manifest-driven, stage-aware tool registry before settings overlay expansion.
- The room protocol must extract a shared media feature envelope before `edit`-specific UI and host actions branch further from `source`.
- Installed-room parity must be verified explicitly; workspace-only validation is not enough because the live room reads from `api.room.installedDir`.

## Scope Lock

- In scope:
  - real `edit` stage UI and host state
  - beginner and advanced edit modes
  - non-destructive edit recipe persistence
  - preview and apply flows
  - project-owned derived outputs
  - stage-aware settings/tool cards for edit capabilities
  - real processing for video, audio, and image using room-managed tools
- Out of scope:
  - making `profile`, `process`, or `report` real
  - heavyweight AI transforms such as scene detection, super resolution, source separation, tracking, or object recognition
  - collaborative editing or multi-user state
- Allowed outside-scope changes:
  - small shared seam changes required for generic room tool execution, progress, or file orchestration

## Confirmed Product Decisions

- Each project keeps one active edit recipe
- Preview and apply are separate actions
- Beginner and advanced modes both exist
- `ffmpeg + ffprobe` are the core edit-stage tools
- Image-specific extra tooling can be added later as an optional advanced lane
- Source media stays untouched; edit results go into `derived`
- Settings overlay should reuse the same install/probe/update model introduced in `source`

## Product Direction

- Beginner mode should read like analysis preparation, not editor jargon
- Advanced mode should expose deeper control without forcing raw CLI flags
- The stage must stay useful for all three source kinds:
  - `video`
  - `audio`
  - `image`
- The stage should bias toward reversible preparation steps:
  - trim
  - crop/focus
  - resize
  - normalize/cleanup
  - mask/blur
  - extract derivative assets for later analysis

## Proposed User Model

- One project has:
  - one source asset
  - one active edit recipe
  - zero or more generated edit outputs
- The user can:
  - tune the active recipe
  - generate a preview output from that recipe
  - apply the recipe to produce a stable derived output
  - select the latest successful derived output as the handoff target for later stages

## Proposed Runtime Layout

- Room-local source code:
  - `rooms/laboratory/ui/*`
  - `rooms/laboratory/host/*`
  - `rooms/laboratory/tools/*`
  - `rooms/laboratory/i18n/*`
- Project data:
  - `data/room-storage/laboratory/projects/<projectSlug>/project.json`
  - `data/room-storage/laboratory/projects/<projectSlug>/source/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/edit/preview/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/edit/output/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/edit/manifest.json`
- Room-managed tools:
  - `data/rooms/laboratory/tools/runtime/<platform>/*`
  - room manifest source stays under `rooms/laboratory/tools/*`

## Proposed Data Contract

Extend the project record with an `edit` branch:

- `mode`: `beginner | advanced`
- `dirty`: boolean
- `activePresetId`: string or null
- `activeOutputId`: string or null
- `preview`: current preview job/output summary
- `recipe`: normalized non-destructive edit settings
- `outputs`: derived output summaries
- `tooling`: stage capability snapshot

The recipe should have a common shape plus media-specific subtrees:

- `common`
  - output name hint
  - focus region label
  - mask/redaction settings
  - metadata notes
- `video`
  - in/out trim
  - crop box
  - resize
  - fps limit
  - audio include/exclude
  - frame extract cadence
- `audio`
  - in/out trim
  - silence trim
  - channel mode
  - normalize target
  - filter toggles
- `image`
  - crop box
  - rotate
  - resize
  - levels/contrast/sharpen
  - blur/redaction areas

## Initial Capability Matrix

- Video MVP:
  - trim
  - crop/focus region
  - resize
  - fps reduction
  - mute/include audio
  - still frame extraction
  - blur/redaction
- Audio MVP:
  - trim
  - silence trimming
  - normalize loudness
  - channel select
  - low/high pass cleanup
  - waveform and spectrogram preview
- Image MVP:
  - crop
  - rotate
  - resize
  - contrast/brightness
  - sharpen
  - blur/redaction

## Prerequisites

- The current `source` stage implementation remains stable
- `ffmpeg/ffprobe` room-managed install flow stays healthy
- The room can already persist project metadata and stream generic tool progress
- `npm run typecheck` is green before implementation starts

## Sprint 1: Lock The Edit Contract

**Goal**: Define edit-stage state, presets, stage-specific tooling rules, and the reusable action envelope before changing UI behavior.
**Demo/Validation**:

- A documented edit schema exists under room-local tool files
- Settings overlay requirements for edit-stage tools are defined
- Host/UI event names and progress semantics are written down and testable

### Task 1.1: Extend the room-local project schema for edit state

- **Location**: `rooms/laboratory/tools/project-schema.json`
- **Description**: Add the `edit` branch with recipe, preview state, output summaries, mode selection, and active output handoff state.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Existing source-stage projects can be upgraded with sensible edit defaults
  - The schema supports video, audio, and image recipes without mixing incompatible fields
  - Preview and apply outputs are represented separately
- **Validation**:
  - Manual schema review
  - Regression assertion for edit defaults and output fields

### Task 1.2: Add room-local edit presets and capability descriptors

- **Location**: `rooms/laboratory/tools/edit-presets.json`, `rooms/laboratory/tools/edit-capabilities.json`
- **Description**: Define beginner presets, advanced capability groups, default values, and media-type-specific form visibility rules.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Beginner mode exposes a curated subset of recipe controls
  - Advanced mode can reveal deeper but still form-based options
  - Presets are portable and room-local
- **Validation**:
  - Manual descriptor review
  - Regression test for descriptor presence and parseability

### Task 1.3: Define edit-stage command and progress envelopes

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/tools/project-schema.json`
- **Description**: Define `edit-action`, `edit-state`, `edit-job`, and `edit-action-result` payloads with `requestId`, `jobId`, cancellation, stale-response handling, and preview/apply domain separation.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Preview jobs and apply jobs do not overwrite each other
  - Stage switching keeps stale responses isolated
  - UI correlation rules are explicit
- **Validation**:
  - Manual envelope review
  - Regression test for correlated edit payload handling

### Task 1.4: Expand the tool manifest for stage-aware capabilities

- **Location**: `rooms/laboratory/tools/toolchain.manifest.json`, `rooms/laboratory/tools/edit-capabilities.json`
- **Description**: Annotate which tools are required vs optional for edit operations. Keep `ffmpeg/ffprobe` as required. Reserve an optional advanced image tool slot without making it mandatory for MVP.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `ffmpeg/ffprobe` are the only required edit tools in MVP
  - Optional advanced tool slots are stage-tagged and capability-gated
  - The settings overlay can read which tools matter to `source` vs `edit`
- **Validation**:
  - Manifest review
  - Regression test for stage-aware tool metadata

### Task 1.5: Extract a shared media feature envelope

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Introduce a shared `media-action`, `media-state`, `media-job`, and `media-action-result` envelope that can carry both source and edit stage activity without leaving the room trapped in source-only naming.
- **Complexity**: 7
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - `source` and `edit` actions can share correlation, progress, and snapshot semantics
  - Legacy source-only behavior can be preserved temporarily during migration if needed
  - UI and host no longer need to invent a second incompatible event family
- **Validation**:
  - Regression test for shared envelope markers in UI and host
  - Manual source-stage sanity check after envelope extraction

## Sprint 2: Generalize Tooling And Host State

**Goal**: Reuse the existing room-local tool infrastructure so the edit stage can manage the tools it depends on and persist recipe state safely.
**Demo/Validation**:

- The host can save and load edit defaults for an active project
- The settings overlay can show edit-relevant tooling cards
- Tool capability state can be consumed by the edit UI

### Task 2.1: Add edit defaults and migrations in the room host

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Normalize old project files into the new `edit` state shape and add helpers for active recipe, active output, preview state, and edit-stage summaries.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Old projects open without manual repair
  - The host can compute default beginner and advanced recipe state
  - Edit state persists alongside source state
- **Validation**:
  - Host regression assertions for project normalization
  - Manual reload test with an existing project

### Task 2.1b: Replace hardcoded host tool ids with a manifest-driven registry

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/toolchain.manifest.json`
- **Description**: Refactor the host so it loads available tool ids and stage metadata from room-local descriptors instead of hardcoding `yt-dlp` and `ffmpeg`.
- **Complexity**: 7
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - The host can enumerate tools from room-local manifests
  - Stage-aware settings cards do not depend on hardcoded host branches
  - Source-stage functionality still works after the registry shift
- **Validation**:
  - Host regression assertions for dynamic tool registry loading
  - Manual source settings overlay sanity check

### Task 2.2: Extend settings overlay from source-only to stage-aware tooling

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Update the settings overlay so it can present tool cards grouped by stage or capability instead of only `yt-dlp/ffmpeg` source actions.
- **Complexity**: 7
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - The overlay distinguishes `source` tools from `edit` tools/capabilities
  - Required vs optional tools are visually clear
  - Inexperienced users see plain-language hints; advanced users can inspect version/path details
- **Validation**:
  - UI regression test for stage-aware tool cards
  - Manual overlay flow check

### Task 2.2b: Load stage metadata through room-local descriptors

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/edit-capabilities.json`, `rooms/laboratory/ui/index.js`
- **Description**: Ensure stage-aware tool cards and capability gating are driven by room-local descriptors loaded through the host, not inferred from `RoomToolService`.
- **Complexity**: 6
- **Dependencies**: Task 1.4, Task 2.1b
- **Acceptance Criteria**:
  - The UI receives trustworthy stage capability metadata from the host snapshot
  - `RoomToolService` remains generic and binary-focused
  - Settings overlay can explain required vs optional tools per stage
- **Validation**:
  - Regression test for capability snapshot propagation
  - Manual overlay inspection

### Task 2.3: Add host-side edit job registry and cancellation helpers

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Reuse the source-stage job model to track preview generation, recipe apply, and output cleanup jobs with progress forwarding and cancellation.
- **Complexity**: 7
- **Dependencies**: Task 1.3, Task 2.1
- **Acceptance Criteria**:
  - Preview and apply jobs can be cancelled independently
  - Tool progress is mapped to edit-stage job summaries
  - Switching projects clears or isolates edit jobs correctly
- **Validation**:
  - Regression test for overlapping edit jobs
  - Manual cancellation sanity check

### Task 2.4: Define derived output manifest and retention policy

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/project-schema.json`, `.rovo/laboratory-media-edit-smoke.md`
- **Description**: Document and implement the rules for preview temp assets, applied outputs, active output selection, and cleanup behavior.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Preview outputs and applied outputs live in separate folders
  - Preview artifacts can be replaced safely
  - Applied outputs remain stable until the user explicitly replaces or deletes them
- **Validation**:
  - Manual derived-folder inspection
  - Smoke checklist item for preview/apply replacement behavior

## Sprint 3: Build The Real Edit Workspace UI

**Goal**: Replace the current dummy panel with a real analysis-prep workspace that adapts to video, audio, and image sources.
**Demo/Validation**:

- The edit stage renders media-aware controls and summaries
- Beginner and advanced modes can be toggled
- Preview and apply actions are visible and understandable

### Task 3.1: Replace the dummy layout with a stage-aware shell

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Keep the existing page rhythm but replace the static image/toggle dummy content with a real shell: workspace center, edit controls, output actions, and summary panel.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The center panel no longer uses a static decorative inspection frame
  - The right panel shows edit summary and output status
  - The stage remains readable on desktop and narrow widths
- **Validation**:
  - Visual smoke check
  - UI regression markers for the new edit shell

### Task 3.2: Implement beginner mode controls

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Build plain-language controls for safe defaults: trim window, focus region, cleanup preset, resize preset, and redact toggle.
- **Complexity**: 6
- **Dependencies**: Task 1.2, Task 3.1
- **Acceptance Criteria**:
  - A novice user can understand the stage without codec knowledge
  - Beginner mode avoids raw filter or container jargon
  - Beginner actions map cleanly to the active recipe
- **Validation**:
  - Manual UX walkthrough
  - State rendering regression for beginner mode

### Task 3.3: Implement advanced mode controls

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add advanced accordions or tabs for media-specific settings such as crop coordinates, normalize targets, filter toggles, frame cadence, and output tuning.
- **Complexity**: 8
- **Dependencies**: Task 1.2, Task 3.1
- **Acceptance Criteria**:
  - Advanced mode reveals deeper form controls without exposing raw CLI input
  - Media-incompatible controls are hidden or disabled
  - Beginner and advanced views edit the same recipe model
- **Validation**:
  - Manual advanced-mode flow
  - Regression test for media-specific control visibility

### Task 3.4: Render media-specific workspaces

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Provide a tailored workspace per media type:
  - video: player plus trim rail and crop overlay
  - audio: waveform/spectrogram area plus trim and cleanup controls
  - image: canvas, zoom/pan, crop box, and mask areas
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Video, audio, and image each have a meaningful central workspace
  - The workspace is driven by the project-owned source asset first
  - Browser-side scaffolding is allowed for waveform/spectrogram and crop overlays before real derived previews land
  - The right summary panel reuses the same recipe state
- **Validation**:
  - Manual smoke with one project per media type
  - UI regression markers for each media workspace

### Task 3.5: Add preview/apply output controls and summaries

- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add explicit buttons and statuses for `Generate Preview`, `Apply Recipe`, `Cancel`, and `Use Latest Output`.
- **Complexity**: 6
- **Dependencies**: Task 2.3, Task 3.1
- **Acceptance Criteria**:
  - Preview and apply are separate controls
  - The UI makes it clear whether the user is looking at source, preview, or applied output
  - Job progress and last-success state are visible
- **Validation**:
  - Manual preview/apply flow
  - Regression test for output action markers

## Sprint 4: Implement The Real Edit Pipeline

**Goal**: Make the edit stage produce real preview and output artifacts using room-managed tooling.
**Demo/Validation**:

- Video recipe can generate preview and applied output
- Audio recipe can generate preview and applied output
- Image recipe can generate preview and applied output

### Task 4.1: Add generic host helpers for edit file planning

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Add helpers to compute preview/output paths, output ids, recipe hashes, and media-type-specific file naming.
- **Complexity**: 5
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Preview and apply outputs get deterministic, collision-safe names
  - Output metadata can be linked back to the active recipe
  - Project folder boundaries remain enforced
- **Validation**:
  - Host regression assertions for path planning
  - Manual folder inspection

### Task 4.2: Implement video preview and apply processors

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/edit-capabilities.json`
- **Description**: Use `ffmpeg` to execute video trim, crop, resize, fps limit, audio include/exclude, blur/redaction, and frame extraction recipes.
- **Complexity**: 9
- **Dependencies**: Task 2.3, Task 4.1
- **Acceptance Criteria**:
  - Preview uses a lighter output strategy than apply where reasonable
  - Apply produces a stable project-owned output artifact
  - Frame extract output can be stored as derivative assets when enabled
- **Validation**:
  - Manual video recipe run
  - Targeted regression for filtergraph assembly

### Task 4.3: Implement audio preview and apply processors

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/edit-capabilities.json`
- **Description**: Use `ffmpeg` to execute audio trim, silence trim, normalize, channel select, and cleanup filter recipes; generate spectrogram artifacts if enabled.
- **Complexity**: 8
- **Dependencies**: Task 2.3, Task 4.1
- **Acceptance Criteria**:
  - Audio preview/apply work without needing extra mandatory tools
  - Spectrogram generation stays optional and project-owned
  - Normalize/filter options are reflected in the derived metadata
- **Validation**:
  - Manual audio recipe run
  - Regression for audio filter assembly

### Task 4.4: Implement image preview and apply processors

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/edit-capabilities.json`
- **Description**: Use `ffmpeg` image pipeline support for crop, rotate, resize, basic levels, sharpen, and blur/redaction in MVP. Keep optional advanced image tooling deferred.
- **Complexity**: 7
- **Dependencies**: Task 2.3, Task 4.1
- **Acceptance Criteria**:
  - Image edits do not require an extra mandatory dependency in MVP
  - Optional advanced image tooling stays capability-gated and absent from the core path
  - Output metadata captures source vs derived dimensions
- **Validation**:
  - Manual image recipe run
  - Regression for image filter assembly

### Task 4.5: Reuse ffprobe metadata for edit outputs

- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Re-run metadata extraction for previews and applied outputs so the UI can report duration, dimensions, bitrate, and format for the selected handoff asset.
- **Complexity**: 6
- **Dependencies**: Task 4.2, Task 4.3, Task 4.4
- **Acceptance Criteria**:
  - The summary panel reflects derived asset metadata instead of only source metadata
  - Output comparisons can show before/after values where relevant
- **Validation**:
  - Manual metadata inspection
  - Regression for derived metadata backfill

### Task 4.6: Add output selection and handoff semantics

- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Let the user mark the current applied output as the handoff asset for later stages, while preserving the original source and previous derived outputs.
- **Complexity**: 6
- **Dependencies**: Task 4.5
- **Acceptance Criteria**:
  - Later stages can read a clear `activeOutputId` or equivalent handoff reference
  - A compatibility rule is documented: `profile/process/report` may stay dummy even if they visually acknowledge the chosen handoff asset
  - The UI clearly distinguishes `source`, `preview`, and `active derived output`
- **Validation**:
  - Manual handoff selection test
  - Regression for selected output persistence

## Sprint 5: Harden, Verify, And Document

**Goal**: Make the edit stage shippable with portability guarantees, targeted tests, and smoke coverage.
**Demo/Validation**:

- The room exports without bundling runtime-downloaded binaries
- Preview/apply flows survive reloads
- The stage behaves correctly for all three media types

### Task 5.1: Add edit-stage regression tests

- **Location**: `scripts/tests/laboratory-media-edit-room-regressions.test.ts`, `scripts/tests/room-tool-service-regressions.test.ts`
- **Description**: Add regression coverage for edit UI markers, host action routing, recipe normalization, and generic tool seam assumptions.
- **Complexity**: 6
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Tests cover beginner/advanced markers
  - Tests cover edit job correlation and output state
  - Tests do not hardcode machine-local paths
- **Validation**:
  - `npx tsx --test scripts/tests/laboratory-media-edit-room-regressions.test.ts`

### Task 5.2: Add portability and export regressions

- **Location**: `scripts/tests/laboratory-media-edit-portability-regressions.test.ts`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Verify that runtime-downloaded edit tools remain excluded from room export and that edit metadata survives reopen/import flows.
- **Complexity**: 5
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Export does not copy runtime tool payloads into workspace room content
  - Reopened projects recover source plus edit state
  - Installed-room behavior is validated explicitly against workspace expectations
- **Validation**:
  - Targeted portability regression suite

### Task 5.2b: Add installed-room parity checks

- **Location**: `scripts/tests/laboratory-media-edit-portability-regressions.test.ts`, `.rovo/laboratory-media-edit-smoke.md`
- **Description**: Add checks and smoke steps that ensure the installed room copy stays behaviorally aligned with the workspace room after edit-stage changes.
- **Complexity**: 4
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Tests or smoke notes explicitly cover workspace vs installed copy parity
  - The live room cannot silently run stale installed files without the discrepancy being caught
- **Validation**:
  - Targeted parity regression or smoke checklist

### Task 5.3: Write smoke checklist and operator notes

- **Location**: `.rovo/laboratory-media-edit-smoke.md`
- **Description**: Document manual verification flows for video, audio, and image recipes, plus settings overlay tool scenarios.
- **Complexity**: 3
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Smoke list includes required and optional tool scenarios
  - Smoke list includes preview/apply/cancel and handoff checks
- **Validation**:
  - Manual doc review

### Task 5.4: Refresh room copy and user-facing text

- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/manifest.json`
- **Description**: Remove leftover dummy phrasing from edit-stage copy and update room description where needed to reflect a live source + edit pipeline.
- **Complexity**: 4
- **Dependencies**: Sprint 3, Sprint 4
- **Acceptance Criteria**:
  - Edit-stage text no longer describes itself as a fake inspection window
  - Manifest wording does not misrepresent the room as fully dummy
- **Validation**:
  - Manual copy review
  - Manifest regression validation

## Testing Strategy

- Static validation:
  - `npm run typecheck`
  - `node --check rooms/laboratory/host/index.js`
- Targeted regressions:
  - source-stage regressions to ensure no breakage
  - edit-stage UI/host regressions
  - room tool service regressions
  - portability/export regressions
- Manual smoke:
  - video local source -> edit preview -> apply -> select derived output
  - audio local/url source -> waveform/spectrogram -> apply
  - image local/url source -> crop/mask -> apply
  - settings overlay with required tools installed/missing
  - stale-response test for preview/apply jobs

## Potential Risks & Gotchas

- Crop coordinates may drift if the displayed aspect ratio differs from source dimensions.
  - Mitigation: store crop values in normalized source-space coordinates.
- Preview and apply jobs may race and overwrite state.
  - Mitigation: separate job domains, explicit request correlation, and stale-response guards.
- Derived assets may consume too much disk if previews are never cleaned.
  - Mitigation: keep preview outputs replaceable and document retention rules.
- `ffmpeg` filtergraph assembly can diverge across media kinds.
  - Mitigation: build dedicated recipe-to-filter helpers for video, audio, and image instead of one giant switch.
- Waveform and spectrogram rendering can accidentally introduce extra mandatory tooling or expensive preview work.
  - Mitigation: prefer browser-side waveform rendering where possible and keep spectrogram generation optional and project-owned.
- Inexperienced users may not understand whether they are seeing source or derived media.
  - Mitigation: label the viewport clearly as `Source`, `Preview`, or `Applied Output`.
- Optional future tools can leak room-portability assumptions.
  - Mitigation: keep optional tools stage-scoped, capability-gated, and excluded from export payloads.
- A single active recipe could make users worry about losing prior work.
  - Mitigation: preserve generated outputs and let users re-select previous applied outputs even if the recipe changes later.

## Rollback Plan

- Keep the source stage untouched and functional at every sprint boundary.
- If the real edit workspace is unstable:
  - disable edit actions in the host
  - fall back to rendering the source asset in read-only mode
  - hide advanced controls behind capability flags
- If a processor path is broken for one media kind:
  - keep the stage live for the other supported kinds
  - mark the broken action unavailable in capability descriptors
- If portability issues appear:
  - stop exporting optional edit-tool metadata until the exclusion rules are corrected
