import { FORGE_HANDOFF_SCHEMA_VERSION, FORGE_TARGET_ROOM_ID } from "../shared/forge-constants.js";
import { slugifyFilePart } from "./forge-runtime-support.js";
export function createForgeHandoffExport() {
  function requireSelectedSynthesis(session) {
    const selected = session.syntheses.find(
      (entry) => entry.id === session.selectedSynthesisId && (entry.status === "selected" || entry.status === "exported")
    );
    if (!selected) {
      throw new Error("A selected synthesis is required before exporting a handoff package.");
    }
    return selected;
  }
  function readAcceptanceCriteria(session, selected) {
    const criteria = selected.acceptanceCriteria.length > 0 ? selected.acceptanceCriteria : session.goal?.acceptanceCriteria ?? [];
    if (criteria.length === 0) {
      throw new Error(
        "At least one acceptance criterion is required before exporting a handoff package."
      );
    }
    return criteria;
  }
  function buildHandoffPackage(session) {
    const exportSummary = buildExportReadySummary(session);
    if (exportSummary.exportReady !== true) {
      throw new Error(exportSummary.reason);
    }
    const goal = session.goal;
    if (goal === null) {
      throw new Error("A goal is required before exporting a handoff package.");
    }
    if (goal.targetRoomId !== FORGE_TARGET_ROOM_ID) {
      throw new Error("Forge Room exports are restricted to the Repair Room target in v1.");
    }
    const selected = requireSelectedSynthesis(session);
    const acceptanceCriteria = readAcceptanceCriteria(session, selected);
    return {
      schemaVersion: FORGE_HANDOFF_SCHEMA_VERSION,
      targetRoomId: "repair-room",
      goalId: goal.id,
      goalSummary: goal.summary,
      goalBrief: goal.brief,
      constraints: goal.constraints,
      taskGraph: {
        tasks: session.approvedTasks.map((task) => ({
          id: task.id,
          parentTaskId: task.parentTaskId,
          level: task.level,
          title: task.title,
          summary: task.summary,
          executionKind: task.executionKind,
          dependsOnTaskIds: task.dependsOnTaskIds,
          assignedSeatId: session.assignments.find((entry) => entry.taskId === task.id)?.seatId ?? null,
          assignedRoleId: session.assignments.find((entry) => entry.taskId === task.id)?.roleId ?? null
        }))
      },
      selectedSynthesis: {
        id: selected.id,
        summary: selected.summary,
        body: selected.body,
        sourceTaskIds: selected.sourceTaskIds,
        selectedResponseIds: selected.selectedResponseIds,
        unresolvedConflictIds: selected.unresolvedConflictIds
      },
      conflicts: session.conflicts.map((conflict) => ({
        id: conflict.id,
        taskId: conflict.taskId,
        kind: conflict.kind,
        status: conflict.status,
        summary: conflict.summary,
        responseIds: conflict.responseIds,
        ...conflict.preferredResponseId ? { preferredResponseId: conflict.preferredResponseId } : {},
        ...conflict.resolutionNote ? { resolutionNote: conflict.resolutionNote } : {}
      })),
      openQuestions: selected.openQuestions.map((question, index) => ({
        id: `forge-open-question-${String(index + 1)}`,
        text: question,
        blocking: true
      })),
      acceptanceCriteria,
      repoRefs: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: {
        actorKind: "coordinator",
        actorId: "coordinator",
        label: "Coordinator"
      }
    };
  }
  function buildExportFileName(session) {
    const goalSummary = session.goal?.summary ?? "forge-handoff";
    return `${slugifyFilePart(goalSummary) || "forge-handoff"}-${session.id}.json`;
  }
  function buildExportReadySummary(session) {
    const selected = session.syntheses.find((entry) => entry.id === session.selectedSynthesisId) ?? null;
    const acceptanceCriteriaCount = selected?.acceptanceCriteria.length ?? session.goal?.acceptanceCriteria.length ?? 0;
    const openConflictCount = session.conflicts.filter(
      (conflict) => conflict.status === "open"
    ).length;
    const missingRequirements = [];
    const targetRoomId = session.goal?.targetRoomId ?? null;
    if (session.goal === null) {
      missingRequirements.push("Define a goal");
    }
    if (session.goal !== null && targetRoomId !== FORGE_TARGET_ROOM_ID) {
      missingRequirements.push("Target room must be repair-room");
    }
    if (selected === null) {
      missingRequirements.push("Select a synthesis");
    }
    if (openConflictCount > 0) {
      missingRequirements.push(
        openConflictCount === 1 ? "Resolve the open conflict" : `Resolve ${String(openConflictCount)} open conflicts`
      );
    }
    if (acceptanceCriteriaCount === 0) {
      missingRequirements.push("Add at least one acceptance criterion");
    }
    const exportReady = missingRequirements.length === 0;
    const status = exportReady === true ? "ready" : acceptanceCriteriaCount === 0 ? "missing-criteria" : "blocked";
    return {
      acceptanceCriteriaCount,
      exportReady,
      missingRequirements,
      openConflictCount,
      reason: exportReady ? "Export ready." : `Export blocked: ${missingRequirements[0] ?? "requirements missing"}.`,
      selectedSynthesisId: selected?.id ?? null,
      status,
      targetRoomId
    };
  }
  return {
    buildExportFileName,
    buildHandoffPackage,
    buildExportReadySummary
  };
}
