# Plan: Laboratory Action Visibility Feedback Layer

**Generated**: 2026-04-23
**Estimated Complexity**: Medium

## Overview

Add a read-only feedback layer in the Laboratory room that answers three user-facing questions for tracked actions:

- what did I start?
- what is happening now?
- what was produced?

The room already has the first half of the foundation:

- `userActions` state exists
- the topbar action hub already renders action status
- the Process panel already has a `Son işlemler` section
- exported outputs already become durable project assets

The missing piece is the action-to-output link. The plan is to thread created asset IDs through the existing host event pipeline, store them on tracked `userActions`, and render those linked outputs in the topbar and recent-actions UI without touching analysis-state semantics.

## Current Repo State

- `rooms/laboratory/models/lab-types.ts` already defines `LabUserActionEvent`, `LabAsset`, and `LabStoreEvent`.
- `rooms/laboratory/runtime/lab-user-actions.ts` already centralizes tracked export/report labels and success/error copy.
- `rooms/laboratory/runtime/lab-store.ts` already has:
  - `user-action-added`
  - `user-action-updated`
  - host-event reconciliation for tracked actions
- `rooms/laboratory/runtime/lab-selectors.ts` already exposes:
  - `getUserActions`
  - `getRecentUserActions`
  - `getHubUserActions`
  - asset registry selectors
- `rooms/laboratory/ui/lab-topbar-actions.ts` already renders the progress hub.
- `rooms/laboratory/ui/workspace-process-panel.ts` already renders `Son işlemler`.
- `rooms/laboratory/runtime/lab-run-controller.ts` already supports `asset-preview` and `asset-download`.
- `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts` already creates durable export assets.
- `rooms/laboratory/shared/host/reporting-export.ts` already creates durable report assets.
- `rooms/laboratory/shared/host/runtime-events.ts` already preserves request/job/project correlation metadata.
- Export/report completion can reach the UI before the refreshed snapshot does.
  Result-link selectors therefore need to tolerate temporarily unresolved `resultAssetIds`.

## Scope Decisions

- This layer stays strictly inside the `userActions` lane.
  It does not change `run`, `activityFeed`, module progress, findings, or artifacts semantics.
- The feature is read-only against the asset registry.
  It resolves outputs from `state.assets`; it does not mutate assets from the UI layer.
- V1 covers tracked Laboratory user actions only.
  That means the current export/report actions registered in `lab-user-actions.ts`.
- Result linkage is asset-ID-based, not filename-based.
  This avoids coupling UI state to localized labels or generated filenames.
- `resultAssetIds` stays optional because not every tracked action always produces an asset.
- Multi-output actions are allowed.
  Report exports may link more than one asset; UI should show a primary result plus overflow context if needed.
- `userActions` remains ephemeral.
  Persisting output-linked action chips across reloads is out of scope.
- Do not hand-edit `data/rooms/laboratory/...`.

## Prerequisites

- Current workflow at planning time:
  - `mode:status = terminal`
  - `whereami.effectiveMode = other-provider-cli`
- Future implementation should continue under `workflow:terminal-mode` unless runtime mode changes before coding starts.
- Existing targeted tests already cover the main seams:
  - `scripts/tests/laboratory-runtime-event-v2-regressions.test.ts`
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-report-composition-v2-regressions.test.ts`
- Validation commands:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- <targeted laboratory tests>`

## Sprint 1: Thread Action Results Through The Existing Event Chain

**Goal**: make tracked user actions capable of carrying linked output asset IDs without introducing a parallel state model.

**Demo/Validation**:

- A completed tracked export/report action contains `resultAssetIds`.
- The asset IDs survive the host event pipeline and patch the matching `userActions` entry.
- Analysis `run` behavior stays unchanged.

