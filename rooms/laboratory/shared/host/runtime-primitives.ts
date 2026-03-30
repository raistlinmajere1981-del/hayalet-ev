import {
  getProjectFeatureProcessDir as getProjectFeatureProcessDirFromPaths,
  getProjectFeatureReportDir as getProjectFeatureReportDirFromPaths,
  getProjectProcessDir as getProjectProcessDirFromPaths,
  getProjectReportDir as getProjectReportDirFromPaths,
} from "./project-paths.js";

export const LABORATORY_ROOM_ID = "laboratory";
export const LABORATORY_MEDIA_FEATURE_ID = "media-analysis";
export const LABORATORY_AUDIO_FEATURE_ID = "audio-analysis";
export const LABORATORY_SUBTITLE_FEATURE_ID = "subtitle-analysis";
export const LABORATORY_FEATURE_IDS = [
  LABORATORY_MEDIA_FEATURE_ID,
  LABORATORY_AUDIO_FEATURE_ID,
  LABORATORY_SUBTITLE_FEATURE_ID,
];
export const LABORATORY_MEDIA_STAGES = ["source", "edit", "profile", "process", "report"];
export const LABORATORY_FEATURE_NAMESPACES = {
  [LABORATORY_MEDIA_FEATURE_ID]: "mediaAnalysis",
  [LABORATORY_AUDIO_FEATURE_ID]: "audioAnalysis",
  [LABORATORY_SUBTITLE_FEATURE_ID]: "subtitleAnalysis",
};

export function getLaboratoryProjectProcessDir(runtime: any, project: any) {
  return getProjectProcessDirFromPaths(runtime, project);
}

export function getLaboratoryProjectReportDir(runtime: any, project: any) {
  return getProjectReportDirFromPaths(runtime, project);
}

export function getLaboratoryFeatureProcessDir(runtime: any, project: any, featureId: any) {
  return getProjectFeatureProcessDirFromPaths(runtime, project, featureId);
}

export function getLaboratoryFeatureReportDir(runtime: any, project: any, featureId: any) {
  return getProjectFeatureReportDirFromPaths(runtime, project, featureId);
}

export function toLaboratoryRecord(value: any) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}

export function cloneLaboratoryValue(value: any) {
  return JSON.parse(JSON.stringify(value));
}

export function readNonEmptyString(value: any) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function normalizeLaboratoryLocale(value: any) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}
