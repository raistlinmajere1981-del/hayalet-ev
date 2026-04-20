# Plan: OpenCode UI Rovo Assistant Management

**Generated**: 2026-04-20
**Estimated Complexity**: High

## Overview
This plan upgrades the Assistant page and OpenCode UI around six connected seams: a usable Rovo character management overlay, richer message rendering for commands/thinking/limits/errors, reliable smart scrolling, a larger model-management overlay, and a shared persistence layer under `data/shared` for user-facing assistant state. The safest path is to first stabilize data contracts and storage, then refactor overlays, then harden message rendering and scroll behavior so each sprint ends with a runnable UI increment.

## Prerequisites
- OpenCode UI renderer bootstrap remains in `src/js/pages/opencode-ui/*`.
- Assistant page overlay work remains in `src/js/pages/assistant/*`.
- Shared persistence should move toward Electron-managed files under `data/shared/` instead of renderer-local storage or mixed config-only state.
- Validation should include targeted renderer smoke checks plus `npm run typecheck`.

## Assumptions
- “Rovo karakteristik belirleme” should evolve from static feature toggles into a CRUD profile manager, not only a richer selector.
- Command visibility should default to compact summary, with click-to-expand details for args/result.
- “Model yönetimi” covers visibility, active/default selection, favorites, and per-model enable-disable style operations.
- “Bütün durumlar data/shared klasöründe tutulsun” means OpenCode UI-specific user state should have a dedicated shared-state file/store even if some legacy compatibility remains during migration.

## Sprint 1: Shared State Contract
**Goal**: Define one persistence contract for OpenCode UI assistant state and remove storage ambiguity before UI refactors.
**Demo/Validation**:
- Launch Assistant/OpenCode UI and confirm last session, model selection, interaction mode, quick prompts, and new shared-state payload reload from disk.
- Verify created files land under `data/shared/`.
- Run `npm run typecheck`.

### Task 1.1: Inventory Current State Sources
- **Location**: `src/js/pages/opencode-ui/model-preferences.ts`, `src/js/pages/opencode-ui/tools-prompts.ts`, `src/js/pages/opencode-ui/session-storage.ts`, `src/js/modules/settings-manager.ts`, `electron/handlers/ipc-opencode-ui-tools.ts`
- **Description**: Map every OpenCode UI state source currently split across settings, localStorage fallback, quick prompt JSON, session DB, and assistant settings.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - All persisted keys are listed with current storage backend and target backend.
  - Migration needs are called out for quick prompts, model preferences, interaction mode, last session, and saved commands/prompts.
- **Validation**:
  - Cross-check code references with `rg`.

### Task 1.2: Define Shared Assistant State Schema
- **Location**: `src/js/pages/opencode-ui/types.ts`, `src/types/settings.ts` or new shared type file under `shared/`
- **Description**: Introduce a normalized schema for OpenCode UI shared state, including model preferences, last selected model, interaction mode, last active session, quick prompts/saved commands, and overlay preferences if needed.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - New type shape is explicit and versionable.
  - Ownership between session DB data and shared UI state is documented in comments or type names.
- **Validation**:
  - TypeScript compile passes for new types.

### Task 1.3: Add Electron Shared-State Read/Write IPC
- **Location**: `electron/main.ts`, `electron/preload.cjs`, `electron/handlers/ipc-opencode-ui-tools.ts` or new IPC handler module, `electron/paths.ts`
- **Description**: Add a dedicated read/write API for OpenCode UI shared state stored under `data/shared/`, likely alongside memory DB and avatar assets.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Renderer can read and write a single shared-state payload via Electron.
  - Disk path is deterministic and under `data/shared/`.
  - Read failures return safe defaults rather than breaking bootstrap.
- **Validation**:
  - Manual read/write smoke.
  - `npm run typecheck`.

