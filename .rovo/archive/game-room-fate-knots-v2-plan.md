# Plan: Game Room Fate Knots V2

**Generated**: 2026-03-27
**Estimated Complexity**: High

## Overview

Fate Knots V2 builds on the stable V1 slice that already ships inside `game-room`. The core strategy is:

- keep the existing room and host contract stable where possible
- upgrade the renderer into a scene-first surface before expanding mechanics
- turn US1 into a real participant without inventing a new transport layer
- add DM and NPC text layers as additive protocol-driven surfaces, not as rule owners
- persist player profile and run history now, while leaving full save/resume as a scaffold only

This plan treats `rooms/game-room/**` as the source of truth and keeps `data/rooms/game-room/**` in sync through the room packaging workflow.

## Locked Decisions

- **Room / Feature Split**: `game-room` remains the room, `fate-knots` remains one main function inside it.
- **Rendering Model**: DOM/CSS stays in place for V2.
- **Combat Ownership**: host combat engine remains authoritative.
- **DM / NPC Scope**: additive narration and banter only in V2.
- **Persistence V2 Scope**: profile + run history + optional save-slot scaffold metadata.
- **US1 Rule**: US1 joins the active roster only when ready and connected.
- **Quorum Rule**: unanimous shared-decision flow stays intact in V2.
- **Primary References**:
  - `deep-research-report.md`
  - `assets/fate-knots-scene-first-ui-plan.md`
  - `assets/game-room-fate-knots-ui-rules.md`

## Prerequisites

- Existing Fate Knots runtime, UI, and asset pipeline under `rooms/game-room/main-functions/fate-knots/**`
- Existing host and UI regressions under `scripts/tests/game-room-fate-knots-*.test.ts`
- Existing installed-copy smoke tests for `game-room`
- Existing room packaging flow via `npm run rooms:bundle`

## V2 Contract Matrix

### UI -> Host Commands

- `GameRoomFateKnotsStart`: start a new run from the overview surface
- `GameRoomFateKnotsReset`: reset the active slice and clear transient run state
- `GameRoomFateKnotsUpdateSelection`: update the local build during creation
- `GameRoomFateKnotsReady`: lock the local build and enter the shared run
- `GameRoomFateKnotsChoice`: submit the current unanimous scenario choice
- `GameRoomFateKnotsCombatAction`: submit the local combat action for the active turn
- `GameRoomFateKnotsSync`: recover desync or timeout waits without reloading the room
- `GameRoomFateKnotsEndRun`: close the result state and return to overview
- `GameRoomFateKnotsDmPacket`: ingest additive DM narration only
- `GameRoomFateKnotsNpcBanter`: ingest additive seat-local NPC banter only

### Host -> UI State Slices

- core flow: `phase`, `statusKey`, `status`, `waiting`, `compatibility`, `sessionId`
- roster and ownership: `participants`, `excludedSeats`, `participantMode`, `rosterLocked`, `transport`
- content and play: `map`, `currentStep`, `decision`, `combat`, `result`, `scenarioLog`
- additive layers: `dmNarration`, `npcBanter`
- persistence: `profile`, `history`, `saveSlot`
- renderer support: `catalogs`, `assetCoverage`, `contentErrors`, `contentSummary`, `uiAssets`

### AI And Transport Entry Points

- AI scenario/combat prompts continue through the room host dispatch flow
- US1 prompts use `api.sendUs1Message(...)` with per-turn and per-decision dedupe
- ambient DM and NPC prompts are best-effort and never block the host engine
- manifest protocol specs stay explicit for `game-room-fate-knots-us1-transport`, `game-room-fate-knots-ai-dm`, and `game-room-fate-knots-ai-npc`

### Persistence Keys

- `fate-knots-profile`
- `fate-knots-history`
- `fate-knots-save-slot`

### Non-Goals / Out Of Scope

- full save and resume UI
- soft quorum or automatic remote-seat downgrade
- renderer migration away from DOM/CSS
- DM or NPC packets mutating combat or scenario authority

