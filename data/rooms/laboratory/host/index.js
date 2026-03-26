import {
  callLaboratoryRoomTools,
  cancelLaboratoryRoomTool,
  digestLaboratorySha1,
  ensureLaboratoryProjectDirectories,
  ensureLaboratoryRuntimeDirectory,
  getLaboratoryElectronApi,
  listLaboratoryDirectory,
  readLaboratoryBinaryFileBytes,
  readLaboratoryJsonFile,
  readLaboratoryTextFile,
  writeLaboratoryJsonFile,
  writeLaboratoryTextFile,
} from "../shared/host/electron-bridge.js";
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
  getProjectFeatureProcessDir as getProjectFeatureProcessDirFromPaths,
  getProjectFeatureReportDir as getProjectFeatureReportDirFromPaths,
  getProjectMetaPath,
  getProjectProcessDir as getProjectProcessDirFromPaths,
  getProjectProcessManifestPath,
  getProjectProfileDir,
  getProjectProfileManifestPath,
  getProjectProfilePreflightDir,
  getProjectReportDir as getProjectReportDirFromPaths,
  getProjectReportManifestPath,
  getProjectSourceDir,
  getProjectSubtitleEditOutputDir,
  getProjectSubtitleProcessDir,
  getProjectSubtitleSourceDir,
} from "../shared/host/project-paths.js";
import { createLaboratoryProjectLifecycleRuntime } from "../shared/host/project-lifecycle.js";
import { createLaboratoryProcessReportStateRuntime } from "../shared/host/process-report-state.js";
import { createLaboratoryRuntimeBootstrap } from "../shared/host/runtime-bootstrap.js";
import { createLaboratoryActionRouter } from "../shared/host/action-router.js";
import { createLaboratoryProcessRuntime } from "../shared/host/process-runtime.js";
import { createLaboratoryProcessTargetingRuntime } from "../shared/host/process-targeting.js";
import { createLaboratoryPresetRuntime } from "../shared/host/preset-runtime.js";
import { createLaboratoryReportingRuntime } from "../shared/host/reporting.js";
import { createLaboratoryRoomSnapshotRuntime } from "../shared/host/room-snapshot.js";
import { createLaboratoryRoomToolsProgressRuntime } from "../shared/host/room-tools-progress.js";
import { createLaboratoryToolMutationRuntime } from "../shared/host/tool-mutations.js";
import { createMediaActionRuntime } from "../main-functions/media-analysis/host/action-handlers.js";
import { createMediaEditSupportRuntime } from "../main-functions/media-analysis/host/edit-support.js";
import { createMediaEditPipelineRuntime } from "../main-functions/media-analysis/host/edit-pipeline.js";
import { createMediaProfileModelRuntime } from "../main-functions/media-analysis/host/profile-models.js";
import { createMediaProfileProjectionRuntime } from "../main-functions/media-analysis/host/profile-projection.js";
import { createMediaProfilePreflightRuntime } from "../main-functions/media-analysis/host/profile-preflight.js";
import { createMediaProfileStateRuntime } from "../main-functions/media-analysis/host/profile-state.js";
import { createMediaSourceMetadataRuntime } from "../main-functions/media-analysis/host/source-metadata.js";
import { createMediaSourceIntakeRuntime } from "../main-functions/media-analysis/host/source-intake.js";
import { createAudioAnalysisUtilityRuntime } from "../main-functions/audio-analysis/host/analysis-utils.js";
import { createAudioAnalysisProjectionRuntime } from "../main-functions/audio-analysis/host/module-projection.js";
import { createAudioAnalysisProcessRuntime } from "../main-functions/audio-analysis/host/process-runners.js";
import { createAudioAnalysisStateRuntime } from "../main-functions/audio-analysis/host/state.js";
import { createSubtitleActionRuntime } from "../main-functions/subtitle-analysis/host/action-handlers.js";
import { createSubtitleDocumentRuntime } from "../main-functions/subtitle-analysis/host/document-runtime.js";
import { createSubtitleEditWorkspaceRuntime } from "../main-functions/subtitle-analysis/host/edit-workspace.js";
import { createSubtitleProcessAnalysisRuntime } from "../main-functions/subtitle-analysis/host/process-analysis.js";
import { createSubtitleStateRuntime } from "../main-functions/subtitle-analysis/host/state.js";
import { createSubtitleSourceIntakeRuntime } from "../main-functions/subtitle-analysis/host/source-intake.js";
import { createSubtitleYoutubeSourceRuntime } from "../main-functions/subtitle-analysis/host/youtube-source.js";

const ROOM_ID = "laboratory";
const SUBTITLE_FEATURE_ID = "subtitle-analysis";
const AUDIO_FEATURE_ID = "audio-analysis";
const FEATURE_ID = "media-analysis";
const FEATURE_IDS = [FEATURE_ID, AUDIO_FEATURE_ID, SUBTITLE_FEATURE_ID];
const MEDIA_STAGES = ["source", "edit", "profile", "process", "report"];
const AUDIO_ANALYSIS_SCHEMA_VERSION = 1;
const PROJECT_SCHEMA_VERSION = 1;
const FEATURE_NAMESPACES = {
  [FEATURE_ID]: "mediaAnalysis",
  [AUDIO_FEATURE_ID]: "audioAnalysis",
  [SUBTITLE_FEATURE_ID]: "subtitleAnalysis",
};

function getProjectProcessDir(runtime, project) {
  return getProjectProcessDirFromPaths(runtime, project);
}

function getProjectReportDir(runtime, project) {
  return getProjectReportDirFromPaths(runtime, project);
}

function getFeatureProcessDir(runtime, project, featureId) {
  return getProjectFeatureProcessDirFromPaths(runtime, project, featureId);
}

function getFeatureReportDir(runtime, project, featureId) {
  return getProjectFeatureReportDirFromPaths(runtime, project, featureId);
}

function toRecord(value) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
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

function getElectronApi() {
  return getLaboratoryElectronApi();
}

async function digestSha1(bytes) {
  return digestLaboratorySha1(bytes);
}

async function readJsonFile(filePath) {
  return readLaboratoryJsonFile(filePath);
}

async function readTextFile(filePath) {
  return readLaboratoryTextFile(filePath);
}

async function readBinaryFileBytes(filePath) {
  return readLaboratoryBinaryFileBytes(filePath);
}

async function writeJsonFile(filePath, value) {
  return writeLaboratoryJsonFile(filePath, value);
}

async function writeTextFile(filePath, value) {
  return writeLaboratoryTextFile(filePath, value);
}

async function listDirectory(dirPath) {
  return listLaboratoryDirectory(dirPath);
}

async function callRoomTools(request) {
  return callLaboratoryRoomTools(request);
}

async function ensureRuntimeDirectory(dirPath, requestId) {
  return ensureLaboratoryRuntimeDirectory({
    roomId: ROOM_ID,
    dirPath: dirPath,
    requestId: requestId,
  });
}

async function ensureProjectDirectories(runtime, project, requestId) {
  return ensureLaboratoryProjectDirectories({
    roomId: ROOM_ID,
    dirPaths: getProjectDirectoryList(runtime, project),
    fallbackMarkerPaths: getProjectDirectoryFallbackMarkerList(runtime, project),
    requestId: requestId,
  });
}

async function cancelRoomTool(roomId, jobId, requestId) {
  return cancelLaboratoryRoomTool({
    roomId: roomId,
    jobId: jobId,
    requestId: requestId,
  });
}

function getPreferredFeatureSourceKind(featureId, sourcePresets) {
  if (featureId === AUDIO_FEATURE_ID) {
    return Object.prototype.hasOwnProperty.call(toRecord(sourcePresets).sourceTypes, "audio")
      ? "audio"
      : getDefaultSourceType(sourcePresets);
  }
  return getDefaultSourceType(sourcePresets);
}

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
  runProfileTool,
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

function createEmptyAudioAnalysisSourceState() {
  return {
    preferredSourceKind: "audio",
    requestedMode: "source",
    mode: "source",
    outputId: null,
    targetSignature: null,
    targetPath: null,
    targetFileName: null,
    targetMimeType: null,
    targetLabel: null,
    extractedAudioPath: null,
    updatedAt: null,
  };
}

function createEmptyAudioAnalysisCatalogState() {
  return {
    orderedIds: [],
    implementedIds: [],
    gatedIds: [],
    plannedIds: [],
    visibleIds: [],
  };
}

function normalizeAudioAnalysisMetric(rawValue) {
  const source = toRecord(rawValue);
  return {
    id: asNonEmptyString(source.id) || `audio-analysis-metric-${Date.now()}`,
    label: asNonEmptyString(source.label),
    labelKey: asNonEmptyString(source.labelKey),
    value: asNonEmptyString(source.value) || "--",
  };
}

function normalizeAudioAnalysisCapabilityEntry(rawValue, moduleId, catalogEntry) {
  const source = toRecord(rawValue);
  const catalog = toRecord(catalogEntry);
  return {
    moduleId: moduleId,
    phase: asNonEmptyString(source.phase) || asNonEmptyString(catalog.phase) || "v1",
    status: asNonEmptyString(source.status) || asNonEmptyString(catalog.status) || "planned",
    titleKey: asNonEmptyString(source.titleKey) || asNonEmptyString(catalog.titleKey),
    summaryKey: asNonEmptyString(source.summaryKey) || asNonEmptyString(catalog.summaryKey),
    providerIds:
      normalizeStringArray(source.providerIds).length > 0
        ? normalizeStringArray(source.providerIds)
        : normalizeStringArray(catalog.providerIds),
    toolIds:
      normalizeStringArray(source.toolIds).length > 0
        ? normalizeStringArray(source.toolIds)
        : normalizeStringArray(catalog.toolIds),
    requiredToolIds:
      normalizeStringArray(source.requiredToolIds).length > 0
        ? normalizeStringArray(source.requiredToolIds)
        : getAudioAnalysisRequiredToolIds(catalog),
    blockers: normalizeStringArray(source.blockers),
    warnings: normalizeStringArray(source.warnings),
  };
}

function normalizeAudioAnalysisProviderStateEntry(rawValue, providerId, descriptor) {
  const source = toRecord(rawValue);
  const provider = toRecord(descriptor);
  return {
    providerId: providerId,
    status: asNonEmptyString(source.status) || asNonEmptyString(provider.status) || "planned",
    toolId: asNonEmptyString(source.toolId) || asNonEmptyString(provider.toolId),
    moduleIds:
      normalizeStringArray(source.moduleIds).length > 0
        ? normalizeStringArray(source.moduleIds)
        : normalizeStringArray(provider.moduleIds),
    titleKey: asNonEmptyString(source.titleKey) || asNonEmptyString(provider.titleKey),
    summaryKey: asNonEmptyString(source.summaryKey) || asNonEmptyString(provider.summaryKey),
    providerType: asNonEmptyString(source.providerType) || asNonEmptyString(provider.providerType),
    installStrategy: asNonEmptyString(source.installStrategy) || asNonEmptyString(provider.installStrategy),
    expectedArtifacts:
      normalizeStringArray(source.expectedArtifacts).length > 0
        ? normalizeStringArray(source.expectedArtifacts)
        : normalizeStringArray(provider.expectedArtifacts),
    fallbackProviderIds:
      normalizeStringArray(source.fallbackProviderIds).length > 0
        ? normalizeStringArray(source.fallbackProviderIds)
        : normalizeStringArray(provider.fallbackProviderIds),
    installed: source.installed === true,
    ready: source.ready === true,
    busy: source.busy === true,
    version: asNonEmptyString(source.version),
    modelId: asNonEmptyString(source.modelId),
    platformSupported: source.platformSupported !== false,
    blockers: normalizeStringArray(source.blockers),
    warnings: normalizeStringArray(source.warnings),
    lastError: asNonEmptyString(source.lastError),
  };
}

function createEmptyAudioAnalysisRunRecord(moduleId) {
  return {
    moduleId: moduleId,
    status: "idle",
    runId: null,
    jobId: null,
    requestId: null,
    startedAt: null,
    completedAt: null,
    warnings: [],
    error: null,
    artifactIds: [],
    findingIds: [],
  };
}

