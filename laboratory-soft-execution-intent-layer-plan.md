# Plan: Laboratory Soft Execution Intent Layer

**Generated**: 2026-04-25
**Estimated Complexity**: Medium

## Overview
Add a passive execution-intent layer on top of the existing selection suggestion + preview flow. The system will let the user say “I want to do this” without running anything. The architecture should mirror the existing preview pattern: store only the selected suggestion id, resolve the full object through selectors, and clear stale intent aggressively when the suggestion context changes.

This phase must stay preview-only:
- no `lab-run-controller.ts` edits
- no analysis execution
- no asset/export creation
- no full execution plan persisted in store

## Assumptions
- `request_user_input` is unavailable in this session, so the plan assumes `queued` stays event-only for now and does not get its own store field.
- The canonical validation source remains `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`.
- The preview panel remains the only place where “accept intent” can originate.

## Prerequisites
- Existing suggestion flow is already live:
  - `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-root.ts`
- Existing preview flow is already selector-derived and id-based.
- Existing tests cover selection, suggestion preview, ROI lifecycle, and passive event emission.

## Sprint 1: Intent Identity Contract
**Goal**: Add the minimal execution-intent identity contract without changing runtime behavior.
**Demo/Validation**:
- Build compiles with new types/event shapes.
- No UI or execution behavior changes yet.

### Task 1.1: Extend model types for soft execution intent
- **Location**:
  - `rooms/laboratory/models/lab-types.ts`
- **Description**:
  - Add `activeExecutionIntentId: string | null` under top-level UI state.
  - Add event union entries:
    - `workspace-selection-suggestion-accepted`
    - `workspace-selection-suggestion-dismissed`
    - `workspace-selection-suggestion-queued`
    - `workspace-execution-intent-cleared`
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - New state/event types compile cleanly.
  - No new persisted/project/run-facing schema is introduced.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 1.2: Reserve execution-intent slot in initial UI state
- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
- **Description**:
  - Initialize `state.ui.activeExecutionIntentId` to `null`.
  - Add helper to clear execution intent, parallel to existing preview clear helpers.
- **Complexity**: 2/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Store initializes with null intent id.
  - No behavior changes until reducer cases are added.
- **Validation**:
  - Targeted store test or smoke assertion in regression suite

## Sprint 2: Validation + Selector Resolution
**Goal**: Make execution intent safe, derived, and stale-resistant.
**Demo/Validation**:
- Valid suggestion id resolves to current suggestion object.
- Invalid/stale id disappears automatically.

### Task 2.1: Add store-side validation helper
- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selection-suggestion-logic.ts`
- **Description**:
  - Add helper similar to preview validation:
    - accept only if active selection exists
    - accept only if `getActiveSuggestionPreview(state) !== null`
    - accept only if `state.ui.activeSuggestionPreviewId === clickedSuggestionId`
    - accept only if suggestion id is present in current `getSelectionSuggestionsForContext(...)`
  - Keep the suggestion logic file as the only truth source for id validity.
- **Complexity**: 5/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Store never accepts arbitrary ids.
  - Validation does not duplicate suggestion construction logic outside the shared suggestion seam.
- **Validation**:
  - Regression for valid accept / invalid reject

### Task 2.2: Add reducer cases for accept/dismiss/clear/queue
- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
- **Description**:
  - `workspace-selection-suggestion-accepted`:
    - validate id
    - set `activeExecutionIntentId`
  - `workspace-selection-suggestion-dismissed`:
    - clear if active id matches or clear unconditionally if simpler and safe
  - `workspace-execution-intent-cleared`:
    - clear id
  - `workspace-selection-suggestion-queued`:
    - keep event passive; no store write unless a minimal history hook is already required
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Accept stores only valid ids.
  - Dismiss/clear never trigger downstream execution.
  - Queue remains passive.
- **Validation**:
  - Store reducer tests

### Task 2.3: Add derived selectors
- **Location**:
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  - Add:
    - `getActiveExecutionIntentId(state)`
    - `getActiveExecutionIntent(state)`
  - Resolve active intent from current suggestion list only.
  - Return `null` when active id is stale, invalid, or selection context is gone.
- **Complexity**: 4/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Selector never returns orphaned suggestion objects.
  - Derived behavior mirrors suggestion preview pattern.
- **Validation**:
  - Selector regression tests for valid + stale cases

## Sprint 3: Lifecycle Fences
**Goal**: Ensure execution intent clears on every context mutation that invalidates user intent.
**Demo/Validation**:
- Changing selection, ROI, intent, source, or project removes stale execution intent.
- Suggestion drift also removes stale intent.

### Task 3.1: Clear execution intent on selection/ROI/intent mutations
- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
- **Description**:
  - Reuse the same lifecycle seams that already clear suggestion preview:
    - `workspace-timeline-updated`
    - `workspace-selection-intent-updated`
    - `selection-roi-updated`
    - `selection-roi-cleared`
    - `selection-inspection-mode-updated` if suggestion set can change there
- **Complexity**: 5/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Active intent clears whenever the current selection meaning changes.
- **Validation**:
  - Range/ROI/intent clear regressions

### Task 3.2: Clear execution intent on source/project/hydrate resets
- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
- **Description**:
  - Clear execution intent in the same reset seams as suggestion preview and inspection micro-state:
    - hydrate
    - source config/source changes
    - active project changes
    - topology resets if relevant
- **Complexity**: 4/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Execution intent remains UI-ephemeral.
  - No stale intent survives source/project transitions.
- **Validation**:
  - Hydrate/source/project reset tests

### Task 3.3: Auto-drop stale active intent when suggestion set changes
- **Location**:
  - `rooms/laboratory/runtime/lab-store.ts`
  - `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**:
  - Ensure active intent is cleared if the current suggestion list no longer contains the stored id.
  - Prefer using existing mutation seams rather than background reconciliation loops.
