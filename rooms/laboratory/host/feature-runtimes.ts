import {
  getProjectEditDir,
  getProjectEditOutputDir,
  getProjectEditPreviewDir,
  getProjectSourceDir,
  getProjectSubtitleEditOutputDir,
  getProjectSubtitleProcessDir,
} from "../shared/host/project-paths.js";
import { createLaboratoryProjectStateRuntime } from "../shared/host/project-state.js";
import { createLaboratoryRoomToolsProgressRuntime } from "../shared/host/room-tools-progress.js";
import { createLaboratoryRuntimeStorage } from "../shared/host/runtime-storage.js";
import { createLaboratorySourceCompositionRuntime } from "../shared/host/source-composition.js";
import { createLaboratoryHostProcessCompositionRuntime } from "../shared/host/process-composition.js";
import { createLaboratoryMediaAnalysisHostRuntime } from "../main-functions/media-analysis/host/runtime.js";
import { createLaboratoryFeatureAdapters } from "./feature-adapters.js";
import type { createLaboratoryHostFoundation } from "./foundation-runtimes.js";
import type { createLaboratoryHostProjectRuntimes } from "./project-runtimes.js";
import type { createLaboratorySubtitleAnalysisHostRuntime } from "../main-functions/subtitle-analysis/host/runtime.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryHostFoundationRuntime = ReturnType<typeof createLaboratoryHostFoundation>;
type LaboratoryHostProjectRuntimesRuntime = ReturnType<typeof createLaboratoryHostProjectRuntimes>;
type LaboratorySourceCompositionRuntime = ReturnType<typeof createLaboratorySourceCompositionRuntime>;
type LaboratoryProcessDelegatesRuntime = {
  cancelFeatureProcess: (...args: unknown[]) => unknown;
  exportFeatureReport: (...args: unknown[]) => unknown;
  runFeatureProcess: (...args: unknown[]) => unknown;
};
type LaboratoryProcessCompositionRuntime = ReturnType<
  typeof createLaboratoryHostProcessCompositionRuntime
> & {
  laboratoryProcessDelegatesRuntime: LaboratoryProcessDelegatesRuntime | null;
};
type LaboratoryProjectStateRuntime = ReturnType<typeof createLaboratoryProjectStateRuntime>;
type LaboratoryFeatureAdaptersRuntime = ReturnType<typeof createLaboratoryFeatureAdapters>;
type LaboratoryRoomToolsProgressRuntime = ReturnType<typeof createLaboratoryRoomToolsProgressRuntime>;
type LaboratoryRuntimeStorageRuntime = ReturnType<typeof createLaboratoryRuntimeStorage>;
type LaboratorySubtitleAnalysisHostRuntime = ReturnType<
  typeof createLaboratorySubtitleAnalysisHostRuntime
>;

type LaboratoryHostFeatureRuntimesDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  audioAnalysisSchemaVersion: number;
  audioFeatureId: string;
  clone: (value: unknown) => unknown;
  foundation: LaboratoryHostFoundationRuntime;
  getFeatureProcessDir: (runtime: unknown, project: unknown, featureId: string) => string;
  getFeatureReportDir: (runtime: unknown, project: unknown, featureId: string) => string;
  getSubtitleAnalysisHostRuntime: () => LaboratorySubtitleAnalysisHostRuntime | null;
  markCloseoutAsStale: (project: LaboratoryRecord, reason: string, featureIds: string[]) => unknown;
  markFeatureProcessStale: (
    project: LaboratoryRecord,
    featureId: string,
    reason: string
  ) => unknown;
  markFeatureReportStale: (
    project: LaboratoryRecord,
    featureId: string,
    reason: string
  ) => unknown;
  mediaFeatureId: string;
  normalizeAudioAnalysisModuleResult: (
    rawValue: unknown,
    moduleId: string,
    catalogEntry: unknown
  ) => unknown;
  normalizeAudioAnalysisState: (rawValue: unknown, runtime: unknown) => unknown;
  projectRuntimes: LaboratoryHostProjectRuntimesRuntime;
  roomId: string;
  setProcessCoordinationRuntime: (
    value: LaboratoryProcessCompositionRuntime["laboratoryProcessCoordinationRuntime"]
  ) => void;
  setProjectStateRuntime: (value: LaboratoryProjectStateRuntime) => void;
  setSubtitleAnalysisHostRuntime: (
    value: LaboratoryFeatureAdaptersRuntime["laboratorySubtitleAnalysisHostRuntime"]
  ) => void;
  subtitleFeatureId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryHostFeatureRuntimes(deps: LaboratoryHostFeatureRuntimesDeps) {
  const { foundation, projectRuntimes } = deps;
  const { bootstrap, hostUtils, io, preset, profileModelState, subtitleDocument } = foundation;

  let sourceComposition: LaboratorySourceCompositionRuntime | null = null;

  const projectRecordsRuntime = projectRuntimes.stateComposition.laboratoryProjectRecordsRuntime;
  const projectStateDelegatesRuntime =
    projectRuntimes.stateComposition.laboratoryProjectStateDelegatesRuntime;

  function getActiveProject(
    ...args: Parameters<typeof projectRecordsRuntime.getActiveProject>
  ): ReturnType<typeof projectRecordsRuntime.getActiveProject> {
    return projectRecordsRuntime.getActiveProject(...args);
  }

  function syncProjectFeatureProjections(
    ...args: Parameters<typeof projectStateDelegatesRuntime.syncProjectFeatureProjections>
  ): ReturnType<typeof projectStateDelegatesRuntime.syncProjectFeatureProjections> {
    return projectStateDelegatesRuntime.syncProjectFeatureProjections(...args);
  }

  function requireSourceComposition(): LaboratorySourceCompositionRuntime {
    if (!sourceComposition) {
      throw new Error("sourceComposition not initialized");
    }
    return sourceComposition;
  }

  const mediaAnalysisDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    audioFeatureId: deps.audioFeatureId,
    buildSyntheticProfileSignal: projectRuntimes.analysisArtifact.buildSyntheticProfileSignal,
    callRoomTools: io.callRoomTools,
    clearJob: projectRuntimes.jobState.clearJob,
    clone: deps.clone,
    clampNumber: hostUtils.clampNumber,
    createDefaultEditState: preset.createDefaultEditState,
    createEmptyProfilePreflight: preset.createEmptyProfilePreflight,
    createProfileSignal: projectRuntimes.analysisArtifact.createProfileSignal,
    ensureEditJobSlotAvailable: projectRuntimes.jobRuntime.ensureEditJobSlotAvailable,
    ensureProfileJobSlotAvailable: projectRuntimes.jobRuntime.ensureProfileJobSlotAvailable,
    ensureProjectDirectories: io.ensureProjectDirectories,
    generateProfileFrameStrip: projectRuntimes.analysisArtifact.generateProfileFrameStrip,
    generateProfileMetadataArtifact:
      projectRuntimes.analysisArtifact.generateProfileMetadataArtifact,
    generateProfileSpectrogram: projectRuntimes.analysisArtifact.generateProfileSpectrogram,
    getActiveProject,
    getCollectDerivedOutputMetadata() {
      return requireSourceComposition().mediaSourceMetadataRuntime.collectDerivedOutputMetadata;
    },
    getFocusRegionCrop: preset.getFocusRegionCrop,
    getProfileFrameDensityRuntimeConfig:
      projectRuntimes.mediaProfileState.getProfileFrameDensityRuntimeConfig,
    getProjectEditDir,
    getProjectEditOutputDir,
    getProjectEditPreviewDir,
    getResizePresetMap: preset.getResizePresetMap,
    maybeRunWhisperProfileSample: projectRuntimes.analysisArtifact.maybeRunWhisperProfileSample,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    markProfileAsStale: projectRuntimes.mediaProfileState.markProfileAsStale,
    mergeObjects: preset.mergeObjects,
    normalizeEditOutput: preset.normalizeEditOutput,
    normalizeProfileArtifactPreferences:
      projectRuntimes.mediaProfileState.normalizeProfileArtifactPreferences,
    normalizeSourceMetadata: preset.normalizeSourceMetadata,
    patchActiveProject: projectRuntimes.lifecycle.patchActiveProject,
    pushJobState: projectRuntimes.snapshot.pushJobState,
    registerJob: projectRuntimes.jobState.registerJob,
    runAudioStructureProbe: foundation.audioAnalysisUtility.runAudioStructureProbe,
    runVideoStructureProbe: foundation.audioAnalysisUtility.runVideoStructureProbe,
    roomId: deps.roomId,
    syncProjectFeatureProjections,
    toRecord: deps.toRecord,
  } as unknown as Parameters<typeof createLaboratoryMediaAnalysisHostRuntime>[0];

  const mediaAnalysis = createLaboratoryMediaAnalysisHostRuntime(mediaAnalysisDeps);

  const processCompositionDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    audioAnalysisSchemaVersion: deps.audioAnalysisSchemaVersion,
    audioFeatureId: deps.audioFeatureId,
    buildDerivedTargetSignature: projectRuntimes.snapshot.buildDerivedTargetSignature,
    buildEmotionHeuristicFromProsody:
      foundation.audioAnalysisUtility.buildEmotionHeuristicFromProsody,
    buildProfileModelSummary: projectRuntimes.mediaProfileModel.buildProfileModelSummary,
    buildSourceTargetSignature: projectRuntimes.snapshot.buildSourceTargetSignature,
    clampProfileTranscriptSampleSeconds:
      projectRuntimes.mediaProfileState.clampProfileTranscriptSampleSeconds,
    clearJob: projectRuntimes.jobState.clearJob,
    clone: deps.clone,
    createEmptyFeatureProcessRecord:
      projectRuntimes.stateComposition.createEmptyFeatureProcessRecord,
    createEmptyFeatureReportRecord: projectRuntimes.stateComposition.createEmptyFeatureReportRecord,
    createProcessArtifact: projectRuntimes.analysisArtifact.createProcessArtifact,
    createProcessFinding: projectRuntimes.analysisArtifact.createProcessFinding,
    ensureEditToolReady: mediaAnalysis.ensureEditToolReady,
    ensureProcessJobSlotAvailable: projectRuntimes.jobRuntime.ensureProcessJobSlotAvailable,
    ensureProjectDirectories: io.ensureProjectDirectories,
    ensureReportJobSlotAvailable: projectRuntimes.jobRuntime.ensureReportJobSlotAvailable,
    ensureRuntimeDirectory: io.ensureRuntimeDirectory,
    findEditOutputById: projectRuntimes.snapshot.findEditOutputById,
    formatIdentifierLabel: projectRuntimes.analysisArtifact.formatIdentifierLabel,
    getActiveProject,
    getFeatureProcessDir: deps.getFeatureProcessDir,
    getFeatureProcessRecord: projectRuntimes.stateComposition.getFeatureProcessRecord,
    getFeatureReportDir: deps.getFeatureReportDir,
    getFeatureReportRecord: projectRuntimes.stateComposition.getFeatureReportRecord,
    getFindingSeverityRank: projectRuntimes.analysisArtifact.getFindingSeverityRank,
    getPreferredFeatureSourceKind: hostUtils.getPreferredFeatureSourceKind,
    getProjectSubtitleProcessDir,
    getStageSupport: bootstrap.getStageSupport,
    getSubtitleAnalysisHostRuntime: deps.getSubtitleAnalysisHostRuntime,
    getSubtitleSelectedEntries: projectRuntimes.stateComposition.getSubtitleSelectedEntries,
    getActiveSubtitleEntry: projectRuntimes.stateComposition.getActiveSubtitleEntry,
    getSubtitleMimeType: projectRuntimes.stateComposition.getSubtitleMimeType,
    getSubtitleAnalysisModuleDescriptors(runtime: unknown) {
      const runtimeRecord = deps.toRecord(runtime);
      const subtitleAnalysisCatalog = deps.toRecord(runtimeRecord["subtitleAnalysisCatalog"]);
      const modules = subtitleAnalysisCatalog["modules"];
      return Array.isArray(modules) ? modules.map(deps.toRecord) : [];
    },
    getToolManifest: bootstrap.getToolManifest,
    listDirectory: io.listDirectory,
    markFeatureReportStale: deps.markFeatureReportStale,
    maybeRunWhisperProfileSample: projectRuntimes.analysisArtifact.maybeRunWhisperProfileSample,
    mediaFeatureId: deps.mediaFeatureId,
    normalizeAudioAnalysisModuleResult: deps.normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisState: deps.normalizeAudioAnalysisState,
    normalizeEditOutput: preset.normalizeEditOutput,
    normalizeFeatureReportRecord: projectRuntimes.stateComposition.normalizeFeatureReportRecord,
    normalizeProcessArtifact: projectRuntimes.stateComposition.normalizeProcessArtifact,
    normalizeProcessFinding: projectRuntimes.stateComposition.normalizeProcessFinding,
    normalizeProcessModule: projectRuntimes.stateComposition.normalizeProcessModule,
    normalizeReportExport: projectRuntimes.stateComposition.normalizeReportExport,
    normalizeSourceMetadata: preset.normalizeSourceMetadata,
    normalizeStringArray: preset.normalizeStringArray,
    normalizeSubtitleAnalysisState: projectRuntimes.stateComposition.normalizeSubtitleAnalysisState,
    parseAspectralStatsText: foundation.audioAnalysisUtility.parseAspectralStatsText,
    patchActiveProject: projectRuntimes.lifecycle.patchActiveProject,
    pushJobState: projectRuntimes.snapshot.pushJobState,
    readJsonFile: io.readJsonFile,
    readTextFile: io.readTextFile,
    registerJob: projectRuntimes.jobState.registerJob,
    resolveOpenSmileProsodyRuntime: foundation.audioAnalysisUtility.resolveOpenSmileProsodyRuntime,
    resolveProfileTarget: projectRuntimes.profileProjection.resolveProfileTarget,
    runAudioStructureProbe: foundation.audioAnalysisUtility.runAudioStructureProbe,
    runOpenSmileProsodyExtraction: foundation.audioAnalysisUtility.runOpenSmileProsodyExtraction,
    runProfileTool: projectRuntimes.analysisArtifact.runProfileTool,
    runVideoStructureProbe: foundation.audioAnalysisUtility.runVideoStructureProbe,
    sanitizeFileSegment: mediaAnalysis.sanitizeFileSegment,
    setFeatureProcessRecord: projectRuntimes.stateComposition.setFeatureProcessRecord,
    setFeatureReportRecord: projectRuntimes.stateComposition.setFeatureReportRecord,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord,
    writeJsonFile: io.writeJsonFile,
    writeTextFile: io.writeTextFile,
  } as unknown as Parameters<typeof createLaboratoryHostProcessCompositionRuntime>[0];

  const processComposition = createLaboratoryHostProcessCompositionRuntime(
    processCompositionDeps
  ) as unknown as LaboratoryProcessCompositionRuntime;

  deps.setProcessCoordinationRuntime(processComposition.laboratoryProcessCoordinationRuntime);

  const sourceCompositionDeps = {
    asNumber: preset.asNumber,
    asNonEmptyString: deps.asNonEmptyString,
    callRoomTools: io.callRoomTools,
    cancelJobsForProject: projectRuntimes.jobState.cancelJobsForProject,
    clearJob: projectRuntimes.jobState.clearJob,
    ensureProjectDirectories: io.ensureProjectDirectories,
    getActiveProject,
    getElectronApi: io.getElectronApi,
    getProjectEditDir,
    getProjectSourceDir,
    getPresetDefaultCustomValues: preset.getPresetDefaultCustomValues,
    getSourceConfig: preset.getSourceConfig,
    normalizeSourceMetadata: preset.normalizeSourceMetadata,
    patchActiveProject: projectRuntimes.lifecycle.patchActiveProject,
    pushJobState: projectRuntimes.snapshot.pushJobState,
    registerJob: projectRuntimes.jobState.registerJob,
    resetEditForCurrentSource: mediaAnalysis.resetEditForCurrentSource,
    resetProfileForCurrentSource: projectRuntimes.mediaProfileState.resetProfileForCurrentSource,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  } as unknown as Parameters<typeof createLaboratorySourceCompositionRuntime>[0];

  sourceComposition = createLaboratorySourceCompositionRuntime(
    sourceCompositionDeps
  ) as unknown as LaboratorySourceCompositionRuntime;

  const roomToolsProgressDeps = {
    roomId: deps.roomId,
    asNonEmptyString: deps.asNonEmptyString,
    toRecord: deps.toRecord,
    getElectronApi: io.getElectronApi,
    pushJobState: projectRuntimes.snapshot.pushJobState,
    pushSourceState: projectRuntimes.snapshot.pushSourceState,
  } as unknown as Parameters<typeof createLaboratoryRoomToolsProgressRuntime>[0];

  const roomToolsProgress = createLaboratoryRoomToolsProgressRuntime(
    roomToolsProgressDeps
  ) as unknown as LaboratoryRoomToolsProgressRuntime;

  const runtimeStorageDeps = {
    lifecycleRuntime: projectRuntimes.lifecycle,
    profileModelRuntime: projectRuntimes.mediaProfileModel,
    toRecord: deps.toRecord,
  } as unknown as Parameters<typeof createLaboratoryRuntimeStorage>[0];

  const runtimeStorage = createLaboratoryRuntimeStorage(
    runtimeStorageDeps
  ) as unknown as LaboratoryRuntimeStorageRuntime;

  const projectStateDeps = {
    roomSnapshotRuntime: projectRuntimes.snapshot.laboratoryRoomSnapshotRuntime,
    runtimeStorage: {
      ...runtimeStorage,
      getFeatureProcessRecord(project: Record<string, unknown>, featureId: string) {
        return projectRuntimes.stateComposition.getFeatureProcessRecord(project, featureId);
      },
      getFeatureReportRecord(project: Record<string, unknown>, featureId: string) {
        return projectRuntimes.stateComposition.getFeatureReportRecord(project, featureId);
      },
      getProfileModelDescriptor(runtime: unknown, modelId: string) {
        return runtimeStorage.getProfileModelDescriptor(
          runtime as Parameters<typeof runtimeStorage.getProfileModelDescriptor>[0],
          modelId
        );
      },
      getProfileModelDescriptorMap(runtime: unknown) {
        return runtimeStorage.getProfileModelDescriptorMap(
          runtime as Parameters<typeof runtimeStorage.getProfileModelDescriptorMap>[0]
        );
      },
      persistProfileModelState(runtime: unknown) {
        return runtimeStorage.persistProfileModelState(
          runtime as Parameters<typeof runtimeStorage.persistProfileModelState>[0]
        );
      },
      persistToolState(runtime: unknown) {
        return runtimeStorage.persistToolState(
          runtime as Parameters<typeof runtimeStorage.persistToolState>[0]
        );
      },
      refreshProfileModelState(runtime: unknown) {
        return runtimeStorage.refreshProfileModelState(
          runtime as Parameters<typeof runtimeStorage.refreshProfileModelState>[0]
        );
      },
    },
    syncProjectAudioAnalysisProjection(runtime: unknown, project: Record<string, unknown>) {
      return processComposition.syncProjectAudioAnalysisProjection(
        runtime as Parameters<typeof processComposition.syncProjectAudioAnalysisProjection>[0],
        project
      );
    },
    syncProjectProfileProjection: projectRuntimes.profileProjection.syncProjectProfileProjection,
    syncProjectSubtitleAnalysisProjection:
      projectRuntimes.stateComposition.syncProjectSubtitleAnalysisProjection,
    toFileUrl: hostUtils.toFileUrl,
  } as unknown as Parameters<typeof createLaboratoryProjectStateRuntime>[0];

  const projectState = createLaboratoryProjectStateRuntime(
    projectStateDeps
  ) as unknown as LaboratoryProjectStateRuntime;

  deps.setProjectStateRuntime(projectState);

  const sourceCompositionRuntime = requireSourceComposition();
  const processCompositionRecord = deps.toRecord(processComposition as unknown);
  const processDelegates = processCompositionRecord[
    "laboratoryProcessDelegatesRuntime"
  ] as LaboratoryProcessDelegatesRuntime | null;
  if (!processDelegates) throw new Error("laboratoryProcessDelegatesRuntime not initialized");

  const featureAdaptersDeps = {
    applyEditRecipePatch: mediaAnalysis.applyEditRecipePatch,
    applyProfilePresetPatch: projectRuntimes.mediaProfileState.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    audioFeatureId: deps.audioFeatureId,
    buildSubtitleEditSummary: subtitleDocument.buildSubtitleEditSummary,
    callRoomTools: io.callRoomTools,
    cancelEditJobsForProject: projectRuntimes.jobRuntime.cancelEditJobsForProject,
    cancelFeatureProcess: processDelegates.cancelFeatureProcess,
    cancelProfileJobsForProject: projectRuntimes.jobRuntime.cancelProfileJobsForProject,
    clampNumber: hostUtils.clampNumber,
    clampProfileTranscriptSampleSeconds:
      projectRuntimes.mediaProfileState.clampProfileTranscriptSampleSeconds,
    clearJob: projectRuntimes.jobState.clearJob,
    createDefaultEditState: preset.createDefaultEditState,
    createDefaultToolEntry: bootstrap.createDefaultToolEntry,
    createEmptySubtitleDiscoveryState:
      projectRuntimes.stateComposition.createEmptySubtitleDiscoveryState,
    createProject: projectRuntimes.lifecycle.createProject,
    createRequestId: projectRuntimes.jobState.createRequestId,
    createSubtitleEntryRecord: projectRuntimes.stateComposition.createSubtitleEntryRecord,
    ensureHydrated: projectRuntimes.lifecycle.ensureHydrated,
    ensureProjectDirectories: io.ensureProjectDirectories,
    ensureProjectExists: projectRuntimes.lifecycle.ensureProjectExists,
    exportFeatureReport: processDelegates.exportFeatureReport,
    findEditPreset: mediaAnalysis.findEditPreset,
    findProfilePreset: preset.findProfilePreset,
    formatIdentifierLabel: projectRuntimes.analysisArtifact.formatIdentifierLabel,
    getActiveProject,
    getActiveSubtitleEntry: projectRuntimes.stateComposition.getActiveSubtitleEntry,
    getDefaultMode: preset.getDefaultMode,
    getDefaultSourceType: preset.getDefaultSourceType,
    getDefaultSubtitleEditPresetId: projectRuntimes.stateComposition.getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe: projectRuntimes.stateComposition.getDefaultSubtitleEditRecipe,
    getElectronApi: io.getElectronApi,
    getFeatureIdFromContext: bootstrap.getFeatureIdFromContext,
    getProfileModelDescriptorMap: profileModelState.readProfileModelDescriptorMap,
    getProjectSubtitleEditOutputDir,
    getRuntimeToolIds: bootstrap.getRuntimeToolIds,
    getSubtitleEntries: projectRuntimes.stateComposition.getSubtitleEntries,
    getSubtitleMimeType: projectRuntimes.stateComposition.getSubtitleMimeType,
    handleLocalPick: sourceCompositionRuntime.laboratorySourceDelegatesRuntime.handleLocalPick,
    handleUrlDownload: sourceCompositionRuntime.laboratorySourceDelegatesRuntime.handleUrlDownload,
    handleYoutubeDownload:
      sourceCompositionRuntime.laboratorySourceDelegatesRuntime.handleYoutubeDownload,
    installProfileModel: projectRuntimes.mediaProfileModel.installProfileModel,
    isSubtitleFileName: projectRuntimes.stateComposition.isSubtitleFileName,
    listDirectory: io.listDirectory,
    loadContext: bootstrap.loadContext,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    markFeatureProcessStale: deps.markFeatureProcessStale,
    markFeatureReportStale: deps.markFeatureReportStale,
    markProfileAsStale: projectRuntimes.mediaProfileState.markProfileAsStale,
    mergeObjects: preset.mergeObjects,
    normalizeProcessModule: projectRuntimes.stateComposition.normalizeProcessModule,
    normalizeProfileArtifactPreferences:
      projectRuntimes.mediaProfileState.normalizeProfileArtifactPreferences,
    normalizeStringArray: preset.normalizeStringArray,
    normalizeSubtitleAnalysisState: projectRuntimes.stateComposition.normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem: projectRuntimes.stateComposition.normalizeSubtitleDiscoveryItem,
    normalizeSubtitleOutputRecord: projectRuntimes.stateComposition.normalizeSubtitleOutputRecord,
    parseSubtitleCues: subtitleDocument.parseSubtitleCues,
    patchActiveProject: projectRuntimes.lifecycle.patchActiveProject,
    patchActiveProjectDrafts: projectRuntimes.lifecycle.patchActiveProjectDrafts,
    persistProfileModelState: runtimeStorage.persistProfileModelState,
    persistToolState: profileModelState.saveToolState,
    pushActionResult: projectRuntimes.snapshot.pushActionResult,
    pushJobState: projectRuntimes.snapshot.pushJobState,
    pushMediaState: projectRuntimes.snapshot.pushMediaState,
    readTextFile: io.readTextFile,
    refreshActiveProjectMetadata:
      sourceCompositionRuntime.mediaSourceMetadataRuntime.refreshActiveProjectMetadata,
    refreshProfileModelState: profileModelState.reloadProfileModelState,
    refreshToolStatus: projectRuntimes.lifecycle.refreshToolStatus,
    registerJob: projectRuntimes.jobState.registerJob,
    removeProfileModel: projectRuntimes.mediaProfileModel.removeProfileModel,
    resetEditForCurrentSource: mediaAnalysis.resetEditForCurrentSource,
    resetProfileForCurrentSource: projectRuntimes.mediaProfileState.resetProfileForCurrentSource,
    resetSubtitleDiscovery: projectRuntimes.stateComposition.resetSubtitleDiscovery,
    resolveSubtitleOutputFormat: subtitleDocument.resolveSubtitleOutputFormat,
    roomId: deps.roomId,
    runEditPipeline: mediaAnalysis.runEditPipeline,
    runFeatureProcess: processDelegates.runFeatureProcess,
    runProfilePreflight: mediaAnalysis.runProfilePreflight,
    sanitizeFileSegment: mediaAnalysis.sanitizeFileSegment,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord,
    transformSubtitleDocument: subtitleDocument.transformSubtitleDocument,
    upsertSubtitleEntries: projectRuntimes.stateComposition.upsertSubtitleEntries,
    writeTextFile: io.writeTextFile,
  } as unknown as Parameters<typeof createLaboratoryFeatureAdapters>[0];

  const featureAdapters = createLaboratoryFeatureAdapters(
    featureAdaptersDeps
  ) as unknown as LaboratoryFeatureAdaptersRuntime;

  deps.setSubtitleAnalysisHostRuntime(featureAdapters.laboratorySubtitleAnalysisHostRuntime);

  return {
    featureAdapters,
    mediaAnalysis,
    processComposition,
    projectState,
    roomToolsProgress,
    runtimeStorage,
    sourceComposition: sourceCompositionRuntime,
  };
}
