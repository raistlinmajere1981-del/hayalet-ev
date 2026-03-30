export function createLaboratoryFeatureStageBundlesRuntime(deps: any) {
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
    getProfileModelEntries() {
      return deps.laboratoryStageAccessorsRuntime.getProfileModelEntries();
    },
    getProfileSelectedModel() {
      return deps.laboratoryStageAccessorsRuntime.getProfileSelectedModel();
    },
    renderPreviewMetaRow: deps.renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel: deps.renderAudioAnalysisProviderPanel,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
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
    setLastAction: deps.laboratoryRequestRuntime.setLastAction,
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
    getProcessModules() {
      return deps.laboratoryStageAccessorsRuntime.getProcessModules();
    },
    getProcessJobs() {
      return deps.laboratoryStageAccessorsRuntime.getProcessJobs();
    },
    getProcessFindings() {
      return deps.laboratoryStageAccessorsRuntime.getProcessFindings();
    },
    getCurrentFeatureTargetLabel() {
      return deps.laboratoryStageAccessorsRuntime.getCurrentFeatureTargetLabel();
    },
    getCurrentFeatureArtifactCount() {
      return deps.laboratoryStageAccessorsRuntime.getCurrentFeatureArtifactCount();
    },
    getCurrentFeatureReportRecord: deps.getCurrentFeatureReportRecord,
    getEffectiveMediaAsset: deps.getEffectiveMediaAsset,
    getReportFindings() {
      return deps.laboratoryStageAccessorsRuntime.getReportFindings();
    },
    getReportSummaryCards() {
      return deps.laboratoryStageAccessorsRuntime.getReportSummaryCards();
    },
    getReportExports() {
      return deps.laboratoryStageAccessorsRuntime.getReportExports();
    },
    getReportJobs() {
      return deps.laboratoryStageAccessorsRuntime.getReportJobs();
    },
    getFeaturePreviewImage: deps.getFeaturePreviewImage,
    renderAudioAnalysisModuleGrid: deps.renderAudioAnalysisModuleGrid,
    getProcessArtifacts() {
      return deps.laboratoryStageAccessorsRuntime.getProcessArtifacts();
    },
    getCurrentSourceLabel: deps.getCurrentSourceLabel,
    getPreferredAssetDuration: deps.getPreferredAssetDuration,
    getSubtitleProcessModuleLabel: deps.getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary: deps.getSubtitleProcessModuleSummary,
    getProfileSignalKindLabel: deps.getProfileSignalKindLabel,
    getProfileConfidenceLabel: deps.getProfileConfidenceLabel,
    getProjectProfile: deps.getProjectProfile,
    getProfilePresetOptions() {
      return deps.laboratoryStageAccessorsRuntime.getProfilePresetOptions();
    },
    getProfileModelEntries() {
      return deps.laboratoryStageAccessorsRuntime.getProfileModelEntries();
    },
    getProfileSelectedModel() {
      return deps.laboratoryStageAccessorsRuntime.getProfileSelectedModel();
    },
    getProfileLaneMap() {
      return deps.laboratoryStageAccessorsRuntime.getProfileLaneMap();
    },
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getProfileArtifactPreferenceEntries: deps.getProfileArtifactPreferenceEntries,
    getProfileTranscriptSampleConfig: deps.getProfileTranscriptSampleConfig,
    getProfileCapabilities: deps.getProfileCapabilities,
    getProfileFrameDensityOptions: deps.getProfileFrameDensityOptions,
    getProfileLaneCardState: deps.getProfileLaneCardState,
    getCurrentProfileMode() {
      return deps.laboratoryStageAccessorsRuntime.getCurrentProfileMode();
    },
    getProfileEstimate() {
      return deps.laboratoryStageAccessorsRuntime.getProfileEstimate();
    },
    getProfileLabel() {
      return deps.laboratoryStageAccessorsRuntime.getProfileLabel();
    },
    getProfileSignals() {
      return deps.laboratoryStageAccessorsRuntime.getProfileSignals();
    },
    sortProfileSignals: deps.sortProfileSignals,
    getProfileArtifacts() {
      return deps.laboratoryStageAccessorsRuntime.getProfileArtifacts();
    },
    getProfileReadiness() {
      return deps.laboratoryStageAccessorsRuntime.getProfileReadiness();
    },
    getProfilePreflight() {
      return deps.laboratoryStageAccessorsRuntime.getProfilePreflight();
    },
    getProfileJobs() {
      return deps.laboratoryStageAccessorsRuntime.getProfileJobs();
    },
    getProjectSource: deps.getProjectSource,
    getPreferredAssetResolution: deps.getPreferredAssetResolution,
    getPreferredAssetCodec: deps.getPreferredAssetCodec,
    getProfileTargetSummary() {
      return deps.laboratoryStageAccessorsRuntime.getProfileTargetSummary();
    },
    getProfileTargetAsset: deps.getProfileTargetAsset,
    getProfileTargetMode() {
      return deps.laboratoryStageAccessorsRuntime.getProfileTargetMode();
    },
    getProfileTargetOutputOptions() {
      return deps.laboratoryStageAccessorsRuntime.getProfileTargetOutputOptions();
    },
    getFocusLabel() {
      return deps.laboratoryStageAccessorsRuntime.getFocusLabel();
    },
  });

  return {
    laboratoryHostMessageRuntime,
    laboratorySettingsUi,
    profileProcessBundle,
  };
}
