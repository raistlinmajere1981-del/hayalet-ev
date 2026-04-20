import { escapeHtml } from "../../models/lab-types.js";
import type { AnalysisScope } from "../../shared/types/analysis-scope.js";

function formatTimeRange(scope: AnalysisScope | null) {
  if (!scope?.timeRange) {
    return "--";
  }
  return `${Math.round(scope.timeRange.startMs / 1000)}s - ${Math.round(scope.timeRange.endMs / 1000)}s`;
}

function formatFrameRange(scope: AnalysisScope | null) {
  if (!scope?.frameRange) {
    return "--";
  }
  return `${scope.frameRange.startFrame} - ${scope.frameRange.endFrame}`;
}

function formatRegion(scope: AnalysisScope | null) {
  if (!scope?.region) {
    return "--";
  }
  return `${scope.region.x},${scope.region.y} / ${scope.region.width}x${scope.region.height}`;
}

export function renderAnalysisScopeSummary(
  scope: AnalysisScope | null,
  confidence?: string | null
) {
  return `
    <div class="labx-summary-list">
      <div><span>Focus</span><strong>${escapeHtml(scope?.focus || "global")}</strong></div>
      <div><span>Time</span><strong>${escapeHtml(formatTimeRange(scope))}</strong></div>
      <div><span>Frames</span><strong>${escapeHtml(formatFrameRange(scope))}</strong></div>
      <div><span>ROI</span><strong>${escapeHtml(formatRegion(scope))}</strong></div>
      <div><span>Hypothesis</span><strong>${escapeHtml(scope?.hypothesis || "--")}</strong></div>
      ${
        confidence
          ? `<div><span>Confidence</span><strong>${escapeHtml(confidence)}</strong></div>`
          : ""
      }
      ${
        scope?.lifecycle
          ? `<div><span>Scope</span><strong>${escapeHtml(
              scope.lifecycle.mutable === false ? "Frozen" : "Draft"
            )}</strong></div>`
          : ""
      }
    </div>
  `;
}
