# Plan: Laboratory Linked Audio Lineage

**Generated**: 2026-04-23
**Estimated Complexity**: Medium

## Overview

Extend the Laboratory asset model so extracted audio assets keep explicit parent lineage to the source they came from, then expose that relationship through selectors and minimal UI affordances. The goal is to make source <-> audio linkage first-class before any dual-preview or synchronized playback work.

Asset field semantics for this work:

- `sourceId`: current project/source scoping field already assigned to output assets; used for grouping assets under the active source context.
- `derivedFromSourceId`: lineage field; points to the source asset identity this asset was derived from.
- `derivedFromAssetId`: lineage field; points to the specific parent asset when one exists.

This plan intentionally stops at the linkage layer:

- In scope:
  - Promote `derivedFromAssetId` and `derivedFromSourceId` into the `LabAsset` contract.
  - Ensure audio extraction writes lineage and simple sync metadata.
  - Add selectors for linked audio and reverse lookup.
  - Show the parent source in the Project Assets panel.
  - Show a linked-audio bar above the workspace preview.
- Out of scope:
  - Dual player
  - Waveform rendering
  - Real-time synchronized playback
  - Playback transport coupling between video and derived audio

## Research Notes

- `rooms/laboratory/models/lab-types.ts` defines `LabAsset`, but lineage is not yet a first-class field on the asset contract.
- `rooms/laboratory/main-functions/media-analysis/host/source-intake-local.ts` already writes `derivedFromAssetId` and `derivedFromSourceId` into source metadata during "asset reuse"; this confirms the lineage concept already exists, but it is metadata-only today.
- `rooms/laboratory/shared/host/lab-assets.ts` and `rooms/laboratory/runtime/lab-store.ts` normalize and persist assets. They currently drop any lineage fields that are not part of `LabAsset`.
- `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts` creates extracted audio assets via `exportAudioTrack()`, but the created asset currently only stores generic metadata like action/request/tool info. It does not yet stamp parent lineage.
- `rooms/laboratory/runtime/lab-selectors.ts` already exposes `getAssets()`, `getAssetById()`, `getAssetsByType()`, `getAssetsBySource()`, and `getAssetsByRun()`. The requested linked-audio selectors fit naturally here.
- `rooms/laboratory/ui/lab-project-assets-panel.ts` renders grouped asset rows and already has clickable asset preview actions, but no parent-link or sync summary UI.
- `rooms/laboratory/ui/workspace-surface.ts` renders the source bar and workspace preview. It is the right place for a compact "linked asset bar" above the preview.
- `rooms/laboratory/runtime/lab-run-controller.ts` already handles `asset-preview` and other panel actions, so it is the likely home for any "focus the source preview" interaction.
- `rooms/laboratory/shared/data/tools/project-schema.json` documents the persisted asset shape and will need to reflect the expanded asset contract.

## Assumptions

- The canonical source asset id is the same as `sourceId` for the active project source. This matches the current `buildSourceLabAsset()` behavior in `rooms/laboratory/shared/host/lab-assets.ts`.
- The first version of "click source -> go to source preview" should focus or scroll to the existing workspace preview, not switch the active source.
- For the initial full-track audio extraction flow, `startOffsetMs` can be `0` or omitted, because the extracted audio shares the source timeline origin.
- `durationMs` for full-track extraction is a v1 display-only value derived from current source metadata (`durationSeconds * 1000`). This plan does not add a new post-export probe dependency to the export runtime.
- If a linked parent source does not match the currently active source preview, v1 should degrade safely rather than silently switching project state.

## Prerequisites

- Repo workflow for this session is `workflow:terminal-mode` because `npm run mode:status` returned `terminal` and `npm run whereami` returned `effectiveMode: other-provider-cli`.
- Edit only `rooms/laboratory/...` source files. Do not hand-edit `data/rooms/laboratory/...`.
- Validate with room-local commands:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts`
- After implementation, rebuild room artifacts with `npm run rooms:build` and rerun parity checks that cover `ui/workspace-surface.js`.
- Current baseline note: `scripts/tests/laboratory-source-ui-regressions.test.ts` is already red on current HEAD, so new linkage assertions should either land in a dedicated linkage UI suite or be paired with an explicit baseline-fix task before using that file as the primary acceptance gate.

## Sprint 1: Promote Lineage to the Asset Contract

**Goal**: Make lineage part of the persisted `LabAsset` shape so UI and selectors do not need to scrape metadata blobs.

**Demo/Validation**:

- Typecheck passes with the expanded asset shape.
- Existing projects without lineage fields still load cleanly.
- Lineage survives normalization, persistence, and snapshot serialization.

### Task 1.1: Extend `LabAsset` With First-Class Lineage Fields

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/shared/data/tools/project-schema.json`
- **Description**: Add optional `derivedFromAssetId?: string` and `derivedFromSourceId?: string` to `LabAsset`. Update schema docs so persisted project assets explicitly allow both fields.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabAsset` supports lineage without metadata inspection.
  - Persisted asset schema documents the new optional fields.
  - Older assets without lineage remain valid.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add `LabAsset` Transport Plumbing for Lineage Fields

- **Location**: `rooms/laboratory/shared/host/lab-assets.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/shared/host/project-records.ts`
- **Description**: Update the actual asset transport seam so the new lineage fields are accepted and preserved in `OutputAssetInput`, `createLabOutputAsset()`, `normalizeLabAsset()`, and `serializeLabAssetForSnapshot()`. Confirm these fields survive project load, host snapshot generation, store hydration, and asset updates.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `shared/host/lab-assets.ts` accepts lineage on asset creation paths, not only on manually constructed asset objects.
  - Host-normalized assets keep `derivedFromAssetId` and `derivedFromSourceId`.
  - Store-normalized assets keep the same fields after `snapshot-received`, `asset-added`, and `asset-updated`.
  - Save/load cycles do not drop lineage.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-project-management-regressions.test.ts`

