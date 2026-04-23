import { createMediaEditActionRuntime } from "./action-handlers-edit.js";
import { createMediaExportActionRuntime } from "./action-handlers-export.js";
import { createMediaProfileActionRuntime } from "./action-handlers-profile.js";
import { createMediaProjectActionRuntime } from "./action-handlers-project.js";
import { createMediaSourceActionRuntime } from "./action-handlers-source.js";
export function createMediaActionRuntime(deps) {
  const mediaSourceActionRuntime = createMediaSourceActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    getDefaultMode: deps.getDefaultMode,
    getDefaultSourceType: deps.getDefaultSourceType,
    handleLocalPick: deps.handleLocalPick,
    handleAssetAsSource: deps.handleAssetAsSource,
    handleUrlDownload: deps.handleUrlDownload,
    handleYoutubeDownload: deps.handleYoutubeDownload,
    patchActiveProject: deps.patchActiveProject,
    patchActiveProjectDrafts: deps.patchActiveProjectDrafts,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource
  });
  const mediaEditActionRuntime = createMediaEditActionRuntime({
    applyEditRecipePatch: deps.applyEditRecipePatch,
    asNonEmptyString: deps.asNonEmptyString,
    audioFeatureId: deps.audioFeatureId,
    cancelEditJobsForProject: deps.cancelEditJobsForProject,
    createDefaultEditState: deps.createDefaultEditState,
    findEditPreset: deps.findEditPreset,
    getActiveProject: deps.getActiveProject,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    markProfileAsStale: deps.markProfileAsStale,
    patchActiveProject: deps.patchActiveProject,
    runEditPipeline: deps.runEditPipeline,
    toRecord: deps.toRecord
  });
  const mediaProfileActionRuntime = createMediaProfileActionRuntime({
    applyProfilePresetPatch: deps.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    cancelProfileJobsForProject: deps.cancelProfileJobsForProject,
    clampNumber: deps.clampNumber,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    createEmptyProfilePreflight: deps.createEmptyProfilePreflight,
    findProfilePreset: deps.findProfilePreset,
    getActiveProject: deps.getActiveProject,
    markProfileAsStale: deps.markProfileAsStale,
    normalizeProfileArtifactPreferences: deps.normalizeProfileArtifactPreferences,
    patchActiveProject: deps.patchActiveProject,
    runProfilePreflight: deps.runProfilePreflight,
    toRecord: deps.toRecord
  });
  const mediaExportActionRuntime = createMediaExportActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    callRoomTools: deps.callRoomTools,
    getActiveProject: deps.getActiveProject,
    getProjectEditOutputDir: deps.getProjectEditOutputDir,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    clearJob: deps.clearJob,
    cancelJobsForProject: deps.cancelJobsForProject,
    toRecord: deps.toRecord
  });
  const mediaProjectActionRuntime = createMediaProjectActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    cancelJobById: deps.cancelJobById,
    cancelFeatureProcess: deps.cancelFeatureProcess,
    checkToolUpdates: deps.checkToolUpdates,
    createProject: deps.createProject,
    deleteProject: deps.deleteProject,
    ensureProjectExists: deps.ensureProjectExists,
    exportFeatureReport: deps.exportFeatureReport,
    handleToolMutation: deps.handleToolMutation,
    patchActiveProject: deps.patchActiveProject,
    refreshActiveProjectMetadata: deps.refreshActiveProjectMetadata,
    refreshToolStatus: deps.refreshToolStatus,
    runFeatureProcess: deps.runFeatureProcess,
    updateAllTools: deps.updateAllTools
  });
  return {
    ...mediaSourceActionRuntime,
    ...mediaEditActionRuntime,
    ...mediaExportActionRuntime,
    ...mediaProfileActionRuntime,
    ...mediaProjectActionRuntime
  };
}
