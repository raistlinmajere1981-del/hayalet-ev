# Plan: Laboratory Asset Registry and Project Assets Panel

**Generated**: 2026-04-23
**Estimated Complexity**: High

## Overview

Add a project-scoped asset registry for the Laboratory room so source files, exported clips, grabbed frames, extracted audio, reports, and analysis artifacts are tracked as reusable project assets rather than plain file paths. The registry should live beside the current laboratory project state, flow through the UI store, and render in a new Project Assets panel that stays separate from the Process panel.

Core design principles:

- Asset is not a file path. It carries lineage: source, run, intents, metadata, created time.
- Asset deletion in v1 removes the registry entry only. It does not delete the disk file.
- Process panel remains execution/progress UI. Project Assets is the data inventory.
- Source of truth is `rooms/laboratory/...`; `data/rooms/laboratory/...` is regenerated/installed copy.

## Research Notes

- `rooms/laboratory/models/lab-types.ts` already owns `LabStoreState`, persisted state, user action events, run artifacts, reports, and workspace UI types.
- `rooms/laboratory/runtime/lab-store.ts` owns the reducer-style store and currently keeps `run.artifacts` separate from user action history.
- `rooms/laboratory/runtime/lab-selectors.ts` already exposes selectors for reports, source, current run, visible artifacts, and recent actions.
- `rooms/laboratory/runtime/lab-run-controller.ts` dispatches UI actions and sends host actions such as `export-timeline-clip`, `export-frame-grab`, and report exports.
- `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts` already creates clip/frame/ROI output files but currently only returns paths and emits generic job completion.
- No dedicated `extract-audio` host action exists yet. The plan adds one so the requested audio asset scenario is testable.
- `rooms/laboratory/ui/workspace-surface.ts` builds the right panel from process, report, controls, and analysis sections. The Project Assets panel should be inserted there as a separate section.
- `rooms/laboratory/ui/components/artifact-item.ts` renders process artifacts only; asset item rendering should use a new component to avoid conflating assets with analysis artifacts.
- Project persistence is handled by `rooms/laboratory/shared/host/project-records.ts`, `project-storage.ts`, `project-manifests.ts`, and `shared/data/tools/project-schema.json`.

## Assumptions

- Project assets should persist across reloads and project switching, so the registry should be stored on the active project record and mirrored into `LabStoreState`.
- The first version can use browser preview URLs when available and local path text when preview URL generation is not yet available.
- Right-click context menus can start with a click/overflow menu if native `contextmenu` wiring becomes too large for the first implementation.
- Download means exposing/opening the asset path through the existing room/Electron bridge if available; if no bridge exists, v1 should copy or reveal the local path without deleting anything.

## Prerequisites

- Use `workflow:terminal-mode` for this repo state: `mode:status` is `terminal`, `whereami.effectiveMode` is `other-provider-cli`.
- Keep edits in `rooms/laboratory/...`; do not hand-edit `data/rooms/laboratory/...`.
- Run room build/install parity checks after implementation so installed copy drift is caught.
- Confirm `ffmpeg` is available for clip, frame, and audio extraction tests.

## Sprint 1: Asset Contract and Store Registry

**Goal**: Introduce a typed, project-scoped registry that can be persisted and queried without changing UI behavior yet.

**Demo/Validation**:

- Typecheck passes.
- Store can add, update, remove, and select assets.
- Existing laboratory run/process behavior remains unchanged.

### Task 1.1: Add Lab Asset Types

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabAssetType` and `LabAsset`. Use `LabRecord` for metadata instead of `Record<string, any>`. Include `id`, `type`, `name`, `url`, `localPath`, `createdAt`, `sourceId`, `runId`, `intentIds`, and `metadata`.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - Asset type covers `source`, `clip`, `frame`, `audio`, `image`, `report`, and `artifact`.
  - Metadata stays typed as existing `LabRecord`.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add Assets to Store and Persistence Types

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/runtime/lab-persistence.ts`
- **Description**: Add `assets: LabAsset[]` to `LabStoreState` and `LabPersistedState`. Initialize empty assets, hydrate from persisted/project snapshot, and include assets in `readPersistableState`.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Existing sessions without assets hydrate cleanly.
  - Assets are not derived from `run.artifacts` automatically.
  - Local persisted state carries assets as fallback.
