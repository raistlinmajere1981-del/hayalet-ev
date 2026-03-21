# Plan: Application-Wide Overlay Centralization

**Generated**: 2026-03-20
**Estimated Complexity**: High

## Overview

- Replace the current mixed overlay model with one central overlay runtime for the main app.
- Keep `ghost-agent` out of scope.
- Remove legacy paths instead of preserving migration, backward compatibility, or fallback layers.
- Converge repeated overlay behaviors into a small set of shared surfaces:
  - topbar workspace tools: `settings`, `whisper`, `archives`
  - webview status overlays: `ai0`, `ai1`, `ai2`
  - scenario overlays: `ai1`, `ai2` webview test and sync
  - assistant tool overlays: `ai0` test, character, memory, opencode settings
- Make `classic` and `scene` modes use the same overlay runtime and the same surface contracts, with theme differences handled only by styling and placement adapters.

## Scope

### In Scope

- `src/js/ui/overlay-system.ts` and the overlay orchestration around it
- topbar tool surfaces currently split across page navigation, special pages, and scene tool events
- entrance and assistant webview status overlays
- entrance scenario overlays
- assistant tool overlays and modal-like tools
- legacy overlay CSS, DOM, and event plumbing tied to removed flows

### Out of Scope

- `ghost-agent`
- third-party drag/drop cleanup overlays inside provider webviews
- side navigation hover expansion
- functional redesign of settings, whisper, archives, memory, character, or scenario UX

## Assumptions

- The main shell becomes the only owner of overlay surfaces covered by this plan.
- `settings`, `whisper`, and `archives` stop behaving like special pages or external tool pages inside the main app flow.
- Existing page controllers may be split or rewritten if needed; preserving current file boundaries is not a goal.
- A direct cleanup approach is acceptable even if it requires deleting now-redundant controllers, events, and CSS in the same sprint.

## Current Findings

- Central overlay primitives already exist: stack, exclusive groups, escape handling, and scroll lock are implemented in [src/js/ui/overlay-system.ts](/home/raistlin/hayalet-ev/src/js/ui/overlay-system.ts).
- The current system is only partially adopted. `entrance`, `assistant`, `analyze`, `opencode-ui`, and splash use it, but topbar tool flows and settings panel activation do not.
- `settings`, `whisper`, and `archives` are still tied to special-page navigation or scene tool events via [src/js/app/navigation.ts](/home/raistlin/hayalet-ev/src/js/app/navigation.ts), [src/js/pages/shared/external-page.ts](/home/raistlin/hayalet-ev/src/js/pages/shared/external-page.ts), and [src/js/scene/tool-pages.ts](/home/raistlin/hayalet-ev/src/js/scene/tool-pages.ts).
- Settings panels are named as overlays, but they are really tab sections switched with `is-hidden` and `settings-hub:state-change`, not real managed overlays.
- Assistant webview status uses the shared overlay controller, but the surrounding UI still exposes legacy callback seams.
- `topbar-tool-overlay` CSS exists, but current runtime flow does not use a central topbar overlay host.

## Target Architecture

### Runtime Layers

1. `OverlayRuntime`
   - global registry, stack, focus/escape policy, scroll lock, overlay groups
   - replaces ad hoc `settings-hub:*`, scene-tool, and special-page open/close flows for in-app overlays

2. `OverlayHost`
   - one canonical DOM host owned by the main shell
   - exposes stable mount points for:
     - `workspace-tool`
     - `assistant-tool`
     - `modal`
     - `status`
     - `scenario`

3. `Surface Controllers`
   - shared controllers for repeated overlay families
   - examples:
     - `WorkspaceToolOverlayController`
     - `WebviewStatusOverlayController`
     - `ScenarioOverlayController`
     - `AssistantToolOverlayController`

4. `Theme Adapters`
   - same runtime and same controller contracts in `classic` and `scene`
   - only layout/art/animation classes differ by `data-ui-mode`

### Canonical Overlay Families

- `workspace-tool`: `settings`, `whisper`, `archives`
- `webview-status`: `ai0`, `ai1`, `ai2`
- `scenario`: `ai1`, `ai2` test/sync overlays
- `assistant-tool`: `ai0` test, character, memory, opencode settings
- `modal`: generic confirm/alert/prompt and simple one-off dialogs

## Sprint 1: Build the Central Overlay Runtime

**Goal**: Define the single overlay model and create the canonical host/runtime that all later sprints build on.

