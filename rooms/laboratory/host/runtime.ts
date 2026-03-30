import { createLaboratoryHostActivation } from "../shared/host/activation.js";
import {
  LABORATORY_AUDIO_FEATURE_ID as AUDIO_FEATURE_ID,
  LABORATORY_FEATURE_IDS as FEATURE_IDS,
  LABORATORY_MEDIA_FEATURE_ID as FEATURE_ID,
  LABORATORY_MEDIA_STAGES as MEDIA_STAGES,
  LABORATORY_ROOM_ID as ROOM_ID,
  LABORATORY_SUBTITLE_FEATURE_ID as SUBTITLE_FEATURE_ID,
  cloneLaboratoryValue as clone,
  getLaboratoryFeatureProcessDir as getFeatureProcessDir,
  getLaboratoryFeatureReportDir as getFeatureReportDir,
  normalizeLaboratoryLocale as normalizeLocale,
  readNonEmptyString as asNonEmptyString,
  toLaboratoryRecord as toRecord,
} from "../shared/host/runtime-primitives.js";
import { createLaboratoryHostFoundation } from "./foundation-runtimes.js";
import { createLaboratoryHostProjectRuntimes } from "./project-runtimes.js";
import { createLaboratoryHostFeatureRuntimes } from "./feature-runtimes.js";

const AUDIO_ANALYSIS_SCHEMA_VERSION = 1;
const PROJECT_SCHEMA_VERSION = 1;

const runtimeRefs: {
  closeoutStaleness: any;
  processCoordination: any;
  projectState: any;
  subtitleAnalysisHost: any;
} = {
  closeoutStaleness: null,
  processCoordination: null,
  projectState: null,
  subtitleAnalysisHost: null,
};

let projectRuntimes: any = null;
let featureRuntimes: any = null;

function markFeatureProcessStale(project: any, featureId: string, reason: string) {
  if (!runtimeRefs.closeoutStaleness) throw new Error("closeoutStaleness not initialized");
  return runtimeRefs.closeoutStaleness.markFeatureProcessStale(project, featureId, reason);
}

function markFeatureReportStale(project: any, featureId: string, reason: string) {
  if (!runtimeRefs.closeoutStaleness) throw new Error("closeoutStaleness not initialized");
  return runtimeRefs.closeoutStaleness.markFeatureReportStale(project, featureId, reason);
}

function markCloseoutAsStale(project: any, reason: string, featureIds: string[]) {
  if (!runtimeRefs.closeoutStaleness) throw new Error("closeoutStaleness not initialized");
  return runtimeRefs.closeoutStaleness.markCloseoutAsStale(project, reason, featureIds);
}

function normalizeAudioAnalysisModuleResult(
  rawValue: unknown,
  moduleId: string,
  catalogEntry: unknown
) {
  if (!featureRuntimes) throw new Error("featureRuntimes not initialized");
  return featureRuntimes.processComposition.audioAnalysisStateRuntime.normalizeAudioAnalysisModuleResult(
    rawValue,
    moduleId,
    catalogEntry
  );
}

function createEmptyAudioAnalysisState() {
  if (!featureRuntimes) throw new Error("featureRuntimes not initialized");
  return featureRuntimes.processComposition.audioAnalysisStateRuntime.createEmptyAudioAnalysisState();
}

function normalizeAudioAnalysisState(rawValue: unknown, runtime: unknown) {
  if (!featureRuntimes) throw new Error("featureRuntimes not initialized");
  return featureRuntimes.processComposition.audioAnalysisStateRuntime.normalizeAudioAnalysisState(
    rawValue,
    runtime
  );
}

function getProfileArtifactPreferenceMap(profileCapabilities: unknown) {
  return toRecord(toRecord(profileCapabilities).artifactPreferences);
}

const foundation = createLaboratoryHostFoundation({
  asNonEmptyString,
  audioFeatureId: AUDIO_FEATURE_ID,
  clone,
  defaultFeatureId: FEATURE_ID,
  getAnalysisArtifactRuntime() {
    if (!projectRuntimes) throw new Error("projectRuntimes not initialized");
    return projectRuntimes.analysisArtifact;
  },
  getProjectStateRuntime() {
    return runtimeRefs.projectState;
  },
  normalizeLocale,
  roomId: ROOM_ID,
  toRecord,
});

projectRuntimes = createLaboratoryHostProjectRuntimes({
  asNonEmptyString,
  audioFeatureId: AUDIO_FEATURE_ID,
  createEmptyAudioAnalysisState,
  clone,
  defaultFeatureId: FEATURE_ID,
  featureIds: FEATURE_IDS,
  foundation,
  getProfileArtifactPreferenceMap,
  getProjectStateRuntime() {
    return runtimeRefs.projectState;
  },
  markCloseoutAsStale,
  markFeatureProcessStale,
  markFeatureReportStale,
  mediaFeatureId: FEATURE_ID,
  mediaStages: MEDIA_STAGES,
  normalizeAudioAnalysisModuleResult,
  normalizeAudioAnalysisState,
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  roomId: ROOM_ID,
  setCloseoutStalenessRuntime(value: any) {
    runtimeRefs.closeoutStaleness = value;
  },
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  toRecord,
});

featureRuntimes = createLaboratoryHostFeatureRuntimes({
  asNonEmptyString,
  audioAnalysisSchemaVersion: AUDIO_ANALYSIS_SCHEMA_VERSION,
  audioFeatureId: AUDIO_FEATURE_ID,
  clone,
  foundation,
  getFeatureProcessDir,
  getFeatureReportDir,
  getSubtitleAnalysisHostRuntime() {
    return runtimeRefs.subtitleAnalysisHost;
  },
  markCloseoutAsStale,
  markFeatureProcessStale,
  markFeatureReportStale,
  mediaFeatureId: FEATURE_ID,
  normalizeAudioAnalysisModuleResult,
  normalizeAudioAnalysisState,
  projectRuntimes,
  roomId: ROOM_ID,
  setProcessCoordinationRuntime(value: any) {
    runtimeRefs.processCoordination = value;
  },
  setProjectStateRuntime(value: any) {
    runtimeRefs.projectState = value;
  },
  setSubtitleAnalysisHostRuntime(value: any) {
    runtimeRefs.subtitleAnalysisHost = value;
  },
  subtitleFeatureId: SUBTITLE_FEATURE_ID,
  toRecord,
});

export default function createLaboratoryHostRuntime() {
  if (!projectRuntimes) throw new Error("projectRuntimes not initialized");
  if (!featureRuntimes) throw new Error("featureRuntimes not initialized");
  return createLaboratoryHostActivation({
    createRuntimeState: foundation.bootstrap.createRuntimeState,
    ensureHydrated: projectRuntimes.lifecycle.ensureHydrated,
    ensureRoomToolsSubscription: featureRuntimes.roomToolsProgress.ensureRoomToolsSubscription,
    handleMediaAction: featureRuntimes.featureAdapters.handleMediaAction,
    pushMediaState: projectRuntimes.snapshot.pushMediaState,
    saveContext: foundation.bootstrap.saveContext,
    tearDownRoomToolsSubscription: featureRuntimes.roomToolsProgress.tearDownRoomToolsSubscription,
    toRecord,
  });
}
