import { escapeHtml } from "../models/lab-types.js";
import type { LabStageSurface, LabStoreState } from "../models/lab-types.js";
import { getLaboratoryRightPanelContext } from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function formatStatus(value: string | null, copy: LabI18n) {
  if (value === null || value === "none") {
    return copy.t("mediaAnalysis.rightContext.status.none", "None");
  }
  return copy.t(
    `mediaAnalysis.rightContext.status.${value}`,
    value
      .split("-")
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ")
  );
}

function renderLiveContext(state: LabStoreState, copy: LabI18n) {
  const context = getLaboratoryRightPanelContext(state);
  const processStateLabel = copy.t(
    `mediaAnalysis.processSummary.states.${context.processSummary.state}`,
    context.processSummary.state
  );
  return `
    <section class="labx-right-context" data-lab-right-context="true">
      <div class="labx-right-context__header">
        <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.rightContext.eyebrow", "Live context"))}</p>
        <h2>${escapeHtml(copy.t("mediaAnalysis.rightContext.title", "Control + context"))}</h2>
      </div>
      <div class="labx-right-context__grid">
        <div class="labx-right-context__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.selection", "Selection"))}</span>
          <strong>${escapeHtml(context.selectionRangeLabel ?? copy.t("mediaAnalysis.rightContext.emptySelection", "No active selection"))}</strong>
          ${context.selectionLabel ? `<small>${escapeHtml(context.selectionLabel)}</small>` : ""}
        </div>
        <div class="labx-right-context__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.intent", "Intent"))}</span>
          <strong>${escapeHtml(context.activeIntentLabel ?? copy.t("mediaAnalysis.rightContext.emptyIntent", "No selected action"))}</strong>
        </div>
        <div class="labx-right-context__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.candidate", "Candidate"))}</span>
          <strong>${escapeHtml(formatStatus(context.candidateStatus, copy))}</strong>
        </div>
        <div class="labx-right-context__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.commitment", "Commitment"))}</span>
          <strong>${escapeHtml(formatStatus(context.commitmentStatus, copy))}</strong>
        </div>
        <div class="labx-right-context__item">
          <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.staging", "Staging"))}</span>
          <strong>${escapeHtml(formatStatus(context.stagingStatus, copy))}</strong>
        </div>
        <div class="labx-right-context__item labx-right-context__item--process">
          <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.process", "Process"))}</span>
          <strong>${escapeHtml(processStateLabel)}</strong>
          ${
            context.processSummary.progressLabel
              ? `<small>${escapeHtml(context.processSummary.progressLabel)}</small>`
              : ""
          }
        </div>
      </div>
    </section>
  `;
}

export function renderLabRightPanel(
  state: LabStoreState,
  surface: LabStageSurface,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const controls = surface.side.trim() !== "" ? surface.side : "";
  const content =
    controls !== ""
      ? `${renderLiveContext(state, copy)}<div class="labx-right-panel__controls">${controls}</div>`
      : `
      ${renderLiveContext(state, copy)}
      <div class="labx-empty-state labx-workspace-empty" style="height: 100%; display: flex; align-items: center; justify-content: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: var(--labx-radius);">
        <div style="text-align: center;">
          <strong class="labx-empty-state__title" style="color: var(--labx-text-dim);">${escapeHtml(copy.t("mediaAnalysis.rightContext.emptyTitle", "Workspace panel"))}</strong>
          <p class="labx-empty-state__description" style="font-size: 0.72rem;">${escapeHtml(copy.t("mediaAnalysis.rightContext.emptyBody", "Load a source to see controls and analysis options."))}</p>
        </div>
      </div>
    `;
  return `<aside class="labx-right-panel">${content}</aside>`;
}
