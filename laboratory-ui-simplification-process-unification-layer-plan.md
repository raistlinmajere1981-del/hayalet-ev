# Plan: Laboratory Phase 4.95 UI Simplification & Process Unification Layer

**Generated**: 2026-04-25
**Estimated Complexity**: High

## Overview

Phase 4.95 simplifies the Laboratory room UI by making process state visible from one top-level place, collapsing deep execution-thinking details by default, turning the right panel into a live context surface, and moving detailed execution-chain inspection into a dismissible overlay.

The language goal is **not** English-only. The corrected requirement is full Laboratory room-local i18n compatibility. All visible copy introduced or touched by this phase should resolve through `rooms/laboratory/i18n/en.json` and `rooms/laboratory/i18n/tr.json`, with key parity and scoped fallbacks. Existing mixed hardcoded strings in the touched Laboratory UI surfaces should be migrated into room-local catalogs instead of being replaced by a single language.

The implementation must remain UI + selector scoped:

- No `rooms/laboratory/runtime/lab-run-controller.ts` changes.
- No execution pipeline changes.
- No queue system changes.
- No analysis logic changes.
- No new persisted state.
- No async behavior changes.
- Source of truth remains `rooms/laboratory`; installed `data/rooms/laboratory` is refreshed only via install/sync.

## Prerequisites

- Confirm work starts in terminal workflow with `npm run mode:status` and `npm run whereami`.
- Keep unrelated screenshot and metadata changes out of the implementation commits unless explicitly requested.
- Read the current UI surfaces before editing:
  - `rooms/laboratory/ui/lab-layout.ts`
  - `rooms/laboratory/ui/lab-right-panel.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/ui/workspace-process-panel.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-root.ts`
  - `rooms/laboratory/ui/lab-theme.css`
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- Treat existing execution-thinking modules as upstream data only:
  - Plan
  - Simulation
  - Readiness
  - Payload preview
  - Reflection
  - Alternatives
  - Candidate
  - Commitment
  - Staging
- Do not reuse existing persisted collapse mechanisms for this phase:
  - Do not use `workspace-process-section-toggled`.
  - Do not use or extend `processPanelCollapsedSections`.
  - Collapse-first behavior must rely on DOM/native details state or equivalent ephemeral UI-only state.

## Sprint 1: Contract Audit And UI State Boundaries

**Goal**: Define the minimal view-model contracts for the simplified UI without adding persistence or changing execution behavior.

**Demo/Validation**:

- Type-only changes compile.
- No reducer/persistence schema changes are required.
- Existing execution-chain selectors still return the same derived data.

### Task 1.1: Inventory Process And Execution UI Surfaces

