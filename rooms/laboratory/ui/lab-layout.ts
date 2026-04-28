import type { LabStageSurface, LabStoreState } from "../models/lab-types.js";
import { renderLabCenterPanel } from "./lab-center-panel.js";
import { renderLabDrawer } from "./lab-drawer.js";
import { renderLabProcessStrip } from "./lab-process-strip.js";
import { renderLabTopBar } from "./lab-top-bar.js";
import { renderToolManagementOverlay } from "./tool-management-overlay.js";
import { renderReportOverlay } from "./report-overlay.js";
import { renderLabAssetPreviewOverlay } from "./lab-asset-preview-overlay.js";
import { getDrawerCollapsed, getWorkspaceMode, resolveDrawerMode } from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

export function renderLabLayout(
  state: LabStoreState,
  surface: LabStageSurface,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const drawerCollapsed = getDrawerCollapsed(state);
  const drawerMode = resolveDrawerMode(state);
  return `
    <div class="labx-shell" data-stage="${state.currentStage}" data-ready="${state.bootReady ? "true" : "false"}" data-workspace-mode="${getWorkspaceMode(state)}" data-drawer-mode="${drawerMode}" data-drawer-collapsed="${drawerCollapsed ? "true" : "false"}">
      ${renderLabTopBar(state, copy)}
      ${renderLabCenterPanel(surface)}
      ${renderLabDrawer(state, surface, copy)}
      ${renderLabProcessStrip(state, copy)}
    </div>
    ${renderToolManagementOverlay(state, copy)}
    ${renderLabAssetPreviewOverlay(state, copy)}
    ${renderReportOverlay(state, copy)}
  `;
}
