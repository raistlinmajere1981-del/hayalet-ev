import { escapeHtml } from "../../models/lab-types.js";

type EmptyStateOptions = {
  description: string;
  hint: string;
  title: string;
};

export function renderEmptyState(options: EmptyStateOptions) {
  return `
    <section class="labx-empty-state">
      <strong class="labx-empty-state__title">${escapeHtml(options.title)}</strong>
      <p class="labx-empty-state__description">${escapeHtml(options.description)}</p>
      <p class="labx-empty-state__hint">${escapeHtml(options.hint)}</p>
    </section>
  `;
}