- **Location**:
  - `rooms/laboratory/ui/workspace-process-panel.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-right-panel.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Map every visible process indicator, execution-chain panel, report/process block, status badge, and loading animation currently rendered in Laboratory.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - Duplicate process indicators are identified before removal.
  - Each execution-chain section is classified as summary, detail, or right-panel context.
  - Affected text strings are listed for i18n migration.
- **Validation**:
  - `rg` confirms all known process labels are accounted for.

### Task 1.2: Add View-Model Types For UI-Only Panel State

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**: Extend `LabWaveformTimelineModel` with UI-only render fields:
  - `collapsedPanels: Record<string, boolean>`
  - `activeOverlay: "none" | "execution-details"`
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Types express the phase requirement.
  - No store schema, reducer, hydrate, or persistence changes are introduced.
  - Defaults are supplied by render/controller composition, not persisted state.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.3: Define Stable Panel IDs

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Define a small union or local constants for collapsible execution panel IDs:
  - `plan`
  - `simulation`
  - `readiness`
  - `payload`
  - `reflection`
  - `alternatives`
  - `candidate`
  - `commitment`
  - `staging`
- **Complexity**: 2
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Defaults match the request:
    - Collapsed by default: simulation, reflection, alternatives, payload preview.
    - Visible by default: candidate, commitment, staging.
  - `plan` and `readiness` are detail-layer panels and should be available in the overlay even if not prominent in the base timeline.
- **Validation**:
  - Unit/UI tests assert default open/closed markup.

## Sprint 2: Global Process Layer In The Topbar

**Goal**: Add one unified process summary at the top of the Laboratory UI and remove competing process summaries from nested/right-panel surfaces.

**Demo/Validation**:

- User can answer “what is happening now?” from one top-level process display.
- Right panel no longer duplicates process progress.
- Existing process data remains accessible through context/details where needed.

### Task 2.1: Add Derived Process Summary Selector

- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/models/lab-types.ts` if a shared type is needed
- **Description**: Add a derived selector such as `getLaboratoryProcessSummary(state)` that returns:
  - `state: "idle" | "processing" | "analyzing" | "staging"`
  - `completedCount`
  - `totalCount`
  - `activeTaskLabel`
  - `progressLabel`
  - `tone`
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Derives from existing run/process/staging data only.
  - State precedence is deterministic when multiple signals exist:
    - `analyzing` wins when a run is actively analyzing.
    - `processing` wins when source/tool/process work is active but not an analysis run.
    - `staging` wins when the passive commitment/staging chain is present and no active processing/analyzing is running.
    - `idle` is used when none of the above applies.
  - `completedCount` and `totalCount` come from existing run/module progress when a run exists; otherwise they use passive execution-chain milestones only as context, not as execution progress.
  - `activeTaskLabel` comes from the active module/run label first, then active operation label, then passive staging/candidate label.
  - Does not trigger execution or call async APIs.
  - `staging` is derived from passive staging/commitment state, not from a real queue.
  - Empty workspace returns `idle`.
- **Validation**:
  - Add selector tests in `scripts/tests/laboratory-runtime-truth-regressions.test.ts` or a suitable UI evaluation test.

### Task 2.2: Render Topbar Process Display

- **Location**:
  - `rooms/laboratory/ui/lab-layout.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/ui/lab-theme.css`
  - possibly `rooms/laboratory/ui/lab-topbar-actions.ts` if the topbar already owns action/status layout
- **Description**: Render a compact top-level process block containing current system state, progress, and active task label.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - One global indicator exists in the rendered shell.
  - Markup has a stable test hook, for example `data-lab-global-process="true"`.
  - If Laboratory does not currently expose a single room-level topbar slot, create a small room-local header strip in the shell rather than coupling to app/global chrome.
  - Display is compact on desktop and does not obscure the existing topbar/room shell.
  - Text uses room-local i18n keys.
- **Validation**:
  - UI test asserts the process summary appears once.
  - Visual smoke in app after install.

### Task 2.3: Remove Duplicate Process Indicators From Nested Surfaces

