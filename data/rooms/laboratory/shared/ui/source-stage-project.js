export function createLaboratorySourceStageProjectRuntime(deps) {
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const featureText = deps.featureText;
  const getProjectSummaries = deps.getProjectSummaries;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getAvailableSourceFormats = deps.getAvailableSourceFormats;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const state = deps.state;
  const toRecord = deps.toRecord;
  function toProjectSummaryRecord(value) {
    return toRecord(value);
  }
  function toSourceSnapshotRecord(value) {
    return toRecord(value);
  }
  function readDisplayText(value, fallback) {
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
  }
  function renderProjectPanelBody() {
    const projects = getProjectSummaries().map(toProjectSummaryRecord);
    const activeProjectId = readDisplayText(
      toSourceSnapshotRecord(getSourceSnapshot()).activeProjectId,
      ""
    );
    const pendingDelete = state.ui.pendingDeleteProjectId === activeProjectId && activeProjectId !== "";
    return `
        <div class="lab-project-panel__grid">
          <label class="lab-field lab-project-panel__field" for="project-select">
            <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "projects", "selectLabel"]))}</span>
            <select class="lab-select" id="project-select" data-select="project">
              ${projects.length > 0 ? projects.map(function(project) {
      const projectId = readDisplayText(project.id, "");
      return `
                          <option value="${escapeHtml(projectId)}" ${projectId === activeProjectId ? "selected" : ""}>
                            ${escapeHtml(readDisplayText(project.name, projectId))}
                          </option>
                        `;
    }).join("") : `<option value="">${escapeHtml(text(["mediaAnalysis", "projects", "empty"]))}</option>`}
            </select>
          </label>
          <div class="lab-project-panel__actions">
            ${pendingDelete ? `
                  <button class="lab-button lab-button--danger" type="button" data-action="project-delete-confirm">
                    ${escapeHtml(text(["mediaAnalysis", "projects", "deleteConfirm"]))}
                  </button>
                  <button class="lab-button lab-button--ghost" type="button" data-action="project-delete-cancel">
                    ${escapeHtml(text(["mediaAnalysis", "projects", "deleteCancel"]))}
                  </button>
                ` : `
                  <button
                    class="lab-button lab-button--ghost"
                    type="button"
                    data-action="project-delete-arm"
                    ${activeProjectId === "" ? "disabled" : ""}
                  >
                    ${escapeHtml(text(["mediaAnalysis", "projects", "deleteAction"]))}
                  </button>
                `}
            <button class="lab-button lab-button--ghost" type="button" data-action="project-create">
              ${escapeHtml(text(["mediaAnalysis", "projects", "newAction"]))}
            </button>
          </div>
        </div>
    `;
  }
  function renderProjectPanel() {
    return `
      <section class="lab-panel lab-panel--compact lab-project-panel">
        ${renderProjectPanelBody()}
      </section>
    `;
  }
  function renderSourceKindPanelBody() {
    const currentKind = getCurrentSourceKind();
    const sourceFormats = getAvailableSourceFormats().filter(function(sourceId) {
      return typeof sourceId === "string" && sourceId.trim() !== "";
    });
    return `
        <div class="lab-source-grid">
          ${sourceFormats.map(function(sourceId) {
      return `
              <button
                class="lab-source-card"
                type="button"
                data-action="source-kind"
                data-value="${sourceId}"
                data-selected="${sourceId === currentKind ? "true" : "false"}"
              >
                <span class="lab-source-card__title">${escapeHtml(
        featureText(["source", "formats", sourceId, "title"])
      )}</span>
                <span class="lab-source-card__subtitle">${escapeHtml(
        featureText(["source", "formats", sourceId, "subtitle"])
      )}</span>
              </button>
            `;
    }).join("")}
        </div>
    `;
  }
  function renderSourceKindPanel() {
    return `
      <section class="lab-panel lab-panel--compact">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["source", "formatLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["source", "title"]))}</h2>
          </div>
        </div>
        ${renderSourceKindPanelBody()}
      </section>
    `;
  }
  return {
    renderProjectPanel,
    renderProjectPanelBody,
    renderSourceKindPanel,
    renderSourceKindPanelBody
  };
}
