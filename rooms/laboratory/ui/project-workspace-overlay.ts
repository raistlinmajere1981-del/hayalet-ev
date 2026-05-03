import { escapeHtml } from "../models/lab-types.js";
import type { LabStoreState } from "../models/lab-types.js";
import { renderProjectNavigation } from "./project-navigation.js";
import { renderAssetGrid } from "./asset-grid.js";
import { renderProjectImportReview } from "./project-import-review.js";
import { renderProjectSourceImport } from "./project-source-import.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function renderHeader(copy: LabI18n): string {
  return `
    <header class="labx-pw-header">
      <div class="labx-pw-header__left">
        <button
          class="labx-pw-header__btn"
          type="button"
          data-lab-action="project-workspace-close"
        >&larr; ${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.back", "Back"))}</button>
        <span class="labx-pw-header__title">${escapeHtml(copy.t("mediaAnalysis.projectWorkspace.managementTitle", "Proje Yönetimi"))}</span>
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
  if (!state.ui.projectWorkspaceOpen || state.ui.labMode === "import-youtube") {
    return `<div id="lab-project-workspace-root" aria-hidden="true"></div>`;
  }

  return `
    <div id="lab-project-workspace-root">
      <div class="labx-pw-overlay" data-overlay="project-workspace">
        ${renderHeader(copy)}
        ${renderProjectNavigation(state, copy)}
        <main class="labx-pw-main">
          ${renderProjectSourceImport(state, copy)}
          ${renderAssetGrid(state, copy)}
        </main>
        ${renderProjectImportReview(state, copy)}
      </div>
    </div>
  `;
}
