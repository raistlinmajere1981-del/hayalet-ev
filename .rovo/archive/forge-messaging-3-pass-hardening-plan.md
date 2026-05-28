# Plan: Forge Messaging 3 Pass Hardening

**Generated**: 2026-04-20
**Estimated Complexity**: High

## Overview

This plan hardens the existing Forge Room and central messaging surfaces without adding new features, rooms, or UI redesign work. The goal is to move the current system from "appears to work" toward a revision-bound, allowlist-serialized, idempotent, and immutable-snapshot-driven architecture.

The work is intentionally split into three reviewable passes:

- Pass 1 locks Forge correctness around revision tracking, stale preflight rejection, serializer boundaries, immutable export snapshots, and run-scoped AI artefacts.
- Pass 2 hardens the broker and sync path against duplicate sends, duplicate provider events, out-of-order delivery, and timestamp-based merge drift.
- Pass 3 narrows trust boundaries, makes owner/provider resolution server-side, clarifies blank/unset semantics, and improves structured logs plus regression coverage.

The repo already contains relevant seams in `rooms/forge-room/host/*`, `rooms/forge-room/shared/types/*`, `electron/database/*`, `electron/us1-conversation-service.ts`, `src/js/modules/commands/slot-bridge.ts`, `src/js/modules/webview/conversation-syncer.ts`, and `scripts/tests/*`. This plan assumes those seams are the primary integration surface and avoids broad rewrites.

## Scope Constraints

- In scope: correctness, provenance safety, idempotency, ordering, owner/provider trust boundary, regression coverage, structured logging.
- Out of scope: session switching and central session management, new UI redesign, AI0 execution handoff, new room features, broad architectural rewrite.
- Guardrail: Pass 1 must be completed and validated before Pass 2 work begins; Pass 2 must stabilize before Pass 3 expands observability and trust-boundary coverage.

## Prerequisites

