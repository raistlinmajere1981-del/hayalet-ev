# Plan: SlotBridge Single Authority Cutover

**Generated**: 2026-04-18
**Estimated Complexity**: High

## Current Status

Implementation is now substantially complete:

- `analyze`, relay, app command, and room host traffic route through `SlotBridge`
- retired wrappers are removed
- retired attachment actions fail loudly at the bridge boundary
- `session.sync` is the canonical US1 refresh path

Remaining room-owned `sessionRef`, remote identity, or duplicate-suppression fields should be treated as derived domain state, not as an alternate transport stack. The single-authority rule applies to transport IO, reply capture, and session refresh entrypoints.

## Overview

The repo already has a strong `SlotBridge` foundation, but it is not yet the only authority for slot messaging, file delivery, waited replies, or room-to-slot transport. There are still live parallel paths in app pages, relay runtimes, room host APIs, and legacy command wrappers.

The goal of this plan is to make `SlotBridge` the single orchestration boundary for every slot-facing operation across the app and rooms:

- slot message send
- slot waited reply flow
- slot attachment/file delivery
- protocol-composed outbound send
- room-to-slot transport
- assistant and relay handoff traffic
- `us1` outbound traffic

End-state rule:

- Every slot-facing workflow enters through `SlotBridge`.
- Low-level webview/IPC delivery code may still exist internally, but it must become a private implementation detail behind `SlotBridge`, not a second callable system.
- Legacy wrappers, fallback actions, and direct bypasses are removed once migrated.

## Planning Snapshot Before Cutover

### Already bridge-based or bridge-adjacent

- `src/js/modules/commands/slot-bridge.ts`
- `src/types/commands.ts`
- `src/js/modules/rooms/room-host-runtime.ts`
  `dispatchBridge(...)` already exists and some room flows use it.
- `rooms/forge-room/host/runtime.ts`
- `rooms/forge-room/host/forge-preflight-runtime.ts`
- `rooms/game-room/main-functions/xox/host/runtime-match.ts`
- `rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts`
- `rooms/game-room/main-functions/team-tetris/host/runtime.ts`

### Historical bypass inventory that originally kept parallel systems alive

- App UI and page surfaces:
  - `src/js/pages/analyze.ts`
  - `src/js/app/relay-ui.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/modules/core/runtime-actions.ts`
- Relay runtimes:
  - `src/js/modules/relay/ai-ai-relay.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
  - `src/js/modules/relay/us1-assistant-relay.ts`
- Legacy orchestration APIs:
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/core/send-actions.ts`
- Room host legacy helper surface:
  - `src/js/modules/rooms/room-host-runtime.ts`
  - exposed helpers still include `sendProtocol`, `sendMessage`, `sendToTargets`, `sendUs1Message`
- Direct transport bypass:
  - `src/js/pages/analyze.ts`
    historical direct `window.electronAPI.us1SendMessage(...)` usage before migration

### Legacy surfaces that conflict with “SlotBridge only”

- Command wrappers:
  - `AIAssistantSend`
  - `AssistantAISend`
- Legacy bridge actions:
  - `message.sendWithAttachments`
  - `file.send`
- Legacy app-facing APIs:
  - `CoreEngine.sendProtocol(...)`
  - `CoreEngine.sendMessage(...)`
  - `CoreEngine.sendToTargets(...)`
  - direct room host helper aliases over those concepts

## Assumptions

- Public slot command after cleanup is only `++cmd:SlotBridge({...})`.
- The end-state removes legacy wrappers instead of keeping them as permanent aliases.
- `message.send` and `message.sendWait` remain the only canonical outbound send actions.
- `room.command`, `connection.ensure`, and `session.*` remain as valid `SlotBridge` actions.
- `rooms/<room-id>` stays the source of truth for room code; `data/rooms/<room-id>` is regenerated, not hand-maintained as a peer source.

## Prerequisites

