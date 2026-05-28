# Plan: Laboratory ContextPanel Pipeline Evolution

**Generated**: 2026-05-02
**Estimated Complexity**: Medium

## Overview

PATCH 3 evolves the Laboratory `ContextPanel` from mode-specific drawer markup into a structured pipeline host made of ordered blocks. The implementation must be additive: existing drawer modes, event delegation attributes, controller behavior, and `surface.side` placement stay intact. The safest path is to introduce the type and renderer first, then adapt `lab-drawer.ts` mode by mode while keeping the rendered content order and current CSS behavior stable.

## Safe Assumptions

- No blocking product decisions are needed before planning.
- Pipeline block wrappers can be visually neutral by default with `display: block`.
- Existing drawer mode content order is the source of truth.
- `surface.side` remains owned by setup drawer content and is not moved into preview, timeline, inspector, or controller code.
- `lab-run-controller.ts` is read-only for this patch.
- Any new metadata uses `data-block-*` attributes only and does not replace existing `data-lab-*` contracts.

## Pipeline Host Contract

- No new `.labx-pipeline` wrapper is introduced.
- The existing `.labx-drawer__body` is the pipeline host.
- `renderPipeline(...)` returns only `.labx-pipeline-block` wrappers.
- Collapsed and empty lifecycle states keep the ContextPanel container and may render an empty `.labx-drawer__body`; the panel remains hidden by PATCH 2 rules.
- Boot/loading skeleton uses the same body host and renders one `drawer-skeleton` block.
- `data-block-mode` must always be one of the resolved drawer modes: `setup`, `running`, `result`, or `explore`.

## Pipeline Block Matrix

| Mode | Order | Block ID | Type | Visible When |
| --- | ---: | --- | --- | --- |
| resolved boot mode | 1 | `drawer-skeleton` | `status` | `!state.bootReady` |
| setup | 1 | `analysis-prep` | `section` | source is ready |
| setup | 2 | `preflight` | `status` | selected intents exist |
| setup | 3 | `analysis-cta` | `action` | always |
| setup | 4 | `selection-panel` | `section` | `surface.side.trim() !== ""` |
| running | 1 | `execution-status` | `status` | always |
| running | 2 | `cancel-analysis` | `action` | always |
| result | 1 | `run-warnings` | `status` | completed run has warnings |
| result | 2 | `context-summary` | `section` | always |
| result | 3 | `decision-status` | `status` | always |
| result | 4 | `execution-advisories` | `status` | at least one advisory exists |
| result | 5 | `report-action` | `action` | always |
| result | 6 | `explore-toggle` | `action` | always |
| explore | 1 | `empty-warning` | `status` | run has empty reason |
| explore | 2 | `run-warnings` | `status` | run has warnings |
| explore | 3 | `workspace-comparison` | `section` | always |
| explore | 4 | `execution-alternatives` | `output` | alternatives exist |
| explore | 5 | `reanalyze-action` | `action` | always |
| explore | 6 | `result-toggle` | `action` | always |

## Global Acceptance Criteria

- No existing `data-lab-action`, `data-lab-field`, or `data-lab-role` attributes are renamed, removed, or shadowed.
- Conditional blocks are omitted when their current markup would be empty.
- No `.labx-pipeline-block` with empty trimmed content is rendered.
- Exact block order is asserted per mode.
- `data-block-id`, `data-block-type`, and `data-block-mode` values are escaped.

## Prerequisites

- PATCH 2 region lifecycle work remains in place.
- Current changed files are understood before implementation; do not revert unrelated dirty files such as `config/rooms.json`.
- Required validation commands remain available:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file -- scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-controller-runtime-regressions.test.ts scripts/tests/laboratory-selection-runtime-regressions.test.ts`
- Recommended extra validation:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
  - Electron smoke when the app is open.

## Sprint 0: Pipeline Contract Preflight

**Goal**: Confirm current drawer mode contracts and test anchors before any code edits.

**Demo/Validation**:
- Identify current `setup`, `running`, `result`, and `explore` drawer content order.
- Confirm no implementation task requires `lab-run-controller.ts`.
- Confirm existing `surface.side` assertions still define placement.

### Task 0.1: Map Existing Drawer Mode Output

- **Location**: `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Confirm the Pipeline Block Matrix against current drawer output and update the matrix if source review finds drift.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - All existing mode segments have a target pipeline block id.
  - Every block has a mode, type, visibility rule, and order.
  - No segment is dropped or moved across modes.
