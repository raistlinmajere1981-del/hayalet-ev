# Plan: XOX US1 Remote User Play

**Generated**: 2026-03-22
**Estimated Complexity**: High

## Overview

Add a third XOX opponent type to Game Room so the local user can play against the currently connected `US1` remote user, not just `AI1` and `AI2`.

The scope also adds two UX surfaces inside the Game Room UI:

- an inbox-style list for incoming Game Room invites from registered remote users, including invite messages
- a free-text invite note field near the invite/start action

The safest approach is to extend the existing room feature contract in three layers:

1. Room runtime and command routing must understand `us1` as a valid room participant.
2. Game Room XOX host must gain a remote-match state machine with invite, accept, reject, turn sync, and recovery states.
3. US1 conversation mail sync must gain a room-command catch path so inbound `++cmd` lines from remote gameplay mail can reach the room host without relying on AI webview scraping.

This plan intentionally keeps the room-local UX and the mail transport aligned with existing project rules:

- single active US1 binding only
- mail remains the transport
- moves are still expressed as `++cmd` commands
- archive/session/thread behavior should reuse existing US1 conversation infrastructure
- invite note text is authored from the room UI, not from Entrance settings

## Assumptions

- Active gameplay reuses the currently selected `us1Slot.selectedRemoteUserId` / `selectedAccountId` conversation binding, while the invite inbox can aggregate pending XOX invites from all registered remote accounts.
- Only one active XOX remote match is supported per side at a time.
- Invite, accept, reject, move, disconnect, and stale-match recovery will be room-local to Game Room XOX.
- Remote acceptance happens from UI, but the final signal still travels over mail as a `++cmd` line.
- No generic multiplayer framework is required in this iteration; the first implementation can stay XOX-specific if shared seams remain small.

## Locked Product Decisions

- The Game Room invite list does not need history; only current actionable invites should be shown.
- The invite list should aggregate incoming XOX invites from all registered remote accounts, not only the currently selected `US1` account.
- Accepting an invite from a different registered remote account should automatically switch the active `US1` selection to that account.
- The invite-note field is free text with no product-level validation rule; implementation may still apply minimal transport-safe normalization.
- For `AI1` / `AI2`, the invite note is prepended only to the initial protocol message.
- For `US1`, the invite note is sent only in the initial invite mail.
- Incoming Game Room invites should also surface as toast notifications.
- XOX over `US1` should reuse the currently selected/general `US1` conversation thread instead of creating a dedicated per-match thread.
- Invite timeout and cancel are out of scope for v1; invites remain pending until accept, reject, or reset.
- The simplest restart behavior is preferred: active remote XOX matches do not recover after app restart and should reset safely.

## Prerequisites

- A verified and connected local mail account in `integrations.mailTransport`.
- An active remote-email handshake in `settings.accounts[*].remoteEmail.handshakeState === "active"`.
- `us1Slot.connectionState === "connected"` and a selected remote binding.
- Existing room package and room runtime flows remain unchanged unless explicitly listed below.

## Current-State Findings

- `rooms/game-room/host/index.js` only supports `target: "ai1" | "ai2"` and `starter: "user" | "ai"`.
- `rooms/game-room/ui/index.js` only renders opponent choices for `ai1` and `ai2`.
- `rooms/game-room/ui/index.js` has no incoming invite list and no invite-note field.
- `src/js/pages/room-page.ts` sends host context with only `slots.ai1` and `slots.ai2`.
- `src/types/rooms.ts` supports `RoomCommandScope = "room-ui" | "ai-slots" | "assistant" | "system"`, but there is no US1-specific command scope.
- `src/js/modules/rooms/room-command-registry.ts` only grants slot-originated room commands to `ai1` and `ai2`.
- `src/js/modules/webview/conversation-syncer.ts` catches `++cmd` lines only from scraped AI webview messages.
- `electron/us1-conversation-service.ts` already provides session/thread-aware mail send/sync and can persist inbound message attachments, but it does not route inbound room commands.
- `electron/mail-identity-service.ts` handshake flow is onboarding-oriented; it is the wrong layer for per-match XOX invite metadata.
- AI protocol delivery is composed centrally, so prepending a room-authored note needs an explicit seam in core protocol composition, not only host-level changes.
- Unknown providers are currently permissive enough in caught-command / room-command paths that `us1` command routing must be explicitly hardened.
- Current US1 send/sync helpers resolve only the active binding, so a room-local invite inbox across all registered remote users needs new projection plumbing.

