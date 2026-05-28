# Plan: Laboratory Room Update

**Generated**: 2026-04-14
**Estimated Complexity**: High

## Overview

This plan translates the refactor intent in [Lab.md](/home/raistlin/hayalet-ev/Lab.md) into the actual Laboratory room seams that exist today. The goal is not to invent a new room or feature set, but to simplify the current guided workbench so that stage progression is guard-driven, each stage has a clearer primary action, the right-side inspector stops duplicating data, and the dependency/readiness surfaces become more honest and action-oriented.

The current implementation already has the right macro structure:

- Stage navigation lives in [rooms/laboratory/shared/ui/navigation-runtime.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/navigation-runtime.ts).
- Stage chrome and next/previous controls live in [rooms/laboratory/shared/ui/shell-frame.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/shell-frame.ts).
- Source, process, and report inspectors are emitted through the shared `LaboratoryStageSurface.inspector` contract in [rooms/laboratory/shared/types/room-shell-contracts.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/types/room-shell-contracts.ts).
- Media analysis edit/profile stages render their own main/side layouts in [edit-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts) and [profile-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts).
- Process/report stages are composed in shared room UI files: [process-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/process-stage.ts) and [report-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/report-stage.ts).
- The dependency center is the settings overlay in [rooms/laboratory/shared/ui/settings-overlay.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/settings-overlay.ts).

The refactor should therefore stay within the existing room shell contract and avoid creating a parallel UI model.

## Prerequisites

- Review [Lab.md](/home/raistlin/hayalet-ev/Lab.md) and treat it as intent, not as a literal file map.
- Preserve the room manifest and feature contract in [rooms/laboratory/manifest.json](/home/raistlin/hayalet-ev/rooms/laboratory/manifest.json).
- Keep `source -> edit -> profile -> process -> report` as the canonical stage order unless the contract is intentionally changed project-wide.
- Reuse the existing `inspector` surface instead of introducing a second right-panel abstraction unless the current contract becomes a blocker.
- Keep room-local visible copy in [rooms/laboratory/i18n/en.json](/home/raistlin/hayalet-ev/rooms/laboratory/i18n/en.json) and [rooms/laboratory/i18n/tr.json](/home/raistlin/hayalet-ev/rooms/laboratory/i18n/tr.json).
- Validation baseline:
  - `npm run rooms:typecheck`
  - `node --import tsx --test scripts/tests/laboratory-ui-evaluation-regressions.test.ts`
  - `node --import tsx --test scripts/tests/laboratory-media-analysis-room-regressions.test.ts`
  - `node --import tsx --test scripts/tests/laboratory-media-process-behavior-regressions.test.ts`
  - `node --import tsx --test scripts/tests/laboratory-media-report-behavior-regressions.test.ts`
  - Add subtitle/audio suites when shared shell behavior changes affect them

## Reality Map

The `Lab.md` patch labels do not match the current codebase one-to-one. Use this mapping during implementation:

- `run` in `Lab.md` maps to `process` in the current room.
- `StepContextPanel` maps to the existing `inspector` region emitted by each stage surface.
- `DiagnosticsDrawer` maps to the current event log plus dependency/settings overlay surfaces, primarily [shell-render.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/shell-render.ts) and [settings-overlay.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/settings-overlay.ts).
- `DependencyCenterModal` maps to the settings overlay opened by `open-settings`.
- `stateMachine / wizardState / reducer` maps first to navigation and bootstrap UI state in [navigation-runtime.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/navigation-runtime.ts), [action-router-actions.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/action-router-actions.ts), and [bootstrap-state-runtime.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/bootstrap-state-runtime.ts).

## Sprint 1: Guarded Journey Contract

**Goal**: Replace unconditional next/previous stage movement with an explicit, host-backed stage guard model while preserving the existing shell contract.
**Demo/Validation**:

- The top rail still renders the same five stages.
- `Next` becomes blocked when source, preflight, or run prerequisites are missing.
- Stage blocking reason is visible in the status line or stage chrome instead of silently failing.

