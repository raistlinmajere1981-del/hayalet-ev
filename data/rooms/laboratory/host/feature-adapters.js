import { createLaboratoryActionCompositionRuntime } from "../shared/host/action-composition.js";
import { createLaboratorySubtitleAnalysisHostRuntime } from "../main-functions/subtitle-analysis/host/runtime.js";
export function createLaboratoryFeatureAdapters(deps) {
  function buildWorkbenchFeatureDescriptors() {
    return [
      {
        featureId: "media-analysis",
        role: "primary"
      },
      {
        featureId: deps.audioFeatureId,
        role: "optional"
      },
      {
        featureId: deps.subtitleFeatureId,
        role: "optional"
      }
    ];
  }
  const laboratorySubtitleAnalysisHostRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    buildSubtitleEditSummary: deps.buildSubtitleEditSummary,
    callRoomTools: deps.callRoomTools,
    clearJob: deps.clearJob,
    createEmptySubtitleDiscoveryState: deps.createEmptySubtitleDiscoveryState,
    createSubtitleEntryRecord: deps.createSubtitleEntryRecord,
    ensureProjectDirectories: deps.ensureProjectDirectories,
    formatIdentifierLabel: deps.formatIdentifierLabel,
    getActiveProject: deps.getActiveProject,
    getActiveSubtitleEntry: deps.getActiveSubtitleEntry,
    getDefaultSubtitleEditPresetId: deps.getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe: deps.getDefaultSubtitleEditRecipe,
    getElectronApi: deps.getElectronApi,
    getProjectSubtitleEditOutputDir: deps.getProjectSubtitleEditOutputDir,
    getSubtitleEntries: deps.getSubtitleEntries,
    getSubtitleMimeType: deps.getSubtitleMimeType,
    isSubtitleFileName: deps.isSubtitleFileName,
    listDirectory: deps.listDirectory,
    markFeatureProcessStale: deps.markFeatureProcessStale,
    markFeatureReportStale: deps.markFeatureReportStale,
    mergeObjects: deps.mergeObjects,
    normalizeProcessModule: deps.normalizeProcessModule,
    normalizeStringArray: deps.normalizeStringArray,
    normalizeSubtitleAnalysisState: deps.normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem: deps.normalizeSubtitleDiscoveryItem,
    normalizeSubtitleOutputRecord: deps.normalizeSubtitleOutputRecord,
    patchActiveProject: deps.patchActiveProject,
    parseSubtitleCues: deps.parseSubtitleCues,
    pushJobState: deps.pushJobState,
    readTextFile: deps.readTextFile,
    registerJob: deps.registerJob,
    resetSubtitleDiscovery: deps.resetSubtitleDiscovery,
    resolveSubtitleOutputFormat: deps.resolveSubtitleOutputFormat,
    roomId: deps.roomId,
    sanitizeFileSegment: deps.sanitizeFileSegment,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord,
    transformSubtitleDocument: deps.transformSubtitleDocument,
    upsertSubtitleEntries: deps.upsertSubtitleEntries,
    writeTextFile: deps.writeTextFile
  };
  const laboratorySubtitleAnalysisHostRuntime = createLaboratorySubtitleAnalysisHostRuntime(
    laboratorySubtitleAnalysisHostRuntimeDeps
  );
  const { buildSubtitleAnalysisStats, buildSubtitleProcessModules, subtitleActionRuntime } = laboratorySubtitleAnalysisHostRuntime;
  const laboratoryActionCompositionRuntimeDeps = {
    applyEditRecipePatch: deps.applyEditRecipePatch,
    applyProfilePresetPatch: deps.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    audioFeatureId: deps.audioFeatureId,
    cancelJobById: deps.cancelJobById,
    cancelEditJobsForProject: deps.cancelEditJobsForProject,
    cancelFeatureProcess: deps.cancelFeatureProcess,
    cancelJobsForProject: deps.cancelJobsForProject,
    cancelProfileJobsForProject: deps.cancelProfileJobsForProject,
    clampNumber: deps.clampNumber,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    createDefaultEditState: deps.createDefaultEditState,
    createDefaultToolEntry: deps.createDefaultToolEntry,
    createProject: deps.createProject,
    createRequestId: deps.createRequestId,
    deleteProject: deps.deleteProject,
    ensureHydrated: deps.ensureHydrated,
    ensureProjectExists: deps.ensureProjectExists,
    exportFeatureReport: deps.exportFeatureReport,
    findEditPreset: deps.findEditPreset,
    findProfilePreset: deps.findProfilePreset,
    getActiveProject: deps.getActiveProject,
    getDefaultMode: deps.getDefaultMode,
    getDefaultSourceType: deps.getDefaultSourceType,
    getFeatureIdFromContext: deps.getFeatureIdFromContext,
    getProfileModelDescriptorMap: deps.getProfileModelDescriptorMap,
    getProjectEditDir: deps.getProjectEditDir,
    getProjectEditOutputDir: deps.getProjectEditOutputDir,
    getProjectSourceDir: deps.getProjectSourceDir,
    getRuntimeToolIds: deps.getRuntimeToolIds,
    handleLocalPick: deps.handleLocalPick,
    handleUrlDownload: deps.handleUrlDownload,
    handleYoutubeDownload: deps.handleYoutubeDownload,
    installProfileModel: deps.installProfileModel,
    loadContext: deps.loadContext,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    markProfileAsStale: deps.markProfileAsStale,
    normalizeProfileArtifactPreferences: deps.normalizeProfileArtifactPreferences,
    patchActiveProject: deps.patchActiveProject,
    patchActiveProjectDrafts: deps.patchActiveProjectDrafts,
    persistProfileModelState: deps.persistProfileModelState,
    persistToolState: deps.persistToolState,
    pushActionResult: deps.pushActionResult,
    pushJobState: deps.pushJobState,
    pushMediaState: deps.pushMediaState,
    refreshActiveProjectMetadata: deps.refreshActiveProjectMetadata,
    refreshProfileModelState: deps.refreshProfileModelState,
    refreshToolStatus: deps.refreshToolStatus,
    registerJob: deps.registerJob,
    removeProfileModel: deps.removeProfileModel,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
    runEditPipeline: deps.runEditPipeline,
    runFeatureProcess: deps.runFeatureProcess,
    runProfilePreflight: deps.runProfilePreflight,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
    callRoomTools: deps.callRoomTools,
    clearJob: deps.clearJob,
    getSubtitleActionRuntime: function() {
      return subtitleActionRuntime;
    }
  };
  const laboratoryActionCompositionRuntime = createLaboratoryActionCompositionRuntime(
    laboratoryActionCompositionRuntimeDeps
  );
  const laboratoryActionCompositionRuntimeRecord = laboratoryActionCompositionRuntime;
  function handleMediaAction(...args) {
    return laboratoryActionCompositionRuntimeRecord.handleMediaAction(...args);
  }
  return {
    buildWorkbenchFeatureDescriptors,
    buildSubtitleAnalysisStats,
    buildSubtitleProcessModules,
    handleMediaAction,
    laboratorySubtitleAnalysisHostRuntime
  };
}
