# Plan: Room System Scene Mode

**Generated**: 2026-03-21
**Estimated Complexity**: High

## Overview
This plan rebuilds Hayalet Ev's room system outside `ghost-agent` around a stricter, simpler contract.

The target model is:
- `classic`: the built-in `rooms` page becomes a shell/launcher, installed room links live in the overlay menu, and each room page can switch between one or more room features inside the same runtime.
- `scene`: the `rooms` corridor gains one clickable area per installed room, each installed room gets its own room-scene with clickable feature hotspots, and clicking a feature opens a close-up scene view whose transparent area hosts the same classic room UI.
- `import/export`: every room capability that matters at runtime is canonical inside the room package itself, including optional i18n catalogs and optional scene assets/layout metadata.

This rollout is intentionally aggressive:
- no fallback path
- no backward compatibility layer
- no migration phase for old room manifests
- no real-time room hot-add / hot-remove behavior
- the legacy sample room and all repository references/records for it are removed

The canonical lifecycle becomes:
1. room workspace changes
2. install/import writes canonical room package data
3. wrapper restart reloads the room projection from disk

## Current State Snapshot
- Classic dynamic room chrome already exists through `src/js/app/room-ui.ts` and `src/js/pages/room-page.ts`, but every room is currently treated as one standalone runtime surface.
- The built-in `rooms` page is only a static shell in classic mode and a fixed corridor scene in scene mode via `src/js/pages/rooms.ts` and `shared/themes/castle/maps/rooms.scene.json`.
- Scene infrastructure is tightly coupled to built-in room IDs through `src/js/scene/schema.ts`, `src/js/scene-system/scene-layout-registry.ts`, and `src/js/scene-editor/scene-debug-room-registry.ts`.
- Room packages are recursively bundled and installed by `electron/room-package-manager.ts` and `scripts/rooms/build-room-bundle.mjs`, but there is no room-owned scene or room-owned i18n contract yet.
- Room runtime messaging currently supports only generic `ready`, `sendCommand`, and `sendEvent` bridges; there is no feature-selection or scene-context protocol.
- External language loading already merges installed catalogs from disk, so room i18n can join that system if namespacing and cleanup rules are explicit.

## Hard Decisions
- Room v2 is the only supported room contract after this work. Old room manifests are out of scope.
- Room install/import/update/remove requires restart. Live runtime mutation is removed instead of maintained.
- Installed-room scene data is owned by the room package, not by the active built-in theme source.
- Built-in scene pages keep their current theme-owned maps; installed rooms use a separate installed-room scene registry/projection instead of widening `SceneRoomId` across the whole app on day one.
- Optional room i18n must live under the room package contract and install into a room-scoped namespace with deterministic cleanup on update/remove.
- the legacy sample room package and all code, tests, docs, manifests, bundles, and references tied to it are removed instead of adapted.

## Scope
- Included:
  - `src/`
  - `electron/`
  - `shared/`
  - `rooms/`
  - `scripts/`
  - `.rovo/`
- Excluded:
  - `ghost-agent/`
  - compatibility adapters for old room manifests
  - dual-mode live room sync during install/import/remove

## Prerequisites
- Accept that this is a breaking room-system revision.
- Accept that repository sample content built on the current room contract will be deleted, not migrated.
- Keep room capabilities canonical inside the room package so export/import remains deterministic.

## Sprint 1: Reset the Room Architecture Contract
**Goal**: Define one strict room model, one strict install lifecycle, and one ownership boundary for scene/i18n data before any UI rewrite.
**Demo/Validation**:
- A written v2 room contract exists in code.
- Startup can reject old room manifests instead of trying to normalize them.
- One ADR-style note inside the plan/code comments captures the ownership rules.

### Task 1.1: Replace the Room Manifest Schema With a Breaking v2 Contract
- **Location**: `src/types/rooms.ts`, optional schema notes under `.rovo/`
- **Description**: Replace the current room manifest model with a v2 contract that requires explicit `features[]`, room-level classic config, optional scene config, optional i18n config, and canonical package-relative asset references.
- **Complexity**: 8
- **Dependencies**: None
- **Acceptance Criteria**:
  - Old manifest shapes are rejected.
  - A room declares one or more features explicitly.
  - Every room capability is package-relative and exportable.