- Existing bridge contract inputs:
  - `.rovo/slot-bridge-contract.md`
  - `.rovo/slot-bridge-protocol-unification-plan.md`
- Core bridge/runtime:
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/commands/slot-bridge-runtime.ts`
  - `src/types/commands.ts`
  - `src/js/modules/server-commands.ts`
- Legacy orchestration surfaces:
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/app/relay-ui.ts`
  - `src/js/modules/core/runtime-actions.ts`
- Relay implementations:
  - `src/js/modules/relay/ai-ai-relay.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
  - `src/js/modules/relay/us1-assistant-relay.ts`
- Room host/runtime surfaces:
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `rooms/game-room/main-functions/**/*`
  - `rooms/forge-room/host/**/*`
- Validation surfaces:
  - `scripts/tests/slot-bridge-regressions.test.ts`
  - `scripts/tests/assistant-ai-command-regressions.test.ts`
  - `scripts/tests/server-command-panel-regressions.test.ts`
  - `scripts/tests/relay-auto-stop-disconnect-regressions.test.ts`
  - `scripts/tests/ai-chat-stop-regressions.test.ts`
  - `scripts/tests/us1-conversation-service-regressions.test.ts`
  - `scripts/tests/game-room-xox-host-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-host-regressions.test.ts`
  - `scripts/tests/game-room-fate-knots-host-regressions.test.ts`
  - `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `scripts/tests/forge-room-host-messages-regressions.test.ts`
  - `npm run rooms:build`
  - `npm run typecheck`

## Sprint 1: Freeze The End-State Contract
**Goal**: Define the exact “SlotBridge only” boundary before deleting any caller paths.
**Demo/Validation**:

- A single contract doc states which actions survive, which wrappers are removed, and which internal helpers are still allowed as private leaves.
- Every currently living bypass is mapped to a migration task and file owner.

### Task 1.1: Document the final single-authority boundary
- **Location**:
  - `.rovo/slot-bridge-contract.md`
  - `src/types/commands.ts`
- **Description**: Update the bridge contract so it explicitly states:
  - canonical send actions are only `message.send` and `message.sendWait`
  - `message.sendWithAttachments` and `file.send` are scheduled for removal
  - `AIAssistantSend` and `AssistantAISend` are scheduled for removal
  - no app or room workflow may call slot delivery through any non-bridge entrypoint
- **Complexity**: 5/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - The contract defines “single authority” in architectural terms, not just command names.
  - The contract distinguishes public bridge surface from private low-level delivery leaves.
- **Validation**:
  - Cross-check the contract against every live send path found in the current-state inventory.

