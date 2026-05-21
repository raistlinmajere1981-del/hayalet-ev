# Plan: Laboratory Execution Transparency Layer

**Generated**: 2026-04-23
**Estimated Complexity**: Medium

## Overview
Add a UI-only transparency revision to the Laboratory workspace so the user can see:
- what selected intents will do before starting analysis
- which capability families and modules are executing during a run
- which module is currently running
- softer failure wording when one module fails but the workflow continues

The scope is intentionally limited to visibility and null-safety:
- harden `.slice(` usage in `rooms/laboratory/ui/workspace-process-panel.ts`, `rooms/laboratory/ui/report-overlay.ts`, and `rooms/laboratory/runtime/lab-selectors.ts`
- add pre-run intent preview content in `rooms/laboratory/ui/workspace-surface.ts`
- add an intent -> capability -> module execution map in `rooms/laboratory/ui/workspace-process-panel.ts`
- add `getActiveModule(state)` in `rooms/laboratory/runtime/lab-selectors.ts`
- keep backend state, run orchestration, and persisted state unchanged, except for freezing already-selected `intentIds` into the existing `analysisScope` snapshot because no other frozen run field carries user intent choice today

## Review Addendum
- The execution map cannot assume `getModuleIdsForCapabilityFamily(...)` directly matches the current run payload. Laboratory runs expose transport modules such as `motion`, `visual-signal`, `audio`, and `report`, while some lower-level module metadata is currently dropped during UI normalization.
- During and after a run, the map must prefer frozen `run.analysisScope` / `getRunSnapshotSummary(state)` over live `selectedIntents`, then show workspace drift separately.
- The no-run process panel already exists; implementation should replace the source-ready empty body rather than remounting the whole panel flow.
- The stricter `sourceReady` rule currently lives in `workspace-surface.ts`; process-side transparency should reuse that exact gating signal.
- Existing intent execution UI already lives in the snapshot block; the new map should extend or replace that seam, not duplicate it beside the current section.
- Validation must include controller/UI alignment and frozen-snapshot vs live-intent drift coverage in addition to source UI regressions.

## Prerequisites
- Treat `rooms/laboratory/**` as the only source of truth; do not hand-edit `data/rooms/laboratory/**`.
- Keep the change UI-only: no new state shape, no run lifecycle change, and no host/runtime contract change beyond preserving frozen `intentIds` inside the existing `analysisScope` snapshot.
- Reuse existing intent/capability/module metadata from `rooms/laboratory/domain/lab-types.ts`.
- Reuse current run projection seams where possible; if transport-module metadata is needed for accurate mapping, preserve it from existing run data instead of inventing new UI state.
- Guard every targeted `.slice(` call against sparse snapshot, report, and run payloads.
- Validate with room-local typecheck plus targeted laboratory regressions.

## Sprint 1: Defensive Rendering Foundation
**Goal**: Make the affected selectors and renderers safe against missing string/array fields before adding new visibility layers.
**Demo/Validation**:
- Sparse `run`, `report`, and snapshot payloads render without throwing.
- Existing Laboratory UI regressions still pass with partial state fixtures.

