# Plan: Laboratory YouTube Import Mode Phase 1.5 Perception Lock

**Generated**: 2026-04-29
**Estimated Complexity**: Medium

## Overview

Phase 1.5 turns the existing YouTube Import Mode shell into a clearly isolated workspace experience. The implementation should stay purely visual and structural: no source state mutation, no yt-dlp behavior, no asset writes, no pipeline triggers, and no data-flow refactor.

The current Phase 1 implementation already has `state.ui.labMode === "import-youtube"`, a string-first `youtube-import-workspace.ts` renderer, import-mode entry/exit actions, drawer collapse, and project workspace overlay hiding. Phase 1.5 should build on that by making import mode the only perceived surface: hide Laboratory chrome and legacy intake UI, strengthen the import workspace header, add a purpose-driven center empty state, and reduce visual noise.

## Clarifications And Assumptions

- No blocking questions remain. The request is scoped to perception/layout only.
- "Import workspace must be the only visible surface" means existing Laboratory chrome should not remain visible in import mode. This includes topbar and process strip if they still read as Laboratory UI.
- The existing Phase 1 state/action behavior is preserved exactly: enter/exit mode only changes `ui.labMode`, and selecting YouTube remains UI-only.
- Placeholder copy should remain room-local i18n with English/Turkish key parity.
- Disabled footer buttons may remain as visual placeholders, but they must not gain actions.
- `data/rooms/laboratory` and installed copies remain untouched; generated build output is refreshed only through `npm run rooms:build` if validation requires parity.

## Prerequisites

- Start from the current Phase 1 workspace changes.
- Keep edits inside `rooms/laboratory` and related tests, except this plan file.
- Current workflow is `workflow:terminal-mode` because `mode:status=terminal` and `whereami.effectiveMode=other-provider-cli`.
- Use focused render/unit tests before broader room checks.

## Sprint 1: Import Boundary Isolation

**Goal**: Make import mode structurally isolated so no legacy Laboratory surface appears around or behind the import workspace.

**Demo/Validation**:

- Render import mode and verify the only main visible surface is `.labx-import-workspace`.
- Verify no source intake, normal workspace main, asset grid overlay, right drawer content, topbar controls, or process strip appears in import mode.
- Exit mode still restores the normal Laboratory layout from existing state.

### Task 1.1: Audit Current Import-Mode Markup

- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-layout.ts`, `rooms/laboratory/ui/lab-center-panel.ts`, `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/project-workspace-overlay.ts`
- **Description**: Confirm which legacy elements are still emitted in import mode after Phase 1, especially `labx-top-bar`, `labx-process-strip`, `labx-drawer`, source intake markup, workspace main markup, and project workspace overlay.
- **Complexity**: 2
- **Dependencies**: None
- **Parallel Execution**: Can run in parallel with test expectation design.
- **Acceptance Criteria**:
  - The implementation target list is explicit before editing.
  - No behavioral code path is selected for modification.
- **Validation**:
  - Source inspection and current `laboratory YouTube import mode renders as an additive shell override` test review.

### Task 1.2: Add Import-Only Layout Branch

- **Location**: `rooms/laboratory/ui/lab-layout.ts`
- **Description**: When `state.ui.labMode === "import-youtube"` and the normal boot overlay is not active, render an import-only shell that contains the center panel/import workspace and omits legacy Laboratory chrome. Prefer render-layer omission over CSS-only hiding for topbar/process strip so tests can prove the markup is absent. Keep this as the static/full-render path only; live mounted updates are covered separately in Task 1.3.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Parallel Execution**: Sequential after audit.
- **Acceptance Criteria**:
  - Import mode does not emit `renderLabTopBar`, `renderLabDrawer`, or `renderLabProcessStrip` content.
  - Import mode still emits overlays that are not visible only if they are already hidden roots and required for shell stability.
  - Normal mode markup remains unchanged.
  - Boot overlay behavior remains unchanged for not-ready states.
- **Validation**:
  - Update render regression to assert absence of `labx-top-bar`, `labx-process-strip`, drawer body content, source intake, and normal workspace main in import mode.
  - `npm run rooms:typecheck`

### Task 1.3: Handle Mounted Shell Mode Transitions

- **Location**: `rooms/laboratory/ui/lab-root.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Update the live render/reconciliation path so entering import mode from an already mounted normal shell cannot leave stale `.labx-top-bar`, `.labx-drawer`, or `.labx-process-strip` nodes behind. On `normal -> import-youtube` and `import-youtube -> normal`, either force a full `renderLabLayout(...)` replacement or add explicit branch reconciliation that removes/restores chrome deterministically.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Parallel Execution**: Sequential after static layout branch design.
- **Acceptance Criteria**:
  - Live app transition into import mode removes legacy chrome from the mounted root.
  - Live app transition back to normal restores the full Laboratory shell.
  - Existing overlay roots remain stable or are recreated intentionally without state loss.
  - No source/project/pipeline behavior is touched.
