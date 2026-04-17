import {
  createDefaultForgeOperatorProfile,
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

function normalizeLegacySkillLevel(
  value: unknown,
  globalLevel: unknown
): "advanced" | "basic" | "intermediate" | "none" | null {
  if (value === "none" || value === "basic" || value === "intermediate" || value === "advanced") {
    return value;
  }
  if (value === "beginner") {
    return "basic";
  }
  if (value === "good") {
    return globalLevel === "advanced" ? "advanced" : "intermediate";
  }
  return null;
}

function normalizeOperatorProfileSnapshot(value: unknown): ForgeRoomSnapshot["operatorProfile"] {
  const fallback = createDefaultForgeOperatorProfile();
  const source = toRecord(value);
  if (Array.isArray(source["skills"]) || Array.isArray(source["equipment"])) {
    return {
      schemaVersion:
        typeof source["schemaVersion"] === "number" ? source["schemaVersion"] : fallback.schemaVersion,
      updatedAt: asNonEmptyString(source["updatedAt"], fallback.updatedAt),
      skills: normalizeForgeOperatorSkillRecords(source["skills"]),
      equipment: normalizeForgeOperatorEquipmentRecords(source["equipment"]),
    };
  }

  const legacySkill = toRecord(source["skill"]);
  const legacyTools = toRecord(source["tools"]);
  const globalSkillLevel = legacySkill["level"];
  return {
    ...fallback,
    skills: normalizeForgeOperatorSkillRecords(
      [
        ["soldering", legacySkill["soldering"]] as const,
        ["measurement", legacySkill["measurement"]] as const,
        ["mechanical", legacySkill["mechanical"]] as const,
      ].flatMap(([skillKey, level]) => {
        const normalizedLevel = normalizeLegacySkillLevel(level, globalSkillLevel);
        return normalizedLevel
          ? [
              {
                skillKey,
                label: skillKey.replace(/_/g, " "),
                level: normalizedLevel,
              },
            ]
          : [];
      })
    ),
    equipment: normalizeForgeOperatorEquipmentRecords(
      [
        ["multimeter", legacyTools["multimeter"]] as const,
        ["soldering_iron", legacyTools["solderingIron"]] as const,
        ["hot_air", legacyTools["hotAir"]] as const,
        ["bench_supply", legacyTools["benchPowerSupply"]] as const,
        ["magnification", legacyTools["magnification"]] as const,
      ].flatMap(([equipmentKey, available]) => {
        if (available === true) {
          return [{ equipmentKey, label: equipmentKey.replace(/_/g, " "), status: "available" }];
        }
        if (available === false) {
          return [{ equipmentKey, label: equipmentKey.replace(/_/g, " "), status: "unavailable" }];
        }
        return [];
      })
    ),
  };
}

function normalizeSessionContextSelectionSnapshot(
  value: unknown
): ForgeRoomSnapshot["sessionContextSelection"] {
  const source = toRecord(value);
  if (
    Array.isArray(source["skillKeys"]) ||
    Array.isArray(source["equipmentKeys"])
  ) {
    return normalizeForgeSessionContextSelectionKeys(source);
  }

  const skill = toRecord(source["skill"]);
  const tools = toRecord(source["tools"]);
  return normalizeForgeSessionContextSelectionKeys({
    skillKeys: [
      skill["soldering"] === true ? "soldering" : null,
      skill["measurement"] === true ? "measurement" : null,
      skill["mechanical"] === true ? "mechanical" : null,
    ].filter((entry): entry is string => typeof entry === "string"),
    equipmentKeys: [
      tools["multimeter"] === true ? "multimeter" : null,
      tools["solderingIron"] === true ? "soldering_iron" : null,
      tools["hotAir"] === true ? "hot_air" : null,
      tools["benchPowerSupply"] === true ? "bench_supply" : null,
      tools["magnification"] === true ? "magnification" : null,
    ].filter((entry): entry is string => typeof entry === "string"),
  });
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
    (source["riskTolerance"] !== "low" &&
      source["riskTolerance"] !== "medium" &&
      source["riskTolerance"] !== "high") &&
    source["enableRovoPreAnalysis"] !== true
  ) {
    return null;
  }
  const mode =
    source["mode"] === "learn_first" || source["mode"] === "result_first"
      ? source["mode"]
      : null;
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
  const presenceUser = toRecord(presence["user"]);
  const user = toRecord(source["user"]);
  const activeFeature = toRecord(source["activeFeature"]);
  const nickname =
    typeof presenceUser["nickname"] === "string" && presenceUser["nickname"].trim() !== ""
      ? presenceUser["nickname"]
      : user["nickname"];
  const avatar =
    typeof presenceUser["avatar"] === "string" && presenceUser["avatar"].trim() !== ""
      ? presenceUser["avatar"].trim()
      : typeof user["avatar"] === "string" && user["avatar"].trim() !== ""
        ? user["avatar"].trim()
        : null;
  return {
    roomId: asNonEmptyString(room["id"], "forge-room"),
    roomName: asNonEmptyString(room["name"], "Forge Room"),
    featureId: asNonEmptyString(activeFeature["id"], "forge-workbench"),
    locale: asNonEmptyString(source["locale"], "en"),
    translations: toRecord(source["translations"]),
    userAvatar: avatar,
    userNickname: asNonEmptyString(nickname, "Operator"),
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
    preflight:
      source["preflight"] !== null &&
      typeof source["preflight"] === "object" &&
      Array.isArray(source["preflight"]) === false
        ? (source["preflight"] as ForgeRoomSnapshot["preflight"])
        : fallback.preflight,
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
