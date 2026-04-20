import {
  getProjectDirectoryFallbackMarkerList,
  getProjectDirectoryList
} from "../shared/host/project-paths.js";
import { createLaboratoryProfileModelStateRuntime } from "../shared/host/profile-model-state.js";
import { createLaboratoryHostUtils } from "../shared/host/host-utils.js";
import { createLaboratoryHostIoRuntime } from "../shared/host/io-runtime.js";
import { createLaboratoryRuntimeBootstrap } from "../shared/host/runtime-bootstrap.js";
import { createLaboratoryPresetRuntime } from "../shared/host/preset-runtime.js";
import { createSubtitleDocumentRuntime } from "../main-functions/subtitle-analysis/host/document-runtime.js";
import { createAudioAnalysisUtilityRuntime } from "../main-functions/audio-analysis/host/analysis-utils.js";
export function createLaboratoryHostFoundation(deps) {
  const bootstrap = createLaboratoryRuntimeBootstrap({
    defaultFeatureId: deps.defaultFeatureId,
    normalizeLocale: deps.normalizeLocale,
    roomId: deps.roomId,
    toRecord: deps.toRecord
  });
  const profileModelState = createLaboratoryProfileModelStateRuntime({
    createDefaultProfileModelEntry: bootstrap.createDefaultProfileModelEntry,
    getProjectStateRuntime: deps.getProjectStateRuntime,
    toRecord: deps.toRecord
  });
  const io = createLaboratoryHostIoRuntime({
    getProjectDirectoryFallbackMarkerList(runtime, project) {
      return getProjectDirectoryFallbackMarkerList(
        runtime,
        project
      );
    },
    getProjectDirectoryList(runtime, project) {
      return getProjectDirectoryList(
        runtime,
        project
      );
    },
    roomId: deps.roomId
  });
  const preset = createLaboratoryPresetRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    clone: deps.clone,
    toRecord: deps.toRecord
  });
  const hostUtils = createLaboratoryHostUtils({
    audioFeatureId: deps.audioFeatureId,
    getDefaultSourceType: preset.getDefaultSourceType,
    toRecord: deps.toRecord
  });
  const subtitleDocument = createSubtitleDocumentRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    toRecord: deps.toRecord
  });
  const audioAnalysisUtility = createAudioAnalysisUtilityRuntime({
    asNonEmptyString: deps.asNonEmptyString,
    asNumber: preset.asNumber,
    readTextFile: io.readTextFile,
    runProfileTool(...args) {
      return deps.getAnalysisArtifactRuntime().runProfileTool(...args);
    },
    toRecord: deps.toRecord
  });
  return {
    audioAnalysisUtility,
    bootstrap,
    hostUtils,
    io,
    preset,
    profileModelState,
    subtitleDocument
  };
}