### Task 1.3: Mirror Existing Source-Reuse Lineage Onto Synthetic Source Assets

- **Location**: `rooms/laboratory/shared/host/lab-assets.ts`, `rooms/laboratory/main-functions/media-analysis/host/source-intake-local.ts`
- **Description**: Keep the current source-reuse metadata write path, but also ensure `buildSourceLabAsset()` can surface `derivedFromAssetId` and `derivedFromSourceId` from source metadata onto the synthetic `source` asset entry. This keeps reverse-link selectors consistent when a source was originally created from another asset.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Source assets created from "Asset reuse" expose lineage at the top level.
  - Existing source metadata-based lineage remains backward compatible.
  - No duplicate or conflicting lineage source of truth is introduced.
- **Validation**:
  - Extend existing source-from-asset regression coverage in `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 1.4: Stamp Lineage and V1 Sync Metadata During Audio Extraction

- **Location**: `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`, optionally `rooms/laboratory/shared/host/lab-assets.ts`
- **Description**: Update `exportAudioTrack()` so created audio assets carry:
  - `derivedFromSourceId` = active project source id
  - `derivedFromAssetId` = active source asset id when resolvable
  - `metadata.durationMs` derived from current source metadata
  - optional `metadata.startOffsetMs`
  Keep the first version simple: full-track extraction should report same-timeline metadata rather than introducing clip-local sync logic or a new metadata probe in the export runtime.
- **Complexity**: 6
- **Dependencies**: Tasks 1.1, 1.2
- **Acceptance Criteria**:
  - Extracted audio assets are directly traceable back to the current source.
  - Audio export from video and audio sources both write lineage safely.
  - `durationMs` and `startOffsetMs` follow the v1 rule set based on existing source timeline metadata only.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

## Sprint 2: Add Link-Resolution Selectors

**Goal**: Provide clean read APIs for UI code so linkage logic stays in selectors rather than being duplicated across panels.

**Demo/Validation**:

- Selectors return correct audio-child and parent-source relationships.
- Missing or stale lineage values fail safely with `null` or empty arrays.

### Task 2.1: Add `getLinkedAudioAssets()`

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add:
  - `getLinkedAudioAssets(state, sourceId: string)`
  Filter `getAssets(state)` for `type === "audio"` and `derivedFromSourceId === sourceId`.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Only linked audio assets are returned.
  - Non-audio assets with the same `derivedFromSourceId` are excluded.
  - Empty or missing links return an empty list.
- **Validation**:
  - Selector coverage in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 2.2: Add `getParentSourceForAsset()`

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add:
  - `getParentSourceForAsset(state, assetId: string)`
  Resolve the asset by id, then find a parent asset by `derivedFromAssetId` or `derivedFromSourceId`. Prefer explicit asset-parent matches first, then source-id fallback.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Missing asset id returns `null`.
  - Assets without lineage return `null`.
  - Parent lookup works for extracted audio and source-reuse scenarios.
- **Validation**:
  - Selector coverage in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 2.3: Add a Small Sync-Status Formatting Helper

- **Location**: `rooms/laboratory/ui/lab-asset-display.ts` or `rooms/laboratory/ui/lab-project-assets-panel.ts`
- **Description**: Add a small helper that interprets `metadata.durationMs` and `metadata.startOffsetMs` for UI text such as "Sync: Same timeline". Keep it display-only; do not attach playback behavior.
- **Complexity**: 2
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - `startOffsetMs` missing or `0` maps to "same timeline" wording.
  - Future non-zero offsets have a clear fallback label instead of misleading success text.
  - Missing metadata degrades to no sync line rather than broken markup.
- **Validation**:
  - UI-string assertions in a dedicated linkage UI regression file, or in `scripts/tests/laboratory-source-ui-regressions.test.ts` only after baseline repair

## Sprint 3: Add Parent-Link UI to the Project Assets Panel

**Goal**: Make the lineage visible where the user inspects assets, without turning the panel into a media player.

**Demo/Validation**:

- Audio asset rows show the linked source when available.
- The source label is clickable in the supported case.
- Sync status is displayed as metadata-only feedback.

### Task 3.1: Render Linked Source Metadata on Audio Rows

- **Location**: `rooms/laboratory/ui/lab-project-assets-panel.ts`, `rooms/laboratory/ui/lab-asset-display.ts`
- **Description**: For audio assets, use `getParentSourceForAsset()` to render a compact secondary line such as `Source: video.mp4`. Keep the existing row layout intact; this is a small informational expansion, not a panel redesign.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Only audio assets with a resolved parent render the source line.
  - The parent source name is taken from the resolved asset, not from guessed file paths.
  - Audio rows without lineage remain visually stable.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - or `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts` after baseline repair

### Task 3.2: Make the Source Label Clickable Without Switching Sources

- **Location**: `rooms/laboratory/ui/lab-project-assets-panel.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add a lightweight action for "focus the source preview" rather than reusing `asset-preview`. The action should scroll to or focus `#lab-workspace-preview` when the linked parent matches the active source. If it does not match, degrade safely instead of mutating source state.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Clicking the source label takes the user to the source preview in the standard extracted-audio flow.
  - No hidden source replacement happens.
  - Missing DOM target or stale lineage fails as a no-op or warning, not a crash.
