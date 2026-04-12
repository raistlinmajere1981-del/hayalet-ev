# Plan: Laboratory Central Workbench

**Generated**: 2026-04-12
**Estimated Complexity**: High

## Overview
Revise the `laboratory` room from three partially duplicated analysis surfaces into one desktop-first analysis workbench with a guided project flow and a dedicated dependency and model management center.

The revised implementation order intentionally changes the earlier plan:
- keep the room id as `laboratory`
- keep the existing declared feature ids alive during the transition
- add a thin workbench compatibility seam before the large UI rewrite
- preserve existing project storage and feature-keyed state during the first release
- move scene simplification and manifest flattening to the very end

This plan assumes the first deliverable is a unified Laboratory experience built on top of the current media/audio/subtitle engines, not a destructive rewrite of room contracts and persisted project data.

## Prerequisites
- Preserve backward compatibility for existing Laboratory projects and generated artifacts under `projectsDir`.
- Keep `rooms/laboratory` as the source of truth and continue syncing the installed copy under `data/rooms/laboratory/`.
- Reuse the existing room-tool install/update pipeline and profile-model lifecycle instead of introducing parallel management paths.
- Treat manifest, scene, installed-room build, and persisted project readers as one contract surface.
- Validate every sprint with targeted room regressions plus `npm run typecheck`.

## Sprint 1: Contract, Compatibility, And Validation Loop
**Goal**: Establish a safe seam for the central workbench before redesigning the shell.
**Demo/Validation**:
- Existing Laboratory room entry still works.
- Existing projects still load.
- A workbench-level adapter contract exists without removing legacy features.

### Task 1.1: Define the workbench contract without removing declared features
- **Location**: `rooms/laboratory/manifest.json`, `config/rooms.json`, `src/types/rooms.ts`, `src/types/room-manifest-types.ts`, `src/types/room-manifest-validation.ts`
- **Description**: Document the central workbench as the new primary Laboratory experience while explicitly keeping `media-analysis`, `audio-analysis`, and `subtitle-analysis` as the declared feature ids during the migration. Do not collapse the manifest to one synthetic feature yet.
- **Complexity**: 7
- **Dependencies**: None
- **Acceptance Criteria**:
  - The plan and code contract identify one primary workbench experience.
  - `defaultFeatureId` and room feature validation remain compatible with the existing room/page/scene flow.
  - No manifest change forces immediate room-page or scene-debug breakage.
- **Validation**:
  - `node --test scripts/tests/room-manifest-regressions.test.ts`
  - `node --test scripts/tests/rooms-scene-page-regressions.test.ts`
  - `npm run rooms:build`

### Task 1.2: Add a workbench-level adapter seam over legacy feature runtimes
- **Location**: `rooms/laboratory/host/feature-adapters.ts`, `rooms/laboratory/host/runtime.ts`, `rooms/laboratory/shared/host/runtime-bootstrap.ts`, `rooms/laboratory/shared/host/project-state.ts`, `rooms/laboratory/shared/host/project-state-delegates.ts`, `rooms/laboratory/shared/ui/feature-runtime.ts`
- **Description**: Introduce a thin compatibility layer that lets the future central workbench talk to the existing media/audio/subtitle engines through one state and action surface. This seam must arrive before the major shell rewrite.
- **Complexity**: 9
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The room exposes a workbench-facing adapter API without deleting the old engine seams.
  - UI state can read a unified view of project, readiness, jobs, and feature outputs.
  - Legacy delegates remain functional behind the adapter.
- **Validation**:
  - `node --test scripts/tests/laboratory-host-import-smoke-regressions.test.ts`
  - `node --test scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `npm run rooms:build`

### Task 1.3: Add persisted-state and schema compatibility guards early
- **Location**: `rooms/laboratory/shared/host/project-paths.ts`, `rooms/laboratory/shared/host/project-manifests.ts`, `rooms/laboratory/shared/host/project-lifecycle.ts`, `rooms/laboratory/shared/host/process-report-state.ts`, `rooms/laboratory/shared/data/tools/project-schema.json`
- **Description**: Protect the current feature-keyed project shape before the central workbench begins writing new state. Add versioned compatibility fields or adapter reads for workbench-level state rather than rewriting project folders or report/process records immediately.
- **Complexity**: 8
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Existing projects remain readable without migration.
  - New workbench-level data can coexist with current `edit`, `profile`, `audioAnalysis`, `subtitleAnalysis`, `process`, and `report` branches.
  - Feature-keyed process/report storage remains stable during the transition.
- **Validation**:
  - `node --test scripts/tests/laboratory-media-source-portability-regressions.test.ts`
  - `node --test scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`
  - `node --test scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
  - `npm run rooms:build`