function normalizeAudioAnalysisRunRecord(rawValue, moduleId) {
  const source = toRecord(rawValue);
  return {
    ...createEmptyAudioAnalysisRunRecord(moduleId),
    ...source,
    moduleId: moduleId,
    status: asNonEmptyString(source.status) || "idle",
    runId: asNonEmptyString(source.runId),
    jobId: asNonEmptyString(source.jobId),
    requestId: asNonEmptyString(source.requestId),
    startedAt: asNonEmptyString(source.startedAt),
    completedAt: asNonEmptyString(source.completedAt),
    warnings: normalizeStringArray(source.warnings),
    error: asNonEmptyString(source.error),
    artifactIds: normalizeStringArray(source.artifactIds),
    findingIds: normalizeStringArray(source.findingIds),
  };
}

function createEmptyAudioAnalysisModuleResult(moduleId, catalogEntry) {
  const catalog = toRecord(catalogEntry);
  const status = asNonEmptyString(catalog.status) || "planned";
  return {
    moduleId: moduleId,
    phase: asNonEmptyString(catalog.phase) || "v1",
    status: status === "implemented" ? "idle" : status,
    titleKey: asNonEmptyString(catalog.titleKey),
    summaryKey: asNonEmptyString(catalog.summaryKey),
    providerIds: normalizeStringArray(catalog.providerIds),
    toolIds: normalizeStringArray(catalog.toolIds),
    requiredToolIds: getAudioAnalysisRequiredToolIds(catalog),
    summary: "",
    blockers: [],
    warnings: [],
    signals: [],
    artifacts: [],
    metrics: [],
    confidence: null,
    timing: {
      sampleWindowSeconds: null,
      startedAt: null,
      completedAt: null,
    },
    runMeta: {
      runId: null,
      jobId: null,
      requestId: null,
    },
    sourceSignature: null,
  };
}

function normalizeAudioAnalysisModuleResult(rawValue, moduleId, catalogEntry) {
  return audioAnalysisStateRuntime.normalizeAudioAnalysisModuleResult(rawValue, moduleId, catalogEntry);
}

function createEmptyAudioAnalysisState() {
  return audioAnalysisStateRuntime.createEmptyAudioAnalysisState();
}

function normalizeAudioAnalysisState(rawValue, runtime) {
  return audioAnalysisStateRuntime.normalizeAudioAnalysisState(rawValue, runtime);
}

function getDefaultSubtitleEditPresetId(runtime) {
  return subtitleStateRuntime.getDefaultSubtitleEditPresetId(runtime);
}

function getDefaultSubtitleEditRecipe(runtime, presetId) {
  return subtitleStateRuntime.getDefaultSubtitleEditRecipe(runtime, presetId);
}

function createEmptySubtitleDiscoveryState() {
  return subtitleStateRuntime.createEmptySubtitleDiscoveryState();
}

function createEmptySubtitleAnalysisState(runtime) {
  return subtitleStateRuntime.createEmptySubtitleAnalysisState(runtime);
}

function normalizeSubtitleAnalysisState(rawValue, runtime) {
  return subtitleStateRuntime.normalizeSubtitleAnalysisState(rawValue, runtime);
}

function getSubtitleMimeType(fileName) {
  return subtitleStateRuntime.getSubtitleMimeType(fileName);
}

function isSubtitleFileName(runtime, fileName) {
  return subtitleStateRuntime.isSubtitleFileName(runtime, fileName);
}

function normalizeSubtitleEntryRecord(rawValue, index) {
  return subtitleStateRuntime.normalizeSubtitleEntryRecord(rawValue, index);
}

function normalizeSubtitleOutputRecord(rawValue, index) {
  return subtitleStateRuntime.normalizeSubtitleOutputRecord(rawValue, index);
}

function normalizeSubtitleDiscoveryItem(rawValue, index) {
  return subtitleStateRuntime.normalizeSubtitleDiscoveryItem(rawValue, index);
}

function getSubtitleEntries(project) {
  return subtitleStateRuntime.getSubtitleEntries(project);
}

function getSubtitleEntryById(project, entryId) {
  const requestedId = asNonEmptyString(entryId);
  return (
    getSubtitleEntries(project).find(function (entry) {
      return requestedId !== null && entry.id === requestedId;
    }) || null
  );
}

function getActiveSubtitleEntry(project) {
  return subtitleStateRuntime.getActiveSubtitleEntry(project);
}

function getSubtitleSelectedEntries(project) {
  return subtitleStateRuntime.getSubtitleSelectedEntries(project);
}

function createSubtitleEntryRecord(filePath, options) {
  return subtitleStateRuntime.createSubtitleEntryRecord(filePath, options);
}

function resetSubtitleFeatureState(runtime, project, reason) {
  return subtitleStateRuntime.resetSubtitleFeatureState(runtime, project, reason);
}

function resetSubtitleDiscovery(runtime, project) {
  return subtitleStateRuntime.resetSubtitleDiscovery(runtime, project);
}

function upsertSubtitleEntries(runtime, project, incomingEntries, options) {
  return subtitleStateRuntime.upsertSubtitleEntries(runtime, project, incomingEntries, options);
}

function buildAudioAnalysisCatalogProjection(runtime) {
  return audioAnalysisProjectionRuntime.buildAudioAnalysisCatalogProjection(runtime);
}

function getAudioAnalysisRequiredToolIds(catalogEntry) {
  return audioAnalysisProjectionRuntime.getAudioAnalysisRequiredToolIds(catalogEntry);
}

function buildAudioAnalysisProviderState(runtime, project) {
  return audioAnalysisProjectionRuntime.buildAudioAnalysisProviderState(runtime, project);
}

function buildAudioAnalysisCapabilityState(runtime, project, target, providerState) {
  return audioAnalysisProjectionRuntime.buildAudioAnalysisCapabilityState(
    runtime,
    project,
    target,
    providerState
  );
}

function getAudioAnalysisConfidenceRank(confidence) {
  return audioAnalysisProjectionRuntime.getAudioAnalysisConfidenceRank(confidence);
}

function mapAudioAnalysisResultStatus(processRecord, moduleEntry, capabilityEntry) {
  return audioAnalysisProjectionRuntime.mapAudioAnalysisResultStatus(
    processRecord,
    moduleEntry,
    capabilityEntry
  );
}

function buildAudioAnalysisModuleMetrics(signals, artifacts) {
  return audioAnalysisProjectionRuntime.buildAudioAnalysisModuleMetrics(signals, artifacts);
}

function buildAudioAnalysisModuleSummary(resultStatus, moduleEntry, capabilityEntry) {
  return audioAnalysisProjectionRuntime.buildAudioAnalysisModuleSummary(
    resultStatus,
    moduleEntry,
    capabilityEntry
  );
}

function syncProjectAudioAnalysisProjection(runtime, project) {
  return audioAnalysisProjectionRuntime.syncProjectAudioAnalysisProjection(runtime, project);
}

function syncProjectSubtitleAnalysisProjection(runtime, project) {
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, runtime);
  const processRecord = getFeatureProcessRecord(project, SUBTITLE_FEATURE_ID);
  const reportRecord = getFeatureReportRecord(project, SUBTITLE_FEATURE_ID);

  subtitleState.analysis = {
    ...subtitleState.analysis,
    status: asNonEmptyString(processRecord.status) || "idle",
    summaryCards: Array.isArray(reportRecord.summaryCards) ? reportRecord.summaryCards.map(normalizeReportSummaryCard) : [],
    findings: Array.isArray(reportRecord.findings) ? reportRecord.findings.map(normalizeProcessFinding) : [],
    warnings: Array.isArray(reportRecord.warnings) ? reportRecord.warnings.map(String) : [],
    moduleResults: (Array.isArray(processRecord.modules) ? processRecord.modules : []).reduce(function (accumulator, entry) {
      const moduleRecord = normalizeProcessModule(entry);
      accumulator[moduleRecord.id] = moduleRecord;
      return accumulator;
    }, {}),
    lastRunAt: asNonEmptyString(processRecord.completedAt),
  };
  subtitleState.export = {
    lastGeneratedAt: asNonEmptyString(reportRecord.generatedAt),
    items: Array.isArray(reportRecord.exports) ? reportRecord.exports.map(normalizeReportExport) : [],
  };
  project.subtitleAnalysis = subtitleState;
  return project.subtitleAnalysis;
}

function getProfileArtifactPreferenceMap(profileCapabilities) {
  return toRecord(toRecord(profileCapabilities).artifactPreferences);
}

function clampProfileTranscriptSampleSeconds(profileCapabilities, value) {
  return mediaProfileStateRuntime.clampProfileTranscriptSampleSeconds(profileCapabilities, value);
}

function normalizeProfileArtifactPreferences(rawValue, profileCapabilities, sourceKind) {
  return mediaProfileStateRuntime.normalizeProfileArtifactPreferences(rawValue, profileCapabilities, sourceKind);
}

function applyProfilePresetPatch(profilePresets, profileModels, profileCapabilities, sourceKind, profileState, presetId) {
  return mediaProfileStateRuntime.applyProfilePresetPatch(
    profilePresets,
    profileModels,
    profileCapabilities,
    sourceKind,
    profileState,
    presetId
  );
}

function createDefaultProfileState(profilePresets, profileModels, profileCapabilities, sourceKind) {
  return mediaProfileStateRuntime.createDefaultProfileState(
    profilePresets,
    profileModels,
    profileCapabilities,
    sourceKind
  );
}

function normalizeProfileArtifact(rawValue) {
  return mediaProfileStateRuntime.normalizeProfileArtifact(rawValue);
}

function normalizeProfileSignal(rawValue) {
  return mediaProfileStateRuntime.normalizeProfileSignal(rawValue);
}

function normalizeProfileState(rawValue, profilePresets, profileModels, profileCapabilities, sourceKind) {
  return mediaProfileStateRuntime.normalizeProfileState(
    rawValue,
    profilePresets,
    profileModels,
    profileCapabilities,
    sourceKind
  );
}

function createProjectRecord(
  sourcePresets,
  editPresets,
  profilePresets,
  profileModels,
  profileCapabilities,
  subtitleRuntime,
  featureId
) {
  const now = new Date().toISOString();
  const kind = getPreferredFeatureSourceKind(featureId, sourcePresets);
  const mode = getDefaultMode(sourcePresets, kind);
  const slug = buildProjectSlug(now);

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: slug,
    slug: slug,
    name: buildProjectName(now),
    createdAt: now,
    updatedAt: now,
    source: {
      kind: kind,
      mode: mode,
      status: "idle",
      storedPath: null,
      storedFileName: null,
      sourceUrl: null,
      mimeType: null,
      routeLabel: null,
      lastError: null,
      metadata: null,
      metadataError: null,
      drafts: createEmptySourceDrafts(sourcePresets),
    },
    edit: createDefaultEditState(editPresets, kind),
    profile: createDefaultProfileState(profilePresets, profileModels, profileCapabilities, kind),
    audioAnalysis: createEmptyAudioAnalysisState(),
    subtitleAnalysis: createEmptySubtitleAnalysisState(subtitleRuntime || {}),
    process: createEmptyProcessState(),
    report: createEmptyReportState(),
  };
}

