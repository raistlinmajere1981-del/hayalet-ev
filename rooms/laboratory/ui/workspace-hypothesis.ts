import { escapeHtml } from "../models/lab-types.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

export function renderWorkspaceHypothesis(hypothesis: string, copy: LabI18n = LAB_FALLBACK_I18N) {
  return `
    <div class="labx-hypothesis" id="lab-hypothesis">
      <label class="labx-field">
        <span class="labx-hypothesis__label">${escapeHtml(copy.t("mediaAnalysis.hypothesis.label", "Hypothesis"))}</span>
        <textarea
          class="labx-textarea labx-textarea--compact"
          data-lab-field="workspace.hypothesis"
          placeholder="${escapeHtml(copy.t("mediaAnalysis.hypothesis.placeholder", "Describe what you're looking for — e.g. check splice around 01:30, verify audio sync..."))}"
          rows="2"
        >${escapeHtml(hypothesis)}</textarea>
      </label>
    </div>
  `;
}
