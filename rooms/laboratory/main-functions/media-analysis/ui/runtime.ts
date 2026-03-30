import { createMediaAnalysisUiRuntimeHelpers } from "./runtime-helpers.js";
import { createMediaAnalysisSourceEditUiRuntime } from "./source-edit-runtime.js";

type MediaAnalysisUiRuntimeDeps = Parameters<typeof createMediaAnalysisSourceEditUiRuntime>[0] &
  Parameters<typeof createMediaAnalysisUiRuntimeHelpers>[0];

type MediaAnalysisUiRuntime = ReturnType<typeof createMediaAnalysisSourceEditUiRuntime> &
  ReturnType<typeof createMediaAnalysisUiRuntimeHelpers>;

export function createMediaAnalysisUiRuntime(
  deps: MediaAnalysisUiRuntimeDeps
): MediaAnalysisUiRuntime {
  const {
    featureText,
    getActiveEditOutput,
    getActiveProject,
    getActiveSubtitleEntry,
    getAvailableSourceFormats,
    getCurrentEditDraft,
    getDefaultSourceKind,
    getEditPresets,
    getEditPreview,
    getProfileCapabilities,
    getProfileLaneMap,
    getProfileReadiness,
    getProfileSignals,
    getProjectEdit,
    getProjectProfile,
    getProjectSource,
    getSourceMetadata,
    getSourcePresets,
    getSubtitleEditPreview,
    getSubtitleOutputs,
    getToolEntry,
    getToolRegistry,
    isSubtitleAnalysisFeature,
    state,
    subtitleText,
    text,
    textFromKey,
    toRecord,
  } = deps;

  const sourceEditRuntime = createMediaAnalysisSourceEditUiRuntime({
    featureText,
    subtitleText,
    text,
    textFromKey,
    toRecord,
    getAvailableSourceFormats,
    getDefaultSourceKind,
    getSourcePresets,
    getProjectSource,
    getCurrentEditDraft,
    getEditPresets,
    getActiveSubtitleEntry,
    isSubtitleAnalysisFeature,
    getActiveProject,
    getProjectEdit,
    getEditPreview,
    getActiveEditOutput,
    getSubtitleEditPreview,
    getSubtitleOutputs,
    getSourceMetadata,
  });

  const runtimeHelpers = createMediaAnalysisUiRuntimeHelpers({
    state,
    text,
    featureText,
    toRecord,
    getCurrentSourceKind: sourceEditRuntime.getCurrentSourceKind,
    getProjectProfile,
    getProfileCapabilities,
    getProfileLaneMap,
    getProfileReadiness,
    getProjectSource,
    getSourceMetadata,
    getToolEntry,
    getToolRegistry,
    getProfileSignals,
  });

  return {
    ...sourceEditRuntime,
    ...runtimeHelpers,
  };
}
