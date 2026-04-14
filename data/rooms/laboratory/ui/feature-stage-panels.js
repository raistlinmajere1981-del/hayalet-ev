export function createLaboratoryFeatureStagePanelsRuntime(deps) {
  const {
    createAudioAnalysisUi,
    createLaboratoryAudioAnalysisRuntime,
    createLaboratoryMediaPreviewUi,
    createMediaAnalysisEditPanels,
    createSubtitleAnalysisUiRuntime,
    escapeHtml,
    featureText,
    formatBitRate,
    formatDuration,
    formatEditWindowLabel,
    formatStatusLabel,
    getActiveEditOutput,
    getActiveProject,
    getActiveSubtitleEntry,
    getAudioAnalysisCapabilities,
    getAudioAnalysisModules,
    getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState,
    getCurrentEditMode,
    getCurrentEditRecipe,
    getCurrentFocusLabel,
    getCurrentFocusRegionId,
    getCurrentResizeLabel,
    getCurrentSourceKind,
    getCurrentSourceLabel,
    getCurrentSourceMode,
    getEditOutputs,
    getEditPresets,
    getEditPreview,
    getEffectiveMediaAsset,
    getPreferredSourceCodec,
    getPreferredSourceDuration,
    getPreferredSourceFormat,
    getPreferredSourceResolution,
    getProjectEdit,
    getProjectSource,
    getProjectStatusLabel,
    getSourceMetadata,
    getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders,
    getSubtitleDiscoveryItems,
    getSubtitleDiscoveryState,
    getSubtitleEditPresets,
    getSubtitleEditPreview,
    getSubtitleEditState,
    getSubtitleEntries,
    getSubtitleOutputs,
    getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary,
    getSubtitleProcessStatusLabel,
    getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels,
    getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary,
    getSubtitleSelectedCandidateIds,
    getSubtitleSelectedEntryIds,
    getSubtitleSourcePresets,
    getSubtitleWorkspace,
    getToolDisplayName,
    getToolEntry,
    laboratoryStageAccessorsRuntime,
    render,
    renderStageIntro,
    renderSummaryRows,
    renderTextField,
    state,
    subtitleTemplate,
    subtitleText,
    text,
    textFromKey,
    toRecord
  } = deps;
  function asRecord(value) {
    return toRecord(value);
  }
  function toJobRecord(value) {
    return asRecord(value);
  }
  function getRelevantJobsSafe() {
    return asRecord(laboratoryStageAccessorsRuntime.getRelevantJobs());
  }
  function getCurrentEditDraftSafe() {
    return asRecord(laboratoryStageAccessorsRuntime.getCurrentEditDraft());
  }
  function getCurrentDraftsSafe() {
    return asRecord(laboratoryStageAccessorsRuntime.getCurrentDrafts());
  }
  function getCurrentEditPresetOptionsSafe() {
    const presets = asRecord(getEditPresets()["presets"]);
    const presetsByKind = asRecord(presets[getCurrentSourceKind()]);
    const presetList = presetsByKind[getCurrentEditMode()];
    return Array.isArray(presetList) ? presetList.map(asRecord) : [];
  }
  function collectEditStageJobsSafe(projectJobs) {
    const jobs = laboratoryStageAccessorsRuntime.collectEditStageJobs(projectJobs);
    return Array.isArray(jobs) ? jobs.map(toJobRecord) : [];
  }
  function getEditJobLabelSafe(job) {
    const label = laboratoryStageAccessorsRuntime.getEditJobLabel(job);
    return typeof label === "string" ? label : "";
  }
  const laboratoryMediaPreviewUiDeps = {
    state,
    render,
    escapeHtml,
    text,
    formatDuration,
    getActiveProject,
    getProjectSource,
    getCurrentSourceMode,
    getRelevantJobs: getRelevantJobsSafe,
    getCurrentSourceKind,
    getProjectStatusLabel,
    getCurrentSourceLabel,
    getPreferredSourceDuration,
    getPreferredSourceResolution,
    getPreferredSourceCodec,
    getPreferredSourceFormat,
    formatBitRate,
    getSourceMetadata
  };
  const laboratoryMediaPreviewUi = createLaboratoryMediaPreviewUi(
    laboratoryMediaPreviewUiDeps
  );
  const { bindAudioAnalysis, bindPreviewMetrics, renderPreviewMetaRow, renderPreviewSurface } = laboratoryMediaPreviewUi;
  const mediaAnalysisEditPanelsDeps = {
    toRecord,
    escapeHtml,
    text,
    textFromKey,
    formatDuration,
    state,
    getCurrentSourceKind,
    getCurrentEditPresetOptions: getCurrentEditPresetOptionsSafe,
    getCurrentEditDraft: getCurrentEditDraftSafe,
    getProjectSource,
    getCurrentEditRecipe,
    getEffectiveMediaAsset,
    getEditPreview,
    getRelevantJobs: getRelevantJobsSafe,
    collectEditStageJobs: collectEditStageJobsSafe,
    renderPreviewMetaRow,
    getPreferredSourceDuration,
    getPreferredSourceResolution,
    getPreferredSourceCodec,
    getPreferredSourceFormat,
    getEditJobLabel: getEditJobLabelSafe,
    getCurrentEditMode,
    getEditPresets,
    getCurrentFocusRegionId,
    getEditOutputs,
    getActiveEditOutput,
    getToolEntry,
    getProjectEdit,
    renderSummaryRows,
    formatEditWindowLabel,
    getCurrentFocusLabel,
    getCurrentResizeLabel
  };
  const mediaAnalysisEditPanels = createMediaAnalysisEditPanels(
    mediaAnalysisEditPanelsDeps
  );
  const subtitleAnalysisUiRuntimeDeps = {
    toRecord,
    escapeHtml,
    featureText,
    subtitleText,
    subtitleTemplate,
    formatStatusLabel,
    formatDuration,
    renderSummaryRows,
    renderTextField,
    renderEditToggle: mediaAnalysisEditPanels.renderEditToggle,
    renderEditSelectField: mediaAnalysisEditPanels.renderEditSelectField,
    renderEditRangeField: mediaAnalysisEditPanels.renderEditRangeField,
    renderStageIntro,
    getCurrentDrafts: getCurrentDraftsSafe,
    getCurrentEditDraft: getCurrentEditDraftSafe,
    getToolEntry,
    getSubtitleSourcePresets,
    getSubtitleWorkspace,
    getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders,
    getSubtitleProcessStatusLabel,
    getSubtitleProcessModuleSummary,
    getSubtitleProcessModuleLabel,
    getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary,
    getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels,
    getActiveSubtitleEntry,
    getSubtitleSelectedEntryIds,
    getSubtitleDiscoveryState,
    getSubtitleDiscoveryItems,
    getSubtitleSelectedCandidateIds,
    getSubtitleEntries,
    getSubtitleEditState,
    getSubtitleEditPresets,
    getSubtitleEditPreview,
    getSubtitleOutputs
  };
  const subtitleAnalysisUiRuntime = createSubtitleAnalysisUiRuntime(
    subtitleAnalysisUiRuntimeDeps
  );
  const audioAnalysisUi = createAudioAnalysisUi({
    toRecord,
    escapeHtml,
    text,
    textFromKey,
    featureText,
    formatStatusLabel,
    renderSummaryRows,
    getToolDisplayName,
    getAudioAnalysisModules,
    getAudioAnalysisCapabilities,
    getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState,
    getAudioAnalysisOrderedResultEntries
  });
  const laboratoryAudioAnalysisRuntime = createLaboratoryAudioAnalysisRuntime({
    audioAnalysisUi
  });
  return {
    bindAudioAnalysis,
    bindPreviewMetrics,
    renderPreviewMetaRow,
    renderPreviewSurface,
    renderEditActionsPanel: mediaAnalysisEditPanels.renderEditActionsPanel,
    renderEditCommonPanel: mediaAnalysisEditPanels.renderEditCommonPanel,
    renderEditControlsPanel: mediaAnalysisEditPanels.renderEditControlsPanel,
    renderEditMediaMarkup: mediaAnalysisEditPanels.renderEditMediaMarkup,
    renderEditModePanel: mediaAnalysisEditPanels.renderEditModePanel,
    renderEditOutputsPanel: mediaAnalysisEditPanels.renderEditOutputsPanel,
    renderEditPresetChooser: mediaAnalysisEditPanels.renderEditPresetChooser,
    renderEditProgressPanel: mediaAnalysisEditPanels.renderEditProgressPanel,
    renderEditRangeField: mediaAnalysisEditPanels.renderEditRangeField,
    renderEditSelectField: mediaAnalysisEditPanels.renderEditSelectField,
    renderEditSummaryPanel: mediaAnalysisEditPanels.renderEditSummaryPanel,
    renderEditTextField: mediaAnalysisEditPanels.renderEditTextField,
    renderEditToggle: mediaAnalysisEditPanels.renderEditToggle,
    renderEditWorkspacePanel: mediaAnalysisEditPanels.renderEditWorkspacePanel,
    renderSubtitleDraftSelect: subtitleAnalysisUiRuntime.renderSubtitleDraftSelect,
    renderSubtitleProviderPanel: subtitleAnalysisUiRuntime.renderSubtitleProviderPanel,
    renderSubtitleSourceWorkspacePanel: subtitleAnalysisUiRuntime.renderSubtitleSourceWorkspacePanel,
    renderSubtitleSourceIntakePanel: subtitleAnalysisUiRuntime.renderSubtitleSourceIntakePanel,
    renderSubtitleEntryPanel: subtitleAnalysisUiRuntime.renderSubtitleEntryPanel,
    renderSubtitleDiscoveryPanel: subtitleAnalysisUiRuntime.renderSubtitleDiscoveryPanel,
    renderSubtitleCatalogPanel: subtitleAnalysisUiRuntime.renderSubtitleCatalogPanel,
    renderSubtitlePreviewBody: subtitleAnalysisUiRuntime.renderSubtitlePreviewBody,
    renderSubtitlePresetChooser: subtitleAnalysisUiRuntime.renderSubtitlePresetChooser,
    renderSubtitleEditWorkspacePanel: subtitleAnalysisUiRuntime.renderSubtitleEditWorkspacePanel,
    renderSubtitleEditControlsPanel: subtitleAnalysisUiRuntime.renderSubtitleEditControlsPanel,
    renderSubtitleEditActionsPanel: subtitleAnalysisUiRuntime.renderSubtitleEditActionsPanel,
    renderSubtitleOutputsPanel: subtitleAnalysisUiRuntime.renderSubtitleOutputsPanel,
    renderSubtitleEditSummaryPanel: subtitleAnalysisUiRuntime.renderSubtitleEditSummaryPanel,
    renderSubtitleEditStage: subtitleAnalysisUiRuntime.renderSubtitleEditStage,
    renderAudioAnalysisCatalogPanel: laboratoryAudioAnalysisRuntime.renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisNoticePanel: laboratoryAudioAnalysisRuntime.renderAudioAnalysisNoticePanel,
    renderAudioAnalysisProviderPanel: laboratoryAudioAnalysisRuntime.renderAudioAnalysisProviderPanel,
    renderAudioAnalysisModuleGrid: laboratoryAudioAnalysisRuntime.renderAudioAnalysisModuleGrid
  };
}
