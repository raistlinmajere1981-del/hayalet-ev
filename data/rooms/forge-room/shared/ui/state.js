export function createEmptyForgeRoomSnapshot() {
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
      targetRoomId: null
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
      lastUpdatedAt: ""
    },
    sessionList: []
  };
}
export function createEmptyForgeUiContext() {
  return {
    roomId: "forge-room",
    roomName: "Forge Room",
    featureId: "forge-workbench",
    locale: "en",
    translations: {},
    userNickname: "Operator"
  };
}
export function createInitialForgeUiState() {
  return {
    context: createEmptyForgeUiContext(),
    snapshot: createEmptyForgeRoomSnapshot(),
    lastCommandResult: null,
    pendingCommand: null,
    meta: {
      roleCatalog: {},
      personaPresets: {}
    }
  };
}
