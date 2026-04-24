# Plan: Laboratory Timeline Phase 1.5 - Selection as First-Class Entity

**Generated**: 2026-04-24
**Estimated Complexity**: Medium

## Overview
Promote the Laboratory timeline selection from a raw `startMs`/`endMs` highlight into a semantic `LabSelection` entity that the UI can present as a meaningful analysis candidate.

This phase stays intentionally narrow:
- No analysis pipeline execution
- No run/user-action/asset-registry changes
- No new command wiring behind the passive action hints

Current codebase note:
- The timeline is composed in [`workspace-surface.ts`](/home/raistlin/hayalet-ev/rooms/laboratory/ui/workspace-surface.ts), but the actual selection/timeline markup owner is [`lab-waveform-timeline.ts`](/home/raistlin/hayalet-ev/rooms/laboratory/ui/lab-waveform-timeline.ts).
- The safest Phase 1.5 path is additive: keep `timelineStartMs` / `timelineEndMs` as compatibility mirrors for existing clip/export/analysis seams, and add `activeSelection` alongside them.
- Because `run-controller` is explicitly out of scope, `activeSelection` should be synthesized from the existing `workspace-timeline-updated` event inside the reducer rather than introduced via new controller events.
- That additive bridge only stays safe if source/project reset seams clear both `activeSelection` and the primitive timeline range together; otherwise export/analysis can still act on stale intervals.

## Prerequisites
- Unified waveform timeline is already active in the Laboratory workspace.
- Existing timeline interactions already dispatch `workspace-timeline-updated`.
- Existing exports and analysis scope still read `timelineStartMs` / `timelineEndMs`.
- Validation baseline:
  - `npm run rooms:typecheck`
  - targeted timeline regressions
  - installed room sync for parity-sensitive suites

## Assumptions
- `LabSelection.type` defaults to `"clip"` in Phase 1.5.
- `label` remains optional and unset by default; this phase only reserves the field.
- `roi` is model-only and future-ready; no ROI authoring UI is added in this phase.
- “Selection created” means the reducer has a valid semantic selection after a valid timeline range exists; it does not require a new mouseup-finalize event.
- `activeSelection` is not introduced as an independent persisted source of truth in this phase; hydrate should synthesize it from a valid persisted primitive range.
- While a drag or numeric refinement evolves the same valid selection, `id` and `createdAt` should be preserved rather than regenerated on every reducer pass.

## Sprint 1: Model And State Bridge
**Goal**: Introduce `LabSelection` safely without breaking current timeline consumers.

**Demo/Validation**:
- A valid timeline range produces `activeSelection` in state.
- Invalid or incomplete ranges do not produce a valid semantic selection.
- Source/project refresh clears stale selection state.

### Task 1.1: Add Semantic Selection Types
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabSelectionType` and `LabSelection`, then extend the workspace UI state with `activeSelection: LabSelection | null`.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabSelection` includes `id`, `startMs`, `endMs`, `type`, optional `label`, optional `roi`, and `createdAt`
  - `LabWorkspaceUiState` can carry `activeSelection`
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add Store Helpers For Selection Synthesis
- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add reducer-local helpers to normalize timeline ranges and build/clear `activeSelection` from existing `workspace-timeline-updated` events.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Valid `startMs < endMs` produces a semantic selection object
  - Invalid ranges keep `activeSelection` null
  - Compatibility fields `timelineStartMs` and `timelineEndMs` remain intact
  - A still-evolving valid selection reuses the current `activeSelection.id` / `createdAt` instead of churning them on every drag frame
  - A fresh `id` is minted only when transitioning from invalid/null into a new valid selection
  - No run-controller edits are required
- **Validation**:
  - reducer-focused regression tests
  - identity-stability regression for drag/refine flows

### Task 1.3: Reset Selection On Source/Project Changes
- **Location**: `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Clear both `activeSelection` and the primitive `timelineStartMs` / `timelineEndMs` bridge at the same source-boundary events that currently reframe workspace media context, especially snapshot/project and source reconfiguration seams.
- **Complexity**: 4/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `snapshot-received` does not carry stale selection or stale primitive timeline range across source/project swaps
  - `source-config-patched` resets the semantic and primitive range when the source is effectively changing
  - export/analyze compatibility seams cannot read an old interval after a source swap
- **Validation**:
  - regression for selection reset on source change
  - regression proving primitive range clears alongside `activeSelection`

### Task 1.4: Define Hydration And Backward-Compat Rules
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/models/lab-types.ts`
- **Description**: Make the compatibility contract explicit: Phase 1.5 either synthesizes `activeSelection` from persisted valid primitive ranges during hydrate, or intentionally ignores persisted semantic copies and derives from the primitive bridge only.
- **Complexity**: 4/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Reloading a session with a valid saved range produces a rendered semantic selection
  - Invalid persisted ranges do not hydrate as valid semantic entities
  - The plan does not introduce a second drifting persisted source of truth