## Payload Matrix

### UI -> Host

- `GameRoomXoxStart`
  - AI target: starts immediately, unchanged behavior.
  - AI target: if `inviteMessage` is non-empty, prepend it to the selected XOX protocol body before dispatch.
  - US1 target: creates pending invitation state and dispatches remote invite mail instead of starting immediately.
- `GameRoomXoxReset`
  - Clears local XOX state and terminates any pending remote match handshake for this room feature.
- `GameRoomXoxUserMove`
  - Local move command, reused for both AI and US1 matches.
- Shared room-ui payload additions
  - `inviteMessage`
  - optional `inviteId`
- New remote-specific room-ui commands
  - `GameRoomXoxRespondInvite`
  - `GameRoomXoxDismissInvite`
  - optional `GameRoomXoxCancelInvite`

### Host -> AI Protocol

- If the selected target is `ai1` or `ai2`, the room UI invite note is prepended to the protocol body as a short user-authored preface.
- The preface must be clearly delimited so the existing XOX protocol instructions still remain parse-safe.

### Host -> US1 Mail

- Game Room invite and move mail should travel through the existing US1 conversation/session transport, not the onboarding handshake transport.
- Lifecycle events travel as structured `roomEvent` metadata:
  - `invite`
  - `accept`
  - `reject`
  - `reset`
- Turn actions travel as structured `roomCommand` metadata and are mirrored in the plain-text body as `++cmd:GameRoomXoxRemoteMove({...})`.

Each remote XOX payload should carry a stable match identifier plus enough state to reject stale or duplicate mail:

- `roomId`
- `featureId`
- `matchId`
- `inviteId` as a compatibility alias while both sides migrate
- `remoteUserId`
- `invitedByRemoteUserId`
- `inviteMessage`
- `starter`
- `turnIndex`
- `boardHashBeforeMove`
- `sentAt`
- `protocolVersion`

### US1 Mail -> Host

- Inbound mail sync projects structured `roomEvent` and `roomCommand` metadata from the US1 conversation envelope.
- For remote moves, the plain-text body still mirrors the move as a single `++cmd` line for transport/debug visibility.
- The parsed command is executed through the same room command pipeline used by AI-originated room commands, but with `provider: "us1"`.

### Host -> UI Events

- `xox-state` remains the main UI sync event.
- Host context/state should include an invite inbox model for Game Room XOX, sourced from registered remote accounts and pending handshake/gameplay invites.
- The current implementation keeps remote lifecycle as a composite host state:
  - `pendingInvite` for outbound waiting
  - `inviteInbox` for inbound choices
  - `active` + `result` for live/finished matches
  - `statusKey` for rejected, blocked, and remote-reset UX states
- Invite inbox actions should key rows by `remoteUserId + matchId` rather than by `inviteId` alone.

## Sprint 1: Widen Room and US1 Contracts

**Goal**: Make the room/runtime layer capable of representing `us1` as a real room participant and receiving room commands from remote mail.

**Demo/Validation**:

- Game Room runtime context includes `us1` next to `ai1` and `ai2`.
- Room command registry can explicitly allow a US1-originated room command.
- Pending invite metadata, including invite message text, can be queried for room UI rendering.
- `us1` room commands are either explicitly whitelisted through hardened routing or isolated from generic caught-command execution.
- Unit tests prove that a `provider: "us1"` room command can reach the correct room handler without loosening unrelated scopes.

### Task 1.1: Extend room target and context types

- **Location**: `src/types/rooms.ts`, `src/js/pages/room-page.ts`, `rooms/game-room/ui/index.js`, `rooms/game-room/host/index.js`
- **Description**: Add a shared XOX target model that includes `us1`, and include US1 in room host context payload generation.
- **Complexity**: 4
- **Dependencies**: None
- **Acceptance Criteria**:
  - Host context payload includes `slots.us1`.
  - Game Room can resolve display metadata for `us1` the same way it resolves `ai1` and `ai2`.
- **Validation**:
  - Add/adjust room-page regression coverage.
  - Smoke with a logged host-context payload snapshot.

### Task 1.2: Add a US1-capable room command scope or provider allowlist

- **Location**: `src/types/rooms.ts`, `src/js/modules/rooms/room-command-registry.ts`, `scripts/tests/room-command-registry-regressions.test.ts`
- **Description**: Introduce the smallest explicit scope model that allows room commands from `us1` without broadening AI or assistant permissions accidentally.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `provider === "us1"` can only execute commands explicitly intended for US1 or shared remote gameplay.
  - Existing AI-only room commands keep their current guardrails.
