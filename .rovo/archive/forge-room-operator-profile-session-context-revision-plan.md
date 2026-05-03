# Plan: Forge Room Operator Profile / Session Context Revision

**Generated**: 2026-04-17
**Estimated Complexity**: High

## Overview
Separate Forge Room's persistent operator profile from run-local session context without rewriting the guided workflow. The revision will replace the current fixed-field/null-placeholder model with a catalog-driven profile system, move profile CRUD into a dedicated manager opened from the top bar, keep session context as a selection-only surface on the main run screen, and make preflight/export/signature logic consume only the records selected for the current run.

The plan also includes showing the operator's nickname and avatar inside the Operator Profile Manager by reading the new centralized room presence payload instead of maintaining a Forge-local identity source.

## Assumptions
- Nickname and avatar are presence-backed identity data shown inside the Operator Profile Manager, not persisted into `operator-profile.json` unless implementation uncovers a hard dependency.
- `rooms/forge-room` remains the only editable source tree. `data/rooms/forge-room` must only be refreshed through the existing room install/sync flow.
- One persisted record exists per catalog key. A skill or equipment item is either absent or present with a meaningful enum value; duplicate records for the same key are out of scope.
- Minimum run override scope replaces the hardcoded `hotAir` override with generic temporary conditions, notes, and pre-analysis state.
- During rollout, Forge can read legacy `host-context.user` as a temporary fallback, but `host-context.presence.user` becomes the preferred identity source.

## Prerequisites
- Existing Forge room host/UI/preflight flow in `rooms/forge-room/**`
- Central presence source in [src/js/modules/rooms/room-presence.ts](/home/raistlin/hayalet-ev/src/js/modules/rooms/room-presence.ts), [src/js/pages/room-page/runtime-context.ts](/home/raistlin/hayalet-ev/src/js/pages/room-page/runtime-context.ts), and [src/js/modules/rooms/room-host-runtime.ts](/home/raistlin/hayalet-ev/src/js/modules/rooms/room-host-runtime.ts)
- Targeted regression coverage under `scripts/tests/forge-room-*.test.ts`
- Validation commands:
  - `npm run typecheck`
  - targeted `node --test` Forge regression suites

## Sprint 1: Define Catalogs And V2 Contracts
**Goal**: Establish the new catalog-driven operator profile and session context contracts before touching UI behavior.
**Demo/Validation**:
- Type definitions compile without changing task/dispatch logic.
- Catalog and normalization tests pass with both empty and migrated legacy data.

### Task 1.1: Add Forge Operator Catalog Modules
- **Location**: `rooms/forge-room/shared/data/forge-operator-skills-catalog.ts`, `rooms/forge-room/shared/data/forge-operator-equipment-catalog.ts`, optional `rooms/forge-room/shared/data/forge-operator-preferences-catalog.ts`, `rooms/forge-room/shared/data/index.ts`
- **Description**: Introduce room-aware catalogs for skills, equipment, and preference descriptors. Seed Forge with `soldering`, `measurement`, `mechanical`, `multimeter`, `soldering_iron`, `hot_air`, `bench_supply`, and `magnification`, but keep the structure extensible with `applicableRooms`, grouping, and optional descriptions.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Repair-room-specific labels are no longer the source of truth for profile fields.
  - Catalog entries expose stable keys and localized label lookup hooks.
  - Catalog helpers can filter entries for Forge now and other rooms later.
- **Validation**:
  - Add or update a small unit test covering seed keys and room filtering behavior.
  - `npm run typecheck`

### Task 1.2: Introduce V2 Operator Profile And Session Context Types
- **Location**: `rooms/forge-room/shared/types/forge-preflight.ts`, `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/shared/types/index.ts`, `rooms/forge-room/shared/forge-constants.ts`
- **Description**: Replace the fixed nullable field matrix with explicit entry collections and selection structures. Define new enums for skill levels (`none`, `basic`, `intermediate`, `advanced`), equipment status (`unavailable`, `available`, `planned`), and preferences (`learn_first`, `result_first`, `low`, `medium`, `high`) while preserving a clean absent-vs-present distinction.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `ForgeOperatorProfile` can represent zero records without null placeholders.
  - `ForgeSessionContextSelection` expresses selected record keys instead of a boolean matrix tied to hardcoded fields.
  - `ForgeRunOverride` supports `temporaryConditions`, `notes`, and `enableRovoPreAnalysis` without hardcoded tool toggles.
  - Schema versions are bumped intentionally for profile/session persistence.
