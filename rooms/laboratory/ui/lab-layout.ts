import type { LabStageSurface, LabStoreState } from "../models/lab-types.js";
import { renderLabCenterPanel } from "./lab-center-panel.js";
import { renderLabLeftRail } from "./lab-left-rail.js";
import { renderLabRightPanel } from "./lab-right-panel.js";

export function renderLabLayout(state: LabStoreState, surface: LabStageSurface) {
  return `
    <div class="labx-shell" data-stage="${state.currentStage}" data-ready="${state.bootReady ? "true" : "false"}">
      ${renderLabLeftRail(state)}
      ${renderLabCenterPanel(surface)}
      ${renderLabRightPanel(surface)}
    </div>
  `;
}
