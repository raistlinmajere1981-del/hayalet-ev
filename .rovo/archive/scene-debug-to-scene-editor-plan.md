# Plan: Scene Debug to Scene Editor

**Generated**: 2026-03-20
**Estimated Complexity**: High

## Overview
Rename the public `scene:debug` mode to `scene:editor`, replace the current floating debug panel with a modular scene theme editor, and move transparent-area detection into a manual editor capability. The implementation should keep ghost-agent out of scope, preserve scene runtime behavior during the migration, and leave room for future editor capabilities beyond alpha detection.

## Current State Findings
- The current editor runtime already lives under `src/js/scene-editor/*`, but most page controllers still treat it as a page-local debug tool.
- Public mode state is currently expressed as `scene-debug` in `src/js/app/ui-mode/state.ts`, `src/index.html`, i18n files, and Electron startup/restart contracts.
- Layout drafts are saved to `shared/themes/<theme>/maps/*.scene.json`, and clickable theme defaults are saved to `shared/themes/<theme>/scene-clickable-defaults.ts`.
- Theme assets are not editor-driven today; they come from static imports inside [manifest.ts](/home/raistlin/hayalet-ev/shared/themes/castle/manifest.ts).
- Transparent-area detection is currently page-wired through `SceneAlphaWindowFrameController` in:
  - [controller.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/controller.ts)
  - [assistant.ts](/home/raistlin/hayalet-ev/src/js/pages/assistant/assistant.ts)
  - [analyze.ts](/home/raistlin/hayalet-ev/src/js/pages/analyze.ts)
  - [server.ts](/home/raistlin/hayalet-ev/src/js/pages/server.ts)
- The current UI in [scene-layout-editor.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/scene-layout-editor.ts) is a single floating aside built from HTML strings, optimized for expert tweaking rather than novice editing.

## Assumptions
- Ghost-agent, `scripts/ghost-agent-wrapper.mjs`, and ghost-only runtime changes are out of scope for this plan. We keep compatibility aliases where needed instead of fully renaming those contracts.
- The file path mentioned in the request as `src/js/app/topbar-settings-overlay.ts` maps to the current settings scene flow rooted in [topbar-tool-overlays.ts](/home/raistlin/hayalet-ev/src/js/app/topbar-tool-overlays.ts) and [controller.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/controller.ts).
- Asset editing should persist portable project files, so selected images should be copied into the active theme asset tree instead of storing machine-specific absolute paths.
- `scene:editor` should become the public mode name, but `sceneDebug` can remain as a temporary compatibility flag during the migration sprint.

## Prerequisites
- Existing scene pages must keep working in normal `scene` mode while the editor is being rebuilt.
- A new persistent asset metadata layer is needed because `manifest.ts` is currently static and not suitable as the only runtime-editable source.
- Alpha detection needs a cache invalidation strategy; the current cache keys only by `src`, which is not safe if a file is overwritten in place.

## Sprint 1: Rename the Mode Contract Safely
**Goal**: Make `scene:editor` the visible/public mode name without breaking scene startup, restart, or current app behavior.
**Demo/Validation**:
- The UI mode dropdown shows `Scene Editor` instead of `Scene Debug`.
- Selecting the mode still restarts into scene mode with editor behavior enabled.
- Existing `scene-debug` startup arguments remain accepted during the migration.

### Task 1.1: Introduce public `scene:editor` naming
- **Location**: [state.ts](/home/raistlin/hayalet-ev/src/js/app/ui-mode/state.ts), [index.html](/home/raistlin/hayalet-ev/src/index.html), [index.json](/home/raistlin/hayalet-ev/shared/languages/tr/index.json), [index.json](/home/raistlin/hayalet-ev/shared/languages/en/index.json)
- **Description**: Replace public labels and dropdown state naming with `scene:editor` terminology while keeping the actual restart behavior mapped to `uiMode: "scene"` plus editor-enabled state.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - UI copy no longer mentions `Scene Debug`.
  - Dropdown state and restart copy consistently use editor naming.
  - The visible mode list still contains `classic`, `scene`, and `scene:editor`.
- **Validation**:
  - Add/update a UI-mode regression test for the new label/state.
  - Smoke-check the dropdown in a local scene-mode run.

