import type { ForgeGoal } from "./forge-goal.js";
import type {
  ForgePreflightState,
  ForgeRunOverride,
  ForgeRunSignature,
  ForgeSessionContextSelection,
} from "./forge-preflight.js";
import type {
  ForgeEventLog,
  ForgeTask,
  ForgeTaskAssignment,
  ForgeAgentResponse,
  ForgeConflict,
  ForgeSynthesis,
  ForgeCoordinatorState,
  ForgeHandoffExportRecord,
} from "./forge-workflow.js";

export interface ForgeSession {
  schemaVersion: number;
  id: string;
  roomId: string;
  goal: ForgeGoal | null;
  draftTasks: ForgeTask[];
  draftSourceText: string | null;
  validationMessages: string[];
  approvedTasks: ForgeTask[];
  assignments: ForgeTaskAssignment[];
  responses: ForgeAgentResponse[];
  conflicts: ForgeConflict[];
  syntheses: ForgeSynthesis[];
  selectedSynthesisId: string | null;
  decisionTrace: string[];
  preflight: ForgePreflightState;
  sessionContextSelection: ForgeSessionContextSelection;
  runOverride: ForgeRunOverride | null;
  runSignature: ForgeRunSignature | null;
  exports: ForgeHandoffExportRecord[];
  coordinatorState: ForgeCoordinatorState;
  eventLog: ForgeEventLog[];
  createdAt: string;
  updatedAt: string;
}
