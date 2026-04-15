import test from "node:test";
import assert from "node:assert/strict";

import { createForgeHandoffExport } from "../../rooms/forge-room/host/forge-handoff-export.ts";
import { createEmptyForgeSession } from "../../rooms/forge-room/host/state/forge-runtime-state.ts";

test("forge-room handoff export blocks exports until a selected synthesis exists", () => {
  const handoffExport = createForgeHandoffExport();
  const session = createEmptyForgeSession("forge-session-1");
  session.goal = {
    id: "forge-goal-1",
    summary: "Repair Room integration",
    brief: "Prepare the first handoff package.",
    constraints: ["Keep the export boundary local."],
    acceptanceCriteria: ["Repair Room can load the exported handoff package."],
    status: "draft-ready",
    targetRoomId: "repair-room",
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };

  assert.throws(() => handoffExport.buildHandoffPackage(session), /select a synthesis/i);
});

test("forge-room handoff export builds the Repair Room contract from the approved session state", () => {
  const handoffExport = createForgeHandoffExport();
  const session = createEmptyForgeSession("forge-session-2");
  session.goal = {
    id: "forge-goal-2",
    summary: "Repair Room integration",
    brief: "Prepare the first handoff package.",
    constraints: ["Keep the export boundary local."],
    acceptanceCriteria: ["Repair Room can import the handoff package."],
    status: "draft-ready",
    targetRoomId: "repair-room",
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };
  session.approvedTasks = [
    {
      id: "forge-task-1",
      parentTaskId: null,
      level: 1,
      title: "Define the persistence boundary",
      summary: "Keep session data room-local.",
      executionKind: "task",
      dependsOnTaskIds: [],
      assignable: true,
      dispatchMode: "single-owner",
      seatId: "ai1",
      roleId: "architect",
      compareSeatIds: [],
      personaPresetId: "gok",
      status: "approved",
    },
  ];
  session.assignments = [
    {
      id: "forge-assignment-1",
      taskId: "forge-task-1",
      mode: "single-owner",
      seatId: "ai1",
      roleId: "architect",
      personaPresetId: "gok",
      requestId: "forge-request-1",
      startedAt: null,
      status: "queued",
      queuedAt: "2026-04-15T00:00:00.000Z",
      responseId: null,
      errorMessage: null,
      archiveRef: null,
      completedAt: null,
    },
  ];
  session.syntheses = [
    {
      id: "forge-synthesis-1",
      summary: "Selected synthesis",
      body: "Keep the first Repair Room handoff narrow and file-backed.",
      sourceTaskIds: ["forge-task-1"],
      selectedResponseIds: ["forge-response-1"],
      unresolvedConflictIds: [],
      acceptanceCriteria: ["Repair Room can import the handoff package."],
      openQuestions: [],
      status: "selected",
      createdAt: "2026-04-15T00:00:00.000Z",
    },
  ];
  session.selectedSynthesisId = "forge-synthesis-1";
  session.conflicts = [
    {
      id: "forge-conflict-1",
      taskId: "forge-task-1",
      kind: "approach",
      status: "resolved",
      summary: "The responses diverged.",
      responseIds: ["forge-response-1"],
      preferredResponseId: "forge-response-1",
      resolutionNote: "Prefer the local export path.",
      createdAt: "2026-04-15T00:00:00.000Z",
    },
  ];

  const handoff = handoffExport.buildHandoffPackage(session);

  assert.equal(handoff.targetRoomId, "repair-room");
  assert.equal(handoff.goalId, "forge-goal-2");
  assert.equal(handoff.selectedSynthesis.id, "forge-synthesis-1");
  assert.equal(handoff.taskGraph.tasks[0]?.assignedSeatId, "ai1");
  assert.equal(handoff.taskGraph.tasks[0]?.assignedRoleId, "architect");
  assert.equal(handoff.conflicts[0]?.preferredResponseId, "forge-response-1");
  assert.deepEqual(handoff.acceptanceCriteria, ["Repair Room can import the handoff package."]);
});

test("forge-room handoff export readiness blocks exports while conflicts stay open", () => {
  const handoffExport = createForgeHandoffExport();
  const session = createEmptyForgeSession("forge-session-3");
  session.goal = {
    id: "forge-goal-3",
    summary: "Repair Room integration",
    brief: "Prepare the first handoff package.",
    constraints: ["Keep the export boundary local."],
    acceptanceCriteria: ["Repair Room can import the handoff package."],
    status: "draft-ready",
    targetRoomId: "repair-room",
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };
  session.syntheses = [
    {
      id: "forge-synthesis-2",
      summary: "Selected synthesis",
      body: "Keep the handoff narrow and file-backed.",
      sourceTaskIds: ["forge-task-1"],
      selectedResponseIds: ["forge-response-1"],
      unresolvedConflictIds: ["forge-conflict-2"],
      acceptanceCriteria: ["Repair Room can import the handoff package."],
      openQuestions: [],
      status: "selected",
      createdAt: "2026-04-15T00:00:00.000Z",
    },
  ];
  session.selectedSynthesisId = "forge-synthesis-2";
  session.conflicts = [
    {
      id: "forge-conflict-2",
      taskId: "forge-task-1",
      kind: "risk",
      status: "open",
      summary: "The responses diverged.",
      responseIds: ["forge-response-1", "forge-response-2"],
      preferredResponseId: null,
      resolutionNote: null,
      createdAt: "2026-04-15T00:00:00.000Z",
    },
  ];

  const summary = handoffExport.buildExportReadySummary(session);

  assert.equal(summary.exportReady, false);
  assert.equal(summary.openConflictCount, 1);
  assert.match(summary.reason, /resolve/i);
});
