# Plan: Laboratory Wireframe v2 Open Gaps

**Generated**: 2026-04-28
**Estimated Complexity**: High
**Source Spec**: `laboratory-wireframe-v2-c63f98.md`
**Current Workflow Context**: `mode:status=terminal`, `whereami.effectiveMode=other-provider-cli`; plain terminal workflow, no app or ghost transition required for planning.

## Overview
Laboratory already implements the Wireframe v2 shell at a structural level: `lab-layout.ts` renders the top bar, center panel, drawer, and process strip; `lab-theme.css` defines the 48px / flexible center / 56px grid with a 22rem drawer; `resolveDrawerMode` derives Setup, Running, Result, and Explore from runtime state.

The remaining work is mostly contract closure rather than a new layout rewrite. The plan below turns the latest open gaps into small, committable increments:

- Running-mode mutation locks for timeline, ROI, hypothesis, and related workspace edits.
- Source failed/loading media viewport states.
- Decision Surface label/advisory mapping aligned with the deterministic spec.
- Process strip warning, cancelled, empty, and color semantics.
- Timeline-to-viewport sync behavior and locked-state visual affordances.
- Focused regressions and a final smoke pass.

No new dependencies are expected. Keep all changes under `rooms/laboratory` and `scripts/tests` unless a shared type must move.

## Current State Summary
- `rooms/laboratory/ui/lab-layout.ts` renders the v2 shell.
- `rooms/laboratory/ui/lab-top-bar.ts` renders project select, mode pills, and tool management.
- `rooms/laboratory/ui/lab-drawer.ts` renders setup/running/result/explore drawer modes.
- `rooms/laboratory/ui/workspace-surface.ts` owns the center source bar, preview viewport, timeline, hypothesis, focus controls, and bookmarks.
- `rooms/laboratory/ui/lab-process-strip.ts` owns the bottom process strip.
- `rooms/laboratory/runtime/lab-selectors.ts` owns `resolveDrawerMode`, report freshness, workspace diff, process summary, journey step, elapsed timer, and intent preview sentence.
- `rooms/laboratory/runtime/lab-run-controller.ts` routes top bar, drawer, timeline, source, report, and workspace actions.
- Existing focused regressions passed: `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts`

## Prerequisites
- Before implementing code changes, run fresh `npm run mode:status` and `npm run whereami` and follow the repo change-approval protocol.
- Do not edit `data/rooms/laboratory` as source; `rooms/laboratory` is the source of truth.
- Keep all visible copy room-local through existing i18n patterns when adding user-facing strings.
- Preserve the current shell shape; this plan is about behavioral and mapping gaps, not another page redesign.
- Use targeted tests first, then `npm run rooms:typecheck`, then broader room tests.

## Sprint 1: Running-Mode Mutation Locks
**Goal**: When a run is active, the center workspace remains inspectable but no analysis-defining inputs mutate source, timeline, ROI, intents, or hypothesis.

**Demo/Validation**:
- Start or simulate a running analysis.
- Source controls are disabled, timeline handles do not move, ROI drawing is ignored, hypothesis cannot edit, and focus controls still respond.
- Attempted blocked actions do not change store state.

### Task 1.1: Add a Shared Workspace Lock Selector
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/models/lab-types.ts`
- **Description**: Add a small selector/model contract for workspace mutation locks, for example `getWorkspaceLockState(state)` returning booleans for `source`, `timeline`, `roi`, `intents`, `hypothesis`, and `focusControls`.
- **Complexity**: 4/10
- **Dependencies**: None
- **Parallelizable**: Yes, with Task 1.2 after interface agreement.
- **Acceptance Criteria**:
  - Lock state is derived from `isRunActive(state)`.
  - Focus controls are explicitly unlocked during active runs.
  - Selector has unit coverage for idle, running, queued, completed, failed, and cancelled states.
- **Validation**:
  - Add assertions to `scripts/tests/laboratory-workspace-runtime-regressions.test.ts` or `scripts/tests/laboratory-runtime-truth-regressions.test.ts`.

### Task 1.2: Thread Lock State into Render Models
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/ui/lab-waveform-timeline-types.ts`, `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/workspace-hypothesis.ts`, `rooms/laboratory/ui/workspace-roi-overlay.ts`
- **Description**: Pass lock booleans into the timeline model, hypothesis renderer, and ROI overlay renderer so disabled state is visible and testable.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Parallelizable**: No, depends on selector shape.
- **Acceptance Criteria**:
  - Timeline markup exposes locked state, such as `data-timeline-locked="true"`.
  - Timeline handles, numeric inputs, finetune controls, and clear/export range actions are disabled or inert when locked.
  - Hypothesis textarea renders disabled when locked.
  - ROI overlay shows existing ROI but does not advertise drawing when locked.
  - Focus controls remain enabled.