### Task 1.1: Add Stage Guard Evaluation Runtime

- **Location**:
  - [rooms/laboratory/shared/ui/navigation-runtime.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/navigation-runtime.ts)
  - [rooms/laboratory/ui/bootstrap-state-runtime.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/bootstrap-state-runtime.ts)
  - [rooms/laboratory/ui/stage-accessors-runtime.ts](/home/raistlin/hayalet-ev/rooms/laboratory/ui/stage-accessors-runtime.ts)
- **Description**: Introduce a normalized guard evaluator that answers `canEnter(stageId)` and returns a short reason when blocked. Base it on actual room state, not UI heuristics.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - Guard rules cover at minimum `source`, `edit`, `profile`, `process`, `report`.
  - Guard inputs are derived from current project/source/preflight/process/report state.
  - The implementation uses current room state accessors rather than duplicate local booleans where possible.
- **Validation**:
  - Add or update a regression test that asserts guarded stage progression hooks exist.
  - Manual verification in shell code that blocked stages are detectable without rendering the full app.

### Task 1.2: Route Rail Navigation Through Guards

- **Location**:
  - [rooms/laboratory/shared/ui/action-router-actions.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/action-router-actions.ts)
  - [rooms/laboratory/shared/ui/shell-frame.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/shell-frame.ts)
  - [rooms/laboratory/shared/ui/navigation-runtime.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/navigation-runtime.ts)
- **Description**: Replace blind `advanceStage(1)` behavior with guarded navigation. Keep previous-stage navigation permissive unless a hard blocker is needed.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `nav-next` cannot enter `edit` without source readiness.
  - `nav-next` cannot enter `process` without profile readiness/preflight completion.
  - `nav-next` cannot enter `report` without process/report readiness.
- **Validation**:
  - Update UI regression coverage for shell next/previous behavior.
  - Check that the rendered next button disabled state or blocking message reflects guard output.

### Task 1.3: Expose Guard Status in Shared Shell Feedback

- **Location**:
  - [rooms/laboratory/shared/ui/shell-render.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/shell-render.ts)
  - [rooms/laboratory/shared/ui/host-messages.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/host-messages.ts)
  - [rooms/laboratory/shared/types/room-shell-contracts.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/types/room-shell-contracts.ts)
- **Description**: Surface a concise blocker/result message when navigation is denied so the guard model is legible to operators.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Guard failures produce one short human-readable explanation.
  - Status messaging does not spam the event log with duplicates for the same blocked action.
- **Validation**:
  - Add a unit/regression assertion for blocked navigation feedback.
  - Manual review of shell render logic for duplicate-card regressions.

## Sprint 2: Source And Edit Stage Simplification

**Goal**: Make the source stage project-first and make the edit stage single-focus with one dominant operator action.
**Demo/Validation**:

- Source stage no longer uses the right panel as a module-management surface.
- Edit stage has one clear primary CTA and a quieter side rail.
- No change to host contracts for source intake or edit operations.

### Task 2.1: Gate Source Intake Behind Active Project Selection

- **Location**:
  - [rooms/laboratory/shared/ui/source-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/source-stage.ts)
  - [rooms/laboratory/shared/ui/source-stage-project.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/source-stage-project.ts)
  - [rooms/laboratory/shared/ui/source-stage-intake.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/source-stage-intake.ts)
- **Description**: Keep project selection as the first obligation. If no project is active, reduce the stage to project selection plus a short status message; reveal source intake only after project selection.
- **Complexity**: 6
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Source intake controls stay hidden or disabled until a project is active.
  - Project create/delete actions remain available without competing with the source CTA.
  - No feature/module selection UI remains in the source inspector.
- **Validation**:
  - Update or add a UI regression asserting project-first rendering.
  - Inspect rendered source-stage markup for absence of module pills/actions.

### Task 2.2: Relocate Module Selection Out Of Source Inspector

- **Location**:
  - [rooms/laboratory/shared/ui/source-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/source-stage.ts)
  - [rooms/laboratory/shared/ui/settings-overlay.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/settings-overlay.ts)
  - [rooms/laboratory/shared/ui/action-router-actions.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/action-router-actions.ts)
