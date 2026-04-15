export function createForgeRuntimeSnapshot(state, sessionList, exportSummary) {
  return {
    activeSessionId: state.activeSessionId,
    currentGoal: state.currentGoal,
    draftTasks: state.draftTasks,
    draftSourceText: state.draftSourceText,
    validationMessages: state.validationMessages,
    approvedTasks: state.approvedTasks,
    assignments: state.assignments,
    exports: state.exports,
    exportSummary,
    responses: state.responses,
    conflicts: state.conflicts,
    syntheses: state.syntheses,
    selectedSynthesisId: state.selectedSynthesisId,
    coordinatorState: state.coordinatorState,
    sessionList
  };
}
