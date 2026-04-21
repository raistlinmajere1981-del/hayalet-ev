import type { LabStageSurface } from "../models/lab-types.js";

export function renderLabRightPanel(surface: LabStageSurface) {
  const content =
    surface.side.trim() !== ""
      ? surface.side
      : `
      <div class="labx-empty-state labx-workspace-empty" style="height: 100%; display: flex; align-items: center; justify-content: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: var(--labx-radius);">
        <div style="text-align: center;">
          <strong class="labx-empty-state__title" style="color: var(--labx-text-dim);">Workspace Panel</strong>
          <p class="labx-empty-state__description" style="font-size: 0.72rem;">Load a source to see controls and analysis options.</p>
        </div>
      </div>
    `;
  return `<aside class="labx-right-panel">${content}</aside>`;
}