- **Validation**:
  - Runtime/controller regression coverage if DOM interaction is introduced
  - UI regression assertions for the new action markup

### Task 3.3: Show Sync Status on Audio Rows

- **Location**: `rooms/laboratory/ui/lab-project-assets-panel.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add a small metadata line for audio assets using the sync helper, for example `Sync: Same timeline`. Keep wording neutral and informational; do not imply synced playback exists.
- **Complexity**: 3
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Same-timeline audio shows a positive sync label.
  - Offset or incomplete metadata shows a fallback label or no label, depending on available signal.
  - Styling stays compact inside the existing asset row design.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - or `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts` after baseline repair

## Sprint 4: Add a Linked Audio Bar Above the Workspace Preview

**Goal**: Surface child-audio availability directly on the source preview without building new playback architecture.

**Demo/Validation**:

- When the current source has linked audio assets, the preview area shows a compact linked-audio bar.
- Clicking an audio item reuses existing preview/open behavior.

### Task 4.1: Render Linked Audio Bar for the Active Source

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Resolve the active source id, call `getLinkedAudioAssets()`, and render a compact bar above the workspace preview such as `This source has extracted audio: audio.wav -> Open`. Support multiple linked audio assets if they exist.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - No linked audio means no extra bar.
  - One or more linked audio assets render in deterministic order.
  - The bar is attached to the current source preview, not the process panel.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - or `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts` after baseline repair

### Task 4.2: Reuse Existing Asset Preview/Open Behavior for the Linked Bar

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Use the existing `asset-preview` action for the linked audio item "Open" control. This keeps the v1 linkage layer small and avoids inventing a new player state machine.
- **Complexity**: 2
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Clicking "Open" behaves the same way as previewing the asset from the assets panel.
  - No new audio-preview state is added to the workspace surface.
  - Markup stays compatible with the existing controller event handling.
- **Validation**:
  - UI regression assertions in a dedicated linkage UI regression file, or in `scripts/tests/laboratory-source-ui-regressions.test.ts` only after baseline repair

### Task 4.3: Style the Linked Audio Bar as Informational, Not Interactive Playback UI

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add minimal styling so the bar reads as linkage metadata, not a second transport bar. Keep it close to the source preview header/area.
- **Complexity**: 2
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Bar feels attached to the current source preview.
  - Styling does not compete with the main media preview controls.
  - Mobile and narrow widths remain readable.
- **Validation**:
  - Visual smoke test after `npm run rooms:build`

## Sprint 5: Regression Coverage and Build Parity

**Goal**: Lock in the data contract and prevent workspace/build/install drift.

**Demo/Validation**:

- Targeted regression suites pass.
- Room build output keeps parity with the shipped/installed copy.

### Task 5.1: Add Selector and Store Regression Coverage

- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Cover:
  - persisted lineage fields
  - `getLinkedAudioAssets()`
  - `getParentSourceForAsset()`
  - null/stale linkage behavior
- **Complexity**: 4
- **Dependencies**: Sprints 1 and 2
- **Acceptance Criteria**:
  - Tests exercise both positive and stale-id cases.
  - Regressions prove the selectors do not require metadata scraping in UI code.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 5.2: Add Host Runtime Coverage for Audio Export Lineage

- **Location**: `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
- **Description**: Extend the existing audio export regression so it asserts top-level lineage fields and sync metadata on the created audio asset.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Audio export test proves the created asset links back to the active source.
  - Sync metadata expectations are explicit for the full-track export path.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 5.3: Add Host Coverage for Source-Asset Lineage Projection

