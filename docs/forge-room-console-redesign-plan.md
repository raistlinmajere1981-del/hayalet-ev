# Plan: Forge Room Console Redesign

**Generated**: 2026-04-15
**Estimated Complexity**: High

## Overview

This redesign converts Forge Room from a hero-led room page into a dense single-screen operation console. The goal is not a cosmetic pass; it is to make the full workflow readable and actionable from one desktop viewport with minimal scroll:

Goal -> Draft -> Review -> Dispatch -> Responses -> Conflict -> Synthesis -> Export

The implementation should preserve the existing Forge Room command/state model where possible, reuse the current panel files instead of creating a parallel component tree, and only add small runtime/state seams where the current UI cannot express the required blocked reasons or conflict decisions.

## Current Architecture Notes

- The shell and column layout are assembled in `rooms/forge-room/ui/forge-room-ui-runtime.ts`.
- Visual density, spacing, and panel language are controlled almost entirely by `rooms/forge-room/ui/style.css`.
- The current hero banner and stage rail consume high-value viewport space before the real workbench begins.
- Plan editing, responses, conflicts, synthesis, and coordinator telemetry are already split into reusable panel files under `rooms/forge-room/ui/panels/`.
- The host runtime already derives useful workflow state such as `planStatus`, queue counts, conflict counts, synthesis status, export readiness, and coordinator notes in `rooms/forge-room/host/runtime.ts`.
- The current UI does not yet expose a true conflict-resolution action surface or durable blocked-reason model for synthesis/export, so the redesign likely needs a minimal host/runtime extension in addition to layout work.

## Prerequisites

- Existing Forge Room room package remains the source of truth under `rooms/forge-room`.
- The redesign stays inside the current room architecture; no new room, no new feature package, no second UI stack.
- Desktop-first layout is the primary target, with mobile fallback remaining usable rather than equally dense.
- Tests to update at minimum:
  - `scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
  - `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
- Likely touched files during implementation:
  - `rooms/forge-room/ui/forge-room-ui-runtime.ts`
  - `rooms/forge-room/ui/style.css`
  - `rooms/forge-room/ui/panels/goal-input-panel.ts`
  - `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`
  - `rooms/forge-room/ui/panels/approved-tasks-panel.ts`
  - `rooms/forge-room/ui/panels/responses-panel.ts`
  - `rooms/forge-room/ui/panels/conflict-summary-panel.ts`
  - `rooms/forge-room/ui/panels/synthesis-panel.ts`
  - `rooms/forge-room/ui/panels/coordinator-panel.ts`
  - `rooms/forge-room/shared/ui/request-runtime.ts`
  - `rooms/forge-room/shared/ui/state.ts`
  - `rooms/forge-room/shared/forge-constants.ts`
  - `rooms/forge-room/shared/types/forge-workflow.ts`
  - `rooms/forge-room/shared/types/forge-session.ts`
  - `rooms/forge-room/host/forge-handoff-export.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/state/forge-runtime-state.ts`

## Sprint 1: Patch 1 - Top Status Bar And Shell Reset

**Goal**: Replace the current hero-first presentation with a compact status bar that immediately communicates stage, counts, next step, and export posture.
**Demo/Validation**:

- Open Forge Room and confirm the first viewport starts with a compact top status bar instead of a large hero block.
- Verify the bar shows current stage, queued count, response count, conflict count, synthesis state, export state, and one-line next-step guidance.
- Confirm the current goal summary is visible without a large headline treatment.

### Task 1.1: Replace Hero And Stage Rail With A Compact Control Header

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Remove or collapse `renderHero()` and `renderStageRail()` into a single top status/action surface that prioritizes room name, active goal summary, current stage, counters, next step, and optional export summary.
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
  - The top area no longer behaves like a landing page hero.
  - The current goal and next step are both visible in the same compact band.
  - Stage and operational counts are readable at a glance.
- **Validation**:
  - UI smoke test verifies the new status bar renders.
  - Manual desktop check confirms the main workbench begins above the fold.

