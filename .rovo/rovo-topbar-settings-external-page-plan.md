# Plan: Rovo Topbar Settings External Page Extraction

**Generated**: 2026-03-20
**Estimated Complexity**: High

## Overview

- Convert `settings` from an injected special page into a standalone renderer page opened from the topbar button.
- Move settings ownership from `src/js/app` into `src/js/pages/settings/`.
- Split tab logic into panel-based modules that match the existing page-folder structure.
- Remove the direct `src/js/app` dependency from settings runtime code while preserving current behavior.

## Current Findings

- `src/pages/settings.html` is not a real Vite entry today; it is injected into the main shell via `src/js/app/page-init.ts`.
- `src/js/pages/settings.ts` is only a re-export of `src/js/app/topbar-settings-overlay.ts`.
- `backup` and `rooms` tabs are still owned by `src/js/app`.
- `live-log` and part of `accounts` setup are still owned by `src/js/pages/entrance`.
- `rooms` still exposes a main-shell navigation path through `showPage(getRoomPageName(...))`; this should be removed instead of preserved.
- `settings-hub:open`, `settings-hub:close`, and `settings-hub:state-change` currently coordinate lazy activation across multiple modules.
- `whisper` and `archives` are still wired through main-shell special-page infrastructure in the current tree, so their external-page split is not fully finished yet.

## Assumption

- "External page" is now confirmed to mean a dedicated renderer entry such as `pages/settings.html`, opened in the same Electron window.

## Non-Goals

- Do not redesign the settings UX in this pass.
- Do not change the persisted settings schema.
- Do not preserve the legacy room-management `open` action if it requires main-shell page coupling.

## Prerequisites

- Keep the existing `SettingsManager`, `AppI18n`, scene helpers, and Electron preload bridge reusable from a standalone page bootstrap.
- Decide the return path from the external settings page before implementing the final navigation layer.
- Preserve compatibility shims until all imports are migrated.

## Sprint 1: Carve Out Settings Ownership

**Goal**: Move settings implementation under `src/js/pages/settings/` without changing user-visible behavior.
**Demo/Validation**:

- Topbar settings still opens successfully in the current shell.
- The main controller is loaded from `src/js/pages/settings/`, not from `src/js/app`.

### Task 1.1: Create Settings Page Module Structure

- **Location**: `src/js/pages/settings/index.ts`, `src/js/pages/settings/controller.ts`, `src/js/pages/settings/scene-controller.ts`, `src/js/pages/settings/types.ts`
- **Description**: Move `SettingsPageController`, panel id types, state contracts, and scene orchestration out of `src/js/app/topbar-settings-overlay.ts`.
- **Dependencies**: None
- **Acceptance Criteria**:
  - `SettingsPageController` lives under `src/js/pages/settings/`.
  - New settings code is no longer authored inside `src/js/app/topbar-settings-overlay.ts`.
- **Validation**:
  - Targeted typecheck passes.
  - Opening settings still works through the existing topbar flow.

### Task 1.2: Create Panel Folders and Thin Adapters

- **Location**: `src/js/pages/settings/panels/theme/`, `src/js/pages/settings/panels/accounts/`, `src/js/pages/settings/panels/backup/`, `src/js/pages/settings/panels/rooms/`, `src/js/pages/settings/panels/live-log/`
- **Description**: Introduce per-panel bootstrap adapters so the main settings controller depends on panel modules instead of app-local or entrance-local files.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The controller activates tabs through panel adapters.
  - Panel folder names match the current tab taxonomy.
- **Validation**:
  - Each panel can still be selected.
  - Lazy activation still happens through the adapter layer.

### Task 1.3: Reduce Old App-Layer Files to Compatibility Shims

- **Location**: `src/js/app/topbar-settings-overlay.ts`, `src/js/pages/settings.ts`
- **Description**: Replace old settings implementation files with thin re-export shims until all imports are updated.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Legacy imports still resolve.
  - New logic is not duplicated across app and page folders.
