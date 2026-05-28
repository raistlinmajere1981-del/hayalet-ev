# Plan: Laboratory Phase 2.5 - Suggestion Preview Dry-Run Layer

**Generated**: 2026-04-24
**Estimated Complexity**: Medium

## Overview
Add a passive preview layer on top of Phase 2 suggestions so clicking a suggested action shows a dry-run plan describing what would happen, without starting any run, creating assets, or touching the execution pipeline.

This phase stays intentionally non-executing:
- no `lab-run-controller.ts` integration
- no `userActions` wiring
- no asset creation
- no pipeline trigger
- no analysis-intent mapping

Current codebase notes:
- suggestion generation already lives in `rooms/laboratory/runtime/lab-selectors.ts`
- the selection panel markup owner is `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- suggestion clicks already bypass `run-controller` through `lab-root.ts` + `lab-selection-suggestion-binder.ts`
- `workspace-timeline-updated` currently re-synthesizes the semantic selection via `syncWorkspaceSelectionWithRange()`
- that helper preserves selection identity across range changes, so preview clearing cannot rely only on `selection.id` changes
- `readPersistableState()` currently saves the whole `workspace` object, so preview state must be explicitly kept ephemeral or it will leak into persistence
- current Laboratory preview patterns already prefer ID-in-store plus selector-derived view data (`activeStepPreviewId`, `activePreviewArtifactId`), which is a better fit than storing fully rendered preview copy in reducer state

## Prerequisites
- Phase 1.5 semantic selection layer is merged
- Phase 1.6 selection intent layer is merged
- Phase 2 suggestion layer is merged
- validation baseline:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - installed room sync before parity-sensitive suites if source files change

## Assumptions
- Preview content is deterministic and generated only from the clicked suggestion plus the current semantic selection
- Preview is UI-only and ephemeral; it should not survive source/project switches, selection intent changes, or persisted workspace hydration
- Preview rendering belongs in the selection panel stack, not in `workspace-surface.ts`
- Clicking a suggestion may still emit the existing passive click event, but preview display must not depend on any execution path
- Preview dismissal should work for:
  - new selection / changed range
  - outside click
  - `Escape`
- Synthetic renderer fallback selection (`selection-preview`) must not generate or keep preview content on its own

## Sprint 1: Preview Contract And State Placement
**Goal**: Define the preview model and place state in a way that stays ephemeral and reducer-safe.

**Demo/Validation**:
- Types compile with a first-class preview model
- Store can hold or clear the active preview without affecting run state

### Task 1.1: Add Preview Model
- **Location**: `rooms/laboratory/models/lab-types.ts`
- **Description**: Add `LabSuggestionPreview` with `suggestionId`, `title`, `steps`, `expectedOutputs`, and optional `estimatedCost` as selector-owned derived UI data.
- **Complexity**: 2/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - `estimatedCost` is limited to `low | medium | high`
  - `steps` and `expectedOutputs` are explicit arrays for renderer reuse
  - type naming stays aligned with existing `LabActionSuggestion`
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Choose Ephemeral Store Location
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`, optionally `rooms/laboratory/ui/lab-root.ts`
- **Description**: Add the minimum canonical store state for preview tracking and document whether it lives in `ui.workspace` or higher-level `ui`.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - preview state can be set and cleared with no run side effects
  - preview does not accidentally become durable workspace data
  - chosen location keeps render access simple
  - store does not duplicate selector-owned `title/steps/expectedOutputs` content
- **Validation**:
  - state compiles
  - persistence behavior is explicitly fenced in plan/tests

Recommended decision:
- Prefer storing only `activeSuggestionPreviewId: string | null`
- Derive the full `LabSuggestionPreview` in selectors from the current active selection and currently valid suggestion list
- If preview tracking lives under `workspace`, scrub it from `readPersistableState()` and ignore it during hydrate
- If preview tracking lives outside `workspace`, centralize clear/reset behavior so existing workspace reset paths do not leave stale preview behind

### Task 1.3: Add Passive Preview Events
- **Location**: `rooms/laboratory/models/lab-types.ts`, `rooms/laboratory/runtime/lab-store.ts`
- **Description**: Add explicit passive events for preview set/clear, for example `workspace-selection-suggestion-preview-set` and `workspace-selection-suggestion-preview-cleared`.
- **Complexity**: 3/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - reducer can set preview from a suggestion id
  - reducer can clear preview idempotently
  - event names stay workspace-scoped and consistent with existing event vocabulary
- **Validation**:
  - event union compiles
  - reducer remains run-controller-free

## Sprint 2: Pure Preview Builder
**Goal**: Create a deterministic dry-run preview generator that describes intent without executing work.

**Demo/Validation**:
- Given a suggestion and selection, preview builder returns a UI-ready plan
- Unsupported or future action types fall back safely

