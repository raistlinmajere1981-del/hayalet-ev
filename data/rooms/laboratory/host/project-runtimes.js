import {
  getProfileModelStatePath,
  getProfileModelsDir,
  getProjectDir,
  getProjectEditManifestPath,
  getProjectMetaPath,
  getProjectProcessManifestPath,
  getProjectProfileDir,
  getProjectProfileManifestPath,
  getProjectProfilePreflightDir,
  getProjectReportManifestPath
} from "../shared/host/project-paths.js";
import { createLaboratoryProjectLifecycleRuntime } from "../shared/host/project-lifecycle.js";
import { createLaboratoryAnalysisArtifactRuntime } from "../shared/host/analysis-artifact-runtime.js";
import { createLaboratoryJobRuntime } from "../shared/host/job-runtime.js";
import { createLaboratorySnapshotCompositionRuntime } from "../shared/host/snapshot-composition.js";
import { createLaboratoryHostStateCompositionRuntime } from "../shared/host/state-composition.js";
import { createLaboratoryJobStateRuntime } from "../shared/host/job-state.js";
import { createMediaProfileModelRuntime } from "../main-functions/media-analysis/host/profile-models.js";
import { createMediaProfileProjectionRuntime } from "../main-functions/media-analysis/host/profile-projection.js";
import { createMediaProfileStateRuntime } from "../main-functions/media-analysis/host/profile-state.js";
export function createLaboratoryHostProjectRuntimes(deps) {
  const { foundation } = deps;
  const { bootstrap, hostUtils, io, preset, profileModelState } = foundation;
  let stateComposition = null;
  const snapshot = createLaboratorySnapshotCompositionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    audioFeatureId: deps.audioFeatureId,
    clone: deps.clone,
    defaultFeatureId: deps.defaultFeatureId,
    featureIds: deps.featureIds,
    getFeatureIdFromContext: bootstrap.getFeatureIdFromContext,
    getFeatureProcessRecord(...args) {
      return stateComposition.getFeatureProcessRecord(...args);
    },
    getFeatureReportRecord(...args) {
      return stateComposition.getFeatureReportRecord(...args);
    },
    getRuntimeToolIds: bootstrap.getRuntimeToolIds,
    getStageSupport: bootstrap.getStageSupport,
    getToolManifest: bootstrap.getToolManifest,
    loadContext: bootstrap.loadContext,
    mediaFeatureId: deps.mediaFeatureId,
    mediaStages: deps.mediaStages,
    normalizeAudioAnalysisModuleResult: deps.normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisState: deps.normalizeAudioAnalysisState,
    normalizeEditOutput: preset.normalizeEditOutput,
    normalizeProcessState(rawValue) {
      return stateComposition.laboratoryProjectStateDelegatesRuntime.normalizeProjectProcessState(rawValue);
    },
    normalizeProfileArtifact(rawValue) {
      return stateComposition.laboratoryProjectStateDelegatesRuntime.normalizeProjectProfileArtifact(rawValue);
    },
    normalizeProfileSignal(rawValue) {
      return stateComposition.laboratoryProjectStateDelegatesRuntime.normalizeProjectProfileSignal(rawValue);
    },
    normalizeReportState(rawValue) {
      return stateComposition.laboratoryProjectStateDelegatesRuntime.normalizeProjectReportState(rawValue);
    },
    normalizeSourceMetadata: preset.normalizeSourceMetadata,
    normalizeSubtitleAnalysisState(rawValue, runtime) {
      return stateComposition.laboratorySubtitleStateDelegatesRuntime.normalizeSubtitleAnalysisState(
        rawValue,
        runtime
      );
    },
    projectSchemaVersion: deps.projectSchemaVersion,
    roomId: deps.roomId,
    subtitleFeatureId: deps.subtitleFeatureId,
    syncProjectFeatureProjections(runtime, project) {
      return stateComposition.laboratoryProjectStateDelegatesRuntime.syncProjectFeatureProjections(
        runtime,
        project
      );
    },
    toFileUrl: hostUtils.toFileUrl,
    toRecord: deps.toRecord
  });
  const jobState = createLaboratoryJobStateRuntime({
    cancelRoomTool: io.cancelRoomTool,
    roomId: deps.roomId
  });
  const lifecycle = createLaboratoryProjectLifecycleRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    buildEditManifest: snapshot.buildEditManifest,
    buildProcessManifest: snapshot.buildProcessManifest,
    buildProfileManifest: snapshot.buildProfileManifest,
    buildReportManifest: snapshot.buildReportManifest,
    callRoomTools: io.callRoomTools,
    cancelJobsForProject: jobState.cancelJobsForProject,
    clone: deps.clone,
    createDefaultProfileModelEntry: bootstrap.createDefaultProfileModelEntry,
    createDefaultToolEntry: bootstrap.createDefaultToolEntry,
    createDefaultToolState: bootstrap.createDefaultToolState,
    createProjectRecord(...args) {
      return stateComposition.laboratoryProjectRecordsRuntime.createProjectRecord(...args);
    },
    defaultFeatureId: deps.defaultFeatureId,
    ensureProjectDirectories: io.ensureProjectDirectories,
    findProject(...args) {
      return stateComposition.laboratoryProjectRecordsRuntime.findProject(...args);
    },
    getActiveProject(...args) {
      return stateComposition.laboratoryProjectRecordsRuntime.getActiveProject(...args);
    },
    getFeatureIdFromContext: bootstrap.getFeatureIdFromContext,
    getProfileModelStatePath,
    getProjectDir,
    getProjectEditManifestPath,
    getProjectMetaPath,
    getProjectProcessManifestPath,
    getProjectProfileManifestPath,
    getProjectReportManifestPath,
    getRuntimeToolIds: bootstrap.getRuntimeToolIds,
    listDirectory: io.listDirectory,
    loadContext: bootstrap.loadContext,
    normalizeProject(...args) {
      return stateComposition.laboratoryProjectRecordsRuntime.normalizeProject(...args);
    },
    readJsonFile: io.readJsonFile,
    refreshProfileModelState: profileModelState.reloadProfileModelState,
    roomId: deps.roomId,
    syncProjectFeatureProjections(runtime, project) {
      return stateComposition.laboratoryProjectStateDelegatesRuntime.syncProjectFeatureProjections(
        runtime,
        project
      );
    },
    toRecord: deps.toRecord,
    updateProjectTimestamps(...args) {
      return stateComposition.laboratoryProjectRecordsRuntime.updateProjectTimestamps(...args);
    },
    writeJsonFile: io.writeJsonFile
  });
  const mediaProfileModel = createMediaProfileModelRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    callRoomTools: io.callRoomTools,
    clearJob: jobState.clearJob,
    createDefaultProfileModelEntry: bootstrap.createDefaultProfileModelEntry,
    digestSha1: io.digestSha1,
    ensureRuntimeDirectory: io.ensureRuntimeDirectory,
    getActiveProject(...args) {
      return stateComposition.laboratoryProjectRecordsRuntime.getActiveProject(...args);
    },
    getProfileModelDescriptor: profileModelState.readProfileModelDescriptor,
    getProfileModelDescriptorMap: profileModelState.readProfileModelDescriptorMap,
    getProfileModelsDir,
    getStageSupport: bootstrap.getStageSupport,
    getToolManifest: bootstrap.getToolManifest,
    listDirectory: io.listDirectory,
    persistProfileModelState: profileModelState.saveProfileModelState,
    pushJobState: snapshot.pushJobState,
    readBinaryFileBytes: io.readBinaryFileBytes,
    refreshProfileModelState: profileModelState.reloadProfileModelState,
    registerJob: jobState.registerJob,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
    updateProfileModelBusy: profileModelState.updateProfileModelBusy,
    updateProfileModelEntry: profileModelState.updateProfileModelEntry
  });
  const mediaProfileState = createMediaProfileStateRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    clampNumber: hostUtils.clampNumber,
    createEmptyProfileEstimate: preset.createEmptyProfileEstimate,
    createEmptyProfilePreflight: preset.createEmptyProfilePreflight,
    createEmptyProfileReadiness: preset.createEmptyProfileReadiness,
    findProfilePreset: preset.findProfilePreset,
    getCompatibleProfileLaneIds: preset.getCompatibleProfileLaneIds,
    getDefaultProfileModelId: preset.getDefaultProfileModelId,
    getDefaultProfilePresetId: preset.getDefaultProfilePresetId,
    getProfileArtifactPreferenceMap: deps.getProfileArtifactPreferenceMap,
    getProfileLaneMap: preset.getProfileLaneMap,
    markCloseoutAsStale: deps.markCloseoutAsStale,
    mediaFeatureId: deps.mediaFeatureId,
    toRecord: deps.toRecord
  });
  stateComposition = createLaboratoryHostStateCompositionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    buildProjectName: preset.buildProjectName,
    buildProjectSlug: preset.buildProjectSlug,
    clone: deps.clone,
    createDefaultEditState: preset.createDefaultEditState,
    createDefaultProfileState: mediaProfileState.createDefaultProfileState,
    createEmptyAudioAnalysisState: deps.createEmptyAudioAnalysisState,
    createEmptySourceDrafts: preset.createEmptySourceDrafts,
    featureIds: deps.featureIds,
    getDefaultMode: preset.getDefaultMode,
    getDefaultSourceType: preset.getDefaultSourceType,
    getMediaProfileStateRuntime() {
      return mediaProfileState;
    },
    getPreferredFeatureSourceKind: hostUtils.getPreferredFeatureSourceKind,
    getPresetDefaultCustomValues: preset.getPresetDefaultCustomValues,
    getProjectStateRuntime: deps.getProjectStateRuntime,
    markFeatureProcessStale: deps.markFeatureProcessStale,
    markFeatureReportStale: deps.markFeatureReportStale,
    normalizeAudioAnalysisState: deps.normalizeAudioAnalysisState,
    normalizeEditState: preset.normalizeEditState,
    normalizeProfileArtifact: mediaProfileState.normalizeProfileArtifact,
    normalizeProfileSignal: mediaProfileState.normalizeProfileSignal,
    normalizeProfileState: mediaProfileState.normalizeProfileState,
    normalizeSourceMetadata: preset.normalizeSourceMetadata,
    normalizeStringArray: preset.normalizeStringArray,
    projectSchemaVersion: deps.projectSchemaVersion,
    subtitleFeatureId: deps.subtitleFeatureId,
    toRecord: deps.toRecord
  });
  deps.setCloseoutStalenessRuntime(stateComposition.laboratoryCloseoutStalenessRuntime);
  const analysisArtifact = createLaboratoryAnalysisArtifactRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    callRoomTools: io.callRoomTools,
    getProjectProfileDir,
    getProjectProfilePreflightDir,
    normalizeProcessArtifact: stateComposition.normalizeProcessArtifact,
    normalizeProcessFinding: stateComposition.normalizeProcessFinding,
    normalizeProfileArtifact: mediaProfileState.normalizeProfileArtifact,
    normalizeProfileSignal: mediaProfileState.normalizeProfileSignal,
    readTextFile: io.readTextFile,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
    writeJsonFile: io.writeJsonFile
  });
  const profileProjection = createMediaProfileProjectionRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    buildDerivedTargetSignature: snapshot.buildDerivedTargetSignature,
    buildProfileModelSummary: mediaProfileModel.buildProfileModelSummary,
    buildProfileToolSummary: mediaProfileModel.buildProfileToolSummary,
    buildSourceTargetSignature: snapshot.buildSourceTargetSignature,
    clampProfileTranscriptSampleSeconds: mediaProfileState.clampProfileTranscriptSampleSeconds,
    clone: deps.clone,
    createDefaultProfileState: mediaProfileState.createDefaultProfileState,
    createEmptyProfilePreflight: preset.createEmptyProfilePreflight,
    findEditOutputById: snapshot.findEditOutputById,
    findProfilePreset: preset.findProfilePreset,
    getCompatibleProfileLaneIds: preset.getCompatibleProfileLaneIds,
    getDefaultProfileModelId: preset.getDefaultProfileModelId,
    getEnabledProfileLaneIds: mediaProfileState.getEnabledProfileLaneIds,
    getProfileDepthConfig: mediaProfileState.getProfileDepthConfig,
    getProfileFrameDensityRuntimeConfig: mediaProfileState.getProfileFrameDensityRuntimeConfig,
    getProfileLaneMap: preset.getProfileLaneMap,
    getProfileModelDescriptorMap: profileModelState.readProfileModelDescriptorMap,
    getStageSupport: bootstrap.getStageSupport,
    getToolManifest: bootstrap.getToolManifest,
    normalizeEditOutput: preset.normalizeEditOutput,
    normalizeProfileArtifactPreferences: mediaProfileState.normalizeProfileArtifactPreferences,
    normalizeProfileState: mediaProfileState.normalizeProfileState,
    normalizeSourceMetadata: preset.normalizeSourceMetadata,
    toRecord: deps.toRecord
  });
  const jobRuntime = createLaboratoryJobRuntime({
    cancelRoomTool: io.cancelRoomTool,
    clearJob: jobState.clearJob,
    pushJobState: snapshot.pushJobState,
    roomId: deps.roomId,
    toRecord: deps.toRecord
  });
  return {
    analysisArtifact,
    jobRuntime,
    jobState,
    lifecycle,
    mediaProfileModel,
    mediaProfileState,
    profileProjection,
    snapshot,
    stateComposition
  };
}