- **Complexity**: 4/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - `activeExecutionIntentId` cannot silently outlive its suggestion set.
- **Validation**:
  - Regression where suggestion list changes due to ROI or inspection mode shift

## Sprint 4: UI Accept/Dismiss/Queue Surface
**Goal**: Expose passive “I want to do this” affordances without making them feel like “Run now”.
**Demo/Validation**:
- Preview card shows Accept / Dismiss / Queue actions.
- Clicking them updates passive intent state only.
- Active intent is visible in selection panel.

### Task 4.1: Extend suggestion preview UI with intent affordances
- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
- **Description**:
  - Add passive controls inside the suggestion preview block:
    - primary: Accept
    - secondary: Dismiss
    - optional passive Queue
  - Keep copy framed as preference/intent, not execution.
- **Complexity**: 5/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Buttons render only when preview exists.
  - Tone reads as “I want this”, not “Run this”.
- **Validation**:
  - Render regression for preview affordances

### Task 4.2: Show active execution intent strip in selection panel
- **Location**:
  - `rooms/laboratory/ui/lab-waveform-timeline-render.ts`
  - `rooms/laboratory/ui/lab-waveform-timeline-types.ts` if model shape needs it
- **Description**:
  - Render a compact badge/strip when `getActiveExecutionIntent(...)` resolves:
    - e.g. `Selected action: Inspect region`
  - Keep it passive and dismissible.
- **Complexity**: 4/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Active intent is visible without implying execution.
  - If selector resolves `null`, strip disappears.
- **Validation**:
  - UI regression for active intent visibility

### Task 4.3: Add binder wiring in root seam
- **Location**:
  - `rooms/laboratory/ui/lab-root.ts`
  - New binder file if needed, likely:
    - `rooms/laboratory/ui/lab-selection-execution-intent-binder.ts`
- **Description**:
  - Decide binder ownership explicitly before implementation:
    - preferred: extend the existing suggestion binder with `data-lab-execution-intent-*` handling, or
    - fallback: add a separate execution-intent binder with strict attribute namespace and click precedence
  - Add delegated click handling for:
    - accept
    - dismiss
    - queue
  - Emit only passive workspace events.
  - Gate accept on the exact active preview id, matching the preview seam requirement.
- **Complexity**: 6/10
- **Dependencies**: Tasks 4.1, 4.2
- **Acceptance Criteria**:
  - No `run-controller` wiring is introduced.
  - Binder only emits workspace-level passive events.
  - Accept path is impossible when no preview is active or when the clicked suggestion is not the currently previewed suggestion.
- **Validation**:
  - Binder event-emission regression

## Sprint 5: Regression Closure + UX Polish
**Goal**: Lock the new intent layer behind tests and keep it aligned with the preview-only architecture.
**Demo/Validation**:
- Full regression suite for intent lifecycle passes.
- No new coupling to execution or persistence.

