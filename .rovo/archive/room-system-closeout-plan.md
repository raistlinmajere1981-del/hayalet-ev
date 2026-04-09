# Plan: Room System Closeout

**Generated**: 2026-03-29
**Estimated Complexity**: Medium
**Status**: Implementation complete 2026-03-29; final manual smoke rerun pending

## Overview
Close the remaining follow-up work after the room-system revision and room TypeScript migration. The core migration is complete: `rooms/game-room` and `rooms/laboratory` are TypeScript-only, `npm run rooms:typecheck` passes, and `npm run rooms:test:core` is green. This plan now focuses on the remaining operational gap in `rooms:lint`, a short manual UI smoke pass for room management flows, and a small documentation closeout so the new contract is easy to maintain.

## Closeout Status
- `npm run rooms:lint` now resolves room TypeScript through `tsconfig.rooms.json`, runs on real room files, and exits successfully.
- Renderer room registry now strips workspace fallback entries before installed-room chrome sync, so side navigation and room pages follow `config/rooms.json` instead of workspace fallback artifacts.
- Stale `data/room-storage/game-room` and `data/room-storage/laboratory` residue was cleared during closeout because the registry was empty.
- Manual follow-up smoke flows are recorded in `.rovo/room-system-closeout-smoke.md` for the final rerun.

## Canonical Room Contract
- `rooms/` is the only editable source tree.
- `config/rooms.json` is the only installed-room source of truth for startup snapshots and room chrome.
- `data/room-storage/<roomId>` holds generated build/runtime residue and may be cleared when a room is not installed.
- Settings > Rooms may list workspace rooms, but room nav/page chrome only appears for real installed registry entries.
- Room TypeScript is first-class through `npm run rooms:typecheck` and `npm run rooms:lint`.

## Current Baseline
- `rooms/` is the only editable room source tree.
- `data/room-storage/<roomId>` is the generated/build/export area.
- Workspace fallback rooms are no longer shown as installed in Settings > Rooms, side navigation, or room pages.
- `npm run rooms:typecheck` passes.
- `npm run rooms:test:core` passes.
- The previous slow room-host/import smoke concern was resolved during the TypeScript conversion phase, so it is no longer an active closeout item.
- `npm run rooms:lint` now provides a real signal for room files instead of failing on ignored globs.

## Prerequisites
- Preserve the current room runtime/build contract: workspace TS source -> generated JS build/install output.
- Do not re-open god-file refactors in this phase.
- Keep room-manager behavior stable while adjusting lint/config and UI verification.

## Sprint 1: Restore Real Room Lint Coverage
**Goal**: Make `npm run rooms:lint` lint room sources for real instead of exiting on ignored globs.
**Demo/Validation**:
- `npm run rooms:lint`
- Verify the command checks `rooms/**` files instead of returning the current ignored-glob error.

### Task 1.1: Inspect the current ESLint ignore/config path for rooms
- **Location**: `package.json`, root ESLint config files, room-related lint tests under `scripts/tests/`
- **Description**: Trace why `rooms/**/*.{js,ts}` is ignored and identify the smallest config change that gives room files a real lint pass.
- **Dependencies**: None
- **Acceptance Criteria**:
  - The ignore/config root cause is documented in the commit or task notes.
  - A minimal target change is selected before editing config.
- **Validation**:
  - Reproduce the current `rooms:lint` failure locally.

### Task 1.2: Update ESLint coverage for room sources
- **Location**: `package.json`, root ESLint config files
- **Description**: Adjust lint config or script inputs so room files are included in ESLint resolution without weakening existing repo lint behavior.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `npm run rooms:lint` runs on room files instead of failing with the ignored-glob message.
  - Existing top-level lint flows remain intact.
- **Validation**:
  - Run `npm run rooms:lint`.

