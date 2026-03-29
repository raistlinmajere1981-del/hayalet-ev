import { createMediaLocalSourceIntakeRuntime } from "./source-intake-local.js";
import { createMediaUrlSourceIntakeRuntime } from "./source-intake-url.js";
import { createMediaYoutubeSourceIntakeRuntime } from "./source-intake-youtube.js";

export function createMediaSourceIntakeRuntime(deps) {
  const mediaLocalSourceIntakeRuntime = createMediaLocalSourceIntakeRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    getActiveProject: deps.getActiveProject,
    getElectronApi: deps.getElectronApi,
    getProjectSourceDir: deps.getProjectSourceDir,
    getSourceConfig: deps.getSourceConfig,
    normalizeMimeType: deps.normalizeMimeType,
    patchActiveProject: deps.patchActiveProject,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
    resolvePreparedSource: deps.resolvePreparedSource,
  });

  const mediaUrlSourceIntakeRuntime = createMediaUrlSourceIntakeRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    callRoomTools: deps.callRoomTools,
    cancelJobsForProject: deps.cancelJobsForProject,
    clearJob: deps.clearJob,
    deriveFilename: deps.deriveFilename,
    getActiveProject: deps.getActiveProject,
    getProjectSourceDir: deps.getProjectSourceDir,
    normalizeMimeType: deps.normalizeMimeType,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
    resolvePreparedSource: deps.resolvePreparedSource,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });

  const mediaYoutubeSourceIntakeRuntime = createMediaYoutubeSourceIntakeRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    callRoomTools: deps.callRoomTools,
    cancelJobsForProject: deps.cancelJobsForProject,
    clearJob: deps.clearJob,
    getActiveProject: deps.getActiveProject,
    getPresetDefaultCustomValues: deps.getPresetDefaultCustomValues,
    getProjectSourceDir: deps.getProjectSourceDir,
    normalizeMimeType: deps.normalizeMimeType,
    patchActiveProject: deps.patchActiveProject,
    pushJobState: deps.pushJobState,
    registerJob: deps.registerJob,
    resetEditForCurrentSource: deps.resetEditForCurrentSource,
    resetProfileForCurrentSource: deps.resetProfileForCurrentSource,
    resolvePreparedSource: deps.resolvePreparedSource,
    roomId: deps.roomId,
    toRecord: deps.toRecord,
  });

  return {
    ...mediaLocalSourceIntakeRuntime,
    ...mediaUrlSourceIntakeRuntime,
    ...mediaYoutubeSourceIntakeRuntime,
  };
}
