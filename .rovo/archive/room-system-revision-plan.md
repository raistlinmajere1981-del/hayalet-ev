# Plan: Room System Revision

**Generated**: 2026-03-28
**Estimated Complexity**: High

## Overview
Revise the room system around a single source of truth in `rooms/`, normalize the boundary between room shell and main functions, split god files into modular room-local pieces, separate shared and feature-specific CSS, move non-package runtime data under `data/room-storage/<roomId>`, and bring room code into the project's TypeScript and lint pipeline without breaking room import/export packaging.

## Status
- Completed on 2026-03-29.
- The room-system revision is no longer an active implementation backlog. The source/build/install split, TypeScript migration, room verification entrypoints, and installed-room registry contract are in place.

## Final Contract
- `rooms/<roomId>` is the only editable source tree.
- `config/rooms.json` is the source of truth for installed room chrome and startup room snapshots.
- `data/room-storage/<roomId>` is generated build/runtime residue, not authoring space.
- Settings > Rooms shows workspace sources separately; side navigation and room pages only follow real installed registry entries.
- `npm run rooms:typecheck`, `npm run rooms:test:core`, and `npm run rooms:lint` are the room closeout quality gates.

## Phase 2 / Backlog
- Revisit the remaining `rooms:lint` `no-await-in-loop` warnings only when queue semantics or batching behavior changes.
- If developers still need workspace-only preview flows, add an explicit dev-only entrypoint instead of letting workspace fallback appear as installed room chrome.
- Re-run the short closeout smoke checklist after future room-manager or registry changes.

## Current Baseline
- `rooms/` is now the only authoring source. `data/rooms/` copies were removed from the workspace.
- `config/rooms.json` is now in an empty bootstrap state with `rooms: []`, so the plan must explicitly define how runtime discovery works when nothing is installed yet.
- Current room package/import logic still assumes runtime-ready JS/HTML files and direct `uiEntry` / `hostEntry` paths.
- Current typecheck and lint scripts exclude `rooms/**`, so room code is outside the main TS/lint safety net.
- Room runtime residue still exists under `data/electron-user-data/Partitions/room-*`, so storage and cleanup policy must cover more than just `data/room-storage/<roomId>`.
- Largest room-local refactor targets found during research:
  - `rooms/game-room/main-functions/fate-knots/ui/module.js`
  - `rooms/game-room/main-functions/team-tetris/ui/module.js`
  - `rooms/game-room/main-functions/fate-knots/host/runtime.js`
  - `rooms/laboratory/main-functions/media-analysis/styles.css`
  - `rooms/game-room/main-functions/xox/host/runtime.js`
  - `rooms/laboratory/host/runtime.js`
  - `rooms/laboratory/main-functions/audio-analysis/host/process-runners.js`
  - `rooms/laboratory/ui/laboratory-ui-runtime.js`

## Prerequisites
- Confirm the canonical rule: `rooms/<roomId>` is the only editable source tree in the repo.
- Keep room package/import support, but treat installed copies as generated artifacts, not authoring space.
- Decide the development runtime contract early: either rooms run directly from workspace in dev, or install-to-generated-artifact remains mandatory before runtime.
- Preserve current room manifest schema unless a schema bump becomes unavoidable.
- Reuse the existing room regression suites in `scripts/tests/` as the primary safety net.
- Add a dedicated room verification command early in the work so refactors can be checked incrementally.

## Sprint 1: Freeze The New Room Contract
**Goal**: Define the new source-of-truth and storage boundary before structural refactors begin.
**Demo/Validation**:
- The repo has a written canonical rule for `rooms/`, `data/rooms/`, and `data/room-storage/`.
- A fresh contributor can tell which room paths are source, generated package output, and runtime data.
- Targeted room-boundary regressions pass with the updated expectations.

### Task 1.1: Define canonical room-source ownership
- **Location**: `electron/paths.ts`, `electron/room-package-manager.ts`, `electron/rooms/*.ts`, `scripts/tests/room-package-boundary-regressions.test.ts`
- **Description**: Make `rooms/` the canonical editable source, and explicitly reduce `data/rooms/` to an optional generated/install artifact used only by packaging or runtime install flows.
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
  - Core room code no longer treats `data/rooms/` as a parallel source tree.
  - Boundary tests describe `rooms/` as the authoring root.
  - Stale assumptions around installed copies are isolated to install/export code paths only.