### Task 1.2: Introduce A Deterministic Next-Step And Blocked-Reason Matrix

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, optionally `rooms/forge-room/shared/ui/state.ts`
- **Description**: Replace the current simple next-step heuristic with a compact decision matrix that can emit both the next action and short blocked reasons such as `Dispatch blocked: draft not approved` or `Export blocked: no selected synthesis`.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Next-step output maps cleanly to the user-requested workflow states.
  - Disabled actions have a short visible explanation nearby.
  - Pending command text does not overwrite critical blocker messaging permanently.
- **Validation**:
  - Unit/smoke coverage asserts at least empty, draft-ready, conflict-blocked, and export-ready states.

### Task 1.3: Rebase Shell Density And Sticky Header Behavior

- **Location**: `rooms/forge-room/ui/style.css`
- **Description**: Rework top-level shell spacing, typography scale, surface padding, and optional sticky behavior so the status bar feels like a control strip instead of editorial chrome.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Outer padding and header height are materially smaller than today.
  - The shell uses a dense workbench rhythm rather than large decorative spacing.
  - The control header remains stable while scanning the work surface.
- **Validation**:
  - Manual desktop and laptop viewport inspection.

## Sprint 2: Patch 2 - Three-Column Workbench Architecture

**Goal**: Make the PLAN / RESPONSES+DECISION / OUTPUT structure explicit, stable, and visible in the first viewport.
**Demo/Validation**:

- Left column reads as plan workspace.
- Center column reads as live responses/decision area.
- Right column reads as synthesis/export output area.
- No bottom-heavy layout forces users through long scroll before reaching decisions.

### Task 2.1: Recompose The Main Render Tree Around Explicit Column Roles

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Reorder the render tree so the three columns match the requested cockpit model and the primary workflow is visually encoded without giant stage cards.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Left column contains goal, draft, and approval surfaces.
  - Center column contains response and conflict decision surfaces.
  - Right column contains synthesis selection, handoff validation, and export state.
- **Validation**:
  - UI smoke test confirms all three logical areas render under the new shell.

### Task 2.2: Compact Panel Headers And Shared Surface Language

- **Location**: `rooms/forge-room/ui/panels/panel-shell.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Reduce large serif-heavy panel headers, standardize compact panel chrome, and make each panel read as a work surface rather than a hero card.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Panel titles remain readable but stop dominating vertical space.
  - Repeated eyebrow/title combinations are reduced where they add no value.
  - Visual hierarchy comes from workflow grouping, not oversized headings.
- **Validation**:
  - Manual scan of all panels in the installed UI smoke environment.

### Task 2.3: Tune Column Heights, Overflow, And First-Viewport Coverage

- **Location**: `rooms/forge-room/ui/style.css`
- **Description**: Set desktop grid proportions, overflow rules, and responsive breakpoints so the first viewport exposes the current goal, draft area, decision area, synthesis/export area, and next step at the same time.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Desktop layout avoids unnecessary page scroll before reaching center/right surfaces.
  - Overflow behavior is intentional and does not create hidden unusable panels.
  - The responsive fallback preserves the same workflow order.
- **Validation**:
  - Manual desktop, laptop, and sub-980px checks.

## Sprint 3: Patch 3 - Compact Plan Surface

**Goal**: Let the user create the session, enter the goal, generate or edit the draft, and approve tasks from a single compact plan lane without raw JSON dominating the page.
**Demo/Validation**:

- Goal capture and draft editing live in one compact left-side workspace.
- Draft task cards are editable inline and visibly denser.
- Raw JSON editing is hidden behind an advanced control and is closed by default.

### Task 3.1: Compress Goal Capture Into A Dense Input Surface

- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Reduce helper text, shrink textareas, regroup session actions, and turn the goal panel into a practical plan-entry surface rather than a descriptive intro block.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Goal, brief, constraints, target room, and session actions fit in a compact layout.
  - Helper copy is short and strictly functional.
  - Current goal context remains visible without duplicating the top bar.
- **Validation**:
  - Manual UI check against the requested fields and density targets.

### Task 3.2: Merge Draft And Approved States Into One Stage-Aware Plan Workspace

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`, `rooms/forge-room/ui/panels/approved-tasks-panel.ts`
- **Description**: Keep the existing panel modules but render them as a single plan lane that changes presentation by workflow stage instead of feeling like two unrelated giant panels.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Draft editing and approved review feel like two modes of the same plan surface.
  - Approval no longer creates a second oversized panel that competes with the center column.
  - Dispatch configuration remains editable only where the workflow allows it.
