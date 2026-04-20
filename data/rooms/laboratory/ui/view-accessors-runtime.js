function isLaboratoryRecord(value) {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}
export function createLaboratoryViewAccessorsRuntime(deps) {
  const currentFeatureProcessRecordFn = deps.getCurrentFeatureProcessRecord;
  const currentFeatureReportRecordFn = deps.getCurrentFeatureReportRecord;
  const projectAudioAnalysisFn = deps.getProjectAudioAnalysis;
  const projectWorkbenchFn = deps.getProjectWorkbench;
  const subtitleEntriesFn = deps.getSubtitleEntries;
  const subtitleProcessModuleLabelFn = deps.getSubtitleProcessModuleLabel;
  const subtitleProviderLabelFn = deps.getSubtitleProviderLabel;
  const audioAnalysisCapabilitiesFn = deps.getAudioAnalysisCapabilities;
  const audioAnalysisOrderedResultEntriesFn = deps.getAudioAnalysisOrderedResultEntries;
  const audioAnalysisPresetsFn = deps.getAudioAnalysisPresets;
  const audioAnalysisProvidersFn = deps.getAudioAnalysisProviders;
  const visualAnalysisCapabilitiesFn = deps.getVisualAnalysisCapabilities;
  const visualAnalysisCatalogFn = deps.getVisualAnalysisCatalog;
  const visualAnalysisProvidersFn = deps.getVisualAnalysisProviders;
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
  function getProjectWorkbench() {
    return projectWorkbenchFn();
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
    return isLaboratoryRecord(providers) ? providers : {};
  }
  function getAudioAnalysisProviderEntries() {
    const providers = getAudioAnalysisProviders().providers;
    return Array.isArray(providers) ? providers : [];
  }
  function getVisualAnalysisCatalog() {
    return visualAnalysisCatalogFn();
  }
  function getVisualAnalysisCapabilities() {
    return visualAnalysisCapabilitiesFn();
  }
  function getVisualAnalysisProviders() {
    const providers = visualAnalysisProvidersFn();
    return isLaboratoryRecord(providers) ? providers : {};
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
    getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisCapabilities,
    getAudioAnalysisProviderEntries,
    getAudioAnalysisPresets,
    getAudioAnalysisProviders,
    getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord,
    getProjectAudioAnalysis,
    getProjectWorkbench,
    getProfileTargetAsset,
    getSubtitleEntries,
    getSubtitleProcessModuleLabel,
    getSubtitleProviderLabel,
    getVisualAnalysisCapabilities,
    getVisualAnalysisCatalog,
    getVisualAnalysisProviders,
    renderProfileModelCard,
    renderSettingsOverlay,
    renderToolCard
  };
}
