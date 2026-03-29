export function createMediaAnalysisEditOutputPanels(deps) {
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const getProjectSource = deps.getProjectSource;
  const getToolEntry = deps.getToolEntry;
  const getProjectEdit = deps.getProjectEdit;
  const getRelevantJobs = deps.getRelevantJobs;
  const getActiveEditOutput = deps.getActiveEditOutput;
  const getEditOutputs = deps.getEditOutputs;
  const renderSummaryRows = deps.renderSummaryRows;
  const formatEditWindowLabel = deps.formatEditWindowLabel;
  const getCurrentFocusLabel = deps.getCurrentFocusLabel;
  const getCurrentResizeLabel = deps.getCurrentResizeLabel;

  function renderEditActionsPanel() {
    const source = getProjectSource();
    const edit = getProjectEdit();
    const activeOutput = getActiveEditOutput();
    const ffmpegInstalled = getToolEntry("ffmpeg").installed === true;
    const previewJob =
      getRelevantJobs().project.find(function (entry) {
        return entry.action === "edit-preview";
      }) || null;
    const applyJob =
      getRelevantJobs().project.find(function (entry) {
        return entry.action === "edit-apply";
      }) || null;

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "actionsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "actionsSubtitle"]))}</h2>
          </div>
        </div>
        ${
          ffmpegInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "edit", "ffmpegMissing"]))}</div>`
            : ""
        }
        ${
          typeof edit.lastError === "string" && edit.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(edit.lastError)}</div>`
            : ""
        }
        <div class="lab-action-stack">
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-preview"
            ${ffmpegInstalled !== true || typeof source.storedPath !== "string" || previewJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "preview"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-cancel-preview"
            ${previewJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "cancelPreview"]))}
          </button>
          <button
            class="lab-button lab-button--primary"
            type="button"
            data-action="edit-apply"
            ${ffmpegInstalled !== true || typeof source.storedPath !== "string" || applyJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "apply"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-cancel-apply"
            ${applyJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "cancelApply"]))}
          </button>
        </div>
        <div class="lab-segmented">
          ${["source", "derived"]
            .map(function (modeId) {
              const disabled = modeId === "derived" && activeOutput === null;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="edit-handoff"
                  data-value="${modeId}"
                  data-selected="${edit.handoffMode === modeId ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "edit", "handoffModes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEditOutputsPanel() {
    const outputs = getEditOutputs();
    const activeOutput = getActiveEditOutput();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "outputsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "outputsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            outputs.length > 0
              ? outputs
                  .map(function (entry) {
                    return `
                      <article class="lab-output-card" data-selected="${activeOutput && activeOutput.id === entry.id ? "true" : "false"}">
                        <div>
                          <strong>${escapeHtml(entry.label || entry.fileName || entry.id)}</strong>
                          <span>${escapeHtml(entry.fileName || "--")}</span>
                        </div>
                        <button
                          class="lab-button lab-button--ghost lab-button--tight"
                          type="button"
                          data-action="edit-select-output"
                          data-value="${escapeHtml(entry.id)}"
                        >
                          ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "selectOutput"]))}
                        </button>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "edit", "outputsEmpty"]))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderEditSummaryPanel() {
    const edit = getProjectEdit();
    const activeOutput = getActiveEditOutput();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "summaryTitle"]))}</p>
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "edit", "selectedWindow"]), formatEditWindowLabel()],
          [text(["mediaAnalysis", "edit", "selectedRegion"]), getCurrentFocusLabel()],
          [text(["mediaAnalysis", "edit", "selectedResize"]), getCurrentResizeLabel()],
          [
            text(["mediaAnalysis", "edit", "selectedOutput"]),
            activeOutput ? activeOutput.label || activeOutput.fileName || activeOutput.id : "--",
          ],
          [text(["mediaAnalysis", "edit", "handoffLabel"]), text(["mediaAnalysis", "edit", "handoffModes", edit.handoffMode === "derived" ? "derived" : "source"])],
        ])}
      </section>
    `;
  }

  return {
    renderEditActionsPanel,
    renderEditOutputsPanel,
    renderEditSummaryPanel,
  };
}
