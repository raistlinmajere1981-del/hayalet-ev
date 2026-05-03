import { asLabRecord, asNonEmptyString, escapeHtml } from "../models/lab-types.js";
import type { LabDrawerMode, LabStoreState } from "../models/lab-types.js";
import { getDrawerCollapsed, resolveDrawerMode } from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { renderLeftRail } from "./laboratory-layout.js";

const ICON_SETTINGS = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const ICON_PANEL_LEFT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`;
const ICON_PANEL_RIGHT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`;

function renderBrand(copy: LabI18n) {
  const brand = copy.t("mediaAnalysis.topBar.brand", "Laboratory");
  return `
    <div class="labx-top-bar__brand">
      <span class="labx-top-bar__brand-name">${escapeHtml(brand)}</span>
    </div>
  `;
}

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

function renderSourceMetaStrip(state: LabStoreState) {
  const source = asLabRecord(state.source);
  const storedFileName = asNonEmptyString(source["storedFileName"]);
  const metadata = asLabRecord(source["metadata"]);
  const width = metadata["width"];
  const height = metadata["height"];
  const duration = metadata["duration"];

  if (storedFileName === null && width === undefined && duration === undefined) {
    return `<div class="labx-top-bar__center labx-top-bar__center--empty" aria-hidden="true"></div>`;
  }

  const parts: string[] = [];
  if (storedFileName !== null) {
    parts.push(`<span class="labx-top-bar__meta-file">${escapeHtml(storedFileName)}</span>`);
  }
  if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) {
    parts.push(`<span class="labx-top-bar__meta-res">${String(width)}\u00D7${String(height)}</span>`);
  }
  if (typeof duration === "number" && duration > 0) {
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    parts.push(`<span class="labx-top-bar__meta-dur">${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}</span>`);
  }

  if (parts.length === 0) {
    return `<div class="labx-top-bar__center labx-top-bar__center--empty" aria-hidden="true"></div>`;
  }

  return `<div class="labx-top-bar__center labx-top-bar__meta-strip">${parts.join('<span class="labx-top-bar__meta-sep" aria-hidden="true">\u00B7</span>')}</div>`;
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
    ? copy.t("mediaAnalysis.topBar.drawerExpand", "Open panel")
    : copy.t("mediaAnalysis.topBar.drawerCollapse", "Close panel");

  return `
    <header class="labx-top-bar" data-lab-region="topbar" data-drawer-mode="${escapeHtml(drawerMode)}">
      <div class="labx-top-bar__left">
        ${renderBrand(copy)}
        ${renderProjectSelector(copy)}
      </div>
      ${renderSourceMetaStrip(state)}
      <div class="labx-top-bar__right">
        <button
          class="labx-top-bar__tool-btn"
          type="button"
          data-lab-action="toggle-tool-manager"
          title="${escapeHtml(copy.t("mediaAnalysis.topBar.toolMgmt", "Tool Management"))}"
          aria-label="${escapeHtml(copy.t("mediaAnalysis.topBar.toolMgmt", "Tool Management"))}"
        >
          ${ICON_SETTINGS}
        </button>
        <button
          class="labx-top-bar__tool-btn labx-top-bar__drawer-toggle"
          type="button"
          data-lab-action="drawer-collapsed-toggled"
          title="${escapeHtml(drawerToggleLabel)}"
          aria-label="${escapeHtml(drawerToggleLabel)}"
          aria-pressed="${drawerCollapsed ? "true" : "false"}"
        >
          ${drawerCollapsed ? ICON_PANEL_LEFT : ICON_PANEL_RIGHT}
        </button>
      </div>
    </header>
  `;
}