- **Validation**:
  - `npm run typecheck`
  - Add helper tests for empty-state and non-empty-state predicates.

### Task 1.3: Add Legacy-To-V2 Normalization Helpers
- **Location**: `rooms/forge-room/host/forge-operator-profile-storage.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`, optional helper module under `rooms/forge-room/host/`
- **Description**: Create migration helpers that can read the current schema-1 profile payload and schema-5 session payload, map them into the new contract, and resave in v2/v6 format on write. Write an explicit migration matrix for legacy `skill.level`, per-skill `none|basic|good`, boolean tool flags, and the current `runOverride.tools.hotAir` seam before implementation starts.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Legacy `null` fields become absent records.
  - Legacy session context booleans become selected key collections.
  - Legacy per-skill `none|basic|good` values have deterministic target mappings in the new enum set.
  - Legacy global `skill.level` has an explicit migration outcome with rationale, even if that outcome is to drop the field.
  - Legacy run override `tools.hotAir` becomes a generic temporary condition or is safely dropped with a deterministic migration rule.
- **Validation**:
  - Update storage regression tests for migration behavior.
  - Add targeted cases for `beginner`, `good`, and removed global `skill.level`.
  - `npm run typecheck`

## Sprint 2: Rewire Persistence, Host Commands, And Session State
**Goal**: Make the host runtime, session persistence, and UI command payloads consume the new contracts without changing the guided workflow stages.
**Demo/Validation**:
- Profile save/load and session save/load work with the new schema.
- Changing selected context or run overrides still invalidates preflight correctly.

### Task 2.1: Refactor Profile Persistence To CRUD-Friendly Snapshots
- **Location**: `rooms/forge-room/host/forge-operator-profile-storage.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Update profile load/save logic to persist catalog-backed skill/equipment/preference records. Keep the command surface simple by allowing the UI to submit a normalized full snapshot, even though the screen itself behaves like CRUD.
- **Complexity**: 6
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Saving a profile never writes placeholder `"not set"` or equivalent values.
  - Deleting a record removes it entirely from persistence.
  - The run signature refresh path still reacts to profile changes.
- **Validation**:
  - Update `scripts/tests/forge-room-preflight-v2-regressions.test.ts`
  - `npm run typecheck`

### Task 2.2: Refactor Session Context And Run Override Persistence
- **Location**: `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/host/forge-session-storage.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Store run-local selection and overrides using the new key-based context model plus structured temporary conditions. Replace hardcoded `tools.hotAir` assumptions throughout the session payload.
- **Complexity**: 7
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Session reload preserves selected skill/equipment/preference keys.
  - Run overrides persist `temporaryConditions`, `notes`, and pre-analysis state.
  - Preflight invalidation still fires when selection or overrides change.
- **Validation**:
  - Update `scripts/tests/forge-room-session-storage-regressions.test.ts`
  - Update targeted runtime-flow tests that assert invalidation behavior

### Task 2.4: Reconcile Selected Context And Legacy Preflight On Hydrate
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/host/forge-preflight-invalidation.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`
- **Description**: Add a reconciliation pass that prunes run-local selected keys which no longer exist in the persisted profile or active catalog, then handles legacy preflight bundles during session reopen by either migrating them to the new shape or invalidating them into a stale/null state that forces rerun.
- **Complexity**: 6
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - Deleting a persistent profile record removes or invalidates any stale run-local selection that still references it.
  - Session hydrate never trusts a legacy preflight bundle silently; it is migrated intentionally or reset with a rerun requirement.
  - Reopening a legacy session leaves the room in a deterministic, explainable state.
- **Validation**:
  - Update `scripts/tests/forge-room-session-storage-regressions.test.ts`
  - Update `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - Add a reopen-session regression for legacy preflight invalidation or migration

