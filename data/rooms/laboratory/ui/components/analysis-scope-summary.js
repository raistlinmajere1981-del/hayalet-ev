import { escapeHtml } from "../../models/lab-types.js";
function formatTimeRange(scope) {
  if (!scope?.timeRange) {
    return "--";
  }
  return `${Math.round(scope.timeRange.startMs / 1e3)}s - ${Math.round(scope.timeRange.endMs / 1e3)}s`;
}
function formatFrameRange(scope) {
  if (!scope?.frameRange) {
    return "--";
  }
  return `${scope.frameRange.startFrame} - ${scope.frameRange.endFrame}`;
}
function formatRegion(scope) {
  if (!scope?.region) {
    return "--";
  }
  return `${scope.region.x},${scope.region.y} / ${scope.region.width}x${scope.region.height}`;
}
export function renderAnalysisScopeSummary(scope, confidence) {
  return `
    <div class="labx-summary-list">
      <div><span>Focus</span><strong>${escapeHtml(scope?.focus || "global")}</strong></div>
      <div><span>Time</span><strong>${escapeHtml(formatTimeRange(scope))}</strong></div>
      <div><span>Frames</span><strong>${escapeHtml(formatFrameRange(scope))}</strong></div>
      <div><span>ROI</span><strong>${escapeHtml(formatRegion(scope))}</strong></div>
      <div><span>Hypothesis</span><strong>${escapeHtml(scope?.hypothesis || "--")}</strong></div>
      ${confidence ? `<div><span>Confidence</span><strong>${escapeHtml(confidence)}</strong></div>` : ""}
      ${scope?.lifecycle ? `<div><span>Scope</span><strong>${escapeHtml(
    scope.lifecycle.mutable === false ? "Frozen" : "Draft"
  )}</strong></div>` : ""}
    </div>
  `;
}