### Task 1.1: Extend The User Action Contract

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
- **Description**:
  Add `resultAssetIds?: string[]` to `LabUserActionEvent`. Add the same optional field to `LabEventFeedItem` so result IDs can travel through canonical `lab-event` messages without broadening store-event contracts that already reconcile through `host-event-received`.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabUserActionEvent` can store zero, one, or many asset IDs.
  - The host-event shape supports optional `resultAssetIds`.
  - Existing action rendering compiles without forcing immediate UI changes.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Return Created Assets From Export/Report Boundaries

- **Location**:
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  - `rooms/laboratory/shared/host/reporting-export.ts`
  - `rooms/laboratory/shared/host/lab-assets.ts` if helper return types need to be formalized
- **Description**:
  Update the host-side output creation flow so durable asset creation yields the created asset object or asset ID at the call site. For media exports, `registerOutputAsset(...)` should return the created asset instead of silently patching project state only. For report export, preserve the existing two-asset creation flow and capture both IDs in order.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Frame, clip, ROI image, audio, and report exports can capture created asset IDs.
  - No file-generation behavior changes.
  - Asset registry remains the source of truth.
- **Validation**:
  - Extend `scripts/tests/laboratory-host-action-runtime-regressions.test.ts` with asset-ID assertions for at least frame and audio exports
  - Extend `scripts/tests/laboratory-host-action-runtime-regressions.test.ts` or `scripts/tests/laboratory-report-composition-v2-regressions.test.ts` for report multi-output ordering
  - Add source-level assertions that completed `pushJobState(...)` payloads carry `resultAssetIds`, not just that assets exist after the run

### Task 1.3: Emit Result Asset IDs On Completed Host Events

- **Location**:
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  - `rooms/laboratory/shared/host/reporting-export.ts`
  - `rooms/laboratory/shared/host/runtime-events.ts`
- **Description**:
  When a tracked export/report job completes, include `resultAssetIds` in the canonical completed event payload. Keep the existing request/job/project correlation fields intact. The event layer should preserve `resultAssetIds` in the same way it already preserves `requestId`, `jobId`, and `projectId`.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Completed export/report `lab-event` payloads include `resultAssetIds`.
  - Failed or cancelled events do not need fake result IDs.
  - Canonical runtime-event transport still behaves the same for non-output actions.
- **Validation**:
  - Extend `scripts/tests/laboratory-runtime-event-v2-regressions.test.ts`
  - Assert correlation metadata plus `resultAssetIds` on completed export/report events

### Task 1.4: Patch User Actions From Host Events Using Result IDs

- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
- **Description**:
  Update tracked-action reconciliation so completed host events patch the matching `userActions` item with `resultAssetIds` in addition to success status/message. Reuse the existing `patchUserAction(...)` path and do not introduce a second reconciliation channel.
- **Complexity**: 4
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - A completed tracked action moves to `success` and stores linked `resultAssetIds`.
  - Running/error flows continue to work without result IDs.
  - Analysis events still update `run`, not `userActions`.
- **Validation**:
  - Extend `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - Add an assertion that completed tracked actions keep `resultAssetIds`

## Sprint 2: Add Read-Only Selectors For Action Outputs

**Goal**: expose action-linked assets through pure selectors so UI stays declarative and tolerant of event ordering.

**Demo/Validation**:

- Selectors resolve `userAction -> assets[]` from state.
- If the success event arrives before the snapshot, selectors safely return `[]` until assets hydrate.
- UI can ask for a primary result label without peeking into host internals.

### Task 2.1: Add Asset Lookup Helpers

- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  Add a small `getAssetById(state, id)` selector and keep it asset-registry-only. This becomes the primitive for resolving action outputs without duplicating lookup loops in multiple UI files.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Lookup returns the current registry asset or `null`.
  - Missing IDs never throw.
  - Selector does not inspect `run.artifacts` or preview artifacts.
