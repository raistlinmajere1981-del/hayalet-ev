// @ts-nocheck
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
