import { escapeHtml } from "../models/lab-types.js";
import type { LabStageSurface, LabStoreState } from "../models/lab-types.js";
import { getLaboratoryRightPanelContext } from "../runtime/lab-selectors.js";
import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function formatStatus(value: string | null, copy: LabI18n) {
  if (value === null || value === "none") {
    return copy.t("mediaAnalysis.rightContext.status.none", "—");
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

function getCandidateAccent(status: string | null): string {
  switch (status) {
    case "viable":
      return "success";
    case "unstable":
      return "pending";
    case "not-viable":
      return "error";
    default:
      return "none";
  }
}

function getCandidateImplication(status: string | null, copy: LabI18n): string {
  switch (status) {
    case "viable":
      return copy.t("mediaAnalysis.rightContext.implication.candidate.viable", "Structurally viable for execution");
    case "unstable":
      return copy.t("mediaAnalysis.rightContext.implication.candidate.unstable", "Structure incomplete \u2014 needs evaluation");
    case "not-viable":
      return copy.t("mediaAnalysis.rightContext.implication.candidate.notViable", "Not viable \u2014 path requires revision");
    default:
      return copy.t("mediaAnalysis.rightContext.implication.candidate.none", "Awaiting evaluation");
  }
}

function getCommitmentImplication(status: string | null, copy: LabI18n): string {
  switch (status) {
    case "committed":
      return copy.t("mediaAnalysis.rightContext.implication.commitment.committed", "Path selected for staging");
    case "revoked":
      return copy.t("mediaAnalysis.rightContext.implication.commitment.revoked", "Commitment withdrawn");
    default:
      return copy.t("mediaAnalysis.rightContext.implication.commitment.none", "No path committed yet");
  }
}

function getStagingImplication(status: string | null, copy: LabI18n): string {
  switch (status) {
    case "staged":
      return copy.t("mediaAnalysis.rightContext.implication.staging.staged", "Prepared for execution");
    case "not-staged":
      return copy.t("mediaAnalysis.rightContext.implication.staging.notStaged", "Not yet staged");
    default:
      return copy.t("mediaAnalysis.rightContext.implication.staging.none", "Awaiting staging readiness");
  }
}

function renderDecisionSurface(state: LabStoreState, copy: LabI18n) {
  const context = getLaboratoryRightPanelContext(state);
  const processStateLabel = copy.t(
    `mediaAnalysis.processSummary.states.${context.processSummary.state}`,
    context.processSummary.state
  );

  const tier1 = `
    <div class="labx-right-context__tier-1">
      <div class="labx-right-context__item">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.selection", "Selection"))}</span>
        <strong>${escapeHtml(context.selectionRangeLabel ?? copy.t("mediaAnalysis.rightContext.emptySelection", "No active selection"))}</strong>
        ${context.selectionLabel ? `<small>${escapeHtml(context.selectionLabel)}</small>` : ""}
      </div>
      <div class="labx-right-context__item">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.intent", "Intent"))}</span>
        <strong>${escapeHtml(context.activeIntentLabel ?? copy.t("mediaAnalysis.rightContext.emptyIntent", "No intent selected"))}</strong>
      </div>
    </div>
  `;

  const tier2 = `
    <div class="labx-right-context__tier-2">
      <div class="labx-right-context__decision-card" data-accent="${getCandidateAccent(context.candidateStatus)}">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.candidate", "Candidate"))}</span>
        <strong>${escapeHtml(formatStatus(context.candidateStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getCandidateImplication(context.candidateStatus, copy))}</p>
      </div>
      <div class="labx-right-context__decision-card" data-accent="${context.commitmentStatus === "committed" ? "success" : "none"}">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.commitment", "Commitment"))}</span>
        <strong>${escapeHtml(formatStatus(context.commitmentStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getCommitmentImplication(context.commitmentStatus, copy))}</p>
      </div>
      <div class="labx-right-context__decision-card" data-accent="${context.stagingStatus === "staged" ? "staging" : "none"}">
        <span>${escapeHtml(copy.t("mediaAnalysis.rightContext.staging", "Staging"))}</span>
        <strong>${escapeHtml(formatStatus(context.stagingStatus, copy))}</strong>
        <p class="labx-right-context__implication">${escapeHtml(getStagingImplication(context.stagingStatus, copy))}</p>
      </div>
    </div>
  `;

  const processLine = `
    <div class="labx-right-context__process-line">
      <span class="labx-global-process__dot" aria-hidden="true" style="flex-shrink:0"></span>
      <span>${escapeHtml(processStateLabel)}</span>
      ${context.processSummary.progressLabel ? `<span>\u00b7 ${escapeHtml(context.processSummary.progressLabel)}</span>` : ""}
    </div>
  `;

  return `
    <section class="labx-right-context" data-lab-right-context="true">
      <div class="labx-right-context__header">
        <p class="labx-card__eyebrow">${escapeHtml(copy.t("mediaAnalysis.rightContext.eyebrow", "Active state"))}</p>
        <h2>${escapeHtml(copy.t("mediaAnalysis.rightContext.title", "Decision Surface"))}</h2>
      </div>
      ${tier1}
      ${tier2}
      ${processLine}
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
      ? `${renderDecisionSurface(state, copy)}<div class="labx-right-panel__controls">${controls}</div>`
      : renderDecisionSurface(state, copy);
  return `<aside class="labx-right-panel">${content}</aside>`;
}
