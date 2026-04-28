import { escapeHtml } from "../models/lab-types.js";
import type { LabStoreState } from "../models/lab-types.js";
import {
  getExecutionJourneyStep,
  getLaboratoryProcessSummary,
  getRunElapsedSeconds,
  getSourceReady,
  isRunActive,
  isRunComplete,
} from "../runtime/lab-selectors.js";

import { LAB_FALLBACK_I18N } from "./lab-i18n.js";
import type { LabI18n } from "./lab-i18n.js";

function getCurrentRunFromState(state: LabStoreState) {
  return state.run;
}

const PIPELINE_STEPS = ["select", "plan", "evaluate", "decide", "stage"] as const;
const PIPELINE_LABELS_TR = ["Seçim", "Plan", "Değerlendirme", "Karar", "Staging"];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getDotState(
  stepIndex: number,
  journeyStep: number,
  runFailed: boolean,
  failedAtStep: number
): "hollow" | "done" | "active" | "error" {
  if (runFailed && stepIndex === failedAtStep) return "error";
  if (stepIndex < journeyStep) return "done";
  if (stepIndex === journeyStep) return "active";
  return "hollow";
}

function getStripTaskLabel(state: LabStoreState, copy: LabI18n): string {
  const summary = getLaboratoryProcessSummary(state);
  const run = getCurrentRunFromState(state);

  if (run?.state === "failed") {
    return run.error ?? copy.t("mediaAnalysis.strip.failed", "Başarısız");
  }
  if (run?.state === "cancelled") {
    return copy.t("mediaAnalysis.strip.cancelled", "İptal edildi");
  }
  if (run?.emptyReason) {
    return copy.t("mediaAnalysis.strip.empty", "Sonuç boş");
  }
  if ((run?.warnings ?? []).length > 0 && isRunComplete(state) && !isRunActive(state)) {
    return copy.t("mediaAnalysis.strip.partial", "Kısmi sonuç");
  }
  if (isRunComplete(state) && !isRunActive(state)) {
    return copy.t("mediaAnalysis.strip.complete", "Tamamlandı");
  }

  switch (summary.state) {
    case "idle":
      return getSourceReady(state)
        ? copy.t("mediaAnalysis.strip.idle", "Hazır")
        : copy.t("mediaAnalysis.strip.idleNoSource", "Hazır — kaynak bekleniyor");
    case "processing":
      return summary.activeTaskLabel ?? copy.t("mediaAnalysis.strip.processing", "İşleniyor…");
    case "analyzing":
      return summary.activeTaskLabel ?? copy.t("mediaAnalysis.strip.analyzing", "Analiz ediliyor…");
    case "staging":
      return summary.activeTaskLabel ?? copy.t("mediaAnalysis.strip.staging", "Staging hazırlanıyor…");
    default:
      return "";
  }
}

function getStripState(state: LabStoreState): string {
  const run = getCurrentRunFromState(state);
  if (run?.state === "failed") return "error";
  if (run?.state === "cancelled") return "cancelled";
  if (isRunComplete(state) && !isRunActive(state)) return "complete";
  const summary = getLaboratoryProcessSummary(state);
  return summary.state;
}

function renderActionOutputNames(state: LabStoreState, assetIds: string[] | undefined) {
  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    return "";
  }
  const names = assetIds.map(function (assetId) {
    return state.assets.find(function (asset) {
      return asset.id === assetId;
    })?.name ?? assetId;
  });
  const visible = names.slice(0, 2).join(", ");
  const overflow = names.length > 2 ? ` +${String(names.length - 2)}` : "";
  return `${visible}${overflow}`;
}

function renderExpandedStrip(state: LabStoreState, copy: LabI18n) {
  if (state.ui.workspace.processViewActive !== true) {
    return "";
  }
  const recentActions = state.userActions.slice(0, 4);
  const rawLog = (state.run?.rawLog ?? []).slice(-6);
  const actionMarkup =
    recentActions.length > 0
      ? `<ul class="labx-strip-expanded__list">
          ${recentActions
            .map(function (action) {
              const output = renderActionOutputNames(state, action.resultAssetIds);
              return `<li data-status="${escapeHtml(action.status)}"><strong>${escapeHtml(action.label)}</strong><span>${escapeHtml(action.message ?? action.status)}</span>${output !== "" ? `<em>${escapeHtml(output)}</em>` : ""}</li>`;
            })
            .join("")}
        </ul>`
      : `<p>${escapeHtml(copy.t("mediaAnalysis.strip.noRecentActions", "Son işlem yok"))}</p>`;
  const rawLogMarkup =
    rawLog.length > 0
      ? `<ol class="labx-strip-expanded__log">
          ${rawLog
            .map(function (entry) {
              return `<li>${escapeHtml(entry.rawLine ?? entry.message)}</li>`;
            })
            .join("")}
        </ol>`
      : `<p>${escapeHtml(copy.t("mediaAnalysis.strip.noRawLog", "Raw log yok"))}</p>`;

  return `
    <div class="labx-strip-expanded" data-lab-process-expanded="true">
      <section>
        <strong>${escapeHtml(copy.t("mediaAnalysis.strip.recentActions", "Son işlemler"))}</strong>
        ${actionMarkup}
      </section>
      <section>
        <strong>${escapeHtml(copy.t("mediaAnalysis.strip.rawLog", "Raw log"))}</strong>
        ${rawLogMarkup}
      </section>
    </div>
  `;
}

