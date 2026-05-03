import { escapeHtml } from "../models/lab-types.js";
import type { LabDrawerMode, LabStoreState } from "../models/lab-types.js";
import { getDrawerCollapsed, resolveDrawerMode } from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderLeftRail } from "./laboratory-layout.js";

function renderProjectSelector(copy: LabI18n) {
  const label = copy.t("mediaAnalysis.topBar.projectManagement", "Project Management");
  return `
    <button
      class="labx-top-bar__project-btn"
      type="button"
      data-lab-action="project-workspace-open"
      title="${escapeHtml(copy.t("mediaAnalysis.topBar.openWorkspace", "Open Project Workspace"))}"
    >
      <span class="labx-top-bar__project-name">${escapeHtml(label)}</span>
    </button>
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
      return drawerMode === "result" || drawerMode === "explore" ? "active" : "inactive";
    default:
      return "inactive";
  }
}

function renderModePills(state: LabStoreState, copy: LabI18n) {
  const drawerMode = resolveDrawerMode(state);
  const pills = [
    {
      id: "source" as const,
      label: copy.t("mediaAnalysis.topBar.source", "Source"),
      action: "topbar-pill-source",
    },
    {
      id: "analyze" as const,
      label: copy.t("mediaAnalysis.topBar.analyze", "Analyze"),
      action: "topbar-pill-analyze",
    },
    {
      id: "results" as const,
      label: copy.t("mediaAnalysis.topBar.results", "Results"),
      action: "topbar-pill-results",
    },
  ];

  return pills
    .map(function (pill) {
      const pillState = getPillState(pill.id, drawerMode);
      const pulsing = pill.id === "analyze" && drawerMode === "running";
      return `
        <button
          class="labx-topbar-pill"
          type="button"
          aria-label="${escapeHtml(pill.label)}"
          title="${escapeHtml(pill.label)}"
          data-lab-action="${escapeHtml(pill.action)}"
          data-pill-state="${pillState}"
          data-pill-pulsing="${pulsing ? "true" : "false"}"
        >
          <span class="labx-topbar-pill__dot" aria-hidden="true"></span>
          <span class="labx-topbar-pill__label">${escapeHtml(pill.label)}</span>
        </button>
      `;
    })
    .join("");
}

export function renderLabLeftRail(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  return renderLeftRail({
    ariaLabel: copy.t("mediaAnalysis.topBar.navLabel", "Mode indicators"),
    controlsMarkup: renderModePills(state, copy),
  });
}

export function renderLabTopBar(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  const drawerMode = resolveDrawerMode(state);
  const drawerCollapsed = getDrawerCollapsed(state);
  const drawerToggleLabel = drawerCollapsed
    ? copy.t("mediaAnalysis.drawer.expand", "Paneli aç")
    : copy.t("mediaAnalysis.drawer.collapse", "Paneli kapat");

  return `
    <header class="labx-top-bar" data-lab-region="topbar" data-drawer-mode="${escapeHtml(drawerMode)}">
      <div class="labx-top-bar__left">
        ${renderProjectSelector(copy)}
      </div>
      <div class="labx-top-bar__center labx-top-bar__center--empty" aria-hidden="true"></div>
      <div class="labx-top-bar__right">
        <button
          class="labx-top-bar__tool-btn"
          type="button"
          data-lab-action="toggle-tool-manager"
          title="${escapeHtml(copy.t("mediaAnalysis.topBar.toolMgmt", "Tool Management"))}"
        >
          ⚙
        </button>
        <button
          class="labx-top-bar__tool-btn labx-top-bar__drawer-toggle"
          type="button"
          data-lab-action="drawer-collapsed-toggled"
          title="${escapeHtml(drawerToggleLabel)}"
          aria-label="${escapeHtml(drawerToggleLabel)}"
          aria-pressed="${drawerCollapsed ? "true" : "false"}"
        >
          ${drawerCollapsed ? "\u00BB" : "\u00AB"}
        </button>
      </div>
    </header>
  `;
}
