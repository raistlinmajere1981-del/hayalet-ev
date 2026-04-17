export const FORGE_PREFLIGHT_STEP_IDS = [
  "operatorContext",
  "constraints",
  "ai0Analysis",
  "runSignature",
  "sessionSave"
];
export const FORGE_OPERATOR_PREFERENCE_KEYS = ["mode", "riskTolerance"];
function trimString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function humanizeIdentifier(value) {
  return value.split(/[^a-z0-9]+/i).filter((segment) => segment !== "").map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`).join(" ");
}
function sortUniqueStrings(values) {
  return Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value !== "")
    )
  ).sort((left, right) => left.localeCompare(right));
}
function toRecord(value) {
  return value !== null && typeof value === "object" && Array.isArray(value) === false ? value : {};
}
export function normalizeForgeLegacyIdentifier(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-z0-9]+/gi, "_").toLowerCase().replace(/^_+|_+$/g, "");
}
export function isForgeOperatorSkillLevel(value) {
  return value === "none" || value === "basic" || value === "intermediate" || value === "advanced";
}
export function isForgeOperatorEquipmentStatus(value) {
  return value === "unavailable" || value === "available" || value === "planned";
}
export function isForgeOperatorMode(value) {
  return value === "learn_first" || value === "result_first";
}
export function isForgeOperatorRiskTolerance(value) {
  return value === "low" || value === "medium" || value === "high";
}
export function isForgeOperatorPreferenceKey(value) {
  return value === "mode" || value === "riskTolerance";
}
export function isForgePreflightStepId(value) {
  return typeof value === "string" && FORGE_PREFLIGHT_STEP_IDS.includes(value);
}
function normalizeForgeLegacySkillLevel(value, globalLevel) {
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
export function normalizeForgeLegacyOperatorSkillRecords(value) {
  const source = toRecord(value);
  const globalLevel = source["level"];
  return normalizeForgeOperatorSkillRecords(
    Object.entries(source).flatMap(([rawKey, level]) => {
      if (rawKey === "level") {
        return [];
      }
      const normalizedLevel = normalizeForgeLegacySkillLevel(level, globalLevel);
      const skillKey = normalizeForgeLegacyIdentifier(rawKey);
      if (normalizedLevel === null || skillKey === "") {
        return [];
      }
      return [
        {
          skillKey,
          label: humanizeIdentifier(skillKey),
          level: normalizedLevel
        }
      ];
    })
  );
}
export function normalizeForgeLegacyOperatorEquipmentRecords(value) {
  const source = toRecord(value);
  return normalizeForgeOperatorEquipmentRecords(
    Object.entries(source).flatMap(([rawKey, available]) => {
      if (typeof available !== "boolean") {
        return [];
      }
      const equipmentKey = normalizeForgeLegacyIdentifier(rawKey);
      if (equipmentKey === "") {
        return [];
      }
      return [
        {
          equipmentKey,
          label: humanizeIdentifier(equipmentKey),
          status: available ? "available" : "unavailable"
        }
      ];
    })
  );
}
export function normalizeForgeLegacySelectionKeys(value) {
  const source = toRecord(value);
  return sortUniqueStrings(
    Object.entries(source).flatMap(([rawKey, selected]) => {
      if (selected !== true) {
        return [];
      }
      const normalizedKey = normalizeForgeLegacyIdentifier(rawKey);
      return normalizedKey !== "" ? [normalizedKey] : [];
    })
  );
}
export function normalizeForgeOperatorSkillRecords(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const records = /* @__PURE__ */ new Map();
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry;
    const skillKey = trimString(record["skillKey"]);
    const level = record["level"];
    if (skillKey === null || isForgeOperatorSkillLevel(level) === false) {
      continue;
    }
    const label = trimString(record["label"]) ?? humanizeIdentifier(skillKey);
    const notes = trimString(record["notes"]);
    records.set(
      skillKey,
      notes ? { skillKey, label, level, notes } : { skillKey, label, level }
    );
  }
  return Array.from(records.values()).sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label);
    return labelCompare !== 0 ? labelCompare : left.skillKey.localeCompare(right.skillKey);
  });
}
export function normalizeForgeOperatorEquipmentRecords(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const records = /* @__PURE__ */ new Map();
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry;
    const equipmentKey = trimString(record["equipmentKey"]);
    const status = record["status"];
    if (equipmentKey === null || isForgeOperatorEquipmentStatus(status) === false) {
      continue;
    }
    const label = trimString(record["label"]) ?? humanizeIdentifier(equipmentKey);
    const brandModel = trimString(record["brandModel"]);
    const notes = trimString(record["notes"]);
    records.set(equipmentKey, {
      equipmentKey,
      label,
      status,
      ...brandModel ? { brandModel } : {},
      ...notes ? { notes } : {}
    });
  }
  return Array.from(records.values()).sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label);
    return labelCompare !== 0 ? labelCompare : left.equipmentKey.localeCompare(right.equipmentKey);
  });
}
export function normalizeForgeOperatorPreferences(value) {
  const source = toRecord(value);
  return {
    ...isForgeOperatorMode(source["mode"]) ? { mode: source["mode"] } : {},
    ...isForgeOperatorRiskTolerance(source["riskTolerance"]) ? { riskTolerance: source["riskTolerance"] } : {}
  };
}
export function normalizeForgeSessionContextSelectionKeys(value) {
  const source = toRecord(value);
  return {
    skillKeys: sortUniqueStrings(
      Array.isArray(source["skillKeys"]) ? source["skillKeys"].filter((entry) => typeof entry === "string") : []
    ),
    equipmentKeys: sortUniqueStrings(
      Array.isArray(source["equipmentKeys"]) ? source["equipmentKeys"].filter((entry) => typeof entry === "string") : []
    ),
    preferenceKeys: sortUniqueStrings(
      Array.isArray(source["preferenceKeys"]) ? source["preferenceKeys"].filter(
        (entry) => isForgeOperatorPreferenceKey(entry)
      ) : []
    )
  };
}
export function reconcileForgeSessionContextSelection(params) {
  const allowedSkillKeys = new Set(params.allowedSkillKeys ?? []);
  const allowedEquipmentKeys = new Set(params.allowedEquipmentKeys ?? []);
  const allowedPreferenceKeys = new Set(params.allowedPreferenceKeys ?? []);
  return {
    skillKeys: params.selection.skillKeys.filter((key) => allowedSkillKeys.has(key)),
    equipmentKeys: params.selection.equipmentKeys.filter((key) => allowedEquipmentKeys.has(key)),
    preferenceKeys: params.selection.preferenceKeys.filter(
      (key) => allowedPreferenceKeys.has(key)
    )
  };
}
export function createDefaultForgeOperatorProfile(updatedAt = "") {
  return {
    schemaVersion: 2,
    updatedAt,
    skills: [],
    equipment: [],
    preferences: {}
  };
}
export function createEmptyForgeSessionContextSelection() {
  return {
    skillKeys: [],
    equipmentKeys: [],
    preferenceKeys: []
  };
}
export function createEmptyForgeSelectedOperatorProfile() {
  return {
    skills: [],
    equipment: [],
    preferences: {}
  };
}
export function isForgeOperatorProfileEmpty(profile) {
  return profile.skills.length === 0 && profile.equipment.length === 0 && Object.keys(profile.preferences).length === 0;
}
export function isForgeSessionContextSelectionEmpty(selection) {
  return selection.skillKeys.length === 0 && selection.equipmentKeys.length === 0 && selection.preferenceKeys.length === 0;
}
export function isForgeSelectedOperatorProfileEmpty(profile) {
  return profile.skills.length === 0 && profile.equipment.length === 0 && Object.keys(profile.preferences).length === 0;
}
export function createEmptyForgeRunOverride() {
  return {
    enableRovoPreAnalysis: false,
    notes: "",
    temporaryConditions: []
  };
}
export function createEmptyForgeContextCapsule() {
  return {
    summary: "",
    relevantModules: [],
    constraints: []
  };
}
export function createEmptyForgePreflightState() {
  return {
    activeStepId: null,
    bundle: null,
    errorMessage: null,
    promptCharCount: 0,
    ranAt: null,
    staleReason: null,
    status: "idle",
    warnings: []
  };
}
