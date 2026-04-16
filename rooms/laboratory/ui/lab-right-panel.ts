import type { LabStageSurface } from "../models/lab-types.js";

export function renderLabRightPanel(surface: LabStageSurface) {
  return `<aside class="labx-right-panel">${surface.side}</aside>`;
}