- **Description**: Move workbench module management to an existing low-frequency surface, preferably the settings/dependency overlay, so the source stage right panel stops acting like a second navigation center.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Source inspector becomes a single compact context card.
  - Module include/activate actions remain reachable somewhere in the room.
  - Audio/subtitle feature switching still works after relocation.
- **Validation**:
  - Add regression coverage for module activation from the chosen replacement surface.
  - Manual grep check for removed `workbench-toggle-module`/`workbench-activate-module` buttons from source-stage markup.

### Task 2.3: Reduce Edit Stage To One Primary Outcome

- **Location**:
  - [rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts)
  - [rooms/laboratory/main-functions/media-analysis/ui/edit-panels.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/edit-panels.ts)
  - [rooms/laboratory/main-functions/media-analysis/ui/edit-mode-panels.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/edit-mode-panels.ts)
- **Description**: Choose a single primary action for the edit stage based on current workflow semantics, then demote the competing action to secondary/ghost styling. Collapse low-frequency controls into an advanced block instead of rendering them as peer panels.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Only one edit CTA renders as visually primary.
  - Progress, summary, and output panels no longer compete equally in the side stack.
  - Advanced sliders/toggles move behind a lower-emphasis disclosure.
- **Validation**:
  - Update `laboratory-ui-evaluation-regressions.test.ts` for the new edit-stage hierarchy.
  - Inspect markup for a single primary edit action token.

### Task 2.4: Compress Edit Inspector To One Summary Card

- **Location**:
  - [rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/edit-stage.ts)
  - Related edit summary/progress/output panel files under `rooms/laboratory/main-functions/media-analysis/ui/`
- **Description**: Replace the three-panel edit aside with one concise inspector card containing preset, latest action, and status. Keep full details in the main surface or existing drawers/overlays.
- **Complexity**: 6
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Edit side rail renders one card only.
  - Output lists remain accessible but are no longer duplicated in the inspector.
- **Validation**:
  - Update regression tests that currently expect progress in the side rail.
  - Manual rendered markup review for one-card inspector output.

## Sprint 3: Profile, Process, And Report Convergence

**Goal**: Turn profile into a real readiness gate, make process a run/watch stage, and make report the single owner of closeout details.
**Demo/Validation**:

- Profile stage blocks transition into process until readiness is actionable.
- Process inspector becomes action-oriented instead of summary-heavy.
- Report inspector stops repeating metrics already visible in the main report surface.

### Task 3.1: Convert Profile Stage Into A True Readiness Gate

- **Location**:
  - [rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts)
  - [rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts)
  - [rooms/laboratory/main-functions/media-analysis/host/profile-preflight.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/host/profile-preflight.ts)
- **Description**: Use existing readiness and preflight data to drive a single dominant preflight action, with model/tool installation paths framed as direct resolution actions rather than passive warnings.
- **Complexity**: 8
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - `profile-run` is the dominant action when preflight is pending.
  - Missing model/tool readiness exposes a concrete next action when one exists.
  - Guard output for entering `process` aligns with profile readiness/preflight status.
- **Validation**:
  - Update media profile behavior regressions to cover readiness-blocked transitions.
  - Confirm no stale passive warning copy survives as the only remediation path.

### Task 3.2: Shrink Profile Inspector To A Compact Readiness Summary

- **Location**:
  - [rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts)
  - [rooms/laboratory/i18n/en.json](/home/raistlin/hayalet-ev/rooms/laboratory/i18n/en.json)
  - [rooms/laboratory/i18n/tr.json](/home/raistlin/hayalet-ev/rooms/laboratory/i18n/tr.json)
- **Description**: Reduce the profile side rail to a short target/readiness/warning summary. Keep long explanatory copy and deep technical detail out of the inspector.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The profile side rail has one summary card.
  - Long warning lists move out of the side rail or are truncated with a secondary route to detail.
- **Validation**:
  - UI regression for inspector output length/card count.
  - Copy review against room-local i18n.

