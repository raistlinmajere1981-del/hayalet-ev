# Plan: Forge Room Aggressive UI Revision

**Generated**: 2026-04-17
**Estimated Complexity**: High

## Overview

Rebuild Forge Room around a hard-guided left-side stage tower instead of
the current vertically growing control stack. The new primary surface is
a viewport-height left panel with one open stage at a time, accordion
headers for progress visibility, and explicit `Previous` / `Next`
navigation. Forge keeps its room identity as an
`orchestration-workbench`, so the center and right surfaces remain live
support surfaces instead of being deleted outright, but they must become
secondary to the staged left workflow.

This pass removes the current `BASLANGIC HATTI` block, moves all
operator-profile CRUD behind the top-bar button, and turns the pre-draft
flow into a stage sequence:

1. Session Management
2. Goal
3. Operator Context + Mode/Risk
4. Run Settings + Preflight
5. Process Tracking
6. Draft

Downstream response, synthesis, and export behavior stays intact, but
its visual emphasis will be retuned around the new staged shell.

## Resolved Room Contract

- `room`: `forge-room`
- `feature`: `forge-workbench`
- `archetype`: `orchestration-workbench`
- `modifier`: guided stage-tower behavior for the left control surface
- `primary_action`: progress the run from session setup to draft
- `active_stage_or_turn`: pre-draft setup and launch
- `primary_surface`: viewport-height left stage tower
- `supporting_surfaces`: top status bar, center response lane, right synthesis/export lane
- `panel_policy`: only one left-stage body visible at a time
- `allowed_exceptions`: keep center/right live because Forge coordinates
  real workflow artifacts, not passive summaries

## Assumptions

- The "tek panel" request applies to the left guided workflow panel; the
  center and right lanes remain visible only as justified support
  surfaces.
- `Operator Profile` remains accessible only from the top bar and the
  main left panel must not add a second visible CRUD entry point.
- `mode` and `risk tolerance` stay session-local, not persistent profile
  fields.
- The aggressive pass is a cutover, not a temporary dual-layout mode.
- Preview approval is required before implementation because this is a
  real structure and hierarchy change.

## Prerequisites

- Source of truth under `rooms/forge-room/**`
- Existing Forge regression suites under `scripts/tests/forge-room-*.test.ts`
- Validation commands:
  - `npm run typecheck`
  - targeted `node --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - targeted `node --test scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
  - targeted `node --test scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - targeted `node --test scripts/tests/forge-room-session-storage-regressions.test.ts`
  - targeted `node --test scripts/tests/forge-room-preflight-v2-regressions.test.ts`

## Sprint 1: Freeze The UX Contract
**Goal**: Lock the left-stage-tower direction before code churn starts.
**Demo/Validation**:
- Preview brief clearly states stage order, supporting surfaces, and why
  center/right panels still exist.
- UI approval is collected before any implementation sprint begins.

### Task 1.1: Write The Stage Inventory And Gate Matrix
- **Location**: `forge-room-aggressive-ui-revision-plan.md`, implementation notes for follow-up work
- **Description**: Translate current Forge flow and user request into a
  single stage matrix covering `stageId`, `completeWhen`,
  `canEnterWhen`, `nextAction`, and `lockedReason`. Include post-draft
  guidance so the runtime can bridge from `Draft` into responses and
  synthesis without losing the new staged mental model.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Every pre-draft stage has an explicit completion rule.
  - `Next` is only enabled when the current stage satisfies its gate.
  - The plan states how draft completion hands off to later workflow
    surfaces.
- **Validation**:
  - Manual design review against the current Forge flow contract

### Task 1.2: Produce A Preview Set Plan
- **Location**: design workflow only; no source edit required yet
- **Description**: Build the preview brief required by
  `hayalet-ev-ui`. The preview set should cover:
  `setup-state`, `preflight-ready-state`, and `draft-active-state`,
  because the new left-stage tower materially changes hierarchy and
  attention in all three moments.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Preview count is justified by state coverage, not style variation.
  - The plan explains which states do not need dedicated previews.
- **Validation**:
  - Review against `preview/preview-plan.md` and `preview/review-checklist.md`

### Task 1.3: Capture Explicit UI Approval
- **Location**: approval thread / implementation kickoff
- **Description**: Freeze the accepted layout direction before code.
  Approval must confirm:
  left full-height stage tower, accordion stage headers, top-bar-only
  profile access, and the removal of `BASLANGIC HATTI`.
- **Complexity**: 2
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - UI direction is accepted independently from code approval.
- **Validation**:
  - Explicit user confirmation

## Sprint 2: Build The Stage Tower Shell
**Goal**: Replace the current left stack with a viewport-height staged shell.
**Demo/Validation**:
- The left column fills the viewport under the status bar.
- Only one stage body is open at a time.
- The stage shell can show completion, locked, active, and ready states.

### Task 2.1: Add A Dedicated Stage Navigation Model
- **Location**: `rooms/forge-room/shared/ui/state.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Introduce a UI-level stage model separate from the
  current `goal | responses | synthesis` surface model. Add stage ids,
  order, navigation helpers, and completion selectors so the runtime can
  derive `activeStage`, `completedStages`, `nextEnabled`, and
  `previousEnabled`.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Runtime can derive stage order without reading DOM state.
  - Stage navigation does not mutate workflow data by itself.
  - The new model can coexist with existing downstream flow states.
