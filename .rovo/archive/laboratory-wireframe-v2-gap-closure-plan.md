# Plan: Laboratory Wireframe v2 Gap Closure

**Generated**: 2026-04-28
**Estimated Complexity**: High
**Source Spec**: `laboratory-wireframe-v2-c63f98.md`
**Current Workflow Context**: `mode:status=terminal`, `whereami.effectiveMode=other-provider-cli`; plain terminal workflow, no app/ghost transition required for planning.

## Overview
This plan compares the deterministic Wireframe v2 spec with the current working tree and turns the remaining gaps into implementation sprints. The current code has already moved the Laboratory shell toward the new design: `lab-layout.ts` renders `lab-top-bar`, `lab-center-panel`, `lab-drawer`, and `lab-process-strip`, and `lab-theme.css` contains the 48px/1fr/56px shell grid with a 22rem drawer.

The transition is not complete yet. The visual shell is mostly switched over, but several behavior contracts still point at old surfaces or have unhandled action names. The highest-priority work is to make the new controls actually drive the runtime, then move the remaining center-stage source/process controls into their new homes, then retire old rail/right-panel/process-panel code and stale tests.

## Current State Summary
- New shell layout is active in `rooms/laboratory/ui/lab-layout.ts`.
- `rooms/laboratory/ui/lab-root.ts` mounts and updates top bar, center panel, drawer, and process strip directly.
- `LabDrawerMode`, `userExploreToggle`, and `drawerCollapsed` exist in `rooms/laboratory/models/lab-types.ts` and are persisted/hydrated through `lab-store.ts`.
- `resolveDrawerMode`, report freshness, workspace diff, process summary, elapsed seconds, and intent preview selectors exist in `rooms/laboratory/runtime/lab-selectors.ts`.
- The old `data-lab-stage` pathway is neutralized in `lab-run-controller.ts`, so stage clicks no longer drive behavior.
- Old UI files remain: `lab-left-rail.ts`, `lab-right-panel.ts`, and `workspace-process-panel.ts`.
- Old center-stage pieces remain in `workspace-surface.ts`: source intake, global process summary, topbar action chips, and legacy compact analysis/report controls.

## Verification Snapshot
- `npm run rooms:typecheck` passed.
- `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts` passed: 178 tests.
- `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts` failed 2 tests because the test still expects old `renderLabRightPanel` update code and the old 3-column left-rail layout CSS.
- Sub-agent review confirmed the same 2 stale UI failures and found additional inert action/name gaps: `workspace-intent-toggled`, `workspace-process-view-toggled`, and report/cancel action canonicalization.
- No Electron smoke was run because the app is currently closed and the active surface is `other-provider-cli`.

## Gap Matrix

