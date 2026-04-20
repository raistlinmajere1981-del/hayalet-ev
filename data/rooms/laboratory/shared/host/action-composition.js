import { createMediaActionRuntime } from "../../main-functions/media-analysis/host/action-handlers.js";
import { createLaboratoryHostActionRuntime } from "./action-runtime.js";
import { createLaboratoryToolMutationRuntime } from "./tool-mutations.js";
export function createLaboratoryActionCompositionRuntime(deps) {
  let laboratoryHostActionRuntime = null;
  const laboratoryToolMutationRuntimeDeps = {
    callRoomTools: deps.callRoomTools,
    clearJob: deps.clearJob,
    createDefaultToolEntry: deps.createDefaultToolEntry,
    getRuntimeToolIds: deps.getRuntimeToolIds,
    persistToolState: deps.persistToolState,
    pushJobState: deps.pushJobState,
    refreshProfileModelState: deps.refreshProfileModelState,
    registerJob: deps.registerJob,
    roomId: deps.roomId,
    toRecord: deps.toRecord
  };
  const laboratoryToolMutationRuntime = createLaboratoryToolMutationRuntime(
    laboratoryToolMutationRuntimeDeps
  );
  const mediaActionRuntimeDeps = {
    applyEditRecipePatch: deps.applyEditRecipePatch,
    applyProfilePresetPatch: deps.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    audioFeatureId: deps.audioFeatureId,
    cancelJobById: deps.cancelJobById,
    cancelEditJobsForProject: deps.cancelEditJobsForProject,
    cancelFeatureProcess: deps.cancelFeatureProcess,
    cancelProfileJobsForProject: deps.cancelProfileJobsForProject,
    checkToolUpdates(...args) {
      return laboratoryToolMutationRuntime.checkToolUpdates(...args);
    },
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
    handleToolMutation(...args) {
      const hostAction = laboratoryHostActionRuntime;
      if (!hostAction) {
        throw new Error("Laboratory host action runtime is not initialized");
      }
      return hostAction.handleToolMutation(...args);
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
    updateAllTools(...args) {
      return laboratoryToolMutationRuntime.updateAllTools(...args);
    }
  };
  const mediaActionRuntime = createMediaActionRuntime(
    mediaActionRuntimeDeps
  );
  const toolMutationRuntime = {
    handleToolMutation(api, runtime, requestId, action, toolId, featureStage) {
      return laboratoryToolMutationRuntime.handleToolMutation(
        api,
        runtime,
        requestId,
        action,
        toolId,
        featureStage
      );
    }
  };
  const laboratoryHostActionRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    createRequestId: deps.createRequestId,
    ensureHydrated: deps.ensureHydrated,
    getFeatureIdFromContext: deps.getFeatureIdFromContext,
    getSubtitleActionRuntime: deps.getSubtitleActionRuntime,
    loadContext: deps.loadContext,
    mediaActionRuntime,
    persistProfileModelState: deps.persistProfileModelState,
    persistToolState: deps.persistToolState,
    pushActionResult: deps.pushActionResult,
    pushMediaState: deps.pushMediaState,
    toRecord: deps.toRecord,
    toolMutationRuntime
  };
  laboratoryHostActionRuntime = createLaboratoryHostActionRuntime(
    laboratoryHostActionRuntimeDeps
  );
  const hostActionRuntime = laboratoryHostActionRuntime;
  return {
    handleMediaAction: hostActionRuntime.handleMediaAction,
    handleToolMutation: hostActionRuntime.handleToolMutation,
    laboratoryHostActionRuntime: hostActionRuntime,
    laboratoryToolMutationRuntime,
    mediaActionRuntime
  };
}