- **Validation**:
  - `npm run typecheck`
  - targeted runtime selector smoke test

### Task 2.2: Replace The Left Column Shell With A Viewport-Height Stage Tower
- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Rework the workbench shell so the left column becomes
  a sticky or viewport-bound stage tower with internal scrolling,
  predictable height, and explicit stage chrome. Keep the center and
  right lanes alive but visually demote them.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Left stage tower does not exceed viewport height on common desktop sizes.
  - Internal scroll stays inside the tower instead of pushing page height.
  - Center/right lanes remain visible as support surfaces.
- **Validation**:
  - UI smoke check at `1600x900`, `1366x768`, and `1280x800`

### Task 2.3: Create Reusable Stage-Shell Components
- **Location**: `rooms/forge-room/ui/panels/panel-shell.ts`, new `rooms/forge-room/ui/panels/stage-shell.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Add reusable rendering helpers for accordion stage
  headers, step status chips, navigation footer, and empty/locked state
  messaging so every stage reads as one family.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Each stage shares the same structural primitives.
  - Header, body, and footer states are visually consistent.
  - `Previous` / `Next` buttons are part of the shared shell.
- **Validation**:
  - UI smoke check

## Sprint 3: Rebuild Pre-Draft Setup Stages
**Goal**: Move all pre-draft setup into sequential, single-open left-panel stages.
**Demo/Validation**:
- Users can move from session creation to draft readiness without the old
  stacked control blocks.
- `Next` only unlocks after each stage is genuinely complete.

### Task 3.1: Convert Session Management Into Stage 1
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Rebuild session controls as the first stage with
  `New session`, a saved-session dropdown, `Load selected`, `Delete
  selected`, and optional `Load latest`. Replace the current short card
  list with a more compact operational picker that works inside the
  viewport-height shell.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Session creation and loading happen from the stage, not a stacked list.
  - Saved session selection is visible at a glance.
  - Delete targets the selected session safely.
- **Validation**:
  - UI smoke test
  - `scripts/tests/forge-room-session-storage-regressions.test.ts`

### Task 3.2: Convert Goal Editing Into Stage 2
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Turn the current goal editor into its own stage with
  compact summary-first presentation and expandable details inside the
  stage body. Remove dependency on the old `BASLANGIC HATTI` explainer.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Goal stage can be completed without scrolling the whole page.
  - Goal completion state is obvious from the accordion header.
  - Duplicate helper copy is reduced.
- **Validation**:
  - UI smoke test

### Task 3.3: Convert Operator Context Into Stage 3
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Rebuild the current session-context area as a dense
  selection stage for skills, equipment, and compact session-local
  `mode` / `risk tolerance` controls. Remove the inline
  `Manage/Open Operator Profile` entry point so the top bar remains the
  only visible CRUD launcher.
- **Complexity**: 8
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Operator context is selection-only.
  - `mode` and `risk` are visible in this stage without reading as
    persistent profile data.
  - No second visible profile entry point remains in the left panel.
  - Dense chip groups fit inside an internal stage scroll region.
- **Validation**:
  - UI smoke test
  - check against room/feature override rules

### Task 3.4: Convert Run Settings + Preflight Into Stage 4
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Rebuild the remaining run-local controls around
  temporary conditions, run notes, pre-analysis toggle, and the
  preflight CTA. The stage footer should clearly tell the user whether
  they can advance to `Process Tracking`.
- **Complexity**: 8
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Stage makes stale, warning, idle, and fresh preflight states obvious.
  - `Next` remains disabled until preflight passes or reaches the chosen
    acceptable state.
  - Run notes and temporary conditions stay visibly distinct from the
    Stage 3 context selectors.
- **Validation**:
  - UI smoke test
  - `scripts/tests/forge-room-preflight-v2-regressions.test.ts`

## Sprint 4: Add Process Tracking And Draft Entry
**Goal**: Finish the guided left-panel journey from preflight into draft work.
**Demo/Validation**:
- Users can reach draft from the new stage sequence without losing the
  current Forge workflow semantics.
- Draft-related blockers and readiness are legible before entering the draft stage.

### Task 4.1: Add A Process Tracking Stage
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Add a stage that summarizes queue state, response
  readiness, conflict count, and synthesis/export readiness without
  becoming a KPI dashboard. This stage bridges preflight completion into
  actual draft work and should help users understand why the next stage
  is available or blocked.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Tracking stage uses live operational signals, not passive summary tiles.
  - The next action is obvious without scanning the whole screen.
- **Validation**:
  - UI smoke check against locked and active states

### Task 4.2: Turn Draft Work Into A Dedicated Stage
- **Location**: `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`, `rooms/forge-room/ui/panels/approved-tasks-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Reframe draft creation, review, and approval as the
  next stage after process tracking. The stage may host existing draft
  and approved-task internals, but it must obey the new single-open
  stage shell and footer navigation.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Draft entry feels like progression from setup, not a separate screen.
  - Draft blockers, approval, and dispatch readiness are visible within
    the stage.
  - Stage body remains internally scrollable.
