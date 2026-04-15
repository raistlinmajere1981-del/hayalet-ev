import type { ForgeGoal, ForgeTask, ForgeTaskAssignment, ForgeAgentResponse, ForgeConflict, ForgeSynthesis } from "../../shared/types/index.js";
import type { ForgeRuntimeState } from "./forge-runtime-state.js";

export type ForgeRuntimeAction =
  | {
      type: "runtime/hydrate";
      state: ForgeRuntimeState;
    }
  | {
      type: "session/activate";
      sessionId: string | null;
    }
  | {
      type: "goal/set";
      goal: ForgeGoal | null;
    }
  | {
      type: "draft/set";
      draftTasks: ForgeTask[];
      draftSourceText: string | null;
      validationMessages: string[];
    }
  | {
      type: "approved/set";
      approvedTasks: ForgeTask[];
    }
  | {
      type: "assignments/set";
      assignments: ForgeTaskAssignment[];
    }
  | {
      type: "responses/set";
      responses: ForgeAgentResponse[];
    }
  | {
      type: "exports/set";
      exports: ForgeRuntimeState["exports"];
    }
  | {
      type: "conflicts/set";
      conflicts: ForgeConflict[];
    }
  | {
      type: "syntheses/set";
      syntheses: ForgeSynthesis[];
      selectedSynthesisId: string | null;
    }
  | {
      type: "coordinator/set";
      coordinatorState: ForgeRuntimeState["coordinatorState"];
    };
