# Plan: SlotBridge Unified Send And Protocol Retirement

> Historical transition note:
> This document is superseded by [`.rovo/slot-bridge-single-authority-plan.md`](./slot-bridge-single-authority-plan.md) and [`.rovo/slot-bridge-contract.md`](./slot-bridge-contract.md).
> Any statements below about temporary wrapper compatibility, short-lived adapters for retired actions, or live parallel protocol-send surfaces should be read as historical migration context only.
> Current state: protocol delivery is bridge-backed, legacy wrappers are removed, and retired attachment actions are rejected at runtime.

**Generated**: 2026-03-31
**Estimated Complexity**: High

## Overview

The goal is to collapse the current parallel outbound pipelines into one canonical public surface:

- `++cmd:SlotBridge({...})`

After this migration, protocol delivery is no longer a separate send system. Protocols become optional composition input to the existing send action family, so the same send path can carry:

- plain text
- text plus attachments
- attachments only
- protocol only
- protocol plus extra text
- protocol plus text plus attachments
- single-target and multi-target sends

The key design choice is to keep one public command surface without introducing a second `protocol.send` action family. Instead, `SlotBridge` `message.send` and `message.sendWait` gain the missing capabilities. Internally, the app should use structured handler calls and adapters, not nested raw command-string reparsing. The raw `++cmd` syntax remains the user-facing and AI-facing wire format, but internal runtime code should not bounce generated command strings back through the parser.

This plan removes the parallel protocol send pipeline, but it does **not** remove protocol authoring or storage. Room protocol specs, `protocols.json`, the archives protocol editor, and runtime room protocol overrides remain valid; only the dedicated delivery path is retired.

## Guiding Decisions

- Canonical outbound command remains `SlotBridge`.
- Canonical send actions after cleanup are `message.send` and `message.sendWait`.
- `message.sendWithAttachments` and `file.send` should become short-lived adapters, then be removed once callers are migrated.
- Protocol composition is expressed as extra payload inside `message.send` and `message.sendWait`, not as a new action family.
- `room.command`, `connection.ensure`, and `session.*` stay as separate `SlotBridge` actions.
- Multi-target send is supported for `message.send`; `message.sendWait` remains single-target only.
- `payload.protocol` must support both `room/scenario` resolution and direct `protocolKey` resolution so app-owned relay flows can migrate cleanly.
- Relay/session side effects move out of the old protocol send helper and become explicit caller behavior or explicit bridge-side helper behavior, not hidden inside protocol resolution.
- Rooms should stop using `api.sendProtocol`, `api.sendMessage`, and `api.sendToTargets` for app-bound communication and use a single SlotBridge-shaped helper instead.
- `us1` is part of the unification scope. If its transport constraints differ, the difference must live behind the same `message.send` contract rather than survive as a second app-bound send system.

## Current State Snapshot

- `SlotBridge` already centralizes `message.send`, `message.sendWait`, `message.sendWithAttachments`, `file.send`, `connection.ensure`, `session.open`, `session.switch`, and `room.command` in `src/js/modules/commands/slot-bridge.ts`.
- `message.sendWait` already knows how to sync, read archive-backed replies, and return attachments.
- `SlotBridge` message actions are not currently available to `us1`; only `room.command` and `session.switch` are exposed there, so `us1` needs an explicit migration task instead of an implicit assumption.
- Protocol sending still goes through a separate pipeline:
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/protocol-handler.ts`
  - `src/js/modules/protocol-message-composer.ts`
  - `src/js/modules/core-engine.ts`
- Room hosts still split protocol send and message send in the Game Room features:
  - `rooms/game-room/main-functions/backgammon/host/runtime-match.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime.ts`
  - `rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts`
- App-owned callers still invoke `CoreEngine.sendProtocol(...)` from:
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/app/relay-ui.ts`
  - `src/js/pages/analyze.ts`
  - `src/js/pages/server.ts`
  - `src/js/modules/core/runtime-actions.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`

## Assumptions

