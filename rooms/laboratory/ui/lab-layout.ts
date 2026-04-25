import type { LabStageSurface, LabStoreState } from "../models/lab-types.js";
import { renderLabCenterPanel } from "./lab-center-panel.js";
import { renderLabLeftRail } from "./lab-left-rail.js";
import { renderLabRightPanel } from "./lab-right-panel.js";
import { renderToolManagementOverlay } from "./tool-management-overlay.js";
import { renderReportOverlay } from "./report-overlay.js";
import { renderLabAssetPreviewOverlay } from "./lab-asset-preview-overlay.js";
import { getWorkspaceMode } from "../runtime/lab-selectors.js";

export function renderLabLayout(state: LabStoreState, surface: LabStageSurface) {
  return `
    <div class="labx-shell" data-stage="${state.currentStage}" data-ready="${state.bootReady ? "true" : "false"}" data-workspace-mode="${getWorkspaceMode(state)}">
      ${renderLabLeftRail(state)}
      ${renderLabCenterPanel(surface)}
      ${renderLabRightPanel(surface)}
    </div>
    ${renderToolManagementOverlay(state)}
    ${renderLabAssetPreviewOverlay(state)}
    ${renderReportOverlay(state)}
  `;
}
