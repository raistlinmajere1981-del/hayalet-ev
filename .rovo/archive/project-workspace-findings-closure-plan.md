# Plan: Project Workspace Findings Closure

**Generated**: 2026-04-29
**Estimated Complexity**: Medium

## Overview

`entity-workspace-impl-69ac95.md` and `pw-consolidation-69ac95.md` are mostly implemented in the current workspace: the Project Workspace overlay exists, source intake and hypothesis UI moved into that overlay path, drawer copies were removed, and `npm run rooms:typecheck` passes.

The remaining work is not a broad rewrite. It is a closure pass that aligns tests, contracts, and a few unfinished behavior details with the new overlay-centered design.

## Current Alignment Snapshot

- Implemented: `LabStoreUiState` has project workspace fields, reducer events are wired, overlay rendering is integrated, top bar opens the workspace, source intake is rendered from project navigation, hypothesis is rendered from the asset grid, and drawer/workspace duplicate surfaces were removed.
- Verified: `npm run rooms:typecheck` passed on 2026-04-29.
- Failing targeted validation: `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts scripts/tests/laboratory-project-management-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts` returned 71 passing / 8 failing tests.
- Main mismatch: existing tests still assert the pre-consolidation locations for project selection, source intake, and hypothesis.
- Important ownership detail: source intake controls moved into Project Workspace, but live import progress still belongs to the center source bar in `workspace-surface.ts`.
- Functional gaps to close: auto-open condition is broader than the plan, hover timeline highlight is not implemented, context bar selection/action copy is incomplete, and new overlay copy has hardcoded labels that should move into room-local i18n.

## Prerequisites

- Keep source of truth in `rooms/laboratory/**`; do not manually edit installed runtime copies.
- Preserve terminal workflow unless the app is intentionally started for a later smoke check.
- Treat existing uncommitted implementation files as user work; do not revert unrelated changes.
- Run focused tests after each sprint, then `npm run rooms:typecheck`.

## Sprint 1: Contract And Test Realignment

**Goal**: Make the regression suite describe the new overlay-centered contract instead of the retired drawer/center-panel contract.

**Demo/Validation**:

- Targeted laboratory tests explain real behavior and stop failing because of stale expectations.
- No application behavior changes are required unless a test exposes a real missing contract.

### Task 1.1: Stabilize UI Evaluation Async Harness

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Isolate the `window is not defined` asynchronous activity before updating broad stale assertions. The first UI smoke imports runtime code with real timers and restores globals quickly; this can keep failing independently of Project Workspace assertions.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - The test no longer reports post-test asynchronous activity.
  - Any fake `window`/timer stubs remain valid until pending async work is drained.
  - The fix is localized to the test harness unless runtime code is proven to be scheduling unsafe global access.
- **Validation**: Run `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 1.2: Update Project Top Bar Tests

- **Location**: `scripts/tests/laboratory-project-management-regressions.test.ts`
- **Description**: Replace old `<select data-lab-field="project.id">` expectations with the new passive button contract: `data-lab-action="project-workspace-open"`, active project/new project label, and no inline project switcher.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - New project mode asserts the Project Workspace open button and visible draft/new project label.
  - Active project mode asserts the active project name and tool manager control.
  - The old project select is explicitly absent.
  - The test records the intended relationship between the top bar label and source-less draft/new projects.
- **Validation**: Run `npm run rooms:test:file -- scripts/tests/laboratory-project-management-regressions.test.ts`.

### Task 1.3: Move Source Intake Regression Expectations To Overlay Path

- **Location**: `scripts/tests/laboratory-source-intake-regressions.test.ts`, `rooms/laboratory/ui/project-navigation.ts`, `rooms/laboratory/ui/project-workspace-overlay.ts`
- **Description**: Update tests that currently call `renderWorkspaceSurface(...).main` for source intake controls so those control assertions render the Project Workspace overlay or project navigation instead. Keep live import progress assertions on `renderWorkspaceSurface(...).main`, because progress still belongs to the center source bar.
- **Complexity**: 4/10
- **Dependencies**: Task 1.2 can run in parallel.
- **Acceptance Criteria**:
  - Tests assert `source.kind`, `source.mode`, YouTube custom controls, and URL/local controls inside the overlay/nav intake area.
  - Tests keep source-bar progress assertions against the center workspace surface.
  - Tests assert the center workspace no longer owns source intake controls.
  - Existing source draft wiring test remains controller-focused.
- **Validation**: Run `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts`.

### Task 1.4: Add Minimal Project Workspace Overlay Render Test

- **Location**: New or existing test under `scripts/tests/`, preferably `scripts/tests/laboratory-project-workspace-regressions.test.ts`
- **Description**: Add a small direct overlay render test early so stale drawer/workspace tests do not become the only source of overlay contract assertions.
- **Complexity**: 3/10
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Closed overlay placeholder contract is asserted.
  - Open overlay asserts header, project navigation, source intake owner, hypothesis owner, grid toolbar, empty inspector, and hidden context bar.
  - The test remains narrow enough to run with the targeted suite.
- **Validation**: Run `npm run rooms:test:file -- scripts/tests/laboratory-project-workspace-regressions.test.ts`.

### Task 1.5: Update Shell Ownership Tests

- **Location**: `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Replace assertions that expect `renderSourceIntake(state, copy)` in `lab-drawer.ts` and `renderWorkspaceHypothesis` in `workspace-surface.ts` with assertions for the new owners.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1 and Task 1.4 should land first so harness stability and overlay ownership are explicit.
- **Acceptance Criteria**:
  - Drawer tests assert source intake and project assets panel are absent from drawer modes.
  - Workspace tests assert hypothesis is absent from `workspace-surface.ts`.
  - Overlay tests assert project navigation renders source intake and asset grid renders `workspace.hypothesis`.
