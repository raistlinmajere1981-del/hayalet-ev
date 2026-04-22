import { createMediaEditActionRuntime } from "./action-handlers-edit.js";
import { createMediaExportActionRuntime } from "./action-handlers-export.js";
import { createMediaProfileActionRuntime } from "./action-handlers-profile.js";
import { createMediaProjectActionRuntime } from "./action-handlers-project.js";
import { createMediaSourceActionRuntime } from "./action-handlers-source.js";

type LaboratoryRecord = Record<string, unknown>;

type MediaSourceActionRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  getDefaultMode: (sourcePresets: unknown, sourceKind: unknown) => string;
  getDefaultSourceType: (sourcePresets: unknown) => string;
  handleLocalPick: (api: unknown, runtime: LaboratoryRecord, requestId: string) => Promise<unknown>;
  handleUrlDownload: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  handleYoutubeDownload: (
    api: unknown,
    runtime: LaboratoryRecord,
    requestId: string
  ) => Promise<unknown>;
  patchActiveProject: (
    runtime: LaboratoryRecord,
    patcher: (project: LaboratoryRecord) => LaboratoryRecord
  ) => Promise<unknown>;
  patchActiveProjectDrafts: (runtime: LaboratoryRecord, fields: unknown) => Promise<unknown>;
  resetEditForCurrentSource: (runtime: LaboratoryRecord, project: LaboratoryRecord) => void;
  resetProfileForCurrentSource: (
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    reason: string
  ) => void;
};

type MediaEditActionRuntimeDeps = Parameters<typeof createMediaEditActionRuntime>[0];
type MediaExportActionRuntimeDeps = Parameters<typeof createMediaExportActionRuntime>[0];
type MediaProfileActionRuntimeDeps = Parameters<typeof createMediaProfileActionRuntime>[0];
type MediaProjectActionRuntimeDeps = Parameters<typeof createMediaProjectActionRuntime>[0];

type MediaActionRuntimeDeps = MediaSourceActionRuntimeDeps &
  MediaEditActionRuntimeDeps &
  MediaExportActionRuntimeDeps &
  MediaProfileActionRuntimeDeps &
  MediaProjectActionRuntimeDeps;

type MediaActionRuntime = ReturnType<typeof createMediaSourceActionRuntime> &
  ReturnType<typeof createMediaEditActionRuntime> &
  ReturnType<typeof createMediaExportActionRuntime> &
  ReturnType<typeof createMediaProfileActionRuntime> &
  ReturnType<typeof createMediaProjectActionRuntime>;

export function createMediaActionRuntime(deps: MediaActionRuntimeDeps): MediaActionRuntime {
  const mediaSourceActionRuntime = createMediaSourceActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    getDefaultMode: deps.getDefaultMode,
    getDefaultSourceType: deps.getDefaultSourceType,
    handleLocalPick: deps.handleLocalPick,
    handleUrlDownload: deps.handleUrlDownload,
    handleYoutubeDownload: deps.handleYoutubeDownload,
    patchActiveProject: deps.patchActiveProject,
    patchActiveProjectDrafts: deps.patchActiveProjectDrafts,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
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
    toRecord: deps.toRecord,
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
    toRecord: deps.toRecord,
  });

  const mediaExportActionRuntime = createMediaExportActionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    callRoomTools: deps.callRoomTools,
    getActiveProject: deps.getActiveProject,
    getProjectEditOutputDir: deps.getProjectEditOutputDir,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    clearJob: deps.clearJob,
    cancelJobsForProject: deps.cancelJobsForProject,
    toRecord: deps.toRecord,
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
    updateAllTools: deps.updateAllTools,
  });

  return {
    ...mediaSourceActionRuntime,
    ...mediaEditActionRuntime,
    ...mediaExportActionRuntime,
    ...mediaProfileActionRuntime,
    ...mediaProjectActionRuntime,
  };
}
