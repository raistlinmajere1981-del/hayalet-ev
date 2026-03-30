import {
  getProjectFeatureProcessDir as getProjectFeatureProcessDirFromPaths,
  getProjectFeatureReportDir as getProjectFeatureReportDirFromPaths,
  getProjectProcessDir as getProjectProcessDirFromPaths,
  getProjectReportDir as getProjectReportDirFromPaths,
} from "./project-paths.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryRuntimeRecord = LaboratoryRecord & {
  paths: {
    projectsDir: string;
  };
};

type LaboratoryProjectRecord = LaboratoryRecord & {
  slug: string;
};

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

export function getLaboratoryProjectProcessDir(
  runtime: LaboratoryRuntimeRecord,
  project: LaboratoryProjectRecord
) {
  return getProjectProcessDirFromPaths(runtime, project);
}

export function getLaboratoryProjectReportDir(
  runtime: LaboratoryRuntimeRecord,
  project: LaboratoryProjectRecord
) {
  return getProjectReportDirFromPaths(runtime, project);
}

export function getLaboratoryFeatureProcessDir(
  runtime: LaboratoryRuntimeRecord,
  project: LaboratoryProjectRecord,
  featureId: string
) {
  return getProjectFeatureProcessDirFromPaths(runtime, project, featureId);
}

export function getLaboratoryFeatureReportDir(
  runtime: LaboratoryRuntimeRecord,
  project: LaboratoryProjectRecord,
  featureId: string
) {
  return getProjectFeatureReportDirFromPaths(runtime, project, featureId);
}

export function toLaboratoryRecord(value: unknown): LaboratoryRecord {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value as LaboratoryRecord;
  }
  return {};
}

export function cloneLaboratoryValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function normalizeLaboratoryLocale(value: unknown): "tr" | "en" {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}