- Existing Forge runtime and state seams remain the source of truth:
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/state/forge-runtime-state.ts`
  - `rooms/forge-room/host/forge-preflight-runtime.ts`
  - `rooms/forge-room/host/forge-stage-serializers.ts`
  - `rooms/forge-room/host/forge-run-artifact-store.ts`
  - `rooms/forge-room/host/forge-synthesis-snapshot.ts`
- Existing messaging and auth seams remain the source of truth:
  - `electron/database/sqlite-archive.ts`
  - `electron/database/sqlite-manager.ts`
  - `electron/us1-conversation-service.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/webview/conversation-syncer.ts`
- Existing regression surfaces will be extended before new suites are invented:
  - `scripts/tests/forge-room-hardening-regressions.test.ts`
  - `scripts/tests/messaging-broker-regressions.test.ts`
  - `scripts/tests/slot-bridge-regressions.test.ts`
  - `scripts/tests/conversation-syncer-regressions.test.ts`
  - `scripts/tests/us1-conversation-service-regressions.test.ts`
- Baseline validation commands:
  - `npm run typecheck`
  - `TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx --test scripts/tests/forge-room-hardening-regressions.test.ts`
  - `TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx --test scripts/tests/messaging-broker-regressions.test.ts`
  - `TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx --test scripts/tests/slot-bridge-regressions.test.ts`
  - `TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx --test scripts/tests/conversation-syncer-regressions.test.ts`
  - `TSX_TSCONFIG_PATH=src/tsconfig.json node --import tsx --test scripts/tests/us1-conversation-service-regressions.test.ts`

## Cross-Pass Contracts

### Authoritative Identity Matrix

| Boundary                   | Authoritative IDs                                                                   | Allowed Inputs                                                                                  | Reject / Invalidate When                                                   |
| -------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Forge preflight build      | `runId`, `contextDigest`, `sessionRevision`                                         | goal, target room, selected session context, run override, operator selection, preflight inputs | canonical digest input changes without rebuild                             |
| Forge draft or AI dispatch | `runId`, `contextDigest`, `preflightId`, `sessionRevision`                          | fresh preflight for the active run only                                                         | stale preflight, digest mismatch, run mismatch                             |
| Forge synthesis            | `runId`, `contextDigest`, `preflightId`, `sessionRevision`, `synthesisId`           | approved tasks, selected responses, decision trace from the active run only                     | any draft, response, or trace comes from another run or digest             |
| Forge export               | `synthesisId`, `snapshotHash`, `runId`, `contextDigest`, `ownerScopeId`, `exportId` | immutable synthesis snapshot only                                                               | live-state lookup, foreign owner scope, missing provenance                 |
| Messaging send             | `clientRequestId`, `brokerMessageId`, owner-scoped provider or slot binding         | validated outbound payload and server-resolved binding                                          | duplicate retry tries to create new provider work, or binding is ambiguous |
| Messaging persistence      | `conversationId`, `providerMessageId` or `brokerMessageId`, append `eventSeq`       | normalized synced event                                                                         | duplicate provider event, timestamp-only merge, projection rollback        |
| Messaging incremental read | `conversationId`, `afterSeq`, owner or account scope                                | persisted rows only                                                                             | duplicate replay, out-of-scope read, non-monotonic replay                  |

### Export Provenance Minimum Schema

- Every exportable snapshot must preserve at least:
  - `ownerScopeId`
  - `runId`
  - `contextDigest`
  - `sessionRevision`
  - `preflightId`
  - `synthesisId`
  - `snapshotHash`
  - `exportId` once export occurs
  - immutable or read-only creation timestamp
- Export lookups must stay queryable by `synthesisId` plus owner scope without falling back to live runtime state.

### Blank and Unset Serialization Contract

| Field Family                                   | Absent          | Explicit None                                    | Selected Empty                                                        | Compatibility Rule                    |
| ---------------------------------------------- | --------------- | ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------- |
| Operator skills or equipment                   | omit field      | preserve only if contract explicitly models none | preserve empty list only when the UI explicitly selected the category | no fake defaults                      |
| Preference fields like mode or risk            | omit field      | preserve explicit enum only if supported         | omit                                                                  | no fallback mode/risk injection       |
| Sensitive fields like `brandModel` and `notes` | omit by default | not serialized unless explicitly allowed         | omit                                                                  | opt-in only                           |
| Raw context capsule body                       | omit by default | n/a                                              | omit                                                                  | send only allowlisted summaries       |
| Internal metadata or architecture notes        | omit by default | n/a                                              | omit                                                                  | allowlist only, no broad pass-through |

### Early Shared Log Contract

- Minimal shared log schema should land as early as Pass 1 so later hardening failures are diagnosable.
- Recommended event codes:
  - `forge.preflight.stale_reject`
  - `forge.context.digest_mismatch`
  - `forge.snapshot.created`
  - `broker.duplicate_drop`
  - `broker.out_of_order`
  - `auth.owner_scope_violation`
- Common fields:
  - `userId`
  - `runId`
  - `contextDigest`
  - `preflightId`
  - `synthesisId`
  - `exportId`
  - `clientRequestId`
  - `brokerMessageId`
  - `eventSeq`
  - `slotId`
  - `provider`

## Sprint 1: Pass 1 - Correctness Lock

**Goal**: Lock Forge runtime behavior to an explicit run revision model and stop stale or over-broad state from reaching providers or exports.

**Demo/Validation**:

- Create or mutate a Forge goal/context and verify a digest change invalidates stale preflight and AI0 reuse.
- Generate synthesis, then mutate live state and verify previous export remains unchanged.
- Run `forge-room-hardening-regressions.test.ts` and targeted Forge host runtime regressions.

### Task 1.1: Audit current Forge revision chain

- **Location**:
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/state/forge-runtime-state.ts`
  - `rooms/forge-room/shared/types/forge-session.ts`
  - `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Trace where `runId`, `contextDigest`, `sessionRevision`, `preflightId`, and `synthesisId` are created, persisted, mutated, and read. Document any path that still falls back to session-wide state or stale mutable objects.
- **Complexity**: 4/10
- **Dependencies**: None
- **Acceptance Criteria**:
  - All Forge stage transitions have a clear revision tuple.
  - Session-level reuse points are identified before enforcement changes start.
  - UI state versus runtime dispatch state boundaries are explicitly listed.
  - A stage-by-stage authoritative id matrix and shared log event-code set are written down before behavior changes begin.
- **Validation**:
  - Manual code audit notes in commit/PR description.
  - `rg -n "runId|contextDigest|sessionRevision|preflightId|synthesisId" rooms/forge-room`

### Task 1.2: Enforce canonical runId + contextDigest boundaries

- **Location**:
  - `rooms/forge-room/host/forge-context-digest.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/forge-preflight-runtime.ts`
  - `rooms/forge-room/shared/types/forge-preflight.ts`
  - `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Centralize canonical digest production and ensure draft generation, assignment dispatch, synthesis, and export only proceed when `runId + contextDigest` match the active run.