### Task 1.3: Add regression coverage for the lint contract
- **Location**: `scripts/tests/room-package-manager-bootstrap-regressions.test.ts` or a dedicated lint-contract regression
- **Description**: Lock in the intended `rooms:lint` command shape so future script/config changes do not silently remove room lint coverage again.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - A regression test fails if `rooms:lint` drifts back to the broken contract.
- **Validation**:
  - Run the affected room bootstrap/lint regression suite.

## Sprint 2: Run Room-Manager Closeout Smoke
**Goal**: Confirm the Settings > Rooms flows match the new workspace/install contract end to end.
**Demo/Validation**:
- Manual smoke pass in the app for both `game-room` and `laboratory`.
- Room lists, install state, and delete/remove behavior stay consistent after refresh/restart.

### Task 2.1: Verify workspace -> install -> remove flows
- **Location**: App UI, `src/js/pages/settings/panels/rooms.ts`, room-manager IPC handlers if fixes are needed
- **Description**: Smoke test room installation from workspace, installed-room removal, and restart/update prompts for both rooms.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Installing a workspace room adds it to the real installed list.
  - Removing an installed room clears the installed list entry without corrupting workspace source.
- **Validation**:
  - Manual test in Settings > Rooms for `game-room` and `laboratory`.

### Task 2.2: Verify workspace delete flows with and without data cleanup
- **Location**: App UI, room-manager storage/registry paths if fixes are needed
- **Description**: Confirm workspace deletion updates both workspace and installed views correctly, including the `deleteData` path and the preserved-data path.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Deleting a workspace room removes the workspace card.
  - Installed-room visibility stays accurate after deletion and refresh.
  - `deleteData` only clears runtime residue when requested.
- **Validation**:
  - Manual test for delete flows.
  - Targeted room boundary regressions if any fix is required.

### Task 2.3: Record a short smoke checklist
- **Location**: `.rovo/` closeout smoke note or existing room smoke docs
- **Description**: Save the final manual verification checklist so future room-system changes can rerun the same flows.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - The final checklist is short, repeatable, and room-manager specific.
- **Validation**:
  - Re-run the checklist once from the saved doc.

## Sprint 3: Documentation Closeout
**Goal**: Leave the room contract easy to understand for the next session.
**Demo/Validation**:
- A contributor can find the new source/build/install contract without re-reading the full revision history.

### Task 4.1: Refresh the room-system plan status
- **Location**: `.rovo/room-system-revision-plan.md`
- **Description**: Mark the major room-system revision work as complete and move any remaining technical debt into a short Phase 2/backlog section.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - The old revision plan reads as completed work, not an active implementation backlog.
- **Validation**:
  - Review the updated status section for accuracy.

### Task 4.2: Save the canonical room contract in one short note
- **Location**: `.rovo/room-system-closeout-plan.md` or adjacent closeout note
- **Description**: Capture the final contract in concise form: `rooms/` is source, `data/room-storage` is generated/runtime storage, installed list shows only real registry entries, and room TypeScript is now first-class.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - The note is short enough to scan quickly.
  - It matches current behavior and tests.
- **Validation**:
  - Cross-check the note against current code/tests.

## Testing Strategy
- Primary quality gate:
  - `npm run rooms:typecheck`
  - `npm run rooms:test:core`
  - `npm run rooms:lint` after Sprint 1
- Targeted validation:
  - Room overlay/room-manager regressions after any room-list UI change
  - Manual Settings > Rooms smoke flows for `game-room` and `laboratory`

## Potential Risks & Gotchas
- Fixing `rooms:lint` may require touching shared ESLint config, not just `package.json`.
- Manual smoke findings may expose one more room-manager edge case even if tests stay green.

## Rollback Plan
- Revert the lint/config change if Sprint 1 causes repo-wide lint regressions.
- Revert room-manager UI tweaks independently if manual smoke fixes introduce list-state drift.

## Closed Follow-Up
- Slow room-host/import smoke behavior was investigated during the TypeScript conversion phase and is now considered resolved.
- If a future regression reopens that topic, track it in a dedicated performance/stability plan instead of expanding this closeout scope.
