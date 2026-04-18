# Plan: Slot Bridge Command Family And Room Command Migration

> Historical transition note:
> This document is superseded by [`.rovo/slot-bridge-single-authority-plan.md`](./slot-bridge-single-authority-plan.md) and [`.rovo/slot-bridge-contract.md`](./slot-bridge-contract.md).
> Any statements below about keeping `AIAssistantSend` / `AssistantAISend` wrappers, legacy-adapter telemetry, or temporary acceptance of retired actions are obsolete.
> Current state: wrappers are removed, `message.sendWithAttachments` and `file.send` hard-fail at the bridge boundary, and SlotBridge is the only supported public entrypoint.

**Generated**: 2026-03-31
**Last Verified**: 2026-03-31
**Estimated Complexity**: High
**Current Status**: Source-workspace implementation is in place and verified; manual smoke execution and built/installed room artifact verification remain open.

## Verification Update
Verification on 2026-03-31 confirmed that the unexpected review-agent additions are real, repo-aligned artifacts rather than hallucinated output:
- Contract doc: `.rovo/slot-bridge-contract.md`
- Manual smoke checklist: `.rovo/slot-bridge-smoke-checklist.md`
- Direct bridge regression suite: `scripts/tests/slot-bridge-regressions.test.ts`

The verification pass also confirmed these implementation points in source:
- `SlotBridge` is the single public command surface with the planned action family.
- Game Room command specs stay internal via manifest exposure metadata.
- Room UI and US1 room-command flows dispatch through `action: "room.command"`.
- `message.sendWait` uses the full-sync/archive-backed reply path and returns normalized attachments, including images.
- Public file-bearing actions support `attachment-ref` archive references and reject raw AI-authored filesystem paths.
- Retired assistant wrappers no longer exist as callable surfaces.

## Sprint Status Snapshot
- Sprint 1: Completed
- Sprint 2: Completed
- Sprint 3: Completed
- Sprint 4: Completed
- Sprint 5: Completed
- Sprint 6: Code, docs, and regression coverage completed; manual smoke execution remains pending.

## Validation Snapshot
- Targeted regressions: `73/73` pass
- Direct SlotBridge regressions: `4/4` pass
- `npm run typecheck`: pass
- Targeted lint: `0` errors
- Residual lint warnings: `5` intentional `no-await-in-loop` warnings in `src/js/modules/commands/slot-bridge.ts` polling loops

## Remaining Follow-Ups
- Execute `.rovo/slot-bridge-smoke-checklist.md` against a live app session.
- Verify Game Room behavior against built or installed room artifacts, not only workspace source and targeted tests.
- Treat wrapper-removal notes below as historical migration context only.

## Overview
Unify the current `++cmd` surface behind a single public command family so rooms, AI slots, assistant slot, and US1 transport all use the same envelope and routing model. The working public surface in this plan is `++cmd:SlotBridge({...})`; if the final public name changes later, the envelope, action names, and migration steps in this plan should stay the same.

This plan treats the existing room-specific command names such as `GameRoomXoxAiMove` as internal room action identifiers instead of long-term public `++cmd` names. Room code should eventually trigger the central bridge externally, then delegate to room-local handlers through a `room.command` action.

The plan also folds in two decisions that materially affect implementation order:
- `sendWait` must return normalized reply text plus archived attachments, including message images that only become available through full sync.
- slot auto-connect must stop being a special-case AI0 behavior and become a generic policy controlled by a bridge-level `force` or normalized `connectPolicy`.

## Assumptions
- Current room command migration scope is `rooms/game-room`; other rooms can adopt the same bridge later when they introduce or expose command specs.
- Existing room manifests continue to define room-local actions and scopes, but not all room actions remain public command-catalog entries after migration.
- Existing transport primitives remain valid:
  - webview send queue and attachment staging
  - conversation sync and archive persistence
  - US1 `roomCommand` and `roomEvent` envelopes
- The generated-image archive path remains the source of truth for assistant-produced images; bridge reply capture should reuse it instead of inventing a second media store.

## Prerequisites
- Current command registry and routing entry points:
  - `src/js/modules/server-commands.ts`
  - `src/js/modules/rooms/room-command-registry.ts`
  - `src/js/modules/catch-manager.ts`
  - `src/types/commands.ts`