- **Complexity**: 7/10
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Digest input is canonical and includes goal, target room, selected session context, run override, operator selection, and relevant preflight input.
  - Digest drift invalidates older preflight/draft/synthesis chains.
  - AI0 output cannot be consumed across a digest change.
  - Boundary-specific mismatch handling is explicit for preflight, draft, synthesis, and export entry points.
- **Validation**:
  - `forge-room-hardening-regressions.test.ts`
  - `forge-room-host-runtime-flow-regressions.test.ts`

### Task 1.3: Convert stale preflight from UI hint to hard gate

- **Location**:
  - `rooms/forge-room/host/forge-preflight-runtime.ts`
  - `rooms/forge-room/host/forge-preflight-invalidation.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/shared/ui/host-messages.ts`
- **Description**: Make `assertFreshPreflight(...)` mandatory at draft/synthesis entry points and ensure stale mismatch returns structured runtime errors instead of soft warnings.
- **Complexity**: 6/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Draft generation rejects stale preflight unless an explicit bypass contract already exists.
  - `getPreflightForRun(runId, contextDigest)` is used instead of session-wide fallback lookups.
  - Runtime logs and UI-facing messages distinguish stale preflight from missing preflight.
- **Validation**:
  - `forge-room-hardening-regressions.test.ts`
  - Manual stale-preflight smoke through Forge runtime command path

### Task 1.4: Separate stage-specific serializers with allowlist discipline

- **Location**:
  - `rooms/forge-room/host/forge-stage-serializers.ts`
  - `rooms/forge-room/host/forge-preflight-metadata.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/shared/types/forge-preflight.ts`
- **Description**: Route AI0, AI1, AI2, and export payloads through dedicated serializers and remove any broad runtime object spread or provider pass-through.
- **Complexity**: 7/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - `serializeForAI0(...)`, `serializeForAI1(...)`, `serializeForAI2(...)`, and `serializeForExport(...)` are the only provider/export entry points.
  - Unselected operator profile data, raw context capsules, internal metadata, `brandModel`, and `notes` stay out unless explicitly allowlisted.
  - Blank profile and unset fields serialize as absent, not fake defaults.
- **Validation**:
  - `forge-room-hardening-regressions.test.ts`
  - `rg -n "\.\.\.|Object.assign|payload: state|payload: runtime" rooms/forge-room/host`

### Task 1.5: Freeze synthesis and export on immutable snapshots

- **Location**:
  - `rooms/forge-room/host/forge-synthesis-snapshot.ts`
  - `rooms/forge-room/host/forge-handoff-export.ts`
  - `rooms/forge-room/host/forge-task-runtime.ts`
  - `rooms/forge-room/host/runtime.ts`
- **Description**: Ensure synthesis generates a deep-cloned, hashed snapshot and export resolves only from that snapshot, never from the current live runtime state.
- **Complexity**: 6/10
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Snapshot hash is created at synthesis time and stored with provenance.
  - Export path resolves from `synthesisId` or snapshot identity, not live state objects.
  - Post-synthesis edits do not mutate historical export output.
- **Validation**:
  - `forge-room-hardening-regressions.test.ts`
  - `forge-room-handoff-regressions.test.ts`

### Task 1.6: Isolate AI artefacts by run scope

