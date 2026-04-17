import { escapeHtml, formatStatusLabel } from "../../models/lab-types.js";
import type { LabModuleState } from "../../models/lab-types.js";
import { renderStatusChip } from "./status-chip.js";

export function renderModuleRow(module: LabModuleState) {
  const progress =
    module.progressMode === "measured" && typeof module.progress === "number"
      ? Math.max(0, Math.min(100, module.progress))
      : null;
  return `
    <article class="labx-module-row">
      <div class="labx-module-row__head">
        <div>
          <strong>${escapeHtml(module.title || module.id)}</strong>
          ${module.summary ? `<p class="labx-panel-hint">${escapeHtml(module.summary)}</p>` : ""}
        </div>
        ${renderStatusChip(formatStatusLabel(module.status), module.status === "failed" ? "error" : module.status === "completed" ? "success" : module.status === "running" ? "running" : "neutral")}
      </div>
      ${
        progress !== null
          ? `
            <div class="labx-progress">
              <span style="width:${String(progress)}%"></span>
            </div>
          `
          : ""
      }
      ${module.message ? `<p class="labx-panel-hint">${escapeHtml(module.message)}</p>` : ""}
    </article>
  `;
}
