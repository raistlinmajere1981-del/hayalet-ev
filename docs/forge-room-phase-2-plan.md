# Plan: Forge Room Phase 2 Live Loop

**Generated**: 2026-04-15  
**Estimated Complexity**: High

## Overview
Phase 2 turns the Forge Room Phase 1 skeleton into a minimally live production loop. The target is not "smart orchestration"; it is a working room-local cycle that can:

- generate a real draft breakdown from a goal
- require user approval before dispatch
- dispatch approved top-level tasks to `ai1`, `ai2`, or `us1`
- capture replies into Forge state
- group minimum conflicts when the same task has multiple responses
- generate/select a synthesis
- export a valid Repair Room handoff JSON
- reopen the session with consistent state

The plan deliberately stays inside the existing room seam:

- no global orchestration layer
- no shared-core `ai0` slot expansion
- no streaming orchestration
- no Repair Room import

## Prerequisites
- Phase 1 room package, persistence spine, reducer/store, and UI skeleton are already in place under `rooms/forge-room`.
- Existing host bridge available through `RoomHostRuntime`:
  - `dispatchBridge(...)`
  - `sendMessage(...)`
  - `sendProtocol(...)`
- Important seam:
  - current `sendProtocol(...)` helper is non-waited convenience wiring and is not sufficient by itself for waited breakdown/synthesis requests.
  - waited Forge steps should use `dispatchBridge(...)` with `message.sendWait` semantics, or a Forge-local helper built on that boundary.
- Existing SlotBridge constraint must be preserved:
  - `message.sendWait` requires exactly one target.
  - Compare mode must therefore run as two separate awaited sends in host code, not one multi-target wait.
- Existing room protocol infrastructure is available and preferable for editable prompt bodies:
  - `manifest.protocolSpecs`
  - `RoomProtocolRegistry`
- Existing bootstrap flow must remain intact:
  - `ForgeRoomUiReady` still hydrates the room shell.
  - `ForgeRoomCreateSession` remains the entrypoint for creating the active session.
  - save/load commands must stay compatible with Phase 1 room startup behavior.

## Assumptions
- We will use strict reply contracts for breakdown and synthesis steps so host parsing stays deterministic.
- We will keep assignment execution as "host sends a prompt and waits for a reply", not command-driven game-style parsing.
- If a breakdown fails validation twice, the UI must expose manual draft correction before approval.

## Sprint 1: Add Live Prompt And Command Contracts
**Goal**: Forge gains the prompt surface and room command surface required for real breakdown, assignment, synthesis, and export work.
**Demo/Validation**:
- `manifest.json` contains Forge protocol specs and new internal room-ui commands.
- Installed room sync still works.
- Targeted manifest regression passes.

### Task 1.1: Extend Forge Command Surface For Phase 2
- **Location**: `rooms/forge-room/manifest.json`, `rooms/forge-room/shared/forge-constants.ts`, `rooms/forge-room/host/forge-room-commands.ts`
- **Description**: Add explicit room-ui commands for the live loop instead of overloading the Phase 1 placeholder flow.
- **Complexity**: 4
- **Dependencies**: Phase 1
- **Acceptance Criteria**:
  - Command set includes at minimum:
    - existing bootstrap and persistence commands remain intact:
      - `ForgeRoomUiReady`
      - `ForgeRoomCreateSession`
      - `ForgeRoomSaveSession`
      - `ForgeRoomLoadLatestSession`
    - `ForgeRoomGenerateDraft`
    - `ForgeRoomApproveDraft`
    - `ForgeRoomUpdateDraftTask`
    - `ForgeRoomDispatchAssignments`
    - `ForgeRoomGenerateSynthesis`
    - `ForgeRoomSelectSynthesis`
    - `ForgeRoomExportHandoff`
    - existing save/load commands remain valid
  - Command names stay `internal`.
- **Validation**:
  - `npm run rooms:typecheck`
  - manifest regression update

### Task 1.2: Add Forge Protocol Specs For Breakdown And Synthesis
- **Location**: `rooms/forge-room/manifest.json`, `rooms/forge-room/main-functions/forge-workbench/protocols/*.md`
- **Description**: Define room-local protocol files for deterministic AI interactions.
- **Complexity**: 6
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Protocol specs exist for:
    - breakdown generation
    - task execution
    - synthesis generation
  - These manifest-backed protocol files are treated as the source of truth for prompt bodies.
  - Bodies instruct AI to return strict JSON-friendly output.
  - Phase 2 does not depend on runtime-only hidden prompt strings.
- **Validation**:
  - `npm run rooms:typecheck`
  - targeted manifest regression