- **Location**: `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
- **Description**: Add or extend a regression that proves asset reuse -> source synthesis projects lineage from source metadata back onto the top-level synthetic source asset. This locks the behavior expected by `getParentSourceForAsset()`.
- **Complexity**: 3
- **Dependencies**: Tasks 1.2 and 1.3
- **Acceptance Criteria**:
  - Source assets created through asset reuse expose top-level `derivedFromAssetId` and `derivedFromSourceId`.
  - Reverse-link selector assumptions are backed by host behavior, not only UI tests.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 5.4: Add Snapshot Serialization Coverage for Lineage Fields

- **Location**: `scripts/tests/laboratory-host-import-smoke-regressions.test.ts` or a new focused room snapshot regression file
- **Description**: Add coverage that a lineage-bearing asset survives room snapshot serialization and reaches the UI-facing snapshot payload with the same top-level lineage fields.
- **Complexity**: 3
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Lineage fields survive host -> snapshot -> UI payload boundaries.
  - No metadata-only fallback is required for the UI selectors to work.
- **Validation**:
  - `npm run rooms:test:file -- <chosen snapshot regression file>`

### Task 5.5: Add UI Regression Coverage for Panel and Preview Bar

- **Location**: a new dedicated linkage UI regression file such as `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`, or `scripts/tests/laboratory-source-ui-regressions.test.ts` only if its baseline is fixed first
- **Description**: Add assertions for:
  - audio row parent source label
  - clickable source-preview action markup
  - sync label
  - linked audio bar above the preview
- **Complexity**: 4
- **Dependencies**: Sprints 3 and 4
- **Acceptance Criteria**:
  - New linkage assertions are not hidden behind an already-failing baseline.
  - The requested user journey is covered:
    - upload video
    - extract audio
    - assets panel shows source linkage
    - preview shows linked audio access
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - or `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts` after baseline repair

### Task 5.6: Rebuild Room Output and Run Parity Checks

- **Location**: workspace build output and parity suites
- **Description**: Rebuild the room package and rerun parity checks that already track `ui/workspace-surface.js` parity between workspace, built artifact, and installed copy.
- **Complexity**: 3
- **Dependencies**: Sprints 3 and 4
- **Acceptance Criteria**:
  - Built room output includes the updated UI files.
  - Installed/shipped parity remains intact after rebuild.
- **Validation**:
  - `npm run rooms:build`
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`

## Testing Strategy

- Start with the contract:
  - `npm run rooms:typecheck`
- Then run targeted regressions as each sprint lands:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- <chosen snapshot regression file>`
  - `npm run rooms:test:file -- scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
- Finish with build/parity confidence:
  - `npm run rooms:build`
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`
- Manual smoke path after implementation:
  - Load a video source
  - Run audio extract
  - Confirm the audio asset row shows parent source + sync label
  - Confirm clicking the source label focuses the preview
  - Confirm the preview area shows the linked-audio bar and "Open" control

## Potential Risks & Gotchas

- `sourceId` / source-asset-id coupling is an important current invariant. If that changes later, `getParentSourceForAsset()` must stop assuming `derivedFromSourceId` can directly match an asset id.
- Historical projects may contain lineage only inside source metadata, not top-level asset fields. The migration path must preserve compatibility rather than forcing destructive rewrites.
- `asset-updated` patch merges can accidentally wipe lineage if `undefined` fields are spread carelessly.
- The requested "go to source preview" behavior is only straightforward when the linked source is also the currently active source preview. Non-active-parent cases need an explicit safe fallback.
- Full-track audio extraction can truthfully claim "same timeline", but future clip-based or partial extraction flows will need richer sync semantics before reusing the same label.
- The preview linked-audio bar should support more than one audio child asset. Even if the common path is one extracted WAV, the selector should not hardcode a single result.
- The existing `laboratory-source-ui-regressions` baseline is already failing, so it should not be treated as the sole acceptance signal for this feature unless repaired first.
- UI copy should not imply real synchronized playback exists yet.

## Rollback Plan

- Revert `LabAsset` lineage field additions and schema updates if persistence proves unstable.
- Remove the new selectors and UI affordances while keeping audio export behavior unchanged if only the presentation layer causes churn.
- If room build/install parity drifts, revert the affected `rooms/laboratory/ui/*` changes, rebuild with `npm run rooms:build`, and rerun parity tests before retrying.
