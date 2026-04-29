import type { LabWorkspaceSurface } from "../models/lab-types.js";

export function renderLabCenterPanel(surface: LabWorkspaceSurface) {
  return `<main class="labx-center-panel">${surface.main}</main>`;
}
