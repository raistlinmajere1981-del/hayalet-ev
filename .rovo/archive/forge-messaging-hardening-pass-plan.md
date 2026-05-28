# Plan: Forge + Messaging Hardening Pass

**Generated**: 2026-04-19
**Estimated Complexity**: High

## Overview
This pass hardens two already-working but still loose systems into a revision-bound, allowlist-serialized, idempotent, immutable-snapshot workflow:

- Forge Room host/runtime flow in `rooms/forge-room/host/*` and `rooms/forge-room/shared/*`
- Central message send/read bridge in `src/js/modules/commands/slot-bridge.ts`, `src/js/modules/webview/conversation-syncer.ts`, `electron/database/sqlite-archive.ts`, and `electron/us1-conversation-service.ts`

Current repo shape suggests these main seams:

- Forge orchestration is concentrated in `rooms/forge-room/host/runtime.ts`
- Preflight bundle assembly and invalidation live in `rooms/forge-room/host/forge-preflight-runtime.ts` and `rooms/forge-room/host/forge-preflight-invalidation.ts`
- AI-stage prompt/build/parse logic is split across `forge-breakdown-runtime.ts`, `forge-task-runtime.ts`, `forge-synthesis-runtime.ts`, and `forge-handoff-export.ts`
- Runtime/session state is normalized in `rooms/forge-room/host/state/forge-runtime-state.ts`
- Message dispatch/wait flow is driven by `src/js/modules/commands/slot-bridge.ts`
- Read-path persistence and dedupe currently rely on `src/js/modules/webview/conversation-syncer.ts` and `electron/database/sqlite-archive.ts`
- US1 has a separate but related ingest/project/archive path in `electron/us1-conversation-service.ts`

This plan intentionally excludes session switching and active target rebinding races. Nothing in this pass should widen that scope.

## Prerequisites
- Work only in workspace room sources under `rooms/forge-room`; do not peer-edit `data/rooms/forge-room`
- Preserve backward-compatible session loading where possible; old sessions may be invalidated, but they should not crash hydration
- Keep `runSignature` only as a derived display/provenance helper if retained; revision enforcement should move to `runId` + `contextDigest`
- Prefer additive, low-risk migrations in persistence layers before destructive rewrites
- Prefer an additive append-only broker event ledger beside existing archive message rows if ordering/idempotency cannot be enforced safely from current `messages` records alone
- Validate with:
- `npm run typecheck`
- `npm run rooms:test:file -- scripts/tests/forge-room-preflight-v2-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/forge-room-synthesis-runtime-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/conversation-syncer-regressions.test.ts`
- `npm run rooms:test:file -- scripts/tests/us1-conversation-service-regressions.test.ts`

## Sprint 1: Revision Backbone
**Goal**: Introduce an explicit run-scoped revision contract and separate mutable runtime/UI state from immutable run state.
**Demo/Validation**:
- Forge snapshots expose run metadata without reusing mutable live objects
- `contextDigest` is deterministic for the same input and changes for the requested fields
- Existing Forge state hydration still works, but legacy preflight/session data is clearly invalidated instead of silently reused

### Task 1.1: Add Revision Types and Session Schema Fields
- **Location**: `rooms/forge-room/shared/types/forge-preflight.ts`, `rooms/forge-room/shared/types/forge-session.ts`, `rooms/forge-room/shared/types/forge-workflow.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/shared/ui/state.ts`
- **Description**: Add first-class `runId`, `contextDigest`, `sessionRevision`, `preflightId`, and `synthesisId` fields to the Forge session/runtime contracts, plus explicit immutable snapshot metadata for synthesis/export provenance.
- **Complexity**: 6
- **Dependencies**: None
- **Acceptance Criteria**:
  - Forge session and runtime types distinguish current mutable runtime state from immutable run-scoped artifacts
  - UI snapshot types can surface revision metadata without requiring live mutable references
  - Null, absent, and explicit-none states remain distinguishable in type shape
  - Session schema/version upgrades include an explicit legacy invalidation or migration path
- **Validation**:
  - Extend `scripts/tests/forge-room-preflight-v2-regressions.test.ts`
  - Extend `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`