- **Validation**:
  - hydrate regression for valid saved selection reconstruction
  - hydrate regression for invalid saved range suppression

## Sprint 2: Selector And View-Model Surface
**Goal**: Expose semantic selection cleanly to the UI without disturbing existing pipelines.

**Demo/Validation**:
- UI selectors can read the semantic selection directly.
- Timeline model includes enough data to render an entity panel without reading raw store internals in the component.

### Task 2.1: Add Selection Selectors
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `getActiveSelection`, `isSelectionValid`, and `getSelectionDuration`.
- **Complexity**: 2/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - selectors return stable defaults when selection is missing
  - validity requires `endMs > startMs`
- **Validation**:
  - selector correctness tests

### Task 2.2: Enrich Timeline View Model
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Extend the unified timeline selector/model so the rendering layer receives semantic selection metadata, not just primitive range values.
- **Complexity**: 4/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - timeline model includes active selection identity, type, label, and duration-ready fields
  - existing playhead/waveform/bookmark data remains unchanged
- **Validation**:
  - timeline selector regressions continue to pass

### Task 2.3: Preserve Compatibility With Existing Timeline Consumers
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Keep `timelineStartMs` / `timelineEndMs` as the operational bridge for exports and analysis while `activeSelection` becomes the semantic UI source of truth.
- **Complexity**: 5/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Phase 1.5 does not require changes to export handlers or analysis pipeline wiring
  - `activeSelection` and primitive timeline range do not drift for valid selections
  - source/project reset seams clear both layers together
  - hydrate reconstructs the semantic layer from the compatibility bridge when appropriate
- **Validation**:
  - existing timeline/export regressions stay green

## Sprint 3: Timeline Entity UI
**Goal**: Make the selected timeline region look and read like a first-class analysis object.

**Demo/Validation**:
- Selecting a range shows a semantic mini-panel above the selection.
- The selected overlay has stronger visual identity than a plain highlight.
- Passive action affordances are visible but inert.

### Task 3.1: Move Selection Rendering Ownership To Semantic Model
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Replace raw highlight-only rendering with selection-entity-aware markup. Keep [`workspace-surface.ts`](/home/raistlin/hayalet-ev/rooms/laboratory/ui/workspace-surface.ts) as the composition layer only.
- **Complexity**: 5/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - valid selection renders from `activeSelection`
  - invalid/incomplete ranges do not show entity affordances
  - render ownership does not fork between `workspace-surface.ts` and `lab-waveform-timeline.ts`
- **Validation**:
  - markup assertions in regressions

### Task 3.2: Add Selection Entity Panel
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Add a floating mini-panel above the selection with:
  - `Selection`
  - `00:12.300 -> 00:18.900 (6.6s)`
  - `Type: Clip`
- **Complexity**: 4/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - panel anchors to the selected region
  - duration formatting matches existing timeline precision conventions
  - type display uses semantic selection data, not hardcoded label text in multiple places
- **Validation**:
  - markup-based UI regression checks

