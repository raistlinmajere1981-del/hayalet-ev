# Plan: Forge Room Workflow and UI Revision

**Generated**: 2026-04-18
**Estimated Complexity**: High

## Overview
Forge Room already has the right high-level building blocks: session storage, operator context, optional preflight, draft generation, task dispatch, response review, synthesis, and export. The revision should keep that minimal structure, but make the workflow easier to read, remove accidental duplicate work, and make AI lane routing and language behavior deterministic.

Current baseline flow in source:
- Session is created or loaded from `rooms/forge-room/host/runtime.ts` and surfaced through the stage tower in `rooms/forge-room/ui/panels/workbench-stage-panel.ts`.
- Goal, operator context, and run overrides are edited in the left-side stage flow.
- Preflight is currently a dedicated command, but `generateDraft()` also invalidates and refreshes preflight automatically.
- Draft generation is dispatched through a selected architect seat, then reviewed and approved before task assignment.
- Responses, conflicts, synthesis, and export are rendered in separate panels, but the fixed three-column shell keeps preflight and draft review cramped.

Key findings from the current implementation:
- `generateDraft()` in `rooms/forge-room/host/runtime.ts:980` explicitly marks preflight stale and calls `ensureFreshPreflight()`, which explains the repeated preflight run during draft generation.
- The current shell in `rooms/forge-room/ui/forge-room-ui-runtime.ts:1563` and `rooms/forge-room/ui/style.css:151` is permanently three-column, so only one area feels active while the others still consume space.
- Architect lane selection exists in both UI and host flow, but the most valuable missing safety net is an end-to-end UI-to-host regression that proves the selected seat is the one actually used for breakdown dispatch.
- Localized protocol files exist, but Forge prompt builders still use English runtime instructions and the Turkish preflight protocol copy is not actually localized, so application-language output is not strongly enforced.

## Prerequisites
- Edit only `rooms/forge-room/**` source files. Do not manually patch `data/rooms/forge-room/**`.
- Keep the current Forge concept model intact: session -> operator context -> optional preflight -> draft -> dispatch -> responses -> synthesis -> export.
- Preserve the minimalist UI direction: no duplicated explanations, no repeated buttons for the same action, no extra decorative copy.
- Use existing regression suites in `scripts/tests/forge-room-*.test.ts` as the primary safety net.

## Sprint 1: Lock the Workflow Contract
**Goal**: Define the intended Forge flow precisely before changing layout or runtime behavior.
**Demo/Validation**:
- A reader can follow one canonical Forge path from session creation to export by reading the new tests and state transitions.
- Regression coverage clearly distinguishes explicit preflight from draft generation.

### Task 1.1: Capture the revised workflow contract in tests
- **Location**: `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`, `scripts/tests/forge-room-ui-smoke-regressions.test.ts`
- **Description**: Add or reshape regression cases so the intended flow is explicit: session selection/creation, goal + operator context, optional preflight, architect lane selection, draft generation, draft editing, optional second-AI involvement, response review, synthesis, export.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Tests describe the expected user path without relying on current accidental behavior.
  - The draft-generation path and preflight path are asserted separately.
  - UI smoke coverage proves the shell surfaces the active step without requiring the old three-column reading model.
- **Validation**:
  - Run `node --test scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - Run `node --test scripts/tests/forge-room-ui-smoke-regressions.test.ts`

### Task 1.2: Decide and encode preflight optionality rules
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-preflight-invalidation.ts`, `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
- **Description**: Turn preflight into an explicitly optional step for draft generation. Draft generation should consume the latest preflight bundle when available, but it must not silently rerun preflight unless the user explicitly requested preflight. Introduce a clear rule for how stale or missing preflight is surfaced later in the flow.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `ForgeRoomRunPreflight` remains the only command that forces a preflight run.
  - `ForgeRoomGenerateDraft` no longer re-triggers AI0 preflight automatically.
  - The coordinator note and UI state explain whether draft generation is using fresh preflight, stale preflight, or no preflight context.
- **Validation**:
  - Add a regression that fails if `forge-room-preflight-pre-analysis` is dispatched during `ForgeRoomGenerateDraft`.
  - Run host runtime regression tests.

### Task 1.3: Strengthen architect lane routing guarantees
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`, `scripts/tests/forge-room-ui-smoke-regressions.test.ts`
- **Description**: Add explicit end-to-end coverage for the selected draft lane. The selected seat must survive UI selection, pending command timing, persistence, and actual breakdown dispatch.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - A UI smoke case proves that changing the architect seat and then triggering draft generation sends the intended lane through the command payload.
  - A host regression proves that the breakdown dispatch target matches the selected architect seat after persistence and hydration.
  - The implementation uses one unambiguous source of truth for the active draft architect during dispatch.