- **Validation**:
  - Add a mounted-root transition regression that starts from normal rendered markup, dispatches/import-renders `import-youtube`, then asserts stale chrome is absent.
  - The same regression exits back to normal and asserts normal chrome returns.

### Task 1.4: Preserve State Restoration Contract

- **Location**: `scripts/tests/laboratory-store-runtime-regressions.test.ts`, `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
- **Description**: Keep or strengthen existing tests proving import mode entry/exit preserves source, assets, project workspace state, drafts, and mode-specific UI preferences.
- **Complexity**: 3
- **Dependencies**: Tasks 1.2 and 1.3
- **Parallel Execution**: Can run in parallel with visual workspace tasks if test fixtures are stable.
- **Acceptance Criteria**:
  - Back/exit restores normal UI without clearing source/project state.
  - No new store events or persistence fields are introduced.
- **Validation**:
  - Focused store/controller tests.

## Sprint 2: Workspace Identity Header

**Goal**: Replace the panel-like back header with a dedicated workspace identity header.

**Demo/Validation**:

- Import mode header clearly reads as "YouTube Import Workspace".
- Back action is still available and still dispatches `exit-youtube-import-mode`.
- Header no longer looks like the whole header is a back button.

### Task 2.1: Update Header Markup

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Replace the current single `<button class="labx-import-header">` with a non-button header containing `.labx-import-title` and a `.labx-import-back` button.
- **Complexity**: 3
- **Dependencies**: Sprint 1 can be parallel if class names are stable.
- **Parallel Execution**: Can run alongside CSS work.
- **Acceptance Criteria**:
  - Header root is `.labx-import-header`.
  - Title element is `.labx-import-title`.
  - Back button is `.labx-import-back`.
  - Back button keeps `data-lab-action="exit-youtube-import-mode"`.
  - No new action is added.
- **Validation**:
  - Render regression asserts title/back classes and exit action.

### Task 2.2: Add Header Copy Keys

- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Add room-local copy for the workspace title and back label, preserving key parity.
- **Complexity**: 2
- **Dependencies**: Task 2.1
- **Parallel Execution**: Can run with Task 2.1.
- **Acceptance Criteria**:
  - English and Turkish catalogs expose the same `youtubeImport` keys.
  - Renderer uses `copy.t(...)` with concise fallbacks.
- **Validation**:
  - Existing i18n parity assertions plus JSON parse check.

## Sprint 3: Purpose-Driven Empty State

**Goal**: Replace the meaningless preview placeholder with a center area that explains the import workspace's purpose without implementing functionality.

**Demo/Validation**:

- Left workspace side shows "Paste YouTube URL to begin".
- URL placeholder appears in the dominant center area.
- Hint text explains preview, extraction strategy, and output format selection as future/workspace intent without triggering behavior.

### Task 3.1: Replace Preview Placeholder With Empty State

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Replace `.labx-import-preview-placeholder` with `.labx-import-empty`, `.labx-import-empty-title`, `.labx-import-url-input`, and `.labx-import-hint` markup.
- **Complexity**: 4
- **Dependencies**: Task 2.1
- **Parallel Execution**: Can run alongside i18n key additions.
- **Acceptance Criteria**:
  - Center area contains the requested empty state structure.
  - URL placeholder is visual only, not an interactive input.
  - No `data-lab-action` is added to empty-state elements.
  - No source draft, import, asset, or pipeline calls are introduced.
- **Validation**:
  - Render test asserts empty-state classes and text.
  - Render test asserts absence of `source-download-youtube`, `source-set-mode`, and `load-source` action markers.

### Task 3.2: Simplify Right Configuration Surface

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Keep right-side configuration placeholders, but make them visually subordinate and flat. Avoid nested card language and avoid implying live settings behavior.
- **Complexity**: 3
- **Dependencies**: Task 3.1
- **Parallel Execution**: Can run with CSS cleanup.
- **Acceptance Criteria**:
  - Right side remains present as configuration context.
  - Basic/advanced placeholder labels remain inert.
  - Markup does not introduce form fields or actionable controls.
- **Validation**:
  - Render test checks right config exists but has no interactive source/import actions.

### Task 3.3: Add Empty-State Copy Keys

- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Add keys for empty title, URL placeholder, hint intro, and three hint list items.
- **Complexity**: 2
- **Dependencies**: Task 3.1
- **Parallel Execution**: Can run in parallel with markup.
- **Acceptance Criteria**:
  - EN/TR key parity remains intact.
  - Copy is concise and placeholder-safe.
- **Validation**:
  - JSON parse and i18n parity regression.

## Sprint 4: Perception-Lock Styling

**Goal**: Make the import screen read as one clean workspace, not a nested panel.

**Demo/Validation**:

- Header is 56px tall, title left, back button right.
- Body uses `grid-template-columns: 1.4fr 1fr`.
- Preview/empty side is dominant and centered.
- Excess inner borders and small segmented card feel are removed.
- Mobile layout stacks without overlap.

### Task 4.1: Update Header Styles

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Update `.labx-import-header`, add `.labx-import-title`, and style `.labx-import-back` as a clear command button.
- **Complexity**: 3
- **Dependencies**: Sprint 2
- **Parallel Execution**: Sequential after header markup.
- **Acceptance Criteria**:
  - Header height is 56px.
  - Header uses space-between alignment and 20px horizontal padding.
  - Title uses 14px, weight 600, `var(--labx-text)`.
  - Back button remains visually clickable and keyboard-accessible.
- **Validation**:
  - CSS/source regression checks key classes.

### Task 4.2: Add Empty-State Styles

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Add `.labx-import-empty`, `.labx-import-empty-title`, `.labx-import-url-input`, and `.labx-import-hint` styles.
- **Complexity**: 3
- **Dependencies**: Sprint 3
- **Parallel Execution**: Can run alongside Task 4.1 after markup exists.
- **Acceptance Criteria**:
  - Empty state is centered vertically and horizontally.
  - Gap is 16px.
  - Empty title is 16px and medium weight.
  - Hint text is 12px and uses `var(--labx-text-soft)`.
  - Hint list is readable without looking like a dense form.
- **Validation**:
  - CSS/source regression checks class definitions.
  - Optional screenshot smoke if Electron is running.

### Task 4.3: Reduce Nested Card Visual Noise

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`
- **Description**: Remove or soften borders/backgrounds in `.labx-import-preview` and `.labx-import-config > div` so the screen reads as one clean surface rather than several nested cards.
- **Complexity**: 4
- **Dependencies**: Tasks 3.1, 3.2
- **Parallel Execution**: Sequential with visual CSS work.
- **Acceptance Criteria**:
  - Preview side no longer feels like a bordered card inside another panel.
  - Config placeholders are subordinate, calm, and not over-segmented.
  - No global project workspace styles are unintentionally changed.
