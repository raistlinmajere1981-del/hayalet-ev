# Plan: Room Source Build Data Separation

**Generated**: 2026-04-25
**Estimated Complexity**: High

## Overview

Rework the room package lifecycle so `rooms/<roomId>` is the only editable source tree, generated room runtime builds live outside `data/`, and `data/` contains only room-owned mutable data such as projects, tool installs, model state, exports, caches, and webview/session residue.

The recommended end state is:

```text
rooms/
  <room-id>/                 # canonical editable source
  .build/<room-id>/runtime/  # ignored generated runtime artifact

config/
  rooms.json                 # registry: source path + generated runtime path

data/
  room-storage/<room-id>/    # mutable room data only
  electron-user-data/...     # Electron/session residue
```

This intentionally removes the current mental split where `data/rooms/<roomId>` looks like a second source tree while `data/room-storage/<roomId>/build/workspace` also contains compiled room code. The efficient target is one generated runtime artifact per room, not a build copy plus an installed copy.

## Current Findings

- `electron/paths.ts` already states that `rooms/` is the single editable room source and `data/rooms` is generated install copies.
- `RoomPackageManager.buildWorkspaceRoomArtifact()` currently writes builds to `data/room-storage/<roomId>/build/workspace`.
- `installFromWorkspace()` then copies that build to `data/rooms/<roomId>` and writes `config/rooms.json` with `installedDir` pointing there.
- Dev fallback installed rooms already prove that a generated build directory can act as a runtime `installedDir`.
- `.gitignore` currently ignores `data/*` but explicitly unignores `data/rooms/**`, which makes generated room code look versioned and editable.
- The current working tree has many `data/rooms/*` generated files deleted or modified, which confirms the confusion and should not be treated as source edits.
- Removed rooms can leave stale generated build folders under `data/room-storage/<roomId>/build`, so cleanup must target that generated subfolder without deleting real room data.
- Room tool runtime data already mostly belongs in `data/room-storage/<roomId>`, but the service still supports legacy package/runtime roots under installed room directories.

## Recommended Contract

- `rooms/<roomId>`: canonical source of truth for manifests, TypeScript, CSS, HTML, i18n, protocols, source assets, and room-local static data.
- `rooms/.build/<roomId>/runtime`: ignored generated runtime artifact produced from `rooms/<roomId>`.
- `config/rooms.json`: registry of installed/enabled rooms; it may reference source and runtime artifact paths, but it does not make either one editable state.
- `data/room-storage/<roomId>`: mutable room data only, including projects, generated reports, exports, tool runtimes, model caches, and room runtime state.
- `data/room-storage/<roomId>/build`: deprecated generated build residue from the old system. It should be removed by cleanup/migration, while sibling data folders remain intact.
- `data/rooms`: deprecated legacy generated package location. New code should not write to it.

## Assumptions To Confirm

- Existing room ids, feature ids, command names, protocol keys, and manifest schema version should remain stable unless a migration truly needs a schema bump.
- Imported `.hevroom.json` bundles should be materialized into `rooms/<roomId>` first, then built into `rooms/.build/<roomId>/runtime`.
- If a legacy installed room exists only in `data/rooms/<roomId>` and no `rooms/<roomId>` source exists, migration should preserve it by restoring a source copy under `rooms/<roomId>` before deleting generated state.
- `data/room-storage/<roomId>/exports` can remain in `data/` because exports are user/runtime data, not build output.
- Removing or uninstalling a room should remove its generated runtime artifact, but should not remove `data/room-storage/<roomId>` unless `deleteData` is explicitly requested.
- The compatibility field name `installedDir` can stay temporarily, but its meaning should become "runtime artifact root" until a later schema cleanup renames it.

## Prerequisites

- Protect the dirty worktree. Do not revert current `rooms/`, `data/rooms/`, `config/rooms.json`, or `.rovo/_metadata` changes unless explicitly asked.
- Run `npm run mode:status` and `npm run whereami` before implementation work, then use the project workflow selected by those signals.
- Keep implementation incremental: no direct deletion of legacy `data/rooms` until registry migration and rollback are proven.
- Inventory generated and legacy residue before cleanup: `data/rooms`, `data/room-storage/*/build`, old package tool runtimes, and registry paths must be classified before removal.
- Use `npm run rooms:test:core`, targeted room boundary tests, and `npm run typecheck` as closeout gates.