- **Validation**:
  - Add a focused selector assertion in `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 2.2: Add `getActionOutputs(...)`

- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  Add `getActionOutputs(state, actionId)` that finds the matching user action, resolves `resultAssetIds` through `getAssetById`, and filters out unresolved entries. Keep the API intentionally narrow so the UI never has to reconstruct action-output joins itself.
- **Complexity**: 3
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Unknown action IDs return `[]`.
  - Missing/unresolved result IDs are ignored safely.
  - Multi-output actions preserve ID order when assets are resolved.
- **Validation**:
  - Extend runtime-truth tests with single-output and multi-output cases

### Task 2.3: Add Output Presentation Helpers

- **Location**:
  - `rooms/laboratory/runtime/lab-user-actions.ts`
  - a tiny shared UI helper if needed for metadata formatting reuse
- **Description**:
  Add small pure helpers for:
  - primary output label text
  - overflow text such as `+1`
  - output availability checks
  - tooltip-safe metadata text for resolved assets

  Keep the helpers presentation-oriented only. They should not trigger preview, download, or state changes. Metadata extraction should be explicitly shared or reused from the current asset-panel formatting rule so topbar and process-panel tooltips do not drift.
- **Complexity**: 3
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Running actions can render without outputs.
  - Success actions can render `Action message -> asset name`.
  - Tooltip copy can be derived from existing asset fields and remain resilient when metadata is sparse.
- **Validation**:
  - `npm run rooms:typecheck`
  - Use source-ui regression assertions for rendered text once Sprint 3 lands

## Sprint 3: Surface Action Results In Topbar And Process Panel

**Goal**: make the existing action surfaces answer “what happened” and “what was produced” without mixing with analysis widgets.

**Demo/Validation**:

- Topbar running action still shows progress copy.
- Topbar success action shows a linked output label when one exists.
- Process panel recent actions render `action -> result` mini blocks.
- Clicking a linked result reuses existing asset preview behavior.

### Task 3.1: Upgrade Topbar Hub Items Into Action Detail Chips

- **Location**:
  - `rooms/laboratory/ui/lab-topbar-actions.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  Enhance the existing topbar action renderer so:
  - running items stay status-first
  - success items can render `Frame alındı -> frame_01.png`
  - linked output text is clickable and routes to preview
  - hover metadata comes from the resolved asset tooltip helper

  Reuse the existing button/action conventions instead of adding ad-hoc DOM behavior.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Topbar still supports running, success, and error tones.
  - Success rows can preview their primary output through the same asset-preview route the asset panel uses.
  - No output means the chip gracefully falls back to plain success text.
- **Validation**:
  - Extend `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - Add assertions for linked output text and preview affordance markup

### Task 3.2: Enrich `Son işlemler` Into Action-Result Blocks

- **Location**:
  - `rooms/laboratory/ui/workspace-process-panel.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  Keep the existing recent-actions section, but enrich each row with a second line or inline result block that shows the linked output. The section should remain clearly separate from pipeline/findings/artifacts so it reads as `USER ACTION`, not `ANALYSIS`.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The section still renders when there is no run.
  - Completed actions with outputs show `action -> asset`.
  - Running/error rows remain readable even without outputs.
  - The section does not read from `run.events`.
- **Validation**:
  - Extend `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - Optionally add a structural string assertion in `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 3.3: Wire Preview Clicks Through Existing Controller Actions

- **Location**:
  - `rooms/laboratory/runtime/lab-run-controller.ts`
  - UI files from Tasks 3.1 and 3.2 if new `data-lab-action` values are introduced
- **Description**:
  Prefer reusing `asset-preview` directly when rendering a resolved result asset. If markup constraints require a new semantic action like `user-action-output-preview`, map it immediately back to the existing `previewAsset(...)` controller path.
- **Complexity**: 2
- **Dependencies**: Tasks 3.1 and 3.2
- **Acceptance Criteria**:
  - Clicking a result output opens the same preview behavior as the asset panel.
  - No new preview logic duplicates asset lookup/opening rules.
  - Keyboard-accessible button/link semantics are preserved.
- **Validation**:
  - Source-ui regression checks for `data-lab-action`
  - Add one controller/runtime regression that clicks the new result affordance and proves it routes through the existing `asset-preview` path
  - Manual smoke for click-to-preview

## Sprint 4: Lock The Behavior With Focused Regressions

**Goal**: protect the new layer against the two likely regressions: stream coupling and missing output linkage.

**Demo/Validation**:

