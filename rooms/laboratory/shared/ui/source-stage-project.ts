import type { createLaboratoryUiBootstrapStateRuntime } from "../../ui/bootstrap-state-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryProjectSummaryRecord = LaboratoryRecord & {
  id?: unknown;
  name?: unknown;
  updatedAt?: unknown;
};

type LaboratorySourceSnapshotRecord = LaboratoryRecord & {
  activeProjectId?: unknown;
};

type LaboratorySourceStageProjectRuntimeDeps = {
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  getActiveProject: () => LaboratoryRecord | null;
  getAvailableSourceFormats: () => string[];
  getCurrentSourceKind: () => string;
  getProjectSummaries: () => LaboratoryRecord[];
  getSourceSnapshot: () => LaboratoryRecord;
  state: LaboratoryUiState;
  text: (path: string[]) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratorySourceStageProjectRuntime(
  deps: LaboratorySourceStageProjectRuntimeDeps
) {
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const featureText = deps.featureText;
  const getProjectSummaries = deps.getProjectSummaries;
  const getSourceSnapshot = deps.getSourceSnapshot;
  const getActiveProject = deps.getActiveProject;
  const getAvailableSourceFormats = deps.getAvailableSourceFormats;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const state = deps.state;
  const toRecord = deps.toRecord;

  function toProjectSummaryRecord(value: unknown): LaboratoryProjectSummaryRecord {
    return toRecord(value);
  }

  function toSourceSnapshotRecord(value: unknown): LaboratorySourceSnapshotRecord {
    return toRecord(value);
  }

  function readDisplayText(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
  }

  function renderProjectPanelBody() {
    const projects = getProjectSummaries().map(toProjectSummaryRecord);
    const activeProjectId = toSourceSnapshotRecord(getSourceSnapshot()).activeProjectId;
    const activeProject = toProjectSummaryRecord(getActiveProject());

    return `
        <div class="lab-project-panel__grid">
          <div class="lab-project-card">
            <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "projects", "title"]))}</span>
            <strong>${escapeHtml(
              readDisplayText(activeProject.name, text(["mediaAnalysis", "projects", "empty"]))
            )}</strong>
            <span>${escapeHtml(readDisplayText(activeProject.updatedAt, "--"))}</span>
          </div>
          <div class="lab-field">
            <label class="lab-field__label" for="project-select">${escapeHtml(
              text(["mediaAnalysis", "projects", "selectLabel"])
            )}</label>
            <select class="lab-select" id="project-select" data-select="project">
              ${
                projects.length > 0
                  ? projects
                      .map(function (project) {
                        const projectId = readDisplayText(project.id, "");
                        return `
                          <option value="${escapeHtml(projectId)}" ${
                            projectId === activeProjectId ? "selected" : ""
                          }>
                            ${escapeHtml(readDisplayText(project.name, projectId))}
                          </option>
                        `;
                      })
                      .join("")
                  : `<option value="">${escapeHtml(text(["mediaAnalysis", "projects", "empty"]))}</option>`
              }
            </select>
          </div>
        </div>
        <div class="lab-action-stack lab-action-stack--inline">
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
    `;
  }

  function renderProjectPanel() {
    return `
      <section class="lab-panel lab-panel--compact lab-project-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "projects", "eyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "projects", "title"]))}</h2>
          </div>
          <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="project-create">
            ${escapeHtml(text(["mediaAnalysis", "projects", "newAction"]))}
          </button>
        </div>
        ${renderProjectPanelBody()}
      </section>
    `;
  }

  function renderSourceKindPanelBody() {
    const currentKind = getCurrentSourceKind();
    const sourceFormats = getAvailableSourceFormats().filter(function (sourceId) {
      return typeof sourceId === "string" && sourceId.trim() !== "";
    });
    return `
        <div class="lab-source-grid">
          ${sourceFormats
            .map(function (sourceId) {
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
            })
            .join("")}
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
    renderSourceKindPanelBody,
  };
}
