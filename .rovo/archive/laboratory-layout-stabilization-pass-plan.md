# Plan: Laboratory Layout Stabilization Pass

**Generated**: 2026-05-02
**Estimated Complexity**: Medium

## Overview

PATCH 2 stabilizes the newly refactored Laboratory multi-region layout without changing the visual hierarchy or user-facing behavior. The work focuses on deterministic region lookup, predictable per-region sync, intentional fallback behavior, and lifecycle rules that keep layout regions present even when their content is empty.

The main safety rule is that DOM contracts remain functional contracts. Region sync must not rename or remove existing `data-lab-action`, `data-lab-field`, `data-lab-role`, `data-lab-preserve-media`, preview IDs, timeline IDs, or media-preservation attributes. `.labx-timeline` remains the TimelineArea node, no wrapper is introduced, and `.labx-media-workbench > .labx-timeline` must remain true.

## Clarified Decision

Selector priority for aliases is canonical first, alias second, legacy class fallback last:

- Top bar: `[data-lab-region="topbar"]`, `[data-lab-region="top-bar"]`, `.labx-top-bar`
- Left rail: `[data-lab-region="left-rail-source"]`, `[data-lab-region="left-rail"]`, `.labx-left-rail`

The existing DOM attributes stay canonical. The alias selectors are accepted for compatibility, but PATCH 2 does not rename the current DOM.

## Safe Assumptions

- Existing region names from PATCH 1 and the layout refactor stay stable unless explicitly migrated later.
- `topbar` and `left-rail-source` are canonical because they already exist in runtime DOM and tests.
- The exact sync implementation may preserve `updateRenderedElement` internally for media/detail state safety, as long as region lookup and fallback behavior become centralized and deterministic.
- Empty region lifecycle means the region container stays present; content inside may be empty or hidden.
- BootOverlay remains inside `.labx-shell`.

## Prerequisites

- Start from the completed PATCH 1 + main layout refactor state.
- Preserve existing dirty unrelated files, especially `config/rooms.json`.
- Do not implement visual redesign or layout hierarchy changes.
- Run tests from the repository root.

## Sprint 1: Selector Registry Hardening

**Goal**: Centralize region selector lookup with canonical-first alias ordering.

**Demo/Validation**:

- `lab-root.ts` has one region selector map.
- All region lookups use a single helper.
- Tests assert canonical, alias, and legacy fallback order.

### Task 1.1: Replace tuple selector map with ordered selector arrays

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Convert `LAB_REGION_SELECTORS` from `[region, fallbackClass]` tuples into ordered CSS selector arrays.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Internal key naming is explicit: either intentionally rename `topbar` -> `topBar` in code and tests, or keep the existing `topbar` key consistently. Do not leave mixed key names.
  - Top bar selector order is canonical `topbar`, alias `top-bar`, legacy `.labx-top-bar`.
  - `leftRail` order is canonical `left-rail-source`, alias `left-rail`, legacy `.labx-left-rail`.
  - Existing `mainStage`, `contextPanel`, `inspectorPanel`, and `processStrip` include current canonical region selector and legacy class fallback.
  - No current DOM region attribute is renamed.
- **Validation**:
  - Static assertions in `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`.

### Task 1.2: Add `queryRegion`

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Replace `queryLabRegion` with `queryRegion(root, selectors)` that iterates ordered selectors and returns the first HTMLElement match.
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Helper accepts `ParentNode` or `HTMLElement` safely.
  - Helper returns `HTMLElement | null`.
  - Region lookups no longer build selector strings internally from region names.
- **Validation**:
  - Unit/static tests confirm `queryRegion(runtimeRoot, LAB_REGION_SELECTORS.<chosenTopbarKey>)` style usage with the key name chosen in Task 1.1.

### Task 1.3: Remove scattered region query calls

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Replace direct region queries for topbar, left rail, main stage, context panel, inspector panel, and process strip with the centralized selector registry.
- **Complexity**: 4/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - No direct `.labx-top-bar`, `.labx-left-rail`, `.labx-center-panel`, `.labx-drawer`, `.labx-workspace-inspector`, or `.labx-process-strip` query is used for region lookup outside the registry.
  - Overlay-root queries may remain separate because they are not layout regions.
- **Validation**:
  - `rg` static check in tests or manual verification.

## Sprint 2: Deterministic Region Sync

