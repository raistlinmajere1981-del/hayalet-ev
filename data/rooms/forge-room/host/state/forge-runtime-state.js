import { FORGE_ROOM_ID, FORGE_SESSION_SCHEMA_VERSION } from "../../shared/forge-constants.js";
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
    approvedTasks: [],
    assignments: [],
    exports: [],
    responses: [],
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
    exports: [],
    coordinatorState: createForgeCoordinatorState({
      note: "Session created. Waiting for the first goal draft."
    }),
    eventLog: [],
    createdAt: now,
    updatedAt: now
  };
}
export function createForgeRuntimeStateFromSession(session) {
  const sessionRecord = session;
  const coordinatorState = createForgeCoordinatorState(sessionRecord.coordinatorState);
  return {
    activeSessionId: session.id,
    currentGoal: session.goal,
    draftTasks: Array.isArray(session.draftTasks) ? session.draftTasks : [],
    draftSourceText: typeof session.draftSourceText === "string" ? session.draftSourceText : null,
    validationMessages: Array.isArray(session.validationMessages) ? session.validationMessages : [],
    approvedTasks: Array.isArray(session.approvedTasks) ? session.approvedTasks : [],
    assignments: Array.isArray(session.assignments) ? session.assignments : [],
    exports: Array.isArray(session.exports) ? session.exports : [],
    responses: Array.isArray(session.responses) ? session.responses : [],
    conflicts: Array.isArray(session.conflicts) ? session.conflicts : [],
    syntheses: Array.isArray(session.syntheses) ? session.syntheses : [],
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
    approvedTasks: state.approvedTasks,
    assignments: state.assignments,
    responses: state.responses,
    conflicts: state.conflicts,
    syntheses: state.syntheses,
    selectedSynthesisId: state.selectedSynthesisId,
    exports: state.exports,
    coordinatorState: state.coordinatorState,
    eventLog: previous?.eventLog ?? [],
    createdAt,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