- **Validation**:
  - Update room schema tests with valid/invalid v2 fixtures.
  - Add explicit failure coverage for old single-runtime manifests.

### Task 1.2: Define Ownership Boundaries for Installed-Room Scene Data
- **Location**: new `src/js/modules/rooms/room-projection.ts`, new installed-room scene registry module under `src/js/modules/rooms/` or `src/js/scene-system/`, `src/js/scene-system/scene-layout-registry.ts`, `src/js/scene-editor/scene-debug-runtime-session.ts`
- **Description**: Establish two clear lanes: built-in scene pages remain theme-owned, installed-room scene data remains room-owned. Scene debug/save flows for installed rooms must write back to room package sources, not theme-root sources.
- **Complexity**: 9
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Installed-room scene save paths are separate from theme-root save paths.
  - Theme switching does not erase installed-room scene ownership.
  - The codebase no longer implies that every scene room is a built-in theme room.
- **Validation**:
  - Add tests around installed-room scene source path resolution.
  - Add tests around theme switching with installed rooms present.

### Task 1.3: Make Restart the Only Install/Import/Remove Lifecycle
- **Location**: `src/js/pages/settings/panels/rooms.ts`, `src/js/modules/rooms/room-registry.ts`, `src/js/app/room-ui.ts`, wrapper-facing restart integration points
- **Description**: Remove the decision seam and make restart-required behavior canonical. Install/import/update/remove should finish by writing disk state and surfacing a restart-required result; live hot-add and live hot-remove details should be deleted.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The code no longer tries to keep current-session room runtime state fully fresh after room mutations.
  - Restart-required UX is explicit.
  - Stale command/protocol/runtime registration is blocked or cleared safely until restart.
- **Validation**:
  - Add regression coverage for restart-required operations.
  - Manual smoke: install/remove a room, confirm restart is required and respected.

## Sprint 2: Remove Legacy Room Content and Dead Paths
**Goal**: Delete old room content and strip the old room system of compatibility assumptions before building the new path.
**Demo/Validation**:
- the legacy sample room no longer exists in the repo.
- Tests and docs no longer mention XOX or legacy room behavior.
- Room code no longer contains fallback branches for legacy manifests or hot-add behavior.

### Task 2.1: Remove the legacy sample room and all repository references
- **Location**: sample-room package files, room tests, `README.md`, `.rovo/*`, and any source files referencing the removed sample room
- **Description**: Delete the old sample room package and remove every reference to it from tests, docs, manifests, examples, and bundle flows.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The legacy sample room package is gone.
  - No room tests or docs reference the removed sample room by name.
  - No code path assumes the removed sample room as a sample or bootstrap room.
- **Validation**:
  - `rg` for the removed sample room identifier only returns intentionally unrelated text, or nothing.

### Task 2.2: Remove Legacy Room Compatibility Branches
- **Location**: `src/types/rooms.ts`, `src/js/modules/rooms/`, `electron/room-package-manager.ts`, `scripts/rooms/build-room-bundle.mjs`
- **Description**: Delete compatibility logic for old manifest shapes, legacy single-runtime assumptions, and transitional normalization branches.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Room parsing is single-path.
  - Package manager and bundle builder only understand v2 rooms.
  - Legacy adapter language is removed from code and tests.
- **Validation**:
  - Add negative tests for old room contract rejection.

### Task 2.3: Remove Real-Time Room Mutation Logic
- **Location**: `src/js/modules/rooms/room-registry.ts`, `src/js/app/room-ui.ts`, room settings panel flows, related tests
- **Description**: Delete the live sync behavior that tries to mutate room chrome, commands, protocols, and runtimes immediately after room install/import/remove.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Room mutation flows no longer promise same-session full integration.
  - Only boot-time projection owns the active room surface list.
  - Dead hot-add/hot-remove tests are removed or rewritten.
