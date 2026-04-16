import type { LabStageSurface } from "../models/lab-types.js";

export function renderLabCenterPanel(surface: LabStageSurface) {
  return `<main class="labx-center-panel">${surface.main}</main>`;
}
