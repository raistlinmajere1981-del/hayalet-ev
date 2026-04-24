import { escapeHtml } from "../models/lab-types.js";
import { getAvailableIntents } from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";
import { renderLabProjectAssetsPanel } from "./lab-project-assets-panel.js";
export function renderLabLeftRail(state) {
  const intents = getAvailableIntents(state);
  return `
    <aside class="labx-left-rail">
      <button
        class="labx-manager-link labx-manager-link--compact"
        type="button"
        data-lab-action="toggle-tool-manager"
        data-active="${state.ui.toolManagerOpen ? "true" : "false"}"
      >
        <strong>Tool Management</strong>
      </button>

      <div class="labx-brand">
        <div>
          <strong>Laboratory</strong>
          <p>Media workspace</p>
        </div>
      </div>

      ${renderLabProjectAssetsPanel(state, { includeProjectControls: true, variant: "rail" })}


      <section class="labx-rail-section">
        <p class="labx-rail-title">INTENTS</p>
        <div class="labx-rail-stack">
          ${intents.map(function(intent) {
    return `
              <button
                class="labx-module-link"
                type="button"
                data-lab-action="workspace-intent-toggle"
                data-lab-value="${escapeHtml(intent.id)}"
                data-active="${intent.selected ? "true" : "false"}"
                ${intent.readiness === "blocked" ? 'data-blocked="true"' : ""}
                title="${intent.blockReason ? escapeHtml(intent.blockReason) : escapeHtml(intent.description)}"
              >
                <div class="labx-module-link__head">
                  <strong>${escapeHtml(intent.label)}</strong>
                  ${renderStatusChip(
      intent.readiness === "ready" ? "OK" : intent.readiness === "optional" ? "△" : "✕",
      intent.readiness === "ready" ? "success" : intent.readiness === "optional" ? "warning" : "error"
    )}
                </div>
                <small>${intent.selected ? "Selected" : intent.readiness === "blocked" ? escapeHtml(intent.blockReason || "Unavailable") : "Available"}</small>
              </button>
            `;
  }).join("")}
        </div>
      </section>
    </aside>
  `;
}