- **Validation**:
  - Host-flow regression still reaches approval and dispatch states.

### Task 3.3: Rebuild Draft Task Cards For High-Density Editing

- **Location**: `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`, `rooms/forge-room/ui/panels/approved-tasks-panel.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Present task title, summary, seat, role, mode, compare seat, and persona in compact cards with a clear editable layout, reduced field height, and stronger inline status cues.
- **Complexity**: 7
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Each task exposes the requested fields without defaulting to JSON.
  - Cards read compactly and do not turn into long form slabs.
  - Approved cards become smaller and more review-oriented than draft cards.
- **Validation**:
  - Manual task editing pass with compare and single-owner examples.

### Task 3.4: Hide Raw Draft JSON Behind Advanced Mode

- **Location**: `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Move the raw draft text editor behind an explicit advanced/raw toggle so it stays available without becoming the default draft experience.
- **Complexity**: 6
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Raw draft textarea is closed by default.
  - The advanced control is visible but low-prominence.
  - Toggling advanced mode survives routine rerenders during local editing.
- **Validation**:
  - UI smoke or targeted UI test confirms advanced mode can open and the raw editor remains functional.

### Task 3.5: Preserve Transient UI View State Across Full Rerenders

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, optionally `rooms/forge-room/shared/ui/state.ts`
- **Description**: Add a lightweight transient UI view model for expand/collapse state, advanced/raw visibility, and similar local presentation flags so compact interactions survive the room UI's full-DOM rerender strategy.
- **Complexity**: 6
- **Dependencies**: Task 3.4
- **Acceptance Criteria**:
  - Advanced/raw mode stays stable while the user types or saves nearby fields.
  - Response and synthesis expand/collapse controls do not snap shut on routine rerenders.
  - The transient view model stays local to UI presentation and does not pollute persisted room session data.
- **Validation**:
  - Targeted UI smoke/manual check confirms transient toggles survive host-state refreshes and command-result rerenders.

## Sprint 4: Patch 4 - Response And Conflict Decision Surface

**Goal**: Make the center column the heart of Forge by grouping responses by task, hiding long bodies behind expand controls, and embedding conflict decisions inside the same task context.
**Demo/Validation**:

- Compare responses are grouped under their task.
- Summaries are visible by default; long bodies are collapsed.
- Conflicts appear as a decision state inside the relevant response group.
- The user can select a preferred response, mark resolved, or leave the conflict open.

### Task 4.1: Add Minimal Runtime Commands For Conflict Decisions

- **Location**: `rooms/forge-room/shared/forge-constants.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`, `rooms/forge-room/host/runtime.ts`, optionally `rooms/forge-room/host/state/forge-runtime-state.ts`
- **Description**: Introduce the smallest possible host-side contract for conflict resolution so the UI can submit decisions without inventing a separate coordination system. A single command such as `ForgeRoomResolveConflict` should be able to express preferred response selection, resolved/open status, and an optional note, while feeding a persisted runtime update instead of a UI-only decision.
- **Complexity**: 8
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - UI can submit a preferred response for a conflict.
  - Conflict status can move between open and resolved.
  - The chosen state survives save/load and affects synthesis blocking through host-managed state.
- **Validation**:
  - Host runtime flow regression covers at least one conflict resolution path.