**Goal**: Make normal layout updates linear and predictable while preserving media/detail state safety.

**Demo/Validation**:

- `render()` computes all region handles once.
- Each region sync is explicit and ordered.
- Full shell replace happens only through the guarded fallback.

### Task 2.1: Introduce region render descriptors

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Create a small descriptor list for normal laboratory layout regions: topBar, leftRail, mainStage, contextPanel, inspectorPanel, processStrip.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Each descriptor has selectors, render function, and preserve-scroll flag.
  - Render order is topBar -> leftRail -> mainStage -> contextPanel -> inspectorPanel -> processStrip.
  - Import-only branch keeps its existing focused behavior.
- **Validation**:
  - Static test asserts descriptor/render flow exists.

### Task 2.2: Add `syncRegion`

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Add a helper that receives the current element and rendered markup, then syncs the region deterministically.
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Empty markup does not remove the region container.
  - Empty markup clears or syncs inner region content according to the region's existing contract.
  - Non-empty markup uses the existing safe sync path where root replacement is required, preserving media and details state.
  - The helper does not introduce raw `innerHTML` replacement for preview/media subtree in a way that breaks `data-lab-preserve-media`.
- **Validation**:
  - Existing media-preservation tests remain passing.
  - `laboratory-controller-runtime-regressions` remains passing.

### Task 2.3: Apply `syncRegion` consistently

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Replace ad-hoc normal-layout region update calls with descriptor-driven `syncRegion` calls.
- **Complexity**: 5/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Topbar, left rail, main stage, context panel, inspector panel, and process strip all use the same sync pathway.
  - Overlay roots continue using existing overlay sync logic.
  - No accidental full re-render occurs during collapsed drawer or empty inspector cases.
- **Validation**:
  - `laboratory-ui-evaluation-regressions`
  - `laboratory-source-ui-regressions`
  - Mounted transition test continues passing.

## Sprint 3: Controlled Full Re-render Fallback

**Goal**: Replace implicit missing-region fallback with a single intentional critical-mass guard.

**Demo/Validation**:

- Shell replacement is easy to audit.
- Missing one optional/empty region does not cause a render loop.
- Losing critical layout mass still recovers with full shell replacement.

### Task 3.1: Add `shouldFallback`

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Implement `shouldFallback(regionsFound: number)` with threshold `< 3`.
- **Complexity**: 2/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Fallback threshold is centralized.
  - Tests document why the threshold exists.
- **Validation**:
  - Static assertion in `laboratory-ui-evaluation-regressions`.

### Task 3.2: Count discovered regions before sync

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: Resolve all normal layout regions first, count found regions, and call `replaceLabLayout` only when `shouldFallback` is true.
- **Complexity**: 4/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Full shell replace is not triggered by only an empty context/inspector state.
  - Full shell replace still triggers if the shell is absent or layout kind changes.
  - Full shell replace triggers when fewer than three core regions are found.
- **Validation**:
  - Add or update mounted shell regression for missing region recovery.

### Task 3.3: Add debug-only fallback telemetry

- **Location**: `rooms/laboratory/ui/lab-root.ts`
- **Description**: When debug mode is active, log region sync/fallback details with `console.debug`.
- **Complexity**: 3/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - No console noise unless debug is active.
  - Debug payload includes region found count and region names.
- **Validation**:
  - Static test asserts debug guard.

## Sprint 4: Region Lifecycle Rules

**Goal**: Make region presence deterministic across normal, empty, collapsed, and error states.

**Demo/Validation**:

- All normal layout regions stay present.
- Timeline empty state remains a direct hidden `.labx-timeline`.
- Inspector and context panel containers are stable.

### Task 4.1: Preserve always-present context panel container

- **Location**: `rooms/laboratory/ui/lab-drawer.ts`, `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Ensure `renderLabDrawer` returns a context panel container even when collapsed/empty, unless import-only layout intentionally omits the region.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Normal layout includes one context panel region.
  - Empty context content does not remove the container.
  - Drawer collapsed state remains behaviorally identical.
- **Validation**:
  - Source UI tests for drawer collapsed/open states.

### Task 4.2: Preserve always-present inspector panel container

- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Ensure normal layout keeps the inspector panel region even when there are no panels, with hidden/empty internal content when needed.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Normal layout includes one inspector panel region.
  - Collapsed inspector hides internal content, not the region container.
  - Existing `data-lab-action` values remain unchanged.
- **Validation**:
  - Source UI inspector tests.
  - Controller focus tests.

### Task 4.3: Keep explicit empty timeline area

- **Location**: `rooms/laboratory/ui/laboratory-layout.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Preserve the existing hidden empty timeline node for no-duration states.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `.labx-media-workbench > .labx-timeline` is true for rendered workspace states.
  - Empty timeline has `data-timeline-empty="true"` and `aria-hidden="true"`.
  - Empty timeline has no timeline interaction actions.