- **Validation**:
  - Run room boundary regressions.
  - Manually verify `Paths.getRoomsWorkspaceDir()` and installed-room semantics are still coherent.

### Task 1.2: Reframe room runtime data ownership
- **Location**: `electron/paths.ts`, `electron/room-package-manager.ts`, `rooms/laboratory/shared/host/project-paths.js`, room storage callers under `electron/` and `rooms/`
- **Description**: Standardize that analyses, generated manifests, exports, caches, and feature-specific runtime data live under `data/room-storage/<roomId>/...`, not alongside source packages.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The planned storage contract clearly separates package files from runtime data.
  - Laboratory project outputs and future room-generated data resolve through room-storage paths.
  - Room-specific partition/session cleanup or retention rules are defined for `data/electron-user-data/Partitions/room-*`.
  - Package portability tests still protect against runtime binaries or install snapshots leaking into source rooms.
- **Validation**:
  - Run portability and room package boundary regressions.
  - Smoke-check resolved storage paths for laboratory and game-room features.

### Task 1.3: Introduce a single room verification entrypoint
- **Location**: `package.json`, `scripts/tests/`, optional `scripts/rooms/`
- **Description**: Add a repo-level verification command such as `npm run rooms:check` that groups room typecheck, lint, boundary tests, and selected room regressions.
- **Complexity**: 4
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Room work can be validated without hand-curating long command lists every time.
  - The command is incremental enough to use after each refactor slice.
- **Validation**:
  - Run the new room verification command locally.

### Task 1.4: Freeze the dev-runtime room resolution strategy
- **Location**: `src/js/modules/rooms/room-registry.ts`, `src/js/modules/rooms/room-host-runtime.ts`, `src/js/pages/room-page/**`, `electron/rooms/installed-room-builder.ts`, `electron/rooms/workspace-room-operations.ts`
- **Description**: Decide and document whether development runtime resolves room shell/host directly from `rooms/` or continues to require an install/build step into a generated artifact before room pages can boot.
- **Complexity**: 8
- **Dependencies**: Tasks 1.1 and 1.2
- **Acceptance Criteria**:
  - The runtime source for room page boot is explicit and testable.
  - An empty `config/rooms.json` no longer creates ambiguity about how developers run room work locally.
  - The decision aligns with package/import/export expectations and does not create a second editable source tree.
- **Validation**:
  - Boot a room from the chosen dev path starting from `config/rooms.json` with `rooms: []`.
  - Run room page and host runtime regressions against the chosen strategy.

## Sprint 2: Normalize Room Layout Around Shell And Main Functions
**Goal**: Make both Laboratory and Game Room follow the same internal package shape.
**Demo/Validation**:
- Each room has an obvious separation between room shell, room-local shared code, and feature-specific code.
- New contributors can find host, UI, styles, assets, data, and protocols without reading unrelated files.

### Task 2.1: Define the target folder contract for every room
- **Location**: `rooms/laboratory/**`, `rooms/game-room/**`
- **Description**: Normalize room structure so each room exposes the same top-level seams: manifest, room shell entrypoints, room-local shared modules, room-local shared styles/types, and `main-functions/<featureId>/...` for feature-specific code.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Laboratory and Game Room no longer rely on ad hoc layout differences.
  - Room-level `ui/index.*` and `host/index.*` are orchestration-only.
  - Shared helpers used by multiple features live outside individual main-function folders.
- **Validation**:
  - Compare both rooms against the documented target tree.
  - Run room manifest and room page regressions.

### Task 2.2: Minimize room entrypoint responsibility
- **Location**: `rooms/game-room/ui/index.js`, `rooms/game-room/host/index.js`, `rooms/laboratory/ui/index.js`, `rooms/laboratory/host/index.js`
- **Description**: Reduce room root entry files to lightweight composition modules that only wire shared runtime pieces and feature adapters together.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Room entrypoints avoid feature logic, data normalization, and large inline tables.
  - Feature registration is delegated to room-local adapter modules.
