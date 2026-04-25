import {
  createDefaultForgeOperatorProfile,
  createEmptyForgePreflightState,
  isForgePreflightStepId,
  normalizeForgeLegacyOperatorEquipmentRecords,
  normalizeForgeLegacyOperatorSkillRecords,
  normalizeForgeLegacySelectionKeys,
  normalizeForgeOperatorEquipmentRecords,
  normalizeForgeOperatorSkillRecords,
  normalizeForgeSessionContextSelectionKeys
} from "../types/index.js";
import {
  createEmptyForgeRoomSnapshot
} from "./state.js";
function toRecord(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
}
function asNonEmptyString(value, fallback) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}
function normalizePreferenceValue(key, value) {
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
function normalizePreferenceSnapshot(value) {
  const source = toRecord(value);
  const preferences = {};
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
function normalizePreferenceSelectionKeys(value) {
  if (Array.isArray(value) === false) {
    return [];
  }
  return value.filter((entry) => entry === "mode" || entry === "riskTolerance");
}
function normalizeOperatorProfileSnapshot(value) {
  const fallback = createDefaultForgeOperatorProfile();
  const source = toRecord(value);
  const normalizedPreferences = normalizePreferenceSnapshot(source["preferences"]);
  if (Array.isArray(source["skills"]) || Array.isArray(source["equipment"])) {
    return {
      schemaVersion: typeof source["schemaVersion"] === "number" ? source["schemaVersion"] : fallback.schemaVersion,
      updatedAt: asNonEmptyString(source["updatedAt"], fallback.updatedAt),
      skills: normalizeForgeOperatorSkillRecords(source["skills"]),
      equipment: normalizeForgeOperatorEquipmentRecords(source["equipment"]),
      preferences: normalizedPreferences
    };
  }
  const legacySkill = toRecord(source["skill"]);
  const legacyTools = toRecord(source["tools"]);
  return {
    ...fallback,
    skills: normalizeForgeLegacyOperatorSkillRecords(legacySkill),
    equipment: normalizeForgeLegacyOperatorEquipmentRecords(legacyTools),
    preferences: normalizedPreferences
  };
}
function normalizeSessionContextSelectionSnapshot(value) {
  const source = toRecord(value);
  if (Array.isArray(source["skillKeys"]) || Array.isArray(source["equipmentKeys"]) || Array.isArray(source["preferenceKeys"])) {
    return {
      ...normalizeForgeSessionContextSelectionKeys(source),
      preferenceKeys: normalizePreferenceSelectionKeys(source["preferenceKeys"])
    };
  }
  const skill = toRecord(source["skill"]);
  const tools = toRecord(source["tools"]);
  const preferences = toRecord(source["preferences"]);
  return {
    ...normalizeForgeSessionContextSelectionKeys({
      skillKeys: normalizeForgeLegacySelectionKeys(skill),
      equipmentKeys: normalizeForgeLegacySelectionKeys(tools)
    }),
    preferenceKeys: [
      preferences["mode"] === true ? "mode" : null,
      preferences["riskTolerance"] === true ? "riskTolerance" : null
    ].filter((entry) => typeof entry === "string")
  };
}
function normalizeRunOverrideSnapshot(value) {
  const source = toRecord(value);
  const temporaryConditions = Array.isArray(source["temporaryConditions"]) ? source["temporaryConditions"].filter(
    (entry) => typeof entry === "string" && entry.trim() !== ""
  ) : [];
  const notes = typeof source["notes"] === "string" && source["notes"].trim() !== "" ? source["notes"] : "";
  if (source["architectSeatId"] !== "ai2" && temporaryConditions.length === 0 && source["mode"] !== "learn_first" && source["mode"] !== "result_first" && notes === "" && source["riskTolerance"] !== "low" && source["riskTolerance"] !== "medium" && source["riskTolerance"] !== "high" && source["enableRovoPreAnalysis"] !== true) {
    return null;
  }
  const mode = source["mode"] === "learn_first" || source["mode"] === "result_first" ? source["mode"] : null;
  const riskTolerance = source["riskTolerance"] === "low" || source["riskTolerance"] === "medium" || source["riskTolerance"] === "high" ? source["riskTolerance"] : null;
  const architectSeatId = source["architectSeatId"] === "ai1" || source["architectSeatId"] === "ai2" ? source["architectSeatId"] : null;
  return {
    enableRovoPreAnalysis: source["enableRovoPreAnalysis"] === true,
    notes,
    temporaryConditions: [...new Set(temporaryConditions)].sort(
      (left, right) => left.localeCompare(right)
    ),
    ...architectSeatId === "ai2" ? { architectSeatId } : {},
    ...mode ? { mode } : {},
    ...riskTolerance ? { riskTolerance } : {}
  };
}
function normalizeDraftArchitectSeatSnapshot(value, seatId) {
  const source = toRecord(value);
  return {
    assigned: source["assigned"] === true,
    avatar: typeof source["avatar"] === "string" && source["avatar"].trim() !== "" ? source["avatar"].trim() : null,
    connected: source["connected"] === true,
    nickname: asNonEmptyString(source["nickname"], seatId.toUpperCase()),
    seatId
  };
}
export function sanitizeForgeUiContext(payload) {
  const source = toRecord(payload);
  const room = toRecord(source["room"]);
  const presence = toRecord(source["presence"]);
  const presenceUser = toRecord(presence["user"] ?? source["user"]);
  const assistant = toRecord(presence["assistant"] ?? source["assistant"]);
  const slots = toRecord(presence["slots"] ?? source["slots"]);
  const activeFeature = toRecord(source["activeFeature"]);
  const assistantNickname = typeof assistant["nickname"] === "string" && assistant["nickname"].trim() !== "" ? assistant["nickname"].trim() : "AI0";
  const assistantAvatar = typeof assistant["avatar"] === "string" && assistant["avatar"].trim() !== "" ? assistant["avatar"].trim() : null;
  const assistantAssigned = assistant["assigned"] === true;
  const assistantConnected = assistant["connected"] === true;
  return {
    assistantAssigned,
    assistantAvatar,
    assistantConnected,
    assistantNickname,
    draftArchitectSeats: {
      ai1: normalizeDraftArchitectSeatSnapshot(slots["ai1"], "ai1"),
      ai2: normalizeDraftArchitectSeatSnapshot(slots["ai2"], "ai2")
    },
    roomId: asNonEmptyString(room["id"], "forge-room"),
    roomName: asNonEmptyString(room["name"], "Forge Room"),
    featureId: asNonEmptyString(activeFeature["id"], "forge-workbench"),
    locale: asNonEmptyString(source["locale"], "en"),
    translations: toRecord(source["translations"]),
    userAvatar: typeof presenceUser["avatar"] === "string" && presenceUser["avatar"].trim() !== "" ? presenceUser["avatar"].trim() : null,
    userNickname: asNonEmptyString(
      typeof presenceUser["nickname"] === "string" ? presenceUser["nickname"] : null,
      "Operator"
    )
  };
}
function normalizePreflightSnapshot(value) {
  const source = toRecord(value);
  const fallback = createEmptyForgePreflightState();
  const status = source["status"] === "idle" || source["status"] === "running" || source["status"] === "fresh" || source["status"] === "stale" || source["status"] === "warning" ? source["status"] : fallback.status;
  return {
    activeStepId: isForgePreflightStepId(source["activeStepId"]) ? source["activeStepId"] : null,
    bundle: source["bundle"] !== null && typeof source["bundle"] === "object" && Array.isArray(source["bundle"]) === false ? source["bundle"] : fallback.bundle,
    contextDigest: typeof source["contextDigest"] === "string" && source["contextDigest"].trim() !== "" ? source["contextDigest"] : fallback.contextDigest,
    errorMessage: typeof source["errorMessage"] === "string" && source["errorMessage"].trim() !== "" ? source["errorMessage"] : null,
    expectedContextDigest: typeof source["expectedContextDigest"] === "string" && source["expectedContextDigest"].trim() !== "" ? source["expectedContextDigest"] : fallback.expectedContextDigest,
    preflightId: typeof source["preflightId"] === "string" && source["preflightId"].trim() !== "" ? source["preflightId"] : fallback.preflightId,
    promptCharCount: typeof source["promptCharCount"] === "number" && Number.isFinite(source["promptCharCount"]) ? source["promptCharCount"] : fallback.promptCharCount,
    ranAt: typeof source["ranAt"] === "string" && source["ranAt"].trim() !== "" ? source["ranAt"] : null,
    runId: typeof source["runId"] === "string" && source["runId"].trim() !== "" ? source["runId"] : fallback.runId,
    sessionRevision: typeof source["sessionRevision"] === "number" && Number.isFinite(source["sessionRevision"]) ? Math.max(0, Math.trunc(source["sessionRevision"])) : fallback.sessionRevision,
    staleReason: typeof source["staleReason"] === "string" && source["staleReason"].trim() !== "" ? source["staleReason"] : null,
    status,
    warnings: Array.isArray(source["warnings"]) ? source["warnings"].filter((entry) => typeof entry === "string") : fallback.warnings
  };
}
export function sanitizeForgeRoomSnapshot(payload) {
  const source = toRecord(payload);
  const fallback = createEmptyForgeRoomSnapshot();
  return {
    activeSessionId: typeof source["activeSessionId"] === "string" && source["activeSessionId"].trim() !== "" ? source["activeSessionId"] : null,
    contextDigest: typeof source["contextDigest"] === "string" && source["contextDigest"].trim() !== "" ? source["contextDigest"] : fallback.contextDigest,
    currentGoal: source["currentGoal"] !== null && typeof source["currentGoal"] === "object" && Array.isArray(source["currentGoal"]) === false ? source["currentGoal"] : null,
    draftTasks: Array.isArray(source["draftTasks"]) ? source["draftTasks"] : fallback.draftTasks,
    draftSourceText: typeof source["draftSourceText"] === "string" ? source["draftSourceText"] : null,
    validationMessages: Array.isArray(source["validationMessages"]) ? source["validationMessages"].filter(
      (entry) => typeof entry === "string" && entry.trim() !== ""
    ) : fallback.validationMessages,
    decisionTrace: Array.isArray(source["decisionTrace"]) ? source["decisionTrace"].filter(
      (entry) => typeof entry === "string" && entry.trim() !== ""
    ) : fallback.decisionTrace,
    approvedTasks: Array.isArray(source["approvedTasks"]) ? source["approvedTasks"] : fallback.approvedTasks,
    assignments: Array.isArray(source["assignments"]) ? source["assignments"] : fallback.assignments,
    exports: Array.isArray(source["exports"]) ? source["exports"] : fallback.exports,
    exportSummary: source["exportSummary"] !== null && typeof source["exportSummary"] === "object" && Array.isArray(source["exportSummary"]) === false ? source["exportSummary"] : fallback.exportSummary,
    operatorProfile: normalizeOperatorProfileSnapshot(source["operatorProfile"]),
    preflight: normalizePreflightSnapshot(source["preflight"]),
    responses: Array.isArray(source["responses"]) ? source["responses"] : fallback.responses,
    runId: typeof source["runId"] === "string" && source["runId"].trim() !== "" ? source["runId"] : fallback.runId,
    sessionRevision: typeof source["sessionRevision"] === "number" && Number.isFinite(source["sessionRevision"]) ? Math.max(0, Math.trunc(source["sessionRevision"])) : fallback.sessionRevision,
    sessionContextSelection: normalizeSessionContextSelectionSnapshot(
      source["sessionContextSelection"]
    ),
    runOverride: normalizeRunOverrideSnapshot(source["runOverride"]),
    runSignature: source["runSignature"] !== null && typeof source["runSignature"] === "object" && Array.isArray(source["runSignature"]) === false ? source["runSignature"] : fallback.runSignature,
    conflicts: Array.isArray(source["conflicts"]) ? source["conflicts"] : fallback.conflicts,
    syntheses: Array.isArray(source["syntheses"]) ? source["syntheses"] : fallback.syntheses,
    selectedSynthesisId: typeof source["selectedSynthesisId"] === "string" && source["selectedSynthesisId"].trim() !== "" ? source["selectedSynthesisId"] : null,
    coordinatorState: source["coordinatorState"] !== null && typeof source["coordinatorState"] === "object" && Array.isArray(source["coordinatorState"]) === false ? source["coordinatorState"] : fallback.coordinatorState,
    sessionList: Array.isArray(source["sessionList"]) ? source["sessionList"] : fallback.sessionList
  };
}
