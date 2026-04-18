# Plan: Forge Room UI Revision Pass 5 Operator Profile Session Manager

**Generated**: 2026-04-17
**Estimated Complexity**: High

## Overview

Revise Forge Room so `Operator Profile`, `Session Management`, and
`Session Context` read as three separate control layers without
rewriting the guided workflow. The pass focuses on surface clarity,
manual profile entry, a centered profile manager, compact session
lifecycle controls, and a scalable run-context selection area.

## Prerequisites

- Forge Room source of truth under `rooms/forge-room/**`
- Existing flow gates, preflight sequencing, selected-context-to-AI
  rules, orchestration, and export behavior stay intact
- Validation commands:
  - `npm run typecheck`
  - targeted Forge UI/runtime tests when relevant

## Sprint 1: Align Contracts

**Goal**: Move profile and session data contracts to the new UI model
without changing workflow logic.
**Demo/Validation**:

- Types compile with manual profile records and session-local run fields.
- Existing runtime still hydrates current sessions and profiles.

### Task 1.1: Redefine Operator Profile Records

- **Location**:
  `rooms/forge-room/shared/types/forge-preflight.ts`,
  `rooms/forge-room/host/forge-operator-profile-storage.ts`,
  `rooms/forge-room/shared/ui/host-messages.ts`
- **Description**: Replace catalog-key-only records with manual-entry
  profile records that store `label`, controlled enum value, optional
  `notes`, and optional `brandModel` for equipment.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - Skills store `label`, `level`, `notes?`
  - Equipment stores `label`, `status`, `brandModel?`, `notes?`
  - Profile no longer stores `mode` or `riskTolerance`
- **Validation**:
  - `npm run typecheck`

### Task 1.2: Move Mode And Risk To Session-Local Overrides

- **Location**:
  `rooms/forge-room/shared/types/forge-preflight.ts`,
  `rooms/forge-room/shared/ui/request-runtime.ts`,
  `rooms/forge-room/host/runtime.ts`,
  `rooms/forge-room/host/state/forge-runtime-state.ts`
- **Description**: Extend run-local override shape so `mode`,
  `riskTolerance`, notes, temporary conditions, and pre-analysis stay in
  the session layer.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Session-local controls can persist and reload
  - Profile payload no longer sends mode/risk
  - Selected run context can still influence AI context through the
    existing selected-only rule
- **Validation**:
  - `npm run typecheck`

### Task 1.3: Update Selected Context Selection Shape

- **Location**:
  `rooms/forge-room/shared/types/forge-preflight.ts`,
  `rooms/forge-room/host/runtime.ts`,
  `rooms/forge-room/host/state/forge-runtime-state.ts`
- **Description**: Make session context selection reference profile
  record ids for skills and equipment, and dedicated session-local
  fields for mode/risk/pre-analysis/notes.
- **Complexity**: 7
- **Dependencies**: Tasks 1.1, 1.2
- **Acceptance Criteria**:
  - Selection state scales beyond hardcoded catalog keys
  - Reconciliation prunes removed records safely
- **Validation**:
  - `npm run typecheck`

## Sprint 2: Rebuild Profile Persistence And Context Metadata

**Goal**: Keep profile persistence compatible while making preflight and
signature logic consume the new selected records.
**Demo/Validation**:

- Profile save/load works with manual labels and equipment brand/model.
- Preflight metadata still only reflects selected run context.

### Task 2.1: Normalize Legacy Profile Data Into Manual Records

- **Location**:
  `rooms/forge-room/host/forge-operator-profile-storage.ts`,
  `rooms/forge-room/shared/ui/host-messages.ts`
- **Description**: Migrate legacy catalog-based skill/equipment and
  profile preferences into the new record shape with deterministic label
  defaults.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Existing stored profiles remain readable
  - Removed profile preferences do not break hydration
  - Equipment can carry `brandModel` after migration
- **Validation**:
  - `npm run typecheck`

### Task 2.2: Rework Selected Operator Metadata Builders

- **Location**:
  `rooms/forge-room/host/forge-preflight-metadata.ts`,
  `rooms/forge-room/host/forge-run-signature.ts`,
  `rooms/forge-room/host/forge-preflight-invalidation.ts`
- **Description**: Make selected-context summaries, signatures, and
  invalidation rules use manual profile labels and session-local mode/risk.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - AI prompt context still receives selected context only
  - Manual labels appear in summaries
  - Session-local mode/risk influence signatures through run override,
    not persistent profile
- **Validation**:
  - `npm run typecheck`

## Sprint 3: Redesign The Main Workbench Surface

**Goal**: Make the main run screen read as a control surface with a
clearer separation between goal work, session lifecycle, and run
context.
**Demo/Validation**:

- Directional helper labels disappear
- Session management is visible and compact
- Session context becomes dense, scrollable, and selection-only

### Task 3.1: Remove Directional And Duplicate UI Labels

- **Location**:
  `rooms/forge-room/ui/forge-room-ui-runtime.ts`,
  `rooms/forge-room/i18n/en.json`,
  `rooms/forge-room/i18n/tr.json`
- **Description**: Remove `Left`, `Center`, `Right`, `SOL`, `ORTA`,
  `SAG`, and duplicate profile entry copy that no longer adds meaning.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Layout communicates itself without directional helper text
  - Topbar remains the only Operator Profile launch point
- **Validation**:
  - UI smoke check