### Task 4.2: Persist Response Selection Semantics In Runtime State

- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/shared/types/forge-workflow.ts`, `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/host/forge-handoff-export.ts`, optional task/runtime helpers
- **Description**: Update runtime behavior and shared types so selected/rejected response semantics and conflict resolution status are reflected in the stored session, coordinator note, synthesis inputs, and exported handoff package. The plan should treat preferred-response choice as a first-class persisted decision, not just a rendered UI state.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Preferred responses are traceable from the UI and in persisted session state.
  - Preferred-response and conflict-resolution fields survive save/load via the shared Forge session contract.
  - Leaving a conflict open keeps synthesis visibly blocked.
  - Resolving a conflict unblocks the next step only when the workflow truly allows it.
  - Handoff export carries the selected-response outcome without drifting from the user's decision.
- **Validation**:
  - Host runtime flow test confirms coordinator state changes after conflict resolution.
  - Handoff/export regressions confirm the chosen response survives into exported Forge session output.

### Task 4.3: Collapse Responses And Conflicts Into One Decision Surface

- **Location**: `rooms/forge-room/ui/panels/responses-panel.ts`, `rooms/forge-room/ui/panels/conflict-summary-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Either merge conflict rendering into `responses-panel.ts` or turn both files into a single coordinated decision lane so conflicts are displayed as part of the task response context instead of a disconnected summary box.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Each task shows its responses and any divergence in one place.
  - Compare tasks clearly indicate why the task needs a decision.
  - The UI no longer forces users to mentally join separate response and conflict panels.
- **Validation**:
  - UI smoke/manual test with compare responses and one unresolved conflict.

### Task 4.4: Add Summary-First Cards, Expandable Bodies, And Artifact Indicators

- **Location**: `rooms/forge-room/ui/panels/responses-panel.ts`, `rooms/forge-room/ui/style.css`, optionally `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Render summary-first response cards with seat/role badges, expand/collapse behavior, and clear archive/artifact markers so long bodies stop overwhelming the center column.
- **Complexity**: 6
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - Default state shows summaries, not full long-form bodies.
  - Archive/artifact presence is visible without opening the full body.
  - Compare responses are scannable without vertical overload.
- **Validation**:
  - Manual inspection with multiple response cards.

## Sprint 5: Patch 5 - Compact Synthesis And Export Surface

**Goal**: Make the right column a compact output surface with clear synthesis selection, visible export readiness, and non-silent blocked reasons.
**Demo/Validation**:

- Selected synthesis is obvious.
- Candidate list is compact and expandable.
- Export readiness displays success, blocked, or missing criteria.
- Export button is disabled with a visible reason when unavailable.

### Task 5.1: Surface Export-Readiness Detail From The Existing Readiness Path

- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-handoff-export.ts`, optionally `rooms/forge-room/shared/ui/state.ts`
- **Description**: The current snapshot exposes `exportReady` as a boolean, but the redesign needs short reasons. Surface a UI-readable summary from the existing `buildExportReadySummary()` path so the export surface can explain what is missing without duplicating readiness rules in a second source of truth.
- **Complexity**: 7
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - UI can display a short reason when export is blocked.
  - Handoff check results map to visible badges such as success, blocked, or missing criteria.
  - Export status stays consistent with actual runtime checks because the UI reads from the same readiness logic used by export validation.
- **Validation**:
  - Host/runtime test verifies blocked reasons when no selected synthesis or missing acceptance criteria exist.
  - Top bar, synthesis panel, and export button all reflect the same readiness state in targeted UI assertions.

### Task 5.2: Rebuild Synthesis Panel Around Selected Output And Candidate Queue

