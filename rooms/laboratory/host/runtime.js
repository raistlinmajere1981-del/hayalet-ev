import {
  getAudioAnalysisDiarizationDir,
  getAudioAnalysisDiarizationScriptPath,
  getAudioAnalysisMusicDir,
  getAudioAnalysisMusicScriptPath,
  getAudioAnalysisOpenSmileConfigDir,
  getAudioAnalysisOpenSmileConfigPath,
  getAudioAnalysisProcessRootDir,
  getAudioAnalysisYamnetDir,
  getAudioAnalysisYamnetScriptPath,
  getProfileModelStatePath,
  getProfileModelsDir,
  getProjectDir,
  getProjectDirectoryFallbackMarkerList,
  getProjectDirectoryList,
  getProjectEditDir,
  getProjectEditManifestPath,
  getProjectEditOutputDir,
  getProjectEditPreviewDir,
  getProjectMetaPath,
  getProjectProcessManifestPath,
  getProjectProfileDir,
  getProjectProfileManifestPath,
  getProjectProfilePreflightDir,
  getProjectReportManifestPath,
  getProjectSourceDir,
  getProjectSubtitleEditOutputDir,
  getProjectSubtitleProcessDir,
  getProjectSubtitleSourceDir,
} from "../shared/host/project-paths.js";
import { createLaboratoryProjectLifecycleRuntime } from "../shared/host/project-lifecycle.js";
import { createLaboratoryProjectStateRuntime } from "../shared/host/project-state.js";
import { createLaboratoryActionCompositionRuntime } from "../shared/host/action-composition.js";
import { createLaboratoryHostUtils } from "../shared/host/host-utils.js";
import { createLaboratoryHostIoRuntime } from "../shared/host/io-runtime.js";
import { createLaboratoryRuntimeBootstrap } from "../shared/host/runtime-bootstrap.js";
import { createLaboratoryHostActivation } from "../shared/host/activation.js";
import { createLaboratoryAnalysisArtifactRuntime } from "../shared/host/analysis-artifact-runtime.js";
import { createLaboratoryJobRuntime } from "../shared/host/job-runtime.js";
import { createLaboratoryPresetRuntime } from "../shared/host/preset-runtime.js";
import { createLaboratoryProfileModelStateRuntime } from "../shared/host/profile-model-state.js";
import { createLaboratoryRoomToolsProgressRuntime } from "../shared/host/room-tools-progress.js";
import { createLaboratoryRuntimeStorage } from "../shared/host/runtime-storage.js";
import { createLaboratorySnapshotCompositionRuntime } from "../shared/host/snapshot-composition.js";
import { createLaboratorySourceCompositionRuntime } from "../shared/host/source-composition.js";
import { createLaboratoryHostStateCompositionRuntime } from "../shared/host/state-composition.js";
import { createLaboratoryJobStateRuntime } from "../shared/host/job-state.js";
import { createLaboratoryHostProcessCompositionRuntime } from "../shared/host/process-composition.js";
import {
  LABORATORY_AUDIO_FEATURE_ID as AUDIO_FEATURE_ID,
  LABORATORY_FEATURE_IDS as FEATURE_IDS,
  LABORATORY_FEATURE_NAMESPACES as FEATURE_NAMESPACES,
  LABORATORY_MEDIA_FEATURE_ID as FEATURE_ID,
  LABORATORY_MEDIA_STAGES as MEDIA_STAGES,
  LABORATORY_ROOM_ID as ROOM_ID,
  LABORATORY_SUBTITLE_FEATURE_ID as SUBTITLE_FEATURE_ID,
  cloneLaboratoryValue as clone,
  getLaboratoryFeatureProcessDir as getFeatureProcessDir,
  getLaboratoryFeatureReportDir as getFeatureReportDir,
  getLaboratoryProjectProcessDir as getProjectProcessDir,
  getLaboratoryProjectReportDir as getProjectReportDir,
  normalizeLaboratoryLocale as normalizeLocale,
  readNonEmptyString as asNonEmptyString,
  toLaboratoryRecord as toRecord,
} from "../shared/host/runtime-primitives.js";
import { createLaboratoryMediaAnalysisHostRuntime } from "../main-functions/media-analysis/host/runtime.js";
import { createMediaProfileModelRuntime } from "../main-functions/media-analysis/host/profile-models.js";
import { createMediaProfileProjectionRuntime } from "../main-functions/media-analysis/host/profile-projection.js";
import { createMediaProfileStateRuntime } from "../main-functions/media-analysis/host/profile-state.js";
import { createAudioAnalysisUtilityRuntime } from "../main-functions/audio-analysis/host/analysis-utils.js";
import { createSubtitleDocumentRuntime } from "../main-functions/subtitle-analysis/host/document-runtime.js";
import { createLaboratorySubtitleAnalysisHostRuntime } from "../main-functions/subtitle-analysis/host/runtime.js";