- Current room UI and room host bridge:
  - `electron/room-webview-preload.cjs`
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `rooms/game-room/ui/game-room-ui-bootstrap.ts`
  - `rooms/game-room/shared/host/command-registry.ts`
- Current slot messaging and sync/archive flow:
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/webview/conversation-syncer.ts`
  - `src/js/modules/webview/pending-archive-handler.ts`
  - `src/js/modules/webview/message-sender.ts`
- Current US1 room transport contract:
  - `src/types/us1-mail.ts`
  - `src/types/us1-relay.ts`
  - `electron/us1-conversation-service.ts`
  - `rooms/game-room/main-functions/xox/host/us1-sync-runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime-transport.ts`

## Sprint 1: Freeze The Bridge Contract
**Goal**: Define a single bridge envelope and eliminate the riskiest contract ambiguities before implementation starts.
**Demo/Validation**:
- A written contract exists for every supported bridge action and result shape.
- The plan includes a parser-safe encoding strategy for rich JSON payloads.
- Room, AI, assistant, and US1 command flows map to the same bridge envelope without hidden one-off fields.

### Task 1.1: Define the canonical bridge envelope and action catalog
- **Location**:
  - New spec doc near repo root or `docs/`
  - `src/types/commands.ts`
  - `src/types/us1-mail.ts`
  - `src/types/us1-relay.ts`
- **Description**: Introduce a typed bridge envelope with fields such as `version`, `reqId`, `action`, `fromSlot`, `toSlot`, `replyToSlot`, `sessionRef`, `connectPolicy`, `wait`, `timeoutMs`, `payload`, and `attachments`. Freeze the first supported action list:
  - `message.send`
  - `message.sendWait`
  - `message.sendWithAttachments`
  - `file.send`
  - `connection.ensure`
  - `session.open`
  - `session.switch`
  - `room.command`
- **Complexity**: 5/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - Every action defines required and optional fields.
  - A standard response shape exists with `ok`, `code`, `message`, `reqId`, `reply`, `session`, and `artifacts`.
  - Attachment metadata explicitly supports image-bearing replies through MIME-aware attachment descriptors.
  - Public v1 guarantees must be called out explicitly:
    - text routing and room actions are first-class
    - file-bearing public actions require either an attachment token/reference contract or explicit temporary internal-only status until that contract lands
- **Validation**:
  - Review the type surface for circular dependencies.
  - Confirm the contract can represent current `AIAssistantSend`, `AssistantAISend`, and room-command transport cases.

### Task 1.2: Normalize connection policy around `force`
- **Location**:
  - `src/types/commands.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - New bridge helper under `src/js/modules/commands/` or `src/js/modules/core/`
- **Description**: Replace AI0-only auto-connect behavior with a generic bridge policy. Keep `force: true` as accepted public input, but normalize internally to a `connectPolicy` value such as `never`, `ensure`, or `require-ready`.
- **Complexity**: 4/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The bridge can apply the same connection policy for `ai0`, `ai1`, `ai2`, and any future connectable slot.
  - Existing commands no longer hardcode AI0 connect behavior.
  - Failure reasons distinguish `offline`, `connect-failed`, and `not-ready`.
- **Validation**:
  - Contract review against current `aiAssistantSendHandler` and `assistantAISendHandler`.
  - Confirm `force` remains backwards-compatible at the public boundary.

### Task 1.3: Harden parser rules for rich JSON payloads
- **Location**:
  - `src/js/modules/catch-manager.ts`
  - `src/js/pages/server-command-utils.ts`
  - Any shared command parsing helper introduced for the bridge
- **Description**: Replace or constrain the current `++cmd:<name>(...)` parsing strategy so large JSON payloads are safe. The current regex stops at the first `)` and is too brittle for a richer envelope containing free text, URLs, or serialized metadata.
- **Complexity**: 8/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - The parser can safely extract a full bridge payload from the final assistant message.
  - The chosen syntax is documented and testable.
  - Failure behavior is explicit when the command is malformed or truncated.
- **Validation**:
  - Add parser regressions for nested JSON, URLs with `)`, quoted text, multiline payloads, and malformed command cases.

### Task 1.4: Separate public command exposure from internal room actions
- **Location**:
  - `src/types/room-manifest-types.ts`
  - `src/js/modules/rooms/room-command-registry.ts`
  - `src/js/modules/server-commands.ts`
