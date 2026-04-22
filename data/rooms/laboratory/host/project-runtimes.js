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
  function requireStateComposition() {
    if (!stateComposition) {
      throw new Error("stateComposition not initialized");
    }
    return stateComposition;
  }
  const snapshotDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    audioFeatureId: deps.audioFeatureId,
    clone: deps.clone,
    defaultFeatureId: deps.defaultFeatureId,
    featureIds: deps.featureIds,
    getFeatureIdFromContext: bootstrap.getFeatureIdFromContext,
    getFeatureProcessRecord(...args) {
      return requireStateComposition().getFeatureProcessRecord(...args);
    },
    getFeatureReportRecord(...args) {
      return requireStateComposition().getFeatureReportRecord(...args);
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
      return requireStateComposition().laboratoryProjectStateDelegatesRuntime.normalizeProjectProcessState(
        rawValue
      );
    },
    normalizeProfileArtifact(rawValue) {
      return requireStateComposition().laboratoryProjectStateDelegatesRuntime.normalizeProjectProfileArtifact(
        rawValue
      );
    },
    normalizeProfileSignal(rawValue) {
      return requireStateComposition().laboratoryProjectStateDelegatesRuntime.normalizeProjectProfileSignal(
        rawValue
      );
    },
    normalizeReportState(rawValue) {
      return requireStateComposition().laboratoryProjectStateDelegatesRuntime.normalizeProjectReportState(
        rawValue
      );
    },
    normalizeSourceMetadata: preset.normalizeSourceMetadata,
    normalizeSubtitleAnalysisState(rawValue, runtime) {
      return requireStateComposition().laboratorySubtitleStateDelegatesRuntime.normalizeSubtitleAnalysisState(
        rawValue,
        runtime
      );
    },
    projectSchemaVersion: deps.projectSchemaVersion,
    roomId: deps.roomId,
    subtitleFeatureId: deps.subtitleFeatureId,
    syncProjectFeatureProjections(...args) {
      return requireStateComposition().laboratoryProjectStateDelegatesRuntime.syncProjectFeatureProjections(
        ...args
      );
    },
    toFileUrl: hostUtils.toFileUrl,
    toRecord: deps.toRecord
  };
  const snapshot = createLaboratorySnapshotCompositionRuntime(
    snapshotDeps
  );
  const jobState = createLaboratoryJobStateRuntime({
    cancelRoomTool: io.cancelRoomTool,
    roomId: deps.roomId
  });
  const lifecycleDeps = {
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
      return requireStateComposition().laboratoryProjectRecordsRuntime.createProjectRecord(...args);
    },
    defaultFeatureId: deps.defaultFeatureId,
    ensureProjectDirectories: io.ensureProjectDirectories,
    findProject(...args) {
      return requireStateComposition().laboratoryProjectRecordsRuntime.findProject(...args);
    },
    getActiveProject(...args) {
      return requireStateComposition().laboratoryProjectRecordsRuntime.getActiveProject(...args);
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
    pushBootstrapState: snapshot.pushMediaState,
    normalizeProject(...args) {
      return requireStateComposition().laboratoryProjectRecordsRuntime.normalizeProject(...args);
    },
    readJsonFile: io.readJsonFile,
    refreshProfileModelState: profileModelState.reloadProfileModelState,
    roomId: deps.roomId,
    syncProjectFeatureProjections(...args) {
      return requireStateComposition().laboratoryProjectStateDelegatesRuntime.syncProjectFeatureProjections(
        ...args
      );
    },
    toRecord: deps.toRecord,
    updateProjectTimestamps(...args) {
      return requireStateComposition().laboratoryProjectRecordsRuntime.updateProjectTimestamps(
        ...args
      );
    },
    writeJsonFile: io.writeJsonFile
  };
  const lifecycle = createLaboratoryProjectLifecycleRuntime(
    lifecycleDeps
  );
  const mediaProfileModelDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    callRoomTools: io.callRoomTools,
    clearJob: jobState.clearJob,
    createDefaultProfileModelEntry: bootstrap.createDefaultProfileModelEntry,
    digestSha1: io.digestSha1,
    ensureRuntimeDirectory: io.ensureRuntimeDirectory,
    getActiveProject(...args) {
      return requireStateComposition().laboratoryProjectRecordsRuntime.getActiveProject(...args);
    },
    getProfileModelDescriptor: profileModelState.readProfileModelDescriptor,
    getProfileModelDescriptorMap: profileModelState.readProfileModelDescriptorMap,
    getProfileModelsDir,
    getStageSupport: bootstrap.getStageSupport,
    getToolManifest: bootstrap.getToolManifest,
    listDirectory: io.listDirectory,
    listSharedTranscriptModels: io.listSharedTranscriptModels,
    persistProfileModelState: profileModelState.saveProfileModelState,
    pushJobState: snapshot.pushJobState,
    readBinaryFileBytes: io.readBinaryFileBytes,
    readSharedTranscriptStatus: io.readSharedTranscriptStatus,
    refreshProfileModelState: profileModelState.reloadProfileModelState,
    registerJob: jobState.registerJob,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
    updateProfileModelBusy: profileModelState.updateProfileModelBusy,
    updateProfileModelEntry: profileModelState.updateProfileModelEntry
  };
  const mediaProfileModel = createMediaProfileModelRuntime(
    mediaProfileModelDeps
  );
  const mediaProfileStateDeps = {
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
  };
  const mediaProfileState = createMediaProfileStateRuntime(
    mediaProfileStateDeps
  );
  const stateCompositionDeps = {
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
    getDefaultYoutubePreset: preset.getDefaultYoutubePreset,
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
  };
  stateComposition = createLaboratoryHostStateCompositionRuntime(
    stateCompositionDeps
  );
  const sc = requireStateComposition();
  deps.setCloseoutStalenessRuntime(sc.laboratoryCloseoutStalenessRuntime);
  const analysisArtifactDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    callRoomTools: io.callRoomTools,
    getProjectProfileDir,
    getProjectProfilePreflightDir,
    normalizeProcessArtifact: sc.normalizeProcessArtifact,
    normalizeProcessFinding: sc.normalizeProcessFinding,
    normalizeProfileArtifact: mediaProfileState.normalizeProfileArtifact,
    normalizeProfileSignal: mediaProfileState.normalizeProfileSignal,
    readTextFile: io.readTextFile,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
    transcribeManagedAudioFile: io.transcribeManagedAudioFile,
    writeJsonFile: io.writeJsonFile
  };
  const analysisArtifact = createLaboratoryAnalysisArtifactRuntime(
    analysisArtifactDeps
  );
  const profileProjectionDeps = {
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
  };
  const profileProjection = createMediaProfileProjectionRuntime(
    profileProjectionDeps
  );
  const jobRuntimeDeps = {
    cancelRoomTool: io.cancelRoomTool,
    clearJob(runtime, jobId) {
      jobState.clearJob(runtime, jobId);
    },
    pushJobState: snapshot.pushJobState,
    roomId: deps.roomId,
    toRecord: deps.toRecord
  };
  const jobRuntime = createLaboratoryJobRuntime(
    jobRuntimeDeps
  );
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
