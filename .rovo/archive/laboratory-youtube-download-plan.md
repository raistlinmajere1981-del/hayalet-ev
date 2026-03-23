# Plan: Laboratory YouTube Download Support

**Generated**: 2026-03-22
**Estimated Complexity**: High

## Overview

- Add a third Laboratory source path for YouTube URLs that downloads media into the existing workspace model, then reuses the current probe, preview, analysis, and history pipeline.
- Keep the room UI simple: a dedicated YouTube input/action in the Laboratory intake card, with source preparation progress shown before analysis starts.
- Treat `yt-dlp` as a host dependency for MVP rather than bundling a new downloader runtime into the app.
- Avoid broad scope creep in V1: single-video URL support only, no playlists, no account cookies, no resume queue, no background batch ingestion.

## Assumptions

- MVP accepts a single YouTube watch/share URL and prepares one downloadable media file for analysis.
- Download itself may use the network, but analysis remains fully local.
- MVP uses the system `yt-dlp` binary and fails with a clear error if it is unavailable.
- The prepared source stored in Laboratory history remains the downloaded media file, not the original remote URL stream.
- Playlist/channel URLs, login-gated videos, subtitles, thumbnails, and audio-only workflows remain out of scope unless explicitly expanded.

## Prerequisites

- Host binaries: `yt-dlp`, `ffmpeg`, `ffprobe`
- Existing Laboratory room package at `rooms/laboratory`
- Existing Electron Laboratory stack:
  `electron/laboratory/source-resolver.ts`,
  `electron/laboratory/media-preview.ts`,
  `electron/laboratory/history-store.ts`,
  `electron/handlers/ipc-laboratory-video-analysis.ts`

## Sprint 1: Contracts And UX Surface

**Goal**: The room, shared types, and bridge contracts recognize YouTube as a real source path instead of a placeholder.

**Demo/Validation**:

- Laboratory intake shows a usable YouTube field/button.
- UI/host/IPC contracts accept YouTube source payloads without fallback hacks.
- Existing local-file and direct-URL flows still render and behave normally.

### Task 1.1: Promote YouTube From Placeholder To Source Contract

- **Location**:
  `src/types/laboratory.ts`,
  `src/types/index.ts`,
  `src/js/global.d.ts`
