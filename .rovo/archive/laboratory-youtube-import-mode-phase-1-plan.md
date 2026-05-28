# Plan: Laboratory YouTube Import Mode Phase 1

**Generated**: 2026-04-29
**Estimated Complexity**: Medium

## Overview

Introduce a non-destructive Laboratory UI mode named `import-youtube`. The mode adds a shell-only YouTube import surface, hides the normal right drawer and project asset workspace while active, and leaves all existing source, project, asset, and analysis state intact in memory.

This codebase uses `LabStoreEvent` plus string-based render surfaces rather than React-style actions and component returns. The implementation should preserve that pattern: state changes live in `rooms/laboratory/runtime/lab-store.ts`, UI contract types live in `rooms/laboratory/models/lab-types.ts`, and user actions continue through `data-lab-action` handling in `rooms/laboratory/runtime/lab-run-controller.ts`.

## Clarifications And Assumptions

- The request's `LabAction` maps to this repo's `LabStoreEvent`.
- The new `labMode` is UI-only and should not be added to `LabPersistedState` in Phase 1.
- The import workspace should be string-first for this repo: use a markup helper for `LabStageSurface.main`, and only expose an `HTMLElement` bridge if a browser `document` is explicitly available.
- The YouTube trigger should happen when the user chooses the YouTube import route, with an optional explicit action marker if a button/card is added later.
- No yt-dlp execution, import pipeline trigger, advanced settings behavior, assets, or source draft migration belongs in this phase.
- Visible import-shell text should use room-local i18n keys with bootstrap fallbacks because Laboratory UI copy is catalog-owned.

## Prerequisites

- Work only under the workspace source tree, especially `rooms/laboratory`.
- Keep `data/rooms/laboratory` untouched; installed copies are generated.
- Start from `workflow:terminal-mode` if current mode remains `terminal` or `other-provider-cli`.
- Use focused checks: `npm run rooms:typecheck`, targeted Node tests, and a browser/Electron smoke only if the app is running or explicitly started for verification.

## Sprint 1: UI Mode State Contract

**Goal**: Add the minimal store contract for entering and exiting YouTube import mode.

**Demo/Validation**:

- A fresh `createLabStore()` state reports `state.ui.labMode === "normal"`.
- Dispatching enter/exit events flips only `state.ui.labMode`.
- Existing source drafts, assets, workspace state, and project workspace fields remain unchanged.

### Task 1.1: Add Lab Mode Type Surface

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add a narrow `LabMode` union or inline field to `LabStoreUiState` with values `"normal"` and `"import-youtube"`.
- **Complexity**: 2
- **Dependencies**: None
- **Parallel Execution**: Can run before UI rendering tasks.
- **Acceptance Criteria**:
  - `LabStoreUiState` includes `labMode`.
  - The field is not added to `LabPersistedState`.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Initialize Default UI Mode

- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add `labMode: "normal"` to `createInitialState().ui`.
- **Complexity**: 1
- **Dependencies**: Task 1.1
- **Parallel Execution**: Sequential after the type field.
- **Acceptance Criteria**:
  - Fresh store instances default to normal mode.
  - Hydrated sessions still start normal unless an explicit event changes the mode.
- **Validation**:
  - Add or update a focused store regression in `scripts/tests/laboratory-source-intake-regressions.test.ts` or a nearby laboratory store test.

### Task 1.3: Add Mode Switch Events

- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add `enter-youtube-import-mode` and `exit-youtube-import-mode` to `LabStoreEvent`, then handle both in `reduceEvent`.
- **Complexity**: 3
- **Dependencies**: Tasks 1.1, 1.2
- **Parallel Execution**: Sequential with store contract work.
- **Acceptance Criteria**:
  - Enter sets `state.ui.labMode` to `"import-youtube"`.
  - Exit sets `state.ui.labMode` to `"normal"`.
  - Reducer does not alter `source`, `assets`, `projectIndex`, `workspace`, or drafts.
- **Validation**:
  - Focused store regression dispatching enter and exit.
  - `npm run rooms:typecheck`

## Sprint 2: Empty Import Surface

**Goal**: Render a shell-only YouTube import workspace that can be entered and exited without starting import logic.

**Demo/Validation**:

- In import mode, center content shows the import shell.
- Back returns the UI to the normal Laboratory surface.
- Buttons are visually present but inert unless later phases assign behavior.

### Task 2.1: Create YouTube Import Workspace Component

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Create a string-first import workspace renderer for the requested header, preview placeholder, config placeholders, and footer buttons. If the exported `renderYoutubeImportWorkspace(state: LabStoreState): HTMLElement` contract is kept for compatibility with the request, back it with a small DOM bridge and keep `lab-root.ts` on the string helper.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Parallel Execution**: Can run in parallel with CSS after the class contract is agreed.
- **Acceptance Criteria**:
  - Root class is `labx-import-workspace`.
  - Header/back control exposes `data-lab-action="exit-youtube-import-mode"`.
  - Footer buttons do not dispatch pipeline or source actions.
  - The renderer has no side effects beyond producing markup or a local element bridge.
