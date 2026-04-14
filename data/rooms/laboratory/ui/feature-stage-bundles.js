export function createLaboratoryFeatureStageBundlesRuntime(deps) {
  const { laboratoryStageAccessorsRuntime, toRecord } = deps;
  function toUnknownArray(value) {
    return Array.isArray(value) ? value : [];
  }
  function toString(value) {
    return typeof value === "string" ? value : "";
  }
  function toNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
  function getProfileModelEntries() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProfileModelEntries());
  }
  function getProfileSelectedModel() {
    const selectedModel = laboratoryStageAccessorsRuntime.getProfileSelectedModel();
    return selectedModel;
  }
  function getProcessModules() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProcessModules());
  }
  function getProcessJobs() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProcessJobs());
  }
  function getProcessFindings() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProcessFindings());
  }
  function getCurrentFeatureTargetLabel() {
    return toString(laboratoryStageAccessorsRuntime.getCurrentFeatureTargetLabel());
  }
  function getCurrentFeatureArtifactCount() {
    return toNumber(laboratoryStageAccessorsRuntime.getCurrentFeatureArtifactCount());
  }
  function getReportFindings() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getReportFindings());
  }
  function getReportSummaryCards() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getReportSummaryCards());
  }
  function getReportExports() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getReportExports());
  }
  function getReportJobs() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getReportJobs());
  }
  function getProcessArtifacts() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProcessArtifacts());
  }
  function getProfilePresetOptions() {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProfilePresetOptions());
  }
  function getProfileLaneMap() {
    return toRecord(laboratoryStageAccessorsRuntime.getProfileLaneMap());
  }
  function getCurrentProfileMode() {
    const mode = laboratoryStageAccessorsRuntime.getCurrentProfileMode();
    return mode;
  }
  function getProfileEstimate() {
    const estimate = laboratoryStageAccessorsRuntime.getProfileEstimate();
    return estimate;
  }
  function getProfileLabel() {
    return toString(laboratoryStageAccessorsRuntime.getProfileLabel());
  }
  function getProfileSignals() {
    const signals = laboratoryStageAccessorsRuntime.getProfileSignals();
    return signals;
  }
  function getProfileArtifacts() {
    const artifacts = laboratoryStageAccessorsRuntime.getProfileArtifacts();
    return artifacts;
  }
  function getProfileReadiness() {
    const readiness = laboratoryStageAccessorsRuntime.getProfileReadiness();
    return readiness;
  }
  function getProfilePreflight() {
    const preflight = laboratoryStageAccessorsRuntime.getProfilePreflight();
    return preflight;
  }
  function getProfileJobs() {
    const jobs = laboratoryStageAccessorsRuntime.getProfileJobs();
    return jobs;
  }
  function getProfileTargetSummary() {
    const summary = laboratoryStageAccessorsRuntime.getProfileTargetSummary();
    return summary;
  }
  function getProfileTargetAsset() {
    const targetAsset = deps.getProfileTargetAsset();
    return targetAsset;
  }
  function getProfileTargetMode() {
    const targetMode = laboratoryStageAccessorsRuntime.getProfileTargetMode();
    return targetMode;
  }
  function getProfileTargetOutputOptions() {
    const outputOptions = laboratoryStageAccessorsRuntime.getProfileTargetOutputOptions();
    return outputOptions;
  }
  function getFocusLabel() {
    return toString(laboratoryStageAccessorsRuntime.getFocusLabel());
  }
  const laboratorySettingsUi = deps.createLaboratorySettingsUi({
    stageOrder: deps.stageOrder,
    state: deps.state,
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    formatBytes: deps.formatBytes,
    formatCleanupPolicy: deps.formatCleanupPolicy,
    formatPlatformList: deps.formatPlatformList,
    getToolEntry: deps.getToolEntry,
    getToolRegistry: deps.getToolRegistry,
    getStageToolIds: deps.getStageToolIds,
    getProfileModelEntries,
    getProfileSelectedModel,
    renderPreviewMetaRow: deps.renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel: deps.renderAudioAnalysisProviderPanel,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature
  });
  const laboratoryHostMessageRuntime = deps.createLaboratoryHostMessageRuntime({
    state: deps.state,
    toRecord: deps.toRecord,
    text: deps.text,
    render: deps.render,
    applyPresentationMode: deps.applyPresentationMode,
    applyLocale: deps.applyLocale,
    normalizeContext: deps.normalizeContext,
    shouldIgnoreCorrelatedPayload: deps.laboratoryRequestRuntime.shouldIgnoreCorrelatedPayload,
    setLastAction: deps.laboratoryRequestRuntime.setLastAction
  });
  const profileProcessBundle = deps.createLaboratoryProfileProcessReportComposition({
    createLaboratoryProcessStageUi: deps.createLaboratoryProcessStageUi,
    createLaboratoryProfileProcessReportRuntime: deps.createLaboratoryProfileProcessReportRuntime,
    createLaboratoryReportStageUi: deps.createLaboratoryReportStageUi,
    createMediaAnalysisProfilePanels: deps.createMediaAnalysisProfilePanels,
    createMediaAnalysisProfileStage: deps.createMediaAnalysisProfileStage,
    state: deps.state,
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    renderStageIntro: deps.renderStageIntro,
    renderSummaryRows: deps.renderSummaryRows,
    formatStatusLabel: deps.formatStatusLabel,
    formatDateTime: deps.formatDateTime,
    formatDuration: deps.formatDuration,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    getCurrentFeatureProcessRecord: deps.getCurrentFeatureProcessRecord,
    getProcessModules,
    getProcessJobs,
    getProcessFindings,
    getCurrentFeatureTargetLabel,
    getCurrentFeatureArtifactCount,
    getCurrentFeatureReportRecord: deps.getCurrentFeatureReportRecord,
    getProjectProcess: deps.getProjectProcess,
    getProjectReport: deps.getProjectReport,
    getWorkbench: deps.getWorkbench,
    getEffectiveMediaAsset: deps.getEffectiveMediaAsset,
    getReportFindings,
    getReportSummaryCards,
    getReportExports,
    getReportJobs,
    getFeaturePreviewImage: deps.getFeaturePreviewImage,
    renderAudioAnalysisModuleGrid: deps.renderAudioAnalysisModuleGrid,
    getProcessArtifacts,
    getCurrentSourceLabel: deps.getCurrentSourceLabel,
    getPreferredAssetDuration: deps.getPreferredAssetDuration,
    getSubtitleProcessModuleLabel: deps.getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary: deps.getSubtitleProcessModuleSummary,
    getProfileSignalKindLabel: deps.getProfileSignalKindLabel,
    getProfileConfidenceLabel: deps.getProfileConfidenceLabel,
    getProjectProfile: deps.getProjectProfile,
    getProfilePresetOptions,
    getProfileModelEntries,
    getProfileSelectedModel,
    getProfileLaneMap,
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getProfileArtifactPreferenceEntries: deps.getProfileArtifactPreferenceEntries,
    getProfileTranscriptSampleConfig: deps.getProfileTranscriptSampleConfig,
    getProfileCapabilities: deps.getProfileCapabilities,
    getProfileFrameDensityOptions: deps.getProfileFrameDensityOptions,
    getProfileLaneCardState: deps.getProfileLaneCardState,
    getCurrentProfileMode,
    getProfileEstimate,
    getProfileLabel,
    getProfileSignals,
    sortProfileSignals: deps.sortProfileSignals,
    getProfileArtifacts,
    getProfileReadiness,
    getProfilePreflight,
    getProfileJobs,
    getProjectSource: deps.getProjectSource,
    getPreferredAssetResolution: deps.getPreferredAssetResolution,
    getPreferredAssetCodec: deps.getPreferredAssetCodec,
    getProfileTargetSummary,
    getProfileTargetAsset,
    getProfileTargetMode,
    getProfileTargetOutputOptions,
    getFocusLabel
  });
  return {
    laboratoryHostMessageRuntime,
    laboratorySettingsUi,
    profileProcessBundle
  };
}
