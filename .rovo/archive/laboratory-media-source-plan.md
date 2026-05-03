# Plan: Laboratory Media Source Stage

**Generated**: 2026-03-24
**Estimated Complexity**: High

## Overview
Turn only the `source` stage of the `laboratory` room from a local dummy shell into a working source intake workflow. The plan keeps non-source stages functionally unchanged unless a tiny compatibility tweak is required.

The implementation should preserve room portability:
- Room-specific UI, host logic, presets, tool manifests, and copy live under `rooms/laboratory/**`
- Room project data lives under `data/room-storage/laboratory/**`
- Downloaded/managed source-stage tools are grouped under a room-local `tools` root so the room package structure stays portable across Hayalet Ev installations
- Any code outside `rooms/laboratory` must stay generic and minimal, acting only as infrastructure for room-managed tools/processes

## Scope Lock
- In scope: source stage UI, project management, preview, local/url/youtube intake, yt-dlp + ffmpeg management, room-local project persistence
- Out of scope: making `edit`, `profile`, `process`, or `report` real pipelines
- Allowed outside-scope changes: tiny runtime/shared seam additions required to let the room run binaries, persist files, or stream progress safely

## Confirmed Product Decisions
- Only `source` becomes real in this phase
- Source type behavior:
  - `video`: `youtube`, `local`, `url`
  - `audio`: `local`, `url`
  - `image`: `local`, `url`
- Preview works only after the source file exists inside the active project directory
- URL sources are downloaded into the project directory before preview
- YouTube advanced settings use a form UI, not raw argument text
- New projects receive automatic names/slugs
- `ffmpeg` is part of the phase together with `yt-dlp`

## Architecture Direction
- The room webview UI continues to talk through `roomAPI`
- `rooms/laboratory/host/index.js` becomes the room-local orchestrator for source-stage state, project lifecycle, and tool operations
- A minimal shared Electron seam handles process spawning, binary install/update, and progress streaming because the room host cannot safely run native processes on its own
- The shared seam must be generic and room-agnostic; laboratory-specific rules stay in room-local manifests/configs
- Export policy must be explicit: exported room packages should not treat runtime-downloaded yt-dlp/ffmpeg payloads as authoritative artifacts; after export/import or reinstall, the room should re-probe and, if needed, re-bootstrap tool binaries per platform

## Proposed Runtime Layout
- Room-local source code:
  - `rooms/laboratory/ui/*`
  - `rooms/laboratory/host/*`
  - `rooms/laboratory/tools/*`
  - `rooms/laboratory/i18n/*`
- Persistent room data:
  - `data/room-storage/laboratory/projects/<projectSlug>/`
  - `data/room-storage/laboratory/projects/<projectSlug>/project.json`
  - `data/room-storage/laboratory/projects/<projectSlug>/source/*`
  - `data/room-storage/laboratory/projects/<projectSlug>/derived/*`
- Room-managed external tools:
  - Workspace/package source root: `rooms/laboratory/tools/*`
  - Installed/exportable runtime root: `data/rooms/laboratory/tools/<platform>/...`
  - Optional room-storage metadata/cache root: `data/room-storage/laboratory/tools-state/*`

Rationale:
- `data/room-storage` already exists as the persistent room-data contract
- tool manifests stay exportable with the room package
- room-managed binaries stay under the room's own installed/exportable folder instead of leaking into app-global locations
- project data remains separate from tool binaries so project cleanup stays safe

## Prerequisites
- Existing laboratory room remains installable and manifest-valid
- Electron main process can expose one new generic room-tool IPC surface
- Network access is available for update checks and binary downloads
- `npm run typecheck` stays green before and after the feature

## Sprint 1: Lock The Room Contract
**Goal**: Define the room-local source-stage data model and the minimal shared seam before touching major UI behavior.
**Demo/Validation**:
- A documented project schema exists
- The room host can persist/read source-stage state for an active project
- No non-source stage behavior regresses

