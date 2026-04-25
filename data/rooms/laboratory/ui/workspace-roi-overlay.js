import { escapeHtml } from "../models/lab-types.js";
const INSPECTION_MODE_OPTIONS = ["none", "visual", "audio", "motion"];
function formatInspectionMode(mode) {
  return {
    none: "None",
    visual: "Visual",
    audio: "Audio",
    motion: "Motion"
  }[mode];
}
function supportsInspectionMode(mode, sourceKind) {
  switch (mode) {
    case "none":
      return true;
    case "audio":
      return sourceKind === "audio" || sourceKind === "video";
    case "motion":
      return sourceKind === "video";
    case "visual":
      return sourceKind === "image" || sourceKind === "video";
    default:
      return false;
  }
}
function renderSelectionFocusMask(selectionRoi) {
  const left = Math.max(0, Math.min(100, selectionRoi.x * 100));
  const top = Math.max(0, Math.min(100, selectionRoi.y * 100));
  const width = Math.max(0, Math.min(100 - left, selectionRoi.width * 100));
  const height = Math.max(0, Math.min(100 - top, selectionRoi.height * 100));
  const right = Math.max(0, 100 - (left + width));
  const bottom = Math.max(0, 100 - (top + height));
  return `
    <div class="labx-selection-roi-mask labx-selection-roi-mask--top" style="left: 0%; top: 0%; width: 100%; height: ${String(top)}%"></div>
    <div class="labx-selection-roi-mask labx-selection-roi-mask--left" style="left: 0%; top: ${String(top)}%; width: ${String(left)}%; height: ${String(height)}%"></div>
    <div class="labx-selection-roi-mask labx-selection-roi-mask--right" style="left: ${String(left + width)}%; top: ${String(top)}%; width: ${String(right)}%; height: ${String(height)}%"></div>
    <div class="labx-selection-roi-mask labx-selection-roi-mask--bottom" style="left: 0%; top: ${String(top + height)}%; width: 100%; height: ${String(bottom)}%"></div>
  `;
}
function renderSelectionRoi(selectionRoi, roiFocusActive) {
  return `
    ${renderSelectionFocusMask(selectionRoi)}
    <div
      class="labx-selection-roi${roiFocusActive ? " labx-selection-roi--focused" : ""}"
      style="left: ${String(selectionRoi.x * 100)}%; top: ${String(selectionRoi.y * 100)}%; width: ${String(selectionRoi.width * 100)}%; height: ${String(selectionRoi.height * 100)}%"
      data-lab-selection-roi="true"
      data-lab-selection-roi-ignore="true"
    >
      <div class="labx-selection-roi__label">${roiFocusActive ? "Focused ROI" : "Inspection ROI"}</div>
    </div>
  `;
}
function renderLegacyRegions(regions) {
  return regions.map(function(region) {
    return `
      <div
        class="labx-roi-region ${region.active ? "labx-roi-region--active" : "labx-roi-region--inactive"}"
        style="left: ${String(region.x)}px; top: ${String(region.y)}px; width: ${String(region.width)}px; height: ${String(region.height)}px"
        data-roi-id="${escapeHtml(region.id)}"
      >
        <div class="labx-roi-region__label">
          ${region.label ? escapeHtml(region.label) : `ROI ${escapeHtml(region.id.slice(-4))}`}
        </div>
        <div class="labx-roi-region__controls" data-lab-selection-roi-ignore="true">
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
}
function renderInlineInspectionControls(inspectionMode, selectionRoi, sourceKind, roiFocusActive) {
  return `
    <div class="labx-roi-selection-toolbar" data-lab-selection-roi-ignore="true">
      <div class="labx-roi-selection-toolbar__status">
        <span>${selectionRoi ? "Region active" : "No region yet"}</span>
        <span>Inspection: ${escapeHtml(formatInspectionMode(inspectionMode))}</span>
      </div>
      <div class="labx-roi-selection-toolbar__modes">
        ${INSPECTION_MODE_OPTIONS.map(function(mode) {
    const supported = supportsInspectionMode(mode, sourceKind);
    const active = inspectionMode === mode;
    return `
            <button
              class="labx-roi-selection-toolbar__mode${active ? " is-active" : ""}"
              type="button"
              ${supported ? `data-lab-selection-inspection-mode="${mode}"` : "disabled"}
              aria-pressed="${String(active)}"
            >${escapeHtml(formatInspectionMode(mode))}</button>
          `;
  }).join("")}
        ${selectionRoi ? `
              <button
                class="labx-roi-selection-toolbar__action"
                type="button"
                ${roiFocusActive ? `data-lab-selection-roi-focus-reset="true"` : `data-lab-selection-roi-focus-toggle="true"`}
              >${roiFocusActive ? "Reset focus" : "Focus region"}</button>
              <button
                class="labx-roi-selection-toolbar__action"
                type="button"
                data-lab-selection-roi-capture="true"
              >Capture region</button>
              <button
                class="labx-roi-selection-toolbar__clear"
                type="button"
                data-lab-selection-roi-clear="true"
              >Clear region</button>
            ` : ""}
      </div>
    </div>
  `;
}
export function renderWorkspaceROIOverlay(options) {
  const selectionRoi = options.selectionRoi ?? null;
  const roiFocusActive = options.roiFocusActive === true;
  const regionElements = renderLegacyRegions(options.legacyRegions);
  const summaryMarkup = options.legacyRegions.length > 0 ? `
        <div class="labx-roi-summary">
          <span>${String(options.legacyRegions.length)} region${options.legacyRegions.length !== 1 ? "s" : ""}</span>
          <span>${String(
    options.legacyRegions.filter(function(r) {
      return r.active;
    }).length
  )} active</span>
        </div>
      ` : `
        <div class="labx-roi-hint">
          ${options.selectionRoiEnabled ? selectionRoi ? "Drag to redefine the inspection region or double click to focus" : "Drag to define an inspection region" : "Select a time range, then drag to define region of interest"}
        </div>
      `;
  return `
    <div
      class="labx-roi-overlay"
      id="lab-roi-overlay"
      data-lab-selection-roi-overlay="true"
      data-lab-roi-focus-active="${roiFocusActive ? "true" : "false"}"
      data-lab-source-kind="${escapeHtml(options.sourceKind)}"
    >
      ${selectionRoi ? renderSelectionRoi(selectionRoi, roiFocusActive) : ""}
      ${regionElements}
      ${summaryMarkup}
      ${options.showInlineInspectionControls === true ? renderInlineInspectionControls(
    options.inspectionMode,
    selectionRoi,
    options.sourceKind,
    roiFocusActive
  ) : ""}
    </div>
  `;
}