| Spec Area | Current Evidence | Status | Required Closure |
|---|---|---:|---|
| Final shell grid | `lab-theme.css` has `48px minmax(0,1fr) 56px` rows and `minmax(0, 1fr) 22rem` columns. | Mostly done | Add responsive and screenshot smoke checks after cleanup. |
| Top bar | `lab-top-bar.ts` renders project button, mode pills, and tool button. | Partial | Wire project dropdown and pill actions in controller/store; define source pill behavior without breaking derived mode rule. |
| Drawer mode derivation | `resolveDrawerMode` exists and resets explore toggle on running host events. | Partial | Add source-removed guard, feature-report freshness handling, stale/empty/cancelled mode tests. |
| Drawer collapse | Render and state exist. | Partial | Controller does not handle `drawer-collapsed-toggled`; add click and `Ctrl+B` keyboard handling. |
| Drawer Setup | Current drawer shows source placeholder/intents/preflight/CTA, but full source intake remains in center stage. | Incomplete | Move or project the real source intake controls into Setup drawer and remove center-stage duplicate. |
| Drawer Running | Pipeline and early signals render from `run`. | Partial | Add frozen run snapshot display and ensure cancel action is explicit. |
| Drawer Result | Decision cards, warnings, report CTA, advisories render. | Partial | Use structured coherence/readiness/bridge outputs from runtime helpers instead of candidate summary approximations. |
| Drawer Explore | Workspace diff and re-analyze CTA render. | Partial | Render execution alternatives and tweak controls; handle no-source force to Setup. |
| Process strip | `lab-process-strip.ts` renders dots/progress/timer/action buttons. | Partial | Add per-second heartbeat, expanded recent-actions/log content, warning/cancelled/empty-result semantics. |
| Center stage | Media viewport, timeline, hypothesis/focus/bookmarks still render in `workspace-surface.ts`. | Partial | Keep viewport/timeline/focus here, but remove source intake/global process/topbar action duplicates. |
| Report CTA | Drawer uses `data-lab-action="report-overlay-open"`; controller handles `open-report-overlay`. | Broken | Normalize action name or support alias; add regression. |
| Intent toggles | Drawer emits `workspace-intent-toggled`, while controller currently handles `workspace-intent-toggle`. | Broken | Canonicalize to one action string and add a rendered-action coverage test. |
| Process log toggle | Strip emits `workspace-process-view-toggled`; store supports the event but controller has no action case. | Broken | Add controller handling or rename to the existing handled action. |
| Topbar actions | `topbar-pill-*` and `project-selector` render but are not handled. | Broken | Add controller/store handling and tests. |
| Boot/loading | Drawer skeleton exists, but center skeleton render path is not proven. | Partial | Add `data-ready=false`, drawer skeleton, and center skeleton coverage. |
| Old UI remnants | Old files and CSS selectors remain and tests import them directly. | Incomplete | Migrate tests, prove reachability, then delete or fence compatibility wrappers. |

## Prerequisites
- Treat `rooms/laboratory` as source of truth; do not hand-edit `data/rooms/laboratory`.
- Preserve user/uncommitted changes already present in the working tree.
- Before application code edits, use the repo's change approval protocol and choose workflow from fresh `npm run mode:status` + `npm run whereami`.
- Use `npm run laboratory:cleanup:inventory` and focused `rg` checks before deleting legacy files.

## Sprint 1: Activate New Shell Actions
**Goal**: Every visible v2 control dispatches a handled action, and no rendered `data-lab-action` is inert.

**Demo/Validation**:
- Click drawer collapse/expand, Explore toggle, report CTA, intent toggles, top bar tool button, and process strip retry/cancel/log in a UI smoke.
- Add a regression that extracts rendered `data-lab-action` values from new components and asserts each has a controller/store path.

### Task 1.1: Normalize Drawer Report CTA
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Replace `report-overlay-open` with the existing `open-report-overlay`, or add an explicit alias in the controller. Prefer one canonical action string.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Drawer Result CTA opens `reportOverlayOpen`.
  - No duplicate report action names remain unless aliases are intentionally tested.
- **Validation**: Add/update a focused UI/controller regression and run `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 1.2: Handle Drawer Collapse and Explore Actions
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add click handling for `drawer-collapsed-toggled` and `drawer-explore-toggled` so the existing store events are reachable.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1 optional
- **Acceptance Criteria**:
  - Collapse button toggles `state.ui.workspace.drawerCollapsed`.
  - Explore toggle switches Result/Explore when a report exists and does not create invalid modes without a report.
- **Validation**: Store/controller unit tests plus rendered drawer assertions.

### Task 1.3: Add `Ctrl+B` Drawer Shortcut
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts` or `rooms/laboratory/ui/lab-root.ts`
- **Description**: Implement the spec shortcut with form-field guards so typing in inputs/textareas is not interrupted.
- **Complexity**: 3/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `Ctrl+B` toggles drawer collapse.
  - Shortcut is ignored inside editable fields.
- **Validation**: Controller keyboard regression.