- **Validation**:
  - Source review only.

### Task 0.2: Identify Regression Anchors

- **Location**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
- **Description**: Identify assertions that must keep passing and where to add new structural checks for `data-block-id`, `data-block-type`, and `data-block-mode`.
- **Complexity**: 2
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - Existing action/field/role assertions remain unchanged.
  - New tests focus on structure, not new behavior.
- **Validation**:
  - Source review only.

## Sprint 1: Add Pipeline Model and Renderer

**Goal**: Introduce additive pipeline primitives without adapting drawer modes yet.

**Demo/Validation**:
- Typecheck passes.
- Renderer can render ordered blocks with metadata and visibility filtering.

### Task 1.1: Add Pipeline Block Type

- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabPipelineBlock` with `id`, `type`, `render`, and optional `visible`.
- **Complexity**: 2
- **Dependencies**: Sprint 0
- **Acceptance Criteria**:
  - Type is exported.
  - Existing exports remain backward-compatible; only the new type export is added.
  - No existing type consumers break.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add Pipeline Renderer

- **Location**: `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Add exported `renderPipeline(blocks, mode)` helper. It should filter invisible blocks, omit empty rendered content, render blocks in order, and add `data-block-id`, `data-block-type`, and `data-block-mode`.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Empty block lists return `""`, not `null`.
  - Renderer returns only `.labx-pipeline-block` wrappers, not a new host wrapper.
  - Block ids, types, and modes are HTML-escaped.
  - Block mode metadata is emitted for every rendered block.
  - Invisible blocks and empty rendered blocks are omitted.
  - No behavior or event wiring is added.
- **Validation**:
  - Add rendered-output regression for block metadata escaping.
  - Add source-level regression to assert renderer exists.
  - `npm run rooms:typecheck`

### Task 1.3: Add Neutral Pipeline Block CSS Early

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add `.labx-pipeline-block { display: block; }` before adapting drawer modes so layout drift is isolated early.
- **Complexity**: 1
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - No spacing, color, grid, or typography changes are introduced.
  - Existing `.labx-drawer__body` gap still controls spacing.
- **Validation**:
  - Source-level CSS assertion.

## Sprint 2: Adapt Setup and Collapsed Lifecycle

**Goal**: Convert setup mode and collapsed drawer lifecycle to pipeline structure while preserving current UI and `surface.side` placement.

**Demo/Validation**:
- Setup drawer still renders analysis prep, preflight, CTA, and selection side controls in the same order.
- Collapsed drawer still leaves ContextPanel mounted and hidden.

### Task 2.1: Build Setup Pipeline Blocks

- **Location**: `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Replace the internal setup concatenation with `LabPipelineBlock[]` blocks:
  - `analysis-prep`
  - `preflight`
  - `analysis-cta`
  - `selection-panel`
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Existing setup mode content order stays unchanged.
  - Existing `data-lab-action="run-deep-analysis"` stays unchanged.
  - No existing `data-lab-action`, `data-lab-field`, or `data-lab-role` attributes are changed.
  - Existing selection panel remains after the CTA.
  - `surface.side` is not rendered outside setup mode.
  - Exact setup block order is asserted.
- **Validation**:
  - Existing source UI tests pass.
  - Add assertions for setup block ids and modes.

### Task 2.2: Preserve Empty/Collapsed Pipeline Container Rules

- **Location**:
  - `rooms/laboratory/ui/lab-drawer.ts`
  - `rooms/laboratory/ui/laboratory-layout.ts`
- **Description**: Ensure collapsed drawer still renders the hidden ContextPanel and that empty content is represented by an empty pipeline host string rather than removing the container.
- **Complexity**: 3
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Collapsed drawer keeps `data-lab-region="context-panel"`.
  - Collapsed drawer keeps `hidden aria-hidden="true"`.
  - Collapsed drawer may keep an empty `.labx-drawer__body` host but renders no visible blocks.
  - No new visible UI appears while collapsed.
- **Validation**:
  - Existing hidden lifecycle tests pass.
  - Add a structural assertion that collapsed lifecycle remains compatible with pipeline rendering.

### Task 2.3: Preserve Boot Skeleton Lifecycle

- **Location**: `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Render the existing loading skeleton as a `drawer-skeleton` status block inside `.labx-drawer__body`, using the resolved drawer mode for `data-block-mode`.
- **Complexity**: 2
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Existing drawer header remains visible during boot loading.
  - Existing `labx-drawer-skeleton` markup remains unchanged inside the block.
  - Boot skeleton block uses `data-block-id="drawer-skeleton"` and `data-block-type="status"`.