- **Location**:
  - `rooms/laboratory/ui/workspace-process-panel.ts`
  - `rooms/laboratory/ui/lab-right-panel.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Replace nested process-progress blocks with either concise contextual summaries or links/triggers to the detail overlay. Do not remove essential diagnostic content if it has no other home.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - No duplicate “process progress” / “analysis flow” indicator competes with the global topbar display.
  - Right panel no longer acts as static report-only process dashboard.
  - Detailed process traces can still be inspected where relevant.
- **Validation**:
  - UI evaluation test counts `data-lab-global-process`.
  - UI evaluation test asserts removed duplicate labels do not render in multiple places.

## Sprint 3: Collapse-First Execution Panel Behavior

**Goal**: Keep the base timeline focused by making deep execution-thinking layers collapsible and compact by default.

**Demo/Validation**:

- Candidate, commitment, and staging are immediately visible.
- Simulation, reflection, alternatives, and payload preview start collapsed.
- Expanding/collapsing does not persist and does not change selection, intent, or execution data.

### Task 3.1: Add Generic Collapsible Panel Renderer

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**: Introduce a local helper that wraps execution-chain sections in a consistent collapsible shell.
- **Complexity**: 5
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Uses stable attributes such as `data-lab-collapsible-panel` and `data-panel-id`.
  - Default state comes from `model.collapsedPanels`.
  - Implementation does not call `workspace-process-section-toggled` and does not read or write `processPanelCollapsedSections`.
  - Existing panel data attributes remain present inside content for test compatibility where possible.
  - The wrapper has no CTA verbs such as standalone “Run”, “Execute”, “Apply”, “Start”, “Commit”, or “Queue”; noun labels such as “Commitment state” are allowed when they describe the passive model.
- **Validation**:
  - UI tests assert default collapsed/open panels.

### Task 3.2: Preserve Collapse State Only In The Live DOM

- **Location**:
  - `rooms/laboratory/ui/lab-root.ts`
- **Description**: Extend existing details-state preservation beyond `data-lab-interpretation-panel` to a generic `data-lab-collapsible-panel` mechanism.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - User toggles survive regular re-render while the same DOM element identity remains.
  - State is lost on full reload, source/project switch, or normal remount.
  - No persisted state is added to `readPersistableState`.
  - Existing persisted process panel collapse state remains untouched and does not control these panels.
- **Validation**:
  - Add DOM sync test coverage for preserved collapsible details state.
  - Confirm persistence tests show no new fields.

### Task 3.3: Reorder Timeline Execution Chain For Scanability

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Reorder base timeline so selection preview and chosen path state stay readable, while deep diagnostic panels are collapsed or moved into details overlay.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Candidate, commitment, and staging remain visible when available.
  - Simulation, reflection, alternatives, and payload preview are collapsed by default.
  - Plan and readiness remain available through overlay/details and do not add visual noise to the base selection panel.
- **Validation**:
  - UI test snapshots/queries verify panel order and visibility.

## Sprint 4: Execution Details Overlay

**Goal**: Move full execution-chain depth into a dismissible overlay so the base UI stays light without hiding expert detail.

**Demo/Validation**:

- A “View details” trigger opens an overlay.
- Overlay includes plan, simulation, readiness, reflection, and alternatives.
- Overlay closes without changing store state or selection.

### Task 4.1: Add UI-Only Overlay Controller

- **Location**:
  - `rooms/laboratory/ui/lab-root.ts`
  - optional new UI helper file if the local state becomes too large
- **Description**: Track `activeOverlay: "none" | "execution-details"` as ephemeral UI state in the root UI/controller layer.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Opening/closing overlay does not emit workspace execution events.
  - No reducer or persistence changes.
  - Selector-built timeline models stay pure; root/UI composition overlays the current `activeOverlay` value before rendering.
  - Overlay closes on explicit close and Escape when practical.
  - Overlay closes on source, project, selection, ROI, or intent invalidation.
  - Overlay may remain open across harmless re-renders, pause/play, and panel toggles when upstream identity is still valid.
  - Re-render receives active overlay state through view model composition.
- **Validation**:
  - UI evaluation test opens/closes overlay through data attributes or DOM events.

### Task 4.2: Render Execution Details Overlay

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add overlay markup with a stable hook such as `data-lab-execution-details-overlay="true"` and render full execution chain details:
  - plan
  - simulation
  - readiness
  - reflection
  - alternatives
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Overlay is dismissible.
  - Overlay does not permanently block base UI.
  - No execution/action CTA language appears.
  - Empty upstream data renders a localized passive empty state.
- **Validation**:
  - UI tests assert overlay content appears only when active.
  - Forbidden execution CTA verb test remains green while allowing passive nouns such as “commitment”.

### Task 4.3: Add “View Details” Trigger Near The Base Chain

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add a small, localized trigger near candidate/commitment/staging or the selection preview.
- **Complexity**: 3
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Trigger is visible only when there is meaningful upstream execution-chain data.
  - Trigger text is localized.
  - Trigger opens overlay only; it does not set intent, commitment, staging, or execution state.
- **Validation**:
  - UI event test verifies no workspace execution event is emitted.

## Sprint 5: Right Panel As Live Control + Context

**Goal**: Reassign the right panel from static/report-heavy process content to a concise live context surface.

**Demo/Validation**:

- Right panel shows current selection, active intent, candidate status, commitment state, and staging state.
- Static report-only usage is removed from the default right panel.
- Report overlay remains available through existing report controls if already present.

### Task 5.1: Build Right Panel Context View Model

- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/ui/lab-right-panel.ts`
  - `rooms/laboratory/models/lab-types.ts` if a shared type is needed