### Task 1.4: Define and Wire Top Bar Pill Behavior
- **Location**: `rooms/laboratory/ui/lab-top-bar.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Implement `topbar-pill-source`, `topbar-pill-analyze`, and `topbar-pill-results`. Resolve the spec contradiction explicitly before coding: either add a real `requestedDrawerMode` or `setupOverride` field consumed by `resolveDrawerMode`, or revise the spec so Source is a focus-only action and cannot force Setup over valid Result/Explore state.
- **Complexity**: 6/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Analyze pill remains informational/no-op.
  - Results pill clears explore override or opens result when a report exists.
  - Source pill behavior is covered for no-report, current-report, stale-report, and running states.
  - Source pill opens source/setup focus only when not running and does not break report freshness rules.
- **Validation**: Selector/store tests for each pill path.

### Task 1.5: Implement Project Selector Surface
- **Location**: `rooms/laboratory/ui/lab-top-bar.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, project selector helpers from existing project asset UI
- **Description**: Replace the inert `project-selector` button with a compact dropdown/menu that lists projects and emits existing `project-select` actions.
- **Complexity**: 5/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Active project name displays correctly.
  - Dropdown switches project through existing store/host behavior.
  - Empty project state shows `Yeni Proje`.
- **Validation**: Render and controller tests for active, empty, and switch states.

### Task 1.6: Close Remaining Rendered Action Mismatches
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Canonicalize currently mismatched v2 action names: `workspace-intent-toggled` versus `workspace-intent-toggle`, and `workspace-process-view-toggled` versus the store event/controller action path.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1 optional
- **Acceptance Criteria**:
  - Drawer intent checkboxes update `selectedIntents` through a handled controller path.
  - Process strip log toggle reaches `workspace-process-view-toggled` state.
  - Rendered action coverage test fails on any future unhandled v2 action string.
- **Validation**: Controller/render regression that enumerates `data-lab-action` values from `lab-drawer.ts`, `lab-top-bar.ts`, and `lab-process-strip.ts` fixtures.

### Task 1.7: Refresh Stale V2 Shell Tests Early
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Convert the two known stale expectations to the new v2 shell before deeper migration work, so the test suite becomes useful during later sprints.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Preview diff test expects top bar, center panel, drawer, and process strip updates instead of `renderLabRightPanel`.
  - Theme test expects the v2 grid and drawer collapse behavior instead of the old 3-column left rail.
- **Validation**: `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts` passes or only fails on new migration work.

### Task 1.8: Canonicalize Start, Retry, and Cancel Actions
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Split cancel semantics from `run-deep-analysis` if needed. Recommended contract: keep `run-deep-analysis` for start/retry and add an explicit `cancel-analysis` or `process-cancel` UI action for running-state cancel buttons.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1 optional
- **Acceptance Criteria**:
  - Start, retry, and cancel can be tested independently.
  - Cancel does not depend on a CTA label or ambiguous branch behavior.
- **Validation**: Controller regression for start, retry after failed run, and cancel during running run.

## Sprint 2: Complete Mode and Layout Migration
**Goal**: The active user workflow follows the v2 layout, with source setup in the drawer, media/timeline in center, process state in the strip, and result/explore in the drawer.

**Demo/Validation**:
- Initial no-source state shows top bar, center empty viewport, Setup drawer source controls, idle process strip.
- Source-ready state shows media/timeline in center and intents/preflight/CTA in drawer.
- Running state locks setup controls and shows Running drawer plus process strip.
- Completed state shows Result drawer and complete strip.

