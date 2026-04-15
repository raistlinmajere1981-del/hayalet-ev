import { FORGE_ROOM_ID, FORGE_SESSION_SCHEMA_VERSION } from "../../shared/forge-constants.js";
import type {
  ForgeGoal,
  ForgeSession,
  ForgeTask,
  ForgeTaskAssignment,
  ForgeAgentResponse,
  ForgeConflict,
  ForgeSynthesis,
  ForgeCoordinatorState,
  ForgeHandoffExportRecord,
} from "../../shared/types/index.js";

export interface ForgeRuntimeState {
  activeSessionId: string | null;
  approvedTasks: ForgeTask[];
  assignments: ForgeTaskAssignment[];
  conflicts: ForgeConflict[];
  coordinatorState: ForgeCoordinatorState;
  currentGoal: ForgeGoal | null;
  draftTasks: ForgeTask[];
  draftSourceText: string | null;
  validationMessages: string[];
  exports: ForgeHandoffExportRecord[];
  responses: ForgeAgentResponse[];
  selectedSynthesisId: string | null;
  syntheses: ForgeSynthesis[];
}

export interface ForgeSessionListItem {
  id: string;
  updatedAt: string;
  title: string;
}

export function createForgeCoordinatorState(
  overrides: Partial<ForgeCoordinatorState> = {}
): ForgeCoordinatorState {
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
    lastUpdatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createEmptyForgeRuntimeState(): ForgeRuntimeState {
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
    coordinatorState: createForgeCoordinatorState(),
  };
}

export function createEmptyForgeSession(sessionId: string): ForgeSession {
  const now = new Date().toISOString();
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
      note: "Session created. Waiting for the first goal draft.",
    }),
    eventLog: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createForgeRuntimeStateFromSession(session: ForgeSession): ForgeRuntimeState {
  const sessionRecord = session as Partial<ForgeSession>;
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
    coordinatorState,
  };
}

export function createForgeSessionFromRuntimeState(
  state: ForgeRuntimeState,
  previous: ForgeSession | null
): ForgeSession {
  const createdAt = previous?.createdAt ?? new Date().toISOString();
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
    updatedAt: new Date().toISOString(),
  };
}