### Task 2.3: Update UI Command And Request Contracts
- **Location**: `rooms/forge-room/shared/forge-constants.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Align request/runtime payloads with the new profile, session context, and run override shapes. Keep command names stable if possible to minimize room host churn.
- **Complexity**: 5
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - `updateOperatorProfile`, `updateSessionContext`, and `updateRunOverride` no longer expect fixed-field payloads.
  - UI and host can exchange the new shapes without fallback field leakage.
- **Validation**:
  - `npm run typecheck`
  - UI smoke test expectations updated for new payloads

## Sprint 3: Update Preflight, Run Signature, And Export Provenance
**Goal**: Ensure only selected operator records and run-local overrides influence preflight, signatures, and handoff provenance.
**Demo/Validation**:
- Preflight prompt includes only selected records.
- Unselected profile entries do not alter the prompt, signature, or provenance snapshot.

### Task 3.1: Build Selected Operator Context From Catalog-Backed Records
- **Location**: `rooms/forge-room/host/forge-preflight-metadata.ts`
- **Description**: Replace the field-by-field selection builder with a key-driven assembler that resolves selected records from the persisted profile, applies room-aware catalog labels, and emits concise summaries without placeholders.
- **Complexity**: 7
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - No unselected or nonexistent profile records appear in selected context output.
  - Equipment summaries use the new status enum.
  - Preferences are included only when explicitly selected.
- **Validation**:
  - Update `scripts/tests/forge-room-preflight-v2-regressions.test.ts`
  - `npm run typecheck`

### Task 3.2: Rework Derived Constraints, Signatures, And Provenance For V2
- **Location**: `rooms/forge-room/host/forge-preflight-metadata.ts`, `rooms/forge-room/host/forge-run-signature.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`, `rooms/forge-room/host/forge-handoff-export.ts`, `rooms/forge-room/host/forge-preflight-invalidation.ts`
- **Description**: Update fingerprinting, derived constraints, warning summaries, and export provenance so they reflect the new selected record model and generic run overrides. Sort keys before hashing so record order does not cause noisy signature churn.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Run signatures remain stable for semantically identical selections.
  - Preflight warnings and provenance summaries stay human-readable.
  - Temporary conditions and notes can influence derived constraints without reviving one-off tool toggles.
- **Validation**:
  - `scripts/tests/forge-room-preflight-v2-regressions.test.ts`
  - `scripts/tests/forge-room-task-runtime-regressions.test.ts`

### Task 3.3: Preserve Selected-Only Prompt Semantics Across Runtime Flows
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`
- **Description**: Verify that draft generation, response dispatch, synthesis, and handoff flows continue using the selected-only context and the migrated run override shape.
- **Complexity**: 5
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Existing workflow stages still execute in the same order.
  - No stage reintroduces full-profile leakage into prompt context.
- **Validation**:
  - Targeted Forge runtime regression suites
  - `npm run typecheck`

## Sprint 4: Add A Presence-Backed Operator Profile Manager
**Goal**: Move profile CRUD out of the main run panel and into a dedicated manager opened from the Forge top bar/status area.
**Demo/Validation**:
- A visible `Operator Profile` action opens a compact manager.
- The manager shows nickname/avatar from centralized presence and supports add/edit/remove flows.

### Task 4.1: Extend Forge UI Context With Presence Identity
- **Location**: `rooms/forge-room/shared/ui/state.ts`, `rooms/forge-room/shared/ui/host-messages.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Add `userAvatar` and, if useful, a small presence view-model to Forge UI context by reading `host-context.presence.user` first and falling back to legacy `host-context.user` during rollout. Keep this identity path separate from the persisted operator profile.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - Forge UI updates when centralized presence nickname/avatar changes.
  - Presence-backed identity wins over legacy `user` payloads when both are present.
  - No Forge-local fallback becomes the new source of truth for identity.
- **Validation**:
  - Update or add a UI smoke test that emits `host-context` with `presence`
  - Add a compatibility test for legacy `host-context.user`
  - `npm run typecheck`

### Task 4.2: Add Topbar Launch Action For Operator Profile
- **Location**: `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/ui/style.css`
- **Description**: Add a small but visible `Operator Profile` action in the top status area. Opening this action should reveal a modal or drawer dedicated to profile management.
- **Complexity**: 4
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - The main run screen no longer depends on an embedded profile editor to access profile CRUD.
  - The launch action stays visible in the guided workbench shell.
  - Opening the manager does not require an active Forge session.
- **Validation**:
  - UI smoke assertions for launch button presence and open/close behavior

### Task 4.3: Split Out A Dedicated Operator Profile Manager Component
- **Location**: `rooms/forge-room/ui/panels/operator-profile-manager-panel.ts` or equivalent new module, `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/style.css`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`
- **Description**: Replace the current inline editor with a compact management UI that behaves like a record manager: list rows, visible add/edit/remove actions, compact grouped sections for skills, equipment, and general preferences, and a presence header showing nickname/avatar.
- **Complexity**: 8
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Skills/equipment/preferences are shown only when records exist.
  - Add/edit/remove flows operate on catalog keys and meaningful enum values.
  - `"not set"` / `"ayarlanmadı"` rows disappear from the manager.
  - The manager visually reads as a control surface, not a giant form.
  - Saving profile changes from the manager still works when `activeSessionId = null`.
