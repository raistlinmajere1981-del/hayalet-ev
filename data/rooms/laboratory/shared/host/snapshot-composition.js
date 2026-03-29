import { createLaboratoryProjectManifestRuntime } from "./project-manifests.js";
import { createLaboratoryRoomSnapshotRuntime } from "./room-snapshot.js";
import { createLaboratoryRuntimeEvents } from "./runtime-events.js";
export function createLaboratorySnapshotCompositionRuntime(deps) {
  const laboratoryProjectManifestRuntime = createLaboratoryProjectManifestRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: deps.asNumber,
    clone: deps.clone,
    normalizeEditOutput: deps.normalizeEditOutput,
    normalizeProcessState(rawValue) {
      return deps.normalizeProcessState(rawValue);
    },
    normalizeProfileArtifact(rawValue) {
      return deps.normalizeProfileArtifact(rawValue);
    },
    normalizeProfileSignal(rawValue) {
      return deps.normalizeProfileSignal(rawValue);
    },
    normalizeReportState(rawValue) {
      return deps.normalizeReportState(rawValue);
    },
    normalizeSourceMetadata: deps.normalizeSourceMetadata,
    projectSchemaVersion: deps.projectSchemaVersion,
    toRecord: deps.toRecord
  });
  const {
    buildDerivedTargetSignature,
    buildEditManifest,
    buildProcessManifest,
    buildProfileManifest,
    buildReportManifest,
    buildSourceTargetSignature,
    findEditOutputById
  } = laboratoryProjectManifestRuntime;
  const laboratoryRoomSnapshotRuntime = createLaboratoryRoomSnapshotRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    clone: deps.clone,
    defaultFeatureId: deps.defaultFeatureId,
    featureIds: deps.featureIds,
    mediaStages: deps.mediaStages,
    audioFeatureId: deps.audioFeatureId,
    subtitleFeatureId: deps.subtitleFeatureId,
    getFeatureProcessRecord(...args) {
      return deps.getFeatureProcessRecord(...args);
    },
    getFeatureReportRecord(...args) {
      return deps.getFeatureReportRecord(...args);
    },
    getRuntimeToolIds: deps.getRuntimeToolIds,
    getStageSupport: deps.getStageSupport,
    getToolManifest: deps.getToolManifest,
    mediaFeatureId: deps.mediaFeatureId,
    normalizeAudioAnalysisModuleResult: deps.normalizeAudioAnalysisModuleResult,
    normalizeAudioAnalysisState: deps.normalizeAudioAnalysisState,
    normalizeSubtitleAnalysisState(rawValue, runtime) {
      return deps.normalizeSubtitleAnalysisState(rawValue, runtime);
    },
    roomId: deps.roomId,
    syncProjectFeatureProjections(runtime, project) {
      return deps.syncProjectFeatureProjections(runtime, project);
    },
    toFileUrl: deps.toFileUrl,
    toRecord: deps.toRecord
  });
  const laboratoryRuntimeEvents = createLaboratoryRuntimeEvents({
    asNonEmptyString: deps.asNonEmptyString,
    defaultFeatureId: deps.defaultFeatureId,
    getFeatureIdFromContext: deps.getFeatureIdFromContext,
    loadContext: deps.loadContext,
    roomSnapshotRuntime: laboratoryRoomSnapshotRuntime
  });
  const {
    buildMediaSnapshot,
    buildSourceSnapshot,
    isSourceCompatibleAction,
    notifyRoom,
    pushActionResult,
    pushJobState,
    pushMediaState,
    pushSourceState
  } = laboratoryRuntimeEvents;
  return {
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
    pushSourceState
  };
}
