type MediaAnalysisEditStageDeps = {
  escapeHtml: (value: string) => string;
  getProjectSource: () => {
    storedPath?: string | null;
  };
  renderEditActionsPanel: () => string;
  renderEditCommonPanel: () => string;
  renderEditControlsPanel: () => string;
  renderEditModePanel: () => string;
  renderEditOutputsPanel: () => string;
  renderEditPresetChooser: () => string;
  renderEditProgressPanel: () => string;
  renderEditSummaryPanel: () => string;
  renderEditWorkspacePanel: () => string;
  renderStageIntro: (stageId: string) => string;
  text: (path: string[]) => string;
};

export function renderMediaAnalysisEditStage(deps: MediaAnalysisEditStageDeps): string {
  const escapeHtml = deps.escapeHtml;
  const getProjectSource = deps.getProjectSource;
  const renderEditActionsPanel = deps.renderEditActionsPanel;
  const renderEditCommonPanel = deps.renderEditCommonPanel;
  const renderEditControlsPanel = deps.renderEditControlsPanel;
  const renderEditModePanel = deps.renderEditModePanel;
  const renderEditOutputsPanel = deps.renderEditOutputsPanel;
  const renderEditPresetChooser = deps.renderEditPresetChooser;
  const renderEditProgressPanel = deps.renderEditProgressPanel;
  const renderEditSummaryPanel = deps.renderEditSummaryPanel;
  const renderEditWorkspacePanel = deps.renderEditWorkspacePanel;
  const renderStageIntro = deps.renderStageIntro;
  const text = deps.text;

  const projectSource = getProjectSource();
  const sourceReady =
    typeof projectSource.storedPath === "string" && projectSource.storedPath.trim() !== "";

  return `
    <div class="lab-layout">
      <section class="lab-main-stack">
        ${renderStageIntro("edit")}
        ${renderEditWorkspacePanel()}
        ${renderEditModePanel()}
        ${renderEditPresetChooser()}
        <div class="lab-subgrid lab-subgrid--edit">
          ${renderEditCommonPanel()}
          ${renderEditControlsPanel()}
          ${renderEditActionsPanel()}
        </div>
        ${
          sourceReady !== true
            ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "edit", "sourceRequired"]))}</div>`
            : ""
        }
      </section>
      <aside class="lab-side-stack">
        ${renderEditProgressPanel()}
        ${renderEditSummaryPanel()}
        ${renderEditOutputsPanel()}
      </aside>
    </div>
  `;
}
