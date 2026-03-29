import {
  getProjectEditDir,
  getProjectEditOutputDir,
  getProjectEditPreviewDir,
  getProjectSourceDir,
  getProjectSubtitleEditOutputDir,
  getProjectSubtitleProcessDir
} from "../shared/host/project-paths.js";
import { createLaboratoryProjectStateRuntime } from "../shared/host/project-state.js";
import { createLaboratoryRoomToolsProgressRuntime } from "../shared/host/room-tools-progress.js";
import { createLaboratoryRuntimeStorage } from "../shared/host/runtime-storage.js";
import { createLaboratorySourceCompositionRuntime } from "../shared/host/source-composition.js";
import { createLaboratoryHostProcessCompositionRuntime } from "../shared/host/process-composition.js";
import { createLaboratoryMediaAnalysisHostRuntime } from "../main-functions/media-analysis/host/runtime.js";
import { createLaboratoryFeatureAdapters } from "./feature-adapters.js";
export function createLaboratoryHostFeatureRuntimes(deps) {
  const { foundation, projectRuntimes } = deps;
  const { bootstrap, hostUtils, io, preset, profileModelState, subtitleDocument } = foundation;
  let sourceComposition = null;
  const mediaAnalysis = createLaboratoryMediaAnalysisHostRuntime({
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
    generateProfileMetadataArtifact: projectRuntimes.analysisArtifact.generateProfileMetadataArtifact,
    generateProfileSpectrogram: projectRuntimes.analysisArtifact.generateProfileSpectrogram,
    getActiveProject(...args) {
      return projectRuntimes.stateComposition.laboratoryProjectRecordsRuntime.getActiveProject(...args);
    },
    getCollectDerivedOutputMetadata() {
      return sourceComposition.mediaSourceMetadataRuntime.collectDerivedOutputMetadata;
    },
    getFocusRegionCrop: preset.getFocusRegionCrop,
    getProfileFrameDensityRuntimeConfig: projectRuntimes.mediaProfileState.getProfileFrameDensityRuntimeConfig,
    getProjectEditDir,
    getProjectEditOutputDir,
    getProjectEditPreviewDir,
    getResizePresetMap: preset.getResizePresetMap,
    maybeRunWhisperProfileSample: projectRuntimes.analysisArtifact.maybeRunWhisperProfileSample,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    markProfileAsStale: projectRuntimes.mediaProfileState.markProfileAsStale,
    mergeObjects: preset.mergeObjects,
    normalizeEditOutput: preset.normalizeEditOutput,
    normalizeProfileArtifactPreferences: projectRuntimes.mediaProfileState.normalizeProfileArtifactPreferences,
    normalizeSourceMetadata: preset.normalizeSourceMetadata,
    patchActiveProject: projectRuntimes.lifecycle.patchActiveProject,
    pushJobState: projectRuntimes.snapshot.pushJobState,
    registerJob: projectRuntimes.jobState.registerJob,
    runAudioStructureProbe: foundation.audioAnalysisUtility.runAudioStructureProbe,
    runVideoStructureProbe: foundation.audioAnalysisUtility.runVideoStructureProbe,
    roomId: deps.roomId,
    syncProjectFeatureProjections(runtime, project) {
      return projectRuntimes.stateComposition.laboratoryProjectStateDelegatesRuntime.syncProjectFeatureProjections(
        runtime,
        project
      );
    },
    toRecord: deps.toRecord
  });
  const processComposition = createLaboratoryHostProcessCompositionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    audioAnalysisSchemaVersion: deps.audioAnalysisSchemaVersion,
    audioFeatureId: deps.audioFeatureId,
    buildDerivedTargetSignature: projectRuntimes.snapshot.buildDerivedTargetSignature,
    buildEmotionHeuristicFromProsody: foundation.audioAnalysisUtility.buildEmotionHeuristicFromProsody,
    buildProfileModelSummary: projectRuntimes.mediaProfileModel.buildProfileModelSummary,
    buildSourceTargetSignature: projectRuntimes.snapshot.buildSourceTargetSignature,
    clampProfileTranscriptSampleSeconds: projectRuntimes.mediaProfileState.clampProfileTranscriptSampleSeconds,
    clearJob: projectRuntimes.jobState.clearJob,
    clone: deps.clone,
    createEmptyFeatureProcessRecord: projectRuntimes.stateComposition.createEmptyFeatureProcessRecord,
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
    getActiveProject(...args) {
      return projectRuntimes.stateComposition.laboratoryProjectRecordsRuntime.getActiveProject(...args);
    },
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
    getSubtitleAnalysisModuleDescriptors(runtime) {
      const modules = deps.toRecord(deps.toRecord(runtime).subtitleAnalysisCatalog).modules;
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
    writeTextFile: io.writeTextFile
  });
  deps.setProcessCoordinationRuntime(processComposition.laboratoryProcessCoordinationRuntime);
  sourceComposition = createLaboratorySourceCompositionRuntime({
    asNumber: preset.asNumber,
    asNonEmptyString: deps.asNonEmptyString,
    callRoomTools: io.callRoomTools,
    cancelJobsForProject: projectRuntimes.jobState.cancelJobsForProject,
    clearJob: projectRuntimes.jobState.clearJob,
    ensureProjectDirectories: io.ensureProjectDirectories,
    getActiveProject(...args) {
      return projectRuntimes.stateComposition.laboratoryProjectRecordsRuntime.getActiveProject(...args);
    },
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
    toRecord: deps.toRecord
  });
  const roomToolsProgress = createLaboratoryRoomToolsProgressRuntime({
    roomId: deps.roomId,
    asNonEmptyString: deps.asNonEmptyString,
    toRecord: deps.toRecord,
    getElectronApi: io.getElectronApi,
    pushJobState: projectRuntimes.snapshot.pushJobState,
    pushSourceState: projectRuntimes.snapshot.pushSourceState
  });
  const runtimeStorage = createLaboratoryRuntimeStorage({
    lifecycleRuntime: projectRuntimes.lifecycle,
    profileModelRuntime: projectRuntimes.mediaProfileModel,
    toRecord: deps.toRecord
  });
  const projectState = createLaboratoryProjectStateRuntime({
    roomSnapshotRuntime: projectRuntimes.snapshot.laboratoryRoomSnapshotRuntime,
    runtimeStorage: {
      ...runtimeStorage,
      getFeatureProcessRecord: projectRuntimes.stateComposition.getFeatureProcessRecord,
      getFeatureReportRecord: projectRuntimes.stateComposition.getFeatureReportRecord
    },
    syncProjectAudioAnalysisProjection: processComposition.syncProjectAudioAnalysisProjection,
    syncProjectProfileProjection: projectRuntimes.profileProjection.syncProjectProfileProjection,
    syncProjectSubtitleAnalysisProjection: projectRuntimes.stateComposition.syncProjectSubtitleAnalysisProjection,
    toFileUrl: hostUtils.toFileUrl
  });
  deps.setProjectStateRuntime(projectState);
  const featureAdapters = createLaboratoryFeatureAdapters({
    applyEditRecipePatch: mediaAnalysis.applyEditRecipePatch,
    applyProfilePresetPatch: projectRuntimes.mediaProfileState.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    audioFeatureId: deps.audioFeatureId,
    buildSubtitleEditSummary: subtitleDocument.buildSubtitleEditSummary,
    callRoomTools: io.callRoomTools,
    cancelEditJobsForProject: projectRuntimes.jobRuntime.cancelEditJobsForProject,
    cancelFeatureProcess: processComposition.laboratoryProcessDelegatesRuntime.cancelFeatureProcess,
    cancelProfileJobsForProject: projectRuntimes.jobRuntime.cancelProfileJobsForProject,
    clampNumber: hostUtils.clampNumber,
    clampProfileTranscriptSampleSeconds: projectRuntimes.mediaProfileState.clampProfileTranscriptSampleSeconds,
    clearJob: projectRuntimes.jobState.clearJob,
    createDefaultEditState: preset.createDefaultEditState,
    createDefaultToolEntry: bootstrap.createDefaultToolEntry,
    createEmptySubtitleDiscoveryState: projectRuntimes.stateComposition.createEmptySubtitleDiscoveryState,
    createProject: projectRuntimes.lifecycle.createProject,
    createRequestId: projectRuntimes.jobState.createRequestId,
    createSubtitleEntryRecord: projectRuntimes.stateComposition.createSubtitleEntryRecord,
    ensureHydrated: projectRuntimes.lifecycle.ensureHydrated,
    ensureProjectDirectories: io.ensureProjectDirectories,
    ensureProjectExists: projectRuntimes.lifecycle.ensureProjectExists,
    exportFeatureReport: processComposition.laboratoryProcessDelegatesRuntime.exportFeatureReport,
    findEditPreset: mediaAnalysis.findEditPreset,
    findProfilePreset: preset.findProfilePreset,
    formatIdentifierLabel: projectRuntimes.analysisArtifact.formatIdentifierLabel,
    getActiveProject(...args) {
      return projectRuntimes.stateComposition.laboratoryProjectRecordsRuntime.getActiveProject(...args);
    },
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
    handleLocalPick: sourceComposition.laboratorySourceDelegatesRuntime.handleLocalPick,
    handleUrlDownload: sourceComposition.laboratorySourceDelegatesRuntime.handleUrlDownload,
    handleYoutubeDownload: sourceComposition.laboratorySourceDelegatesRuntime.handleYoutubeDownload,
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
    normalizeProfileArtifactPreferences: projectRuntimes.mediaProfileState.normalizeProfileArtifactPreferences,
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
    refreshActiveProjectMetadata: sourceComposition.mediaSourceMetadataRuntime.refreshActiveProjectMetadata,
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
    runFeatureProcess: processComposition.laboratoryProcessDelegatesRuntime.runFeatureProcess,
    runProfilePreflight: mediaAnalysis.runProfilePreflight,
    sanitizeFileSegment: mediaAnalysis.sanitizeFileSegment,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord,
    transformSubtitleDocument: subtitleDocument.transformSubtitleDocument,
    upsertSubtitleEntries: projectRuntimes.stateComposition.upsertSubtitleEntries,
    writeTextFile: io.writeTextFile
  });
  deps.setSubtitleAnalysisHostRuntime(featureAdapters.laboratorySubtitleAnalysisHostRuntime);
  return {
    featureAdapters,
    mediaAnalysis,
    processComposition,
    projectState,
    roomToolsProgress,
    runtimeStorage,
    sourceComposition
  };
}
