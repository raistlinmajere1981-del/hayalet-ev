export type ForgeOperatorSkillLevel = "none" | "basic" | "intermediate" | "advanced";
export type ForgeOperatorEquipmentStatus = "unavailable" | "available" | "planned";
export type ForgeOperatorMode = "learn_first" | "result_first";
export type ForgeOperatorRiskTolerance = "low" | "medium" | "high";
export type ForgeOperatorPreferenceKey = "mode" | "riskTolerance";
export type ForgePreflightStatus = "idle" | "fresh" | "stale" | "warning";
export type ForgeCapabilityTag =
  | "archive"
  | "camera"
  | "image"
  | "protocol"
  | "relay"
  | "repair-room"
  | "storage"
  | "ui";

export const FORGE_OPERATOR_PREFERENCE_KEYS = ["mode", "riskTolerance"] as const;

export interface ForgeOperatorCatalogEntry {
  applicableRooms?: string[];
  description?: string;
  group: "equipment" | "general" | "skills";
  key: string;
  label: string;
  translationKey: string;
}

export interface ForgeOperatorPreferenceCatalogEntry {
  applicableRooms?: string[];
  description?: string;
  key: ForgeOperatorPreferenceKey;
  label: string;
  options: string[];
  translationKey: string;
}

export interface ForgeOperatorSkillRecord {
  label: string;
  level: ForgeOperatorSkillLevel;
  notes?: string;
  skillKey: string;
}

export interface ForgeOperatorEquipmentRecord {
  brandModel?: string;
  equipmentKey: string;
  label: string;
  notes?: string;
  status: ForgeOperatorEquipmentStatus;
}

export interface ForgeOperatorProfile {
  equipment: ForgeOperatorEquipmentRecord[];
  schemaVersion: number;
  skills: ForgeOperatorSkillRecord[];
  updatedAt: string;
}

export interface ForgeSessionContextSelection {
  equipmentKeys: string[];
  skillKeys: string[];
}

export interface ForgeSelectedOperatorProfile {
  equipment: ForgeOperatorEquipmentRecord[];
  skills: ForgeOperatorSkillRecord[];
}

export interface ForgeRunOverride {
  enableRovoPreAnalysis: boolean;
  mode?: ForgeOperatorMode;
  notes: string;
  riskTolerance?: ForgeOperatorRiskTolerance;
  temporaryConditions: string[];
}

export interface ForgeContextCapsule {
  summary: string;
  relevantModules: string[];
  constraints: string[];
}

export interface ForgeCapabilityDescriptor {
  id: string;
  title: string;
  summary: string;
  tags: ForgeCapabilityTag[];
  relevantModules: string[];
  roomIds: string[];
}

export interface ForgeCapabilityContext {
  items: ForgeCapabilityDescriptor[];
  omittedCount: number;
  selectedTags: ForgeCapabilityTag[];
  sizeBudget: number;
  summary: string;
}

export interface ForgeCoreSystemMetadata {
  featureId: string;
  mode: "guided";
  roomId: string;
  schemaVersion: number;
  sessionId: string | null;
}

export interface ForgeAppArchitectureSummary {
  exportBoundary: string;
  relevantModules: string[];
  storageBoundary: string;
  summary: string;
}

export interface ForgeTargetRoomContext {
  constraints: string[];
  relevantModules: string[];
  summary: string;
  targetRoomId: string;
}

export interface ForgeRovoPreAnalysis {
  missingInfo: string[];
  status: "completed" | "warning";
  summary: string;
  warnings: string[];
}

export interface ForgePreflightBundle {
  appArchitectureSummary: ForgeAppArchitectureSummary;
  capabilityContext: ForgeCapabilityContext | null;
  constraints: string[];
  coreSystemMetadata: ForgeCoreSystemMetadata;
  createdAt: string;
  selectedOperatorProfile: ForgeSelectedOperatorProfile;
  rovoPreAnalysis: ForgeRovoPreAnalysis | null;
  runOverride: ForgeRunOverride | null;
  schemaVersion: "v3";
  sessionContextSelection: ForgeSessionContextSelection;
  targetRoomContext: ForgeTargetRoomContext | null;
}

export interface ForgePreflightState {
  bundle: ForgePreflightBundle | null;
  errorMessage: string | null;
  promptCharCount: number;
  ranAt: string | null;
  staleReason: string | null;
  status: ForgePreflightStatus;
  warnings: string[];
}

export interface ForgeRunSignature {
  source: string[];
  updatedAt: string;
  value: string;
}

export interface ForgeSynthesisProvenance {
  operatorProfileSummary: string[];
  preflightWarnings: string[];
  runSignature: string | null;
}

