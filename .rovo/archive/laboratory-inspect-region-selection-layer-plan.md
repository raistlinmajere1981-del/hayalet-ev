# Plan: Laboratory Phase 3.5 - Inspect & Region Selection Layer

**Generated**: 2026-04-25
**Estimated Complexity**: High

## Overview
Extend Laboratory's passive selection system so an active selection can carry both a time range and an optional preview-space region of interest, while adding a lightweight inspection mode for visual guidance. The phase must stay preview-only: no `lab-run-controller.ts` edits, no analysis execution, no asset creation, no AI calls, and no suggestion-preview execution coupling.

The safest implementation path is to build on seams that already exist instead of creating parallel concepts:
- `LabSelection` already has an optional `roi` payload.
- `workspace-roi-overlay.ts` already owns the preview overlay shell.
- `lab-root.ts` already hosts passive binder registration patterns.
- `getSelectionSuggestions(state)` and `buildInterpretationItems(...)` are already selector-derived.

This plan therefore treats the requested "region" as the existing `activeSelection.roi` semantic region, rather than adding a second `region` field that would drift from the current model.

## Assumptions
- `activeSelection.roi` becomes the canonical semantic region payload for this phase; no parallel `activeSelection.region` field is introduced.
- `activeSelection.roi` should use normalized preview coordinates (`0..1` ratios) so it survives resize/rerender without pixel drift.
- ROI creation should enforce a minimum visible draw size equivalent to `8px x 8px` in preview space, so accidental clicks do not produce semantic regions.
- The `8px x 8px` rule is an authoring-time invariant for interactive draws, not a heuristic migration rule for old persisted data.
- Persisted `activeSelection.roi` values are only considered valid if they already satisfy the normalized ratio-space contract; legacy pixel-like ROI values will be dropped rather than guessed.
- Existing `roiRegions` remain as the legacy multi-ROI overlay surface and are not deleted in this phase.
- Region-aware suggestions and interpretation react only to `activeSelection.roi`, not to legacy `roiRegions`.
- Inspection mode is UI-only and must not be persisted inside the existing `workspace` payload, because `workspace` is currently hydrated/saved as a block in `lab-root.ts`.
- Dual preview keeps ROI drawing fenced to the visual pane only; the audio pane remains non-interactive.

## Prerequisites
- Existing selection/suggestion/interpretation phases are present and passing.
- Existing preview overlay owner remains:
  - `rooms/laboratory/ui/workspace-surface.ts`
  - `rooms/laboratory/ui/workspace-roi-overlay.ts`
- Existing selection synthesis seam remains:
  - `rooms/laboratory/runtime/lab-workspace-selection.ts`
- Existing truth suite remains the primary regression surface:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`

## Sprint 1: Canonical Region Contract
**Goal**: Formalize how semantic selection region data should be stored and reset without adding duplicate state concepts.
**Demo/Validation**:
- `activeSelection` can carry a normalized ROI payload.
- Invalid or stale ROI data is dropped during normalization/hydration.
- No new run/analysis state is introduced.

### Task 1.1: Standardize Selection ROI Contract
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Keep `LabSelection.roi` as the single semantic region field and document it as the canonical preview-space ROI contract for this phase. If helpful, add a small shared type alias for the normalized ROI payload to clarify intent and avoid ad-hoc shape reuse.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `LabSelection` remains the only semantic selection entity.
  - No second `region` field is introduced.
  - The ROI contract is explicit enough to distinguish it from pixel-space `LabROIRegion`.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Add UI-Scoped Inspection Mode State
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add `inspectionMode: "none" | "visual" | "audio" | "motion"` as UI-only state outside the persisted `workspace` object, so it does not leak into hydrate/save flows.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Inspection mode lives in `LabStoreUiState`, not in `LabWorkspaceUiState`.
  - No run state, snapshot, or persisted workspace payload changes are required.
- **Validation**:
  - Source review
  - `npm run rooms:typecheck`

### Task 1.3: Add Region Normalization Helpers
- **Location**: `rooms/laboratory/runtime/lab-workspace-selection.ts`
- **Description**: Add helpers to normalize `activeSelection.roi` as ratio-space data and reject invalid rectangles (`width <= 0`, `height <= 0`, out-of-range values, NaN). Keep this logic close to the existing selection range normalization seam and explicitly define the compatibility boundary:
  - interactive ROI creation must pass the `8px x 8px` authoring guard before ratio conversion is stored
  - persisted ROI hydration only accepts already-normalized ratio-space values
  - legacy pixel-like persisted ROI is dropped rather than implicitly converted
- **Complexity**: 5/10
- **Dependencies**: Tasks 1.1-1.2
- **Acceptance Criteria**:
  - Invalid ROI payloads hydrate as absent.
  - Normalized ROI values are clamped into a stable range.
  - The plan leaves no ambiguity about authoring-time guard vs persisted invariant.
  - Selection normalization remains deterministic.
- **Validation**:
  - Targeted truth tests for normalization

### Task 1.4: Reserve a Dedicated Semantic ROI Namespace
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/ui/*`
- **Description**: Define dedicated event, DOM, and selector naming for semantic selection ROI so it does not collide with legacy controller-owned `workspace-roi-*` surfaces. Use `selection-roi-*` style naming for new passive preview-only behavior.
- **Complexity**: 4/10
- **Dependencies**: Tasks 1.1-1.3
- **Acceptance Criteria**:
  - New semantic ROI events do not reuse legacy `workspace-roi-*` names.
  - The plan clearly separates preview-only selection ROI behavior from controller-owned ROI annotations.