### Task 5.1: Expand truth-regression coverage
- **Location**:
  - `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**:
  - Add tests for:
    - valid suggestion accept
    - invalid suggestion reject
    - preview-gated accept using the exact active preview id
    - dismiss behavior
    - selection/ROI/intent/source/project clears
    - stale suggestion auto-drop
    - selector resolves current suggestion object correctly
    - queue emits passively
    - hydrate does not restore `activeExecutionIntentId`
    - persisted snapshots do not serialize `activeExecutionIntentId`
    - post-hydrate source/project resets still clear intent
- **Complexity**: 6/10
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - All acceptance criteria from the request are represented by tests.
- **Validation**:
  - Run targeted truth suite

### Task 5.2: Add UI-seam coverage outside truth suite
- **Location**:
  - `scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - optionally `scripts/tests/laboratory-source-ui-regressions.test.ts` if render-seam assertions fit better there
- **Description**:
  - Add at least one broader UI-seam regression proving:
    - preview affordances are present
    - active intent strip is rendered in the shell
    - no execution-facing wording leaked into markup
- **Complexity**: 4/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Coverage is not concentrated only in the truth-regression suite.
- **Validation**:
  - Run UI regression file(s)

### Task 5.3: Final verification sweep
- **Location**:
  - whole Laboratory room
- **Description**:
  - Run:
    - `npm run rooms:typecheck`
    - `npm run rooms:lint`
    - `npm run rooms:build`
    - installed room sync
    - broad Laboratory regression pack
  - Then perform sub-agent conformance review against this plan.
- **Complexity**: 3/10
- **Dependencies**: All previous tasks
- **Acceptance Criteria**:
  - All suites pass.
  - Sub-agent reports no guardrail violations.
- **Validation**:
  - Full command chain

## Testing Strategy
- Start with store/selector truth tests for id validation and lifecycle clears.
- Add binder tests for passive event emission and preview gating.
- Add at least one broader UI-seam test so the phase is not verified only through truth-regression coverage.
- Re-run the full Laboratory parity/regression pack after build + installed sync.

## Potential Risks & Gotchas
- **Preview gate drift**:
  - Risk: accept is allowed when “some preview is open” instead of when the clicked suggestion is the currently active preview.
  - Mitigation: validate against `activeSuggestionPreviewId`, `getActiveSuggestionPreview(state)`, and current suggestion membership together.
- **Validation drift**:
  - Risk: preview accept validation gets copied into store and selectors separately.
  - Mitigation: keep `lab-selection-suggestion-logic.ts` as the only suggestion truth source and add one store helper mirroring preview validation.
- **Preview/intent mismatch**:
  - Risk: a user could accept a stale suggestion after ROI or inspection mode changes.
  - Mitigation: require active preview + current suggestion membership, and clear on every selection-context mutation seam.
- **Queue scope creep**:
  - Risk: “queue” turns into a hidden execution queue.
  - Mitigation: keep queue event-only in this phase; no queue state, no scheduler, no side effects.
- **UI tone drift**:
  - Risk: Accept button reads like “Run”.
  - Mitigation: keep copy explicitly intent-oriented, e.g. “I want this” / “Keep this selected”, not “Execute”.
- **Persistence leak**:
  - Risk: new intent id accidentally enters persisted UI snapshot.
  - Mitigation: make persistence exclusion a first-class implementation task, add explicit hydrate/serialization regressions, and keep `readPersistableState()` unchanged unless a deliberate exclusion list is maintained.
- **Binder race with preview controls**:
  - Risk: a second delegated binder can race the existing suggestion binder and produce inconsistent preview/intent state.
  - Mitigation: prefer extending the existing suggestion binder; if a new binder is added, give it a dedicated attribute namespace and explicit click precedence rules.

## Rollback Plan
- Revert `activeExecutionIntentId` and new workspace events from `lab-types.ts`.
- Remove reducer cases and lifecycle clearing from `lab-store.ts`.
- Remove derived selectors from `lab-selectors.ts`.
- Remove preview affordance markup and active intent strip from `lab-waveform-timeline-render.ts`.
- Remove binder wiring from `lab-root.ts` and delete any new execution-intent binder file.
- Re-run Laboratory truth/UI regression suites to confirm the room returns to Phase 3.6 behavior.
