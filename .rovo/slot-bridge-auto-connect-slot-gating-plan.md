# Plan: SlotBridge Auto Connect And Slot Assignment Gating

**Generated**: 2026-04-18
**Estimated Complexity**: High

## Overview

This plan covers two linked changes:

1. Add a shared `slot-bridge` readiness path so communication actions can auto-connect a slot when an account is assigned but the slot is still disconnected, then wait for the target to become usable before sending.
2. Update app and room UI gating so controls that trigger slot communication stay enabled for assigned slots and become disabled only when the target slot has no assigned account or identity.
3. Remove duplicated legacy connection checks and local auto-connect helpers once the shared bridge seam is proven by regressions.

The current codebase already shows the desired behavior in one narrow place: AI0 delivery from the assistant page waits for connection, DOM readiness, provider tools, and loading completion before sending. The main gap is that this behavior is not centralized in `slot-bridge`, while many app and room flows already route through `dispatchInternalSlotBridge(...)` or `api.dispatchBridge(...)`.

## Research Summary

Observed communication surfaces that already enter the bridge or an equivalent send path:

- Assistant delivery:
  - `src/js/pages/entrance/webview-panel.ts`
  - `src/js/modules/assistant-delivery.ts`
  - `src/js/pages/assistant/assistant.ts`
- Analyze page:
  - `src/js/pages/analyze.ts`
- Relays:
  - `src/js/modules/relay/ai-ai-relay.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
  - `src/js/modules/relay/us1-assistant-relay.ts`
- Conversation/session refresh:
  - `src/js/modules/conversation-list-manager.ts`
  - `src/js/pages/settings/accounts/us1-panel.ts`
- Forge Room automatic dispatch:
  - `rooms/forge-room/host/forge-preflight-runtime.ts`
  - `rooms/forge-room/host/runtime.ts`
- Game Room automatic AI/US1 dispatch:
  - `rooms/game-room/main-functions/backgammon/host/runtime-match.ts`
  - `rooms/game-room/main-functions/backgammon/host/runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime.ts`
  - `rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts`

Observed readiness and gating problems:

- `src/js/modules/commands/slot-bridge.ts`
  - `message.send` and `message.sendWait` default to `connectPolicy: "never"`.
  - `ensureConnected(...)` can connect only when the envelope already asks for it.
- `src/js/pages/assistant/assistant.ts`
  - `_ensureReadyForDelivery()` already implements an AI0-specific auto-connect and loading wait path.
- `src/js/pages/analyze.ts`
  - send toggles are disabled when a slot is disconnected, not only when unassigned.
- `src/js/app/indicators.ts`
  - conversation select and refresh affordances are disabled when the slot is not connected.
- `rooms/game-room/shared/host/context-state.ts`
  - `ready` is derived from `assigned && connected`, so room hosts and room UI often block before bridge dispatch can try recovery.

## Assumptions

- Unassigned slots must still fail fast and keep their controls disabled.
- We do not need a separate "user-triggered send" policy if the bridge contract is action-based instead.
- Auto-connect should apply to outbound communication actions regardless of who initiated them, but passive polling or mailbox refresh paths still need separate treatment.
- Existing strict behavior must remain available through an explicit opt-out, so legacy or background flows can still require a pre-connected slot.
- US1 keeps its identity-specific checks; "assigned" means bound identity for US1, account assignment for AI slots.

## Prerequisites

- Shared agreement on which bridge actions are allowed to auto-connect.
- Existing bridge regression harness remains the main contract test entry point.
- No room should keep a second transport path outside `SlotBridge` after this change.

## Sprint 1: Bridge Readiness Contract

**Goal**: Centralize assigned-slot recovery in `slot-bridge` without breaking explicit strict callers.
**Demo/Validation**:

- A disconnected but assigned AI slot can receive `message.send` through the bridge after auto-connect.
- An unassigned slot still fails immediately with a targeted error.
- Existing strict callers can still request "require ready" behavior.

### Task 1.1: Freeze The Readiness Matrix

- **Location**:
  - `src/js/modules/commands/slot-bridge.ts`
  - `.rovo/slot-bridge-contract.md`
- **Description**: Document the target-state matrix per action: unassigned, assigned-disconnected, connecting, connected-loading, connected-ready. Decide which actions inherit auto-connect by default and which stay strict unless explicitly requested. The split should be action-based, not caller-based.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - The matrix covers at least `message.send`, `message.sendWait`, protocol-start wrappers, `session.open`, `session.switch`, and `session.sync`.
  - The matrix explicitly states that outbound delivery actions can auto-connect even when fired by relays or room runtimes, while passive sync paths are handled separately.
  - The matrix explicitly notes that `room.command` is inbound/local dispatch and is not itself an outbound auto-connect seam.
  - The matrix explicitly notes that `session.open` and `session.switch` already have partial `ensure` behavior inside `runSessionAction(...)`, so Sprint 1 work there is mostly parity, telemetry, and caller adoption.
- **Validation**:
  - Contract review against existing callers found in the research summary.

### Task 1.2: Add A Shared Target Readiness Helper

- **Location**:
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/commands/slot-bridge-runtime.ts`
  - `src/js/pages/assistant/assistant.ts`
