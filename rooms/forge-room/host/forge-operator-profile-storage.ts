import {
  createDefaultForgeOperatorProfile,
  isForgeOperatorSkillLevel,
  normalizeForgeOperatorEquipmentRecords,
  normalizeForgeOperatorSkillRecords,
  type ForgeOperatorProfile,
  type ForgeOperatorSkillLevel,
} from "../shared/types/index.js";
import { createForgeRoomPaths } from "../shared/host/forge-paths.js";
import { FORGE_OPERATOR_PROFILE_SCHEMA_VERSION } from "../shared/forge-constants.js";
import { asNonEmptyString, nowIso, toRecord } from "./forge-runtime-support.js";

type ForgeOperatorProfileStorageDeps = {
  ensureRuntimeDirectory: (dirPath: string, requestId?: string | null) => Promise<void>;
  readJsonFile: (filePath: string) => Promise<unknown>;
  writeJsonFile: (filePath: string, value: unknown) => Promise<void>;
};

type LegacyForgeOperatorSkillLevel = "beginner" | "intermediate" | "advanced";
type LegacyForgeOperatorCapabilityLevel = "none" | "basic" | "good";

function readLegacySkillLevel(value: unknown): LegacyForgeOperatorSkillLevel | null {
  return value === "beginner" || value === "intermediate" || value === "advanced" ? value : null;
}

function readLegacyCapabilityLevel(value: unknown): LegacyForgeOperatorCapabilityLevel | null {
  return value === "none" || value === "basic" || value === "good" ? value : null;
}

function readLegacyToolFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function mapLegacyCapabilityLevel(params: {
  legacyCapability: LegacyForgeOperatorCapabilityLevel | null;
  legacyGlobalSkillLevel: LegacyForgeOperatorSkillLevel | null;
}): ForgeOperatorSkillLevel | null {
  const { legacyCapability, legacyGlobalSkillLevel } = params;
  if (legacyCapability === null) {
    return null;
  }
  if (legacyCapability === "none") {
    return "none";
  }
  if (legacyCapability === "basic") {
    return "basic";
  }
  return legacyGlobalSkillLevel === "advanced" ? "advanced" : "intermediate";
}

export function normalizeForgeOperatorProfile(
  value: unknown,
  updatedAtFallback = nowIso()
): ForgeOperatorProfile {
  const record = toRecord(value);

  if (Array.isArray(record["skills"]) || Array.isArray(record["equipment"])) {
    return {
      schemaVersion: FORGE_OPERATOR_PROFILE_SCHEMA_VERSION,
      updatedAt: asNonEmptyString(record["updatedAt"]) ?? updatedAtFallback,
      skills: normalizeForgeOperatorSkillRecords(record["skills"]),
      equipment: normalizeForgeOperatorEquipmentRecords(record["equipment"]),
    };
  }

  const skill = toRecord(record["skill"]);
  const tools = toRecord(record["tools"]);
  const legacyGlobalSkillLevel = readLegacySkillLevel(skill["level"]);
  const migratedSkills = normalizeForgeOperatorSkillRecords(
    [
      {
        skillKey: "soldering",
        label: "Soldering",
        level: mapLegacyCapabilityLevel({
          legacyCapability: readLegacyCapabilityLevel(skill["soldering"]),
          legacyGlobalSkillLevel,
        }),
      },
      {
        skillKey: "measurement",
        label: "Measurement",
        level: mapLegacyCapabilityLevel({
          legacyCapability: readLegacyCapabilityLevel(skill["measurement"]),
          legacyGlobalSkillLevel,
        }),
      },
      {
        skillKey: "mechanical",
        label: "Mechanical",
        level: mapLegacyCapabilityLevel({
          legacyCapability: readLegacyCapabilityLevel(skill["mechanical"]),
          legacyGlobalSkillLevel,
        }),
      },
    ].filter((entry) => isForgeOperatorSkillLevel(entry.level))
  );
  const migratedEquipment = normalizeForgeOperatorEquipmentRecords(
    [
      {
        equipmentKey: "multimeter",
        label: "Multimeter",
        status: readLegacyToolFlag(tools["multimeter"]) === true ? "available" : "unavailable",
      },
      {
        equipmentKey: "soldering_iron",
        label: "Soldering Iron",
        status:
          readLegacyToolFlag(tools["solderingIron"]) === true ? "available" : "unavailable",
      },
      {
        equipmentKey: "hot_air",
        label: "Hot Air",
        status: readLegacyToolFlag(tools["hotAir"]) === true ? "available" : "unavailable",
      },
      {
        equipmentKey: "bench_supply",
        label: "Bench Supply",
        status:
          readLegacyToolFlag(tools["benchPowerSupply"]) === true ? "available" : "unavailable",
      },
      {
        equipmentKey: "magnification",
        label: "Magnification",
        status: readLegacyToolFlag(tools["magnification"]) === true ? "available" : "unavailable",
      },
    ].filter((entry) => readLegacyToolFlag(tools[legacyEquipmentToolField(entry.equipmentKey)]) !== null)
  );

  return {
    schemaVersion: FORGE_OPERATOR_PROFILE_SCHEMA_VERSION,
    updatedAt: asNonEmptyString(record["updatedAt"]) ?? updatedAtFallback,
    skills: migratedSkills,
    equipment: migratedEquipment,
  };
}

function legacyEquipmentToolField(equipmentKey: string): string {
  switch (equipmentKey) {
    case "soldering_iron":
      return "solderingIron";
    case "hot_air":
      return "hotAir";
    case "bench_supply":
      return "benchPowerSupply";
    default:
      return equipmentKey;
  }
}

export function createForgeOperatorProfileStorage(deps: ForgeOperatorProfileStorageDeps) {
  const { ensureRuntimeDirectory, readJsonFile, writeJsonFile } = deps;

  async function loadProfile(runtimePaths: unknown): Promise<ForgeOperatorProfile> {
    const roomPaths = createForgeRoomPaths(runtimePaths);
    const loaded = await readJsonFile(roomPaths.operatorProfilePath);
    if (loaded === null || loaded === undefined) {
      return createDefaultForgeOperatorProfile();
    }
    return normalizeForgeOperatorProfile(loaded, nowIso());
  }

  async function saveProfile(runtimePaths: unknown, value: unknown): Promise<ForgeOperatorProfile> {
    const roomPaths = createForgeRoomPaths(runtimePaths);
    await ensureRuntimeDirectory(roomPaths.roomStorageDir);
    const profile = normalizeForgeOperatorProfile(value, nowIso());
    await writeJsonFile(roomPaths.operatorProfilePath, profile);
    return profile;
  }

  return {
    loadProfile,
    saveProfile,
  };
}