- `SlotBridge` remains the public command name.
- Protocol metadata still comes from room manifests, runtime room overrides, app-owned protocol defaults, and `protocols.json`.
- Existing room protocol specs and the archives protocol editor are worth preserving.
- A single branch can carry the migration if adapters are used in the middle phase and removed only after tests and smoke checks pass.
- Existing external user habits around `AIAssistantSend`, `AssistantAISend`, `AIAIChatStart`, and similar commands may still require compatibility wrappers during the transition.

## Prerequisites

- Contract and help surfaces:
  - `docs/slot-bridge-contract.md`
  - `src/js/modules/commands/command-descriptions.ts`
  - `src/js/pages/server-command-utils.ts`
- Current SlotBridge runtime:
  - `src/types/commands.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/server-commands.ts`
- Current transport-specific send surfaces:
  - `src/types/us1-mail.ts`
  - `electron/us1-conversation-service.ts`
  - `src/js/modules/rooms/room-host-runtime.ts`
- Current protocol resolution/storage path:
  - `src/js/modules/protocol-handler.ts`
  - `src/js/modules/protocol-message-composer.ts`
  - `src/js/modules/rooms/room-protocol-registry.ts`
  - `electron/file-manager.ts`
  - `src/js/pages/archives/protocol-editor.ts`
- Current legacy send entry points:
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/app/relay-ui.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
- Room host/runtime surfaces:
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `rooms/game-room/main-functions/**/*`
  - `data/rooms/game-room/main-functions/**/*`
- Validation surfaces:
  - `scripts/tests/slot-bridge-regressions.test.ts`
  - `scripts/tests/protocol-message-composer-regressions.test.ts`
  - `scripts/tests/protocol-handler-stop-regressions.test.ts`
  - `scripts/tests/room-protocol-registry-regressions.test.ts`
  - `scripts/tests/protocol-storage-regressions.test.ts`
  - `scripts/tests/archives-protocol-editor-regressions.test.ts`
  - `scripts/tests/relay-auto-stop-disconnect-regressions.test.ts`
  - `scripts/tests/server-command-panel-regressions.test.ts`
  - `npm run rooms:build`
  - `npm run rooms:test:core`
  - `npm run typecheck`

## Sprint 1: Freeze The Unified Send Contract

**Goal**: Define the final command contract before code moves so the migration stays aggressive without rework.
**Demo/Validation**:

- The contract doc clearly states that `message.send` and `message.sendWait` are the only canonical send actions.
- A single payload shape can represent protocol composition, attachments, files, images, and multi-target sends.
- The removal list for legacy send APIs is explicit.

### Task 1.1: Define the canonical send envelope extensions

- **Location**:
  - `docs/slot-bridge-contract.md`
  - `src/types/commands.ts`
- **Description**: Extend the current SlotBridge envelope so `message.send` and `message.sendWait` can support:
  - `toSlot` or `toSlots`
  - attachments on both message actions
  - protocol composition metadata inside `payload`
  - text placement rules such as protocol before text, protocol after text, or protocol-only
- **Complexity**: 6/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - The contract explicitly supports text-only, attachment-only, protocol-only, and mixed sends.
  - `message.sendWait` is documented as single-target only.
  - The contract explains how reply capture and attachments work after protocol-composed sends.
- **Validation**:
  - Review the resulting contract against every current `sendProtocol(...)` and `sendMessage(...)` caller.

### Task 1.2: Freeze the protocol composition payload model

- **Location**:
  - `docs/slot-bridge-contract.md`
  - New resolver module under `src/js/modules/`
- **Description**: Define the shape of `payload.protocol`, including the minimum fields needed to replace `sendProtocol(...)`, such as:
  - `room`
  - `scenario`
  - `protocolKey`
  - `preface`
  - `context`
  - `fallbackTitle` or equivalent override when needed
  - `textPosition` or equivalent merge rule
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The payload can reproduce current room, analyze, and server protocol sends.
  - The contract does not require a second public action family.
  - Merge behavior is deterministic and documented.
- **Validation**:
  - Map `backgammon`, `team-tetris`, `fate-knots`, `analyze`, and `server/takecontrol` cases onto the new payload shape.