- **Validation**:
  - `rg "SettingsPageController"` points to the new page folder as the real source.

## Sprint 2: Convert Settings Into a Standalone Renderer Page

**Goal**: Make settings build and run as its own renderer entry instead of being injected into `pages-container`.
**Demo/Validation**:

- The topbar button opens a standalone settings page.
- The main app still boots without any injected settings DOM.

### Task 2.1: Register a Dedicated Settings Entry

- **Location**: `vite.config.js`, `src/pages/settings.html`, `src/js/pages/settings/app.ts`
- **Description**: Add `settings` to Vite `rollupOptions.input`, attach a module script to `src/pages/settings.html`, and create a standalone bootstrap file that initializes `SettingsManager`, `AppI18n`, `ThemeManager`, and the settings page controller.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `dist/renderer/pages/settings.html` is emitted by `vite build`.
  - Settings can bootstrap without `src/js/app/index.ts`.
- **Validation**:
  - `npm run build`
  - Manual load of the settings page in dev and build output

### Task 2.2: Remove Raw Settings Template Injection

- **Location**: `src/js/app/page-init.ts`
- **Description**: Remove `settings.html?raw` injection and stop registering `controllers["settings"]` inside the main shell.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - `settingsTemplate` is no longer imported into the main app.
  - `page-settings` markup is not inserted into `#pages-container`.
- **Validation**:
  - Main shell loads with no missing-element errors.
  - Search confirms settings is no longer injected from `page-init.ts`.

### Task 2.3: Replace Special-Page Toggle With External Page Navigation

- **Location**: `src/js/app/topbar-tool-overlays.ts`, optional shared helper under `src/js/app/` or `src/js/pages/shared/`
- **Description**: Change the topbar settings button from `toggleSpecialPage("settings")` to a direct external-page navigation strategy.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Clicking the topbar button no longer depends on `SPECIAL_PAGES`.
  - Settings opens through its dedicated page URL or equivalent runtime path.
- **Validation**:
  - Manual click from the topbar in dev and packaged-style paths.

### Task 2.4: Implement Return and Close Navigation

- **Location**: `src/pages/settings.html`, `src/js/pages/settings/app.ts`, optional `electron/startup-flags.ts` if reload-based navigation is chosen
- **Description**: Add a clear way to return from settings to the main shell or previous screen without relying on `closeSpecialPage("settings")`.
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Settings has a deterministic back or close path.
  - Returning from settings does not leave the app in an undefined navigation state.
- **Validation**:
  - Open settings, exit settings, and confirm the expected landing page.

## Sprint 3: Decouple Every Tab From `src/js/app` and `entrance`

**Goal**: Each settings tab has local ownership under `src/js/pages/settings/`, while reusable business logic stays in shared modules.
**Demo/Validation**:

- Settings runtime imports come from `src/js/pages/settings/` and shared modules, not from `src/js/app`.
- Opening a tab does not require `EntranceHallController` or `settings-hub:*` events.

### Task 3.1: Extract Theme Panel Bootstrap

- **Location**: `src/js/pages/settings/panels/theme/*`, `src/js/ui/theme-manager.ts`
- **Description**: Move panel-specific DOM wiring out of the global theme manager and into a settings page adapter while keeping theme state logic shared.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Theme panel DOM listeners are initialized by the settings page bootstrap.
  - Theme state remains centralized in `ThemeManager`.
- **Validation**:
  - Theme changes update the page immediately.
  - Persisted appearance settings still round-trip.

### Task 3.2: Extract Accounts Panel From Entrance Bootstrap

- **Location**: `src/js/pages/settings/panels/accounts/*`, `src/js/pages/entrance/user-panel.ts`, `src/js/pages/entrance/us1-panel.ts`, `src/js/pages/entrance/account-panel.ts`, optional shared folder such as `src/js/pages/shared/settings-identity/`
- **Description**: Separate reusable account, user, and US1 behaviors from `EntranceHallController` so the settings page can initialize them directly.
- **Dependencies**: Tasks 1.2, 2.1
- **Acceptance Criteria**:
  - Settings accounts panel initializes without relying on `EntranceHallController`.
  - DOM lookup is rooted or namespaced to the settings page instead of assuming global page ownership.
