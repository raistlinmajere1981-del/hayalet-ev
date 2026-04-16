export function createDefaultForgeOperatorProfile(updatedAt = "") {
  return {
    schemaVersion: 1,
    updatedAt,
    skill: {
      level: null,
      soldering: null,
      measurement: null,
      mechanical: null
    },
    tools: {
      multimeter: null,
      solderingIron: null,
      hotAir: null,
      benchPowerSupply: null,
      magnification: null
    },
    preferences: {
      mode: null,
      riskTolerance: null
    }
  };
}
export function isForgeOperatorProfileEmpty(profile) {
  return profile.skill.level === null && profile.skill.soldering === null && profile.skill.measurement === null && profile.skill.mechanical === null && profile.tools.multimeter === null && profile.tools.solderingIron === null && profile.tools.hotAir === null && profile.tools.benchPowerSupply === null && profile.tools.magnification === null && profile.preferences.mode === null && profile.preferences.riskTolerance === null;
}
export function createEmptyForgeRunOverride() {
  return {
    tools: {},
    notes: "",
    enableRovoPreAnalysis: false
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
    bundle: null,
    errorMessage: null,
    promptCharCount: 0,
    ranAt: null,
    staleReason: null,
    status: "idle",
    warnings: []
  };
}
