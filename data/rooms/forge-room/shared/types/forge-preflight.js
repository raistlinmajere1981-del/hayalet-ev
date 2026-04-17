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
export function createEmptyForgeSessionContextSelection() {
  return {
    skill: {
      level: false,
      soldering: false,
      measurement: false,
      mechanical: false
    },
    tools: {
      multimeter: false,
      solderingIron: false,
      hotAir: false,
      benchPowerSupply: false,
      magnification: false
    },
    preferences: {
      mode: false,
      riskTolerance: false
    }
  };
}
export function createEmptyForgeSelectedOperatorProfile() {
  return {
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
export function isForgeSessionContextSelectionEmpty(selection) {
  return selection.skill.level !== true && selection.skill.soldering !== true && selection.skill.measurement !== true && selection.skill.mechanical !== true && selection.tools.multimeter !== true && selection.tools.solderingIron !== true && selection.tools.hotAir !== true && selection.tools.benchPowerSupply !== true && selection.tools.magnification !== true && selection.preferences.mode !== true && selection.preferences.riskTolerance !== true;
}
export function isForgeSelectedOperatorProfileEmpty(profile) {
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