- **Validation**:
  - Nickname/avatar update works.
  - Account create/edit/delete works.
  - Remote sync and US1 mail actions still work.

### Task 3.3: Move Backup Tab Out of `src/js/app`

- **Location**: `src/js/pages/settings/panels/backup/*`, `src/js/app/backup-overlay.ts`, `src/js/app/backup-overlay-markup.ts`
- **Description**: Move backup tab bootstrap and markup builders into the settings page tree, replacing `settings-hub:state-change` with local page lifecycle hooks.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Backup tab runtime code no longer lives in `src/js/app`.
  - Backup activation is owned by the settings page controller.
- **Validation**:
  - Create/select/refresh/preview/restore actions still load and render.

### Task 3.4: Move Rooms Tab Out of `src/js/app`

- **Location**: `src/js/pages/settings/panels/rooms/*`, `src/js/app/room-overlay.ts`, `src/js/app/room-ui.ts`, `src/js/modules/rooms/*`
- **Description**: Split room-management tab behavior from main-shell page navigation. Keep `RoomRegistry` shared, move tab rendering and actions under the settings page tree, and remove the legacy `open` action instead of bridging it across pages.
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - Settings room management no longer depends on `src/js/app/room-overlay.ts`.
  - The `open` room action is removed from the settings panel UI and runtime.
- **Validation**:
  - Import/install/package/export/remove still work.
  - No room-management code in settings attempts to call `showPage(getRoomPageName(...))`.

## Sprint 5: Finish Whisper and Archives External-Page Cleanup

**Goal**: Remove any remaining main-shell special-page coupling from `whisper` and `archives` so all three topbar tools follow the same external-page model.
**Demo/Validation**:

- `whisper`, `archives`, and `settings` no longer depend on `toggleSpecialPage()` or `closeSpecialPage()`.
- Topbar tool buttons open dedicated renderer pages instead of injected special pages.

### Task 5.1: Audit Remaining Topbar Tool Couplings

- **Location**: `src/js/app/topbar-tool-overlays.ts`, `src/js/app/navigation.ts`, `src/js/app/page-init.ts`
- **Description**: Inventory and remove special-page assumptions for `whisper` and `archives`, using the settings extraction as the target pattern.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `SPECIAL_PAGES` no longer needs `whisper` or `archives`.
  - Topbar buttons do not call `toggleSpecialPage()` for those tools.
- **Validation**:
  - Search confirms the old helper is no longer used by topbar tool pages.

### Task 5.2: Finish Whisper External-Page Cleanup

- **Location**: `src/js/pages/whisper/index.ts`, `src/pages/whisper.html`, related whisper bootstrap files
- **Description**: Remove remaining host assumptions such as `closeSpecialPage("whisper")`, and make whisper responsible for its own standalone page close and return logic.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Whisper no longer imports or calls main-shell special-page helpers.
  - Whisper bootstrap is self-owned as an external renderer page.
- **Validation**:
  - Whisper opens from the topbar and closes through its standalone page flow.

### Task 5.3: Finish Archives External-Page Cleanup

- **Location**: `src/js/pages/archives/index.ts`, `src/js/pages/archives/controller.ts`, `src/pages/archives.html`
- **Description**: Remove remaining `PageController` host assumptions and special-page navigation contracts from archives, replacing them with standalone-page lifecycle handling.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Archives no longer relies on `getCurrentPage()`, `navigate-page`, or `closeSpecialPage("archives")` for its primary lifecycle.
  - Archives owns its own open, close, and visibility flow as an external page.
- **Validation**:
  - Archives opens from the topbar and closes without the main-shell special-page registry.

### Task 3.5: Move Live Log Tab Out of `entrance`

