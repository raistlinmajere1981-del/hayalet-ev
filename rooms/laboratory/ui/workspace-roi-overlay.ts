import { escapeHtml } from "../models/lab-types.js";
import type { LabInspectionMode, LabROIRegion, LabSelectionROI } from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

type RenderWorkspaceROIOverlayOptions = {
  inspectionMode: LabInspectionMode;
  legacyRegions: LabROIRegion[];
  mutationLocked?: boolean;
  roiFocusActive?: boolean;
  selectionRoi?: LabSelectionROI | null;
  selectionRoiEnabled: boolean;
  showInlineInspectionControls?: boolean;
  sourceKind: string;
};

const INSPECTION_MODE_OPTIONS = ["none", "visual", "audio", "motion"] as const;

function formatInspectionMode(mode: LabInspectionMode) {
  return (
    {
      none: "None",
      visual: "Visual",
      audio: "Audio",
      motion: "Motion",
    } as const
  )[mode];
}

function formatInspectionModeCopy(mode: LabInspectionMode, copy: LabI18n) {
  return copy.t(`mediaAnalysis.roi.inspectionModes.${mode}`, formatInspectionMode(mode));
}

function supportsInspectionMode(mode: LabInspectionMode, sourceKind: string) {
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

function renderSelectionFocusMask(selectionRoi: LabSelectionROI) {
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

function renderSelectionRoi(selectionRoi: LabSelectionROI, roiFocusActive: boolean, copy: LabI18n) {
  return `
    ${renderSelectionFocusMask(selectionRoi)}
    <div
      class="labx-selection-roi${roiFocusActive ? " labx-selection-roi--focused" : ""}"
      style="left: ${String(selectionRoi.x * 100)}%; top: ${String(selectionRoi.y * 100)}%; width: ${String(selectionRoi.width * 100)}%; height: ${String(selectionRoi.height * 100)}%"
      data-lab-selection-roi="true"
      data-lab-selection-roi-ignore="true"
    >
      <div class="labx-selection-roi__label">${escapeHtml(
        roiFocusActive
          ? copy.t("mediaAnalysis.roi.focusedLabel", "Focused ROI")
          : copy.t("mediaAnalysis.roi.inspectionLabel", "Inspection ROI")
      )}</div>
    </div>
  `;
}

function renderLegacyRegions(regions: LabROIRegion[], mutationLocked: boolean, copy: LabI18n) {
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

function renderInlineInspectionControls(
  inspectionMode: LabInspectionMode,
  selectionRoi: LabSelectionROI | null,
  sourceKind: string,
  roiFocusActive: boolean,
  mutationLocked: boolean,
  copy: LabI18n
) {
  const mutationDisabledAttr = mutationLocked ? 'disabled aria-disabled="true"' : "";
  return `
    <div class="labx-roi-selection-toolbar" data-lab-selection-roi-ignore="true">
      <div class="labx-roi-selection-toolbar__status">
        <span>${escapeHtml(selectionRoi ? copy.t("mediaAnalysis.roi.status.regionActive", "Region active") : copy.t("mediaAnalysis.roi.status.noRegion", "No region yet"))}</span>
        <span>${escapeHtml(copy.t("mediaAnalysis.roi.inspectionPrefix", "Inspection"))}: ${escapeHtml(formatInspectionModeCopy(inspectionMode, copy))}</span>
      </div>
      <div class="labx-roi-selection-toolbar__modes">
        ${INSPECTION_MODE_OPTIONS.map(function (mode) {
          const supported = supportsInspectionMode(mode, sourceKind);
          const active = inspectionMode === mode;
          return `
            <button
              class="labx-roi-selection-toolbar__mode${active ? " is-active" : ""}"
              type="button"
              ${supported ? `data-lab-selection-inspection-mode="${mode}"` : "disabled"}
              aria-pressed="${String(active)}"
            >${escapeHtml(formatInspectionModeCopy(mode, copy))}</button>
          `;
        }).join("")}
        ${
          selectionRoi
            ? `
              <button
                class="labx-roi-selection-toolbar__action"
                type="button"
                ${roiFocusActive ? `data-lab-selection-roi-focus-reset="true"` : `data-lab-selection-roi-focus-toggle="true"`}
              >${escapeHtml(roiFocusActive ? copy.t("mediaAnalysis.roi.actions.resetFocus", "Reset focus") : copy.t("mediaAnalysis.roi.actions.focusRegion", "Focus region"))}</button>
              <button
                class="labx-roi-selection-toolbar__action"
                type="button"
                data-lab-selection-roi-capture="true"
                ${mutationDisabledAttr}
              >${escapeHtml(copy.t("mediaAnalysis.roi.actions.captureRegion", "Capture region"))}</button>
              <button
                class="labx-roi-selection-toolbar__clear"
                type="button"
                data-lab-selection-roi-clear="true"
                ${mutationDisabledAttr}
              >${escapeHtml(copy.t("mediaAnalysis.roi.actions.clearRegion", "Clear region"))}</button>
            `
            : ""
        }
      </div>
    </div>
  `;
}

export function renderWorkspaceROIOverlay(
  options: RenderWorkspaceROIOverlayOptions,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const selectionRoi = options.selectionRoi ?? null;
  const roiFocusActive = options.roiFocusActive === true;
  const mutationLocked = options.mutationLocked === true;
  const regionElements = renderLegacyRegions(options.legacyRegions, mutationLocked, copy);
  const summaryMarkup =
    options.legacyRegions.length > 0
      ? `
        <div class="labx-roi-summary">
          <span>${escapeHtml(copy.t("mediaAnalysis.roi.summary.regions", "{count} region(s)", { count: options.legacyRegions.length }))}</span>
          <span>${String(
            options.legacyRegions.filter(function (r) {
              return r.active;
            }).length
          )} ${escapeHtml(copy.t("mediaAnalysis.roi.summary.active", "active"))}</span>
        </div>
      `
      : `
        <div class="labx-roi-hint">
          ${
            options.selectionRoiEnabled
              ? mutationLocked
                ? escapeHtml(
                    copy.t(
                      "mediaAnalysis.roi.hints.locked",
                      "ROI edits are locked while analysis is running"
                    )
                  )
                : selectionRoi
                  ? escapeHtml(
                      copy.t(
                        "mediaAnalysis.roi.hints.redefine",
                        "Drag to redefine the inspection region or double click to focus"
                      )
                    )
                  : escapeHtml(
                      copy.t(
                        "mediaAnalysis.roi.hints.define",
                        "Drag to define an inspection region"
                      )
                    )
              : escapeHtml(
                  copy.t(
                    "mediaAnalysis.roi.hints.selectRange",
                    "Select a time range, then drag to define region of interest"
                  )
                )
          }
        </div>
      `;

  return `
    <div
      class="labx-roi-overlay"
      id="lab-roi-overlay"
      data-lab-selection-roi-overlay="true"
      data-lab-roi-focus-active="${roiFocusActive ? "true" : "false"}"
      data-lab-roi-mutation-locked="${mutationLocked ? "true" : "false"}"
      data-lab-source-kind="${escapeHtml(options.sourceKind)}"
    >
      ${selectionRoi ? renderSelectionRoi(selectionRoi, roiFocusActive, copy) : ""}
      ${regionElements}
      ${summaryMarkup}
      ${
        options.showInlineInspectionControls === true
          ? renderInlineInspectionControls(
              options.inspectionMode,
              selectionRoi,
              options.sourceKind,
              roiFocusActive,
              mutationLocked,
              copy
            )
          : ""
      }
    </div>
  `;
}