- **Validation**:
  - Regression tests show room list changes after restart/bootstrap, not by live mutation.

## Sprint 3: Rebuild the Classic Room Surface
**Goal**: Rebuild classic room navigation and room pages around the new multi-feature room model.
**Demo/Validation**:
- Overlay menu shows installed rooms from boot-time projection.
- The built-in `rooms` page works as a shell/launcher.
- Each installed room page can switch among room features inside the same room runtime.

### Task 3.1: Build a Boot-Time Room Projection Model
- **Location**: new `src/js/modules/rooms/room-projection.ts`, `src/js/modules/rooms/room-registry.ts`, `src/js/app/page-init.ts`
- **Description**: Normalize installed room records into one projection model that drives classic menu links, room pages, scene corridor entries, scene room entries, and package capability summaries.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Startup uses one projection model.
  - Page/controller code consumes projections instead of raw manifest structures.
  - Projection output includes both classic and scene surfaces.
- **Validation**:
  - Add unit tests for projection output and ordering.

### Task 3.2: Rework Classic Navigation and the `rooms` Shell
- **Location**: `src/js/app/room-ui.ts`, `src/js/modules/rooms/room-markup.ts`, `src/index.html`, `src/pages/rooms.html`
- **Description**: Move classic room navigation ownership fully to the projection model. The built-in `rooms` page becomes the shell/launcher for room discovery and room management messaging, while installed rooms live behind direct overlay links.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Installed room links come from room projections only.
  - The built-in `rooms` page is no longer treated like the place where room content itself lives.
  - There is no hard upper limit on installed room links.
- **Validation**:
  - Update room chrome and page-init regressions.

### Task 3.3: Add a Dedicated Room Runtime Protocol
- **Location**: `electron/room-webview-preload.cjs`, `src/js/modules/rooms/room-host-runtime.ts`, `src/js/pages/room-page.ts`, new shared room runtime protocol types if needed
- **Description**: Add a first-class runtime contract for `activeFeature`, `sceneContext`, `viewOpen`, and room shell metadata so the same room runtime can react cleanly to classic feature switching and scene close-up embedding.
- **Complexity**: 9
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Room runtime receives explicit feature/view context instead of inferring everything from generic events.
  - Room host/runtime lifecycle stays deterministic.
  - Classic and scene both use the same runtime protocol.
- **Validation**:
  - Add room runtime protocol regressions.

### Task 3.4: Rebuild `RoomPageController` Around Features Instead of One Runtime Surface
- **Location**: `src/js/pages/room-page.ts`, `src/styles/rooms.css`, optional new helpers under `src/js/modules/rooms/`
- **Description**: Replace the current single runtime/status shell with a room shell that can switch features, host room metadata, and expose the correct feature context to the room runtime.
- **Complexity**: 9
- **Dependencies**: Tasks 3.2 and 3.3
- **Acceptance Criteria**:
  - One room page can host multiple features.
  - Feature changes stay inside the room page.
  - The runtime survives feature transitions cleanly.
- **Validation**:
  - Add controller regressions for feature switching and runtime sync.

## Sprint 4: Build Installed-Room Scene Projection
**Goal**: Add dynamic corridor and dynamic room scenes without destabilizing built-in scene pages.
**Demo/Validation**:
- `rooms` corridor shows installed-room hotspots.
- Clicking a room opens that room in scene mode.
- Clicking a room feature hotspot opens a close-up scene view that reuses the classic room UI.

### Task 4.1: Add an Installed-Room Scene Registry Instead of Widening `SceneRoomId`
- **Location**: new installed-room scene registry/projection module under `src/js/modules/rooms/` or `src/js/scene-system/`, `src/js/scene/action-dispatcher.ts`
- **Description**: Keep built-in scene unions intact for built-in pages, and layer installed-room scene projection beside them. Add room-scene action types for `open-room`, `open-room-feature`, and `close-room-feature`.
- **Complexity**: 9
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Installed rooms do not require global widening of built-in scene enums in the first pass.
  - Scene action routing can target installed room pages and room features safely.
  - Built-in scene pages remain stable.