- **Location**:
  - `rooms/forge-room/host/forge-run-artifact-store.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/state/forge-runtime-state.ts`
  - `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Move AI0 output, selected capsules, decision trace, synthesis snapshots, and export source snapshots to run-scoped storage keyed by revision identity rather than broad session reuse, while tightening lookups and invalidation rules before considering any storage-layout migration.
- **Complexity**: 7/10
- **Dependencies**: Tasks 1.2, 1.4, 1.5
- **Acceptance Criteria**:
  - New run creation does not leak previous run artefacts into the active chain.
  - Digest changes invalidate stale AI0 output and related capsules.
  - Null state and unavailable state stay distinguishable in storage and UI contracts.
- **Validation**:
  - `forge-room-hardening-regressions.test.ts`
  - `forge-room-session-storage-regressions.test.ts`

### Task 1.7: Close Pass 1 with regression and report

- **Location**:
  - `scripts/tests/forge-room-hardening-regressions.test.ts`
  - `scripts/tests/forge-room-host-runtime-flow-regressions.test.ts`
  - `scripts/tests/forge-room-handoff-regressions.test.ts`
- **Description**: Add or update regressions for digest mismatch, stale invalidation, serializer allowlist behavior, immutable export, and run-scoped artefacts. Highest-risk assertions should land with the behavior change instead of waiting for the pass close. Produce the requested Pass 1 report format.
- **Complexity**: 5/10
- **Dependencies**: Tasks 1.3 to 1.6
- **Acceptance Criteria**:
  - Requested Forge hardening tests exist and pass.
  - Pass 1 report includes files, behavior changes, guarantees, missing guarantees, risks, and suggested next pass.
- **Validation**:
  - `npm run typecheck`
  - Targeted Forge regression suite run

## Sprint 2: Pass 2 - Central Messaging Hardening

**Goal**: Make broker send/read behavior deterministic enough to resist duplicates, retries, identity drift, and out-of-order events without expanding feature scope.

**Demo/Validation**:

- Retry the same outbound request with the same `clientRequestId` and verify it does not produce a second provider-side send.
- Sync messages with duplicate provider events and out-of-order sequences and verify append/read behavior stays stable.
- Run broker, SlotBridge, conversation-syncer, and US1 regression suites.

### Task 2.1: Audit messaging identity and ordering seams

- **Location**:
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/js/modules/webview/conversation-syncer.ts`
  - `electron/us1-conversation-service.ts`
  - `electron/database/sqlite-archive.ts`
  - `electron/database/sqlite-manager.ts`
- **Description**: Trace the lifecycle of `clientRequestId`, `brokerMessageId`, `providerMessageId`, `eventSeq`, and `afterSeq` from client send through persistence and readback.
- **Complexity**: 4/10
- **Dependencies**: Sprint 1 complete
- **Acceptance Criteria**:
  - One documented identity chain exists from outbound request to persisted event.
  - Known duplicate/ordering failure modes are mapped to specific files.
  - UI rendering state and persistence state responsibilities are separated in the audit.
  - Cache replay paths and read APIs are included in the audit, not only outbound send paths.
- **Validation**:
  - `rg -n "clientRequestId|brokerMessageId|providerMessageId|eventSeq|afterSeq" src electron`

### Task 2.2: Make send path idempotent by request identity

- **Location**:
  - `src/js/modules/commands/slot-bridge.ts`
  - `electron/us1-conversation-service.ts`
  - `src/types/commands.ts`
  - `src/types/ipc-channels.ts`
  - `src/types/us1-mail.ts`
- **Description**: Require or deterministically derive `clientRequestId`, generate `brokerMessageId`, and ensure retries resolve from idempotent cache/state instead of issuing duplicate provider work.
- **Complexity**: 7/10
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Outbound retry with the same `clientRequestId` produces one provider-side send.
  - `brokerMessageId` is generated once per logical outbound message.
  - Missing `clientRequestId` is either rejected or deterministically synthesized before send.
- **Validation**:
  - `slot-bridge-regressions.test.ts`
  - `us1-conversation-service-regressions.test.ts`

### Task 2.3: Enforce sequence-driven read path

- **Location**:
  - `electron/database/sqlite-archive.ts`
  - `electron/database/sqlite-manager.ts`
  - `src/js/modules/webview/conversation-syncer.ts`
  - `electron/types/index.ts`
- **Description**: Keep append ordering and projection ordering distinct where needed, expose incremental reads with `afterSeq`, and make out-of-order event handling predictable.
- **Complexity**: 8/10
- **Dependencies**: Tasks 2.1, 2.2
- **Acceptance Criteria**:
  - Event append order is monotonic.
  - Incremental reads return only events/messages after the requested sequence.
  - Out-of-order arrival does not corrupt latest projection for the same message identity.
