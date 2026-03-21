# Plan: XOX Alignment Closure

**Generated**: 2026-03-21
**Estimated Complexity**: High

## Overview

Close the remaining mismatches between the original XOX room plan and the current implementation.
The feature itself is largely shipped; the gaps now sit in validation depth, scene/debug regression alignment,
room-local i18n strictness, and assistant workflow guidance for future room / main-function work.

This closure plan assumes the current `game-room` XOX implementation remains the product baseline.
The work below tightens tests, trims fallback ambiguity, and strengthens `AGENTS.md` so future room additions
do not drift into the same class of room/feature/type mismatches.

## Prerequisites

- Use the current installed `game-room` package and XOX-first manifest as the source of truth.
- Treat failing scene/debug expectations as a contract-audit step, not as auto-fix noise.
- Keep room-local i18n catalogs as the primary copy source for room UIs.
- Finish with targeted regressions plus full `npm run typecheck`.

## Sprint 1: Re-lock Validation Contract

**Goal**: Align scene/debug and room-page regressions with the current installed-room contract before deeper feature tests expand.

**Demo/Validation**:

- Scene/debug regressions reflect the current contract rather than stale assumptions.
- Installed-room scene integration is validated directly, not only inferred from static strings.

### Task 1.1: Update stale rooms scene expectations

- **Location**: `scripts/tests/rooms-scene-page-regressions.test.ts`, `src/js/pages/rooms.ts`
- **Description**: Replace stale assertions that assume the old `createSceneDebugRuntimeSession("rooms")` signature with checks that match the current runtime-session configuration and installed-room corridor integration.
- **Dependencies**: None
- **Acceptance Criteria**:
  - The regression reflects the actual `rooms.ts` scene-debug constructor shape.
  - The test asserts installed-room corridor behavior instead of only static rooms page wiring.
- **Validation**:
  - `node --import tsx --test scripts/tests/rooms-scene-page-regressions.test.ts`

### Task 1.2: Validate dynamic installed-room scene/debug registration directly

- **Location**: `scripts/tests/scene-debug-room-regressions.test.ts`, `src/js/scene-editor/scene-debug-room-registry.ts`, `src/js/modules/rooms/room-scene-debug.ts`
- **Description**: Add direct tests for installed-room options and corridor-node generation by stubbing `RoomRegistry.getInstalledRooms()` and checking `game-room` participation in scene/debug helpers.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Scene/debug tests verify installed-room options and corridor nodes for `game-room`.
  - Static expectations that broke due to coordinate or selector refactors are updated only when the new contract is intentional.
- **Validation**:
  - `node --import tsx --test scripts/tests/scene-debug-room-regressions.test.ts`

### Task 1.3: Expand room-page regression to cover the new host/UI contract

- **Location**: `scripts/tests/room-page-regressions.test.ts`, `src/js/pages/room-page.ts`
- **Description**: Add targeted assertions for slot subscriptions, host-context payload content, scene runtime slot selection, and room-local translation forwarding.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `room-page` regressions cover the new room runtime context shape, not just URL normalization.
  - Slot-aware host-context expectations are explicit in tests.
- **Validation**:
  - `node --import tsx --test scripts/tests/room-page-regressions.test.ts`

## Sprint 2: Deepen XOX Behavior Coverage

**Goal**: Bring XOX verification up to the level promised by the original plan.

**Demo/Validation**:

- XOX host tests cover core rule enforcement and failure paths.
- Room UI / room-page tests cover the new runtime contract more concretely.

### Task 2.1: Add missing host-rule regressions

- **Location**: `scripts/tests/game-room-xox-host-regressions.test.ts`, `rooms/game-room/host/index.js`
- **Description**: Add coverage for invalid user cells, filled-cell rejection, wrong-turn rejection, provider mismatch, invalid AI move blocking, filled AI move blocking, win detection, draw detection, and game-over lockout.
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Core XOX game rules are directly covered by tests.
  - AI-slot routing errors fail safely and deterministically.
- **Validation**:
  - `node --import tsx --test scripts/tests/game-room-xox-host-regressions.test.ts`

### Task 2.2: Add room UI / i18n bridge assertions for translation-driven rendering