function trimString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function humanizeIdentifier(value: string): string {
  return value
    .split(/[^a-z0-9]+/i)
    .filter((segment) => segment !== "")
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

function sortUniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value !== "")
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function isForgeOperatorSkillLevel(value: unknown): value is ForgeOperatorSkillLevel {
  return (
    value === "none" ||
    value === "basic" ||
    value === "intermediate" ||
    value === "advanced"
  );
}

export function isForgeOperatorEquipmentStatus(
  value: unknown
): value is ForgeOperatorEquipmentStatus {
  return value === "unavailable" || value === "available" || value === "planned";
}

export function isForgeOperatorMode(value: unknown): value is ForgeOperatorMode {
  return value === "learn_first" || value === "result_first";
}

export function isForgeOperatorRiskTolerance(
  value: unknown
): value is ForgeOperatorRiskTolerance {
  return value === "low" || value === "medium" || value === "high";
}

export function isForgeOperatorPreferenceKey(
  value: unknown
): value is ForgeOperatorPreferenceKey {
  return value === "mode" || value === "riskTolerance";
}

export function normalizeForgeOperatorSkillRecords(value: unknown): ForgeOperatorSkillRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records = new Map<string, ForgeOperatorSkillRecord>();
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
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

export function normalizeForgeOperatorEquipmentRecords(
  value: unknown
): ForgeOperatorEquipmentRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records = new Map<string, ForgeOperatorEquipmentRecord>();
  for (const entry of value) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
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
      ...(brandModel ? { brandModel } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  return Array.from(records.values()).sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label);
    return labelCompare !== 0
      ? labelCompare
      : left.equipmentKey.localeCompare(right.equipmentKey);
  });
}

export function normalizeForgeSessionContextSelectionKeys(
  value: unknown
): ForgeSessionContextSelection {
  const source =
    value !== null && typeof value === "object" && Array.isArray(value) === false
      ? (value as Record<string, unknown>)
      : {};

  return {
    skillKeys: sortUniqueStrings(
      Array.isArray(source["skillKeys"])
        ? source["skillKeys"].filter((entry): entry is string => typeof entry === "string")
        : []
    ),
    equipmentKeys: sortUniqueStrings(
      Array.isArray(source["equipmentKeys"])
        ? source["equipmentKeys"].filter((entry): entry is string => typeof entry === "string")
        : []
    ),
  };
}

export function reconcileForgeSessionContextSelection(params: {
  allowedEquipmentKeys?: string[];
  allowedSkillKeys?: string[];
  selection: ForgeSessionContextSelection;
}): ForgeSessionContextSelection {
  const allowedSkillKeys = new Set(params.allowedSkillKeys ?? []);
  const allowedEquipmentKeys = new Set(params.allowedEquipmentKeys ?? []);

  return {
    skillKeys: params.selection.skillKeys.filter((key) => allowedSkillKeys.has(key)),
    equipmentKeys: params.selection.equipmentKeys.filter((key) => allowedEquipmentKeys.has(key)),
  };
}

export function createDefaultForgeOperatorProfile(updatedAt = ""): ForgeOperatorProfile {
  return {
    schemaVersion: 3,
    updatedAt,
    skills: [],
    equipment: [],
  };
}

export function createEmptyForgeSessionContextSelection(): ForgeSessionContextSelection {
  return {
    skillKeys: [],
    equipmentKeys: [],
  };
}

export function createEmptyForgeSelectedOperatorProfile(): ForgeSelectedOperatorProfile {
  return {
    skills: [],
    equipment: [],
  };
}

export function isForgeOperatorProfileEmpty(profile: ForgeOperatorProfile): boolean {
  return profile.skills.length === 0 && profile.equipment.length === 0;
}

export function isForgeSessionContextSelectionEmpty(
  selection: ForgeSessionContextSelection
): boolean {
  return selection.skillKeys.length === 0 && selection.equipmentKeys.length === 0;
}

export function isForgeSelectedOperatorProfileEmpty(
  profile: ForgeSelectedOperatorProfile
): boolean {
  return profile.skills.length === 0 && profile.equipment.length === 0;
}

export function createEmptyForgeRunOverride(): ForgeRunOverride {
  return {
    enableRovoPreAnalysis: false,
    notes: "",
    temporaryConditions: [],
  };
}

export function createEmptyForgeContextCapsule(): ForgeContextCapsule {
  return {
    summary: "",
    relevantModules: [],
    constraints: [],
  };
}

export function createEmptyForgePreflightState(): ForgePreflightState {
  return {
    bundle: null,
    errorMessage: null,
    promptCharCount: 0,
    ranAt: null,
    staleReason: null,
    status: "idle",
    warnings: [],
  };
}