const AUDIO_ANALYSIS_SCHEMA_VERSION = 1;
const PROJECT_SCHEMA_VERSION = 1;

let laboratoryProjectStateRuntime = null;
let laboratoryProcessCoordinationRuntime = null;
let laboratoryCloseoutStalenessRuntime = null;
let laboratorySubtitleAnalysisHostRuntime = null;

function markFeatureProcessStale(project, featureId, reason) {
  return laboratoryCloseoutStalenessRuntime.markFeatureProcessStale(project, featureId, reason);
}

function markFeatureReportStale(project, featureId, reason) {
  return laboratoryCloseoutStalenessRuntime.markFeatureReportStale(project, featureId, reason);
}

function markCloseoutAsStale(project, reason, featureIds) {
  return laboratoryCloseoutStalenessRuntime.markCloseoutAsStale(project, reason, featureIds);
}
const laboratoryRuntimeBootstrap = createLaboratoryRuntimeBootstrap({
  defaultFeatureId: FEATURE_ID,
  normalizeLocale,
  roomId: ROOM_ID,
  toRecord,
});
const {
  createDefaultProfileModelEntry,
  createDefaultToolEntry,
  createDefaultToolState,
  createRuntimeState,
  getFeatureIdFromContext,
  getRuntimeToolIds,
  getStageSupport,
  getToolManifest,
  loadContext,
  sanitizeContext,
  saveContext,
} = laboratoryRuntimeBootstrap;

const laboratoryProfileModelStateRuntime = createLaboratoryProfileModelStateRuntime({
  createDefaultProfileModelEntry,
  getProjectStateRuntime: function () {
    return laboratoryProjectStateRuntime;
  },
  toRecord,
});
const {
  readProfileModelDescriptor,
  readProfileModelDescriptorMap,
  reloadProfileModelState,
  saveProfileModelState,
  saveToolState,
  updateProfileModelBusy,
  updateProfileModelEntry,
} = laboratoryProfileModelStateRuntime;
const laboratoryHostIoRuntime = createLaboratoryHostIoRuntime({
  getProjectDirectoryFallbackMarkerList,
  getProjectDirectoryList,
  roomId: ROOM_ID,
});
const {
  callRoomTools,
  cancelRoomTool,
  digestSha1,
  ensureProjectDirectories,
  ensureRuntimeDirectory,
  getElectronApi,
  listDirectory,
  readBinaryFileBytes,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} = laboratoryHostIoRuntime;

const laboratoryPresetRuntime = createLaboratoryPresetRuntime({
  asNonEmptyString,
  clone,
  toRecord,
});

const {
  asNumber,
  normalizeStringArray,
  normalizeSourceMetadata,
  buildProjectName,
  buildProjectSlug,
  getSourceConfig,
  getDefaultSourceType,
  getDefaultMode,
  getDefaultYoutubePreset,
  getPresetDefaultCustomValues,
  createEmptySourceDrafts,
  getFocusRegionMap,
  getDefaultFocusRegionId,
  getFocusRegionCrop,
  getResizePresetMap,
  getDefaultEditPresetId,
  mergeObjects,
  createDefaultEditState,
  normalizeCropBox,
  normalizeEditOutput,
  normalizeEditState,
  getProfileLaneMap,
  getCompatibleProfileLaneIds,
  getProfilePresetList,
  findProfilePreset,
  getDefaultProfilePresetId,
  getDefaultProfileModelId,
  createEmptyProfileReadiness,
  createEmptyProfileEstimate,
  createEmptyProfilePreflight,
} = laboratoryPresetRuntime;
const laboratoryHostUtils = createLaboratoryHostUtils({
  audioFeatureId: AUDIO_FEATURE_ID,
  getDefaultSourceType: getDefaultSourceType,
  toRecord: toRecord,
});
const { clampNumber, getPreferredFeatureSourceKind, toFileUrl } = laboratoryHostUtils;

const subtitleDocumentRuntime = createSubtitleDocumentRuntime({
  asNonEmptyString,
  asNumber,
  toRecord,
});

const {
  applySubtitleTextCleanup,
  buildNormalizedSubtitleCueModel,
  buildSubtitleEditSummary,
  formatSubtitleRenderTimestamp,
  normalizeSubtitleText,
  parseSubtitleCues,
  parseSubtitleTimestamp,
  resolveSubtitleOutputFormat,
  serializeSubtitleCueModel,
  transformSubtitleCueLines,
  transformSubtitleDocument,
  wrapSubtitleLines,
} = subtitleDocumentRuntime;

