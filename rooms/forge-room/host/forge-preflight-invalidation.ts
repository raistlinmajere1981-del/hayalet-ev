import type {
  ForgeGoal,
  ForgeOperatorProfile,
  ForgePreflightState,
  ForgeRunOverride,
} from "../shared/types/index.js";
type ForgePreflightStage =
  | "before-draft"
  | "draft-review"
  | "approved-pending-dispatch"
  | "dispatch-started"
  | "synthesis-selected";

function normalizeTools(value: Record<string, boolean | null | undefined>): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .map((key) => [key, value[key] === true])
  );
}

function normalizeProfileFingerprint(profile: ForgeOperatorProfile): string {
  return JSON.stringify({
    preferences: profile.preferences,
    skill: profile.skill,
    tools: profile.tools,
  });
}

function normalizeRunOverrideFingerprint(runOverride: ForgeRunOverride | null): string {
  return JSON.stringify({
    enableRovoPreAnalysis: runOverride?.enableRovoPreAnalysis === true,
    notes: runOverride?.notes.trim() ?? "",
    tools: normalizeTools(runOverride?.tools ?? {}),
  });
}

export function readForgePreflightInvalidationReason(params: {
  goal: ForgeGoal;
  operatorProfile: ForgeOperatorProfile;
  preflight: ForgePreflightState;
  runOverride: ForgeRunOverride | null;
}): string | null {
  const { goal, operatorProfile, preflight, runOverride } = params;
  if (preflight.bundle === null) {
    return preflight.status === "idle"
      ? "Preflight has not been run for this session yet."
      : preflight.staleReason ?? "Preflight data is unavailable.";
  }

  if (preflight.bundle.operatorProfile && normalizeProfileFingerprint(preflight.bundle.operatorProfile) !== normalizeProfileFingerprint(operatorProfile)) {
    return "Operator profile changed after the last preflight run.";
  }

  if (
    normalizeRunOverrideFingerprint(preflight.bundle.runOverride) !==
    normalizeRunOverrideFingerprint(runOverride)
  ) {
    return "Run override changed after the last preflight run.";
  }

  if (
    preflight.bundle.targetRoomContext?.targetRoomId &&
    preflight.bundle.targetRoomContext.targetRoomId !== goal.targetRoomId
  ) {
    return "Target room changed after the last preflight run.";
  }

  if (preflight.status === "stale" && preflight.staleReason) {
    return preflight.staleReason;
  }

  return null;
}

export function readForgePreflightStage(params: {
  hasDispatchStarted: boolean;
  hasSelectedSynthesis: boolean;
  hasTopLevelApprovedTasks: boolean;
  hasTopLevelDraftTasks: boolean;
}): ForgePreflightStage {
  if (params.hasSelectedSynthesis) {
    return "synthesis-selected";
  }
  if (params.hasDispatchStarted) {
    return "dispatch-started";
  }
  if (params.hasTopLevelApprovedTasks) {
    return "approved-pending-dispatch";
  }
  if (params.hasTopLevelDraftTasks) {
    return "draft-review";
  }
  return "before-draft";
}

export function describeForgePreflightStageImpact(
  stage: ForgePreflightStage,
  reason: string
): string {
  switch (stage) {
    case "draft-review":
      return `${reason} Existing draft tasks were kept; review them before approval and the next AI call will refresh preflight automatically.`;
    case "approved-pending-dispatch":
      return `${reason} Approved tasks were kept; dispatch will refresh preflight before any new AI response is requested.`;
    case "dispatch-started":
      return `${reason} In-flight assignments and captured responses were left untouched; the new context only applies to future AI work.`;
    case "synthesis-selected":
      return `${reason} Existing syntheses and exports were preserved; rerun preflight only if you start another AI step.`;
    case "before-draft":
    default:
      return `${reason} The next AI step will refresh preflight automatically.`;
  }
}