### Task 2.1: Add Selector-Side Preview Builder
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Add `buildSuggestionPreview(suggestion, selection)` as a pure helper that returns a `LabSuggestionPreview`, then expose selector accessors that resolve the preview from `activeSuggestionPreviewId`.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `analyze-segment` returns analysis-oriented steps and outputs
  - `inspect-audio` returns audio-specific steps and outputs
  - `extract-clip` returns clip-oriented steps and outputs
  - other action types return a safe placeholder preview
  - helper does not read global state or mutate anything
  - derived preview resolves to `null` when the stored preview id no longer matches the current valid suggestion set
- **Validation**:
  - unit-style selector regressions

### Task 2.2: Close The Store/Selector Circularity Risk
- **Location**: plan note, `rooms/laboratory/ui/lab-selection-suggestion-binder.ts`, optionally a small runtime helper file if needed
- **Description**: Prevent `lab-store.ts` from importing selector logic directly just to build previews.
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - no `lab-store` -> `lab-selectors` circular dependency is introduced
  - preview payload is built in a seam that already has access to current state
  - future execution phases can still reuse the preview builder
- **Validation**:
  - typecheck remains green
  - import graph stays one-directional

Recommended decision:
- Keep `buildSuggestionPreview()` pure in selector/runtime land
- Expand the binder/root seam to receive `getState`
- On click, binder resolves the matching suggestion id from current state and emits a passive preview-set event
- Let selectors own the full `id -> suggestion -> preview` derivation so store state stays lean and canonical

## Sprint 3: Click To Preview Flow
**Goal**: Turn suggestion clicks into preview state updates while keeping the whole path passive.

**Demo/Validation**:
- Clicking a suggestion shows a preview
- No run starts, no assets are created, and existing selection intent behavior remains intact

### Task 3.1: Expand The Suggestion Binder Seam
- **Location**: `rooms/laboratory/ui/lab-selection-suggestion-binder.ts`, `rooms/laboratory/ui/lab-root.ts`
- **Description**: Extend the current binder to access current state, validate the clicked suggestion against the current selection/suggestion set, and emit preview-id events.
- **Complexity**: 5/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - binder still supports delegated document-level clicks
  - suggestion click does not route through `data-lab-action`
  - binder ignores invalid / stale suggestion ids
  - event ordering avoids accidental clear-on-click races
- **Validation**:
  - click-path regressions

### Task 3.2: Keep The Existing Passive Suggestion Click Event Compatible
- **Location**: `rooms/laboratory/ui/lab-selection-suggestion-binder.ts`, `rooms/laboratory/runtime/lab-store.ts`, tests
- **Description**: Decide whether to keep emitting `workspace-selection-suggestion-clicked` alongside preview-set for telemetry/history compatibility.
- **Complexity**: 3/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - either the legacy passive event stays emitted and documented, or it is intentionally superseded
  - no consumer breaks if both events exist in sequence
- **Validation**:
  - regression locks the chosen event contract

Recommended decision:
- Keep the existing passive click event for continuity
- Emit preview-set after a valid suggestion id is resolved so future layers can still observe click intent separately from preview state

## Sprint 4: Preview Panel Rendering
**Goal**: Render a non-modal preview panel beneath the existing suggestion section with a darker, “thinking layer” treatment.

**Demo/Validation**:
- Clicking a suggestion reveals a readable preview plan inside the selection panel stack
- Preview content matches the clicked suggestion

### Task 4.1: Extend The Timeline View Model
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `rooms/laboratory/ui/lab-waveform-timeline-types.ts`
- **Description**: Feed the derived active preview object into the waveform timeline model so the renderer stays declarative.
- **Complexity**: 3/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - timeline model exposes preview data separately from suggestion data
  - missing preview safely resolves to `null`
  - existing waveform, selection, bookmark, and dual-preview math stays untouched
- **Validation**:
  - model compilation/tests