const audioAnalysisUtilityRuntime = createAudioAnalysisUtilityRuntime({
  asNonEmptyString,
  asNumber,
  readTextFile,
  runProfileTool(...args) {
    return laboratoryAnalysisArtifactRuntime.runProfileTool(...args);
  },
  toRecord,
});

const {
  buildEmotionHeuristicFromProsody,
  buildProsodySummaryFromCsv,
  parseAspectralStatsText,
  resolveOpenSmileProsodyRuntime,
  runAudioStructureProbe,
  runOpenSmileProsodyExtraction,
  runVideoStructureProbe,
} = audioAnalysisUtilityRuntime;

function normalizeAudioAnalysisModuleResult(rawValue, moduleId, catalogEntry) {
  return audioAnalysisStateRuntime.normalizeAudioAnalysisModuleResult(
    rawValue,
    moduleId,
    catalogEntry
  );
}

function createEmptyAudioAnalysisState() {
  return audioAnalysisStateRuntime.createEmptyAudioAnalysisState();
}

function normalizeAudioAnalysisState(rawValue, runtime) {
  return audioAnalysisStateRuntime.normalizeAudioAnalysisState(rawValue, runtime);
}

function getProfileArtifactPreferenceMap(profileCapabilities) {
  return toRecord(toRecord(profileCapabilities).artifactPreferences);
}

const {
  buildDerivedTargetSignature,
  buildEditManifest,
  buildMediaSnapshot,
  buildProcessManifest,
  buildProfileManifest,
  buildReportManifest,
  buildSourceSnapshot,
  buildSourceTargetSignature,
  findEditOutputById,
  isSourceCompatibleAction,
  laboratoryRoomSnapshotRuntime,
  notifyRoom,
  pushActionResult,
  pushJobState,
  pushMediaState,
  pushSourceState,
} = createLaboratorySnapshotCompositionRuntime({
  asNonEmptyString,
  asNumber,
  audioFeatureId: AUDIO_FEATURE_ID,
  clone,
  defaultFeatureId: FEATURE_ID,
  featureIds: FEATURE_IDS,
  getFeatureIdFromContext,
  getFeatureProcessRecord(...args) {
    return getFeatureProcessRecord(...args);
  },
  getFeatureReportRecord(...args) {
    return getFeatureReportRecord(...args);
  },
  getRuntimeToolIds,
  getStageSupport,
  getToolManifest,
  loadContext,
  mediaFeatureId: FEATURE_ID,
  mediaStages: MEDIA_STAGES,
  normalizeAudioAnalysisModuleResult,
  normalizeAudioAnalysisState,
  normalizeEditOutput,
  normalizeProcessState(rawValue) {
    return laboratoryProjectStateDelegatesRuntime.normalizeProjectProcessState(rawValue);
  },
  normalizeProfileArtifact(rawValue) {
    return laboratoryProjectStateDelegatesRuntime.normalizeProjectProfileArtifact(rawValue);
  },
  normalizeProfileSignal(rawValue) {
    return laboratoryProjectStateDelegatesRuntime.normalizeProjectProfileSignal(rawValue);
  },
  normalizeReportState(rawValue) {
    return laboratoryProjectStateDelegatesRuntime.normalizeProjectReportState(rawValue);
  },
  normalizeSourceMetadata,
  normalizeSubtitleAnalysisState(rawValue, runtime) {
    return laboratorySubtitleStateDelegatesRuntime.normalizeSubtitleAnalysisState(rawValue, runtime);
  },
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  roomId: ROOM_ID,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  syncProjectFeatureProjections(runtime, project) {
    return laboratoryProjectStateDelegatesRuntime.syncProjectFeatureProjections(runtime, project);
  },
  toFileUrl,
  toRecord,
});

const laboratoryJobStateRuntime = createLaboratoryJobStateRuntime({
  cancelRoomTool,
  roomId: ROOM_ID,
});
const { cancelJobsForProject, clearJob, createRequestId, registerJob } = laboratoryJobStateRuntime;