- A tracked export action can go running -> success -> linked asset.
- The UI can render the linked result after state snapshot hydration.
- Analysis-state regressions remain covered.

### Task 4.1: Add Store And Selector Regressions

- **Location**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**:
  Add tests for:
  - tracked action success with `resultAssetIds`
  - `getActionOutputs(...)` resolving current assets
  - unresolved result IDs safely collapsing to `[]`
- **Complexity**: 3
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Store tests prove that user-action success does not mutate `run`.
  - Selector tests cover single-result and multi-result actions.
- **Validation**:
  - `node --import tsx --test scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 4.2: Add Transport Regressions For Result IDs

- **Location**:
  - `scripts/tests/laboratory-runtime-event-v2-regressions.test.ts`
- **Description**:
  Extend canonical host-event transport tests so completed export/report events preserve `resultAssetIds` together with `requestId`, `jobId`, and `projectId`.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Event transport keeps result IDs intact.
  - Non-output events remain unaffected.
- **Validation**:
  - `node --import tsx --test scripts/tests/laboratory-runtime-event-v2-regressions.test.ts`

### Task 4.3: Add UI Rendering Regressions

- **Location**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts` if needed
- **Description**:
  Protect the user-facing copy and separation rules:
  - topbar shows running/progress state
  - success rows can render output-linked text
  - Process panel recent actions remain separate from analysis sections
- **Complexity**: 3
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Test HTML includes output-linked text and preview action markup.
  - Existing action-hub smoke keeps passing.
  - No assertion accidentally binds `Son işlemler` to `run.events`.
- **Validation**:
  - `node --import tsx --test scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

## Testing Strategy

- Run `npm run rooms:typecheck` after each sprint-sized change.
- Prefer focused Laboratory regressions during iteration:
  - runtime-event transport
  - runtime truth/store selectors
  - host export/report runtime
  - source UI rendering
  - report export composition
  - built room UI evaluation when new UI helpers/imports are introduced
- Manual smoke checklist:
  - load a Laboratory project with a valid source
  - trigger frame export
  - confirm topbar shows a running item
  - wait for completion and confirm the topbar shows `success -> asset`
  - click the output and confirm asset preview opens
  - inspect hover text for metadata
  - confirm `Son işlemler` shows `action -> result`
  - trigger a deep analysis run and confirm process pipeline remains analysis-only
  - export during or after analysis and confirm the new layer still reads from `userActions`, not `run`
  - export a report and confirm multi-output behavior is sensible

## Potential Risks & Gotchas

- The user’s requested `updateUserAction(actionId, ...)` concept already exists semantically as `user-action-updated` plus store patching.
  Implementation should reuse that path instead of inventing another updater abstraction.
- Host-event ordering matters.
  Completed events can arrive before or near snapshot updates, so selectors must tolerate `resultAssetIds` that resolve later when assets hydrate.
- Preview wiring is already testable through the existing controller seam.
  At least one targeted regression should prove the new result affordance reaches `asset-preview`.
- Report export may create more than one asset.
  UI needs a primary-display rule, not an assumption that every action yields exactly one file.
- Tooltip metadata is already assembled inside the asset panel.
  Duplicating that logic in two more UI surfaces can drift unless the formatting rule is lightly shared.
- Not every success action should be forced to show an output.
  If no linked asset exists, the UI should stay success-only instead of rendering broken arrows or placeholder filenames.
- Keep the stream split explicit:
  - analysis progress belongs to `run`
  - user-triggered export/report feedback belongs to `userActions`
- Do not accidentally treat preview artifacts or analysis artifacts as action outputs.
  The layer should resolve only durable registry assets via `state.assets`.

## Rollback Plan

- Revert result-ID plumbing independently from UI changes if host-event transport becomes unstable.
- Remove topbar/process-panel output rendering while keeping the existing action hub and recent-actions list intact.
- Revert report multi-output handling separately if it complicates the initial release; media export linkage can still ship first.
- Because the feature is read-only over existing assets, rollback does not require asset migration or persisted-state cleanup.
