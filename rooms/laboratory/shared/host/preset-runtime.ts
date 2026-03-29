// @ts-nocheck
import { createLaboratoryPresetEditRuntime } from "./preset-edit-runtime.js";
import { createLaboratoryPresetProfileRuntime } from "./preset-profile-runtime.js";
import { createLaboratoryPresetSourceRuntime } from "./preset-source-runtime.js";

export function createLaboratoryPresetRuntime(deps) {
  const presetSource = createLaboratoryPresetSourceRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    clone: deps.clone,
    toRecord: deps.toRecord,
  });
  const presetEdit = createLaboratoryPresetEditRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    normalizeSourceMetadata: presetSource.normalizeSourceMetadata,
    toRecord: deps.toRecord,
  });
  const presetProfile = createLaboratoryPresetProfileRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    toRecord: deps.toRecord,
  });

  return {
    asNumber: presetSource.asNumber,
    normalizeStringArray: presetSource.normalizeStringArray,
    normalizeSourceMetadata: presetSource.normalizeSourceMetadata,
    buildProjectName: presetSource.buildProjectName,
    buildProjectSlug: presetSource.buildProjectSlug,
    getSourceConfig: presetSource.getSourceConfig,
    getDefaultSourceType: presetSource.getDefaultSourceType,
    getDefaultMode: presetSource.getDefaultMode,
    getDefaultYoutubePreset: presetSource.getDefaultYoutubePreset,
    getPresetDefaultCustomValues: presetSource.getPresetDefaultCustomValues,
    createEmptySourceDrafts: presetSource.createEmptySourceDrafts,
    getFocusRegionMap: presetEdit.getFocusRegionMap,
    getDefaultFocusRegionId: presetEdit.getDefaultFocusRegionId,
    getFocusRegionCrop: presetEdit.getFocusRegionCrop,
    getResizePresetMap: presetEdit.getResizePresetMap,
    getDefaultEditPresetId: presetEdit.getDefaultEditPresetId,
    mergeObjects: presetEdit.mergeObjects,
    createDefaultEditState: presetEdit.createDefaultEditState,
    normalizeCropBox: presetEdit.normalizeCropBox,
    normalizeEditOutput: presetEdit.normalizeEditOutput,
    normalizeEditState: presetEdit.normalizeEditState,
    getProfileLaneMap: presetProfile.getProfileLaneMap,
    getCompatibleProfileLaneIds: presetProfile.getCompatibleProfileLaneIds,
    getProfilePresetList: presetProfile.getProfilePresetList,
    findProfilePreset: presetProfile.findProfilePreset,
    getDefaultProfilePresetId: presetProfile.getDefaultProfilePresetId,
    getDefaultProfileModelId: presetProfile.getDefaultProfileModelId,
    createEmptyProfileReadiness: presetProfile.createEmptyProfileReadiness,
    createEmptyProfileEstimate: presetProfile.createEmptyProfileEstimate,
    createEmptyProfilePreflight: presetProfile.createEmptyProfilePreflight,
  };
}
