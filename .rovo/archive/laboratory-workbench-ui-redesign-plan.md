# Plan: Laboratory Workbench UI Redesign

**Generated**: 2026-04-14
**Estimated Complexity**: High

## Overview
Redesign the Laboratory room as a dense, calm, desktop-first workbench application instead of a web page with many competing panels.

The redesign should keep the current room contract and functional flow:
- preserve `source -> edit -> profile -> process -> report`
- preserve the existing `media-analysis`, `audio-analysis`, and `subtitle-analysis` engines
- preserve room-local i18n and current project storage
- preserve the dependency and model lifecycle, but move it into a clearer operational surface
- complement `.rovo/laboratory-central-workbench-plan.md` instead of replacing it; this file is the UI-layer execution plan

The main UX problem to solve is hierarchy, not missing capability. The current shell already has the right building blocks, but the source and process stages present too many peers at once, and the current `lastActionMessage` footer mixes critical failures, passive success messages, and noisy activity into one channel.

This plan treats the new Laboratory as an operator console with three stable layers:
- left rail: stage, run context, and global actions
- central workspace: the one main task for the current stage
- right inspector: preview, readiness, metadata, or report context

## Prerequisites
- Keep `rooms/laboratory/manifest.json` and current feature ids intact during the redesign.
- Reuse the current shell runtime and stage routing as the starting seam instead of replacing the whole room runtime.
- Keep visible copy in `rooms/laboratory/i18n/en.json` and `rooms/laboratory/i18n/tr.json`.
- Keep zero-motion rules: no new animation, decorative transition, parallax, shimmer, or animated overlay behavior.
- Preserve installed-room parity with `data/rooms/laboratory/` as part of delivery, not as a late cleanup.
- Treat desktop as the primary target, but keep collapse behavior app-like at `1120px` and `760px`.

## Sprint 1: UX Contract And Shell Hierarchy
**Goal**: Lock the information architecture before rewriting stage surfaces.
**Demo/Validation**:
- The redesign direction is reflected in shell structure and state contracts.
- The room still renders with the current engines, but the shell now has clear lanes for persistent context, primary task, and support context.

### Task 1.1: Define persistent shell surfaces and status priority
- **Location**: `rooms/laboratory/shared/types/room-shell-contracts.ts`, `rooms/laboratory/ui/bootstrap-state-runtime.ts`, `rooms/laboratory/shared/ui/shell-render.ts`, `rooms/laboratory/shared/ui/host-messages.ts`
- **Description**: Expand the shell contract so the UI distinguishes persistent workbench context, contextual inspector data, and ephemeral operational feedback. Build on the current host-message coalescing and request tracking rather than replacing them, and add a precise state model for `blocking`, `activity`, and `result`.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - The shell contract explicitly models persistent rail data, inspector data, and status-line data.
  - Host messages keep current coalescing behavior while projecting into clearer status channels.
  - The redesign has a stable state seam before layout changes begin.
- **Validation**:
  - TypeScript compile passes for room-local UI types.
  - Existing room shell render path still mounts without feature regressions.
  - Correlated payloads, sticky blockers, and verbose tool output still resolve into the correct state channel.

### Task 1.2: Rebuild the shell frame as a true operator console
- **Location**: `rooms/laboratory/shared/ui/shell-frame.ts`, `rooms/laboratory/shared/ui/shell-render.ts`, `rooms/laboratory/shared/styles/shell.css`, `rooms/laboratory/shared/styles/layout.css`, `rooms/laboratory/shared/styles/components/navigation.css`
- **Description**: Slim the left rail, reduce duplicate explanatory copy, make selected modules and stage progression continuously visible, and reserve more horizontal space for the active task. The rail should feel like application chrome, not a content card stack, and should not repeat summaries that already belong to the workspace or inspector.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The left rail communicates stage, active module, selected run scope, and global actions in one scan.
  - The rail stays visually lighter than the workspace and does not become a second content column.
  - The main workspace gets visibly more room than the current shell.
  - The shell looks app-like at desktop sizes rather than page-like.