- **Description**: Extract or recreate the AI0 delivery readiness logic as a bridge-owned helper that can:
  - detect missing assignment and fail fast
  - auto-connect assigned slots
  - wait for connection completion
  - wait for loading or traffic readiness before send
  - preserve AI0-specific tool-ready checks where needed
- **Complexity**: 8
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The bridge can prepare AI0, AI1, and AI2 from a disconnected assigned state.
  - AI0 delivery no longer owns the only reliable auto-connect path.
  - Readiness wait timeout and reply wait timeout stay separate concerns.
- **Validation**:
  - New bridge unit tests for assigned-disconnected and assigned-connecting targets.
  - Manual code review against `_ensureReadyForDelivery()` parity.

### Task 1.3: Introduce Explicit Policy Separation

- **Location**:
  - `src/js/modules/commands/slot-bridge.ts`
  - `scripts/tests/slot-bridge-regressions.test.ts`
- **Description**: Introduce or refine a bridge policy so callers can say:
  - auto-connect if assigned
  - require ready now
  - never auto-connect
    Prefer an additive policy over silently changing every existing caller, but make the default for outbound communication actions match the new product decision instead of branching on caller origin.
- **Complexity**: 7
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The default behavior for explicit send-style actions matches the new product requirement.
  - Callers that must stay strict can still opt out.
  - Error codes/messages clearly distinguish "unassigned", "connect failed", and "not ready in time".
- **Validation**:
  - Bridge regression tests for each policy branch.

### Task 1.4: Lock The Bridge Contract With Regressions

- **Location**:
  - `scripts/tests/slot-bridge-regressions.test.ts`
- **Description**: Expand the direct bridge suite with cases for:
  - `message.send` auto-connecting an assigned AI slot
  - `message.sendWait` auto-connecting and then waiting for a reply
  - protocol-driven outbound sends inheriting the same recovery path once they reach the bridge
  - unassigned slot rejection without connection attempts
  - strict opt-out behavior
- **Complexity**: 6
- **Dependencies**: Tasks 1.2-1.3
- **Acceptance Criteria**:
  - The suite fails if a future refactor removes assigned-slot auto-connect.
  - The suite proves no-connect behavior still exists when explicitly requested.
- **Validation**:
  - `node --import tsx --test scripts/tests/slot-bridge-regressions.test.ts`

## Sprint 2: App-Level Caller Adoption

**Goal**: Move app-level communication flows onto the shared readiness seam and relax connected-only gating where the bridge can recover.
**Demo/Validation**:

- Assigned but disconnected slots remain operable from app surfaces that send, sync, or relay through the bridge.
- Controls become disabled only when their required slot has no assigned account or identity.

### Task 2.1: Normalize Assistant Delivery And Provider-Test Delivery

- **Location**:
  - `src/js/modules/assistant-delivery.ts`
  - `src/js/pages/assistant/assistant.ts`
  - `src/js/pages/assistant/connection-ui.ts`
  - `src/js/pages/entrance/webview-panel.ts`
- **Description**: Decide whether assistant delivery should send through `slot-bridge` directly or remain a thin wrapper over the same shared readiness helper. Align AI0 delivery behavior with the new bridge contract and gate the "send to assistant" affordance by assignment instead of live connection.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The entrance webview test delivery path works when AI0 is assigned but currently disconnected.
  - The delivery button stays unavailable only when AI0 has no assigned account.
  - The assistant page test/delivery affordances no longer depend on live connection alone if the bridge can recover.
  - `_ensureReadyForDelivery()` is either removed or reduced to a thin wrapper over the shared bridge readiness seam.
