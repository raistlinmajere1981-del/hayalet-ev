# Plan: Laboratory Cleanup And God File Reduction

**Generated**: 2026-04-26
**Estimated Complexity**: High

## Overview

Laboratory has accumulated several revision layers across UI, runtime selectors, store reducers, host orchestration, process runners, and room-local catalogs. This cleanup should be aggressive, but it must be evidence-led: remove only code proven unused, retire legacy compatibility only after hydration and installed-room parity are protected, and split god files along existing room boundaries instead of introducing a new architecture.

The work should stay source-first:

- Source of truth is `rooms/laboratory/**`.
- `data/rooms/laboratory/**` is generated/installed output and must not be edited directly.
- Tests may be updated under `scripts/tests/laboratory-*.test.ts` only when the removed behavior is intentionally retired.
- Global Electron or room packaging files should be touched only if the cleanup exposes a real package-boundary issue.

## Research Snapshot

- Current mode during planning: `terminal`; `whereami.effectiveMode`: `other-provider-cli`; workflow should be plain `workflow:terminal-mode`.
- Laboratory source inventory is large: about 73k lines across `rooms/laboratory` code, JSON, CSS, and HTML.
- Largest god-file candidates found:
  - `rooms/laboratory/ui/lab-theme.css` at about 6.1k lines.
  - `rooms/laboratory/runtime/lab-store.ts` at about 2.6k lines.
  - `rooms/laboratory/runtime/lab-run-controller.ts` at about 2.6k lines.
  - `rooms/laboratory/runtime/lab-selectors.ts` at about 1.9k lines with high fan-in.
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts` at about 1.7k lines.
  - `rooms/laboratory/ui/workspace-surface.ts` at about 1.6k lines.
  - `rooms/laboratory/models/lab-types.ts` at about 1.3k lines and about 95 import references.
- Initial dead-code candidate:
  - `rooms/laboratory/ui/workspace-intents.ts` has zero Laboratory import references.
  - Its matching CSS selectors appear only in `lab-theme.css`.
- CSS audit baseline:
  - `rooms/laboratory/ui/lab-theme.css` plus `style.css` define about 643 class selectors.
  - A conservative static scan found about 76 possibly unused class selectors.
  - Because Laboratory markup is template-string heavy, CSS removal needs runtime or markup-snapshot confirmation before deletion.
- Baseline validation observed during planning:
  - `npm run rooms:typecheck` passed.
  - Targeted host/UI smoke tests passed:
    `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - Global `knip:strict` currently reports many repo-level false positives and is not yet Laboratory-scoped enough to be a cleanup gate.

## Prerequisites

- Before implementation, present the repository change-approval block unless the next user request explicitly starts with `Fast:`.
- Confirm mode before implementation with `npm run mode:status` and `npm run whereami`.
- Start from a clean mental boundary: ignore unrelated current worktree changes unless they touch `rooms/laboratory/**` or relevant Laboratory tests.
- Do not edit `data/rooms/laboratory/**` directly; refresh installed output through the room build/sync flow only if verification needs it.
- Run a focused baseline before deletion:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - Relevant feature tests listed in the Testing Strategy.
- Treat comments marked `@deprecated`, `legacy`, `fallback`, `compat`, and `stale` as audit targets, not automatic deletion targets.

## Sprint 1: Cleanup Safety Harness

**Goal**: Build a reliable map of what is actually reachable before removing anything.

**Demo/Validation**:

- A repeatable audit command or documented command set identifies Laboratory reachability, largest files, CSS candidates, and fallback/legacy markers.
- No production behavior changes.
- Existing typecheck and targeted tests still pass.

### Task 1.1: Capture The Laboratory Entry Graph

- **Location**:
  - `rooms/laboratory/manifest.json`
  - `rooms/laboratory/ui/index.html`
  - `rooms/laboratory/host/index.ts`
  - `rooms/laboratory/host/runtime.ts`
  - `rooms/laboratory/ui/index.ts`
  - `rooms/laboratory/ui/bootstrap.ts`
  - `rooms/laboratory/ui/lab-root.ts`
  - `rooms/laboratory/i18n/**`
  - `rooms/laboratory/shared/data/tools/**`
  - `rooms/laboratory/main-functions/**/assets/**`
