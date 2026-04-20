import { escapeHtml, formatDateTime } from "../../models/lab-types.js";
export function renderEventFeed(options) {
  if (options.events.length === 0) {
    return `<p class="labx-panel-hint">Henüz olay kaydı oluşmadı.</p>`;
  }
  return `
    <div class="labx-event-feed">
      ${options.totalCount > options.events.length ? `<p class="labx-panel-hint">${String((options.offset || 0) + 1)}-${String(
    (options.offset || 0) + options.events.length
  )} / ${String(options.totalCount)} olay gösteriliyor.</p>` : ""}
      ${options.events.map(function(event) {
    return `
            <article class="labx-event-feed__item" data-severity="${escapeHtml(event.severity)}">
              <div class="labx-event-feed__head">
                <strong>${escapeHtml(event.message)}</strong>
                <span>${escapeHtml(formatDateTime(new Date(event.timestamp).toISOString()))}</span>
              </div>
              ${event.detail ? `<p class="labx-event-feed__detail">${escapeHtml(event.detail)}</p>` : ""}
            </article>
          `;
  }).join("")}
      ${options.canAdvance ? `
            <div class="labx-inline-actions">
              <button class="labx-inline-action" type="button" data-lab-action="event-feed-next">Daha eski olaylar</button>
              <button class="labx-inline-action" type="button" data-lab-action="event-feed-reset">Başa dön</button>
            </div>
          ` : ""}
    </div>
  `;
}