- **Description**: Derive a small right-panel context model from existing selectors:
  - active selection summary
  - active execution intent label/status
  - candidate status
  - commitment state
  - staging state
  - process summary reference
- **Complexity**: 5
- **Dependencies**: Sprint 2 and Sprint 3
- **Acceptance Criteria**:
  - Derived-only, no persistence.
  - Safe if any upstream execution-chain layer is null.
  - The model is passed explicitly to `renderLabRightPanel`; the new live context must not be awkwardly smuggled through `surface.side`.
  - Text uses room-local i18n.
- **Validation**:
  - Runtime/UI tests for empty, selected, committed, and staged states.

### Task 5.2: Render Live Control + Context Panel

- **Location**:
  - `rooms/laboratory/ui/lab-right-panel.ts`
  - `rooms/laboratory/ui/lab-layout.ts`
  - `rooms/laboratory/ui/lab-theme.css`
- **Description**: Render the new right-panel surface instead of passing static `surface.side` through unchanged for Laboratory workspace states.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - `renderLabRightPanel` receives the state-derived context model and localized copy helper, or an equivalent explicit view model.
  - Includes active selection summary.
  - Includes active intent.
  - Includes candidate, commitment, and staging states.
  - Does not duplicate the topbar process indicator.
  - Does not include execution triggers.
  - Uses existing report content only as contextual links/summary if needed.
- **Validation**:
  - UI test asserts right panel contains context blocks.
  - UI test asserts duplicate process labels are gone.

### Task 5.3: Retire Static Report-Only Right Panel Content

- **Location**:
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/ui/workspace-process-panel.ts`
  - `rooms/laboratory/ui/lab-right-panel.ts`
- **Description**: Remove or move report-only/static process surfaces that made the right panel feel like a second dashboard.
- **Complexity**: 5
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Existing report overlay remains functional.
  - No analysis/report generation logic changes.
  - Process content that remains is contextual, not a duplicate control surface.
- **Validation**:
  - Existing report overlay tests still pass.
  - Manual smoke confirms right panel updates with selection/intent state.

## Sprint 6: Room-Local i18n Compatibility

**Goal**: Make the touched Laboratory UI surfaces fully compatible with room-local i18n in both English and Turkish.

**Demo/Validation**:

- Switching room locale uses `rooms/laboratory/i18n/en.json` or `rooms/laboratory/i18n/tr.json`.
- Touched surfaces no longer rely on hardcoded visible copy.
- English and Turkish catalogs have matching keys.

### Task 6.1: Introduce A Small Laboratory UI Copy Access Pattern

- **Location**:
  - `rooms/laboratory/ui/lab-root.ts`
  - `rooms/laboratory/ui/lab-layout.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - optionally a new `rooms/laboratory/ui/lab-i18n.ts`
- **Description**: Add a room-local copy helper or pass a copy object through render models so UI renderers can resolve catalog keys without importing runtime controller logic.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Renderers receive localized strings or a typed helper.
  - Fallbacks remain minimal and scoped.
  - No async loading changes.
  - No store persistence changes.
- **Validation**:
  - Typecheck and UI render tests.

### Task 6.2: Add Phase 4.95 Copy Keys To en/tr Catalogs

- **Location**:
  - `rooms/laboratory/i18n/en.json`
  - `rooms/laboratory/i18n/tr.json`
- **Description**: Add keys for:
  - global process layer
  - collapsed panel labels
  - execution details overlay
  - right-panel live context
  - loading/status copy
  - empty states
  - action-neutral words such as “View details”, “Hide details”, “Prepared”, “Staged”
- **Complexity**: 4
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Catalog key parity between English and Turkish.
  - No mixed-language copy in newly added keys.
  - Existing intentionally technical identifiers remain unchanged where they are data, not visible prose.
- **Validation**:
  - Add or extend an i18n parity test.