- **Location**: `rooms/forge-room/ui/panels/synthesis-panel.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Split the panel into selected synthesis, candidate list, generate action, validation surface, and export history summary, while keeping bodies collapsed by default.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Selected synthesis is visually distinct from non-selected candidates.
  - Candidate summaries are scannable without opening long text blocks.
  - Export state appears in the same right-column context.
- **Validation**:
  - Manual UI test with multiple syntheses and at least one export record.

### Task 5.3: Wire Systematic Blocked Messaging For Synthesis And Export

- **Location**: `rooms/forge-room/ui/panels/synthesis-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Add short, systematic blocked messages such as `Synthesis blocked: unresolved conflict` and `Export blocked: no selected synthesis`, and place them beside or beneath the relevant controls. These messages should be derived from the same readiness/blocker sources used by the host runtime and top status bar.
- **Complexity**: 5
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Disabled buttons are never silent.
  - Blocked language is short, repeatable, and operational.
  - The next-step bar and right-column surface agree on the same blocker.
  - Export blocked messaging does not drift from `buildExportReadySummary()` output.
- **Validation**:
  - UI smoke or targeted assertions cover blocked and ready states.

### Task 5.4: Show Compact Export History And Last Export Metadata

- **Location**: `rooms/forge-room/ui/panels/synthesis-panel.ts`
- **Description**: Reduce export history to a compact summary with filename/path cue and latest timestamp so the user can confirm the handoff outcome without leaving the console.
- **Complexity**: 4
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Last export info is visible and compact.
  - Export history does not dominate the panel.
  - Success state is immediately distinguishable from blocked state.
- **Validation**:
  - Manual check after running export in the host-flow regression harness.

## Sprint 6: Patch 6 - Coordinator Simplification

**Goal**: Demote coordinator telemetry from a large footer panel to a compact operational strip or top-bar summary.
**Demo/Validation**:

- Coordinator no longer occupies a full large panel.
- Last event, counts, export readiness, and pending command remain visible somewhere compact.
- Session-management information remains reachable without taking over the page.

### Task 6.1: Move Coordinator Essentials Into A Mini Telemetry Strip

- **Location**: `rooms/forge-room/ui/panels/coordinator-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Convert the current coordinator footer into a compact strip or embedded status surface that carries the essentials only: stage, last event, counts, export readiness, and pending command.
- **Complexity**: 5
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - No large coordinator wall remains on the page.
  - Coordinator information reads as operational telemetry, not as a second page section.
  - The last event/note still survives as a useful operator signal.
- **Validation**:
  - Manual scan confirms the footer panel has been removed or collapsed.

### Task 6.2: Relocate Saved Sessions To A Compact Plan-Or-Strip Context

- **Location**: `rooms/forge-room/ui/panels/coordinator-panel.ts`, `rooms/forge-room/ui/panels/goal-input-panel.ts`, optionally `rooms/forge-room/ui/style.css`
- **Description**: The current saved-session list lives in the coordinator panel. Move it into a more appropriate compact context so session operations remain discoverable after the coordinator is minimized.
- **Complexity**: 5
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Saved sessions are still accessible.
  - Session list does not consume prime decision-making real estate.
  - Create/save/load actions stay close to the goal/plan surface.
- **Validation**:
  - UI smoke/manual test confirms sessions remain visible or expandable.

## Sprint 7: Patch 7 - Density, Typography, And Redundancy Cleanup

**Goal**: Finish the redesign by removing repeated copy, overgrown spacing, and decorative leftovers so the console feels fast, technical, and production-ready.
**Demo/Validation**:

- The page reads like a workbench, not onboarding.
- Repeated helper text and duplicate status language are gone.
- The first viewport carries the workflow clearly on desktop.

### Task 7.1: Remove Or Reduce Redundant Copy And Decorative UI

- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/panels/*.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Remove leftover onboarding-style copy, repeated labels, oversized helper paragraphs, and decorative chrome that no longer serves the cockpit model.
- **Complexity**: 4
- **Dependencies**: Sprint 6
- **Acceptance Criteria**:
  - No large room-hero language remains.
  - Helper text is short and only appears where it prevents user error.
  - Duplicate status descriptions are eliminated.
- **Validation**:
  - Manual copy review against the redesign brief.

### Task 7.2: Final Typography, Spacing, And Density Tuning

- **Location**: `rooms/forge-room/ui/style.css`
- **Description**: Tune font sizes, row heights, control padding, badge density, and panel spacing to hit a dark technical cockpit feel without turning the UI into unreadable clutter.
- **Complexity**: 5
- **Dependencies**: Task 7.1
- **Acceptance Criteria**:
  - The UI feels denser but still legible.
  - Desktop first viewport includes current goal, plan area, decision area, synthesis/export area, and next step.
  - Mobile fallback still works even if it becomes a stacked layout.
- **Validation**:
  - Manual viewport pass on desktop and mobile breakpoints.

### Task 7.3: Refresh Regression Coverage For The New Information Architecture

- **Location**: `scripts/tests/forge-room-ui-smoke-regressions.test.ts`, `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`, `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`, optional targeted host/runtime tests
- **Description**: Update brittle UI assumptions, add assertions for the new top bar and compact surfaces, and cover any new host commands introduced for conflict resolution or export-readiness detail.
- **Complexity**: 6
- **Dependencies**: All prior sprints
- **Acceptance Criteria**:
  - Existing smoke and flow tests pass with the new UI contract.
  - New commands or state fields are covered where they introduce workflow risk.
  - Installed-copy smoke still proves the room renders in production packaging.
- **Validation**:
  - Run the targeted Forge Room suites listed in Testing Strategy.

## Testing Strategy

- Targeted UI smoke:
  - `node --import tsx --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