- **Validation**:
  - Unit-style render assertion checks root class and required placeholder regions.
  - `npm run rooms:typecheck`

### Task 2.2: Integrate Surface Override In Root Render

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Import the new workspace renderer and update `renderSurface` so `state.ui.labMode === "import-youtube"` returns an import-mode main surface and empty side content.
- **Complexity**: 4
- **Dependencies**: Tasks 1.1-1.3, Task 2.1
- **Parallel Execution**: Sequential after component creation.
- **Acceptance Criteria**:
  - Normal mode still calls `renderWorkspaceSurface`.
  - Import mode does not render source bar, workbench preview, waveform timeline, or normal workspace controls.
  - Existing boot overlay behavior remains unchanged.
- **Validation**:
  - Render regression checks import mode contains `labx-import-workspace`.
  - Render regression checks normal mode still contains the existing workspace surface.

### Task 2.3: Hide Right Drawer While Import Mode Is Active

- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/ui/lab-layout.ts`, `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Treat import mode as a temporary drawer-hidden layout without mutating the user's normal drawer collapsed preference. Prefer a selector/layout flag such as `data-lab-mode="import-youtube"` or derived drawer collapse over removing the drawer node outright.
- **Complexity**: 4
- **Dependencies**: Task 2.2
- **Parallel Execution**: Can run after root surface override.
- **Acceptance Criteria**:
  - The drawer root is hidden or layout-collapsed in import mode without forcing repeated full layout replacement from `lab-root.ts`.
  - Exiting import mode restores the prior drawer state.
  - The center panel uses the available width instead of leaving an empty right column.
- **Validation**:
  - Render/layout regression asserts import mode has shell collapse data applied and no visible drawer content.

### Task 2.4: Hide Project Asset Workspace Overlay During Import Mode

- **Location**: `rooms/laboratory/ui/project-workspace-overlay.ts`
- **Description**: Return the hidden overlay root while `state.ui.labMode === "import-youtube"` without changing `projectWorkspaceOpen`.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Parallel Execution**: Can run alongside Task 2.3.
- **Acceptance Criteria**:
  - Asset grid and inspector markup are absent while import mode is active.
  - `state.ui.projectWorkspaceOpen` remains unchanged for restoration after exit.
- **Validation**:
  - Render regression where `projectWorkspaceOpen` is true and `labMode` is import still omits `labx-pw-overlay`.

### Task 2.5: Add Room-Local Placeholder Copy

- **Location**: `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`, `rooms/laboratory/ui/youtube-import-workspace.ts`
- **Description**: Add minimal room-local keys for Back, preview placeholder, URL placeholder, basic options placeholder, advanced settings placeholder, Download, and Download + Analyze.
- **Complexity**: 2
- **Dependencies**: Task 2.1
- **Parallel Execution**: Can run alongside styling.
- **Acceptance Criteria**:
  - English and Turkish catalogs stay in parity.
  - The renderer uses `copy.t(...)` with concise fallbacks.
  - No behavior, asset, or pipeline copy is introduced beyond placeholder labels.
- **Validation**:
  - Existing laboratory i18n parity regression passes.

## Sprint 3: Mode Entry And Exit Actions

**Goal**: Wire user interaction to the new mode without activating any download behavior.

**Demo/Validation**:

- Selecting/clicking YouTube import entry opens the import workspace.
- Back exits to the normal Laboratory UI.
- Download buttons do nothing in Phase 1.

### Task 3.1: Wire Controller Action Cases

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Add action handling for `enter-youtube-import-mode` and `exit-youtube-import-mode` in the existing click delegation switch.
- **Complexity**: 3
- **Dependencies**: Sprint 1
- **Parallel Execution**: Can run before final UI trigger placement.
- **Acceptance Criteria**:
  - Enter action dispatches only the enter event.
  - Exit action dispatches only the exit event.
  - Neither action sends media actions or starts probes.
- **Validation**:
  - Source-level regression in `scripts/tests/laboratory-source-intake-regressions.test.ts` checks action cases exist and avoid source download calls.

### Task 3.2: Connect YouTube Source Selection Trigger

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Trigger import mode from the existing `case "source.mode"` branch in the input/change handler when `targetValue === "youtube"`. Preserve the existing source-mode draft update so later phases can reuse the normal source draft state.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Parallel Execution**: Sequential with controller action handling.
- **Acceptance Criteria**:
  - YouTube selection enters import mode.
  - The current source kind/mode draft behavior is not removed.
  - Audio source mode restrictions remain unchanged.
- **Validation**:
  - Existing YouTube source intake tests still pass.
  - Add a regression that selecting `source.mode = youtube` is associated with the import-mode event path.

### Task 3.3: Back Control Contract

