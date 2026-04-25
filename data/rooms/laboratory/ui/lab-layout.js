import { renderLabCenterPanel } from "./lab-center-panel.js";
import { renderLabLeftRail } from "./lab-left-rail.js";
import { renderLabRightPanel } from "./lab-right-panel.js";
import { renderToolManagementOverlay } from "./tool-management-overlay.js";
import { renderReportOverlay } from "./report-overlay.js";
import { renderLabAssetPreviewOverlay } from "./lab-asset-preview-overlay.js";
import { getWorkspaceMode } from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
export function renderLabLayout(state, surface, copy = LAB_FALLBACK_I18N) {
  return `
    <div class="labx-shell" data-stage="${state.currentStage}" data-ready="${state.bootReady ? "true" : "false"}" data-workspace-mode="${getWorkspaceMode(state)}">
      ${renderLabLeftRail(state)}
      ${renderLabCenterPanel(surface)}
      ${renderLabRightPanel(state, surface, copy)}
    </div>
    ${renderToolManagementOverlay(state)}
    ${renderLabAssetPreviewOverlay(state)}
    ${renderReportOverlay(state)}
  `;
}
