import { createLaboratoryHostActionRuntime } from "./action-runtime.js";
import { createLaboratoryToolMutationRuntime } from "./tool-mutations.js";
import { createMediaActionRuntime } from "../../main-functions/media-analysis/host/action-handlers.js";

export function createLaboratoryActionCompositionRuntime(deps) {
  let laboratoryHostActionRuntime = null;

  const laboratoryToolMutationRuntime = createLaboratoryToolMutationRuntime({
    callRoomTools: deps.callRoomTools,
    clearJob: deps.clearJob,
    createDefaultToolEntry: deps.createDefaultToolEntry,
    getRuntimeToolIds: deps.getRuntimeToolIds,
    persistToolState: deps.persistToolState,
    pushJobState: deps.pushJobState,
    refreshProfileModelState: deps.refreshProfileModelState,
    registerJob: deps.registerJob,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });

  const mediaActionRuntime = createMediaActionRuntime({
    applyEditRecipePatch: deps.applyEditRecipePatch,
    applyProfilePresetPatch: deps.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    audioFeatureId: deps.audioFeatureId,
    cancelEditJobsForProject: deps.cancelEditJobsForProject,
    cancelFeatureProcess: deps.cancelFeatureProcess,
    cancelProfileJobsForProject: deps.cancelProfileJobsForProject,
    clampNumber: deps.clampNumber,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    createEmptyProfilePreflight: deps.createEmptyProfilePreflight,
    createDefaultEditState: deps.createDefaultEditState,
    createProject: deps.createProject,
    deleteProject: deps.deleteProject,
    ensureProjectExists: deps.ensureProjectExists,
    exportFeatureReport: deps.exportFeatureReport,
    findEditPreset: deps.findEditPreset,
    findProfilePreset: deps.findProfilePreset,
    getProfileModelDescriptorMap: deps.getProfileModelDescriptorMap,
    getActiveProject: deps.getActiveProject,
    getDefaultMode: deps.getDefaultMode,
    getDefaultSourceType: deps.getDefaultSourceType,
    handleLocalPick: deps.handleLocalPick,
    handleToolMutation: function (...args) {
      return laboratoryHostActionRuntime.handleToolMutation(...args);
    },
    handleUrlDownload: deps.handleUrlDownload,
    handleYoutubeDownload: deps.handleYoutubeDownload,
    installProfileModel: deps.installProfileModel,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    markProfileAsStale: deps.markProfileAsStale,
    normalizeProfileArtifactPreferences: deps.normalizeProfileArtifactPreferences,
    patchActiveProject: deps.patchActiveProject,
    patchActiveProjectDrafts: deps.patchActiveProjectDrafts,
    refreshActiveProjectMetadata: deps.refreshActiveProjectMetadata,
    refreshToolStatus: deps.refreshToolStatus,
    removeProfileModel: deps.removeProfileModel,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
    runFeatureProcess: deps.runFeatureProcess,
    runEditPipeline: deps.runEditPipeline,
    runProfilePreflight: deps.runProfilePreflight,
    toRecord: deps.toRecord,
  });

  laboratoryHostActionRuntime = createLaboratoryHostActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    createRequestId: deps.createRequestId,
    ensureHydrated: deps.ensureHydrated,
    getFeatureIdFromContext: deps.getFeatureIdFromContext,
    loadContext: deps.loadContext,
    mediaActionRuntime: mediaActionRuntime,
    persistProfileModelState: deps.persistProfileModelState,
    persistToolState: deps.persistToolState,
    pushActionResult: deps.pushActionResult,
    pushMediaState: deps.pushMediaState,
    toRecord: deps.toRecord,
    toolMutationRuntime: laboratoryToolMutationRuntime,
    getSubtitleActionRuntime: deps.getSubtitleActionRuntime,
  });

  return {
    handleMediaAction: laboratoryHostActionRuntime.handleMediaAction,
    handleToolMutation: laboratoryHostActionRuntime.handleToolMutation,
    laboratoryHostActionRuntime: laboratoryHostActionRuntime,
    laboratoryToolMutationRuntime: laboratoryToolMutationRuntime,
    mediaActionRuntime: mediaActionRuntime,
  };
}
