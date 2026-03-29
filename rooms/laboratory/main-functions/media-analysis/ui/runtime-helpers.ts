import {
  formatBitRate as formatMediaAnalysisBitRate,
  formatBytes as formatMediaAnalysisBytes,
  formatCleanupPolicy as formatMediaAnalysisCleanupPolicy,
  formatPlatformList as formatMediaAnalysisPlatformList,
  getMediaKindLabel as getMediaAnalysisKindLabel,
  getPreferredAssetCodec as getMediaAnalysisPreferredAssetCodec,
  getPreferredAssetDuration as getMediaAnalysisPreferredAssetDuration,
  getPreferredAssetResolution as getMediaAnalysisPreferredAssetResolution,
  getPreferredSourceCodec as getMediaAnalysisPreferredSourceCodec,
  getPreferredSourceDuration as getMediaAnalysisPreferredSourceDuration,
  getPreferredSourceFormat as getMediaAnalysisPreferredSourceFormat,
  getPreferredSourceResolution as getMediaAnalysisPreferredSourceResolution,
  getProfileArtifactPreferenceEntries as getMediaAnalysisProfileArtifactPreferenceEntries,
  getProfileConfidenceLabel as getMediaAnalysisProfileConfidenceLabel,
  getProfileFrameDensityOptions as getMediaAnalysisProfileFrameDensityOptions,
  getProfileLaneCardState as getMediaAnalysisProfileLaneCardState,
  getProfileSignalKindLabel as getMediaAnalysisProfileSignalKindLabel,
  getProfileTranscriptSampleConfig as getMediaAnalysisProfileTranscriptSampleConfig,
  getToolDisplayName as getMediaAnalysisToolDisplayName,
  getTopProfileSignals as getMediaAnalysisTopProfileSignals,
  sortProfileSignals as sortMediaAnalysisProfileSignals,
} from "./profile-helpers.js";