### Task 1.2: Add Canonical Digest and Revision Helper Module
- **Location**: new `rooms/forge-room/host/forge-context-digest.ts`, new `rooms/forge-room/host/forge-revision-assertions.ts`, `rooms/forge-room/host/forge-run-signature.ts`
- **Description**: Implement canonical serialization and hashing for Forge run inputs. Digest input must include goal, target room, selected session context, run overrides, selected operator subset, and preflight input fields. Keep `runSignature` separate from enforcement logic.
- **Complexity**: 7
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `buildContextDigest(...)` is deterministic and order-stable
  - Digest changes when any scoped input changes and remains stable for semantically identical input
  - `runSignature` no longer acts as the enforcement primitive
- **Validation**:
  - Add dedicated digest determinism tests in `scripts/tests/forge-room-preflight-v2-regressions.test.ts`

### Task 1.3: Split Runtime Dispatch State from Immutable Run Artefacts
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/state/forge-runtime-actions.ts`, `rooms/forge-room/host/state/forge-selectors.ts`, `rooms/forge-room/shared/ui/host-messages.ts`
- **Description**: Refactor runtime state updates so UI-friendly snapshot shape, live dispatch state, and immutable run artefact state are not passed around as the same object graph.
- **Complexity**: 8
- **Dependencies**: Task 1.1, Task 1.2
- **Acceptance Criteria**:
  - Stage transitions do not reuse broad mutable objects across runs
  - Historical run data survives later live-state edits without aliasing
  - Snapshot sanitization keeps only safe UI-facing fields
- **Validation**:
  - Extend `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - Extend `scripts/tests/forge-room-host-messages-regressions.test.ts`

## Sprint 2: Freshness Enforcement and Allowlist Serializers
**Goal**: Turn preflight freshness into a hard gate and replace broad runtime payload reuse with stage-specific serializers.
**Demo/Validation**:
- Draft generation is rejected when preflight digest is stale or mismatched
- AI0, AI1, AI2, and export payloads all come from dedicated serializers
- Blank/unset profile data is omitted instead of default-filled