- **Location**: `rooms/laboratory/ui/youtube-import-workspace.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Ensure the back header uses the exit action and returns to normal mode without clearing any Laboratory state.
- **Complexity**: 2
- **Dependencies**: Tasks 2.1, 3.1
- **Parallel Execution**: Can be checked with component tests.
- **Acceptance Criteria**:
  - Back control is reachable as a button or equivalent interactive element.
  - Exit event restores normal workspace rendering.
- **Validation**:
  - Store regression checks source drafts/assets survive enter/exit.
  - Render regression checks normal workspace is visible after exit.

## Sprint 4: Styling And Verification

**Goal**: Add the requested visual shell styling and prove the phase is non-destructive.

**Demo/Validation**:

- Import workspace fills the center surface.
- Header, body grid, placeholders, and footer are aligned at desktop widths.
- Mobile/narrow widths do not overlap text or controls.

### Task 4.1: Add Import Workspace CSS

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add `.labx-import-*` classes using existing Laboratory variables such as `--labx-bg`, `--labx-surface`, and `--labx-border`; add any shell-grid import-mode selector in `lab-theme.css` where `.labx-shell` layout is defined.
- **Complexity**: 3
- **Dependencies**: Task 2.1
- **Parallel Execution**: Can run in parallel with controller wiring.
- **Acceptance Criteria**:
  - CSS matches the requested shell structure.
  - Add a narrow viewport fallback so the body grid stacks instead of overflowing.
  - Styling does not change `.labx-pw-*` project workspace behavior.
- **Validation**:
  - `npx prettier --check rooms/laboratory/ui/styles/project-workspace.css`
  - Manual visual smoke if app is available.

### Task 4.2: Add Focused Regression Tests

- **Location**: `scripts/tests/laboratory-store-runtime-regressions.test.ts`, `scripts/tests/laboratory-controller-runtime-regressions.test.ts`, `scripts/tests/laboratory-source-intake-regressions.test.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Split regressions by ownership: store mode behavior in store runtime tests, controller action routing in controller tests, source-mode trigger behavior in source intake tests, and shell/import render/layout/i18n assertions in UI evaluation tests.
- **Complexity**: 4
- **Dependencies**: Sprints 1-3
- **Parallel Execution**: Sequential after implementation.
- **Acceptance Criteria**:
  - Tests cover default mode, enter, exit, non-persistence, YouTube hydrate negative case, import shell markup, drawer/overlay hiding, and no download trigger from footer buttons.
  - Existing source intake tests remain unchanged except where expectations must include the additive trigger.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 4.3: Run Room-Level Checks

- **Location**: Repository root
- **Description**: Run the focused validation set before handoff.
- **Complexity**: 2
- **Dependencies**: All implementation tasks
- **Parallel Execution**: Sequential final gate.
- **Acceptance Criteria**:
  - Typecheck passes.
  - Focused tests pass.
  - No console errors in smoke path if Electron verification is run.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - Optional: start app and verify YouTube entry, back action, and normal workspace restoration.

## Testing Strategy

- Store test: default `labMode`, enter/exit reducer behavior, and preservation of source/project/workspace fields.
- Persistence negative test: hydrate a YouTube source/draft state and verify `ui.labMode` still starts as `"normal"`.
- Render test: import mode returns `labx-import-workspace`, normal mode keeps existing workspace rendering.
- Overlay test: project workspace state may remain open but overlay markup is hidden in import mode.
- Controller/source test: YouTube route entry dispatches import mode without calling source download or probe paths.
- Visual smoke: click/select YouTube, confirm import shell opens; click Back, confirm normal Laboratory returns; check browser console.

## Potential Risks & Gotchas

- **Renderer mismatch**: The request names an `HTMLElement` component, but current Laboratory render functions return strings. Mitigate with a small element-to-markup bridge or a paired markup helper while preserving the exported function name.
- **Drawer gap**: Returning only an empty side panel is not enough because `.labx-shell` has a two-column grid. Mitigate by owning import-mode collapse through selectors/layout data and `lab-theme.css`.
- **Incremental render churn**: Removing `.labx-drawer` can make `lab-root.ts` fall back to full layout replacement on repeated renders. Mitigate by keeping a stable hidden/collapsed drawer root or explicitly accepting one full replacement only at mode boundary.
- **Overlay leak**: If project workspace was already open, the asset grid can sit above the import screen. Mitigate by hiding overlay markup in import mode without mutating `projectWorkspaceOpen`.
- **Accidental persistence**: Persisting `labMode` could reopen the import shell after reload. Keep the field out of `LabPersistedState`.
- **Accidental pipeline trigger**: Existing YouTube source UI is already connected to `source-download-youtube`. Keep Phase 1 buttons and mode entry separate from `load-source`.
- **Trigger ambiguity**: Existing UI uses a select for import method. If product intent requires a dedicated YouTube card/button, add it as an explicit `data-lab-action` without removing the select behavior.
- **Catalog drift**: New visible strings can desync English and Turkish room catalogs. Mitigate with paired i18n entries and existing parity tests.

## Rollback Plan

- Remove `labMode` from `LabStoreUiState`, initial state, and reducer cases.
- Remove the controller action cases and YouTube trigger.
- Remove `rooms/laboratory/ui/youtube-import-workspace.ts`.
- Remove `.labx-import-*` CSS from `rooms/laboratory/ui/styles/project-workspace.css`.
- Revert the import-mode branches in `lab-root.ts`, `lab-layout.ts`, `lab-drawer.ts`, and `project-workspace-overlay.ts`.
- Re-run `npm run rooms:typecheck` and the focused source intake regression file.
