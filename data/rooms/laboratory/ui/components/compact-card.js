import { escapeHtml } from "../../models/lab-types.js";
export function renderCompactCard(options) {
  return `
    <section class="labx-card" data-tone="${escapeHtml(options.tone || "neutral")}">
      <div class="labx-card__header">
        <div>
          ${options.eyebrow ? `<p class="labx-card__eyebrow">${escapeHtml(options.eyebrow)}</p>` : ""}
          <h2 class="labx-card__title">${escapeHtml(options.title)}</h2>
        </div>
      </div>
      <div class="labx-card__body">${options.body}</div>
      ${options.footer ? `<div class="labx-card__footer">${options.footer}</div>` : ""}
    </section>
  `;
}
