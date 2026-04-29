# Plan: Laboratory Cleanup

**Generated**: 2026-04-30
**Estimated Complexity**: High

## Overview
Laboratory cleanup will remove old system residue across four connected surfaces: legacy stage compatibility, old UI fallback paths, unused CSS, and the removed `subtitle-analysis` feature. The work should be done as a controlled, testable cleanup rather than a broad rewrite, because Laboratory has persisted project state, room manifest contracts, host runtime composition, and many targeted regression tests.

Primary goals:
- Remove `subtitle-analysis` as a supported Laboratory feature and clean its remaining host, runtime, schema, manifest, i18n, and test traces.
- Retire the `LabStage/currentStage` legacy projection once the UI and runtime no longer need stage-shaped state.
- Remove old UI fallback components and fallback copy that only supported prior Laboratory shells.
- Delete unused CSS classes proven by inventory plus targeted `rg` checks.
- Keep media and audio analysis behavior intact.

Safe assumptions:
- `subtitle-analysis` has already been intentionally removed as a product feature, so remaining references are cleanup targets unless they are needed for migration of stored project data.
- Audio/tool fallbacks are out of scope unless they are UI-only remnants of the old Laboratory shell.
- Saved Laboratory projects were deleted before implementation, so no persisted-project migration is required for `subtitleAnalysis`, `currentStage`, or `workbench.activeModuleId = "subtitle-analysis"`. New state contracts can be simplified directly.
- `data/rooms/laboratory` must not be edited as peer source. Workspace source of truth is `rooms/laboratory`.

## Prerequisites
- Start each implementation session with `npm run mode:status` and `npm run whereami`.
- If code changes are made later, follow the repo approval and syntax-check flow before editing.
- Baseline inventory:
  - `npm run laboratory:cleanup:inventory`
  - `npm run laboratory:cleanup:gate`
- Baseline validation:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
- Do not manually edit installed/runtime copies under `data/rooms/laboratory`.

## Sprint 1: Baseline And Cleanup Guardrails
**Goal**: Establish a reproducible cleanup inventory before removing anything.
**Demo/Validation**:
- `npm run laboratory:cleanup:inventory` produces a saved or copied baseline.
- `npm run laboratory:cleanup:gate` reports known current findings.
- Targeted `rg` lists for `subtitle-analysis`, `currentStage`, `LabStage`, `legacy`, `compat`, and `fallback` are captured for implementation reference.

### Task 1.1: Capture Cleanup Inventory
- **Location**: `rooms/laboratory/scripts/laboratory-cleanup-inventory.ts`, `rooms/laboratory/scripts/laboratory-dead-code-gate.ts`
- **Description**: Run the inventory and gate scripts, record the current unused exports, zero-indegree files, CSS candidates, and legacy markers.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - The current 7 unused exports and 3 zero-indegree UI files are confirmed or superseded by fresh output.
  - The current CSS candidate list is available for manual verification.
- **Validation**:
  - `npm run laboratory:cleanup:inventory`
  - `npm run laboratory:cleanup:gate`

### Task 1.2: Tighten Cleanup Definitions
- **Location**: `rooms/laboratory/README.md`
- **Description**: Update Laboratory cleanup ownership notes so `subtitle-analysis` is no longer protected as internal transcript support. Replace the old protection rule with a migration rule for stale persisted `subtitleAnalysis` data.
- **Complexity**: 2
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - README no longer says `subtitle-analysis` must be preserved.
  - README clearly says path-loaded tool data is still protected unless proven unrelated.
- **Validation**:
  - `rg -n "subtitle-analysis|internal transcript support" rooms/laboratory/README.md`