- **Validation**:
  - Visual review at `1600x900` and `1366x768`.
  - Desktop chrome review confirms the rail keeps only persistent context, not duplicate stage prose.
  - No new motion or animated chrome is introduced.

### Task 1.3: Introduce a compact status line and expandable event log
- **Location**: `rooms/laboratory/shared/ui/shell-render.ts`, `rooms/laboratory/shared/ui/host-messages.ts`, `rooms/laboratory/shared/ui/request-runtime.ts`, `rooms/laboratory/shared/styles/components/feedback.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Replace the always-on verbose footer note with a compact status strip and an optional event log drawer. This should sit on top of the current message suppression pipeline, not bypass it. Critical blockers must stay visible; routine success and progress output should be summarized unless the user opens detail.
- **Complexity**: 8
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Critical failures stay persistent until resolved or dismissed.
  - Routine action success does not dominate the workspace.
  - Long tool output is discoverable without flooding the stage.
- **Validation**:
  - Manual smoke with success, failure, and long-running job message scenarios.
  - Verbose tool output still remains accessible.
  - Correlated request updates do not create duplicate or stale status entries.

### Task 1.4: Define novice and expert density rules
- **Location**: `rooms/laboratory/shared/styles/layout.css`, `rooms/laboratory/shared/styles/components/panels.css`, `rooms/laboratory/shared/styles/responsive.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Establish UI rules for when guidance is always visible, when it collapses into hints, and when dense metadata is allowed to stay continuously visible. The goal is one layout that welcomes first-time users without slowing repeat operators.
- **Complexity**: 6
- **Dependencies**: Tasks 1.1, 1.2
- **Acceptance Criteria**:
  - Primary actions and blockers are obvious to inexperienced users.
  - Experts do not need to scroll through repeated helper prose to operate the room.
  - Responsive collapse preserves grouping and does not turn into a generic stacked landing page.
- **Validation**:
  - Desktop and narrow-width review with guidance-heavy and guidance-light states.

## Sprint 2: Source Stage As The Main Intake Console
**Goal**: Turn the source stage into one confident intake workspace instead of multiple competing panels.
**Demo/Validation**:
- A user can create or resume a project, choose source route, and define run scope from one central surface.
- Preview, readiness, and module context move to supporting surfaces instead of competing with the main task.

### Task 2.1: Merge orientation, project selection, and intake into a single primary canvas
- **Location**: `rooms/laboratory/shared/ui/source-stage.ts`, `rooms/laboratory/shared/ui/source-stage-project.ts`, `rooms/laboratory/shared/ui/source-stage-intake.ts`, `rooms/laboratory/shared/styles/layout.css`, `rooms/laboratory/shared/styles/components/panels.css`
- **Description**: Replace the current multi-panel source stage with one main intake canvas that sequences project choice, source route, and current task summary in one visual flow. Keep a compact orientation summary and run-scope context persistent, but collapse non-primary support blocks out of the main column. Preserve module-specific audio and subtitle intake behavior instead of flattening it into one generic media intake.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Project choice and source intake feel like one task, not separate cards fighting for attention.
  - The user can immediately tell what the next required action is.
  - The main column no longer contains multiple equally weighted "hero" blocks.
  - Specialized audio and subtitle source paths remain intact.
- **Validation**:
  - Manual source-stage smoke for existing project, new project, local source, and remote source paths.

### Task 2.2: Turn module selection into a run-plan tray
- **Location**: `rooms/laboratory/shared/ui/source-stage.ts`, `rooms/laboratory/shared/ui/shell-frame.ts`, `rooms/laboratory/shared/ui/action-router.ts`, `rooms/laboratory/shared/styles/layout.css`
- **Description**: Move module selection away from a large competing card and into a compact run-plan tray that clearly shows included modules, focused module, and expected output scope.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Module selection remains continuously visible without taking over the source stage.
  - Included versus focused modules are easy to distinguish.
  - Run scope can be adjusted quickly by experienced users.
- **Validation**:
  - Manual smoke for single-module and multi-module run setup.

