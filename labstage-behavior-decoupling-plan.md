# Plan: LabStage Behavior Decoupling

**Generated**: 2026-04-22
**Estimated Complexity**: High
**Scope**: `rooms/laboratory` source tree only. Keep `LabStage`, `currentStage`, and `stage-changed` for compatibility, but remove their ability to control behavior.

## Control Coupling Points

### Action Dispatch

1. `rooms/laboratory/runtime/lab-run-controller.ts:665`
   Current behavior:
   `runPrimaryAction()` switches on `state.currentStage` and picks the core action path:
   `source -> source intake`, `edit -> edit-preview`, `process -> process-run/cancel`, `report -> report-export`.
   Replacement:
   Replace the stage switch with explicit selectors:
   source actions from source mode + source draft requirements,
   analysis actions from source readiness + selected intents/capabilities + run state,
   report actions from report availability,
   and `WorkspaceMode` only for high-level mode branching where needed.

2. `rooms/laboratory/runtime/lab-run-controller.ts:879`
   Current behavior:
   Tool lifecycle actions forward `featureStage: state.currentStage` into host actions, which makes tool jobs and event routing inherit UI stage.
   Replacement:
   Derive tool context from actual action intent:
   source-route tools from source import mode,
   analysis tools from selected intents and required capability tools,
   process/report job scope from action family or active run context.
   `currentStage` may still be mirrored into payloads only as passive metadata if a compatibility field is still needed.

3. `rooms/laboratory/runtime/lab-run-controller.ts:386`
   Current behavior:
   Selecting a new blank project dispatches `stage-changed -> source` before resetting source state.
   Replacement:
   Reset the real source workspace state first, then recompute legacy stage through a single compatibility projection helper.

4. `rooms/laboratory/runtime/lab-run-controller.ts:993`
   Current behavior:
   `new-run-from-report` dispatches `stage-changed -> edit` after seeding a new mutable scope.
   Replacement:
   Seed editable workspace state and preview focus directly, then project legacy stage from the resulting real state.

5. `rooms/laboratory/runtime/lab-run-controller.ts:1020`
   Current behavior:
   `run-deep-analysis` forces `stage-changed -> edit`, runs preview and preflight, then forces `stage-changed -> process`.
   Replacement:
   Keep the flow intent-based:
   selected intents -> derived capabilities -> preview/preflight/run.
   Reflect stage only after each real state transition through compatibility sync, not as the cause of the transition.

6. `rooms/laboratory/runtime/lab-run-controller.ts:1295`
   Current behavior:
   `toggle-report-view` dispatches `stage-changed -> report`.
   Replacement:
   Let report overlay and report tab state control the report UI.
   Legacy stage should be projected from report availability or completed-run/report-overlay conditions.

### UI State Derivation

1. `rooms/laboratory/runtime/lab-run-controller.ts:1663`
   Current behavior:
   `getPrimaryActionState()` switches on `state.currentStage` to decide button label, disabled state, and detail copy.
   Replacement:
   Split this into condition-driven helpers:
   source CTA state from source mode + required source inputs,
   analysis CTA state from source readiness + intent/capability readiness + run state,
   report CTA state from report export availability.
   Use `WorkspaceMode` only to distinguish workspace/analyzing/complete presentation.

2. `rooms/laboratory/ui/tool-management-overlay.ts:342`
   Current behavior:
   The tool overlay computes "active stage tools" from `state.currentStage` and `descriptor.stageSupport[stageId]`.
   Replacement:
   Relevance-filter tools from:
   selected intents,
   intent-derived capability families,
   capability `requiredTools`,
   source route needs,
   and `WorkspaceMode`.
   Keep `stageSupport` visible only as descriptive metadata if needed, not as the thing that decides what is "active now".

### Validation / Gating

1. `rooms/laboratory/runtime/lab-selectors.ts:265`
   Current behavior:
   `getStageBlockReason(stage)` encodes readiness as "may we enter stage X?"
   Replacement:
   Replace with direct condition checks:
   `getSourceActionBlockReason`,
   `getAnalysisActionBlockReason`,
   `getReportActionBlockReason`,
   plus focused capability/tool readiness helpers.

2. `rooms/laboratory/runtime/lab-selectors.ts:319`
   Current behavior:
   `canAdvanceToStage(stage)` turns stage readiness into a shared gate.
   Replacement:
   Remove it from behavioral decision paths.
   Compatibility code may still project or emit a stage change, but no user action should depend on stage admission checks.

3. `rooms/laboratory/runtime/lab-run-controller.ts:552`
   Current behavior:
   `setStage()` is still a live gate because `[data-lab-stage]` clicks route through `canAdvanceToStage()` and `getStageBlockReason()`.
   Replacement:
   Neutralize `setStage()` early.
   It may continue to emit legacy stage updates for compatibility, but it must not block or unlock behavior.

