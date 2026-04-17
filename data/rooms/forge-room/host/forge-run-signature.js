import { FORGE_PREFLIGHT_SCHEMA_VERSION } from "../shared/forge-constants.js";
import { nowIso, uniqueStrings } from "./forge-runtime-support.js";
function hashFingerprint(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 6);
}
function slugifySegment(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function titleCaseRoomId(roomId) {
  return roomId.split(/[^a-z0-9]+/i).filter((segment) => segment !== "").map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`).join("");
}
function buildCollisionSuffix(params) {
  const fingerprint = JSON.stringify({
    goal: {
      summary: params.goal.summary,
      brief: params.goal.brief,
      constraints: params.goal.constraints,
      targetRoomId: params.goal.targetRoomId
    },
    selectedOperatorProfile: params.selectedOperatorProfile,
    runOverride: params.runOverride,
    source: params.source
  });
  return hashFingerprint(fingerprint);
}
function collectConstraintTokens(params) {
  const effectiveMode = params.runOverride?.mode ?? params.selectedOperatorProfile.preferences.mode;
  const effectiveRiskTolerance = params.runOverride?.riskTolerance ?? params.selectedOperatorProfile.preferences.riskTolerance;
  const tokens = uniqueStrings(
    [
      params.goal.constraints[0] ?? null,
      effectiveMode,
      effectiveRiskTolerance ? `${effectiveRiskTolerance}-risk` : null,
      params.selectedOperatorProfile.skills[0] ? `${params.selectedOperatorProfile.skills[0].label}-${params.selectedOperatorProfile.skills[0].level}` : null,
      params.selectedOperatorProfile.equipment.filter((entry) => entry.status === "available").map((entry) => entry.label)[0] ?? null,
      ...(params.runOverride?.temporaryConditions ?? []).slice(0, 2),
      params.runOverride?.notes.trim() || null
    ].filter((entry) => typeof entry === "string" && entry.trim() !== "").map((entry) => slugifySegment(entry)).filter((entry) => entry !== "")
  );
  return tokens.slice(0, 3);
}
export function buildForgeRunSignature(params) {
  const roomPart = titleCaseRoomId(params.goal.targetRoomId.trim() || "unspecified-target");
  const versionPart = FORGE_PREFLIGHT_SCHEMA_VERSION;
  const source = collectConstraintTokens(params);
  const tokenPart = source.length > 0 ? source.join("-") : "baseline";
  const collisionSuffix = buildCollisionSuffix({
    ...params,
    source
  });
  return {
    source,
    updatedAt: nowIso(),
    value: `${roomPart}-${versionPart}-${tokenPart}-${collisionSuffix}`
  };
}