function normalizeProject(
  rawValue,
  sourcePresets,
  editPresets,
  profilePresets,
  profileModels,
  profileCapabilities,
  subtitleRuntime
) {
  const source = toRecord(toRecord(rawValue).source);
  const kind = asNonEmptyString(source.kind) || getDefaultSourceType(sourcePresets);
  const mode = asNonEmptyString(source.mode) || getDefaultMode(sourcePresets, kind);
  const drafts = toRecord(source.drafts);
  const defaultPreset = getDefaultYoutubePreset(sourcePresets);
  const youtubePreset = asNonEmptyString(drafts.youtubePreset) || defaultPreset;

  return {
    schemaVersion:
      typeof toRecord(rawValue).schemaVersion === "number"
        ? toRecord(rawValue).schemaVersion
        : PROJECT_SCHEMA_VERSION,
    id: asNonEmptyString(toRecord(rawValue).id) || asNonEmptyString(toRecord(rawValue).slug) || buildProjectSlug(new Date().toISOString()),
    slug: asNonEmptyString(toRecord(rawValue).slug) || asNonEmptyString(toRecord(rawValue).id) || buildProjectSlug(new Date().toISOString()),
    name: asNonEmptyString(toRecord(rawValue).name) || buildProjectName(new Date().toISOString()),
    createdAt: asNonEmptyString(toRecord(rawValue).createdAt) || new Date().toISOString(),
    updatedAt: asNonEmptyString(toRecord(rawValue).updatedAt) || new Date().toISOString(),
    source: {
      kind: kind,
      mode: mode,
      status: asNonEmptyString(source.status) || "idle",
      storedPath: asNonEmptyString(source.storedPath),
      storedFileName: asNonEmptyString(source.storedFileName),
      sourceUrl: asNonEmptyString(source.sourceUrl),
      mimeType: asNonEmptyString(source.mimeType),
      routeLabel: asNonEmptyString(source.routeLabel),
      lastError: asNonEmptyString(source.lastError),
      metadata: normalizeSourceMetadata(source.metadata),
      metadataError: asNonEmptyString(source.metadataError),
      drafts: {
        urlInput: asNonEmptyString(drafts.urlInput) || "",
        youtubeUrl: asNonEmptyString(drafts.youtubeUrl) || "",
        fileNameHint: asNonEmptyString(drafts.fileNameHint) || "",
        youtubePreset: youtubePreset,
        youtubeCustom: {
          ...getPresetDefaultCustomValues(sourcePresets, youtubePreset),
          ...toRecord(drafts.youtubeCustom),
        },
      },
    },
    edit: normalizeEditState(toRecord(rawValue).edit, editPresets, kind),
    profile: normalizeProfileState(
      toRecord(rawValue).profile,
      profilePresets,
      profileModels,
      profileCapabilities,
      kind
    ),
    audioAnalysis: clone(toRecord(rawValue).audioAnalysis),
    subtitleAnalysis: normalizeSubtitleAnalysisState(toRecord(rawValue).subtitleAnalysis, subtitleRuntime || {}),
    process: normalizeProcessState(toRecord(rawValue).process),
    report: normalizeReportState(toRecord(rawValue).report),
  };
}

function updateProjectTimestamps(project) {
  project.updatedAt = new Date().toISOString();
  return project;
}

function findProject(runtime, projectId) {
  return runtime.projects.find(function (project) {
    return project.id === projectId;
  });
}

function getActiveProject(runtime) {
  return findProject(runtime, runtime.activeProjectId) || null;
}

function toFileUrl(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return null;
  }

  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    return encodeURI(`file://${normalized}`);
  }
  return encodeURI(`file:///${normalized}`);
}

function serializeProjectSummary(project) {
  return laboratoryRoomSnapshotRuntime.serializeProjectSummary(project);
}

function serializeProject(project, runtime) {
  return laboratoryRoomSnapshotRuntime.serializeProject(project, runtime);
}

function buildEditManifest(project) {
  const edit = toRecord(project.edit);
  const preview = toRecord(edit.preview);
  const outputs = Array.isArray(edit.outputs) ? edit.outputs.map(normalizeEditOutput) : [];

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: project.id,
    updatedAt: project.updatedAt,
    sourceKind: project.source.kind,
    handoffMode: asNonEmptyString(edit.handoffMode) || "source",
    activeOutputId: asNonEmptyString(edit.activeOutputId),
    preview: {
      status: asNonEmptyString(preview.status) || "idle",
      path: asNonEmptyString(preview.path),
      fileName: asNonEmptyString(preview.fileName),
      recipeSignature: asNonEmptyString(preview.recipeSignature),
      metadata: normalizeSourceMetadata(preview.metadata),
      artifacts: Array.isArray(preview.artifacts) ? preview.artifacts.map(toRecord) : [],
      updatedAt: asNonEmptyString(preview.updatedAt),
    },
    outputs: outputs.map(function (entry) {
      return {
        id: entry.id,
        path: entry.path,
        fileName: entry.fileName,
        kind: entry.kind,
        label: entry.label,
        recipeSignature: entry.recipeSignature,
        createdAt: entry.createdAt,
        metadata: normalizeSourceMetadata(entry.metadata),
        artifacts: Array.isArray(entry.artifacts) ? entry.artifacts.map(toRecord) : [],
      };
    }),
  };
}

function buildProfileManifest(project) {
  const profile = toRecord(project.profile);

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: project.id,
    updatedAt: project.updatedAt,
    targetAssetMode: asNonEmptyString(profile.targetAssetMode) || "source",
    targetOutputId: asNonEmptyString(profile.targetOutputId),
    targetAssetSignature: asNonEmptyString(profile.targetAssetSignature),
    depth: asNonEmptyString(profile.depth) || "balanced",
    sensitivity: asNumber(profile.sensitivity),
    frameSampleDensity: asNonEmptyString(profile.frameSampleDensity) || "balanced",
    transcriptSampleSeconds: asNumber(profile.transcriptSampleSeconds),
    activePresetId: asNonEmptyString(profile.activePresetId),
    artifactPreferences: clone(toRecord(profile.artifactPreferences)),
    preflight: clone(toRecord(profile.preflight)),
    signals: Array.isArray(profile.signals) ? profile.signals.map(normalizeProfileSignal) : [],
    artifacts: Array.isArray(profile.artifacts) ? profile.artifacts.map(normalizeProfileArtifact) : [],
  };
}

function buildProcessManifest(project) {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: project.id,
    updatedAt: project.updatedAt,
    process: normalizeProcessState(project.process),
  };
}

function buildReportManifest(project) {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: project.id,
    updatedAt: project.updatedAt,
    report: normalizeReportState(project.report),
  };
}

function buildSourceTargetSignature(project) {
  const source = toRecord(project.source);
  const metadata = normalizeSourceMetadata(source.metadata);

  return JSON.stringify({
    mode: "source",
    kind: asNonEmptyString(source.kind) || "video",
    path: asNonEmptyString(source.storedPath),
    fileName: asNonEmptyString(source.storedFileName),
    mimeType: asNonEmptyString(source.mimeType),
    durationSeconds: asNumber(toRecord(metadata).durationSeconds),
    sizeBytes: asNumber(toRecord(metadata).sizeBytes),
    updatedAt: asNonEmptyString(project.updatedAt),
  });
}

function buildDerivedTargetSignature(output) {
  const entry = normalizeEditOutput(output);
  const metadata = normalizeSourceMetadata(entry.metadata);

  return JSON.stringify({
    mode: "derived",
    outputId: entry.id,
    path: asNonEmptyString(entry.path),
    fileName: asNonEmptyString(entry.fileName),
    mimeType: asNonEmptyString(entry.mimeType),
    recipeSignature: asNonEmptyString(entry.recipeSignature),
    durationSeconds: asNumber(toRecord(metadata).durationSeconds),
    sizeBytes: asNumber(toRecord(metadata).sizeBytes),
    createdAt: asNonEmptyString(entry.createdAt),
  });
}

function findEditOutputById(project, outputId) {
  const targetId = asNonEmptyString(outputId);
  if (targetId === null) {
    return null;
  }

  return (
    (Array.isArray(toRecord(project.edit).outputs) ? project.edit.outputs : []).find(function (entry) {
      return asNonEmptyString(toRecord(entry).id) === targetId;
    }) || null
  );
}

function resolveProfileTarget(project) {
  return mediaProfileProjectionRuntime.resolveProfileTarget(project);
}

function getProfileDepthConfig(runtime, depthId) {
  return mediaProfileStateRuntime.getProfileDepthConfig(runtime, depthId);
}

function getProfileFrameDensityRuntimeConfig(runtime, densityId) {
  return mediaProfileStateRuntime.getProfileFrameDensityRuntimeConfig(runtime, densityId);
}

function getCurrentRuntimePlatformKey(runtime) {
  return mediaProfileModelRuntime.getCurrentRuntimePlatformKey(runtime);
}

function evaluateProfileModelCompatibility(runtime, descriptor, whisperSummary) {
  return mediaProfileModelRuntime.evaluateProfileModelCompatibility(runtime, descriptor, whisperSummary);
}

function getEnabledProfileLaneIds(runtime, project) {
  return mediaProfileStateRuntime.getEnabledProfileLaneIds(runtime, project);
}

function buildProfileToolSummary(runtime, toolId, supportLevel) {
  return mediaProfileModelRuntime.buildProfileToolSummary(runtime, toolId, supportLevel);
}

function buildProfileModelSummary(runtime, project) {
  return mediaProfileModelRuntime.buildProfileModelSummary(runtime, project);
}

function buildProfileReadiness(runtime, project) {
  return mediaProfileProjectionRuntime.buildProfileReadiness(runtime, project);
}

function buildProfileEstimate(runtime, project, readiness) {
  return mediaProfileProjectionRuntime.buildProfileEstimate(runtime, project, readiness);
}

function syncProjectProfileProjection(runtime, project) {
  return mediaProfileProjectionRuntime.syncProjectProfileProjection(runtime, project);
}

function syncProjectFeatureProjections(runtime, project) {
  syncProjectProfileProjection(runtime, project);
  syncProjectAudioAnalysisProjection(runtime, project);
  syncProjectSubtitleAnalysisProjection(runtime, project);
  return project;
}

const laboratoryRoomSnapshotRuntime = createLaboratoryRoomSnapshotRuntime({
  asNonEmptyString,
  clone,
  defaultFeatureId: FEATURE_ID,
  featureIds: FEATURE_IDS,
  mediaStages: MEDIA_STAGES,
  audioFeatureId: AUDIO_FEATURE_ID,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  getFeatureProcessRecord,
  getFeatureReportRecord,
  getRuntimeToolIds,
  getStageSupport,
  getToolManifest,
  mediaFeatureId: FEATURE_ID,
  normalizeAudioAnalysisModuleResult,
  normalizeAudioAnalysisState,
  normalizeSubtitleAnalysisState,
  roomId: ROOM_ID,
  syncProjectFeatureProjections,
  toFileUrl,
  toRecord,
});

function buildMediaSnapshot(runtime, featureId) {
  return laboratoryRoomSnapshotRuntime.buildMediaSnapshot(runtime, featureId);
}

function buildSourceSnapshot(runtime) {
  return laboratoryRoomSnapshotRuntime.buildMediaSnapshot(runtime, FEATURE_ID);
}

function notifyRoom(api, type, payload) {
  api.notifyRoom(type, payload || {});
}

function isSourceCompatibleAction(action) {
  const actionId = asNonEmptyString(action);
  if (actionId === null) {
    return true;
  }
  return (
    actionId === "refresh" ||
    actionId === "tools-refresh" ||
    actionId.startsWith("source-") ||
    actionId.startsWith("subtitle-source-") ||
    actionId.startsWith("project-") ||
    actionId.startsWith("tool-")
  );
}

function pushMediaState(api, runtime, requestId, action) {
  const featureId = getFeatureIdFromContext(loadContext(api));
  const payload = {
    requestId: requestId || null,
    action: action || null,
    snapshot: buildMediaSnapshot(runtime, featureId),
  };

  notifyRoom(api, "media-state", payload);
  if (isSourceCompatibleAction(action)) {
    notifyRoom(api, "source-state", payload);
  }
}

function pushSourceState(api, runtime, requestId, action) {
  pushMediaState(api, runtime, requestId, action);
}

function pushActionResult(api, payload) {
  notifyRoom(api, "media-action-result", payload);
  if (isSourceCompatibleAction(payload && payload.action)) {
    notifyRoom(api, "source-action-result", payload);
  }
}

function pushJobState(api, payload) {
  notifyRoom(api, "media-job", payload);
  if (isSourceCompatibleAction(payload && payload.action)) {
    notifyRoom(api, "source-job", payload);
  }
}

async function loadRuntimeConfigs(api, runtime) {
  return laboratoryProjectLifecycleRuntime.loadRuntimeConfigs(api, runtime);
}

async function loadProjects(runtime) {
  return laboratoryProjectLifecycleRuntime.loadProjects(runtime);
}

async function saveProject(runtime, project) {
  return laboratoryProjectLifecycleRuntime.saveProject(runtime, project);
}