- **Description**: Add metadata that lets room command specs remain internal action IDs without automatically surfacing as public custom `++cmd` commands in the catalog.
- **Complexity**: 6/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Room manifests can still declare room action IDs and scopes.
  - Public command listing can hide internal room actions once bridge migration is complete.
  - Existing room scope enforcement remains intact for internal dispatch.
- **Validation**:
  - Confirm catalog behavior for built-in commands, internal room actions, and any future public room bridge actions.

### Task 1.5: Move access control and disabled-command policy to the bridge action level
- **Location**:
  - `src/js/modules/server-commands.ts`
  - `src/types/commands.ts`
  - `src/types/settings.ts`
  - `src/js/modules/settings/settings-schema.ts`
- **Description**: Replace current command-name-level access assumptions with a model that can authorize one public command differently per bridge action. The same review must cover how slot-level `disabledCommands` should behave once most public traffic flows through a single command name.
- **Complexity**: 7/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Access checks can distinguish `room.command`, `message.send`, `message.sendWait`, and session actions even when they share one public command name.
  - Slot-level disable rules do not collapse into an all-or-nothing `SlotBridge` toggle unless that behavior is explicitly chosen.
  - Existing room scope enforcement still applies after the public-to-internal bridge hop.
- **Validation**:
  - Add regressions for action-level allow/deny behavior and disabled-action behavior.

### Task 1.6: Audit every `++cmd` authoring and testing surface that assumes `Name(args)`
- **Location**:
  - `src/js/pages/server-command-utils.ts`
  - `src/js/pages/server.ts`
  - `src/js/pages/server/types.ts`
  - `src/js/modules/commands/command-descriptions.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - Any command-panel i18n/help surface that renders inline examples
- **Description**: Inventory and plan the non-runtime surfaces that will break or become misleading when one public bridge command replaces many named commands. This includes the command test panel, inline example generation, command stripping, and help/description rendering.
- **Complexity**: 5/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Command test tooling, examples, and help text have an explicit migration path.
  - Slot-policy behavior for assistant, AI, and US1 is documented for UI/config surfaces, not only runtime code.
  - The plan explicitly decides whether the server UI presents one bridge command, derived bridge actions, or both.
- **Validation**:
  - Review command-panel and help-copy behavior before implementation begins.

## Sprint 2: Build The Central Slot Bridge Runtime
**Goal**: Add a single central dispatcher that owns routing, attachment handling, connection policy, and legacy adapter entry points.
**Demo/Validation**:
- A new bridge handler can execute at least one message action and one room action end-to-end through the central command path.
- Existing legacy commands can be redirected to the bridge without changing user-visible behavior yet.

### Task 2.1: Add the bridge dispatcher module
- **Location**:
  - New module under `src/js/modules/commands/`
  - `src/js/modules/server-commands.ts`
  - `src/types/commands.ts`
- **Description**: Implement a single bridge dispatcher that validates the envelope, normalizes slot references, resolves `connectPolicy`, and routes to per-action handlers.
- **Complexity**: 7/10
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - The dispatcher handles action lookup, validation, and standardized result shaping.
  - Command execution can be traced by `reqId`.
  - The bridge is registered once in `ServerCommands` as the canonical public command handler.
- **Validation**:
  - Unit or targeted integration coverage for action validation and standardized error responses.

### Task 2.2: Implement bridge attachment and message staging helpers
- **Location**:
  - New helper near `src/js/modules/core/` or `src/js/modules/commands/`
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/webview/message-sender.ts`
  - `src/types/commands.ts`
- **Description**: Reuse current attachment staging and send queue logic so bridge actions can send:
  - text-only messages
  - file-only messages
  - mixed text + attachments
  - image attachments using the existing attachment model
- **Complexity**: 7/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Bridge actions can produce the same staged attachment metadata used by the current command queue.
  - No duplicate ad hoc attachment flow is introduced for images.
  - File-only sends do not require placeholder text unless the provider transport demands it.
- **Validation**:
  - Targeted tests for staged attachment payloads and bridge job metadata.

### Task 2.3: Move legacy assistant/AI send commands behind bridge adapters
- **Location**:
  - `src/js/modules/commands/ai-chat-commands.ts`
  - `src/js/modules/server-commands.ts`
- **Description**: Keep `AIAssistantSend` and `AssistantAISend` temporarily available as compatibility wrappers, but make them translate their old payloads into the new bridge envelope.
- **Complexity**: 5/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Existing callers still work.
  - AI0 auto-connect logic disappears from the wrappers.
  - Wrappers emit bridge-shaped telemetry and use the generic connection policy path.