const laboratoryProjectLifecycleRuntime = createLaboratoryProjectLifecycleRuntime({
  asNonEmptyString,
  buildEditManifest,
  buildProcessManifest,
  buildProfileManifest,
  buildReportManifest,
  callRoomTools,
  cancelJobsForProject,
  clone,
  createDefaultProfileModelEntry,
  createDefaultToolEntry,
  createDefaultToolState,
  createProjectRecord(...args) {
    return laboratoryProjectRecordsRuntime.createProjectRecord(...args);
  },
  defaultFeatureId: FEATURE_ID,
  ensureProjectDirectories,
  findProject(...args) {
    return laboratoryProjectRecordsRuntime.findProject(...args);
  },
  getActiveProject(...args) {
    return laboratoryProjectRecordsRuntime.getActiveProject(...args);
  },
  getFeatureIdFromContext,
  getProfileModelStatePath,
  getProjectDir,
  getProjectEditManifestPath,
  getProjectMetaPath,
  getProjectProcessManifestPath,
  getProjectProfileManifestPath,
  getProjectReportManifestPath,
  getRuntimeToolIds,
  listDirectory,
  loadContext,
  normalizeProject(...args) {
    return laboratoryProjectRecordsRuntime.normalizeProject(...args);
  },
  readJsonFile,
  refreshProfileModelState: reloadProfileModelState,
  roomId: ROOM_ID,
  syncProjectFeatureProjections(runtime, project) {
    return laboratoryProjectStateDelegatesRuntime.syncProjectFeatureProjections(runtime, project);
  },
  toRecord,
  updateProjectTimestamps(...args) {
    return laboratoryProjectRecordsRuntime.updateProjectTimestamps(...args);
  },
  writeJsonFile,
});
const {
  createProject,
  deleteProject,
  ensureHydrated,
  ensureProjectExists,
  patchActiveProject,
  patchActiveProjectDrafts,
  refreshToolStatus,
  updateProjectInMemory,
} = laboratoryProjectLifecycleRuntime;

const mediaProfileModelRuntime = createMediaProfileModelRuntime({
  asNonEmptyString,
  asNumber,
  callRoomTools,
  clearJob,
  createDefaultProfileModelEntry,
  digestSha1,
  ensureRuntimeDirectory,
  getActiveProject(...args) {
    return laboratoryProjectRecordsRuntime.getActiveProject(...args);
  },
  getProfileModelDescriptor: readProfileModelDescriptor,
  getProfileModelDescriptorMap: readProfileModelDescriptorMap,
  getProfileModelsDir,
  getStageSupport,
  getToolManifest,
  listDirectory,
  persistProfileModelState: saveProfileModelState,
  pushJobState,
  readBinaryFileBytes,
  refreshProfileModelState: reloadProfileModelState,
  registerJob,
  roomId: ROOM_ID,
  toRecord,
  updateProfileModelBusy,
  updateProfileModelEntry,
});
const {
  buildProfileModelSummary,
  buildProfileToolSummary,
  evaluateProfileModelCompatibility,
  getCurrentRuntimePlatformKey,
  installProfileModel,
  removeProfileModel,
  verifyProfileModel,
} = mediaProfileModelRuntime;

