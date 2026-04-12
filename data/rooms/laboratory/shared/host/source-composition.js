import { createMediaSourceFileRuntime } from "../../main-functions/media-analysis/host/source-file-utils.js";
import { createMediaSourceIntakeRuntime } from "../../main-functions/media-analysis/host/source-intake.js";
import { createMediaSourceMetadataRuntime } from "../../main-functions/media-analysis/host/source-metadata.js";
import { createLaboratorySourceDelegatesRuntime } from "./source-delegates.js";
export function createLaboratorySourceCompositionRuntime(deps) {
  const mediaSourceFileRuntime = createMediaSourceFileRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    getSourceConfig: deps.getSourceConfig,
    toRecord: deps.toRecord
  });
  const mediaSourceMetadataRuntime = createMediaSourceMetadataRuntime({
    asNumber: deps.asNumber,
    asNonEmptyString: deps.asNonEmptyString,
    callRoomTools: deps.callRoomTools,
    ensureProjectDirectories: deps.ensureProjectDirectories,
    findCompanionExecutableName: mediaSourceFileRuntime.findCompanionExecutableName,
    getActiveProject: deps.getActiveProject,
    getProjectEditDir: deps.getProjectEditDir,
    getProjectSourceDir: deps.getProjectSourceDir,
    normalizeSourceMetadata: deps.normalizeSourceMetadata,
    patchActiveProject: deps.patchActiveProject,
    roomId: deps.roomId,
    stripMimeParameters: mediaSourceFileRuntime.stripMimeParameters,
    toRecord: deps.toRecord,
    validateSourceCandidate: mediaSourceFileRuntime.validateSourceCandidate
  });
  const mediaSourceIntakeRuntimeDeps = {
    asNonEmptyString: deps.asNonEmptyString,
    callRoomTools: deps.callRoomTools,
    cancelJobsForProject: deps.cancelJobsForProject,
    clearJob: deps.clearJob,
    deriveFilename: mediaSourceFileRuntime.deriveFilename,
    getActiveProject: deps.getActiveProject,
    getElectronApi: deps.getElectronApi,
    getPresetDefaultCustomValues: deps.getPresetDefaultCustomValues,
    getProjectSourceDir: deps.getProjectSourceDir,
    getSourceConfig: deps.getSourceConfig,
    normalizeMimeType: mediaSourceFileRuntime.normalizeMimeType,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
    resolvePreparedSource: mediaSourceMetadataRuntime.resolvePreparedSource,
    roomId: deps.roomId,
    toRecord: deps.toRecord
  };
  const mediaSourceIntakeRuntime = createMediaSourceIntakeRuntime(mediaSourceIntakeRuntimeDeps);
  const laboratorySourceDelegatesRuntimeDeps = {
    mediaSourceIntakeRuntime
  };
  const laboratorySourceDelegatesRuntime = createLaboratorySourceDelegatesRuntime(
    laboratorySourceDelegatesRuntimeDeps
  );
  return {
    laboratorySourceDelegatesRuntime,
    mediaSourceFileRuntime,
    mediaSourceMetadataRuntime
  };
}