- **Validation**:
  - Regression checks for old command names against the new bridge runtime.

### Task 2.4: Add an attachment reference contract for public file-bearing actions
- **Location**:
  - `src/types/commands.ts`
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/file-manager.ts`
  - Any bridge dispatcher helper introduced in Sprint 2
- **Description**: Make `message.sendWithAttachments` and `file.send` viable for public bridge payloads by defining how a command can reference attachable artifacts without relying on raw local file paths embedded in AI-authored payloads. This may be a staged token, archived attachment reference, or another explicit internal reference model.
- **Complexity**: 8/10
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Public file-bearing actions no longer assume arbitrary real filesystem paths from AI-authored command text.
  - The bridge can resolve declared attachment references into staged files safely.
  - The contract is explicit about what remains internal-only if no valid reference is provided.
- **Validation**:
  - Add focused tests for valid attachment references, invalid references, and missing-reference behavior.

## Sprint 3: Add `sendWait` Reply Capture With Attachment And Image Support
**Goal**: Return stable reply payloads for bridge wait actions using full sync, not lightweight scrape-only reply capture.
**Demo/Validation**:
- `message.sendWait` returns normalized reply text.
- If the reply contains generated images that reach the archive path, the bridge result includes them.
- Text-only replies still return quickly when no extra archive work is needed.

### Task 3.1: Add bridge-level correlation and reply ownership metadata
- **Location**:
  - `src/types/commands.ts`
  - `src/js/modules/core/send-actions.ts`
  - `src/js/modules/webview/conversation-syncer.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
- **Description**: Thread `reqId`, sender identity, and reply ownership metadata through sends and sync so the bridge can correlate a reply back to the originating request even when another AI is the visible responder.
- **Complexity**: 8/10
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - Reply lookup can distinguish manual traffic from bridge traffic.
  - Sender preservation no longer depends only on ad hoc nickname tags.
  - The reply owner is explicit for cross-slot AI routing.
- **Validation**:
  - Regression coverage for same-slot, assistant-to-AI, AI-to-assistant, and AI-to-AI routing.

### Task 3.2: Cut assistant reply capture over from latest-only sync to full-sync-friendly paths
- **Location**:
  - `src/js/modules/webview/conversation-syncer.ts`
  - `src/js/modules/relay-manager.ts`
  - Any assistant reply helper introduced for the bridge
- **Description**: Remove or bypass assistant paths that are hard-wired to `syncLatestMessage` when the bridge needs a final `sendWait` reply. The assistant and relay flows must be able to use the same full-sync-capable reply pipeline as other slots when reply artifacts matter.
- **Complexity**: 8/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Assistant reply capture is no longer constrained to latest-only scrape paths when the bridge requests a waited reply.
  - Relay-assisted assistant flows can participate in full-sync reply resolution.
  - The cutover is explicit enough that later work does not accidentally route `sendWait` back through lightweight sync helpers.
- **Validation**:
  - Add focused regressions for assistant wait flows with and without relay involvement.

### Task 3.3: Build a full-sync wait pipeline
- **Location**:
  - New helper near `src/js/modules/webview/`
  - `src/js/modules/webview/conversation-syncer.ts`
  - `src/js/modules/relay-manager.ts`
- **Description**: Add a wait helper that uses the full sync path rather than `syncLatestMessage`, so returned replies can include persisted attachments and generated images. This helper should wait for a bounded stable reply, then re-read archived message rows plus attachments.
- **Complexity**: 9/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - `sendWait` does not rely on `syncLatestMessage` for final reply data.
  - Generated-image persistence is allowed to complete before the final reply DTO is returned.
  - The helper supports timeouts, retries, and explicit `TARGET_TIMEOUT` style errors.
- **Validation**:
  - Add targeted regressions for delayed generated images, attachment-bearing assistant replies, and timeout behavior.

### Task 3.4: Normalize reply DTOs for text, generated images, and persisted attachments
- **Location**:
  - `src/types/commands.ts`
  - `src/js/modules/webview/conversation-syncer.ts`
  - Possibly a new mapper near analyze/archive IPC helpers
- **Description**: Create a normalized reply DTO containing:
  - plain text
  - provider and slot metadata
  - generated-image attachments surfaced as normal attachments with MIME-aware metadata
  - any other persisted attachments that already exist in the archive path