- **Validation**:
  - Source review
  - `npm run rooms:typecheck`

## Sprint 2: Selection Lifecycle and Reset Rules
**Goal**: Make region data obey the same semantic lifecycle as time selection, while keeping inspection mode preview-only.
**Demo/Validation**:
- Source/project changes clear semantic region.
- Timeline changes clear region while preserving the current selection entity rules.
- Invalid selections cannot carry stale region data.

### Task 2.1: Clear ROI on Timeline Mutations
- **Location**: `rooms/laboratory/runtime/lab-workspace-selection.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Update selection synthesis so a changed `[startMs, endMs]` range clears `activeSelection.roi` instead of preserving it from the previous selection. Preserve the current identity-preserving behavior for selection id/intent where appropriate, but explicitly drop ROI on range changes.
- **Complexity**: 6/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Moving or resizing the timeline selection clears semantic ROI.
  - Repeated no-op timeline updates do not churn selection state.
  - Invalid time ranges still produce `activeSelection = null`.
- **Validation**:
  - Truth tests for unchanged range vs changed range behavior

### Task 2.2: Clear ROI on Source/Project Reset Paths
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-workspace-selection.ts`
- **Description**: Verify all existing source/project reset paths clear `activeSelection`, and ensure ROI is therefore removed with it. If any hydrate or reset seam can repopulate a stale ROI, fence it explicitly.
- **Complexity**: 4/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Source change clears the semantic region.
  - Project change clears the semantic region.
  - Hydration never resurrects invalid ROI payloads.
- **Validation**:
  - Truth tests covering hydrate/source/project transitions

### Task 2.3: Add Store Events for Region + Inspection Mode
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Introduce store events for setting/clearing semantic selection ROI and updating inspection mode, without touching `lab-run-controller.ts`. Keep reducer logic pure and UI-scoped, and use the dedicated semantic ROI namespace reserved in Sprint 1 instead of reusing legacy `workspace-roi-*` names.
- **Complexity**: 5/10
- **Dependencies**: Tasks 1.4, 2.1-2.2
- **Acceptance Criteria**:
  - Region update events only affect `activeSelection`.
  - Inspection mode updates remain UI-only.
  - No run-controller event contract changes are required.
- **Validation**:
  - `npm run rooms:typecheck`
  - Reducer truth tests

## Sprint 3: Preview ROI Interaction Layer
**Goal**: Let the user draw and view a semantic ROI on the preview surface without interfering with media controls or legacy ROI controls.
**Demo/Validation**:
- User can drag to create a preview ROI on video/image preview.
- ROI rectangle renders on the preview surface.
- Dual preview only allows drawing on the visual pane.

### Task 3.1: Split Semantic ROI Overlay From Legacy ROI Regions
- **Location**: `rooms/laboratory/ui/workspace-roi-overlay.ts`, `rooms/laboratory/ui/workspace-surface.ts`
- **Description**: Extend the overlay renderer so it can display the current semantic selection ROI distinctly from legacy `roiRegions`. The semantic ROI should render as a passive selection rectangle, while existing ROI region controls continue to render only for the legacy collection.
- **Complexity**: 6/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `activeSelection.roi` is visible even when `roiRegions` is empty.
  - Legacy ROI controls remain intact.
  - The overlay clearly differentiates "selection region" from legacy saved regions.