- **Validation**:
  - CSS diff review limited to `.labx-import-*`.
  - Render tests still pass.

### Task 4.4: Adjust Layout Proportions And Import-Only Shell CSS

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Change import body grid to `1.4fr 1fr` and ensure import mode shell/center panel fills the workspace without visible leftover grid rows from normal Laboratory chrome.
- **Complexity**: 4
- **Dependencies**: Sprint 1, Tasks 4.1-4.3
- **Parallel Execution**: Sequential after layout branch decision.
- **Acceptance Criteria**:
  - `.labx-import-body` uses `grid-template-columns: 1.4fr 1fr`.
  - Import mode does not reserve visual space for hidden topbar, drawer, or process strip.
  - Mobile media query still stacks cleanly.
- **Validation**:
  - CSS/source regression.
  - Optional browser screenshot check at desktop and narrow width if app smoke is available.

## Sprint 5: Regression Suite And Smoke

**Goal**: Prove Phase 1.5 is visual-only, isolated, and reversible.

**Demo/Validation**:

- Focused tests pass.
- Typecheck and lint pass.
- Core room tests pass if generated room parity is affected.
- Electron smoke/log check runs if the app can be started safely.

### Task 5.1: Update Render Regression For Import-Only Surface

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Update the import-mode test to assert the new header/empty-state markup and absence of legacy UI markup.
- **Complexity**: 4
- **Dependencies**: Sprints 1-4
- **Parallel Execution**: Sequential after markup/CSS changes.
- **Acceptance Criteria**:
  - Asserts `.labx-import-title`, `.labx-import-back`, `.labx-import-empty`, `.labx-import-url-input`, and `.labx-import-hint`.
  - Asserts no `id="lab-workspace-main"`, source intake controls, drawer content, topbar, process strip, project workspace overlay, or asset grid markup in import mode.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 5.2: Preserve Existing State And Action Tests

