import { createLaboratoryHostActionRuntime } from "./action-runtime.js";
import { createLaboratoryToolMutationRuntime } from "./tool-mutations.js";
import { createMediaActionRuntime } from "../../main-functions/media-analysis/host/action-handlers.js";

export function createLaboratoryActionCompositionRuntime(deps: any) {
  let laboratoryHostActionRuntime: any = null;

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
    handleToolMutation: function (...args: unknown[]) {
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
    toolMutationRuntime: {
      handleToolMutation(
        api: unknown,
        runtime: unknown,
        requestId: string,
        action: string,
        toolId: string,
        featureStage: string | null
      ) {
        return laboratoryToolMutationRuntime.handleToolMutation(
          api,
          runtime as Parameters<typeof laboratoryToolMutationRuntime.handleToolMutation>[1],
          requestId,
          action,
          toolId,
          featureStage
        );
      },
    },
    getSubtitleActionRuntime: deps.getSubtitleActionRuntime,
  });

  const hostActionRuntime = laboratoryHostActionRuntime;
  if (!hostActionRuntime) {
    throw new Error("Laboratory host action runtime is not initialized");
  }

  return {
    handleMediaAction: hostActionRuntime.handleMediaAction,
    handleToolMutation: hostActionRuntime.handleToolMutation,
    laboratoryHostActionRuntime: hostActionRuntime,
    laboratoryToolMutationRuntime: laboratoryToolMutationRuntime,
    mediaActionRuntime: mediaActionRuntime,
  };
}
