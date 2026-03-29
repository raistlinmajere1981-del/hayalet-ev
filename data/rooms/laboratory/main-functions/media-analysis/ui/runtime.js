import { createMediaAnalysisUiRuntimeHelpers } from "./runtime-helpers.js";
import { createMediaAnalysisSourceEditUiRuntime } from "./source-edit-runtime.js";
export function createMediaAnalysisUiRuntime(deps) {
  const sourceEditRuntime = createMediaAnalysisSourceEditUiRuntime({
    featureText: deps.featureText,
    subtitleText: deps.subtitleText,
    text: deps.text,
    textFromKey: deps.textFromKey,
    toRecord: deps.toRecord,
    getAvailableSourceFormats: deps.getAvailableSourceFormats,
    getDefaultSourceKind: deps.getDefaultSourceKind,
    getSourcePresets: deps.getSourcePresets,
    getProjectSource: deps.getProjectSource,
    getCurrentEditDraft: deps.getCurrentEditDraft,
    getEditPresets: deps.getEditPresets,
    getActiveSubtitleEntry: deps.getActiveSubtitleEntry,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    getActiveProject: deps.getActiveProject,
    getProjectEdit: deps.getProjectEdit,
    getEditPreview: deps.getEditPreview,
    getActiveEditOutput: deps.getActiveEditOutput,
    getSubtitleEditPreview: deps.getSubtitleEditPreview,
    getSubtitleOutputs: deps.getSubtitleOutputs,
    getSourceMetadata: deps.getSourceMetadata
  });
  const runtimeHelpers = createMediaAnalysisUiRuntimeHelpers({
    state: deps.state,
    text: deps.text,
    featureText: deps.featureText,
    toRecord: deps.toRecord,
    getCurrentSourceKind: sourceEditRuntime.getCurrentSourceKind,
    getProjectProfile: deps.getProjectProfile,
    getProfileCapabilities: deps.getProfileCapabilities,
    getProfileLaneMap: deps.getProfileLaneMap,
    getProfileReadiness: deps.getProfileReadiness,
    getProjectSource: deps.getProjectSource,
    getSourceMetadata: deps.getSourceMetadata,
    getToolEntry: deps.getToolEntry,
    getToolRegistry: deps.getToolRegistry,
    getProfileSignals: deps.getProfileSignals
  });
  return {
    ...sourceEditRuntime,
    ...runtimeHelpers
  };
}