async function persistToolState(runtime) {
  return laboratoryProjectLifecycleRuntime.persistToolState(runtime);
}

async function persistProfileModelState(runtime) {
  return laboratoryProjectLifecycleRuntime.persistProfileModelState(runtime);
}

async function loadToolState(runtime) {
  return laboratoryProjectLifecycleRuntime.loadToolState(runtime);
}

async function loadProfileModelState(runtime) {
  return laboratoryProjectLifecycleRuntime.loadProfileModelState(runtime);
}

function getProfileModelDescriptorMap(runtime) {
  return toRecord(toRecord(runtime.profileModels).models);
}

function getProfileModelDescriptor(runtime, modelId) {
  return toRecord(getProfileModelDescriptorMap(runtime)[modelId]);
}

async function refreshProfileModelState(runtime) {
  return mediaProfileModelRuntime.refreshProfileModelStateWithStorage(runtime);
}

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
  createProjectRecord,
  defaultFeatureId: FEATURE_ID,
  ensureProjectDirectories,
  findProject,
  getActiveProject,
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
  normalizeProject,
  readJsonFile,
  refreshProfileModelState,
  roomId: ROOM_ID,
  syncProjectFeatureProjections,
  toRecord,
  updateProjectTimestamps,
  writeJsonFile,
});

async function ensureProjectExists(runtime, featureId) {
  return laboratoryProjectLifecycleRuntime.ensureProjectExists(runtime, featureId);
}

async function refreshToolStatus(runtime, options) {
  return laboratoryProjectLifecycleRuntime.refreshToolStatus(runtime, options);
}

async function ensureHydrated(api, runtime) {
  return laboratoryProjectLifecycleRuntime.ensureHydrated(api, runtime);
}