- **Description**: Document the runtime entry chain from manifest to host activation and UI bootstrap, then list dynamic seams that static import tools may miss.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - Entry files and dynamic loader expectations are known before deletion.
  - The keep-list includes manifest asset paths, `i18n.baseDir`, `ui/index.html` stylesheet loading, room-local tool JSON, Python/conf payloads, feature assets, and files copied into installed room output.
  - Dead-code tooling treats path-loaded data and assets differently from TS import reachability.
  - Installed copy behavior is explicitly classified as generated output.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts`

### Task 1.2: Add A Local Cleanup Inventory Script

- **Location**:
  - Preferred: `scripts/rooms/`
  - Optional generated output path: `tmp/laboratory-cleanup-inventory-*.json` or a documented stdout format.
- **Description**: Produce an inventory for file sizes, import fan-in/fan-out, zero-reference files, fallback markers, and CSS selector candidates scoped to `rooms/laboratory`.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The report includes god-file ranking.
  - The report distinguishes static certainty from dynamic-risk candidates.
  - The report can be rerun after each sprint.
  - The script emits before/after artifacts or a stable diffable report for deletion proof.
- **Validation**:
  - Run the script twice and confirm stable output on an unchanged tree.

### Task 1.3: Create A Laboratory-Specific Dead-Code Gate

- **Location**:
  - `knip.config.ts` or a new local audit script, depending on false-positive rate.
  - `package.json` only if adding a durable `laboratory:*` script is justified.
- **Description**: Configure a Laboratory-specific unused-file/export pass that understands room entries and excludes generated `data/rooms/**`.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The gate can flag `rooms/laboratory/ui/workspace-intents.ts` or explain why it is intentionally ignored.
  - Repo-level false positives from Electron, MCP, and other pages do not block Laboratory cleanup.
- **Validation**:
  - Run the new scoped gate and compare with the custom import inventory.

## Sprint 2: First Confirmed Deletions

**Goal**: Remove low-risk dead UI and CSS after proving they are unreachable.

**Demo/Validation**:

- Laboratory still boots through host import and UI smoke tests.
- CSS class count decreases with no visual-contract test failures.
- No installed-copy edits are made.

### Task 2.1: Remove The Unused Workspace Intents Renderer

- **Location**:
  - `rooms/laboratory/ui/workspace-intents.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**: Delete `renderWorkspaceIntents` and the CSS block for `.labx-intents-card` / `.labx-intent-item*` if the Sprint 1 gate confirms no dynamic usage.
- **Complexity**: 2
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - No imports or tests reference `renderWorkspaceIntents`.
  - Related CSS selectors are removed in the same commit.
  - Typecheck passes.
- **Validation**:
  - `rg "renderWorkspaceIntents|labx-intents-card|labx-intent-item" rooms/laboratory scripts/tests`
  - `npm run rooms:typecheck`
  - Targeted UI tests.

### Task 2.2: Remove CSS Blocks With No Markup Or Test References

- **Location**:
  - `rooms/laboratory/ui/lab-theme.css`
  - Related UI template files under `rooms/laboratory/ui/*.ts`
- **Description**: Remove only selector groups whose class names have no source, test, generated snapshot, or runtime DOM evidence. Start with obvious stale families such as old stage grids, preview cards, raw log blocks, and obsolete module rows.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Each removed selector family has a matching `rg` proof before deletion.
  - Each non-trivial selector family also has one stronger proof: runtime DOM snapshot, markup fixture snapshot, or Electron screenshot smoke.
  - Composed classes, conditional class fragments, and `data-*` state selectors are reviewed manually before deletion.
  - Adjacent active selectors are not reformatted unnecessarily.
  - UI smoke tests still pass.
- **Validation**:
  - Re-run CSS inventory.
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 2.3: Retire Obsolete Room-Local Visible Copy

- **Location**:
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
  - UI files that referenced removed copy.
- **Description**: Remove i18n keys used only by deleted UI blocks while preserving key parity between English and Turkish catalogs.
- **Complexity**: 4
- **Dependencies**: Task 2.1, Task 2.2
- **Acceptance Criteria**:
  - Removed keys are not referenced by `copy.t(...)`.
  - `en.json` and `tr.json` retain matching key paths.
- **Validation**:
  - Existing i18n parity tests in `laboratory-ui-evaluation-regressions.test.ts`.
  - `npm run rooms:typecheck`

## Sprint 3: Fallback And Legacy Retirement

**Goal**: Remove compatibility branches that no longer match supported persisted state or user-facing behavior.

**Demo/Validation**:

- Hydration tests continue to pass for supported migrations.
- Tests that still assert retired legacy behavior are updated only after explicit acceptance that the behavior is no longer supported.
- Runtime state shape becomes simpler.

### Task 3.1: Classify Legacy Markers By Owner

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/shared/host/**`
  - `rooms/laboratory/main-functions/**/host/**`
- **Description**: Build a table of `@deprecated`, `legacy`, `compat`, and fallback markers. Classify each as supported migration, active safety fallback, obsolete UI fallback, or process-tool fallback.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Every marker has an owner and removal decision.
  - Tool/runtime fallbacks are not removed just because the word "fallback" appears.
- **Validation**:
  - `rg -n "fallback|legacy|deprecated|compat|stale" rooms/laboratory`

### Task 3.2: Remove Retired UI Compatibility State

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - Tests under `scripts/tests/laboratory-*`
- **Description**: Remove fields such as obsolete module-manager UI state only if hydration tests show no supported persisted payload still needs them.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Removed fields are absent from state creation, hydration, reducer handling, selectors, and tests.
  - Migration tests are updated to assert the new supported boundary.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-state-persistence-v2-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts`

### Task 3.3: Collapse Legacy Feature Visibility

- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
  - `rooms/laboratory/manifest.json`
  - `rooms/laboratory/host/feature-runtimes.ts`
  - `rooms/laboratory/main-functions/subtitle-analysis/**`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
  - `rooms/laboratory/shared/data/tools/project-schema.json`
  - `rooms/laboratory/shared/data/tools/subtitle-*`
- **Description**: Decide whether `subtitle-analysis` remains a hidden internal feature or is fully retired. If retired, remove manifest feature exposure, host adapters, source intake, and tests in one controlled chain.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - No partial state exists where manifest, host runtime, and UI disagree.
  - The decision covers `workbench.availableFeatureIds`, `LabFeatureId`, `isLabFeatureId`, feature metadata, i18n labels/content, project schema records, subtitle tool configs, report composition, room page expectations, scene/debug expectations, and installed parity.
  - If kept, comments and names stop implying accidental legacy debt.
  - If removed, installed host import and report composition tests still pass.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-report-composition-v2-regressions.test.ts scripts/tests/laboratory-host-import-smoke-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/room-manifest-regressions.test.ts scripts/tests/room-page-regressions.test.ts scripts/tests/scene-debug-room-regressions.test.ts scripts/tests/laboratory-source-intake-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`

## Sprint 4: Centralize Repeated Host Utilities

**Goal**: Reduce repeated helper logic across media, audio, subtitle, and shared host files without broad rewrites.

**Demo/Validation**:

- Helper duplication decreases.
- Feature host behavior remains unchanged.
- Existing process and reporting tests pass.

### Task 4.1: Centralize File And String Sanitizers

- **Location**:
  - Current repeats in:
    - `rooms/laboratory/main-functions/media-analysis/host/edit-support.ts`
    - `rooms/laboratory/main-functions/subtitle-analysis/host/edit-workspace.ts`
    - `rooms/laboratory/main-functions/audio-analysis/host/process-model-speaker-diarization.ts`
  - Target:
    - `rooms/laboratory/shared/host/host-utils.ts` or a new narrow utility module.
- **Description**: Move repeated `sanitizeFileSegment`, timestamp formatting, and safe-string helpers into a shared host utility if call sites share identical semantics.
- **Complexity**: 5
- **Dependencies**: Sprint 3 marker classification
- **Acceptance Criteria**:
  - Golden-case filename/timestamp sanitization tests exist before extraction.
  - No behavior drift in generated artifact names.
  - Tests using sanitize stubs are updated to import the real shared helper where practical.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-action-runtime-regressions.test.ts scripts/tests/laboratory-report-composition-v2-regressions.test.ts`

### Task 4.2: Centralize Clamp And Number Normalization

- **Location**:
  - `rooms/laboratory/main-functions/media-analysis/host/profile-state.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/profile-preflight.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/action-handlers-profile.ts`
  - `rooms/laboratory/main-functions/media-analysis/host/edit-artifacts.ts`
  - Target shared helper under `rooms/laboratory/shared/host/`.
- **Description**: Replace duplicated clamp/number coercion helpers with one tested implementation.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Numeric clamp boundary-table tests exist before extraction.
  - Numeric bounds remain identical.
  - Strict room typecheck passes without widening to `any`.
- **Validation**:
  - `npm run rooms:typecheck`
  - Relevant profile and edit tests.

### Task 4.3: Consolidate Process Runner Support

- **Location**:
  - `rooms/laboratory/shared/host/process-managed-media-runner.ts`
  - `rooms/laboratory/shared/host/process-managed-audio-runner.ts`
  - `rooms/laboratory/shared/host/process-managed-subtitle-runner.ts`
  - `rooms/laboratory/shared/host/process-managed-runners.ts`
  - `rooms/laboratory/shared/host/process-runtime.ts`
- **Description**: Identify duplicated process lifecycle, artifact collection, and progress mapping. Extract only stable common pieces; keep feature-specific command construction local.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Process event mapping fixtures exist before extraction.
  - Shared process primitives are smaller and easier to test.
  - Feature-specific runner files stay readable and do not become config blobs.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-audio-runtime-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts scripts/tests/laboratory-runtime-event-v2-regressions.test.ts`

## Sprint 5: God File Split - Runtime State And Selectors

**Goal**: Split large runtime files along domain boundaries while preserving public imports for incremental safety.

**Demo/Validation**:

- `lab-store.ts`, `lab-run-controller.ts`, and `lab-selectors.ts` shrink without changing their exported contract in the first pass.
- Tests pass after each moved domain.
- Follow-up tasks can remove barrels once imports settle.

### Task 5.1: Split Store Normalization Domains

- **Location**:
  - Source: `rooms/laboratory/runtime/lab-store.ts`
  - Targets:
    - `rooms/laboratory/runtime/store/lab-store-assets.ts`
    - `rooms/laboratory/runtime/store/lab-store-projects.ts`
    - `rooms/laboratory/runtime/store/lab-store-workspace.ts`
    - `rooms/laboratory/runtime/store/lab-store-reducer.ts`
- **Description**: Move normalization and reducer helpers by state domain. Keep `createLabStore` exported from `lab-store.ts` during the split.
- **Complexity**: 8
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - `lab-store.ts` becomes an orchestrating module rather than a mixed reducer/normalizer file.
  - No public import path changes are required outside runtime internals in the first commit.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-workspace-runtime-regressions.test.ts scripts/tests/laboratory-project-management-regressions.test.ts`

### Task 5.2: Split Selector Domains

- **Location**:
  - Source: `rooms/laboratory/runtime/lab-selectors.ts`
  - Targets:
    - `rooms/laboratory/runtime/selectors/lab-project-selectors.ts`
    - `rooms/laboratory/runtime/selectors/lab-source-selectors.ts`
    - `rooms/laboratory/runtime/selectors/lab-execution-selectors.ts`
    - `rooms/laboratory/runtime/selectors/lab-report-selectors.ts`
- **Description**: Move selectors by domain, then re-export from `lab-selectors.ts` to avoid a big-bang import rewrite.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Circular imports do not increase.
  - Fan-in remains on the compatibility barrel during the transition.
  - Domain files have clear ownership.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-selection-runtime-regressions.test.ts scripts/tests/laboratory-suggestion-runtime-regressions.test.ts scripts/tests/laboratory-execution-runtime-regressions.test.ts`

### Task 5.3: Split Controller Event Binding Domains

- **Location**:
  - Source: `rooms/laboratory/runtime/lab-run-controller.ts`
  - Targets:
    - `rooms/laboratory/runtime/controller/lab-controller-source-actions.ts`
    - `rooms/laboratory/runtime/controller/lab-controller-workspace-actions.ts`
    - `rooms/laboratory/runtime/controller/lab-controller-media-sync.ts`
    - `rooms/laboratory/runtime/controller/lab-controller-host-messages.ts`
- **Description**: Extract event handlers and media synchronization helpers behind small dependency objects. Keep lifecycle attach/detach orchestration in `lab-run-controller.ts`.
- **Complexity**: 8
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - No listener is registered twice.
  - Timers and media element bindings are disposed in the same conditions as before.
  - UI tests that exercise host traffic and media preservation still pass.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-waveform-runtime-regressions.test.ts scripts/tests/laboratory-runtime-truth-regressions.test.ts`

## Sprint 6: God File Split - UI And CSS

**Goal**: Make UI styling and rendering maintainable without a visual rewrite.

**Demo/Validation**:

- CSS is split into imported modules with no visual-contract regressions.
- Large render files become domain modules with stable public wrappers.
- The room still builds and imports as an installed room.

### Task 6.1: Split `lab-theme.css` Into Layered CSS Modules

- **Location**:
  - Source: `rooms/laboratory/ui/lab-theme.css`
  - Target candidates:
    - `rooms/laboratory/ui/styles/base.css`
    - `rooms/laboratory/ui/styles/layout.css`
    - `rooms/laboratory/ui/styles/workspace.css`
    - `rooms/laboratory/ui/styles/process.css`
    - `rooms/laboratory/ui/styles/timeline.css`
    - `rooms/laboratory/ui/styles/overlays.css`
    - `rooms/laboratory/ui/styles/tools.css`
  - Import owner: `rooms/laboratory/ui/style.css`
- **Description**: Move CSS by visible surface. Preserve selector names unless a selector was already proven dead in Sprint 2.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - CSS import order is explicit.
  - No broad color/theme rewrite happens in this cleanup.
  - Removed CSS remains limited to proven-dead selectors.
- **Validation**:
  - UI evaluation tests.
  - `npm run rooms:build`
  - `npm run rooms:test:file -- scripts/tests/room-bundle-import-regressions.test.ts scripts/tests/room-host-source-regressions.test.ts`
  - Optional Electron smoke screenshot if app mode is available.

### Task 6.2: Split Workspace Surface Rendering

- **Location**:
  - Source: `rooms/laboratory/ui/workspace-surface.ts`
  - Target candidates:
    - `rooms/laboratory/ui/workspace/source-panel.ts`
    - `rooms/laboratory/ui/workspace/preview-panel.ts`
    - `rooms/laboratory/ui/workspace/asset-strip.ts`
    - `rooms/laboratory/ui/workspace/analysis-controls.ts`
- **Description**: Extract pure render helpers by panel. Keep `renderWorkspaceSurface` as the compatibility wrapper.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - No DOM behavior changes.
  - Tests that parse workspace markup still pass with minimal fixture updates.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`

### Task 6.3: Split Waveform Timeline Rendering

- **Location**:
  - Source: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - Target candidates:
    - `rooms/laboratory/ui/timeline/timeline-axis.ts`
    - `rooms/laboratory/ui/timeline/timeline-selection.ts`
    - `rooms/laboratory/ui/timeline/timeline-execution-panels.ts`
    - `rooms/laboratory/ui/timeline/timeline-audio-focus.ts`
- **Description**: Move independent timeline render sections into focused modules. Keep `renderLabWaveformTimeline` stable.
- **Complexity**: 7
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Snapshot extraction helpers in tests still find expected panels.
  - Execution-chain render ownership remains unchanged.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts scripts/tests/laboratory-waveform-runtime-regressions.test.ts`

## Sprint 7: Final Hardening And Documentation

**Goal**: Lock the cleanup behind tests and document the new ownership boundaries.

**Demo/Validation**:

- Full room checks pass.
- Cleanup inventory shows lower LOC in the original god files.
- Follow-up work can extend Laboratory without reintroducing dead layers.

### Task 7.1: Update Laboratory Architecture Notes

- **Location**:
  - `LABORATORY.md`
  - Optional new `rooms/laboratory/README.md` section if room-local ownership needs to live with code.
- **Description**: Document source-of-truth boundaries, generated installed-copy policy, main runtime modules, UI/CSS module ownership, and supported legacy/hydration policy.
- **Complexity**: 3
- **Dependencies**: Sprints 2-6
- **Acceptance Criteria**:
  - New contributors can identify where to add UI, selector, store, and host logic.
  - The doc explicitly says not to edit `data/rooms/laboratory` directly.
- **Validation**:
  - Documentation review plus `rg "data/rooms/laboratory" LABORATORY.md rooms/laboratory/README.md`

### Task 7.2: Add Regression Coverage For Removed Legacy Paths

- **Location**:
  - `scripts/tests/laboratory-*.test.ts`
- **Description**: Where legacy behavior is intentionally removed, add tests that assert the new boundary rather than leaving stale expectations deleted without replacement.
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Tests distinguish supported migration from unsupported retired payloads.
  - No test relies on generated installed source paths.
- **Validation**:
  - Relevant focused tests plus `npm run rooms:test:core` when practical.

### Task 7.3: Final Cleanup Gate

- **Location**:
  - Whole Laboratory source and relevant tests.
- **Description**: Run the final validation matrix and compare the before/after inventory.
- **Complexity**: 4
- **Dependencies**: All prior tasks
- **Acceptance Criteria**:
  - God-file LOC drops are recorded.
  - Dead CSS and unused file candidates are either removed or documented with rationale.
  - Typecheck, lint, and focused tests pass.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:test:core` if runtime allows.

## Testing Strategy

- **Always run after each sprint**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-host-import-smoke-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Run when touching store/hydration**:
  - `scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-state-persistence-v2-regressions.test.ts`
  - `scripts/tests/laboratory-project-management-regressions.test.ts`
- **Run when touching source/workspace UI**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-source-intake-regressions.test.ts`
  - `scripts/tests/laboratory-media-source-portability-regressions.test.ts`
  - `scripts/tests/laboratory-workspace-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-linked-audio-lineage-ui-regressions.test.ts`
  - `scripts/tests/laboratory-asset-lineage-regressions.test.ts`
- **Run when touching execution layers**:
  - `scripts/tests/laboratory-execution-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-suggestion-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-selection-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `scripts/tests/laboratory-stage-decoupling-regressions.test.ts`
- **Run when touching host/process/reporting**:
  - `scripts/tests/laboratory-host-action-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-audio-runtime-regressions.test.ts`
  - `scripts/tests/laboratory-report-composition-v2-regressions.test.ts`
  - `scripts/tests/laboratory-media-edit-behavior-regressions.test.ts`
  - `scripts/tests/laboratory-scope-aware-analysis-regressions.test.ts`
  - `scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`
  - `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
- **Final pass**:
  - `npm run rooms:check`
  - `npm run rooms:test:core` if the branch has enough time for the larger room suite.

## Potential Risks And Gotchas

- Static CSS scans can lie because Laboratory uses template strings, conditional class fragments, and runtime-preserved DOM nodes. Use markup tests or runtime coverage before deleting non-obvious selectors.
- Dynamic room roots can look unused to TS import analysis. Manifest assets, i18n directories, room-local tool data, Python/conf payloads, and copied installed-room files need an explicit keep-list.
- `knip:strict` is currently too noisy at repo level. Use a Laboratory-scoped gate or it will bury real cleanup signals.
- `lab-types.ts` is high fan-in. Splitting it too early can create import churn across host, UI, runtime, and tests. Prefer removing obsolete fields first, then split types by domain only if fan-in pain remains.
- Some fallbacks are operational safety, not legacy debt. Tool fallbacks for model/process runners and source metadata extraction should stay unless an equivalent hard-failure UX is deliberately chosen.
- `subtitle-analysis` is both marked legacy-internal and still present in manifest/workbench feature lists. Retiring it is a product decision, not just a cleanup step.
- Installed room parity tests may build temporary copies. Do not "fix" failures by editing `data/rooms/laboratory`; fix source and rebuild/sync.
- Current worktree has many unrelated changes and generated deletions. Implementation commits should avoid mixing Laboratory cleanup with room-source/build-data separation work unless explicitly requested.

## Open Decisions Before Implementation

- Should `subtitle-analysis` remain an internal transcript support feature, or should it be removed from Laboratory entirely?
- Should the cleanup add durable audit scripts to `package.json`, or keep audit commands as PR-local/checklist-only tooling?
- Is the desired end state smaller files only, or also stricter import boundaries that prevent future god-file growth?
- Should runtime screenshot smoke be required for CSS deletion, or are existing UI markup tests enough for this pass?

## Planner Review Notes

- Start with confirmed deletion and audit gates before splitting god files. A god-file split without deletion first would preserve too much stale surface area.
- Do not remove every fallback marker. Process runner fallbacks, metadata extraction fallbacks, and model availability fallbacks may be active user-facing safety behavior.
- Keep first-pass splits compatible through wrapper exports. Import-path rewrites can happen later after the domain boundaries prove stable.
- Treat `subtitle-analysis` as the main product decision in the cleanup. It can be hidden, renamed as transcript support, or removed, but partial retirement is the highest-risk path.
- Subagent review was run on 2026-04-26 and its actionable feedback was incorporated: dynamic keep-list, stronger `subtitle-analysis` chain, durable inventory script, stronger CSS validation, CSS build validation, broader Laboratory test matrix, and golden-case centralization tests.

## Rollback Plan

- Keep each sprint atomic and committable.
- For deletion commits, record the exact `rg` proof and validation command in the commit body or PR notes.
- If a deletion breaks behavior, revert the specific deletion commit instead of rolling back unrelated centralization work.
- If a god-file split introduces circular imports or lifecycle bugs, keep the new domain files but restore the old public wrapper until tests are green.
- Regenerate installed room output only from source after rollback decisions are complete.