const mediaProfileStateRuntime = createMediaProfileStateRuntime({
  asNonEmptyString,
  asNumber,
  clampNumber,
  createEmptyProfileEstimate,
  createEmptyProfilePreflight,
  createEmptyProfileReadiness,
  findProfilePreset,
  getCompatibleProfileLaneIds,
  getDefaultProfileModelId,
  getDefaultProfilePresetId,
  getProfileArtifactPreferenceMap,
  getProfileLaneMap,
  markCloseoutAsStale,
  mediaFeatureId: FEATURE_ID,
  toRecord,
});
const {
  applyProfilePresetPatch,
  clampProfileTranscriptSampleSeconds,
  createDefaultProfileState,
  getEnabledProfileLaneIds,
  getProfileDepthConfig,
  getProfileFrameDensityRuntimeConfig,
  markProfileAsStale,
  normalizeProfileArtifact,
  normalizeProfileArtifactPreferences,
  normalizeProfileSignal,
  normalizeProfileState,
  resetProfileForCurrentSource,
} = mediaProfileStateRuntime;
const {
  createEmptyFeatureProcessRecord,
  createEmptyFeatureReportRecord,
  createEmptyProcessState,
  createEmptyReportState,
  createEmptySubtitleAnalysisState,
  createEmptySubtitleDiscoveryState,
  createProjectRecord,
  createSubtitleEntryRecord,
  findProject,
  getActiveProject,
  getActiveSubtitleEntry,
  getDefaultSubtitleEditPresetId,
  getDefaultSubtitleEditRecipe,
  getFeatureProcessRecord,
  getFeatureReportRecord,
  getSubtitleEntries,
  getSubtitleEntryById,
  getSubtitleMimeType,
  getSubtitleSelectedEntries,
  isSubtitleFileName,
  laboratoryCloseoutStalenessRuntime: nextLaboratoryCloseoutStalenessRuntime,
  laboratoryProcessReportStateRuntime,
  laboratoryProjectRecordsRuntime,
  laboratoryProjectStateDelegatesRuntime,
  laboratorySubtitleStateDelegatesRuntime,
  normalizeFeatureProcessRecord,
  normalizeFeatureReportRecord,
  normalizeProcessArtifact,
  normalizeProcessFinding,
  normalizeProcessModule,
  normalizeProcessState,
  normalizeReportExport,
  normalizeReportState,
  normalizeReportSummaryCard,
  normalizeSubtitleAnalysisState,
  normalizeSubtitleDiscoveryItem,
  normalizeSubtitleEntryRecord,
  normalizeSubtitleOutputRecord,
  normalizeProject,
  resetSubtitleDiscovery,
  resetSubtitleFeatureState,
  setFeatureProcessRecord,
  setFeatureReportRecord,
  syncProjectSubtitleAnalysisProjection,
  updateProjectTimestamps,
  upsertSubtitleEntries,
} = createLaboratoryHostStateCompositionRuntime({
  asNonEmptyString,
  asNumber,
  buildProjectName,
  buildProjectSlug,
  clone,
  createDefaultEditState,
  createDefaultProfileState,
  createEmptyAudioAnalysisState,
  createEmptySourceDrafts,
  featureIds: FEATURE_IDS,
  getDefaultMode,
  getDefaultSourceType,
  getDefaultYoutubePreset,
  getMediaProfileStateRuntime() {
    return mediaProfileStateRuntime;
  },
  getPreferredFeatureSourceKind,
  getPresetDefaultCustomValues,
  getProjectStateRuntime() {
    return laboratoryProjectStateRuntime;
  },
  markFeatureProcessStale,
  markFeatureReportStale,
  normalizeAudioAnalysisState,
  normalizeEditState,
  normalizeProfileArtifact,
  normalizeProfileSignal,
  normalizeProfileState,
  normalizeSourceMetadata,
  normalizeStringArray,
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  toRecord,
});
laboratoryCloseoutStalenessRuntime = nextLaboratoryCloseoutStalenessRuntime;

const laboratoryAnalysisArtifactRuntime = createLaboratoryAnalysisArtifactRuntime({
  asNonEmptyString,
  asNumber,
  callRoomTools,
  getProjectProfileDir,
  getProjectProfilePreflightDir,
  normalizeProcessArtifact,
  normalizeProcessFinding,
  normalizeProfileArtifact,
  normalizeProfileSignal,
  readTextFile,
  roomId: ROOM_ID,
  toRecord,
  writeJsonFile,
});

const mediaProfileProjectionRuntime = createMediaProfileProjectionRuntime({
  asNonEmptyString,
  asNumber,
  buildDerivedTargetSignature,
  buildProfileModelSummary,
  buildProfileToolSummary,
  buildSourceTargetSignature,
  clampProfileTranscriptSampleSeconds,
  clone,
  createDefaultProfileState,
  createEmptyProfilePreflight,
  findEditOutputById,
  findProfilePreset,
  getCompatibleProfileLaneIds,
  getDefaultProfileModelId,
  getEnabledProfileLaneIds,
  getProfileDepthConfig,
  getProfileFrameDensityRuntimeConfig,
  getProfileLaneMap,
  getProfileModelDescriptorMap: readProfileModelDescriptorMap,
  getStageSupport,
  getToolManifest,
  normalizeEditOutput,
  normalizeProfileArtifactPreferences,
  normalizeProfileState,
  normalizeSourceMetadata,
  toRecord,
});
const {
  buildProfileEstimate,
  buildProfileReadiness,
  resolveProfileTarget,
  syncProjectProfileProjection,
} = mediaProfileProjectionRuntime;

const laboratoryJobRuntime = createLaboratoryJobRuntime({
  cancelRoomTool,
  clearJob,
  pushJobState,
  roomId: ROOM_ID,
  toRecord,
});

