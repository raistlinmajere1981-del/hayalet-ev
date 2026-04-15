import type {
  ForgeAgentResponse,
  ForgeConflict,
  ForgeCoordinatorState,
  ForgeExportReadinessSummary,
  ForgeGoal,
  ForgeHandoffExportRecord,
  ForgeSynthesis,
  ForgeTask,
  ForgeTaskAssignment,
} from "../types/index.js";

export type ForgeWorkbenchUiFlowState =
  | "IDLE"
  | "GOAL_DEFINED"
  | "SESSION_CREATED"
  | "DRAFT_READY"
  | "APPROVED"
  | "DISPATCHED"
  | "RESPONSES_READY"
  | "CONFLICT"
  | "SYNTHESIS_READY"
  | "EXPORTED";

export type ForgeWorkbenchUiSurface = "goal" | "responses" | "synthesis";

export interface ForgeRoomSnapshot {
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
  exportSummary: ForgeExportReadinessSummary;
  responses: ForgeAgentResponse[];
  selectedSynthesisId: string | null;
  sessionList: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
  syntheses: ForgeSynthesis[];
}

export interface ForgeUiContextState {
  featureId: string;
  locale: string;
  roomId: string;
  roomName: string;
  translations: Record<string, unknown>;
  userNickname: string;
}

export interface ForgeUiState {
  context: ForgeUiContextState;
  lastCommandResult: {
    command: string;
    message: string | null;
    success: boolean;
  } | null;
  pendingCommand: string | null;
  meta: {
    personaPresets: Record<string, unknown>;
    roleCatalog: Record<string, unknown>;
  };
  snapshot: ForgeRoomSnapshot;
}

export function createEmptyForgeRoomSnapshot(): ForgeRoomSnapshot {
  return {
    activeSessionId: null,
    currentGoal: null,
    draftTasks: [],
    draftSourceText: null,
    validationMessages: [],
    approvedTasks: [],
    assignments: [],
    exports: [],
    exportSummary: {
      acceptanceCriteriaCount: 0,
      exportReady: false,
      missingRequirements: ["Select a synthesis"],
      openConflictCount: 0,
      reason: "Export blocked: no selected synthesis.",
      selectedSynthesisId: null,
      status: "blocked",
      targetRoomId: null,
    },
    responses: [],
    conflicts: [],
    syntheses: [],
    selectedSynthesisId: null,
    coordinatorState: {
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
      lastUpdatedAt: "",
    },
    sessionList: [],
  };
}

export function createEmptyForgeUiContext(): ForgeUiContextState {
  return {
    roomId: "forge-room",
    roomName: "Forge Room",
    featureId: "forge-workbench",
    locale: "en",
    translations: {},
    userNickname: "Operator",
  };
}

export function createInitialForgeUiState(): ForgeUiState {
  return {
    context: createEmptyForgeUiContext(),
    snapshot: createEmptyForgeRoomSnapshot(),
    lastCommandResult: null,
    pendingCommand: null,
    meta: {
      roleCatalog: {},
      personaPresets: {},
    },
  };
}
