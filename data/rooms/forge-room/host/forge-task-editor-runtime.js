import { isForgePersonaPresetId, isForgeRoleId, isForgeSeatId } from "../shared/types/index.js";
import {
  normalizeForgeBreakdownDraft,
  parseForgeBreakdownDraft,
  serializeForgeBreakdownDraft
} from "./forge-breakdown-runtime.js";
import { createAssignmentsForApprovedTasks } from "./forge-task-runtime.js";
import { asNonEmptyString, asStringArray, uniqueStrings } from "./forge-runtime-support.js";
function readDefaultRoleForSeat(seatId) {
  if (seatId === "ai2") {
    return "challenger";
  }
  if (seatId === "us1") {
    return "external-perspective";
  }
  return "architect";
}
function normalizeSeatId(value) {
  return isForgeSeatId(value) ? value : "ai1";
}
function normalizeRoleId(value, seatId) {
  return isForgeRoleId(value) ? value : readDefaultRoleForSeat(seatId);
}
function normalizeDispatchMode(value) {
  return value === "compare" ? "compare" : "single-owner";
}
function normalizePersonaPresetId(value) {
  return isForgePersonaPresetId(value) ? value : null;
}
function normalizeCompareSeatIds(primarySeatId, mode, value) {
  if (mode !== "compare") {
    return [];
  }
  const explicit = uniqueStrings(asStringArray(value)).filter(
    (entry) => isForgeSeatId(entry)
  );
  const filtered = explicit.filter((entry) => entry !== primarySeatId);
  if (filtered.length > 0) {
    return filtered;
  }
  if (primarySeatId === "ai1") {
    return ["ai2"];
  }
  if (primarySeatId === "ai2") {
    return ["ai1"];
  }
  return ["ai1"];
}
function materializeDraft(payload) {
  const sourceText = JSON.stringify(payload, null, 2);
  const parsed = parseForgeBreakdownDraft(sourceText);
  if (parsed.payload === null) {
    return {
      draftSourceText: sourceText,
      draftTasks: [],
      validationMessages: parsed.validationMessages
    };
  }
  const normalized = normalizeForgeBreakdownDraft(parsed.payload);
  return {
    draftSourceText: normalized.draftSourceText,
    draftTasks: normalized.draftTasks,
    validationMessages: parsed.validationMessages
  };
}
function readDraftPayload(acceptanceCriteria, draftTasks) {
  return serializeForgeBreakdownDraft({
    acceptanceCriteria,
    tasks: draftTasks
  });
}
function createTaskSpecFromPayload(payload) {
  const seatId = normalizeSeatId(payload["seatId"]);
  const dispatchMode = normalizeDispatchMode(payload["dispatchMode"]);
  return {
    title: asNonEmptyString(payload["title"]) ?? "",
    summary: asNonEmptyString(payload["summary"]) ?? "",
    dispatchMode,
    seatId,
    roleId: normalizeRoleId(payload["roleId"], seatId),
    personaPresetId: normalizePersonaPresetId(payload["personaPresetId"]),
    compareSeatIds: normalizeCompareSeatIds(seatId, dispatchMode, payload["compareSeatIds"]),
    dependsOnTaskTitles: [],
    checklist: uniqueStrings(asStringArray(payload["checklist"]))
  };
}
export function upsertForgeDraftTask(params) {
  const currentPayload = readDraftPayload(params.acceptanceCriteria, params.draftTasks);
  const topLevelTasks = params.draftTasks.filter((task) => task.level === 1);
  const taskId = asNonEmptyString(params.payload["taskId"]);
  const taskIndex = taskId ? topLevelTasks.findIndex((task) => task.id === taskId) : -1;
  const nextTaskSpec = createTaskSpecFromPayload(params.payload);
  const oldTitle = taskIndex >= 0 ? currentPayload.tasks[taskIndex]?.title ?? null : null;
  const nextTitle = nextTaskSpec.title.trim();
  const titleByTaskId = new Map(topLevelTasks.map((task) => [task.id, task.title]));
  nextTaskSpec.dependsOnTaskTitles = uniqueStrings(
    asStringArray(params.payload["dependsOnTaskIds"]).map((dependencyId) => titleByTaskId.get(dependencyId) ?? null).filter((dependencyTitle) => dependencyTitle !== null).filter((dependencyTitle) => dependencyTitle !== nextTitle)
  );
  const nextPayload = {
    acceptanceCriteria: [...currentPayload.acceptanceCriteria],
    tasks: taskIndex >= 0 ? currentPayload.tasks.map(
      (task, index) => index === taskIndex ? nextTaskSpec : { ...task }
    ) : [...currentPayload.tasks, nextTaskSpec]
  };
  if (oldTitle !== null && oldTitle !== nextTitle && nextTitle !== "") {
    nextPayload.tasks = nextPayload.tasks.map((task, index) => {
      if (index === taskIndex) {
        return task;
      }
      return {
        ...task,
        dependsOnTaskTitles: task.dependsOnTaskTitles.map(
          (dependencyTitle) => dependencyTitle === oldTitle ? nextTitle : dependencyTitle
        )
      };
    });
  }
  return materializeDraft(nextPayload);
}
export function removeForgeDraftTask(params) {
  const currentPayload = readDraftPayload(params.acceptanceCriteria, params.draftTasks);
  const topLevelTasks = params.draftTasks.filter((task) => task.level === 1);
  const taskIndex = topLevelTasks.findIndex((task) => task.id === params.taskId);
  if (taskIndex < 0) {
    return materializeDraft(currentPayload);
  }
  const removedTitle = currentPayload.tasks[taskIndex]?.title ?? null;
  const nextPayload = {
    acceptanceCriteria: [...currentPayload.acceptanceCriteria],
    tasks: currentPayload.tasks.filter((_, index) => index !== taskIndex).map((task) => ({
      ...task,
      dependsOnTaskTitles: removedTitle === null ? [...task.dependsOnTaskTitles] : task.dependsOnTaskTitles.filter(
        (dependencyTitle) => dependencyTitle !== removedTitle
      )
    }))
  };
  return materializeDraft(nextPayload);
}
export function updateForgeApprovedTask(params) {
  const taskId = asNonEmptyString(params.payload["taskId"]);
  if (taskId === null) {
    return {
      approvedTasks: params.approvedTasks,
      validationMessage: "Approved task id is required."
    };
  }
  const taskIndex = params.approvedTasks.findIndex(
    (task) => task.id === taskId && task.level === 1
  );
  if (taskIndex < 0) {
    return {
      approvedTasks: params.approvedTasks,
      validationMessage: "Approved task was not found."
    };
  }
  const currentTask = params.approvedTasks[taskIndex];
  if (!currentTask) {
    return {
      approvedTasks: params.approvedTasks,
      validationMessage: "Approved task was not found."
    };
  }
  const seatId = normalizeSeatId(params.payload["seatId"] ?? currentTask.seatId);
  const dispatchMode = normalizeDispatchMode(
    params.payload["dispatchMode"] ?? currentTask.dispatchMode
  );
  const roleId = normalizeRoleId(params.payload["roleId"] ?? currentTask.roleId, seatId);
  const compareSeatIds = normalizeCompareSeatIds(
    seatId,
    dispatchMode,
    params.payload["compareSeatIds"] ?? currentTask.compareSeatIds
  );
  const nextTask = {
    ...currentTask,
    seatId,
    roleId,
    dispatchMode,
    compareSeatIds,
    personaPresetId: normalizePersonaPresetId(
      params.payload["personaPresetId"] ?? currentTask.personaPresetId
    ),
    status: "approved"
  };
  return {
    approvedTasks: params.approvedTasks.map(
      (task, index) => index === taskIndex ? nextTask : task
    ),
    validationMessage: null
  };
}
export function rebuildQueuedAssignments(approvedTasks) {
  return createAssignmentsForApprovedTasks(approvedTasks);
}