### Task 2.3: Recast the right side as a true inspector
- **Location**: `rooms/laboratory/shared/ui/source-stage.ts`, `rooms/laboratory/ui/feature-stage-panels.ts`, `rooms/laboratory/shared/ui/media-preview.ts`, `rooms/laboratory/shared/styles/layout.css`
- **Description**: Convert the side stack into an inspector surface that shows preview, source metadata, provider state, and contextual readiness without duplicating the main task. Define explicitly which blocks stay persistent, which move into the inspector, and which remain module-specific side surfaces. The inspector should answer "what is selected" and "what is blocked" at a glance.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Preview and metadata become supportive instead of primary.
  - The inspector content changes by active module without changing shell grammar.
  - The source stage remains understandable even when inspector panels are empty or partial.
  - Audio and subtitle specialty panels keep their distinct operational value.
- **Validation**:
  - Review media, audio, and subtitle source states with and without active previews.

## Sprint 3: Guided Preparation And Execution Surfaces
**Goal**: Make `edit`, `profile`, and `process` feel like focused operator tasks with less visual noise.
**Demo/Validation**:
- Each stage has one dominant task, one supporting inspector, and a predictable action area.
- The user can move across stages without relearning a new layout each time.

### Task 3.1: Refactor the edit stage into a task board
- **Location**: `rooms/laboratory/ui/shell-composition.ts`, `rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts`, `rooms/laboratory/main-functions/media-analysis/ui/edit-panels.ts`, `rooms/laboratory/main-functions/subtitle-analysis/ui/edit-panels.ts`, `rooms/laboratory/shared/ui/profile-process-report-composition.ts`, `rooms/laboratory/main-functions/media-analysis/styles/edit.css`
- **Description**: Reduce edit-stage fragmentation by organizing preset choice, edit controls, preview delta, and output selection around one main edit task board. Supporting information should stay inspectable but not co-equal. Keep the subtitle-specific edit path intact and account for shared composition seams that feed later profile/process/report behavior.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The active editing task is visually dominant.
  - Output selection and preview comparison are easier to scan.
  - Large control sets no longer scatter across unrelated cards.
- **Validation**:
  - Manual smoke for preview, apply, cancel preview, and output selection flows.
  - Module-specific regression review for media edit and subtitle edit behavior.

### Task 3.2: Redesign profile as a readiness checklist, not a page of warnings
- **Location**: `rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts`, `rooms/laboratory/main-functions/media-analysis/ui/profile-panels.ts`, `rooms/laboratory/shared/ui/profile-process-report-composition.ts`, `rooms/laboratory/shared/styles/components/feedback.css`
- **Description**: Rebuild profile around readiness gates, artifact decisions, and blocker explanations. Warnings should be grouped by severity and impact rather than presented as undifferentiated prose.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The user can tell what is required, optional, and risky before running.
  - Readiness is readable as a checklist.
  - Warning density drops without hiding real risk.
- **Validation**:
  - Manual smoke with ready, partially ready, and blocked profiles.
  - Guard that profile changes do not regress downstream process/report artifact summaries.

### Task 3.3: Rebuild process as a timeline-first run board
- **Location**: `rooms/laboratory/shared/ui/process-stage.ts`, `rooms/laboratory/shared/styles/components/feedback.css`, `rooms/laboratory/shared/styles/layout.css`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Shift process from stacked summary cards toward a run board that highlights current step, module queue, active operation, and completion state. The user should see progress, waiting, and failure recovery in one glance.
- **Complexity**: 8
- **Dependencies**: Tasks 1.3, 2.2
- **Acceptance Criteria**:
  - Current operation and queue state are more prominent than static summary text.
  - The process surface remains readable during long runs.
  - Restart, cancel, and jump-to-report actions stay stable and predictable.
- **Validation**:
  - Manual smoke with queued, running, failed, and completed process states.

## Sprint 4: Reporting, Operations, And Performance Polish
**Goal**: Finish the redesign with a calmer report surface, a stronger operations center, and lower UI churn.
**Demo/Validation**:
- Reporting feels like a coherent laboratory outcome.
- Dependency and model management read as operations, not detours.
- UI remains responsive during frequent state updates.