- **Validation**:
  - Update `scripts/tests/forge-room-ui-smoke-regressions.test.ts`
  - Update `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`
  - Add a no-session smoke case for open/edit/save

## Sprint 5: Rebuild The Main Session Context Panel
**Goal**: Keep the main run screen focused on selecting context for the current run and managing temporary run conditions.
**Demo/Validation**:
- The session context area shows only persisted profile records as selectable chips/cards.
- The draft panel follows the context panel in a clean, dense order.

### Task 5.1: Replace Fixed Session Context Chips With Record-Driven Selection UI
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`
- **Description**: Rebuild session context groups from persisted records and catalog labels. Chips/cards should toggle inclusion for the run, but never open inline editors. If a section has no records, show a tight empty-state CTA that points back to `Open Operator Profile`.
- **Complexity**: 7
- **Dependencies**: Sprint 4 complete
- **Acceptance Criteria**:
  - The panel is selection-only.
  - No chip represents a missing record.
  - Editing continues to happen only in the Operator Profile Manager.
  - If a record is deleted from the persistent profile, any stale selected chip for that key disappears on the next hydrate/update.
- **Validation**:
  - UI smoke tests for select/deselect behavior
  - Add a regression case for deleting a selected record and pruning the run-local selection
  - `npm run typecheck`

### Task 5.2: Replace Hardcoded Run Override Controls With Generic Temporary Conditions
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/ui/forge-room-ui-runtime.ts`, `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/shared/types/forge-preflight.ts`
- **Description**: Remove the one-off hot-air toggle and model run-local context as temporary conditions, notes, and pre-analysis. Keep the control surface compact and horizontally dense.
- **Complexity**: 6
- **Dependencies**: Tasks 2.2, 5.1
- **Acceptance Criteria**:
  - Examples like borrowed microscope, urgent turnaround, or learning-focused run can be captured without new hardcoded fields.
  - Session context and run overrides remain visually distinct.
- **Validation**:
  - UI smoke tests for add/remove condition flows
  - Preflight regression tests confirm override text reaches prompt summaries

### Task 5.3: Clean Up Main-Panel UX Order And Copy
- **Location**: `rooms/forge-room/ui/panels/goal-input-panel.ts`, `rooms/forge-room/i18n/en.json`, `rooms/forge-room/i18n/tr.json`, `rooms/forge-room/ui/style.css`
- **Description**: Tighten the run screen so the session context panel reads first, the draft panel follows naturally, and explanatory copy is reduced. Add a small but visible `Open Operator Profile` action inside the session context panel while keeping the topbar launch action.
- **Complexity**: 4
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Profile management no longer dominates the main run screen.
  - The run screen stays compact and operator-oriented.
  - Stale copy referring to inline profile editing is removed.
- **Validation**:
  - UI smoke tests
  - Manual visual sanity check if the app is launched later

## Sprint 6: Regression Sweep And Release Readiness
**Goal**: Lock the revision down with tests, migration coverage, and drift-safe rollout checks.
**Demo/Validation**:
- Targeted Forge tests pass.
- Legacy data can still be loaded and resaved into the new shape.