- **Location**: `src/js/pages/settings/panels/live-log/*`, `src/js/pages/entrance/live-log-overlay.ts`, reusable helpers in `src/js/pages/entrance/live-log-overlay-model.ts` and `src/js/pages/entrance/live-log-overlay-render.ts`
- **Description**: Re-home live-log bootstrap under settings while keeping pure model/render helpers shared if still useful.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Live-log polling starts and stops from settings-local lifecycle hooks.
  - `EntranceHallController` no longer owns settings live-log bootstrap.
- **Validation**:
  - App tabs, session selection, level filter, search, pause, and clear all still work.

## Sprint 4: Remove Legacy Special-Page Infrastructure

**Goal**: Delete settings-specific special-page plumbing from the main app once the standalone page is stable.
**Demo/Validation**:

- Settings is no longer treated as a special page inside the main shell.
- Search results show settings ownership under `src/js/pages/settings/` plus shared modules only.

### Task 4.1: Remove Settings From Main-Shell Special Page Contracts

- **Location**: `src/js/app/navigation.ts`, `src/js/scene/navigation.ts`, any settings-specific open or close event dispatchers
- **Description**: Remove `settings` from `SPECIAL_PAGES` and replace `settings-hub:*` document events with page-local APIs or delete them if no longer needed.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Main-shell navigation no longer knows about settings as an injected page.
  - `settings-hub:*` is either gone or reduced to a temporary compatibility layer with no active callers.
- **Validation**:
  - `rg "settings-hub"` returns only approved compatibility code or zero results.

### Task 4.2: Delete Compatibility Shims

- **Location**: old app-layer settings files and temporary re-export modules
- **Description**: Remove temporary shims after all imports have moved to the new page-folder structure.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - No runtime settings implementation remains in `src/js/app`.
  - Imports resolve directly to the page folder or shared modules.
- **Validation**:
  - Typecheck and lint pass.

### Task 4.3: Clean Up Settings CSS Ownership

- **Location**: `src/styles/main.css`, optional dedicated settings stylesheet such as `src/styles/pages/settings.css`
- **Description**: Re-scope settings page styles so they are owned by the standalone page layout instead of assumptions baked into the main shell.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Settings style rules have a clear owner.
  - Main shell no longer carries dead settings layout rules it does not use.
- **Validation**:
  - Visual smoke check in classic and scene modes.

## Testing Strategy

- Build validation: `npm run build`
- Type validation: `npm run check-types`
- Lint validation: targeted lint or `npm run lint`
- Manual smoke checklist:
  - Open settings from the topbar
  - Exit settings and return to the intended page
  - Switch all tabs
  - Change theme and confirm persistence
  - Create, edit, sync, and remove account data
  - Load backup metadata and preview data
  - Run room import or refresh flows
  - Open live logs and switch filters
- Regression checklist:
  - Main shell still boots without `page-settings` injection
  - `whisper` and `archives` keep their current behavior unless explicitly migrated later

## Potential Risks & Gotchas

- `accounts` is the highest-risk extraction because its behavior is currently bootstrapped from entrance-oriented modules.
- `rooms` is the second highest-risk extraction because it depends on the main-shell controller registry and `showPage()`.
- Removing `settings-hub:state-change` too early will break lazy loading for backup, rooms, and live-log.
- Theme panel bootstrap must become explicit on the standalone page because panel DOM ownership changes.
- Scene-mode behavior should keep shared scene primitives, but settings scene orchestration should move under the settings page module tree.
- `whisper` and `archives` may still contain hidden main-shell lifecycle assumptions even if their HTML pages already exist.

## Rollback Plan

- Land the work in small commits: ownership extraction, standalone entry, panel migrations, cleanup.
- Keep compatibility shims during Sprints 1-3.
- If standalone navigation regresses, revert Sprint 2 while keeping Sprint 1 extraction.
- If a tab proves too coupled, keep shared business logic where it is and only move the settings-specific bootstrap layer.
