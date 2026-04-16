import {
  createDefaultForgeOperatorProfile
} from "../shared/types/index.js";
import { createForgeRoomPaths } from "../shared/host/forge-paths.js";
import { FORGE_OPERATOR_PROFILE_SCHEMA_VERSION } from "../shared/forge-constants.js";
import { asNonEmptyString, nowIso, toRecord } from "./forge-runtime-support.js";
function readSkillLevel(value) {
  return value === "beginner" || value === "intermediate" || value === "advanced" ? value : null;
}
function readCapabilityLevel(value) {
  return value === "none" || value === "basic" || value === "good" ? value : null;
}
function readToolFlag(value) {
  return typeof value === "boolean" ? value : null;
}
function readMode(value) {
  return value === "learn-first" || value === "result-first" ? value : null;
}
function readRiskTolerance(value) {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}
export function normalizeForgeOperatorProfile(value, updatedAtFallback = nowIso()) {
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
      mechanical: readCapabilityLevel(skill["mechanical"])
    },
    tools: {
      multimeter: readToolFlag(tools["multimeter"]),
      solderingIron: readToolFlag(tools["solderingIron"]),
      hotAir: readToolFlag(tools["hotAir"]),
      benchPowerSupply: readToolFlag(tools["benchPowerSupply"]),
      magnification: readToolFlag(tools["magnification"])
    },
    preferences: {
      mode: readMode(preferences["mode"]),
      riskTolerance: readRiskTolerance(preferences["riskTolerance"])
    }
  };
}
export function createForgeOperatorProfileStorage(deps) {
  const { ensureRuntimeDirectory, readJsonFile, writeJsonFile } = deps;
  async function loadProfile(runtimePaths) {
    const roomPaths = createForgeRoomPaths(runtimePaths);
    const loaded = await readJsonFile(roomPaths.operatorProfilePath);
    if (loaded === null || loaded === void 0) {
      return createDefaultForgeOperatorProfile();
    }
    return normalizeForgeOperatorProfile(loaded, nowIso());
  }
  async function saveProfile(runtimePaths, value) {
    const roomPaths = createForgeRoomPaths(runtimePaths);
    await ensureRuntimeDirectory(roomPaths.roomStorageDir);
    const profile = normalizeForgeOperatorProfile(value, nowIso());
    await writeJsonFile(roomPaths.operatorProfilePath, profile);
    return profile;
  }
  return {
    loadProfile,
    saveProfile
  };
}