- **Validation**:
  - Run UI smoke and host runtime Forge tests.

## Sprint 2: Fix Host Orchestration and Language Rules
**Goal**: Make runtime behavior deterministic and ensure AI natural-language output follows the active application language.
**Demo/Validation**:
- Draft generation can happen without re-running preflight.
- AI0, AI1, and AI2 prompts carry a consistent language rule and use the correct localized protocol text.

### Task 2.1: Separate explicit preflight refresh from draft generation
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`
- **Description**: Refactor the host runtime so preflight refresh is not embedded inside draft generation. Reuse existing preflight bundle and run signature when valid, and attach a clear state note when the draft is proceeding without a fresh preflight run.
- **Complexity**: 7
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The host exposes a clean boundary between explicit preflight execution and draft generation.
  - Draft generation updates coordinator state without impersonating a preflight run.
  - Existing draft/review flows continue to work when preflight was never run.
- **Validation**:
  - Run host runtime and preflight regression suites.

### Task 2.2: Thread app locale into Forge prompt builders
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-breakdown-runtime.ts`, `rooms/forge-room/host/forge-task-runtime.ts`, `rooms/forge-room/host/forge-synthesis-runtime.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`
- **Description**: Use the room host locale to add an explicit output-language rule to every Forge AI prompt. This should cover human-readable JSON fields such as `summary`, `body`, `warnings`, `missingInfo`, `acceptanceCriteria`, and `openQuestions`.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - All Forge AI prompt builders accept a locale or resolved language hint.
  - Prompt text clearly instructs the AI to write human-readable fields in the application language.
  - No protocol relies only on the model inferring the output language from unrelated prompt text.
- **Validation**:
  - Add targeted tests for prompt text generation or dispatch payload inspection.
  - Run `node --test` for Forge runtime and protocol-adjacent regressions.

### Task 2.3: Correct localized Forge protocol copy
- **Location**: `rooms/forge-room/main-functions/forge-workbench/protocols/*.md`, `rooms/forge-room/main-functions/forge-workbench/protocols/tr/*.md`
- **Description**: Review Forge protocol files and align Turkish copies with the intended behavior. The Turkish preflight protocol in particular should be truly localized, not left in English.
- **Complexity**: 3
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - `tr` protocol files are localized and semantically aligned with the default protocol set.
  - The wording stays minimal and instruction-focused.
  - Protocol intent remains identical across locales.
- **Validation**:
  - Run `node --test scripts/tests/forge-room-manifest-regressions.test.ts`
  - Manually diff `default/en/tr` protocol intent for drift.

## Sprint 3: Replace the Fixed Three-Column Shell with a Tabbed Workbench
**Goal**: Keep the same information architecture, but let the currently needed surface use the screen width.
**Demo/Validation**:
- Preflight, draft review, responses, and synthesis each have enough width to read comfortably.
- The active tab follows the current workflow state, while locked/monitor states stay visible through compact badges instead of full columns.