- **Validation**:
  - Render assertions in UI/truth tests

### Task 3.2: Add ROI Draw Binder
- **Location**: `rooms/laboratory/ui/lab-root.ts`, `rooms/laboratory/ui/` (new ROI binder module)
- **Description**: Add a new passive binder, registered from `lab-root.ts`, that handles pointer drag on the preview ROI overlay and emits selection ROI events. The binder must:
  - resolve the active visual stage bounds
  - ignore clicks on media controls and legacy ROI buttons
  - emit only the new semantic `selection-roi-*` events
  - normalize pixel coordinates into ratio-space ROI data
  - support clear/cancel behavior for tiny accidental drags
  - reject new ROI draws smaller than `8px` wide or `8px` tall before semantic state is written
- **Complexity**: 8/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Dragging empty preview space creates or updates `activeSelection.roi`.
  - Tiny drags and near-clicks do not create unusable rectangles.
  - Minimum ROI size is enforced at `8px x 8px` in display space.
  - Existing controls remain clickable.
  - No `lab-run-controller.ts` changes are needed.
- **Validation**:
  - Binder-focused truth tests
  - Manual preview interaction smoke test

### Task 3.3: Fence ROI Drawing by Source Type and Preview Mode
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, new ROI binder module, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Only enable ROI drawing when the effective preview has a visual plane (`image` / `video`). In dual preview mode, the binder must attach to the video pane only and ignore the audio pane.
- **Complexity**: 5/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Audio-only previews do not expose draggable ROI behavior.
  - Dual preview keeps ROI interaction on the visual pane.
  - The audio pane remains non-interactive for region selection.
- **Validation**:
  - Truth tests for single preview vs dual preview markup/binder behavior

### Task 3.4: Add Focus Mask Hit-Testing Rules
- **Location**: `rooms/laboratory/ui/workspace-roi-overlay.ts`, `rooms/laboratory/ui/workspace-surface.ts`, new ROI binder module, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Define the outside-area fade/scrim as part of the interaction model, not only styling. The focus mask must have explicit markup and pointer behavior so it never blocks native media controls, legacy ROI buttons, or semantic ROI drag handles.
- **Complexity**: 6/10
- **Dependencies**: Tasks 3.1-3.3
- **Acceptance Criteria**:
  - The outside fade is rendered through explicit semantic markup/class hooks.
  - The fade layer does not steal pointer events from native controls or ROI controls.
  - Focus treatment remains preview-only and non-modal.
- **Validation**:
  - Render assertions for focus-mask markup/class hooks
  - Binder smoke coverage for control hit-testing

## Sprint 4: Region-Aware Suggestions and Interpretation
**Goal**: Make passive guidance react to the presence and shape of a semantic region without storing derived results.
**Demo/Validation**:
- Suggestions differ when ROI is present.
- Interpretation items react to ROI size/aspect context.
- All outputs remain derived-only.

### Task 4.1: Upgrade Suggestion Engine for Region Context
- **Location**: `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Extend suggestion generation to accept selection ROI presence and optionally inspection mode/source kind context. Boost visual or motion-oriented suggestions when a valid ROI exists, but keep output deterministic and passive.
- **Complexity**: 6/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Suggestions differ with and without ROI on compatible media.
  - Audio-only sources do not receive visual ROI-based boosts.
  - The selector remains derived-only.
- **Validation**:
  - Truth tests for suggestion output deltas

### Task 4.2: Extend Interpretation Engine Input
- **Location**: `rooms/laboratory/runtime/lab-interpretation-engine.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Pass ROI size and aspect information into the deterministic interpretation engine. Add rules for:
  - very small region -> limited context
  - very large region -> consider narrowing focus
  - region + high playback rate -> motion ambiguity hint
- **Complexity**: 6/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - No async logic, AI calls, or randomness are introduced.
  - ROI rules only fire when a valid semantic region exists.
  - Existing audio-only interpretation behavior remains intact.
- **Validation**:
  - Targeted truth tests for ROI rule coverage

### Task 4.3: Keep Derived Boundaries Intact
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Verify that suggestions and interpretation stay selector-derived. Do not store derived ROI guidance in state.
- **Complexity**: 2/10
- **Dependencies**: Tasks 4.1-4.2
- **Acceptance Criteria**:
  - No new persisted suggestion/interpretation fields appear.
  - Region-aware guidance is computed on demand.
- **Validation**:
  - Diff review
  - `npm run rooms:typecheck`