- **Validation**:
  - New registry regression tests for accepted and rejected provider/scope combinations.

### Task 1.3: Create a US1 inbound command catch seam

- **Location**: `electron/us1-conversation-service.ts`, `src/js/modules/catch-manager.ts` or a new shared helper, `src/js/pages/analyze.ts` and/or a room-runtime-facing listener
- **Description**: Parse inbound US1 conversation messages for room `++cmd` commands and expose them as structured gameplay events instead of leaving them as passive archive messages only.
- **Complexity**: 8
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The latest inbound US1 assistant-side message can yield structured command metadata.
  - Duplicate mail fetches do not re-execute the same room command.
  - The command path can carry `provider: "us1"` plus session/match metadata.
- **Validation**:
  - Add focused `us1-conversation-service` regression tests for inbound command extraction and dedupe.

### Task 1.4: Persist room invite metadata in the conversation layer, not the handshake layer

- **Location**: `src/types/us1-mail.ts`, `electron/us1-conversation-service.ts`, `src/js/modules/app-state.ts`
- **Description**: Extend conversation-layer room-invite metadata so a remote XOX invite can store a human-authored invite message and later surface as a room-specific invite list entry without coupling gameplay to US1 onboarding handshake state.
- **Complexity**: 7
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Outbound US1 invites can carry an optional invite message.
  - Inbound pending invites retain their message text after sync.
  - Room UI can read a normalized invite inbox model without scraping raw mail text.
- **Validation**:
  - Add regression tests for outbound conversation invite serialization and inbound invite metadata projection.

### Task 1.5: Add multi-account invite inbox projection

- **Location**: `electron/us1-conversation-service.ts`, `src/js/modules/app-state.ts`, `src/js/pages/room-page.ts`
- **Description**: Build a room-facing invite inbox projection that can aggregate current XOX invites from all registered remote users instead of only the active US1 binding.
- **Complexity**: 8
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - Invite inbox projection is not limited to `resolveActiveBinding`.
  - Accepting an invite from a non-selected remote user can switch the active US1 selection safely.
  - Toast and room-list state can be produced from the same normalized invite feed.
- **Validation**:
  - Add tests for cross-account invite projection and accept-driven selection switching.

## Sprint 2: Build the XOX Remote Match State Machine

**Goal**: Teach the Game Room host to manage invite/accept/reject/move flows for a human remote opponent over mail.

**Demo/Validation**:

- Starting XOX with `us1` creates an invite-pending state instead of an AI turn.
- Starting XOX with an AI target can include a protocol preface from the room invite-note field.
- Receiving an accept command activates the match with a stable `matchId`.
- Receiving a remote move updates the board and turn correctly.

### Task 2.1: Add remote-match state and serialization

- **Location**: `rooms/game-room/host/index.js`
- **Description**: Extend host state with `matchId`, remote user identity, composite remote lifecycle state, last processed remote command id, and stale/disconnect guards.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Host can distinguish AI match, pending remote invite, active remote match, and blocked remote match.
  - `xox-state` payload contains enough information for both inviter and invitee UI states.
- **Validation**:
  - Add host-level state transition tests or a new room host regression suite.

### Task 2.2: Define remote XOX command set and protocol docs

- **Location**: `rooms/game-room/manifest.json`, `rooms/game-room/protocols/*`, `config/rooms.json`
- **Description**: Register remote-game command specs and add XOX mail/protocol docs for invite, accept, reject, move, reset, and optional invite-note semantics.
- **Complexity**: 5
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Manifest no longer describes XOX as AI-only.
  - Remote XOX command names are explicit and versionable.
  - Protocol docs describe the exact `++cmd` format, single-command rule, and how the user-authored note is prepended for AI targets.
- **Validation**:
  - Room manifest and protocol registry regression tests pass.

### Task 2.3: Implement host handlers for invite and remote move flow

- **Location**: `rooms/game-room/host/index.js`
- **Description**: Split start logic between AI and US1, consume the protocol-preface seam for AI invites, send outbound invite/move/reset mail payloads through the US1 conversation layer, and handle inbound accept/reject/move commands.
- **Complexity**: 9
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Local start with `us1` sends an invite and does not mark the board active until accept arrives.
  - Local start with `ai1` or `ai2` can prepend the invite-note text without breaking the protocol contract.
  - Accept initializes symbols and turn ownership consistently on both sides.
  - Remote move validation enforces active match, correct turn, open cell, and matching `matchId`.
  - Reset cancels or terminates the remote match cleanly.