- **Validation**:
  - Update `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.
  - Update `scripts/tests/laboratory-source-ui-regressions.test.ts` for rendered disabled states.

### Task 1.3: Guard Controller Mutations
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add controller-level guards for timeline interactions, timeline numeric input, timeline clear/finetune, workspace intent toggle, hypothesis input, and any workspace mutation that should be locked during runs.
- **Complexity**: 6/10
- **Dependencies**: Task 1.1
- **Parallelizable**: Can run in parallel with Task 1.2 if using the same selector.
- **Acceptance Criteria**:
  - UI disabled state is not the only protection; direct events cannot mutate locked fields.
  - Blocked attempts are no-ops or emit a low-noise warning event, consistently with existing controller style.
  - `run-deep-analysis` and `cancel-analysis` still work.
- **Validation**:
  - Add tests to `scripts/tests/laboratory-controller-runtime-regressions.test.ts`.

### Task 1.4: Guard ROI Mutation Without Blocking Inspection Focus
- **Location**: `rooms/laboratory/ui/lab-selection-roi-binder.ts`, `rooms/laboratory/ui/lab-root.ts`
- **Description**: Extend binder deps with separate lock predicates for ROI mutation and inspection focus. Block ROI create/update/clear while a run is active, but keep non-mutating focus/zoom/seek inspection controls available.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Parallelizable**: Yes, with Task 1.3 after selector exists.
- **Acceptance Criteria**:
  - Existing ROIs remain visible during active runs.
  - Dragging in preview does not create or update ROI during active runs.
  - Clear/capture buttons do not mutate locked ROI state.
  - ROI focus/zoom/seek remains usable as an inspection aid when it does not rewrite analysis input.
- **Validation**:
  - Add/extend ROI tests in `scripts/tests/laboratory-controller-runtime-regressions.test.ts` or a dedicated selection runtime test.

### Task 1.5: Reset or Preserve UI State on Run Boundaries
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Verify and, if needed, codify which UI fields are preserved on run start/end. Preserve selected intents and source intake collapse, reset `userExploreToggle` on run start, and keep focus controls unchanged.
- **Complexity**: 4/10
- **Dependencies**: Tasks 1.1-1.4
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Run start freezes analysis input without losing user workspace context.
  - Run completion lifts locks and returns timeline/ROI/hypothesis to editable state.
  - Existing report freshness and workspace diff semantics remain stable.
- **Validation**:
  - Store and selector tests covering start, complete, failed, and cancelled runs.

## Sprint 2: Media Viewport State Machine
**Goal**: Center media viewport follows the spec states: empty, loading, active, and error.

**Demo/Validation**:
- No source shows the intended empty placeholder.
- Running source probe shows skeleton/loading state.
- Completed source shows media with overlays.
- Failed source shows an actionable error card and hides timeline.

### Task 2.1: Add a Viewport State Selector
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getMediaViewportState(state)` or equivalent, derived from `getSourceReady`, `sourceProbeStatus`, and source metadata.
- **Complexity**: 3/10
- **Dependencies**: None
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Returns `empty`, `loading`, `active`, or `error`.
  - Handles stale source records and failed probes predictably.
- **Validation**:
  - Selector tests for `idle`, `running`, `completed`, and `failed` probe states.

### Task 2.2: Render Loading and Error Viewport States
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-theme.css`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/i18n/en.json`
- **Description**: Replace the current generic empty preview fallback with explicit loading and error states. The failed state should render the plan message and a retry button.
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - `sourceProbeStatus === "running"` renders viewport skeleton/loading.
  - `sourceProbeStatus === "failed"` renders error card: source failed message plus retry action.
  - Timeline remains hidden when duration is zero or source is failed.
  - Source bar still displays source/probe progress independently.
  - Failed source state keeps drawer in Setup, expands source intake, hides intents, disables the analysis CTA, and leaves process strip idle.
- **Validation**:
  - Render tests in `scripts/tests/laboratory-source-ui-regressions.test.ts`.
  - Selector/render tests for drawer mode, source intake collapse, CTA disabled reason, and process strip idle state.

