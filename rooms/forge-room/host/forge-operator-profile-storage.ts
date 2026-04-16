import {
  createDefaultForgeOperatorProfile,
  type ForgeOperatorProfile,
  type ForgeOperatorProfilePreferences,
  type ForgeOperatorProfileSkill,
} from "../shared/types/index.js";
import { createForgeRoomPaths } from "../shared/host/forge-paths.js";
import { FORGE_OPERATOR_PROFILE_SCHEMA_VERSION } from "../shared/forge-constants.js";
import { asNonEmptyString, nowIso, toRecord } from "./forge-runtime-support.js";

type ForgeOperatorProfileStorageDeps = {
  ensureRuntimeDirectory: (dirPath: string, requestId?: string | null) => Promise<void>;
  readJsonFile: (filePath: string) => Promise<unknown>;
  writeJsonFile: (filePath: string, value: unknown) => Promise<void>;
};

function readSkillLevel(value: unknown): ForgeOperatorProfileSkill["level"] {
  return value === "beginner" || value === "intermediate" || value === "advanced" ? value : null;
}

function readCapabilityLevel(value: unknown): ForgeOperatorProfileSkill["soldering"] {
  return value === "none" || value === "basic" || value === "good" ? value : null;
}

function readToolFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readMode(value: unknown): ForgeOperatorProfilePreferences["mode"] {
  return value === "learn-first" || value === "result-first" ? value : null;
}

function readRiskTolerance(value: unknown): ForgeOperatorProfilePreferences["riskTolerance"] {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

export function normalizeForgeOperatorProfile(
  value: unknown,
  updatedAtFallback = nowIso()
): ForgeOperatorProfile {
  const record = toRecord(value);
  const skill = toRecord(record["skill"]);
  const tools = toRecord(record["tools"]);
  const preferences = toRecord(record["preferences"]);
  return {
    schemaVersion: FORGE_OPERATOR_PROFILE_SCHEMA_VERSION,
    updatedAt: asNonEmptyString(record["updatedAt"]) ?? updatedAtFallback,
    skill: {
      level: readSkillLevel(skill["level"]),
      soldering: readCapabilityLevel(skill["soldering"]),
      measurement: readCapabilityLevel(skill["measurement"]),
      mechanical: readCapabilityLevel(skill["mechanical"]),
    },
    tools: {
      multimeter: readToolFlag(tools["multimeter"]),
      solderingIron: readToolFlag(tools["solderingIron"]),
      hotAir: readToolFlag(tools["hotAir"]),
      benchPowerSupply: readToolFlag(tools["benchPowerSupply"]),
      magnification: readToolFlag(tools["magnification"]),
    },
    preferences: {
      mode: readMode(preferences["mode"]),
      riskTolerance: readRiskTolerance(preferences["riskTolerance"]),
    },
  };
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

  async function saveProfile(
    runtimePaths: unknown,
    value: unknown
  ): Promise<ForgeOperatorProfile> {
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