- **Validation**:
  - Add reducer tests or focused node tests for hydrate/migrate behavior.
  - `npm run rooms:typecheck`

### Task 1.3: Add Asset Reducer Events

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add events for `asset-added`, `asset-removed`, and `asset-updated`. Upsert by `id`, remove by registry only, and cap or sort only if product requirements demand it.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Adding an existing id updates/replaces one registry entry.
  - Removing an asset never sends disk-delete requests.
  - Updating merges a patch without clearing lineage fields accidentally.
- **Validation**:
  - Unit tests in a new or existing laboratory store regression file.

### Task 1.4: Add Asset Selectors

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getAssets`, `getAssetsByType`, `getAssetsBySource`, and `getAssetsByRun`. Add grouping helpers for Project Assets panel if useful.
- **Complexity**: 3
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Selectors return stable copies, not mutable store arrays.
  - Type/source/run filters handle null or missing ids safely.
- **Validation**:
  - Selector tests cover clip, frame, audio, report, and source filters.

### Task 1.5: Persist Assets on Project Records

- **Location**: `rooms/laboratory/shared/host/project-records.ts`, `rooms/laboratory/shared/data/tools/project-schema.json`
- **Description**: Add optional `assets` to project records, normalize it during project load, initialize it on new projects, and include it in schema documentation.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - New projects start with an empty asset array.
  - Existing project JSON without `assets` still loads.
  - Project `assets` survives save/load cycles.
- **Validation**:
  - Project management regression test for asset persistence.
  - `npm run rooms:test:file -- scripts/tests/laboratory-project-management-regressions.test.ts`

### Task 1.6: Add Host Asset Registry Mutation Boundary

- **Location**: `rooms/laboratory/shared/host/project-records.ts`, `rooms/laboratory/shared/host/project-storage.ts`, `rooms/laboratory/shared/host/action-router.ts`, optionally new `rooms/laboratory/shared/host/asset-registry.ts`
- **Description**: Add host-side helpers for upserting, patching, and removing project assets so generated asset records are written into active project JSON, then mirrored back to UI through normal snapshots.
- **Complexity**: 6
- **Dependencies**: Task 1.5
- **Acceptance Criteria**:
  - Host can upsert assets by id or stable local path without duplicating entries.
  - Host can remove registry entries without deleting disk files.
  - UI store assets can be treated as snapshot state rather than the only persistence source.
- **Validation**:
  - Project storage regression proves asset mutations survive save/load.
  - Existing project save/load tests still pass.

### Task 1.7: Define Stable Source Identity

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/shared/host/project-records.ts`, `rooms/laboratory/shared/host/asset-registry.ts`
- **Description**: Define how `sourceId` is produced because current source records do not expose a stable id. Prefer a source asset id or source signature derived from project id, stored path, stored file name, and source metadata.
- **Complexity**: 5
- **Dependencies**: Task 1.5
- **Acceptance Criteria**:
  - Every source-ready project has a stable source identity.
  - Derived clip/frame/audio/report/artifact assets can reference the active source identity.
  - Rehydrating a project does not generate a different source id for the same source file.
- **Validation**:
  - Source identity regression covers reload and source replacement.

### Task 1.8: Add Snapshot Plumbing for Assets

- **Location**: `rooms/laboratory/shared/host/room-snapshot.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Serialize `activeProject.assets` into media snapshots and hydrate `LabStoreState.assets` from snapshots. Add preview/file URL derivation where the room snapshot layer already knows how to expose managed files.
- **Complexity**: 6
- **Dependencies**: Task 1.6, Task 1.7
- **Acceptance Criteria**:
  - UI receives project assets after project load, project switch, and reload.
  - Asset records include usable `url` or preview fields when the host can expose them.
  - Project switch filters assets to the active project instead of leaking stale registry entries.
- **Validation**:
  - Snapshot serialization regression.
  - Project switch and reload persistence tests.

## Sprint 2: Asset Creation from Source and Actions

**Goal**: Create assets at the moment project data is produced, with lineage attached.

**Demo/Validation**:

- Loading a source creates a source asset.
- Exporting a clip and grabbing a frame creates clip/frame assets.
- Exporting a report creates report assets.
- Audio extraction action exists and creates audio assets.

### Task 2.1: Define Asset Creation Helper

- **Location**: new `rooms/laboratory/shared/host/asset-registry.ts` plus optional UI helper `rooms/laboratory/runtime/lab-assets.ts`
- **Description**: Add a helper that builds a `LabAsset` from project/runtime state plus result payload: active source id/path, current run id, selected intents, file name, local path, URL, and action metadata. UI helper may be used only for optimistic rendering; host helper owns durable writes.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Helper can create source, clip, frame, audio, report, artifact records.
  - `createdAt` uses numeric `Date.now()`.
  - Asset names prefer file name, then label, then action fallback.
  - Stable ids or dedupe keys prevent duplicate assets when a completed snapshot is replayed.
- **Validation**:
  - Unit tests with state fixtures.

### Task 2.2: Register Assets in Host Producers

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`, `rooms/laboratory/shared/host/reporting-export.ts`, `rooms/laboratory/shared/host/asset-registry.ts`
- **Description**: Upsert assets directly inside the host code that produces files. Avoid relying on `action-router` return values because the router currently discards handler returns.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Clip/frame/ROI/audio/report producers upsert durable asset records before final snapshot push.
  - Existing `userActions` success handling still works.
  - No process-run event shape is broken.