### Task 4.1: Redesign report into summary, evidence, and export lanes
- **Location**: `rooms/laboratory/shared/ui/report-stage.ts`, `rooms/laboratory/shared/ui/report-stage-subtitle.ts`, `rooms/laboratory/shared/ui/report-stage-support.ts`, `rooms/laboratory/shared/styles/layout.css`, `rooms/laboratory/shared/styles/components/panels.css`
- **Description**: Recompose the report stage so the top of the screen answers outcome, confidence, and next step immediately, while findings, evidence, and exports each get a predictable lane below.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Report overview is visible without scrolling through dense detail first.
  - Findings, caveats, and exports are grouped by purpose.
  - Cross-module reporting still feels like one laboratory report.
- **Validation**:
  - Manual smoke with media, audio, subtitle, and mixed-module report states.

### Task 4.2: Turn the dependency center into an operations console
- **Location**: `rooms/laboratory/shared/ui/settings-overlay.ts`, `rooms/laboratory/shared/ui/settings-tool-card.ts`, `rooms/laboratory/shared/ui/settings-profile-model.ts`, `rooms/laboratory/shared/styles/components/overlay.css`, `rooms/laboratory/shared/styles/layout.css`
- **Description**: Rework the current overlay so it behaves like an operations console with install state, manual guidance, model lifecycle, and active jobs. Keep it visually connected to the shell and readable during long operations.
- **Complexity**: 7
- **Dependencies**: Tasks 1.1, 1.2, 1.3
- **Acceptance Criteria**:
  - Tool and model operations are easier to scan and act on.
  - Running operations do not overwhelm the main workspace.
  - Manual versus automatic setup paths are obvious.
- **Validation**:
  - Manual smoke for install, refresh, manual guidance, and model-ready states.

### Task 4.3: Define the render strategy before optimizing the shell
- **Location**: `rooms/laboratory/shared/ui/shell-runtime.ts`, `rooms/laboratory/shared/ui/shell-render.ts`, `rooms/laboratory/shared/ui/shell-frame.ts`, `rooms/laboratory/ui/laboratory-ui-runtime.ts`, `rooms/laboratory/shared/ui/request-runtime.ts`
- **Description**: Turn performance work into an explicit implementation seam. Decide whether the redesigned shell should keep full-shell `innerHTML` replacement with smaller update boundaries, move to partial shell-region rerenders, or introduce targeted DOM patching for status and operations surfaces. This task must define ownership for render boundaries, event binding lifecycles, and focus preservation before optimization work lands.
- **Complexity**: 8
- **Dependencies**: Tasks 1.3, 3.3
- **Acceptance Criteria**:
  - The plan names the concrete render strategy for the redesigned shell.
  - Render boundaries, event rebinding, and focus preservation responsibilities are explicit.
  - The chosen path is small enough to land in follow-up implementation tasks.
- **Validation**:
  - Architecture note or implementation checklist is captured before optimization begins.

### Task 4.4: Implement the chosen render strategy and reduce shell churn
- **Location**: `rooms/laboratory/shared/ui/shell-runtime.ts`, `rooms/laboratory/shared/ui/shell-render.ts`, `rooms/laboratory/shared/ui/shell-frame.ts`, `rooms/laboratory/ui/laboratory-ui-runtime.ts`, `rooms/laboratory/shared/ui/host-messages.ts`, `rooms/laboratory/shared/ui/request-runtime.ts`
- **Description**: Implement the chosen rendering approach so rapid job updates, stage changes, status-line updates, and operations telemetry do not force unnecessary shell rebuilds. The redesign should not improve clarity while making the room feel heavier. Where region-level `innerHTML` replacement still remains, the runtime must preserve keyboard focus and text selection for draft, edit, and profile controls.
- **Complexity**: 9
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - Frequent job updates no longer cause visible shell churn.
  - Ephemeral activity updates can change without rebuilding every major panel.
  - Event bindings and keyboard focus stay stable during updates.
  - Text input, select changes, and caret position survive the remaining region rerenders in the active work surface.
  - The redesigned shell remains calmer than the current implementation during active runs.