### Task 1.2: Add compatibility aliases for startup and restart flags
- **Location**: [startup-flags.ts](/home/raistlin/hayalet-ev/electron/startup-flags.ts), [window-manager.ts](/home/raistlin/hayalet-ev/electron/window-manager.ts), [preload.cjs](/home/raistlin/hayalet-ev/electron/preload.cjs), [global.d.ts](/home/raistlin/hayalet-ev/src/js/global.d.ts)
- **Description**: Introduce editor-named aliases in app-facing contracts, but continue accepting `sceneDebug` and `--scene-debug` during the transition so app startup does not break.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - App restart logic can derive editor-enabled mode from either the legacy or new contract.
  - Renderer-side `getStartupFlags()` exposes a clear editor-enabled signal.
  - No ghost-agent-specific contract is renamed in this sprint.
- **Validation**:
  - Update startup flag regression tests.
  - Verify restart logic by forcing a relaunch path in dev mode.

### Task 1.3: Create migration-safe editor exports
- **Location**: [index.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/index.ts), [scene-debug-flag.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/scene-debug-flag.ts), [scene-debug-room-registry.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/scene-debug-room-registry.ts)
- **Description**: Add editor-named exports and adapters so page migrations can happen incrementally without a giant rename patch.
- **Complexity**: 5
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - New editor-facing exports exist beside legacy aliases.
  - Navigation and room activation can work through the new naming layer.
  - No page controller needs to import mixed old/new names after its migration step.
- **Validation**:
  - Add a small regression test covering editor room registry exports.

## Sprint 2: Extract a Central Scene Editor Core
**Goal**: Turn page-local debug wiring into a shared editor runtime with a central capability registry.
**Demo/Validation**:
- `assistant`, `analyze`, `server`, `settings`, `entrance`, and `rooms` all mount the same editor shell contract.
- Page controllers provide room-specific adapters instead of constructing ad hoc editor behavior.

### Task 2.1: Rename runtime/store contracts from debug to editor
- **Location**: [scene-debug-runtime-session.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/scene-debug-runtime-session.ts), [scene-editor-store.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/scene-editor-store.ts), [schema.ts](/home/raistlin/hayalet-ev/src/js/scene/schema.ts)
- **Description**: Introduce `SceneEditorSession`/`SceneEditorStore` naming and keep temporary aliases for the existing debug-named APIs.
- **Complexity**: 6
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Core editor state is expressed with editor naming.
  - Draft, copy, reset, and save flows remain unchanged functionally.
  - Existing tests can be migrated incrementally instead of all at once.
- **Validation**:
  - Update store/session regression tests to assert the new contract.

### Task 2.2: Add a scene editor capability registry
- **Location**: New files under `src/js/scene-editor/`, likely `scene-editor-capability-registry.ts`, `scene-editor-capability-types.ts`, `scene-editor-context.ts`
- **Description**: Create a registry where capabilities such as transparent-area detection, asset picking, previews, and future tools can register themselves against a shared editor context.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Capabilities can register UI sections, actions, and per-room availability.
  - Page code no longer needs to know capability internals.
  - Alpha detection can be added later without editing every controller again.
- **Validation**:
  - Add a focused unit/regression test for registry ordering and room filtering.

### Task 2.3: Introduce page adapters for all app-side scene rooms
- **Location**: [scene-controller.ts](/home/raistlin/hayalet-ev/src/js/pages/entrance/scene/scene-controller.ts), [rooms.ts](/home/raistlin/hayalet-ev/src/js/pages/rooms.ts), [controller.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/controller.ts), [assistant.ts](/home/raistlin/hayalet-ev/src/js/pages/assistant/assistant.ts), [analyze.ts](/home/raistlin/hayalet-ev/src/js/pages/analyze.ts), [server.ts](/home/raistlin/hayalet-ev/src/js/pages/server.ts)
- **Description**: Replace direct `new SceneLayoutEditor(...)` setup with adapter objects that expose room state, selection, layout, theme, asset targets, and view-open state to the shared editor shell.
- **Complexity**: 9
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Each room mounts the same editor shell API.
  - Room-specific scene behavior stays inside adapters, not inside the shell.
  - Old per-page debug-specific setup methods are removed or reduced to adapter wiring.
- **Validation**:
  - Update scene room regression tests to assert adapter usage.
  - Smoke-check room switching across the editor shell.

## Sprint 3: Rebuild the UI as a Guided Bottom Accordion Editor
**Goal**: Replace the floating debug panel with a novice-friendly editor that lives below the scene and exposes collapsible sections.
**Demo/Validation**:
- Scene content remains the primary focus area.
- Editor sections are collapsed into a bottom accordion and can be expanded without crowding the scene.
- Layout and theme edits still work from the new UI.