### Task 6.3: Audit Rendered Upstream Deterministic Prose

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/runtime/lab-execution-planner.ts`
  - `rooms/laboratory/runtime/lab-execution-simulator.ts`
  - `rooms/laboratory/runtime/lab-execution-readiness.ts`
  - `rooms/laboratory/runtime/lab-execution-bridge.ts`
  - `rooms/laboratory/runtime/lab-execution-reflection.ts`
  - `rooms/laboratory/runtime/lab-execution-alternatives.ts`
  - `rooms/laboratory/runtime/lab-execution-candidate.ts`
  - `rooms/laboratory/runtime/lab-execution-staging.ts`
  - `rooms/laboratory/runtime/lab-interpretation-engine.ts`
- **Description**: Identify deterministic prose generated upstream and rendered by the touched UI. Decide whether each rendered string can be localized at the UI/selector boundary through stable IDs/action types or must be documented as an out-of-scope follow-up because changing the runtime generation layer would violate the phase constraints.
- **Complexity**: 6
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - All upstream rendered prose in the new overlay/right-panel/collapsible flow is inventoried.
  - Stable action/status/category labels are localized through UI-boundary formatting.
  - Freeform deterministic summaries that cannot be safely localized without runtime-module rewrites are explicitly listed as follow-up debt.
  - No execution-thinking runtime modules are rewritten solely for translation unless the change is selector/UI-boundary formatting and remains side-effect free.
- **Validation**:
  - Review inventory against rendered panels.
  - Add test coverage for localized stable labels and documented follow-up exclusions.

### Task 6.4: Migrate Hardcoded Visible Copy In Touched UI

- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/workspace-process-panel.ts`
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/ui/lab-right-panel.ts`
  - `rooms/laboratory/ui/workspace-roi-overlay.ts` if touched by right/context overlay
  - `rooms/laboratory/ui/lab-project-assets-panel.ts` if preview labels are touched
  - `rooms/laboratory/ui/lab-root.ts` boot fallback copy
  - `rooms/laboratory/runtime/lab-selectors.ts` only for selector-derived visible labels already consumed by touched UI
- **Description**: Replace visible hardcoded strings in the touched surfaces with catalog lookups or localized copy passed through the view model.
- **Complexity**: 9
- **Dependencies**: Tasks 6.2 and 6.3
- **Acceptance Criteria**:
  - Touched UI renders through room-local i18n.
  - Runtime-originated messages from selectors/controllers are not rewritten unless they pass through a UI formatter in scope.
  - Selector-originated user-facing labels that appear in the new topbar/right-panel/timeline surfaces are localized at the UI boundary or moved to i18n-aware formatting.
  - `lab-run-controller.ts` is untouched.
  - Technical enum values, data attributes, and test IDs are not localized.
- **Validation**:
  - Targeted `rg` audit for visible strings in touched files.
  - UI tests assert key localized labels render.

### Task 6.5: Add i18n Guard Tests

- **Location**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - optionally a new focused i18n regression test
- **Description**: Add tests for catalog key parity and the most important rendered labels in both locales.
- **Complexity**: 5
- **Dependencies**: Task 6.4
- **Acceptance Criteria**:
  - en/tr catalogs have matching object paths.
  - Global process, right context, overlay, and collapsible panel labels are localized.
  - Tests render representative UI in both English and Turkish, not only catalog parity.
  - Tests avoid false positives from technical IDs, class names, enum values, brand names, and data attributes.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

## Sprint 7: Visual Noise And Loading State Cleanup

**Goal**: Reduce redundant visual weight and standardize passive loading/status behavior.

**Demo/Validation**:

- Only one process/progress indicator is visually prominent.
- Loading buttons/indicators share one style.
- Deep execution-chain details no longer crowd the selection panel.

### Task 7.1: Normalize Loading And Status Styles

- **Location**:
  - `rooms/laboratory/ui/lab-theme.css`
  - `rooms/laboratory/ui/style.css` if global room-level CSS is required
- **Description**: Define a single lightweight loading/status animation and reuse it for UI-only pending states.
- **Complexity**: 5
- **Dependencies**: Sprint 2 and Sprint 6
- **Acceptance Criteria**:
  - No new aggressive animations.
  - Existing disabled/loading buttons look consistent.
  - Accessibility is preserved with text labels and state attributes.
- **Validation**:
  - Visual smoke.
  - CSS lint/build.

### Task 7.2: Remove Redundant Nested Panels

- **Location**:
  - `rooms/laboratory/ui/workspace-process-panel.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-right-panel.ts`
- **Description**: Remove or collapse nested process panels that repeat the same progress/status copy.
- **Complexity**: 6
- **Dependencies**: Sprint 2 and Sprint 5
- **Acceptance Criteria**:
  - Base UI scan path is topbar -> center work surface -> right context.
  - Detail path is explicit via “View details”.
  - No duplicate progress wording appears.
- **Validation**:
  - UI evaluation test for single process indicator.
  - Manual app smoke.

## Sprint 8: Validation, Install Sync, And Guardrail Review

**Goal**: Prove Phase 4.95 is UI-only, i18n-compatible, and safe to hand to the next implementation AI.

**Demo/Validation**:

- Full requested validation suite passes.
- Installed room copy refreshes from workspace source.
- A final sub-agent review checks plan/current-state compatibility.

### Task 8.1: Run Targeted Automated Checks

- **Location**:
  - test scripts and npm scripts
- **Description**: Run the focused checks before broad checks.
- **Complexity**: 4
- **Dependencies**: Sprints 1-7
- **Acceptance Criteria**:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:build`
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - `npm run rooms:test:core`
- **Validation**:
  - Record any pre-existing warnings separately from new failures.

