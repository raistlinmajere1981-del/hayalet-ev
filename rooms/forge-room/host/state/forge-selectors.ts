import type {
  ForgeGoal,
  ForgeTask,
  ForgeTaskAssignment,
  ForgeAgentResponse,
  ForgeConflict,
  ForgeSynthesis,
  ForgeHandoffExportRecord,
} from "../../shared/types/index.js";
import type { ForgeRuntimeState, ForgeSessionListItem } from "./forge-runtime-state.js";

export interface ForgeRuntimeSnapshot {
  activeSessionId: string | null;
  approvedTasks: ForgeTask[];
  assignments: ForgeTaskAssignment[];
  conflicts: ForgeConflict[];
  coordinatorState: ForgeRuntimeState["coordinatorState"];
  currentGoal: ForgeGoal | null;
  draftTasks: ForgeTask[];
  draftSourceText: string | null;
  validationMessages: string[];
  exports: ForgeHandoffExportRecord[];
  responses: ForgeAgentResponse[];
  selectedSynthesisId: string | null;
  sessionList: ForgeSessionListItem[];
  syntheses: ForgeSynthesis[];
}

export function createForgeRuntimeSnapshot(
  state: ForgeRuntimeState,
  sessionList: ForgeSessionListItem[]
): ForgeRuntimeSnapshot {
  return {
    activeSessionId: state.activeSessionId,
    currentGoal: state.currentGoal,
    draftTasks: state.draftTasks,
    draftSourceText: state.draftSourceText,
    validationMessages: state.validationMessages,
    approvedTasks: state.approvedTasks,
    assignments: state.assignments,
    exports: state.exports,
    responses: state.responses,
    conflicts: state.conflicts,
    syntheses: state.syntheses,
    selectedSynthesisId: state.selectedSynthesisId,
    coordinatorState: state.coordinatorState,
    sessionList,
  };
}
