# Plan: Laboratory Room Video Analysis

**Generated**: 2026-03-22
**Estimated Complexity**: High

## Overview
- Add a new dynamic room package at `rooms/laboratory` using the existing room lifecycle (`rooms/*` workspace -> install -> `data/rooms/*` -> `config/rooms.json` -> `RoomRegistry`).
- Ship the first room feature as `video-analysis`, focused on fully local media forensics with a simple user report and a machine-readable technical report.
- Keep the room webview UI simple; use the room host as the control plane and Electron IPC/services for file dialogs, media acquisition, temp files, job orchestration, and heavy compute.
- Support `local file` and `direct media URL` in V1; keep `YouTube` visible in the UI as a disabled or "coming soon" acquisition path rather than a day-one download capability.
- Build the analyzer pipeline behind adapter interfaces so `metadata`, `motion`, `visual`, and `audio` analyzers remain modular and future laboratory functions (subtitle, voice, multimodal, etc.) can reuse the same execution/reporting stack.
- Optimize for low-end systems by sampling frames, capping concurrency, streaming detailed progress, supporting cancellation, and making advanced analyzers optional.

## Research Notes
- Rooms are already dynamic packages. A new room with valid `manifest.json`, runtime files, and scene metadata should appear without hardcoded navigation changes.
- The rooms corridor is manifest-driven. `scene.roomsHotspot` is enough for a new doorway/hotspot on the `rooms` page.
- The room webview only exposes `window.roomAPI`; it does not expose the full `window.electronAPI`. That means OS/file/network/process access should stay in the room host and Electron IPC, not the webview runtime UI.
- Current local environment already has `ffmpeg 6.1.1`, `ffprobe 6.1.1`, and `yt-dlp 2024.04.09`, but Python analyzer packages (`cv2`, `librosa`, `scenedetect`) are not installed.
- The provided room assets already exist in the repo as `rooms/laboratory_room_background.webp` and `rooms/laboratory_video_analyze_view.webp`, but they are not yet inside a canonical room package directory.

## Assumptions
- "Offline" means the analysis itself is fully local and does not call any cloud API/service. Media download/acquisition may still use the user's own network connection.
- V1 does not require Python-backed analyzers to run. Python/OpenCV/Librosa/PySceneDetect stay optional adapters behind stable analyzer interfaces.
- V1 supports local files and direct media URLs. YouTube download is explicitly deferred, but the UI should reserve space for it.
- V1 technical output is shown locally in a readable detail view and can be copied as JSON; it is not automatically sent to AI slots.
- Each completed analysis gets its own workspace folder under the Laboratory room data directory, containing a copied working source file plus its reports, selections, metadata, and analyzer artifacts. In-progress jobs do not need resume support in V1.

## Prerequisites
- Required local binaries: `ffmpeg`, `ffprobe`
- Optional future local binary: `yt-dlp` for a later YouTube adapter
- Optional future runtime: Python 3 + `opencv-python` / `librosa` / `PySceneDetect`
- Small fixture set of clean and tampered sample videos for deterministic tests
- Room-private mutable data path for per-analysis workspaces, copied source media, cached source metadata, reports, and temporary working files

## Out Of Scope For MVP
- Cloud/API-backed classification
- Full subtitle/ASR/media-transcript analysis
- Batch processing multiple videos in one job
- Legal/proof-style certainty claims about forgery
- Mandatory Python/OpenCV dependency on first release
- Day-one YouTube download support

## Sprint 1: Room Skeleton And Contracts
**Goal**: `laboratory` exists as a valid installable room and opens a stub runtime with the intended feature shell.
**Demo/Validation**:
- Install `laboratory` from the Settings > Rooms overlay and restart the app.
- Open Laboratory from the Rooms page and see the new room background + close-up asset with placeholder controls.
- Confirm the manifest validates and packaging tests pass.

