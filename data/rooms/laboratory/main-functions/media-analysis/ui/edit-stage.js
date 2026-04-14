export function renderMediaAnalysisEditStage(deps) {
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
  const sourceReady = typeof projectSource.storedPath === "string" && projectSource.storedPath.trim() !== "";
  return `
    <div class="lab-layout lab-layout--workbench">
      <section class="lab-main-stack">
        ${renderStageIntro("edit")}
        ${sourceReady !== true ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "edit", "sourceRequired"]))}</div>` : ""}
        ${renderEditWorkspacePanel()}
        <div class="lab-edit-console">
          ${renderEditModePanel()}
          ${renderEditPresetChooser()}
        </div>
        ${renderEditActionsPanel()}
        ${renderEditProgressPanel()}
        ${renderEditOutputsPanel()}
        <details class="lab-panel lab-panel--compact">
          <summary class="lab-field__label">${escapeHtml(
    text(["mediaAnalysis", "edit", "modes", "advanced"])
  )}</summary>
          <div class="lab-subgrid lab-subgrid--edit lab-edit-console">
            ${renderEditCommonPanel()}
            ${renderEditControlsPanel()}
          </div>
        </details>
      </section>
      <aside class="lab-side-stack">
        ${renderEditSummaryPanel()}
      </aside>
    </div>
  `;
}
