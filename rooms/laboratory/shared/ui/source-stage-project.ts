export function createLaboratorySourceStageProjectRuntime(deps) {
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const featureText = deps.featureText;
  const getProjectSummaries = deps.getProjectSummaries;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getActiveProject = deps.getActiveProject;
  const getAvailableSourceFormats = deps.getAvailableSourceFormats;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const state = deps.state;

  function renderProjectPanel() {
    const projects = getProjectSummaries();
    const activeProjectId = getSourceSnapshot().activeProjectId;
    const activeProject = getActiveProject();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "projects", "eyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "projects", "title"]))}</h2>
          </div>
          <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="project-create">
            ${escapeHtml(text(["mediaAnalysis", "projects", "newAction"]))}
          </button>
        </div>
        <div class="lab-project-card">
          <strong>${escapeHtml(activeProject ? activeProject.name : text(["mediaAnalysis", "projects", "empty"]))}</strong>
          <span>${escapeHtml(activeProject ? activeProject.updatedAt : "--")}</span>
        </div>
        <div class="lab-field">
          <label class="lab-field__label" for="project-select">${escapeHtml(
            text(["mediaAnalysis", "projects", "selectLabel"])
          )}</label>
          <select class="lab-select" id="project-select" data-select="project">
            ${projects
              .map(function (project) {
                return `
                  <option value="${escapeHtml(project.id)}" ${
                    project.id === activeProjectId ? "selected" : ""
                  }>
                    ${escapeHtml(project.name)}
                  </option>
                `;
              })
              .join("")}
          </select>
        </div>
        <div class="lab-action-stack">
          ${
            state.ui.pendingDeleteProjectId === activeProjectId
              ? `
                <button class="lab-button lab-button--danger" type="button" data-action="project-delete-confirm">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteConfirm"]))}
                </button>
                <button class="lab-button lab-button--ghost" type="button" data-action="project-delete-cancel">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteCancel"]))}
                </button>
              `
              : `
                <button class="lab-button lab-button--ghost" type="button" data-action="project-delete-arm">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteAction"]))}
                </button>
              `
          }
        </div>
      </section>
    `;
  }

  function renderSourceKindPanel() {
    const currentKind = getCurrentSourceKind();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["source", "formatLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["source", "title"]))}</h2>
          </div>
        </div>
        <div class="lab-source-grid">
          ${getAvailableSourceFormats().map(function (sourceId) {
            return `
              <button
                class="lab-source-card"
                type="button"
                data-action="source-kind"
                data-value="${sourceId}"
                data-selected="${sourceId === currentKind ? "true" : "false"}"
              >
                <span class="lab-source-card__icon">${escapeHtml(sourceId.slice(0, 1).toUpperCase())}</span>
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
      </section>
    `;
  }

  return {
    renderProjectPanel,
    renderSourceKindPanel,
  };
}
