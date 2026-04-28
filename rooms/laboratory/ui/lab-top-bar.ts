import { escapeHtml } from "../models/lab-types.js";
import type { LabDrawerMode, LabStoreState } from "../models/lab-types.js";
import { resolveDrawerMode } from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function renderProjectSelector(state: LabStoreState, copy: LabI18n) {
  const projects = state.projectIndex.projects;
  const activeId = state.projectIndex.activeProjectId;
  const selectableProjects = projects.filter(function (project) {
    return (project as Record<string, unknown>)["hasSource"] !== false;
  });
  const hasActiveProject = activeId !== null && selectableProjects.some(function (project) {
    return String((project as Record<string, unknown>)["id"] || "") === activeId;
  });
  const projectOptions = selectableProjects
    .map(function (project) {
      const record = project as Record<string, unknown>;
      const id = String(record["id"] || "");
      const name = String(record["name"] || id || copy.t("mediaAnalysis.topBar.project", "Proje"));
      return `<option value="${escapeHtml(id)}" ${id === activeId ? "selected" : ""}>${escapeHtml(name)}</option>`;
    })
    .join("");

  return `
    <label class="labx-top-bar__project">
      <span class="labx-top-bar__project-label">${escapeHtml(copy.t("mediaAnalysis.topBar.project", "Proje"))}</span>
      <select class="labx-top-bar__project-select" data-lab-field="project.id">
        <option value="new" ${hasActiveProject ? "" : "selected"}>${escapeHtml(copy.t("mediaAnalysis.topBar.newProject", "Yeni Proje"))}</option>
        ${projectOptions}
      </select>
    </label>
  `;
}

function getPillState(
  pill: "source" | "analyze" | "results",
  drawerMode: LabDrawerMode
): "active" | "inactive" {
  switch (pill) {
    case "source":
      return drawerMode === "setup" ? "active" : "inactive";
    case "analyze":
      return drawerMode === "running" ? "active" : "inactive";
    case "results":
      return drawerMode === "result" || drawerMode === "explore"
        ? "active"
        : "inactive";
    default:
      return "inactive";
  }
}

export function renderLabTopBar(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const drawerMode = resolveDrawerMode(state);

  const pills = [
    { id: "source" as const, label: copy.t("mediaAnalysis.topBar.source", "Kaynak"), action: "topbar-pill-source" },
    { id: "analyze" as const, label: copy.t("mediaAnalysis.topBar.analyze", "Analiz"), action: "topbar-pill-analyze" },
    { id: "results" as const, label: copy.t("mediaAnalysis.topBar.results", "Sonuçlar"), action: "topbar-pill-results" },
  ];

  const pillsMarkup = pills
    .map(function (pill) {
      const pillState = getPillState(pill.id, drawerMode);
      const pulsing = pill.id === "analyze" && drawerMode === "running";
      return `
        <button
          class="labx-topbar-pill"
          type="button"
          data-lab-action="${escapeHtml(pill.action)}"
          data-pill-state="${pillState}"
          data-pill-pulsing="${pulsing ? "true" : "false"}"
        >
          <span class="labx-topbar-pill__dot" aria-hidden="true"></span>
          <span>${escapeHtml(pill.label)}</span>
        </button>
      `;
    })
    .join("");

  return `
    <header class="labx-top-bar" data-drawer-mode="${escapeHtml(drawerMode)}">
      <div class="labx-top-bar__left">
        ${renderProjectSelector(state, copy)}
      </div>
      <nav class="labx-top-bar__center" aria-label="${escapeHtml(copy.t("mediaAnalysis.topBar.navLabel", "Mode indicators"))}">
        ${pillsMarkup}
      </nav>
      <div class="labx-top-bar__right">
        <button
          class="labx-top-bar__tool-btn"
          type="button"
          data-lab-action="toggle-tool-manager"
          title="${escapeHtml(copy.t("mediaAnalysis.topBar.toolMgmt", "Araç Yönetimi"))}"
        >
          ⚙
        </button>
      </div>
    </header>
  `;
}