### Task 2.3: Define the Source Retry Action Contract
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Define a canonical source retry action before implementation. It must be distinct from process-strip analysis retry (`run-deep-analysis`) and must avoid blind re-import when the previous source cannot be replayed safely.
- **Complexity**: 4/10
- **Dependencies**: Task 2.2
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Source viewport retry has its own action name, such as `source-probe-retry`.
  - The retry contract states whether each source mode re-probes an existing project source, replays a URL/YouTube draft, or requires the user to choose a local file again.
  - Missing URL, missing YouTube dependency, and unavailable local file-handle states produce blocked UI copy instead of silent failure.
  - Analysis retry in the process strip remains `run-deep-analysis`.
- **Validation**:
  - Controller/action-name tests proving source retry and analysis retry do not collide.

### Task 2.4: Implement Source Retry Action
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Implement the Task 2.3 source retry contract for local, URL, and YouTube source modes.
- **Complexity**: 6/10
- **Dependencies**: Task 2.3
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Retry from failed local source follows the agreed safe local path.
  - Retry from failed URL source follows the URL path and respects missing URL guard.
  - Retry from failed YouTube source respects `yt-dlp` availability.
  - Retry action does not start while a run is active.
- **Validation**:
  - Controller tests for local, URL, YouTube, missing dependency, and active run cases.

### Task 2.5: Keep ROI and Filters Active Only in Active Viewport
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/workspace-roi-overlay.ts`
- **Description**: Ensure ROI overlay and visual filters render only for active video/image sources and do not appear in loading/error/empty states.
- **Complexity**: 3/10
- **Dependencies**: Task 2.1
- **Parallelizable**: Yes, after Task 2.1.
- **Acceptance Criteria**:
  - Loading/error/empty states have no ROI overlay stage.
  - Active video/image states preserve existing overlay and focus behavior.
- **Validation**:
  - Render tests for each viewport state.

## Sprint 3: Decision Surface Mapping and Advisory Contracts
**Goal**: Result drawer displays user-facing labels, accents, advisories, and details exactly through deterministic mapping helpers.

**Demo/Validation**:
- Completed current report shows Candidate, Commitment, Staging cards with localized labels.
- Coherence, Readiness, and Bridge summaries use runtime formatter output.
- Conflicted/strained sections auto-open; Bridge stays collapsed.

### Task 3.1: Centralize Decision Surface UI Mapping
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, optionally `rooms/laboratory/ui/components/status-chip.ts`
- **Description**: Replace raw status rendering with mapping helpers for candidate, commitment, and staging labels/implications.
- **Complexity**: 4/10
- **Dependencies**: None
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Candidate labels map through room-local i18n to TR `Geçerli`, `Dengesiz`, `Geçersiz`, or `-`, with EN equivalents covered.
  - Commitment labels map through room-local i18n to TR `Onaylandı`, `İptal Edildi`, or `-`, with EN equivalents covered.
  - Staging labels map through room-local i18n to TR `Hazır`, `Beklemede`, or `-`, with EN equivalents covered.
  - Implication text for candidate, commitment, and staging is locale-aware and tested in both `tr` and `en`.
  - Accent values line up with success, warning, error, accent, or none.
- **Validation**:
  - Render tests in `scripts/tests/laboratory-source-ui-regressions.test.ts` or `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.
  - i18n parity assertions for `rooms/laboratory/i18n/tr.json` and `rooms/laboratory/i18n/en.json`.