### Task 1.1: Create The Laboratory Room Package
- **Location**: `rooms/laboratory/manifest.json`, `rooms/laboratory/assets/room-background.webp`, `rooms/laboratory/assets/video-analysis-view.webp`, `rooms/laboratory/ui/index.html`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`, `rooms/laboratory/host/index.js`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Build the room from the existing `game-room` package pattern, move/copy the provided assets into the canonical package structure, define `defaultFeatureId: "video-analysis"`, set `storageNamespace`, add feature `commandSpecs`, keep `protocolSpecs` empty unless V1 AI handoff is explicitly required, and stub the runtime UI/host handshake.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - Workspace room is discoverable through the existing room overlay.
  - Manifest is valid and references only safe relative paths.
  - The room opens in both classic and scene-driven flows.
- **Validation**:
  - `node --test scripts/tests/laboratory-room-regressions.test.ts`
  - Manual install/open smoke test

### Task 1.2: Define Room-Scoped Video Analysis Types
- **Location**: `src/types/laboratory.ts`, `src/types/index.ts`
- **Description**: Define shared contracts for source descriptors, analysis modes, time range and ROI selection, job status/progress, analyzer output, persisted history entries, user report, readable technical report sections, and technical JSON export.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Room host, runtime UI, and Electron services can share a single typed data model.
  - Report sections and evidence structures are explicit rather than ad-hoc objects.
- **Validation**:
  - `npm run typecheck`

### Task 1.3: Define Bridge Message Contracts And Versioning
- **Location**: `src/types/laboratory.ts`, `rooms/laboratory/host/index.js`, `rooms/laboratory/ui/index.js`, `electron/handlers/ipc-laboratory-video-analysis.ts`
- **Description**: Define explicit payload contracts and message names across `Electron <-> renderer host <-> room webview`, including `host-context`, `laboratory-state`, `analysis-progress`, `analysis-complete`, `history-loaded`, and `command-result`, plus a versioning rule for future schema changes.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Message boundaries across the three layers are documented and stable.
  - Host/UI payload drift is detectable during implementation and tests.
- **Validation**:
  - `npm run typecheck`
  - Contract-focused regression test coverage

### Task 1.4: Add Room Contract Regression Coverage
- **Location**: `scripts/tests/laboratory-room-regressions.test.ts`
- **Description**: Add file-presence and manifest validation tests similar to the existing `game-room` coverage, including required assets, i18n files, and runtime entries.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Tests fail when the room package is incomplete or invalid.
  - The room contract is verified before packaging/install attempts.
- **Validation**:
  - `node --test scripts/tests/laboratory-room-regressions.test.ts`

## Sprint 2: Ingestion And Execution Backbone
**Goal**: The host can resolve a source, create a job, and hand heavy work off to Electron without blocking the UI.
**Demo/Validation**:
- The room can pick a local file or accept a direct URL and return normalized media metadata.
- The user can start/cancel a job and see progress updates without freezing the room page.
- Completed reports remain viewable from history after app restart.

### Task 2.1: Add A Mutable Room Data Directory Helper
- **Location**: `electron/paths.ts`
- **Description**: Add a helper for room-private mutable data such as per-analysis workspace folders, copied source media, temp downloads, extracted frames, intermediate analyzer outputs, and final reports. Keep this separate from the installed room bundle under `data/rooms/<roomId>`.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - No analysis output is written into the installed room package directory.
  - Each analysis receives a stable workspace path under the Laboratory data directory.
  - Temp, report, and media-cache paths are stable and discoverable.
- **Validation**:
  - Targeted path helper assertions in a new or existing Electron path regression test

### Task 2.2: Implement Laboratory IPC Handlers And Progress Channel
- **Location**: `electron/handlers/ipc-laboratory-video-analysis.ts`, `electron/main.ts`, `electron/preload.cjs`, `src/js/global.d.ts`
- **Description**: Add Electron invoke handlers for source resolution, analysis start, progress subscription, cancel, report fetch, history load, and cleanup. Reuse the provider progress pattern for long-running job updates.
- **Complexity**: 7
- **Dependencies**: Task 1.2, Task 2.1
- **Acceptance Criteria**:
  - Long-running work is owned by Electron/Node rather than the room UI thread.
  - Progress, completion, and cancellation are observable from the renderer.
  - History retrieval works without reopening the original source.
- **Validation**:
  - `node --test scripts/tests/laboratory-video-analysis-ipc-regressions.test.ts`
  - `npm run typecheck`

### Task 2.3: Build Source Resolver Adapters For V1
- **Location**: `electron/laboratory/source-resolver.ts`, `electron/laboratory/source-resolvers/local-file.ts`, `electron/laboratory/source-resolvers/direct-url.ts`
- **Description**: Normalize two acquisition paths for MVP: local file and direct `http(s)` media URL. Reuse the existing "block unsupported protocol / localhost / local address" validation pattern before any remote fetch, then copy the resolved working media into that analysis workspace before preview/analysis. Keep the resolver architecture ready for a later YouTube adapter without implementing it in V1.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - The resolver always returns a workspace-local working media path plus provenance metadata.
  - Unsupported protocols and local/private addresses are rejected.
- **Validation**:
  - Fixture-based tests covering local files, invalid URLs, localhost/private IP rejection, and direct URL success

### Task 2.4: Add Worker-Backed Job Runner
- **Location**: `electron/laboratory/job-runner.ts`, `electron/laboratory/analysis-worker.ts`, `electron/handlers/ipc-laboratory-video-analysis.ts`
- **Description**: Move heavy analysis execution into a worker-backed job runner so ffmpeg probing, frame extraction, and analyzer orchestration do not block the Electron main thread. Include cancellation, progress relays, and bounded concurrency.
- **Complexity**: 8
- **Dependencies**: Task 2.2, Task 2.3
- **Acceptance Criteria**:
  - Heavy analysis runs outside the UI-critical thread.
  - Progress and cancellation propagate cleanly from worker to renderer.
- **Validation**:
  - Worker lifecycle and cancellation regression tests
  - Manual start/cancel smoke test

### Task 2.5: Add Media Preview Normalization Service
- **Location**: `electron/laboratory/media-preview.ts`, `electron/laboratory/source-resolver.ts`
- **Description**: Add a preview compatibility step that inspects the source and, when needed, generates a preview-safe derivative so the room UI can render the video reliably and ROI coordinates remain stable.
- **Complexity**: 6
- **Dependencies**: Task 2.3, Task 2.4
- **Acceptance Criteria**:
  - Common preview-incompatible sources still open in the room.
  - Preview dimensions and ROI mapping are stable after normalization.
- **Validation**:
  - Fixture-based preview compatibility tests
  - Manual ROI selection smoke test on normalized media

### Task 2.6: Turn The Room Host Into The Laboratory Control Plane
- **Location**: `rooms/laboratory/host/index.js`
- **Description**: Translate room UI commands into file dialog actions, source resolution calls, analysis start/cancel, history persistence, media-cache cleanup actions, and room-state notifications back to the webview runtime.
- **Complexity**: 6
- **Dependencies**: Task 1.1, Task 1.3, Task 2.2, Task 2.3, Task 2.4, Task 2.5
- **Acceptance Criteria**:
  - The room UI never calls OS APIs directly.
  - Host state transitions are explicit and serializable.
  - Completed analysis history is restored after restart.
  - In-progress job resume is not required.
  - Media cache cleanup can run without breaking already-saved report viewing.
- **Validation**:
  - Host state transition regression test
  - Manual source-pick, history reload, and cancel smoke test

### Task 2.7: Persist Laboratory History
- **Location**: `electron/laboratory/history-store.ts`, `electron/paths.ts`, `rooms/laboratory/host/index.js`
- **Description**: Save each completed analysis into its own workspace folder, including copied source provenance, selected time range, ROI, mode, summarized evidence, readable technical detail payload, copyable JSON payload, and any retained analyzer artifacts. Separate durable report data from removable media-cache files so report viewing survives cleanup.
- **Complexity**: 6
- **Dependencies**: Task 2.1, Task 2.2, Task 2.6
- **Acceptance Criteria**:
  - Completed results are viewable after restart.
  - History entries contain enough detail to re-open reports without recomputing analysis.
  - Cleaning media cache does not delete the structured report/history payload.
- **Validation**:
  - History persistence regression tests
  - Manual restart/reopen smoke test

## Sprint 3: Analyzer Pipeline MVP
**Goal**: A sampled offline pipeline produces both a technical JSON report and a simplified user summary.
**Demo/Validation**:
- Run a small MP4 fixture in `balanced` mode and get all four analyzer sections plus an overall risk score.
- Verify deep mode increases sample density without changing the UI contract.

### Task 3.1: Define Analyzer Plugin And Orchestration Contracts
- **Location**: `electron/laboratory/pipeline/index.ts`, `electron/laboratory/pipeline/types.ts`, `electron/laboratory/pipeline/mode-profiles.ts`
- **Description**: Define analyzer interfaces, per-mode sampling profiles (`fast`, `balanced`, `deep`), capped concurrency, job-level cancellation, and shared evidence/output formats.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Analyzers can be enabled/disabled per mode without UI rewrites.
  - Job execution can stop cleanly on cancel or failure.
- **Validation**:
  - Orchestrator unit tests
  - `npm run typecheck`

### Task 3.2: Implement Metadata Analyzer
- **Location**: `electron/laboratory/analyzers/metadata-analyzer.ts`
- **Description**: Use `ffprobe` to collect container/codec/fps/bitrate/stream-map data and derive re-encode indicators, fps drift, and codec/container mismatch signals.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Metadata section includes both normalized verdict fields and raw evidence.
  - Missing audio/video streams are handled gracefully.
- **Validation**:
  - Fixture-driven unit tests on known-clean and re-encoded clips

### Task 3.3: Implement Motion Analyzer MVP
- **Location**: `electron/laboratory/analyzers/motion-analyzer.ts`
- **Description**: Sample frames/clips, measure frame-to-frame continuity and background/object motion consistency, and prepare the contract so a future OpenCV backend can plug in without changing the report format.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Analyzer returns suspicious intervals/evidence instead of a binary claim.
  - User ROI is honored when present.
- **Validation**:
  - Synthetic fixture with inserted motion/compositing anomaly

### Task 3.4: Implement Visual Analyzer MVP
- **Location**: `electron/laboratory/analyzers/visual-analyzer.ts`
- **Description**: Detect local edge halos, compression discontinuities, abrupt luminance changes, and related tamper signals on sampled frames/crops. Keep the implementation lightweight and adapter-ready.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Analyzer distinguishes local ROI anomalies from scene-wide compression artifacts.
  - Timestamped evidence can be surfaced in both reports.
- **Validation**:
  - Fixture-based tests using obvious compositing/compression anomalies

### Task 3.5: Implement Lightweight Audio Analyzer
- **Location**: `electron/laboratory/analyzers/audio-analyzer.ts`
- **Description**: Use `ffmpeg`/`ffprobe`-derived heuristics for amplitude/noise-floor/change-point detection first, leaving `librosa` as an optional future adapter.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Audio analyzer can report `no-audio`, `not-run`, and `unsupported` without failing the full job.
  - Sudden audio bed/noise-floor changes can be surfaced as evidence.
- **Validation**:
  - Fixture with abrupt audio discontinuity

### Task 3.6: Build Report Builder And Risk Calibration
- **Location**: `electron/laboratory/report-builder.ts`
- **Description**: Merge analyzer outputs into a canonical technical JSON report, a readable technical detail view model, and a simplified user report with clear wording and transparent evidence weighting.
- **Complexity**: 6
- **Dependencies**: Tasks 3.2, 3.3, 3.4, 3.5
- **Acceptance Criteria**:
  - User and technical reports are derived from the same canonical result.
  - Output wording clearly states "signal" or "risk" rather than "proof".
  - The technical payload is suitable for both readable UI rendering and JSON copy.
- **Validation**:
  - Snapshot tests for JSON report output and user summary text

## Sprint 4: Full Laboratory UX Flow
**Goal**: The user can complete the full room flow from source selection to report review.
**Demo/Validation**:
- Select a source, preview the video, choose a time range, select a rectangular region, choose a mode, start analysis, and inspect both report tabs.
- Cancel an in-progress job and see the UI recover cleanly.

### Task 4.1: Build Preview, Timeline, ROI, And Mode UI
- **Location**: `rooms/laboratory/ui/index.html`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/style.css`
- **Description**: Implement the source entry area, file CTA, direct URL input, YouTube placeholder CTA, preview player, time-range controls, ROI rectangle selection, mode picker, detailed progress panel, report tabs, history list, workspace-aware history details, media-cache cleanup affordances, and error/empty states.
- **Complexity**: 8
- **Dependencies**: Task 1.1, Task 2.4
- **Acceptance Criteria**:
  - The room supports the intended step-by-step user flow.
  - UI works in both classic and scene-view presentation.
  - Controls are usable on lower-resolution screens.
  - Default behavior without manual selection is full video + full frame analysis.
  - Users can distinguish between saved reports and removable cached media.