**Demo/Validation**:

- Main app boots with a single overlay host in the shell.
- `OverlayRuntime` can open and close a trivial test surface in both `classic` and `scene`.
- Scroll lock, group exclusivity, and escape handling work from the new host.

### Task 1.1: Write the Overlay Ownership Map

- **Location**: `.rovo/overlay-centralization-plan.md`, `src/js/ui/overlay-system.ts`, `src/js/app/navigation.ts`, `src/js/pages/shared/external-page.ts`
- **Description**: Freeze the target taxonomy in code comments and a small runtime contract doc near the overlay runtime so future migrations do not reintroduce page-vs-overlay ambiguity.
- **Complexity**: 3
- **Dependencies**: None
- **Acceptance Criteria**:
  - Overlay families and ownership rules are documented next to the runtime.
  - Covered surfaces are clearly marked as overlay-owned, not page-owned.
- **Validation**:
  - Search confirms only one canonical overlay taxonomy remains.

### Task 1.2: Refactor `overlay-system.ts` Into the App-Level Runtime

- **Location**: `src/js/ui/overlay-system.ts`, optional new files under `src/js/ui/overlay/`
- **Description**: Split the current primitive helpers into a runtime that explicitly supports host registration, family/group registration, focus return, and theme-aware surface placement.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Runtime exposes a single app-facing API for registering and opening surfaces.
  - No new feature depends directly on ad hoc `classList` toggles for overlay ownership.
- **Validation**:
  - Targeted tests cover stack ordering, escape close, and exclusivity.

### Task 1.3: Add a Canonical Overlay Host to the Main Shell

- **Location**: `src/index.html`, `src/styles/main.css`, `src/styles/scene-system/shell.css`, `src/js/app/index.ts`
- **Description**: Add one shell-owned overlay host with mount points for `workspace-tool`, `assistant-tool`, `modal`, `status`, and `scenario`.
- **Complexity**: 6
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The shell contains a single authoritative overlay host.
  - The host lives above page-specific content containers instead of inside `page-*` sections.
  - Host markup exists once and is not duplicated by page modules.
- **Validation**:
  - DOM inspection shows one overlay host.
  - The host remains present in both UI modes.

### Task 1.4: Define Shared Styling Tokens for Overlay Surfaces

- **Location**: `src/styles/main.css`, `src/styles/design-system/components/modals.css`, optional new `src/styles/design-system/components/overlays.css`
- **Description**: Normalize backdrop, shell, padding, z-index, motion, and panel sizing into one overlay styling layer instead of per-feature CSS blocks.
- **Complexity**: 5
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Shared surface families use common tokens.
  - Theme differences are mode-based overrides, not separate structural CSS systems.
- **Validation**:
  - Both UI modes render the same surface structure with different presentation only.

## Sprint 2: Unify Topbar Workspace Tool Overlays

**Goal**: Make `settings`, `whisper`, and `archives` use the same workspace overlay host and the same open/close lifecycle in both UI modes.

**Demo/Validation**:

- The topbar buttons open one shared overlay shell.
- `settings`, `whisper`, and `archives` swap content inside the same host.
- The same runtime path works in `classic` and `scene`.

### Task 2.1: Build `WorkspaceToolOverlayController`

- **Location**: new module under `src/js/ui/overlay/` or `src/js/app/`, plus `src/index.html`
- **Description**: Create one controller that owns the workspace tool shell, active tool identity, close behavior, and content mounting for `settings`, `whisper`, and `archives`.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - One controller opens all topbar tools.
  - Tool switching does not navigate pages.
- **Validation**:
  - Open `settings`, switch to `whisper`, then `archives`, and confirm the same shell stays mounted.

### Task 2.2: Define the Workspace Tool Lifecycle Contract

- **Location**: new workspace overlay modules, `src/js/pages/settings/panels/*`, `src/js/pages/settings/live-log/overlay.ts`
- **Description**: Introduce a host-level lifecycle contract for workspace tools and settings sub-panels. Replace `settings-hub:state-change` ownership with explicit panel `enter`, `exit`, `activate`, and `deactivate` hooks so polling, subscriptions, and refresh work are started and stopped by the new host instead of by document-wide events.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Settings panels do not depend on `settings-hub:*` events for runtime ownership.
  - `live-log`, `backup`, and `rooms` have explicit lifecycle hooks for start/stop behavior.
  - Panel switching cannot leak timers, subscriptions, or background refresh work.