- **Validation**:
  - Extend `laboratory-host-action-runtime-regressions.test.ts`.

### Task 2.3: Register Source Assets

- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/shared/host/project-records.ts`, source intake host files
- **Description**: When source state becomes ready with a stored path, add or upsert one `source` asset tied to the active project/source.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Local, URL, and YouTube sources all create source assets.
  - Replacing a source does not overwrite old derived assets unless explicitly removed.
  - Source asset metadata includes source kind, mime type, stored file name, and route label.
- **Validation**:
  - Source intake regression test for source asset creation.

### Task 2.4: Register Clip and Frame Assets

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`, `rooms/laboratory/shared/host/asset-registry.ts`, optional optimistic mirror in `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: On successful `export-timeline-clip` and `export-frame-grab`, upsert `clip` or `frame` assets into the active project asset registry and allow the UI snapshot to hydrate them.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Clip assets include timeline start/end metadata.
  - Frame assets include seek time metadata.
  - `sourceId`, `runId`, and `intentIds` are attached when known.
- **Validation**:
  - Controller/store test for completed export event to asset registry.

### Task 2.5: Add Audio Extraction Action

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`, `rooms/laboratory/shared/host/action-router.ts`, `rooms/laboratory/runtime/lab-user-actions.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/workspace-timeline.ts`
- **Description**: Add `export-audio-track` or equivalent action that extracts audio from a video source into an audio file, tracks it as user action type `extract-audio`, and registers an `audio` asset.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Action is available only for video sources with audio.
  - Output file uses project edit output directory.
  - Successful completion registers an `audio` asset.
  - `TRACKED_USER_ACTION_DEFINITIONS`, router cases, runtime labels, export cancellation sets, and UI controls all include the audio action.
  - Existing clip/frame actions are not blocked by audio jobs except where export job slot rules require it.
- **Validation**:
  - Host action test for ffmpeg args and job cancellation rules.
  - Controller test for audio asset creation.

### Task 2.6: Register Report Assets

- **Location**: `rooms/laboratory/shared/host/reporting-export.ts`, `rooms/laboratory/shared/host/asset-registry.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Convert report export entries into `report` assets when report export succeeds. Include both user markdown and AI JSON exports when both are produced.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Report assets include run id and feature id metadata.
  - Re-exporting the same path does not duplicate registry entries.
- **Validation**:
  - Report composition/export regression test.

### Task 2.7: Register ROI and Image Assets

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`, `rooms/laboratory/shared/host/asset-registry.ts`, `rooms/laboratory/runtime/lab-user-actions.ts`
- **Description**: Treat ROI exports and image-derived outputs as `image` assets so the model's `image` type is not a dead enum branch.
- **Complexity**: 4
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - ROI export creates an `image` asset with region metadata.
  - Image source export or derived image output can register an `image` asset when applicable.
  - The Project Assets panel groups these separately from `frame` assets if product copy calls them Images.
- **Validation**:
  - Host export regression for ROI/image asset registration.

### Task 2.8: Register Process Artifact Assets or Scope Them Out