## Sprint 0: Contract Freeze And V2 Backlog

**Goal**: Freeze the V2 payload, protocol, and persistence surface before code changes branch out.
**Demo / Validation**:

- one written contract matrix exists for UI, host, AI, US1, and persistence
- V2 scope boundaries are explicit

### Task 0.1: Freeze command and event matrix

- **Location**: `assets/game-room-fate-knots-v2-plan.md`
- **Description**: Record the UI -> host commands, host -> UI state slices, AI protocol entry points, US1 transport events, and persistence keys that V2 will touch.
- **Complexity**: 2
- **Dependencies**: None
- **Acceptance Criteria**:
  - every new or changed Fate Knots command is listed with producer and consumer
  - non-goals are explicitly written
- **Validation**:
  - manual review against `rooms/game-room/manifest.json`
  - manual review against `rooms/game-room/main-functions/fate-knots/host/runtime.js`

### Task 0.2: Freeze smoke matrix

- **Location**: `assets/game-room-fate-knots-v2-plan.md`
- **Description**: Record the minimum smoke matrix for overview, creation, scenario, combat, result, US1 pending, DM packet, NPC packet, and persistence recovery.
- **Complexity**: 2
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - each V2 surface has one target smoke scenario
- **Validation**:
  - plan review

## Sprint 1: Scene-First UI Foundation

**Goal**: Replace the remaining dashboard feel with asset-backed scene-first primitives without changing the host payload contract.
**Demo / Validation**:

- overview, creation, scenario, combat, and result render through one visual system
- UI path regressions still verify command dispatch and structural hooks

### Task 1.1: Freeze landmark and primitive contract

- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Standardize `data-fk-phase`, `data-fk-role`, and `data-seat-id` landmarks and define reusable visual primitives for scene shell, rail frame, button plate, card slot, dialogue surface, and status chip.
- **Complexity**: 5
- **Dependencies**: Sprint 0
- **Acceptance Criteria**:
  - all major phase regions expose stable landmark hooks
  - renderer stops depending on generic panel semantics for primary surfaces
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`

### Task 1.2: Recompose all phases around scene-first hierarchy

- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Rework phase layouts so map, scene, and combat arena stay visually dominant while action, log, and status rails remain secondary.
- **Complexity**: 8
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - overview has dominant map shell
  - creation reads as a preparation table
  - scenario and combat remain in-world rather than dashboard-like
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-ui-path-regressions.test.ts`

### Task 1.3: Add UI asset preload and installed-copy parity gate

- **Location**: `rooms/game-room/main-functions/fate-knots/ui/module.js`, `scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`
- **Description**: Add lightweight preload behavior for the UI asset family and confirm installed-room parity still resolves the packaged assets.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - no obvious image pop-in remains on first render
  - installed-copy smoke covers packaged Fate Knots UI assets
- **Validation**:
  - `node --test scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`

## Sprint 2: US1 As A Real Participant

**Goal**: Promote US1 from deferred transport-only status into an active voter and combatant when ready.
**Demo / Validation**:

- a ready US1 joins the roster
- decision and combat prompts can be delivered to US1
- host state explains pending US1 waits cleanly

### Task 2.1: Include US1 in participant build

- **Location**: `rooms/game-room/main-functions/fate-knots/host/runtime.js`, `rooms/game-room/main-functions/fate-knots/host/models.js`
- **Description**: Remove the `v1-remote-deferred` exclusion path and include US1 in the participant roster when the room context reports it as ready.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `excludedSeats` no longer carries US1 deferral when ready
  - scenario quorum includes US1 when present
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-host-regressions.test.ts`

### Task 2.2: Add US1 prompt dispatch with dedupe and recovery

- **Location**: `rooms/game-room/main-functions/fate-knots/host/runtime.js`, `rooms/game-room/main-functions/fate-knots/protocols/game-room-fate-knots-us1-transport.md`
- **Description**: Reuse room transport to send decision and combat prompts to US1 only when a new pending state is entered, with sync-safe dedupe and clear retry behavior.
- **Complexity**: 8
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - US1 receives one prompt per pending turn or decision transition
  - sync retries do not spam duplicate transport messages
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-host-regressions.test.ts`
  - targeted mailbox-style assertions if needed