const laboratoryMediaAnalysisHostRuntime = createLaboratoryMediaAnalysisHostRuntime({
  asNonEmptyString,
  asNumber,
  audioFeatureId: AUDIO_FEATURE_ID,
  buildSyntheticProfileSignal: laboratoryAnalysisArtifactRuntime.buildSyntheticProfileSignal,
  callRoomTools,
  clearJob,
  clone,
  clampNumber,
  createDefaultEditState,
  createEmptyProfilePreflight,
  createProfileSignal: laboratoryAnalysisArtifactRuntime.createProfileSignal,
  ensureEditJobSlotAvailable: laboratoryJobRuntime.ensureEditJobSlotAvailable,
  ensureProfileJobSlotAvailable: laboratoryJobRuntime.ensureProfileJobSlotAvailable,
  ensureProjectDirectories,
  generateProfileFrameStrip: laboratoryAnalysisArtifactRuntime.generateProfileFrameStrip,
  generateProfileMetadataArtifact:
    laboratoryAnalysisArtifactRuntime.generateProfileMetadataArtifact,
  generateProfileSpectrogram: laboratoryAnalysisArtifactRuntime.generateProfileSpectrogram,
  getActiveProject(...args) {
    return laboratoryProjectRecordsRuntime.getActiveProject(...args);
  },
  getCollectDerivedOutputMetadata: function () {
    return mediaSourceMetadataRuntime.collectDerivedOutputMetadata;
  },
  getFocusRegionCrop,
  getProfileFrameDensityRuntimeConfig,
  getProjectEditDir,
  getProjectEditOutputDir,
  getProjectEditPreviewDir,
  getResizePresetMap,
  maybeRunWhisperProfileSample: laboratoryAnalysisArtifactRuntime.maybeRunWhisperProfileSample,
  markCloseoutAsStale,
  markProfileAsStale,
  mergeObjects,
  normalizeEditOutput,
  normalizeProfileArtifactPreferences,
  normalizeSourceMetadata,
  patchActiveProject,
  pushJobState,
  registerJob,
  runAudioStructureProbe,
  runVideoStructureProbe,
  roomId: ROOM_ID,
  syncProjectFeatureProjections(runtime, project) {
    return laboratoryProjectStateDelegatesRuntime.syncProjectFeatureProjections(runtime, project);
  },
  toRecord,
});
const {
  applyEditRecipePatch,
  buildEditCommand,
  buildEditOutputLabel,
  buildEditTargetPath,
  ensureEditToolReady,
  ensureProfileToolReady,
  findEditPreset,
  getDerivedMimeType,
  getEditRecipeSignature,
  getPreparedSourcePath,
  requirePreparedSource,
  resetEditForCurrentSource,
  runEditPipeline,
  runProfilePreflight,
  sanitizeFileSegment,
} = laboratoryMediaAnalysisHostRuntime;

const {
  audioAnalysisStateRuntime,
  buildAudioAnalysisModules,
  buildMediaProcessModules,
  buildProcessSpeechAvailability,
  getAudioAnalysisModulesForRuntime,
  getFeatureProcessJobAction,
  getFeatureReportExportAction,
  laboratoryAudioProcessDelegatesRuntime,
  laboratoryProcessCoordinationRuntime: nextLaboratoryProcessCoordinationRuntime,
  laboratoryProcessDelegatesRuntime,
  laboratoryProcessRuntime,
  laboratoryReportingRuntime,
  resolveProcessTarget,
  syncProjectAudioAnalysisProjection,
  updateProcessModule,
  updateProcessRecordPercent,
} = createLaboratoryHostProcessCompositionRuntime({
  asNonEmptyString,
  asNumber,
  audioAnalysisSchemaVersion: AUDIO_ANALYSIS_SCHEMA_VERSION,
  audioFeatureId: AUDIO_FEATURE_ID,
  buildDerivedTargetSignature,
  buildEmotionHeuristicFromProsody,
  buildProfileModelSummary,
  buildSourceTargetSignature,
  clampProfileTranscriptSampleSeconds,
  clearJob,
  clone,
  createEmptyFeatureProcessRecord,
  createEmptyFeatureReportRecord,
  createProcessArtifact: laboratoryAnalysisArtifactRuntime.createProcessArtifact,
  createProcessFinding: laboratoryAnalysisArtifactRuntime.createProcessFinding,
  ensureEditToolReady,
  ensureProcessJobSlotAvailable: laboratoryJobRuntime.ensureProcessJobSlotAvailable,
  ensureProjectDirectories,
  ensureReportJobSlotAvailable: laboratoryJobRuntime.ensureReportJobSlotAvailable,
  ensureRuntimeDirectory,
  findEditOutputById,
  formatIdentifierLabel: laboratoryAnalysisArtifactRuntime.formatIdentifierLabel,
  getActiveProject(...args) {
    return laboratoryProjectRecordsRuntime.getActiveProject(...args);
  },
  getFeatureProcessDir,
  getFeatureProcessRecord,
  getFeatureReportDir,
  getFeatureReportRecord,
  getFindingSeverityRank: laboratoryAnalysisArtifactRuntime.getFindingSeverityRank,
  getPreferredFeatureSourceKind,
  getProjectSubtitleProcessDir,
  getStageSupport,
  getSubtitleAnalysisHostRuntime() {
    return laboratorySubtitleAnalysisHostRuntime;
  },
  getSubtitleSelectedEntries,
  getActiveSubtitleEntry,
  getSubtitleMimeType,
  getSubtitleAnalysisModuleDescriptors(runtime) {
    const modules = toRecord(toRecord(runtime).subtitleAnalysisCatalog).modules;
    return Array.isArray(modules) ? modules.map(toRecord) : [];
  },
  getToolManifest,
  listDirectory,
  markFeatureReportStale,
  maybeRunWhisperProfileSample: laboratoryAnalysisArtifactRuntime.maybeRunWhisperProfileSample,
  mediaFeatureId: FEATURE_ID,
  normalizeAudioAnalysisModuleResult,
  normalizeAudioAnalysisState,
  normalizeEditOutput,
  normalizeFeatureReportRecord,
  normalizeProcessArtifact,
  normalizeProcessFinding,
  normalizeProcessModule,
  normalizeReportExport,
  normalizeSourceMetadata,
  normalizeStringArray,
  normalizeSubtitleAnalysisState,
  parseAspectralStatsText,
  patchActiveProject,
  pushJobState,
  readJsonFile,
  readTextFile,
  registerJob,
  resolveOpenSmileProsodyRuntime,
  resolveProfileTarget,
  runAudioStructureProbe,
  runOpenSmileProsodyExtraction,
  runProfileTool: laboratoryAnalysisArtifactRuntime.runProfileTool,
  runVideoStructureProbe,
  sanitizeFileSegment,
  setFeatureProcessRecord,
  setFeatureReportRecord,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  toRecord,
  writeJsonFile,
  writeTextFile,
});
laboratoryProcessCoordinationRuntime = nextLaboratoryProcessCoordinationRuntime;