- **Complexity**: 6/10
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - The bridge result can expose generated-image replies without inventing a second image return type.
  - Consumers can detect `image/*` from attachment metadata.
  - Reply DTOs remain stable across provider differences.
- **Validation**:
  - Snapshot or mapper regressions for text-only and generated-image reply cases.

## Sprint 4: Generalize US1 And Room Transport Around The Bridge
**Goal**: Make room transport and remote transport carry the same logical action model as local bridge execution.
**Demo/Validation**:
- A room-originated action can cross US1 transport and still resolve through the central bridge model.
- Existing room event flows remain intact during migration.

### Task 4.1: Expand US1 room-command payload shape for bridge-compatible transport
- **Location**:
  - `src/types/us1-mail.ts`
  - `src/types/us1-relay.ts`
  - `electron/us1-conversation-service.ts`
- **Description**: Extend `roomCommand` so it can carry a bridge-compatible payload or bridge action envelope while preserving a compatibility adapter for current `commandName/rawArgs` room transport.
- **Complexity**: 8/10
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - Old room-command payloads remain readable during migration.
  - New bridge-compatible room transport can include richer action metadata without losing `featureId`, `remoteUserId`, or session references.
  - Relay and mail transport normalize to the same stored record shape.
- **Validation**:
  - Regression coverage for legacy and bridge-style US1 room commands.

### Task 4.2: Route room UI commands through `room.command`
- **Location**:
  - `electron/room-webview-preload.cjs`
  - `src/js/modules/rooms/room-host-runtime.ts`
  - `rooms/game-room/ui/game-room-ui-bootstrap.ts`
  - Any room UI runtime contract file that documents `roomAPI.sendCommand`
- **Description**: Keep the room UI API simple, but make its external semantics bridge-first. The host should receive room UI requests and dispatch them as `SlotBridge` `room.command` actions instead of treating every room command name as a public standalone command.
- **Complexity**: 7/10
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Room UI can still call `sendCommand`.
  - The host maps room UI sends into bridge payloads without exposing room action IDs as public top-level commands.
  - `command-result` replies remain available to the room UI.
- **Validation**:
  - Manual room UI smoke for XOX, Team Tetris, and Fate Knots buttons.

### Task 4.3: Keep room action dispatch internal and scope-aware
- **Location**:
  - `src/js/modules/rooms/room-command-registry.ts`
  - `src/js/modules/server-commands.ts`
  - `rooms/game-room/shared/host/command-registry.ts`
- **Description**: Preserve internal dispatch by action ID after the public bridge is introduced. Room action IDs should still reach the correct host handlers and keep scope gating for `room-ui`, `ai-slots`, `assistant`, and `us1`.
- **Complexity**: 6/10
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Internal room action dispatch remains a direct host concern.
  - Public command catalog can hide internal room actions.
  - Scope violations still fail before room handler execution.
  - Internal action IDs remain globally unique until registry keys are widened beyond `spec.name`.
- **Validation**:
  - Add regressions for room-ui, ai-slot, and US1 scope enforcement.

## Sprint 5: Migrate Game Room To The New Bridge Surface
**Goal**: Update the active room that currently emits room-specific `++cmd` names so it uses the central bridge everywhere.
**Demo/Validation**:
- Game Room flows no longer require public `++cmd:GameRoom...` command names.
- AI and US1 transports still drive the same gameplay outcomes through bridge-mediated room actions.

### Task 5.1: Migrate the shared Game Room seams before per-feature prompt changes
- **Location**:
  - `rooms/game-room/shared/host/command-registry.ts`
  - `rooms/game-room/main-functions/xox/host/us1-sync-runtime.ts`
  - `rooms/game-room/host/runtime.ts`
  - Any shared room host seam that still assumes public room command names
- **Description**: Update the shared Game Room command registry and the shared receive-side US1 room-command loop first. XOX, Team Tetris, and Fate Knots all depend on these seams, so they must become bridge-aware before per-feature prompt migration starts.
- **Complexity**: 8/10
- **Dependencies**: Sprint 4 complete
- **Acceptance Criteria**:
  - Shared Game Room dispatch paths understand bridge-mediated room actions.
  - Receive-side US1 command application no longer assumes the old public-command model.
  - The plan explicitly treats this as a shared migration seam rather than three isolated feature rewrites.