### Task 2.1: Replace Soft Invalidation with Hard Freshness Assertions
- **Location**: `rooms/forge-room/host/forge-preflight-invalidation.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Add `assertFreshPreflight(...)` and `getPreflightForRun(runId, contextDigest)` and wire them so draft generation, assignment dispatch, synthesis generation, and AI0 result reuse are rejected on stale digest mismatch unless an explicit bypass is added later.
- **Complexity**: 8
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Draft generation cannot start against stale/mismatched preflight
  - AI0 output is accepted only when `runId` + `contextDigest` match
  - Runtime returns explicit failure states for stale preflight rather than “warning and continue”
- **Validation**:
  - Add `rejects_draft_when_preflight_digest_mismatch`
  - Add `marks_preflight_stale_on_selected_context_change`
  - Add `does_not_reuse_ai0_output_after_digest_change`

### Task 2.2: Add Stage-Specific Forge Serializers
- **Location**: new `rooms/forge-room/host/forge-stage-serializers.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`, `rooms/forge-room/host/forge-breakdown-runtime.ts`, `rooms/forge-room/host/forge-task-runtime.ts`, `rooms/forge-room/host/forge-synthesis-runtime.ts`, `rooms/forge-room/host/forge-handoff-export.ts`
- **Description**: Implement `serializeForAI0(...)`, `serializeForAI1(...)`, `serializeForAI2(...)`, and `serializeForExport(...)` with strict allowlists. Remove broad object spread/pass-through into provider-facing payloads.
- **Complexity**: 9
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Only selected session context reaches providers
  - Raw capsule internals do not go out by default
  - `brandModel`, `notes`, and internal architecture summary are opt-in, not ambient
  - Missing or empty fields are omitted instead of fake-defaulted
- **Validation**:
  - Add `blank_profile_serializes_as_absent`
  - Add `selected_context_only_reaches_provider`

### Task 2.3: Apply Blank/Unset/Explicit-None Semantics Consistently
- **Location**: `rooms/forge-room/shared/types/forge-preflight.ts`, `rooms/forge-room/host/forge-preflight-metadata.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/shared/ui/host-messages.ts`
- **Description**: Normalize all Forge operator/session-context serialization paths so absent fields, explicit none, selected-but-empty, and selected-with-value remain distinct.
- **Complexity**: 6
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Empty profile does not synthesize fake skills/equipment/preferences
  - Unset mode/risk is omitted
  - Selected empty values remain distinguishable from absent selection
- **Validation**:
  - Extend `scripts/tests/forge-room-preflight-v2-regressions.test.ts`
  - Extend `scripts/tests/forge-room-host-messages-regressions.test.ts`

## Sprint 3: Run-Scoped Artefact Isolation and Immutable Export
**Goal**: Ensure all AI artefacts are keyed by run, and exports are built only from immutable synthesis snapshots.
**Demo/Validation**:
- New run or digest change resets the right artefacts without mutating prior snapshots
- Export resolves only from `synthesisId`
- Changing current goal/context/notes after synthesis does not alter earlier exports

### Task 3.1: Introduce a Run-Scoped Forge Artefact Store
- **Location**: new `rooms/forge-room/host/forge-run-artifact-store.ts`, `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/host/forge-session-storage.ts`
- **Description**: Move AI0 pre-analysis output, selected capsule state, draft artefacts, review artefacts, decision trace, synthesis snapshot, and export source snapshot to run-keyed storage rather than session-wide loose fields.
- **Complexity**: 8
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Artefact store keys are run-centric, not session-centric
  - New run clears or isolates prior artefacts correctly
  - Null state and not-available state are modeled separately
- **Validation**:
  - Add `run_artifacts_are_run_scoped`
  - Extend `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`

### Task 3.2: Create Immutable Synthesis Snapshots
- **Location**: new `rooms/forge-room/host/forge-synthesis-snapshot.ts`, `rooms/forge-room/host/forge-synthesis-runtime.ts`, `rooms/forge-room/host/forge-task-runtime.ts`
- **Description**: Add `createSynthesisSnapshot(...)` and `computeSnapshotHash(...)`, deep-clone/freeze synthesis data at creation time, and bind decision trace plus provenance to the same revision boundary.
- **Complexity**: 7
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Synthesis snapshot contains frozen export-ready data plus provenance hash
  - Decision trace and synthesis snapshot share the same revision metadata
  - Later runtime edits cannot mutate previous snapshot content
- **Validation**:
  - Add `decision_trace_and_snapshot_share_same_revision`
  - Add `post_synthesis_edits_do_not_change_previous_export`

### Task 3.3: Export Only from Immutable Synthesis Snapshots
- **Location**: `rooms/forge-room/host/forge-handoff-export.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Replace live-state export construction with `exportFromSynthesisSnapshot(...)`, require `synthesisId` lookup, and include snapshot hash/provenance in exported payloads.
- **Complexity**: 8
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Export no longer builds from `createForgeSessionFromRuntimeState(state, ...)` as the primary source of truth
  - Export fails if the requested synthesis snapshot does not exist or does not belong to the owner/run
  - Temporary runtime fallback text and internal warnings do not leak into export body
- **Validation**:
  - Add `export_uses_immutable_snapshot`
  - Extend `scripts/tests/forge-room-preflight-v2-regressions.test.ts`

## Sprint 4: Messaging Idempotency and Ordered Event Application
**Goal**: Make broker send/read flows idempotent, sequence-aware, and identity-merged without addressing session switching.
**Demo/Validation**:
- Retrying the same send request does not duplicate provider work
- Duplicate provider events are dropped
- Out-of-order events are applied only in sequence

### Task 4.1: Define Broker Envelope Identity and Sequence Contract
- **Location**: `src/js/modules/commands/slot-bridge.ts`, `src/js/pages/room-page/runtime-messaging.ts`, `electron/us1-conversation-service.ts`, new shared broker/event types if needed under `shared/`
- **Description**: Standardize `clientRequestId`, `brokerMessageId`, `providerMessageId`, `eventSeq`, `conversationId`, and `slotId` across send/wait/read paths.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - `clientRequestId` is mandatory on send path
  - `brokerMessageId` is generated centrally
  - Reply-wait logic can correlate broker identity without relying only on textual request markers
- **Validation**:
  - Add contract-focused tests in `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts` where Forge uses `message.sendWait`
  - Add targeted messaging tests under `scripts/tests/conversation-syncer-regressions.test.ts`