- **Validation**:
  - `messaging-broker-regressions.test.ts`
  - `conversation-syncer-regressions.test.ts`

### Task 2.4: Lock merge behavior to message identity, not timestamp

- **Location**:
  - `electron/database/sqlite-archive.ts`
  - `src/js/modules/webview/conversation-syncer.ts`
  - `electron/types/index.ts`
- **Description**: Ensure message merge/update decisions key off `conversationId + providerMessageId` or `conversationId + brokerMessageId`, never off timestamp recency alone.
- **Complexity**: 6/10
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - Same logical message updates collapse correctly even when timestamps are misleading.
  - Duplicate reads do not cause the UI to show the same logical message twice.
  - Provider identity gaps fall back to broker identity rather than timestamp heuristics.
- **Validation**:
  - `messaging-broker-regressions.test.ts`
  - `conversation-syncer-regressions.test.ts`

### Task 2.5: Separate persistence discipline from UI presentation

- **Location**:
  - `src/js/modules/webview/conversation-syncer.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - `electron/database/sqlite-archive.ts`
- **Description**: Keep append-only or merge-only broker persistence rules in the backend and ensure renderer sync/render logic consumes the persisted identity model rather than reinventing merge logic, without turning this pass into a broad renderer presentation refactor.
- **Complexity**: 6/10
- **Dependencies**: Tasks 2.3, 2.4
- **Acceptance Criteria**:
  - Renderer-side dedupe does not conflict with archive identity rules.
  - UI selection/refresh logic does not mutate broker ordering.
  - Duplicate provider reads are dropped before they become duplicate UI rows.
- **Validation**:
  - `conversation-syncer-regressions.test.ts`
  - Targeted SlotBridge regression run

### Task 2.6: Close Pass 2 with regression and report

- **Location**:
  - `scripts/tests/messaging-broker-regressions.test.ts`
  - `scripts/tests/slot-bridge-regressions.test.ts`
  - `scripts/tests/conversation-syncer-regressions.test.ts`
  - `scripts/tests/us1-conversation-service-regressions.test.ts`
- **Description**: Add/update send-idempotency, duplicate drop, out-of-order sequence, and merge identity regressions. Highest-risk assertions should land with the behavior change instead of waiting for the pass close. Produce the requested Pass 2 report format.
- **Complexity**: 5/10
- **Dependencies**: Tasks 2.2 to 2.5
- **Acceptance Criteria**:
  - Requested messaging tests exist and pass.
  - Report captures new guarantees and known remaining broker/UI gaps.
- **Validation**:
  - `npm run typecheck`
  - Targeted messaging regression suite run

## Sprint 3: Pass 3 - Trust Boundary + Observability

**Goal**: Stop trusting client-selected provider/session/artifact identity, clarify blank/unset semantics, and make critical failures easier to trace in logs and tests.

**Demo/Validation**:

- Attempt forged provider/session/artifact access and verify server-side ownership checks reject or remap it.
- Verify blank or unselected fields are omitted rather than serialized as fake defaults.
- Trigger stale preflight, duplicate drop, out-of-order event, and owner-scope violations and confirm structured log fields are present.

### Task 3.1: Audit trust boundaries and owner scope contracts

- **Location**:
  - `electron/us1-conversation-service.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/forge-run-artifact-store.ts`
  - `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Identify every place client input can choose provider credentials, slot identity, local session identity, synthesis lookup, export or artifact lookup, server-side read API parameters, and cache replay access.
- **Complexity**: 4/10
- **Dependencies**: Sprint 2 complete
- **Acceptance Criteria**:
  - Each client-trusted path is mapped to a server-side resolution plan.
  - Owner-scoped contracts are explicit for run artefacts, synthesis snapshots, and export resolution.
  - False trust around UI-selected provider/session ids is listed before patching.
- **Validation**:
  - Audit notes plus targeted `rg` search

### Task 3.2: Resolve provider and ownership server-side