- **Validation**:
  - Add or update boot-loading drawer assertion.

## Sprint 3: Adapt Running Mode Pipeline

**Goal**: Convert running mode to pipeline blocks and make status/progress areas independently queryable.

**Demo/Validation**:
- Running drawer still shows the locked analysis plan and cancel CTA.
- Cancel pending state remains unchanged.

### Task 3.1: Split Running Mode Into Status and Action Blocks

- **Location**: `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Build running mode blocks:
  - `execution-status` for `renderRunningAnalysisPlan(...)`
  - `cancel-analysis` for cancel CTA
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `data-lab-running-plan="true"` stays unchanged.
  - `data-lab-action="cancel-analysis"` stays unchanged.
  - No existing `data-lab-action`, `data-lab-field`, or `data-lab-role` attributes are changed.
  - `aria-busy` and disabled behavior stay unchanged.
  - `data-block-type="status"` is used for execution status.
  - Exact running block order is asserted.
- **Validation**:
  - `scripts/tests/laboratory-wireframe-v2-contract-regressions.test.ts`
  - `scripts/tests/laboratory-controller-runtime-regressions.test.ts`
  - Add running block metadata assertions.

## Sprint 4: Adapt Result and Explore Pipelines

**Goal**: Convert result and explore modes to blocks without altering decision/advisory/explore behavior.

**Demo/Validation**:
- Result mode still opens report overlay and can toggle explore.
- Explore mode still shows comparison, alternatives, reanalysis CTA, and back toggle.

### Task 4.1: Build Result Pipeline Blocks

- **Location**: `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Build result blocks:
  - `run-warnings`
  - `context-summary`
  - `decision-status`
  - `execution-advisories`
  - `report-action`
  - `explore-toggle`
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Existing `open-report-overlay` action remains unchanged.
  - Existing `drawer-explore-toggled` action remains unchanged.
  - No existing `data-lab-action`, `data-lab-field`, or `data-lab-role` attributes are changed.
  - Existing advisory details remain preserved for diffing.
  - Conditional result blocks are omitted when empty.
  - Exact result block order is asserted for a state with warnings and advisories.
  - No result content moves into inspector or process strip.
- **Validation**:
  - Existing result/explore source tests pass.
  - Add result block metadata assertions.

### Task 4.2: Build Explore Pipeline Blocks

- **Location**: `rooms/laboratory/ui/lab-drawer.ts`
- **Description**: Build explore blocks:
  - `empty-warning`
  - `run-warnings`
  - `workspace-comparison`
  - `execution-alternatives`
  - `reanalyze-action`
  - `result-toggle`
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - `data-lab-drawer-alternatives="true"` remains unchanged.
  - `run-deep-analysis` reanalysis action remains unchanged.
  - No existing `data-lab-action`, `data-lab-field`, or `data-lab-role` attributes are changed.
  - Explore back toggle remains unchanged.
  - Conditional explore blocks are omitted when empty.
  - Exact explore block order is asserted for a state with alternatives and warnings.
- **Validation**:
  - Existing explore tests pass.
  - Add explore block metadata assertions.

## Sprint 5: Debug Visibility