export function createMediaAnalysisUiRuntimeHelpers(deps) {
  const state = deps.state;
  const text = deps.text;
  const featureText = deps.featureText;
  const toRecord = deps.toRecord;

  function getSubtitleMimeType(fileName) {
    const normalized = typeof fileName === "string" ? fileName.toLowerCase() : "";
    if (normalized.endsWith(".vtt")) {
      return "text/vtt";
    }
    if (normalized.endsWith(".ass") || normalized.endsWith(".ssa")) {
      return "text/x-ass";
    }
    return "application/x-subrip";
  }

  function getProjectStatusLabel(source) {
    if (source.status === "error") {
      return text(["mediaAnalysis", "settings", "status", "error"]);
    }
    if (typeof source.storedPath === "string" && source.storedPath.trim() !== "") {
      return text(["mediaAnalysis", "settings", "status", "ready"]);
    }
    return text(["mediaAnalysis", "settings", "status", "idle"]);
  }

  function getProfileArtifactPreferenceEntries() {
    return getMediaAnalysisProfileArtifactPreferenceEntries({
      currentSourceKind: deps.getCurrentSourceKind(),
      profileCapabilities: deps.getProfileCapabilities(),
      projectProfile: deps.getProjectProfile(),
      toRecord: toRecord,
    });
  }

  function getProfileFrameDensityOptions() {
    return getMediaAnalysisProfileFrameDensityOptions({
      profileCapabilities: deps.getProfileCapabilities(),
      toRecord: toRecord,
    });
  }

  function getProfileTranscriptSampleConfig() {
    return getMediaAnalysisProfileTranscriptSampleConfig({
      profileCapabilities: deps.getProfileCapabilities(),
      toRecord: toRecord,
    });
  }

  function sortProfileSignals(signals) {
    return sortMediaAnalysisProfileSignals(signals, toRecord);
  }

  function getTopProfileSignals(limit) {
    return getMediaAnalysisTopProfileSignals(deps.getProfileSignals(), limit, toRecord);
  }

  function getProfileSignalKindLabel(kind) {
    return getMediaAnalysisProfileSignalKindLabel(text, kind);
  }

  function getProfileConfidenceLabel(confidence) {
    return getMediaAnalysisProfileConfidenceLabel(text, confidence);
  }

  function formatPlatformList(platforms) {
    return formatMediaAnalysisPlatformList(platforms);
  }

  function formatCleanupPolicy(policy) {
    return formatMediaAnalysisCleanupPolicy(policy, toRecord, text);
  }

  function getPreferredSourceDuration(previewUrl) {
    return getMediaAnalysisPreferredSourceDuration(
      deps.getSourceMetadata(),
      state.ui.previewMetrics,
      previewUrl
    );
  }

  function getPreferredSourceResolution(previewUrl) {
    return getMediaAnalysisPreferredSourceResolution(
      deps.getSourceMetadata(),
      state.ui.previewMetrics,
      previewUrl
    );
  }

  function getPreferredSourceCodec() {
    return getMediaAnalysisPreferredSourceCodec(deps.getSourceMetadata());
  }

  function getPreferredAssetDuration(asset) {
    return getMediaAnalysisPreferredAssetDuration(asset, state.ui.previewMetrics, toRecord);
  }

  function getPreferredAssetResolution(asset) {
    return getMediaAnalysisPreferredAssetResolution(asset, state.ui.previewMetrics, toRecord);
  }

  function getPreferredAssetCodec(asset) {
    return getMediaAnalysisPreferredAssetCodec(asset, toRecord);
  }

  function getToolDisplayName(toolId) {
    return getMediaAnalysisToolDisplayName(toolId, deps.getToolRegistry(), text);
  }

  function getMediaKindLabel(kind) {
    return getMediaAnalysisKindLabel(kind, featureText);
  }

  function getProfileLaneCardState(laneId) {
    return getMediaAnalysisProfileLaneCardState({
      currentSourceKind: deps.getCurrentSourceKind(),
      getMediaKindLabel: getMediaKindLabel,
      getToolDisplayName: getToolDisplayName,
      getToolEntry: deps.getToolEntry,
      laneId: laneId,
      profileLaneMap: deps.getProfileLaneMap(),
      profileReadiness: deps.getProfileReadiness(),
      projectProfile: deps.getProjectProfile(),
      text: text,
      toRecord: toRecord,
    });
  }

  function getPreferredSourceFormat() {
    return getMediaAnalysisPreferredSourceFormat(deps.getSourceMetadata(), deps.getProjectSource());
  }

  function formatBitRate(bitsPerSecond) {
    return formatMediaAnalysisBitRate(bitsPerSecond);
  }

  function formatBytes(value) {
    return formatMediaAnalysisBytes(value);
  }

  return {
    formatBitRate: formatBitRate,
    formatBytes: formatBytes,
    formatCleanupPolicy: formatCleanupPolicy,
    formatPlatformList: formatPlatformList,
    getMediaKindLabel: getMediaKindLabel,
    getPreferredAssetCodec: getPreferredAssetCodec,
    getPreferredAssetDuration: getPreferredAssetDuration,
    getPreferredAssetResolution: getPreferredAssetResolution,
    getPreferredSourceCodec: getPreferredSourceCodec,
    getPreferredSourceDuration: getPreferredSourceDuration,
    getPreferredSourceFormat: getPreferredSourceFormat,
    getPreferredSourceResolution: getPreferredSourceResolution,
    getProfileArtifactPreferenceEntries: getProfileArtifactPreferenceEntries,
    getProfileConfidenceLabel: getProfileConfidenceLabel,
    getProfileFrameDensityOptions: getProfileFrameDensityOptions,
    getProfileLaneCardState: getProfileLaneCardState,
    getProfileSignalKindLabel: getProfileSignalKindLabel,
    getProfileTranscriptSampleConfig: getProfileTranscriptSampleConfig,
    getSubtitleMimeType: getSubtitleMimeType,
    getToolDisplayName: getToolDisplayName,
    getTopProfileSignals: getTopProfileSignals,
    getProjectStatusLabel: getProjectStatusLabel,
    sortProfileSignals: sortProfileSignals,
  };
}
