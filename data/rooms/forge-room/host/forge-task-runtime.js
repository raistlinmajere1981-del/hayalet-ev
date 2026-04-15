import { FORGE_ROLE_CATALOG } from "../shared/data/role-catalog.js";
import { FORGE_TARGET_ROOM_ID } from "../shared/forge-constants.js";
import { FORGE_PERSONA_PRESETS } from "../shared/data/persona-presets.js";
import { isForgeSeatId } from "../shared/types/index.js";
import {
  asNonEmptyString,
  createForgeId,
  extractJsonValue,
  normalizeTextForComparison,
  nowIso,
  toRecord,
  uniqueStrings
} from "./forge-runtime-support.js";
function readRoleForSeat(seatId) {
  const role = Object.values(FORGE_ROLE_CATALOG).find(
    (entry) => entry.defaultSeatId === seatId && entry.localActor === false
  );
  return role?.id ?? (seatId === "ai2" ? "challenger" : seatId === "us1" ? "external-perspective" : "architect");
}
export function createAssignmentsForApprovedTasks(tasks) {
  const timestamp = nowIso();
  return tasks.filter((task) => task.assignable === true && task.level === 1).flatMap((task) => {
    const primarySeatId = task.seatId ?? "ai1";
    const primaryRoleId = task.roleId ?? readRoleForSeat(primarySeatId);
    const primaryAssignment = {
      id: createForgeId("forge-assignment"),
      taskId: task.id,
      mode: task.dispatchMode,
      seatId: primarySeatId,
      roleId: primaryRoleId,
      personaPresetId: task.personaPresetId,
      requestId: createForgeId("forge-request"),
      startedAt: null,
      status: "queued",
      queuedAt: timestamp,
      responseId: null,
      errorMessage: null,
      archiveRef: null,
      completedAt: null
    };
    const compareAssignments = task.dispatchMode === "compare" ? task.compareSeatIds.filter((seatId) => seatId !== primarySeatId).map((seatId) => ({
      id: createForgeId("forge-assignment"),
      taskId: task.id,
      mode: task.dispatchMode,
      seatId,
      roleId: readRoleForSeat(seatId),
      personaPresetId: task.personaPresetId,
      requestId: createForgeId("forge-request"),
      startedAt: null,
      status: "queued",
      queuedAt: timestamp,
      responseId: null,
      errorMessage: null,
      archiveRef: null,
      completedAt: null
    })) : [];
    return [primaryAssignment, ...compareAssignments];
  });
}
export function buildForgeTaskPrompt(params) {
  const { approvedTasks, assignment, goal, task } = params;
  const persona = assignment.personaPresetId !== null ? FORGE_PERSONA_PRESETS[assignment.personaPresetId] : null;
  const dependencies = approvedTasks.filter((candidate) => task.dependsOnTaskIds.includes(candidate.id)).map((candidate) => candidate.title);
  return [
    "Return JSON only using this exact schema:",
    JSON.stringify(
      {
        summary: "One short sentence summary",
        body: "Compact recommendation body under 900 chars",
        artifacts: [
          {
            kind: "file",
            label: "Optional artifact label",
            path: "optional/path",
            note: "optional note"
          }
        ]
      },
      null,
      2
    ),
    `Target room: ${goal.targetRoomId || FORGE_TARGET_ROOM_ID}`,
    `Goal summary: ${goal.summary}`,
    `Goal brief: ${goal.brief || "No additional brief provided."}`,
    `Role: ${assignment.roleId}`,
    `Seat: ${assignment.seatId}`,
    `Task title: ${task.title}`,
    `Task summary: ${task.summary}`,
    `Task mode: ${task.dispatchMode}`,
    `Dependencies: ${dependencies.length > 0 ? dependencies.join(" | ") : "None"}`,
    `Constraints: ${goal.constraints.length > 0 ? goal.constraints.join(" | ") : "None"}`,
    `Acceptance criteria: ${goal.acceptanceCriteria.length > 0 ? goal.acceptanceCriteria.join(" | ") : "Derive practical acceptance criteria."}`,
    persona ? `Persona focus: ${formatPersonaPrompt(persona)}` : "Persona focus: none",
    "This run is a smoke test. Keep the JSON compact and avoid unnecessary detail.",
    "Keep summary under 140 characters.",
    "Keep body under 900 characters and prefer 3 to 6 short bullet-style lines inside the JSON string when helpful.",
    "Produce exactly one final JSON response for this task.",
    "Do not provide alternatives, variants, multiple drafts, or multiple candidate answers.",
    "Keep the answer practical and directly useful for downstream Repair Room handoff."
  ].join("\n");
}
function formatPersonaPrompt(persona) {
  return `${persona.label} | ${persona.summary} | ${persona.focus}`;
}
function toArtifactRefs(rawValue) {
  return Array.isArray(rawValue) ? rawValue.flatMap((entry) => {
    const record = toRecord(entry);
    const label = asNonEmptyString(record["label"]);
    if (label === null) {
      return [];
    }
    const kind = record["kind"] === "json" || record["kind"] === "image" || record["kind"] === "archive-ref" ? record["kind"] : "file";
    return [
      {
        kind,
        label,
        path: asNonEmptyString(record["path"]),
        note: asNonEmptyString(record["note"])
      }
    ];
  }) : [];
}
export function createForgeArchiveRef(input) {
  return {
    conversationId: asNonEmptyString(input.conversationId) ?? null,
    localSessionId: asNonEmptyString(input.localSessionId) ?? null,
    messageId: asNonEmptyString(input.messageId) ?? null,
    provider: asNonEmptyString(input.provider) ?? null
  };
}
export function parseForgeTaskResponsePayload(rawText) {
  const parsed = extractJsonValue(rawText);
  if (parsed === null) {
    return {
      payload: null,
      validationMessages: ["Task response did not contain valid JSON."]
    };
  }
  const record = toRecord(parsed);
  const summary = asNonEmptyString(record["summary"]);
  const body = asNonEmptyString(record["body"]);
  const artifacts = toArtifactRefs(record["artifacts"]);
  const validationMessages = [];
  if (summary === null) {
    validationMessages.push("Task response summary is required.");
  }
  if (body === null) {
    validationMessages.push("Task response body is required.");
  }
  return {
    payload: summary !== null && body !== null ? {
      summary,
      body,
      artifacts
    } : null,
    validationMessages
  };
}
export function createForgeTaskResponse(params) {
  const { archiveRef, assignment, payload, rawText, task } = params;
  return {
    id: createForgeId("forge-response"),
    assignmentId: assignment.id,
    taskId: task.id,
    seatId: assignment.seatId,
    roleId: assignment.roleId,
    personaPresetId: assignment.personaPresetId,
    summary: payload.summary,
    body: payload.body,
    rawText: rawText.trim(),
    archiveRef,
    artifacts: payload.artifacts,
    status: "captured",
    createdAt: nowIso()
  };
}
function inferConflictKind(bodies) {
  const joined = bodies.map((entry) => entry.toLowerCase()).join(" ");
  if (/(risk|danger|failure|break|regression|validate|guard)/.test(joined)) {
    return "risk";
  }
  if (/(sequence|order|first|then|before|after|step)/.test(joined)) {
    return "sequence";
  }
  if (/(scope|defer|exclude|out of scope|minimal|phase)/.test(joined)) {
    return "scope";
  }
  return "approach";
}
export function groupForgeConflicts(params) {
  const { assignments, responses, tasks } = params;
  return tasks.filter((task) => task.assignable === true).flatMap((task) => {
    const taskAssignments = assignments.filter((assignment) => assignment.taskId === task.id);
    const taskResponses = responses.filter((response) => response.taskId === task.id);
    if (taskResponses.length < 2) {
      return [];
    }
    const uniqueBodies = new Set(
      taskResponses.map((response) => normalizeTextForComparison(response.body))
    );
    if (task.dispatchMode !== "compare" && uniqueBodies.size < 2) {
      return [];
    }
    return [
      {
        id: createForgeId("forge-conflict"),
        taskId: task.id,
        kind: inferConflictKind(taskResponses.map((response) => response.body)),
        status: "open",
        summary: `Responses for "${task.title}" diverged across ${String(taskAssignments.length)} assignment lane(s).`,
        responseIds: taskResponses.map((response) => response.id),
        resolutionNote: null,
        createdAt: nowIso()
      }
    ];
  });
}
function buildAcceptanceCriteria(goal, tasks, responses) {
  if (goal.acceptanceCriteria.length > 0) {
    return uniqueStrings(goal.acceptanceCriteria);
  }
  const fromResponses = responses.map((response) => response.summary);
  if (fromResponses.length > 0) {
    return uniqueStrings(fromResponses).slice(0, 3);
  }
  return tasks.filter((task) => task.level === 1).slice(0, 3).map((task) => `${task.title} is reflected in the Repair Room handoff.`);
}
function buildOpenQuestions(conflicts, taskTitles) {
  return conflicts.filter((conflict) => conflict.status === "open").map((conflict) => {
    const taskTitle = taskTitles.get(conflict.taskId) ?? conflict.taskId;
    return `${taskTitle}: resolve the ${conflict.kind} difference before implementation starts.`;
  });
}
export function createForgeSynthesisCandidate(params) {
  const { conflicts, goal, responses, tasks } = params;
  if (responses.length === 0) {
    return null;
  }
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  const responsesByTask = /* @__PURE__ */ new Map();
  responses.forEach((response) => {
    const bucket = responsesByTask.get(response.taskId) ?? [];
    bucket.push(response);
    responsesByTask.set(response.taskId, bucket);
  });
  const preferredResponses = tasks.filter((task) => task.assignable === true).flatMap((task) => {
    const taskResponses = responsesByTask.get(task.id) ?? [];
    if (taskResponses.length === 0) {
      return [];
    }
    const preferred = taskResponses.find(
      (response) => response.seatId === (task.seatId ?? "ai1")
    );
    return [preferred ?? taskResponses[0]].filter(
      (entry) => entry !== void 0
    );
  });
  const acceptanceCriteria = buildAcceptanceCriteria(goal, tasks, preferredResponses);
  const openQuestions = buildOpenQuestions(conflicts, taskTitles);
  return {
    id: createForgeId("forge-synthesis"),
    summary: `${goal.summary} synthesis`,
    body: preferredResponses.map((response) => {
      const taskTitle = taskTitles.get(response.taskId) ?? response.taskId;
      return `Task: ${taskTitle}
Seat: ${response.seatId}
Summary: ${response.summary}
${response.body}`;
    }).join("\n\n"),
    sourceTaskIds: uniqueStrings(preferredResponses.map((response) => response.taskId)),
    selectedResponseIds: preferredResponses.map((response) => response.id),
    unresolvedConflictIds: conflicts.filter((conflict) => conflict.status === "open").map((conflict) => conflict.id),
    acceptanceCriteria,
    openQuestions,
    status: "draft",
    createdAt: nowIso()
  };
}
export function selectForgeSynthesis(syntheses, synthesisId) {
  const nextSyntheses = syntheses.map((entry) => ({
    ...entry,
    status: entry.id === synthesisId ? "selected" : entry.status === "exported" ? "exported" : "draft"
  }));
  const selected = nextSyntheses.find((entry) => entry.id === synthesisId);
  return {
    selectedSynthesisId: selected ? selected.id : null,
    syntheses: nextSyntheses
  };
}
export function markForgeSynthesisExported(syntheses, synthesisId) {
  return syntheses.map(
    (entry) => entry.id === synthesisId ? { ...entry, status: "exported" } : entry
  );
}
export function syncApprovedTaskStatuses(params) {
  const { assignments, responses, tasks } = params;
  return tasks.map((task) => {
    if (task.assignable !== true) {
      return task;
    }
    const taskAssignments = assignments.filter((assignment) => assignment.taskId === task.id);
    const completedAssignments = taskAssignments.filter(
      (assignment) => assignment.status === "completed"
    );
    if (taskAssignments.length > 0 && completedAssignments.length === taskAssignments.length) {
      return {
        ...task,
        status: responses.some((response) => response.taskId === task.id) ? "answered" : "assigned"
      };
    }
    if (taskAssignments.some((assignment) => assignment.status === "dispatched")) {
      return {
        ...task,
        status: "assigned"
      };
    }
    return task;
  });
}
export function createForgeExportRecord(params) {
  return {
    id: createForgeId("forge-export"),
    targetRoomId: "repair-room",
    synthesisId: params.synthesisId,
    filePath: params.filePath,
    createdAt: nowIso(),
    createdBy: params.createdBy
  };
}
export function resolveDispatchSeat(value, fallback) {
  return isForgeSeatId(value) ? value : fallback;
}
