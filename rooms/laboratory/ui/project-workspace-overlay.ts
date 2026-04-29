import { escapeHtml, asNonEmptyString } from "../models/lab-types.js";
import type { LabStoreState } from "../models/lab-types.js";
import { renderProjectNavigation } from "./project-navigation.js";
import { renderAssetGrid } from "./asset-grid.js";
import { renderAssetInspector } from "./asset-inspector.js";
import { renderContextActionBar } from "./context-action-bar.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function renderHeader(state: LabStoreState, copy: LabI18n): string {
  const activeProject = state.projectIndex.projects.find(function (project) {
    return String(project["id"] || "") === state.projectIndex.activeProjectId;
  });
  const projectName =
    activeProject !== undefined
      ? asNonEmptyString(activeProject["name"]) ||
        copy.t("mediaAnalysis.projectWorkspace.untitledProject", "Untitled")
      : copy.t("mediaAnalysis.projectWorkspace.noProject", "No project");

  return `
    <header class="labx-pw-header">
      <div class="labx-pw-header__left">
        <button
          class="labx-pw-header__btn"
          type="button"
          data-lab-action="project-workspace-close"
        >&larr; ${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.back", "Back"))}</button>
        <span class="labx-pw-header__title">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.title", "Project Workspace"))}</span>
        <span style="font-size:0.76rem;color:var(--labx-text-dim);margin-left:0.3rem">\u2014 ${escapeHtml(projectName)}</span>
      </div>
      <div class="labx-pw-header__right">
        <button
          class="labx-pw-header__btn labx-pw-header__btn--close"
          type="button"
          data-lab-action="project-workspace-close"
          aria-label="${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.close", "Close"))}"
        >&times;</button>
      </div>
    </header>
  `;
}

export function renderProjectWorkspaceOverlay(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
): string {
  if (!state.ui.projectWorkspaceOpen) {
    return `<div id="lab-project-workspace-root" aria-hidden="true"></div>`;
  }

  return `
    <div id="lab-project-workspace-root">
      <div class="labx-pw-overlay" data-overlay="project-workspace">
        ${renderHeader(state, copy)}
        ${renderProjectNavigation(state, copy)}
        ${renderAssetGrid(state, copy)}
        ${renderAssetInspector(state, copy)}
        ${renderContextActionBar(state, copy)}
      </div>
    </div>
  `;
}
