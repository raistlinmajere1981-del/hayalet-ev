import { FORGE_ROOM_ID, FORGE_SESSION_SCHEMA_VERSION } from "../../shared/forge-constants.js";
import {
  createDefaultForgeOperatorProfile,
  createEmptyForgePreflightState,
  createEmptyForgeSessionContextSelection
} from "../../shared/types/index.js";
function normalizeForgeTask(task) {
  return {
    ...task,
    contextCapsule: task.contextCapsule && typeof task.contextCapsule === "object" && Array.isArray(task.contextCapsule) === false ? {
      summary: typeof task.contextCapsule.summary === "string" ? task.contextCapsule.summary : "",
      relevantModules: Array.isArray(task.contextCapsule.relevantModules) ? task.contextCapsule.relevantModules.filter(
        (entry) => typeof entry === "string"
      ) : [],
      constraints: Array.isArray(task.contextCapsule.constraints) ? task.contextCapsule.constraints.filter(
        (entry) => typeof entry === "string"
      ) : []
    } : null
  };
}
function normalizeForgeTasks(tasks) {
  return tasks.map((task) => normalizeForgeTask(task));
}
function normalizeForgeDecisionTrace(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
function normalizeForgeSessionContextSelection(value) {
  const record = value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
  const skill = record["skill"] !== null && typeof record["skill"] === "object" && Array.isArray(record["skill"]) === false ? record["skill"] : {};
  const tools = record["tools"] !== null && typeof record["tools"] === "object" && Array.isArray(record["tools"]) === false ? record["tools"] : {};
  const preferences = record["preferences"] !== null && typeof record["preferences"] === "object" && Array.isArray(record["preferences"]) === false ? record["preferences"] : {};
  return {
    skill: {
      level: skill["level"] === true,
      soldering: skill["soldering"] === true,
      measurement: skill["measurement"] === true,
      mechanical: skill["mechanical"] === true
    },
    tools: {
      multimeter: tools["multimeter"] === true,
      solderingIron: tools["solderingIron"] === true,
      hotAir: tools["hotAir"] === true,
      benchPowerSupply: tools["benchPowerSupply"] === true,
      magnification: tools["magnification"] === true
    },
    preferences: {
      mode: preferences["mode"] === true,
      riskTolerance: preferences["riskTolerance"] === true
    }
  };
}
export function createForgeCoordinatorState(overrides = {}) {
  return {
    actorId: "coordinator",
    planStatus: "idle",
    assignmentQueueTotal: 0,
    pendingAssignmentCount: 0,
    completedResponseCount: 0,
    pendingConflictCount: 0,
    synthesisStatus: "idle",
    exportReady: false,
    lastExportPath: null,
    note: "Coordinator is idle.",
    lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...overrides
  };
}
export function createEmptyForgeRuntimeState() {
  return {
    activeSessionId: null,
    currentGoal: null,
    draftTasks: [],
    draftSourceText: null,
    validationMessages: [],
    decisionTrace: [],
    approvedTasks: [],
    assignments: [],
    exports: [],
    operatorProfile: createDefaultForgeOperatorProfile(),
    preflight: createEmptyForgePreflightState(),
    responses: [],
    sessionContextSelection: createEmptyForgeSessionContextSelection(),
    runOverride: null,
    runSignature: null,
    conflicts: [],
    syntheses: [],
    selectedSynthesisId: null,
    coordinatorState: createForgeCoordinatorState()
  };
}
export function createEmptyForgeSession(sessionId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    schemaVersion: FORGE_SESSION_SCHEMA_VERSION,
    id: sessionId,
    roomId: FORGE_ROOM_ID,
    goal: null,
    draftTasks: [],
    draftSourceText: null,
    validationMessages: [],
    approvedTasks: [],
    assignments: [],
    responses: [],
    conflicts: [],
    syntheses: [],
    selectedSynthesisId: null,
    decisionTrace: [],
    preflight: createEmptyForgePreflightState(),
    sessionContextSelection: createEmptyForgeSessionContextSelection(),
    runOverride: null,
    runSignature: null,
    exports: [],
    coordinatorState: createForgeCoordinatorState({
      note: "Session created. Waiting for the first goal draft."
    }),
    eventLog: [],
    createdAt: now,
    updatedAt: now
  };
}
export function createForgeRuntimeStateFromSession(session, overrides = {}) {
  const sessionRecord = session;
  const coordinatorState = createForgeCoordinatorState(sessionRecord.coordinatorState);
  return {
    activeSessionId: session.id,
    currentGoal: session.goal,
    draftTasks: Array.isArray(session.draftTasks) ? normalizeForgeTasks(session.draftTasks) : [],
    draftSourceText: typeof session.draftSourceText === "string" ? session.draftSourceText : null,
    validationMessages: Array.isArray(session.validationMessages) ? session.validationMessages : [],
    decisionTrace: normalizeForgeDecisionTrace(sessionRecord.decisionTrace),
    approvedTasks: Array.isArray(session.approvedTasks) ? normalizeForgeTasks(session.approvedTasks) : [],
    assignments: Array.isArray(session.assignments) ? session.assignments : [],
    exports: Array.isArray(session.exports) ? session.exports : [],
    operatorProfile: overrides.operatorProfile ?? createDefaultForgeOperatorProfile(),
    preflight: sessionRecord.preflight && typeof sessionRecord.preflight === "object" ? sessionRecord.preflight : createEmptyForgePreflightState(),
    responses: Array.isArray(session.responses) ? session.responses : [],
    sessionContextSelection: normalizeForgeSessionContextSelection(
      sessionRecord.sessionContextSelection
    ),
    runOverride: sessionRecord.runOverride && typeof sessionRecord.runOverride === "object" ? sessionRecord.runOverride : null,
    runSignature: sessionRecord.runSignature && typeof sessionRecord.runSignature === "object" ? sessionRecord.runSignature : null,
    conflicts: Array.isArray(session.conflicts) ? session.conflicts : [],
    syntheses: Array.isArray(session.syntheses) ? session.syntheses.map((synthesis) => ({
      ...synthesis,
      decisionTrace: normalizeForgeDecisionTrace(synthesis.decisionTrace),
      provenance: synthesis.provenance && typeof synthesis.provenance === "object" && Array.isArray(synthesis.provenance) === false ? {
        runSignature: typeof synthesis.provenance.runSignature === "string" && synthesis.provenance.runSignature.trim() !== "" ? synthesis.provenance.runSignature : null,
        operatorProfileSummary: Array.isArray(synthesis.provenance.operatorProfileSummary) ? synthesis.provenance.operatorProfileSummary.filter(
          (entry) => typeof entry === "string" && entry.trim() !== ""
        ) : [],
        preflightWarnings: Array.isArray(synthesis.provenance.preflightWarnings) ? synthesis.provenance.preflightWarnings.filter(
          (entry) => typeof entry === "string" && entry.trim() !== ""
        ) : []
      } : null
    })) : [],
    selectedSynthesisId: session.selectedSynthesisId,
    coordinatorState
  };
}
export function createForgeSessionFromRuntimeState(state, previous) {
  const createdAt = previous?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString();
  return {
    schemaVersion: FORGE_SESSION_SCHEMA_VERSION,
    id: state.activeSessionId ?? previous?.id ?? "",
    roomId: FORGE_ROOM_ID,
    goal: state.currentGoal,
    draftTasks: state.draftTasks,
    draftSourceText: state.draftSourceText,
    validationMessages: state.validationMessages,
    decisionTrace: state.decisionTrace,
    approvedTasks: state.approvedTasks,
    assignments: state.assignments,
    responses: state.responses,
    conflicts: state.conflicts,
    syntheses: state.syntheses,
    selectedSynthesisId: state.selectedSynthesisId,
    preflight: state.preflight,
    sessionContextSelection: state.sessionContextSelection,
    runOverride: state.runOverride,
    runSignature: state.runSignature,
    exports: state.exports,
    coordinatorState: state.coordinatorState,
    eventLog: previous?.eventLog ?? [],
    createdAt,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