- **Validation**:
  - Add scene projection and action dispatch tests.

### Task 4.2: Make the `rooms` Corridor Dynamic
- **Location**: `src/js/pages/rooms.ts`, `shared/themes/castle/maps/rooms.scene.json`, installed-room scene projection helpers
- **Description**: Preserve the corridor shell but append one hotspot per installed room from the projection model. The built-in corridor map remains the base shell; installed-room nodes are composed on top at runtime.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Every installed room appears in the corridor.
  - Return-to-entrance behavior still works.
  - No hardcoded room count exists.
- **Validation**:
  - Update `rooms-scene-page` regressions.

### Task 4.3: Turn Installed Room Pages Into Scene-Capable Room Hosts
- **Location**: `src/js/pages/room-page.ts`, `src/js/scene/runtime.ts`, `src/styles/rooms.css`
- **Description**: Add room-scene root, hotspot layer, close-up view slot, and back/close handling to dynamic room pages so each installed room can render both room interior and feature close-up surfaces.
- **Complexity**: 10
- **Dependencies**: Tasks 3.4 and 4.1
- **Acceptance Criteria**:
  - Installed room pages render classic shell in classic mode and scene shell in scene mode.
  - Feature hotspot clicks open close-up views.
  - The same classic room UI is visible through the close-up transparent window.
- **Validation**:
  - Add installed-room scene host regressions.
  - Manual smoke on desktop and narrow widths.

### Task 4.4: Extend `scene:debug` to Installed Rooms With Room-Owned Save Paths
- **Location**: `src/js/scene-editor/scene-debug-room-registry.ts`, `src/js/scene-editor/scene-debug-runtime-session.ts`, `src/js/scene-editor/scene-theme-asset-state.ts`, `src/js/scene-editor/scene-layout-editor-asset-bindings.ts`
- **Description**: Let `scene:debug` select installed rooms, tune their hotspot/layout drafts, and save room-owned scene sources and transparent-window bounds back into the room package.
- **Complexity**: 9
- **Dependencies**: Tasks 4.2 and 4.3
- **Acceptance Criteria**:
  - Installed rooms appear in debug room selection.
  - Save operations for installed rooms write to room-owned sources.
  - Theme-root save behavior remains limited to built-in pages.
- **Validation**:
  - Add scene-debug registry/store tests for installed rooms.

## Sprint 5: Rebuild Room Packaging, Import, and Removal
**Goal**: Make room packaging deterministic and package-owned, and make update/remove cleanup strict.
**Demo/Validation**:
- Export emits one self-contained room bundle.
- Import installs the room package and marks restart-required.
- Remove/update clean up room-owned scene and i18n artifacts deterministically.

### Task 5.1: Make Package-Owned Capability Layout Canonical
- **Location**: `electron/room-package-manager.ts`, `scripts/rooms/build-room-bundle.mjs`, `src/types/rooms.ts`
- **Description**: Define the canonical package layout for room runtime files, scene assets, scene layout sources, transparent-window metadata, and optional i18n catalogs so export/import can operate on one self-contained package root.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Export only needs the room package root.
  - Import writes one canonical package root.
  - No external sidecar capability is required to make a room work.
- **Validation**:
  - Add package layout tests for classic-only and classic+scene+i18n rooms.

### Task 5.2: Integrate Room-Scoped I18n With Namespacing and Cleanup
- **Location**: `electron/room-package-manager.ts`, `electron/i18n/language-service.ts`, `shared/i18n/node-loader.ts`, optional room i18n registry helper
- **Description**: Install room-provided translations into a deterministic room namespace, and define update/remove cleanup semantics so room catalogs cannot orphan or shadow unrelated keys.
- **Complexity**: 8
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Room i18n installs automatically if present.
  - Room update/overwrite cleans prior room language artifacts.
  - Room remove deletes room-scoped language artifacts.
- **Validation**:
  - Add loader tests for namespace merging and cleanup.