### Task 3.1: Split the current monolithic editor renderer
- **Location**: [scene-layout-editor.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/scene-layout-editor.ts)
- **Description**: Refactor the existing string-built panel into smaller renderers for room navigation, selection inspector, theme defaults, asset controls, capability sections, and status/help surfaces.
- **Complexity**: 8
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - The editor shell is composable by section.
  - The old floating “all-in-one” debug panel is removed.
  - Scroll and selection state are preserved across refreshes.
- **Validation**:
  - Add a regression test covering the new section labels and accordion hooks.

### Task 3.2: Build the accordion-first layout and styling
- **Location**: [editor-panel.css](/home/raistlin/hayalet-ev/src/styles/scene-editor/editor-panel.css), [debug-overrides.css](/home/raistlin/hayalet-ev/src/styles/scene-editor/debug-overrides.css), room scene CSS files as needed
- **Description**: Move the editor from an absolute floating panel to a scene-attached bottom surface with collapsible panels, clear action grouping, novice-friendly copy, and responsive behavior.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The editor is no longer positioned as a floating expert tool over the room.
  - Desktop and smaller widths still keep the scene usable.
  - Editor-visible styling no longer depends on “debug” wording.
- **Validation**:
  - Visual smoke check in `entrance`, `assistant`, `analyze`, `server`, `settings`, and `rooms`.

### Task 3.3: Replace steppers-only editing with guided controls
- **Location**: [scene-layout-editor.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/scene-layout-editor.ts)
- **Description**: Add more understandable control types for novices: labeled numeric inputs, grouped presets, previews, helper text, reset buttons, and explicit “draft vs saved” feedback.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - A new user can tell what object/view/theme value they are editing.
  - Draft state, reset behavior, and save targets are obvious.
  - Keyboard editing remains available but is no longer the primary affordance.
- **Validation**:
  - Add a targeted regression test for rendered action labels and draft messaging.

## Sprint 4: Make Theme Assets Editor-Managed
**Goal**: Allow scene assets to be changed directly from the editor and persisted as portable theme data.
**Demo/Validation**:
- A user can replace a background or panel art from the editor.
- The new asset persists across reloads and scene re-entry.
- The active room updates its preview without manual file edits.

### Task 4.1: Create an editable theme asset source of truth
- **Location**: [manifest.ts](/home/raistlin/hayalet-ev/shared/themes/castle/manifest.ts), [scene-theme-assets.ts](/home/raistlin/hayalet-ev/src/js/scene-system/scene-theme-assets.ts), [scene-theme-registry.ts](/home/raistlin/hayalet-ev/src/js/scene-system/scene-theme-registry.ts), new theme asset metadata file under `shared/themes/castle/`
- **Description**: Extract room/view/panel asset references into a dedicated source that the editor can read and write safely, instead of treating `manifest.ts` as the only mutable source.
- **Complexity**: 9
- **Dependencies**: Sprint 3 complete
- **Acceptance Criteria**:
  - Background, panel, and view art can be resolved from the new source.
  - Existing asset getters keep the same consumer API.
  - The manifest remains a build/runtime entry point, not the only editable file.
- **Validation**:
  - Add or update theme source regression tests.

### Task 4.2: Add a scene asset store and file import workflow
- **Location**: New files under `src/js/scene-editor/` and/or `src/js/scene-system/`; reuse [file-manager.ts](/home/raistlin/hayalet-ev/src/js/modules/file-manager.ts) and `window.electronAPI.showOpenDialog`
- **Description**: Build a store that can open a file picker, copy selected assets into the active theme asset folder, normalize paths, and save metadata updates atomically.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Asset imports do not depend on absolute user-machine paths.
  - Save operations are atomic and rollback-friendly.
  - Imported assets can be previewed before saving.
- **Validation**:
  - Add regression coverage for metadata writes and copied asset paths.

### Task 4.3: Surface asset editing in the new editor shell
- **Location**: [scene-layout-editor.ts](/home/raistlin/hayalet-ev/src/js/scene-editor/scene-layout-editor.ts), new capability UI files, room adapters from Sprint 2
- **Description**: Add asset selectors and previews for room backgrounds, view backgrounds, panel art, and other theme-facing assets that belong to the active room/view.
- **Complexity**: 7
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - The editor exposes room/view/panel asset slots in clear language.
  - Selecting a new asset updates preview state immediately.
  - Save/reset behavior matches the rest of the editor.
- **Validation**:
  - Manual smoke test by swapping at least one asset in `assistant` and one in `settings`.

