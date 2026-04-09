# Plan: Rooms Main Function Centralization

**Generated**: 2026-03-26
**Estimated Complexity**: High

## Overview
Turn the current room system into a portable, modular `room -> main-functions` architecture without breaking existing room packaging, installation, or runtime behavior.

The current foundation is already close:
- `manifest.features[]` already behaves like the canonical "main function" list.
- room bundle import/export already exists.
- runtime data already has room-aware roots under `data/rooms/*` and `data/room-storage/*`.

The main gaps are structural:
- room host and UI runtimes are still monolithic
- room feature code is not consistently isolated under feature-owned folders
- room CSS is still mostly single-file per room
- protocol and host loader contracts still assume flatter file layouts
- generated artifacts still leak into workspace folders such as `rooms/*/dist`

This plan keeps the room system portable while making it easier for multiple agents to work in parallel on isolated files.

## Assumptions
- `manifest.features[]` remains the canonical "ana fonksiyon" model.
- `data/rooms/<room>` remains the installed portable room copy.
- mutable runtime data, reports, exports, caches, models, and analysis outputs move under `data/room-storage/<room>`.
- room-specific logic should live inside `rooms/<room>/**`, while `src/**` and `electron/**` stay generic.
- no room-specific behavior should be added to core during this refactor.

## Current Hotspot Analysis
- `rooms/laboratory/host/index.js` — 12,563 lines
  - storage, tool bridge, project lifecycle, edit/profile/process/report flows, audio analysis, subtitle analysis, and report composition are all mixed together
- `rooms/laboratory/ui/index.js` — 6,776 lines
  - bootstrap, state, local drafts, stage navigation, rendering, and three main functions are all in one file
- `rooms/game-room/host/index.js` — 3,402 lines
  - XOX, Team Tetris, AI transport, US1 transport, and persistence are coupled
- `rooms/game-room/ui/index.js` — 2,661 lines
  - two separate game UIs plus shared shell logic live in one script
- `src/js/pages/room-page.ts` — 1,608 lines
  - room page shell, webview lifecycle, scene rendering, and scene-debug glue are tightly coupled
- `electron/room-package-manager.ts` — 1,259 lines
  - workspace discovery, install/export/import, registry hydration, and file snapshot logic are bundled together
- `src/types/rooms.ts` — 1,206 lines
  - room schema types, installed types, bundle types, and validation live in one file
- `rooms/laboratory/ui/style.css` — 26,284 bytes
  - shared shell and feature/stage styling are mixed
- `rooms/game-room/ui/style.css` — 26,659 bytes
  - XOX and Team Tetris visual systems share a single stylesheet

## Target Structure
The refactor should converge on this package pattern:

```text
rooms/<room-id>/
  manifest.json
  host/
    index.js
  ui/
    index.html
    bootstrap.js
    style.css
  shared/
    host/
    ui/
    styles/
    protocols/
    assets/
    data/
  main-functions/
    <feature-id>/
      host/
      ui/
      styles/
      assets/
      protocols/
      data/
```

Runtime-owned files should converge on:

```text
data/
  rooms/<room-id>/                     # installed portable room copy
  room-storage/<room-id>/              # mutable room runtime data
    exports/
    caches/
    models/
    tools/
    projects/
      <project-id>/
        shared/
        main-functions/<feature-id>/
```

## Prerequisites
- protect the current dirty worktree and avoid reverting unrelated user changes
- keep existing room install/import/export flows working during the transition
- preserve current room ids, feature ids, command names, and protocol keys unless there is a deliberate schema migration
- add migration coverage for existing installed rooms and laboratory project data

## Sprint 1: Contract and Loader Foundation
**Goal**: Make the room platform capable of loading modular room packages before migrating either room.
**Demo/Validation**:
- a sample room host can load logic from sibling modules instead of one giant `host/index.js`
- a sample room UI can boot from `ui/bootstrap.js` and load shared + feature-local modules
- bundle import/export still works with the new multi-file room layout