### Task 3.3: Reframe Process Stage As Run And Observe

- **Location**:
  - [rooms/laboratory/shared/ui/process-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/process-stage.ts)
  - [rooms/laboratory/shared/ui/action-router-actions.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/action-router-actions.ts)
- **Description**: Keep the main process surface focused on timeline/progress/module execution, and demote `open-report` from primary to secondary. The inspector should become a compact action/status card instead of a second dashboard.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Process main area remains status/timeline-first.
  - `open-report` is not the primary process CTA.
  - Duplicate warning and module summary blocks are removed from the process inspector.
- **Validation**:
  - Update process behavior regressions to match the new process-side action hierarchy.
  - Manual markup review for duplicate summary removal.

### Task 3.4: Make Report Main Surface The Single Closeout Owner

- **Location**:
  - [rooms/laboratory/shared/ui/report-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/report-stage.ts)
  - [rooms/laboratory/shared/ui/report-stage-support.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/report-stage-support.ts)
  - Subtitle/audio report helpers if shared summaries drift
- **Description**: Keep findings, summary cards, and exports centered in the main report surface. Convert the inspector into one concise module/status/export card without repeated metrics and warning dumps.
- **Complexity**: 7
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Report metrics are not repeated in both main and inspector panels.
  - Export remains available, but the right panel no longer acts like a second summary dashboard.
  - Audio/subtitle shared report paths remain compatible with the shared shell expectations.
- **Validation**:
  - Update media and subtitle report behavior regressions.
  - Spot-check audio-analysis report rendering for shell parity.

## Sprint 4: Unified Inspector Discipline, Diagnostics, And Dependency Truthfulness

**Goal**: Apply one consistent rule to right-side inspectors, move technical noise behind secondary surfaces, and make dependency management reflect real runtime capabilities.
**Demo/Validation**:

- Each stage emits one inspector card at most.
- Technical details default closed.
- Dependency overlay shows only real actions supported by host/runtime metadata.

### Task 4.1: Standardize Inspector Contract Across All Stages

- **Location**:
  - [rooms/laboratory/shared/types/room-shell-contracts.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/types/room-shell-contracts.ts)
  - [rooms/laboratory/shared/ui/source-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/source-stage.ts)
  - [rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts)
  - [rooms/laboratory/shared/ui/process-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/process-stage.ts)
  - [rooms/laboratory/shared/ui/report-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/report-stage.ts)
- **Description**: Enforce the `one inspector card, short summary, no duplicate CTA overload` rule through shared conventions and lightweight helpers if needed.
- **Complexity**: 6
- **Dependencies**: Sprints 2 and 3 mostly complete
- **Acceptance Criteria**:
  - No stage renders more than one high-level inspector panel.
  - Inspector copy stays compact and stage-specific.
- **Validation**:
  - Add a regression that checks per-stage inspector panel count or characteristic markers.
  - Manual render review for all five stages.

### Task 4.2: Consolidate Technical Detail Into Secondary Surfaces

- **Location**:
  - [rooms/laboratory/shared/ui/shell-render.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/shell-render.ts)
  - [rooms/laboratory/shared/ui/settings-overlay.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/settings-overlay.ts)
  - [rooms/laboratory/shared/ui/action-router-actions.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/action-router-actions.ts)
- **Description**: Keep the event log and dependency overlay as the technical/detail layer. Do not render verbose diagnostic blocks directly in stage inspectors or primary stage surfaces unless they are operationally critical.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Event log remains default closed.
  - Technical dependency/job detail is reachable but not foregrounded during normal stage work.
- **Validation**:
  - Existing UI evaluation regression remains green or is updated intentionally.
  - Manual shell render inspection for default-closed behavior.

### Task 4.3: Split Dependency Overlay Into Managed Vs External Truth

- **Location**:
  - [rooms/laboratory/shared/ui/settings-overlay.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/settings-overlay.ts)
  - [rooms/laboratory/shared/ui/settings-tool-card.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/settings-tool-card.ts)
  - [rooms/laboratory/shared/ui/settings-profile-model.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/settings-profile-model.ts)
  - Tool metadata under [rooms/laboratory/shared/data/tools/](/home/raistlin/hayalet-ev/rooms/laboratory/shared/data/tools/)
