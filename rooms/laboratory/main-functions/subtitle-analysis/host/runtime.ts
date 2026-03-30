import { createSubtitleActionRuntime } from "./action-handlers.js";
import { createSubtitleEditWorkspaceRuntime } from "./edit-workspace.js";
import { createSubtitleProcessAnalysisRuntime } from "./process-analysis.js";
import { createSubtitleSourceIntakeRuntime } from "./source-intake.js";
import { createSubtitleWorkspaceRuntime } from "./workspace-runtime.js";
import { createSubtitleYoutubeSourceRuntime } from "./youtube-source.js";

type LaboratoryRecord = Record<string, unknown>;
type SubtitleWorkspaceRuntimeDeps = Parameters<typeof createSubtitleWorkspaceRuntime>[0];
type SubtitleEditWorkspaceRuntimeDeps = Parameters<typeof createSubtitleEditWorkspaceRuntime>[0];
type SubtitleYoutubeSourceRuntimeDeps = Parameters<typeof createSubtitleYoutubeSourceRuntime>[0];
type SubtitleProcessAnalysisRuntimeDeps = Parameters<
  typeof createSubtitleProcessAnalysisRuntime
>[0];
type SubtitleSourceIntakeRuntimeDeps = Parameters<typeof createSubtitleSourceIntakeRuntime>[0];
type SubtitleActionRuntimeDeps = Parameters<typeof createSubtitleActionRuntime>[0];

type LaboratorySubtitleAnalysisHostRuntimeDeps = {
  asNonEmptyString: SubtitleYoutubeSourceRuntimeDeps["asNonEmptyString"];
  asNumber: SubtitleProcessAnalysisRuntimeDeps["asNumber"];
  buildSubtitleEditSummary: SubtitleEditWorkspaceRuntimeDeps["buildSubtitleEditSummary"];
  callRoomTools: SubtitleYoutubeSourceRuntimeDeps["callRoomTools"];
  clearJob: SubtitleYoutubeSourceRuntimeDeps["clearJob"];
  createEmptySubtitleDiscoveryState: SubtitleYoutubeSourceRuntimeDeps["createEmptySubtitleDiscoveryState"];
  createSubtitleEntryRecord: SubtitleYoutubeSourceRuntimeDeps["createSubtitleEntryRecord"];
  ensureProjectDirectories: (...args: unknown[]) => Promise<unknown> | unknown;
  formatIdentifierLabel: SubtitleProcessAnalysisRuntimeDeps["formatIdentifierLabel"];
  getActiveProject: SubtitleYoutubeSourceRuntimeDeps["getActiveProject"];
  getActiveSubtitleEntry: (project: LaboratoryRecord) => LaboratoryRecord | null;
  getDefaultSubtitleEditPresetId: (runtime: LaboratoryRecord) => string;
  getDefaultSubtitleEditRecipe: (runtime: LaboratoryRecord, presetId: string) => LaboratoryRecord;
  getElectronApi: SubtitleSourceIntakeRuntimeDeps["getElectronApi"];
  getProjectSubtitleEditOutputDir: (...args: unknown[]) => string;
  getSubtitleEntries: (project: LaboratoryRecord) => LaboratoryRecord[];
  getSubtitleMimeType: (fileName: string) => string | null;
  isSubtitleFileName: SubtitleSourceIntakeRuntimeDeps["isSubtitleFileName"];
  listDirectory: (
    dirPath: string
  ) => Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
  markFeatureProcessStale: (
    project: LaboratoryRecord,
    featureId: string,
    reason: string
  ) => unknown;
  markFeatureReportStale: (project: LaboratoryRecord, featureId: string, reason: string) => unknown;
  mergeObjects: (...args: unknown[]) => LaboratoryRecord;
  normalizeProcessModule: SubtitleProcessAnalysisRuntimeDeps["normalizeProcessModule"];
  normalizeStringArray: SubtitleYoutubeSourceRuntimeDeps["normalizeStringArray"];
  normalizeSubtitleAnalysisState: SubtitleYoutubeSourceRuntimeDeps["normalizeSubtitleAnalysisState"];
  normalizeSubtitleDiscoveryItem: SubtitleYoutubeSourceRuntimeDeps["normalizeSubtitleDiscoveryItem"];
  normalizeSubtitleOutputRecord: (rawValue: unknown, index: number) => LaboratoryRecord;
  parseSubtitleCues: SubtitleProcessAnalysisRuntimeDeps["parseSubtitleCues"];
  patchActiveProject: SubtitleEditWorkspaceRuntimeDeps["patchActiveProject"];
  pushJobState: SubtitleYoutubeSourceRuntimeDeps["pushJobState"];
  readTextFile: (filePath: string) => Promise<string>;
  registerJob: SubtitleYoutubeSourceRuntimeDeps["registerJob"];
  resetSubtitleDiscovery: SubtitleSourceIntakeRuntimeDeps["resetSubtitleDiscovery"];
  resolveSubtitleOutputFormat: (...args: unknown[]) => string;
  roomId: string;
  sanitizeFileSegment: (value: string, fallbackValue: string) => string;
  subtitleFeatureId: string;
  toRecord: SubtitleYoutubeSourceRuntimeDeps["toRecord"];
  transformSubtitleDocument: (...args: unknown[]) => string;
  upsertSubtitleEntries: SubtitleYoutubeSourceRuntimeDeps["upsertSubtitleEntries"];
  writeTextFile: (filePath: string, content: string) => Promise<unknown> | unknown;
};