### Task 4.2: Render Preview Block
- **Location**: `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**: Add a `[ Preview ]` block under suggested actions that renders title, step list, expected outputs, and optional cost.
- **Complexity**: 4/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - preview only renders for a real active semantic selection
  - preview title and lists come entirely from preview payload
  - renderer never fabricates preview content from `selection-preview`
  - empty outputs do not produce broken markup
- **Validation**:
  - markup regression assertions

### Task 4.3: Add Preview Styling
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Style preview as a darker inset layer under the suggestion pills while keeping it non-modal and within the existing selection accent system.
- **Complexity**: 3/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - preview feels visually deeper than suggestion pills
  - intent accent color still harmonizes with preview chrome
  - preview remains legible on mobile-width selection panels
- **Validation**:
  - manual visual smoke check

## Sprint 5: Dismissal And Safety Rules
**Goal**: Ensure preview appears and disappears predictably without leaking stale state across timeline interactions.

**Demo/Validation**:
- Preview closes on outside click, `Escape`, and selection changes
- Source/project resets never leave stale preview behind

### Task 5.1: Clear Preview On Selection Mutation
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, optionally `rooms/laboratory/runtime/lab-workspace-selection.ts`
- **Description**: Clear preview when timeline range changes, selection becomes invalid, or a new source/project reset clears workspace selection.
- **Complexity**: 5/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `workspace-timeline-updated` clears preview when range materially changes
  - `workspace-selection-intent-updated` clears or revalidates preview when current suggestions change
  - source/project reset paths clear preview together with selection
  - hydrate does not restore stale preview
- **Validation**:
  - reducer regressions for range change and source reset

Important nuance:
- Because `syncWorkspaceSelectionWithRange()` preserves selection `id` across range edits, preview-clear logic must compare range/nullability, not only identity

### Task 5.2: Outside Click And Escape Dismissal
- **Location**: `rooms/laboratory/ui/lab-selection-suggestion-binder.ts` or a focused preview binder helper, `rooms/laboratory/ui/lab-root.ts`
- **Description**: Add passive dismissal logic for outside clicks and `Escape` without turning preview into a modal.
- **Complexity**: 5/10
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - clicks inside suggestion pills or preview panel do not instantly dismiss the preview
  - clicks outside the selection panel / preview region clear the preview
  - `Escape` clears preview when one is active
  - listener cleanup remains safe across rerenders
  - document-level listeners can coexist without test harness blind spots
- **Validation**:
  - delegated click + keydown regressions

Recommended implementation shape:
- Use data attributes for preview root to make outside-click fencing explicit
- Keep dismissal in binder/root space rather than `run-controller`
- Guard against same-tick click races where suggestion click both opens and closes preview

## Sprint 6: Regression Coverage And Parity
**Goal**: Protect the dry-run preview layer from regressions before future execution phases build on it.

**Demo/Validation**:
- Targeted truth regressions cover preview generation, display, and clearing
- Installed/source parity stays clean after source edits

### Task 6.1: Add Preview Regressions
- **Location**: `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Add tests for:
  - preview builder output per action type
  - click -> preview-set flow
  - preview rendering
  - clear on selection change
  - clear or revalidate on selection intent change
  - clear on source/project reset
  - outside click dismissal
  - `Escape` dismissal
  - no preview when there is no real active selection
  - hydrate-ignore / persistence-scrub behavior for preview tracking
  - integration race coverage for suggestion click + outside dismiss while controller/root listeners coexist
- **Complexity**: 6/10
- **Dependencies**: Sprints 2-5
- **Acceptance Criteria**:
  - preview state and markup are both covered
  - regressions prove no run execution side effect
  - preview and suggestion layers can coexist without event collisions
  - fake document/test harness supports multiple listeners per event type where preview dismissal relies on stacked document listeners
- **Validation**:
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`

### Task 6.2: Full Validation And Installed Sync
- **Location**: repository root workflow
- **Description**: Run type/lint/test validation and refresh installed room outputs if source room files changed.
- **Complexity**: 3/10
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - typecheck passes
  - lint passes or only pre-existing unrelated failures remain
  - installed Laboratory copy is refreshed before parity suites
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:lint`
  - `npm run rooms:test:file -- scripts/tests/laboratory-runtime-truth-regressions.test.ts`
  - broader Laboratory parity/regression suite if source/install drift is possible

## Testing Strategy
- Start with pure builder tests so preview content rules are locked before UI wiring
- Add binder-level tests for click, outside-click, and `Escape` behavior
- Add renderer assertions for preview presence/absence and content shape
- Re-run the wider Laboratory suite after installed copy sync because this room uses parity-sensitive regression coverage

## Potential Risks & Gotchas
- **Persistence leak**: if preview is stored under `workspace` and saved wholesale, stale dry-run plans could rehydrate on reload
  - **Mitigation**: keep preview outside persisted workspace or explicitly scrub it from persistence/hydrate
- **Reset seam split**: if preview state sits outside `workspace`, existing `clearWorkspaceSelection()` callers will not clear it automatically
  - **Mitigation**: choose one canonical location and centralize reset behavior for source/project/timeline clears
- **Circular dependency**: putting builder logic in selectors but deriving preview inside store can create `store <-> selectors` coupling
  - **Mitigation**: store only preview id and let selectors derive the preview object
- **Selection identity trap**: current selection helper preserves `id` during range edits
  - **Mitigation**: clear preview on range change, not just `id` change
- **Intent drift**: current suggestions are keyed by selection intent, so a preview can become stale after intent switching
  - **Mitigation**: clear or revalidate preview on every `workspace-selection-intent-updated`
- **Synthetic selection leak**: renderer fallback selection can make UI appear valid without real semantic selection
  - **Mitigation**: only render preview when `activeSelection` is real and valid
- **Dismiss race**: document-level outside click handling can close preview immediately after opening it
  - **Mitigation**: fence clicks inside preview/suggestion panel and order preview-set vs clear logic carefully
- **Harness blind spot**: current fake document utilities may hide multi-listener races if they store only one listener per event type
  - **Mitigation**: upgrade the test harness before relying on stacked document-level click/keydown coverage
- **Overloaded binder**: stuffing suggestion open + outside dismiss + `Escape` into one helper may get noisy
  - **Mitigation**: split into focused helpers if the binder grows beyond a small delegated layer

## Rollback Plan
- Remove preview model and passive preview events
- Revert binder changes to Phase 2 suggestion-click-only behavior
- Drop preview block from the timeline renderer and CSS
- Keep existing suggestion layer intact so Phase 2 behavior remains as the fallback end state