## Sprint 1: Freeze The Boundary

**Goal**: Make the intended source/build/data contract explicit and testable before moving paths.
**Demo/Validation**:

- A contributor or assistant can tell which room paths are source, generated runtime, and mutable data.
- Boundary tests fail if generated code is treated as editable source again.

### Task 1.1: Add a room path ownership matrix

- **Location**: `.rovo/03-ARCHITECTURE.md`, optional new `rooms/README.md`
- **Description**: Document the canonical path contract for `rooms/<roomId>`, `rooms/.build`, `config/rooms.json`, `data/room-storage`, and deprecated `data/rooms`.
- **Complexity**: 3
- **Dependencies**: None
- **Parallelization**: Can run in parallel with Task 1.2.
- **Acceptance Criteria**:
  - Documentation says `rooms/<roomId>` is the only editable room source.
  - Documentation says generated runtime artifacts are ignored and disposable.
  - Documentation says `data/` must not contain generated room code after migration.
- **Validation**:
  - Manual doc review.
  - Check that docs do not describe `data/rooms` as an authoring path.

### Task 1.2: Introduce explicit generated room path resolvers

- **Location**: `electron/paths.ts`, `electron/types/paths.d.ts`, `scripts/tests/room-package-manager-bootstrap-regressions.test.ts`
- **Description**: Add path APIs for generated room build/runtime roots, for example `getGeneratedRoomsDir()` and `getRoomRuntimeBuildDir(roomId)`, instead of deriving build paths from `data/room-storage`.
- **Complexity**: 5
- **Dependencies**: None
- **Parallelization**: Can run in parallel with Task 1.1.
- **Acceptance Criteria**:
  - Path construction remains centralized in `electron/paths.ts`.
  - Generated build paths resolve under `rooms/.build`, not `data/room-storage`.
  - Room manager options distinguish `sourceRoot`, `runtimeBuildRoot`, `dataRoot`, and `registryPath`; mutable data paths are not inferred from the runtime artifact root.
  - Packaged mode still resolves paths under the external projected project root.
- **Validation**:
  - Add/update path and bootstrap regression expectations.
  - Run `npm run rooms:test:file -- scripts/tests/room-package-manager-bootstrap-regressions.test.ts`.

### Task 1.3: Strengthen generated-source guardrails

- **Location**: `.gitignore`, `scripts/tests/room-package-boundary-regressions.test.ts`
- **Description**: Stop versioning generated room runtime copies and add tests that reject generated artifacts under source roots except the ignored `rooms/.build` root.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Parallelization**: Depends on new path names, but test drafting can start earlier.
- **Acceptance Criteria**:
  - `data/rooms/**` is no longer allowlisted as tracked source.
  - `rooms/.build/**` is ignored.
  - Boundary tests assert that `data/rooms` is legacy/deprecated and not a tracked source root.
- **Validation**:
  - Run `git status --ignored --short data/rooms rooms/.build`.
  - Run room package boundary regressions.

### Task 1.4: Add a machine-readable room path report

- **Location**: `scripts/rooms/`, `package.json`
- **Description**: Add a small diagnostic command such as `npm run rooms:paths` that prints source, generated runtime, registry, and data roots for each discovered room.
- **Complexity**: 4
- **Dependencies**: Task 1.2
- **Parallelization**: Can be built after path resolver signatures are settled.
- **Acceptance Criteria**:
  - The report clearly labels source, generated runtime, and mutable data roots.
  - The report flags legacy `data/rooms/<roomId>` copies if they exist.
- **Validation**:
  - Run `npm run rooms:paths`.
  - Confirm laboratory, game-room, and forge-room resolve without room-specific hardcoding.

## Sprint 2: Move Runtime Builds Out Of Data

**Goal**: Build room runtime artifacts under the new generated root while preserving current room boot behavior.
**Demo/Validation**:

- `npm run rooms:build` produces runtime artifacts under `rooms/.build`.
- `data/room-storage/<roomId>/build/workspace` is no longer created by normal room builds.

