# Plan: Room Runtime Scale Scroll Revision

**Generated**: 2026-03-28
**Estimated Complexity**: High

## Overview
Room main-function pages currently behave like nested full-screen apps inside an already-sized room host. The host shell owns page height and scene slots, but multiple room runtimes still claim viewport-sized height, add outer scrolling, and apply scale visually instead of layout-aware sizing. The result is the same failure pattern across classic room pages, scene-view, and scene debug: oversized content at `1920x1080` and `100%`, double-scroll ownership, and inconsistent scale semantics.

This revision should stay clean:
- No new CSS override layer.
- No "temporary fix" stylesheet that only masks the issue.
- Existing host, shared room, and feature styles should be revised so ownership is explicit.
- Scene-view and scene-debug must follow the same sizing contract.
- Settings scene scale must use the same behavior model as room runtime scale.

## Assumptions
- The active runtime loads installed room copies, so workspace edits under `rooms/` must be followed by install/sync before visual verification.
- `game-room` and `laboratory` are the current shipped room families in scope.
- The first pass targets fit, scroll ownership, and scale semantics; broader responsive redesign stays out of scope.
- Success is measured first at `1920x1080` with `100%` scale, then rechecked at `85%` and other supported scale presets.

## Prerequisites
- Confirm the workspace source-of-truth for room assets and styles before touching duplicated files.
- Include design-system layout and shell primitives in the audit, not just `src/styles/rooms/*`.
- Keep revisions inside existing files and selectors.
- Preserve scene coordinate math and reference-size behavior while changing layout ownership.
- Account for runtime bootstrap defaults so first paint does not start in the wrong presentation mode or scale.
- Prepare a repeatable smoke matrix for classic room mode, scene-view, and scene debug.

## Sprint 1: Establish the Canonical Layout Contract
**Goal**: Replace implicit sizing assumptions with one documented host-to-runtime contract before editing feature CSS.
**Demo/Validation**:
- Inventory shows which layer owns height, scroll, scale, and scene slot bounds.
- Affected files and ownership changes are explicit before implementation starts.

### Task 1.1: Audit host height and scroll ownership
- **Location**: `src/styles/rooms/page.css`, `src/styles/rooms/shell.css`, `src/styles/rooms/scene.css`, `src/styles/main.css`, `src/styles/scene-system/shell.css`, `src/styles/design-system/components/page-shells.css`, `src/styles/design-system/tokens/layout.css`
- **Description**: Trace the full height chain from app shell to room page, classic shell, scene shell, runtime mount, and scene runtime slot. Record where `height: 100%`, `min-height`, and `overflow` currently compete.
- **Complexity**: 4/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - A single contract is written down for classic mode, scene-view, and scene debug.
  - The contract explicitly names which element may scroll and which must stay clipped.
- **Validation**:
  - Manual code review against the audited files.
  - No unresolved "maybe this host should scroll" ambiguity remains.

### Task 1.2: Audit runtime scale semantics
- **Location**: `src/styles/main.css`, `src/styles/design-system/themes/theme-base.css`, `src/js/ui/theme/ui-scale-state.ts`, `src/js/ui/theme/classic-theme-manager.ts`, `src/js/ui/theme/theme-host-sync.ts`, `src/js/scene-system/scene-ui-scale-manager.ts`, `src/js/pages/room-page/runtime-context.ts`, `rooms/game-room/shared/styles/base.css`, `rooms/laboratory/shared/styles/shell.css`, `rooms/game-room/ui/index.js`, `rooms/laboratory/shared/ui/navigation-runtime.js`
- **Description**: Compare how app scale and scene scale are applied today. Confirm the mismatch between app `zoom` and room runtime `transform: scale(...)`, and define the replacement behavior.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The chosen scale mechanism is layout-aware and consistent across classic and scene presentation modes.
  - The contract states whether Chromium `zoom` becomes the standard for room runtimes, or whether an equivalent layout-aware strategy is used.
- **Validation**:
  - Decision note reviewed against current scale flow.
  - Risks for pointer alignment, scene projections, and debug overlays are documented.