- **Location**: `scripts/tests/i18n-remediation-regressions.test.ts`, `rooms/game-room/ui/index.js`
- **Description**: Update the room UI smoke path to feed room translations through `host-context`, then assert locale-sensitive rendering from the room catalog rather than from a giant embedded fallback table.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - UI smoke tests represent the real runtime path: `host-context.locale` + `host-context.translations`.
  - The test fails if room-local catalogs stop driving visible room copy.
- **Validation**:
  - `node --import tsx --test scripts/tests/i18n-remediation-regressions.test.ts`

## Sprint 3: Tighten I18n And Workflow Guidance

**Goal**: Reduce future drift by making room-local copy and room/feature process rules more explicit.

**Demo/Validation**:

- The room UI no longer relies on a large embedded fallback catalog as its de facto copy source.
- `AGENTS.md` tells future assistants exactly how to prevent room/feature/type mismatch regressions.

### Task 3.1: Reduce room UI fallback scope to bootstrap-safe copy only

- **Location**: `rooms/game-room/ui/index.js`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Replace the large embedded room copy table with a minimal bootstrap fallback. The real room UI should render from room-local translations delivered via `host-context`.
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - Embedded fallback copy is intentionally minimal and documented.
  - Visible XOX room strings resolve from room-local catalogs once context arrives.
- **Validation**:
  - `node --import tsx --test scripts/tests/i18n-remediation-regressions.test.ts scripts/tests/room-ui-regressions.test.ts`

### Task 3.2: Harden AGENTS room / main-function workflows against type and contract drift

- **Location**: `AGENTS.md`
- **Description**: Tighten `workflow:room-addition` and `workflow:room-feature-addition` with explicit instructions for payload typing, manifest/type synchronization, scene/debug regression updates, room-local i18n usage, command/protocol uniqueness, and mandatory typecheck/test closure before completion.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Future assistants are instructed to lock room-vs-feature scope before editing.
  - Type and contract checks are mandatory for room/feature work.
  - The process explicitly prevents hidden fallback-copy and stale-test drift.
- **Validation**:
  - Manual consistency review against existing mode/onay rules

## Sprint 4: Final Closure And Smoke Record

**Goal**: Leave a clean closure trail for both code and process.

**Demo/Validation**:

- Targeted room/XOX/scene suites pass together.
- A smoke checklist exists for future runtime verification.

### Task 4.1: Record the XOX smoke matrix

- **Location**: `.rovo/` closure notes or checklist file
- **Description**: Add a short smoke checklist for `AI1/AI2` and `user-start/ai-start`, including disconnect and malformed-command scenarios. This is a durable artifact even when runtime smoke cannot be executed in the same turn.
- **Dependencies**: Sprints 1-3 complete
- **Acceptance Criteria**:
  - The closure leaves behind a repeatable smoke matrix.
  - Remaining manual-runtime checks, if any, are stated explicitly.
- **Validation**:
  - Manual review of the checklist file

### Task 4.2: Run the final validation bundle

- **Location**: test runner / typecheck
- **Description**: Run all touched room/XOX/scene/i18n suites plus full typecheck and ensure the closure work is stable.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Targeted suites are green.
  - `npm run typecheck` is green.
- **Validation**:
  - Final command log and summary

## Testing Strategy

- Update stale static regressions first so later work measures the intended contract.
- Prefer direct installed-room scene/debug tests over source-string-only checks where feasible.
- Keep host-rule tests deterministic and focused on single responsibilities.
- Re-run i18n and scene/debug suites after any room UI fallback changes.
- Finish with the combined targeted suite plus `npm run typecheck`.

## Potential Risks And Gotchas

- Some scene/debug failures may look like stale tests but can hide real contract drift; each one must be justified before rewriting the expectation.
- Shrinking room UI fallbacks too aggressively can leave the UI unreadable if `host-context` is delayed or missing.
- Dynamic installed-room tests can become brittle if they mutate `RoomRegistry` globally and do not restore it cleanly.
- `AGENTS.md` tightening must not conflict with the existing onay/mode system.

## Rollback Plan

- Revert the new closure-only plan if documentation paths change.
- Revert targeted regression updates if they accidentally mask a genuine behavior regression.
- If bootstrap fallback tightening harms the room UI startup path, restore the previous fallback temporarily and keep the new tests as a guide for a narrower follow-up.
