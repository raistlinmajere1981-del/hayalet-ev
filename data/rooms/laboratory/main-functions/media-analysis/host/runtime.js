import { createMediaEditArtifactRuntime } from "./edit-artifacts.js";
import { createMediaEditSupportRuntime } from "./edit-support.js";
import { createMediaEditPipelineRuntime } from "./edit-pipeline.js";
import { createMediaProfilePreflightRuntime } from "./profile-preflight.js";
import { createLaboratoryVisualAnalysisRuntime } from "./visual-analysis-runtime.js";
export function createLaboratoryMediaAnalysisHostRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    audioFeatureId,
    buildSyntheticProfileSignal,
    callRoomTools,
    clearJob,
    clone,
    clampNumber,
    createDefaultEditState,
    createEmptyProfilePreflight,
    createProfileSignal,
    ensureEditJobSlotAvailable,
    ensureProfileJobSlotAvailable,
    ensureProjectDirectories,
    generateProfileFrameStrip,
    generateProfileMetadataArtifact,
    generateProfileSpectrogram,
    getActiveProject,
    getCollectDerivedOutputMetadata,
    getFocusRegionCrop,
    getProjectEditDir,
    getProjectEditOutputDir,
    getProjectEditPreviewDir,
    getProfileFrameDensityRuntimeConfig,
    getResizePresetMap,
    maybeRunWhisperProfileSample,
    markCloseoutAsStale,
    markProfileAsStale,
    mergeObjects,
    normalizeEditOutput,
    normalizeProfileArtifactPreferences,
    normalizeSourceMetadata,
    patchActiveProject,
    pushJobState,
    registerJob,
    runAudioStructureProbe,
    runVideoStructureProbe,
    roomId,
    syncProjectFeatureProjections,
    toRecord
  } = deps;
  function getFfmpegToolState(runtime) {
    return toRecord(toRecord(toRecord(runtime.toolState)["tools"])["ffmpeg"]);
  }
  const mediaEditSupportRuntime = createMediaEditSupportRuntime({
    asNonEmptyString,
    asNumber,
    clampNumber,
    createDefaultEditState,
    getFocusRegionCrop,
    getProjectEditOutputDir,
    getProjectEditPreviewDir,
    getResizePresetMap,
    markCloseoutAsStale,
    mergeObjects,
    normalizeSourceMetadata,
    toRecord
  });
  const {
    applyEditRecipePatch,
    buildEditCommand,
    buildEditOutputLabel,
    buildEditTargetPath,
    findEditPreset,
    getDerivedMimeType,
    getEditRecipeSignature,
    getPreparedSourcePath,
    requirePreparedSource,
    resetEditForCurrentSource,
    sanitizeFileSegment
  } = mediaEditSupportRuntime;
  function ensureEditToolReady(runtime) {
    const ffmpegState = getFfmpegToolState(runtime);
    if (ffmpegState["installed"] !== true) {
      throw new Error("Install FFmpeg in settings before using the edit stage.");
    }
  }
  const mediaEditArtifactRuntime = createMediaEditArtifactRuntime({
    asNonEmptyString,
    asNumber,
    callRoomTools,
    clampNumber,
    getProjectEditDir,
    getProjectEditOutputDir,
    getProjectEditPreviewDir,
    listDirectory: deps.listDirectory,
    roomId,
    toRecord
  });
  const mediaEditPipelineRuntime = createMediaEditPipelineRuntime({
    audioFeatureId,
    buildAuxiliaryArtifacts: mediaEditArtifactRuntime.buildAuxiliaryArtifacts,
    buildEditCommand,
    buildEditOutputLabel,
    buildEditTargetPath,
    callRoomTools,
    clearJob,
    collectDerivedOutputMetadata: getCollectDerivedOutputMetadata,
    ensureEditJobSlotAvailable,
    ensureEditToolReady,
    ensureProjectDirectories,
    getActiveProject,
    getDerivedMimeType,
    getEditRecipeSignature,
    getPreparedSourcePath,
    getProjectEditDir,
    markCloseoutAsStale,
    markProfileAsStale,
    normalizeEditOutput,
    patchActiveProject,
    pushJobState,
    registerJob,
    requirePreparedSource,
    roomId,
    toRecord
  });
  function runEditPipeline(...args) {
    return mediaEditPipelineRuntime.runEditPipeline(...args);
  }
  function ensureProfileToolReady(runtime) {
    const ffmpegState = getFfmpegToolState(runtime);
    if (ffmpegState["installed"] !== true) {
      throw new Error("Install FFmpeg in settings before using the profile stage.");
    }
  }
  const mediaProfilePreflightRuntime = createMediaProfilePreflightRuntime({
    asNonEmptyString,
    asNumber,
    buildSyntheticProfileSignal,
    clampNumber,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    clearJob,
    clone,
    createEmptyProfilePreflight,
    createProfileSignal,
    ensureProfileJobSlotAvailable,
    ensureProfileToolReady,
    ensureProjectDirectories,
    generateProfileFrameStrip,
    generateProfileMetadataArtifact,
    generateProfileSpectrogram,
    getActiveProject,
    getProfileFrameDensityRuntimeConfig,
    maybeRunWhisperProfileSample,
    normalizeProfileArtifactPreferences,
    normalizeSourceMetadata,
    patchActiveProject,
    pushJobState,
    registerJob,
    runAudioStructureProbe,
    runVideoStructureProbe,
    sanitizeFileSegment,
    syncProjectFeatureProjections,
    toRecord
  });
  function runProfilePreflight(...args) {
    return mediaProfilePreflightRuntime.runProfilePreflight(...args);
  }
  const visualAnalysisRuntime = createLaboratoryVisualAnalysisRuntime({
    asNonEmptyString,
    toRecord
  });
  return {
    applyEditRecipePatch,
    buildEditCommand,
    buildEditOutputLabel,
    buildEditTargetPath,
    ensureEditToolReady,
    ensureProfileToolReady,
    findEditPreset,
    getDerivedMimeType,
    getEditRecipeSignature,
    getPreparedSourcePath,
    requirePreparedSource,
    resetEditForCurrentSource,
    runEditPipeline,
    runProfilePreflight,
    sanitizeFileSegment,
    visualAnalysisRuntime
  };
}
