import { createSubtitleActionRuntime } from "./action-handlers.js";
import { createSubtitleEditWorkspaceRuntime } from "./edit-workspace.js";
import { createSubtitleProcessAnalysisRuntime } from "./process-analysis.js";
import { createSubtitleSourceIntakeRuntime } from "./source-intake.js";
import { createSubtitleWorkspaceRuntime } from "./workspace-runtime.js";
import { createSubtitleYoutubeSourceRuntime } from "./youtube-source.js";
export function createLaboratorySubtitleAnalysisHostRuntime(deps) {
  const workspacePatchActiveProject = deps.patchActiveProject;
  const youtubePatchActiveProject = deps.patchActiveProject;
  const sourceIntakePatchActiveProject = deps.patchActiveProject;
  const editWorkspacePatchActiveProject = deps.patchActiveProject;
  const actionPatchActiveProject = deps.patchActiveProject;
  const subtitleWorkspaceRuntime = createSubtitleWorkspaceRuntime({
    asNumber: deps.asNumber,
    getActiveProject: deps.getActiveProject,
    isSubtitleFileName: deps.isSubtitleFileName,
    listDirectory: deps.listDirectory,
    markFeatureProcessStale: deps.markFeatureProcessStale,
    markFeatureReportStale: deps.markFeatureReportStale,
    mergeObjects: deps.mergeObjects,
    normalizeSubtitleAnalysisState: deps.normalizeSubtitleAnalysisState,
    patchActiveProject: workspacePatchActiveProject,
    readTextFile: deps.readTextFile,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord
  });
  const subtitleYoutubeSourceRuntime = createSubtitleYoutubeSourceRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    callRoomTools: deps.callRoomTools,
    clearJob: deps.clearJob,
    createEmptySubtitleDiscoveryState: deps.createEmptySubtitleDiscoveryState,
    createSubtitleEntryRecord: deps.createSubtitleEntryRecord,
    getActiveProject: deps.getActiveProject,
    listSubtitleFilesInDirectory: subtitleWorkspaceRuntime.listSubtitleFilesInDirectory,
    normalizeStringArray: deps.normalizeStringArray,
    normalizeSubtitleAnalysisState: deps.normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem: deps.normalizeSubtitleDiscoveryItem,
    patchActiveProject: youtubePatchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
    upsertSubtitleEntries: deps.upsertSubtitleEntries
  });
  const subtitleSourceIntakeRuntime = createSubtitleSourceIntakeRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    callRoomTools: deps.callRoomTools,
    createSubtitleEntryRecord: deps.createSubtitleEntryRecord,
    getActiveProject: deps.getActiveProject,
    getElectronApi: deps.getElectronApi,
    getSubtitleMimeType: deps.getSubtitleMimeType,
    isSubtitleFileName: deps.isSubtitleFileName,
    listSubtitleFilesInDirectory: subtitleWorkspaceRuntime.listSubtitleFilesInDirectory,
    normalizeSubtitleAnalysisState: deps.normalizeSubtitleAnalysisState,
    patchActiveProject: sourceIntakePatchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    resetSubtitleDiscovery: deps.resetSubtitleDiscovery,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
    upsertSubtitleEntries: deps.upsertSubtitleEntries
  });
  const subtitleEditWorkspaceRuntime = createSubtitleEditWorkspaceRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    buildSubtitleEditSummary: deps.buildSubtitleEditSummary,
    ensureProjectDirectories: deps.ensureProjectDirectories,
    getActiveProject: deps.getActiveProject,
    getActiveSubtitleEntry: deps.getActiveSubtitleEntry,
    getProjectSubtitleEditOutputDir: deps.getProjectSubtitleEditOutputDir,
    markFeatureProcessStale: deps.markFeatureProcessStale,
    markFeatureReportStale: deps.markFeatureReportStale,
    normalizeSubtitleAnalysisState: deps.normalizeSubtitleAnalysisState,
    normalizeSubtitleOutputRecord: deps.normalizeSubtitleOutputRecord,
    patchActiveProject: editWorkspacePatchActiveProject,
    readSubtitleText: subtitleWorkspaceRuntime.readSubtitleText,
    resolveSubtitleOutputFormat: deps.resolveSubtitleOutputFormat,
    sanitizeFileSegment: deps.sanitizeFileSegment,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord,
    transformSubtitleDocument: deps.transformSubtitleDocument,
    writeTextFile: deps.writeTextFile
  });
  const subtitleActionRuntime = createSubtitleActionRuntime({
    applySubtitleEdit: subtitleEditWorkspaceRuntime.applyEdit,
    applySubtitleEditPatch: subtitleWorkspaceRuntime.applySubtitleEditPatch,
    asNonEmptyString: deps.asNonEmptyString,
    createEmptySubtitleDiscoveryState: deps.createEmptySubtitleDiscoveryState,
    getDefaultSubtitleEditPresetId: deps.getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe: deps.getDefaultSubtitleEditRecipe,
    getSubtitleEntries: deps.getSubtitleEntries,
    handleSubtitleFolderPick: subtitleSourceIntakeRuntime.handleFolderPick,
    handleSubtitleLocalPick: subtitleSourceIntakeRuntime.handleLocalPick,
    handleSubtitleUrlDownload: subtitleSourceIntakeRuntime.handleUrlDownload,
    handleSubtitleYoutubeDiscovery: subtitleYoutubeSourceRuntime.handleYoutubeDiscovery,
    handleSubtitleYoutubeDownload: subtitleYoutubeSourceRuntime.handleYoutubeDownload,
    markFeatureProcessStale: deps.markFeatureProcessStale,
    markFeatureReportStale: deps.markFeatureReportStale,
    normalizeStringArray: deps.normalizeStringArray,
    normalizeSubtitleAnalysisState: deps.normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem: deps.normalizeSubtitleDiscoveryItem,
    patchActiveProject: actionPatchActiveProject,
    patchActiveSubtitleWorkspaceDrafts: subtitleWorkspaceRuntime.patchActiveSubtitleWorkspaceDrafts,
    previewSubtitleEdit: subtitleEditWorkspaceRuntime.previewEdit,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord
  });
  const subtitleProcessAnalysisRuntime = createSubtitleProcessAnalysisRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    formatIdentifierLabel: deps.formatIdentifierLabel,
    getSubtitleAnalysisModuleDescriptors(runtime) {
      const runtimeRecord = deps.toRecord(runtime);
      const subtitleAnalysisCatalog = deps.toRecord(runtimeRecord["subtitleAnalysisCatalog"]);
      const modules = subtitleAnalysisCatalog["modules"];
      return Array.isArray(modules) ? modules.map(deps.toRecord) : [];
    },
    normalizeProcessModule: deps.normalizeProcessModule,
    parseSubtitleCues: deps.parseSubtitleCues,
    readSubtitleText: subtitleWorkspaceRuntime.readSubtitleText,
    toRecord: deps.toRecord
  });
  function buildSubtitleAnalysisStats(runtime, project, target) {
    return subtitleProcessAnalysisRuntime.buildSubtitleAnalysisStats(runtime, project, target);
  }
  function buildSubtitleProcessModules(runtime, project, target) {
    return subtitleProcessAnalysisRuntime.buildSubtitleProcessModules(runtime, project, target);
  }
  return {
    buildSubtitleAnalysisStats,
    buildSubtitleProcessModules,
    subtitleActionRuntime
  };
}