- **Validation**:
  - Existing provider-test presentation tests plus new targeted delivery-state coverage.

### Task 2.2: Adopt Protocol And Starter Paths

- **Location**:
  - `src/js/modules/protocol-handler.ts`
  - `src/js/modules/commands/slot-bridge-runtime.ts`
  - `src/js/app/relay-ui.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/pages/analyze.ts`
- **Description**: Adopt the shared readiness seam in protocol/start surfaces that currently filter disconnected-but-assigned targets before bridge dispatch ever runs. This includes protocol target building, analyze start/stop helpers, top-bar relay starters, and command wrappers that still assume slot readiness up front.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `ProtocolHandler.buildPayload(...)` and adjacent protocol-start wrappers do not silently drop assigned disconnected slots that should now be recoverable.
  - Analyze start/stop, relay start buttons, and AI chat command wrappers can reach the bridge seam for assigned disconnected targets.
  - Passive sync-only helpers still avoid unintended auto-connect churn.
- **Validation**:
  - Add or extend regression coverage for protocol-start and relay-start paths.

### Task 2.3: Relax Analyze Page Target Gating

- **Location**:
  - `src/js/pages/analyze.ts`
- **Description**: Change analyze target toggles and send-button eligibility so assigned targets can be selected even when disconnected. Preserve "no target" and "no content" blocking, but let bridge dispatch handle the recovery path.
- **Complexity**: 5
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `send-ai1`, `send-ai2`, and `send-us1` are disabled only when the slot is unassigned or unbound.
  - Cross-send logic still works and does not silently re-check the old connected-only rule.
  - Sending to an assigned disconnected slot triggers bridge recovery instead of an immediate UI block.
- **Validation**:
  - Add or extend analyze-page regressions for assigned-disconnected targets.

### Task 2.4: Align Relay Startup And Forwarding

- **Location**:
  - `src/js/modules/relay/ai-ai-relay.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
  - `src/js/modules/relay/us1-assistant-relay.ts`
  - `src/js/app/relay-ui.ts`
- **Description**: Remove the hard dependency on "already connected" where relay startup or forwarding can safely rely on bridge recovery. Keep any flows that truly need a live slot strict only if auto-connect would create repeated churn.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Relay startup can proceed for assigned-but-disconnected targets when the bridge contract allows it.
  - Relay forwarding does not silently drop a message only because the slot was disconnected at send time.
  - Duplicate and sync protections stay intact.
  - Redundant direct `AppState.isConnected(...)` hard-fail checks are removed wherever the bridge now owns recovery.
- **Validation**:
  - Relay regression coverage for startup and one forwarded turn from a recovered slot.

### Task 2.5: Split Assigned vs Connected In Shared App Controls

- **Location**:
  - `src/js/app/indicators.ts`
  - `src/js/modules/conversation-list-manager.ts`
  - `src/js/pages/settings/accounts/us1-panel.ts`
- **Description**: Audit controls that still disable on disconnected state and split them into:
  - controls that require only assignment to be clickable
  - controls that should stay strict because they expose passive monitoring or sync-only behavior
    Do not branch on "user-triggered send" semantics; branch on whether the control launches outbound communication or only inspects state.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Manual refresh, session open, or similar communication-adjacent actions can run from an assigned disconnected slot if the bridge supports recovery.
  - Passive background sync does not start auto-connecting slots unexpectedly.
- **Validation**:
  - Conversation and US1 regression coverage for explicit app actions that should remain recoverable.

## Sprint 3: Room Runtime Adoption

**Goal**: Ensure Forge Room and Game Room stop treating "assigned but disconnected" as a hard failure when the bridge can recover.
**Demo/Validation**:

- Forge automated AI dispatch works from assigned disconnected seats.
- Game-room AI turns and room-command transport no longer block solely because a slot started disconnected.

### Task 3.1: Upgrade Forge Room Dispatch Paths

- **Location**:
  - `rooms/forge-room/host/forge-preflight-runtime.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/ui/panels/workbench-stage-panel.ts`
- **Description**: Route Forge preflight, breakdown, task response, and synthesis sends through the new readiness contract. Update UI copy or warnings that currently flatten every disconnected state into "offline" if the slot is actually recoverable.
- **Complexity**: 8
- **Dependencies**: Sprints 1-2
- **Acceptance Criteria**:
  - AI0 preflight can run when AI0 is assigned but disconnected.
  - AI1 and operator seat dispatch can recover from disconnected assigned seats.
  - Forge UI distinguishes unassigned from temporarily disconnected/recoverable.
- **Validation**:
  - `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `scripts/tests/forge-room-ui-smoke-regressions.test.ts`