### Task 1.4: Migrate Renderer State Consumers
- **Location**: `src/js/pages/opencode-ui/model-preferences.ts`, `src/js/pages/opencode-ui/tools-prompts.ts`, `src/js/pages/opencode-ui/app.ts`, related assistant files
- **Description**: Move OpenCode UI-specific persistence from scattered settings/localStorage fallbacks to the new shared-state API, while keeping one-time legacy import where needed.
- **Complexity**: 7
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Model preferences no longer depend on `assistants.opencodeUi` as primary storage.
  - Quick prompts no longer rely on renderer localStorage fallback except emergency fallback.
  - Last used model/mode/session restore from shared state.
- **Validation**:
  - Restart app and confirm state restoration.
  - Verify no regressions in quick prompt CRUD.

## Sprint 2: Rovo Character Profile Manager
**Goal**: Replace the brittle CHARACTER.md-driven overlay experience with a real profile-management surface users can add, edit, remove, and activate.
**Demo/Validation**:
- Open Rovo overlay, create multiple profiles, edit labels/features, delete one, activate another, save, close, reopen, and verify persistence.
- Confirm empty-state bug is gone and selectable content appears.
- Run `npm run typecheck`.

### Task 2.1: Audit Current Character Overlay Parsing and Failure Modes
- **Location**: `src/js/pages/assistant/character-overlay.ts`, `.rovo/_metadata/CHARACTER.md`
- **Description**: Identify why current overlay can render empty and why selection feels non-functional, especially around label parsing and dependence on markdown comments.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Failure modes are enumerated: missing file, unparseable labels, no CRUD model, save path fragility.
  - Decision is made on whether CHARACTER.md remains derived output or source of truth.
- **Validation**:
  - Reproduce with existing overlay data/state.

### Task 2.2: Introduce Profile Data Model and Storage
- **Location**: `src/js/pages/assistant/character-overlay.ts`, shared state types/store from Sprint 1
- **Description**: Define profile records with id, name, selected features, optional description, timestamps, and active profile marker.
- **Complexity**: 6
- **Dependencies**: Sprint 1 shared state
- **Acceptance Criteria**:
  - Multiple profiles are supported.
  - Active profile is explicit, not inferred from markdown text.
  - Data can still export/update CHARACTER.md if needed for downstream prompts.
- **Validation**:
  - Manual serialize/deserialize checks.

### Task 2.3: Refactor Overlay UI to CRUD Manager
- **Location**: `src/js/pages/assistant/character-overlay.ts`, related Assistant page markup/CSS
- **Description**: Replace the current two-column passive selector with a manager that supports profile list, create/edit/delete actions, active profile switch, and per-profile feature editing.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Users can add, remove, rename, and update profiles.
  - Selecting features updates the active draft immediately.
  - Conflict indicators remain visible and actionable.
- **Validation**:
  - Manual smoke on create/edit/delete/save/reopen.

### Task 2.4: Keep CHARACTER.md as Derived Output
- **Location**: `src/js/pages/assistant/character-overlay.ts`, `.rovo/_metadata/CHARACTER.md`
- **Description**: If the existing prompt pipeline still consumes `CHARACTER.md`, rewrite save flow so the chosen active profile generates the markdown block instead of treating markdown as the editable source.
- **Complexity**: 6
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Overlay works even if existing markdown content is stale or partially broken.
  - Export remains deterministic from active profile state.
- **Validation**:
  - Diff generated markdown after profile switch.

## Sprint 3: Model Management Overlay Expansion
**Goal**: Upgrade the right-panel model controls into a centered, larger overlay that supports provider and model management in one place.
**Demo/Validation**:
- Open new overlay from composer area.
- Toggle provider/model visibility, set favorite/default/active model, verify selected model updates composer.
- Close/reopen and confirm persisted state reloads.

### Task 3.1: Expand Model Preference Contract
- **Location**: `src/js/pages/opencode-ui/types.ts`, shared-state schema
- **Description**: Extend model preferences beyond hidden/default/favorite to cover active/inactive semantics or other management flags the UI needs.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Preference fields distinguish “hidden in picker” vs “inactive/disabled” if both are required.
  - Backward compatibility for existing preference fields is preserved.