- **Location**:
  - `electron/us1-conversation-service.ts`
  - `src/js/modules/commands/slot-bridge.ts`
  - `src/types/ipc-channels.ts`
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/forge-run-artifact-store.ts`
- **Description**: Ensure provider credentials, outbound session mapping, and Forge artefact/export lookup resolve from server-owned bindings or owner scope, not raw client-provided ids. This task must harden existing checks without expanding into central session-switching or full session-management redesign.
- **Complexity**: 8/10
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Client-sent provider key or session identity is not trusted directly.
  - Foreign synthesis/export/artifact access is rejected or invisible across owner scope.
  - Slot/provider ownership maps are authoritative on the server side.
  - Read paths, replay paths, and export retrieval paths apply the same owner-scope rule as write paths.
- **Validation**:
  - `us1-conversation-service-regressions.test.ts`
  - `forge-room-hardening-regressions.test.ts`

### Task 3.3: Clarify blank, unset, and explicit-none semantics

- **Location**:
  - `rooms/forge-room/host/forge-stage-serializers.ts`
  - `rooms/forge-room/host/forge-preflight-metadata.ts`
  - `rooms/forge-room/shared/types/forge-preflight.ts`
  - `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Standardize absent versus selected-empty versus explicit-none behavior so providers do not receive misleading defaults.
- **Complexity**: 5/10
- **Dependencies**: Task 3.2
- **Acceptance Criteria**:
  - Blank profile fields are omitted.
  - Unselected mode/risk/equipment/skill fields are absent, not serialized as `"none"` unless explicitly represented as such.
  - Explicit-none remains distinguishable where the contract needs it.
- **Validation**:
  - `forge-room-hardening-regressions.test.ts`
  - Serializer-focused unit assertions

### Task 3.4: Add structured logs for revision, messaging, and trust-boundary failures

- **Location**:
  - `rooms/forge-room/host/runtime.ts`
  - `rooms/forge-room/host/forge-preflight-runtime.ts`
  - `electron/database/sqlite-archive.ts`
  - `electron/us1-conversation-service.ts`
  - `src/js/modules/commands/slot-bridge.ts`
- **Description**: Add structured log context for stale rejects, digest mismatches, duplicate drops, out-of-order events, snapshot hashes, and owner-scope violations.
- **Complexity**: 6/10
- **Dependencies**: Tasks 3.2, 3.3
- **Acceptance Criteria**:
  - Critical logs include `userId`, `runId`, `contextDigest`, `preflightId`, `synthesisId`, `exportId`, `clientRequestId`, `brokerMessageId`, `eventSeq`, `slotId`, and `provider` when available.
  - Log messages distinguish stale-preflight rejects from digest drift and owner-scope violations.
  - Export snapshot hash is visible in structured context when export succeeds.
- **Validation**:
  - Targeted log assertions where feasible
  - Manual smoke with log inspection

### Task 3.5: Expand regression coverage for trust boundary and observability

- **Location**:
  - `scripts/tests/forge-room-hardening-regressions.test.ts`
  - `scripts/tests/messaging-broker-regressions.test.ts`
  - `scripts/tests/slot-bridge-regressions.test.ts`
  - `scripts/tests/us1-conversation-service-regressions.test.ts`
- **Description**: Add or tighten the requested Forge, messaging, and auth regressions, including foreign-synthesis denial and owner-scoped artefact queries. Highest-risk assertions should land with the behavior change instead of waiting for the pass close.
- **Complexity**: 6/10
- **Dependencies**: Tasks 3.2 to 3.4
- **Acceptance Criteria**:
  - The requested test list from the brief is covered.
  - Observability assertions exist where structured failures are critical to debugging.
  - No session-switching tests are added in this pass.
  - Owner-scope coverage explicitly includes foreign read, foreign export, foreign artefact lookup, and replay or cache access.
- **Validation**:
  - Full targeted hardening regression run

### Task 3.6: Close Pass 3 with report and explicit non-guarantees

- **Location**:
  - `forge-messaging-3-pass-hardening-plan.md`
  - Final implementation report or PR description
- **Description**: Produce the requested Pass 3 report format and explicitly call out what still is not guaranteed so the work does not create false confidence.
- **Complexity**: 3/10
- **Dependencies**: Tasks 3.2 to 3.5
- **Acceptance Criteria**:
  - Report includes files changed, behavior changes, tests, guarantees, non-guarantees, remaining risks, and suggested next pass.
  - Remaining session-switching risk is explicitly preserved as out of scope.
- **Validation**:
  - Final review against the user brief

## Testing Strategy

