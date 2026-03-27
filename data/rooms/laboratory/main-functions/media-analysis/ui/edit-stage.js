export function renderMediaAnalysisEditStage(deps) {
  const escapeHtml = deps.escapeHtml;
  const getProjectSource = deps.getProjectSource;
  const renderEditActionsPanel = deps.renderEditActionsPanel;
  const renderEditCommonPanel = deps.renderEditCommonPanel;
  const renderEditControlsPanel = deps.renderEditControlsPanel;
  const renderEditModePanel = deps.renderEditModePanel;
  const renderEditOutputsPanel = deps.renderEditOutputsPanel;
  const renderEditPresetChooser = deps.renderEditPresetChooser;
  const renderEditSummaryPanel = deps.renderEditSummaryPanel;
  const renderEditWorkspacePanel = deps.renderEditWorkspacePanel;
  const renderStageIntro = deps.renderStageIntro;
  const text = deps.text;

  const sourceReady =
    typeof getProjectSource().storedPath === "string" &&
    getProjectSource().storedPath.trim() !== "";

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
        ${renderEditSummaryPanel()}
        ${renderEditOutputsPanel()}
      </aside>
    </div>
  `;
}
