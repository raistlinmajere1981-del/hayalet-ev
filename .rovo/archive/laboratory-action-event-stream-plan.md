# Plan: Laboratory Action Event Stream

**Generated**: 2026-04-23
**Estimated Complexity**: Medium

## Overview
The laboratory room already has most of the action-stream foundation in place. The remaining work is not to invent a new queue from scratch, but to finish the transport wiring, surface the existing queue in the UI, and remove the export-vs-analysis concurrency conflict.

The revised implementation focus is:
- keep `LabRun` and analysis events as the analysis-only stream
- keep the already-landed `userActions` queue as the user-action-only stream
- finish `requestId` / `jobId` / `projectId` propagation from host runtime events so the existing store reconciliation works reliably
- mount the existing queue into a topbar hub and a process-panel history section
- fix export handlers so clip/frame/ROI export does not cancel an active analysis run

## Current Repo State
- Action-event types already exist in:
  `rooms/laboratory/models/lab-types.ts`
- `userActions` state plus reducer events already exist in:
  `rooms/laboratory/runtime/lab-store.ts`
- tracked labels/history windows already exist in:
  `rooms/laboratory/runtime/lab-user-actions.ts`
- selectors for hub/recent slices already exist in:
  `rooms/laboratory/runtime/lab-selectors.ts`
- controller-side tracked action creation and success-dismiss timers already exist in:
  `rooms/laboratory/runtime/lab-run-controller.ts`

## Scope Decisions
- `userActions` stays ephemeral by default.
  Persistence is out of scope unless product explicitly wants cross-refresh action history.
- No new ID dependency is required.
  Reuse the room's existing request/action ID generation approach.
- The critical concurrency bug is concentrated in media export handlers:
  `export-timeline-clip`, `export-frame-grab`, `export-roi-image`
- Report export uses a separate runtime/job-slot path and is lower risk for the concurrent export-plus-analysis scenario.
- The critical product rule remains:
  `user action !== analysis run`

## Prerequisites
- Existing runtime event chain:
  `rooms/laboratory/runtime/lab-run-controller.ts`
  `rooms/laboratory/runtime/lab-host-bridge.ts`
  `rooms/laboratory/shared/host/runtime-events.ts`
- Existing host export/runtime files:
  `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  `rooms/laboratory/shared/host/job-state.ts`
  `rooms/laboratory/shared/host/reporting-export.ts`
- Validation commands:
  `npm run rooms:typecheck`
  `node --import tsx --test <targeted-laboratory-tests>`

## Sprint 1: Finish Event Correlation
**Goal**: Make the already-existing `userActions` queue reconcile reliably from host/runtime events.
**Demo/Validation**:
- Starting a tracked export creates a local running action immediately.
- Host queued/completed/failed events update that same action via `requestId` correlation.

### Task 1.1: Preserve Correlation Metadata In Runtime Events
- **Location**:
  `rooms/laboratory/shared/host/runtime-events.ts`
- **Description**:
  Update `buildJobEventPayload(...)` and `buildActionResultEventPayload(...)` so canonical job/result events keep `requestId`, `jobId`, and `projectId` when those values exist. The store already expects that metadata, so this task should complete the transport rather than redesign the store.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - Export job events reaching the UI still include correlation metadata.
  - Request-result events preserve enough metadata for the existing `userActions` reconciliation path.
  - `LabRun` event handling stays unchanged for analysis events.
- **Validation**:
  - Update `scripts/tests/laboratory-runtime-event-v2-regressions.test.ts`
  - Add a focused assertion for metadata preservation

### Task 1.2: Tighten Store-Level Separation Assertions
- **Location**:
  `rooms/laboratory/runtime/lab-store.ts`
  `rooms/laboratory/runtime/lab-selectors.ts`
  `scripts/tests/laboratory-state-persistence-v2-regressions.test.ts`
- **Description**:
  Verify that export lifecycle events land only in `userActions` reconciliation paths and do not mutate `run` semantics beyond the normal global activity/event feed behavior. Prefer minimal store changes only if gaps appear after Task 1.1.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Tracked export success/error updates the matching `userActions` entry.
  - Analysis state continues to flow through `run` only.
  - No persistence changes are introduced for `userActions`.
- **Validation**:
  - Add a targeted regression asserting:
    export lifecycle -> `userActions`
    analysis lifecycle -> `run`

## Sprint 2: Surface The Existing Queue In UI
**Goal**: Expose the existing `userActions` queue in the two places the user asked for.
**Demo/Validation**:
- Running and recent user actions are visible without affecting the analysis pipeline widgets.
- The process panel still renders correctly with or without an active analysis run.

### Task 2.1: Add The Topbar Progress Hub
- **Location**:
  `rooms/laboratory/ui/lab-topbar-actions.ts`
  `rooms/laboratory/ui/workspace-surface.ts`
  `rooms/laboratory/ui/lab-theme.css`
- **Description**:
  Create a dedicated renderer for the topbar hub and mount it near the existing source bar/workspace header using `getHubUserActions(...)`. Show:
  running -> spinner
  success -> checkmark until the existing dismiss timer expires
  error -> red error state
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Clip/frame/report-style actions appear in the topbar while active.
  - Success items disappear from the hub after the already-landed dismiss window.
  - The hub uses `userActions`, not `run.events`, as its source of truth.
- **Validation**:
  - `npm run rooms:typecheck`
  - Manual laboratory UI smoke

### Task 2.2: Add The Process Panel Recent Actions Section
- **Location**:
  `rooms/laboratory/ui/workspace-process-panel.ts`
  `rooms/laboratory/ui/lab-theme.css`
  `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  Add a `Son islemler` mini section using `getRecentUserActions(...)`, relative-time copy, and action result text. Keep it visually separate from pipeline/findings/artifacts so the action stream cannot be mistaken for the analysis stream.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The section renders recent exports even while an analysis run is active.
  - The section still renders sensibly when there is no current `LabRun`.
  - V1 stays non-collapsible unless collapsed-section persistence is intentionally extended.