- **Validation**:
  - Run installed-host and installed-ui smoke regressions after each room is converted.

### Task 2.3: Add room-local type seams before TS migration
- **Location**: `rooms/laboratory/`, `rooms/game-room/`, likely new `types/` or `shared/types/` folders per room
- **Description**: Create explicit room-local type surfaces for UI state, host state, commands, feature payloads, and storage records so later TS conversion does not depend on giant inferred object literals.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Each room has named data contracts for shared shell state and feature state.
  - Feature-local payloads no longer depend on hidden shape knowledge spread across large files.
- **Validation**:
  - Run room host, room UI, and protocol registry regressions using the new seams.

## Sprint 3: Break Down The God Files
**Goal**: Split oversized room files into modules that AI agents and humans can safely edit in isolation.
**Demo/Validation**:
- No room file remains a multi-responsibility bottleneck without a clear reason.
- The biggest files are split into small, reviewable modules with stable ownership boundaries.

### Task 3.1: Split Fate Knots UI into state, assets, and stage renderers
- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: Decompose the file into modules for state creation/sanitization, asset resolution, shared UI primitives, and per-phase/stage rendering.
- **Complexity**: 9
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Fate Knots UI no longer keeps state modeling, asset utilities, and all stage rendering in one file.
  - Each stage renderer can be changed independently.
- **Validation**:
  - Run Fate Knots room, UI path, and installed-ui regressions.

### Task 3.2: Split Fate Knots host runtime by orchestration domain
- **Location**: `rooms/game-room/main-functions/fate-knots/host/runtime.js`
- **Description**: Separate content loading, session/bootstrap, decision orchestration, combat orchestration, prompt dispatch, and command handlers into discrete host modules.
- **Complexity**: 9
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Command handlers stop sharing a monolithic runtime file.
  - Prompt-generation, transport sync, and state transitions are isolated.
- **Validation**:
  - Run Fate Knots host, engine, asset-registry, and room regressions.

### Task 3.3: Split Laboratory host composition by concern
- **Location**: `rooms/laboratory/host/runtime.js`
- **Description**: Break the composition root into room bootstrap, storage/runtime wiring, shared host services, and feature adapters for media, audio, and subtitle flows.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The room host composition root becomes readable and orchestration-only.
  - Shared host services can be tested without loading every feature adapter.
- **Validation**:
  - Run laboratory host import, host action runtime, and room regressions.

### Task 3.4: Split audio-analysis process runners by module family
- **Location**: `rooms/laboratory/main-functions/audio-analysis/host/process-runners.js`
- **Description**: Move analyzer-specific runners into smaller modules grouped by waveform/spectral artifacts, speech/transcription, music, diarization, and support utilities.
- **Complexity**: 8
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - New analyzers can be added without editing a single giant runner file.
  - Shared process utilities are centralized.
- **Validation**:
  - Run laboratory audio-analysis regressions and process behavior checks.

### Task 3.5: Split high-risk secondary bottlenecks
- **Location**: `rooms/game-room/main-functions/team-tetris/ui/module.js`, `rooms/game-room/main-functions/xox/host/runtime.js`, `rooms/laboratory/ui/laboratory-ui-runtime.js`
- **Description**: Apply the same decomposition rules to the next-largest files once the primary refactor pattern is proven.
- **Complexity**: 7
- **Dependencies**: Tasks 3.1 to 3.4
- **Acceptance Criteria**:
  - Team Tetris UI, XOX host runtime, and laboratory UI runtime each expose clear submodules.
  - No new god file is created as a side effect of earlier extractions.
- **Validation**:
  - Run the room verification command and the targeted room regressions for each slice.

## Sprint 4: Rebuild CSS Around Shared Shell And Feature Styles
**Goal**: Make room styling modular, predictable, and purgeable.
**Demo/Validation**:
- Shared shell CSS and feature CSS are physically separate and intentionally imported.
- Unused selectors can be identified without guessing which feature owns them.

### Task 4.1: Define shared shell style layers per room
- **Location**: `rooms/laboratory/shared/styles/`, `rooms/game-room/shared/styles/`, room `ui/style.css`
- **Description**: Split room shell tokens, layout primitives, overlays, and generic component styles into shared room-level layers.
- **Complexity**: 6
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Root room CSS files become import maps, not large styling dumps.
  - Shared room shell styles no longer live inside feature-specific CSS files.