- **Validation**: Run `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 1.6: Add Direct Project Workspace Store Tests

- **Location**: `scripts/tests/laboratory-store-runtime-regressions.test.ts`
- **Description**: Add focused reducer coverage for open/close, selection filtering, sort/filter/group/search changes, and confirm-replace reset behavior.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Closing the overlay clears selected entity ids and pending replace confirmation.
  - Selecting stale ids filters them out.
  - Sort/filter/group/search changes remain transient UI state.
- **Validation**: Run `npm run rooms:test:file -- scripts/tests/laboratory-store-runtime-regressions.test.ts`.

## Sprint 2: Behavior Closure

**Goal**: Close the implementation gaps that are visible in the original plans but not fully represented in the current code.

**Demo/Validation**:

- Overlay behavior matches the documented Project Workspace experience.
- Tests cover the new behavior rather than only checking static source strings.

### Task 2.1: Tighten Clean-Project Auto-Open

- **Location**: `rooms/laboratory/ui/lab-root.ts`, optional selector helper in `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Make the boot-time auto-open condition match the plan: open only for a genuinely clean/new project, not every state where `source === null`.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1 tests should be updated first.
- **Acceptance Criteria**:
  - Clean draft/new project opens Project Workspace after boot overlay unlock.
  - Existing project with source does not auto-open.
  - Restored source-less projects with non-empty drafts/assets/context do not auto-open unless they meet the explicit clean-project predicate.
  - Active source-less project records are either represented as the current draft/new project or intentionally excluded with a tested rationale.
  - User close is not immediately undone.
  - Behavior is expressed through a small helper or clearly named local predicate.
- **Validation**: Add or update a lab-root regression and run `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 2.2: Decide Source-Less Project Navigation Semantics

- **Location**: `rooms/laboratory/ui/project-navigation.ts`, `rooms/laboratory/ui/lab-top-bar.ts`, related project management tests
- **Description**: Decide whether Project Workspace navigation should hide `hasSource: false` project records, show the active draft/new project, or show source-less drafts in a separate draft state. Current navigation filters them out while the top bar can display the active source-less draft.
- **Complexity**: 3/10
- **Dependencies**: Task 1.2 and Task 2.1
- **Acceptance Criteria**:
  - The active draft/new project is not confusingly invisible in the overlay.
  - Source-less projects have a tested display rule.
  - Project switching, delete, and new-project affordances keep their existing safeguards.
- **Validation**: Update project management and overlay render regressions.

### Task 2.3: Finish Entity Hover Timeline Highlight Contract

- **Location**: `rooms/laboratory/ui/asset-card.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/lab-waveform-timeline-types.ts`, possibly `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Implement the original card hover plan using a transient highlight contract. Do not mutate the user's selected timeline range through `workspace-timeline-updated`; add an explicit highlight field/event if needed.
- **Complexity**: 5/10
- **Dependencies**: Task 1.6 for store event confidence.
- **Acceptance Criteria**:
  - Hovering/focusing an entity with timeline metadata highlights the corresponding timeline range.
  - Leaving/blur clears the highlight.
  - Entities without timeline metadata do not dispatch noisy events.
  - Keyboard focus path receives the same behavior as mouse hover.
  - Timeline model/type changes distinguish preview highlight from committed user selection.