### Task 1.1: Define the canonical room/main-function package contract
- **Location**: `src/types/rooms.ts`, `scripts/tests/room-manifest-regressions.test.ts`, `.rovo/03-ARCHITECTURE.md`
- **Description**: Freeze the rules for `shared/` and `main-functions/<featureId>/` folders, clarify what belongs in workspace vs installed room vs runtime storage, and document which paths are stable packaging inputs.
- **Complexity**: 5
- **Dependencies**: none
- **Acceptance Criteria**:
  - core room docs describe the canonical folder layout
  - the contract explicitly distinguishes source files from runtime/generated files
  - manifest validation tests cover any new path rules
- **Validation**:
  - targeted room manifest regression tests
  - manual review of architecture doc and type surface

### Task 1.2: Add a modular room host loading strategy
- **Location**: `src/js/modules/rooms/room-host-runtime.ts`, new `src/js/modules/rooms/room-host-loader.ts`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Replace the current single-file-only `new Function(...source)` assumption with a room-local loader that can resolve relative CommonJS-style modules from the installed room directory, or introduce an equivalent generic host bundling step if that proves safer.
- **Complexity**: 9
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - room host bootstrap can delegate to shared and main-function modules
  - installed room path resolution remains room-local and traversal-safe
  - bundle import/export continues to work for multi-file rooms
- **Validation**:
  - add a fixture bundle whose `host/index.js` depends on sibling modules
  - run room bundle import regressions

### Task 1.3: Switch room UIs to a modular bootstrap contract
- **Location**: `rooms/*/ui/index.html`, `rooms/*/ui/bootstrap.js`, `scripts/tests/room-page-regressions.test.ts`
- **Description**: Standardize room UIs on a bootstrap entry that can import shared and main-function modules. The simplest path is `type="module"` plus relative imports, while keeping `ui/index.html` as the stable manifest entry.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - room UI entry can be kept thin
  - per-feature UI modules can load without core knowing room internals
  - existing room-page webview mounting behavior does not change
- **Validation**:
  - room-page regressions
  - manual smoke on one migrated room

### Task 1.4: Extend protocol loading so feature-local protocol files are supported
- **Location**: `src/types/rooms.ts`, `src/js/modules/rooms/room-protocol-registry.ts`, `scripts/tests/room-protocol-registry-regressions.test.ts`, `scripts/tests/room-manifest-regressions.test.ts`
- **Description**: Remove the implicit assumption that every protocol file must live under room-root `protocols/<key>.md`. Add an optional manifest-level path field or an equivalent generic resolver so protocol files can live next to their owning main function.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - protocol files can live under `main-functions/<featureId>/protocols`
  - runtime protocol registry stays generic
  - protocol keys and user-facing transport behavior remain unchanged
- **Validation**:
  - protocol registry regressions
  - manifest validation regressions

### Task 1.5: Formalize room runtime storage policy
- **Location**: `electron/room-tool-service.ts`, `electron/paths.ts`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Lock down which files belong under `data/rooms/<room>` and which belong under `data/room-storage/<room>`, including exports, caches, models, and generated reports.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - generated outputs never need to live under `rooms/<room>`
  - room tools only write inside managed room roots
  - the storage policy is explicit enough for later migrations
- **Validation**:
  - targeted room-tool path checks
  - manual audit against laboratory runtime paths

## Sprint 2: Core Room System Decomposition
**Goal**: Shrink the core god files that every room migration depends on.
**Demo/Validation**:
- room core files are split into stable submodules with preserved public APIs
- room install, registry, and runtime behavior remain unchanged
- multiple contributors can work on room core without touching a single giant file

### Task 2.1: Split room schema and validation types
- **Location**: `src/types/rooms.ts` into `src/types/rooms/*`
- **Description**: Separate schema constants, scene types, installed record types, bundle types, and validation helpers into distinct files with one barrel export.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `@shared/index.js` surface stays compatible
  - validation behavior does not regress
  - room-specific migrations can edit smaller files
- **Validation**:
  - room manifest regressions
  - typecheck

### Task 2.2: Split room package manager by responsibility
- **Location**: `electron/room-package-manager.ts`, new `electron/rooms/*`
- **Description**: Extract workspace discovery, installed record building, snapshot cleanup, import/export, and registry read/write into smaller modules.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - install/import/export behavior is preserved
  - file snapshot deletion logic is isolated
  - generated bundle output location becomes configurable for later data migration