### Task 1.3: Classify Fallback Hits
- **Location**: `rooms/laboratory/runtime`, `rooms/laboratory/ui`, `rooms/laboratory/shared/host`, `rooms/laboratory/main-functions`
- **Description**: Split fallback hits into three buckets: UI legacy fallback to remove, valid i18n/runtime default to keep, and data migration fallback to keep temporarily.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - UI-only fallback cleanup targets are listed.
  - Audio/tool operational fallbacks are explicitly excluded.
  - Data migration fallbacks are either scoped for deletion in later sprints or documented as temporary.
- **Validation**:
  - `rg -n "fallback|legacy|deprecated|compat" rooms/laboratory/runtime rooms/laboratory/ui rooms/laboratory/shared/host rooms/laboratory/main-functions -g '*.ts'`

## Sprint 2: Remove Dead UI Files And Unused Exports
**Goal**: Make the existing dead-code gate pass for known low-risk findings.
**Demo/Validation**:
- `npm run laboratory:cleanup:gate` no longer reports the initial unused files or exports.
- Focused UI tests continue to pass.

### Task 2.1: Remove Zero-Indegree UI Components
- **Location**: `rooms/laboratory/ui/components/artifact-item.ts`, `rooms/laboratory/ui/context-action-bar.ts`, `rooms/laboratory/ui/workspace-hypothesis.ts`
- **Description**: Delete the three currently unreferenced UI files after confirming no dynamic import or string-based loader references exist.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The files are removed.
  - No import, test, or manifest references remain.
- **Validation**:
  - `rg -n "artifact-item|context-action-bar|workspace-hypothesis" rooms/laboratory scripts/tests`
  - `npm run laboratory:cleanup:gate`
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`

### Task 2.2: Remove Unused Project Import Export
- **Location**: `rooms/laboratory/runtime/lab-project-import.ts`
- **Description**: Remove `getProjectImportActionForMethod` if fresh import graph confirms it is not used.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Export is removed or converted to local only if a local use exists.
  - No tests import the symbol.
- **Validation**:
  - `rg -n "getProjectImportActionForMethod" rooms/laboratory scripts/tests`
  - `npm run rooms:typecheck`

### Task 2.3: Remove Unused User Action Display Exports
- **Location**: `rooms/laboratory/runtime/lab-user-actions.ts`
- **Description**: Remove unused display helpers `getLabUserActionDisplayText`, `getLabUserActionPrimaryOutput`, and `getLabUserActionOutputLabel` if the fresh gate still reports them.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Unused exports are gone.
  - Any remaining user action helpers are still covered by imports or tests.
- **Validation**:
  - `rg -n "getLabUserActionDisplayText|getLabUserActionPrimaryOutput|getLabUserActionOutputLabel" rooms/laboratory scripts/tests`
  - `npm run laboratory:cleanup:gate`

## Sprint 3: Remove Subtitle Analysis Feature Surface
**Goal**: Remove `subtitle-analysis` from public room, host composition, runtime config, project state, reporting, and tests while preserving media and audio analysis.
**Demo/Validation**:
- Manifest exposes only `media-analysis` and `audio-analysis`.
- Typecheck passes without `subtitle-analysis` feature types.
- Updated tests assert the new two-feature Laboratory contract.

### Task 3.1: Update Manifest And Room Contract
- **Location**: `rooms/laboratory/manifest.json`
- **Description**: Remove `subtitle-analysis` from `workbench.availableFeatureIds`, `features`, and description copy.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Manifest feature list contains only `media-analysis` and `audio-analysis`.
  - Room description no longer promises subtitle modules.
- **Validation**:
  - `rg -n "subtitle-analysis|subtitle" rooms/laboratory/manifest.json`
  - `npm run rooms:test:file -- scripts/tests/room-manifest-regressions.test.ts scripts/tests/room-page-regressions.test.ts scripts/tests/scene-debug-room-regressions.test.ts`

### Task 3.2: Shrink Laboratory Feature Types
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/shared/host/runtime-primitives.ts`
- **Description**: Remove `subtitle-analysis` from `LabFeatureId`, `LAB_FEATURES`, feature normalization, runtime feature constants, and feature-to-state maps.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `isLabFeatureId` rejects `subtitle-analysis`.
  - Default/normalization paths land on media or audio only.
  - Compile errors identify all downstream references for planned cleanup.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 3.3: Remove Subtitle Host Runtime Composition