### Task 3.2: Use Existing Advisory Formatter Functions
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/runtime/lab-decision-coherence.ts`, `rooms/laboratory/runtime/lab-execution-readiness-signal.ts`, `rooms/laboratory/runtime/lab-execution-bridge.ts`
- **Description**: Use `formatDecisionCoherenceAdvisory`, `formatExecutionReadinessSignalAdvisory`, and `formatExecutionBridgeAdvisory` instead of summary approximations where the source data is available.
- **Complexity**: 7/10
- **Dependencies**: Task 3.1 optional.
- **Parallelizable**: Partially; data-shape discovery can happen before Task 3.1 completes.
- **Acceptance Criteria**:
  - Coherence summary is a single advisory sentence.
  - Readiness summary is a single advisory sentence.
  - Bridge summary is a single advisory sentence.
  - Expanded details contain the plan-specified fields.
- **Validation**:
  - Add render tests that assert formatter output appears in drawer Result mode.
  - Reuse existing runtime formatter tests in `scripts/tests/laboratory-execution-runtime-regressions.test.ts`.

### Task 3.3: Auto-Expand Details by Spec State
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Update `<details>` open conditions: coherence opens only when conflicted, readiness opens when strained, bridge never auto-opens.
- **Complexity**: 3/10
- **Dependencies**: Task 3.2
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - `aligned` and `mixed` coherence stay collapsed.
  - `conflicted` coherence opens.
  - `strained` readiness opens.
  - Bridge is always collapsed by default.
- **Validation**:
  - Render tests for each state.

### Task 3.4: Preserve Result Versus Explore Semantics
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Verify user Explore toggle, report freshness, workspace dirty badge, source-removed setup force, and empty result routing after advisory updates.
- **Complexity**: 4/10
- **Dependencies**: Tasks 3.1-3.3
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Current report defaults to Result unless `userExploreToggle` is true.
  - Previous/stale report defaults to Explore.
  - Source removal forces Setup.
  - Empty run without report routes to Explore and keeps retry CTA.
- **Validation**:
  - Selector tests in `scripts/tests/laboratory-workspace-runtime-regressions.test.ts`.

### Task 3.5: Keep Partial Result Warning Visible in Result Drawer
- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Ensure completed runs with `run.warnings[]` render the Result drawer warning banner that lists warnings, independent of process strip partial state.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Parallelizable**: Yes, after Task 3.1.
- **Acceptance Criteria**:
  - Result drawer displays the partial-result warning banner when a completed run has warnings.
  - Banner lists `run.warnings[]` and does not suppress Decision Surface cards.
  - Explore drawer warning behavior remains consistent for stale or toggled views.
- **Validation**:
  - Render tests for completed-with-warnings Result and Explore modes.

## Sprint 4: Process Strip State and Color Semantics
**Goal**: Bottom strip matches the plan for idle, processing, analyzing, staging, complete, cancelled, partial, and error states.

**Demo/Validation**:
- Active run shows progress/timer.
- Completed run shows all dots green and final elapsed time.
- Failed run shows red failed point and retry.
- Cancelled run shows cancelled label without retry.
- Warning/partial run shows warning state without pretending every module is fully green.

### Task 4.1: Align Dot Colors and States
- **Location**: `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add explicit `warning` dot state, change done dots to success color, keep active dots accent, and preserve red error dots.
- **Complexity**: 4/10
- **Dependencies**: None
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Done dots use `--labx-success`.
  - Active dots use `--labx-accent`.
  - Warning modules use `--labx-warning`.
  - Error dot uses `--labx-error`.
- **Validation**:
  - Render/CSS contract tests in `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 4.2: Derive Partial Result Strip State
- **Location**: `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add a narrow strip model for partial completion, using `run.warnings`, module statuses, and run completion.
- **Complexity**: 5/10
- **Dependencies**: Task 4.1 optional.
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Completed run with warnings displays `Tamamlandı (uyarılarla)` or equivalent localized copy.
  - Warning modules get warning dots.
  - Report CTA remains enabled if report payload exists.
- **Validation**:
  - Add tests in `scripts/tests/laboratory-source-ui-regressions.test.ts`.

### Task 4.3: Fix Cancelled and Empty Run Semantics
- **Location**: `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Make cancelled runs show cancelled label without retry; make empty completed runs include empty reason when available.
- **Complexity**: 3/10
- **Dependencies**: None
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Cancelled strip has no retry button.
  - Cancelled strip shows completed module progress but no red error state.
  - Empty report strip task includes `emptyReason`.
- **Validation**:
  - Render tests for cancelled and empty runs.

### Task 4.4: Add Indeterminate Progress for Unknown Totals
- **Location**: `rooms/laboratory/ui/lab-process-strip.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: When processing/analyzing with `summary.totalCount === 0`, show an indeterminate progress animation with no percentage.
- **Complexity**: 3/10
- **Dependencies**: None
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Unknown total active work still has visible motion/progress.
  - No `0%` is displayed for indeterminate state.
- **Validation**:
  - CSS/render tests for total count zero.

### Task 4.5: Expand Toggle Shows Five Recent Actions
- **Location**: `rooms/laboratory/ui/lab-process-strip.ts`
- **Description**: Plan says `getUserActions(state).slice(0, 5)`; current strip uses four. Align with the spec and keep raw log display.
- **Complexity**: 1/10
- **Dependencies**: None
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Expanded strip renders up to five recent actions.
  - Raw log remains bounded and scrollable.
