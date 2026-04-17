import {
  FORGE_PREFLIGHT_SCHEMA_VERSION,
  FORGE_ROOM_ID,
  FORGE_SESSION_SCHEMA_VERSION,
} from "../../shared/forge-constants.js";
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
  ForgeOperatorProfile,
  ForgePreflightState,
  ForgeRunOverride,
  ForgeRunSignature,
  ForgeSessionContextSelection,
} from "../../shared/types/index.js";
import {
  createDefaultForgeOperatorProfile,
  createEmptyForgePreflightState,
  createEmptyForgeSessionContextSelection,
  isForgePreflightStepId,
  normalizeForgeLegacySelectionKeys,
  normalizeForgeSessionContextSelectionKeys,
  reconcileForgeSessionContextSelection,
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
  decisionTrace: string[];
  exports: ForgeHandoffExportRecord[];
  operatorProfile: ForgeOperatorProfile;
  preflight: ForgePreflightState;
  responses: ForgeAgentResponse[];
  sessionContextSelection: ForgeSessionContextSelection;
  runOverride: ForgeRunOverride | null;
  runSignature: ForgeRunSignature | null;
  selectedSynthesisId: string | null;
  syntheses: ForgeSynthesis[];
}

export interface ForgeSessionListItem {
  id: string;
  updatedAt: string;
  title: string;
}

function normalizeForgeTask(task: ForgeTask): ForgeTask {
  return {
    ...task,
    contextCapsule:
      task.contextCapsule &&
      typeof task.contextCapsule === "object" &&
      Array.isArray(task.contextCapsule) === false
        ? {
            summary:
              typeof task.contextCapsule.summary === "string" ? task.contextCapsule.summary : "",
            relevantModules: Array.isArray(task.contextCapsule.relevantModules)
              ? task.contextCapsule.relevantModules.filter(
                  (entry): entry is string => typeof entry === "string"
                )
              : [],
            constraints: Array.isArray(task.contextCapsule.constraints)
              ? task.contextCapsule.constraints.filter(
                  (entry): entry is string => typeof entry === "string"
                )
              : [],
          }
        : null,
  };
}

function normalizeForgeTasks(tasks: ForgeTask[]): ForgeTask[] {
  return tasks.map((task) => normalizeForgeTask(task));
}