### Task 1.3: Add Forge Protocol Resolver Runtime
- **Location**: `rooms/forge-room/host/protocols/forge-protocol-runtime.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Add a Forge-local resolver that loads prompt bodies through the room protocol registry instead of embedding markdown text in host code.
- **Complexity**: 5
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Breakdown, execution, and synthesis flows resolve their body from `RoomProtocolRegistry` using manifest keys/scenarios.
  - Missing protocol bodies fail as structured host errors.
  - Host builder modules receive resolved protocol text as input rather than acting as the prompt source of truth.
- **Validation**:
  - targeted protocol resolution test

### Task 1.4: Define Runtime Parse Contracts
- **Location**: `rooms/forge-room/shared/types/forge-workflow.ts`, optional `rooms/forge-room/shared/types/forge-runtime-contracts.ts`
- **Description**: Add explicit parse-time shapes for breakdown replies, execution replies, and synthesis replies.
- **Complexity**: 5
- **Dependencies**: Tasks 1.2-1.3
- **Acceptance Criteria**:
  - Parse contracts distinguish:
    - breakdown reply payload
    - execution reply payload
    - synthesis reply payload
  - Host code does not parse untyped `unknown` blobs ad hoc.
- **Validation**:
  - `npm run rooms:typecheck`

## Sprint 2: Implement Real Draft Breakdown With Validation
**Goal**: Goal input can produce a real draft task graph through a single-seat Architect request, then block or approve based on validator output.
**Demo/Validation**:
- User enters goal fields and triggers draft generation.
- Host dispatches one awaited breakdown request.
- Returned task graph is validated and written into `draftTasks`.
- Invalid drafts block approval with visible feedback.

### Task 2.1: Extend Forge Goal And Task Models For Phase 2 Control Data
- **Location**: `rooms/forge-room/shared/types/forge-goal.ts`, `rooms/forge-room/shared/types/forge-workflow.ts`
- **Description**: Add only the missing v1 control fields needed for breakdown and approval flow.
- **Complexity**: 4
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Goal includes `targetRoomId`.
  - Runtime state or approved-task metadata includes persisted dispatch preference data for:
    - dispatch mode
    - selected seats
    - selected role ids
    - selected persona preset ids
  - Task includes minimum assignment-mode metadata where appropriate, or the plan explicitly stores that separately.
  - Level-2 checklist children remain non-assignable by type or guard.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 2.2: Add Breakdown Prompt Builder And Reply Parser
- **Location**: `rooms/forge-room/host/breakdown/forge-breakdown-prompt.ts`, `rooms/forge-room/host/breakdown/forge-breakdown-parse.ts`
- **Description**: Build the outbound Architect request and parse the awaited reply into draft tasks.
- **Complexity**: 7
- **Dependencies**: Sprint 1, Task 2.1
- **Acceptance Criteria**:
  - Prompt builder includes goal summary, brief, constraints, and target room id.
  - Prompt builder consumes protocol text resolved from the Forge protocol runtime instead of hardcoding body text.
  - Parser accepts the agreed strict response shape and normalizes it into Forge tasks.
  - Parse failure is surfaced as structured validation feedback, not a silent no-op.
- **Validation**:
  - targeted breakdown parser test

### Task 2.3: Add Draft Graph Validator And Regenerate Guard
- **Location**: `rooms/forge-room/host/breakdown/forge-breakdown-validate.ts`
- **Description**: Enforce the frozen breakdown rules before approval.
- **Complexity**: 7
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Top-level task count must be `3-7`.
  - Level 2 is allowed only for `executionKind: "checklist"`.
  - Level 2 tasks are marked or treated as non-assignable.
  - Depth > 2 is rejected.
  - One automatic regenerate attempt is allowed.
  - After the second failure, coordinator state becomes blocked until user edits.
- **Validation**:
  - targeted validator tests for valid/invalid graphs

### Task 2.4: Wire Generate-Draft Host Command
- **Location**: `rooms/forge-room/host/runtime.ts`, optional `rooms/forge-room/host/breakdown/forge-breakdown-runtime.ts`
- **Description**: Replace the placeholder draft generator with a real awaited dispatch flow.
- **Complexity**: 8
- **Dependencies**: Tasks 2.2-2.3
- **Acceptance Criteria**:
  - `ForgeRoomGenerateDraft` ensures an active session.
  - Host dispatches a single awaited request to `ai1` with Architect role context through the SlotBridge wait boundary, not through the non-waited `sendProtocol(...)` helper alone.
  - Valid draft replaces `draftTasks`.
  - Invalid draft writes feedback into coordinator state and command result payload.
  - Placeholder draft task generation is removed.
- **Validation**:
  - targeted host test
  - targeted Forge test slice

### Task 2.5: Add Manual Draft Editing Controls For Blocked Drafts
- **Location**: `rooms/forge-room/ui/panels/draft-breakdown-panel.ts`, `rooms/forge-room/shared/ui/state.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Add the minimum UI/control surface required by the frozen rule that users must be able to fix a twice-invalid draft before approval.
- **Complexity**: 6
- **Dependencies**: Task 2.4
- **Acceptance Criteria**:
  - User can edit title/summary and remove invalid draft tasks in the UI.
  - Level-2 checklist children, if shown, are clearly not dispatchable.
  - Approval stays blocked until validation passes.
