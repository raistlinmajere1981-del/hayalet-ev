type LaboratoryRecord = Record<string, unknown>;

type LaboratoryAudioAnalysisProvidersRecord = LaboratoryRecord & {
  providers?: unknown;
};

type LaboratoryViewAccessorsRuntimeDeps = {
  getAudioAnalysisCapabilities: () => unknown;
  getAudioAnalysisOrderedResultEntries: () => unknown[];
  getAudioAnalysisPresets: () => unknown;
  getAudioAnalysisProviders: () => unknown;
  getCurrentFeatureProcessRecord: () => unknown;
  getCurrentFeatureReportRecord: () => unknown;
  getProfileTargetAsset: () => unknown;
  getProjectAudioAnalysis: () => unknown;
  getSubtitleEntries: () => unknown;
  getSubtitleProcessModuleLabel: (entry: unknown) => string;
  getSubtitleProviderLabel: (entry: unknown) => string;
  renderProfileModelCard: (entry: unknown) => string;
  renderSettingsOverlay: () => string;
  renderToolCard: (toolId: string, stageId: string) => string;
};

function isLaboratoryRecord(value: unknown): value is LaboratoryRecord {
  return typeof value === "object" && value !== null && Array.isArray(value) === false;
}

export function createLaboratoryViewAccessorsRuntime(deps: LaboratoryViewAccessorsRuntimeDeps) {
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

  function getSubtitleProcessModuleLabel(entry: unknown) {
    return subtitleProcessModuleLabelFn(entry);
  }

  function getSubtitleProviderLabel(entry: unknown) {
    return subtitleProviderLabelFn(entry);
  }

  function getAudioAnalysisCapabilities() {
    return audioAnalysisCapabilitiesFn();
  }

  function getAudioAnalysisPresets() {
    return audioAnalysisPresetsFn();
  }

  function getAudioAnalysisProviders(): LaboratoryAudioAnalysisProvidersRecord {
    const providers = audioAnalysisProvidersFn();
    return isLaboratoryRecord(providers) ? providers : {};
  }

  function getAudioAnalysisProviderEntries(): unknown[] {
    const providers = getAudioAnalysisProviders().providers;
    return Array.isArray(providers) ? providers : [];
  }

  function getProfileTargetAsset() {
    return profileTargetAssetFn();
  }

  function getAudioAnalysisOrderedResultEntries() {
    return audioAnalysisOrderedResultEntriesFn();
  }

  function renderToolCard(toolId: string, stageId: string) {
    return renderToolCardFn(toolId, stageId);
  }

  function renderProfileModelCard(entry: unknown) {
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