const { laboratorySourceDelegatesRuntime, mediaSourceFileRuntime, mediaSourceMetadataRuntime } =
  createLaboratorySourceCompositionRuntime({
    asNumber,
    asNonEmptyString,
    callRoomTools,
    cancelJobsForProject,
    clearJob,
    ensureProjectDirectories,
    getActiveProject(...args) {
      return laboratoryProjectRecordsRuntime.getActiveProject(...args);
    },
    getElectronApi,
    getProjectEditDir,
    getProjectSourceDir,
    getPresetDefaultCustomValues,
    getSourceConfig,
    normalizeSourceMetadata,
    patchActiveProject,
    pushJobState,
    registerJob,
    resetEditForCurrentSource,
    resetProfileForCurrentSource,
    roomId: ROOM_ID,
    toRecord,
  });
const {
  collectDerivedOutputMetadata,
  collectStoredSourceMetadata,
  deleteOwnedSourceFile,
  refreshActiveProjectMetadata,
  resolvePreparedSource,
} = mediaSourceMetadataRuntime;
const laboratoryRoomToolsProgressRuntime = createLaboratoryRoomToolsProgressRuntime({
  roomId: ROOM_ID,
  asNonEmptyString,
  toRecord,
  getElectronApi: getElectronApi,
  pushJobState: pushJobState,
  pushSourceState: pushSourceState,
});
const ensureRoomToolsSubscription = laboratoryRoomToolsProgressRuntime.ensureRoomToolsSubscription;
const tearDownRoomToolsSubscription =
  laboratoryRoomToolsProgressRuntime.tearDownRoomToolsSubscription;
const laboratoryRuntimeStorage = createLaboratoryRuntimeStorage({
  lifecycleRuntime: laboratoryProjectLifecycleRuntime,
  profileModelRuntime: mediaProfileModelRuntime,
  toRecord,
});
const {
  getProfileModelDescriptor,
  getProfileModelDescriptorMap,
  loadProfileModelState,
  loadProjects,
  loadRuntimeConfigs,
  loadToolState,
  persistProfileModelState,
  persistToolState,
  refreshProfileModelState,
  saveProject,
} = laboratoryRuntimeStorage;

laboratoryProjectStateRuntime = createLaboratoryProjectStateRuntime({
  roomSnapshotRuntime: laboratoryRoomSnapshotRuntime,
  runtimeStorage: laboratoryRuntimeStorage,
  syncProjectAudioAnalysisProjection: syncProjectAudioAnalysisProjection,
  syncProjectProfileProjection: syncProjectProfileProjection,
  syncProjectSubtitleAnalysisProjection: syncProjectSubtitleAnalysisProjection,
  toFileUrl: toFileUrl,
});