### Task 6.1: Refresh Regression Coverage
- **Location**: `scripts/tests/forge-room-preflight-v2-regressions.test.ts`, `scripts/tests/forge-room-session-storage-regressions.test.ts`, `scripts/tests/forge-room-ui-smoke-regressions.test.ts`, `scripts/tests/forge-room-installed-ui-smoke-regressions.test.ts`, `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`, `scripts/tests/forge-room-handoff-regressions.test.ts`, `scripts/tests/forge-room-host-import-smoke-regressions.test.ts`, plus any affected runtime-flow suites
- **Description**: Update expectations that currently reference the old field matrix, the profile drawer toggles, placeholder copy, and hardcoded run override payloads.
- **Complexity**: 6
- **Dependencies**: Sprints 2-5 complete
- **Acceptance Criteria**:
  - Tests cover legacy migration, selected-only preflight, manager open/edit/remove flows, session context selection, and selected-record pruning.
  - Tests cover legacy session reopen behavior when a stale or legacy preflight bundle is present.
  - Tests cover no-session profile manager usage and presence-driven nickname/avatar refresh.
  - No regression test still asserts `"not set"` or hardcoded hot-air override behavior.
- **Validation**:
  - Targeted `node --test` suites

### Task 6.2: Execute Validation And Sync Checks
- **Location**: repo root commands plus Forge room source tree
- **Description**: Run a focused verification pass and, if needed, refresh the installed room copy through the normal sync/install mechanism instead of hand-editing `data/rooms/forge-room`.
- **Complexity**: 3
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - `npm run typecheck` passes.
  - Targeted Forge regressions pass.
  - No manual edits are made to installed room copies.
- **Validation**:
  - `npm run typecheck`
  - targeted `node --test scripts/tests/forge-room-*.test.ts`

## Testing Strategy
- Start with type-first verification after each schema or contract change.
- Add migration tests before removing legacy field readers.
- Keep preflight/signature tests focused on selected-only context behavior and stable ordering.
- Keep UI smoke tests focused on:
  - topbar profile manager open/close
  - profile manager open/save before any session exists
  - add/edit/remove skill and equipment records
  - no placeholder rows for missing records
  - session context select/deselect without inline editing
  - deleting a selected record and pruning the run-local selection
  - generic temporary condition flows
  - nickname/avatar rendering from presence
  - presence-only host-context updates that do not wipe unsaved profile drafts
- After implementation, run a short manual smoke checklist:
  - create or migrate a blank profile
  - add profile records
  - select a subset for a run
  - run preflight
  - verify unselected records stay out of prompt/provenance
  - delete a selected profile record and confirm session context/prerflight state reconcile cleanly
  - reload session and verify persistence
  - reopen at least one legacy session and confirm preflight is migrated or forced stale intentionally

## Potential Risks & Gotchas
- **Legacy migration ambiguity**: old `skill.level`, tool booleans, and `hotAir` run override values need deterministic migration rules. Document these rules before coding so existing sessions do not silently drift.
- **Legacy preflight trust**: old preflight bundles may deserialize cleanly while being semantically wrong for the new context model. Session hydrate should migrate them intentionally or invalidate them loudly.
- **Stable identity vs duplicate records**: session selection stays simplest if each catalog key is unique in persistence. Allowing duplicate skill records would complicate selection and preflight fingerprints.
- **Presence churn**: nickname/avatar updates may arrive independently of Forge state snapshots. The UI context update must not wipe unsaved profile drafts when presence changes.
- **Selection drift after delete**: removing a persistent record can leave stale run-local selection keys unless reconciliation runs on both profile changes and session reopen.
- **Signature noise**: selected record arrays must be sorted before hashing so UI ordering changes do not alter run signatures.
- **Catalog drift**: saved sessions may reference keys removed from the catalog later. The UI should degrade safely with a fallback label or a filtered stale-record notice.
- **Installed copy drift**: only `rooms/forge-room` should be edited. Any installed copy refresh must use the existing sync/install flow.
- **Translation cleanup**: `"not set"` / `"ayarlanmadı"` text and inline-editor copy currently appear in tests and UI strings; these must be removed everywhere, not just visually hidden.
- **Scope creep**: this revision should not rewrite the guided workflow, draft generation, assignment dispatch, or synthesis stages beyond their operator-context inputs.

## Rollback Plan
- Keep schema migration logic additive until the new UI and host flows are proven by tests.
- Land catalogs and type contracts before deleting legacy field readers.
- If the UI separation destabilizes the room, temporarily keep the old command names and host plumbing while swapping only the rendering layer.
- If preflight behavior regresses, fall back to the last known-good selection-to-summary adapter while preserving the new storage schema.
