export function createLaboratoryPresetProfileRuntime(deps) {
  const { asNonEmptyString, toRecord } = deps;
  function getProfileLaneMap(profilePresets) {
    return toRecord(toRecord(profilePresets)["lanes"]);
  }
  function getCompatibleProfileLaneIds(profilePresets, sourceKind) {
    const laneMap = getProfileLaneMap(profilePresets);
    return Object.keys(laneMap).filter(function(laneId) {
      const lane = toRecord(laneMap[laneId]);
      const mediaKinds = Array.isArray(lane.mediaKinds) ? lane.mediaKinds : [];
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    });
  }
  function getProfilePresetList(profilePresets, sourceKind, mode) {
    const presetsByKind = toRecord(toRecord(profilePresets)["presets"]);
    const branch = toRecord(presetsByKind[sourceKind]);
    const selectedMode = asNonEmptyString(mode) ?? asNonEmptyString(toRecord(profilePresets)["defaultMode"]) ?? "beginner";
    return Array.isArray(branch[selectedMode]) ? branch[selectedMode] : [];
  }
  function findProfilePreset(profilePresets, sourceKind, presetId) {
    const targetId = asNonEmptyString(presetId);
    if (targetId === null) {
      return null;
    }
    return getProfilePresetList(profilePresets, sourceKind, "beginner").find(function(entry) {
      return asNonEmptyString(toRecord(entry)["id"]) === targetId;
    }) ?? null;
  }
  function getDefaultProfilePresetId(profilePresets, sourceKind) {
    const preset = toRecord(getProfilePresetList(profilePresets, sourceKind, "beginner")[0]);
    return asNonEmptyString(preset["id"]);
  }
  function getDefaultProfileModelId(profileModels, sourceKind) {
    const modelMap = toRecord(toRecord(profileModels)["models"]);
    const preferredId = asNonEmptyString(toRecord(profileModels)["defaultModelId"]);
    const preferredModel = preferredId === null ? {} : toRecord(modelMap[preferredId]);
    const preferredKinds = Array.isArray(preferredModel.mediaKinds) ? preferredModel.mediaKinds : [];
    if (preferredId !== null && (preferredKinds.length === 0 || preferredKinds.includes(sourceKind))) {
      return preferredId;
    }
    return Object.keys(modelMap).find(function(modelId) {
      const model = toRecord(modelMap[modelId]);
      const mediaKinds = Array.isArray(model.mediaKinds) ? model.mediaKinds : [];
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    }) ?? null;
  }
  function createEmptyProfileReadiness() {
    return {
      stageReady: false,
      requiredTools: [],
      optionalTools: [],
      models: [],
      blockers: [],
      warnings: []
    };
  }
  function createEmptyProfileEstimate() {
    return {
      runtimeSeconds: null,
      artifactCount: 0,
      sampleWindowSeconds: null
    };
  }
  function createEmptyProfilePreflight() {
    return {
      status: "idle",
      jobId: null,
      requestId: null,
      ranAt: null,
      targetSummary: null,
      warnings: [],
      error: null
    };
  }
  return {
    getProfileLaneMap,
    getCompatibleProfileLaneIds,
    getProfilePresetList,
    findProfilePreset,
    getDefaultProfilePresetId,
    getDefaultProfileModelId,
    createEmptyProfileReadiness,
    createEmptyProfileEstimate,
    createEmptyProfilePreflight
  };
}