- **Validation**:
  - TypeScript checks and migration smoke.

### Task 3.2: Redesign Overlay Layout and Entry Points
- **Location**: `src/js/pages/opencode-ui/model-settings-overlay.ts`, `src/js/pages/opencode-ui/app.ts`, relevant HTML/CSS
- **Description**: Move model management from side behavior into a prominent centered modal with clearer sections, richer summary, and larger browsing area.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Overlay visually reads as a primary management screen.
  - Provider and model controls are accessible without cramped scrolling.
- **Validation**:
  - Desktop and compact-width smoke review.

### Task 3.3: Add Full Model Actions
- **Location**: `src/js/pages/opencode-ui/model-settings-overlay.ts`, `src/js/pages/opencode-ui/provider-actions.ts`, `src/js/pages/opencode-ui/provider-catalog.ts`
- **Description**: Add or harden actions for active selection, default selection, favorite, visible/hidden, and active/passive model management.
- **Complexity**: 7
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Active model can be changed inside overlay.
  - Favorite/default/visibility actions remain synced with dropdown state.
  - Any disabled/passive models are excluded or visually marked in standard selectors.
- **Validation**:
  - Click-through smoke with refresh/reopen.

## Sprint 4: Message Rendering for Commands, Thinking, Limits, and Errors
**Goal**: Make assistant output richer without overwhelming the main transcript.
**Demo/Validation**:
- Send a command-producing message and confirm command summary is visible with click-to-expand args/result.
- Trigger or simulate runtime error and limit notice rendering.
- Confirm reasoning/thinking blocks appear without flooding the main bubble.

### Task 4.1: Enrich Message Event Contract
- **Location**: `src/js/pages/opencode-ui/types.ts`, `src/js/pages/opencode-ui/message-content.ts`, session parsing/store boundaries
- **Description**: Review current session message shape and extend it to consistently preserve tool command summaries, reasoning/thinking blocks, limit warnings, retry notices, and runtime errors.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Message shape can represent collapsible commands and structured notices.
  - Parsing logic recognizes thinking/reasoning, limit, and error data from session payloads.
- **Validation**:
  - Fixture-based manual payload inspection.

### Task 4.2: Replace Always-Open Tool Cards with Collapsible Command Cards
- **Location**: `src/js/pages/opencode-ui/render-actions.ts`, `src/styles/design-system/components/chat.css` or related styles
- **Description**: Render tool calls in collapsed form by default, showing command name/status summary and exposing args/result only on click.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Terminal command presence is immediately visible.
  - Details are hidden until expanded.
  - Large args/results do not explode transcript height.
- **Validation**:
  - Manual expand/collapse behavior test.

### Task 4.3: Surface Thinking, Limit, and Error States in Transcript
- **Location**: `src/js/pages/opencode-ui/message-content.ts`, `src/js/pages/opencode-ui/chat-utils.ts`, `src/js/pages/opencode-ui/notice-utils.ts`
- **Description**: Ensure reasoning/thinking blocks, rate-limit notices, retries, interruptions, and generic runtime failures render consistently in message bubbles.
- **Complexity**: 6
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Thinking/reasoning shows as a structured block when present.
  - Limit warnings and errors display with distinct tones and copy.
  - Notice-only messages remain readable.
- **Validation**:
  - Manual simulated payload rendering.

## Sprint 5: Smart Scroll and Live Session Sync
**Goal**: Make scrolling feel stable during history loads and live updates.
**Demo/Validation**:
- Scroll upward, receive new message, verify viewport does not jump unexpectedly.
- Stay near bottom, receive new message, verify auto-follow works.
- Load older history and confirm scroll offset is preserved.

### Task 5.1: Define Scroll Heuristics
- **Location**: `src/js/pages/opencode-ui/app.ts`, `src/js/pages/opencode-ui/history-actions.ts`
- **Description**: Replace unconditional “scroll to bottom” behavior with bottom-lock heuristics based on user distance from bottom and live-submission state.
- **Complexity**: 5
- **Dependencies**: None
- **Acceptance Criteria**:
  - Auto-follow only happens when user is already near bottom or when explicitly forced.
  - History pagination preserves visual anchor.