### Task 1.2: Freeze the capability-gap list for bridge-first migration
- **Location**:
  - `.rovo/slot-bridge-contract.md`
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/commands/slot-bridge-runtime.ts`
- **Description**: Confirm which capabilities must be improved inside `SlotBridge` before deletion work starts. Minimum decision list:
  - attachments only through `message.send` and `message.sendWait`
  - protocol-composed send parity for AI slots and `us1`
  - stable `sessionRef` handling for room and `us1` flows
  - typed internal bridge dispatch helper so callers stop building raw handler payloads ad hoc
- **Complexity**: 6/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - There is no migration task that still depends on `file.send`, `message.sendWithAttachments`, or direct `electronAPI.us1SendMessage`.
  - Any real bridge gap is named before caller deletion starts.
- **Validation**:
  - Review against `analyze`, relay, game room, forge room, and `us1` transport call sites.

### Task 1.3: Freeze the deletion matrix
- **Location**:
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `src/js/modules/server-commands.ts`
  - `src/js/modules/commands/command-descriptions.ts`
  - `shared/languages/en/index.json`
  - `shared/languages/tr/index.json`
- **Description**: Mark every legacy surface as one of:
  - migrate then delete
  - migrate then hard-error
  - keep only as private internal leaf
- **Complexity**: 5/10
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - No ambiguous “maybe keep temporarily” surface remains in the end-state definition.
  - The deletion order avoids breaking rooms or relay stop flows mid-migration.
- **Validation**:
  - Compare the deletion matrix against grep results for `sendProtocol`, `sendMessage`, `sendToTargets`, `sendUs1Message`, `AIAssistantSend`, `AssistantAISend`, `file.send`, and `message.sendWithAttachments`.

### Task 1.4: Freeze room migration scope from source copies only
- **Location**:
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `rooms/game-room/main-functions/**/*`
  - `rooms/forge-room/host/**/*`
- **Description**: Lock the room migration to workspace sources only. The plan should say explicitly:
  - migrate `rooms/*` sources
  - regenerate installed copies
  - do not hand-edit `data/rooms/*` as a peer path
- **Complexity**: 3/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The room migration sequence respects the repo’s source-of-truth rule.
- **Validation**:
  - Review the affected room source files and the room build flow before implementation starts.

## Sprint 2: Build The Bridge-Only Runtime Foundation
**Goal**: Make `SlotBridge` ergonomic and capable enough that callers no longer need any parallel orchestration API.
**Demo/Validation**:

- App code can call one typed internal bridge helper instead of assembling raw `slotBridgeHandler(...)` payloads repeatedly.
- `message.send` and `message.sendWait` cover attachments, protocol composition, and `us1` parity without legacy fallback actions.

### Task 2.1: Introduce a typed internal bridge dispatcher
- **Location**:
  - `src/js/modules/commands/slot-bridge-runtime.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - optionally new helper module under `src/js/modules/commands/`
- **Description**: Add one app-facing helper for structured bridge dispatch. It should:
  - normalize provider/source/message boilerplate
  - expose typed helpers for fire-and-forget and wait modes
  - replace scattered direct `slotBridgeHandler(...)` construction in app code
- **Complexity**: 7/10
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - New app callers no longer need to hand-build internal command payload wrappers.
  - The helper can be reused by pages, relays, and room host runtime.
- **Validation**:
  - Add direct unit coverage for helper normalization and failure propagation.

### Task 2.2: Make message actions fully canonical
- **Location**:
  - `src/types/commands.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/commands/slot-bridge-runtime.ts`
- **Description**: Close any remaining gaps so `message.send` and `message.sendWait` are the only bridge send actions needed. This includes:
  - attachment handling without `message.sendWithAttachments`
  - attachment-only send support without `file.send`
  - protocol composition parity for AI slots and `us1`
  - consistent `sessionRef` and reply/artifact behavior
- **Complexity**: 8/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Canonical message actions can cover every current caller shape.
  - Legacy send actions become unnecessary at the contract level.
- **Validation**:
  - Expand `scripts/tests/slot-bridge-regressions.test.ts` for canonical attachment-only, protocol-plus-attachment, and `us1` parity cases.

### Task 2.3: Re-home old CoreEngine semantics behind the bridge
- **Location**:
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/core/send-actions.ts`
- **Description**: Collapse old orchestration behavior so `CoreEngine` no longer represents a second routing system. The target state is:
  - bridge dispatcher owns orchestration
  - any remaining `sendBatch`-style functionality is private delivery infrastructure only
  - `sendProtocol`, `sendMessage`, and `sendToTargets` stop being supported architectural entrypoints
  - any still-needed `sendProtocol` behavior survives only as a bridge-backed shim until every relay/app caller is migrated in the same or immediately following step
- **Complexity**: 8/10
- **Dependencies**: Task 2.1, Task 2.2
- **Acceptance Criteria**:
  - `CoreEngine` no longer exposes a parallel public mental model for slot delivery.
  - Hidden analyze/relay side effects inside `sendProtocol` are either migrated or deleted.
- **Validation**:
  - Search for remaining external imports/usages of old `CoreEngine` send surfaces and verify they are gone or intentionally private.

### Task 2.4: Add architecture guard coverage before caller migration
- **Location**:
  - `scripts/tests/slot-bridge-regressions.test.ts`
  - new regression file if needed under `scripts/tests/`
- **Description**: Add tests that fail if non-bridge orchestration paths reappear. Guard at least:
  - legacy action use
  - raw `sendProtocol` orchestration use
  - direct `electronAPI.us1SendMessage` from UI/app pages
  - legacy bridge action acceptance at runtime so `message.sendWithAttachments` and `file.send` cannot silently survive through dynamic payloads
- **Complexity**: 6/10
- **Dependencies**: Task 2.2, Task 2.3
- **Acceptance Criteria**:
  - The repo has a regression boundary that protects the architecture, not just behavior.
- **Validation**:
  - Run the new guard suite plus targeted bridge regressions.

### Task 2.5: Add explicit wait-plus-attachment bridge coverage
- **Location**:
  - `scripts/tests/slot-bridge-regressions.test.ts`
- **Description**: Add focused coverage for the combined code paths that are easiest to miss during migration:
  - `message.sendWait` with attachments on AI targets
  - `message.sendWait` with attachments on `us1`
  - reply/artifact forwarding after waited attachment sends
- **Complexity**: 6/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Waited attachment flows are pinned down at the bridge level before caller deletion begins.
- **Validation**:
  - Run the direct bridge regression suite after adding the new waited-attachment cases.

## Sprint 3: Migrate App Pages And Relay Orchestration
**Goal**: Remove non-room live bypasses so app-visible behavior is already bridge-only before room cleanup begins.
**Demo/Validation**:

- Analyze page sends everything through `SlotBridge`.
- Relay buttons and AI chat commands stop using `CoreEngine.sendProtocol`.
- Relay runtimes forward all traffic through the bridge dispatcher.

### Task 3.1: Migrate Analyze outbound send and `us1` send
- **Location**:
  - `src/js/pages/analyze.ts`
- **Description**: Replace:
  - `CoreEngine.sendBatch(...)`
  - direct `window.electronAPI.us1SendMessage(...)`
  - `CoreEngine.sendProtocol(...)`

  with bridge-only sends. When AI targets need different text variants, issue sequential `SlotBridge` sends instead of falling back to `sendBatch`.
- **Complexity**: 8/10
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - Analyze text send, attachments, protocol start/stop, and `us1` send all route through the bridge.
  - Analyze no longer owns a direct transport bypass.
- **Validation**:
  - Add or update targeted Analyze regressions for AI send, cross-send, attachment send, and `us1` send.

### Task 3.2: Migrate relay UI and AI chat command orchestration
- **Location**:
  - `src/js/app/relay-ui.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/modules/core/runtime-actions.ts`
- **Description**: Replace `CoreEngine.sendProtocol(...)`-based start/stop flows with explicit bridge-driven behavior:
  - bridge sends the protocol/control message
  - relay/session lifecycle is started or stopped explicitly where needed
  - stop behavior no longer depends on hidden `sendProtocol` side effects
- **Complexity**: 8/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Relay buttons and AI chat commands do not depend on `CoreEngine.sendProtocol`.
  - Auto-stop behavior still works when peers disconnect.
- **Validation**:
  - Update `scripts/tests/assistant-ai-command-regressions.test.ts`
  - Update `scripts/tests/relay-auto-stop-disconnect-regressions.test.ts`
  - Update `scripts/tests/ai-chat-stop-regressions.test.ts`

### Task 3.3: Migrate relay runtimes to bridge-only forwarding
- **Location**:
  - `src/js/modules/relay/ai-ai-relay.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
  - `src/js/modules/relay/us1-assistant-relay.ts`
  - `src/js/modules/relay/base-relay.ts`
- **Description**: Replace relay use of:
  - `coreEngine.sendMessage(...)`
  - `coreEngine.sendToTargets(...)`

  with the internal typed bridge dispatcher. This includes protocol kickoffs, plain message forwarding, attachment forwarding, and `us1` session-bound forwarding.
- **Complexity**: 9/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Relay runtimes no longer treat `CoreEngine` send helpers as normal routing APIs.
  - Relay behavior is unchanged from the user’s perspective.
- **Validation**:
  - Add/update relay regressions for AI-AI, AI-assistant, and `us1`-assistant flows.

### Task 3.4: Remove app-layer direct transport bypasses
- **Location**:
  - `src/js/pages/analyze.ts`
  - any other app/page module still calling direct IPC transport
- **Description**: Enforce the rule that app/page modules may not call slot transport IPC directly. Any required transport-specific metadata must be expressed through bridge payloads.
- **Complexity**: 5/10
- **Dependencies**: Task 3.1, Task 3.3
- **Acceptance Criteria**:
  - Grep for direct `us1SendMessage` usage in app/page code returns zero intentional hits.
- **Validation**:
  - Add a regression or guard that blocks future direct app/page transport calls.

## Sprint 4: Migrate Rooms To A Single Room Bridge API
**Goal**: Remove room host helper sprawl so room code also talks to the app through one bridge-shaped primitive.
**Demo/Validation**:

- Room host API exposes one bridge-first boundary.
- Game Room and Forge Room source code stop relying on legacy helper variants.

### Task 4.1: Collapse room host API to one bridge-first surface
- **Location**:
  - `src/js/modules/rooms/room-host-runtime.ts`
- **Description**: Replace room host helper sprawl with one bridge-first API. Target state:
  - keep `dispatchBridge(...)` or replace it with a better-named equivalent
  - remove room-facing `sendProtocol`, `sendMessage`, `sendToTargets`, `sendUs1Message`
  - decide the fate of `syncUs1Messages` and `selectUs1RemoteUser` explicitly: either fold them into the bridge contract or keep them only as named private leaves with architecture guards
  - provide typed wait/send helpers only as thin bridge wrappers if ergonomics are needed
- **Complexity**: 8/10
- **Dependencies**: Sprint 3 complete
- **Acceptance Criteria**:
  - Room code has one conceptual way to talk to slots.
  - Room host runtime no longer preserves legacy helper concepts as parallel APIs.
- **Validation**:
  - Compile and run targeted room-host regressions after interface replacement.

### Task 4.2: Migrate Game Room sources from helper sprawl to bridge-only
- **Location**:
  - `rooms/game-room/main-functions/xox/host/runtime.ts`
  - `rooms/game-room/main-functions/xox/host/us1-invite-runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime-transport.ts`
  - `rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts`
- **Description**: Replace all use of room host legacy helper shapes with bridge-only requests. Focus on:
  - `us1` invite/move/reset flows
  - `us1` sync and remote-user selection flows where they affect XOX runtime continuity
  - AI turn dispatch
  - prompt delivery
  - waited host requests if any
- **Complexity**: 9/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Game Room source code no longer depends on `sendUs1Message` or other legacy host helper names.
  - Room-to-slot traffic remains behaviorally unchanged.
- **Validation**:
  - Run `npm run rooms:build` immediately after each migrated source batch
  - Run `scripts/tests/game-room-xox-host-regressions.test.ts`
  - Run `scripts/tests/game-room-team-tetris-host-regressions.test.ts`
  - Run `scripts/tests/game-room-fate-knots-host-regressions.test.ts`

### Task 4.3: Migrate Forge Room host flows to the same bridge discipline
- **Location**:
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/forge-preflight-runtime.ts`
- **Description**: Forge already uses bridge waits in key places; tighten it so there are no side paths or mixed patterns left once the room host API is simplified.
- **Complexity**: 6/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Forge Room stays on the same single-authority bridge model as Game Room.
- **Validation**:
  - Run `npm run rooms:build` after Forge source changes when installed copies are part of the exercised path
  - Run `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - Run `scripts/tests/forge-room-host-messages-regressions.test.ts`

### Task 4.4: Rebuild room artifacts from source and verify parity
- **Location**:
  - `rooms/**/*`
  - generated installed copies under `data/rooms/**/*`
- **Description**: After source-room migration, regenerate installed copies and verify no manual drift remains.
- **Complexity**: 4/10
- **Dependencies**: Task 4.2, Task 4.3
- **Acceptance Criteria**:
  - Installed room copies reflect migrated source behavior.
  - No direct patching is required in `data/rooms`.
- **Validation**:
  - Run `npm run rooms:build`
  - Run room regression suites again after rebuild

## Sprint 5: Remove Legacy Commands, Fallbacks, And Drift Vectors
**Goal**: Complete the cutover so `SlotBridge` is not just preferred, but enforced as the only slot orchestration surface.
**Demo/Validation**:

- Legacy wrappers and legacy send actions are gone.
- Architectural guardrails fail fast if someone reintroduces a bypass.

### Task 5.1: Remove legacy command wrappers and action aliases
- **Location**:
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/modules/server-commands.ts`
  - `src/js/modules/commands/command-descriptions.ts`
  - `shared/languages/en/index.json`
  - `shared/languages/tr/index.json`
  - `src/types/commands.ts`
  - `src/js/modules/commands/slot-bridge.ts`