## Sprint 5: Selection Panel and Preview UX
**Goal**: Surface region status and inspection mode in the existing passive selection UI without introducing execution actions.
**Demo/Validation**:
- Selection panel shows when a region is active.
- Inspection mode can be toggled passively.
- The system still reads as preview-only guidance.

### Task 5.1: Add Region Status to Selection Panel
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**: Extend the selection panel to display whether a semantic region is active and, if useful, compact metadata such as normalized size or a simple "Region active" badge.
- **Complexity**: 4/10
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Region presence is visible in the selection panel.
  - No new execution buttons are added.
  - Existing suggestion/preview/interpretation blocks continue to work.
- **Validation**:
  - Render assertions in truth tests

### Task 5.2: Add Passive Inspection Mode Toggle
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`, `rooms/laboratory/ui/lab-root.ts`, new ROI/inspection binder module
- **Description**: Add a passive inspection mode toggle (`none`, `visual`, `audio`, `motion`) near the selection panel, wired through UI-only store events. Use the same binder-style pattern as other selection controls rather than adding controller logic.
- **Complexity**: 5/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Inspection mode updates UI state only.
  - No persistence, execution, or analysis side effects occur.
  - The toggle remains available even when no ROI is active, if that improves guidance discoverability.
- **Validation**:
  - Reducer + render tests

### Task 5.3: Style the Selection ROI and Inspection UI
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add styling for the semantic ROI rectangle, region-active panel badge, and passive inspection mode controls. Keep the look subtle and consistent with the existing Laboratory overlay language. The ROI overlay should also dim the outside area with a light fade/scrim while leaving the selected area visually emphasized, so the preview communicates "focus is here" without looking modal.
- **Complexity**: 4/10
- **Dependencies**: Tasks 3.4, 5.1-5.2
- **Acceptance Criteria**:
  - The semantic ROI is visually distinct from legacy ROI regions.
  - The area outside the ROI is lightly faded while the ROI interior remains the visual focus.
  - Inspection controls do not dominate the panel.
  - Overlay remains readable over dark and bright media.
- **Validation**:
  - Visual review
  - UI markup/class assertions if needed

## Sprint 6: Regression Closure and Safety Sweep
**Goal**: Prove the new region layer stays passive, derived where appropriate, and compatible with current preview architecture.
**Demo/Validation**:
- Region lifecycle is stable.
- UI renders ROI overlay.
- Suggestions and interpretation respond to ROI without side effects.

### Task 6.1: Add Region Lifecycle Truth Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests for:
  - ROI normalization
  - invalid ROI rejection
  - minimum-size guard (`8px x 8px`) rejecting near-click rectangles at the binder/normalization seam
  - legacy pixel-like persisted ROI being dropped on hydrate
  - ROI clearing on timeline/source/project changes
  - no stale ROI when selection becomes invalid
- **Complexity**: 6/10
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - Region state behaves predictably across resets and invalidation.
  - Hydrate paths do not revive malformed ROI payloads.
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 6.2: Add Suggestion + Interpretation ROI Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Cover suggestion differences with and without ROI, inspection-mode-aware fences if implemented, and interpretation rules for small/large region plus high-rate motion ambiguity.
- **Complexity**: 5/10
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Suggestion output changes only in intended media contexts.
  - Interpretation output remains deterministic across repeated runs.
- **Validation**:
  - Targeted truth suite

### Task 6.3: Add ROI Overlay Render Tests
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`, `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- **Description**: Add render-level coverage for semantic ROI overlay presence, panel region state, dual-preview fencing, and the faded outside-focus treatment. If binder behavior is hard to fully exercise in the truth suite, add source/markup-level assertions plus focused reducer tests.
- **Complexity**: 5/10
- **Dependencies**: Sprints 3-5
- **Acceptance Criteria**:
  - ROI overlay markup appears when expected.
  - Focus mask/fade markup or class hooks appear when a semantic ROI exists.
  - Audio-only previews do not expose interactive ROI affordances.
  - Dual preview only renders/targets the visual pane for ROI drawing.
- **Validation**:
  - Targeted truth/UI regression suites

### Task 6.4: Final Safety Sweep
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/ui/*`
- **Description**: Verify this phase did not add `lab-run-controller.ts` coupling, execution paths, analysis hooks, asset creation, or persistence leaks for inspection mode.
- **Complexity**: 3/10
- **Dependencies**: Entire plan
- **Acceptance Criteria**:
  - No `lab-run-controller.ts` edits are required.
  - No analysis pipeline or asset pipeline surfaces change.
  - `getWorkspaceAnalysisInput(state)` continues to expose the existing analysis-facing `roiRegions` contract unchanged.
  - Inspection mode is not persisted.
  - `lab-run-controller.ts` gains no new semantic ROI cases for this phase.