### Task 3.1: Introduce a tab model for Forge surfaces
- **Location**: `rooms/forge-room/shared/ui/state.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Replace the rigid `goal/responses/synthesis` column emphasis with a top-level tab model. Recommended tabs for v1: `Flow`, `Responses`, and `Output`. Keep the stage tower inside `Flow`.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The UI can switch between surfaces without rendering all three as equal-width columns.
  - Default tab selection follows workflow state, but the user can switch tabs explicitly.
  - Locked and monitor states remain visible through concise tab badges or chips.
- **Validation**:
  - Extend UI smoke tests to verify tab switching and default active tab selection.

### Task 3.2: Rebuild the Forge shell layout for wide reading surfaces
- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Convert the workbench shell into a tabbed layout with a single wide content surface. Preserve the status bar and coordinator strip, but remove the requirement that responses and synthesis always consume space beside the active flow.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The preflight screen and draft editor can use the main width on desktop.
  - The layout still degrades cleanly on tablet and mobile widths.
  - The shell does not duplicate major CTA buttons across tab header, panel body, and coordinator strip.
- **Validation**:
  - Run Forge UI smoke regression tests.
  - Manually inspect desktop and narrow-width states if a local preview is available.

### Task 3.3: Give preflight a report-friendly wide layout
- **Location**: `rooms/forge-room/ui/panels/workbench-stage-panel.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Redesign the preflight stage so AI0 observations read like a compact report instead of a narrow checklist card. Keep the process steps visible, but let the summary, warnings, and run signature breathe.
- **Complexity**: 5
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - AI0 pre-analysis summary is readable without cramped wrapping.
  - Warnings, missing information, and run signature are visible in a stable hierarchy.
  - The preflight action remains singular and obvious.
- **Validation**:
  - Add or update UI smoke assertions for preflight content visibility and button count.

### Task 3.4: Give draft review and approved-task editing a full-width editing mode
- **Location**: `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`, `rooms/forge-room/ui/panels/approved-tasks-panel.ts`, `rooms/forge-room/ui/panels/workbench-stage-panel.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Widen draft editing and approved-task review so the user can edit the selected AI’s draft without fighting the old column constraints.
- **Complexity**: 6
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Draft cards and raw editor can use the full main work area.
  - Approved-task controls remain clear without repeating the same action label in multiple places.
  - The user can understand whether they are editing a generated draft, an approved task, or a read-only artifact.
- **Validation**:
  - Extend UI smoke tests for draft and approved-task surfaces.

## Sprint 4: Make “Who Said What” Legible
**Goal**: Improve process visibility so the user can see what is happening now, which AI spoke, and what stage the run is in.
**Demo/Validation**:
- The user can tell whether Forge is waiting on AI0, AI1, AI2, or the user.
- Response and synthesis views show compact but readable provenance.

### Task 4.1: Promote Forge event log into a user-facing activity timeline
- **Location**: `rooms/forge-room/shared/types/forge-workflow.ts`, `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/ui/panels/coordinator-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Reuse the existing `eventLog` model to emit clear workflow events for preflight start/completion, draft dispatch, lane routing, response capture, conflict resolution, synthesis generation, and export.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Host runtime emits structured, seat-aware activity entries.
  - The UI renders a compact activity timeline or feed without creating repetitive explanatory text.
  - The current actor and current wait state are obvious.
- **Validation**:
  - Add runtime regression coverage for event emission.
  - Add UI smoke coverage for activity feed rendering.

### Task 4.2: Enrich response and synthesis panels with provenance-first summaries
- **Location**: `rooms/forge-room/ui/panels/responses-panel.ts`, `rooms/forge-room/ui/panels/synthesis-panel.ts`
- **Description**: Refine card summaries so each response clearly shows seat, role, status, and relevant provenance before expansion. The synthesis view should also show which answers were selected and why the output is blocked or ready.
- **Complexity**: 5
- **Dependencies**: Task 3.2, Task 4.1
- **Acceptance Criteria**:
  - A user can identify the speaker and state of each response without opening every card.
  - Conflict and synthesis status copy stays concise and non-duplicative.
  - Selected synthesis provenance remains visible without burying the main output.
- **Validation**:
  - Extend UI smoke tests for response and synthesis cards.