### Task 3.3: Add Passive Action Affordances
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline.ts`
- **Description**: Add disabled or soft buttons for `Analyze this`, `Extract clip`, and `Focus region`, but explicitly keep the existing live timeline action row as the canonical executable control surface in Phase 1.5.
- **Complexity**: 3/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - buttons do not trigger actions
  - buttons do not emit live `data-lab-action` hooks
  - existing live export/grab/extract buttons remain untouched and tested
  - the passive panel controls are visually secondary so they do not compete with the existing live action row
  - the UI communicates next-step potential without starting work
- **Validation**:
  - click behavior remains unchanged in existing tests
  - markup regression confirms passive buttons are inert and existing live action row still renders once

### Task 3.4: Add Selection Entity Styling
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Introduce `.lab-selection-overlay`, `.lab-selection-panel`, glow treatment, border emphasis, and passive action styles that match the current laboratory aesthetic.
- **Complexity**: 4/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - selected range gains a stronger but not noisy visual identity
  - panel remains legible over the waveform on desktop and mobile widths
  - style names stay scoped to the Laboratory timeline
- **Validation**:
  - manual visual smoke check

## Sprint 4: Regression Coverage And Safety Rails
**Goal**: Lock the selection entity behavior before any later “selection -> intent -> pipeline” work begins.

**Demo/Validation**:
- All new behavior is covered by targeted tests.
- Existing timeline/export/playhead suites remain green.

### Task 4.1: Add Selection Entity Store/Selector Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add coverage for:
  - selection creation from valid timeline range
  - reset on source/snapshot change
  - selector correctness
  - invalid selection suppression
- **Complexity**: 4/10
- **Dependencies**: Sprint 1, Sprint 2
- **Acceptance Criteria**:
  - tests prove `activeSelection` creation and clearing
  - tests prove `isSelectionValid` and duration semantics
  - tests prove selection identity stays stable while a valid selection is being refined
  - tests prove source reset clears both semantic selection and primitive timeline bridge
- **Validation**:
  - targeted test file run

### Task 4.2: Add Timeline Entity UI Markup Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add UI-facing assertions for the entity panel and passive buttons.
- **Complexity**: 3/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - panel content matches expected time and type text
  - passive affordances render without execution hooks
  - passive panel does not accidentally replace or duplicate the canonical live action row in a breaking way
- **Validation**:
  - targeted test file run

### Task 4.3: Add Hydration Reconstruction Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add coverage for the chosen backward-compat rule so persisted primitive ranges reconstruct semantic selection correctly on reload.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - valid persisted range hydrates into `activeSelection`
  - invalid persisted range hydrates without a semantic selection
- **Validation**:
  - targeted test file run

### Task 4.4: Parity And No-Regression Verification
- **Location**: validation only
- **Description**: Re-run the current installed/workspace parity-sensitive Laboratory suites after the new selection entity lands.
- **Complexity**: 2/10
- **Dependencies**: All previous tasks
- **Acceptance Criteria**:
  - installed room sync succeeds
  - targeted parity suites remain green
- **Validation**:
  - `npm run rooms:typecheck`
  - targeted ESLint
  - installed room sync
  - targeted Laboratory regression suite

## Testing Strategy
- Unit/regression focus for this phase:
  - reducer synthesis of `activeSelection`
  - selection identity stability across drag/refine updates
  - reset semantics on source boundaries
  - primitive bridge clearing on source boundaries
  - hydrate reconstruction from persisted primitive range
  - selector correctness
  - entity panel markup and passive affordances
- Re-run existing timeline behavior checks to ensure:
  - playhead sync still works
  - drag handles/body behavior remain unchanged
  - export affordances still read the same compatibility range

## Potential Risks & Gotchas
- **Primitive replacement risk**:
  Fully replacing `timelineStartMs` / `timelineEndMs` now would spill into export and analysis seams. Phase 1.5 should therefore be additive, not destructive.
- **Run-controller guardrail**:
  The requested “on drag/end finalize selection” behavior cannot be modeled perfectly without new controller signals. To honor the no-controller constraint, this phase should synthesize semantic selection from the existing timeline update action.
- **Selection identity churn**:
  Because `workspace-timeline-updated` fires continuously during drag and refine flows, reducer synthesis must preserve `id` / `createdAt` for the currently evolving valid selection.
- **Renderer ownership drift**:
  The actual selection UI lives in `lab-waveform-timeline.ts`, not `workspace-surface.ts`. The plan should avoid duplicating timeline entity markup across both files.
- **Stale selection carryover**:
  Source/project/hydration boundaries must clear the primitive range bridge alongside `activeSelection`, otherwise export/analyze seams can still act on stale intervals.
- **Passive button leakage**:
  Disabled buttons must not accidentally reuse live action hooks from the current toolbar/timeline controls, and they must not break the existing live export row already present in the timeline.
- **Hydration split-brain risk**:
  If `activeSelection` becomes the semantic UI source of truth, the phase must define whether hydrate reconstructs it from the primitive range or persists it directly. Leaving that ambiguous can produce a valid saved range with no rendered semantic selection after reload.
- **Future ROI compatibility**:
  `roi` should be model-ready but inert. Phase 1.5 should not imply ROI persistence or editing behavior yet.

## Rollback Plan
- Remove `activeSelection` from `LabWorkspaceUiState`
- Remove new selection selectors
- Revert the timeline UI from entity panel markup back to highlight-only rendering
- Remove selection-entity CSS classes
- Re-sync installed room package
- Re-run the current Laboratory timeline regression suite to confirm baseline restoration