- **Validation**:
  - Manual laboratory UI smoke
  - Optional structure assertion in `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

## Sprint 3: Remove Export vs Analysis Cancellation Conflict
**Goal**: Allow export actions to coexist with a live analysis run without weakening destructive project/source flows.
**Demo/Validation**:
- Export clip can start while deep analysis is already running.
- The analysis run continues.
- The export action still gets tracked in `userActions`.

### Task 3.1: Add Export-Specific Cancellation Behavior
- **Location**:
  `rooms/laboratory/main-functions/media-analysis/host/action-handlers-export.ts`
  `rooms/laboratory/shared/host/job-state.ts`
- **Description**:
  Do not broadly weaken `cancelJobsForProject(...)`, because other destructive flows depend on it. Instead, add a more local/export-specific path:
  either filter cancellations at the export call sites or add a narrower helper that cancels only conflicting export jobs.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `export-timeline-clip`, `export-frame-grab`, and `export-roi-image` do not cancel a live `process-run`.
  - Source-replacement and destructive project flows keep their stricter cancellation behavior.
  - Report export behavior remains unchanged unless testing shows a concrete gap.
- **Validation**:
  - Update `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - Manual concurrent export-plus-analysis smoke

### Task 3.2: Add The Critical Separation Regression
- **Location**:
  `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  `scripts/tests/laboratory-runtime-event-v2-regressions.test.ts`
  `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**:
  Add focused regressions for the user's non-negotiable rule:
  export lifecycle updates `userActions`
  analysis lifecycle updates `run`
  concurrent export does not freeze or cancel analysis
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Transport regression covers preserved correlation metadata.
  - Host regression covers clip/frame export while analysis is running.
  - At least one regression explicitly protects the stream split:
    `user action != analysis run`
- **Validation**:
  - `node --import tsx --test scripts/tests/laboratory-runtime-event-v2-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

## Testing Strategy
- Run `npm run rooms:typecheck` after each sprint-sized change.
- Prefer targeted laboratory regressions over the full rooms suite during iteration.
- Manual smoke matrix:
  - Load a video source.
  - Trigger clip export.
  - Immediately trigger deep analysis.
  - Confirm the UI stays interactive.
  - Confirm the topbar hub shows the export action.
  - Confirm `Son islemler` shows the export history.
  - Confirm the analysis pipeline still reflects only `run` progress.
  - Confirm export success/error changes only `userActions`.

## Potential Risks & Gotchas
- The transport gap is now the primary blocker.
  The store/controller foundation already exists, but host runtime events still rebuild payloads in ways that can drop correlation metadata.
- `userActions` should stay non-persisted unless product explicitly changes the requirement.
  Persisting ephemeral export chips would resurrect stale running/success/error state after reload.
- The shared `cancelJobsForProject(...)` primitive is used by destructive flows outside exports.
  Do not turn it into a globally weaker helper just to solve export concurrency.
- Report export uses a separate report-runtime/job-slot path.
  Treat it as a separate verification item, not the main concurrency fix target.
- Keep the new UI strictly selector-driven from `userActions`.
  Pulling from `run.events` would silently re-couple the two streams.

## Rollback Plan
- Revert runtime-event metadata preservation independently from UI changes if transport updates misbehave.
- Remove the topbar hub mount and process-panel recent-actions section without touching the existing action queue foundation.
- Revert export-specific cancellation handling without changing global destructive-flow cancellation semantics.
