# Fate Knots — First Architecture Audit Handoff

This is a **read-only architecture audit first**. Do not redesign Fate Knots and do not start Babylon/image-materializer implementation during this pass.

Target branch:

`feat/fate-knots-stage-c`

Base for integration comparison:

`main`

## Read first

In this order:

1. `rooms/game-room/main-functions/fate-knots/README.md`
2. `rooms/game-room/main-functions/fate-knots/CODEX-HANDOFF.md`
3. `rooms/game-room/main-functions/fate-knots/IMPLEMENTATION-PLAN.md`
4. `rooms/game-room/main-functions/fate-knots/AI0-RUNTIME-OVERRIDE.md`
5. `rooms/game-room/main-functions/fate-knots/FORGE-ASSET-CONTRACT.md`
6. `rooms/game-room/main-functions/fate-knots/MATERIALIZER-HANDOFF.md`

Treat those contracts as fixed design decisions. This audit is looking for implementation faults inside those decisions, not alternatives to them.

## Audit mode

### Phase 1 — static architecture review, no edits

Inspect the Fate Knots implementation plus every shared file changed by the branch.

Pay special attention to:

- `shared/contracts.ts`
- `shared/story-progression.ts`
- `shared/story-combat-flow.ts`
- `shared/run-flow.ts`
- `shared/run-phase.ts`
- `shared/run-setup.ts`
- `shared/encounter.ts`
- `shared/loot.ts`
- combat flow/runtime/resolution/aftermath/closure files
- `shared/player-view.ts`
- `shared/story-dm.ts`
- `shared/npc-role.ts`
- `host/persistence.ts`
- `host/durable-persistence.ts`
- `host/runtime.ts`
- `host/runtime-ai.ts`
- `host/transport.ts`
- `host/forge-service.ts`
- `host/world-forge-authoring.ts`
- `host/world-forge-orchestrator.ts`
- Forge validation/materializer files
- `electron/fate-knots-ai0-runtime-service.ts`
- Fate-related modifications to Game Room host/UI/manifest and room-tools IPC/types

Do not modify files during Phase 1.

## Questions the audit must answer

### 1. Canonical authority

Confirm that canonical game state remains engine/host-owned.

Look for any path where:

- renderer can receive hidden/full Universe canon
- renderer can submit an arbitrary replacement Universe/Run snapshot
- AI1 output can mutate mechanics/canon without an engine validator
- AI0 output can bypass normal legality/commit validation
- Babylon/UI state could become persistence authority
- provider conversation history can become canonical memory

The removal of raw public SaveUniverse/SaveRun commands and the use of `shared/player-view.ts` are intentional. Flag any remaining bypass.

### 2. Story progression / impossible states

V1 story-transition kinds are exactly:

`scene | travel | combat | camp | finale`

`loot` is a run phase reached through engine-owned encounter outcome, not a story-transition kind.

Normal story choices are available only from `exploration`.

Inside `finale`, only the combat transition matching `finale.finalEncounterId` may be exposed by the story resolver.

Check for:

- dead ends created by phase ownership
- transitions that can be selected from the wrong phase
- combat transition tracking cleared too early
- retreat/victory moving to the wrong knot/location
- final encounter paths that can never become legal
- final encounter victory leaving the run in an impossible phase
- loot/camp phases that cannot be exited through their intended authority
- story revisions or persistence snapshots becoming internally inconsistent

Do not solve a finding by adding a generic quest/workflow system.

### 3. Combat lifecycle

Verify:

- discussion -> commit -> resolution -> aftermath ownership
- movement pass precedes action pass
- action queue is rebuilt after movement
- queued cards revalidate immediately before resolution
- deterministic priority/speed/actor-id ordering
- fallen actor loses unresolved action
- shields/direct combat modifiers clear at intended aftermath boundary
- timed status semantics match the fixed V1 law
- terminal combat closes without leaking combat-only runtime
- party victory recovery syncs correctly into run state
- party defeat always terminates run
- mid-combat save/resume has enough state to continue coherently

### 4. Persistence / restart / rollback

Inspect restart-safe JSON persistence carefully.

Check:

- hydration order
- malformed/corrupt persisted entry behavior
- single-store write rollback
- dual Universe/Run mutation failure behavior
- deleting universe + related runs if one disk write fails
- activating a run + universe if one disk write fails
- active IDs pointing to removed/invalid entries
- combatRuntime actor matching
- schema/version assumptions
- accidental reliance on volatile RoomHost state

Do not propose a database unless a concrete V1 correctness failure requires one.

### 5. World Forge transaction

Verify the intended authority chain:

`AI1 draft -> structural validation -> playability validation -> asset materialization -> final validation -> durable save`

Check:

- requestId/universeId/createdAt round-trip protection
- pending asset paths cannot become canonical
- missing/duplicate/foreign materialized assets fail closed
- card-art bindings cannot point to foreign/duplicate cards
- Forge progress cannot leak hidden draft/canon to renderer
- concurrent Forge calls cannot race the same transaction state
- partial materializer success does not incorrectly mark Forge complete
- provenance/checkpoint writes cannot make an invalid universe active

A concrete image adapter is intentionally not implemented yet. Do not flag its absence as an architecture bug; only audit the adapter boundary.

### 6. AI isolation

AI0 runtime must remain isolated from the development-agent environment.

Check:

- separate OpenCode server/workspace ownership
- no repository-root AGENTS/MCP/memory bootstrap
- tool denial actually applies to Fate AI0 runtime
- fresh short-lived sessions are deleted
- failure cannot silently fall back to normal coding AI0
- hidden player commits are not present in AI0 combat packets
- AI0 receives no hidden global canon through NPC role packets

AI1 Forge session and runtime DM session must remain separate.

### 7. Strict TypeScript / integration risk

Look specifically for:

- `exactOptionalPropertyTypes` violations
- `noUncheckedIndexedAccess` hazards
- unsafe `unknown` casts at host/IPC boundaries
- structural types that compile only accidentally
- stale imports/exports after story-transition changes
- incompatible `GameRoomHostApi` capability assumptions
- browser-only APIs used in an invalid runtime context
- Node/Electron APIs used from room renderer code
- branch changes that could break Backgammon, Team Tetris or Yahtzee

## Phase 2 — local checks

After the static report is written, run checks without changing contracts merely to make them green.

At minimum try:

```bash
npx tsc --noEmit -p rooms/tsconfig.rooms.json
npx tsc --noEmit -p electron/tsconfig.electron.json
```

Then, if practical on the machine:

```bash
npm run typecheck
npm run rooms:build
```

Run focused existing Game Room tests if the repository exposes them. Do not depend on GitHub Actions.

If a check fails because of pre-existing unrelated main-branch debt, distinguish that from a Fate Knots regression.

## Required report format

Return findings only; do not edit yet.

Group them as:

- **BLOCKER** — corrupts canon, leaks hidden state, loses saves, breaks build/runtime, or makes normal V1 path impossible
- **HIGH** — likely lifecycle/authority bug but not always triggered
- **MEDIUM** — real robustness/maintainability fault worth fixing before Babylon
- **LOW** — cleanup or non-blocking concern

For each finding include:

1. exact file and symbol/area
2. what invariant is broken
3. a minimal reproduction/path when possible
4. the smallest contract-preserving fix
5. whether the issue is definitely introduced by Fate Knots or may be pre-existing/shared

Also include a final section:

### Confirmed clean boundaries

List important areas you specifically checked and found consistent. This prevents silence from being mistaken for an unreviewed area.

Do not include new game-design proposals in the report.
