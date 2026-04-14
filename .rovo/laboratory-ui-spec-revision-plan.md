# Plan: Laboratory UI Spec Revision

**Generated**: 2026-04-14
**Estimated Complexity**: High

## Overview
Revise the Laboratory room so it follows `LAB-UI-SPEC.md` as a guided workbench instead of a dashboard-like multi-panel surface.

The implementation should preserve the existing room contract, stage order, feature ids, and room-local i18n while reducing competing panels and making the default shell hierarchy explicit:
- left rail = navigation only
- center = one active task
- right = compact context
- bottom diagnostics = hidden by default

## Prerequisites
- Keep `source -> edit -> profile -> process -> report`
- Preserve `media-analysis`, `audio-analysis`, and `subtitle-analysis`
- Keep room-local copy in `rooms/laboratory/i18n/*.json`
- Avoid new motion or decorative transitions
- Validate with room regressions plus `npm run typecheck`

## Sprint 1: Lock Shell Hierarchy
**Goal**: Align the shell with the spec before changing stage internals.
**Demo/Validation**:
- The shell clearly separates navigation, primary work, context, and diagnostics.
- Diagnostics do not appear by default.

### Task 1.1: Reduce shell competition
- **Location**: `rooms/laboratory/shared/ui/shell-render.ts`, `rooms/laboratory/shared/ui/shell-frame.ts`, `rooms/laboratory/shared/styles/shell.css`
- **Description**: Keep the left rail focused on stage and module context, simplify the status footer, and make the event log a hidden diagnostics drawer.
- **Complexity**: 7
- **Dependencies**: None
- **Acceptance Criteria**:
  - The rail reads as navigation chrome, not a second content column.
  - Status messaging is compact and does not compete with the workspace.
  - Diagnostics stay hidden until toggled.
- **Validation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 1.2: Encode primary/secondary/tertiary layout rules
- **Location**: `rooms/laboratory/shared/styles/layout.css`, `rooms/laboratory/shared/styles/components/panels.css`, `rooms/laboratory/shared/styles/responsive.css`
- **Description**: Rebalance visual weight so the center surface dominates, the inspector supports, and technical detail stays tertiary.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Center contrast and width are dominant.
  - Inspector is visually quieter than the main task.
  - Responsive collapse still feels app-like.
- **Validation**:
  - Manual review at `1600x900`, `1366x768`, `1120px`, `760px`

## Sprint 2: Rebuild Source As One Main Task
**Goal**: Make source intake feel like one guided action area.
**Demo/Validation**:
- Project choice, source route, and active module setup feel like one flow.
- The right side shows only compact supporting context.

### Task 2.1: Collapse source-stage hero competition
- **Location**: `rooms/laboratory/shared/ui/source-stage.ts`, `rooms/laboratory/shared/ui/source-stage-project.ts`, `rooms/laboratory/shared/styles/components/panels.css`
- **Description**: Merge orientation, project work, and source intake into one dominant center flow instead of multiple equal panels.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Only one primary card dominates the center.
  - The next required action is obvious within five seconds.
  - Repeated guidance is removed from side surfaces.
- **Validation**:
  - `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts`

### Task 2.2: Move module scope into compact context surfaces
- **Location**: `rooms/laboratory/shared/ui/source-stage.ts`, `rooms/laboratory/shared/ui/shell-frame.ts`
- **Description**: Keep module selection visible, but reduce it from a large competing card into a compact run-plan tray or inspector surface.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Selected modules remain visible.
  - Active module is distinct from included modules.
  - Scope controls no longer dominate the screen.
- **Validation**:
  - Manual smoke for single-module and multi-module setup

## Sprint 3: Normalize Stage Focus
**Goal**: Apply the same hierarchy to edit, profile, process, and report.
**Demo/Validation**:
- Each stage has one dominant work surface and one quieter context rail.

### Task 3.1: Tighten edit and profile
- **Location**: `rooms/laboratory/ui/shell-composition.ts`, `rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts`, `rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts`
- **Description**: Keep edit and profile centered on one task board/checklist while moving verbose summaries and secondary detail out of the main lane.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Edit feels like one task board.
  - Profile reads as readiness gates instead of warning sprawl.
- **Validation**:
  - Existing edit/profile regressions

### Task 3.2: Recast process and report away from dashboard summaries
- **Location**: `rooms/laboratory/shared/ui/process-stage.ts`, `rooms/laboratory/shared/ui/report-stage.ts`, `rooms/laboratory/shared/styles/components/feedback.css`
- **Description**: Make process timeline-first and report outcome-first while keeping technical evidence secondary.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Process emphasizes current run state and recovery actions.
  - Report answers outcome, gaps, and next step immediately.
- **Validation**:
  - Existing process/report regressions

## Sprint 4: Finish Operations, Responsive, And Parity
**Goal**: Close the redesign with overlay polish, copy alignment, and shipped-room parity.
**Demo/Validation**:
- Dependency operations remain accessible without stealing focus.
- Responsive behavior preserves the workbench feel.

### Task 4.1: Align operations surfaces and copy
- **Location**: `rooms/laboratory/shared/ui/settings-overlay.ts`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Keep dependency and model management operational, concise, and visually secondary to the active task.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Operations copy matches the new hierarchy.
  - Overlay remains useful without becoming a full detour.
- **Validation**:
  - Manual overlay smoke

### Task 4.2: Verify shipped behavior and parity
- **Location**: `data/rooms/laboratory/`, `scripts/tests/laboratory-*.test.ts`
- **Description**: Validate the workspace and shipped room stay aligned and that the new hierarchy survives room-local regressions.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Workspace and shipped room behavior remain aligned.
  - Final validation covers shell, source, stage flow, and reporting.
- **Validation**:
  - `npm run rooms:build`
  - `npm run typecheck`
  - Targeted laboratory regressions

## Testing Strategy
- Re-run the room shell regression after each shell-structure change.
- Re-run targeted stage regressions after each stage-focused sprint.
- Verify default hidden diagnostics, single-focus center area, and quieter inspector manually.

## Potential Risks & Gotchas
- Hiding diagnostics too aggressively could remove useful live feedback if status channels are not clear enough.
- Audio and subtitle stage variants should keep their specialized flows instead of being over-flattened.
- Shell hierarchy changes may require test updates where markup structure is asserted too literally.

## Rollback Plan
- Revert sprint-by-sprint if a hierarchy change breaks a specialized module path.
- Preserve existing host/runtime contracts while changing layout so behavior can be restored without data migration.