- **Validation**:
  - room bundle import regressions
  - room package install/export regressions if present

### Task 2.3: Split room page runtime shell
- **Location**: `src/js/pages/room-page.ts`, new `src/js/pages/room-page/*`
- **Description**: Separate page shell rendering, scene composition, room webview bridge, and scene-debug integration into focused modules.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - room page controller stays generic
  - no room-specific logic is introduced into the new modules
  - scene view behavior remains unchanged
- **Validation**:
  - room page regressions
  - scene debug room regressions

### Task 2.4: Split shared room CSS
- **Location**: `src/styles/rooms.css`, new `src/styles/rooms/*`
- **Description**: Move corridor, classic cards, immersive shell, runtime mount, and scene shell styles into smaller files with a single aggregate entry.
- **Complexity**: 4
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - room shell styles are easier to reason about
  - page-level selectors stay generic
  - no room-specific selectors move into shared CSS
- **Validation**:
  - visual smoke in corridor and two room pages
  - CSS build sanity check

## Sprint 3: Game Room Migration to Shared + Main Functions
**Goal**: Convert `game-room` into the first full room/main-function package.
**Demo/Validation**:
- `game-room` uses `shared/` plus `main-functions/xox` and `main-functions/team-tetris`
- host and UI bootstraps become thin
- XOX and Team Tetris can evolve mostly independently

### Task 3.1: Create the target Game Room folder layout
- **Location**: `rooms/game-room/**`
- **Description**: Introduce `shared/` and `main-functions/` folders while keeping `manifest.json`, `host/index.js`, and `ui/index.html` as the portable package entry points.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - room layout matches the agreed contract
  - entry files only orchestrate shared and feature modules
  - bundle export still includes the new files
- **Validation**:
  - workspace room listing
  - bundle packaging smoke

### Task 3.2: Split Game Room host by domain
- **Location**: `rooms/game-room/host/index.js`, `rooms/game-room/shared/host/*`, `rooms/game-room/main-functions/xox/host/*`, `rooms/game-room/main-functions/team-tetris/host/*`
- **Description**: Extract shared context/persistence helpers, XOX engine and commands, Team Tetris engine and commands, and US1/AI transport helpers into separate files.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - bootstrap host file becomes thin
  - XOX and Team Tetris state machines are isolated
  - room command and protocol registration still originates from the room package
- **Validation**:
  - `scripts/tests/game-room-xox-room-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-room-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-host-regressions.test.ts`

### Task 3.3: Split Game Room UI by shared shell and main function
- **Location**: `rooms/game-room/ui/index.js`, `rooms/game-room/ui/bootstrap.js`, `rooms/game-room/shared/ui/*`, `rooms/game-room/main-functions/xox/ui/*`, `rooms/game-room/main-functions/team-tetris/ui/*`
- **Description**: Extract shared room shell, bridge events, state hydration, XOX surface, Team Tetris surface, and reusable board rendering pieces.
- **Complexity**: 8
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - the bootstrap UI file becomes thin
  - feature UIs are independently editable
  - room payload contracts do not drift between UI and host
- **Validation**:
  - `scripts/tests/game-room-team-tetris-ui-path-regressions.test.ts`
  - targeted XOX room regressions

### Task 3.4: Redistribute Game Room CSS into shared and feature files
- **Location**: `rooms/game-room/ui/style.css`, `rooms/game-room/shared/styles/*`, `rooms/game-room/main-functions/xox/styles/*`, `rooms/game-room/main-functions/team-tetris/styles/*`
- **Description**: Move shared shell styling to room-shared CSS and keep game-specific selectors near the owning main function.
- **Complexity**: 5
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - shared room shell selectors are separated from XOX and Team Tetris selectors
  - feature styles are easier to change without side effects
  - final CSS entry remains portable inside the room package
- **Validation**:
  - manual visual smoke in both games
  - no selector collisions during feature switch

### Task 3.5: Move Game Room generated artifacts out of workspace
- **Location**: `scripts/rooms/build-room-bundle.mjs`, `electron/room-package-manager.ts`, `rooms/game-room/dist/*`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Stop using `rooms/game-room/dist` as the default output for generated bundles. Redirect exports to `data/room-storage/game-room/exports` or a shared room-export path under `data`.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - workspace room folders contain only source/package inputs
  - exported `.hevroom` files become runtime artifacts under `data`
  - import/export workflows remain documented and testable