- **Validation**:
  - Shared seam smoke for one XOX command, one Team Tetris command, and one Fate Knots command before prompt migration begins.

### Task 5.2: Update XOX prompts and remote transport
- **Location**:
  - `rooms/game-room/main-functions/xox/host/copy.ts`
  - `rooms/game-room/main-functions/xox/host/runtime.ts`
  - `rooms/game-room/main-functions/xox/host/us1-sync-runtime.ts`
  - `rooms/game-room/main-functions/xox/protocols/*.md`
- **Description**: Replace public prompt instructions like `++cmd:GameRoomXoxAiMove(...)` with bridge calls that target `room.command` and carry the XOX internal action ID plus payload.
- **Complexity**: 7/10
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - AI prompts emit bridge syntax only.
  - US1 remote move transport can still apply XOX actions through internal room dispatch.
  - Invite, accept, reject, reset, and move flows remain compatible.
- **Validation**:
  - Focused XOX smoke matrix for user, AI, and US1 opponents.

### Task 5.3: Update Team Tetris prompts and transport
- **Location**:
  - `rooms/game-room/main-functions/team-tetris/host/runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime-transport.ts`
  - `rooms/game-room/main-functions/team-tetris/host/runtime-protocol.ts`
  - `rooms/game-room/main-functions/team-tetris/protocols/*.md`
- **Description**: Migrate Team Tetris AI and US1 transport so all remote actions use bridge syntax and internal room action IDs.
- **Complexity**: 7/10
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - AI opening and follow-up prompts emit bridge syntax.
  - Remote start, reset, and move flows still preserve session and turn metadata.
  - Existing seat-readiness and blocked-dispatch logic remains intact.
- **Validation**:
  - Focused Team Tetris turn smoke with AI seats and US1 remote seat.

### Task 5.4: Update Fate Knots prompts and dispatch loops
- **Location**:
  - `rooms/game-room/main-functions/fate-knots/host/prompt-runtime.ts`
  - `rooms/game-room/main-functions/fate-knots/host/runtime.ts`
  - `rooms/game-room/main-functions/fate-knots/protocols/*.md`
- **Description**: Replace direct public Fate Knots command names in prompts with bridge-driven `room.command` actions for AI choices, combat actions, DM packets, and NPC banter.
- **Complexity**: 8/10
- **Dependencies**: Task 5.3
- **Acceptance Criteria**:
  - All AI-facing prompts emit bridge syntax.
  - Additive narration and banter still resolve to the same internal handlers.
  - Waiting-state recalculation and dispatch retry logic remain deterministic.
- **Validation**:
  - Focused Fate Knots decision and combat smoke for AI seats plus remote seat handling.

### Task 5.5: Clean up manifest exposure and room catalog behavior
- **Location**:
  - `rooms/game-room/manifest.json`
  - `src/types/room-manifest-types.ts`
  - `src/js/modules/rooms/room-command-registry.ts`
  - `src/js/modules/server-commands.ts`
- **Description**: Update manifest metadata and catalog behavior so Game Room action IDs stay internal after migration while any explicitly supported public bridge entry remains visible.
- **Complexity**: 5/10
- **Dependencies**: Task 5.4
- **Acceptance Criteria**:
  - Internal room action IDs are no longer treated as end-user public custom commands.
  - Scope data remains available for internal dispatch.
  - Room install/build/load flows continue to validate command specs.
  - Internal action IDs remain globally unique until registry keying changes.
- **Validation**:
  - Room manifest validation regressions.
  - Manual inspection of server command catalog UI if present.
  - Rebuild workspace artifacts and verify behavior against built or installed room output, not only source manifests.

## Sprint 6: Compatibility, Validation, And Rollout
**Goal**: Land the migration safely with explicit compatibility boundaries, regression coverage, and rollback-ready checkpoints.
**Demo/Validation**:
- Legacy commands either still work through adapters or fail with an intentional migration message.
- The bridge can be demonstrated for one message send, one send-wait reply with image, and one room action.

### Task 6.1: Add compatibility shims and deprecation telemetry
- **Location**:
  - `src/js/modules/server-commands.ts`
  - `src/js/modules/commands/ai-chat-commands.ts`
  - Any bridge telemetry helper introduced earlier