export function renderLabProcessStrip(
  state: LabStoreState,
  copy: LabI18n = LAB_FALLBACK_I18N
) {
  const summary = getLaboratoryProcessSummary(state);
  const journeyStep = getExecutionJourneyStep(state);
  const elapsed = getRunElapsedSeconds(state);
  const runActive = isRunActive(state);
  const runComplete = isRunComplete(state) && !runActive;
  const run = getCurrentRunFromState(state);
  const runFailed = run?.state === "failed";
  const failedAtStep = runFailed ? Math.max(0, journeyStep) : -1;
  const stripState = getStripState(state);
  const taskLabel = getStripTaskLabel(state, copy);

  const progressPercent =
    summary.totalCount > 0
      ? Math.round((summary.completedCount / summary.totalCount) * 100)
      : 0;
  const showProgress = runActive || runComplete || runFailed;
  const showElapsed = runActive || runComplete;

  const dotsMarkup = PIPELINE_STEPS.map(function (key, i) {
    const label = copy.t(
      `mediaAnalysis.strip.steps.${key}`,
      PIPELINE_LABELS_TR[i] ?? key
    );
    const effectiveJourney = runComplete ? PIPELINE_STEPS.length : journeyStep;
    const dotState = getDotState(i, effectiveJourney, runFailed === true, failedAtStep);
    return `
      <div class="labx-strip-step" data-dot="${dotState}">
        <span class="labx-strip-step__dot" aria-hidden="true"></span>
        <span class="labx-strip-step__label">${escapeHtml(label)}</span>
      </div>
    `;
  }).join(`<span class="labx-strip-step__connector" aria-hidden="true"></span>`);

  const progressMarkup = showProgress
    ? `
      <div class="labx-strip-progress">
        <div class="labx-strip-progress__bar">
          <div
            class="labx-strip-progress__fill"
            style="width:${String(runFailed ? progressPercent : runComplete ? 100 : progressPercent)}%"
            data-tone="${runFailed ? "error" : "running"}"
          ></div>
        </div>
        ${summary.totalCount > 0 ? `<span class="labx-strip-progress__pct">${String(progressPercent)}%</span>` : ""}
      </div>
    `
    : "";

  const elapsedMarkup = showElapsed
    ? `<span class="labx-strip-elapsed">${escapeHtml(formatElapsed(elapsed))}</span>`
    : "";

  const retryMarkup = runFailed
    ? `<button class="labx-strip-retry" type="button" data-lab-action="run-deep-analysis">${escapeHtml(copy.t("mediaAnalysis.strip.retry", "Tekrar Dene"))}</button>`
    : "";

  const cancelMarkup = runActive
    ? `<button class="labx-strip-cancel" type="button" data-lab-action="cancel-analysis">${escapeHtml(copy.t("mediaAnalysis.strip.cancel", "Durdur"))}</button>`
    : "";

  const expandMarkup = (runActive || runComplete)
    ? `<button class="labx-strip-expand" type="button" data-lab-action="workspace-process-view-toggled">${escapeHtml(copy.t("mediaAnalysis.strip.log", "Log ▾"))}</button>`
    : "";

  return `
    <footer
      class="labx-process-strip"
      data-strip-state="${escapeHtml(stripState)}"
      aria-label="${escapeHtml(copy.t("mediaAnalysis.strip.ariaLabel", "Process state"))}"
    >
      <div class="labx-strip-pipeline">
        ${dotsMarkup}
      </div>
      <div class="labx-strip-info">
        <span class="labx-strip-task">${escapeHtml(taskLabel)}</span>
        ${progressMarkup}
        ${elapsedMarkup}
      </div>
      <div class="labx-strip-actions">
        ${expandMarkup}
        ${cancelMarkup}
        ${retryMarkup}
      </div>
      ${renderExpandedStrip(state, copy)}
    </footer>
  `;
}
