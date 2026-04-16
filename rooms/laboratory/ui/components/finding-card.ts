import { escapeHtml } from "../../models/lab-types.js";
import type { LabFindingProjection } from "../../models/lab-types.js";
import { renderStatusChip } from "./status-chip.js";

export function renderFindingCard(finding: LabFindingProjection) {
  return `
    <article class="labx-finding-card">
      <div class="labx-finding-card__head">
        <strong>${escapeHtml(finding.title)}</strong>
        ${renderStatusChip(finding.kind, finding.kind === "measured" ? "success" : finding.kind === "heuristic" ? "warning" : "neutral")}
      </div>
      <p class="labx-finding-card__detail">${escapeHtml(finding.detail)}</p>
      <div class="labx-finding-card__meta">
        <span>${escapeHtml(`Confidence: ${finding.confidence}`)}</span>
        <span>${escapeHtml(`Evidence: ${String(finding.evidenceCount)}`)}</span>
      </div>
    </article>
  `;
}