- **Validation**:
  - installed UI smoke update
  - targeted draft validation interaction test

## Sprint 3: Add Assignment Dispatch And Response Capture
**Goal**: Approved top-level tasks can be dispatched to live seats and their replies are captured into Forge state and persistence.
**Demo/Validation**:
- Single-owner task dispatch works.
- Compare-mode task dispatch runs as two separate awaited sends.
- Responses appear in the Responses panel and persist across save/load.

### Task 3.1: Extend Assignment Model For Dispatch Mode And Reply Session Tracking
- **Location**: `rooms/forge-room/shared/types/forge-workflow.ts`, `rooms/forge-room/host/state/forge-runtime-state.ts`
- **Description**: Add the minimum fields needed to distinguish single-owner vs compare mode and to resume reply polling safely.
- **Complexity**: 5
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Assignment captures dispatch mode such as `single-owner` or `compare`.
  - Assignment stores enough session metadata for awaited reply continuity, such as local conversation/session refs.
  - Runtime state includes persisted per-task dispatch preference data so `seat / role / persona` selection is not ephemeral UI-only state.
  - `queued/dispatched/completed/failed` style lifecycle is explicit.
- **Validation**:
  - `npm run rooms:typecheck`

### Task 3.2: Build Forge Assignment Planner
- **Location**: `rooms/forge-room/host/dispatch/forge-assignment-plan.ts`
- **Description**: Convert approved top-level tasks into dispatchable assignment records using role/persona defaults plus UI-selected overrides.
- **Complexity**: 6
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Only level-1 tasks are planned for dispatch.
  - Single-owner mode yields one assignment.
  - Compare mode yields two assignments for the same task, typically `architect` + `challenger`.
  - Planner reads persisted task/session dispatch preferences rather than silently hardcoding defaults.
  - Persona preset remains contextual metadata, not a target seat.
- **Validation**:
  - targeted assignment planning test

### Task 3.3: Build Dispatch Boundary On Top Of SlotBridge Wait Semantics
- **Location**: `rooms/forge-room/host/dispatch/forge-dispatch-runtime.ts`
- **Description**: Implement a room-local dispatch service that uses existing `dispatchBridge` and `message.sendWait` semantics correctly.
- **Complexity**: 8
- **Dependencies**: Tasks 3.1-3.2
- **Acceptance Criteria**:
  - Single-owner dispatch sends exactly one awaited request to one seat.
  - Compare mode dispatch sends two separate awaited requests, never one multi-target wait.
  - Dispatch options support `ai1`, `ai2`, `us1`.
  - Errors are normalized into structured command results and coordinator feedback.
- **Validation**:
  - targeted dispatch boundary test