**Goal**: Add debug-only outlines after the pipeline structure is stable.

**Demo/Validation**:
- Debug mode shows block boundaries when region debugging is enabled.

### Task 5.1: Add Debug-Only Pipeline Outlines

- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add debug-only outline under `.labx-shell[data-lab-debug-regions="true"] .labx-pipeline-block`.
- **Complexity**: 1
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Debug outline is gated.
  - No global `.labx-pipeline-block` outline exists.
- **Validation**:
  - Source-level test asserts gated selector exists.

## Sprint 6: Verification and Live Smoke

**Goal**: Prove the pipeline structure is additive and existing behavior still works.

**Demo/Validation**:
- Typecheck and target suites pass.
- Electron smoke confirms live DOM and basic interactions.

### Task 6.1: Run Required Validation

- **Location**: repo root
- **Description**: Run required commands.
- **Complexity**: 2
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - Required test suites pass:
    - `laboratory-source-ui-regressions`
    - `laboratory-controller-runtime-regressions`
    - `laboratory-selection-runtime-regressions`
- **Validation**:
  - Command output.

### Task 6.2: Run Recommended Contract Suites

- **Location**: repo root
- **Description**: Run additional suites that caught prior layout and DOM contract issues.
- **Complexity**: 2
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - `laboratory-ui-evaluation-regressions` passes.
  - `laboratory-wireframe-v2-contract-regressions` passes.
  - `git diff --check` passes.
- **Validation**:
  - Command output.

### Task 6.3: Electron Smoke When Available

- **Location**: Electron Laboratory webview
- **Description**: If app/CDP is available, verify:
  - context panel exists
  - pipeline blocks exist with `data-block-id`, `data-block-type`, `data-block-mode`
  - pipeline block ids appear in expected order for the active mode
  - drawer collapse/expand keeps context lifecycle stable
  - existing actions still respond
- **Complexity**: 2
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - No Electron error logs.
  - Pipeline metadata is visible in live DOM.
  - Drawer/timeline/inspector smoke remains green.
- **Validation**:
  - CDP DOM snapshot and optional screenshot.

## Testing Strategy

- Keep tests behavior-first: existing assertions must continue to prove old drawer modes work.
- Add narrow structural assertions for pipeline metadata rather than snapshotting full HTML.
- Prefer testing each mode by rendering `renderLabDrawer(...)` with existing fixture states.
- Validate `surface.side` ordering with existing index checks and add a block id check for `selection-panel`.
- Use controller runtime tests to prove `data-lab-action` delegation was not disrupted.
- Use selection runtime tests to prove timeline/selection behavior is untouched.

## Potential Risks & Gotchas

- **Wrapper spacing drift**: Adding block wrappers inside `.labx-drawer__body` can alter flex gap behavior if blocks wrap fragments differently. Mitigation: each major existing segment becomes one block and CSS stays neutral.
- **Conditional empty blocks**: Returning empty string inside a visible block could create empty wrappers. Mitigation: use `visible` predicates for optional sections where safe, while preserving order.
- **Selection panel movement**: `surface.side` is easy to accidentally treat as a generic block across modes. Mitigation: only setup block builder receives `surface`.
- **Event delegation breakage**: Existing actions rely on `data-lab-action` and closest lookups. Mitigation: wrapper divs must not rename or shadow action attributes.
- **Details state preservation**: Result advisories use details elements that PATCH 2 preserves during diffing. Mitigation: keep existing advisory markup intact inside blocks.
- **Collapsed lifecycle regression**: Returning empty content could remove the region. Mitigation: keep `renderContextPanel` as the region owner and render hidden container as before.
- **Type import churn**: `lab-drawer.ts` may need type-only import of `LabPipelineBlock`; avoid turning it into a runtime import from model types.

## Rollback Plan

- Remove pipeline type and renderer additions.
- Restore `lab-drawer.ts` mode functions to direct string concatenation.
- Remove `.labx-pipeline-block` CSS and pipeline metadata tests.
- Keep PATCH 2 region lifecycle code untouched.
- Re-run typecheck and the same target regression suites after rollback.