- **Validation**:
  - UI smoke test
  - `scripts/tests/forge-room-task-editor-runtime-regressions.test.ts`

### Task 4.3: Bridge Draft Completion Into Response/Synthesis Guidance
- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/panels/responses-panel.ts`, `rooms/forge-room/ui/panels/synthesis-panel.ts`
- **Description**: Decide and implement how the stage tower hands off to
  later workflow moments after draft approval: either by switching the
  active stage set or by guiding the user toward center/right live
  lanes. The chosen behavior must preserve the new staged mental model.
- **Complexity**: 7
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - There is no dead-end after draft approval.
  - Responses and synthesis feel connected to the new left workflow.
- **Validation**:
  - targeted runtime flow smoke test

## Sprint 5: Retune Supporting Surfaces
**Goal**: Make the rest of Forge support the new primary left-stage surface.
**Demo/Validation**:
- Top bar, center lane, right lane, and coordinator strip all reinforce
  the staged workflow instead of competing with it.

### Task 5.1: Simplify The Status Bar Around Stage Guidance
- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Reduce top-bar copy and reframe it around current
  stage, next safe action, operator nickname, and the single
  `Operator Profile` button. Remove guidance that is now duplicated by
  the stage tower.
- **Complexity**: 6
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Top bar still carries high-signal live state.
  - It no longer repeats left-panel guidance.
  - Operator button remains the only visible profile launcher.
- **Validation**:
  - UI smoke test

### Task 5.2: Demote Center/Right Lanes Without Killing Their Live Role
- **Location**: `rooms/forge-room/ui/panels/responses-panel.ts`, `rooms/forge-room/ui/panels/synthesis-panel.ts`, `rooms/forge-room/ui/panels/conflict-summary-panel.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Rebalance visual weight so center/right lanes read as
  live monitors or downstream action lanes, not equal-weight dashboard
  columns. Preserve locked, warning, and ready states so the room stays
  unmistakably operational.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Center/right lanes remain useful during setup but do not steal primary focus.
  - Locked and ready states stay obvious.
- **Validation**:
  - UI smoke check across `draft`, `responses`, and `synthesis` moments