### Task 2.1: Move workspace build output to `rooms/.build`

- **Location**: `electron/room-package-manager.ts`, `electron/rooms/workspace-room-build.ts`, `electron/rooms/workspace-room-build-support.ts`, `scripts/rooms/build-workspace-rooms.ts`, `scripts/tests/room-workspace-build-regressions.test.ts`
- **Description**: Change `buildWorkspaceRoomArtifact()` so generated output goes to the new path resolver instead of `getRoomStorageRoot(roomId)/build/workspace`.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Parallelization**: Blocks Tasks 2.2 and 2.3.
- **Acceptance Criteria**:
  - Generated JS, copied HTML, copied CSS, assets, and manifest land under `rooms/.build/<roomId>/runtime`.
  - Source TypeScript files are not copied into the build artifact.
  - Existing required-file checks still accept TypeScript source satisfying `.js` manifest entries.
- **Validation**:
  - Run `npm run rooms:build`.
  - Run `npm run rooms:test:file -- scripts/tests/room-workspace-build-regressions.test.ts`.

### Task 2.2: Collapse workspace install to one runtime artifact

- **Location**: `electron/rooms/workspace-room-operations.ts`, `electron/room-package-manager.ts`, `electron/rooms/installed-room-builder.ts`, `electron/room-tool-service.ts`, `src/types/room-installed-types.ts`
- **Description**: Stop copying workspace builds into `data/rooms/<roomId>`. For workspace-linked installs, write the registry record with `installedDir` pointing at the generated runtime build artifact and `sourceDir` pointing at `rooms/<roomId>`.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Parallelization**: Can run in parallel with Task 2.4 after build output moves.
- **Acceptance Criteria**:
  - Installing from workspace updates `config/rooms.json` without creating `data/rooms/<roomId>`.
  - Room page UI, host runtime, scene assets, i18n, command specs, and protocol specs load from the generated runtime artifact.
  - `removeInstalledRoom` and `deleteWorkspaceRoom` remove the generated runtime artifact and registry entry, while preserving `rooms/<roomId>` unless the delete-workspace flow is explicitly requested.
  - `deleteData` removes `data/room-storage` and room partitions, not `rooms/<roomId>` unless the delete-workspace flow is explicitly used.
  - Runtime/root options keep `sourceRoot`, `runtimeBuildRoot`, `dataRoot`, and `registryPath` separate so exports and `deleteData` cleanup still target mutable data roots.
  - Room tool service resolves package/tool manifests from registry/runtime artifact roots, treats generated/package roots as read-only, and writes installs/downloads only under `data/room-storage`.
- **Validation**:
  - Run room package manager bootstrap regressions.
  - Run room tool service regressions.
  - Run room page, room host source, room protocol registry, and scene room regressions.

### Task 2.3: Rebuild stale or missing runtime artifacts during startup sync

- **Location**: `electron/room-package-manager.ts`, `electron/main.ts`, `src/js/modules/rooms/room-registry.ts`
- **Description**: Extend startup sync so raw registry records are inspected before hydration; entries with missing generated runtime artifacts are rebuilt from `sourceDir`, then hydrated.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Parallelization**: Can start after Task 2.1, but final behavior depends on Task 2.2.
- **Acceptance Criteria**:
  - A deleted `rooms/.build/<roomId>` folder is regenerated on startup when source is valid.
  - Missing `manifestPath`, `runtimeEntryPath`, or `hostEntryPath` does not cause the room to disappear before repair is attempted.
  - Invalid source is excluded from the startup snapshot and surfaced through a clear `StartupRoomsSyncResult.error` entry instead of silently using stale generated code.
  - Dev fallback and managed installed startup snapshots use the same stale/missing check.
- **Validation**:
  - Add a raw-registry regression that deletes `rooms/.build/<roomId>/runtime/manifest.json` and confirms startup sync rebuilds before hydration.
  - Run room package manager and startup sync regressions.

### Task 2.4: Keep package/export/import based on the runtime artifact