- **Validation**:
  - Switching between settings panels starts the correct panel work and stops the previous one.
  - Closing the workspace overlay leaves no active live-log polling loop behind.

### Task 2.3: Convert Settings From Page/Special-Page Semantics to Overlay Semantics

- **Location**: `src/js/pages/settings/controller.ts`, `src/js/pages/settings/app.ts`, `src/js/pages/settings/panels/*`, `src/pages/settings.html`, `src/js/app/page-init.ts`
- **Description**: Re-home settings into the workspace tool overlay. Remove page-level assumptions and make panel activation local to the overlay controller rather than event-broadcast driven.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Settings is mounted as workspace tool content, not as a special page.
  - `settings-hub:open`, `settings-hub:close`, and `settings-hub:state-change` are no longer needed for overlay ownership.
- **Validation**:
  - Theme, accounts, backup, rooms, and live-log still activate correctly from the overlay shell.

### Task 2.4: Migrate the Settings Scene Controller to the Shared Overlay Host

- **Location**: `src/js/pages/settings/controller.ts`, `src/js/scene/runtime.ts`, `src/styles/scene-system/shell.css`, relevant settings scene assets and helpers
- **Description**: Explicitly migrate `SettingsSceneController` and its scene-only room/panel rendering path onto the same workspace overlay runtime. Keep the scene presentation layer, but move ownership so scene mode uses the same host and lifecycle contract as classic mode instead of a separate settings page path.
- **Complexity**: 8
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Settings scene mode opens through the same workspace overlay runtime as classic mode.
  - Scene-specific rendering remains functional without owning a separate navigation model.
  - `SettingsSceneController` becomes a presentation adapter, not an alternate overlay owner.
- **Validation**:
  - In scene mode, open settings, switch panels, return to room view, and close settings successfully.
  - Scene alpha-window and panel-art behavior still render correctly inside the shared host.

### Task 2.5: Convert Whisper and Archives to Workspace Tool Modules

- **Location**: `src/js/pages/whisper/page-controller.ts`, `src/js/pages/whisper/controller.ts`, `src/js/pages/archives/controller.ts`, `src/pages/whisper.html`, `src/pages/archives.html`
- **Description**: Move whisper and archives off page-close/scene-tool semantics and onto the shared workspace overlay contract.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Both tools open and close through the shared overlay controller.
  - No tool decides between `closeExternalPage()` and `closeSceneTool()`.
- **Validation**:
  - Open/close behavior is identical in both UI modes.
  - Search confirms removed scene-tool close branches for these tools.

### Task 2.6: Delete Special-Page and External-Page Paths for Workspace Tools

- **Location**: `src/js/app/navigation.ts`, `src/js/pages/shared/external-page.ts`, `src/js/scene/tool-pages.ts`, `src/js/app/topbar-tool-overlays.ts`, `src/js/app/page-init.ts`
- **Description**: Remove `SPECIAL_PAGES` ownership for `settings`, `whisper`, and `archives`, delete no-longer-needed event flows, and make topbar buttons call the new workspace overlay controller directly.
- **Complexity**: 7
- **Dependencies**: Tasks 2.3, 2.4, 2.5
- **Acceptance Criteria**:
  - Topbar tool open/close no longer goes through page navigation.
  - Workspace tool runtime does not depend on scene tool events or external-page helpers.
- **Validation**:
  - Search confirms removed `settings/archives/whisper` entries from special-page flow.

## Sprint 3: Unify Webview Status and Scenario Overlays

**Goal**: Use one shared overlay family for all in-app webview status and scenario surfaces.

**Demo/Validation**:

- `ai0`, `ai1`, and `ai2` status overlays render through one controller family.
- `ai1` and `ai2` test/sync flows render through one scenario overlay surface with shared behavior and styling.

### Task 3.1: Extract a Shared Webview Status Overlay Module

