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
  getProjectWorkbench: () => unknown;
  getSubtitleEntries: () => unknown;
  getSubtitleProcessModuleLabel: (entry: unknown) => string;
  getSubtitleProviderLabel: (entry: unknown) => string;
  getVisualAnalysisCapabilities: () => unknown;
  getVisualAnalysisCatalog: () => unknown;
  getVisualAnalysisProviders: () => unknown;
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
    getProjectWorkbench: getProjectWorkbench,
    getProfileTargetAsset: getProfileTargetAsset,
    getSubtitleEntries: getSubtitleEntries,
    getSubtitleProcessModuleLabel: getSubtitleProcessModuleLabel,
    getSubtitleProviderLabel: getSubtitleProviderLabel,
    getVisualAnalysisCapabilities: getVisualAnalysisCapabilities,
    getVisualAnalysisCatalog: getVisualAnalysisCatalog,
    getVisualAnalysisProviders: getVisualAnalysisProviders,
    renderProfileModelCard: renderProfileModelCard,
    renderSettingsOverlay: renderSettingsOverlay,
    renderToolCard: renderToolCard,
  };
}