- **Validation**:
  - Host transition tests for invite accepted, invite rejected, invalid remote move, duplicate remote move, and reset.

### Task 2.4: Add an explicit AI protocol-preface seam

- **Location**: `src/js/modules/core/send-actions.ts`, `src/js/modules/protocol-handler.ts`, `src/js/modules/protocol-message-composer.ts`, `rooms/game-room/host/index.js`
- **Description**: Introduce an explicit way for a room feature to prepend a one-time note to the initial AI protocol body without weakening the protocol contract or leaking the note into later turn updates.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - The note is prepended only to the initial protocol dispatch.
  - The existing XOX protocol instructions remain intact and parse-safe.
  - Other protocol senders are unaffected unless they opt into the new seam.
- **Validation**:
  - Add focused protocol composition regression coverage.

## Sprint 3: Ship the Room UI for Both Sides

**Goal**: Make the Game Room XOX UI usable for invite senders and invite receivers, with clear state feedback and no Analyze-page dependency.

**Demo/Validation**:

- A connected US1 opponent appears in the opponent picker.
- Incoming invites from registered remote accounts appear in a room-local list with their invite messages.
- The invite/start area includes a text box for an optional invite note.
- Sending an invite shows pending state and disables invalid actions.
- Receiving an invite shows accept/reject actions in the room UI.
- Both sides see the same board, turn, and result progression.

### Task 3.1: Add US1 to the XOX opponent picker

- **Location**: `rooms/game-room/ui/index.js`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Expand the opponent selector and copy so `US1` is a first-class target with remote-specific labels and readiness states.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - UI can render `ai1`, `ai2`, and `us1`.
  - Start button behavior changes based on target type.
  - Status copy distinguishes AI wait vs remote invite vs remote turn.
- **Validation**:
  - Manual smoke in room UI with mocked host state payloads.

### Task 3.2: Render incoming invite list and invite messages

- **Location**: `rooms/game-room/ui/index.js`, optional `rooms/game-room/ui/style.css`
- **Description**: Add a room-local list for incoming Game Room invites from registered remote users, including sender identity, invite message, freshness, and per-invite actions.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Incoming room invites are visible without leaving Game Room.
  - Each row shows remote user identity plus invite message text.
  - The user can accept, reject, or dismiss from the list entry where appropriate.
- **Validation**:
  - UI state snapshots or deterministic render tests if available.

### Task 3.3: Add invite-note composer near the primary action

- **Location**: `rooms/game-room/ui/index.js`, optional `rooms/game-room/ui/style.css`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Add a text area near the invite/start button so the user can author a short note that is reused as AI protocol preface or US1 invite mail content depending on the selected target.
- **Complexity**: 5
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - The invite note is editable from room UI.
  - AI targets use the text as protocol preface.
  - US1 targets include the same text in outbound invite mail.
  - Empty note remains a valid path.
- **Validation**:
  - Manual smoke for AI target and US1 target dispatch payloads.

### Task 3.4: Render invite lifecycle controls

- **Location**: `rooms/game-room/ui/index.js`, optional `rooms/game-room/ui/style.css`
- **Description**: Add sender and receiver controls for pending invite, accept, reject, cancel, blocked, and finished states around the new invite inbox and note composer.
- **Complexity**: 6
- **Dependencies**: Task 3.2, Task 3.3
- **Acceptance Criteria**:
  - Invite receiver can accept or reject from UI.
  - Invite sender sees whether the request is pending, rejected, or accepted.
  - UI prevents illegal board clicks while invite is unresolved.
- **Validation**:
  - UI state snapshots or deterministic render tests if available.

### Task 3.5: Keep room state synchronized while outside Analyze

- **Location**: `src/js/pages/room-page.ts`, possibly a new US1 room sync helper shared with `src/js/pages/analyze.ts`
- **Description**: Ensure room page can trigger or subscribe to US1 message sync while the user is actively inside Game Room, so inbound remote moves are visible without visiting Analyze.
- **Complexity**: 8
- **Dependencies**: Task 3.4
- **Acceptance Criteria**:
  - Active room can observe inbound US1 XOX commands within a reasonable polling/event window.
  - Active room can also refresh inbound invite inbox state and invite messages.
  - The sync path does not create duplicate archive projections or duplicate command execution.