### Task 5.3: Remove Stale Copy And Deprecated Chrome
- **Location**: `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`, `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/panels/coordinator-panel.ts`
- **Description**: Remove `BASLANGIC HATTI`, directional helper text,
  duplicate section narration, and any old labels that describe the
  retired stacked layout.
- **Complexity**: 5
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - No UI string refers to the removed start-lane model.
  - No stale helper copy restates obvious placement or stage order.
- **Validation**:
  - search-based i18n audit
  - UI smoke test

## Sprint 6: Regression Pass And Rollout Safety
**Goal**: Ship the aggressive revision without silently breaking session, preflight, or handoff behavior.
**Demo/Validation**:
- UI shell works in source and installed room copies after normal sync.
- Core Forge flows remain intact.

### Task 6.1: Update UI Smoke Coverage For The Stage Tower
- **Location**: `scripts/tests/forge-room-ui-smoke-regressions.test.ts`, `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
- **Description**: Rewrite smoke expectations around the new staged
  shell: active stage header, previous/next controls, session dropdown,
  removed `BASLANGIC HATTI`, and top-bar-only operator access.
- **Complexity**: 7
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - Smoke tests fail if the old stacked layout reappears.
  - Tests cover at least one disabled `Next` state and one unlocked one.
- **Validation**:
  - targeted UI smoke suites

### Task 6.2: Verify Host And Session Regressions
- **Location**: `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`, `scripts/tests/forge-room-session-storage-regressions.test.ts`, `scripts/tests/forge-room-preflight-v2-regressions.test.ts`
- **Description**: Confirm the new navigation shell does not create
  implicit sessions, skip preflight invalidation, or break saved-session
  restore behavior.
- **Complexity**: 6
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Session lifecycle semantics remain identical.
  - Preflight still goes stale when goal/context/run settings change.
  - Draft flow still respects existing blockers.
- **Validation**:
  - targeted host/runtime suites

### Task 6.3: Run Final Manual Smoke Matrix
- **Location**: manual QA checklist for implementation handoff
- **Description**: Run a short manual matrix:
  no session,
  existing session,
  preflight stale,
  preflight warning,
  draft ready,
  post-draft response-ready,
  export-ready.
- **Complexity**: 4
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - Every major stage and blocker state is observed once.
  - No stage exceeds viewport height without internal scroll.
- **Validation**:
  - manual smoke pass

## Testing Strategy

- Keep `npm run typecheck` green after each sprint that touches runtime
  types or navigation selectors.
- Run UI smoke tests after every shell or stage-structure change.
- Run session/preflight host regressions before any merge because the
  new shell changes entry order and gating expectations.
- Use a viewport matrix during QA because the left stage tower is now a
  height-bound surface, not an unbounded stack.

## Potential Risks & Gotchas

- **Archetype drift**: if the cutover hides too much live context, Forge
  can drift from `orchestration-workbench` into a generic wizard.
  Mitigation: keep center/right live surfaces and top-bar signals.
- **Viewport overflow**: a sticky full-height tower can still become
  unusable on shorter screens if internal sections do not scroll.
  Mitigation: lock tower height and move overflow inside stage bodies.
- **Duplicate profile entry points**: current context blocks include
  inline `Manage/Open Operator Profile` actions that violate the new
  rule. Mitigation: remove them early in Sprint 3 and rely on the top bar.
- **Gate ambiguity**: if `Next` rules are vague, users will not know why
  they are blocked. Mitigation: every stage header and footer must show
  a concrete blocker reason.
- **Session semantics regression**: dropdown-driven loading can make it
  easier to delete or load the wrong session. Mitigation: always bind
  destructive actions to explicit selected-session identity.
- **Test churn**: existing smoke tests probably assert old copy and old
  block structure. Mitigation: update them as part of Sprint 6, not as
  an afterthought.

## Rollback Plan

- Keep the aggressive revision on a dedicated branch until stage-shell,
  session flow, and preflight regressions are green.
- If the staged shell breaks workflow clarity, revert the shell/layout
  commits first while leaving unrelated type or storage fixes isolated.
- If center/right demotion harms visibility, roll back only the visual
  weighting changes and keep the stage model intact.
- If dropdown session management proves error-prone, revert that slice to
  the existing list-based interaction without abandoning the overall
  stage tower.