- **Description**:
  Replace the placeholder-only contract with a real YouTube source kind and, if needed, add source metadata fields for acquisition details such as canonical page URL and downloader metadata.
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LaboratorySourceKind` includes a real YouTube kind used end-to-end.
  - `LaboratorySourceResolveInput` accepts a YouTube URL payload.
  - Shared typings do not require `any`-style escape hatches.
- **Validation**:
  - `npm run typecheck`

### Task 1.2: Add Room UI Controls For YouTube Intake

- **Location**:
  `rooms/laboratory/ui/index.js`,
  `rooms/laboratory/i18n/en.json`,
  `rooms/laboratory/i18n/tr.json`
- **Description**:
  Replace the passive “coming soon” pill with a dedicated input and action for YouTube preparation while preserving the existing local-file and direct-URL paths.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - User can paste a YouTube URL and trigger source preparation.
  - Source-kind labels and helper copy distinguish local file, direct URL, and YouTube.
  - Empty/error/loading states remain readable in both locales.
- **Validation**:
  - `node --test scripts/tests/laboratory-room-regressions.test.ts`

### Task 1.3: Extend Host Action Routing For Download Preparation

- **Location**:
  `rooms/laboratory/host/index.js`
- **Description**:
  Add a new host action for YouTube source preparation and make source-preparation progress text explicit enough for a long-running download flow.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Host recognizes a dedicated YouTube submit action.
  - Host keeps state coherent when switching between transient sources.
  - Preparation failures surface clear user-facing errors.
- **Validation**:
  - Add/update host regression coverage

## Sprint 2: Electron Download Adapter

**Goal**: Electron can turn a valid YouTube URL into a workspace-local media file and hand it to the existing Laboratory pipeline.

**Demo/Validation**:

- A valid YouTube URL resolves to a prepared Laboratory source.
- Missing `yt-dlp`, invalid URL, and unsupported URL shapes fail safely.
- The resulting source opens preview and can start the current analysis flow.

### Task 2.1: Add A YouTube Resolver Adapter

- **Location**:
  `electron/laboratory/source-resolver.ts`
  or split into
  `electron/laboratory/source-resolvers/youtube.ts`
- **Description**:
  Implement a dedicated `yt-dlp`-backed adapter that validates the URL, downloads one media file into the workspace source directory, and returns the same normalized payload shape as existing resolvers.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Adapter rejects empty, malformed, and clearly unsupported YouTube inputs.
  - Adapter saves one stable working media file inside the workspace.
  - Resolver returns the existing `LaboratorySourceDescriptor` contract after probe/preview generation.
- **Validation**:
  - Targeted resolver tests with mocked `yt-dlp` process output

### Task 2.2: Stop Treating Source Preparation As A Black Box

- **Location**:
  `electron/handlers/ipc-laboratory-video-analysis.ts`,
  `rooms/laboratory/host/index.js`,
  optionally `src/types/laboratory.ts`
- **Description**:
  Introduce a source-preparation progress model suitable for longer downloads, instead of the current single invoke-and-wait pattern.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Host receives incremental preparation progress for YouTube downloads.
  - UI can show states such as validating, downloading, probing, and preview generation.
  - Existing local-file/direct-URL paths still work through the same contract.
- **Validation**:
  - Contract-focused regression test for progress payload shape

### Task 2.3: Harden Downloader Process Management

- **Location**:
  `electron/laboratory/source-resolver.ts`,
  shared helper module if extracted
- **Description**:
  Manage `yt-dlp` as a child process with cancellation-safe teardown, bounded output parsing, and deterministic output naming.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Child process errors become user-readable messages.
  - Partial downloads are cleaned when preparation fails.
  - Output naming is sanitized before workspace persistence.
- **Validation**:
  - Targeted unit/regression tests for success, failure, cancel, and cleanup paths

## Sprint 3: Validation, Packaging Notes, And Regression Coverage

**Goal**: The new path is supportable in development and packaged builds, with explicit constraints and regression protection.

**Demo/Validation**:

- Typecheck and Laboratory regressions pass.
- Packaging docs mention the new host dependency clearly.
- Smoke checklist exists for local/manual verification.

### Task 3.1: Add Resolver And IPC Regression Coverage

- **Location**:
  new targeted tests under `scripts/tests/`,
  existing `scripts/tests/laboratory-room-regressions.test.ts`
- **Description**:
  Add tests for source-kind acceptance, host action routing, YouTube resolver failure modes, and IPC contract validation.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Tests fail if YouTube source kind is removed or IPC stops accepting it.
  - Tests cover missing `yt-dlp`, invalid URL, mocked successful download, and cleanup on failure.
- **Validation**:
  - `node --test scripts/tests/laboratory-room-regressions.test.ts`
  - new targeted Laboratory test files

### Task 3.2: Update Packaging And Operator Documentation

- **Location**:
  `PACKAGING.md`,
  optional Laboratory docs/archive notes
- **Description**:
  Document `yt-dlp` as a host/runtime prerequisite for this feature and describe expected fallback behavior when it is absent.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Packaging notes no longer mention only `ffmpeg` for video-analysis prerequisites.
  - Operators know YouTube download support depends on `yt-dlp` being present on the host.
- **Validation**:
  - Manual docs review

### Task 3.3: Run End-To-End Smoke Validation

- **Location**:
  Manual smoke checklist and any lightweight scripted helpers if needed
- **Description**:
  Verify the real integration with a short public YouTube clip and at least one expected-failure case.
- **Dependencies**: Sprint 3 complete
- **Acceptance Criteria**:
  - Successful prepare -> preview -> analysis flow works for one public clip.
  - Failure messaging is clean for invalid URL and missing binary scenarios.
  - Existing local-file and direct-URL flows still work after the new feature lands.
- **Validation**:
  - `npm run typecheck`
  - targeted `node --test ...`
  - manual Laboratory smoke test

## Testing Strategy

- Prefer mocked process tests for `yt-dlp` instead of network-dependent CI fixtures.
- Keep one manual smoke case with a short public video to validate real downloader behavior.
- Re-run existing Laboratory room regressions to catch UI/host contract drift.
- Re-run typecheck after shared-type and preload/IPC changes.

## Potential Risks & Gotchas

- Current source preparation is not progress-aware enough for long downloads; if we skip this, UX will look frozen.
- `direct-url` currently buffers the full response in memory; YouTube must not copy that pattern.
- Packaged builds may behave differently if `yt-dlp` is missing from the host PATH.
- `yt-dlp` can produce format/container combinations that require preview transcoding; preview generation should stay in the existing `ffmpeg` path.
- Some YouTube URLs may resolve to playlists or unsupported restricted content; MVP should reject these clearly instead of guessing.

## Rollback Plan

- Remove the YouTube source kind from shared types and host/UI actions.
- Remove the downloader adapter and restore the existing two-source resolver logic.
- Revert packaging/documentation updates related to `yt-dlp`.
- Keep the rest of the Laboratory analysis pipeline unchanged.