- **Location**: `electron/rooms/room-bundle-operations.ts`, `electron/rooms/room-bundle-validation.ts`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Ensure bundle export reads from the generated runtime artifact, while bundle import writes canonical source to `rooms/<roomId>` and then rebuilds the runtime artifact.
- **Complexity**: 6
- **Dependencies**: Task 2.1
- **Parallelization**: Can run in parallel with Task 2.2.
- **Acceptance Criteria**:
  - `.hevroom.json` export remains package-shaped and runtime-ready.
  - Imported bundles do not write generated code under `data/rooms`.
  - Imported source is visible under `rooms/<roomId>` so future edits have one obvious location.
- **Validation**:
  - Run room bundle import regressions.
  - Manually export and re-import a small room fixture.

## Sprint 3: Migrate Legacy `data/rooms`

**Goal**: Safely retire existing generated copies under `data/rooms` without losing user-imported rooms or runtime data.
**Demo/Validation**:

- Existing registry entries pointing to `data/rooms/<roomId>` are migrated to source plus generated runtime build paths.
- `data/rooms` can be absent after migration.

### Task 3.1: Add a legacy installed-room migration helper

- **Location**: `electron/room-package-manager.ts`, new `electron/rooms/legacy-installed-room-migration.ts`, `scripts/tests/room-bundle-import-regressions.test.ts`
- **Description**: Detect registry entries whose `installedDir` points at `data/rooms`. If `sourceDir` exists, rebuild and rewrite the registry. If source is missing but installed copy exists, restore a source copy into `rooms/<roomId>` before rebuilding.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Parallelization**: Blocks Task 3.3.
- **Acceptance Criteria**:
  - Current `laboratory` registry entries can migrate without data loss.
  - Legacy imported rooms without source are preserved.
  - Migration is idempotent.
  - Migration does not copy room tool runtimes or user residue into source.
  - Migration rebuilds the registry record via `buildInstalledRoomRecord` so `manifestPath`, `runtimeEntryPath`, `hostEntryPath`, `iconPath`, `i18nBaseDir`, scene backgrounds, and feature view paths all point at `rooms/.build/<roomId>/runtime`.
  - Migration inventories old package runtime directories under `data/rooms/<roomId>/tools/runtime` and `data/rooms/<roomId>/shared/data/tools/runtime` before any legacy deletion.
- **Validation**:
  - Add temp-directory migration fixtures for source-present and source-missing cases.
  - Run room bundle import and boundary regressions.

### Task 3.2: Separate legacy package files from mutable room data

- **Location**: `electron/rooms/room-install-files.ts`, `electron/room-tool-service.ts`, `scripts/tests/room-tool-service-regressions.test.ts`
- **Description**: Keep legacy cleanup aware of tracked generated package files, but make writable tool/runtime paths resolve to `data/room-storage` only.
- **Complexity**: 6
- **Dependencies**: Task 3.1 can define legacy behavior; can begin earlier by auditing paths.
- **Parallelization**: Can run in parallel with Task 3.1 after Sprint 2.
- **Acceptance Criteria**:
  - New writes do not target generated build or legacy installed roots.
  - Tool manifests may be read from generated runtime artifacts, but tool installs and runtime downloads write to `data/room-storage`.
  - Legacy package runtime dirs are migrated into `data/room-storage/<roomId>/tools/runtime` before cleanup or read only as temporary compatibility paths.
  - Cleanup refuses to delete `data/rooms` when unmigrated package runtime payloads remain.
- **Validation**:
  - Run room tool service regressions.
  - Smoke install/probe one laboratory tool manifest path.

### Task 3.3: Stop tracking and remove generated `data/rooms`

- **Location**: `.gitignore`, repository index, `scripts/tests/room-package-boundary-regressions.test.ts`
- **Description**: Remove generated `data/rooms` files from version control after migration support exists. Keep the directory ignored or absent.
- **Complexity**: 5
- **Dependencies**: Tasks 3.1 and 3.2
- **Parallelization**: Should be serialized late to avoid losing rollback visibility.
- **Acceptance Criteria**:
  - `git status` no longer reports ordinary generated room JS/CSS/assets under `data/rooms`.
  - A fresh build/install flow does not recreate tracked `data/rooms` files.
  - Boundary tests reject generated code under `data/rooms`.
