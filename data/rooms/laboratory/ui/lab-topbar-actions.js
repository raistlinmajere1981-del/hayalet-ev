import { escapeHtml } from "../models/lab-types.js";
import { getHubUserActions } from "../runtime/lab-selectors.js";
import { getLabUserActionDisplayText } from "../runtime/lab-user-actions.js";
function getHubActionIcon(actionEvent) {
  switch (actionEvent.status) {
    case "idle":
      return `<span class="labx-topbar-actions__icon" aria-hidden="true">•</span>`;
    case "running":
      return `<span class="labx-topbar-actions__spinner" aria-hidden="true"></span>`;
    case "success":
      return `<span class="labx-topbar-actions__icon" aria-hidden="true">✓</span>`;
    case "error":
      return `<span class="labx-topbar-actions__icon" aria-hidden="true">✕</span>`;
    default: {
      const unreachableStatus = actionEvent.status;
      return `<span class="labx-topbar-actions__icon" aria-hidden="true">${escapeHtml(unreachableStatus)}</span>`;
    }
  }
}
function getHubActionTone(actionEvent) {
  switch (actionEvent.status) {
    case "idle":
      return "idle";
    case "running":
      return "running";
    case "success":
      return "success";
    case "error":
      return "error";
    default: {
      const unreachableStatus = actionEvent.status;
      return unreachableStatus;
    }
  }
}
export function renderLabTopbarActions(state) {
  const hubActions = getHubUserActions(state);
  if (hubActions.length === 0) {
    return "";
  }
  return `
    <section class="labx-topbar-actions" aria-label="Action progress hub">
      <div class="labx-topbar-actions__list">
        ${hubActions.map(function(actionEvent) {
    return `
              <article
                class="labx-topbar-actions__item"
                data-tone="${escapeHtml(getHubActionTone(actionEvent))}"
              >
                ${getHubActionIcon(actionEvent)}
                <span class="labx-topbar-actions__label">${escapeHtml(
      getLabUserActionDisplayText(actionEvent)
    )}</span>
              </article>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