- **Location**: new shared module under `src/js/ui/overlay/` or `src/js/pages/shared/`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/entrance/webview-panel.ts`, relevant HTML/CSS files
- **Description**: Remove per-page duplication for empty, disconnected, connecting, and error overlays. Standardize markup, state model, blocked-target behavior, and translation keys.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `ai0`, `ai1`, and `ai2` all use the same status overlay adapter.
  - Page-specific code only supplies slot identity and translated state payloads.
- **Validation**:
  - Manual matrix: no account, connecting, tools-loading, disconnected, error, connected.

### Task 3.2: Extract a Shared Scenario Overlay Runtime for `ai1` and `ai2`

- **Location**: `src/js/pages/entrance/webview-panel.ts`, `src/js/pages/shared/provider-test-presentation.ts`, relevant entrance HTML/CSS, optional new scenario overlay modules
- **Description**: Make test and sync use the same scenario overlay shell, action bar, scroll behavior, and completion lifecycle instead of slot-local custom reset logic.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Test and sync share one scenario surface contract.
  - `ai1` and `ai2` differ only by slot data, not by overlay implementation.
- **Validation**:
  - Existing provider overlay regression tests remain green after adaptation.

### Task 3.3: Remove Legacy Webview Overlay Callback Seams

- **Location**: `src/js/pages/assistant/connection-ui.ts`, `src/js/pages/assistant/assistant.ts`, `src/js/pages/entrance/webview-panel.ts`
- **Description**: Replace `_updateOverlay` and `_hideOverlay` callback seams with direct shared overlay controller usage.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Assistant and entrance connection logic talk to the shared overlay API directly.
  - No redundant overlay adapter methods remain on page controllers.
- **Validation**:
  - Search confirms the legacy callback seam is removed.

## Sprint 4: Unify Assistant Tool Overlays

**Goal**: Make assistant-side tools behave as one overlay family with consistent shell, placement, close behavior, and state cleanup.

**Demo/Validation**:

- `ai0` test, character, memory, and opencode settings open inside the same assistant tool host.
- Close, escape, backdrop, focus, and cleanup semantics are identical across all assistant tool surfaces.

### Task 4.1: Build `AssistantToolOverlayController`

- **Location**: new overlay module under `src/js/ui/overlay/`, `src/pages/assistant.html`, `src/styles/assistant.css`
- **Description**: Create a single assistant tool host that can render:
  - scenario/test side surface
  - character manager
  - memory manager
  - opencode settings
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Assistant tools no longer each own their own modal shell.
  - Host decides shell type, active tool, and close behavior.
- **Validation**:
  - Open each tool sequentially and verify the host is reused.

### Task 4.2: Migrate Character and Memory Into the Shared Assistant Tool Host

- **Location**: `src/js/pages/assistant/character-overlay.ts`, `src/js/pages/assistant/memory-overlay.ts`, `src/pages/assistant.html`
- **Description**: Convert feature logic into content modules mounted by the assistant tool host instead of feature-owned modal wrappers.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Feature modules own content and actions, not modal shells.
  - Existing feature cleanup hooks are preserved through the host lifecycle.
- **Validation**:
  - Character selection rollback on close still works.
  - Memory load/search/add/prune flows still work.

### Task 4.3: Migrate AI0 Test and Opencode Settings Into the Shared Assistant Tool Host

- **Location**: `src/js/pages/assistant/assistant.ts`, `src/js/pages/assistant/opencode-doctor.ts`, `src/pages/assistant.html`
- **Description**: Move AI0 test panel and opencode settings away from one-off side panel or modal flows and onto the same host contract.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - AI0 test and opencode settings reuse the assistant tool shell.
  - `ModalManager.open()` is no longer used for opencode settings.
- **Validation**:
  - Test results and opencode settings can be opened, interacted with, and closed from the shared host.

### Task 4.4: Normalize Assistant Tool Styling Across Classic and Scene

- **Location**: `src/styles/assistant.css`, `src/styles/main.css`, `src/styles/scene-system/shell.css`
- **Description**: Remove separate structural styling assumptions for classic vs scene assistant tools and keep only surface-level presentation differences.
- **Complexity**: 5
- **Dependencies**: Tasks 4.2, 4.3
- **Acceptance Criteria**:
  - Same DOM and controller contract works in both modes.
  - Scene mode does not need a distinct assistant tool implementation path.
- **Validation**:
  - Visual smoke test in both modes for all four assistant tools.

## Sprint 5: Collapse Remaining Overlay Drift and Delete Old Paths

**Goal**: Finish cleanup so overlay ownership is obvious and legacy overlay/page hybrids are gone.

**Demo/Validation**:

- No dead overlay host CSS or event system remains for removed flows.
- Remaining modal-like flows either use the central modal family or a central named overlay family.

### Task 5.1: Decide and Migrate Remaining Main-App Overlay Stragglers

- **Location**: `src/js/pages/analyze/context-menu.ts`, `src/js/ui/modal-manager.ts`, `src/js/pages/assistant/test-results-modal.ts`, optional splash files
- **Description**: Fold remaining simple dialogs into the central modal family and remove duplicated wrapper logic where it no longer adds value.
- **Complexity**: 6
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - Analyze read modal and similar simple dialogs follow the same modal ownership rules.
  - Generic modal usage is limited to truly generic dialogs.
- **Validation**:
  - Open/close, focus, and escape behavior match the shared modal runtime.

### Task 5.2: Delete Dead CSS, DOM, and Event Artifacts

- **Location**: `src/styles/main.css`, `src/styles/design-system/components/composites.css`, `src/index.html`, `src/pages/*.html`, `src/js/app/navigation.ts`, `src/js/pages/shared/external-page.ts`, `src/js/scene/tool-pages.ts`
- **Description**: Remove only the migrated overlay-related branches from shared navigation files, plus unused overlay classes, special-page DOM, stale naming, and event contracts that only existed for the old architecture. Do not treat shared shell/navigation files as whole-file deletion targets unless they become fully dead after the migration.
- **Complexity**: 7
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - No stale `topbar-tool-overlay`, `settings-hub:*`, special-page, or scene-tool plumbing remains for migrated surfaces.
  - Shared shell/navigation files keep their unrelated responsibilities intact.
  - Overlay names match real ownership.
- **Validation**:
  - Search for deleted concepts returns no runtime references.

### Task 5.3: Lock the New Model With Regression Tests

- **Location**: `scripts/tests/*overlay*`, `scripts/tests/*settings*`, `scripts/tests/*whisper*`, `scripts/tests/*archives*`, plus new targeted tests
- **Description**: Add regression coverage around overlay family ownership, shared host reuse, and cross-mode behavior.
- **Complexity**: 6
- **Dependencies**: Tasks 5.1, 5.2
- **Acceptance Criteria**:
  - Tests cover the new runtime boundaries instead of old page-level assumptions.
  - Failures clearly indicate overlay family regressions.
- **Validation**:
  - Targeted test suite passes.

## Optional Centralization Candidates

- `Splash` can stay on the same runtime as the `loading` family after the core migration. This is a good cleanup target, but not required for the first convergence wave.
- `opencode-ui` page-local prompt/model settings modals can either:
  - stay page-local but use the central modal family contract, or
  - join the main overlay host only if that page remains shell-owned
- `side-nav-overlay` should stay out unless the goal expands from "overlay surface convergence" to "all transient layers".

## Testing Strategy

- Run targeted regression tests for:
  - provider test overlays
  - settings panel behavior
  - archives and whisper interaction
  - modal and connection-state flows
- Add DOM-level assertions for:
  - one canonical overlay host
  - active overlay family metadata
  - correct `aria-hidden`, focus, and scroll-lock behavior
- Manual smoke matrix:
  - `classic` and `scene`
  - `ai0`, `ai1`, `ai2` status transitions
  - topbar tools open/close/switch
  - assistant tools open/close/switch
  - test and sync scenario overlay flows

## Potential Risks & Gotchas

- `settings`, `whisper`, and `archives` currently mix page, scene, and overlay semantics. The highest-risk area is deleting those paths too early before the new workspace host is live.
- `classic` vs `scene` may drift again if structure and styling are refactored together. Keep DOM/runtime unification separate from visual tuning.
- `assistant` tools have feature-specific cleanup rules. Those rules must move into host lifecycle hooks, not disappear with modal shell deletion.
- `settings` live-log, backup, and rooms currently assume event-based activation. If panel lifecycle is moved without replacing activation hooks, data loading will silently stop.
- `settings` scene mode is not just a theme swap; it has its own scene controller and render path. That path needs an explicit migration step, not just shared CSS.
- Regression tests currently encode some old terminology such as "overlay" vs "modal". Expect test rewrites, not just snapshots.
- A large cleanup pass can leave dead imports and orphaned selectors. Each sprint should end with search-based cleanup before moving on.

## Rollback Plan

- Keep each sprint committable and reversible by family:
  - Sprint 1: runtime/host only
  - Sprint 2: workspace tools only
  - Sprint 3: webview status/scenario only
  - Sprint 4: assistant tools only
  - Sprint 5: cleanup and residual dialogs
- If a sprint regresses behavior, revert that sprint’s branch/commit range rather than reintroducing compatibility code.