- **Location**: `rooms/laboratory/host/feature-adapters.ts`, `rooms/laboratory/host/feature-runtimes.ts`, `rooms/laboratory/host/runtime.ts`, `rooms/laboratory/shared/host/action-composition.ts`, `rooms/laboratory/shared/host/action-router.ts`, `rooms/laboratory/shared/host/process-composition.ts`, `rooms/laboratory/shared/host/state-composition.ts`
- **Description**: Remove imports, dependency slots, runtime factories, and delegation methods that only exist for subtitle analysis.
- **Complexity**: 7
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - No host composition imports from `main-functions/subtitle-analysis`.
  - Media and audio runtime adapters still initialize.
  - Missing subtitle runtime no longer requires defensive fallback code.
- **Validation**:
  - `rg -n "subtitle-analysis|SubtitleAnalysis|subtitleAnalysis|Subtitle" rooms/laboratory/host rooms/laboratory/shared/host -g '*.ts'`
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts`

### Task 3.4: Remove Subtitle Project State And Schema
- **Location**: `rooms/laboratory/shared/data/tools/project-schema.json`, `rooms/laboratory/shared/host/project-records.ts`, `rooms/laboratory/shared/host/project-state.ts`, `rooms/laboratory/shared/host/project-paths.ts`, `rooms/laboratory/shared/host/room-snapshot.ts`, `rooms/laboratory/shared/host/runtime-bootstrap.ts`, `rooms/laboratory/shared/host/project-config-loader.ts`
- **Description**: Remove active `subtitleAnalysis` project state, paths, config loading, snapshot fields, and bootstrap config. Because saved projects were deleted before implementation, do not keep migration-only rehydration code.
- **Complexity**: 8
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - New projects do not create `subtitleAnalysis`.
  - No active normalizer or snapshot code rehydrates `subtitleAnalysis`.
  - Runtime no longer loads subtitle catalog/capability/provider JSON.
- **Validation**:
  - `rg -n "subtitleAnalysis|subtitle-analysis|subtitle" rooms/laboratory/shared/host rooms/laboratory/shared/data/tools/project-schema.json`
  - `npm run rooms:test:file -- scripts/tests/laboratory-state-persistence-v2-regressions.test.ts scripts/tests/laboratory-scope-aware-analysis-regressions.test.ts`

### Task 3.5: Classify And Remove Extended Subtitle References
- **Location**: `rooms/laboratory/i18n`, `rooms/laboratory/services/process-output-parser.ts`, `rooms/laboratory/runtime/selectors/lab-project-selectors.ts`, `rooms/laboratory/shared/host/runtime-events.ts`, `rooms/laboratory/shared/host/reporting-export.ts`, `rooms/laboratory/shared/types/analysis-scope.ts`, `rooms/laboratory/shared/data/tools/toolchain.manifest.json`, migration/build scripts that mention subtitle paths`
- **Description**: Remove non-obvious subtitle traces outside the main host/schema path: i18n sections, parser aliases, selector aliases, runtime event feature maps, report export labels, analysis-scope feature lists, toolchain entries, and migration/build references.
- **Complexity**: 7
- **Dependencies**: Task 3.4
- **Acceptance Criteria**:
  - `rg` subtitle scans show only intentional historical notes or none.
  - Media/audio parser, event, scope, and report export behavior still works.
  - Removed subtitle i18n keys do not leave dangling lookups.
- **Validation**:
  - `rg -n "subtitle-analysis|subtitleAnalysis|SubtitleAnalysis|subtitle" rooms/laboratory -g '*.ts' -g '*.json' -g '*.md'`
  - `npm run rooms:typecheck`