- **Validation**:
  - build-room-bundle smoke
  - bundle import regressions

## Sprint 4: Laboratory Migration to Shared + Main Functions
**Goal**: Convert `laboratory` into a fully modular room package with three isolated main functions.
**Demo/Validation**:
- `laboratory` uses `shared/` plus `main-functions/media-analysis`, `main-functions/audio-analysis`, and `main-functions/subtitle-analysis`
- stage-specific logic is no longer buried inside one host or one UI file
- laboratory data layout clearly separates shared runtime state from feature-owned outputs

### Task 4.1: Create the target Laboratory folder layout
- **Location**: `rooms/laboratory/**`
- **Description**: Introduce `shared/` and `main-functions/` folders, classify current assets/descriptors by ownership, and keep thin package entry files at room root.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - every current laboratory feature has an owning main-function directory
  - room-shared assets and tool descriptors are clearly separated from feature-owned ones
  - package entry points remain stable
- **Validation**:
  - workspace room listing
  - room package smoke

### Task 4.2: Split Laboratory host into shared services and feature pipelines
- **Location**: `rooms/laboratory/host/index.js`, `rooms/laboratory/shared/host/*`, `rooms/laboratory/main-functions/*/host/*`
- **Description**: Extract path resolution, project persistence, room-tool bridge, shared report helpers, and per-feature process pipelines into separate modules.
- **Complexity**: 10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - the root host file becomes orchestration only
  - media-analysis, audio-analysis, and subtitle-analysis register their own handlers through feature modules
  - feature ownership of tool descriptors and report composition is explicit
- **Validation**:
  - `scripts/tests/laboratory-media-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-audio-analysis-room-regressions.test.ts`
  - `scripts/tests/laboratory-subtitle-analysis-room-regressions.test.ts`

### Task 4.3: Split Laboratory UI by shared shell, stage framework, and feature surfaces
- **Location**: `rooms/laboratory/ui/index.js`, `rooms/laboratory/ui/bootstrap.js`, `rooms/laboratory/shared/ui/*`, `rooms/laboratory/main-functions/*/ui/*`
- **Description**: Extract shared room chrome, request tracking, local draft stores, stage navigation, and per-feature presentation modules.
- **Complexity**: 9
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - the root UI file becomes bootstrap-only
  - stage rendering logic is separated from feature-specific rendering
  - shared room shell code is reusable across the three main functions
- **Validation**:
  - laboratory room regressions
  - targeted smoke for each feature surface

### Task 4.4: Redistribute Laboratory CSS into room-shared and feature/stage files
- **Location**: `rooms/laboratory/ui/style.css`, `rooms/laboratory/shared/styles/*`, `rooms/laboratory/main-functions/*/styles/*`
- **Description**: Move shell, shared chips, generic panel primitives, and feature-specific stage styling into separate CSS files while keeping a thin aggregate entry.
- **Complexity**: 6
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - shared shell selectors are isolated
  - media, audio, and subtitle surfaces can be edited independently
  - CSS ownership mirrors the new room folder layout
- **Validation**:
  - manual visual smoke in each laboratory feature
  - check for cross-feature selector leakage

### Task 4.5: Move Laboratory feature data under feature-scoped runtime folders
- **Location**: `rooms/laboratory/tools/project-schema.json`, `rooms/laboratory/shared/data/*`, `rooms/laboratory/main-functions/*/data/*`, `electron/room-tool-service.ts`
- **Description**: Evolve project/runtime paths so generated artifacts map cleanly to main-function ownership. Shared project metadata can stay shared, but derived outputs, reports, caches, and exports should become feature-scoped.
- **Complexity**: 9
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - generated outputs no longer rely on flat room-wide derived folders where feature ownership is ambiguous
  - room runtime paths stay within `data/room-storage/laboratory`
  - existing project data has a defined migration path
- **Validation**:
  - laboratory project schema regressions
  - manual migration smoke on an existing lab project

