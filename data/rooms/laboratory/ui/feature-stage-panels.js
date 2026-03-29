export function createLaboratoryFeatureStagePanelsRuntime(deps) {
  const laboratoryMediaPreviewUi = deps.createLaboratoryMediaPreviewUi({
    state: deps.state,
    render: deps.render,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    formatDuration: deps.formatDuration,
    getActiveProject: deps.getActiveProject,
    getProjectSource: deps.getProjectSource,
    getCurrentSourceMode: deps.getCurrentSourceMode,
    getRelevantJobs() {
      return deps.laboratoryStageAccessorsRuntime.getRelevantJobs();
    },
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getProjectStatusLabel: deps.getProjectStatusLabel,
    getCurrentSourceLabel: deps.getCurrentSourceLabel,
    getPreferredSourceDuration: deps.getPreferredSourceDuration,
    getPreferredSourceResolution: deps.getPreferredSourceResolution,
    getPreferredSourceCodec: deps.getPreferredSourceCodec,
    getPreferredSourceFormat: deps.getPreferredSourceFormat,
    formatBitRate: deps.formatBitRate,
    getSourceMetadata: deps.getSourceMetadata
  });
  const { bindAudioAnalysis, bindPreviewMetrics, renderPreviewMetaRow, renderPreviewSurface } = laboratoryMediaPreviewUi;
  const mediaAnalysisEditPanels = deps.createMediaAnalysisEditPanels({
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    formatDuration: deps.formatDuration,
    state: deps.state,
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getCurrentEditPresetOptions() {
      return deps.laboratoryStageAccessorsRuntime.getProfilePresetOptions();
    },
    getCurrentEditDraft() {
      return deps.laboratoryStageAccessorsRuntime.getCurrentEditDraft();
    },
    getProjectSource: deps.getProjectSource,
    getCurrentEditRecipe: deps.getCurrentEditRecipe,
    getEffectiveMediaAsset: deps.getEffectiveMediaAsset,
    getEditPreview: deps.getEditPreview,
    getRelevantJobs() {
      return deps.laboratoryStageAccessorsRuntime.getRelevantJobs();
    },
    collectEditStageJobs(projectJobs) {
      return deps.laboratoryStageAccessorsRuntime.collectEditStageJobs(projectJobs);
    },
    renderPreviewMetaRow,
    getPreferredSourceDuration: deps.getPreferredSourceDuration,
    getPreferredSourceResolution: deps.getPreferredSourceResolution,
    getPreferredSourceCodec: deps.getPreferredSourceCodec,
    getPreferredSourceFormat: deps.getPreferredSourceFormat,
    getEditJobLabel(job) {
      return deps.laboratoryStageAccessorsRuntime.getEditJobLabel(job);
    },
    getCurrentEditMode: deps.getCurrentEditMode,
    getEditPresets: deps.getEditPresets,
    getCurrentFocusRegionId: deps.getCurrentFocusRegionId,
    getEditOutputs: deps.getEditOutputs,
    getActiveEditOutput: deps.getActiveEditOutput,
    getToolEntry: deps.getToolEntry,
    getProjectEdit: deps.getProjectEdit,
    renderSummaryRows: deps.renderSummaryRows,
    formatEditWindowLabel: deps.formatEditWindowLabel,
    getCurrentFocusLabel: deps.getCurrentFocusLabel,
    getCurrentResizeLabel: deps.getCurrentResizeLabel
  });
  const subtitleAnalysisUiRuntime = deps.createSubtitleAnalysisUiRuntime({
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    featureText: deps.featureText,
    subtitleText: deps.subtitleText,
    subtitleTemplate: deps.subtitleTemplate,
    formatStatusLabel: deps.formatStatusLabel,
    formatDuration: deps.formatDuration,
    renderSummaryRows: deps.renderSummaryRows,
    renderTextField: deps.renderTextField,
    renderEditToggle: mediaAnalysisEditPanels.renderEditToggle,
    renderEditSelectField: mediaAnalysisEditPanels.renderEditSelectField,
    renderEditRangeField: mediaAnalysisEditPanels.renderEditRangeField,
    renderStageIntro: deps.renderStageIntro,
    getCurrentDrafts() {
      return deps.laboratoryStageAccessorsRuntime.getCurrentDrafts();
    },
    getCurrentEditDraft() {
      return deps.laboratoryStageAccessorsRuntime.getCurrentEditDraft();
    },
    getToolEntry: deps.getToolEntry,
    getSubtitleSourcePresets: deps.getSubtitleSourcePresets,
    getSubtitleWorkspace: deps.getSubtitleWorkspace,
    getSubtitleAnalysisCatalog: deps.getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders: deps.getSubtitleAnalysisProviders,
    getSubtitleProcessStatusLabel: deps.getSubtitleProcessStatusLabel,
    getSubtitleProcessModuleSummary: deps.getSubtitleProcessModuleSummary,
    getSubtitleProcessModuleLabel: deps.getSubtitleProcessModuleLabel,
    getSubtitleProviderStatusLabel: deps.getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary: deps.getSubtitleProviderSummary,
    getSubtitleProviderLabel: deps.getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels: deps.getSubtitleProviderModuleLabels,
    getActiveSubtitleEntry: deps.getActiveSubtitleEntry,
    getSubtitleSelectedEntryIds: deps.getSubtitleSelectedEntryIds,
    getSubtitleDiscoveryState: deps.getSubtitleDiscoveryState,
    getSubtitleDiscoveryItems: deps.getSubtitleDiscoveryItems,
    getSubtitleSelectedCandidateIds: deps.getSubtitleSelectedCandidateIds,
    getSubtitleEntries: deps.getSubtitleEntries,
    getSubtitleEditState: deps.getSubtitleEditState,
    getSubtitleEditPresets: deps.getSubtitleEditPresets,
    getSubtitleEditPreview: deps.getSubtitleEditPreview,
    getSubtitleOutputs: deps.getSubtitleOutputs
  });
  const audioAnalysisUi = deps.createAudioAnalysisUi({
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    formatStatusLabel: deps.formatStatusLabel,
    renderSummaryRows: deps.renderSummaryRows,
    getToolDisplayName: deps.getToolDisplayName,
    getAudioAnalysisModules: deps.getAudioAnalysisModules,
    getAudioAnalysisCapabilities: deps.getAudioAnalysisCapabilities,
    getAudioAnalysisProviderEntries: deps.getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState: deps.getAudioAnalysisProviderState,
    getAudioAnalysisOrderedResultEntries: deps.getAudioAnalysisOrderedResultEntries
  });
  const laboratoryAudioAnalysisRuntime = deps.createLaboratoryAudioAnalysisRuntime({
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