### Task 1.4: Expand dependency and model metadata for central management
- **Location**: `rooms/laboratory/shared/data/tools/toolchain.manifest.json`, `rooms/laboratory/shared/data/tools/project-schema.json`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Extend metadata so tools and profile models can expose install strategy, support level, usage context, test impact, readiness blockers, and manual fallback guidance from one management center.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Each dependency clearly indicates `automatic`, `manual/system`, or `planned`.
  - Each dependency or model can explain which analysis module or workflow depends on it.
  - The metadata is sufficient for both readiness gating and the future dependency center.
- **Validation**:
  - `node --test scripts/tests/room-tool-service-regressions.test.ts`
  - `npm run rooms:build`

### Task 1.5: Establish the installed-room validation loop from the start
- **Location**: `scripts/rooms/build-workspace-rooms.ts`, `data/rooms/laboratory/`, `scripts/tests/room-bundle-import-regressions.test.ts`, `scripts/tests/room-workspace-build-regressions.test.ts`
- **Description**: Make installed-room validation part of the implementation flow from Sprint 1 onward so workspace changes cannot drift away from the shipped room bundle.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - The plan explicitly treats `npm run rooms:build` as part of the normal loop.
  - Installed-room and workspace-room regressions are run before late-stage polish.
  - Manifest and UI runtime changes cannot quietly bypass the actual shipped room path.
- **Validation**:
  - `npm run rooms:build`
  - `node --test scripts/tests/room-workspace-build-regressions.test.ts`
  - `node --test scripts/tests/room-bundle-import-regressions.test.ts`

## Sprint 2: Central Workbench Shell
**Goal**: Ship the new unified Laboratory shell on top of the compatibility seam.
**Demo/Validation**:
- Open Laboratory and see one desktop-first workbench instead of three parallel analysis surfaces.
- Create or select a project, choose a source, and reach a readiness summary from one shell.

### Task 2.1: Replace the split shell with a desktop workbench layout
- **Location**: `rooms/laboratory/shared/ui/shell-render.ts`, `rooms/laboratory/shared/ui/shell-runtime.ts`, `rooms/laboratory/ui/shell-composition.ts`, `rooms/laboratory/shared/styles/layout.css`, `rooms/laboratory/shared/styles/components/panels.css`, `rooms/laboratory/shared/styles/components/controls.css`, `rooms/laboratory/ui/style.css`
- **Description**: Build a new desktop-first shell with a left step rail, a central workspace, and a right-side context rail for project state, queue, readiness, and actions. Avoid modal-first interaction for the main workflow.
- **Complexity**: 8
- **Dependencies**: Tasks 1.2, 1.3
- **Acceptance Criteria**:
  - The default Laboratory surface fits a typical desktop viewport without giant stacked cards.
  - The shell is workbench-first rather than feature-tab-first.
  - The existing engines remain reachable through the adapter seam.
- **Validation**:
  - `node --test scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `node --test scripts/tests/room-ui-regressions.test.ts`
  - `npm run rooms:build`

### Task 2.2: Build a unified project and source hub
- **Location**: `rooms/laboratory/shared/ui/source-stage.ts`, `rooms/laboratory/shared/ui/source-stage-project.ts`, `rooms/laboratory/shared/ui/source-stage-intake.ts`, `rooms/laboratory/shared/ui/action-router-events.ts`
- **Description**: Merge project selection, new project creation, source type choice, and source intake into one guided workspace. Existing/new project handling should become a first-class step, not a side panel afterthought.
- **Complexity**: 7
- **Dependencies**: Tasks 1.2, 2.1
- **Acceptance Criteria**:
  - Users can choose an existing project or create a new one without leaving the main workspace.
  - Local file, direct URL, YouTube, subtitle import, and audio-first intake are accessible from one hub.
  - Disabled source options explain which dependency is missing and how to unblock.
- **Validation**:
  - `node --test scripts/tests/laboratory-media-analysis-room-regressions.test.ts`
  - `node --test scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
  - `node --test scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts`
  - `npm run rooms:build`