- **Location**: `rooms/laboratory/shared/host/process-runtime.ts`, `rooms/laboratory/shared/host/analysis-artifact-runtime.ts`, `rooms/laboratory/shared/host/process-report-state.ts`
- **Description**: Decide and encode v1 behavior for analysis artifacts. Preferred v1: register finalized module/process artifacts as `artifact` assets while keeping `run.artifacts` as process-local execution evidence.
- **Complexity**: 6
- **Dependencies**: Task 2.1, Task 1.8
- **Acceptance Criteria**:
  - `artifact` type is either populated from finalized process artifacts or explicitly hidden from v1 UI.
  - If populated, asset records include module id, run id, and analysis scope metadata.
  - Process panel still renders `run.artifacts`; Project Assets renders reusable registry assets.
- **Validation**:
  - Process/module artifact regression covers no duplication and correct grouping.

## Sprint 3: Project Assets Panel UI

**Goal**: Render a separate asset inventory in the right panel and support preview, metadata, remove, download, and use-as-source commands.

**Demo/Validation**:

- Project Assets appears below Process panel or behind a clean tab.
- Assets group into Source, Clips, Frames, Audio, Reports, and Artifacts.
- Clicking an asset opens preview or activates preview state.
- Hover/title exposes metadata.

### Task 3.1: Create Asset Item Component

- **Location**: `rooms/laboratory/ui/components/asset-item.ts`
- **Description**: Render one asset row with icon/type indicator, name, lineage hint, created time, and action controls.
- **Complexity**: 4
- **Dependencies**: Sprint 1 selectors
- **Acceptance Criteria**:
  - Asset rows do not use `renderArtifactItem`.
  - Long names and paths truncate without layout shift.
  - Rows expose `data-lab-action` hooks for preview, remove, download, and use-as-source.
- **Validation**:
  - UI string snapshot or DOM-oriented regression test.

### Task 3.2: Create Project Assets Panel

- **Location**: `rooms/laboratory/ui/lab-project-assets-panel.ts`
- **Description**: Render grouped asset inventory under the Process panel by default, with empty state and counts.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Sections: Source, Clips, Frames, Audio, Reports, Artifacts.
  - Panel stays visually separate from process execution.
  - Empty groups are hidden except when registry is empty.
- **Validation**:
  - DOM regression: panel renders with sample assets.

### Task 3.3: Insert Panel in Right Panel Surface

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Import `renderLabProjectAssetsPanel` and insert it after `processSection` and before report/controls/actions.
- **Complexity**: 2
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Process panel remains first.
  - Project Assets does not collapse or alter process sections.
  - Analysis button remains reachable on narrow screens.
- **Validation**:
  - UI regression and manual responsive check.

### Task 3.4: Add Asset Panel Styling

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add `labx-project-assets` styles aligned with existing laboratory visual system, with stable row dimensions and responsive text truncation.
- **Complexity**: 4
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - No nested cards.
  - No overlapping text at desktop or mobile widths.
  - Buttons use compact icons or established inline action style.
- **Validation**:
  - Visual smoke check with long file names.

### Task 3.5: Wire Preview and Metadata

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Add UI state for active asset preview or reuse existing preview activation if the asset maps to media. On click, set selected asset and render preview in workspace or an overlay.
- **Complexity**: 6
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Image/frame assets preview as image.
  - Clip/source assets preview as video when URL/path can be resolved.
  - Audio assets preview as audio.
  - Reports can open report overlay or reveal path.
- **Validation**:
  - Controller test for preview action.
  - Manual browser/Electron smoke if app is available.

### Task 3.6: Wire Remove and Download

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/shared/host/action-router.ts` if host support is needed
- **Description**: Remove deletes registry entry only. Download/reveal uses existing bridge if available; otherwise emits a warning or copies path in v1.
- **Complexity**: 5
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Remove never deletes disk files.
  - Download/reveal is disabled or explanatory when path is missing.
  - Actions are reflected immediately in the panel.
- **Validation**:
  - Store reducer test for registry-only removal.

### Task 3.7: Add i18n and UI Copy

- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/ui/lab-project-assets-panel.ts`
- **Description**: Add localized labels for Project Assets, group headings, action names, empty states, and warning messages instead of hardcoding all visible text in the panel.
- **Complexity**: 3
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Group names and actions have English and Turkish copy.
  - Missing/pathless/forged asset warnings use localized messages where the room UI already supports i18n.
  - No user-visible strings are left as accidental debug copy.
- **Validation**:
  - i18n JSON syntax check.
  - UI rendering test covers at least one localized label.