### Task 1.5: Freeze `us1` parity rules for the unified send model

- **Location**:
  - `docs/slot-bridge-contract.md`
  - `src/types/commands.ts`
  - `src/types/us1-mail.ts`
  - `electron/us1-conversation-service.ts`
- **Description**: Define how `message.send` behaves for `us1` under the same public contract. This includes whether `us1` supports:
  - text-only sends
  - protocol-composed sends
  - attachments
  - wait mode
  - session targeting
- **Complexity**: 7/10
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - `us1` is either fully represented in the contract or explicitly constrained with documented unsupported combinations.
  - The public bridge contract stays the same across AI slots and `us1`, with provider-specific limits handled internally.
  - No parallel app-bound `us1` send path is left undocumented.
- **Validation**:
  - Review the contract against the current `us1` conversation service and room-host mail helpers.

### Task 1.3: Decide the adapter and deletion matrix

- **Location**:
  - `docs/slot-bridge-contract.md`
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/rooms/room-host-runtime.ts`
- **Description**: Freeze which legacy entry points become adapters first and which are removed after migration. Minimum list:
  - `CoreEngine.sendProtocol`
  - `sendProtocolWithContext`
  - `RoomHostApi.sendProtocol`
  - `RoomHostApi.sendMessage`
  - `RoomHostApi.sendToTargets`
  - `message.sendWithAttachments`
  - `file.send`
- **Complexity**: 4/10
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - Every legacy entry point has a clear status: keep, adapt, or delete.
  - The plan states which user-visible wrappers remain temporarily.
  - No hidden parallel send path survives by accident.
- **Validation**:
  - Review all `sendProtocol(` and room-host send helper call sites against the migration list.

### Task 1.4: Freeze the room communication boundary

- **Location**:
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `rooms/game-room/main-functions/**/*`
- **Description**: Decide the one room-facing API that replaces `sendProtocol`, `sendMessage`, and `sendToTargets`. The recommended boundary is a structured bridge helper that mirrors `++cmd:SlotBridge({...})` without re-stringifying raw nested commands.
- **Complexity**: 6/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Room host code has one app-bound communication primitive.
  - The primitive is explicitly SlotBridge-shaped.
  - The plan states that rooms should not keep separate protocol send helpers.
- **Validation**:
  - Confirm the helper can cover the existing Game Room message and protocol cases.

## Sprint 2: Build The Unified SlotBridge Send Runtime

**Goal**: Make `message.send` and `message.sendWait` powerful enough that legacy protocol delivery becomes a thin adapter.
**Demo/Validation**:

- `SlotBridge` can send a protocol-composed message without touching the old protocol send pipeline directly.
- `message.send` can target one or many slots and include attachments.
- `message.sendWait` still returns archived reply text and attachments.

### Task 2.1: Extend SlotBridge types and normalization

- **Location**:
  - `src/types/commands.ts`
  - `src/js/modules/commands/slot-bridge.ts`
- **Description**: Add envelope and payload support for:
  - multi-target send
  - attachments on all message actions
  - optional protocol composition metadata
  - validation rules for single-target wait
- **Complexity**: 7/10
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - The normalized envelope can express every existing protocol send shape.
  - `message.send` accepts attachments without forcing `message.sendWithAttachments`.
  - Invalid combinations fail early with clear error codes.
- **Validation**:
  - Expand `scripts/tests/slot-bridge-regressions.test.ts` with contract-level cases.

### Task 2.2: Replace the protocol send helper with a pure resolver/composer boundary

- **Location**:
  - New module such as `src/js/modules/protocol-resolution.ts`
  - `src/js/modules/protocol-handler.ts`
  - `src/js/modules/protocol-message-composer.ts`
  - `src/js/modules/rooms/room-protocol-registry.ts`
- **Description**: Extract the useful parts of the current protocol path into a pure resolver that turns room/app protocol metadata plus optional preface into composed text for SlotBridge. The resolver should handle:
  - room manifest protocols
  - runtime room protocol overrides
  - app-owned analyze and server protocol scenarios
  - stored protocol bodies from `protocols.json`
- **Complexity**: 8/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Protocol composition becomes reusable from SlotBridge and adapters.
  - Hidden relay start/stop side effects are not buried inside the resolver.
  - Room and app-owned protocols resolve through one predictable boundary.
- **Validation**:
  - Update or replace `protocol-message-composer` and `protocol-handler` regressions with the new resolver behavior.

### Task 2.3: Rework `runMessageAction` into the canonical outbound dispatcher

- **Location**:
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/core/send-actions.ts`
- **Description**: Update `runMessageAction` so it can:
  - resolve and merge protocol text before send
  - send to one or many targets
  - send text-only, attachment-only, and mixed payloads
  - preserve current request-marker and reply-wait behavior
- **Complexity**: 8/10
- **Dependencies**: Task 2.1, Task 2.2
- **Acceptance Criteria**:
  - One path owns all slot-bound message delivery.
  - Multi-target protocol sends use the same send runtime as plain batch messages.
  - Wait mode still uses archive-backed reply capture and reply-forwarding where applicable.
- **Validation**:
  - Add regressions for protocol-only, protocol-plus-text, and attachment-plus-protocol sends.

### Task 2.4: Add short-lived compatibility adapters

- **Location**:
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/commands/slot-bridge.ts`
- **Description**: Convert old entry points into adapters that build canonical SlotBridge payloads and call the structured runtime. Adapters should exist only to keep migration incremental:
  - `CoreEngine.sendProtocol`
  - `message.sendWithAttachments`
  - `file.send`
- **Complexity**: 6/10
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Legacy callers reach the same underlying send runtime.
  - Adapter telemetry or logging makes stragglers visible.
  - No caller still needs the old protocol helper behavior directly.
- **Validation**:
  - Trace adapter calls in targeted tests or logs during migration.

### Task 2.5: Add unified-send provider adapters for `us1`

- **Location**:
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `electron/us1-conversation-service.ts`
  - `src/types/us1-mail.ts`
- **Description**: Add the provider-specific adapter layer needed for `SlotBridge` `message.send` to reach `us1` while keeping the public envelope identical. This task should decide and implement how protocol-composed text and optional attachments are mapped onto the existing `us1` transport.
- **Complexity**: 8/10
- **Dependencies**: Task 2.3, Task 1.5
- **Acceptance Criteria**:
  - `message.send` can target `us1` through the unified bridge path.
  - Provider-specific `us1` constraints are enforced by validation, not by a parallel command surface.
  - Room and app-owned callers do not need a second public send primitive for `us1`.
- **Validation**:
  - Add targeted `us1` bridge tests or transport-adapter tests before caller migration.

## Sprint 3: Migrate App-Owned Callers And Relay Flows

**Goal**: Move app-level callers off the parallel protocol API before touching rooms aggressively.
**Demo/Validation**:

- Analyze, relay UI, and server actions use SlotBridge-shaped sends.
- Relay/session side effects still behave correctly after protocol send removal.

### Task 3.1: Migrate app command and page callers

- **Location**:
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/app/relay-ui.ts`
  - `src/js/pages/analyze.ts`
  - `src/js/pages/server.ts`
- **Description**: Replace direct `CoreEngine.sendProtocol(...)` usage with SlotBridge `message.send` calls that carry protocol metadata in payload. Keep top-level user-facing commands where helpful, but make them wrappers over the unified send path.
- **Complexity**: 7/10
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - No app page or command sends protocols through the old dedicated send API.
  - Analyze and server control flows still deliver the same text.
  - Legacy user-facing command names keep working if they are intentionally retained.
- **Validation**:
  - Targeted checks for analyze start/stop and server take-control flows.

### Task 3.2: Make relay lifecycle behavior explicit

- **Location**:
  - `src/js/modules/core/runtime-actions.ts`
  - `src/js/modules/relay/ai-assistant-relay.ts`
  - `src/js/modules/relay/ai-ai-relay.ts`
  - `src/js/modules/relay-manager.ts`
- **Description**: Untangle relay/session lifecycle control from the old protocol send helper. The protocol message should now be sent through SlotBridge, while relay start/stop behavior is triggered explicitly by the caller or a clearly named helper.
- **Complexity**: 8/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - AI-AI start/stop still respects starter order and disconnect auto-stop behavior.
  - AI-assistant relay start still sends the initial protocol through the unified send path.
  - Relay stop logic no longer depends on hidden behavior in `sendProtocolWithContext`.
- **Validation**:
  - Rework and run relay-specific regressions, especially disconnect auto-stop scenarios.

### Task 3.3: Align help, examples, and action descriptions

- **Location**:
  - `docs/slot-bridge-contract.md`
  - `src/js/modules/commands/command-descriptions.ts`
  - `src/js/pages/server-command-utils.ts`
  - `src/js/modules/server-commands.ts`
- **Description**: Update command descriptions, examples, and any panel help so they describe the new unified send model instead of separate protocol/file send behavior.
- **Complexity**: 4/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The documented command surface matches the real runtime.
  - Deprecated actions are marked clearly during the transition.
  - Examples show protocol composition through `message.send`.
- **Validation**:
  - Update help/copy regressions if they exist and manually review the server command panel behavior.

## Sprint 4: Migrate Room Host APIs And Room Implementations

**Goal**: Make rooms speak to the app through one SlotBridge-shaped path and remove split protocol/message dispatch.
**Demo/Validation**:

- Game Room features send one combined first message where needed.
- Room host code no longer keeps separate app-bound protocol and message helpers.

### Task 4.1: Replace room host send APIs with one bridge helper

- **Location**:
  - `src/js/modules/rooms/room-host-runtime.ts`
- **Description**: Introduce the single room-facing SlotBridge helper and deprecate the app-bound direct send methods:
  - `sendProtocol`
  - `sendMessage`
  - `sendToTargets`
    The replacement should accept structured SlotBridge envelopes or a thin typed helper around them.
- **Complexity**: 7/10
- **Dependencies**: Sprint 3 complete
- **Acceptance Criteria**:
  - Room hosts have one app-bound send primitive.
  - Existing `room.command` dispatch remains intact.
  - The helper is reusable for slot sends with or without protocol composition.
- **Validation**:
  - Verify host runtime still loads and room command dispatch continues to work.

### Task 4.2: Migrate Game Room feature sources to single-send flows

- **Location**:
  - `rooms/game-room/main-functions/backgammon/host/runtime-match.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime.ts`
  - `rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts`
- **Description**: Replace `sendProtocolSafe(...)` plus `sendMessageSafe(...)` pairs with one SlotBridge-based send helper. The first-turn and prompt flows should send protocol content and game/prompt text as a single outbound message.
- **Complexity**: 8/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Backgammon user-start and AI-start both send one first message containing protocol plus board state.
  - Team Tetris prompt dispatch uses one send path.
  - Fate Knots protocol-plus-prompt flows are single-send and no longer split.
- **Validation**:
  - Add or update feature-level targeted tests and smoke steps for each room flow.

### Task 4.3: Regenerate room artifacts and keep parity

- **Location**:
  - `data/rooms/game-room/main-functions/**/*`
  - `data/room-storage/game-room/build/workspace/**/*`
  - build scripts under `scripts/rooms/`
- **Description**: Regenerate the mirrored room artifacts after source migration so workspace, packaged copies, and installed-runtime parity stay aligned. `rooms/` remains the source of truth; generated `data/` outputs should be refreshed by build flow, not hand-migrated as peer sources.
- **Complexity**: 6/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Generated room files reflect the new single-send flow.
  - Room parity regressions do not drift between source and built workspace.
  - No stale built artifact still uses the old split send helpers.
- **Validation**:
  - Run `npm run rooms:build` and the relevant installed/workspace room smoke regressions.

## Sprint 5: Remove The Parallel Protocol Delivery System

**Goal**: Delete the old protocol send path once all callers have moved.
**Demo/Validation**:

- There is no second app-bound protocol delivery system left.
- Protocol storage/editor behavior still works through the new resolver/composer boundary.

### Task 5.1: Remove old protocol send entry points

- **Location**:
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/core-engine.ts`
  - `src/js/modules/protocol-handler.ts`
- **Description**: Delete or reduce the legacy protocol send helpers after all callers route through SlotBridge. Keep only the parts that still belong in pure resolution/composition modules.
- **Complexity**: 7/10
- **Dependencies**: Sprint 4 complete
- **Acceptance Criteria**:
  - `sendProtocolWithContext` is gone.
  - `CoreEngine.sendProtocol` is gone or reduced to an intentionally temporary wrapper with a removal date.
  - `ProtocolHandler` no longer acts as a parallel send pipeline.
- **Validation**:
  - Search for remaining `sendProtocol(` call sites and verify they are intentional or removed.

### Task 5.2: Collapse extra send actions into the canonical pair

- **Location**:
  - `src/types/commands.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/server-commands.ts`
  - `docs/slot-bridge-contract.md`
- **Description**: Remove or hard-deprecate `message.sendWithAttachments` and `file.send` once every caller uses `message.send` or `message.sendWait`.
- **Complexity**: 6/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - The public send surface is simplified to the canonical pair.
  - Any temporary alias behavior is intentional and documented.
  - Slot disable rules and command descriptions are updated for removed actions.
- **Validation**:
  - Update SlotBridge action regressions and command catalog checks.

### Task 5.3: Prune room and adapter leftovers

- **Location**:
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `rooms/game-room/main-functions/**/*`
  - `data/rooms/game-room/main-functions/**/*`
- **Description**: Remove deprecated room-host send helpers, split-send helper functions, and any migration shims that survived the earlier sprints.
- **Complexity**: 5/10
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - Room sources do not retain old `sendProtocolSafe` or parallel send helpers.
  - Host API surface is smaller and easier to reason about.
  - No duplicated protocol/message logic remains in rooms.
- **Validation**:
  - Search for deprecated helper names and confirm zero remaining uses.

## Sprint 6: Verification, Smoke Coverage, And Rollback Guard

**Goal**: Prove the aggressive cleanup did not break room flows, relay flows, or archive-backed reply behavior.
**Demo/Validation**:

- Automated regressions pass.
- Manual smoke scenarios confirm protocol-plus-message composition works in the UI.
- Rollback points are clear if a late regression appears.

### Task 6.1: Update and run targeted regressions

- **Location**:
  - `scripts/tests/slot-bridge-regressions.test.ts`
  - `scripts/tests/protocol-message-composer-regressions.test.ts`
  - `scripts/tests/protocol-handler-stop-regressions.test.ts`
  - `scripts/tests/room-protocol-registry-regressions.test.ts`
  - `scripts/tests/protocol-storage-regressions.test.ts`
  - `scripts/tests/archives-protocol-editor-regressions.test.ts`
  - `scripts/tests/relay-auto-stop-disconnect-regressions.test.ts`
  - `scripts/tests/server-command-panel-regressions.test.ts`
- **Description**: Refresh the regression suite so it tests the new unified send model instead of the deleted protocol send path.
- **Complexity**: 7/10
- **Dependencies**: Sprint 5 complete
- **Acceptance Criteria**:
  - SlotBridge tests cover protocol composition, attachments, and multi-target send.
  - Protocol-specific tests cover resolution/composition, not the removed send helper.
  - Relay stop/start tests still pass with the new lifecycle boundary.
- **Validation**:
  - Run the targeted node test files plus `npm run rooms:test:core`.

### Task 6.2: Run cross-feature smoke scenarios

- **Location**:
  - `docs/slot-bridge-smoke-checklist.md`
  - live app session
- **Description**: Expand the smoke checklist and execute at least these scenarios:
  - Backgammon user starts
  - Backgammon AI starts
  - Team Tetris prompt dispatch
  - Fate Knots prompt dispatch
  - Analyze start and stop
  - AI-assistant relay start and stop
  - attachment-only send
  - protocol-plus-attachment send
  - installed Game Room parity smoke for built workspace artifacts
- **Complexity**: 6/10
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
  - The first room message is single-send where intended.
  - Relay and analyze controls still behave correctly.
  - Attachments and generated images still move through the archive-backed path.
- **Validation**:
  - Record smoke outcomes in the checklist doc or a follow-up status note.

### Task 6.3: Finish with strict workspace verification

- **Location**:
  - repo root scripts
- **Description**: Run the broad validation passes needed for an aggressive cleanup branch and compare against the old behavior.
- **Complexity**: 5/10
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - TypeScript, room build, and room core regressions all pass.
  - Any retained compatibility wrapper is intentional and documented.
  - There is a short residual-risk note for anything not smoke-tested live.
- **Validation**:
  - `npm run typecheck`
  - `npm run rooms:build`
  - `npm run rooms:test:core`

### Task 6.4: Enforce source-of-truth discipline for room artifacts

- **Location**:
  - `rooms/**/*`
  - generated outputs under `data/rooms/` and `data/room-storage/`
- **Description**: Confirm the migration is authored in `rooms/` only and that `data/rooms/` plus `data/room-storage/` are regenerated outputs, not hand-migrated peers. Update the plan/status notes if any generated output still requires manual intervention so the drift is visible.
- **Complexity**: 4/10
- **Dependencies**: Task 4.3, Task 6.3
- **Acceptance Criteria**:
  - `rooms/` is documented as the source of truth for room logic changes.
  - Generated copies are refreshed by build flow, not by duplicated manual edits unless a documented exception exists.
  - Any parity gap is called out explicitly before the branch is considered complete.
- **Validation**:
  - Diff generated room outputs after `npm run rooms:build` and confirm no hand-edited drift remains.

## Testing Strategy

- Add regression coverage at the SlotBridge contract level before deleting the old protocol send path.
- Treat protocol resolution and protocol delivery as separate test surfaces:
  - resolver/composer tests for room/app protocol text assembly
  - SlotBridge send tests for delivery, attachments, wait mode, and multi-target behavior
- Re-run room build and room core regressions after Game Room migration because source and built artifacts both matter here.
- Preserve a smoke matrix for the user-visible turn-based flows, especially Backgammon first-turn behavior in both starter modes.
- Keep relay auto-stop tests close to the runtime lifecycle changes because those behaviors were previously hidden in the protocol send helper.

## Potential Risks & Gotchas

- The user wants one send system, but protocol **content** is still a separate concern from message **delivery**. Over-cleaning the storage/editor side would be the wrong simplification.
- Multi-target sends and wait mode do not mix cleanly. The runtime should reject that combination instead of guessing.
- `protocolKey` support is required for AI-assistant relay start and any future app-owned protocol that is not best expressed as `room/scenario`.
- `AIAIChatStart` and AI-assistant relay start currently rely on protocol send side effects. Those must become explicit before the old helper is deleted.
- `us1` transport may not match AI-slot semantics for attachments or wait mode exactly. Those differences must be validated behind the unified bridge contract, not leaked as a second public send path.
- Game Room code exists in source and mirrored build/workspace copies. Migrating only `rooms/` or only `data/rooms/` will leave the repo in a half-converted state.
- Room migration edits should originate in `rooms/`; generated `data/` copies should be refreshed by build steps rather than maintained as equal hand-edit sources.
- `message.sendWithAttachments` and `file.send` may appear in slot-level disabled-command settings or docs. Removing them needs a compatibility decision, not just a type edit.
- AI-authored attachment payloads still must not gain arbitrary filesystem access during the cleanup.
- The archives protocol editor and runtime protocol overrides depend on protocol keys staying stable even if the delivery path changes.

## Rollback Plan

- Land the migration in phases so the branch can stop after adapters if verification finds issues.
- Keep temporary adapters until the new unified send path is proven by regressions and smoke checks.
- If relay behavior regresses, restore wrappers around the unified send runtime first; do not resurrect the full old protocol send pipeline unless absolutely necessary.
- If room parity drifts, revert the room migration commit(s), regenerate artifacts, and keep the app-side unification work isolated.
- If attachment or reply-wait behavior regresses, revert the `runMessageAction` expansion while keeping the pure protocol resolver improvements.
