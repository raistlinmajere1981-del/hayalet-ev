import {
  getProjectFeatureProcessDir as getProjectFeatureProcessDirFromPaths,
  getProjectFeatureReportDir as getProjectFeatureReportDirFromPaths,
  getProjectProcessDir as getProjectProcessDirFromPaths,
  getProjectReportDir as getProjectReportDirFromPaths
} from "./project-paths.js";
import { normalizeAnalysisScope, serializeAnalysisScope } from "../types/analysis-scope.js";
export const LABORATORY_ROOM_ID = "laboratory";
export const LABORATORY_MEDIA_FEATURE_ID = "media-analysis";
export const LABORATORY_AUDIO_FEATURE_ID = "audio-analysis";
export const LABORATORY_SUBTITLE_FEATURE_ID = "subtitle-analysis";
export const LABORATORY_WORKBENCH_EXPERIENCE_ID = "analysis-workbench";
export const LABORATORY_WORKBENCH_MODE = "guided";
export const LABORATORY_WORKBENCH_SCHEMA_VERSION = 1;
export const LABORATORY_FEATURE_IDS = [
  LABORATORY_MEDIA_FEATURE_ID,
  LABORATORY_AUDIO_FEATURE_ID,
  LABORATORY_SUBTITLE_FEATURE_ID
];
export const LABORATORY_MEDIA_STAGES = ["source", "edit", "profile", "process", "report"];
export const LABORATORY_FEATURE_NAMESPACES = {
  [LABORATORY_MEDIA_FEATURE_ID]: "mediaAnalysis",
  [LABORATORY_AUDIO_FEATURE_ID]: "audioAnalysis",
  [LABORATORY_SUBTITLE_FEATURE_ID]: "subtitleAnalysis"
};
export function isLaboratoryFeatureId(value) {
  return typeof value === "string" && LABORATORY_FEATURE_IDS.includes(value);
}
export function normalizeLaboratoryFeatureId(value, fallback = LABORATORY_MEDIA_FEATURE_ID) {
  return isLaboratoryFeatureId(value) ? value : fallback;
}
export function normalizeLaboratoryFeatureIdList(value, fallback = LABORATORY_FEATURE_IDS) {
  const nextValues = Array.isArray(value) ? value.filter((entry) => isLaboratoryFeatureId(entry)) : [];
  const uniqueValues = Array.from(new Set(nextValues));
  return uniqueValues.length > 0 ? uniqueValues : fallback.slice();
}
export function createLaboratoryWorkbenchState(overrides = {}) {
  const source = toLaboratoryRecord(overrides);
  const activeModuleId = normalizeLaboratoryFeatureId(
    source["activeModuleId"] ?? source["featureId"],
    LABORATORY_MEDIA_FEATURE_ID
  );
  const primaryFeatureId = normalizeLaboratoryFeatureId(
    source["primaryFeatureId"],
    LABORATORY_MEDIA_FEATURE_ID
  );
  const availableModuleIds = normalizeLaboratoryFeatureIdList(
    source["availableModuleIds"] ?? source["availableFeatureIds"],
    LABORATORY_FEATURE_IDS
  );
  const selectedModuleIds = normalizeLaboratoryFeatureIdList(
    source["selectedModuleIds"] ?? source["selectedFeatureIds"],
    [activeModuleId]
  ).filter(function(featureId) {
    return availableModuleIds.includes(featureId);
  });
  const analysisScope = serializeAnalysisScope(normalizeAnalysisScope(source["analysisScope"]));
  return {
    schemaVersion: LABORATORY_WORKBENCH_SCHEMA_VERSION,
    experienceId: readNonEmptyString(source["experienceId"]) || LABORATORY_WORKBENCH_EXPERIENCE_ID,
    mode: LABORATORY_WORKBENCH_MODE,
    primaryFeatureId,
    activeModuleId: availableModuleIds.includes(activeModuleId) ? activeModuleId : primaryFeatureId,
    availableModuleIds,
    selectedModuleIds: selectedModuleIds.length > 0 ? selectedModuleIds : [availableModuleIds.includes(activeModuleId) ? activeModuleId : primaryFeatureId],
    analysisScope,
    moduleToggles: toLaboratoryRecord(source["moduleToggles"]),
    activePreviewArtifactId: readNonEmptyString(source["activePreviewArtifactId"]),
    activeLiveFindingsStreamId: readNonEmptyString(source["activeLiveFindingsStreamId"]),
    controlsCollapsed: source["controlsCollapsed"] !== false
  };
}
export function getLaboratoryProjectProcessDir(runtime, project) {
  return getProjectProcessDirFromPaths(runtime, project);
}
export function getLaboratoryProjectReportDir(runtime, project) {
  return getProjectReportDirFromPaths(runtime, project);
}
export function getLaboratoryFeatureProcessDir(runtime, project, featureId) {
  return getProjectFeatureProcessDirFromPaths(runtime, project, featureId);
}
export function getLaboratoryFeatureReportDir(runtime, project, featureId) {
  return getProjectFeatureReportDirFromPaths(runtime, project, featureId);
}
export function toLaboratoryRecord(value) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}
export function cloneLaboratoryValue(value) {
  return JSON.parse(JSON.stringify(value));
}
export function readNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
export function normalizeLaboratoryLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}
