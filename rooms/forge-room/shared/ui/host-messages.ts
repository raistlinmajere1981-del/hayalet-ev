import {
  createDefaultForgeOperatorProfile,
  createEmptyForgePreflightState,
  isForgePreflightStepId,
  normalizeForgeLegacyOperatorEquipmentRecords,
  normalizeForgeLegacyOperatorSkillRecords,
  normalizeForgeLegacySelectionKeys,
  normalizeForgeOperatorEquipmentRecords,
  normalizeForgeOperatorSkillRecords,
  normalizeForgeSessionContextSelectionKeys,
} from "../types/index.js";
import {
  createEmptyForgeRoomSnapshot,
  type ForgeRoomSnapshot,
  type ForgeUiContextState,
} from "./state.js";

type ForgeUnknownRecord = Record<string, unknown>;

function toRecord(value: unknown): ForgeUnknownRecord {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as ForgeUnknownRecord)
    : {};
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function normalizePreferenceValue(key: "mode" | "riskTolerance", value: unknown): string | null {
  if (key === "mode") {
    if (value === "learn_first" || value === "learn-first") {
      return "learn_first";
    }
    if (value === "result_first" || value === "result-first") {
      return "result_first";
    }
    return null;
  }
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

function normalizePreferenceSnapshot(value: unknown): Record<string, string> {
  const source = toRecord(value);
  const preferences: Record<string, string> = {};
  const mode = normalizePreferenceValue("mode", source["mode"]);
  const riskTolerance = normalizePreferenceValue("riskTolerance", source["riskTolerance"]);
  if (mode) {
    preferences["mode"] = mode;
  }
  if (riskTolerance) {
    preferences["riskTolerance"] = riskTolerance;
  }
  return preferences;
}

function normalizePreferenceSelectionKeys(value: unknown): string[] {
  if (Array.isArray(value) === false) {
    return [];
  }
  return value.filter((entry): entry is string => entry === "mode" || entry === "riskTolerance");
}

function normalizeOperatorProfileSnapshot(value: unknown): ForgeRoomSnapshot["operatorProfile"] {
  const fallback = createDefaultForgeOperatorProfile();
  const source = toRecord(value);
  const normalizedPreferences = normalizePreferenceSnapshot(source["preferences"]);
  if (Array.isArray(source["skills"]) || Array.isArray(source["equipment"])) {
    return {
      schemaVersion:
        typeof source["schemaVersion"] === "number"
          ? source["schemaVersion"]
          : fallback.schemaVersion,
      updatedAt: asNonEmptyString(source["updatedAt"], fallback.updatedAt),
      skills: normalizeForgeOperatorSkillRecords(source["skills"]),
      equipment: normalizeForgeOperatorEquipmentRecords(source["equipment"]),
      preferences: normalizedPreferences,
    } as ForgeRoomSnapshot["operatorProfile"];
  }

  const legacySkill = toRecord(source["skill"]);
  const legacyTools = toRecord(source["tools"]);
  return {
    ...fallback,
    skills: normalizeForgeLegacyOperatorSkillRecords(legacySkill),
    equipment: normalizeForgeLegacyOperatorEquipmentRecords(legacyTools),
    preferences: normalizedPreferences,
  } as ForgeRoomSnapshot["operatorProfile"];
}

function normalizeSessionContextSelectionSnapshot(
  value: unknown
): ForgeRoomSnapshot["sessionContextSelection"] {
  const source = toRecord(value);
  if (
    Array.isArray(source["skillKeys"]) ||
    Array.isArray(source["equipmentKeys"]) ||
    Array.isArray(source["preferenceKeys"])
  ) {
    return {
      ...normalizeForgeSessionContextSelectionKeys(source),
      preferenceKeys: normalizePreferenceSelectionKeys(source["preferenceKeys"]),
    } as ForgeRoomSnapshot["sessionContextSelection"];
  }

  const skill = toRecord(source["skill"]);
  const tools = toRecord(source["tools"]);
  const preferences = toRecord(source["preferences"]);
  return {
    ...normalizeForgeSessionContextSelectionKeys({
      skillKeys: normalizeForgeLegacySelectionKeys(skill),
      equipmentKeys: normalizeForgeLegacySelectionKeys(tools),
    }),
    preferenceKeys: [
      preferences["mode"] === true ? "mode" : null,
      preferences["riskTolerance"] === true ? "riskTolerance" : null,
    ].filter((entry): entry is string => typeof entry === "string"),
  } as ForgeRoomSnapshot["sessionContextSelection"];
}

function normalizeRunOverrideSnapshot(value: unknown): ForgeRoomSnapshot["runOverride"] {
  const source = toRecord(value);
  const temporaryConditions = Array.isArray(source["temporaryConditions"])
    ? source["temporaryConditions"].filter(
        (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
      )
    : [];
  const notes =
    typeof source["notes"] === "string" && source["notes"].trim() !== "" ? source["notes"] : "";
  if (
    temporaryConditions.length === 0 &&
    source["mode"] !== "learn_first" &&
    source["mode"] !== "result_first" &&
    notes === "" &&
    source["riskTolerance"] !== "low" &&
    source["riskTolerance"] !== "medium" &&
    source["riskTolerance"] !== "high" &&
    source["enableRovoPreAnalysis"] !== true
  ) {
    return null;
  }
  const mode =
    source["mode"] === "learn_first" || source["mode"] === "result_first" ? source["mode"] : null;
  const riskTolerance =
    source["riskTolerance"] === "low" ||
    source["riskTolerance"] === "medium" ||
    source["riskTolerance"] === "high"
      ? source["riskTolerance"]
      : null;
  return {
    enableRovoPreAnalysis: source["enableRovoPreAnalysis"] === true,
    notes,
    temporaryConditions: [...new Set(temporaryConditions)].sort((left, right) =>
      left.localeCompare(right)
    ),
    ...(mode ? { mode } : {}),
    ...(riskTolerance ? { riskTolerance } : {}),
  };
}

export type ForgeHostMessage =
  | {
      type: "forge-state";
      snapshot?: unknown;
      meta?: unknown;
    }
  | {
      type: "host-context";
      [key: string]: unknown;
    }
  | {
      type: "command-result";
      command?: unknown;
      result?: unknown;
    };

export function sanitizeForgeUiContext(payload: unknown): ForgeUiContextState {
  const source = toRecord(payload);
  const room = toRecord(source["room"]);
  const presence = toRecord(source["presence"]);
  const presenceUser = toRecord(presence["user"] ?? source["user"]);
  const assistant = toRecord(presence["assistant"] ?? source["assistant"]);
  const activeFeature = toRecord(source["activeFeature"]);
  const assistantNickname =
    typeof assistant["nickname"] === "string" && assistant["nickname"].trim() !== ""
      ? assistant["nickname"].trim()
      : "AI0";
  const assistantAvatar =
    typeof assistant["avatar"] === "string" && assistant["avatar"].trim() !== ""
      ? assistant["avatar"].trim()
      : null;
  const assistantConnected = assistant["connected"] === true;
  return {
    assistantAvatar,
    assistantConnected,
    assistantNickname,
    roomId: asNonEmptyString(room["id"], "forge-room"),
    roomName: asNonEmptyString(room["name"], "Forge Room"),
    featureId: asNonEmptyString(activeFeature["id"], "forge-workbench"),
    locale: asNonEmptyString(source["locale"], "en"),
    translations: toRecord(source["translations"]),
    userAvatar:
      typeof presenceUser["avatar"] === "string" && presenceUser["avatar"].trim() !== ""
        ? presenceUser["avatar"].trim()
        : null,
    userNickname: asNonEmptyString(
      typeof presenceUser["nickname"] === "string" ? presenceUser["nickname"] : null,
      "Operator"
    ),
  };
}

function normalizePreflightSnapshot(value: unknown): ForgeRoomSnapshot["preflight"] {
  const source = toRecord(value);
  const fallback = createEmptyForgePreflightState();
  const status =
    source["status"] === "idle" ||
    source["status"] === "running" ||
    source["status"] === "fresh" ||
    source["status"] === "stale" ||
    source["status"] === "warning"
      ? source["status"]
      : fallback.status;
  return {
    activeStepId: isForgePreflightStepId(source["activeStepId"]) ? source["activeStepId"] : null,
    bundle:
      source["bundle"] !== null &&
      typeof source["bundle"] === "object" &&
      Array.isArray(source["bundle"]) === false
        ? (source["bundle"] as ForgeRoomSnapshot["preflight"]["bundle"])
        : fallback.bundle,
    errorMessage:
      typeof source["errorMessage"] === "string" && source["errorMessage"].trim() !== ""
        ? source["errorMessage"]
        : null,
    promptCharCount:
      typeof source["promptCharCount"] === "number" && Number.isFinite(source["promptCharCount"])
        ? source["promptCharCount"]
        : fallback.promptCharCount,
    ranAt:
      typeof source["ranAt"] === "string" && source["ranAt"].trim() !== "" ? source["ranAt"] : null,
    staleReason:
      typeof source["staleReason"] === "string" && source["staleReason"].trim() !== ""
        ? source["staleReason"]
        : null,
    status,
    warnings: Array.isArray(source["warnings"])
      ? source["warnings"].filter((entry): entry is string => typeof entry === "string")
      : fallback.warnings,
  };
}

export function sanitizeForgeRoomSnapshot(payload: unknown): ForgeRoomSnapshot {
  const source = toRecord(payload);
  const fallback = createEmptyForgeRoomSnapshot();
  return {
    activeSessionId:
      typeof source["activeSessionId"] === "string" && source["activeSessionId"].trim() !== ""
        ? source["activeSessionId"]
        : null,
    currentGoal:
      source["currentGoal"] !== null &&
      typeof source["currentGoal"] === "object" &&
      Array.isArray(source["currentGoal"]) === false
        ? (source["currentGoal"] as ForgeRoomSnapshot["currentGoal"])
        : null,
    draftTasks: Array.isArray(source["draftTasks"])
      ? (source["draftTasks"] as ForgeRoomSnapshot["draftTasks"])
      : fallback.draftTasks,
    draftSourceText:
      typeof source["draftSourceText"] === "string" ? source["draftSourceText"] : null,
    validationMessages: Array.isArray(source["validationMessages"])
      ? source["validationMessages"].filter(
          (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
        )
      : fallback.validationMessages,
    decisionTrace: Array.isArray(source["decisionTrace"])
      ? source["decisionTrace"].filter(
          (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
        )
      : fallback.decisionTrace,
    approvedTasks: Array.isArray(source["approvedTasks"])
      ? (source["approvedTasks"] as ForgeRoomSnapshot["approvedTasks"])
      : fallback.approvedTasks,
    assignments: Array.isArray(source["assignments"])
      ? (source["assignments"] as ForgeRoomSnapshot["assignments"])
      : fallback.assignments,
    exports: Array.isArray(source["exports"])
      ? (source["exports"] as ForgeRoomSnapshot["exports"])
      : fallback.exports,
    exportSummary:
      source["exportSummary"] !== null &&
      typeof source["exportSummary"] === "object" &&
      Array.isArray(source["exportSummary"]) === false
        ? (source["exportSummary"] as ForgeRoomSnapshot["exportSummary"])
        : fallback.exportSummary,
    operatorProfile: normalizeOperatorProfileSnapshot(source["operatorProfile"]),
    preflight: normalizePreflightSnapshot(source["preflight"]),
    responses: Array.isArray(source["responses"])
      ? (source["responses"] as ForgeRoomSnapshot["responses"])
      : fallback.responses,
    sessionContextSelection: normalizeSessionContextSelectionSnapshot(
      source["sessionContextSelection"]
    ),
    runOverride: normalizeRunOverrideSnapshot(source["runOverride"]),
    runSignature:
      source["runSignature"] !== null &&
      typeof source["runSignature"] === "object" &&
      Array.isArray(source["runSignature"]) === false
        ? (source["runSignature"] as ForgeRoomSnapshot["runSignature"])
        : fallback.runSignature,
    conflicts: Array.isArray(source["conflicts"])
      ? (source["conflicts"] as ForgeRoomSnapshot["conflicts"])
      : fallback.conflicts,
    syntheses: Array.isArray(source["syntheses"])
      ? (source["syntheses"] as ForgeRoomSnapshot["syntheses"])
      : fallback.syntheses,
    selectedSynthesisId:
      typeof source["selectedSynthesisId"] === "string" &&
      source["selectedSynthesisId"].trim() !== ""
        ? source["selectedSynthesisId"]
        : null,
    coordinatorState:
      source["coordinatorState"] !== null &&
      typeof source["coordinatorState"] === "object" &&
      Array.isArray(source["coordinatorState"]) === false
        ? (source["coordinatorState"] as ForgeRoomSnapshot["coordinatorState"])
        : fallback.coordinatorState,
    sessionList: Array.isArray(source["sessionList"])
      ? (source["sessionList"] as ForgeRoomSnapshot["sessionList"])
      : fallback.sessionList,
  };
}