### Task 3.2: Add Compact Session Management Panel

- **Location**:
  `rooms/forge-room/ui/panels/goal-input-panel.ts`,
  `rooms/forge-room/ui/forge-room-ui-runtime.ts`,
  `rooms/forge-room/ui/style.css`,
  `rooms/forge-room/i18n/en.json`,
  `rooms/forge-room/i18n/tr.json`
- **Description**: Introduce a compact session lifecycle block with
  `New session`, `Save session`, `Delete session`, and `Open saved
session`, plus a short saved-session list and selected-session info.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Session management is separate from the goal form
  - Goal panel no longer carries this responsibility implicitly
- **Validation**:
  - `npm run typecheck`

### Task 3.3: Rebuild Session Context As A Dense Selection Surface

- **Location**:
  `rooms/forge-room/ui/panels/goal-input-panel.ts`,
  `rooms/forge-room/ui/style.css`
- **Description**: Replace large record cards and embedded profile
  management cues with compact, scrollable chips grouped under
  `Skills`, `Equipment`, and session-local categories.
- **Complexity**: 8
- **Dependencies**: Tasks 1.1, 1.2, 1.3
- **Acceptance Criteria**:
  - Main screen selection area scales vertically
  - Session context does not contain profile CRUD controls
  - Run-specific mode/risk/pre-analysis/notes stay visible but clearly
    session-local
- **Validation**:
  - UI smoke check

## Sprint 4: Rebuild Operator Profile Manager

**Goal**: Turn profile management into a centered, scalable overlay that
supports manual entry and auto-save.
**Demo/Validation**:

- Opening profile manager shows a centered overlay
- Skills and equipment can be added manually
- Closing the panel persists dirty changes

### Task 4.1: Replace Drawer Layout With Centered Profile Overlay

- **Location**:
  `rooms/forge-room/ui/panels/operator-profile-manager-panel.ts`,
  `rooms/forge-room/ui/forge-room-ui-runtime.ts`,
  `rooms/forge-room/ui/style.css`
- **Description**: Convert the current side drawer into a broader modal
  overlay with enough room for profile record editing and future growth.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Overlay is centered and roomy
  - Background dimming clarifies modal state
  - Main surface remains visible but secondary
- **Validation**:
  - UI smoke check

### Task 4.2: Replace Catalog Dropdown Entry With Manual Record Editors

- **Location**:
  `rooms/forge-room/ui/panels/operator-profile-manager-panel.ts`,
  `rooms/forge-room/ui/forge-room-ui-runtime.ts`,
  `rooms/forge-room/i18n/en.json`,
  `rooms/forge-room/i18n/tr.json`
- **Description**: Remove fixed skill/equipment dropdown entry and add
  manual fields:
  skill = `label`, `level`, `notes?`
  equipment = `label`, `status`, `brandModel?`, `notes?`
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Manual labels are accepted
  - Enums remain controlled
  - Equipment editor exposes `brandModel`
- **Validation**:
  - `npm run typecheck`

### Task 4.3: Remove Save Button And Add Auto-Save Behavior

- **Location**:
  `rooms/forge-room/ui/forge-room-ui-runtime.ts`,
  `rooms/forge-room/ui/panels/operator-profile-manager-panel.ts`
- **Description**: Drop the explicit `Save profile` button and persist
  dirty draft state when the profile panel closes. Debounce is optional,
  but close-time save is required.
- **Complexity**: 6
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Dirty profile edits persist on close
  - Panel footer keeps only relevant control actions
- **Validation**:
  - UI interaction smoke check

## Sprint 5: Verify And Report

**Goal**: Validate the pass against protected workflow behavior and the
required delivery report.
**Demo/Validation**:

- Typecheck passes
- Targeted Forge tests pass or known gaps are reported
- Final report matches requested headings

### Task 5.1: Run Focused Validation

- **Location**:
  `rooms/forge-room/**`
- **Description**: Run typecheck and any targeted Forge tests needed to
  validate host/session/profile changes.
- **Complexity**: 4
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Broken contracts are caught before final report
  - Any skipped tests are explicitly called out
- **Validation**:
  - `npm run typecheck`
  - targeted Forge suite(s) if available

### Task 5.2: Produce Requested Delivery Report

- **Location**: Final response
- **Description**: Summarize completed work under the required headings:
  Operator Profile button changes, centered panel changes, manual entry,
  auto-save, brandModel, session management, session context redesign,
  moved mode/risk, removed labels, remaining UX risks.
- **Complexity**: 2
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Report structure matches the requested list
  - Remaining UX risks are honest and specific

## Testing Strategy

- Prefer `npm run typecheck` as the baseline contract check
- If targeted Forge tests are available, run the smallest suites that
  cover:
  - profile persistence
  - session save/load
  - selected context metadata
  - UI smoke for panel structure

## Potential Risks & Gotchas

- Legacy profile migration may need careful defaults so existing saved
  data does not disappear unexpectedly
- Selected-context reconciliation must remove deleted profile records
  without leaving stale preflight state behind
- Auto-save on close should not create duplicate writes or regress panel
  close behavior
- Deleting sessions requires confirming the existing command surface or
  adding a minimal host command
- Manual labels improve flexibility but remove catalog ordering, so UI
  sorting should stay stable and readable

## Rollback Plan

- Revert changed Forge Room files in one patch set if validation fails
- Keep schema migration logic additive where possible so legacy payloads
  still hydrate during rollback
