export function createForgeRuntimeSnapshot(state, sessionList, exportSummary) {
  return {
    activeSessionId: state.activeSessionId,
    currentGoal: state.currentGoal,
    draftTasks: state.draftTasks,
    draftSourceText: state.draftSourceText,
    validationMessages: state.validationMessages,
    decisionTrace: state.decisionTrace,
    approvedTasks: state.approvedTasks,
    assignments: state.assignments,
    exports: state.exports,
    exportSummary,
    operatorProfile: state.operatorProfile,
    preflight: state.preflight,
    responses: state.responses,
    runOverride: state.runOverride,
    runSignature: state.runSignature,
    conflicts: state.conflicts,
    syntheses: state.syntheses,
    selectedSynthesisId: state.selectedSynthesisId,
    coordinatorState: state.coordinatorState,
    sessionList
  };
}