- **Validation**:
  - Existing process strip action history test updated from four to five.

## Sprint 5: Timeline and Viewport Sync
**Goal**: Timeline interactions drive preview seek behavior according to the deterministic interaction table, and locked mode remains visible but inert.

**Demo/Validation**:
- Click seeks without creating a range.
- Drag creates/updates a range without realtime seek.
- Drag completion seeks to the final selection start.
- Bookmark click seeks to bookmark time.
- Playhead follows preview media time.

### Task 5.1: Decide and Document Timeline Drag Seek Semantics
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `laboratory-wireframe-v2-c63f98.md` only if the implementation intentionally diverges
- **Description**: Treat the source spec as canonical by default: selection start and selection end seek to the selection start, while mousemove never previews in realtime. Only update the spec if there is an explicit product decision to preserve the current click-only seek behavior.
- **Complexity**: 2/10
- **Dependencies**: None
- **Parallelizable**: No; this decision affects later tasks.
- **Acceptance Criteria**:
  - Spec behavior is implemented unless a deliberate product decision records a divergence.
  - Any divergence updates `laboratory-wireframe-v2-c63f98.md` and the plan before code changes.
  - Tests are written to that behavior.
- **Validation**:
  - No code validation unless spec changes; otherwise controller tests.

### Task 5.2: Implement Canonical Drag Completion Seek
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: If the spec is kept, add a seek-to-selection-start on drag completion without adding realtime preview during mousemove.
- **Complexity**: 6/10
- **Dependencies**: Task 5.1
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Mousemove only updates selection state.
  - Mouseup after drag seeks preview to final `startMs`.
  - Body drag and start/end handle drag use final selection start consistently.
  - Click-only seek behavior remains intact.
- **Validation**:
  - Extend timeline tests in `scripts/tests/laboratory-controller-runtime-regressions.test.ts`.

### Task 5.3: Center Bookmark Click Behavior
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Bookmark click already emits `timeline-seek`; add timeline scroll/centering behavior if the timeline can overflow. If no overflow exists, document that centering is a no-op under the current full-width track.
- **Complexity**: 4/10
- **Dependencies**: None
- **Parallelizable**: Yes.
- **Acceptance Criteria**:
  - Bookmark click seeks preview to `timeMs`.
  - If timeline has scrollable overflow, clicked bookmark centers.
  - If timeline is not scrollable, test documents the no-op.
- **Validation**:
  - Controller or DOM-oriented test.

### Task 5.4: Add Timeline Locked Visual Contract
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Use Sprint 1 lock data to render the locked state: handles disabled, rail inert, run markers visible if available.
- **Complexity**: 5/10
- **Dependencies**: Sprint 1 Tasks 1.1-1.3
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Timeline remains visible during active runs.
  - Selection handles and numeric controls are visibly disabled.
  - Existing bookmarks stay visible.
  - Available run/module markers render without shifting layout.
- **Validation**:
  - Render tests for locked timeline.

### Task 5.5: Keep Playhead Sync Stable Across Single and Dual Preview
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-waveform-timeline-visualizer.ts`
- **Description**: Re-run and extend existing playhead tests after timeline lock and seek changes to ensure dual preview offsets remain correct.
- **Complexity**: 4/10
- **Dependencies**: Tasks 5.2-5.4
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Single preview playhead follows media current time.
  - Dual preview master/slave offset handling remains unchanged.
  - Timeline lock does not stop passive playhead updates.
- **Validation**:
  - Existing controller runtime tests plus one locked-state playhead test.

## Sprint 6: Regression Closure and Smoke
**Goal**: The implementation is proven across render, selector, controller, typecheck, and a small manual or automated UI smoke.

**Demo/Validation**:
- Run the full focused Laboratory regression set.
- Run `npm run rooms:typecheck`.
- If app is available, smoke the room in Electron; otherwise document that live smoke was skipped.

### Task 6.1: Add a Wireframe v2 Contract Test File
- **Location**: `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
- **Description**: Add a focused test file that documents the remaining deterministic contracts instead of scattering every assertion into older tests.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-5
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Tests cover mode resolution, viewport state, lock state, decision mappings, process strip states, and timeline locked state.
  - Tests are readable and do not duplicate broad fixture setup unnecessarily.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`

### Task 6.2: Update Existing Focused Regressions
- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`, `scripts/tests/laboratory-source-ui-regressions.test.ts`, `scripts/tests/laboratory-workspace-runtime-regressions.test.ts`, `scripts/tests/laboratory-controller-runtime-regressions.test.ts`, `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- **Description**: Update existing tests only where their current assertions overlap with the changed contracts.
- **Complexity**: 6/10
- **Dependencies**: Sprints 1-5
- **Parallelizable**: Yes, by test file ownership.
- **Acceptance Criteria**:
  - No stale expectations preserve pre-fix behavior.
  - Existing meaningful coverage is retained.
  - Tests stay targeted rather than snapshot-heavy.
- **Validation**:
  - Run each touched test file through `npm run rooms:test:file`.

### Task 6.3: Typecheck and Room Build Sanity
- **Location**: project scripts
- **Description**: Run room typecheck and, if touched CSS/render integration warrants it, room build.
- **Complexity**: 2/10
- **Dependencies**: Sprints 1-5
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:build` passes if build-affecting assets or manifest references changed.
- **Validation**:
  - Command output.