### Task 2.1: Move Real Source Intake Into Drawer Setup
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-drawer.ts`, possible new source-intake renderer module
- **Description**: Extract source intake rendering from `workspace-surface.ts` so Setup drawer can render the actual source mode/kind/import controls. Center stage should keep only the compact source summary bar.
- **Complexity**: 7/10
- **Dependencies**: Sprint 1 action wiring
- **Acceptance Criteria**:
  - Full source intake controls are no longer rendered in center stage.
  - Existing source intake actions still work and remain locked during running.
  - Source intake collapse state is preserved as the spec requires.
- **Validation**: Update `laboratory-source-ui-regressions.test.ts` and add drawer Setup render assertions.

### Task 2.2: Remove Center Global Process Duplicate
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Retire `renderGlobalProcessSummary` from center stage once the process strip covers all required states.
- **Complexity**: 4/10
- **Dependencies**: Process strip parity tests in Sprint 3
- **Acceptance Criteria**:
  - Center stage no longer contains `data-lab-global-process="true"`.
  - Process strip is the single visible global process layer.
- **Validation**: Update stale UI evaluation assertions.

### Task 2.3: Remove Center Topbar Action Hub or Re-home It
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-topbar-actions.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Decide whether topbar action chips belong in the new top bar or process strip. If not part of v2, remove them from the primary layout after preserving any necessary status affordance in the strip.
- **Complexity**: 4/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - No separate center-stage topbar action hub remains unless explicitly documented as a v2 exception.
  - Success/failure action feedback still has a visible home.
- **Validation**: UI render tests and user action state tests.

### Task 2.4: Tighten Drawer Mode Resolution
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add tests and fixes for source removal, feature-report-only payloads, failed/cancelled runs, stale reports, and empty-result behavior.
- **Complexity**: 5/10
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Source removed forces Setup even if old report records exist.
  - Feature report status and actual report payload agree on freshness semantics.
  - Completed runs with `emptyReason` and no report resolve to Explore before Explore UI work is considered complete.
  - Cancelled/failed states resolve to Setup or Explore according to report presence.
- **Validation**: Selector tests in `laboratory-runtime-truth-regressions.test.ts` or a new focused file.

### Task 2.5: Prove Boot and Loading Skeleton Behavior
- **Location**: `rooms/laboratory/ui/lab-layout.ts`, `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/lab-center-panel.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add a render path and tests for the spec's boot sequence: top bar and process strip render immediately, while drawer and center show skeleton states until ready.
- **Complexity**: 4/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `data-ready="false"` is covered by render tests.
  - Drawer skeleton and center skeleton are both reachable.
  - Top bar and process strip are not hidden by the boot skeleton contract.
- **Validation**: UI evaluation fixture for pre-boot state.

## Sprint 3: Match Component Behavior to the Spec
**Goal**: New components are not just present; their state machines match the wireframe tables.

**Demo/Validation**:
- Use fixture states for no source, source probing, ready source, running, completed, failed, cancelled, stale report, and empty report.
- Assert top bar, drawer, center, and strip render the correct labels and state attributes.

### Task 3.1: Add Structured Advisory Selectors for Result Drawer
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/runtime/lab-decision-coherence.ts`, `rooms/laboratory/runtime/lab-execution-readiness-signal.ts`, `rooms/laboratory/runtime/lab-execution-bridge.ts`, `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Expose structured coherence/readiness/bridge values instead of deriving drawer details from `candidate.summary` and generic readiness fields.
- **Complexity**: 7/10
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Coherence displays `state`, `dominantAxis`, and `confidence`.
  - Readiness displays `level`, `decisionPressure`, and `reasons[]`.
  - Bridge displays `adapter`, `operation`, `inputContract.required[]`, and `outputContract.type`.
  - Auto-expand uses `conflicted` and `strained`, not unrelated status names.
- **Validation**: Result drawer fixture tests plus existing execution runtime tests.

### Task 3.2: Complete Explore Drawer Content
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Render active execution alternatives, comparison, and editable tweak controls for intents/timeline/hypothesis. Keep edits persisted through normal store actions.
- **Complexity**: 6/10
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Alternatives section appears when alternatives exist.
  - Comparison reflects `getWorkspaceDiff`.
  - Tweak controls write to existing workspace state and re-analysis CTA uses updated inputs.
- **Validation**: Explore mode render and store tests.

### Task 3.3: Add Process Strip Heartbeat and Expansion
- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Re-render the strip once per second while running and implement expanded recent-actions/raw-log content for the strip toggle.
- **Complexity**: 6/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Elapsed timer increments while analyzing without needing unrelated store events.
  - Log toggle reveals recent user actions and raw run log in the strip or an attached panel.
  - Toggle hidden in idle and visible in complete/running states per spec.
