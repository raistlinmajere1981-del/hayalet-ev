export function renderMediaAnalysisEditStage(deps) {
  const escapeHtml = deps.escapeHtml;
  const getCurrentEditMode = deps.getCurrentEditMode;
  const getProjectSource = deps.getProjectSource;
  const renderEditAdvancedPanel = deps.renderEditAdvancedPanel;
  const renderEditActionsPanel = deps.renderEditActionsPanel;
  const renderEditOutputsPanel = deps.renderEditOutputsPanel;
  const renderEditPresetChooser = deps.renderEditPresetChooser;
  const renderEditProgressPanel = deps.renderEditProgressPanel;
  const renderEditSummaryPanel = deps.renderEditSummaryPanel;
  const renderEditWorkspacePanel = deps.renderEditWorkspacePanel;
  const renderStageIntro = deps.renderStageIntro;
  const text = deps.text;
  const projectSource = getProjectSource();
  const editMode = getCurrentEditMode() === "advanced" ? "advanced" : "beginner";
  const sourceReady = typeof projectSource.storedPath === "string" && projectSource.storedPath.trim() !== "";
  return `
    <div class="lab-layout lab-layout--workbench">
      <section class="lab-main-stack">
        ${renderStageIntro("edit")}
        ${sourceReady !== true ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "edit", "sourceRequired"]))}</div>` : ""}
        <section class="lab-panel lab-panel--compact lab-edit-mode-surface">
          <div class="lab-panel__header">
            <div>
              <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "modeTitle"]))}</p>
            </div>
          </div>
          <div class="lab-segmented lab-segmented--dual">
            ${["beginner", "advanced"].map(function(modeId) {
    return `
                  <button
                    class="lab-segmented__button"
                    type="button"
                    data-action="edit-mode"
                    data-value="${modeId}"
                    data-selected="${modeId === editMode ? "true" : "false"}"
                  >
                    ${escapeHtml(text(["mediaAnalysis", "edit", "modes", modeId]))}
                  </button>
                `;
  }).join("")}
          </div>
          <div class="lab-edit-mode-surface__body" data-mode="${editMode}">
            ${editMode === "advanced" ? renderEditAdvancedPanel() : renderEditPresetChooser()}
          </div>
        </section>
        ${renderEditActionsPanel()}
        ${renderEditOutputsPanel()}
      </section>
      <aside class="lab-side-stack lab-side-stack--edit">
        ${renderEditWorkspacePanel()}
        ${renderEditSummaryPanel()}
        ${renderEditProgressPanel()}
      </aside>
    </div>
  `;
}
