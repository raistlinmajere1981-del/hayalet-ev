// @ts-nocheck
export function createLaboratorySubtitlePanelRuntime(deps) {
  const { subtitleAnalysisUi } = deps;

  function renderSubtitleDraftSelect() {
    return subtitleAnalysisUi.renderSubtitleDraftSelect.apply(subtitleAnalysisUi, arguments);
  }

  function renderSubtitleProviderPanel() {
    return subtitleAnalysisUi.renderSubtitleProviderPanel();
  }

  function renderSubtitleSourceWorkspacePanel() {
    return subtitleAnalysisUi.renderSubtitleSourceWorkspacePanel();
  }

  function renderSubtitleSourceIntakePanel() {
    return subtitleAnalysisUi.renderSubtitleSourceIntakePanel();
  }

  function renderSubtitleEntryPanel() {
    return subtitleAnalysisUi.renderSubtitleEntryPanel();
  }

  function renderSubtitleDiscoveryPanel() {
    return subtitleAnalysisUi.renderSubtitleDiscoveryPanel();
  }

  function renderSubtitleCatalogPanel() {
    return subtitleAnalysisUi.renderSubtitleCatalogPanel();
  }

  function renderSubtitlePreviewBody() {
    return subtitleAnalysisUi.renderSubtitlePreviewBody.apply(subtitleAnalysisUi, arguments);
  }

  function renderSubtitlePresetChooser() {
    return subtitleAnalysisUi.renderSubtitlePresetChooser();
  }

  function renderSubtitleEditWorkspacePanel() {
    return subtitleAnalysisUi.renderSubtitleEditWorkspacePanel();
  }

  function renderSubtitleEditControlsPanel() {
    return subtitleAnalysisUi.renderSubtitleEditControlsPanel();
  }

  function renderSubtitleEditActionsPanel() {
    return subtitleAnalysisUi.renderSubtitleEditActionsPanel();
  }

  function renderSubtitleOutputsPanel() {
    return subtitleAnalysisUi.renderSubtitleOutputsPanel();
  }

  function renderSubtitleEditSummaryPanel() {
    return subtitleAnalysisUi.renderSubtitleEditSummaryPanel();
  }

  function renderSubtitleEditStage() {
    return subtitleAnalysisUi.renderSubtitleEditStage();
  }

  return {
    renderSubtitleDraftSelect: renderSubtitleDraftSelect,
    renderSubtitleProviderPanel: renderSubtitleProviderPanel,
    renderSubtitleSourceWorkspacePanel: renderSubtitleSourceWorkspacePanel,
    renderSubtitleSourceIntakePanel: renderSubtitleSourceIntakePanel,
    renderSubtitleEntryPanel: renderSubtitleEntryPanel,
    renderSubtitleDiscoveryPanel: renderSubtitleDiscoveryPanel,
    renderSubtitleCatalogPanel: renderSubtitleCatalogPanel,
    renderSubtitlePreviewBody: renderSubtitlePreviewBody,
    renderSubtitlePresetChooser: renderSubtitlePresetChooser,
    renderSubtitleEditWorkspacePanel: renderSubtitleEditWorkspacePanel,
    renderSubtitleEditControlsPanel: renderSubtitleEditControlsPanel,
    renderSubtitleEditActionsPanel: renderSubtitleEditActionsPanel,
    renderSubtitleOutputsPanel: renderSubtitleOutputsPanel,
    renderSubtitleEditSummaryPanel: renderSubtitleEditSummaryPanel,
    renderSubtitleEditStage: renderSubtitleEditStage,
  };
}