## Sprint 5: Data Hygiene, Migration, and Bundle Parity
**Goal**: Finish the transition so both rooms are portable packages and all non-core artifacts live under room-scoped data folders.
**Demo/Validation**:
- room source folders contain only package inputs
- installed room copies and runtime data follow a clear ownership split
- old room data and old bundle output locations can be migrated safely

### Task 5.1: Add migration scripts for old room layouts and generated artifacts
- **Location**: new `scripts/rooms/migrate-room-layouts.mjs`, `scripts/rooms/build-room-bundle.mjs`, `electron/room-package-manager.ts`
- **Description**: Provide one-way migrations for workspace `dist` outputs, installed room copies, and laboratory runtime project data that moves to feature-scoped folders.
- **Complexity**: 7
- **Dependencies**: Sprints 3 and 4
- **Acceptance Criteria**:
  - the migration can relocate old artifacts without touching source package files
  - legacy paths remain readable long enough for transition if needed
  - rollback steps are documented
- **Validation**:
  - migration dry-run on current repo data
  - spot-check restored paths

### Task 5.2: Add a room leakage audit
- **Location**: `scripts/tests/room-bundle-import-regressions.test.ts`, new `scripts/tests/room-package-boundary-regressions.test.ts`, `scripts/tests/room-page-regressions.test.ts`
- **Description**: Add automated checks that fail if room-specific code paths or generated room artifacts drift back into generic core locations.
- **Complexity**: 6
- **Dependencies**: Sprint 2, Sprint 3, Sprint 4
- **Acceptance Criteria**:
  - tests catch room package files outside allowed roots
  - tests catch generated bundle outputs in workspace room folders
  - tests guard protocol/command/runtime path consistency
- **Validation**:
  - full targeted room regression suite

### Task 5.3: Re-sync installed room copies and confirm parity
- **Location**: `config/rooms.json`, `data/rooms/*`, `rooms/*`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Reinstall or re-export migrated rooms so installed copies match workspace packages and registry metadata reflects the new file layout.
- **Complexity**: 5
- **Dependencies**: Sprints 3 and 4
- **Acceptance Criteria**:
  - installed room copies contain the new modular layout
  - registry paths resolve correctly after migration
  - room bundle import/export still recreates the same package
- **Validation**:
  - room install/export/import smoke
  - compare workspace and installed room contents

## Testing Strategy
- Run targeted room regressions after each sprint instead of waiting for the end.
- Keep `npm run typecheck` mandatory after any core room or shared type change.
- Add loader-specific tests before migrating rooms so room refactors do not have to debug platform issues and feature moves at the same time.
- Validate both room package paths and runtime data paths:
  - workspace source
  - installed room copy
  - runtime storage
- Preserve room command and protocol contracts during refactors:
  - command names
  - protocol keys
  - room ids
  - feature ids

## Potential Risks & Gotchas
- The current room host loader only evaluates one CommonJS file.
  - Without a generic loader upgrade or equivalent bundling strategy, host modularization will stall.
- The current protocol registry assumes `protocols/<key>.md` under the installed room root.
  - Feature-local protocol folders require a generic resolver change.
- Generated room bundles currently default to workspace `dist`.
  - Moving them into `data` changes existing packaging habits and tests.
- Laboratory project data is already populated under `data/room-storage/laboratory/projects/*`.
  - Feature-scoped data migration must avoid corrupting existing project histories.
- The repository is already dirty.
  - Refactors must not overwrite unrelated user work, especially in room manifests and installed copies.
- The installed room registry currently references only `laboratory`.
  - parity checks must cover both workspace-only rooms and installed rooms.

## Rollback Plan
- Keep the old entry points (`host/index.js`, `ui/index.html`, `ui/style.css`) valid throughout the migration so each sprint can stop at a working state.
- Land loader and protocol-path changes before room content moves so package breakages can be isolated quickly.
- If a room migration becomes unstable:
  - restore the thin bootstrap files to delegate back to the previous monolith temporarily
  - keep feature folders in place so decomposition work is not lost
- If runtime data migration causes regressions:
  - preserve a legacy read path for old laboratory project directories during the transition sprint
  - defer destructive cleanup until parity checks pass
