import { escapeHtml, formatDateTime } from "../../models/lab-types.js";
export function renderArtifactItem(artifact) {
  return `
    <article class="labx-artifact-item">
      <div>
        <strong>${escapeHtml(artifact.fileName || artifact.kind || artifact.id)}</strong>
        <p class="labx-panel-hint">${escapeHtml(artifact.path || artifact.previewUrl || "Path unavailable")}</p>
      </div>
      <span>${escapeHtml(artifact.createdAt ? formatDateTime(artifact.createdAt) : "--")}</span>
    </article>
  `;
}