- **Description**: Group dependencies by realistic support model and suppress fake actions for unsupported tools. When the runtime can only guide manual install/verify/locate flows, show those honestly.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Unsupported tools do not show fake install/update actions.
  - Manual/external tools show guidance-oriented actions only.
  - Managed tools keep host-backed actions where they exist.
- **Validation**:
  - Add or update regressions around dependency/tool helper rendering.
  - Cross-check action IDs in `action-router-actions.ts` against visible overlay actions.

### Task 4.4: Deduplicate Warning And Status Copy

- **Location**:
  - [rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/main-functions/media-analysis/ui/profile-stage.ts)
  - [rooms/laboratory/shared/ui/process-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/process-stage.ts)
  - [rooms/laboratory/shared/ui/report-stage.ts](/home/raistlin/hayalet-ev/rooms/laboratory/shared/ui/report-stage.ts)
  - [rooms/laboratory/i18n/en.json](/home/raistlin/hayalet-ev/rooms/laboratory/i18n/en.json)
  - [rooms/laboratory/i18n/tr.json](/home/raistlin/hayalet-ev/rooms/laboratory/i18n/tr.json)
- **Description**: Normalize warning repetition rules and trim right-panel copy to short action-oriented lines. Reuse existing host deduped warning data when available before adding new UI-only dedupe logic.
- **Complexity**: 6
- **Dependencies**: Tasks 3.2, 3.3, 3.4
- **Acceptance Criteria**:
  - The same warning is not rendered in main surface, inspector, and overlay without a clear reason.
  - Short copy becomes the default in inspector/status regions.
- **Validation**:
  - Regression assertions for warning list size or duplicated key strings.
  - Copy pass comparing TR and EN catalogs.

## Sprint 5: Regression Lock And Handoff Readiness

**Goal**: Lock the new workbench behavior with focused regressions and a concise implementation acceptance checklist.
**Demo/Validation**:

- Room typecheck passes.
- Focused laboratory regressions pass.
- A human-readable acceptance matrix exists for the refactor.

### Task 5.1: Update Shared Laboratory Regression Coverage

- **Location**:
  - [scripts/tests/laboratory-ui-evaluation-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/laboratory-ui-evaluation-regressions.test.ts)
  - [scripts/tests/laboratory-media-analysis-room-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/laboratory-media-analysis-room-regressions.test.ts)
  - [scripts/tests/laboratory-media-process-behavior-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/laboratory-media-process-behavior-regressions.test.ts)
  - [scripts/tests/laboratory-media-report-behavior-regressions.test.ts](/home/raistlin/hayalet-ev/scripts/tests/laboratory-media-report-behavior-regressions.test.ts)
  - Profile/audio/subtitle suites as needed
- **Description**: Update current expectations to reflect guarded navigation, single-card inspectors, process/report de-duplication, and dependency overlay truthfulness.
- **Complexity**: 7
- **Dependencies**: Sprints 1-4 complete
- **Acceptance Criteria**:
  - Tests cover guard presence, reduced inspector duplication, and updated CTA hierarchy.
  - Audio/subtitle suites stay green if shared shell behavior changed.
- **Validation**:
  - Run the targeted `node --import tsx --test ...` suites.
  - Escalate to `npm run rooms:test:core` if shared room shell contract changed broadly.

### Task 5.2: Produce An Acceptance Checklist For The Refactor

- **Location**:
  - PR description or dedicated implementation note; no production file required unless requested
- **Description**: Capture the final acceptance matrix that mirrors the important `Lab.md` outcomes using the real stage names and current UI terminology.
- **Complexity**: 3
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Checklist covers source gating, edit primary action, profile/process gating, report de-duplication, inspector one-card rule, diagnostics default-closed, and dependency truthfulness.
- **Validation**:
  - Human review before merge.

## Suggested Execution Order

