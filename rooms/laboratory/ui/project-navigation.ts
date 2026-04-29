import { asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import type { LabRecord, LabStoreState } from "../models/lab-types.js";
import { renderSourceIntake } from "./workspace-surface.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function getProjectLabel(project: LabRecord, copy: LabI18n): string {
  return (
    asNonEmptyString(project["name"]) ||
    asNonEmptyString(project["id"]) ||
    copy.t("mediaAnalysis.projectWorkspace.untitledProject", "Untitled")
  );
}

export function renderProjectNavigation(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  const activeId = state.projectIndex.activeProjectId;
  const projects = state.projectIndex.projects.filter(function (project) {
    return project["hasSource"] !== false || String(project["id"] || "") === activeId;
  });
  const disableDelete = activeId === null;

  const projectItems = projects
    .map(function (project) {
      const id = String(project["id"] || "");
      const isActive = id === activeId;
      return `
        <button
          class="labx-pw-nav__item"
          type="button"
          data-lab-action="project-workspace-switch"
          data-lab-value="${escapeHtml(id)}"
          data-active="${isActive ? "true" : "false"}"
        >
          <span class="labx-pw-nav__item-dot" aria-hidden="true"></span>
          <span>${escapeHtml(getProjectLabel(project, copy))}</span>
        </button>
      `;
    })
    .join("");

  const sourceIntakeMarkup = renderSourceIntake(state, copy);

  return `
    <nav class="labx-pw-nav" aria-label="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.nav", "Projects"))}">
      <div class="labx-pw-nav__intake">
        ${sourceIntakeMarkup}
      </div>
      <div class="labx-pw-nav__title">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.projects", "Projects"))}</div>
      <div class="labx-pw-nav__list">
        ${projectItems || `<div style="padding:0.5rem 0.9rem;color:var(--labx-text-dim);font-size:0.78rem">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.noProjects", "No projects yet"))}</div>`}
      </div>
      <div class="labx-pw-nav__actions">
        <button
          class="labx-pw-nav__action-btn"
          type="button"
          data-lab-action="save-project"
        >
          ${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.newProject", "New"))}
        </button>
        <button
          class="labx-pw-nav__action-btn labx-pw-nav__action-btn--danger"
          type="button"
          data-lab-action="project-delete"
          ${disableDelete ? "disabled" : ""}
        >
          ${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.deleteProject", "Delete"))}
        </button>
      </div>
    </nav>
  `;
}