### Task 2.3: Introduce a central module-selection and readiness gate
- **Location**: `rooms/laboratory/shared/ui/feature-runtime.ts`, `rooms/laboratory/shared/ui/process-stage.ts`, `rooms/laboratory/shared/host/process-targeting.ts`, `rooms/laboratory/shared/host/process-orchestration.ts`
- **Description**: Let the user choose which analysis modules to run from one place, then compute readiness and degraded-mode warnings before execution. This replaces feature switching as the primary decision point.
- **Complexity**: 8
- **Dependencies**: Tasks 1.3, 1.4, 2.1, 2.2
- **Acceptance Criteria**:
  - The workbench can show one readiness summary that covers media/audio/subtitle capability together.
  - Missing tools, missing models, unsupported source kinds, and degraded-mode fallbacks are visible before the run starts.
  - Users understand what will run, what will be skipped, and why.
- **Validation**:
  - `node --test scripts/tests/laboratory-media-profile-behavior-regressions.test.ts`
  - `node --test scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - `node --test scripts/tests/laboratory-subtitle-analysis-behavior-regressions.test.ts`
  - `npm run rooms:build`

## Sprint 3: Dependency And Model Center
**Goal**: Replace the current settings overlay with a real operations panel for tools and models.
**Demo/Validation**:
- Open a dedicated dependency center.
- Inspect every tool and model, see why it matters, and run install, update, refresh, or remove actions with visible progress.

### Task 3.1: Turn settings into a dedicated dependency and model center
- **Location**: `rooms/laboratory/shared/ui/settings-overlay.ts`, `rooms/laboratory/shared/ui/settings-tool-card.ts`, `rooms/laboratory/shared/ui/settings-profile-model.ts`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Replace the current stage-filtered overlay with a richer management center that covers required tools, optional tools, profile models, install strategy, support level, usage context, and readiness impact.
- **Complexity**: 7
- **Dependencies**: Tasks 1.4, 2.1
- **Acceptance Criteria**:
  - The panel is organized around dependency and model operations, not the current active stage.
  - Each card explains what the tool or model is used for and whether the room can manage it automatically.
  - Tool lifecycle and model lifecycle live in one coherent surface.
- **Validation**:
  - `node --test scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:build`

### Task 3.2: Show live telemetry for tool and model operations
- **Location**: `rooms/laboratory/shared/host/tool-mutations.ts`, `rooms/laboratory/shared/host/room-tools-progress.ts`, `rooms/laboratory/shared/ui/request-runtime.ts`, `rooms/laboratory/shared/ui/media-preview.ts`, `rooms/laboratory/shared/ui/settings-profile-model.ts`
- **Description**: Surface queued, running, completed, failed, percent, activity messages, retry, and remove states so users are never blind during installs, updates, checks, or model downloads.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Automatic installs and updates expose progress and completion state in the UI.
  - Profile model downloads and removals expose equivalent operational visibility.
  - Failures show actionable reasons instead of only generic missing status.
- **Validation**:
  - `node --test scripts/tests/room-tool-service-regressions.test.ts`
  - `node --test scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `npm run rooms:build`

### Task 3.3: Add manual guidance and dependency usage mapping
- **Location**: `rooms/laboratory/shared/data/tools/toolchain.manifest.json`, `rooms/laboratory/shared/ui/settings-tool-card.ts`, `rooms/laboratory/shared/ui/settings-profile-model.ts`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: For non-automatable tools and blocked models, show clear host requirements, manual install hints, verification steps, and which analysis modules or reports remain blocked until the dependency is available.
- **Complexity**: 5
- **Dependencies**: Tasks 1.4, 3.1
- **Acceptance Criteria**:
  - Users always see whether a dependency is auto-installable or manual.
  - Manual flows expose the verification action after host setup is complete.
  - Dependency usage explanations reduce guesswork during troubleshooting.
