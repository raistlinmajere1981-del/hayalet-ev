import { escapeHtml } from "../models/lab-types.js";
import { getActionOutputs, getHubUserActions } from "../runtime/lab-selectors.js";
import {
  getLabUserActionDisplayText,
  getLabUserActionOutputLabel,
  getLabUserActionPrimaryOutput
} from "../runtime/lab-user-actions.js";
import { buildLabAssetMetadataTitle } from "./lab-asset-display.js";
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
function renderHubActionResult(state, actionEvent) {
  if (actionEvent.status !== "success") {
    return "";
  }
  const outputs = getActionOutputs(state, actionEvent.id);
  const primaryOutput = getLabUserActionPrimaryOutput(outputs);
  const outputLabel = getLabUserActionOutputLabel(outputs);
  if (primaryOutput === null || outputLabel === null) {
    return "";
  }
  return `
    <button
      class="labx-topbar-actions__result"
      type="button"
      data-lab-action="asset-preview"
      data-lab-value="${escapeHtml(primaryOutput.id)}"
      title="${escapeHtml(buildLabAssetMetadataTitle(primaryOutput))}"
    >
      &rarr; ${escapeHtml(outputLabel)}
    </button>
  `;
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
                <span class="labx-topbar-actions__content">
                  <span class="labx-topbar-actions__label">${escapeHtml(
      getLabUserActionDisplayText(actionEvent)
    )}</span>
                  ${renderHubActionResult(state, actionEvent)}
                </span>
              </article>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