1. Ship guard evaluation and guarded navigation first.
2. Simplify the source stage and relocate module management.
3. Refactor edit stage hierarchy while tests still isolate edit-specific risk.
4. Convert profile readiness into the hard gate for process entry.
5. Simplify process and report inspectors after the guard model is stable.
6. Finish with dependency overlay truthfulness and warning dedupe.
7. Lock the new behavior with focused regressions, then run the broader room test suite if shared shell seams changed.

## Parallelization Notes

- Can run in parallel:
  - Task 2.2 and Task 2.3 after Task 2.1 is stable
  - Task 3.2 and early i18n cleanup while Task 3.1 host/UI gating work lands
  - Task 5.2 can be prepared while final test runs execute
- Should stay serialized:
  - Sprint 1 guard work before any stage simplification
  - Task 3.1 before Task 3.3 because `process` entry depends on profile readiness semantics
  - Task 4.3 after tool/model action truth is understood from current host capabilities

## Testing Strategy

- Stage navigation:
  - Add assertions that `nav-next` is blocked with missing prerequisites.
  - Assert guard reasons are exposed through shell feedback.
- Source stage:
  - Verify source intake is hidden/disabled until a project exists.
  - Verify module selection no longer appears in the source inspector.
- Edit stage:
  - Verify only one dominant CTA remains primary.
  - Verify side rail collapses to one summary card.
- Profile/process/report:
  - Verify `process` cannot be entered before readiness/preflight.
  - Verify `open-report` is not the primary process CTA.
  - Verify report metrics are centered in the main surface and not duplicated in the inspector.
- Dependency overlay:
  - Verify managed/manual/external action rendering matches real runtime support.
  - Verify unsupported tools do not render fake update/install actions.
- Cross-feature:
  - Re-run audio/subtitle suites when shared shell or overlay code changes.

## Potential Risks & Gotchas

- `Lab.md` says `run`, but the codebase says `process`. Renaming this across the codebase would widen scope unnecessarily.
- Module selection currently lives in the source inspector. Removing it without relocation would quietly break workbench multi-feature control.
- Some “warning dedupe” may already happen in host projection layers. Adding aggressive UI-side dedupe could hide distinct warnings if the keying strategy is too coarse.
- The settings overlay currently mixes readiness summary, running operations, tool cards, models, and audio provider data. Simplifying it without a clear grouping rule could regress discoverability.
- Report and process inspectors currently summarize selected feature IDs across media/audio/subtitle. Over-compressing them could remove valuable cross-feature visibility for multi-module workbench runs.
- Existing tests are mostly structural/behavioral regressions over source strings and light runtime stubs. They may need explicit updates for new markup and action hierarchy even if behavior improves.
- Room-local copy changes in TR/EN must stay aligned; otherwise the UI will feel partially refactored and regressions may pass while UX drifts.

## Mitigations

- Keep terminology stable in code and only align labels/copy where needed.
- Rehome module-management actions before removing them from source stage markup.
- Prefer dedupe against host-normalized warning arrays before inventing a new UI warning identity layer.
- Treat the overlay as a second-order operational surface, not as the new primary control center.
- Preserve cross-feature visibility where it affects real workbench decisions; remove duplication, not observability.
- Update tests in the same commit as each stage refactor to keep regressions honest.

## Rollback Plan

- Revert by sprint boundary, not by individual cosmetic tweak.
- If Sprint 1 guard navigation destabilizes the shell, roll back only the guard runtime and keep stage UI untouched.
- If Sprint 2 or Sprint 3 reduces discoverability too aggressively, revert the affected stage renderer and inspector changes while preserving guard foundations.
- If dependency overlay truthfulness breaks tool actions, restore the prior overlay rendering and revisit metadata/action mapping separately.
- Keep each task atomic enough to revert with a single commit where possible.

## Review Notes

- This plan intentionally avoids introducing a brand-new page model, modal family, or panel system.
- The preferred implementation path is to refactor through existing shell seams and stage surfaces.
- A subagent review step from the skill was skipped because this session does not include explicit user authorization for delegated agent work.
