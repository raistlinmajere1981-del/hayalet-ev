import { escapeHtml } from "../domain/lab-types.js";
import type { LaboratoryTransformPreviewMode } from "../shared/transform-stack-render-context.js";
import type { LabI18n } from "./lab-i18n.js";

export function renderWorkspacePreviewModes(input: {
  activeMode: LaboratoryTransformPreviewMode;
  content: string;
  copy: LabI18n;
  differenceAvailable: boolean;
  locked: boolean;
  trackingPreviewActive: boolean;
  transformAvailable: boolean;
}) {
  if (!input.transformAvailable && !input.differenceAvailable) return input.content;

  const sourceLabel = input.copy.t("mediaAnalysis.stages.source", "Source");
  const transformLabel = input.copy.t("mediaAnalysis.timeline.transformPreviewMode", "Transform");
  const differenceLabel = input.copy.t(
    "mediaAnalysis.operations.comparison.viewModes.difference",
    "Difference"
  );
  const selectedValue =
    input.activeMode === "transform"
      ? "stacked"
      : input.activeMode === "difference"
        ? "difference"
        : "side-by-side";
  const activeLabel = input.trackingPreviewActive
    ? input.copy.t("mediaAnalysis.timeline.trackingPreviewPaneLabel", "Tracking Preview")
    : input.activeMode === "transform"
      ? transformLabel
      : input.activeMode === "difference"
        ? differenceLabel
        : sourceLabel;

  return `
    <div class="labx-workspace-preview-modes" data-lab-workspace-preview-modes="true">
      <div class="labx-workspace-preview-modes__toolbar">
        <strong>${escapeHtml(input.copy.t("mediaAnalysis.timeline.playerPreviewModes", "Player Preview"))}</strong>
        <label>
          <span>${escapeHtml(input.copy.t("mediaAnalysis.operations.comparison.viewMode", "View"))}</span>
          <select
            class="labx-select labx-select--compact"
            data-lab-field="workspace.comparison.viewMode"
            data-lab-workspace-preview-mode="true"
            ${input.locked ? "disabled" : ""}
          >
            <option value="side-by-side" ${selectedValue === "side-by-side" ? "selected" : ""}>${escapeHtml(sourceLabel)}</option>
            <option value="stacked" ${selectedValue === "stacked" ? "selected" : ""} ${input.transformAvailable ? "" : "disabled"}>${escapeHtml(transformLabel)}</option>
            <option value="difference" ${selectedValue === "difference" ? "selected" : ""} ${input.differenceAvailable ? "" : "disabled"}>${escapeHtml(differenceLabel)}</option>
          </select>
        </label>
        <span class="labx-workspace-preview-modes__status">${escapeHtml(activeLabel)}</span>
      </div>
      <div class="labx-workspace-preview-modes__content">
        ${input.content}
      </div>
    </div>
  `;
}
