export function createLaboratoryUiShellComposition(deps) {
  const laboratorySourceStageCompositionDeps = {
    state: deps.state,
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    renderStageIntro: deps.renderStageIntro,
    renderTextField: deps.renderTextField,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    getProjectSummaries: deps.getProjectSummaries,
    getSourceSnapshot: deps.getSourceSnapshot,
    getActiveProject: deps.getActiveProject,
    getAvailableSourceFormats: deps.getAvailableSourceFormats,
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getCurrentSourceMode: deps.getCurrentSourceMode,
    getSourceModeOptions: deps.getSourceModeOptions,
    getToolEntry: deps.getToolEntry,
    getCurrentDrafts: deps.getCurrentDrafts,
    getYtDlpForm: deps.getYtDlpForm,
    renderPreviewSurface: deps.renderPreviewSurface,
    renderAudioAnalysisCatalogPanel: deps.renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisProviderPanel: deps.renderAudioAnalysisProviderPanel,
    renderAudioAnalysisNoticePanel: deps.renderAudioAnalysisNoticePanel,
    renderSubtitleSourceWorkspacePanel: deps.renderSubtitleSourceWorkspacePanel,
    renderSubtitleDiscoveryPanel: deps.renderSubtitleDiscoveryPanel,
    renderSubtitleCatalogPanel: deps.renderSubtitleCatalogPanel,
    renderSubtitleProviderPanel: deps.renderSubtitleProviderPanel,
    renderSubtitleSourceIntakePanel: deps.renderSubtitleSourceIntakePanel,
    renderSubtitleEntryPanel: deps.renderSubtitleEntryPanel
  };
  const laboratorySourceStageUi = deps.createLaboratorySourceStageComposition(
    laboratorySourceStageCompositionDeps
  );
  const laboratoryStageShellDelegatesDeps = {
    laboratorySourceStageUi,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    renderSubtitleEditStage: deps.renderSubtitleEditStage,
    renderMediaAnalysisEditStage: deps.renderMediaAnalysisEditStage,
    mediaAnalysisEditStageDeps: {
      escapeHtml: deps.escapeHtml,
      getCurrentEditMode: deps.getCurrentEditMode,
      getProjectSource: deps.getProjectSource,
      renderEditAdvancedPanel: deps.renderEditAdvancedPanel,
      renderEditActionsPanel: deps.renderEditActionsPanel,
      renderEditCommonPanel: deps.renderEditCommonPanel,
      renderEditControlsPanel: deps.renderEditControlsPanel,
      renderEditModePanel: deps.renderEditModePanel,
      renderEditOutputsPanel: deps.renderEditOutputsPanel,
      renderEditPresetChooser: deps.renderEditPresetChooser,
      renderEditProgressPanel: deps.renderEditProgressPanel,
      renderEditSummaryPanel: deps.renderEditSummaryPanel,
      renderEditWorkspacePanel: deps.renderEditWorkspacePanel,
      renderStageIntro: deps.renderStageIntro,
      text: deps.text
    },
    mediaAnalysisProfileStage: deps.mediaAnalysisProfileStage,
    laboratoryProcessStageUi: deps.laboratoryProcessStageUi,
    laboratoryReportStageUi: deps.laboratoryReportStageUi
  };
  const laboratoryStageShellDelegates = deps.createLaboratoryStageShellDelegates(
    laboratoryStageShellDelegatesDeps
  );
  const laboratoryUiShellRuntimeDeps = {
    state: deps.state,
    documentRef: deps.documentRef,
    escapeHtml: deps.escapeHtml,
    renderBootstrap: deps.renderBootstrap,
    renderStageRail: deps.renderStageRail,
    renderSettingsOverlay: deps.renderSettingsOverlay,
    renderSourceStage: laboratoryStageShellDelegates.renderSourceStage,
    renderEditStage: laboratoryStageShellDelegates.renderEditStage,
    renderProfileStage: laboratoryStageShellDelegates.renderProfileStage,
    renderProcessStage: laboratoryStageShellDelegates.renderProcessStage,
    renderReportStage: laboratoryStageShellDelegates.renderReportStage,
    captureScrollState: deps.captureScrollState,
    restoreScrollState: deps.restoreScrollState,
    bindPreviewMetrics: deps.bindPreviewMetrics,
    bindAudioAnalysis: deps.bindAudioAnalysis,
    text: deps.text
  };
  const laboratoryUiShellRuntime = deps.createLaboratoryUiShellRuntime(
    laboratoryUiShellRuntimeDeps
  );
  const laboratoryUiActionRouterDeps = {
    advanceStage: deps.advanceStage,
    buildCurrentDraftPayload: deps.buildCurrentDraftPayload,
    buildCurrentEditRecipePatch: deps.buildCurrentEditRecipePatch,
    buildNestedPatch: deps.buildNestedPatch,
    closeSettingsOverlay: deps.closeSettingsOverlay,
    commitEditPatch: deps.commitEditPatch,
    getActiveEditOutput: deps.getActiveEditOutput,
    getCurrentEditDraft: deps.getCurrentEditDraft,
    getProfileTargetSummary: deps.getProfileTargetSummary,
    getProjectProfile: deps.getProjectProfile,
    getSourceSnapshot: deps.getSourceSnapshot,
    getToolRegistry: deps.getToolRegistry,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    openReport: deps.openReport,
    openSettingsOverlay: deps.openSettingsOverlay,
    persistDrafts: deps.persistDrafts,
    readFormValue: deps.readFormValue,
    render: deps.render,
    resetJourney: deps.resetJourney,
    restartProcess: deps.restartProcess,
    setActiveWorkbenchModule: deps.setActiveWorkbenchModule,
    setBlockingStatus: deps.setBlockingStatus,
    setResultStatus: deps.setResultStatus,
    sendMediaAction: deps.sendMediaAction,
    sendSourceAction: deps.sendSourceAction,
    setStage: deps.setStage,
    state: deps.state,
    syncDraftField: deps.syncDraftField,
    syncLocalEditField: deps.syncLocalEditField,
    text: deps.text,
    toRecord: deps.toRecord,
    toggleEventLog: deps.toggleEventLog,
    toggleWorkbenchModuleSelection: deps.toggleWorkbenchModuleSelection,
    toggleCleanup: deps.toggleCleanup
  };
  const laboratoryUiActionRouter = deps.createLaboratoryUiActionRouter(
    laboratoryUiActionRouterDeps
  );
  const laboratoryUiBootstrapRuntimeDeps = {
    actionRouter: laboratoryUiActionRouter,
    applyLocale: deps.applyLocale,
    applyPresentationMode: deps.applyPresentationMode,
    bootstrapText: deps.bootstrapText,
    documentRef: deps.documentRef,
    getActiveFeatureId: deps.getActiveFeatureId,
    handleHostMessage(message) {
      deps.handleHostMessage(message);
    },
    render: deps.render,
    setLastAction: deps.setLastAction,
    state: deps.state,
    windowRef: deps.windowRef
  };
  const laboratoryUiBootstrapRuntime = deps.createLaboratoryUiBootstrapRuntime(
    laboratoryUiBootstrapRuntimeDeps
  );
  return {
    laboratoryUiBootstrapRuntime,
    laboratoryUiShellRuntime
  };
}