### Task 1.3: Lock the room source-of-truth workflow
- **Location**: `electron/rooms/installed-room-builder.ts`, `electron/rooms/workspace-room-operations.ts`, `electron/rooms/workspace-discovery.ts`
- **Description**: Confirm whether workspace room sources under `rooms/` are authoritative and installed copies must be regenerated, instead of editing both `rooms/` and `data/rooms/` manually.
- **Complexity**: 3/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - The implementation plan names one source-of-truth for edits.
  - Install/sync steps for active runtime verification are defined.
- **Validation**:
  - Runtime path loading is confirmed from the Electron room install flow.

### Task 1.4: Audit bootstrap defaults and runtime scroll-state helpers
- **Location**: `rooms/game-room/ui/index.js`, `rooms/game-room/ui/context-runtime.js`, `rooms/game-room/shared/host/context-state.js`, `rooms/laboratory/ui/bootstrap-state-runtime.js`, `rooms/laboratory/ui/bootstrap-runtime.js`, `rooms/laboratory/shared/ui/navigation-runtime.js`, `rooms/laboratory/shared/host/runtime-bootstrap.js`
- **Description**: Check whether bootstrap state defaults, first-paint presentation mode, and runtime scroll capture/restore logic will fight the new sizing contract.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - Initial runtime state no longer starts in a misleading presentation mode or scale before host context arrives.
  - Scroll persistence logic only targets intentional inner scroll containers.
- **Validation**:
  - Review the first-render path for `game-room` and `laboratory`.
  - Confirm the implementation order covers bootstrap behavior before smoke testing.

## Sprint 2: Revise Shared Room Host and Scale Pipeline
**Goal**: Make classic room mode fit reliably at `100%` before touching room-specific composition.
**Demo/Validation**:
- Opening any room page no longer creates page-level overflow by default.
- Classic mode uses one consistent scale behavior across room families.

### Task 2.1: Remove page-level scroll ownership from the generic room page
- **Location**: `src/styles/rooms/page.css`, `src/styles/rooms/shell.css`, `src/styles/design-system/components/page-shells.css`, `src/styles/design-system/tokens/layout.css`
- **Description**: Revise the shared room page so the room page shell and runtime mount fully own available height, while outer page scroll is removed unless a page explicitly needs it.
- **Complexity**: 6/10
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `.page-rooms` no longer acts as the default scroll container for room runtimes.
  - Shared shell padding and frame styling do not force overflow at `1920x1080`.
- **Validation**:
  - Manual smoke in at least one game room and one laboratory room.
  - No right-edge room scrollbar appears before interacting with inner content.

### Task 2.2: Normalize room runtime mount and scene slot sizing
- **Location**: `src/styles/rooms/shell.css`, `src/styles/rooms/scene.css`, `src/styles/main.css`
- **Description**: Clean up `min-height: 100%` and `height: 100%` chains so runtime mounts, webviews, and scene runtime frames use the host’s actual box instead of competing for extra height.
- **Complexity**: 7/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Room runtime mounts do not require extra height beyond the host slot.
  - Scene runtime slot, classic runtime mount, and immersive shell all follow the same box contract.
- **Validation**:
  - Room runtime frame bounds match host frame bounds in both classic and scene-view.
  - No extra overflow is introduced when switching between room features.

### Task 2.3: Unify room runtime scale with the app and scene scale model
- **Location**: `rooms/game-room/shared/styles/base.css`, `rooms/laboratory/shared/styles/shell.css`, `rooms/game-room/ui/index.js`, `rooms/laboratory/shared/ui/navigation-runtime.js`, `src/js/pages/room-page/runtime-context.ts`, `src/js/pages/settings/controller.ts`
- **Description**: Replace transform-only room runtime scaling with the chosen layout-aware model and keep the host-context payload authoritative for mode-specific scale values.
- **Complexity**: 8/10
- **Dependencies**: Task 1.2, Task 2.2
- **Acceptance Criteria**:
  - `100%` and `85%` produce the same sizing semantics in room runtimes that the app already uses outside webviews.
  - Scale changes resize layout behavior, not just painted pixels.
