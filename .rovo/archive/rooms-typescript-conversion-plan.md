# Plan: Rooms TypeScript Conversion

**Generated**: 2026-03-29
**Estimated Complexity**: High

## Overview

Complete the TypeScript migration for the two workspace rooms under `rooms/` by moving the source-of-truth model to `workspace TS -> build/install JS`. The current split is uneven: `rooms/game-room` still keeps `88` source `.js` twins beside `.ts`, while `rooms/laboratory` is fully `.ts` but still relies on `148` `@ts-nocheck` escape hatches. The plan finishes the migration in staged, testable slices so runtime packaging and installed-room parity remain intact throughout.

## Prerequisites

- `npm run rooms:build`
- `npm run rooms:typecheck`
- `npm run rooms:test:core`
- Room build support in `electron/rooms/workspace-room-build-support.ts` remains the canonical `TS source -> JS runtime` path

## Sprint 1: Freeze The Source Contract

**Goal**: Make tests and room build assumptions match the desired model: workspace source files may be `.ts`, while build and installed outputs must be `.js`.
**Demo/Validation**:

- `npm run rooms:build`
- Targeted `scripts/tests/game-room-*.test.ts`
- Verify build artifacts still expose `.js` runtime entrypoints

### Task 1.1: Rewrite `game-room` workspace file expectations

- **Location**: `scripts/tests/game-room-*.test.ts`, `scripts/tests/room-layout-contract-regressions.test.ts`, `scripts/tests/i18n-remediation-regressions.test.ts`
- **Description**: Replace workspace assertions that require source `.js` files with assertions against `.ts` source files or built/installed `.js` outputs, depending on the contract being tested.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Workspace-package tests no longer require duplicate `.js` twins in `rooms/game-room`
  - Installed/build parity tests still require emitted `.js` outputs
- **Validation**:
  - Run affected `node --import tsx --test ...` suites

### Task 1.2: Preserve build contract coverage

- **Location**: `scripts/tests/room-package-manager-bootstrap-regressions.test.ts`, `electron/rooms/workspace-room-build-support.ts`
- **Description**: Keep explicit regression coverage proving that TypeScript sources compile into `.js` runtime files during workspace room builds.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Tests still lock in `buildWorkspaceRoomOutput`
  - Runtime path satisfaction logic remains covered
- **Validation**:
  - Run `scripts/tests/room-package-manager-bootstrap-regressions.test.ts`

## Sprint 2: Remove `game-room` Source Twins

**Goal**: Remove duplicated `.js` source files from `rooms/game-room` while preserving runtime output and room feature behavior.
**Demo/Validation**:

- `rg --files rooms/game-room -g '*.js'` returns only intentional generated/data/runtime-source files that have no TS source replacement requirement, or zero source twins if fully complete
- `npm run rooms:build`
- Targeted `game-room` regression suites pass

### Task 2.1: Migrate shared and root entrypoints

- **Location**: `rooms/game-room/host/*`, `rooms/game-room/ui/*`, `rooms/game-room/shared/**/*`
- **Description**: Remove duplicate `.js` files for root host/UI/shared seams once tests no longer require them.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Source-of-truth files are `.ts`
  - Room build still emits `.js` entrypoints consumed by manifest/runtime
- **Validation**:
  - Run targeted `game-room` bootstrap/layout tests

### Task 2.2: Finish `xox` and `team-tetris`

- **Location**: `rooms/game-room/main-functions/xox/**/*`, `rooms/game-room/main-functions/team-tetris/**/*`
- **Description**: Remove `.js` twins and ensure source imports/tests follow the TS-only workspace model.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - No duplicate `.js` twins remain in these features
  - Installed UI/host smoke tests stay green
- **Validation**:
  - Run targeted `xox` and `team-tetris` regression suites

### Task 2.3: Finish `fate-knots`

- **Location**: `rooms/game-room/main-functions/fate-knots/**/*`
- **Description**: Remove the largest remaining set of source `.js` twins, keeping build/runtime asset module behavior unchanged.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Fate Knots workspace tests validate TS source presence instead of source `.js` duplication
  - Installed/build outputs still expose `.js` runtime modules