- **Description**: Delete:
  - `AIAssistantSend`
  - `AssistantAISend`
  - `message.sendWithAttachments`
  - `file.send`

  Update help text, command catalog, and command-disable surfaces so the old names are not advertised or silently accepted.
- **Complexity**: 7/10
- **Dependencies**: Sprint 4 complete
- **Acceptance Criteria**:
  - Users, AI prompts, and command catalogs point only to `SlotBridge`.
  - Removed surfaces do not remain as undocumented aliases.
- **Validation**:
  - Update `scripts/tests/assistant-ai-command-regressions.test.ts`
  - Update `scripts/tests/server-command-panel-regressions.test.ts`

### Task 5.1a: Hard-reject retired bridge actions at runtime before final doc cleanup
- **Location**:
  - `src/types/commands.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - `scripts/tests/slot-bridge-regressions.test.ts`
- **Description**: As soon as callers are migrated, stop accepting `message.sendWithAttachments` and `file.send` inside `slotBridgeHandler(...)` so stale prompts and dynamic payloads fail loudly instead of silently using legacy behavior.
- **Complexity**: 5/10
- **Dependencies**: Sprint 3 complete
- **Acceptance Criteria**:
  - Retired bridge action names fail at runtime with explicit errors before the final cleanup sweep.
- **Validation**:
  - Add negative regression coverage for both retired action names.

### Task 5.2: Privatize remaining delivery leaves so only SlotBridge can call them
- **Location**:
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/commands/slot-bridge-runtime.ts`
  - transport leaf modules under `src/js/modules/webview/` and Electron IPC if touched