### Task 4.2: Harden Send Path Idempotency
- **Location**: `src/js/modules/commands/slot-bridge.ts`, `src/js/modules/webview/message-sender.ts`, `electron/us1-conversation-service.ts`
- **Description**: Ensure retries with the same `clientRequestId` reuse the same broker state/result and do not trigger a second provider send.
- **Complexity**: 8
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Duplicate send attempts short-circuit against stored request identity
  - `message.sendWait` retains idempotent semantics through retry and poll paths
  - US1 and AI-slot send paths share the same identity guarantees even if implemented with different adapters
- **Validation**:
  - Add `retry_send_is_idempotent_with_same_clientRequestId`
  - Extend `scripts/tests/us1-conversation-service-regressions.test.ts`

### Task 4.3: Move Read Path to Sequence-Driven Merge Discipline
- **Location**: `src/js/modules/webview/conversation-syncer.ts`, `electron/database/sqlite-archive.ts`, `electron/database/message-dedupe.ts`, `electron/us1-conversation-service.ts`
- **Description**: Introduce append/sequence semantics and identity-based merge rules so duplicate events are dropped and out-of-order arrivals are buffered or rejected instead of timestamp-merged. If current archive rows cannot safely hold this contract, add an append-only broker/provider event ledger and project UI-ready message state from it.
- **Complexity**: 9
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Read path supports incremental `afterSeq`-style application
  - Duplicate events are identified by broker/provider identity, not just `domIndex` or timestamp
  - Message merge logic does not use timestamp precedence as the primary rule
  - Persistence ordering is separated from UI render ordering
- **Validation**:
  - Add `duplicate_provider_event_is_dropped`
  - Add `out_of_order_events_apply_in_sequence`
  - Add `merge_uses_message_identity_not_timestamp`

## Sprint 5: Auth Boundary, Ownership Scope, Logging, and Regression Closure
**Goal**: Eliminate client-trust shortcuts, add structured diagnostics, and close the pass with full regression coverage.
**Demo/Validation**:
- Foreign synthesis/export access is rejected
- Provider resolution is server-side or owner-scoped at privileged boundaries
- Structured logs expose revision and broker fields for debugging

### Task 5.1: Enforce Owner-Scoped Artefact and Provider Access
- **Location**: `src/js/modules/commands/slot-bridge.ts`, `src/js/modules/app-state.ts`, `src/js/modules/slot-presence-store.ts`, `electron/handlers/ipc-provider.ts`, `electron/database/index.ts`, `electron/us1-conversation-service.ts`
- **Description**: Audit and harden all places where provider identity, slot ownership, or synthesis/export access currently relies on client-submitted values. Resolve privileged provider/account ownership server-side wherever possible.
- **Complexity**: 9
- **Dependencies**: Sprint 3, Sprint 4
- **Acceptance Criteria**:
  - Client `providerKey` or session identity is not treated as trusted authority
  - Export/synthesis/run artefact access is owner-scoped
  - Foreign provider or foreign artefact usage is blocked with explicit error paths
- **Validation**:
  - Add `cannot_export_foreign_synthesis`
  - Add `provider_credentials_are_server_resolved`
  - Add `artifact_queries_are_owner_scoped`

### Task 5.2: Add Structured Logging for Revision and Broker Debugging
- **Location**: `rooms/forge-room/host/runtime.ts`, `rooms/forge-room/host/forge-preflight-runtime.ts`, `rooms/forge-room/host/forge-handoff-export.ts`, `src/js/modules/commands/slot-bridge.ts`, `electron/database/sqlite-archive.ts`, `electron/us1-conversation-service.ts`
- **Description**: Emit structured logs for stale preflight rejects, digest mismatch, duplicate drops, out-of-order events, export snapshot hashes, and owner-scope violations using the requested field set.
- **Complexity**: 6
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Critical flows log `userId`, `runId`, `contextDigest`, `preflightId`, `synthesisId`, `exportId`, `clientRequestId`, `brokerMessageId`, `eventSeq`, `provider`, and `slotId` when available
  - Duplicate/out-of-order/stale-path failures become diagnosable without replaying the full session
- **Validation**:
  - Targeted assertions in regression tests where logs are observable
  - Manual smoke against failure branches during implementation