### Task 3.6: Remove Subtitle Reports And Managed Runner
- **Location**: `rooms/laboratory/shared/host/reporting-subtitle.ts`, `rooms/laboratory/shared/host/reporting-feature-report.ts`, `rooms/laboratory/shared/host/process-delegates.ts`, `rooms/laboratory/shared/host/process-managed-subtitle-runner.ts`, `rooms/laboratory/shared/host/process-managed-runners.ts`, `rooms/laboratory/shared/host/process-runtime.ts`
- **Description**: Delete subtitle-only reporting and runner modules, then simplify process routing to media/audio only.
- **Complexity**: 7
- **Dependencies**: Task 3.5
- **Acceptance Criteria**:
  - No process runner branch can dispatch subtitle analysis.
  - Report export handles media/audio only.
  - Removed subtitle report tests are updated or deleted.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-report-composition-v2-regressions.test.ts scripts/tests/laboratory-media-edit-behavior-regressions.test.ts`

### Task 3.7: Delete Subtitle Main Function Package And Tool Data
- **Location**: `rooms/laboratory/main-functions/subtitle-analysis`, `rooms/laboratory/shared/data/tools/subtitle-*`
- **Description**: Delete the subtitle main-function directory and subtitle-only tool catalog/capability/provider/form JSON files after all imports and dynamic loaders are removed.
- **Complexity**: 5
- **Dependencies**: Tasks 3.3, 3.4, 3.5, 3.6
- **Acceptance Criteria**:
  - Subtitle main function files are gone.
  - Subtitle-only tool data files are gone.
  - Cleanup inventory keep-list no longer preserves removed subtitle paths indirectly.
- **Validation**:
  - `rg --files rooms/laboratory | rg "subtitle-analysis|subtitle-"`
  - `npm run laboratory:cleanup:gate`

### Task 3.8: Update Subtitle-Dependent Tests
- **Location**: `scripts/tests`
- **Description**: Update tests that assert `subtitle-analysis` is present. Delete tests whose only purpose was subtitle runtime behavior, and change generic Laboratory tests to assert media/audio only.
- **Complexity**: 6
- **Dependencies**: Tasks 3.1 through 3.7
- **Acceptance Criteria**:
  - Tests no longer expect subtitle feature IDs, runtime imports, installed parity paths, or subtitle reports.
  - Generic room, manifest, source UI, and host action tests still cover media/audio.
- **Validation**:
  - `rg -n "subtitle-analysis|subtitleAnalysis|SubtitleAnalysis" scripts/tests`
  - `npm run rooms:test:file -- scripts/tests/room-manifest-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-report-composition-v2-regressions.test.ts`

## Sprint 4: Retire Legacy Stage Compatibility
**Goal**: Remove `LabStage/currentStage` as an active UI/runtime contract and replace it with condition-driven workspace state.
**Demo/Validation**:
- UI no longer depends on `data-stage` or stage-click compatibility.
- Store/selectors no longer expose deprecated stage navigation helpers.
- Persisted old `currentStage` does not break load.

### Task 4.1: Map Current Stage Consumers
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/tool-management-overlay.ts`
- **Description**: Confirm every `currentStage`, `LabStage`, `LabStageSurface`, `stage-changed`, and `deriveLegacyStage` consumer and classify it as UI metadata, persisted hydration, action routing, or dead compatibility.
- **Complexity**: 4
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - A removal map exists before edits.
  - Any persisted migration requirement is identified.
- **Validation**:
  - `rg -n "currentStage|LabStage|LabStageSurface|stage-changed|deriveLegacyStage|getStageBlockReason|canAdvanceToStage" rooms/laboratory -g '*.ts'`