- **Validation**: Timer fake-clock test and render assertions.

### Task 3.4: Complete Error, Cancelled, Partial, Missing Tool, and Empty Report States
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/runtime/lab-selectors.ts`, run/preflight models as needed
- **Description**: Fill missing table rows from spec sections 8 and 9.
- **Complexity**: 6/10
- **Dependencies**: Tasks 2.4 and 3.3
- **Acceptance Criteria**:
  - Failed runs show red strip progress and retry.
  - Cancelled runs show cancelled labels without retry.
  - Partial results show warning banner and warning dots.
  - Missing dependencies list install affordances and disable CTA only for `will-fail`.
  - Empty report routes to Explore with `emptyReason`.
- **Validation**: Fixture matrix tests.

### Task 3.5: Align Timeline and Viewport Lock Rules
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/ui/workspace-roi-overlay.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Verify the spec's drag/seek/lock behavior against current timeline tests and fill only missing cases.
- **Complexity**: 4/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Drag does not seek in realtime.
  - Mouseup seeks to selection start.
  - Running state disables source intake, timeline handles, ROI creation, and intent selection while leaving viewing controls usable.
- **Validation**: Existing selection/workspace runtime tests plus new lock assertions if missing.

## Sprint 4: Retire Old UI System Remnants
**Goal**: Remove or fence old rail/right-panel/process-panel code after the new layout owns the workflow and tests.

**Demo/Validation**:
- `rg` shows no runtime imports of old components.
- Cleanup inventory identifies no path-loaded dependency on deleted files.
- UI evaluation tests assert new shell contracts, not old layout contracts.

### Task 4.1: Migrate Stale UI and Legacy Component Tests
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, `scripts/tests/laboratory-source-ui-regressions.test.ts`, `scripts/tests/laboratory-project-management-regressions.test.ts`, installed parity tests, `scripts/tests/room-layout-contract-regressions.test.ts`
- **Description**: Replace old `renderLabRightPanel`, `renderLabLeftRail`, `renderWorkspaceProcessPanel`, installed `workspace-process-panel.js`, and 3-column left-rail expectations with v2 shell expectations or explicit compatibility tests.
- **Complexity**: 5/10
- **Dependencies**: Task 1.7 for the first two known failures; Sprints 1-2 for broader source/process migrations
- **Acceptance Criteria**:
  - The failing preview-diff test expects top bar, center panel, drawer, and process strip updates.
  - The failing theme test expects the v2 grid and drawer collapse behavior.
  - Source UI, project management, parity, and room layout contract tests no longer keep old components alive accidentally.
- **Validation**: `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-project-management-regressions.test.ts scripts/tests/room-layout-contract-regressions.test.ts` plus relevant installed parity tests.

### Task 4.2: Prove Old Component Reachability
- **Location**: `rooms/laboratory/scripts/laboratory-cleanup-inventory.ts`, `rooms/laboratory/ui/*`, `scripts/tests/*`
- **Description**: Run cleanup inventory and focused `rg` checks for `renderLabLeftRail`, `renderLabRightPanel`, `renderWorkspaceProcessPanel`, installed `workspace-process-panel.js`, and related CSS classes.
- **Complexity**: 3/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Each old component is classified as deleted, compatibility-only, or still required.
  - Path-loaded and test-only references are separated.
- **Validation**: Attach cleanup inventory output summary to PR/commit notes.

### Task 4.3: Delete or Fence Old Component Modules
- **Location**: `rooms/laboratory/ui/lab-left-rail.ts`, `rooms/laboratory/ui/lab-right-panel.ts`, `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Remove modules if unreachable, or replace with tiny compatibility exports only if tests/build artifacts still need them temporarily.
- **Complexity**: 5/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - No old component is used by live layout.
  - Any compatibility wrapper has a documented removal target.
- **Validation**: `npm run rooms:typecheck`, targeted UI/source tests, and room build if files are deleted.

### Task 4.4: Prune Legacy CSS Selectors
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Remove old left rail, right panel, workspace process panel, global process, and topbar action styles after their markup is gone.
- **Complexity**: 6/10
- **Dependencies**: Tasks 2.2, 2.3, 4.3
- **Acceptance Criteria**:
  - CSS no longer contains stale `.labx-left-rail`, `.labx-right-panel`, `.labx-process-panel`, or `.labx-global-process` rules unless a compatibility wrapper remains.
  - New v2 selectors still cover responsive/mobile behavior.
- **Validation**: CSS contract tests and visual smoke.

## Sprint 5: Full Validation and App Smoke
**Goal**: Confirm that the Laboratory workflow truly runs on the v2 design and that old UI expectations are gone.

**Demo/Validation**:
- Typecheck, targeted tests, room build, and optional Electron smoke all pass.
- Manual smoke follows no-source -> source-ready -> running -> result -> explore -> re-analyze.

### Task 5.1: Targeted Test Suite
- **Location**: `scripts/tests/*`
- **Description**: Run and fix fallout from the core Laboratory tests affected by the migration.
- **Complexity**: 4/10
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts` passes.
- **Validation**: Command output.

### Task 5.2: Room Build and Installed Parity
- **Location**: `scripts/rooms/*`, room package output
- **Description**: Build workspace rooms and verify Laboratory installed parity tests still pass.
- **Complexity**: 3/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - `npm run rooms:build` passes.
  - Installed parity tests do not reference deleted old UI files unless intentionally kept.
- **Validation**: Build and parity test output.

### Task 5.3: Electron/App Smoke When App Mode Is Available
- **Location**: app runtime, CDP smoke tooling
- **Description**: When the app is running, use the current mode workflow to smoke test the Laboratory UI visually.
- **Complexity**: 4/10
- **Dependencies**: Tasks 5.1-5.2
- **Acceptance Criteria**:
  - Body loads.
  - Laboratory shell contains top bar, center stage, drawer, and process strip.
  - No old left rail/right panel/process dashboard is visible.
  - Basic interaction smoke passes: drawer collapse, source controls, report CTA, explore toggle.
- **Validation**: CDP screenshot and DOM assertions.

## Testing Strategy
- Selector/store tests first for mode correctness and action reachability.
- Render tests second for top bar, drawer, center, and strip markup.
- Controller tests third for click/keyboard behavior.
- Cleanup tests last, after old imports are removed or fenced.
- Full room typecheck and build only after the old-component cleanup is done.

## Potential Risks & Gotchas
- The spec says drawer mode is derived and never user-toggled, but top bar Source/Results pills describe forced mode behavior. Resolve this as a concrete selector/store contract or update the spec before coding.
- `hasReportPayload` and `getReportFreshness` currently do not treat feature-report-only status identically; this can route ready reports to Explore by accident.
- Deleting old files too early can break path-loaded installed parity or stale tests. Prove reachability before removal.
- Center-stage `workspace-surface.ts` is still a large shared surface. Extract source intake and process fragments in small steps to avoid destabilizing media/timeline behavior.
- Process strip elapsed time currently depends on re-render events; a heartbeat must be scoped to running state and cleaned up on teardown.
- Empty-report Explore cannot be reached until `resolveDrawerMode` stops short-circuiting all no-report states to Setup.
- Boot skeleton requirements need a real center skeleton render path, not only CSS.
- Existing working tree has unrelated/uncommitted changes; implementation should avoid broad formatting churn.

## Rollback Plan
- Keep each sprint in small commits.
- If Sprint 1 action wiring regresses behavior, revert only controller/store action changes; the visual shell can remain.
- If Sprint 2 source-intake extraction breaks imports, restore the previous `workspace-surface.ts` source-intake render and keep drawer Setup as a placeholder until extraction is fixed.
- If Sprint 4 cleanup breaks build/parity, restore compatibility wrappers for deleted old components and defer CSS pruning.
- Never restore or edit `data/rooms/laboratory` directly; rebuild/sync installed copies from `rooms/laboratory`.

## Review Notes
Sub-agent review was completed in this session. The plan was updated with the review findings: inert action mismatches, explicit top bar Source pill contract, empty-report mode routing, early stale test migration, expanded legacy test scope, boot/loading skeleton coverage, and cancel action canonicalization.

## Implementation Closure Snapshot

**Closed**: 2026-04-28

**Status**: Implementation sprints are complete for the planned v2 shell migration. The live Laboratory workflow now renders through the top bar, center panel, right drawer, and process strip. Old left rail, old right panel, and old topbar action modules were removed from the live source tree.

**Completed scope**:

- V2 shell actions are wired through controller/store paths: drawer collapse, Explore toggle, report CTA, intent toggle, process log toggle, cancel, retry/start, tool manager, and top bar mode pills.
- Source intake moved into the Setup drawer while center stage keeps the compact source bar, media viewport, timeline, hypothesis/focus, and bookmark surfaces.
- Drawer mode resolution now guards source removal, empty completed runs, report freshness, feature report records, setup/result overrides, and running state.
- Result and Explore drawer modes render advisory/result context from execution coherence, readiness, bridge, candidate, and alternatives data.
- Process strip owns the global process surface, heartbeat refresh, expanded recent action/raw log view, cancel/retry controls, and idle/running/complete/failure labels.
- Legacy files `lab-left-rail.ts`, `lab-right-panel.ts`, and `lab-topbar-actions.ts` were deleted.
- `workspace-process-panel.ts` was deleted after the v2 process strip and drawer became the only process surfaces.
- Legacy CSS for deleted rail/right-panel/topbar/global-process/process-panel surfaces was pruned.
- Old process-panel workspace state was removed: `rightPanelCollapsed`, `activeStepPreviewId`, `processPanelCollapsedSections`, and their action dispatch paths are no longer part of the Laboratory store contract.

**Validation completed**:

- `npm run rooms:lint`
- `npm run typecheck`
- `npm run rooms:build`
- `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-project-management-regressions.test.ts scripts/tests/room-layout-contract-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
- `git diff --check`

## Strict Legacy Cleanup Pass — 2026-04-28

**Closed**: 2026-04-28

**Scope completed**:

- Removed the fenced compatibility renderer `rooms/laboratory/ui/workspace-process-panel.ts`.
- Moved remaining process history assertions onto the live `lab-process-strip` surface.
- Updated installed parity tests so `ui/workspace-process-panel.js` is classified as a removed legacy artifact.
- Removed stale process-panel CSS families: `.labx-process-panel`, `.labx-intent-map`, `.labx-output-trace`, old process section controls, old process recent-action cards, old step list/card styles, and unused old CTA/capability card styles.
- Removed old right-panel/process-panel workspace state and controller actions: `rightPanelCollapsed`, `activeStepPreviewId`, `processPanelCollapsedSections`, `workspace-right-panel-toggled`, `workspace-step-preview-activated`, and `workspace-process-section-toggled`.
- Refreshed the generated room runtime bundle with `npm run rooms:build` so `.build/laboratory/runtime` no longer carries the stale process panel file.

**Validation completed**:

- `npm run rooms:lint`
- `npm run rooms:typecheck`
- `npm run rooms:build`
- `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
- `npm run laboratory:cleanup:inventory`
- `git diff --check`

**Known validation gap**:

- Electron/CDP visual smoke was not run because the runtime is in `terminal` mode, `whereami.effectiveMode` is `other-provider-cli`, Electron is closed, and OpenCode serve is not running.

**Final review note**:

- A final sub-agent review was attempted after validation, but the sub-agent failed before analysis because the account usage limit was reached. Manual plan/current-state review was completed instead; no remaining blocker was found in source, tests, build, or parity checks.