### Task 4.3: Simplify coordinator messaging to one primary cue per state
- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/panels/coordinator-panel.ts`
- **Description**: Reconcile the status bar, coordinator strip, tab badges, and stage CTA rules so the UI always has one primary next-step signal, not several competing variants of the same instruction.
- **Complexity**: 4
- **Dependencies**: Task 3.1, Task 4.1
- **Acceptance Criteria**:
  - Each workflow state exposes one dominant CTA or wait message.
  - Duplicate labels such as repeated “generate draft” or “run preflight” instructions are removed.
  - Secondary surfaces show state through chips/badges, not by repeating the same sentence.
- **Validation**:
  - UI smoke assertions for primary action uniqueness in representative states.

## Sprint 5: Regression Hardening and Release Readiness
**Goal**: Finish with a demoable Forge revision that is stable under the existing regression suite.
**Demo/Validation**:
- Forge draft routing, optional preflight behavior, localized prompts, and tabbed UI all pass targeted regression coverage.
- The room remains type-safe and manifest-consistent.

### Task 5.1: Expand targeted Forge regressions for the new contract
- **Location**: `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`, `scripts/tests/forge-room-ui-smoke-regressions.test.ts`, `scripts/tests/forge-room-preflight-v2-regressions.test.ts`, `scripts/tests/forge-room-manifest-regressions.test.ts`
- **Description**: Add or update regressions for optional preflight, draft lane routing, localized prompt rules, tab navigation, timeline rendering, and no-duplicate-CTA behavior.
- **Complexity**: 6
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Every reported issue has a regression test.
  - New UI states are covered by smoke tests instead of relying on manual checking only.
  - Locale and protocol changes are covered where practical.
- **Validation**:
  - Run targeted Forge `node --test` suites.

### Task 5.2: Run type and room-safety verification
- **Location**: `rooms/forge-room/**`, `scripts/tests/**`
- **Description**: Execute the project’s required validation path for a room workflow change, including type safety and relevant room regression suites.
- **Complexity**: 3
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - `npm run typecheck` passes.
  - Relevant Forge regressions pass.
  - Any intentional behavior changes are reflected in test expectations, not left as silent drift.
- **Validation**:
  - Run `npm run typecheck`
  - Run the targeted Forge test commands selected during implementation

## Testing Strategy
- Start by adding failing or expectation-tightening regressions for the two reported bugs.
- Keep host-runtime tests focused on protocol dispatch, seat routing, preflight state, and persisted session behavior.
- Keep UI smoke tests focused on visible workflow cues, tab state, and command payloads.
- Re-run manifest and preflight regressions when protocol or preflight semantics change.
- Finish with `npm run typecheck` plus the focused Forge regression set before considering the revision complete.

## Potential Risks & Gotchas
- **Preflight optionality affects export provenance**: if preflight becomes optional for draft generation, export cannot keep assuming fresh preflight is always present. Recommended v1 policy: skipped preflight should warn, not hard-block, unless a later export rule truly depends on it.
- **Duplicate source of truth for architect lane**: if UI state, run override state, and generate-draft payload can disagree, routing bugs will remain intermittent. The implementation should converge on one authoritative value at dispatch time.
- **Tabbed layout can accidentally hide critical lock states**: locked and monitor states need compact badges and coordinator messaging so users still understand why a tab is inactive.
- **Activity visibility can become noisy**: event rendering should prefer actor, step, and outcome over verbose prose. The goal is traceability, not a transcript dump.
- **Localized protocol copy alone is not enough**: the runtime prompt builders also need locale-aware instructions, otherwise JSON prose fields may still come back in English.
- **Minimalism can regress during redesign**: every state should expose one primary action, with supporting context compressed into chips, badges, or short provenance lines.

## Rollback Plan
- Keep shell refactors and host-runtime behavior changes in separate commits so layout and workflow logic can be reverted independently.
- If the tabbed shell introduces usability regressions, temporarily retain the old panels behind the existing render functions while keeping the new host/runtime contract changes.
- If optional preflight causes downstream export ambiguity, revert only the export gating rule while preserving the draft-generation bug fix.
- If locale-aware prompts produce unstable model behavior, keep protocol localization changes and roll back only the extra runtime language instructions.