- Targeted runtime flow:
  - `node --import tsx --test scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-task-runtime-regressions.test.ts`
  - `node --import tsx --test scripts/tests/forge-room-handoff-regressions.test.ts`
- Broader room regression pass after the redesign stabilizes:
  - `npm run rooms:test:core`
- Manual product checks:
  - Empty state with no session
  - Goal saved but no draft
  - Draft ready but not approved
  - Approved tasks queued for dispatch
  - Compare responses with unresolved conflict
  - Synthesis generated and selected
  - Export blocked vs export successful
  - Latest saved session reloaded into the redesigned console

## Potential Risks & Gotchas

- **Local UI view state loss**: The current UI rerenders by replacing the full DOM tree. Expand/collapse state, advanced/raw visibility, and compact strip state will reset unless a lightweight transient UI view model is added in `forge-room-ui-runtime.ts`.
- **Conflict resolution is not just CSS**: The requested center-column behavior needs an actual host/runtime command plus shared-type and export-contract updates; otherwise synthesis and handoff export can drift from the user's chosen response.
- **Export blocker detail must stay single-source**: `exportReady` alone cannot power the requested disabled-reason UX, but the fix should still derive from `buildExportReadySummary()` rather than inventing a competing readiness model.
- **Too many nested scroll regions can backfire**: The redesign should be dense, but not trap the user in three independently scrolling columns unless that behavior is carefully tuned.
- **Coordinator minimization can hide sessions accidentally**: Saved sessions currently live in the coordinator panel and must be deliberately relocated.
- **Installed smoke tests may assume the old shell**: UI smoke coverage needs to be updated as the hero/stage rail disappear.
- **Responsive degradation must remain acceptable**: Desktop is the main target, but the layout should still collapse in a predictable workflow order on narrower widths.

## Rollback Plan

- Revert UI-only changes first:
  - `rooms/forge-room/ui/forge-room-ui-runtime.ts`
  - `rooms/forge-room/ui/style.css`
  - `rooms/forge-room/ui/panels/*.ts`
- If new host commands or state fields were introduced for conflict decisions or export-readiness detail, revert them in:
  - `rooms/forge-room/shared/forge-constants.ts`
  - `rooms/forge-room/shared/ui/request-runtime.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/state/forge-runtime-state.ts`
- Restore previous smoke expectations in Forge-specific test files.
- If rollback happens mid-flight, prefer keeping the older hero/stage-rail UI intact rather than leaving a partially merged hybrid console.