- **Validation**:
  - Manual room smoke test in desktop and narrow layouts
  - Optional DOM/state regression tests for key controls

### Task 4.2: Wire Host Messages Into Deterministic UI State
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Implement the bridge message types defined earlier and make runtime state deterministic after rerender/reopen. Include detailed progress phases such as source resolve, preview prep, probe, frame extraction, analyzer stages, report build, persistence, and complete.
- **Complexity**: 6
- **Dependencies**: Task 2.4, Task 3.6, Task 4.1
- **Acceptance Criteria**:
  - UI survives room reloads without entering inconsistent partial states.
  - Progress/error/result rendering remains stable under repeated host updates.
  - Progress UI explains both current phase and high-level completion state in a user-friendly way.
- **Validation**:
  - Simulated host-message regression tests

### Task 4.3: Add Export/Copy Actions For Reports
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Let the user copy the simplified summary and the technical JSON. Render the technical report in a readable structured view rather than raw JSON by default.
- **Complexity**: 4
- **Dependencies**: Task 3.6, Task 4.2
- **Acceptance Criteria**:
  - Technical JSON is machine-readable and sanitized.
  - User summary can be copied without raw debug noise.
  - Technical detail view is readable without requiring JSON literacy.
- **Validation**:
  - Manual copy/export smoke test
  - Unit test for export payload sanitization