- **Description**: Keep high-risk legacy commands available temporarily and emit deprecation telemetry so remaining callers can be found before removal.
- **Complexity**: 4/10
- **Dependencies**: Sprint 5 complete
- **Acceptance Criteria**:
  - Legacy assistant send commands still route through the bridge.
  - Optional legacy room public commands either route through adapters or produce an intentional deprecation result.
  - Logs identify remaining legacy callers by command name.
- **Validation**:
  - Manual smoke for adapter entry points.

### Task 6.2: Expand automated regression coverage
- **Location**:
  - Existing tests around command parsing, conversation sync, room manifests, room host runtime, and US1 transport
  - New bridge-focused tests near the owning modules
- **Description**: Add regression coverage for parser safety, standardized bridge results, `sendWait` attachment/image returns, connection policy, and Game Room bridge prompts.
- **Complexity**: 7/10
- **Dependencies**: Task 6.1
- **Acceptance Criteria**:
- Tests cover malformed bridge payloads, timeout behavior, generated-image replies, and legacy adapter routing.
- Room command migration is covered for at least one action per Game Room feature.
- US1 room transport remains covered in both legacy and migrated shapes until legacy removal.
- Built or installed room artifacts are exercised for Game Room migration checks, not only workspace source files.
- **Validation**:
  - Run targeted suites plus `npm run typecheck`.

### Task 6.3: Build a manual smoke checklist and rollout order
- **Location**:
  - This plan file or a short follow-up checklist doc
- **Description**: Document the recommended rollout order:
  - parser and type layer
  - bridge dispatcher
  - `sendWait` full-sync reply capture
  - room transport migration
  - Game Room prompt updates
  - legacy cleanup
- **Complexity**: 3/10
- **Dependencies**: Task 6.2
- **Acceptance Criteria**:
  - A tester can validate the bridge without guessing the order of risky changes.
  - Manual checks exist for text-only reply, file reply, generated-image reply, room UI action, and US1 room transport.
- **Validation**:
  - Review by implementation owner before coding starts.

## Testing Strategy
- Add focused parser tests first because the bridge payload becomes riskier than current room commands.
- Keep bridge action tests at the handler level where possible, then add a thinner integration layer through `ServerCommands`.
- Use full-sync-based tests for any `sendWait` case that expects archived attachments or generated images.
- Treat US1 migration as a dual-shape period:
  - bridge-compatible room transport
  - legacy `commandName/rawArgs` transport
- Require targeted Game Room smoke checks after each feature migration:
  - XOX local + AI + US1
  - Team Tetris AI turn dispatch + remote transport
  - Fate Knots decision + combat + additive narration
- Require `npm run typecheck` before considering the migration sprint complete.

## Potential Risks & Gotchas
- The current command parser is too weak for a richer JSON bridge payload and must be fixed before rollout.
- `syncLatestMessage` is not enough for attachment-bearing `sendWait` replies because it skips the archive and generated-image persistence path.
- Generated images can materialize after assistant text; reply capture must tolerate short post-thinking delays without making text-only flows sluggish.
- The current access model is keyed by command name, not action semantics. A single public bridge command will bypass or distort existing category and disabled-command rules unless policy moves inside the bridge.
- The command test panel, inline builders, description registries, and help copy still assume `++cmd:Name(args)`. If those surfaces are not migrated explicitly, operators will keep authoring old syntax even after runtime migration.
- Room manifests currently double as internal action declarations and public command exposure. If this is not split, the new bridge will still leak room internals into the public catalog.
- US1 `roomCommand` currently assumes a narrow command payload. Changing the envelope without a compatibility phase risks breaking in-flight remote matches.
- Bridge correlation must survive relay scenarios where the visible responder and the actual requester are different slots.
- Attachment-heavy `sendWait` flows may increase latency; timeout policy and partial-result behavior must be explicit.
- Game Room feature migrations are not fully independent because receive-side US1 sync and shared host command registry seams are shared across XOX, Team Tetris, and Fate Knots.

## Rollback Plan
- Keep legacy assistant send commands as adapters until the bridge path is stable.
- Preserve legacy US1 `roomCommand` normalization until migrated room payloads are verified in manual smoke.
- Treat the shared Game Room seam migration separately from per-feature prompt rewrites; only the later prompt/runtime tasks are feature-local rollback points.
- If `sendWait` full-sync capture proves unstable, keep bridge send actions enabled but temporarily gate reply attachment/image return behind a feature flag or fallback to text-only reply results.
- Do not remove internal room action IDs or manifest scope data during the first rollout; only remove public exposure after bridge migration is verified.