### Task 6.4: Live UI Smoke Checklist
- **Location**: Electron app / Laboratory room
- **Description**: Smoke the user-facing flow when app mode is available.
- **Complexity**: 4/10
- **Dependencies**: Sprints 1-5
- **Parallelizable**: No.
- **Acceptance Criteria**:
  - Open Laboratory.
  - Confirm topbar, center, drawer, process strip are visible.
  - Simulate/no-op source failed state if possible.
  - Start a run or mock running state and verify locks.
  - Complete/cancel/fail mocked run states and verify drawer/strip.
- **Validation**:
  - CDP screenshot and/or DOM assertions when Electron is running.

## Testing Strategy
- Start with selector tests for pure derivations: lock state, viewport state, report freshness, process summary.
- Add render tests for visible disabled states, error/loading viewport, decision labels, process dot states, and timeline locked state.
- Add controller tests for blocked mutation attempts and timeline seek semantics.
- Keep existing passing test files green after each sprint:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
- Finish with `npm run rooms:typecheck`.

## Potential Risks & Gotchas
- **Spec versus current UX conflict**: The timeline currently separates click seek from drag selection. The plan includes an explicit decision task before changing behavior.
- **UI disabled state is insufficient**: Controller and binder guards are required because tests and synthetic events can bypass DOM disabled attributes.
- **Run-active locks can hide useful inspection**: Focus controls must stay enabled, and playhead updates must continue during active runs.
- **ROI binder is UI-local**: It currently has no direct store lock context; adding a predicate through `lab-root.ts` avoids importing store logic into the binder.
- **Decision advisory data shape may not match the drawer directly**: Existing formatter functions live in runtime modules and may require a small projection layer instead of direct candidate-summary parsing.
- **Warning module attribution may be coarse**: `run.warnings[]` may not always identify a module. If module-level warning status is unavailable, derive warning dots only when module trace/event data clearly identifies a module.
- **Source retry can accidentally re-import instead of re-probe**: Retry must use the source mode and existing drafts/project source carefully, especially for local sources where file handles may not be reusable.
- **i18n parity can drift**: Any visible copy added to `tr.json` must also land in `en.json`.
- **Legacy tests may encode old behavior**: Update tests only when the behavior is intentionally changed and keep regressions focused on the v2 contract.

## Rollback Plan
- Revert by sprint-sized commits where possible.
- If Sprint 1 locks regress normal workspace editing, revert controller guards first while keeping render disabled states for investigation.
- If Sprint 2 source retry behaves incorrectly, disable only the retry button/action while preserving the error viewport state.
- If Sprint 3 advisory projection becomes unstable, keep mapped decision cards and temporarily fall back to existing candidate/readiness summaries.
- If Sprint 5 timeline behavior feels worse, keep tests documenting the chosen behavior and update the wireframe spec if the existing UX is intentionally preferred.

## Recommended Implementation Order
1. Sprint 1, because it protects data integrity during active runs.
2. Sprint 2, because source failed/loading states are user-visible and isolated.
3. Sprint 3, because it is mostly mapping/render work but depends on stable result state.
4. Sprint 4, because process strip semantics become clearer after run state contracts are stable.
5. Sprint 5, because timeline behavior can be UX-sensitive and should happen after lock safeguards exist.
6. Sprint 6, to consolidate coverage and smoke the final room flow.