- **Location**: `scripts/tests/laboratory-store-runtime-regressions.test.ts`, `scripts/tests/laboratory-controller-runtime-regressions.test.ts`, `scripts/tests/laboratory-source-intake-regressions.test.ts`
- **Description**: Keep existing Phase 1 tests passing and add only narrow assertions if needed to prove no new action paths were introduced.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Parallel Execution**: Can run in parallel with UI test updates.
- **Acceptance Criteria**:
  - YouTube selection remains UI-only.
  - Back restores normal mode.
  - Source/project state remains preserved.
  - No download/import/pipeline actions appear in import workspace markup.
- **Validation**:
  - Focused four-suite laboratory test command used in Phase 1.

### Task 5.3: Run Validation Commands

- **Location**: Repo root
- **Description**: Run formatting/syntax/type/lint/test checks appropriate to changed files.
- **Complexity**: 3
- **Dependencies**: Tasks 5.1 and 5.2
- **Parallel Execution**: Sequential final gate.
- **Acceptance Criteria**:
  - MCP syntax checks pass for edited TS/CSS/JSON.
  - Prettier check passes for edited files.
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:lint` passes.
  - Focused laboratory tests pass.
  - `npm run rooms:build` is run only if generated runtime parity or import smoke requires it.
  - `npm run rooms:test:core` passes if `rooms:build` or parity files are affected.
  - Any generated `config/rooms.json`, `data/rooms/laboratory`, or installed-copy timestamp drift is reviewed and excluded unless it is an intentional deliverable.
- **Validation**:
  - Command output summary in final implementation report.

### Task 5.4: Browser/Electron Visual Smoke When Available

- **Location**: Runtime app, logs
- **Description**: If Electron/CDP can be started safely, run a short smoke/log check and capture or inspect import mode at desktop and narrow widths. Restore the starting mode afterward. If CDP is unavailable or app startup fails, record the skip reason explicitly instead of treating regex tests as a visual substitute.
- **Complexity**: 4
- **Dependencies**: Task 5.3
- **Parallel Execution**: Final optional check.
- **Acceptance Criteria**:
  - When CDP is available, no console/error log regressions from import mode.
  - When CDP is available, desktop and narrow viewport checks show no overlapping text or legacy UI.
  - When CDP is unavailable, final report lists the exact reason and the non-visual tests that still passed.
  - Starting terminal/app mode is restored after smoke.
- **Validation**:
  - `npm run mode:status`
  - `hev_read_electron_logs` if app was started
  - Screenshot/manual DOM assertions if CDP is available

## Testing Strategy

- **Markup tests**: Update `scripts/tests/laboratory-ui-evaluation-regressions.test.ts` to validate the new workspace identity and strict absence of legacy UI.
- **State tests**: Preserve Phase 1 store/controller tests proving import mode is UI-only and non-persistent.
- **Source-level guard tests**: Keep assertions that YouTube selection returns before source mutation/media actions.
- **Style checks**: Add targeted regex/source checks for critical `.labx-import-*` classes only if existing test style supports it.
- **Validation commands**:
  - `npm run rooms:build` only when generated runtime parity or app smoke requires it
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-source-intake-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:test:core` after build/parity changes

## Potential Risks & Gotchas

- **Topbar/process strip remain visible**: Phase 1 hid drawer and overlay but normal shell chrome can still make import mode feel like the same page. Mitigate with an import-only layout branch and tests asserting absence.
- **CSS-only hiding can leave layout gaps**: Hidden rows/areas may still reserve space. Mitigate with render-layer omission or import-mode shell grid override.
- **Nested cards fight the perception goal**: Existing preview/config boxes have borders and surfaces. Mitigate by softening `.labx-import-*` styles only.
- **Copy implies live functionality**: Empty-state hints mention future capabilities. Mitigate by keeping placeholders inert and footer buttons disabled.
- **Accidental logic changes**: Avoid edits in source host handlers, asset managers, pipeline code, or persisted state.
- **Installed copy drift**: Do not manually edit `data/rooms/laboratory`; run `npm run rooms:build` if parity tests require generated runtime refresh.
- **Mobile overlap**: Header title/back and empty-state hint list can crowd. Mitigate with responsive wrapping or stacked layout constraints.

## Rollback Plan

- Revert changes to `rooms/laboratory/ui/youtube-import-workspace.ts`.
- Revert import-only layout changes in `rooms/laboratory/ui/lab-layout.ts` and related CSS in `lab-theme.css` / `project-workspace.css`.
- Revert new/changed i18n keys under `mediaAnalysis.source.youtubeImport` if unused.
- Revert updated Phase 1.5-specific assertions while keeping Phase 1 tests.
- Keep Phase 1 `labMode`, enter/exit actions, and UI-only source selection unless explicitly rolling back Phase 1 too.
