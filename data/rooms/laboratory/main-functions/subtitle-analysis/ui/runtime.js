import { createSubtitleAnalysisUi } from "./module.js";
import { createLaboratorySubtitlePanelRuntime } from "../../../ui/subtitle-panel-runtime.js";
export function createSubtitleAnalysisUiRuntime(deps) {
  const subtitleAnalysisUi = createSubtitleAnalysisUi({
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    featureText: deps.featureText,
    subtitleText: deps.subtitleText,
    subtitleTemplate: deps.subtitleTemplate,
    formatStatusLabel: deps.formatStatusLabel,
    formatDuration: deps.formatDuration,
    renderSummaryRows: deps.renderSummaryRows,
    renderTextField: deps.renderTextField,
    renderEditToggle: deps.renderEditToggle,
    renderEditSelectField: deps.renderEditSelectField,
    renderEditRangeField: deps.renderEditRangeField,
    renderStageIntro: deps.renderStageIntro,
    getCurrentDrafts: deps.getCurrentDrafts,
    getCurrentEditDraft: deps.getCurrentEditDraft,
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
  const subtitlePanelRuntime = createLaboratorySubtitlePanelRuntime({
    subtitleAnalysisUi
  });
  function renderSubtitleCatalogPanel() {
    return subtitlePanelRuntime.renderSubtitleCatalogPanel();
  }
  function renderSubtitleDiscoveryPanel() {
    return subtitlePanelRuntime.renderSubtitleDiscoveryPanel();
  }
  function renderSubtitleDraftSelect(...args) {
    return subtitlePanelRuntime.renderSubtitleDraftSelect(...args);
  }
  function renderSubtitleEditActionsPanel() {
    return subtitlePanelRuntime.renderSubtitleEditActionsPanel();
  }
  function renderSubtitleEditControlsPanel() {
    return subtitlePanelRuntime.renderSubtitleEditControlsPanel();
  }
  function renderSubtitleEditStage() {
    return subtitlePanelRuntime.renderSubtitleEditStage();
  }
  function renderSubtitleEditSummaryPanel() {
    return subtitlePanelRuntime.renderSubtitleEditSummaryPanel();
  }
  function renderSubtitleEditWorkspacePanel() {
    return subtitlePanelRuntime.renderSubtitleEditWorkspacePanel();
  }
  function renderSubtitleEntryPanel() {
    return subtitlePanelRuntime.renderSubtitleEntryPanel();
  }
  function renderSubtitleOutputsPanel() {
    return subtitlePanelRuntime.renderSubtitleOutputsPanel();
  }
  function renderSubtitlePreviewBody(...args) {
    return subtitlePanelRuntime.renderSubtitlePreviewBody(...args);
  }
  function renderSubtitlePresetChooser() {
    return subtitlePanelRuntime.renderSubtitlePresetChooser();
  }
  function renderSubtitleProviderPanel() {
    return subtitlePanelRuntime.renderSubtitleProviderPanel();
  }
  function renderSubtitleSourceIntakePanel() {
    return subtitlePanelRuntime.renderSubtitleSourceIntakePanel();
  }
  function renderSubtitleSourceWorkspacePanel() {
    return subtitlePanelRuntime.renderSubtitleSourceWorkspacePanel();
  }
  return {
    renderSubtitleCatalogPanel,
    renderSubtitleDiscoveryPanel,
    renderSubtitleDraftSelect,
    renderSubtitleEditActionsPanel,
    renderSubtitleEditControlsPanel,
    renderSubtitleEditStage,
    renderSubtitleEditSummaryPanel,
    renderSubtitleEditWorkspacePanel,
    renderSubtitleEntryPanel,
    renderSubtitleOutputsPanel,
    renderSubtitlePreviewBody,
    renderSubtitlePresetChooser,
    renderSubtitleProviderPanel,
    renderSubtitleSourceIntakePanel,
    renderSubtitleSourceWorkspacePanel,
    subtitleAnalysisUi,
    subtitlePanelRuntime
  };
}