### Task 3.2: Define Room Recoverable Vs Ready Contract

- **Location**:
  - `rooms/game-room/shared/host/context-state.ts`
  - `rooms/game-room/main-functions/backgammon/host/runtime-sync.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime-sync.ts`
  - `rooms/game-room/main-functions/fate-knots/host/session-participants.ts`
  - `rooms/game-room/main-functions/fate-knots/host/session-runtime.ts`
- **Description**: Decide and document whether existing `ready` keeps its strict meaning or whether room dispatch needs a new `dispatchable` / `recoverable` predicate. Make this contract decision before cleanup so match sync, roster building, and desync protection do not break when connected-only dispatch guards are relaxed.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - The plan stops overloading `ready` for both gameplay state and bridge recoverability.
  - A named contract such as `dispatchable` / `recoverable` exists before legacy guard cleanup begins.
  - Sync, roster, and desync paths that must remain strict are explicitly separated from outbound dispatch paths that can recover.
- **Validation**:
  - Targeted game-room host/runtime regression updates prove the new contract does not regress sync or participant state.

### Task 3.3: Remove Connected-Only Room Readiness Blocks

- **Location**:
  - `rooms/game-room/shared/host/context-state.ts`
  - `rooms/game-room/main-functions/backgammon/host/runtime-match.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime.ts`
  - `rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts`
- **Description**: Replace room-host "ready means assigned and connected" blocking where it prevents the bridge from trying recovery. The room should still block when a slot is truly unassigned, but it should not fail early for a recoverable assigned-disconnected target.
- **Complexity**: 9
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Backgammon can start or continue an AI turn when the opponent slot is assigned but disconnected.
  - Team Tetris and Fate Knots no longer mark the match blocked before the bridge gets a recovery attempt.
  - Host status still surfaces a meaningful failure if recovery times out.
- **Validation**:
  - `scripts/tests/game-room-backgammon-host-regressions.test.ts`
  - target Team Tetris and Fate Knots host/runtime suites already listed in `package.json`

### Task 3.4: Relax Room UI Start-State Gating

- **Location**:
  - `rooms/game-room/main-functions/backgammon/ui/render-runtime.ts`
  - `rooms/game-room/main-functions/backgammon/ui/state-runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`
  - related Fate Knots UI state files if their affordances still mirror connected-only readiness
- **Description**: Change room UI affordances so "assigned but disconnected" is displayed as recoverable rather than hard-disabled when the next action goes through the bridge.
- **Complexity**: 7
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Start buttons and relevant room action buttons disable only for truly missing participants.
  - UI status text still communicates disconnected vs ready vs empty.
  - Room UI does not promise availability for seats that are entirely unassigned.
- **Validation**:
  - Game-room UI regression suites for Backgammon and Team Tetris.

## Sprint 4: Verification, Telemetry, And Rollout Safety

**Goal**: Make the new behavior observable and safe to ship.
**Demo/Validation**:

- Logs clearly show when a bridge action auto-connected a slot, how long readiness waited, and why failures happened.
- The main app and room regression suites cover the new semantics.

### Task 4.1: Remove Legacy Readiness And Connection Guards