## Sprint 4: Use As Source Workflow

**Goal**: Let users turn a clip/audio/image/frame asset into the active project source and start a new analysis from it.

**Demo/Validation**:

- User selects a clip and chooses Use as Source.
- Source is loaded from the asset local path.
- Analysis can be started using the new source.

### Task 4.1: Add Use-As-Source Action Contract

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add `asset-use-as-source` UI action that sends only an asset id to the host. The UI may validate compatible type for feedback, but it must not send raw `localPath` as authority.
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Compatible types: `clip`, `audio`, `image`, `frame`, and optionally `source`.
  - Incompatible or pathless assets show a warning event.
  - Current run is not interrupted unless user explicitly starts analysis.
  - Forged or stale asset ids fail safely.
- **Validation**:
  - Controller test for valid/invalid asset ids.

### Task 4.2: Add Host Source-From-Asset Action

- **Location**: `rooms/laboratory/shared/host/action-router.ts`, `rooms/laboratory/main-functions/media-analysis/host/action-handlers-source.ts`, `rooms/laboratory/main-functions/media-analysis/host/source-intake-local.ts`
- **Description**: Add an action that resolves the asset by id from the active project registry, then creates a source record without forcing the file picker. Prefer copying into source storage or using non-owning validation so the original asset file is never deleted by source validation cleanup.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Uses the same validation and metadata path as source intake.
  - Preserves lineage by linking new source asset metadata to the original asset id.
  - Does not mutate or delete the original asset.
  - Host rejects raw UI-provided file paths and missing asset ids.
- **Validation**:
  - Host source-intake regression for source-from-asset.

### Task 4.3: Preserve Lineage Across Use-As-Source

- **Location**: `rooms/laboratory/shared/host/project-records.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: When an asset becomes a source, create a new `source` asset whose metadata references `derivedFromAssetId` and original `sourceId/runId`.
- **Complexity**: 4
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - New source asset appears under Source.
  - Original clip/audio/frame asset remains in its group.
  - New analysis run can attach to the new source id.
- **Validation**:
  - End-to-end store test with clip -> source -> run start.

### Task 4.4: Trigger Analysis from New Source

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: After Use as Source completes, leave the workspace ready for analysis. Do not auto-start unless a future UX decision explicitly asks for it.
- **Complexity**: 3
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Source readiness becomes completed.
  - User can click Derin Analiz Başlat.
  - The run snapshot uses the new source.
- **Validation**:
  - Manual smoke checklist.

## Sprint 5: Regression Coverage and Build Parity

**Goal**: Prove the complete scenario and prevent drift between workspace and installed room copies.

**Demo/Validation**:

- Full requested scenario passes in automated or semi-automated smoke:
  1. Load a video.
  2. Export two clips.
  3. Grab one frame.
  4. Extract one audio file.
  5. Verify Project Assets list groups all entries.
  6. Use one clip as source.
  7. Start analysis from that clip source.

### Task 5.1: Add Store and Selector Tests

- **Location**: `scripts/tests/laboratory-asset-registry-regressions.test.ts`
- **Description**: Add focused reducer and selector tests for add/update/remove/filter/hydrate behavior.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Tests cover all requested asset types.
  - Remove test confirms registry-only deletion.
  - Project switch filtering and reload hydration are covered.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-asset-registry-regressions.test.ts`

### Task 5.2: Add Host Action Tests

- **Location**: `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
- **Description**: Extend existing host action tests for clip/frame result payloads and new audio extraction action.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Existing export job cancellation rule still passes.
  - Audio extraction uses ffmpeg args expected for WAV or chosen format.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 5.3: Add UI Rendering Tests

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts` or new focused test
- **Description**: Render Project Assets panel with fixture assets and assert sections/actions are present, including long-list scroll behavior and long file name truncation.
- **Complexity**: 4
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Source, Clips, Frames, Audio, Reports groups render.
  - Process artifacts and project assets remain different render paths.
- **Validation**:
  - Targeted room UI test.

### Task 5.4: Add Use-As-Source Tests

- **Location**: `scripts/tests/laboratory-source-intake-regressions.test.ts`, `scripts/tests/laboratory-source-ui-regressions.test.ts`
- **Description**: Test source-from-asset host action and controller behavior.
- **Complexity**: 6
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Clip asset can become source.
  - Pathless asset fails cleanly.
  - Derived source lineage is preserved.
  - Forged asset ids and raw path attempts are rejected.
  - Original asset file remains in place after use-as-source validation.
