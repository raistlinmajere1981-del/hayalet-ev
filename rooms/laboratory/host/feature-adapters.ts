import { createLaboratoryActionCompositionRuntime } from "../shared/host/action-composition.js";
import { createLaboratorySubtitleAnalysisHostRuntime } from "../main-functions/subtitle-analysis/host/runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type UnknownFn = (...args: unknown[]) => unknown;

type LaboratoryFeatureAdaptersDeps = {
  applyEditRecipePatch: UnknownFn;
  applyProfilePresetPatch: UnknownFn;
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  audioFeatureId: string;
  buildSubtitleEditSummary: UnknownFn;
  callRoomTools: UnknownFn;
  cancelEditJobsForProject: UnknownFn;
  cancelFeatureProcess: UnknownFn;
  cancelProfileJobsForProject: UnknownFn;
  clampNumber: UnknownFn;
  clampProfileTranscriptSampleSeconds: UnknownFn;
  clearJob: UnknownFn;
  createDefaultEditState: UnknownFn;
  createDefaultToolEntry: UnknownFn;
  createEmptySubtitleDiscoveryState: UnknownFn;
  createProject: UnknownFn;
  createRequestId: UnknownFn;
  createSubtitleEntryRecord: UnknownFn;
  ensureHydrated: UnknownFn;
  ensureProjectDirectories: UnknownFn;
  ensureProjectExists: UnknownFn;
  exportFeatureReport: UnknownFn;
  findEditPreset: UnknownFn;
  findProfilePreset: UnknownFn;
  formatIdentifierLabel: UnknownFn;
  getActiveProject: UnknownFn;
  getActiveSubtitleEntry: UnknownFn;
  getDefaultMode: UnknownFn;
  getDefaultSourceType: UnknownFn;
  getDefaultSubtitleEditPresetId: UnknownFn;
  getDefaultSubtitleEditRecipe: UnknownFn;
  getElectronApi: UnknownFn;
  getFeatureIdFromContext: UnknownFn;
  getProfileModelDescriptorMap: UnknownFn;
  getProjectSubtitleEditOutputDir: UnknownFn;
  getRuntimeToolIds: UnknownFn;
  getSubtitleEntries: UnknownFn;
  getSubtitleMimeType: UnknownFn;
  handleLocalPick: UnknownFn;
  handleUrlDownload: UnknownFn;
  handleYoutubeDownload: UnknownFn;
  installProfileModel: UnknownFn;
  isSubtitleFileName: UnknownFn;
  listDirectory: UnknownFn;
  loadContext: UnknownFn;
  markCloseoutAsStale: UnknownFn;
  markFeatureProcessStale: UnknownFn;
  markFeatureReportStale: UnknownFn;
  markProfileAsStale: UnknownFn;
  mergeObjects: UnknownFn;
  normalizeProcessModule: UnknownFn;
  normalizeProfileArtifactPreferences: UnknownFn;
  normalizeStringArray: (value: unknown) => string[];
  normalizeSubtitleAnalysisState: UnknownFn;
  normalizeSubtitleDiscoveryItem: UnknownFn;
  normalizeSubtitleOutputRecord: UnknownFn;
  parseSubtitleCues: UnknownFn;
  patchActiveProject: UnknownFn;
  patchActiveProjectDrafts: UnknownFn;
  persistProfileModelState: UnknownFn;
  persistToolState: UnknownFn;
  pushActionResult: UnknownFn;
  pushJobState: UnknownFn;
  pushMediaState: UnknownFn;
  readTextFile: UnknownFn;
  refreshActiveProjectMetadata: UnknownFn;
  refreshProfileModelState: UnknownFn;
  refreshToolStatus: UnknownFn;
  registerJob: UnknownFn;
  removeProfileModel: UnknownFn;
  resetEditForCurrentSource: UnknownFn;
  resetProfileForCurrentSource: UnknownFn;
  resetSubtitleDiscovery: UnknownFn;
  resolveSubtitleOutputFormat: UnknownFn;
  roomId: string;
  runEditPipeline: UnknownFn;
  runFeatureProcess: UnknownFn;
  runProfilePreflight: UnknownFn;
  sanitizeFileSegment: UnknownFn;
  subtitleFeatureId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
  transformSubtitleDocument: UnknownFn;
  upsertSubtitleEntries: UnknownFn;
  writeTextFile: UnknownFn;
};

export function createLaboratoryFeatureAdapters(deps: LaboratoryFeatureAdaptersDeps) {
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
    writeTextFile: deps.writeTextFile,
  };
  const laboratorySubtitleAnalysisHostRuntime = createLaboratorySubtitleAnalysisHostRuntime(
    laboratorySubtitleAnalysisHostRuntimeDeps as unknown as Parameters<typeof createLaboratorySubtitleAnalysisHostRuntime>[0]
  );
  const { buildSubtitleAnalysisStats, buildSubtitleProcessModules, subtitleActionRuntime } =
    laboratorySubtitleAnalysisHostRuntime;
  const laboratoryActionCompositionRuntimeDeps = {
    applyEditRecipePatch: deps.applyEditRecipePatch,
    applyProfilePresetPatch: deps.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    audioFeatureId: deps.audioFeatureId,
    cancelEditJobsForProject: deps.cancelEditJobsForProject,
    cancelFeatureProcess: deps.cancelFeatureProcess,
    cancelProfileJobsForProject: deps.cancelProfileJobsForProject,
    clampNumber: deps.clampNumber,
    clampProfileTranscriptSampleSeconds: deps.clampProfileTranscriptSampleSeconds,
    createDefaultEditState: deps.createDefaultEditState,
    createDefaultToolEntry: deps.createDefaultToolEntry,
    createProject: deps.createProject,
    createRequestId: deps.createRequestId,
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
    getSubtitleActionRuntime: function () {
      return subtitleActionRuntime;
    },
  };
  const laboratoryActionCompositionRuntime = createLaboratoryActionCompositionRuntime(
    laboratoryActionCompositionRuntimeDeps as unknown as Parameters<typeof createLaboratoryActionCompositionRuntime>[0]
  );
  const laboratoryActionCompositionRuntimeRecord = laboratoryActionCompositionRuntime as
    LaboratoryRecord & {
      handleMediaAction: UnknownFn;
    };

  function handleMediaAction(...args: unknown[]) {
    return laboratoryActionCompositionRuntimeRecord.handleMediaAction(...args);
  }

  return {
    buildSubtitleAnalysisStats,
    buildSubtitleProcessModules,
    handleMediaAction,
    laboratorySubtitleAnalysisHostRuntime,
  };
}