- **Location**:
  - `src/js/pages/assistant/assistant.ts`
  - `src/js/modules/relay/ai-ai-relay.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
  - `src/js/modules/relay/us1-assistant-relay.ts`
  - `rooms/game-room/shared/host/context-state.ts`
  - `rooms/game-room/main-functions/backgammon/host/runtime-sync.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime-sync.ts`
  - `rooms/game-room/main-functions/fate-knots/host/session-participants.ts`
  - `rooms/game-room/main-functions/fate-knots/host/session-runtime.ts`
  - any remaining app or room callers that still own private auto-connect logic
- **Description**: After the bridge seam is stable, delete duplicated local readiness code and direct connected-only prechecks that are now redundant. Keep only the checks that represent true "unassigned" or transport-unavailable failures.
- **Complexity**: 6
- **Dependencies**: Sprints 1-3, especially Task 3.2
- **Acceptance Criteria**:
  - There is one canonical auto-connect and readiness path for bridge-owned communication.
  - Assistant, relay, and room callers no longer maintain separate recovery logic that can drift from the bridge.
  - Cleanup does not remove strict sync/roster/desync checks that still belong to the room-side `ready` contract.
  - Remaining direct connection guards are intentional and documented.
- **Validation**:
  - Grep audit for stale helpers and duplicate guard patterns.
  - Targeted regression runs after each cleanup batch.

### Task 4.2: Add Readiness Telemetry

- **Location**:
  - `src/js/modules/commands/slot-bridge.ts`
  - any shared logging helpers touched by the bridge
- **Description**: Add structured logs around assignment checks, auto-connect attempts, readiness wait duration, and timeout/failure reasons.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - A failed send can be diagnosed as missing account, connect failure, readiness timeout, or downstream send failure.
  - Logs make it obvious when auto-connect happened.
- **Validation**:
  - Targeted unit coverage where practical plus manual log inspection.

### Task 4.3: Run Focused Regression Packs

- **Location**:
  - `scripts/tests/slot-bridge-regressions.test.ts`
  - `scripts/tests/forge-room-*.test.ts`
  - `scripts/tests/game-room-*.test.ts`
- **Description**: Run the most relevant bridge, Forge, and game-room suites first, then the room core pack if the targeted suites pass.
- **Complexity**: 3
- **Dependencies**: Sprints 1-3
- **Acceptance Criteria**:
  - The bridge suite passes.
  - Forge host/UI paths covering AI dispatch pass.
  - Game-room paths that dispatch AI or US1 commands pass.
- **Validation**:
  - `node --import tsx --test scripts/tests/slot-bridge-regressions.test.ts`
  - targeted Forge and game-room test commands
  - `npm run rooms:test:core` if targeted runs stay green

### Task 4.4: Manual Smoke Checklist

- **Location**:
  - `.rovo/slot-bridge-smoke-checklist.md`
  - new or updated smoke notes if needed
- **Description**: Extend smoke steps to cover:
  - assigned disconnected AI0 delivery
  - Forge auto-connect on preflight and task dispatch
  - analyze send to assigned disconnected AI slot
  - one game-room feature recovering a disconnected AI seat
- **Complexity**: 3
- **Dependencies**: Sprints 2-3
- **Acceptance Criteria**:
  - The checklist explicitly distinguishes unassigned vs assigned-disconnected cases.
  - The checklist names expected loading, waiting, and failure messages.
- **Validation**:
  - Manual smoke on a live app session.

## Testing Strategy

- Start with direct bridge contract tests before touching room or UI logic.
- Add caller-level regressions only after the bridge helper stabilizes.
- Treat Forge and game-room suites as separate adoption checkpoints because they currently encode connected-only assumptions in different ways.
- Preserve one explicit "strict/no auto-connect" test path to prevent unwanted global behavior changes.

## Potential Risks & Gotchas

- The assistant page already has a richer AI0 readiness model than generic slots. If that logic is copied instead of centralized, behavior will drift again.
- If protocol/start wrappers keep their old connected-only filtering, assigned disconnected slots will still be dropped before the bridge seam can recover them.
- Background sync loops, especially US1 polling, must not start auto-connecting slots endlessly. The safe split is action-based, not "user-triggered vs system-triggered".
- Game-room `ready` currently means more than "assigned". Host and UI changes must avoid breaking turn validation or seat availability messaging.
- Forge UI currently renders localized "AI0 is offline" summaries. If the host becomes recoverable, those strings can become misleading unless the preflight state model is updated too.
- `message.sendWait` will now have two wait phases: readiness wait and reply wait. Each phase needs separate timeout reporting.
- If relay startup begins auto-connecting both ends, duplicate startup attempts and disconnect auto-stop logic need regression coverage.
- If legacy guards are deleted before the bridge regressions are authoritative, it will be hard to tell whether a failure belongs to the new seam or to the cleanup batch.

## Rollback Plan

- Revert the bridge readiness helper and restore strict connected-only behavior.
- Restore room host checks that require `ready === true` before dispatch.
- Re-enable connected-only UI gating for affected app and room controls if the new flow causes churn or unexpected reconnects.
- Reintroduce selected legacy wrappers temporarily if a cleanup batch removes a caller-specific invariant that the bridge does not yet model.
- Keep the bridge policy flagging strategy additive so strict callers can remain on the old path during rollback.