### Task 5.3: Expand and Finalize Regression Coverage
- **Location**: `scripts/tests/forge-room-preflight-v2-regressions.test.ts`, `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`, `scripts/tests/forge-room-synthesis-runtime-regressions.test.ts`, `scripts/tests/forge-room-host-messages-regressions.test.ts`, `scripts/tests/conversation-syncer-regressions.test.ts`, `scripts/tests/us1-conversation-service-regressions.test.ts`, and any new focused test files needed
- **Description**: Add the requested Forge, messaging, and auth-boundary regression cases and make the pass releasable only when the targeted suites and full typecheck are green.
- **Complexity**: 8
- **Dependencies**: All previous sprints
- **Acceptance Criteria**:
  - All requested tests from the hardening brief exist
  - Validation commands are documented and runnable per sprint
  - Scope-excluded session switching tests are not added in this pass
- **Validation**:
  - `npm run rooms:test:file -- <targeted test files>`
  - `npm run typecheck`

## Testing Strategy
- Start with low-level deterministic tests for digesting, serializer omission rules, and snapshot hashing
- Add runtime-flow tests for Forge host commands rather than only unit-testing helpers
- Add send/retry/read tests around `slot-bridge`, `conversation-syncer`, `sqlite-archive`, and `us1-conversation-service` to prove idempotency and ordering
- Keep session switching explicitly out of the matrix for this pass
- Run targeted suites per sprint, then finish with:
- `npm run typecheck`
- `npm run rooms:test:file -- scripts/tests/forge-room-preflight-v2-regressions.test.ts scripts/tests/forge-room-host-runtime-flow-regressions.test.ts scripts/tests/forge-room-synthesis-runtime-regressions.test.ts scripts/tests/conversation-syncer-regressions.test.ts scripts/tests/us1-conversation-service-regressions.test.ts`

## Potential Risks & Gotchas
- `runSignature` currently appears in UI/provenance and may be mistaken for the new enforcement primitive. Keep it derived and non-authoritative.
- Legacy Forge sessions may deserialize into incomplete revision state. Plan for explicit invalidation, not silent coercion.
- `exportHandoff()` currently rebuilds a session from live runtime state. That coupling must be removed before export hardening is considered complete.
- `conversation-syncer` and `sqlite-archive` currently dedupe by DOM identity or hash/index pairs. That is insufficient for broker-level idempotency and sequence ordering.
- `slot-bridge` wait logic still uses request markers and archived reply polling. Idempotent broker identity should be layered in without widening to session rebinding logic.
- US1 mail ingest and AI-slot webview ingest are not the same transport. Apply one contract, but keep adapter-specific implementations.
- Moving credential/provider resolution to the server side may force some logic out of renderer utilities and into Electron handlers.
- Deep clone/freeze boundaries can expose hidden mutation assumptions in Forge UI/runtime code. Expect follow-up cleanup in selectors and snapshot sanitizers.
- Logging volume can spike if every poll path logs full detail. Restrict structured logs to state transitions and exceptional branches.
- Session switching risks remain open by design. The plan must avoid “small incidental fixes” that accidentally pull them back into scope.

## Out of Scope for This Pass
- Session switching
- Active target rebinding during a switch
- Session delete/tombstone behavior
- Any transport redesign whose only purpose is switch-time recovery

## Rollback Plan
- Keep schema changes additive first; preserve legacy field readers until the new path is proven
- Gate new revision assertions behind clear runtime branches during implementation so a partial rollback can re-enable legacy read-only behavior if needed
- If the new message sequencing layer causes regressions, disable new merge/apply logic before removing the old dedupe path
- If snapshot export breaks downstream import, keep prior export writer available temporarily behind a non-default compatibility path only for local recovery
- Revert by sprint boundary, not by file, so partially landed revision/auth/persistence changes do not leave mixed invariants behind

## Planned Deliverable Mapping
- System architecture short summary: this document Overview
- Changed files: each sprint task lists primary file surfaces
- Revision model: Sprint 1 and Sprint 2
- Provider serializer changes: Sprint 2
- Messaging ordering/idempotency: Sprint 4
- Export snapshot safety: Sprint 3
- Auth boundary fixes: Sprint 5
- Added tests: Sprint 5.3
- Conscious session-switch exclusions: Out of Scope section
- Remaining risks: Potential Risks & Gotchas section