### Task 1.1: Define room-local source data schema
- **Location**: `rooms/laboratory/tools/project-schema.json`, `rooms/laboratory/tools/source-presets.json`
- **Description**: Create the project metadata contract for project identity, source type, acquisition mode, file paths, preview info, tool versions, and acquisition status.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Project metadata covers `video`, `audio`, and `image`
  - Video metadata supports `youtube`, `local`, and `url`
  - Download preset + custom form state can be serialized without referencing global app settings
- **Validation**:
  - Manual schema review
  - Regression test asserts required room-local tool/config files exist

### Task 1.2: Define the room command/event envelope
- **Location**: `rooms/laboratory/tools/project-schema.json`, `rooms/laboratory/tools/source-presets.json`, `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Define the request/response envelope used between room UI and host for source-stage actions: `requestId`, `jobId`, action type, status, progress payload, stale-response guards, and cancellation semantics.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Every mutating source-stage action has a correlation shape
  - Long-running jobs can emit progress without crossing responses between requests
  - Project-switch and cancellation behavior is explicitly defined
- **Validation**:
  - Manual envelope review
  - Regression or smoke test for overlapping actions using correlated responses

### Task 1.3: Define the minimal generic room-tool seam
- **Location**: `electron/handlers/ipc-room-tools.ts`, `electron/main.ts`, `electron/preload.cjs`, `src/js/global.d.ts`, `src/types/ipc-channels.ts`
- **Description**: Add a generic IPC surface for room-managed tools: probe, install, update-check, update, run, and progress events. Keep the API room-agnostic and aligned with the typed IPC contract map.
- **Complexity**: 8
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - API shape does not mention `laboratory`, `yt-dlp`, or `ffmpeg`
  - API can execute a room-requested tool action and stream structured progress
  - API can be called from room host logic through the renderer preload
  - Typed IPC definitions stay in sync with the new handler surface
- **Validation**:
  - Unit/regression test for handler registration and result shape
  - Manual dry-run probe from a renderer path

### Task 1.4: Add room-local host state helpers
- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Refactor the host into explicit helpers for active project, tool status, acquisition jobs, and UI notifications while preserving existing context sync.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Host can save/load project metadata under `data/room-storage/laboratory`
  - Host can notify the room UI with structured events instead of dummy-only messages
  - Existing `host-context` flow still works
- **Validation**:
  - Targeted host regression assertions
  - Manual state reload sanity check

## Sprint 2: Rebuild The Source Stage UI
**Goal**: Replace the dummy source pane with a real project-first UI while keeping the rest of the room visually stable.
**Demo/Validation**:
- Source stage renders project management, compact stage rail, settings action, and source-mode-specific forms
- The top dummy eyebrow/chips are removed
- The stage rail becomes more compact and single-line

### Task 2.1: Simplify the stage rail and top copy
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Remove the top `Obsidian Laboratory` labels and extra chips, move stages to the top, shrink stage pills/nav controls to single-line compact height, and add a settings icon button at the far right.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - The eyebrow above the stage rail is removed
  - The eyebrow above `Prepare the analysis source` is removed
  - Stage pills and transitions are visibly smaller and remain readable on one line
  - A settings trigger exists at the far right of the rail
- **Validation**:
  - Visual smoke check in desktop and narrow widths
  - Regression test for updated source-stage UI markers

### Task 2.2: Add project management panel
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Create the right-panel top section for `new project`, `continue project`, `delete project`, and active project summary.
- **Complexity**: 6
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - The right panel starts with project management
  - New project action auto-generates name and slug
  - Existing projects can be selected and reopened
  - Delete project is explicit and guarded
- **Validation**:
  - Manual project create/open/delete cycle
  - Regression test for project panel markup/state rendering

### Task 2.3: Add source-type specific intake forms
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Build three distinct right-panel intake UIs based on source type, with video mode segmented into `youtube`, `local`, and `url`.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `video` shows mutually exclusive `youtube/local/url`
  - `audio` shows `local/url`
  - `image` shows `local/url`
  - The UI only exposes controls relevant to the selected source type/mode
- **Validation**:
  - Manual mode-switching verification
  - State snapshot test or string-based UI regression

### Task 2.4: Add source preview/player and source summary merge
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Replace the static preview card with media-aware preview rendering. Display player controls and the same source summary information inside the central preview area.
- **Complexity**: 7
- **Dependencies**: Task 2.3, Task 4.6
- **Acceptance Criteria**:
  - Image preview renders as still image
  - Audio preview renders native audio controls
  - Video preview renders native video controls
  - Preview area includes key source info shown by the summary
- **Validation**:
  - Manual preview for one image, one audio file, one video file
  - No preview is shown until the source exists in the project folder

### Task 2.5: Add source-stage settings overlay
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Implement a room-local overlay/modal opened from the new settings icon. The overlay exposes yt-dlp and ffmpeg doctor/install/update actions and status rows.
- **Complexity**: 6
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Settings overlay opens/closes without leaving the room page
  - Tool status shows installed/missing/version/update state
  - Install/update actions show progress and end state
- **Validation**:
  - Manual overlay open/close flow
  - Manual missing-tool and installed-tool scenarios

## Sprint 3: Room-Managed Toolchain
**Goal**: Make yt-dlp and ffmpeg real dependencies of the room with install/probe/update behavior.
**Demo/Validation**:
- The room can tell whether yt-dlp and ffmpeg exist
- Missing tools can be installed from the settings overlay
- Update status and update action work without touching global assistant settings

### Task 3.1: Add room-local tool manifests and platform mapping
- **Location**: `rooms/laboratory/tools/toolchain.manifest.json`, `rooms/laboratory/tools/yt-dlp.form.json`, `rooms/laboratory/tools/ffmpeg.manifest.json`
- **Description**: Store room-specific tool descriptors, download URLs/templates, checksum slots, version parse rules, and custom-form definitions inside the room package.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Room manifests describe both yt-dlp and ffmpeg
  - Manifest format is portable and does not hardcode machine-specific paths
  - Custom form fields needed by YouTube advanced settings are enumerated here or in a sibling config
  - Export/import policy for runtime-downloaded binaries and tool-state is documented alongside the manifests
- **Validation**:
  - Manual manifest review
  - Regression test asserts manifest presence and basic parseability

### Task 3.2: Implement tool probe/install/update service
- **Location**: `electron/room-tool-service.ts`, `electron/handlers/ipc-room-tools.ts`, `electron/main.ts`
- **Description**: Build the generic service that resolves room-local tool manifests, downloads binaries to the installed room's `tools` root, checks versions, checks latest release metadata, and runs updates.
- **Complexity**: 9
- **Dependencies**: Task 1.2, Task 3.1
- **Acceptance Criteria**:
  - Service supports `probe`, `install`, `checkForUpdates`, `update`
  - Runtime tool root is room-scoped and export-friendly, not app-global
  - Version parsing supports `--version` probes for both tools
  - Service reports structured progress/events for UI consumption
- **Validation**:
  - Regression tests for probe result normalization
  - Manual install into an empty tool directory
  - Manual update check against a known installed binary

### Task 3.3: Persist room-local tool state without using global assistant settings
- **Location**: `rooms/laboratory/host/index.js`, `data/rooms/laboratory/tools/.tool-state.json` (runtime output)
- **Description**: Store last-known tool versions, relative install paths, and update timestamps in room-local tool state instead of `AppSettings`.
- **Complexity**: 5
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Room tool state survives reloads
  - Removing the installed room tool directory or reinstalling the room can reset tool metadata cleanly
  - No `assistants.opencode`-style global settings branch is introduced for laboratory
  - Tool state avoids absolute machine-specific paths where possible so export/import remains sane
- **Validation**:
  - Manual reload test
  - Metadata file inspection

## Sprint 4: Real Source Acquisition
**Goal**: Make local copy, URL download, and YouTube download produce project-owned files plus metadata.
**Demo/Validation**:
- A new project can ingest one local file
- A direct URL can download into the project folder
- A YouTube URL can download into the project folder when yt-dlp is available

### Task 4.1: Implement project lifecycle and directory creation
- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Create automatic project slugs, create the project directory structure, store `project.json`, and list/delete/open projects.
- **Complexity**: 6
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - New project creates a directory under `data/room-storage/laboratory/projects`
  - Delete removes project metadata and owned source files for that project only
  - Open existing project restores its source-stage state
- **Validation**:
  - Manual create/open/delete cycle
  - Regression test for project list persistence
  - Smoke check for switching projects during an unfinished source-stage request

### Task 4.2: Implement local-file acquisition
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`
- **Description**: Use file dialog from host-side orchestration, copy the chosen file into the active project `source` folder, and update project metadata.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Local selection is disabled until a project exists
  - Selected file is copied into the project directory
  - Preview always points to the project-owned copy, not the original path
