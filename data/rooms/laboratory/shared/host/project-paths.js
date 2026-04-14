function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
const MEDIA_FEATURE_ID = "media-analysis";
const AUDIO_FEATURE_ID = "audio-analysis";
const SUBTITLE_FEATURE_ID = "subtitle-analysis";
export function getProjectDir(runtime, project) {
  return `${runtime.paths.projectsDir}/${project.slug}`;
}
export function getProjectMetaPath(runtime, project) {
  return `${getProjectDir(runtime, project)}/project.json`;
}
export function getProjectSourceDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/source`;
}
export function getProjectSubtitleSourceDir(runtime, project) {
  return `${getProjectSourceDir(runtime, project)}/subtitles`;
}
export function getProjectMainFunctionsDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/main-functions`;
}
export function getProjectFeatureDir(runtime, project, featureId) {
  return `${getProjectMainFunctionsDir(runtime, project)}/${asNonEmptyString(featureId) || MEDIA_FEATURE_ID}`;
}
export function getProjectFeatureStageDir(runtime, project, featureId, stageId) {
  return `${getProjectFeatureDir(runtime, project, featureId)}/${stageId}`;
}
export function getProjectDerivedDir(runtime, project) {
  return `${getProjectDir(runtime, project)}/derived`;
}
export function getProjectEditDir(runtime, project) {
  return getProjectFeatureStageDir(runtime, project, MEDIA_FEATURE_ID, "edit");
}
export function getProjectSubtitleEditDir(runtime, project) {
  return getProjectFeatureStageDir(runtime, project, SUBTITLE_FEATURE_ID, "edit");
}
export function getProjectEditPreviewDir(runtime, project) {
  return `${getProjectEditDir(runtime, project)}/preview`;
}
export function getProjectSubtitleEditPreviewDir(runtime, project) {
  return `${getProjectSubtitleEditDir(runtime, project)}/preview`;
}
export function getProjectEditOutputDir(runtime, project) {
  return `${getProjectEditDir(runtime, project)}/output`;
}
export function getProjectSubtitleEditOutputDir(runtime, project) {
  return `${getProjectSubtitleEditDir(runtime, project)}/output`;
}
export function getProjectEditManifestPath(runtime, project) {
  return `${getProjectEditDir(runtime, project)}/manifest.json`;
}
export function getProjectProfileDir(runtime, project) {
  return getProjectFeatureStageDir(runtime, project, MEDIA_FEATURE_ID, "profile");
}
export function getProjectProfilePreflightDir(runtime, project) {
  return `${getProjectProfileDir(runtime, project)}/preflight`;
}
export function getProjectProfileManifestPath(runtime, project) {
  return `${getProjectProfileDir(runtime, project)}/manifest.json`;
}
export function getProjectFeatureProcessDir(runtime, project, featureId) {
  return getProjectFeatureStageDir(runtime, project, featureId, "process");
}
export function getProjectProcessDir(runtime, project) {
  return getProjectFeatureProcessDir(runtime, project, MEDIA_FEATURE_ID);
}
export function getProjectSubtitleProcessDir(runtime, project) {
  return getProjectFeatureProcessDir(runtime, project, SUBTITLE_FEATURE_ID);
}
export function getProjectFeatureProcessManifestPath(runtime, project, featureId) {
  return `${getProjectFeatureProcessDir(runtime, project, featureId)}/manifest.json`;
}
export function getProjectProcessManifestPath(runtime, project) {
  return getProjectFeatureProcessManifestPath(runtime, project, MEDIA_FEATURE_ID);
}
export function getProjectFeatureReportDir(runtime, project, featureId) {
  return getProjectFeatureStageDir(runtime, project, featureId, "report");
}
export function getProjectReportDir(runtime, project) {
  return getProjectFeatureReportDir(runtime, project, MEDIA_FEATURE_ID);
}
export function getProjectFeatureReportManifestPath(runtime, project, featureId) {
  return `${getProjectFeatureReportDir(runtime, project, featureId)}/manifest.json`;
}
export function getProjectReportManifestPath(runtime, project) {
  return getProjectFeatureReportManifestPath(runtime, project, MEDIA_FEATURE_ID);
}
export function getProjectDirectoryList(runtime, project) {
  return [
    getProjectDir(runtime, project),
    getProjectSourceDir(runtime, project),
    getProjectSubtitleSourceDir(runtime, project),
    getProjectMainFunctionsDir(runtime, project),
    getProjectFeatureDir(runtime, project, MEDIA_FEATURE_ID),
    getProjectEditDir(runtime, project),
    getProjectEditPreviewDir(runtime, project),
    getProjectEditOutputDir(runtime, project),
    getProjectProfileDir(runtime, project),
    getProjectProfilePreflightDir(runtime, project),
    getProjectProcessDir(runtime, project),
    getProjectSubtitleProcessDir(runtime, project),
    getProjectReportDir(runtime, project),
    getProjectFeatureDir(runtime, project, AUDIO_FEATURE_ID),
    getAudioAnalysisProcessRootDir(runtime, project),
    getProjectFeatureReportDir(runtime, project, AUDIO_FEATURE_ID),
    getProjectFeatureDir(runtime, project, SUBTITLE_FEATURE_ID),
    getProjectSubtitleEditDir(runtime, project),
    getProjectSubtitleEditPreviewDir(runtime, project),
    getProjectSubtitleEditOutputDir(runtime, project),
    getProjectFeatureReportDir(runtime, project, SUBTITLE_FEATURE_ID)
  ];
}
export function getProjectDirectoryFallbackMarkerList(runtime, project) {
  return [
    getProjectSubtitleSourceDir(runtime, project),
    getProjectSourceDir(runtime, project),
    getProjectMainFunctionsDir(runtime, project),
    getProjectFeatureDir(runtime, project, MEDIA_FEATURE_ID),
    getProjectEditPreviewDir(runtime, project),
    getProjectEditOutputDir(runtime, project),
    getProjectProfilePreflightDir(runtime, project),
    getProjectSubtitleEditPreviewDir(runtime, project),
    getProjectSubtitleEditOutputDir(runtime, project),
    getProjectProcessDir(runtime, project),
    getProjectFeatureDir(runtime, project, AUDIO_FEATURE_ID),
    getAudioAnalysisProcessRootDir(runtime, project),
    getProjectSubtitleProcessDir(runtime, project),
    getProjectReportDir(runtime, project),
    getProjectFeatureReportDir(runtime, project, AUDIO_FEATURE_ID),
    getProjectFeatureDir(runtime, project, SUBTITLE_FEATURE_ID),
    getProjectFeatureReportDir(runtime, project, SUBTITLE_FEATURE_ID)
  ];
}
export function getRoomPackageToolsDir(runtime) {
  return asNonEmptyString(runtime.packageToolsDir);
}
export function getAudioAnalysisOpenSmileConfigDir(runtime) {
  const packageToolsDir = getRoomPackageToolsDir(runtime);
  return packageToolsDir !== null ? `${packageToolsDir}/opensmile` : null;
}
export function getAudioAnalysisOpenSmileConfigPath(runtime, relativePath) {
  const configDir = getAudioAnalysisOpenSmileConfigDir(runtime);
  return configDir !== null ? `${configDir}/${relativePath}` : null;
}
export function getAudioAnalysisYamnetDir(runtime) {
  const packageToolsDir = getRoomPackageToolsDir(runtime);
  return packageToolsDir !== null ? `${packageToolsDir}/yamnet` : null;
}
export function getAudioAnalysisYamnetScriptPath(runtime) {
  const yamnetDir = getAudioAnalysisYamnetDir(runtime);
  return yamnetDir !== null ? `${yamnetDir}/yamnet_infer.py` : null;
}
export function getAudioAnalysisDiarizationDir(runtime) {
  const packageToolsDir = getRoomPackageToolsDir(runtime);
  return packageToolsDir !== null ? `${packageToolsDir}/diarization` : null;
}
export function getAudioAnalysisDiarizationScriptPath(runtime) {
  const diarizationDir = getAudioAnalysisDiarizationDir(runtime);
  return diarizationDir !== null ? `${diarizationDir}/pyaudioanalysis_diarize.py` : null;
}
export function getAudioAnalysisMusicDir(runtime) {
  const packageToolsDir = getRoomPackageToolsDir(runtime);
  return packageToolsDir !== null ? `${packageToolsDir}/music` : null;
}
export function getAudioAnalysisMusicScriptPath(runtime) {
  const musicDir = getAudioAnalysisMusicDir(runtime);
  return musicDir !== null ? `${musicDir}/librosa_music_analysis.py` : null;
}
export function getProfileModelsDir(runtime) {
  return `${runtime.paths.storageDir}/models/whisper`;
}
export function getProfileModelStatePath(runtime) {
  return `${runtime.paths.storageDir}/profile-model-state.json`;
}
export function getAudioAnalysisProcessRootDir(runtime, project) {
  return getProjectFeatureProcessDir(runtime, project, AUDIO_FEATURE_ID);
}
export function getAudioAnalysisModuleProcessDir(runtime, project, moduleId, sanitizeFileSegment) {
  return `${getAudioAnalysisProcessRootDir(runtime, project)}/${sanitizeFileSegment(moduleId, "audio-module")}`;
}