- **Validation**:
  - Wireframe v2 contract tests.

## Sprint 5: Debug Mode and Test Coverage

**Goal**: Harden region visibility/debug tooling and lock the stabilization behavior with tests.

**Demo/Validation**:

- Debug outlines cover all current canonical regions.
- Optional alias selectors do not change visual output.
- Runtime delegation tests still pass.

### Task 5.1: Harden debug region outlines

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Ensure `data-lab-debug-regions="true"` outlines all current regions, including topbar, left rail, main stage, main-stage-inner, preview, timeline, context, inspector, and process strip.
- **Complexity**: 2/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Debug CSS remains gated under `.labx-shell[data-lab-debug-regions="true"]`.
  - No default production outline.
- **Validation**:
  - Static CSS test.

### Task 5.2: Update regression tests for deterministic sync

- **Location**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
- **Description**: Update tests to verify selector priority, single sync pathway, controlled fallback, and always-present normal regions.
- **Complexity**: 5/10
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Tests assert canonical-first alias order.
  - Tests assert no direct scattered region queries.
  - Tests assert no wrapper around `.labx-timeline`.
  - Tests assert empty timeline region lifecycle.
- **Validation**:
  - Targeted test commands listed below.

### Task 5.3: Live DOM smoke checklist

- **Location**: CDP/Electron validation, no source file required
- **Description**: Validate open Laboratory page after implementation.
- **Complexity**: 2/10
- **Dependencies**: Sprint 5.2
- **Acceptance Criteria**:
  - 9/9 regions exist in normal layout.
  - The counted regions are topbar, left-rail-source, main-stage, main-stage-inner, preview-area, timeline-area, context-panel, inspector-panel, and process-strip.
  - `.labx-media-workbench > .labx-timeline` is true.
  - Critical IDs remain present when source duration exists.
  - Drawer/inspector/timeline controls remain clickable.
- **Validation**:
  - CDP evaluate + screenshot.

## Testing Strategy

Required validation:

```text
npm run rooms:typecheck
npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-controller-runtime-regressions.test.ts
npm run rooms:test:file -- scripts/tests/laboratory-selection-runtime-regressions.test.ts
```

Recommended extra validation:

```text
npm run rooms:test:file -- scripts/tests/laboratory-waveform-runtime-regressions.test.ts
npm run rooms:test:file -- scripts/tests/room-layout-contract-regressions.test.ts
git diff --check
```

Live smoke:

- Confirm all regions exist.
- Confirm timeline remains direct child of media workbench.
- Toggle drawer and inspector and restore state.
- Confirm timeline playback/seek controls remain reachable.

## Potential Risks & Gotchas

- The requested `syncRegion` example uses `innerHTML`; using it naively on main stage could break media preservation and details state. Mitigation: route sync through the existing safe DOM diff where needed.
- Region lifecycle "always exists" conflicts with import-only mode. Mitigation: scope always-present rules to normal Laboratory layout; import-only remains its intentional shell variant.
- Context panel currently may disappear when collapsed. Mitigation: decide in implementation whether collapsed means empty container or hidden content while preserving user-facing behavior.
- Alias region selectors must not encourage immediate DOM renames. Mitigation: tests assert current canonical values remain.
- Fallback threshold `< 3` is intentionally coarse. Mitigation: keep shell/layout-kind fallback checks separate and add tests for missing critical mass.
- Debug logging must be gated. Mitigation: only log when shell/debug dataset is active.

## Rollback Plan

- Revert changes in `rooms/laboratory/ui/lab-root.ts` to previous region sync logic.
- Keep existing `laboratory-layout.ts` container renderers intact unless a regression is tied directly to sync helpers.
- Revert only tests added for PATCH 2 stabilization if implementation is rolled back.
- Do not revert unrelated dirty files such as runtime-updated `config/rooms.json`.