laboratorySubtitleAnalysisHostRuntime = createLaboratorySubtitleAnalysisHostRuntime({
  asNonEmptyString,
  asNumber,
  buildSubtitleEditSummary,
  callRoomTools,
  clearJob,
  createEmptySubtitleDiscoveryState,
  createSubtitleEntryRecord,
  ensureProjectDirectories,
  formatIdentifierLabel: laboratoryAnalysisArtifactRuntime.formatIdentifierLabel,
  getActiveProject(...args) {
    return laboratoryProjectRecordsRuntime.getActiveProject(...args);
  },
  getActiveSubtitleEntry,
  getDefaultSubtitleEditPresetId,
  getDefaultSubtitleEditRecipe,
  getElectronApi,
  getProjectSubtitleEditOutputDir,
  getSubtitleEntries,
  getSubtitleMimeType,
  isSubtitleFileName,
  listDirectory,
  markFeatureProcessStale,
  markFeatureReportStale,
  mergeObjects,
  normalizeProcessModule,
  normalizeStringArray,
  normalizeSubtitleAnalysisState,
  normalizeSubtitleDiscoveryItem,
  normalizeSubtitleOutputRecord,
  patchActiveProject,
  parseSubtitleCues,
  pushJobState,
  readTextFile,
  registerJob,
  resetSubtitleDiscovery,
  resolveSubtitleOutputFormat,
  roomId: ROOM_ID,
  sanitizeFileSegment,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  toRecord,
  transformSubtitleDocument,
  upsertSubtitleEntries,
  writeTextFile,
});
const { buildSubtitleAnalysisStats, buildSubtitleProcessModules, subtitleActionRuntime } =
  laboratorySubtitleAnalysisHostRuntime;
const laboratoryActionCompositionRuntime = createLaboratoryActionCompositionRuntime({
  applyEditRecipePatch,
  applyProfilePresetPatch,
  asNonEmptyString,
  audioFeatureId: AUDIO_FEATURE_ID,
  cancelEditJobsForProject: laboratoryJobRuntime.cancelEditJobsForProject,
  cancelFeatureProcess: laboratoryProcessDelegatesRuntime.cancelFeatureProcess,
  cancelProfileJobsForProject: laboratoryJobRuntime.cancelProfileJobsForProject,
  clampNumber,
  clampProfileTranscriptSampleSeconds,
  createDefaultEditState,
  createDefaultToolEntry,
  createProject,
  createRequestId,
  ensureHydrated,
  ensureProjectExists,
  exportFeatureReport: laboratoryProcessDelegatesRuntime.exportFeatureReport,
  findEditPreset,
  findProfilePreset,
  getActiveProject(...args) {
    return laboratoryProjectRecordsRuntime.getActiveProject(...args);
  },
  getDefaultMode,
  getDefaultSourceType,
  getFeatureIdFromContext,
  getProfileModelDescriptorMap: readProfileModelDescriptorMap,
  getRuntimeToolIds,
  handleLocalPick: laboratorySourceDelegatesRuntime.handleLocalPick,
  handleUrlDownload: laboratorySourceDelegatesRuntime.handleUrlDownload,
  handleYoutubeDownload: laboratorySourceDelegatesRuntime.handleYoutubeDownload,
  installProfileModel,
  loadContext,
  markCloseoutAsStale,
  markProfileAsStale,
  normalizeProfileArtifactPreferences,
  patchActiveProject,
  patchActiveProjectDrafts,
  persistProfileModelState,
  persistToolState: saveToolState,
  pushActionResult,
  pushJobState,
  pushMediaState,
  refreshActiveProjectMetadata,
  refreshProfileModelState: reloadProfileModelState,
  refreshToolStatus,
  registerJob,
  removeProfileModel,
  resetEditForCurrentSource,
  resetProfileForCurrentSource,
  runEditPipeline,
  runFeatureProcess: laboratoryProcessDelegatesRuntime.runFeatureProcess,
  runProfilePreflight,
  roomId: ROOM_ID,
  toRecord,
  callRoomTools,
  clearJob,
  getSubtitleActionRuntime: function () {
    return subtitleActionRuntime;
  },
});
const handleMediaAction = laboratoryActionCompositionRuntime.handleMediaAction;

export default function createLaboratoryHostRuntime() {
  return createLaboratoryHostActivation({
    createRuntimeState,
    ensureHydrated,
    ensureRoomToolsSubscription,
    handleMediaAction,
    pushMediaState,
    saveContext,
    tearDownRoomToolsSubscription,
    toRecord,
  });
}