- **Validation**:
  - Open both room UIs and verify shared shell visuals still load correctly.

### Task 4.2: Split feature CSS by stage or component family
- **Location**: `rooms/laboratory/main-functions/media-analysis/styles.css`, `rooms/game-room/main-functions/fate-knots/styles.css`, other feature style files as needed
- **Description**: Break large feature stylesheets into smaller imports such as layout, panels, cards, combat, map, forms, and state-specific overrides.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Large stylesheets are no longer the sole owner of every selector in a feature.
  - File names reflect actual UI ownership.
- **Validation**:
  - Run feature UI smoke checks and manual style regressions for affected rooms.

### Task 4.3: Remove unused room CSS safely
- **Location**: All room CSS and corresponding UI modules
- **Description**: Build a selector inventory from room markup/runtime usage, remove dead selectors in small batches, and confirm no visual regressions are introduced.
- **Complexity**: 7
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Removed CSS is backed by either static non-usage evidence or runtime smoke validation.
  - No feature loses styling because of a shared selector assumption.
- **Validation**:
  - Run targeted UI regressions.
  - Capture before/after screenshots for high-risk features.

## Sprint 5: Bring Room Code Into TypeScript, Lint, And Build
**Goal**: Make room code first-class in the repo's quality gates without breaking runtime packaging.
**Demo/Validation**:
- Room code is included in TS and lint workflows.
- Room packages still resolve runtime-ready `uiEntry` and `hostEntry` artifacts.

### Task 5.1: Add room-aware TS and lint configs
- **Location**: `package.json`, new `tsconfig.rooms.json` or per-room tsconfigs, ESLint config files
- **Description**: Introduce room-specific TS config and lint coverage, starting with permissive inclusion for existing JS and then tightening as modules are converted.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - `rooms/**` participates in automated type and lint checks.
  - Existing JS room files can be incrementally migrated instead of requiring a flag day.
- **Validation**:
  - Run room typecheck and room lint commands independently and via the room verification entrypoint.

### Task 5.2: Establish a runtime-ready room build pipeline
- **Location**: `package.json`, `scripts/rooms/`, package/install code under `electron/rooms/`
- **Description**: Add a dedicated build step that compiles TS room sources into runtime-ready package output for `uiEntry` / `hostEntry` consumers, without reintroducing `data/rooms/` as manual source.
- **Complexity**: 9
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - TS room sources can be compiled before install/export/import.
  - Bundle/import flows no longer depend on raw TS files being executable at runtime.
  - Generated artifacts live in a clear build/install area and are never treated as editable source.
- **Validation**:
  - Build a room package from TS-backed room sources.
  - Run room bundle import/export regressions.

### Task 5.3: Convert room-local modules to TS in layers
- **Location**: `rooms/laboratory/**`, `rooms/game-room/**`
- **Description**: Migrate room code in this order: shared types/contracts, shared utilities, orchestration roots, then feature modules. Convert files only after their boundaries are stable.
- **Complexity**: 9
- **Dependencies**: Tasks 5.1 and 5.2, Sprint 3
- **Acceptance Criteria**:
  - Room shell and shared modules reach TS first.
  - Feature modules stop depending on untyped giant object literals.
  - Converted code passes room typecheck without suppressing core safety flags.
- **Validation**:
  - Run room typecheck after each slice.
  - Run targeted room regressions for every converted feature.

## Sprint 6: Restore Packageability And Runtime Parity
**Goal**: End with rooms that are modular in source, packageable for import/export, and safe to install or run.
**Demo/Validation**:
- Workspace rooms can be bundled, imported, exported, and validated from the new layout.
- Room runtime data stays outside package source.
- No room-specific leakage remains in generic core code.