- **Validation**:
  - Manual stress test with repeated host messages and long-running operations.
  - Compare before/after render stability during process execution.
  - Source, edit, and profile form interactions do not lose focus or caret position during live rerenders.

### Task 4.5: Final responsive, accessibility, and installed-room parity pass
- **Location**: `rooms/laboratory/shared/styles/responsive.css`, `rooms/laboratory/ui/style.css`, `config/rooms.json`, `data/rooms/laboratory/`
- **Description**: Finish the redesign by verifying collapse behavior, focus order, keyboard access, ARIA labeling for new status and operations surfaces, and installed-room sync for shipped output. Treat the shipped `data/rooms/laboratory/` copy as part of the done definition, especially for shell chrome runtime files.
- **Complexity**: 6
- **Dependencies**: All prior tasks
- **Acceptance Criteria**:
  - The room still feels like an application at reduced widths.
  - Keyboard navigation reaches rail, main task area, inspector, and operations surfaces predictably.
  - Installed-room output matches workspace behavior.
  - Critical shell chrome files remain in parity across workspace build output, temporary install output, and shipped room output.
- **Validation**:
  - `npm run rooms:build`
  - `npm run typecheck`
  - Room-local smoke at desktop, tablet-width, and narrow-width breakpoints.
  - Built-output parity check confirms the shipped `data/rooms/laboratory/` copy matches the intended redesign behavior for `shell-frame`, `shell-render`, `shell-runtime`, and `request-runtime`.

## Testing Strategy
- Validate every sprint at `1600x900`, `1366x768`, `1120px`, and `760px`.
- Run room-local smoke checks for each stage after major surface changes.
- Test novice flows:
  - new project
  - local source intake
  - blocked dependency
  - first successful run
- Test expert flows:
  - resume project
  - change module selection quickly
  - rerun process
  - jump directly to report
- Verify message behavior for:
  - success
  - failure
  - long-running operations
  - verbose tool output
- Verify focus retention while typing or changing controls in source, edit, and profile surfaces.
- Verify media, audio, subtitle, and mixed-module states.
- Keep installed-room parity in the loop with `npm run rooms:build` before calling the redesign complete.
- Compare critical shell chrome files across workspace build output, temporary install output, and the shipped `data/rooms/laboratory/` copy.

## Potential Risks & Gotchas
- The redesign can accidentally become a wizard. Mitigation: keep stage navigation explicit and always visible in the rail.
- The right inspector can grow into a second main workspace. Mitigation: reserve it for selection context, preview, readiness, and metadata only.
- Message cleanup can hide important failures if severity is not modeled well. Mitigation: treat `blocking`, `activity`, and `result` as different channels.
- Reusing current shells without reducing render churn can make the new UI look cleaner but feel slower. Mitigation: include a render-frequency task in the plan, not as optional polish.
- Region-level rerenders can still break focus for active form controls. Mitigation: treat focus and caret preservation as part of the render seam, not as a later nicety.
- Source-stage simplification can underserve advanced users if quick module changes become harder. Mitigation: keep the run-plan tray lightweight and always reachable.
- Overlay redesign can drift from room-local dependency data and manual helper flows. Mitigation: keep tool and model center on top of current registry and job state instead of inventing parallel state.
- Large copy changes can drift between Turkish and English. Mitigation: update both room-local locale files in the same task.
- Workspace and installed-room versions can drift during staged UI work. Mitigation: rebuild and compare the installed room as part of the final sprint.

## Rollback Plan
- Keep shell contract changes isolated from host engine logic so the room can fall back to the current shell if needed.
- Land shell hierarchy, stage redesign, operations console, and performance work in separate commits.
- Avoid changing persisted project schema for this UI effort.
- If a redesigned stage becomes unstable, restore the previous stage renderer while keeping the new shell contract in place.
- If responsive collapse becomes too fragile, ship the desktop redesign first and retain the current narrow-width fallback until the next pass.