- **Validation**:
  - Run `git status --short data/rooms`.
  - Run room package boundary regressions.

### Task 3.4: Add a cleanup command for stale generated artifacts

- **Location**: `scripts/rooms/`, `package.json`
- **Description**: Add a safe cleanup script such as `npm run rooms:clean-generated` that removes `rooms/.build`, legacy `data/rooms`, and only the deprecated generated subfolder `data/room-storage/<roomId>/build` after confirming registry/source migration safety.
- **Complexity**: 4
- **Dependencies**: Task 3.1
- **Parallelization**: Can run in parallel with Task 3.3 once migration checks are available.
- **Acceptance Criteria**:
  - Cleanup refuses to delete legacy installed-only rooms unless they have been restored to source.
  - Cleanup never removes the `data/room-storage/<roomId>` root, `projects`, `exports`, `tools`, `models`, `runtime`, `tool-state.json`, profile/model state files, or Electron room partitions.
  - Cleanup may remove `data/room-storage/<roomId>/build` because it is generated residue from the old build location.
  - Cleanup refuses to delete `data/rooms` if unmigrated package runtime payloads remain.
  - Running cleanup followed by startup sync rebuilds needed artifacts.
- **Validation**:
  - Run cleanup in a temp fixture containing `data/room-storage/<roomId>/build` plus real projects/tools/models and prove only `build` is removed.
  - Run `npm run rooms:build` and startup sync regressions after cleanup.

## Sprint 4: Update Runtime Surfaces And UI Language

**Goal**: Make the new contract visible in runtime APIs and Settings so assistants stop seeing generated artifacts as editable sources.
**Demo/Validation**:

- Settings and diagnostics show source, generated runtime, and data paths with distinct labels.
- Room runtime APIs keep working with the new generated runtime root.

### Task 4.1: Rename displayed path labels

- **Location**: `src/js/pages/settings/panels/rooms.ts`, `src/js/modules/rooms/room-overlay-markup.ts`, shared i18n files
- **Description**: Replace user-facing "installed path" wording with clearer labels such as "Source", "Runtime build", and "Room data".
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Parallelization**: Can run in parallel with Task 4.2.
- **Acceptance Criteria**:
  - Settings does not present generated runtime artifacts as editable room source.
  - Workspace-linked rooms are clearly labeled as linked to `rooms/<roomId>`.
- **Validation**:
  - Run room overlay, settings, and i18n regressions.

### Task 4.2: Keep renderer registries filtering fallback entries correctly

- **Location**: `src/js/modules/rooms/room-registry.ts`, `src/js/modules/rooms/room-overlay-markup.ts`, `scripts/tests/room-overlay-regressions.test.ts`
- **Description**: Verify managed installed rooms, workspace fallback rooms, and generated runtime paths remain filtered and displayed as intended after `installedDir` semantics change.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Parallelization**: Can run with Task 4.1.
- **Acceptance Criteria**:
  - Workspace fallback entries still stay out of installed-room summaries.
  - Managed installed entries show their source/runtime/data roots without duplicate source illusions.
- **Validation**:
  - Run room overlay regressions.
  - Run room UI regressions.

### Task 4.3: Update room protocol and command loaders for new runtime root

- **Location**: `electron/main.ts`, `src/js/modules/rooms/room-protocol-registry.ts`, `electron/us1-conversation-service.ts`
- **Description**: Confirm all protocol and command body reads use the generated runtime root while source editing remains under `rooms/<roomId>`.
- **Complexity**: 5
- **Dependencies**: Task 2.2
- **Parallelization**: Can run with Task 4.1 after runtime records settle.
- **Acceptance Criteria**:
  - Protocol body reads continue to work for room-local and feature-local protocols.
  - SlotBridge room commands still dispatch using current command specs.
  - No loader reads protocol source from deprecated `data/rooms`.
- **Validation**:
  - Run room protocol registry and command registry regressions.
  - Run slot-bridge room command regressions if command surfaces changed.

### Task 4.4: Update packaged workspace seeding assumptions