- **Validation**:
  - Diff review
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`

### Task 6.5: Add Inspection Mode Persistence Round-Trip Test
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add an explicit save/hydrate regression proving that inspection mode is absent from persisted payloads and resets to default after reload, even while workspace state still round-trips normally.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Persisted payload omits inspection mode.
  - Hydrate restores normal workspace state but resets inspection mode to its default.
- **Validation**:
  - Targeted truth suite

## Testing Strategy
- Start with reducer and normalization truth tests before adding ROI UI behavior.
- Add suggestion and interpretation assertions only after the canonical ROI contract is stable.
- Minimum verification for the phase:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- If preview overlay markup or selector wiring grows beyond the targeted truth suite, escalate to:
  - `npm run rooms:test:file -- scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
- If dual preview or installed-copy drift appears, finish with the broader Laboratory parity/regression pack.

## Potential Risks & Gotchas
- **Schema drift between `roi` and `region`**: introducing a new `region` field would fork the semantic selection contract. Mitigation: keep `activeSelection.roi` as the canonical field for this phase.
- **Coordinate drift on resize**: pixel-space region data would not survive preview resize or dual-preview layout changes. Mitigation: store semantic ROI as normalized ratios and convert to pixels only in the renderer/binder boundary.
- **Persisted ROI compatibility ambiguity**: old persisted ROI may not already be normalized. Mitigation: explicitly define that hydrate accepts normalized ratio-space ROI only and drops legacy pixel-like ROI rather than guessing a conversion.
- **`roiRegions` vs `activeSelection.roi` ambiguity**: both can render on the same overlay. Mitigation: treat `activeSelection.roi` as the current semantic selection rectangle and keep `roiRegions` as legacy multi-region annotations with separate styling.
- **Semantic ROI namespace drift**: reusing `workspace-roi-*` names would couple this phase back to controller-owned ROI behavior. Mitigation: reserve a dedicated `selection-roi-*` namespace for events/DOM hooks/selectors and verify `lab-run-controller.ts` stays untouched.
- **Accidental click-as-ROI behavior**: without a minimum size guard, near-zero rectangles would create meaningless semantic regions and noisy interpretation. Mitigation: enforce `8px x 8px` minimum draw size before storing ROI.
- **Analysis-input contract drift**: swapping `getWorkspaceAnalysisInput(state)` from `roiRegions` to `activeSelection.roi` would silently change downstream behavior. Mitigation: keep analysis-facing ROI data unchanged in this phase and confine semantic region support to preview-only selectors/UI.
- **Inspection mode persistence leak**: adding inspection mode under `workspace` would persist automatically via `lab-root.ts`. Mitigation: keep it in top-level UI state and omit it from persistence.
- **ROI draw conflicts with media controls**: overlay drag handling can steal clicks from native video controls or legacy ROI buttons. Mitigation: binder must only start drawing from empty overlay space and ignore control/button targets.
- **Overly heavy focus mask**: a strong dimming layer could make the preview feel modal or hide details near the ROI edge. Mitigation: keep the outside fade subtle and treat the ROI interior emphasis as a lightweight focus cue, not a blackout.
- **Timeline changes preserving stale ROI**: current selection synthesis preserves prior ROI. Mitigation: explicitly clear ROI when `[startMs, endMs]` changes.
- **Dual preview ambiguity**: ROI interaction on the audio pane would be meaningless. Mitigation: bind only to the visual pane and fence ROI features by source kind.
- **No run-controller edits**: existing ROI system already has controller-driven actions for export/toggle/remove. Mitigation: add a new UI binder seam for semantic ROI drawing and keep this phase independent from controller-owned ROI actions.

## Rollback Plan
- Remove the new ROI/inspection binders and stop registering them from `lab-root.ts`.
- Revert `activeSelection.roi` normalization/reset behavior back to current time-only selection semantics.
- Remove region-aware suggestion and interpretation rules, returning to time-only derived guidance.
- Remove inspection mode UI and styling while preserving existing selection panel behavior.
- Keep legacy `roiRegions` rendering intact so current ROI surfaces continue to function even if the semantic selection-region layer is rolled back.
