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
  const projectRecordsRuntime = projectRuntimes.stateComposition.laboratoryProjectRecordsRuntime;
  const projectStateDelegatesRuntime = projectRuntimes.stateComposition.laboratoryProjectStateDelegatesRuntime;
  function getActiveProject(...args) {
    return projectRecordsRuntime.getActiveProject(...args);
  }
  function syncProjectFeatureProjections(...args) {
    return projectStateDelegatesRuntime.syncProjectFeatureProjections(...args);
  }
  function requireSourceComposition() {
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
    clampProfileTranscriptSampleSeconds: projectRuntimes.mediaProfileState.clampProfileTranscriptSampleSeconds,
    createDefaultEditState: preset.createDefaultEditState,
    createEmptyProfilePreflight: preset.createEmptyProfilePreflight,
    createProfileSignal: projectRuntimes.analysisArtifact.createProfileSignal,
    ensureEditJobSlotAvailable: projectRuntimes.jobRuntime.ensureEditJobSlotAvailable,
    ensureProfileJobSlotAvailable: projectRuntimes.jobRuntime.ensureProfileJobSlotAvailable,
    ensureProjectDirectories: io.ensureProjectDirectories,
    generateProfileFrameStrip: projectRuntimes.analysisArtifact.generateProfileFrameStrip,
    generateProfileMetadataArtifact: projectRuntimes.analysisArtifact.generateProfileMetadataArtifact,
    generateProfileSpectrogram: projectRuntimes.analysisArtifact.generateProfileSpectrogram,
    getActiveProject,
    getCollectDerivedOutputMetadata() {
      return requireSourceComposition().mediaSourceMetadataRuntime.collectDerivedOutputMetadata;
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
    syncProjectFeatureProjections,
    toRecord: deps.toRecord
  };
  const mediaAnalysis = createLaboratoryMediaAnalysisHostRuntime(mediaAnalysisDeps);
  const processCompositionDeps = {
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
    getSubtitleAnalysisModuleDescriptors(runtime) {
      const runtimeRecord = deps.toRecord(runtime);
      const subtitleAnalysisCatalog = deps.toRecord(runtimeRecord["subtitleAnalysisCatalog"]);
      const modules = subtitleAnalysisCatalog["modules"];
      return Array.isArray(modules) ? modules.map(deps.toRecord) : [];
    },
    getToolManifest: bootstrap.getToolManifest,
    generateProcessMetadataArtifact: projectRuntimes.analysisArtifact.generateProcessMetadataArtifact,
    generateProcessFramePreviewArtifact: projectRuntimes.analysisArtifact.generateProcessFramePreviewArtifact,
    generateProcessVisualTransformArtifact: projectRuntimes.analysisArtifact.generateProcessVisualTransformArtifact,
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
    getVisualAnalysisCapabilityState(runtime, sourceKind) {
      return mediaAnalysis.visualAnalysisRuntime.buildVisualAnalysisCapabilityState(
        deps.toRecord(runtime),
        sourceKind
      );
    },
    getVisualAnalysisModulesForRuntime(runtime, sourceKind) {
      return mediaAnalysis.visualAnalysisRuntime.getVisualAnalysisModulesForRuntime(
        deps.toRecord(runtime),
        sourceKind || null
      );
    },
    getVisualAnalysisProviderState(runtime) {
      return mediaAnalysis.visualAnalysisRuntime.buildVisualAnalysisProviderState(
        deps.toRecord(runtime)
      );
    },
    partitionVisualAnalysisModuleIds(runtime, moduleIds) {
      return mediaAnalysis.visualAnalysisRuntime.partitionVisualAnalysisModuleIds(
        deps.toRecord(runtime),
        moduleIds
      );
    },
    resolveEnabledVisualAnalysisModuleIds(runtime, project, sourceKind, workbenchSource) {
      return mediaAnalysis.visualAnalysisRuntime.resolveEnabledVisualAnalysisModuleIds(
        deps.toRecord(runtime),
        deps.toRecord(project),
        sourceKind,
        workbenchSource
      );
    },
    setFeatureProcessRecord: projectRuntimes.stateComposition.setFeatureProcessRecord,
    setFeatureReportRecord: projectRuntimes.stateComposition.setFeatureReportRecord,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord,
    writeJsonFile: io.writeJsonFile,
    writeTextFile: io.writeTextFile
  };
  const processComposition = createLaboratoryHostProcessCompositionRuntime(
    processCompositionDeps
  );
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
    toRecord: deps.toRecord
  };
  sourceComposition = createLaboratorySourceCompositionRuntime(
    sourceCompositionDeps
  );
  const roomToolsProgressDeps = {
    roomId: deps.roomId,
    asNonEmptyString: deps.asNonEmptyString,
    toRecord: deps.toRecord,
    emitEvent: projectRuntimes.snapshot.emitEvent,
    getElectronApi: io.getElectronApi,
    pushJobState: projectRuntimes.snapshot.pushJobState,
    pushSourceState: projectRuntimes.snapshot.pushSourceState
  };
  const roomToolsProgress = createLaboratoryRoomToolsProgressRuntime(
    roomToolsProgressDeps
  );
  const runtimeStorageDeps = {
    lifecycleRuntime: projectRuntimes.lifecycle,
    profileModelRuntime: projectRuntimes.mediaProfileModel,
    toRecord: deps.toRecord
  };
  const runtimeStorage = createLaboratoryRuntimeStorage(
    runtimeStorageDeps
  );
  const projectStateDeps = {
    roomSnapshotRuntime: projectRuntimes.snapshot.laboratoryRoomSnapshotRuntime,
    runtimeStorage: {
      ...runtimeStorage,
      getFeatureProcessRecord(project, featureId) {
        return projectRuntimes.stateComposition.getFeatureProcessRecord(project, featureId);
      },
      getFeatureReportRecord(project, featureId) {
        return projectRuntimes.stateComposition.getFeatureReportRecord(project, featureId);
      },
      getProfileModelDescriptor(runtime, modelId) {
        return runtimeStorage.getProfileModelDescriptor(
          runtime,
          modelId
        );
      },
      getProfileModelDescriptorMap(runtime) {
        return runtimeStorage.getProfileModelDescriptorMap(
          runtime
        );
      },
      persistProfileModelState(runtime) {
        return runtimeStorage.persistProfileModelState(
          runtime
        );
      },
      persistToolState(runtime) {
        return runtimeStorage.persistToolState(
          runtime
        );
      },
      refreshProfileModelState(runtime) {
        return runtimeStorage.refreshProfileModelState(
          runtime
        );
      }
    },
    syncProjectAudioAnalysisProjection(runtime, project) {
      return processComposition.syncProjectAudioAnalysisProjection(
        runtime,
        project
      );
    },
    syncProjectProfileProjection: projectRuntimes.profileProjection.syncProjectProfileProjection,
    syncProjectSubtitleAnalysisProjection: projectRuntimes.stateComposition.syncProjectSubtitleAnalysisProjection,
    toFileUrl: hostUtils.toFileUrl
  };
  const projectState = createLaboratoryProjectStateRuntime(
    projectStateDeps
  );
  deps.setProjectStateRuntime(projectState);
  const sourceCompositionRuntime = requireSourceComposition();
  const processCompositionRecord = deps.toRecord(processComposition);
  const processDelegates = processCompositionRecord["laboratoryProcessDelegatesRuntime"];
  if (!processDelegates) throw new Error("laboratoryProcessDelegatesRuntime not initialized");
  const featureAdaptersDeps = {
    applyEditRecipePatch: mediaAnalysis.applyEditRecipePatch,
    applyProfilePresetPatch: projectRuntimes.mediaProfileState.applyProfilePresetPatch,
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    audioFeatureId: deps.audioFeatureId,
    buildSubtitleEditSummary: subtitleDocument.buildSubtitleEditSummary,
    callRoomTools: io.callRoomTools,
    cancelJobById: projectRuntimes.jobRuntime.cancelJobById,
    cancelEditJobsForProject: projectRuntimes.jobRuntime.cancelEditJobsForProject,
    cancelFeatureProcess: processDelegates.cancelFeatureProcess,
    cancelJobsForProject: projectRuntimes.jobState.cancelJobsForProject,
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
    deleteProject: projectRuntimes.lifecycle.deleteProject,
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
    getProjectEditDir,
    getProjectEditOutputDir,
    getProjectSourceDir,
    getProjectSubtitleEditOutputDir,
    getRuntimeToolIds: bootstrap.getRuntimeToolIds,
    getSubtitleEntries: projectRuntimes.stateComposition.getSubtitleEntries,
    getSubtitleMimeType: projectRuntimes.stateComposition.getSubtitleMimeType,
    handleLocalPick: sourceCompositionRuntime.laboratorySourceDelegatesRuntime.handleLocalPick,
    handleUrlDownload: sourceCompositionRuntime.laboratorySourceDelegatesRuntime.handleUrlDownload,
    handleYoutubeDownload: sourceCompositionRuntime.laboratorySourceDelegatesRuntime.handleYoutubeDownload,
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
    refreshActiveProjectMetadata: sourceCompositionRuntime.mediaSourceMetadataRuntime.refreshActiveProjectMetadata,
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
    writeTextFile: io.writeTextFile
  };
  const featureAdapters = createLaboratoryFeatureAdapters(
    featureAdaptersDeps
  );
  deps.setSubtitleAnalysisHostRuntime(featureAdapters.laboratorySubtitleAnalysisHostRuntime);
  return {
    featureAdapters,
    mediaAnalysis,
    processComposition,
    projectState,
    roomToolsProgress,
    runtimeStorage,
    sourceComposition: sourceCompositionRuntime
  };
}
