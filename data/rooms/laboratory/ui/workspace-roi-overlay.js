import { escapeHtml } from "../models/lab-types.js";
export function renderWorkspaceROIOverlay(regions) {
  const regionElements = regions.map(function(region) {
    return `
      <div
        class="labx-roi-region ${region.active ? "labx-roi-region--active" : "labx-roi-region--inactive"}"
        style="left: ${String(region.x)}px; top: ${String(region.y)}px; width: ${String(region.width)}px; height: ${String(region.height)}px"
        data-roi-id="${escapeHtml(region.id)}"
      >
        <div class="labx-roi-region__label">
          ${region.label ? escapeHtml(region.label) : `ROI ${escapeHtml(region.id.slice(-4))}`}
        </div>
        <div class="labx-roi-region__controls">
          <button
            class="labx-roi-btn"
            type="button"
            data-lab-action="workspace-roi-toggle"
            data-lab-value="${escapeHtml(region.id)}"
            title="${region.active ? "Deactivate" : "Activate"}"
          >${region.active ? "●" : "○"}</button>
          <button
            class="labx-roi-btn labx-roi-btn--export"
            type="button"
            data-lab-action="workspace-roi-export"
            data-lab-value="${escapeHtml(region.id)}"
            title="Export as image"
          >⤓</button>
          <button
            class="labx-roi-btn"
            type="button"
            data-lab-action="workspace-roi-remove"
            data-lab-value="${escapeHtml(region.id)}"
            title="Remove"
          >✕</button>
        </div>
      </div>
    `;
  }).join("");
  return `
    <div class="labx-roi-overlay" id="lab-roi-overlay" data-lab-action="roi-draw">
      ${regionElements}
      ${regions.length > 0 ? `
        <div class="labx-roi-summary">
          <span>${String(regions.length)} region${regions.length !== 1 ? "s" : ""}</span>
          <span>${String(
    regions.filter(function(r) {
      return r.active;
    }).length
  )} active</span>
        </div>
      ` : `
        <div class="labx-roi-hint">Draw rectangle to define region of interest</div>
      `}
    </div>
  `;
}