### Task 5.3: Rebuild Import/Update/Remove Around Restart and Cleanup
- **Location**: `electron/room-package-manager.ts`, `electron/handlers/ipc-rooms.ts`, room settings panel flows, related tests
- **Description**: Implement strict install/import/update/remove flows that write package state, clean replaced artifacts, report restart-required, and never try to fully mutate current-session runtime state in place.
- **Complexity**: 8
- **Dependencies**: Tasks 5.1 and 5.2
- **Acceptance Criteria**:
  - Update replaces previous room package content cleanly.
  - Remove clears room package, room-owned scene metadata, and room-owned i18n artifacts.
  - Current session never pretends changes are fully live before restart.
- **Validation**:
  - Add import/update/remove regression coverage.

## Sprint 6: Final Verification and Docs
**Goal**: Lock the new system with focused tests and docs, with no leftover legacy references.
**Demo/Validation**:
- No removed-sample-room wording and no hot-add wording remain.
- Tests protect the new room contract and restart lifecycle.
- Docs explain only the new room model.

### Task 6.1: Rewrite the Room Regression Suite
- **Location**: `scripts/tests/room-*.test.ts`, `scripts/tests/scene-*.test.ts`, `scripts/tests/*i18n*`
- **Description**: Replace legacy room test assumptions with v2-only coverage for strict manifest parsing, classic room projection, installed-room scene projection, room runtime protocol, package import/export, and restart-required cleanup.
- **Complexity**: 8
- **Dependencies**: All prior sprints
- **Acceptance Criteria**:
  - Tests no longer reference compatibility behavior.
  - Installed-room scene and room-owned save paths are covered.
  - Restart-required lifecycle is covered.
- **Validation**:
  - Run the updated room, scene, and i18n suites.

### Task 6.2: Purge Legacy Terms and Dead Documentation
- **Location**: `README.md`, `.rovo/`, comments in touched source files
- **Description**: Remove docs that describe old room packaging, XOX examples, migration language, or real-time room insertion behavior. Replace them with the new room package contract and operational flow.
- **Complexity**: 5
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - Docs describe only the new room model.
  - XOX and legacy room references are gone.
  - Restart-required operational behavior is clearly documented.
- **Validation**:
  - `rg` for banned legacy terms and sample references.

## Testing Strategy
- Start with schema, projection, and ownership-boundary tests before UI/controller rewrites.
- Add focused regressions for:
  - strict room v2 manifest validation
  - boot-time room projection
  - classic room feature switching
  - dedicated room runtime protocol
  - dynamic corridor hotspots
  - installed-room scene host behavior
  - `scene:debug` room-owned save paths
  - package-owned scene/i18n import/export
  - update/remove cleanup
  - restart-required lifecycle
- Finish with manual smoke in:
  - `classic` mode
  - `scene` mode
  - `scene:debug` mode
  - install/import/remove plus restart

## Potential Risks & Gotchas
- Built-in scene systems still assume static built-in room IDs; installed-room scene projection must stay layered and not leak into built-in unions too early.
- Room runtime protocol changes affect preload, host runtime, and room page controller together; sequencing matters.
- Restart-required UX must prevent the user from assuming a partially updated in-memory room state is live.
- Room-owned i18n needs deterministic namespacing and cleanup or imported catalogs can linger after remove/update.
- Scene close-up transparent-window behavior depends on asset quality and consistent room package metadata.
- Removing XOX and compatibility tests early will shrink safety nets, so replacement v2 tests must land quickly.

## Recommended Decision
- Use **boot-time room projection** as the only active room surface source of truth.
- Use **restart-required install/import/update/remove** as the only operational lifecycle.
- Use **room-owned scene data** for installed rooms and **theme-owned scene data** only for built-in pages.
- Use a **dedicated room runtime protocol** for feature selection and scene context.
- Delete **XOX, legacy room assumptions, and hot-add logic** instead of adapting them.

## Rollback Plan
- If implementation work must be reverted, revert the code changes as a development rollback.
- Do not keep a product-level fallback path in the final architecture.
- If a sprint lands partially and proves unstable, revert the sprint commits rather than adding compatibility branches.