- **Validation**:
  - Manual scroll matrix.

### Task 5.2: Integrate Smart Scroll with Submission and Live Sync
- **Location**: `src/js/pages/opencode-ui/composer-actions.ts`, `src/js/pages/opencode-ui/history-actions.ts`, `src/js/pages/opencode-ui/app.ts`
- **Description**: Apply the new heuristics during optimistic send, fallback render, and disk-driven session refresh.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Sending a message follows the latest output when expected.
  - Passive live updates do not steal scroll when user is reviewing history.
- **Validation**:
  - Manual live-update smoke.

### Task 5.3: Add Scroll Regression Checklist
- **Location**: `.rovo/opencode-ui-rovo-assistant-management-plan.md` follow-up checklist or targeted test notes
- **Description**: Capture a small regression checklist for near-bottom, far-from-bottom, load-more, and error-notice cases.
- **Complexity**: 2
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Scroll behavior is testable and not left to intuition.
- **Validation**:
  - Checklist executed during final QA.

## Sprint 6: Integration, Cleanup, and Verification
**Goal**: Close the loop across Assistant page, OpenCode UI, storage, and UX polish.
**Demo/Validation**:
- Full user flow: open Assistant, manage Rovo profile, open OpenCode UI, manage models, send message, observe command/thinking/notice rendering, reload app, verify state persistence.
- Run `npm run typecheck` and any relevant targeted tests.

### Task 6.1: Wiring Cleanup and Backward Compatibility
- **Location**: affected renderer and Electron files from prior sprints
- **Description**: Remove stale fallback paths where safe, keep guarded compatibility where migration still matters, and align naming across shared-state APIs.
- **Complexity**: 5
- **Dependencies**: All prior sprints
- **Acceptance Criteria**:
  - No duplicate source of truth remains for the same UI state.
  - Legacy import paths are clearly marked if temporarily retained.
- **Validation**:
  - Search for obsolete storage keys and deprecated writes.

### Task 6.2: Final UX and Copy Pass
- **Location**: OpenCode UI and Assistant page markup/i18n/style files
- **Description**: Polish labels, empty states, button copy, and spacing for the new overlays and transcript blocks.
- **Complexity**: 4
- **Dependencies**: Tasks from Sprints 2-5
- **Acceptance Criteria**:
  - Empty states explain what users can do next.
  - Overlay actions are understandable without internal terminology.
- **Validation**:
  - Manual visual pass in Turkish UI.

## Testing Strategy
- Run `npm run typecheck` after each storage/contract milestone.
- Use targeted manual smoke tests per sprint instead of waiting for one big final pass.
- Validate persistence by closing and reopening the relevant page/app after each shared-state change.
- For transcript rendering, use representative session payloads containing tool calls, reasoning, warnings, and failures.
- For scroll, verify both “user reviewing history” and “user following live output” states.

## Potential Risks & Gotchas
- Character overlay currently treats `.rovo/_metadata/CHARACTER.md` as editable source, which is brittle and likely behind the empty/non-selectable behavior.
- Model state already lives partly in settings and partly in OpenCode-specific files; migration can create source-of-truth drift if not done early.
- Session history is loaded from disk and refreshed incrementally; richer message metadata may require updates both in renderer parsing and Electron session-store readers.
- A bigger overlay can regress mobile/smaller window behavior unless height, focus trapping, and overflow are planned together.
- Smart scroll often fails when optimistic render, disk refresh, and user scroll are all active; heuristics must be centralized rather than duplicated.

## Rollback Plan
- Keep new shared-state storage additive at first, with one-way migration from legacy settings/localStorage.
- Preserve legacy read fallbacks for one transition window until the new state path is verified stable.
- If overlay refactors regress usability, keep the old trigger wiring but feature-flag new layout blocks behind safe guards during rollout.