### Task 6.1: Update bundle/import/export to the new source-build contract
- **Location**: `electron/rooms/room-bundle-operations.ts`, `electron/rooms/workspace-room-operations.ts`, `electron/rooms/room-bundle-validation.ts`, `scripts/rooms/build-room-bundle.mjs`
- **Description**: Ensure bundle creation, validation, import, install, and export work with the new modular layout and the room build output contract.
- **Complexity**: 8
- **Dependencies**: Sprint 5
- **Acceptance Criteria**:
  - Workspace bundle/export no longer depends on removed `data/rooms` copies.
  - Import/install flows validate only package-relevant artifacts.
  - Export excludes generated runtime binaries, caches, and install snapshots.
- **Validation**:
  - Run room bundle import/export regressions.
  - Run room package boundary regressions.

### Task 6.2: Regenerate or replace stale room registry assumptions
- **Location**: `config/rooms.json`, room registry readers/writers under `electron/rooms/`
- **Description**: Reconcile registry behavior with the new world where the repo currently starts from an empty installed-room registry and source lives only under `rooms/`.
- **Complexity**: 5
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - The project no longer assumes preinstalled rooms exist in `config/rooms.json`.
  - Fresh installs or room discovery can repopulate the registry from valid artifacts.
- **Validation**:
  - Start from an empty install state and install at least one room successfully.

### Task 6.3: Close the room-core leakage gaps
- **Location**: `src/`, `electron/`, `scripts/rooms/`
- **Description**: Re-run leakage checks and remove any remaining room-specific references from generic room-core modules. Room-specific helper scripts outside room packages must either move under the relevant room or remain as narrowly documented packaging exceptions.
- **Complexity**: 4
- **Dependencies**: Tasks 6.1 and 6.2
- **Acceptance Criteria**:
  - Generic room core stays room-agnostic.
  - Room ids and feature ids live only in explicit room packages or room-specific helper scripts.
- **Validation**:
  - Run `scripts/tests/room-package-boundary-regressions.test.ts`.

## Testing Strategy
- Create and maintain a single room verification command that runs:
  - room typecheck
  - room lint
  - room package boundary regressions
  - room bundle import/export regressions
  - empty-registry bootstrap checks
  - targeted laboratory and game-room regressions touched by the current slice
- Use existing room-heavy regression coverage in `scripts/tests/` as the main safety net, especially:
  - room boundary and bundle tests
  - room page, room UI, and room host runtime tests
  - Laboratory feature regressions
  - Game Room feature regressions for XOX, Team Tetris, and Fate Knots
- Require `npm run typecheck` and project lint once room configs are integrated.
- Add lightweight screenshot or smoke checks for CSS cleanup and UI decomposition work.

## Potential Risks & Gotchas
- The biggest architectural risk is TS migration before a build pipeline exists. `uiEntry` and `hostEntry` currently expect executable runtime files, so TS conversion must follow build-contract work, not precede it.
- `config/rooms.json` is currently empty, not populated. Any work that assumes room registry bootstrap already happened will produce false negatives until the runtime resolution strategy is frozen.
- Laboratory and Game Room do not share exactly the same entrypoint conventions today. Forcing a layout rewrite before freezing a common contract will create avoidable churn.
- CSS cleanup is risky because several room UIs build DOM dynamically. Static selector search alone is not enough; runtime smoke validation is required.
- Fate Knots has generated content and asset-sync tooling. Its generated data must stay packageable while runtime-only outputs move to room storage.
- Existing tests reference both workspace and installed paths. These must be updated deliberately so they keep protecting packageability instead of reintroducing duplicate source trees.
- Runtime residue currently includes `data/electron-user-data/Partitions/room-*`; removing or retaining those partitions needs an explicit policy so the new storage contract is not only half-migrated.
- There is a likely decision point around dev runtime behavior:
  - Recommended path: run from `rooms/` in development, and generate runtime-ready package output only for install/export/build flows.
  - Avoid: restoring `data/rooms/` as a second editable tree.

## Rollback Plan
- Keep each task small and committable, grouped by one room, one feature, or one infrastructure seam at a time.
- Do not migrate both rooms to TS in a single change; complete one shared seam first, verify, then proceed.
- Preserve existing manifest schema and bundle file format until the new build/install path is proven.
- If a refactor destabilizes a room, revert only the latest slice for that room or feature while keeping previously validated boundary work intact.
- Maintain package boundary regressions as a hard gate so temporary build/install experiments do not reintroduce duplicate editable copies or runtime artifacts into source rooms.