function createRequestId() {
  return `lab-source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateProjectInMemory(runtime, nextProject) {
  return laboratoryProjectLifecycleRuntime.updateProjectInMemory(runtime, nextProject);
}

async function patchActiveProject(runtime, updater) {
  return laboratoryProjectLifecycleRuntime.patchActiveProject(runtime, updater);
}

async function patchActiveProjectDrafts(runtime, fields) {
  return laboratoryProjectLifecycleRuntime.patchActiveProjectDrafts(runtime, fields);
}

async function refreshActiveProjectMetadata(runtime, requestId) {
  return mediaSourceMetadataRuntime.refreshActiveProjectMetadata(runtime, requestId);
}

async function createProject(runtime, featureId) {
  return laboratoryProjectLifecycleRuntime.createProject(runtime, featureId);
}

async function deleteProject(runtime, projectId, requestId, featureId) {
  return laboratoryProjectLifecycleRuntime.deleteProject(runtime, projectId, requestId, featureId);
}

function updateProfileModelEntry(runtime, modelId, patch) {
  runtime.profileModelState.models[modelId] = {
    ...createDefaultProfileModelEntry(modelId),
    ...toRecord(toRecord(runtime.profileModelState).models)[modelId],
    ...toRecord(patch),
    modelId: modelId,
  };
  return runtime.profileModelState.models[modelId];
}

function updateProfileModelBusy(runtime, modelId, busy, lastError) {
  return updateProfileModelEntry(runtime, modelId, {
    busy: busy === true,
    lastError: lastError || null,
  });
}

const mediaProfileModelRuntime = createMediaProfileModelRuntime({
  asNonEmptyString,
  asNumber,
  callRoomTools,
  clearJob,
  createDefaultProfileModelEntry,
  digestSha1,
  ensureRuntimeDirectory,
  getActiveProject,
  getProfileModelDescriptor,
  getProfileModelDescriptorMap,
  getProfileModelsDir,
  getStageSupport,
  getToolManifest,
  listDirectory,
  persistProfileModelState,
  pushJobState,
  readBinaryFileBytes,
  refreshProfileModelState,
  registerJob,
  roomId: ROOM_ID,
  toRecord,
  updateProfileModelBusy,
  updateProfileModelEntry,
});

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
  toRecord,
});
const laboratoryProcessReportStateRuntime = createLaboratoryProcessReportStateRuntime({
  asNonEmptyString,
  asNumber,
  featureIds: FEATURE_IDS,
  normalizeProfileArtifact,
  normalizeProfileSignal,
  toRecord,
});
const {
  createEmptyFeatureProcessRecord,
  createEmptyProcessState,
  normalizeProcessArtifact,
  normalizeProcessFinding,
  normalizeProcessModule,
  normalizeFeatureProcessRecord,
  normalizeProcessState,
  createEmptyFeatureReportRecord,
  createEmptyReportState,
  normalizeReportSummaryCard,
  normalizeReportExport,
  normalizeFeatureReportRecord,
  normalizeReportState,
  getFeatureProcessRecord,
  setFeatureProcessRecord,
  getFeatureReportRecord,
  setFeatureReportRecord,
} = laboratoryProcessReportStateRuntime;

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
  getProfileModelDescriptorMap,
  getStageSupport,
  getToolManifest,
  normalizeEditOutput,
  normalizeProfileArtifactPreferences,
  normalizeProfileState,
  normalizeSourceMetadata,
  toRecord,
});

async function verifyProfileModel(runtime, modelId) {
  return mediaProfileModelRuntime.verifyProfileModel(runtime, modelId);
}

async function installProfileModel(api, runtime, requestId, modelId) {
  return mediaProfileModelRuntime.installProfileModel(api, runtime, requestId, modelId);
}

async function removeProfileModel(runtime, requestId, modelId) {
  return mediaProfileModelRuntime.removeProfileModel(runtime, requestId, modelId);
}

function resetProfileForCurrentSource(runtime, nextProject, reason) {
  const previousMode = asNonEmptyString(toRecord(nextProject.profile).mode);
  const previousPresetId = asNonEmptyString(toRecord(nextProject.profile).activePresetId);
  const nextProfile = createDefaultProfileState(
    runtime.profilePresets,
    runtime.profileModels,
    runtime.profileCapabilities,
    nextProject.source.kind
  );

  if (previousMode === "advanced") {
    nextProfile.mode = "advanced";
  }
  if (findProfilePreset(runtime.profilePresets, nextProject.source.kind, previousPresetId) !== null) {
    nextProfile.activePresetId = previousPresetId;
  }

  nextProfile.dirty = true;
  nextProfile.lastError = null;
  nextProfile.lastActionAt = new Date().toISOString();
  nextProfile.preflight = {
    ...createEmptyProfilePreflight(),
    status: "idle",
    warnings: reason ? [reason] : [],
  };
  nextProject.profile = nextProfile;
  markCloseoutAsStale(nextProject, reason || "Source media changed.");
}

function markProfileAsStale(nextProject, reason, options) {
  const profile = toRecord(nextProject.profile);
  const preflight = toRecord(profile.preflight);
  nextProject.profile = {
    ...profile,
    dirty: true,
    targetOutputId:
      options && options.clearTargetOutput === true ? null : asNonEmptyString(profile.targetOutputId),
    targetAssetSignature: null,
    lastError: null,
    lastActionAt: new Date().toISOString(),
    preflight: {
      ...createEmptyProfilePreflight(),
      ...preflight,
      status: asNonEmptyString(preflight.ranAt) !== null ? "stale" : "idle",
      jobId: null,
      requestId: null,
      error: null,
      warnings: Array.from(
        new Set(
          (Array.isArray(preflight.warnings) ? preflight.warnings : []).concat(reason ? [reason] : [])
        )
      ),
    },
  };
  markCloseoutAsStale(nextProject, reason, [FEATURE_ID]);
}

function getActiveProfileJobs(runtime, projectId, actionId) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      return {
        jobId: jobId,
        ...toRecord(runtime.jobs[jobId]),
      };
    })
    .filter(function (job) {
      return (
        job.projectId === projectId &&
        String(job.action || "").startsWith("profile-") &&
        (actionId ? job.action === actionId : true)
      );
    });
}

function ensureProfileJobSlotAvailable(runtime, projectId, actionId) {
  const activeJobs = getActiveProfileJobs(runtime, projectId, actionId);
  if (activeJobs.length > 0) {
    throw new Error("This profile job is already running. Cancel it before starting another one.");
  }
}

async function cancelProfileJobsForProject(api, runtime, projectId, requestId, actionId) {
  const activeJobs = getActiveProfileJobs(runtime, projectId, actionId);
  for (let index = 0; index < activeJobs.length; index += 1) {
    const job = activeJobs[index];
    await cancelRoomTool(ROOM_ID, job.jobId, requestId);
    pushJobState(api, {
      requestId: requestId,
      jobId: job.jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: "profile",
      stage: "cancelled",
      message: "Cancelled by operator.",
    });
    clearJob(runtime, job.jobId);
  }
  return activeJobs;
}

function registerJob(runtime, options) {
  runtime.jobs[options.jobId] = {
    requestId: options.requestId || null,
    action: options.action,
    projectId: options.projectId || null,
    toolId: options.toolId || null,
    featureStage: options.featureStage || null,
    stage: "queued",
    percent: null,
    message: null,
  };
  return runtime.jobs[options.jobId];
}

function clearJob(runtime, jobId) {
  delete runtime.jobs[jobId];
}

async function cancelJobsForProject(runtime, projectId, requestId) {
  const jobIds = Object.keys(runtime.jobs);
  for (let index = 0; index < jobIds.length; index += 1) {
    const jobId = jobIds[index];
    const job = runtime.jobs[jobId];
    if (job && job.projectId === projectId) {
      await cancelRoomTool(ROOM_ID, jobId, requestId);
      clearJob(runtime, jobId);
    }
  }
}

function normalizeMimeType(fileName, kind) {
  const lowerName = String(fileName || "").toLowerCase();
  if (kind === "audio") {
    if (lowerName.endsWith(".m4a")) return "audio/mp4";
    if (lowerName.endsWith(".wav")) return "audio/wav";
    if (lowerName.endsWith(".flac")) return "audio/flac";
    if (lowerName.endsWith(".ogg")) return "audio/ogg";
    if (lowerName.endsWith(".aac")) return "audio/aac";
    return "audio/mpeg";
  }
  if (kind === "image") {
    if (lowerName.endsWith(".png")) return "image/png";
    if (lowerName.endsWith(".webp")) return "image/webp";
    if (lowerName.endsWith(".gif")) return "image/gif";
    if (lowerName.endsWith(".bmp")) return "image/bmp";
    return "image/jpeg";
  }
  if (lowerName.endsWith(".webm")) return "video/webm";
  if (lowerName.endsWith(".mov")) return "video/quicktime";
  if (lowerName.endsWith(".mkv")) return "video/x-matroska";
  if (lowerName.endsWith(".avi")) return "video/x-msvideo";
  if (lowerName.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

function stripMimeParameters(value) {
  const rawValue = asNonEmptyString(value);
  if (rawValue === null) {
    return null;
  }

  const normalized = rawValue.split(";")[0].trim().toLowerCase();
  return normalized || null;
}

function getFileExtension(fileName) {
  const rawValue = asNonEmptyString(fileName);
  if (rawValue === null) {
    return null;
  }

  const match = rawValue.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

function getSupportedMimeTypes(sourcePresets, kind) {
  const sourceConfig = getSourceConfig(sourcePresets, kind);
  return toRecord(sourceConfig).supportedMimeTypes instanceof Array
    ? toRecord(sourceConfig).supportedMimeTypes
        .map(stripMimeParameters)
        .filter(Boolean)
    : [];
}

function getSupportedExtensions(sourcePresets, kind) {
  const sourceConfig = getSourceConfig(sourcePresets, kind);
  const filters = Array.isArray(sourceConfig.fileDialogFilters) ? sourceConfig.fileDialogFilters : [];
  const values = [];

  filters.forEach(function (filter) {
    if (!filter || Array.isArray(filter.extensions) === false) {
      return;
    }

    filter.extensions.forEach(function (extension) {
      const normalized = asNonEmptyString(extension);
      if (normalized) {
        values.push(normalized.toLowerCase().replace(/^\./, ""));
      }
    });
  });

  return Array.from(new Set(values));
}

function validateSourceCandidate(runtime, kind, storedFileName, mimeType) {
  const normalizedMimeType = stripMimeParameters(mimeType);
  const normalizedExtension = getFileExtension(storedFileName);
  const supportedMimeTypes = getSupportedMimeTypes(runtime.sourcePresets, kind);
  const supportedExtensions = getSupportedExtensions(runtime.sourcePresets, kind);
  const extensionMatches =
    normalizedExtension !== null && supportedExtensions.includes(normalizedExtension);
  const mimeMatches =
    normalizedMimeType !== null &&
    (supportedMimeTypes.includes(normalizedMimeType) || normalizedMimeType.startsWith(`${kind}/`));

  if (
    normalizedMimeType === "text/html" ||
    normalizedMimeType === "application/xhtml+xml" ||
    normalizedMimeType === "text/plain"
  ) {
    return {
      valid: false,
      error: `Saved file is ${normalizedMimeType}, not a supported ${kind} source.`,
    };
  }

  if (mimeMatches || extensionMatches) {
    return {
      valid: true,
      mimeType:
        mimeMatches && normalizedMimeType !== null
          ? normalizedMimeType
          : normalizeMimeType(storedFileName, kind),
    };
  }

  if (normalizedMimeType === "application/octet-stream" && extensionMatches) {
    return {
      valid: true,
      mimeType: normalizeMimeType(storedFileName, kind),
    };
  }

  return {
    valid: false,
    error: `Saved file is not a supported ${kind} source.`,
  };
}

function findCompanionExecutableName(toolEntry, baseName) {
  const companionPaths = toRecord(toRecord(toolEntry).companionPaths);
  const keys = Object.keys(companionPaths);
  const match = keys.find(function (key) {
    return key.toLowerCase() === baseName.toLowerCase() || key.toLowerCase().startsWith(`${baseName.toLowerCase()}.`);
  });
  return match || null;
}

async function deleteOwnedSourceFile(filePath, requestId) {
  return mediaSourceMetadataRuntime.deleteOwnedSourceFile(filePath, requestId);
}

async function collectStoredSourceMetadata(runtime, project, options) {
  return mediaSourceMetadataRuntime.collectStoredSourceMetadata(runtime, project, options);
}

async function resolvePreparedSource(runtime, project, options) {
  return mediaSourceMetadataRuntime.resolvePreparedSource(runtime, project, options);
}

function deriveFilename(urlValue, kind, hint) {
  const hintValue = asNonEmptyString(hint);
  if (hintValue) {
    return hintValue;
  }

  try {
    const parsed = new URL(urlValue);
    const pathname = decodeURIComponent(parsed.pathname || "");
    const rawName = pathname.split("/").filter(Boolean).pop();
    if (rawName && rawName.indexOf(".") > 0) {
      return rawName;
    }
  } catch (_error) {
    // noop
  }

  if (kind === "audio") return "downloaded-audio.mp3";
  if (kind === "image") return "downloaded-image.jpg";
  return "downloaded-video.mp4";
}

function sanitizeFileSegment(value, fallback) {
  return mediaEditSupportRuntime.sanitizeFileSegment(value, fallback);
}

function getPreparedSourcePath(project) {
  return mediaEditSupportRuntime.getPreparedSourcePath(project);
}

function requirePreparedSource(project) {
  return mediaEditSupportRuntime.requirePreparedSource(project);
}

function getDerivedMimeType(kind) {
  return mediaEditSupportRuntime.getDerivedMimeType(kind);
}

function getEditRecipeSignature(project) {
  return mediaEditSupportRuntime.getEditRecipeSignature(project);
}

function clampNumber(value, minimum, maximum, fallback) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) !== true) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, numericValue));
}

function buildEditCommand(runtime, project, outputPath, mode) {
  return mediaEditSupportRuntime.buildEditCommand(runtime, project, outputPath, mode);
}

function buildEditTargetPath(runtime, project, mode) {
  return mediaEditSupportRuntime.buildEditTargetPath(runtime, project, mode);
}

function buildEditOutputLabel(project, mode) {
  return mediaEditSupportRuntime.buildEditOutputLabel(project, mode);
}

function resetEditForCurrentSource(runtime, nextProject) {
  return mediaEditSupportRuntime.resetEditForCurrentSource(runtime, nextProject);
}

function findEditPreset(runtime, project, presetId) {
  return mediaEditSupportRuntime.findEditPreset(runtime, project, presetId);
}

function applyEditRecipePatch(runtime, nextProject, patch, options) {
  return mediaEditSupportRuntime.applyEditRecipePatch(runtime, nextProject, patch, options);
}

async function collectDerivedOutputMetadata(runtime, project, options) {
  return mediaSourceMetadataRuntime.collectDerivedOutputMetadata(runtime, project, options);
}

function getActiveEditJobs(runtime, projectId, actionId) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      return {
        jobId: jobId,
        ...toRecord(runtime.jobs[jobId]),
      };
    })
    .filter(function (job) {
      return (
        job.projectId === projectId &&
        String(job.action || "").startsWith("edit-") &&
        (actionId ? job.action === actionId : true)
      );
    });
}

function ensureEditJobSlotAvailable(runtime, projectId, actionId) {
  const activeJobs = getActiveEditJobs(runtime, projectId, actionId);
  if (activeJobs.length > 0) {
    throw new Error("This edit job is already running. Cancel it before starting another one.");
  }
}

async function cancelEditJobsForProject(api, runtime, projectId, requestId, actionId) {
  const activeJobs = getActiveEditJobs(runtime, projectId, actionId);
  for (let index = 0; index < activeJobs.length; index += 1) {
    const job = activeJobs[index];
    await cancelRoomTool(ROOM_ID, job.jobId, requestId);
    pushJobState(api, {
      requestId: requestId,
      jobId: job.jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: job.featureStage || "edit",
      stage: "cancelled",
      message: "Cancelled by operator.",
    });
    clearJob(runtime, job.jobId);
  }
  return activeJobs;
}

function getActiveProcessJobs(runtime, projectId, actionId) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      return {
        jobId: jobId,
        ...toRecord(runtime.jobs[jobId]),
      };
    })
    .filter(function (job) {
      return (
        job.projectId === projectId &&
        String(job.featureStage || "") === "process" &&
        (actionId ? job.action === actionId : true)
      );
    });
}

function ensureProcessJobSlotAvailable(runtime, projectId, actionId) {
  const activeJobs = getActiveProcessJobs(runtime, projectId, actionId);
  if (activeJobs.length > 0) {
    throw new Error("This process job is already running. Cancel it before starting another one.");
  }
}

async function cancelProcessJobsForProject(api, runtime, projectId, requestId, actionId) {
  const activeJobs = getActiveProcessJobs(runtime, projectId, actionId);
  for (let index = 0; index < activeJobs.length; index += 1) {
    const job = activeJobs[index];
    await cancelRoomTool(ROOM_ID, job.jobId, requestId);
    pushJobState(api, {
      requestId: requestId,
      jobId: job.jobId,
      action: job.action,
      projectId: job.projectId,
      toolId: job.toolId,
      featureStage: "process",
      stage: "cancelled",
      message: "Cancelled by operator.",
    });
    clearJob(runtime, job.jobId);
  }
  return activeJobs;
}

function getActiveReportJobs(runtime, projectId, actionId) {
  return Object.keys(runtime.jobs)
    .map(function (jobId) {
      return {
        jobId: jobId,
        ...toRecord(runtime.jobs[jobId]),
      };
    })
    .filter(function (job) {
      return (
        job.projectId === projectId &&
        String(job.featureStage || "") === "report" &&
        (actionId ? job.action === actionId : true)
      );
    });
}

function ensureReportJobSlotAvailable(runtime, projectId, actionId) {
  const activeJobs = getActiveReportJobs(runtime, projectId, actionId);
  if (activeJobs.length > 0) {
    throw new Error("This report job is already running. Wait for it or cancel it first.");
  }
}

function buildArtifactEntry(filePath, kind) {
  const normalizedPath = asNonEmptyString(filePath);
  if (normalizedPath === null) {
    return null;
  }
  return {
    kind: kind,
    path: normalizedPath,
    fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
  };
}

async function listArtifactsWithPrefix(dirPath, filePrefix) {
  const entries = await listDirectory(dirPath);
  return entries
    .filter(function (entry) {
      return entry && entry.isDirectory !== true && String(entry.name || "").startsWith(filePrefix);
    })
    .map(function (entry) {
      return entry.path;
    })
    .sort();
}

async function buildAuxiliaryArtifacts(runtime, project, options) {
  const artifactDir =
    options.mode === "preview"
      ? getProjectEditPreviewDir(runtime, project)
      : getProjectEditOutputDir(runtime, project);

  if (project.source.kind === "audio") {
    if (toRecord(toRecord(toRecord(project.edit).recipe).audio).spectrogram !== true) {
      return [];
    }
    const artifactBase = options.baseName;
    const spectrogramPath = `${artifactDir}/${artifactBase}-spectrogram.png`;

    await callRoomTools({
      operation: "tool-run",
      roomId: ROOM_ID,
      requestId: options.requestId || null,
      jobId: options.jobId || null,
      toolId: "ffmpeg",
      cwd: getProjectEditDir(runtime, project),
      args: [
        "-y",
        "-i",
        options.outputPath,
        "-lavfi",
        "showspectrumpic=s=1600x480:legend=0",
        "-frames:v",
        "1",
        spectrogramPath,
      ],
      timeoutMs: 60_000,
    });

    return [buildArtifactEntry(spectrogramPath, "spectrogram")].filter(Boolean);
  }

  if (project.source.kind === "video" && options.mode === "apply") {
    const frameGrabCount = clampNumber(
      toRecord(toRecord(toRecord(project.edit).recipe).video).frameGrabCount,
      0,
      24,
      0
    );
    const durationSeconds =
      asNumber(toRecord(options.metadata).durationSeconds) ||
      asNumber(toRecord(toRecord(project.source).metadata).durationSeconds);
    if (frameGrabCount > 0 && durationSeconds && durationSeconds > 0) {
      const framePattern = `${artifactDir}/${options.baseName}-frame-%03d.jpg`;
      const fpsValue = Math.max(0.2, frameGrabCount / durationSeconds);

      await callRoomTools({
        operation: "tool-run",
        roomId: ROOM_ID,
        requestId: options.requestId || null,
        jobId: options.jobId || null,
        toolId: "ffmpeg",
        cwd: getProjectEditDir(runtime, project),
        args: [
          "-y",
          "-i",
          options.outputPath,
          "-vf",
          `fps=${fpsValue}`,
          "-frames:v",
          String(frameGrabCount),
          framePattern,
        ],
        timeoutMs: 60_000,
      });

      const createdFrames = await listArtifactsWithPrefix(
        artifactDir,
        `${options.baseName}-frame-`
      );
      return createdFrames
        .map(function (filePath) {
          return buildArtifactEntry(filePath, "frame");
        })
        .filter(Boolean);
    }
  }

  return [];
}

function ensureEditToolReady(runtime) {
  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  if (ffmpegState.installed !== true) {
    throw new Error("Install FFmpeg in settings before using the edit stage.");
  }
}

const mediaEditSupportRuntime = createMediaEditSupportRuntime({
  asNonEmptyString,
  asNumber,
  clampNumber,
  createDefaultEditState,
  getFocusRegionCrop,
  getProjectEditOutputDir,
  getProjectEditPreviewDir,
  getResizePresetMap,
  markCloseoutAsStale,
  mergeObjects,
  normalizeSourceMetadata,
  toRecord,
});

const mediaEditPipelineRuntime = createMediaEditPipelineRuntime({
  audioFeatureId: AUDIO_FEATURE_ID,
  buildAuxiliaryArtifacts,
  buildEditCommand,
  buildEditOutputLabel,
  buildEditTargetPath,
  callRoomTools,
  clearJob,
  collectDerivedOutputMetadata,
  ensureEditJobSlotAvailable,
  ensureEditToolReady,
  ensureProjectDirectories,
  getActiveProject,
  getDerivedMimeType,
  getEditRecipeSignature,
  getPreparedSourcePath,
  getProjectEditDir,
  markCloseoutAsStale,
  markProfileAsStale,
  normalizeEditOutput,
  patchActiveProject,
  pushJobState,
  registerJob,
  requirePreparedSource,
  roomId: ROOM_ID,
  toRecord,
});

async function runEditPipeline(api, runtime, requestId, mode) {
  return mediaEditPipelineRuntime.runEditPipeline(api, runtime, requestId, mode);
}

function ensureProfileToolReady(runtime) {
  const ffmpegState = toRecord(runtime.toolState.tools.ffmpeg);
  if (ffmpegState.installed !== true) {
    throw new Error("Install FFmpeg in settings before using the profile stage.");
  }
}

function createProfileArtifact(kind, path, label, metadata) {
  const normalizedPath = asNonEmptyString(path);
  if (normalizedPath === null) {
    return null;
  }

  return normalizeProfileArtifact({
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: kind,
    path: normalizedPath,
    fileName: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
    label: label,
    createdAt: new Date().toISOString(),
    metadata: toRecord(metadata),
  });
}

function createProfileSignal(laneId, kind, level, confidence, title, detail, evidenceCount, artifactIds) {
  return normalizeProfileSignal({
    id: `${laneId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    laneId: laneId,
    kind: kind,
    level: level,
    confidence: confidence,
    title: title,
    detail: detail,
    evidenceCount: evidenceCount,
    artifactIds: Array.isArray(artifactIds) ? artifactIds : [],
  });
}