4. `rooms/laboratory/runtime/lab-run-controller.ts:837`
   Current behavior:
   Clicks on `[data-lab-stage]` still invoke stage routing.
   Replacement:
   Treat this path as legacy-only.
   Either no-op it or convert it into a passive compatibility sync that never determines behavior.

### Compatibility-Only References to Preserve

1. `rooms/laboratory/runtime/lab-store.ts:1229`
   Current behavior:
   Hydration restores persisted `currentStage`.
   Replacement:
   Keep hydration compatibility, but immediately recompute stage from real state through a single projection helper so stale persisted stage cannot win.

2. `rooms/laboratory/runtime/lab-store.ts:1509`
   Current behavior:
   `stage-changed` still mutates `state.currentStage`.
   Replacement:
   Keep the event and field, but route writes through one compatibility sync path or treat `stage-changed` as a passive mirror event.

3. `rooms/laboratory/ui/lab-root.ts:225`
   Current behavior:
   Persisted state still stores `currentStage`.
   Replacement:
   Keep persistence for backward compatibility, but persist the projected legacy value only.

4. `rooms/laboratory/ui/lab-layout.ts:11`
   Current behavior:
   The shell still exposes `data-stage`.
   Replacement:
   Keep the dataset for CSS/tests/automation compatibility, but populate it from projected legacy stage rather than letting it control behavior.

5. `rooms/laboratory/ui/lab-root.ts:321`
   Current behavior:
   Live DOM updates still write `shell.dataset.stage = state.currentStage`.
   Replacement:
   Keep the write, but ensure `state.currentStage` is derived output, not decision input.

## Replacement Strategy

### Core Principle

`LabStage` stays in the type system and state shape, but it becomes a compatibility mirror of real workflow state.
The new control model should be:

1. Intent-based dispatch for analysis flows
2. Condition-based checks for source, process, and report readiness
3. `WorkspaceMode` for high-level presentation state only
4. One-way legacy projection back into `currentStage`

### New Authoritative Inputs

- Source readiness:
  source presence, probe status, source mode, source-specific required fields
- Analysis readiness:
  selected intents, intent-derived capabilities, required tools, preflight state, run state
- Report readiness:
  report payload presence, completed/cancelled/failed run state, exportable report artifacts
- UI presentation:
  `WorkspaceMode`

### Legacy Projection Rule

Add a helper such as `deriveLegacyStage(state)` and make it the only authoritative writer for `currentStage`.
Suggested projection:

- `source`: no usable source or source probe not complete
- `edit`: source is ready and workspace is still preparing or adjusting analysis inputs
- `process`: run is active or queued
- `report`: report payload exists, report overlay is open, or completed run/report output is available

### Tool Relevance Rule

Replace stage-based tool grouping with:

1. Source route relevance:
   local, URL, YouTube, source kind
2. Intent relevance:
   selected intents and their internal capability mapping
3. Capability relevance:
   capability family `requiredTools`
4. WorkspaceMode refinement:
   workspace vs analyzing vs complete only for display emphasis

`stageSupport` may remain in manifests and snapshots, but only as descriptive metadata unless a later cleanup explicitly removes its behavioral influence from producers too.

## Step-by-step Patch Plan (ordered)

1. Add real-state selectors before touching controller logic.
   Files:
   `rooms/laboratory/runtime/lab-selectors.ts`
   Add:
   source/action/report readiness helpers,
   analysis action state helpers,
   tool relevance helpers,
   and `deriveLegacyStage(state)`.
   Reason:
   All downstream rewires depend on a stable non-stage decision API.

2. Make `deriveLegacyStage()` the only intended write path for `currentStage`.
   Files:
   `rooms/laboratory/runtime/lab-store.ts`,
   `rooms/laboratory/ui/lab-root.ts`,
   any controller helpers that currently dispatch `stage-changed`.
   Change:
   Keep hydration, persistence, and `stage-changed`, but immediately normalize legacy stage from real state after hydrate and after key state mutations.
   Dependency:
   Step 1.

3. Neutralize live stage gating early.
   Files:
   `rooms/laboratory/runtime/lab-run-controller.ts`
   Change:
   Remove behavioral dependency from `setStage()` and `[data-lab-stage]` click handling.
   Legacy stage may still sync for compatibility, but this route must no longer block or choose behavior.
   Dependency:
   Step 2.

4. Rewire primary action dispatch away from stage.
   Files:
   `rooms/laboratory/runtime/lab-run-controller.ts`
   Change:
   Replace `switch (state.currentStage)` in `runPrimaryAction()` with explicit condition helpers.
   Cover:
   source prepare/refresh,
   preview generation,
   analysis run/cancel,
   report export.
   Dependency:
   Steps 1-3.