- **Validation**:
  - Compare a classic room page at `100%` and `85%`.
  - Verify scroll height and visible content change for the right reasons.

### Task 2.4: Align settings scene scale with runtime behavior
- **Location**: `src/js/pages/settings/panels/theme.ts`, `src/js/pages/settings/controller.ts`, `src/js/scene-system/scene-ui-scale-manager.ts`, `src/js/ui/theme/ui-scale-state.ts`, `src/js/ui/theme/classic-theme-manager.ts`, `src/js/ui/theme/theme-host-sync.ts`, `src/styles/design-system/themes/theme-base.css`
- **Description**: Ensure the scene scale setting drives room scene-view and debug the same way the app scale drives classic room mode. The setting must update runtime layout through the same ownership model, not a separate fix-up path.
- **Complexity**: 6/10
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Changing scene scale in settings updates room scene-view and debug predictably.
  - No extra scene-only workaround logic is introduced.
- **Validation**:
  - Change scene scale and re-open a scene-enabled room.
  - Confirm the runtime frame and debug/editor surfaces respond consistently.

## Sprint 3: Refactor Room Families to Follow the Contract
**Goal**: Remove room-specific viewport assumptions and move scroll to intentional inner panels.
**Demo/Validation**:
- `XOX`, `Team Tetris`, `Fate Knots`, and `Media Analysis` fit at `1920x1080` and `100%` without root-page overflow.
- Inner panels still scroll where needed.

### Task 3.1: Refactor `game-room` shared base
- **Location**: `rooms/game-room/shared/styles/base.css`, `rooms/game-room/ui/index.js`, `rooms/game-room/shared/host/context-state.js`
- **Description**: Update the shared game-room runtime base so every main function inherits the new scale and height contract before feature-specific cleanup begins.
- **Complexity**: 6/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Shared base no longer encourages full-viewport self-sizing inside the webview.
  - Feature modules do not need a second corrective layer.
- **Validation**:
  - All `game-room` features still boot after the base change.

### Task 3.2: Refactor `XOX` layout ownership
- **Location**: `rooms/game-room/main-functions/xox/styles.css`
- **Description**: Remove `100vh` sizing, stop outer surface scrolling, and move scroll to the smallest necessary child regions. Keep current visual design, but make the layout fit the host box.
- **Complexity**: 7/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `XOX` no longer overflows at `100%`.
  - Left rail, board area, and stage footer all fit within the host box.
  - No new scene-view-only corrective layer is introduced.
- **Validation**:
  - Visual smoke at `100%` and `85%`.
  - Confirm only intended panels can scroll.

### Task 3.3: Refactor `Team Tetris` layout ownership
- **Location**: `rooms/game-room/main-functions/team-tetris/styles.css`
- **Description**: Remove viewport-based sizing and shift scrolling from the outer stage surface to the correct child panels.
- **Complexity**: 7/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Score bar, board panels, left rail, and stage fit within the host slot at `100%`.
  - The board grid remains readable without requiring page scroll.
- **Validation**:
  - Visual smoke in classic mode and scene-view.