function createProcessArtifact(moduleId, kind, path, label, metadata) {
  const artifact = createProfileArtifact(kind, path, label, metadata);
  if (artifact === null) {
    return null;
  }
  return normalizeProcessArtifact({
    ...artifact,
    moduleId: moduleId,
  });
}

function createProcessFinding(moduleId, kind, level, confidence, title, detail, evidenceCount, artifactIds) {
  return normalizeProcessFinding({
    ...createProfileSignal(moduleId, kind, level, confidence, title, detail, evidenceCount, artifactIds),
    moduleId: moduleId,
  });
}

async function runProfileTool(runtime, options) {
  const runResult = await callRoomTools({
    operation: "tool-run",
    roomId: ROOM_ID,
    requestId: options.requestId || null,
    jobId: options.jobId || null,
    toolId: options.toolId,
    executableName: options.executableName || undefined,
    cwd: options.cwd,
    args: options.args,
    timeoutMs: options.timeoutMs,
  });
  const runPayload = toRecord(runResult.run);
  const exitCode = typeof runPayload.exitCode === "number" ? runPayload.exitCode : 0;
  if (runPayload.cancelled === true || exitCode !== 0) {
    throw new Error(asNonEmptyString(runPayload.stderr) || `${options.toolId} job failed.`);
  }
  return runPayload;
}

async function generateProfileMetadataArtifact(runtime, project, target, artifactBase) {
  const metadataPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-metadata.json`;
  await writeJsonFile(metadataPath, {
    generatedAt: new Date().toISOString(),
    target: {
      requestedMode: target.requestedMode,
      mode: target.mode,
      outputId: target.outputId,
      label: target.label,
      fileName: target.fileName,
      mimeType: target.mimeType,
      path: target.path,
      signature: target.signature,
    },
    metadata: clone(target.metadata || {}),
  });
  return createProfileArtifact("metadata", metadataPath, "Metadata Snapshot", {
    requestedMode: target.requestedMode,
    mode: target.mode,
  });
}

async function generateProfileFrameStrip(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  sampleWindowSeconds,
  tileCount
) {
  const sourceKind = asNonEmptyString(project.source.kind) || "video";
  const outputPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-frames.png`;

  if (sourceKind === "image") {
    await runProfileTool(runtime, {
      requestId: requestId,
      jobId: jobId,
      toolId: "ffmpeg",
      cwd: getProjectProfileDir(runtime, project),
      args: ["-y", "-i", target.path, "-vf", "scale=1280:-1:flags=lanczos", "-frames:v", "1", outputPath],
      timeoutMs: 90_000,
    });
    return createProfileArtifact("frame-strip", outputPath, "Profile Reference Frame", {});
  }

  const normalizedTileCount = Math.max(2, Math.round(asNumber(tileCount) || 4));
  const intervalSeconds = Math.max(1, Math.round((sampleWindowSeconds || 40) / normalizedTileCount));
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProfileDir(runtime, project),
    args: [
      "-y",
      "-i",
      target.path,
      "-vf",
      `fps=1/${intervalSeconds},scale=420:-1:flags=lanczos,tile=${normalizedTileCount}x1`,
      "-frames:v",
      "1",
      outputPath,
    ],
    timeoutMs: 90_000,
  });
  return createProfileArtifact("frame-strip", outputPath, "Frame Strip", {
    tileCount: normalizedTileCount,
    intervalSeconds: intervalSeconds,
  });
}

async function generateProfileSpectrogram(runtime, project, requestId, jobId, target, artifactBase) {
  const outputPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-spectrogram.png`;
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProfileDir(runtime, project),
    args: [
      "-y",
      "-i",
      target.path,
      "-lavfi",
      "showspectrumpic=s=1600x440:legend=0",
      "-frames:v",
      "1",
      outputPath,
    ],
    timeoutMs: 90_000,
  });
  return createProfileArtifact("spectrogram", outputPath, "Spectrogram", {});
}

async function maybeRunWhisperProfileSample(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  transcriptSampleSeconds
) {
  const profileReadiness = toRecord(toRecord(project.profile).readiness);
  const selectedModel =
    (Array.isArray(profileReadiness.models) ? profileReadiness.models : []).find(function (entry) {
      return toRecord(entry).selected === true;
    }) || null;
  if (!selectedModel || selectedModel.ready !== true) {
    return null;
  }

  const modelPath = asNonEmptyString(selectedModel.path);
  if (modelPath === null) {
    return null;
  }

  const language = asNonEmptyString(selectedModel.language) || "en";
  const sampleWavPath = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-speech.wav`;
  const transcriptBase = `${getProjectProfilePreflightDir(runtime, project)}/${artifactBase}-transcript`;
  const transcriptPath = `${transcriptBase}.txt`;

  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "ffmpeg",
    cwd: getProjectProfileDir(runtime, project),
    args: [
      "-y",
      "-i",
      target.path,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-t",
      String(Math.max(5, Math.round(asNumber(transcriptSampleSeconds) || 45))),
      sampleWavPath,
    ],
    timeoutMs: 120_000,
  });
  await runProfileTool(runtime, {
    requestId: requestId,
    jobId: jobId,
    toolId: "whisper.cpp",
    cwd: getProjectProfileDir(runtime, project),
    args: ["-m", modelPath, "-f", sampleWavPath, "-l", language, "-otxt", "-of", transcriptBase],
    timeoutMs: 8 * 60 * 1000,
  });

  const transcriptText = asNonEmptyString(await readTextFile(transcriptPath));
  if (transcriptText === null) {
    return null;
  }

  const artifact = createProfileArtifact("transcript", transcriptPath, "Transcript Sample", {
    wordCount: transcriptText.split(/\s+/).filter(Boolean).length,
    language: language,
  });

  return {
    text: transcriptText,
    artifact: artifact,
  };
}

function buildSyntheticProfileSignal(signals, sensitivity, artifactIds) {
  const score = signals.reduce(function (total, entry) {
    const signal = toRecord(entry);
    const level = asNonEmptyString(signal.level) || "low";
    return total + (level === "high" ? 3 : level === "medium" ? 2 : 1);
  }, 0);
  const threshold = sensitivity >= 0.68 ? 4 : sensitivity >= 0.5 ? 5 : 6;
  if (score < threshold) {
    return null;
  }

  const level = score >= threshold + 3 ? "high" : "medium";
  const confidence = score >= threshold + 2 ? "medium" : "low";
  return createProfileSignal(
    "synthetic-suspicion",
    "derived",
    level,
    confidence,
    "Composite suspicion score elevated",
    "Multiple weak structure, continuity, or audio anomalies overlap in the sampled profile pass.",
    signals.length,
    artifactIds
  );
}

const mediaProfilePreflightRuntime = createMediaProfilePreflightRuntime({
  asNonEmptyString,
  asNumber,
  buildSyntheticProfileSignal,
  clampNumber,
  clampProfileTranscriptSampleSeconds,
  clearJob,
  clone,
  createEmptyProfilePreflight,
  createProfileSignal,
  ensureProfileJobSlotAvailable,
  ensureProfileToolReady,
  ensureProjectDirectories,
  generateProfileFrameStrip,
  generateProfileMetadataArtifact,
  generateProfileSpectrogram,
  getActiveProject,
  getProfileFrameDensityRuntimeConfig,
  maybeRunWhisperProfileSample,
  normalizeProfileArtifactPreferences,
  normalizeSourceMetadata,
  patchActiveProject,
  pushJobState,
  registerJob,
  runAudioStructureProbe,
  runVideoStructureProbe,
  sanitizeFileSegment,
  syncProjectFeatureProjections,
  toRecord,
});

async function runProfilePreflight(api, runtime, requestId) {
  return mediaProfilePreflightRuntime.runProfilePreflight(api, runtime, requestId);
}

function resolveAudioFeatureTarget(project) {
  return audioAnalysisProjectionRuntime.resolveAudioFeatureTarget(project);
}

const laboratoryProcessTargetingRuntime = createLaboratoryProcessTargetingRuntime({
  audioFeatureId: AUDIO_FEATURE_ID,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  asNonEmptyString,
  toRecord,
  normalizeSubtitleAnalysisState,
  getSubtitleSelectedEntries,
  getActiveSubtitleEntry,
  getSubtitleMimeType,
  resolveAudioFeatureTarget,
  resolveProfileTarget,
  normalizeProcessModule,
  buildProfileModelSummary,
});

function resolveProcessTarget(project, featureId) {
  return laboratoryProcessTargetingRuntime.resolveProcessTarget(project, featureId);
}

function buildMediaProcessModules(runtime, project, target) {
  return laboratoryProcessTargetingRuntime.buildMediaProcessModules(runtime, project, target);
}

function getSubtitleAnalysisModuleDescriptors(runtime) {
  const modules = toRecord(runtime.subtitleAnalysisCatalog).modules;
  return Array.isArray(modules) ? modules.map(toRecord) : [];
}

function buildSubtitleProcessModules(runtime, target) {
  return subtitleProcessAnalysisRuntime.buildSubtitleProcessModules(runtime, target);
}

async function buildSubtitleAnalysisStats(runtime, project, target) {
  return subtitleProcessAnalysisRuntime.buildSubtitleAnalysisStats(runtime, project, target);
}

function buildAudioAnalysisModules(runtime, project, target) {
  return audioAnalysisProjectionRuntime.buildAudioAnalysisModules(runtime, project, target);
}

function getAudioAnalysisModulesForRuntime(runtime) {
  const modules = toRecord(runtime.audioAnalysisCatalog).modules;
  return Array.isArray(modules) ? modules.map(toRecord) : [];
}

function buildProcessSpeechAvailability(runtime, project) {
  return laboratoryProcessTargetingRuntime.buildProcessSpeechAvailability(runtime, project);
}

function createEmptyProcessRun(featureId) {
  return createEmptyFeatureProcessRecord(featureId);
}

function updateProcessRecordPercent(record) {
  const modules = Array.isArray(record.modules) ? record.modules.map(toRecord) : [];
  if (modules.length === 0) {
    record.percent = record.status === "ready" ? 100 : 0;
    return record;
  }

  const total = modules.reduce(function (sum, moduleEntry) {
    const status = asNonEmptyString(moduleEntry.status) || "idle";
    if (status === "running" || status === "queued" || status === "idle") {
      return sum + Math.max(0, Math.min(100, Math.round(asNumber(moduleEntry.percent) || 0)));
    }
    return sum + 100;
  }, 0);
  record.percent = Math.max(0, Math.min(100, Math.round(total / modules.length)));
  return record;
}

function updateProcessModule(record, moduleId, patch) {
  const modules = Array.isArray(record.modules) ? record.modules.map(normalizeProcessModule) : [];
  const moduleIndex = modules.findIndex(function (entry) {
    return entry.id === moduleId;
  });
  if (moduleIndex === -1) {
    return record;
  }
  modules[moduleIndex] = normalizeProcessModule({
    ...modules[moduleIndex],
    ...toRecord(patch),
  });
  record.modules = modules;
  return updateProcessRecordPercent(record);
}

