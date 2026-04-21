import { escapeHtml } from "../models/lab-types.js";

export function renderWorkspaceHypothesis(hypothesis: string) {
  return `
    <div class="labx-hypothesis" id="lab-hypothesis">
      <label class="labx-field">
        <span class="labx-hypothesis__label">Hypothesis</span>
        <textarea
          class="labx-textarea labx-textarea--compact"
          data-lab-field="workspace.hypothesis"
          placeholder="Describe what you're looking for — e.g. check splice around 01:30, verify audio sync..."
          rows="2"
        >${escapeHtml(hypothesis)}</textarea>
      </label>
    </div>
  `;
}