### Task 1.1: Replace unsafe `.slice(` calls in the requested files
- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`, `rooms/laboratory/ui/report-overlay.ts`, `rooms/laboratory/runtime/lab-selectors.ts`
- **Description**: Audit every `.slice(` call in the three requested files and wrap it with the correct null-safe fallback:
  - string usage: `(value ?? "").slice(...)`
  - array usage: `Array.isArray(value) ? value.slice(...) : []`
  Include `run.id`, module traces, visible artifacts/findings, raw logs, event feeds, preview artifacts, comparison variants, and report-group excerpts where payloads can be sparse.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - No targeted `.slice(` call assumes a string or array exists.
  - Rendering still produces the same user-visible subset sizes when data is present.
  - Missing run/report fields degrade to empty strings or empty arrays instead of throwing.
- **Validation**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - Add sparse-payload assertions for missing `run.id`, trace arrays, and report-group arrays

### Task 1.2: Add a pure active-module selector
- **Location**: `rooms/laboratory/runtime/lab-selectors.ts`, `scripts/tests/laboratory-stage-decoupling-regressions.test.ts`
- **Description**: Add `getActiveModule(state)` that returns the first running module from `run.moduleOrder`, or `null` if no running module exists. Keep the selector pure and derived entirely from existing `state.run` data.
- **Complexity**: 3
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Returns the first module where `status === "running"`.
  - Returns `null` when `run` is absent or no running module exists.
  - Does not add new state or mutate existing run data.
- **Validation**:
  - Add selector-level assertions for running, completed-only, and no-run cases

### Task 1.3: Seed regression coverage for sparse Laboratory UI state
- **Location**: `scripts/tests/laboratory-source-ui-regressions.test.ts`, `scripts/tests/laboratory-runtime-truth-regressions.test.ts`
- **Description**: Extend the current Laboratory regression fixtures so renderers receive incomplete `run`, `reports`, and workspace snapshot data. This locks in the “never assume snapshot fields exist” rule before new UI is layered on top.
- **Complexity**: 5
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - At least one regression renders the process panel with a missing/blank run id.
  - At least one regression renders the report overlay with missing trace and grouped arrays.
  - Selector coverage proves `getActiveModule(state)` is reactive to status changes.
- **Validation**:
  - Targeted laboratory UI and selector tests pass

### Task 1.4: Preserve or reconstruct capability-relevant run metadata
- **Location**: `rooms/laboratory/runtime/lab-store.ts`, `rooms/laboratory/domain/lab-types.ts`, `rooms/laboratory/shared/host/process-report-state.ts`
- **Description**: Before building the execution map, make sure the UI layer still has enough run-module information to map transport modules back to capability families. Prefer preserving existing host-side metadata from normalized process modules; where the live event path cannot provide it, add a transport-module fallback map without changing backend contracts.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The UI can associate `motion`, `visual-signal`, and `audio` style transport modules with capability families.
  - No backend payload contract is changed.
  - Live event-only runs still produce a stable fallback mapping.
- **Validation**:
  - Add a regression covering hydrated process-record modules and a live event-only run

## Sprint 2: Pre-Run Transparency
**Goal**: Show what the selected intents will do before the user presses the analysis button.
**Demo/Validation**:
- When `sourceReady` is true, the side rail shows a preview card above the analysis CTA.
- When no intent is selected, the preview clearly asks the user to select one.

### Task 2.1: Add `renderIntentPreview(intentIds)` with static intent descriptions
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/domain/lab-types.ts`
- **Description**: Create a pure render helper that maps intent ids to the requested UX copy using a shared intent metadata seam rather than a second disconnected catalog:
  - `visual-inspection` -> `Görsel yapı ve anomaliler analiz edilir`
  - `audio-investigation` -> `Ses sinyali ve anomaliler analiz edilir`
  - `detail-enhancement` -> `Görüntü detayları iyileştirilir`
  - `anomaly-detection` -> `Olası anormallikler tespit edilir`
  The helper should also append the static “Beklenen çıktılar” list.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The preview card renders only from selected intent ids.
  - No backend data is required.
  - The card includes both “Bu analiz şunları yapacak:” and “Beklenen çıktılar:” sections.
- **Validation**:
  - HTML assertions in `scripts/tests/laboratory-source-ui-regressions.test.ts`

### Task 2.2: Mount the preview above the analysis button without changing CTA logic
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Insert the preview panel above the existing deep-analysis CTA, gated by the existing strict `sourceReady` computation already used by the workspace surface. Preserve the existing report button flow and keep the CTA behavior unchanged.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - The preview appears only when `sourceReady`.
  - If no intents are selected, it shows `Analiz için intent seçin`.
  - Existing analysis buttons and report freshness indicators stay in their current order and remain functional.
- **Validation**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - Manual smoke for source-ready and source-not-ready states

### Task 2.3: Add focused preview styling that fits the existing right-panel language
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Add compact styles for the preview card, list spacing, headings, and empty state so the new block reads as supporting guidance instead of a second dominant panel.
- **Complexity**: 3
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - The preview remains compact above the CTA.
  - Long intent lists wrap cleanly inside the existing process/CTA column.
  - Mobile and narrower widths do not overflow the right panel.
- **Validation**:
  - Manual review at desktop and narrow right-panel widths

## Sprint 3: In-Run Intent -> Execution Transparency
**Goal**: Expose how selected intents resolve into capability families and module execution states during a run.
**Demo/Validation**:
- The process area shows intent -> capability -> module mapping in source-ready states.
- Running and failed modules are easier to interpret without touching backend status values.

### Task 3.1: Refactor process-side composition for source-ready no-run states
- **Location**: `rooms/laboratory/ui/workspace-surface.ts`, `rooms/laboratory/ui/workspace-process-panel.ts`
- **Description**: Replace the current source-ready / no-run empty panel body with a transparency state, while keeping the existing panel mount point intact. Pass the already computed strict `sourceReady` signal into the process panel so the new map obeys the same readiness rule as the analysis CTA.
- **Complexity**: 6
- **Dependencies**: Sprint 1, Sprint 2
- **Acceptance Criteria**:
  - Source-ready / no-run state can show the new execution map area.
  - Non-source-ready state still stays minimal and does not expose process UI early.
  - No new placeholder run object is introduced.
- **Validation**:
  - Add a regression for `sourceReady === true` with no run

### Task 3.2: Implement `renderIntentExecutionMap(state)`
- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`, `rooms/laboratory/domain/lab-types.ts`
- **Description**: Build a new visual-only section that renders per selected intent:
  - intent label
  - resolved capabilities
  - modules under each capability with localized statuses
  Extend the current snapshot execution seam instead of adding a second competing section. Resolve capability families from frozen run intent ids when a run exists, otherwise from the live workspace selection. Resolve module rows from `run.modules` and preserved transport-module metadata first, then fall back to a room-local transport-module projection where necessary.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The section always renders when `sourceReady`.
  - If no run exists, it shows `Henüz yürütme yok`.
  - Status labels map to:
    - `running` -> `çalışıyor`
    - `completed` / `ready` -> `tamamlandı`
    - `failed` -> `tamamlanamadı`
    - `queued` -> `bekliyor`
  - The section is read-only and adds no new interaction.
- **Validation**:
  - `scripts/tests/laboratory-source-ui-regressions.test.ts`
  - Add HTML assertions for no-run, running, queued, completed, ready, and failed module rows

### Task 3.3: Add the active-module header line and UI-only soft-fail copy
- **Location**: `rooms/laboratory/ui/workspace-process-panel.ts`, `rooms/laboratory/ui/lab-theme.css`
- **Description**: Use `getActiveModule(state)` in the process header to show `Çalışan modül: {module title}` when a running module exists. Localize visible failed labels in the panel to `Tamamlanamadı` and attach the tooltip `Bu modül çalışmadı, diğerleri devam ediyor`, while leaving raw status values untouched for runtime logic and CSS hooks.
- **Complexity**: 5
- **Dependencies**: Task 1.2, Task 3.2
- **Acceptance Criteria**:
  - Header updates as streaming events change the running module.
  - If no module is running, the extra header line disappears cleanly.
  - Failure wording changes only in UI copy, not in backend state.
- **Validation**:
  - Selector assertion for active-module changes
  - HTML assertions for active header text and failed-module tooltip

### Task 3.4: Keep process-panel density under control after adding the map
- **Location**: `rooms/laboratory/ui/lab-theme.css`
- **Description**: Extend the process-panel styles so the new map fits within the existing max-height/scroll behavior, uses readable nesting, and does not crowd the current snapshot/findings/artifacts sections.
- **Complexity**: 4
- **Dependencies**: Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - The panel remains scannable at current `max-height`.
  - Nested capability/module rows remain readable on narrow widths.
  - Added content does not break existing section scroll behavior.
- **Validation**:
  - Manual smoke with long module lists and active findings/artifacts

## Sprint 4: Verification And Parity Closeout
**Goal**: Prove the change stays UI-only, null-safe, and compatible with existing room packaging workflows.
**Demo/Validation**:
- Typecheck and targeted regressions pass.
- The workspace room remains the source of truth and shipped parity risk is understood.

### Task 4.1: Run targeted room checks
- **Location**: Workspace root
- **Description**: Run the smallest useful validation set for the affected UI slice and selectors.
- **Complexity**: 2
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - `rooms/laboratory` typechecks cleanly.
  - Targeted UI regressions pass.
  - No backend/runtime test failures are introduced by UI-only changes.
- **Validation**:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:file scripts/tests/laboratory-source-ui-regressions.test.ts scripts/tests/laboratory-stage-decoupling-regressions.test.ts scripts/tests/laboratory-ui-evaluation-regressions.test.ts`

### Task 4.2: Confirm room-package expectations if shipped parity is required
- **Location**: `rooms/laboratory/**`, `data/rooms/laboratory/**`, `scripts/tests/laboratory-media-edit-installed-parity-regressions.test.ts`, `scripts/tests/laboratory-media-profile-installed-parity-regressions.test.ts`
- **Description**: If the implementation flow refreshes the installed room copy, run the room build/sync step and verify parity-sensitive regressions. Keep this conditional so the change remains anchored to the workspace copy as the source of truth.
- **Complexity**: 3
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - No manual dual-editing of workspace and installed copies occurs.
  - If a room sync is triggered, parity-sensitive regressions stay green.
- **Validation**:
  - `npm run rooms:build` when installed copy refresh is required
  - Targeted installed-parity regressions when that sync happens

## Testing Strategy
- Add sparse-state regressions first so null-safety failures are caught before UX work lands.
- Re-run `scripts/tests/laboratory-source-ui-regressions.test.ts` after each UI sprint because it already covers `renderWorkspaceSurface`, `renderWorkspaceProcessPanel`, and `renderReportOverlay`.
- Use `scripts/tests/laboratory-stage-decoupling-regressions.test.ts` for selector-level behavior such as `getActiveModule(state)`.
- Use `scripts/tests/laboratory-runtime-truth-regressions.test.ts` to lock frozen snapshot truth versus live workspace drift.
- Run `scripts/tests/laboratory-ui-evaluation-regressions.test.ts` once the markup and right-panel composition settle.
- Add at least one controller/UI alignment test so selected intents resolve to the same effective capability view as the workbench prepared by `lab-run-controller.ts`.
- Finish with `npm run rooms:typecheck` and, only if room sync is performed, `npm run rooms:build`.

## Potential Risks & Gotchas
- The current no-run process panel already exists in `workspace-surface.ts`; the risky part is replacing its source-ready empty state without accidentally exposing process UI for mismatched sources.
- The runtime type exposes `title` and `id` on `LabModuleState`, not `name`; the header should prefer `module.title || module.id` unless the runtime contract is expanded later.
- Intent-to-capability mapping is many-to-many, so shared capability families may appear under multiple intents. That duplication is acceptable unless product wants deduplication later.
- Capability order and module order can drift if the run payload is partial. Prefer `run.moduleOrder` and preserved run-module metadata when present, then use a constrained transport-module fallback map.
- The execution map must not describe live intent edits as if they belonged to the active run; frozen run scope remains the source of truth and workspace drift stays separate.
- The request only defines localized labels for `running`, `completed`, `failed`, and `queued`; keep every other runtime status on a neutral fallback instead of changing backend enums.
- The process panel already has a capped height; new nested rows may require careful spacing and overflow handling to avoid pushing out findings/artifacts visibility.
- Report-overlay regressions may need fixture updates if null-safety changes alter previously assumed string suffixes or excerpt counts.

## Rollback Plan
- Revert sprint-by-sprint, starting with the process-panel composition changes if they create layout regressions.
- Because the scope is UI-only, rollback should not require data migration or backend cleanup.
- Keep selector additions pure so they can be removed independently from markup/styling if necessary.
