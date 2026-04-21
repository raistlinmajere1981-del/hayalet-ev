import { escapeHtml } from "../models/lab-types.js";
import { getAvailableIntents } from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";
function getReadinessTone(readiness) {
  switch (readiness) {
    case "ready":
      return "success";
    case "optional":
      return "warning";
    case "blocked":
      return "error";
    default:
      return "neutral";
  }
}
export function renderWorkspaceIntents(state) {
  const intents = getAvailableIntents(state);
  return `
    <section class="labx-card labx-intents-card">
      <div class="labx-card__header">
        <div>
          <p class="labx-card__eyebrow">CAPABILITIES</p>
          <h2 class="labx-card__title">What to look for</h2>
        </div>
      </div>
      <div class="labx-card__body">
        <div class="labx-intent-list">
          ${intents.map(function(intent) {
    return `
              <article
                class="labx-intent-item"
                data-readiness="${intent.readiness}"
                data-selected="${intent.selected ? "true" : "false"}"
              >
                <div class="labx-intent-item__head">
                  <strong>${escapeHtml(intent.label)}</strong>
                  ${renderStatusChip(
      intent.readiness === "ready" ? "Available" : intent.readiness === "optional" ? "Partial" : "Unavailable",
      getReadinessTone(intent.readiness)
    )}
                </div>
                <p class="labx-intent-item__desc">${escapeHtml(intent.description)}</p>
                ${intent.blockReason ? `<p class="labx-intent-item__reason">${escapeHtml(intent.blockReason)}</p>` : ""}
                <button
                  class="labx-inline-action labx-inline-action--small"
                  type="button"
                  data-lab-action="workspace-intent-toggle"
                  data-lab-value="${escapeHtml(intent.id)}"
                  ${intent.readiness === "blocked" ? "disabled" : ""}
                >
                  ${intent.selected ? "Deselect" : "Select"}
                </button>
              </article>
            `;
  }).join("")}
        </div>
      </div>
    </section>
  `;
}
