import { escapeHtml } from "../../models/lab-types.js";
export function renderPrimaryCTA(options) {
  return `
    <button
      class="labx-primary-cta"
      type="button"
      data-lab-action="${escapeHtml(options.action)}"
      ${options.disabled ? "disabled" : ""}
    >
      <span>${escapeHtml(options.label)}</span>
      ${options.detail ? `<small class="labx-primary-cta__detail">${escapeHtml(options.detail)}</small>` : ""}
    </button>
  `;
}
