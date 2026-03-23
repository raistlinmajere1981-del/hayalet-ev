# Plan: XOX US1 Findings Remediation

**Generated**: 2026-03-22
**Estimated Complexity**: High

## Overview

This follow-up plan addresses the post-implementation review findings for XOX over `US1`.

The goal is not to rewrite the whole feature. The safer path is to preserve the working room/UI/conversation seams and harden the missing correctness guarantees:

1. add replay/stale protection that is stronger than the current `inviteId + turn` checks
2. make reset symmetric so one side cannot leave the other in a phantom match
3. align the canonical transport/docs contract with the actual implementation choices
4. close the remaining regression gaps

## Recommended Canonical Contract

To resolve the current plan/code mismatch with minimum churn:

- lifecycle signals stay conversation-envelope based:
  - `invite`
  - `accept`
  - `reject`
  - `reset`
- turn actions stay command based:
  - `GameRoomXoxRemoteMove`
  - transported as `roomCommand`
  - still mirrored in mail text as `++cmd`

This matches the original product requirement that moves travel as `++cmd` while avoiding a needless rewrite of invite flow that is already coherent in the codebase.

## Scope

- In scope:
  - host-side replay and stale-command hardening
  - symmetric remote reset
  - remote transport contract documentation
  - regression coverage for room-page `US1` context and remote lifecycle edges
- Out of scope:
  - generic multiplayer framework extraction
  - restart recovery beyond the already locked simple-reset behavior
  - invite timeout/cancel workflow

## Prerequisites

- Current US1 XOX implementation is already merged locally and passing baseline tests.
- Existing room/localization/runtime seams stay the integration boundary.
- No product re-decision is required unless the team wants to force invite lifecycle into pure `++cmd`.

## Sprint 1: Canonicalize Match Identity and Remote Payloads

**Goal**: Introduce a stable remote-match model that can support hard replay/stale rejection without breaking the working invite flow.

**Demo/Validation**:

- Host state exposes a canonical `matchId`.
- Remote move payload carries enough metadata to reject stale or replayed mail.
- Existing invite-driven start flow still works without UI regressions.

### Task 1.1: Promote `inviteId` to a stable `matchId` contract

- **Location**: `rooms/game-room/host/index.js`, `src/types/us1-mail.ts`, `electron/us1-conversation-service.ts`
- **Description**: Introduce `matchId` as the canonical XOX remote-match identifier. Keep `inviteId` as a compatibility alias during migration so current inbox and UI payloads do not break.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Host state stores `matchId`.
  - Remote invite entries expose `matchId`.
  - Existing invite rows continue to render without migration bugs.
- **Validation**:
  - Add host and service tests that accept legacy `inviteId` input and normalize to `matchId`.

### Task 1.2: Extend remote move payload with turn and board validation data

- **Location**: `rooms/game-room/host/index.js`, `src/types/us1-mail.ts`
- **Description**: Add `turnIndex` and a compact `boardHashBeforeMove` or equivalent deterministic precondition to outbound and inbound move payloads.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Every outbound remote move carries `matchId`, `turnIndex`, `cell`, and board precondition metadata.
  - Host can determine whether an inbound move is late, duplicated, or from the wrong board snapshot.
- **Validation**:
  - Add focused host tests for wrong turn index and wrong board hash.

### Task 1.3: Add reset to the lifecycle event model

- **Location**: `src/types/us1-mail.ts`, `electron/us1-conversation-service.ts`
- **Description**: Extend the lifecycle event type set with `reset` and document its semantics as "terminate current pending/active match for this `matchId`".
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Room event types include `reset`.
  - Sync layer can project reset events the same way it projects invite/accept/reject.
- **Validation**:
  - Add service regression coverage for outbound and inbound `reset`.

## Sprint 2: Harden Replay and Stale Rejection

**Goal**: Ensure delayed or replayed remote messages cannot corrupt an active XOX match.

**Demo/Validation**:

- Replayed remote move is ignored.
- Late move from an old board snapshot is rejected.
- Wrong-session or wrong-identity traffic cannot mutate the board.

### Task 2.1: Persist last-processed remote message markers in host state

- **Location**: `rooms/game-room/host/index.js`
- **Description**: Persist remote-processing metadata such as `lastRemoteTransportMessageId`, `lastRemoteTurnIndex`, and optionally a dedupe key derived from message id + command name.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Host can detect and ignore exact transport replays.
  - Host state survives intra-session polling without reapplying the same remote move.
- **Validation**:
  - Add host regression for duplicate `transportMessageId`.

### Task 2.2: Validate inbound moves against match, turn, and board snapshot

- **Location**: `rooms/game-room/host/index.js`
- **Description**: Reject inbound remote moves unless `provider`, `matchId`, `turnIndex`, expected board hash, and active remote identity all match the current active match.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Valid move still advances the board.
  - Delayed move for the same match but old turn is blocked or ignored safely.
  - Wrong-board replay no longer depends only on cell occupancy.
- **Validation**:
  - Add host regressions for stale move, duplicate move, wrong identity, wrong `matchId`, and wrong `turnIndex`.

### Task 2.3: Keep sync-layer dedupe and host-layer dedupe complementary

- **Location**: `electron/us1-conversation-service.ts`, `rooms/game-room/host/index.js`
- **Description**: Make the sync layer continue deduping fetched mail while the host remains the final authority for gameplay reapplication safety.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Duplicate fetch does not cause duplicate command projection.
  - Even if projection repeats, host state still blocks replay.
- **Validation**:
  - Add service + host combined regression cases.

## Sprint 3: Make Reset Symmetric and User-Safe