- **Validation**: Add controller/store regression in `scripts/tests/laboratory-controller-runtime-regressions.test.ts`.

### Task 2.4: Complete Context Action Bar Selection Contract

- **Location**: `rooms/laboratory/ui/context-action-bar.ts`, `rooms/laboratory/ui/asset-card.ts`, `rooms/laboratory/runtime/lab-run-controller.ts`
- **Description**: Either implement real multi-select or intentionally narrow the contract to single-select. Prefer multi-select because the store and plan already use plural ids.
- **Complexity**: 5/10
- **Dependencies**: Task 1.6
- **Acceptance Criteria**:
  - Label reads `1 selected: <name>` for one entity and `N selected` for multiple entities.
  - Context bar includes Use as Source when valid, Open Report for report selection, Delete, and Send to AI stub.
  - Ctrl/meta click toggles selection without losing existing selected ids.
  - Delete behavior for multiple ids is explicit and tested, even if it dispatches one host action per id.
  - Open Report behavior with multiple report selections is explicit; if only one report can open, the first valid report target is clearly chosen.
  - Actions that only support one entity clearly target the first valid entity.
- **Validation**: Add render/controller tests for single and multi-select cases.

### Task 2.5: Reconcile Double-Click Source Replacement

- **Location**: `rooms/laboratory/runtime/lab-run-controller.ts`, `rooms/laboratory/ui/asset-card.ts`, `rooms/laboratory/ui/asset-inspector.ts`
- **Description**: Decide whether double-click should bypass replacement confirmation as the first plan says, or require confirmation like the inspector action says. Encode the decision in tests.
- **Complexity**: 3/10
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Double-click behavior is documented by tests.
  - Invalid/non-source assets are ignored or produce a harmless no-op.
  - The unused `project-workspace-entity-dblclick` action path is removed or made reachable.
- **Validation**: Add controller regression for double-click and source eligibility.

## Sprint 3: Copy, i18n, And Visual Contract

**Goal**: Make the overlay production-ready under room-local i18n and CSS ownership rules.

**Demo/Validation**:

- Overlay copy is localized through room catalogs.
- CSS changes are intentional and documented by tests.

### Task 3.1: Move Hardcoded Project Workspace Copy Into Room i18n

- **Location**: `rooms/laboratory/ui/asset-card.ts`, `rooms/laboratory/ui/asset-grid.ts`, `rooms/laboratory/ui/asset-inspector.ts`, `rooms/laboratory/ui/context-action-bar.ts`, `rooms/laboratory/ui/lab-top-bar.ts`, `rooms/laboratory/i18n/en.json`, `rooms/laboratory/i18n/tr.json`
- **Description**: Replace visible hardcoded labels such as group names, metadata labels, context text, and action copy with `copy.t(...)` entries.
- **Complexity**: 5/10
- **Dependencies**: Sprint 1 test contract should be stable.
- **Acceptance Criteria**:
  - English and Turkish catalogs have key parity.
  - Used-key coverage verifies `mediaAnalysis.projectWorkspace.*` and `mediaAnalysis.topBar.*` keys referenced from TS exist in the room catalogs, not merely that both catalogs omit the same keys.
  - Bootstrap fallbacks remain minimal.
  - New visible copy uses room-local i18n.
- **Validation**: Run `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts` and the i18n parity tests if they cover room catalogs.

### Task 3.2: Reconcile CSS Scope Drift

- **Location**: `rooms/laboratory/ui/styles/project-workspace.css`, `rooms/laboratory/ui/lab-theme.css`, `rooms/laboratory/ui/style.css`
- **Description**: The first plan said all new styles should live in `styles/project-workspace.css`, but top bar button styles were added to `lab-theme.css`. Keep the change if it belongs to top bar global shell styling, or move it if the project workspace button should be locally scoped.
- **Complexity**: 3/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - CSS ownership is intentional and documented by a regression or source assertion.
  - No duplicate project selector styles remain.
  - Mobile/narrow widths keep project name and controls non-overlapping.
- **Validation**: Run targeted CSS/source tests and, if app smoke is needed, capture a screenshot after starting the app intentionally.

### Task 3.3: Expand Overlay Render Regression Coverage

