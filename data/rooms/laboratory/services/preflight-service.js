import {
  asLabRecord,
  asNonEmptyString,
  asStringArray
} from "../models/lab-types.js";
export function runPreflight(profileConfig, _source = null) {
  const profile = asLabRecord(profileConfig);
  const readiness = asLabRecord(profile["readiness"]);
  const preflight = asLabRecord(profile["preflight"]);
  const requiredTools = Array.isArray(readiness["requiredTools"]) ? readiness["requiredTools"] : [];
  const enabledModules = Array.isArray(readiness["enabledLaneIds"]) ? readiness["enabledLaneIds"].map(String) : [];
  const missingDependencies = requiredTools.map(function(entry) {
    const record = asLabRecord(entry);
    if (record["ready"] === true) {
      return null;
    }
    return asNonEmptyString(record["displayName"]) || asNonEmptyString(record["toolId"]);
  }).filter((entry) => entry !== null);
  const warnings = Array.from(
    new Set(asStringArray(readiness["warnings"]).concat(asStringArray(preflight["warnings"])))
  );
  const stageReady = readiness["stageReady"] === true;
  const rawStatus = asNonEmptyString(preflight["status"]);
  return {
    status: stageReady !== true ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    missingDependencies,
    warnings,
    estimatedRuntime: typeof asLabRecord(profile["estimate"])["runtimeSeconds"] === "number" ? asLabRecord(profile["estimate"])["runtimeSeconds"] : null,
    enabledModules,
    stageReady,
    rawStatus
  };
}
export function normalizeLabPreflight(projectProfile) {
  return runPreflight(asLabRecord(projectProfile), null);
}