## Sprint 5: Move Transparent Detection into a Manual Capability
**Goal**: Remove automatic transparent-area scanning from scene pages and make it a modular editor-only capability with preview and manual override.
**Demo/Validation**:
- Opening scene panels/screens no longer auto-runs transparent-area scanning.
- The editor exposes a manual “detect transparent area” action with preview.
- Detected/manual bounds drive automatic placement of screen/panel views when objects are opened.

### Task 5.1: Replace `SceneAlphaWindowFrameController` with a reusable capability service
- **Location**: [alpha-window.ts](/home/raistlin/hayalet-ev/src/js/scene/alpha-window.ts), new files under `src/js/scene-editor/capabilities/`
- **Description**: Split image scanning, bounds projection, cache invalidation, preview rendering, and persistence into reusable editor capability pieces instead of a page-bound controller.
- **Complexity**: 9
- **Dependencies**: Sprint 4 complete
- **Acceptance Criteria**:
  - Alpha detection can be triggered manually from the editor.
  - Cached results are invalidated when asset content changes.
  - The capability can be extended with future image-analysis tools.
- **Validation**:
  - Add focused tests for bounds detection and cache invalidation.

### Task 5.2: Remove automatic alpha detection triggers from scene pages
- **Location**: [controller.ts](/home/raistlin/hayalet-ev/src/js/pages/settings/controller.ts), [assistant.ts](/home/raistlin/hayalet-ev/src/js/pages/assistant/assistant.ts), [analyze.ts](/home/raistlin/hayalet-ev/src/js/pages/analyze.ts), [server.ts](/home/raistlin/hayalet-ev/src/js/pages/server.ts)
- **Description**: Delete the page-level `SceneAlphaWindowFrameController` wiring and automatic `refresh()` paths that currently run when scene panels/screens open or assets sync.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - None of the four scene pages instantiates the old alpha-frame controller.
  - Page asset-sync methods no longer trigger transparent scanning.
  - Only the editor capability can trigger detection.
- **Validation**:
  - Search-based regression test ensuring those pages no longer import/use the old controller.

### Task 5.3: Persist transparent bounds and use them for automatic view placement
- **Location**: Scene theme asset metadata introduced in Sprint 4, plus scene page adapters from Sprint 2
- **Description**: Save detected/manual bounds per relevant asset and feed those bounds into scene view positioning so main function surfaces open into the intended transparent area automatically.
- **Complexity**: 9
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - `assistant`, `analyze`, `server`, and `settings` view surfaces consume saved bounds instead of re-scanning images on open.
  - Users can manually adjust the detected region and save it.
  - Opening a screen/panel object places the view inside the stored transparent window.
- **Validation**:
  - Manual scene smoke for each affected room.
  - Regression test for persisted bounds round-trip.

## Testing Strategy
- Update and extend existing scene editor regression tests under `scripts/tests/`.
- Add targeted tests for:
  - UI mode rename and compatibility aliases
  - editor session/store renaming
  - capability registry
  - asset metadata read/write flow
  - transparent bounds detection, cache invalidation, and persistence
- Run focused tests first, then broader checks:
  - `node --test scripts/tests/ui-mode-orchestration-regressions.test.ts`
  - `node --test scripts/tests/startup-flags-regressions.test.ts`
  - `node --test scripts/tests/scene-debug-store-regressions.test.ts`
  - `node --test scripts/tests/scene-debug-room-regressions.test.ts`
  - `npm run lint`
  - `npm run check-types`
- Smoke-check scene flows in local Electron dev mode after each sprint.

## Potential Risks & Gotchas
- Static theme asset imports are the biggest architectural blocker; editing them safely requires a new metadata layer rather than a naive in-place `manifest.ts` rewrite.
- If the project keeps only a boolean `sceneDebug` internally for too long, naming drift will confuse future contributors; compatibility should be temporary and clearly documented.
- The current editor uses full re-render refreshes; adding previews and accordions without careful state preservation can cause jitter and collapsed-panel resets.
- Transparent bounds belong to asset metadata, not transient page state; storing them in page controllers would recreate the current duplication problem.
- Replacing an image at the same path can produce stale bounds if cache invalidation only keys on `src`.
- `settings` differs from `assistant`/`analyze`/`server` because it uses panel art per active panel rather than a single view asset; the editor data model must distinguish room panel assets from room view assets.

## Rollback Plan
- Keep compatibility exports and startup aliases until the new editor flow is proven stable.
- Land the migration sprint-by-sprint so each step remains runnable and reversible.
- If the new asset metadata layer proves unstable, continue reading the old manifest as fallback while writing only draft metadata until the persistence format is finalized.
- Keep alpha detection behind the capability registry so it can be disabled without reverting the full editor shell.
