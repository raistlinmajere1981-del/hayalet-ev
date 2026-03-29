// @ts-nocheck
export function createLaboratoryViewAccessorsRuntime(deps) {
  const currentFeatureProcessRecordFn = deps.getCurrentFeatureProcessRecord;
  const currentFeatureReportRecordFn = deps.getCurrentFeatureReportRecord;
  const projectAudioAnalysisFn = deps.getProjectAudioAnalysis;
  const subtitleEntriesFn = deps.getSubtitleEntries;
  const subtitleProcessModuleLabelFn = deps.getSubtitleProcessModuleLabel;
  const subtitleProviderLabelFn = deps.getSubtitleProviderLabel;
  const audioAnalysisCapabilitiesFn = deps.getAudioAnalysisCapabilities;
  const audioAnalysisOrderedResultEntriesFn = deps.getAudioAnalysisOrderedResultEntries;
  const audioAnalysisPresetsFn = deps.getAudioAnalysisPresets;
  const audioAnalysisProvidersFn = deps.getAudioAnalysisProviders;
  const profileTargetAssetFn = deps.getProfileTargetAsset;
  const renderToolCardFn = deps.renderToolCard;
  const renderProfileModelCardFn = deps.renderProfileModelCard;
  const renderSettingsOverlayFn = deps.renderSettingsOverlay;

  function getCurrentFeatureProcessRecord() {
    return currentFeatureProcessRecordFn();
  }

  function getCurrentFeatureReportRecord() {
    return currentFeatureReportRecordFn();
  }

  function getProjectAudioAnalysis() {
    return projectAudioAnalysisFn();
  }

  function getSubtitleEntries() {
    return subtitleEntriesFn();
  }

  function getSubtitleProcessModuleLabel(entry) {
    return subtitleProcessModuleLabelFn(entry);
  }

  function getSubtitleProviderLabel(entry) {
    return subtitleProviderLabelFn(entry);
  }

  function getAudioAnalysisCapabilities() {
    return audioAnalysisCapabilitiesFn();
  }

  function getAudioAnalysisPresets() {
    return audioAnalysisPresetsFn();
  }

  function getAudioAnalysisProviders() {
    const providers = audioAnalysisProvidersFn();
    return providers && typeof providers === "object" && Array.isArray(providers) === false
      ? providers
      : {};
  }

  function getAudioAnalysisProviderEntries() {
    const providers = getAudioAnalysisProviders().providers;
    return Array.isArray(providers) ? providers : [];
  }

  function getProfileTargetAsset() {
    return profileTargetAssetFn();
  }

  function getAudioAnalysisOrderedResultEntries() {
    return audioAnalysisOrderedResultEntriesFn();
  }

  function renderToolCard(toolId, stageId) {
    return renderToolCardFn(toolId, stageId);
  }

  function renderProfileModelCard(entry) {
    return renderProfileModelCardFn(entry);
  }

  function renderSettingsOverlay() {
    return renderSettingsOverlayFn();
  }

  return {
    getAudioAnalysisOrderedResultEntries: getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisCapabilities: getAudioAnalysisCapabilities,
    getAudioAnalysisProviderEntries: getAudioAnalysisProviderEntries,
    getAudioAnalysisPresets: getAudioAnalysisPresets,
    getAudioAnalysisProviders: getAudioAnalysisProviders,
    getCurrentFeatureProcessRecord: getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord: getCurrentFeatureReportRecord,
    getProjectAudioAnalysis: getProjectAudioAnalysis,
    getProfileTargetAsset: getProfileTargetAsset,
    getSubtitleEntries: getSubtitleEntries,
    getSubtitleProcessModuleLabel: getSubtitleProcessModuleLabel,
    getSubtitleProviderLabel: getSubtitleProviderLabel,
    renderProfileModelCard: renderProfileModelCard,
    renderSettingsOverlay: renderSettingsOverlay,
    renderToolCard: renderToolCard,
  };
}