- **Validation**:
  - Targeted integration test or smoke checklist covering “room open, Analyze closed”.

## Sprint 4: Harden Mail Session Wiring and Regressions

**Goal**: Make the remote match reliable across mail sessions, retries, duplicates, and disconnects.

**Demo/Validation**:

- Invite, accept, move, and reset commands remain tied to the same US1 session/thread.
- Duplicate inbound mail does not replay a move.
- Disconnect or stale session conditions block the match with actionable UI copy.

### Task 4.1: Reuse the existing general US1 session/thread strategy explicitly

- **Location**: `electron/us1-conversation-service.ts`, `rooms/game-room/host/index.js`, possibly a new room-mail helper
- **Description**: Make XOX remote gameplay explicitly reuse the existing general/selected US1 conversation mapping and remove any ambiguity about creating a dedicated per-match thread.
- **Complexity**: 7
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - XOX invite and move mail reuse the current selected/general US1 conversation mapping.
  - Outbound replies reuse the correct `localSessionId`, `threadMessageId`, and remote identity.
- **Validation**:
  - Extend US1 conversation service tests for session reuse.

### Task 4.2: Add duplicate, stale, and mismatch protections

- **Location**: `rooms/game-room/host/index.js`, `electron/us1-conversation-service.ts`
- **Description**: Reject late commands, wrong `matchId`, wrong turn, and replayed transport messages without corrupting board state.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Replay-safe processing exists at both mail metadata and host state levels.
  - Wrong-identity or wrong-session commands do not mutate the board.
  - UI receives a blocked or warning state instead of silently drifting.
- **Validation**:
  - Regression tests for duplicate fetch, late reject, stale move, and wrong match id.

### Task 4.3: Complete end-to-end regression coverage

- **Location**: `scripts/tests/room-page-regressions.test.ts`, `scripts/tests/us1-conversation-service-regressions.test.ts`, new Game Room XOX regression tests as needed
- **Description**: Cover the end-to-end contract from room UI intent to mail payload to inbound command application.
- **Complexity**: 8
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Tests cover happy path and major failure paths.
  - Existing AI XOX behavior remains green.
- **Validation**:
  - Run targeted suites plus `npm run typecheck`.

## Testing Strategy

- Unit/regression focus:
  - room command registry provider/scope rules
  - XOX host state transitions
  - US1 mail session reuse and inbound command extraction
  - room page runtime context emission
- Integration focus:
  - local user invites US1, remote accepts, alternating moves complete, both UIs converge
  - local user invites US1, remote rejects, sender sees rejection
  - remote disconnect or stale mail blocks the match without corrupting the board
- Mandatory verification before considering the feature done:
  - `npm run typecheck`
  - targeted `scripts/tests/*` suites for room, protocol, and US1 mail
  - short manual smoke with two Hayalet Ev endpoints if available

## Potential Risks & Gotchas

- `us1` is not a webview-backed slot, so reusing AI command-catching logic directly will not work.
- Room invite metadata must live in the US1 conversation layer, not the onboarding handshake layer.
- If room-page-triggered US1 sync and Analyze-page US1 sync both execute commands, duplicate protection must be explicit.
- Current room command scopes do not distinguish remote-human traffic from AI traffic; this is a security and correctness seam, not just a typing change.
- A room-local invite inbox across all registered remote users is larger than a simple active-binding projection and needs explicit aggregation logic.
- AI protocol prefaces must stay clearly bounded so they do not dilute or break the strict XOX command instructions.
- Invite acceptance UX is ambiguous when the remote user is not already inside Game Room.
- Long-lived mail sessions may outlive room UI state; `matchId` and last processed command metadata are required.
- Reset semantics must be symmetric; otherwise one side can remain in a phantom active match.
- Existing manifest copy and tests currently describe XOX as AI-only and will need coordinated updates.

## Remaining Open Questions

- None at the product level for the first implementation pass.

## Rollback Plan

- Keep AI XOX command paths untouched while introducing US1 flow behind explicit target checks.
- If the US1-specific room command routing destabilizes room commands globally, revert:
  - US1 room-command scope additions
  - Game Room manifest/host/UI US1 changes
  - US1 inbound command catch seam
- Preserve existing US1 mail conversation and archive behavior even if XOX remote gameplay is rolled back.