- **Validation**:
  - Targeted source tests.

### Task 5.5: Add Snapshot and Installed-Copy Parity Tests

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`, `scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`, `scripts/tests/laboratory-host-import-smoke-regressions.test.ts`
- **Description**: Cover asset serialization through `room-snapshot.ts` and verify built/installed room copies include the new asset registry files and panel files.
- **Complexity**: 5
- **Dependencies**: Sprint 1, Sprint 3
- **Acceptance Criteria**:
  - Snapshot test proves `activeProject.assets` reaches UI state.
  - Installed-copy parity catches missing new files.
  - No test manually edits `data/rooms/laboratory`.
- **Validation**:
  - Targeted runtime/parity tests.

### Task 5.6: Run Full Validation

- **Location**: package scripts
- **Description**: Run typecheck, targeted tests, and room build parity.
- **Complexity**: 4
- **Dependencies**: All implementation tasks
- **Acceptance Criteria**:
  - `npm run rooms:typecheck`
  - Targeted asset/source/host/UI tests pass.
  - `npm run rooms:build` succeeds.
  - Installed-copy parity tests pass.
- **Validation**:
  - `npm run rooms:test:core` or relevant subset if full core is too slow.

## Testing Strategy

- Unit-test store reducers and selectors first because they define the registry contract.
- Test host asset upserts before controller wiring so UI does not depend on guessed paths.
- Test UI rendering with static fixture assets to keep panel regressions cheap.
- Add one integration-style scenario for clip -> source -> analysis readiness.
- For manual smoke, use a short video fixture to keep ffmpeg export and audio extraction fast.
- Include snapshot, project switch, reload, forged id, and installed-copy parity coverage.

## Potential Risks and Gotchas

- Export handlers currently return paths but generic action-result events may not carry those paths to the UI. Mitigation: add an explicit asset-ready payload or enrich completed job events in a compatible way.
- UI-only asset dispatch would be lost or drift from project JSON. Mitigation: host-side asset registry helpers own durable project mutation; UI state mirrors snapshots and can optionally render optimistic updates.
- Existing source records do not define stable ids. Mitigation: define source identity before any derived asset registration.
- Use-as-source can become unsafe if the UI sends raw paths or if source validation treats reused files as disposable owned files. Mitigation: host resolves by asset id, copies into source storage or uses non-owning validation, and never deletes the original asset file.
- Audio extraction is listed in the requested UX but no current direct action exists. Mitigation: add it as a small sibling to clip/frame export rather than overloading edit preview/apply.
- Project-level persistence can drift if only browser localStorage stores assets. Mitigation: persist `assets` on project JSON and hydrate UI from snapshots.
- `run.artifacts` and `assets` can be confused. Mitigation: separate types, selectors, components, CSS classes, and tests.
- Use-as-source can accidentally skip normal source reset logic. Mitigation: route through source intake/metadata preparation and reuse source-change stale markers.
- Local file preview may need a URL bridge. Mitigation: v1 can preview only when `url` exists and still offer reveal/path actions for local-only assets.
- Right-click behavior is inconsistent in webviews. Mitigation: implement visible overflow actions first, then add `contextmenu` as progressive enhancement.
- Hand-editing `data/rooms/laboratory` would create installed-copy drift. Mitigation: edit `rooms/laboratory` only and validate with room build/parity tests.

## Rollback Plan

- Revert the asset model/store additions and remove `assets` from project normalization if Sprint 1 fails.
- If host result payload changes cause regressions, keep store/UI work disabled behind no-op selectors until event shape is corrected.
- If Use as Source proves risky, ship registry and panel first with the action hidden or disabled for v1.
- Since v1 deletion is registry-only, rollback does not need disk cleanup.

## Implementation Order Summary

1. Add type/store/selectors/persistence.
2. Define stable source identity and snapshot plumbing.
3. Add host-side asset registry mutation helpers.
4. Add host asset creation helpers.
5. Register source, clip, frame, audio, image/ROI, report, and scoped process artifacts.
6. Render Project Assets panel, actions, styling, and i18n.
7. Add Use as Source through safe asset-id-based source intake.
8. Add regressions and run room validation.
