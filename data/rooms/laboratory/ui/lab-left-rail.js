import { escapeHtml } from "../models/lab-types.js";
import { getAvailableIntents } from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import { renderLabProjectAssetsPanel } from "./lab-project-assets-panel.js";
import { translateLabRuntimeText } from "./lab-runtime-i18n.js";
function getIntentLabel(intentId, fallback, copy) {
  return copy.t(`mediaAnalysis.workspace.intents.${intentId}.label`, fallback);
}
function getIntentDescription(intentId, fallback, copy) {
  return copy.t(`mediaAnalysis.workspace.intents.${intentId}.description`, fallback);
}
export function renderLabLeftRail(state, copy = LAB_FALLBACK_I18N) {
  const intents = getAvailableIntents(state);
  return `
    <aside class="labx-left-rail">
      <button
        class="labx-manager-link labx-manager-link--compact"
        type="button"
        data-lab-action="toggle-tool-manager"
        data-active="${state.ui.toolManagerOpen ? "true" : "false"}"
      >
        <strong>${escapeHtml(copy.t("mediaAnalysis.leftRail.toolManagement", "Tool Management"))}</strong>
      </button>

      <div class="labx-brand">
        <div>
          <strong>${escapeHtml(copy.t("title", "Laboratory"))}</strong>
          <p>${escapeHtml(copy.t("mediaAnalysis.leftRail.workspaceLabel", "Media workspace"))}</p>
        </div>
      </div>

      ${renderLabProjectAssetsPanel(state, {
    copy,
    includeProjectControls: true,
    variant: "rail"
  })}


      <section class="labx-rail-section">
        <p class="labx-rail-title">${escapeHtml(copy.t("mediaAnalysis.leftRail.intentsTitle", "INTENTS"))}</p>
        <div class="labx-rail-stack">
          ${intents.map(function(intent) {
    const intentLabel = getIntentLabel(intent.id, intent.label, copy);
    const intentDescription = getIntentDescription(intent.id, intent.description, copy);
    const blockReason = intent.blockReason === null ? null : translateLabRuntimeText(intent.blockReason, copy);
    return `
              <button
                class="labx-module-link"
                type="button"
                data-lab-action="workspace-intent-toggle"
                data-lab-value="${escapeHtml(intent.id)}"
                data-active="${intent.selected ? "true" : "false"}"
                ${intent.readiness === "blocked" ? 'data-blocked="true"' : ""}
                title="${blockReason ? escapeHtml(blockReason) : escapeHtml(intentDescription)}"
              >
                <div class="labx-module-link__head">
                  <strong>${escapeHtml(intentLabel)}</strong>
                  ${renderStatusChip(
      intent.readiness === "ready" ? copy.t("mediaAnalysis.leftRail.readiness.readyShort", "OK") : intent.readiness === "optional" ? "△" : "✕",
      intent.readiness === "ready" ? "success" : intent.readiness === "optional" ? "warning" : "error"
    )}
                </div>
                <small>${intent.selected ? escapeHtml(copy.t("mediaAnalysis.leftRail.status.selected", "Selected")) : intent.readiness === "blocked" ? escapeHtml(
      blockReason || copy.t("mediaAnalysis.leftRail.status.unavailable", "Unavailable")
    ) : escapeHtml(copy.t("mediaAnalysis.leftRail.status.available", "Available"))}</small>
              </button>
            `;
  }).join("")}
        </div>
      </section>
    </aside>
  `;
}