### Task 4.2: Remove Deprecated Stage Selectors
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Remove `getStageBlockReason`, `canAdvanceToStage`, and `getPrimaryActionLabel` stage parameter compatibility after replacing call sites with condition-driven selectors. Keep `deriveLegacyStage` until `currentStage` is removed from store/persistence in the same state-contract slice.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Deprecated selectors are gone.
  - Readiness is still derived from source/edit/process/report conditions through current selector APIs.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-stage-decoupling-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-selection-runtime-regressions.test.ts`

### Task 4.3: Remove Stage Events And Controller No-Ops
- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/models/lab-types.ts`
- **Description**: Remove `stage-changed` events and no-op stage click handling that only preserved old UI navigation.
- **Complexity**: 5
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - No stage click compatibility code remains.
  - Controller actions are driven by explicit source/edit/process/report commands or workspace state.
- **Validation**:
  - `rg -n "stage-changed|legacy stage|stage clicks|deriveLegacyStage" rooms/laboratory/runtime rooms/laboratory/models`
  - `npm run rooms:typecheck`

### Task 4.4: Remove Current Stage From Store State
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-persistence.ts`
- **Description**: Remove active `currentStage` from `LabStoreState` and stop persisting it. Saved projects were deleted before implementation, so no persisted-project migration branch is required.
- **Complexity**: 8
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - New persisted Laboratory state no longer writes `currentStage`.
  - `schemaVersion` and persistence payloads no longer require `currentStage`.
  - `LabStage` type is removed unless still needed by migration-only code.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-state-persistence-v2-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 4.5: Remove Stage UI Metadata
- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-layout.ts`, `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/tool-management-overlay.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Remove `data-stage`, `LabStageSurface`, and any CSS or render logic that exists only for stage metadata.
- **Complexity**: 6
- **Dependencies**: Task 4.4
- **Acceptance Criteria**:
  - UI renders from workspace, process, report, and project state rather than stage labels.
  - No `data-stage` selector is required by CSS or tests.
- **Validation**:
  - `rg -n "data-stage|LabStageSurface|currentStage" rooms/laboratory/ui rooms/laboratory/ui/*.css rooms/laboratory/ui/styles`
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

## Sprint 5: Remove Old UI Fallbacks
**Goal**: Remove UI fallback paths that only existed for older Laboratory shells, while keeping legitimate translation fallbacks.
**Demo/Validation**:
- UI tests pass with fallback UI remnants removed.
- Runtime i18n remains resilient through explicit catalog fallback behavior.

### Task 5.1: Remove Legacy Source And Layout Copy
- **Location**: `rooms/laboratory/ui/lab-source-retry-copy.ts`, `rooms/laboratory/ui/project-source-import.ts`, `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-root.ts`
- **Description**: Remove old source retry/helper copy that duplicates current project import UI behavior. Keep error copy that is still emitted by active source actions.
- **Complexity**: 4
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - No old local-copy helper copy remains.
  - Source import still presents valid local, URL, and YouTube states for supported media/audio flows.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts`

### Task 5.2: Remove UI Shell Fallbacks
- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-layout.ts`, `rooms/laboratory/ui/lab-center-panel.ts`, `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/project-workspace-overlay.ts`
- **Description**: Remove fallback rendering paths that display old shell or empty workbench variants no longer reachable after the current project workspace flow.
- **Complexity**: 6
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Empty/error states are still intentional and testable.
  - No branch exists only to support the removed stage shell or subtitle feature.
- **Validation**:
  - `rg -n "fallback|legacy|compat|deprecated" rooms/laboratory/ui -g '*.ts'`
  - `npm run rooms:test:file -- scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-project-management-regressions.test.ts`

### Task 5.3: Keep Legitimate I18n Fallbacks Explicit
- **Location**: `rooms/laboratory/ui/lab-i18n.ts`, `rooms/laboratory/ui/lab-runtime-i18n.ts`, `rooms/laboratory/runtime/lab-i18n.ts`
- **Description**: Keep translation fallback mechanics, but rename or document them as catalog defaults if the term `fallback` causes inventory noise.
- **Complexity**: 3
- **Dependencies**: Sprint 5.2
- **Acceptance Criteria**:
  - Translation behavior remains intact.
  - Cleanup inventory no longer treats valid i18n defaults as old UI fallback targets, or the plan documents why they remain.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/i18n-ui-regressions.test.ts scripts/tests/i18n-language-loader-regressions.test.ts`

## Sprint 6: CSS Prune
**Goal**: Delete unused Laboratory CSS classes after code and feature cleanup have made the inventory stable.
**Demo/Validation**:
- CSS inventory has no stale candidates except intentionally documented dynamic class names.
- Visual contract tests pass.

### Task 6.1: Re-run CSS Inventory After Code Cleanup
- **Location**: `rooms/laboratory/ui/style.css`, `rooms/laboratory/ui/lab-theme.css`, `rooms/laboratory/ui/styles/base.css`, `rooms/laboratory/ui/styles/project-workspace.css`, `rooms/laboratory/main-functions/media-analysis/styles.css`
- **Description**: Re-run `npm run laboratory:cleanup:inventory` after Sprints 2-5. Use the fresh `possiblyUnused` list rather than the initial 40-class list.
- **Complexity**: 2
- **Dependencies**: Sprints 2 through 5
- **Acceptance Criteria**:
  - Fresh CSS candidate list is available.
  - Any dynamic class generation is verified with `rg`.
- **Validation**:
  - `npm run laboratory:cleanup:inventory`

### Task 6.1a: Decide Media Analysis Stylesheet Fate
- **Location**: `rooms/laboratory/main-functions/media-analysis/styles.css`
- **Description**: Before selector deletion, decide whether this file is an obsolete stylesheet entry or a stylesheet that should be restored. It currently imports missing-looking `./styles/edit.css` and `./styles/profile.css` paths, so it must not be treated as normal selector inventory without this decision.
- **Complexity**: 3
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - The file is deleted if obsolete, or repaired if it is still part of a valid entrypoint.
  - Cleanup inventory no longer reports misleading CSS state from this file.
- **Validation**:
  - `rg -n "main-functions/media-analysis/styles.css|media-analysis/styles.css" rooms/laboratory scripts/tests`
  - `npm run laboratory:cleanup:inventory`

### Task 6.2: Delete Proven Unused CSS Selectors
- **Location**: `rooms/laboratory/ui/lab-theme.css`, `rooms/laboratory/ui/styles/base.css`, `rooms/laboratory/ui/styles/project-workspace.css`, `rooms/laboratory/main-functions/media-analysis/styles.css`
- **Description**: Remove selectors whose class names are absent from UI source, tests, HTML, and dynamic class builders. Initial likely candidates include stage/header preview remnants and right-context/intent-preview classes, but only the fresh inventory should drive deletion.
- **Complexity**: 5
- **Dependencies**: Task 6.1a
- **Acceptance Criteria**:
  - Deleted selectors have no source references.
  - Remaining CSS files still form the same entry chain from `ui/style.css`.
  - No CSS import path is broken.
- **Validation**:
  - `rg -n "<deleted-class-name>" rooms/laboratory scripts/tests`
  - `npm run rooms:test:file -- scripts/tests/room-layout-contract-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts`

### Task 6.3: Update Cleanup Gate Expectations If Needed
- **Location**: `rooms/laboratory/scripts/laboratory-cleanup-inventory.ts`, `rooms/laboratory/scripts/laboratory-dead-code-gate.ts`
- **Description**: If the cleanup tool flags dynamic class names incorrectly, add narrow keep-list logic or improve class detection rather than leaving recurring false positives.
- **Complexity**: 4
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - Gate catches real dead code.
  - False positives are minimized and documented in tool logic.
- **Validation**:
  - `npm run laboratory:cleanup:inventory`
  - `npm run laboratory:cleanup:gate`

## Sprint 7: Final Regression And Packaging
**Goal**: Prove Laboratory still builds and runs as a media/audio workbench after cleanup.
**Demo/Validation**:
- Typecheck, targeted tests, room build, and cleanup gate pass.
- Installed room parity tests no longer expect subtitle artifacts.

### Task 7.1: Run Targeted Laboratory Regression Set
- **Location**: `scripts/tests`
- **Description**: Run the focused Laboratory suites most likely to catch feature contract, store, UI, and host regressions.
- **Complexity**: 3
- **Dependencies**: Sprints 2 through 6
- **Acceptance Criteria**:
  - All targeted suites pass or are updated for the intentional two-feature contract.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-state-persistence-v2-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`

### Task 7.2: Run Global Room Validation
- **Location**: repo root
- **Description**: Run broad room validation after targeted suites pass.
- **Complexity**: 4
- **Dependencies**: Task 7.1
- **Acceptance Criteria**:
  - Typecheck passes.
  - Room build passes.
  - Core room tests pass or known unrelated failures are documented.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:build`
  - `npm run rooms:test:core`

### Task 7.3: Final Cleanup Gate
- **Location**: `rooms/laboratory`
- **Description**: Run the cleanup inventory and gate one final time and confirm no unintended dead-code or CSS findings remain.
- **Complexity**: 2
- **Dependencies**: Task 7.2
- **Acceptance Criteria**:
  - `laboratory:cleanup:gate` passes.
  - Any remaining inventory marker is intentional and documented.
- **Validation**:
  - `npm run laboratory:cleanup:inventory`
  - `npm run laboratory:cleanup:gate`

## Testing Strategy
- Start with cleanup scripts to avoid guessing about dead code.
- Use typecheck after each subtitle-removal slice because TypeScript will reveal hidden contract references.
- Keep test updates in the same sprint as the behavior they intentionally change.
- Run UI-focused tests after removing fallback UI and CSS.
- Run room build only after imports and CSS entrypoints are stable.

Recommended command order:
1. `npm run laboratory:cleanup:inventory`
2. `npm run laboratory:cleanup:gate`
3. `npm run rooms:typecheck`
4. `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
5. `npm run rooms:test:file -- scripts/tests/room-manifest-regressions.test.ts scripts/tests/room-page-regressions.test.ts scripts/tests/scene-debug-room-regressions.test.ts`
6. `npm run rooms:build`
7. `npm run rooms:test:core`

## Potential Risks & Gotchas
- Saved projects were deleted before implementation, so `subtitleAnalysis/currentStage` migration is intentionally skipped. If old project data is reintroduced later, this cleanup may need a one-off importer or reset path.
- The cleanup inventory protects path-loaded data. After subtitle removal, keep-list behavior may need to change so subtitle tool JSON is not preserved by default.
- CSS inventory is conservative. Dynamic class names and state attributes must be checked manually before deleting selectors.
- `deriveLegacyStage` must not be removed before `currentStage` is removed from store/persistence; otherwise the store dispatch loop will break.
- Tests that mention subtitle may be generic room contract tests, not subtitle-only tests. Update expected feature lists carefully.
- `rooms/laboratory/main-functions/media-analysis/styles.css` currently imports missing-looking `./styles/edit.css` and `./styles/profile.css` paths. Verify whether this file is obsolete before deleting or altering it.
- I18n fallback mechanics are probably valid defaults, not old UI fallback residue. Avoid removing translation resilience.

## Rollback Plan
- Keep each sprint as a separate commit-sized change.
- If subtitle removal breaks startup despite deleted saved projects, restore the last safe state normalization boundary and add a narrow reset path rather than reintroducing the feature.
- If CSS deletion causes layout regressions, revert only the CSS prune commit and rerun inventory with a dynamic keep-list.
- If stage removal is too risky, stop after deleting deprecated selector exports and leave `currentStage` as migration-only state for a later sprint.
- If broad room tests fail for unrelated rooms, keep targeted Laboratory validation results and document the unrelated failures before proceeding.
