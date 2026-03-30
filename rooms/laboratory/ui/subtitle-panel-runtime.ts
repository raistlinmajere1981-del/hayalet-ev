import type { createSubtitleAnalysisUi } from "../main-functions/subtitle-analysis/ui/module.js";

type LaboratorySubtitleAnalysisUiMethodName =
  | "renderSubtitleCatalogPanel"
  | "renderSubtitleDiscoveryPanel"
  | "renderSubtitleDraftSelect"
  | "renderSubtitleEditActionsPanel"
  | "renderSubtitleEditControlsPanel"
  | "renderSubtitleEditStage"
  | "renderSubtitleEditSummaryPanel"
  | "renderSubtitleEditWorkspacePanel"
  | "renderSubtitleEntryPanel"
  | "renderSubtitleOutputsPanel"
  | "renderSubtitlePreviewBody"
  | "renderSubtitlePresetChooser"
  | "renderSubtitleProviderPanel"
  | "renderSubtitleSourceIntakePanel"
  | "renderSubtitleSourceWorkspacePanel";

type LaboratorySubtitleAnalysisUiRuntime = Pick<
  ReturnType<typeof createSubtitleAnalysisUi>,
  LaboratorySubtitleAnalysisUiMethodName
>;
type RenderSubtitleDraftSelect = LaboratorySubtitleAnalysisUiRuntime["renderSubtitleDraftSelect"];
type RenderSubtitlePreviewBody = LaboratorySubtitleAnalysisUiRuntime["renderSubtitlePreviewBody"];

type LaboratorySubtitlePanelRuntimeDeps = {
  subtitleAnalysisUi: LaboratorySubtitleAnalysisUiRuntime;
};

export function createLaboratorySubtitlePanelRuntime(
  deps: LaboratorySubtitlePanelRuntimeDeps
) {
  const { subtitleAnalysisUi } = deps;

  function renderSubtitleDraftSelect(...args: Parameters<RenderSubtitleDraftSelect>) {
    return subtitleAnalysisUi.renderSubtitleDraftSelect(...args);
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

  function renderSubtitlePreviewBody(...args: Parameters<RenderSubtitlePreviewBody>) {
    return subtitleAnalysisUi.renderSubtitlePreviewBody(...args);
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