- **Location**: `electron/packaged-workspace-seed.ts`, `electron/packaged-wrapper-main.ts`, `electron/packaged-wrapper-cli.ts`, `scripts/electron-builder-after-pack.mjs`, `scripts/tests/room-package-manager-bootstrap-regressions.test.ts`
- **Description**: Make packaged startup seed only canonical source/support files and rebuild generated runtime artifacts externally; do not seed `config/rooms.json` or generated runtime directories.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Parallelization**: Can run after Task 2.3.
- **Acceptance Criteria**:
  - Packaged app startup can bootstrap rooms from source into `rooms/.build`.
  - Packaged seed and after-pack steps exclude `rooms/.build/**`, `data/rooms/**`, generated registry files, and generated runtime artifacts.
  - Packaged output does not include stale generated registry or runtime directories.
- **Validation**:
  - Run package manager bootstrap regressions.
  - Add a packaged seed fixture proving `rooms/.build` is not copied.
  - Run a packaged-mode path fixture if available.

## Sprint 5: Closeout Verification

**Goal**: Prove the migration works across dev startup, installed room startup, package import/export, room tools, and cleanup.
**Demo/Validation**:

- A fresh checkout has source under `rooms/`, generated artifacts under `rooms/.build`, and mutable data under `data/room-storage`.
- Deleting generated artifacts and restarting rebuilds them.

### Task 5.1: Add source/build/data invariant tests

- **Location**: `scripts/tests/room-package-boundary-regressions.test.ts`, `scripts/tests/room-workspace-build-regressions.test.ts`, `scripts/tests/room-package-manager-bootstrap-regressions.test.ts`
- **Description**: Add or update tests that encode the final invariant: no generated room code under `data/`, one generated runtime root, and `rooms/<roomId>` as source.
- **Complexity**: 5
- **Dependencies**: Sprints 2 and 3
- **Parallelization**: Can be split by test file.
- **Acceptance Criteria**:
  - Tests fail if `data/room-storage/<room>/build` returns.
  - Tests fail if `data/rooms` is recreated by standard install/build flows.
  - Tests fail if source discovery scans `rooms/.build`.
  - Cleanup tests prove only `data/room-storage/<room>/build` is removed while projects, exports, tools, models, and state files survive.
  - Uninstall and delete-workspace tests prove no orphaned `rooms/.build/<roomId>` artifact remains.
  - Startup tests prove missing generated runtime manifests are rebuilt from raw registry records before hydration.
  - Room tool service tests prove writes cannot target generated/package roots.
  - Packaged seed tests prove `rooms/.build` is not copied.
- **Validation**:
  - Run targeted test files.

### Task 5.2: Run full room verification

- **Location**: `package.json`, room test suite
- **Description**: Run the full room safety suite after path migration.
- **Complexity**: 3
- **Dependencies**: Task 5.1
- **Parallelization**: Serialized verification.
- **Acceptance Criteria**:
  - `npm run rooms:typecheck` passes.
  - `npm run rooms:test:core` passes.
  - `npm run typecheck` passes.
- **Validation**:
  - Capture command outputs in the final implementation report.

### Task 5.3: Smoke the current real rooms

- **Location**: `rooms/forge-room`, `rooms/game-room`, `rooms/laboratory`, `config/rooms.json`
- **Description**: Build and boot the real rooms through the new runtime artifact path.
- **Complexity**: 6
- **Dependencies**: Task 5.2
- **Parallelization**: Room-specific smoke checks can run independently after shared builds pass.
- **Acceptance Criteria**:
  - `forge-room`, `game-room`, and `laboratory` build under `rooms/.build`.
  - Laboratory tool manifests resolve from generated runtime artifacts while tool runtimes stay in `data/room-storage`.
  - Room page and scene entries load the expected assets.
- **Validation**:
  - Run `npm run rooms:build`.
  - Run room host import smoke regressions and installed UI smoke regressions.
  - If the app is running, perform a short Electron room navigation smoke.

### Task 5.4: Remove temporary compatibility after one stable cycle

