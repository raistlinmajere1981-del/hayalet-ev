import { escapeHtml, formatDateTime } from "../../models/lab-types.js";
import type { LabArtifactProjection } from "../../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "../lab-i18n.js";
import type { LabI18n } from "../lab-i18n.js";

export function renderArtifactItem(
  artifact: LabArtifactProjection,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  return `
    <article class="labx-artifact-item">
      <div>
        <strong>${escapeHtml(artifact.fileName || artifact.kind || artifact.id)}</strong>
        <p class="labx-panel-hint">${escapeHtml(
          artifact.path ||
            artifact.previewUrl ||
            copy.t("mediaAnalysis.assets.pathUnavailable", "Path unavailable")
        )}</p>
      </div>
      <span>${escapeHtml(artifact.createdAt ? formatDateTime(artifact.createdAt) : "--")}</span>
    </article>
  `;
}