export function createLaboratorySubtitleAnalysisHostRuntime(
  deps: LaboratorySubtitleAnalysisHostRuntimeDeps
) {
  const workspacePatchActiveProject =
    deps.patchActiveProject as SubtitleWorkspaceRuntimeDeps["patchActiveProject"];
  const youtubePatchActiveProject =
    deps.patchActiveProject as SubtitleYoutubeSourceRuntimeDeps["patchActiveProject"];
  const sourceIntakePatchActiveProject =
    deps.patchActiveProject as SubtitleSourceIntakeRuntimeDeps["patchActiveProject"];
  const editWorkspacePatchActiveProject = deps.patchActiveProject;
  const actionPatchActiveProject =
    deps.patchActiveProject as SubtitleActionRuntimeDeps["patchActiveProject"];
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
    toRecord: deps.toRecord,
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
    upsertSubtitleEntries: deps.upsertSubtitleEntries,
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
    upsertSubtitleEntries: deps.upsertSubtitleEntries,
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
    writeTextFile: deps.writeTextFile,
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
    toRecord: deps.toRecord,
  });

  const subtitleProcessAnalysisRuntime = createSubtitleProcessAnalysisRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    formatIdentifierLabel: deps.formatIdentifierLabel,
    getSubtitleAnalysisModuleDescriptors(runtime: LaboratoryRecord) {
      const runtimeRecord = deps.toRecord(runtime);
      const subtitleAnalysisCatalog = deps.toRecord(runtimeRecord["subtitleAnalysisCatalog"]);
      const modules = subtitleAnalysisCatalog["modules"];
      return Array.isArray(modules) ? modules.map(deps.toRecord) : [];
    },
    normalizeProcessModule: deps.normalizeProcessModule,
    parseSubtitleCues: deps.parseSubtitleCues,
    readSubtitleText: subtitleWorkspaceRuntime.readSubtitleText,
    toRecord: deps.toRecord,
  });

  function buildSubtitleAnalysisStats(
    runtime: LaboratoryRecord,
    project: LaboratoryRecord,
    target: LaboratoryRecord
  ) {
    return subtitleProcessAnalysisRuntime.buildSubtitleAnalysisStats(runtime, project, target);
  }

  function buildSubtitleProcessModules(runtime: LaboratoryRecord, target: LaboratoryRecord) {
    return subtitleProcessAnalysisRuntime.buildSubtitleProcessModules(runtime, target);
  }

  return {
    buildSubtitleAnalysisStats,
    buildSubtitleProcessModules,
    subtitleActionRuntime,
  };
}