- **Location**: `electron/rooms/legacy-installed-room-migration.ts`, `electron/room-tool-service.ts`, tests
- **Description**: After the migration has shipped and real workspaces are clean, remove or narrow compatibility paths that read from deprecated `data/rooms`.
- **Complexity**: 4
- **Dependencies**: A completed migration cycle
- **Parallelization**: Later cleanup only.
- **Acceptance Criteria**:
  - Remaining legacy compatibility is either removed or documented with an expiry condition.
  - New regressions protect the final simplified contract.
- **Validation**:
  - Run room boundary, room tool, and package manager regressions.

## Testing Strategy

- Run targeted tests after each sprint:
  - `npm run rooms:test:file -- scripts/tests/room-package-boundary-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/room-workspace-build-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/room-package-manager-bootstrap-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/room-bundle-import-regressions.test.ts`
  - `npm run rooms:test:file -- scripts/tests/room-tool-service-regressions.test.ts`
- Run room-wide closeout:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:core`
  - `npm run typecheck`
- Smoke checks:
  - `npm run rooms:paths`
  - `npm run rooms:build`
  - Delete `rooms/.build/<roomId>` and verify startup/build recreates it.
  - Delete/remove a room and verify its generated runtime artifact disappears while `data/room-storage` survives unless `deleteData` is requested.
  - Run cleanup against a fixture with stale `data/room-storage/<roomId>/build` and verify mutable data is preserved.
  - Confirm `git status --short data/rooms` stays clean or absent.

## Potential Risks & Gotchas

- `installedDir` currently means "runtime package root" in many call sites. Keeping the field name initially lowers blast radius, but the plan should clearly treat it as generated runtime root.
- Imported legacy rooms may exist only under `data/rooms`. Migration must restore those to `rooms/<roomId>` before cleanup.
- Legacy `data/room-storage/<roomId>/build` folders are generated residue, but the rest of `data/room-storage/<roomId>` is real room data. Cleanup must target only the `build` subfolder unless `deleteData` is explicitly requested.
- Generated runtime artifacts under `rooms/.build` must be ignored and excluded from workspace room discovery. The current discovery already skips top-level directories beginning with `.`, but tests should lock this down.
- Room tool service must read package manifests from generated artifacts but write tool installations only under `data/room-storage`.
- Startup sync must inspect raw registry records and rebuild missing artifacts before hydration; otherwise deleting ignored `rooms/.build` would break registered rooms before repair can run.
- Room package manager must not infer mutable `dataRoot` from a generated runtime root, or exports and `deleteData` cleanup will drift into `rooms/.build`.
- Old package tool runtimes under `data/rooms` must be migrated before cleanup, because current compatibility may only move them lazily.
- Packaged mode must use the external projected project root, not `app.asar`, for generated runtime artifacts.
- `config/rooms.json` may still contain absolute paths. Migration must rewrite these safely and idempotently.
- Current generated `data/rooms` files are dirty in git. Implementation should treat them as generated drift and avoid manual edits there.

## Rollback Plan

- Keep legacy `data/rooms` compatibility until Sprint 3 migrations pass.
- If runtime artifact loading fails, restore `Paths.getInstalledRoomsDir()` and registry entries to the previous `data/rooms` behavior while keeping source docs/tests staged separately.
- Keep migrations idempotent so rerunning startup sync can repair partially migrated registries.
- Do not delete `data/room-storage` roots during generated cleanup; only `data/room-storage/<roomId>/build` is disposable generated residue unless the user requested `deleteData`.
- For any source-missing legacy room, preserve the legacy package by copying it to `rooms/<roomId>` before removing deprecated generated directories.
- Preserve old package tool runtimes until they are copied or moved into `data/room-storage/<roomId>/tools/runtime`.

## Review Notes

- Self-review after drafting: the plan intentionally moves build output before deleting legacy generated copies, because cleanup before migration would risk losing imported-only rooms.
- Self-review after drafting: the plan treats `rooms/.build` as disposable. Any feature that writes user data there is a bug and should be redirected to `data/room-storage`.
- Subagent review incorporated on 2026-04-25: the plan now explicitly cleans stale `data/room-storage/<roomId>/build` residue, removes generated runtime artifacts on uninstall/delete, repairs missing builds before hydration, separates source/runtime/data roots, and moves room-tool write boundaries earlier in the migration.