### Task 2.3: Refresh waiting, timeout, and desync messaging

- **Location**: `rooms/game-room/main-functions/fate-knots/host/state.js`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Improve V2 waiting and error visibility so US1 participation does not create silent deadlocks.
- **Complexity**: 4
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - state clearly identifies remote-pending phases
  - status copy exists in room-local i18n
- **Validation**:
  - host regression review
  - targeted UI path review

## Sprint 3: DM And NPC Additive Protocols

**Goal**: Add narration and party flavor without allowing AI text layers to alter rules or hidden state.
**Demo / Validation**:

- scenario and combat can show DM narration packets
- optional NPC seat banter appears in the UI
- host progression stays authoritative

### Task 3.1: Add protocol and command surfaces for DM packets

- **Location**: `rooms/game-room/manifest.json`, `rooms/game-room/main-functions/fate-knots/protocols/**`, `rooms/game-room/main-functions/fate-knots/host/runtime.js`
- **Description**: Register a strict protocol and ingestion command for DM narration packets tied to player-visible state only.
- **Complexity**: 7
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - DM replies are one-line `++cmd` payloads
  - host validates and stores additive narration only
- **Validation**:
  - host regressions for command parsing and storage

### Task 3.2: Add protocol and UI surfaces for NPC banter

- **Location**: `rooms/game-room/main-functions/fate-knots/protocols/**`, `rooms/game-room/main-functions/fate-knots/ui/module.js`, `rooms/game-room/main-functions/fate-knots/styles.css`
- **Description**: Let a selected AI seat emit short advisory or flavor packets that render as temporary seat-local bubbles.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - NPC bubble appears at the right seat landmark
  - bubble lifecycle never blocks command flow
- **Validation**:
  - UI path regressions
  - host regressions

### Task 3.3: Enforce knowledge boundary and schema rules

- **Location**: `rooms/game-room/main-functions/fate-knots/host/runtime.js`, `rooms/game-room/main-functions/fate-knots/host/payloads.js`
- **Description**: Reject malformed, multi-command, or state-mutating DM/NPC payloads and keep only player-visible additive text.
- **Complexity**: 6
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - malformed or overpowered packets are ignored safely
  - core scenario and combat progression remains engine-owned
- **Validation**:
  - host regressions for invalid payload handling

## Sprint 4: Persistence V2

**Goal**: Persist the local player profile and run history without attempting full save/resume yet.
**Demo / Validation**:

- lobby shows last build and recent run summaries
- last selections survive reset or restart

### Task 4.1: Add persistent profile state

- **Location**: `rooms/game-room/main-functions/fate-knots/host/state.js`, `rooms/game-room/main-functions/fate-knots/host/models.js`
- **Description**: Persist the last avatar, class, and background used by the local player.
- **Complexity**: 5
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - new runs default to the last valid local build
  - invalid or stale profile values normalize safely
- **Validation**:
  - host regressions for hydrate/reset behavior

### Task 4.2: Add run history summaries

- **Location**: `rooms/game-room/main-functions/fate-knots/host/state.js`, `rooms/game-room/main-functions/fate-knots/host/runtime.js`, `rooms/game-room/main-functions/fate-knots/ui/module.js`
- **Description**: Store compact run summaries with timestamp, roster, and outcome, then expose them in the lobby using the existing scene-first visual system.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - history is capped and stable
  - lobby can render recent runs without becoming a dashboard
- **Validation**:
  - host regressions
  - UI path review

### Task 4.3: Add save-slot scaffold metadata

- **Location**: `rooms/game-room/main-functions/fate-knots/host/models.js`, `rooms/game-room/main-functions/fate-knots/host/state.js`
- **Description**: Create a minimal metadata scaffold for future full save/resume without exposing unfinished behavior in the UI.
- **Complexity**: 4
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - future save metadata has a stable shape
  - no false impression of full resume support appears in the UI