**Goal**: Ensure local reset and remote reset cleanly terminate pending or active XOX state on both sides.

**Demo/Validation**:

- Local reset during pending invite notifies the remote side.
- Local reset during active match notifies the remote side.
- Inbound remote reset returns the local room to safe idle copy.

### Task 3.1: Send outbound remote reset on local `GameRoomXoxReset`

- **Location**: `rooms/game-room/host/index.js`, `rooms/game-room/manifest.json`
- **Description**: When the active target is `us1` and there is a pending or active match, send a lifecycle `reset` event before clearing local state.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Local reset emits outbound reset only when a US1 match context exists.
  - Plain local idle reset remains a no-op for remote transport.
- **Validation**:
  - Add host regression for pending invite reset and active match reset.

### Task 3.2: Handle inbound remote reset consistently

- **Location**: `rooms/game-room/host/index.js`, `rooms/game-room/ui/index.js`, `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- **Description**: Apply inbound reset to pending or active match state and present actionable status copy instead of silent disappearance.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Inbound reset clears pending invite or active board safely.
  - UI status makes it clear that the remote side ended the match.
- **Validation**:
  - Add host/UI regression snapshots for remote reset.

### Task 3.3: Remove phantom invite/match state from inbox projections

- **Location**: `electron/us1-conversation-service.ts`, `rooms/game-room/host/index.js`
- **Description**: Ensure `reset` clears room inbox/pending projections for the affected match where appropriate, without deleting unrelated invites from other remote accounts.
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Reset only affects the addressed `matchId`.
  - Multi-account invite inbox remains intact for unrelated remote users.
- **Validation**:
  - Add service regression for targeted reset clearing.

## Sprint 4: Align Plan, Docs, and Regression Surface

**Goal**: Remove the remaining plan/code drift so future work uses the right contract.

**Demo/Validation**:

- Plan and code describe the same transport model.
- Room-page tests explicitly cover `slots.us1`.
- Remote transport docs exist for invite/accept/reject/reset/move.

### Task 4.1: Update the original XOX US1 plan to reflect the canonical transport split

- **Location**: `xox-us1-remote-user-plan.md`
- **Description**: Revise the earlier plan so it no longer claims invite/accept/reject are pure `++cmd` flows and no longer says only the active binding is in scope for invite inbox.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Plan text matches the implementation target.
  - Known stale assumptions are removed.
- **Validation**:
  - Manual cross-check against implementation files.

### Task 4.2: Add explicit remote XOX transport documentation

- **Location**: `rooms/game-room/protocols/`, optionally `rooms/game-room/manifest.json`
- **Description**: Add a concise transport spec documenting:
  - lifecycle events: invite/accept/reject/reset
  - move command format
  - `matchId`
  - `turnIndex`
  - board precondition metadata
  - dedupe expectations
- **Dependencies**: Sprint 1, Sprint 2, Sprint 3
- **Acceptance Criteria**:
  - Contributors can understand the canonical mail contract without reverse-engineering host code.
  - AI-only protocol docs remain unchanged except where note-preface behavior is referenced.
- **Validation**:
  - Review doc against host and service payload builders.

### Task 4.3: Add the missing room-page `US1` regression coverage

- **Location**: `scripts/tests/room-page-regressions.test.ts`, `src/js/pages/room-page.ts`
- **Description**: Extend regression coverage so host-context/runtime payloads explicitly assert `slots.us1`, remote identity fields, and readiness state.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Test fails if future edits drop `US1` from room context again.
- **Validation**:
  - Run room-page regression suite.

### Task 4.4: Expand end-to-end remote lifecycle regression coverage

- **Location**: `scripts/tests/game-room-xox-host-regressions.test.ts`, `scripts/tests/us1-conversation-service-regressions.test.ts`
- **Description**: Add follow-up regressions for:
  - duplicate transport replay
  - stale move by old turn index
  - outbound reset
  - inbound reset
  - reset clearing the correct invite only
- **Dependencies**: Sprint 2, Sprint 3
- **Acceptance Criteria**:
  - The current review findings each map to at least one automated regression.
- **Validation**:
  - Run targeted suites plus `npm run typecheck`.

## Testing Strategy

- Mandatory targeted suites:
  - `scripts/tests/game-room-xox-host-regressions.test.ts`
  - `scripts/tests/us1-conversation-service-regressions.test.ts`
  - `scripts/tests/room-command-registry-regressions.test.ts`
  - `scripts/tests/room-page-regressions.test.ts`
  - `scripts/tests/room-manifest-regressions.test.ts`
- Mandatory type safety:
  - `npm run typecheck`
- Manual smoke after Sprint 3:
  - local invite to US1
  - remote accept
  - one valid move each side
  - local reset
  - remote reset
  - duplicate or delayed move injection sanity check if tooling allows

## Potential Risks & Gotchas

- Adding `matchId` too abruptly can break current invite-list rendering if the compatibility alias is not handled carefully.
- Host-side dedupe must not accidentally swallow a valid move after a reset/new match with the same remote user.
- Reset projection must target only the active match; multi-account invite inbox must remain aggregate-safe.
- Board hash validation must stay deterministic and cheap so it does not introduce serialization drift between local and remote sides.
- Updating docs without fixing runtime first will create a second round of plan/code drift.

## Rollback Plan

- If replay hardening introduces false positives, keep `matchId` and transport metadata types but temporarily relax host rejection back to current `inviteId + turn` behavior behind one helper.
- If remote reset causes interoperability issues, disable outbound reset emission while preserving inbound reset parsing for forward compatibility.
- Keep the existing invite inbox projection and AI protocol-preface seam intact even if hardening work is partially rolled back.