function normalizeForgeDecisionTrace(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeForgeSessionContextSelection(value: unknown): ForgeSessionContextSelection {
  const record = toRecord(value);
  if (
    Array.isArray(record["skillKeys"]) ||
    Array.isArray(record["equipmentKeys"]) ||
    Array.isArray(record["preferenceKeys"])
  ) {
    return normalizeForgeSessionContextSelectionKeys(record);
  }

  const skill = toRecord(record["skill"]);
  const tools = toRecord(record["tools"]);
  const preferences = toRecord(record["preferences"]);
  return normalizeForgeSessionContextSelectionKeys({
    skillKeys: normalizeForgeLegacySelectionKeys(skill),
    equipmentKeys: normalizeForgeLegacySelectionKeys(tools),
    preferenceKeys: normalizeForgeLegacySelectionKeys(preferences).filter(
      (entry): entry is "mode" | "riskTolerance" => entry === "mode" || entry === "riskTolerance"
    ),
  });
}

function normalizeForgeRunOverride(value: unknown): ForgeRunOverride | null {
  const record = toRecord(value);
  const notes = typeof record["notes"] === "string" ? record["notes"].trim() : "";
  const temporaryConditions = Array.isArray(record["temporaryConditions"])
    ? Array.from(
        new Set(
          record["temporaryConditions"]
            .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
            .map((entry) => entry.trim())
        )
      )
    : [];

  if (
    temporaryConditions.length > 0 ||
    notes !== "" ||
    record["enableRovoPreAnalysis"] === true ||
    record["mode"] === "learn_first" ||
    record["mode"] === "result_first" ||
    record["riskTolerance"] === "low" ||
    record["riskTolerance"] === "medium" ||
    record["riskTolerance"] === "high"
  ) {
    const mode =
      record["mode"] === "learn_first" || record["mode"] === "result_first"
        ? record["mode"]
        : null;
    const riskTolerance =
      record["riskTolerance"] === "low" ||
      record["riskTolerance"] === "medium" ||
      record["riskTolerance"] === "high"
        ? record["riskTolerance"]
        : null;
    return {
      enableRovoPreAnalysis: record["enableRovoPreAnalysis"] === true,
      notes,
      temporaryConditions: temporaryConditions.sort((left, right) => left.localeCompare(right)),
      ...(mode ? { mode } : {}),
      ...(riskTolerance ? { riskTolerance } : {}),
    };
  }

  if (record["enableRovoPreAnalysis"] !== true) {
    return null;
  }

  return {
    enableRovoPreAnalysis: true,
    notes,
    temporaryConditions: [],
  };
}

function normalizeForgePreflightState(value: unknown): ForgePreflightState {
  const record = toRecord(value);
  const bundle = toRecord(record["bundle"]);
  const fallback = createEmptyForgePreflightState();
  const status =
    record["status"] === "idle" ||
    record["status"] === "running" ||
    record["status"] === "fresh" ||
    record["status"] === "stale" ||
    record["status"] === "warning"
      ? record["status"]
      : fallback.status;
  const warnings = Array.isArray(record["warnings"])
    ? record["warnings"].filter((entry): entry is string => typeof entry === "string")
    : fallback.warnings;
  const normalized = {
    activeStepId: isForgePreflightStepId(record["activeStepId"]) ? record["activeStepId"] : null,
    bundle:
      record["bundle"] !== null &&
      typeof record["bundle"] === "object" &&
      Array.isArray(record["bundle"]) === false
        ? (record["bundle"] as ForgePreflightState["bundle"])
        : fallback.bundle,
    errorMessage:
      typeof record["errorMessage"] === "string" && record["errorMessage"].trim() !== ""
        ? record["errorMessage"]
        : null,
    promptCharCount:
      typeof record["promptCharCount"] === "number" && Number.isFinite(record["promptCharCount"])
        ? record["promptCharCount"]
        : fallback.promptCharCount,
    ranAt: typeof record["ranAt"] === "string" && record["ranAt"].trim() !== "" ? record["ranAt"] : null,
    staleReason:
      typeof record["staleReason"] === "string" && record["staleReason"].trim() !== ""
        ? record["staleReason"]
        : null,
    status,
    warnings,
  } satisfies ForgePreflightState;

  if (bundle["schemaVersion"] === FORGE_PREFLIGHT_SCHEMA_VERSION) {
    return normalized;
  }

  if (record["bundle"] !== undefined && record["bundle"] !== null) {
    return {
      ...fallback,
      status: "stale",
      staleReason: "Legacy preflight bundle requires a rerun with the new operator context model.",
      warnings: ["Legacy preflight bundle was invalidated during session hydration."],
    };
  }

  return normalized;
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
    decisionTrace: [],
    approvedTasks: [],
    assignments: [],
    exports: [],
    operatorProfile: createDefaultForgeOperatorProfile(),
    preflight: createEmptyForgePreflightState(),
    responses: [],
    sessionContextSelection: createEmptyForgeSessionContextSelection(),
    runOverride: null,
    runSignature: null,
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
    decisionTrace: [],
    preflight: createEmptyForgePreflightState(),
    sessionContextSelection: createEmptyForgeSessionContextSelection(),
    runOverride: null,
    runSignature: null,
    exports: [],
    coordinatorState: createForgeCoordinatorState({
      note: "Session created. Waiting for the first goal draft.",
    }),
    eventLog: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createForgeRuntimeStateFromSession(
  session: ForgeSession,
  overrides: {
    operatorProfile?: ForgeOperatorProfile;
  } = {}
): ForgeRuntimeState {
  const sessionRecord = session as Partial<ForgeSession>;
  const coordinatorState = createForgeCoordinatorState(sessionRecord.coordinatorState);
  const operatorProfile = overrides.operatorProfile ?? createDefaultForgeOperatorProfile();
  const sessionContextSelection = reconcileForgeSessionContextSelection({
    selection: normalizeForgeSessionContextSelection(sessionRecord.sessionContextSelection),
    allowedSkillKeys: operatorProfile.skills.map((entry) => entry.skillKey),
    allowedEquipmentKeys: operatorProfile.equipment.map((entry) => entry.equipmentKey),
    allowedPreferenceKeys: Object.keys(operatorProfile.preferences).filter(
      (entry): entry is "mode" | "riskTolerance" => entry === "mode" || entry === "riskTolerance"
    ),
  });
  return {
    activeSessionId: session.id,
    currentGoal: session.goal,
    draftTasks: Array.isArray(session.draftTasks) ? normalizeForgeTasks(session.draftTasks) : [],
    draftSourceText: typeof session.draftSourceText === "string" ? session.draftSourceText : null,
    validationMessages: Array.isArray(session.validationMessages) ? session.validationMessages : [],
    decisionTrace: normalizeForgeDecisionTrace(sessionRecord.decisionTrace),
    approvedTasks: Array.isArray(session.approvedTasks)
      ? normalizeForgeTasks(session.approvedTasks)
      : [],
    assignments: Array.isArray(session.assignments) ? session.assignments : [],
    exports: Array.isArray(session.exports) ? session.exports : [],
    operatorProfile,
    preflight: normalizeForgePreflightState(sessionRecord.preflight),
    responses: Array.isArray(session.responses) ? session.responses : [],
    sessionContextSelection,
    runOverride: normalizeForgeRunOverride(sessionRecord.runOverride),
    runSignature:
      sessionRecord.runSignature && typeof sessionRecord.runSignature === "object"
        ? sessionRecord.runSignature
        : null,
    conflicts: Array.isArray(session.conflicts) ? session.conflicts : [],
    syntheses: Array.isArray(session.syntheses)
      ? session.syntheses.map((synthesis) => ({
          ...synthesis,
          decisionTrace: normalizeForgeDecisionTrace(synthesis.decisionTrace),
          provenance:
            synthesis.provenance &&
            typeof synthesis.provenance === "object" &&
            Array.isArray(synthesis.provenance) === false
              ? {
                  runSignature:
                    typeof synthesis.provenance.runSignature === "string" &&
                    synthesis.provenance.runSignature.trim() !== ""
                      ? synthesis.provenance.runSignature
                      : null,
                  operatorProfileSummary: Array.isArray(synthesis.provenance.operatorProfileSummary)
                    ? synthesis.provenance.operatorProfileSummary.filter(
                        (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
                      )
                    : [],
                  preflightWarnings: Array.isArray(synthesis.provenance.preflightWarnings)
                    ? synthesis.provenance.preflightWarnings.filter(
                        (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
                      )
                    : [],
                }
              : null,
        }))
      : [],
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
    decisionTrace: state.decisionTrace,
    approvedTasks: state.approvedTasks,
    assignments: state.assignments,
    responses: state.responses,
    conflicts: state.conflicts,
    syntheses: state.syntheses,
    selectedSynthesisId: state.selectedSynthesisId,
    preflight: state.preflight,
    sessionContextSelection: state.sessionContextSelection,
    runOverride: state.runOverride,
    runSignature: state.runSignature,
    exports: state.exports,
    coordinatorState: state.coordinatorState,
    eventLog: previous?.eventLog ?? [],
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}