### Task 3.4: Refactor `Fate Knots` root surface and stage shell
- **Location**: `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Clean up the root surface, topbar, and stage-frame height ownership so the ornate UI keeps its current style without overflowing the room host.
- **Complexity**: 8/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Decorative frames do not force extra root height.
  - Scroll, if needed, belongs to content panels rather than the entire surface.
- **Validation**:
  - Visual smoke with topbar, scene-view, and main content present.

### Task 3.5: Refactor `laboratory` shared shell and feature shells
- **Location**: `rooms/laboratory/shared/styles/shell.css`, `rooms/laboratory/shared/ui/navigation-runtime.js`, `rooms/laboratory/shared/host/runtime-bootstrap.js`, `rooms/laboratory/ui/bootstrap-state-runtime.js`, `rooms/laboratory/ui/bootstrap-runtime.js`, `rooms/laboratory/main-functions/media-analysis/styles.css`, `rooms/laboratory/main-functions/audio-analysis/styles.css`, `rooms/laboratory/main-functions/subtitle-analysis/styles.css`
- **Description**: Normalize the shared laboratory shell first, then revise feature shells so stage steps, project cards, and canvas/report sections fit without root overflow.
- **Complexity**: 8/10
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Media Analysis fits at `100%` with no outer room scroll.
  - Audio and subtitle flows inherit the same corrected sizing behavior.
- **Validation**:
  - Visual smoke for at least one feature per laboratory flow.
  - Confirm shared shell changes do not regress feature switching.

## Sprint 4: Bring Scene-View and Scene Debug onto the Same Contract
**Goal**: Make scene-view and debug layouts inherit the same revised sizing model instead of compensating with special-case shrink rules.
**Demo/Validation**:
- Scene-view fits its runtime slot at `100%`.
- Scene debug overlays stay usable and clipped correctly inside the scene shell.

### Task 4.1: Simplify scene-view feature revisions
- **Location**: `src/styles/rooms/scene.css`, `rooms/game-room/main-functions/xox/styles.css`, `rooms/game-room/main-functions/team-tetris/styles.css`, `rooms/game-room/main-functions/fate-knots/styles.css`, `rooms/laboratory/main-functions/media-analysis/styles.css`
- **Description**: Rework current `body[data-presentation-mode="scene-view"]` rules so they express true presentation differences, not hidden fixes for broken classic-mode sizing.
- **Complexity**: 7/10
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Scene-view blocks become smaller and cleaner because classic-mode overflow bugs are gone.
  - Runtime frames fit scene slots without extra scrollbar creation.
- **Validation**:
  - Compare classic mode and scene-view in the same room/feature.
  - Confirm scene-view no longer needs "collapse everything to survive" behavior.

### Task 4.2: Refit room scene runtime frame and back-layer chrome
- **Location**: `src/js/pages/room-page/scene-presentation.ts`, `src/js/pages/room-page/scene-sync-runtime.ts`, `src/js/pages/room-page/page-view-runtime.ts`, `src/styles/scene-system/shell.css`
- **Description**: Ensure scene runtime frame bounds, back controls, and presentation transitions still align after scale and height contract changes.
- **Complexity**: 6/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Scene back controls remain clickable and correctly positioned.
  - Runtime slot bounds stay aligned with scene frame art and panel art.
- **Validation**:
  - Visual smoke while entering and exiting a feature through scene hotspots.

### Task 4.3: Revise scene debug/editor host sizing
- **Location**: `src/styles/scene-editor/editor-panel.css`, `src/styles/scene-editor/debug-overrides.css`, `src/js/pages/room-page/scene-debug-runtime.ts`, `src/js/pages/room-page/scene-debug-composition.ts`, `src/js/pages/room-page/page-scene-runtime.ts`
- **Description**: Make the debug editor host obey the same scene shell sizing rules so debug panels do not introduce new overflow or clipping problems after runtime scale changes.
- **Complexity**: 7/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Scene debug panel stays fully accessible in scene mode.
  - Debug overlays do not push runtime content out of frame or create double scroll.
- **Validation**:
  - Open scene debug on a room with scene data and verify panel fit, drag, resize, and overlay hit targets.

### Task 4.4: Verify scene-debug save and source synchronization behavior
- **Location**: `src/js/modules/rooms/room-scene-debug.ts`, installed room workflow through Electron room package manager
- **Description**: Confirm scene-debug save flows still write the right copies after the room source-of-truth and install-sync rules are enforced, and avoid stale manifest overwrites during the CSS/layout refactor.
- **Complexity**: 5/10
- **Dependencies**: Task 1.3, Task 4.3
- **Acceptance Criteria**:
  - Scene-debug save continues to update the intended manifest copies.
  - Debug save does not hide install-sync drift during verification.
- **Validation**:
  - Save a scene-debug adjustment and verify both active runtime behavior and expected manifest targets.

## Sprint 5: Install, Verify, and Lock the New Contract
**Goal**: Validate the revision through the actual installed room pipeline and leave behind a stable smoke checklist.
**Demo/Validation**:
- Workspace edits are reflected in active installed room copies.
- All target visual problems are covered by a repeatable manual regression checklist.

### Task 5.1: Reinstall workspace room packages after source revisions
- **Location**: `rooms/`, installed room workflow through Electron room package manager
- **Description**: Reinstall updated workspace rooms so the active runtime loads the revised CSS and runtime assets from installed copies.
- **Complexity**: 4/10
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Active room runtime matches workspace changes after install/update.
  - No manual double-editing of installed copies is required.
- **Validation**:
  - Installed runtime path timestamps or rendered UI confirm sync completion.

### Task 5.2: Run the room fit smoke matrix
- **Location**: Manual verification plus optional `.rovo/*-smoke.md` artifact
- **Description**: Create and execute a smoke checklist covering classic mode, scene-view, and scene debug at the key scale presets.
- **Complexity**: 5/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Matrix covers `100%`, `85%`, and at least one larger preset.
  - Matrix covers `XOX`, `Team Tetris`, `Fate Knots`, and `Media Analysis`.
  - Matrix checks no root overflow, correct inner scroll ownership, correct scene-view fit, and debug usability.
- **Validation**:
  - Manual pass/fail checklist with screenshots or notes.

### Task 5.3: Run project validation and regression checks
- **Location**: Whole project
- **Description**: Run type and syntax checks, then targeted runtime smoke for room navigation, feature switching, scene entry, and debug activation.
- **Complexity**: 5/10
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Type/syntax checks pass.
  - No room runtime fails to boot after the CSS and scale revisions.
- **Validation**:
  - `npm run typecheck`
  - Targeted syntax/lint checks for changed files where practical
  - Manual runtime smoke in the installed app

## Testing Strategy
- Use visual verification first on `1920x1080` with classic room mode at `100%`, because that is the current failure baseline.
- Re-run the same routes at `85%` and one larger preset to confirm scale semantics stay consistent after the refactor.
- Validate both direct tab feature switches and scene-hotspot entry into features.
- Verify scene debug with panel open, dragged, resized, and closed.
- Confirm scroll ownership explicitly:
  - Room page root should not scroll by default.
  - Feature root surface should not scroll unless intentionally designed to.
  - Intended log/list/body subpanels may scroll.

## Potential Risks & Gotchas
- Replacing room runtime `transform: scale(...)` with a layout-aware mechanism may affect pointer math, screenshot baselines, and scene projection alignment.
- Some current `scene-view` blocks likely hide classic-mode bugs. Cleaning the base may require removing or shrinking those blocks, not just editing classic rules.
- `rooms/` and `data/rooms/` duplication can cause false positives if installed copies are not refreshed.
- Bootstrap state defaults can cause a wrong first paint even after the steady-state runtime contract is fixed.
- Runtime JS that captures and restores root scroll can silently reintroduce page scrolling unless it is revised with the CSS changes.
- Scene debug currently writes certain manifest changes to both installed and source copies, so verification order matters; stale installed manifests can make the refactor look correct or incorrect for the wrong reason.
- App scale and scene scale already flow through different managers, so scale-contract changes must be tested through both theme appearance updates and explicit scene scale updates.
- `Fate Knots` is visually dense and may still need targeted compaction after the shared fix, even if the contract is correct.
- Debug overlays use absolute positioning and independent max-height logic; they can regress even if classic room mode is fixed.
- If a runtime currently depends on outer `overflow: auto`, moving scroll inward can expose missing `min-height: 0` on intermediate grid/flex containers.

## Rollback Plan
- Revert by sprint boundary, not file-by-file cherry-picking.
- If the shared scale contract change destabilizes scene-view or pointer behavior, keep the host/layout cleanup and temporarily revert only the runtime scale mechanism.
- If a room family regresses, revert that room family’s feature styles while keeping shared host cleanup intact.
- Do not keep partial duplicate fixes in both workspace and installed copies; either revert workspace and reinstall, or move forward cleanly.