### Task 8.2: Refresh Installed Laboratory Copy

- **Location**:
  - `rooms/laboratory`
  - generated `data/rooms/laboratory`
- **Description**: Run `installFromWorkspace("laboratory")` or the existing project-approved install command after source changes pass.
- **Complexity**: 3
- **Dependencies**: Task 8.1
- **Acceptance Criteria**:
  - Installed copy reflects workspace source.
  - No manual peer edits are made directly in `data/rooms/laboratory`.
- **Validation**:
  - Installed parity tests or smoke import pass.

### Task 8.3: Guardrail Diff Review

- **Location**:
  - repository diff
- **Description**: Verify forbidden files/systems were not changed.
- **Complexity**: 2
- **Dependencies**: Task 8.2
- **Acceptance Criteria**:
  - `rooms/laboratory/runtime/lab-run-controller.ts` unchanged.
  - No queue, dispatch, analysis pipeline, or persistence additions.
  - No new persisted fields for `collapsedPanels` or `activeOverlay`.
  - Existing persisted `processPanelCollapsedSections` behavior is unchanged and not repurposed for Phase 4.95 collapsible panels.
  - UI strings introduced/touched by the phase are represented in room-local i18n catalogs.
- **Validation**:
  - `git diff --name-only`
  - targeted `rg` audits.

### Task 8.4: Sub-Agent Plan/Implementation Compatibility Review

- **Location**:
  - full repository state after implementation
- **Description**: Ask a sub-agent to compare the final implementation against this plan and report guardrail, i18n, duplicate-process, and UI state issues.
- **Complexity**: 3
- **Dependencies**: Task 8.3
- **Acceptance Criteria**:
  - Review findings are either fixed or explicitly documented.
  - No unresolved high-severity mismatch remains.
- **Validation**:
  - Final targeted tests rerun after fixes.

## Testing Strategy

- **Type safety**:
  - `npm run rooms:typecheck`
- **Lint/build**:
  - `npm run rooms:lint`
  - `npm run rooms:build`
- **UI evaluation**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - collapsed panels default state
  - overlay open/close behavior
  - single process indicator enforcement
  - right-panel context content
  - forbidden execution CTA verb wording
  - i18n label rendering in English and Turkish
- **Runtime truth**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - process summary selector
  - no persistence leak for UI-only state
  - execution-chain selectors unchanged
