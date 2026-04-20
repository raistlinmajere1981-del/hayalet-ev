import { escapeHtml, formatDateTime } from "../../models/lab-types.js";
function formatReference(finding) {
  const parts = [];
  if (finding.reference?.timeRange) {
    const timeRange = finding.reference.timeRange;
    parts.push(`${Math.round(timeRange.startMs / 1e3)}s-${Math.round(timeRange.endMs / 1e3)}s`);
  }
  if (finding.reference?.frameRange) {
    const frameRange = finding.reference.frameRange;
    parts.push(`F ${frameRange.startFrame}-${frameRange.endFrame}`);
  }
  if (finding.reference?.region) {
    const region = finding.reference.region;
    parts.push(`ROI ${region.x},${region.y} ${region.width}x${region.height}`);
  }
  return parts.join(" | ");
}
export function renderLiveFindingsStream(options) {
  if (options.findings.length === 0) {
    return `<p class="labx-panel-hint">Canli bulgu akisi, modul toplu bulgu gonderdiginde burada görünür.</p>`;
  }
  return `
    <div class="labx-list-stack">
      ${options.findings.map(function(finding) {
    const reference = formatReference(finding);
    return `
            <article class="labx-finding-card" data-kind="live">
              <div class="labx-finding-card__head">
                <strong>${escapeHtml(finding.title)}</strong>
                <span>${escapeHtml(formatDateTime(new Date(finding.emittedAt).toISOString()))}</span>
              </div>
              <p class="labx-finding-card__detail">${escapeHtml(finding.detail)}</p>
              <div class="labx-finding-card__meta">
                <span>${escapeHtml(`Confidence: ${finding.confidence}`)}</span>
                ${finding.sourceModule ? `<span>${escapeHtml(`Module: ${finding.sourceModule}`)}</span>` : ""}
                ${reference ? `<span>${escapeHtml(reference)}</span>` : ""}
                ${finding.hypothesis ? `<span>${escapeHtml(`Hypothesis: ${finding.hypothesis}`)}</span>` : ""}
              </div>
            </article>
          `;
  }).join("")}
      ${options.canExpand ? `
            <div class="labx-inline-actions">
              <button class="labx-inline-action" type="button" data-lab-action="toggle-live-findings">
                ${options.expanded ? "Akisi daralt" : "Tum akis"}
              </button>
            </div>
          ` : ""}
    </div>
  `;
}
