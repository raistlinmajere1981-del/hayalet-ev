export function reduceForgeRuntimeState(state, action) {
  switch (action.type) {
    case "runtime/hydrate":
      return action.state;
    case "session/activate":
      return {
        ...state,
        activeSessionId: action.sessionId
      };
    case "goal/set":
      return {
        ...state,
        currentGoal: action.goal
      };
    case "draft/set":
      return {
        ...state,
        draftTasks: action.draftTasks,
        draftSourceText: action.draftSourceText,
        validationMessages: action.validationMessages
      };
    case "approved/set":
      return {
        ...state,
        approvedTasks: action.approvedTasks
      };
    case "assignments/set":
      return {
        ...state,
        assignments: action.assignments
      };
    case "responses/set":
      return {
        ...state,
        responses: action.responses
      };
    case "exports/set":
      return {
        ...state,
        exports: action.exports
      };
    case "conflicts/set":
      return {
        ...state,
        conflicts: action.conflicts
      };
    case "syntheses/set":
      return {
        ...state,
        syntheses: action.syntheses,
        selectedSynthesisId: action.selectedSynthesisId
      };
    case "coordinator/set":
      return {
        ...state,
        coordinatorState: action.coordinatorState
      };
    default:
      return state;
  }
}