### Task 3.4: Capture Replies Into ForgeAgentResponse Records
- **Location**: `rooms/forge-room/host/dispatch/forge-response-capture.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Normalize awaited replies into persisted Forge response records.
- **Complexity**: 7
- **Dependencies**: Task 3.3
- **Acceptance Criteria**:
  - Every completed assignment creates one `ForgeAgentResponse`.
  - Response links to `taskId` through `assignmentId`.
  - Summary/body are populated from the parsed reply.
  - Archive/session refs and artifacts are preserved when present.
- **Validation**:
  - targeted response capture test

### Task 3.5: Add Dispatch UI Controls And Response Rendering
- **Location**: `rooms/forge-room/ui/panels/approved-tasks-panel.ts`, `rooms/forge-room/ui/panels/responses-panel.ts`, `rooms/forge-room/shared/ui/request-runtime.ts`
- **Description**: Add minimum interaction controls for dispatching approved tasks and showing live response data.
- **Complexity**: 6
- **Dependencies**: Tasks 3.2-3.4
- **Acceptance Criteria**:
  - Approved task panel supports single-owner vs compare mode.
  - Approved task panel allows selecting and persisting seat/role/persona overrides before dispatch.
  - Dispatch action is user-triggered and visibly pending while in flight.
  - Responses panel renders real role/seat/body data, not placeholder cards.
- **Validation**:
  - installed UI smoke update

## Sprint 4: Add Conflict Grouping, Synthesis, And Export
**Goal**: The room can transform multiple responses into conflicts, produce/select a synthesis, and export a valid Repair Room handoff.
**Demo/Validation**:
- Compare-mode dispatch produces at least one conflict record when two responses exist.
- Synthesis can be generated and one synthesis can be selected.
- Selected synthesis unlocks export and writes JSON under session exports.

### Task 4.1: Build Minimum Conflict Grouper
- **Location**: `rooms/forge-room/host/conflicts/forge-conflict-grouping.ts`
- **Description**: Add a deterministic, minimum-v1 grouper for multi-response tasks.
- **Complexity**: 6
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Conflict evaluation only runs when a task has 2+ responses.
  - Compare-mode siblings can produce one or more `ForgeConflict` records.
  - Minimum kinds supported:
    - `approach`
    - `scope`
    - `risk`
    - `sequence`
  - If no strong heuristic can distinguish kind, a stable fallback rule is documented and used.
- **Validation**:
  - targeted conflict grouping test

### Task 4.2: Build Synthesis Prompt Builder And Reply Parser
- **Location**: `rooms/forge-room/host/synthesis/forge-synthesis-prompt.ts`, `rooms/forge-room/host/synthesis/forge-synthesis-parse.ts`
- **Description**: Generate a synthesis request from approved tasks, responses, and conflicts, then parse the selected output.
- **Complexity**: 7
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Prompt includes relevant responses and conflict summaries.
  - Prompt builder consumes synthesis protocol text resolved from the Forge protocol runtime, not host-embedded prompt bodies.
  - Parser returns one normalized `ForgeSynthesis`.
  - Phase 2 keeps the first synthesis pass simple and deterministic.
- **Validation**:
  - targeted synthesis parser test

### Task 4.3: Add Selected-Synthesis State Rules
- **Location**: `rooms/forge-room/host/state/forge-runtime-actions.ts`, `rooms/forge-room/host/state/forge-runtime-reducer.ts`
- **Description**: Enforce "only one selected synthesis" in reducer/store state.
- **Complexity**: 4
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Selecting one synthesis deselects others.
  - `selectedSynthesisId` stays consistent after save/load.
  - Synthesis status feeds coordinator/export readiness.
- **Validation**:
  - targeted reducer test

### Task 4.4: Implement Real Handoff Export Write Path
- **Location**: `rooms/forge-room/host/forge-handoff-export.ts`, `rooms/forge-room/host/forge-session-storage.ts`, `rooms/forge-room/host/runtime.ts`
- **Description**: Upgrade the existing export skeleton so it writes a valid handoff JSON under the session exports directory.
- **Complexity**: 6
- **Dependencies**: Tasks 4.2-4.3
- **Acceptance Criteria**:
  - Export is blocked without a selected synthesis.
  - `targetRoomId` is always `repair-room`.
  - `acceptanceCriteria` contains at least one item.
  - Export writes JSON into `sessions/<sessionId>/exports/`.
  - Export result is surfaced to the UI with a success/failure message.
- **Validation**:
  - targeted export test

### Task 4.5: Add Synthesis/Export UI Controls
- **Location**: `rooms/forge-room/ui/panels/conflict-summary-panel.ts`, `rooms/forge-room/ui/panels/synthesis-panel.ts`, `rooms/forge-room/ui/panels/coordinator-panel.ts`
- **Description**: Add minimum controls for generating synthesis, selecting one, and exporting.
- **Complexity**: 6
- **Dependencies**: Tasks 4.1-4.4
- **Acceptance Criteria**:
  - Conflict panel renders real conflict summaries.
  - Synthesis panel can trigger generation, show multiple syntheses if present, and select one.
  - Coordinator panel shows export readiness derived from real state.
- **Validation**:
  - installed UI smoke update

## Sprint 5: Persistence Integration, Runtime Polish, And Regression Coverage
**Goal**: The new live loop survives save/load and is protected by targeted regressions.
**Demo/Validation**:
- Create session -> generate draft -> approve -> dispatch -> capture response -> create conflict/synthesis -> export -> save -> reload.
- Reopened session shows consistent state.

### Task 5.1: Persist The Full Phase 2 Session Shape
- **Location**: `rooms/forge-room/host/state/forge-runtime-state.ts`, `rooms/forge-room/host/forge-session-storage.ts`
- **Description**: Ensure all new live-loop fields survive session round-trip.
- **Complexity**: 6
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Session save/load covers:
    - goal
    - draftTasks
    - approvedTasks
    - assignments
    - responses
    - conflicts
    - syntheses
    - selected synthesis
    - coordinator state
    - export artifacts/refs
  - Reopened state derives a correct coordinator summary.
- **Validation**:
  - session round-trip regression

### Task 5.2: Replace Placeholder Coordinator Metrics With Derived Runtime Metrics
- **Location**: `rooms/forge-room/host/state/forge-selectors.ts`, `rooms/forge-room/ui/panels/coordinator-panel.ts`
- **Description**: Make the coordinator panel derive its numbers and readiness flags from live state instead of placeholder values.
- **Complexity**: 5
- **Dependencies**: Sprints 2-4
- **Acceptance Criteria**:
  - Coordinator shows:
    - current stage
    - queued assignments
    - completed responses
    - conflict count
    - synthesis status
    - export readiness
  - Values are selector-driven, not manually incremented in the UI.
- **Validation**:
  - targeted selector test

### Task 5.3: Add Phase 2 Regression Coverage
- **Location**: `scripts/tests/forge-room-*.test.ts`, optional helpers under `scripts/tests/helpers/`, `package.json`
- **Description**: Extend the Phase 1 test surface for live-loop behavior.
- **Complexity**: 7
- **Dependencies**: Sprints 2-5
- **Acceptance Criteria**:
  - Coverage exists for:
    - breakdown validation and regenerate guard
    - assignment planning
    - single-owner dispatch
    - compare-mode sequential waited dispatch
    - response capture
    - conflict grouping
    - synthesis selection
    - export guard and export write path
    - session reopen consistency
  - A dedicated targeted Forge suite is available for iteration if the full room harness is too brittle or slow.
  - `rooms:test:core` remains the final gate, but not the only executable path.
- **Validation**:
  - `npm run rooms:test:core`

### Task 5.4: Verify Installed-Room Runtime Parity
- **Location**: installed copy under `data/rooms/forge-room`, `config/rooms.json`, smoke tests if needed
- **Description**: Confirm the live-loop additions still survive install/startup-sync and installed runtime usage.
- **Complexity**: 4
- **Dependencies**: Sprints 2-5
- **Acceptance Criteria**:
  - Installed copy contains protocol files and updated runtime bundles.
  - Registry/install sync still refreshes Forge after workspace edits.
  - Installed UI smoke still passes with the live controls present.
- **Validation**:
  - targeted install-sync regression
  - `npm run rooms:check`

## Testing Strategy
- Early Phase 2 safety net:
  - add or preserve a clearly named targeted Forge slice such as `rooms:test:forge` if the full room harness becomes the bottleneck.
- Use targeted Forge suites first for seam-heavy work:
  - breakdown validation
  - dispatch boundary
  - synthesis/export
- Baseline validation each sprint:
  - `npm run rooms:typecheck`
  - targeted Forge tests for changed seam
- Full regression gate before calling Phase 2 complete:
  - `npm run rooms:check`
- Required targeted suites by the end of Phase 2:
  - breakdown validation/regenerate
  - host dispatch boundary
  - installed UI smoke
  - conflict grouping
  - synthesis selection
  - handoff export write path
  - session reopen consistency

## Potential Risks & Gotchas
- `message.sendWait` is single-target only.
  - Compare mode must dispatch sequential awaited sends, never multi-target wait.
- Reply parsing can be brittle.
  - Mitigation: strict JSON-oriented protocol bodies and dedicated parser modules.
- It is easy to accidentally implement waited prompt steps through `sendProtocol(...)`.
  - Mitigation: Phase 2 should centralize waited Forge sends behind one Forge-local dispatch helper that explicitly uses `message.sendWait`.
- Conversation/session drift can cause stale reply capture.
  - Mitigation: store assignment-level session refs from SlotBridge results and reuse them per seat.
- Twice-invalid breakdowns require user correction.
  - Mitigation: Phase 2 must include minimal draft editing controls, not just error toasts.
- US1 may be slower or disconnected than AI seats.
  - Mitigation: normalize dispatch errors and keep per-assignment failure state instead of stalling the whole session.
- Session persistence can become inconsistent if multiple host mutations save ad hoc.
  - Mitigation: keep reducer/store as the single source of truth and persist after committed transitions.

## Rollback Plan
- Revert Forge Phase 2-specific command additions in `manifest.json` and `forge-constants.ts`.
- Revert new breakdown/dispatch/conflict/synthesis runtime modules.
- Revert UI action additions while keeping the Phase 1 shell intact.
- Revert added Forge Phase 2 regression files and `package.json` test wiring if the live loop needs to be backed out.