- **Description**: Preserve low-level delivery implementation where needed, but move or rename it so it cannot be mistaken for a second orchestration API. The important rule is:
  - low-level leaves may remain
  - only `SlotBridge` may own orchestration and public entry
- **Complexity**: 8/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - There is no callable app-layer API that competes with `SlotBridge`.
  - Internal leaf naming and module placement reflect their reduced role.
- **Validation**:
  - Grep for external imports/usages of former orchestration helpers.

### Task 5.3: Add hard architectural guardrails
- **Location**:
  - new regression or lint guard under `scripts/tests/`
  - optional lint config if preferred by the repo
- **Description**: Add an automated guard that blocks future reintroduction of:
  - `CoreEngine.sendProtocol(...)`
  - app/page direct transport IPC
  - legacy room host helper exports
  - legacy wrapper command registry entries
- **Complexity**: 6/10
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Future bypasses fail CI quickly.
- **Validation**:
  - Run the new guard suite with the targeted bridge and room regressions.

### Task 5.4: Final smoke and rollout proof
- **Location**:
  - relevant docs and smoke checklist files
- **Description**: Run a final bridge-only smoke matrix covering:
  - AI text send
  - AI waited reply
  - attachment send
  - `us1` send
  - AI relay start/stop
  - assistant relay start/stop
  - room AI move / room remote move
  - forge waited prompt/preflight