function getFeatureProcessJobAction(featureId) {
  return featureId === AUDIO_FEATURE_ID ? "audio-process-run" : "process-run";
}

function getFeatureReportExportAction(featureId) {
  return featureId === AUDIO_FEATURE_ID ? "audio-report-export" : "report-export";
}

function markFeatureProcessStale(project, featureId, reason) {
  const existing = getFeatureProcessRecord(project, featureId);
  setFeatureProcessRecord(project, featureId, {
    ...existing,
    status: existing.completedAt ? "stale" : "idle",
    jobId: null,
    requestId: null,
    runId: existing.runId,
    percent: 0,
    warnings: Array.from(new Set((existing.warnings || []).concat(reason ? [reason] : []))),
    error: null,
  });
  project.process.lastError = null;
  project.process.lastActionAt = new Date().toISOString();
}

function markFeatureReportStale(project, featureId, reason) {
  const existing = getFeatureReportRecord(project, featureId);
  setFeatureReportRecord(project, featureId, {
    ...existing,
    status: existing.generatedAt ? "stale" : "idle",
    warnings: Array.from(new Set((existing.warnings || []).concat(reason ? [reason] : []))),
    error: null,
  });
  project.report.lastError = null;
  project.report.lastActionAt = new Date().toISOString();
}

function markCloseoutAsStale(project, reason, featureIds) {
  const targetFeatures = Array.isArray(featureIds) && featureIds.length > 0 ? featureIds : FEATURE_IDS;
  targetFeatures.forEach(function (featureId) {
    markFeatureProcessStale(project, featureId, reason);
    markFeatureReportStale(project, featureId, reason);
  });
}

async function generateProcessMetadataArtifact(runtime, project, target, artifactBase, outputDir, moduleId) {
  const metadataPath = `${outputDir}/${artifactBase}-metadata.json`;
  await writeJsonFile(metadataPath, {
    generatedAt: new Date().toISOString(),
    target: clone(target),
    metadata: clone(target.metadata || {}),
  });
  return createProcessArtifact(moduleId, "metadata", metadataPath, "Metadata Snapshot", {
    mode: target.mode,
  });
}

const audioAnalysisStateRuntime = createAudioAnalysisStateRuntime({
  asNonEmptyString,
  asNumber,
  audioAnalysisSchemaVersion: AUDIO_ANALYSIS_SCHEMA_VERSION,
  createEmptyAudioAnalysisCatalogState,
  createEmptyAudioAnalysisModuleResult,
  createEmptyAudioAnalysisSourceState,
  getAudioAnalysisModulesForRuntime,
  normalizeAudioAnalysisCapabilityEntry,
  normalizeAudioAnalysisMetric,
  normalizeAudioAnalysisProviderStateEntry,
  normalizeAudioAnalysisRunRecord,
  normalizeProcessArtifact,
  normalizeProcessFinding,
  normalizeReportExport,
  normalizeStringArray,
  toRecord,
});

const audioAnalysisProjectionRuntime = createAudioAnalysisProjectionRuntime({
  asNumber,
  asNonEmptyString,
  audioAnalysisSchemaVersion: AUDIO_ANALYSIS_SCHEMA_VERSION,
  audioFeatureId: AUDIO_FEATURE_ID,
  buildDerivedTargetSignature,
  buildProcessSpeechAvailability,
  buildProfileModelSummary,
  buildSourceTargetSignature,
  findEditOutputById,
  getFeatureProcessRecord,
  getFeatureReportRecord,
  getAudioAnalysisModulesForRuntime,
  getPreferredFeatureSourceKind,
  getStageSupport,
  getToolManifest,
  normalizeAudioAnalysisCapabilityEntry,
  normalizeAudioAnalysisMetric,
  normalizeAudioAnalysisModuleResult,
  normalizeAudioAnalysisProviderStateEntry,
  normalizeAudioAnalysisRunRecord,
  normalizeAudioAnalysisState,
  normalizeEditOutput,
  normalizeProcessArtifact,
  normalizeProcessFinding,
  normalizeProcessModule,
  normalizeReportExport,
  normalizeSourceMetadata,
  normalizeStringArray,
  toRecord,
});

const audioAnalysisProcessRuntime = createAudioAnalysisProcessRuntime({
  asNonEmptyString,
  asNumber,
  buildEmotionHeuristicFromProsody,
  buildProcessSpeechAvailability,
  clone,
  createProcessArtifact,
  createProcessFinding,
  ensureRuntimeDirectory,
  listDirectory,
  maybeRunWhisperProfileSample,
  normalizeProcessArtifact,
  parseAspectralStatsText,
  readJsonFile,
  readTextFile,
  resolveOpenSmileProsodyRuntime,
  runAudioStructureProbe,
  runOpenSmileProsodyExtraction,
  runProfileTool,
  sanitizeFileSegment,
  toRecord,
  writeJsonFile,
});

function getAudioAnalysisModuleProcessDir(runtime, project, moduleId) {
  return audioAnalysisProcessRuntime.getModuleProcessDir(runtime, project, moduleId);
}

function getAudioAnalysisModuleRunner(moduleId) {
  return audioAnalysisProcessRuntime.getModuleRunner(moduleId);
}

async function generateProcessSpectrogram(
  runtime,
  project,
  requestId,
  jobId,
  target,
  artifactBase,
  outputDir,
  moduleId
) {
  return audioAnalysisProcessRuntime.generateProcessSpectrogram(
    runtime,
    project,
    requestId,
    jobId,
    target,
    artifactBase,
    outputDir,
    moduleId
  );
}

async function runManagedProcess(runtime, project, requestId, jobId, featureId) {
  const outputDir = getFeatureProcessDir(runtime, project, featureId);
  return laboratoryProcessRuntime.runManagedProcess(
    runtime,
    project,
    requestId,
    jobId,
    featureId,
    outputDir
  );
}

function getFindingSeverityRank(level) {
  const nextLevel = asNonEmptyString(level) || "low";
  return nextLevel === "high" ? 3 : nextLevel === "medium" ? 2 : 1;
}