- High-risk assertions should land with the matching behavior change instead of waiting only for pass-close cleanup.
- Pass 1:
  - Focus on Forge-only regression coverage and immutable export behavior.
  - Run `forge-room-hardening-regressions.test.ts`, plus any touched Forge runtime/handoff suites.
- Pass 2:
  - Focus on broker identity, append ordering, incremental reads, and renderer sync consistency.
  - Run `messaging-broker-regressions.test.ts`, `slot-bridge-regressions.test.ts`, `conversation-syncer-regressions.test.ts`, and `us1-conversation-service-regressions.test.ts`.
- Pass 3:
  - Focus on forged identity denial, owner-scoped lookup, blank/unset semantics, and structured logs.
  - Re-run all hardening suites plus any targeted log assertions introduced.
- Always run:
  - `npm run typecheck`
  - Targeted `tsx` regression commands for touched suites

### Required Regression Mapping

- Forge correctness and provenance:
  - `rejects_draft_when_preflight_digest_mismatch`
  - `marks_preflight_stale_on_selected_context_change`
  - `does_not_reuse_ai0_output_after_digest_change`
  - `blank_profile_serializes_as_absent`
  - `selected_context_only_reaches_provider`
  - `export_uses_immutable_snapshot`
  - `post_synthesis_edits_do_not_change_previous_export`
  - `decision_trace_and_snapshot_share_same_revision`
  - `run_artifacts_are_run_scoped`
  - Primary home: `scripts/tests/forge-room-hardening-regressions.test.ts`
- Messaging idempotency and ordering:
  - `retry_send_is_idempotent_with_same_clientRequestId`
  - `duplicate_provider_event_is_dropped`
  - `out_of_order_events_apply_in_sequence`
  - `merge_uses_message_identity_not_timestamp`
  - Primary homes: `scripts/tests/messaging-broker-regressions.test.ts`, `scripts/tests/slot-bridge-regressions.test.ts`, `scripts/tests/us1-conversation-service-regressions.test.ts`, `scripts/tests/conversation-syncer-regressions.test.ts`
- Auth and owner scope:
  - `cannot_export_foreign_synthesis`
  - `provider_credentials_are_server_resolved`
  - `artifact_queries_are_owner_scoped`
  - owner-scope replay and foreign-read checks
  - Primary homes: `scripts/tests/forge-room-hardening-regressions.test.ts`, `scripts/tests/us1-conversation-service-regressions.test.ts`

## Potential Risks & Gotchas

- Digest input drift can be introduced accidentally if canonical serialization and UI payload assembly diverge.
- Export can look immutable while still leaking live references if clone/freeze boundaries are inconsistent across nested objects.
- Broker ordering can appear correct in `message_events` while `messages` projection still regresses due to projection sequence handling.
- Client-generated ids can appear idempotent but still duplicate provider work if the server path derives a second identity.
- Blank/unset cleanup can accidentally break older expectations if UI code assumes fake defaults are always present.
- Logging can create noise without clarity if fields are inconsistent across Forge and messaging paths.
- Room-installed copies under `data/rooms/forge-room/*` must not become manual peer-edit targets during implementation planning; source-of-truth remains `rooms/forge-room/*`.

## Rollback Plan

- Keep each pass split into atomic commits so Pass 2 and Pass 3 can be reverted independently from Pass 1.
- If revision enforcement causes breakage, revert only the newest enforcement layer while keeping test coverage and audit notes.
- If broker ordering changes destabilize read behavior, revert the projection-update slice while preserving append-only event storage.
- If ownership hardening blocks legitimate flows, temporarily revert the access gate while retaining structured logs that expose the mismatch.

## Pass Deliverable Template

Each pass should conclude with this report shape:

1. Files changed
2. Main behavior changes
3. Tests added/updated
4. What is now guaranteed
5. What is still not guaranteed
6. Remaining risks
7. Suggested next pass

## Suggested Execution Order

1. Complete Sprint 1 and do not start broker work until Forge revision enforcement and immutable export behavior are green.
2. Complete Sprint 2 only after Pass 1 regression coverage is stable and reviewable.
3. Complete Sprint 3 only after messaging identity/order contracts stop shifting.
4. Preserve session-switching work as a separate future hardening track.