- **Complexity**: 5/10
- **Dependencies**: Task 5.1, Task 5.2, Task 5.3
- **Acceptance Criteria**:
  - The whole slot-facing experience works without any old command or legacy helper.
- **Validation**:
  - Targeted smoke checklist run on a live app session after regression suites pass.

## Testing Strategy

- Keep direct bridge contract coverage strong in `scripts/tests/slot-bridge-regressions.test.ts`.
- Add architecture-guard coverage so the repo fails when new bypasses appear.
- Re-run targeted command/relay suites after each app-surface migration:
  - `scripts/tests/assistant-ai-command-regressions.test.ts`
  - `scripts/tests/relay-auto-stop-disconnect-regressions.test.ts`
  - `scripts/tests/ai-chat-stop-regressions.test.ts`
- Re-run `us1` transport coverage after any `sessionRef` or attachment change:
  - `scripts/tests/us1-conversation-service-regressions.test.ts`
- Re-run room regressions after room-host API simplification:
  - `scripts/tests/game-room-xox-host-regressions.test.ts`
  - `scripts/tests/game-room-team-tetris-host-regressions.test.ts`
  - `scripts/tests/game-room-fate-knots-host-regressions.test.ts`
  - `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `scripts/tests/forge-room-host-messages-regressions.test.ts`
- Run `npm run rooms:build` after room source migrations.
- Run `npm run typecheck` before calling the cutover complete.

## Potential Risks & Gotchas

- `CoreEngine.sendProtocol(...)` currently hides analyze/relay side effects. Deleting it before re-homing those behaviors will silently break relay start/stop semantics.
- The special analyze sequential branch in `CoreEngine.sendProtocol(...)` must either move to a bridge-owned helper or remain as an explicitly temporary bridge-backed shim until the caller set is empty.
- `us1` session continuity depends on `localSessionId` and/or `conversationId`; bridge normalization must preserve both where needed.
- Room-side `syncUs1Messages` and `selectUs1RemoteUser` are not plain send helpers; if they remain, they must be documented as private state/control leaves and protected so they do not become an accidental second transport API.
- Analyze currently uses one AI send path and one direct `us1` path; migrating only one side creates temporary split-brain behavior.
- Room host simplification can accidentally leave helper-shaped adapters alive under new names. The review pass must check concepts, not just symbol names.
- Removing `AIAssistantSend` and `AssistantAISend` without updating command docs, prompts, and user-facing help will cause stale outputs to keep emitting dead commands.
- Some wrapper regressions currently assert `testMode` behavior on the legacy commands; once wrappers are deleted, those expectations must move to bridge-native coverage instead of being dropped silently.
- Removing `message.sendWithAttachments` and `file.send` can also affect disabled-command settings, server command panel examples, and documentation text.
- The repo contains generated installed room copies. If source-room migration is not followed by rebuild/sync, the runtime can look broken even when source files are correct.
- Some low-level delivery helpers likely need to remain for webview/IPC execution. The important cut is ownership: they must become private leaves, not public alternatives.

## Rollback Plan

- Land the migration in sprint-sized commits so each architectural cut can be reverted independently.
- If a sprint breaks behavior, restore the previous adapter layer for that sprint only rather than reintroducing the whole legacy surface.
- Do not delete wrappers and legacy actions until app surfaces, relays, and room hosts are already green on targeted regressions.
- If room migration causes drift, revert source-room changes, rebuild installed copies from the restored source state, and retry with a narrower room slice.
