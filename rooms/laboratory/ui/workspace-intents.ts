import { escapeHtml } from "../models/lab-types.js";
import type { LabStoreState } from "../models/lab-types.js";
import { getAvailableIntents } from "../runtime/lab-selectors.js";
import { renderStatusChip } from "./components/status-chip.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";
import { translateLabRuntimeText } from "./lab-runtime-i18n.js";

function getReadinessTone(readiness: string) {
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

export function renderWorkspaceIntents(state: LabStoreState, copy: LabI18n = LAB_FALLBACK_I18N) {
  const intents = getAvailableIntents(state);

  return `
    <section class="labx-card labx-intents-card">
      <div class="labx-card__header">
        <div>
          <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.workspaceIntents.eyebrow", "CAPABILITIES"))}</p>
          <h2 class="labx-card__title">${escapeHtml(copy.t("mediaAnalysis.workspaceIntents.title", "What to look for"))}</h2>
        </div>
      </div>
      <div class="labx-card__body">
        <div class="labx-intent-list">
          ${intents
            .map(function (intent) {
              const label = copy.t(
                `mediaAnalysis.workspace.intents.${intent.id}.label`,
                intent.label
              );
              const description = copy.t(
                `mediaAnalysis.workspace.intents.${intent.id}.description`,
                intent.description
              );
              const blockReason = intent.blockReason
                ? translateLabRuntimeText(intent.blockReason, copy)
                : null;
              return `
              <article
                class="labx-intent-item"
                data-readiness="${intent.readiness}"
                data-selected="${intent.selected ? "true" : "false"}"
              >
                <div class="labx-intent-item__head">
                  <strong>${escapeHtml(label)}</strong>
                  ${renderStatusChip(
                    intent.readiness === "ready"
                      ? copy.t("mediaAnalysis.workspaceIntents.readiness.available", "Available")
                      : intent.readiness === "optional"
                        ? copy.t("mediaAnalysis.workspaceIntents.readiness.partial", "Partial")
                        : copy.t(
                            "mediaAnalysis.workspaceIntents.readiness.unavailable",
                            "Unavailable"
                          ),
                    getReadinessTone(intent.readiness)
                  )}
                </div>
                <p class="labx-intent-item__desc">${escapeHtml(description)}</p>
	                ${blockReason ? `<p class="labx-intent-item__reason">${escapeHtml(blockReason)}</p>` : ""}
                <button
                  class="labx-inline-action labx-inline-action--small"
                  type="button"
                  data-lab-action="workspace-intent-toggle"
                  data-lab-value="${escapeHtml(intent.id)}"
                  ${intent.readiness === "blocked" ? "disabled" : ""}
                >
                  ${escapeHtml(
                    intent.selected
                      ? copy.t("mediaAnalysis.workspaceIntents.actions.deselect", "Deselect")
                      : copy.t("mediaAnalysis.workspaceIntents.actions.select", "Select")
                  )}
                </button>
              </article>
            `;
            })
            .join("")}
        </div>
      </div>
    </section>
  `;
}
