import { escapeHtml } from "../domain/lab-types.js";
import type { LabROIRegion, LabSelectionROI } from "../domain/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

type VisualStressRoiRole = "target" | "control" | "background";

type RenderWorkspaceROIOverlayOptions = {
  regions: LabROIRegion[];
  mutationLocked?: boolean;
  overlayId?: string;
  roiFocusActive?: boolean;
  selectionRoi?: LabSelectionROI | null;
  selectionRoiEnabled: boolean;
  sourceKind: string;
};

const SELECTION_ROI_RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

function renderSelectionResizeHandles(
  copy: LabI18n,
  visualStressRole: VisualStressRoiRole | null = null
) {
  const label = escapeHtml(copy.t("mediaAnalysis.roi.actions.resizeRegion", "Resize region"));
  const roleAttribute =
    visualStressRole === null ? "" : ` data-lab-visual-stress-roi-role="${visualStressRole}"`;
  return SELECTION_ROI_RESIZE_HANDLES.map(function (handle) {
    return `
      <button
        class="labx-selection-roi__resize-handle labx-selection-roi__resize-handle--${handle}"
        type="button"
        data-lab-selection-roi-resize="${handle}"
        data-lab-selection-roi-ignore="true"${roleAttribute}
        aria-label="${label}"
        title="${label}"
      ></button>
    `;
  }).join("");
}

function renderSelectionRoi(
  selectionRoi: LabSelectionROI,
  roiFocusActive: boolean,
  mutationLocked: boolean,
  copy: LabI18n,
  sourceKind: string
) {
  const visualStressRole: VisualStressRoiRole | null = sourceKind === "video" ? "target" : null;
  const roleAttribute =
    visualStressRole === null ? "" : ` data-lab-visual-stress-roi-role="${visualStressRole}"`;
  return `
    <div
      class="labx-selection-roi${roiFocusActive ? " labx-selection-roi--focused" : ""}"
      style="left: ${String(selectionRoi.x * 100)}%; top: ${String(selectionRoi.y * 100)}%; width: ${String(selectionRoi.width * 100)}%; height: ${String(selectionRoi.height * 100)}%"
      data-lab-selection-roi="true"
      data-lab-selection-roi-ignore="true"${roleAttribute}
    >
      <div class="labx-selection-roi__label">${escapeHtml(
        roiFocusActive
          ? copy.t("mediaAnalysis.roi.focusedLabel", "Focused ROI")
          : copy.t("mediaAnalysis.roi.inspectionLabel", "Inspection ROI")
      )}</div>
      ${
        mutationLocked
          ? ""
          : `
            <button
              class="labx-selection-roi__clear"
              type="button"
              data-lab-selection-roi-clear="true"
              data-lab-selection-roi-ignore="true"${roleAttribute}
              aria-label="${escapeHtml(copy.t("mediaAnalysis.roi.actions.clearRegion", "Clear region"))}"
              title="${escapeHtml(copy.t("mediaAnalysis.roi.actions.clearRegion", "Clear region"))}"
            >&times;</button>
            ${renderSelectionResizeHandles(copy, visualStressRole)}
          `
      }
    </div>
  `;
}

function renderVisualStressAuxiliaryRoi(
  role: "control" | "background",
  mutationLocked: boolean,
  copy: LabI18n
) {
  const title = role === "control" ? "Control ROI" : "Background ROI";
  return `
    <div
      class="labx-selection-roi labx-selection-roi--visual-${role}"
      data-lab-selection-roi="${role}"
      data-lab-selection-roi-ignore="true"
      data-lab-visual-stress-${role}-overlay="true"
      data-lab-visual-stress-roi-role="${role}"
      data-active="false"
      hidden
    >
      <div class="labx-selection-roi__label">${title}</div>
      ${
        mutationLocked
          ? ""
          : `
            <button
              class="labx-selection-roi__clear"
              type="button"
              data-lab-selection-roi-clear="true"
              data-lab-selection-roi-ignore="true"
              data-lab-visual-stress-roi-role="${role}"
              aria-label="Clear ${title}"
              title="Clear ${title}"
            >&times;</button>
            ${renderSelectionResizeHandles(copy, role)}
          `
      }
    </div>
  `;
}

function renderRegions(regions: LabROIRegion[], mutationLocked: boolean, copy: LabI18n) {
  const mutationDisabledAttr = mutationLocked ? 'disabled aria-disabled="true"' : "";
  return regions
    .map(function (region) {
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
            title="${escapeHtml(region.active ? copy.t("mediaAnalysis.roi.actions.deactivate", "Deactivate") : copy.t("mediaAnalysis.roi.actions.activate", "Activate"))}"
            ${mutationDisabledAttr}
          >${region.active ? "●" : "○"}</button>
          <button
            class="labx-roi-btn labx-roi-btn--export"
            type="button"
            data-lab-action="workspace-roi-export"
            data-lab-value="${escapeHtml(region.id)}"
            title="${escapeHtml(copy.t("mediaAnalysis.roi.actions.export", "Export as image"))}"
          >⤓</button>
          <button
            class="labx-roi-btn"
            type="button"
            data-lab-action="workspace-roi-remove"
            data-lab-value="${escapeHtml(region.id)}"
            title="${escapeHtml(copy.t("mediaAnalysis.roi.actions.remove", "Remove"))}"
            ${mutationDisabledAttr}
          >✕</button>
        </div>
      </div>
    `;
    })
    .join("");
}

export function renderWorkspaceROIOverlay(
  options: RenderWorkspaceROIOverlayOptions,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const selectionRoi = options.selectionRoi ?? null;
  const roiFocusActive = options.roiFocusActive === true;
  const mutationLocked = options.mutationLocked === true;
  const regionElements = renderRegions(options.regions, mutationLocked, copy);
  const overlayId = options.overlayId || "lab-roi-overlay";
  const visualStressNodes =
    options.sourceKind === "video"
      ? `${renderVisualStressAuxiliaryRoi("control", mutationLocked, copy)}${renderVisualStressAuxiliaryRoi("background", mutationLocked, copy)}`
      : "";

  return `
    <div
      class="labx-roi-overlay"
      id="${escapeHtml(overlayId)}"
      data-lab-selection-roi-overlay="true"
      data-lab-selection-roi-frame="true"
      data-lab-roi-focus-active="${roiFocusActive ? "true" : "false"}"
      data-lab-roi-mutation-locked="${mutationLocked ? "true" : "false"}"
      data-lab-selection-roi-enabled="${options.selectionRoiEnabled ? "true" : "false"}"
      data-lab-source-kind="${escapeHtml(options.sourceKind)}"
    >
      <!-- labx-selection-roi-mask intentionally not rendered: ROI inspection must not dim the source preview. -->
      ${selectionRoi ? renderSelectionRoi(selectionRoi, roiFocusActive, mutationLocked, copy, options.sourceKind) : ""}
      ${visualStressNodes}
      ${regionElements}
    </div>
  `;
}