- **Validation**:
  - host model regression review

## Sprint 5: Hardening, Packaging, And Release Gate

**Goal**: Make V2 safe to ship inside both source and installed room copies.
**Demo / Validation**:

- source and installed copies stay in parity
- targeted tests are green
- smoke checklist passes

### Task 5.1: Refresh Fate Knots regression suites

- **Location**: `scripts/tests/game-room-fate-knots-*.test.ts`
- **Description**: Update host, UI, engine, and asset tests to match the V2 contract.
- **Complexity**: 7
- **Dependencies**: Sprints 1-4
- **Acceptance Criteria**:
  - V2 behavior is covered with red/green assertions
- **Validation**:
  - `node --test scripts/tests/game-room-fate-knots-*.test.ts`

### Task 5.2: Refresh installed-copy parity and room bundle

- **Location**: `data/rooms/game-room/**`, `scripts/tests/game-room-installed-*.test.ts`
- **Description**: Rebuild or resync installed-room outputs and verify packaged host/UI/assets still load correctly.
- **Complexity**: 5
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - installed host smoke and installed UI smoke both pass
  - room bundle references only packaged Fate Knots files
- **Validation**:
  - `node --test scripts/tests/game-room-installed-host-runtime-smoke-regressions.test.ts`
  - `node --test scripts/tests/game-room-installed-ui-smoke-regressions.test.ts`
  - `npm run rooms:bundle`

### Task 5.3: Final review against plan

- **Location**: `assets/game-room-fate-knots-v2-plan.md`
- **Description**: Compare implementation output against this plan, reconcile drift, and close remaining gaps before sign-off.
- **Complexity**: 3
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - plan and implementation match or intentional deviations are documented
- **Validation**:
  - subagent review

## Testing Strategy

- Run targeted Fate Knots host/UI/engine/asset tests after each sprint that changes those surfaces.
- Keep installed-copy smoke checks in the loop once UI assets or packaged contracts change.
- Run `npm run typecheck` before final sign-off.
- Run `npm run rooms:bundle` before final sign-off.

## Smoke Matrix

- Overview render with active `fate-knots`
- Character creation with local selection updates
- Scenario decision with user + AI
- Combat action loop with user + AI
- Scenario pending on ready US1
- Combat pending on ready US1
- DM narration packet render
- NPC banter bubble render
- Lobby restore from profile + history

## Potential Risks And Gotchas

- **US1 deadlock risk**: remote waits can stall unanimous decisions. Mitigation: dedupe transport prompts, explicit wait state, recoverable sync.
- **DM overreach risk**: narration packets could leak hidden state. Mitigation: additive text only, strict schema validation, host-owned progression.
- **UI drift risk**: scene-first implementation can accidentally regress command flow. Mitigation: preserve button semantics and landmark hooks.
- **Source vs installed drift**: packaged room assets can fall out of sync. Mitigation: installed-copy smoke and bundle checks stay in definition-of-done.
- **Persistence bloat risk**: run history can become dashboard-like. Mitigation: compact summaries, capped history, restrained visual treatment.

## Rollback Plan

- Keep each sprint independently committable.
- If Sprint 2 transport logic destabilizes the room, revert US1 participation while keeping Sprint 1 UI improvements intact.
- If DM/NPC protocols prove noisy, disable the new command specs and keep the additive UI surfaces dormant.
- If persistence introduces normalization issues, fall back to transient V1-style run state while preserving the V2 schema scaffolding.

## Final Alignment Notes

- The implementation matches the planned V2 scope: scene-first renderer refresh, ready-only US1 roster participation, additive DM/NPC layers, profile/history persistence, save-slot scaffold, installed-copy parity, targeted regressions, `typecheck`, and room bundle validation.
- One late drift fix was required during final review: the overview rail's visible US1 label was moved from hardcoded UI copy into room-local i18n.
- Planned subagent sign-off could not complete because the agent tool hit an external usage limit; this review was completed locally as the fallback.