- **Validation**:
  - Run Fate Knots room/UI/engine regression suites

## Sprint 3: Harden `laboratory` Shared And Host Typing

**Goal**: Remove the highest-risk `@ts-nocheck` escapes from the shared/host foundation first.
**Demo/Validation**:

- Targeted `laboratory` host/import tests pass
- `@ts-nocheck` count drops across shared/host core modules

### Task 3.1: Type runtime primitives and core state seams

- **Location**: `rooms/laboratory/shared/host/**/*`, `rooms/laboratory/host/**/*`
- **Description**: Introduce explicit state, action, snapshot, and process dependency types so core composition layers no longer need blanket `@ts-nocheck`.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Core host composition files compile with real TS checking
  - No behavior drift in host snapshot and activation flows
- **Validation**:
  - Run targeted laboratory host/import tests

### Task 3.2: Type shared UI shell/runtime seams

- **Location**: `rooms/laboratory/shared/ui/**/*`, `rooms/laboratory/ui/**/*`
- **Description**: Replace broad unchecked UI composition with typed message/state contracts aligned to the host/runtime primitives.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Shared UI runtime entry layers no longer need `@ts-nocheck`
  - Shell routing and feature stage composition tests remain stable
- **Validation**:
  - Run targeted laboratory UI regressions

## Sprint 4: Finish `laboratory` Features And Tighten `tsconfig.rooms`

**Goal**: Remove remaining migration escape hatches in feature modules and then tighten the room tsconfig in stages.
**Demo/Validation**:

- `npm run rooms:check`
- `npm run typecheck`
- Remaining `@ts-nocheck` count is near zero or zero for room sources

### Task 4.1: Finish `subtitle-analysis`

- **Location**: `rooms/laboratory/main-functions/subtitle-analysis/**/*`
- **Description**: Type intake, workspace, process, and projection state flows end-to-end.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Subtitle feature host/UI paths compile without blanket suppression
- **Validation**:
  - Run subtitle-specific regressions

### Task 4.2: Finish `media-analysis`

- **Location**: `rooms/laboratory/main-functions/media-analysis/**/*`
- **Description**: Type edit/profile/source state and action routers, focusing on data payload and UI stage contracts.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Media analysis host/UI layers compile without blanket suppression
- **Validation**:
  - Run media-specific regressions and installed parity tests

### Task 4.3: Finish `audio-analysis`

- **Location**: `rooms/laboratory/main-functions/audio-analysis/**/*`
- **Description**: Type runner results, projection records, and provider/runtime responses.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Audio analysis modules compile without blanket suppression
- **Validation**:
  - Run audio-specific regressions and room build

### Task 4.4: Tighten `tsconfig.rooms`

- **Location**: `tsconfig.rooms.json`
- **Description**: After source cleanup, remove `allowJs/checkJs` dependence and turn on stricter compiler options in safe increments.
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - `rooms:typecheck` runs under stricter settings
  - No remaining dependency on source `.js` twins
- **Validation**:
  - Run `npm run rooms:typecheck` and `npm run typecheck`

## Testing Strategy

- Use targeted regression suites after each feature slice instead of waiting for the full room suite.
- Treat `rooms:build` as the canonical proof that workspace TS still produces valid runtime JS.
- Keep installed/build parity tests for both rooms, but align workspace assertions with the actual source contract.

## Potential Risks & Gotchas

- `game-room` tests currently encode old workspace `.js` assumptions; deleting files before moving those tests will create false regressions.
- `fate-knots` has the heaviest duplicate surface and should be migrated only after root/shared seams stabilize.
- `laboratory` is not blocked by `.js` twins; its real risk is hidden shape drift behind `@ts-nocheck`.
- Tightening `tsconfig.rooms.json` too early will create noise and slow the migration.

## Rollback Plan

- Revert each sprint as a standalone patch set if a feature slice breaks packaging or installed-room parity.
- Keep room build and installed-copy tests green before starting the next sprint.
- If strictness changes destabilize the suite, revert only `tsconfig.rooms.json` tightening and keep typed source improvements.