function formatIdentifierLabel(value) {
  const token = asNonEmptyString(value) || "item";
  return token
    .split(/[-_]/)
    .filter(Boolean)
    .map(function (segment) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

const laboratoryReportingRuntime = createLaboratoryReportingRuntime({
  asNonEmptyString,
  asNumber,
  clearJob,
  clone,
  createEmptyFeatureReportRecord,
  ensureProjectDirectories,
  ensureReportJobSlotAvailable,
  formatIdentifierLabel,
  getActiveProject,
  getAudioAnalysisModulesForRuntime,
  getFeatureProcessRecord,
  getFeatureReportDir,
  getFeatureReportExportAction,
  getFeatureReportRecord,
  getFindingSeverityRank,
  getSubtitleAnalysisModuleDescriptors,
  getSubtitleSelectedEntries,
  normalizeAudioAnalysisModuleResult,
  normalizeAudioAnalysisState,
  normalizeFeatureReportRecord,
  normalizeProcessArtifact,
  normalizeProcessFinding,
  normalizeProcessModule,
  normalizeReportExport,
  normalizeStringArray,
  patchActiveProject,
  pushJobState,
  registerJob,
  sanitizeFileSegment,
  setFeatureReportRecord,
  syncProjectAudioAnalysisProjection,
  toRecord,
  writeTextFile,
  audioFeatureId: AUDIO_FEATURE_ID,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  mediaFeatureId: FEATURE_ID,
});

const mediaSourceMetadataRuntime = createMediaSourceMetadataRuntime({
  asNumber,
  asNonEmptyString,
  callRoomTools,
  ensureProjectDirectories,
  findCompanionExecutableName,
  getActiveProject,
  getProjectEditDir,
  getProjectSourceDir,
  normalizeSourceMetadata,
  patchActiveProject,
  roomId: ROOM_ID,
  stripMimeParameters,
  toRecord,
  validateSourceCandidate,
});

const mediaActionRuntime = createMediaActionRuntime({
  applyEditRecipePatch,
  applyProfilePresetPatch,
  asNonEmptyString,
  audioFeatureId: AUDIO_FEATURE_ID,
  cancelEditJobsForProject,
  cancelFeatureProcess,
  cancelProfileJobsForProject,
  clampNumber,
  clampProfileTranscriptSampleSeconds,
  createEmptyProfilePreflight,
  createDefaultEditState,
  createProject,
  deleteProject,
  ensureProjectExists,
  exportFeatureReport,
  findEditPreset,
  findProfilePreset,
  getProfileModelDescriptorMap,
  getActiveProject,
  getDefaultMode,
  getDefaultSourceType,
  handleLocalPick,
  handleToolMutation,
  handleUrlDownload,
  handleYoutubeDownload,
  installProfileModel,
  markCloseoutAsStale,
  markProfileAsStale,
  normalizeProfileArtifactPreferences,
  patchActiveProject,
  patchActiveProjectDrafts,
  refreshActiveProjectMetadata,
  refreshToolStatus,
  removeProfileModel,
  resetEditForCurrentSource,
  resetProfileForCurrentSource,
  runFeatureProcess,
  runEditPipeline,
  runProfilePreflight,
  toRecord,
});

const laboratoryToolMutationRuntime = createLaboratoryToolMutationRuntime({
  callRoomTools,
  clearJob,
  createDefaultToolEntry,
  getRuntimeToolIds,
  persistToolState,
  pushJobState,
  refreshProfileModelState,
  registerJob,
  roomId: ROOM_ID,
  toRecord,
});
const laboratoryRoomToolsProgressRuntime = createLaboratoryRoomToolsProgressRuntime({
  roomId: ROOM_ID,
  asNonEmptyString,
  toRecord,
  getElectronApi: getElectronApi,
  pushJobState: pushJobState,
  pushSourceState: pushSourceState,
});

function buildAudioAnalysisReportProjection(runtime, project) {
  return laboratoryReportingRuntime.buildAudioAnalysisReportProjection(runtime, project);
}

function composeAudioAnalysisReport(runtime, project) {
  return laboratoryReportingRuntime.composeAudioAnalysisReport(runtime, project);
}

function getProcessArtifactByKind(processRecord, kind) {
  return laboratoryReportingRuntime.getProcessArtifactByKind(processRecord, kind);
}

function formatReportCardLabel(card) {
  return laboratoryReportingRuntime.formatReportCardLabel(card);
}

function composeSubtitleAnalysisReport(runtime, project) {
  return laboratoryReportingRuntime.composeSubtitleAnalysisReport(runtime, project);
}

function composeFeatureReport(runtime, project, featureId) {
  return laboratoryReportingRuntime.composeFeatureReport(runtime, project, featureId);
}

function buildReportMarkdown(runtime, project, featureId, reportRecord) {
  return laboratoryReportingRuntime.buildReportMarkdown(runtime, project, featureId, reportRecord);
}

const laboratoryProcessRuntime = createLaboratoryProcessRuntime({
  asNonEmptyString,
  buildAudioAnalysisModules,
  buildMediaProcessModules,
  buildProcessSpeechAvailability,
  buildSubtitleAnalysisStats,
  buildSubtitleProcessModules,
  cancelProcessJobsForProject,
  clampProfileTranscriptSampleSeconds,
  clearJob,
  clone,
  composeFeatureReport,
  createEmptyFeatureProcessRecord,
  createEmptyProcessRun,
  createProcessArtifact,
  createProcessFinding,
  ensureEditToolReady,
  ensureProcessJobSlotAvailable,
  ensureProjectDirectories,
  generateProcessMetadataArtifact,
  generateProcessSpectrogram,
  getActiveProject,
  getAudioAnalysisModuleProcessDir,
  getAudioAnalysisModuleRunner,
  getFeatureProcessDir,
  getFeatureProcessJobAction,
  getFeatureProcessRecord,
  getProjectSubtitleProcessDir,
  maybeRunWhisperProfileSample,
  normalizeProcessArtifact,
  normalizeProcessFinding,
  patchActiveProject,
  pushJobState,
  registerJob,
  resolveProcessTarget,
  runAudioStructureProbe,
  runVideoStructureProbe,
  sanitizeFileSegment,
  setFeatureProcessRecord,
  setFeatureReportRecord,
  toRecord,
  updateProcessModule,
  updateProcessRecordPercent,
  writeJsonFile,
  writeTextFile,
  markFeatureReportStale,
  audioFeatureId: AUDIO_FEATURE_ID,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
});

async function runFeatureProcess(api, runtime, requestId, featureId) {
  return laboratoryProcessRuntime.runFeatureProcess(api, runtime, requestId, featureId);
}

async function cancelFeatureProcess(api, runtime, requestId, featureId) {
  return laboratoryProcessRuntime.cancelFeatureProcess(api, runtime, requestId, featureId);
}

async function exportFeatureReport(api, runtime, requestId, featureId) {
  return laboratoryReportingRuntime.exportFeatureReport(api, runtime, requestId, featureId);
}

const mediaSourceIntakeRuntime = createMediaSourceIntakeRuntime({
  asNonEmptyString,
  callRoomTools,
  cancelJobsForProject,
  clearJob,
  deriveFilename,
  getActiveProject,
  getElectronApi,
  getPresetDefaultCustomValues,
  getProjectSourceDir,
  getSourceConfig,
  normalizeMimeType,
  patchActiveProject,
  pushJobState,
  registerJob,
  resetEditForCurrentSource,
  resetProfileForCurrentSource,
  resolvePreparedSource,
  roomId: ROOM_ID,
  toRecord,
});

async function handleLocalPick(api, runtime, requestId) {
  return mediaSourceIntakeRuntime.handleLocalPick(api, runtime, requestId);
}

async function handleUrlDownload(api, runtime, requestId) {
  return mediaSourceIntakeRuntime.handleUrlDownload(api, runtime, requestId);
}

function getResolvedYoutubeSettings(project, sourcePresets) {
  return mediaSourceIntakeRuntime.getResolvedYoutubeSettings(project, sourcePresets);
}

function findYtDlpFinalPath(stdoutValue) {
  return mediaSourceIntakeRuntime.findYtDlpFinalPath(stdoutValue);
}

function buildYtDlpArgs(project, toolState, sourceDir) {
  return mediaSourceIntakeRuntime.buildYtDlpArgs(project, toolState, sourceDir);
}

async function handleYoutubeDownload(api, runtime, requestId) {
  return mediaSourceIntakeRuntime.handleYoutubeDownload(api, runtime, requestId);
}

async function patchActiveSubtitleWorkspaceDrafts(runtime, fields) {
  const patch = toRecord(fields);
  if (Object.keys(patch).length === 0) {
    return getActiveProject(runtime);
  }

  return await patchActiveProject(runtime, function (nextProject) {
    const subtitleState = normalizeSubtitleAnalysisState(toRecord(nextProject).subtitleAnalysis, runtime);
    subtitleState.workspace.drafts = {
      ...toRecord(subtitleState.workspace.drafts),
      ...patch,
      durationMinSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMinSeconds")
        ? asNumber(patch.durationMinSeconds)
        : asNumber(toRecord(subtitleState.workspace.drafts).durationMinSeconds),
      durationMaxSeconds: Object.prototype.hasOwnProperty.call(patch, "durationMaxSeconds")
        ? asNumber(patch.durationMaxSeconds)
        : asNumber(toRecord(subtitleState.workspace.drafts).durationMaxSeconds),
      limitCount: Object.prototype.hasOwnProperty.call(patch, "limitCount")
        ? asNumber(patch.limitCount)
        : asNumber(toRecord(subtitleState.workspace.drafts).limitCount),
    };
    subtitleState.workspace.lastError = null;
    subtitleState.workspace.lastActionAt = new Date().toISOString();
    nextProject.subtitleAnalysis = subtitleState;
    return nextProject;
  });
}

function applySubtitleEditPatch(runtime, project, patchValue) {
  const patch = toRecord(patchValue);
  const subtitleState = normalizeSubtitleAnalysisState(toRecord(project).subtitleAnalysis, runtime);
  subtitleState.edit.recipe = mergeObjects(toRecord(subtitleState.edit.recipe), patch);
  subtitleState.edit.recipe.maxCharsPerLine = Math.max(
    24,
    Math.min(64, Math.round(asNumber(toRecord(subtitleState.edit.recipe).maxCharsPerLine) || 42))
  );
  subtitleState.edit.lastError = null;
  subtitleState.edit.lastActionAt = new Date().toISOString();
  project.subtitleAnalysis = subtitleState;
  markFeatureProcessStale(project, SUBTITLE_FEATURE_ID, "Subtitle edit recipe changed.");
  markFeatureReportStale(project, SUBTITLE_FEATURE_ID, "Subtitle edit recipe changed.");
  return project.subtitleAnalysis;
}

async function listSubtitleFilesInDirectory(runtime, dirPath) {
  const entries = await listDirectory(dirPath);
  return entries
    .filter(function (entry) {
      return entry && entry.isDirectory !== true && isSubtitleFileName(runtime, entry.name);
    })
    .sort(function (left, right) {
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
}

async function readSubtitleText(filePath) {
  const rawText = await readTextFile(filePath);
  if (typeof rawText !== "string") {
    throw new Error(`Subtitle file could not be read: ${filePath}`);
  }
  return rawText;
}

const subtitleStateRuntime = createSubtitleStateRuntime({
  asNonEmptyString,
  asNumber,
  markFeatureProcessStale,
  markFeatureReportStale,
  normalizeReportExport,
  normalizeStringArray,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  toRecord,
});

const subtitleYoutubeSourceRuntime = createSubtitleYoutubeSourceRuntime({
  asNonEmptyString,
  asNumber,
  callRoomTools,
  clearJob,
  createEmptySubtitleDiscoveryState,
  createSubtitleEntryRecord,
  getActiveProject,
  listSubtitleFilesInDirectory,
  normalizeStringArray,
  normalizeSubtitleAnalysisState,
  normalizeSubtitleDiscoveryItem,
  patchActiveProject,
  pushJobState,
  registerJob,
  roomId: ROOM_ID,
  toRecord,
  upsertSubtitleEntries,
});

const subtitleSourceIntakeRuntime = createSubtitleSourceIntakeRuntime({
  asNonEmptyString,
  callRoomTools,
  createSubtitleEntryRecord,
  getActiveProject,
  getElectronApi,
  getSubtitleMimeType,
  isSubtitleFileName,
  listSubtitleFilesInDirectory,
  normalizeSubtitleAnalysisState,
  patchActiveProject,
  pushJobState,
  registerJob,
  resetSubtitleDiscovery,
  roomId: ROOM_ID,
  toRecord,
  upsertSubtitleEntries,
});

const subtitleEditWorkspaceRuntime = createSubtitleEditWorkspaceRuntime({
  asNonEmptyString,
  buildSubtitleEditSummary,
  ensureProjectDirectories,
  getActiveProject,
  getActiveSubtitleEntry,
  getProjectSubtitleEditOutputDir,
  markFeatureProcessStale,
  markFeatureReportStale,
  normalizeSubtitleAnalysisState,
  normalizeSubtitleOutputRecord,
  patchActiveProject,
  readSubtitleText,
  resolveSubtitleOutputFormat,
  sanitizeFileSegment,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  toRecord,
  transformSubtitleDocument,
  writeTextFile,
});

const subtitleActionRuntime = createSubtitleActionRuntime({
  applySubtitleEdit,
  applySubtitleEditPatch,
  asNonEmptyString,
  createEmptySubtitleDiscoveryState,
  getDefaultSubtitleEditPresetId,
  getDefaultSubtitleEditRecipe,
  getSubtitleEntries,
  handleSubtitleFolderPick,
  handleSubtitleLocalPick,
  handleSubtitleUrlDownload,
  handleSubtitleYoutubeDiscovery,
  handleSubtitleYoutubeDownload,
  markFeatureProcessStale,
  markFeatureReportStale,
  normalizeStringArray,
  normalizeSubtitleAnalysisState,
  normalizeSubtitleDiscoveryItem,
  patchActiveProject,
  patchActiveSubtitleWorkspaceDrafts,
  previewSubtitleEdit,
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  toRecord,
});

const subtitleProcessAnalysisRuntime = createSubtitleProcessAnalysisRuntime({
  asNonEmptyString,
  asNumber,
  formatIdentifierLabel,
  getSubtitleAnalysisModuleDescriptors,
  normalizeProcessModule,
  parseSubtitleCues,
  readSubtitleText,
  toRecord,
});

async function handleSubtitleLocalPick(api, runtime, requestId) {
  return subtitleSourceIntakeRuntime.handleLocalPick(api, runtime, requestId);
}

async function handleSubtitleFolderPick(api, runtime, requestId) {
  return subtitleSourceIntakeRuntime.handleFolderPick(api, runtime, requestId);
}

async function handleSubtitleUrlDownload(api, runtime, requestId) {
  return subtitleSourceIntakeRuntime.handleUrlDownload(api, runtime, requestId);
}

async function handleSubtitleYoutubeDiscovery(api, runtime, requestId) {
  return subtitleYoutubeSourceRuntime.handleYoutubeDiscovery(api, runtime, requestId);
}

async function handleSubtitleYoutubeDownload(api, runtime, requestId) {
  return subtitleYoutubeSourceRuntime.handleYoutubeDownload(api, runtime, requestId);
}

async function previewSubtitleEdit(runtime, requestId) {
  return subtitleEditWorkspaceRuntime.previewEdit(runtime, requestId);
}

async function applySubtitleEdit(runtime, requestId) {
  return subtitleEditWorkspaceRuntime.applyEdit(runtime, requestId);
}

function updateToolBusy(runtime, toolId, busy, lastError) {
  return laboratoryToolMutationRuntime.updateToolBusy(runtime, toolId, busy, lastError);
}

async function handleToolMutation(api, runtime, requestId, action, toolId, featureStage) {
  return laboratoryToolMutationRuntime.handleToolMutation(
    api,
    runtime,
    requestId,
    action,
    toolId,
    featureStage
  );
}

function updateJobFromProgress(runtime, eventPayload) {
  return laboratoryRoomToolsProgressRuntime.updateJobFromProgress(runtime, eventPayload);
}

function ensureRoomToolsSubscription(api, runtime) {
  return laboratoryRoomToolsProgressRuntime.ensureRoomToolsSubscription(api, runtime);
}

function tearDownRoomToolsSubscription(runtime) {
  return laboratoryRoomToolsProgressRuntime.tearDownRoomToolsSubscription(runtime);
}

const laboratoryActionRouter = createLaboratoryActionRouter({
  asNonEmptyString,
  createRequestId,
  ensureHydrated,
  getFeatureIdFromContext,
  loadContext,
  mediaActionRuntime,
  persistProfileModelState,
  persistToolState,
  pushActionResult,
  pushMediaState,
  subtitleActionRuntime,
  toRecord,
});

async function handleMediaAction(api, runtime, payload) {
  return laboratoryActionRouter.dispatch(api, runtime, payload);
}

module.exports = {
  activate: function activate(api) {
    const runtime = createRuntimeState();
    api.log("info", "Laboratory media analysis host activated.");
    saveContext(api, {});
    ensureRoomToolsSubscription(api, runtime);

    return {
      onRoomReady: function onRoomReady(payload) {
        saveContext(api, payload);
        void ensureHydrated(api, runtime)
          .then(function () {
            pushMediaState(api, runtime, null);
          })
          .catch(function (error) {
            api.log(
              "warn",
              `Laboratory media host bootstrap failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          });
      },
      onRoomEvent: function onRoomEvent(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          return;
        }

        if (payload.type === "host-context") {
          saveContext(api, payload);
          return;
        }

        if (payload.type === "source-action" || payload.type === "media-action") {
          void handleMediaAction(api, runtime, toRecord(payload.payload));
        }
      },
      dispose: function dispose() {
        tearDownRoomToolsSubscription(runtime);
        api.log("info", "Laboratory media analysis host disposed.");
      },
    };
  },
};