### Task 4.4: Add History Workspace And Cache Management UX
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Let the user inspect each analysis workspace at a report level, show whether source/preview/cache media is still present, and trigger safe media-cache cleanup without deleting durable report/history data.
- **Complexity**: 4
- **Dependencies**: Task 2.7, Task 4.2
- **Acceptance Criteria**:
  - Each history entry exposes its workspace state in user-friendly terms.
  - Media cache cleanup is explicit and does not remove report readability.
  - Cleanup feedback appears in the same detailed progress/status system.
- **Validation**:
  - Manual history cleanup smoke test
  - Unit/regression coverage for workspace state rendering
### Task 4.5: Complete Room-Local I18n
- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/ui/index.js`
- **Description**: Move visible strings into room-local translations and keep only minimal bootstrap fallback copy inside the runtime JS.
- **Complexity**: 3
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Main user-facing copy is delivered from room-local i18n.
  - Bootstrap fallback is small and only covers pre-handshake loading states.
- **Validation**:
  - Manual locale switch smoke test
  - `AppI18n.getNamespaceCatalog(["rooms", "laboratory"])` payload check

## Sprint 5: Hardening, Fixtures, And Release Readiness
**Goal**: The MVP is testable, packageable, and safe to run on low-end hardware.
**Demo/Validation**:
- Package the room as `.hevroom.json`, import/install it, run a sample analysis, cancel a deep job, restart, and reopen the latest report.

### Task 5.1: Add Deterministic Video Fixtures And Golden Reports
- **Location**: `scripts/tests/fixtures/laboratory/**/*`, `scripts/tests/laboratory-video-analysis-pipeline-regressions.test.ts`
- **Description**: Add a tiny clean clip, a clearly tampered clip, and golden JSON expectations for analyzer/report stability.
- **Complexity**: 6
- **Dependencies**: Task 3.6
- **Acceptance Criteria**:
  - Core pipeline can be tested without live downloads.
  - Report snapshots catch scoring/schema drift.
- **Validation**:
  - `node --test scripts/tests/laboratory-video-analysis-pipeline-regressions.test.ts`

### Task 5.2: Add Performance Caps, Cleanup, And Failure Policy
- **Location**: `electron/laboratory/pipeline/index.ts`, `electron/laboratory/job-store.ts`, `electron/paths.ts`
- **Description**: Limit sample counts by mode, cap heavy analyzer concurrency, clean temp directories, define media-cache cleanup rules for per-analysis workspaces, avoid a hard video-duration ceiling, and define restart/cancel cleanup behavior.
- **Complexity**: 5
- **Dependencies**: Task 3.1, Task 4.2
- **Acceptance Criteria**:
  - Deep mode does not overwhelm 2-core systems.
  - Long videos remain analyzable through adaptive sampling rather than a hard reject.
  - Cancelled or failed jobs do not leak large temp directories.
  - Media-cache cleanup removes heavy copied/derived media while preserving durable reports and history metadata.
- **Validation**:
  - Manual profiling on small/medium clips
  - Cleanup regression tests

### Task 5.3: Cover Packaging And Install Lifecycle Regressions
- **Location**: `scripts/tests/room-bundle-import-regressions.test.ts`, `scripts/tests/room-package-manager-bootstrap-regressions.test.ts`, plus any new laboratory-specific room/package tests
- **Description**: Verify that Laboratory packages, imports, installs, and restarts cleanly through the existing room package manager lifecycle.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Bundle contains all room assets/runtime files.
  - Workspace/install/import failures produce actionable errors.
- **Validation**:
  - Targeted room package tests
  - `npm run typecheck`

### Task 5.4: Expand Existing Room Regression Matrix
- **Location**: `scripts/tests/rooms-scene-page-regressions.test.ts`, `scripts/tests/scene-debug-room-regressions.test.ts`, `scripts/tests/room-ui-regressions.test.ts`, plus any affected scene/debug tests
- **Description**: Extend existing shared room regressions so the new Laboratory room is covered in corridor routing, scene debug room discovery, and generated room page/nav markup behavior.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Adding Laboratory does not silently break shared room discovery or room page generation surfaces.
  - Scene/debug tooling recognizes the new room.
- **Validation**:
  - Targeted shared room regression runs
  - `npm run typecheck`

### Task 5.5: Add Minimal Developer Documentation
- **Location**: `rooms/laboratory/README.md`
- **Description**: Document required binaries, optional adapters, fixture refresh steps, and MVP limitations so another developer can set up and debug the room without re-discovering the architecture.
- **Complexity**: 3
- **Dependencies**: Tasks 2.3, 5.2
- **Acceptance Criteria**:
  - Setup requirements and feature flags are discoverable from the room package itself.
  - The next feature (audio/subtitle/media extensions) has an obvious insertion point.
- **Validation**:
  - Fresh-developer checklist review

## Testing Strategy
- Use targeted Node tests for manifest validity, room packaging, IPC handlers, pipeline orchestration, and report-builder output.
- Run `npm run typecheck` after every sprint that touches shared types, Electron handlers, or room host contracts.
- Verify room install/import flows through the existing Settings > Rooms overlay.
- Keep analyzer tests fixture-based so the core pipeline stays deterministic and does not require live network access.
- Run manual UX smoke tests for source selection, preview, time range, ROI selection, mode switching, start/cancel, and both report tabs.
- Add shared room regression coverage for corridor routing, scene debug, and generated room markup/page surfaces.
- Treat YouTube adapter tests as future-scope tests, not MVP requirements.

## Potential Risks And Gotchas
- The room webview does not have direct Electron access.
  Mitigation: keep OS/network/process operations in the host + Electron IPC, not the runtime UI.
- "Offline" and media download can be interpreted as conflicting.
  Mitigation: define offline as analysis-local-only; acquisition can use the network, but analysis cannot depend on cloud services.
- YouTube is visible in the UI before it is implemented.
  Mitigation: label it clearly as disabled or coming soon so the user promise stays honest.
- Per-analysis workspaces can consume significant disk space over time.
  Mitigation: store durable reports separately from removable media cache inside each workspace, and provide explicit cache cleanup actions in the UI.
- Python analyzer packages are absent in the current environment.
  Mitigation: make OpenCV/Librosa/PySceneDetect optional backends behind stable analyzer interfaces.
- Deep mode can overwhelm low-end CPUs.
  Mitigation: sample aggressively, serialize heavy analyzers, support cancel, and cap file duration/frame budgets.
- Some codecs may not preview well in the room webview.
  Mitigation: add a preview-proxy step that generates an H.264/AAC preview only when needed.
- ROI selection can drift if CSS pixels are not mapped to natural video coordinates correctly.
  Mitigation: centralize coordinate transforms and cover them with resize-aware tests.
- Risk scores may be misread as legal certainty.
  Mitigation: user-facing copy must clearly communicate probabilistic evidence, not proof.
- Detailed progress can become noisy or technical.
  Mitigation: show a simple user-facing phase label first, with expandable technical detail underneath.

## Resolved Product Decisions
- V1 supports local files and direct media URLs.
- YouTube download is not in day one scope, but the UI keeps a placeholder for it.
- Each completed analysis gets its own workspace folder in the Laboratory room data directory.
- The working source file is copied into that workspace before preview/analysis, and related details/artifacts live alongside it.
- Completed analyses, reports, and source/selection details are persisted in the Laboratory room data directory.
- Media cache cleanup is supported; it removes heavy media artifacts while keeping durable report/history data readable.
- In-progress analyses do not need resume support in V1.
- User report and readable technical report are both shown in the UI.
- Technical report can be copied as JSON; AI transfer is manual and outside V1.
- If no time range or ROI is selected, analyze the full video and full frame.
- Do not impose a hard video-duration ceiling; rely on adaptive sampling and progressive execution instead.

## Rollback Plan
- Remove or disable the `rooms/laboratory` workspace package if the room UX is not ready to ship.
- Unregister the new Laboratory IPC handlers from `electron/main.ts` to revert the app to the pre-feature state.
- Delete the Laboratory room-private runtime data directory and temp jobs; never rely on the installed room bundle directory for mutable state.
- Reinstall the last known-good room registry state via workspace/export/import flows if the install lifecycle regresses.