- **Validation**:
  - Manual local image/audio/video copy flows
  - Path inspection inside the project folder

### Task 4.3: Implement direct URL acquisition
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/source-presets.json`
- **Description**: Download a remote media URL into the active project folder, validate result type, and record final path + metadata for preview.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - URL download does not preview until the file is fully saved
  - Failed downloads surface clear error states in the room UI
  - Metadata points to the saved project file
- **Validation**:
  - Manual URL download test
  - Error-path test with an invalid URL

### Task 4.4: Implement YouTube presets and gated custom form
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/tools/yt-dlp.form.json`
- **Description**: Add `lowest`, `medium`, `best`, and `custom` presets. Disable the YouTube option when yt-dlp is unavailable. Reveal the advanced form only for `custom`.
- **Complexity**: 6
- **Dependencies**: Task 2.3, Task 3.2
- **Acceptance Criteria**:
  - YouTube mode is visibly disabled when yt-dlp is missing
  - Presets map to deterministic command-building inputs
  - Custom mode reveals a structured advanced form instead of freeform args
- **Validation**:
  - Manual preset switching
  - Manual disabled-state verification

### Task 4.5: Implement yt-dlp download execution
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/tools/yt-dlp-command-map.json`, `electron/room-tool-service.ts`
- **Description**: Convert preset/custom form state into a safe yt-dlp invocation, download into the active project folder, and emit progress back to the UI.
- **Complexity**: 9
- **Dependencies**: Task 4.1, Task 3.2, Task 4.4
- **Acceptance Criteria**:
  - Downloads land in the project `source` folder
  - Output naming is deterministic and project-safe
  - Progress, completion, and failure states stream back to the room
  - No raw shell string concatenation is required for user input fields
  - Correlated progress events remain tied to the active request/job
- **Validation**:
  - Manual YouTube download with a short test URL
  - Failure test for unsupported/broken input

### Task 4.6: Extract media metadata and preview contract
- **Location**: `rooms/laboratory/host/index.js`, `electron/room-tool-service.ts`
- **Description**: Use ffprobe or equivalent ffmpeg tooling to collect duration, resolution, codec, and format details for the saved project source.
- **Complexity**: 7
- **Dependencies**: Task 4.1, Task 3.2, Task 4.2 or Task 4.3 or Task 4.5
- **Acceptance Criteria**:
  - Video metadata includes duration, resolution, codec
  - Audio metadata includes duration and codec/bitrate where available
  - Image metadata includes dimensions and mime/format where available
- **Validation**:
  - Manual metadata comparison against known sample files
  - Metadata shows up in both summary and preview panel

## Sprint 5: Polish, Regression Safety, And Room Portability
**Goal**: Make the source-stage implementation stable enough to demo, export, and continue later.
**Demo/Validation**:
- Room remains installable/exportable
- Source stage survives reloads and project reopen
- Tests cover the new source contract

### Task 5.1: Update room regressions for the new source contract
- **Location**: `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`
- **Description**: Replace dummy-specific assertions with source-stage contract checks: project panel, settings trigger, source mode selectors, and host capabilities.
- **Complexity**: 5
- **Dependencies**: Sprint 2, Sprint 4
- **Acceptance Criteria**:
  - Tests no longer assert dummy download-only UI
  - Tests assert room package files required by the real source stage
  - Tests stay scoped to the source phase
- **Validation**:
  - Run the targeted regression test file

### Task 5.2: Add generic room-tool seam regressions
- **Location**: `scripts/tests/room-tool-service-regressions.test.ts`
- **Description**: Cover generic handler registration, result normalization, room tool root resolution, and update/probe edge cases.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Tests verify the seam stays room-agnostic
  - Tests cover missing manifest, bad version output, and missing binary states
  - Tests cover the typed IPC contract shape
  - Tests cover correlated progress/result routing for overlapping jobs
- **Validation**:
  - Run the new regression test file

### Task 5.3: Add portability regression for export/import behavior
- **Location**: `scripts/tests/laboratory-media-source-portability-regressions.test.ts`
- **Description**: Verify the room's export/import or reinstall behavior matches the chosen tool export policy so runtime binaries/tool-state do not silently become cross-platform authoritative artifacts.
- **Complexity**: 5
- **Dependencies**: Sprint 3, Sprint 4
- **Acceptance Criteria**:
  - Export/import behavior for runtime-downloaded binaries is explicit and tested
  - Reinstall/export does not leave the room in an ambiguous tool-state
  - The room can re-probe/re-bootstrap tools after import as designed
- **Validation**:
  - Run the portability regression test file

### Task 5.4: Add manual smoke checklist for the feature
- **Location**: `.rovo/laboratory-media-source-smoke.md`
- **Description**: Document the minimum manual validation path for local, URL, and YouTube acquisition plus tool install/update.
- **Complexity**: 3
- **Dependencies**: All prior sprints
- **Acceptance Criteria**:
  - Checklist covers missing-tool and installed-tool paths
  - Checklist covers project resume and delete flows
  - Checklist stays source-stage-only
- **Validation**:
  - Manual checklist dry run

## Testing Strategy
- Mandatory:
  - `npm run typecheck`
  - `node --test scripts/tests/laboratory-media-analysis-room-regressions.test.ts`
  - `node --test scripts/tests/room-tool-service-regressions.test.ts`
  - `node --test scripts/tests/laboratory-media-source-portability-regressions.test.ts`
- Manual smoke:
  - Create auto-named project
  - Ingest local image and preview it
  - Ingest local audio and preview it
  - Ingest local video and preview it
  - Download a direct media URL into the project and preview it
  - Verify YouTube mode is disabled when yt-dlp is missing
  - Install yt-dlp and ffmpeg from the settings overlay
  - Run one YouTube download using a preset
  - Trigger two overlapping source actions and verify correlated progress/results do not cross
  - Open the same project after reload and verify restored preview/info
  - Export or reinstall the room and verify tool behavior matches the export policy
  - Delete the project and confirm cleanup

## Potential Risks & Gotchas
- The current room webview has only `roomAPI`, so native process access must remain in the host/shared seam.
- Keep the authoritative writable binary root under the installed room package's `tools` directory, not the workspace checkout, so export/import can carry the room-local tool layout forward.
- Previewing by original source path would break portability and cleanup; always preview the copied/downloaded project-owned file.
- ffmpeg distribution is platform-specific and FFmpeg upstream only links to compiled builds from third parties, so the manifest must isolate provider selection per platform.
- yt-dlp standalone binaries support self-update, but some packaged variants do not; the plan should prefer standalone builds that support the intended update flow.
- A large YouTube advanced form can turn into raw flag soup; keep the first version curated to the options the source stage actually needs.
- URL downloads can return HTML or unsupported content; validate saved mime/extension before declaring the source ready.
- Fire-and-forget room messaging is not enough for this feature by itself; correlated request/job envelopes are required to avoid stale UI updates.
- Project deletion must remove only room-owned files, never the user's original local source.
- Because non-source stages remain dummy, avoid leaking real source-state assumptions into `edit/profile/process/report`.

## Rollback Plan
- Revert the generic room-tool seam files if they destabilize the shell
- Restore the previous laboratory room package from git if source-stage UI/host changes regress room loading
- Keep project data isolated under `data/room-storage/laboratory` so test artifacts can be deleted without touching other rooms
- If binary management proves unstable on one platform, disable install/update actions in the room settings overlay while preserving local-file acquisition

## Research Notes
- yt-dlp README documents standalone release binaries, `yt-dlp -U`, and `--update-to`; it also recommends `ffmpeg` and `ffprobe` alongside yt-dlp: https://github.com/yt-dlp/yt-dlp
- FFmpeg's official download page explicitly points users to compiled third-party builds rather than shipping official binaries directly: https://ffmpeg.org/download.html