5. Rewire workflow actions so real state changes happen first and legacy stage mirrors second.
   Files:
   `rooms/laboratory/runtime/lab-run-controller.ts`
   Change:
   Update blank-project reset,
   rerun-from-report,
   deep-analysis,
   report toggle/open paths.
   Remove any assumption that stage transition is required before preview, preflight, process, or report actions can happen.
   Dependency:
   Step 4.

6. Replace stage-keyed UI helper logic.
   Files:
   `rooms/laboratory/runtime/lab-run-controller.ts`,
   `rooms/laboratory/runtime/lab-selectors.ts`
   Change:
   Retire `getPrimaryActionState()` and `getPrimaryActionLabel()` as stage-driven authorities.
   Replace them with condition-driven CTA and block-reason helpers.
   Dependency:
   Steps 1-5.

7. Rebuild tool overlay relevance before collapsing legacy stage helpers entirely.
   Files:
   `rooms/laboratory/ui/tool-management-overlay.ts`
   Change:
   Stop reading `state.currentStage` for active/other tool grouping.
   Use source route + intents + capability `requiredTools` + `WorkspaceMode`.
   Keep stage labels/chips only if they are clearly labeled as informational metadata.
   Dependency:
   Steps 1 and 5.

8. Update tool payload derivation and downstream host consumers as one patch slice.
   Files:
   `rooms/laboratory/runtime/lab-run-controller.ts`,
   `rooms/laboratory/shared/host/action-router.ts`,
   `rooms/laboratory/shared/host/tool-mutations.ts`,
   `rooms/laboratory/shared/host/runtime-events.ts`,
   `rooms/laboratory/shared/host/job-runtime.ts`,
   `rooms/laboratory/shared/host/room-tools-progress.ts`,
   related action-runtime/composition wrappers if signatures shift.
   Change:
   Stop making `featureStage` a UI-stage echo.
   Derive job scope and routing from action family, active run context, and explicit process/report semantics.
   Dependency:
   Steps 4-7.

9. Audit `stageSupport` producers so stage metadata stops shaping active tool behavior indirectly.
   Files:
   `rooms/laboratory/shared/host/runtime-bootstrap.ts`,
   `rooms/laboratory/shared/host/room-snapshot.ts`,
   `rooms/laboratory/shared/data/tools/toolchain.manifest.json`
   Change:
   Keep manifest data if needed, but ensure runtime bootstrap/snapshot layers do not make it the authoritative source of what the UI treats as currently actionable.
   Dependency:
   Step 7.

10. Lock compatibility behavior after the control rewrite.
    Files:
    `rooms/laboratory/runtime/lab-store.ts`,
    `rooms/laboratory/ui/lab-layout.ts`,
    `rooms/laboratory/ui/lab-root.ts`
    Change:
    Verify `LabStage`, `currentStage`, `stage-changed`, persistence, and `data-stage` still exist and stay populated from the projected legacy stage.
    Dependency:
    Steps 2-9.

11. Expand regression coverage from source-shape checks into behavioral proof.
    Files:
    `scripts/tests/laboratory-*.test.ts`
    Add tests for:
    primary action resolution without relying on `currentStage`,
    stale hydrated stage being corrected by projection,
    `[data-lab-stage]` no longer gating behavior,
    overlay grouping based on relevance instead of stage,
    tool/event job scope staying correct after `featureStage` decoupling.
    Dependency:
    Steps 1-10.

## Risk Points

1. `setStage()` is still a live compatibility trap.
   If it remains behaviorally active while the new selectors are landing, the system will look partly migrated but still be stage-driven in edge paths.

2. Persisted `currentStage` can override truth unless projection ownership is strict.
   Hydration must not leave stale stage values in charge.

3. `featureStage` is wider than the UI controller.
   Event scope, job scope, and room-tool progress currently infer process/global behavior from it.
   UI decoupling alone is not enough.

4. `stageSupport` is produced upstream, not just consumed in the overlay.
   If producer layers still shape the tool registry around stage semantics, stage coupling survives indirectly.

5. `currentStage` is not purely cosmetic.
   It still feeds persisted state, DOM datasets, boot copy, and likely tests or automation hooks.
   It must stay present, but it must become read-only compatibility output.

6. `WorkspaceMode` coverage must be explicit.
   Loading, incomplete source, running analysis, cancelled run, failed run, and report-ready states need clear fallback rules so stage removal does not create ambiguous CTA behavior.

7. Existing tests skew toward source-shape assertions.
   Without new behavioral tests, the refactor could preserve file structure while still leaving hidden stage control paths alive.

## Verification Targets

- `LabStage` type remains exported
- `currentStage` field remains in store state and persisted state
- `stage-changed` remains part of the event union
- No primary behavior path depends on `state.currentStage`
- No live UI gate depends on `canAdvanceToStage()` or `getStageBlockReason()`
- Tool/job/event scope uses explicit action context rather than UI stage
- Tool overlay groups by relevance, not current stage
- Hydration corrects stale persisted stage through projection