- **Source UI regression**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - topbar/right-panel/timeline render compatibility
- **Install parity**:
  - run the approved `installFromWorkspace("laboratory")` flow
  - parity/smoke tests if available
- **Manual smoke**:
  - source loaded, no selection
  - time selection only
  - ROI selection
  - accepted intent
  - candidate visible
  - commitment chosen/revoked
  - staging visible
  - details overlay open/close
  - Turkish and English locales

## Potential Risks & Gotchas

- **UI-only state can accidentally become persisted**:
  - Mitigation: keep `collapsedPanels` and `activeOverlay` out of `LabStoreState`, reducers, hydrate, and `readPersistableState`; do not use existing `processPanelCollapsedSections` or `workspace-process-section-toggled`.
- **i18n migration can balloon scope**:
  - Mitigation: fully localize all newly added and touched visible copy, but do not rewrite untouched runtime-originated messages unless they are routed through a touched UI formatter.
- **Upstream deterministic prose is already rendered by the UI**:
  - Mitigation: localize stable labels at the UI boundary and explicitly document freeform runtime-generated summaries that require a later runtime/i18n phase.
- **Hardcoded string scans can false-positive technical text**:
  - Mitigation: tests should ignore data attributes, CSS class names, enum values, action IDs, file names, and brand/product names.
- **Removing duplicate process panels can hide useful diagnostics**:
  - Mitigation: move deep details into the overlay rather than deleting unique diagnostic content.
- **Right panel reassignment can conflict with existing `surface.side` ownership**:
  - Mitigation: preserve existing surface-side content where it contains unique report/diagnostic detail, but render it through the new context hierarchy or overlay instead of as the default static panel.
- **The requested “topbar” might not map to an existing room-owned topbar component**:
  - Mitigation: create a Laboratory-owned shell process strip instead of coupling to the host/app chrome.
- **Selectors can leak localized copy concerns into runtime logic**:
  - Mitigation: keep selectors primarily structural; format localized labels at UI boundaries unless a selector already returns visible text for a touched surface.
- **Topbar “staging” can be misread as real execution queue state**:
  - Mitigation: derive staging only from passive Laboratory staging/commitment chain and use passive i18n wording.
- **Multiple process signals can compete**:
  - Mitigation: use the explicit precedence `analyzing > processing > staging > idle` and test mixed-signal cases.
- **Existing DOM sync preserves only interpretation details state**:
  - Mitigation: extend it generically for collapsible panels without disrupting media preservation keys.
- **Turkish catalog currently contains mixed English terms**:
  - Mitigation: touched keys should become coherent Turkish. Existing untouched mixed terms can be logged as follow-up unless they render in the new/touched flow.
- **Installed room copy drift**:
  - Mitigation: edit only `rooms/laboratory`, then refresh `data/rooms/laboratory` via install/sync.
- **Unrelated dirty files exist**:
  - Mitigation: do not include screenshot or metadata changes in implementation commits unless the user explicitly asks.

## Rollback Plan

- Revert only Phase 4.95 source changes in `rooms/laboratory` and related tests.
- Re-run install/sync to regenerate `data/rooms/laboratory` from the reverted source.
- Confirm `lab-run-controller.ts`, execution pipeline, queue, and persistence files remain untouched.
- If the i18n helper causes broad render breakage, keep catalog additions but temporarily route touched renderers through existing literal fallback while preserving tests as pending follow-up.

## Definition Of Done

- One global topbar process indicator exists.
- Duplicate process indicators are removed from right/nested panels.
- Deep execution-chain panels are collapse-first:
  - collapsed by default: simulation, reflection, alternatives, payload preview
  - visible by default: candidate, commitment, staging
- Right panel acts as Live Control + Context:
  - active selection
  - active intent
  - candidate
  - commitment
  - staging
- Details overlay shows:
  - plan
  - simulation
  - readiness
  - reflection
  - alternatives
- Laboratory room-local i18n compatibility is improved for all touched visible UI.
- No execution, queue, analysis, asset/export, async, or persistence behavior is added.
- Targeted tests and room validation pass.