- **Validation**:
  - `node --test scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `npm run rooms:build`

## Sprint 4: Unified Reporting And Existing Project Compatibility
**Goal**: Make the new shell produce one coherent report while proving old projects still behave correctly.
**Demo/Validation**:
- Load an existing project and complete a run through the unified workbench.
- Open one combined report surface with module-specific sections and coherent summary cards.

### Task 4.1: Merge report composition into one workbench report
- **Location**: `rooms/laboratory/shared/ui/report-stage.ts`, `rooms/laboratory/shared/ui/report-stage-subtitle.ts`, `rooms/laboratory/shared/host/reporting.ts`, `rooms/laboratory/shared/host/reporting-markdown.ts`, `rooms/laboratory/shared/host/reporting-audio.ts`, `rooms/laboratory/shared/host/reporting-subtitle.ts`
- **Description**: Present a single report view with grouped module sections, cross-module findings, exports, and evidence artifacts instead of separate mental models per feature.
- **Complexity**: 7
- **Dependencies**: Tasks 1.2, 1.3, 2.3
- **Acceptance Criteria**:
  - The report surface reads like one Laboratory outcome, not three stitched tabs.
  - Media, audio, and subtitle findings can coexist in one summary and export flow.
  - Empty, stale, partial-result, and degraded-result states remain explicit.
- **Validation**:
  - `node --test scripts/tests/laboratory-media-report-behavior-regressions.test.ts`
  - `node --test scripts/tests/laboratory-subtitle-report-behavior-regressions.test.ts`
  - `npm run rooms:build`

### Task 4.2: Prove existing project resume and partial-run compatibility
- **Location**: `rooms/laboratory/shared/host/project-lifecycle.ts`, `rooms/laboratory/shared/host/project-manifests.ts`, `rooms/laboratory/shared/host/process-report-state.ts`, `scripts/tests/laboratory-*.test.ts`
- **Description**: Add a compatibility smoke matrix for old projects, partial runs, stale outputs, and mixed module completion states so the central workbench does not silently regress older Laboratory data.
- **Complexity**: 7
- **Dependencies**: Tasks 1.3, 2.3, 4.1
- **Acceptance Criteria**:
  - Old projects can resume in the new workbench.
  - Partial media/audio/subtitle completion still projects into correct readiness and report states.
  - Stale or missing feature branches fail safely.
- **Validation**:
  - `node --test scripts/tests/laboratory-host-import-smoke-regressions.test.ts`
  - `node --test scripts/tests/laboratory-media-source-portability-regressions.test.ts`
  - `npm run rooms:build`

### Task 4.3: Tighten installed-room parity during feature delivery, not after it
- **Location**: `scripts/rooms/build-workspace-rooms.ts`, `config/rooms.json`, `data/rooms/laboratory/`, `scripts/tests/room-workspace-build-regressions.test.ts`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Rebuild the installed room bundle as part of the reporting and compatibility phase so the shipped room is already proving parity before final polish.
- **Complexity**: 6
- **Dependencies**: Tasks 2.1, 3.1, 4.1
- **Acceptance Criteria**:
  - Workspace and installed room copies stay aligned during active development.
  - The real shipped room path is covered before the last sprint.
  - Generated room output is not treated as a final cleanup step.
- **Validation**:
  - `npm run rooms:build`
  - `node --test scripts/tests/room-workspace-build-regressions.test.ts`
  - `node --test scripts/tests/room-bundle-import-regressions.test.ts`

## Sprint 5: Scene Simplification, Final Sync, And Closure
**Goal**: Simplify the visible room scene only after the workbench and compatibility layers are proven.
**Demo/Validation**:
- The room scene reflects the new unified Laboratory experience.
- Installed-room output, regressions, and polish all close cleanly.

### Task 5.1: Simplify room scene entry only after the workbench is stable
- **Location**: `rooms/laboratory/manifest.json`, `config/rooms.json`, `src/js/pages/room-page/*`, `src/js/modules/rooms/room-scene-debug.ts`, `shared/themes/castle/maps/rooms.scene.json`
- **Description**: Replace the current multi-hotspot analysis entry model with a cleaner single-entry or subordinate scene structure only after room-page, scene-debug, installed-room build, and persisted project readers are already compatible.
- **Complexity**: 6
- **Dependencies**: Tasks 1.1, 4.2, 4.3
- **Acceptance Criteria**:
  - The room scene no longer implies three equal top-level analysis rooms.
  - Scene-debug and room-page resolution remain correct after the visual simplification.
  - Feature ids can remain internally alive even if the scene becomes visually unified.
- **Validation**:
  - `node --test scripts/tests/scene-debug-room-regressions.test.ts`
  - `node --test scripts/tests/room-page-regressions.test.ts`
  - `npm run rooms:build`

### Task 5.2: Final polish for desktop constraints and degraded states
- **Location**: `rooms/laboratory/shared/styles/*.css`, `rooms/laboratory/ui/*`, `rooms/laboratory/i18n/*.json`
- **Description**: Refine spacing, copy density, empty states, blocked states, and smaller-desktop behavior so the workbench feels intentional instead of crowded.
- **Complexity**: 5
- **Dependencies**: Tasks 2.1, 3.1, 4.1
- **Acceptance Criteria**:
  - The default desktop view fits without giant stacked buttons or excessive scrolling.
  - Missing tool, missing model, degraded mode, and partial-run states remain readable at a glance.
  - The workbench keeps one visual language from intake through report.
- **Validation**:
  - `node --test scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:build`

### Task 5.3: Final regression closure and release readiness
- **Location**: `scripts/tests/laboratory-*.test.ts`, `scripts/tests/room-*.test.ts`, `data/rooms/laboratory/`
- **Description**: Run the final target suite, confirm installed-room parity, and close any remaining regressions before the room is considered complete.
- **Complexity**: 5
- **Dependencies**: All prior sprint tasks
- **Acceptance Criteria**:
  - Core Laboratory, room packaging, room UI, room-page, and scene regressions pass together.
  - Installed-room output matches the intended release state.
  - No known compatibility gap remains open for existing projects.
- **Validation**:
  - `npm run rooms:build`
  - `npm run rooms:test:core`
  - `npm run typecheck`

## Testing Strategy
- Run `npm run rooms:build` after every sprint that changes manifest, UI runtime, host runtime, packaging, or room metadata.
- Run installed-room regressions early and repeatedly instead of waiting for the final sprint.
- Keep `npm run typecheck` mandatory once Sprint 1 starts touching shared room and host types.
- Re-run Laboratory-specific regressions whenever adapters, readiness logic, report composition, dependency management, or scene behavior changes.
- Include a manual smoke matrix for:
  - existing project resume
  - new project creation
  - missing dependency path
  - missing model path
  - automatic install path
  - manual install guidance path
  - degraded readiness path
  - unified report after partial module completion

## Potential Risks & Gotchas
- The current room/page/scene contract still expects real feature entries, so flattening the manifest too early can break room entry and scene mode.
- The current persistence model is both path-based and feature-keyed, so compatibility work must cover data shape as well as directory layout.
- The central shell can become another crowded dashboard if it only restyles existing cards instead of removing duplicates and clarifying hierarchy.
- Tool installs and model installs already have different lifecycle paths today; the new management center must not split them again.
- Workspace-room success is not enough; the installed room under `data/rooms/laboratory/` must stay in sync throughout development.
- Subtitle, audio, and media runs have different readiness semantics, so the central readiness gate must explain `blocked`, `optional`, and `degraded` states clearly.

## Rollback Plan
- Land each sprint as an isolated commit boundary so the room can roll back to the prior shell if compatibility breaks.
- Preserve the legacy host runtimes and feature-specific projections until the unified workbench passes compatibility checks.
- Avoid destructive project-directory migrations in the first implementation pass.
- Treat scene simplification and any future feature-id flattening as the last migration step, not the first.
