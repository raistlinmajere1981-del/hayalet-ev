import { hashStableValue } from "./forge-runtime-support.js";
function sortStrings(values) {
  return [...values].map((entry) => entry.trim()).filter((entry) => entry !== "").sort((left, right) => left.localeCompare(right));
}
function normalizeGoal(goal) {
  return {
    id: goal.id,
    summary: goal.summary.trim(),
    brief: goal.brief.trim(),
    constraints: sortStrings(goal.constraints),
    acceptanceCriteria: sortStrings(goal.acceptanceCriteria),
    targetRoomId: goal.targetRoomId.trim()
  };
}
function normalizeRunOverride(runOverride) {
  if (runOverride === null) {
    return null;
  }
  return {
    architectSeatId: runOverride.architectSeatId ?? null,
    enableRovoPreAnalysis: runOverride.enableRovoPreAnalysis === true,
    mode: runOverride.mode ?? null,
    notes: runOverride.notes.trim(),
    riskTolerance: runOverride.riskTolerance ?? null,
    temporaryConditions: sortStrings(runOverride.temporaryConditions)
  };
}
function normalizeSessionContextSelection(selection) {
  return {
    equipmentKeys: sortStrings(selection.equipmentKeys),
    preferenceKeys: [...selection.preferenceKeys].sort((left, right) => left.localeCompare(right)),
    skillKeys: sortStrings(selection.skillKeys)
  };
}
function normalizeSelectedOperatorProfile(profile) {
  return {
    skills: profile.skills.map((entry) => ({
      label: entry.label.trim(),
      level: entry.level,
      notes: entry.notes?.trim() ?? null,
      skillKey: entry.skillKey.trim()
    })),
    equipment: profile.equipment.map((entry) => ({
      brandModel: entry.brandModel?.trim() ?? null,
      equipmentKey: entry.equipmentKey.trim(),
      label: entry.label.trim(),
      notes: entry.notes?.trim() ?? null,
      status: entry.status
    })),
    preferences: {
      mode: profile.preferences.mode ?? null,
      riskTolerance: profile.preferences.riskTolerance ?? null
    }
  };
}
export function buildContextDigestInput(params) {
  return {
    goal: normalizeGoal(params.goal),
    runOverride: normalizeRunOverride(params.runOverride),
    selectedOperatorProfile: normalizeSelectedOperatorProfile(params.selectedOperatorProfile),
    sessionContextSelection: normalizeSessionContextSelection(params.sessionContextSelection),
    preflightInputFields: params.preflightInputFields ?? {}
  };
}
export function buildContextDigest(params) {
  return hashStableValue(buildContextDigestInput(params));
}