- **Location**: New or existing test under `scripts/tests/`, likely `laboratory-project-workspace-regressions.test.ts`
- **Description**: Expand the minimal Sprint 1 overlay test into fuller surface coverage instead of scattering all assertions through legacy tests.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1 and Sprint 2 decisions.
- **Acceptance Criteria**:
  - Asset card variants are covered for source/clip/image/audio/report/artifact.
  - Source-less project navigation semantics are covered.
  - i18n-backed labels are asserted through stable keys/copy, not brittle full HTML.
- **Validation**: Run the new test file plus targeted existing lab tests.

## Sprint 4: End-To-End Verification

**Goal**: Prove the closure work is complete with focused automated checks and a small manual smoke path.

**Demo/Validation**:

- The test suite no longer fails on stale contract expectations.
- The overlay can be opened, used for source intake/hypothesis/entity selection, and closed.

### Task 4.1: Run Focused Regression Suite

- **Location**: N/A
- **Description**: Re-run the targeted command that currently fails.
- **Complexity**: 1/10
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - `laboratory-source-intake-regressions.test.ts` passes.
  - `laboratory-project-management-regressions.test.ts` passes.
  - `laboratory-store-runtime-regressions.test.ts` passes.
  - `laboratory-controller-runtime-regressions.test.ts` passes.
  - `laboratory-ui-evaluation-regressions.test.ts` passes.
- **Validation**: `npm run rooms:test:file -- scripts/tests/laboratory-source-intake-regressions.test.ts scripts/tests/laboratory-project-management-regressions.test.ts scripts/tests/laboratory-store-runtime-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 4.2: Run Room Typecheck And Core Lab Smoke Tests

- **Location**: N/A
- **Description**: Re-run room-level typecheck and the highest-signal laboratory tests touched by the closure.
- **Complexity**: 1/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - New project workspace regression file passes.
  - No unrelated room package tests regress.
- **Validation**: `npm run rooms:typecheck` and the new/updated test files.

### Task 4.3: Manual App Smoke

- **Location**: Runtime app, no source code location
- **Description**: Start the app only if needed and smoke the Project Workspace from the UI.
- **Complexity**: 2/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Clean/new project opens the overlay after boot.
  - Top bar button opens overlay.
  - Source intake accepts local/url/youtube drafts in the overlay.
  - Hypothesis edits persist in workspace UI state.
  - Asset card selection, inspector, context bar, report open, download, delete, and close/ESC work.
  - If the app was started for smoke, return to the initial terminal state afterward.
- **Validation**: Manual smoke notes plus optional screenshot when Electron is available.

## Testing Strategy

- Start with tests that currently fail because they are stale; do not hide genuine implementation gaps by weakening assertions.
- Add direct overlay tests so future changes do not depend on old drawer/workspace source-string assertions.
- Keep source-intake tests focused on behavior and rendered controls, not exact large HTML layout.
- Finish with `npm run rooms:typecheck` and the focused five-file laboratory regression command.

## Potential Risks & Gotchas

- Updating tests only can mask missing behavior. Sprint 2 explicitly separates stale-test cleanup from actual behavior gaps.
- Auto-open can annoy users if it triggers on restored source-less projects. The predicate should match clean/new project semantics.
- Context multi-select may require host action support for batch delete/use. If host only supports single asset actions, UI must say and test that it uses the first valid target.
- Hover timeline highlight must stay transient; reusing `workspace-timeline-updated` would overwrite user selection and create surprising analysis input changes.
- Source progress should remain center-surface owned unless the product decision changes. Do not accidentally move progress into the overlay while realigning tests.
- Source intake is imported from `workspace-surface.ts`; if that file remains the owner of source intake internals, tests should assert ownership by render path rather than force a premature extraction.
- Missing i18n keys can be hidden by fallback copy and by EN/TR parity tests when both catalogs omit the same key. Add used-key coverage.
- `project-workspace.css` uses overlay-specific classes, while top bar styling lives in `lab-theme.css`; keep that split intentional.
- The current targeted test run reported an async `window is not defined` after `laboratory UI shell evaluates under minimal runtime stubs`; do not ignore it if it persists after contract updates.

## Rollback Plan

- If closure work destabilizes the room, revert only the new closure commits in reverse order.
- Preserve the already implemented Project Workspace files unless the user explicitly asks to revert the feature.
- If a sprint creates too much churn, keep Sprint 1 test contract updates separate from Sprint 2 behavior changes so stale-test fixes and real behavior fixes can be reviewed independently.
