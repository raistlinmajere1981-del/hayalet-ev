import { createLaboratoryReportStageSupportRuntime } from "./report-stage-support.js";
import { createLaboratorySubtitleReportStageRuntime } from "./report-stage-subtitle.js";

export function createLaboratoryReportStageUi(deps: any) {
  const escapeHtml = deps.escapeHtml;
  const featureText = deps.featureText;
  const renderStageIntro = deps.renderStageIntro;
  const renderSummaryRows = deps.renderSummaryRows;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const getCurrentFeatureReportRecord = deps.getCurrentFeatureReportRecord;
  const getEffectiveMediaAsset = deps.getEffectiveMediaAsset;
  const getReportFindings = deps.getReportFindings;
  const getReportSummaryCards = deps.getReportSummaryCards;
  const getReportExports = deps.getReportExports;
  const getFeaturePreviewImage = deps.getFeaturePreviewImage;
  const renderAudioAnalysisModuleGrid = deps.renderAudioAnalysisModuleGrid;
  const laboratoryReportStageSupportRuntime = createLaboratoryReportStageSupportRuntime(deps);
  const laboratorySubtitleReportStageRuntime = createLaboratorySubtitleReportStageRuntime(deps);

  function getRunningReportJob() {
    return laboratoryReportStageSupportRuntime.getRunningReportJob();
  }

  function renderReportFinding(signal: any) {
    return laboratoryReportStageSupportRuntime.renderReportFinding(signal);
  }

  function getReportOverviewRows(reportRecord: any, findings: any, asset: any) {
    return laboratoryReportStageSupportRuntime.getReportOverviewRows(reportRecord, findings, asset);
  }

  function getReportSideRows(reportRecord: any, findings: any, exportsList: any) {
    return laboratoryReportStageSupportRuntime.getReportSideRows(
      reportRecord,
      findings,
      exportsList
    );
  }

  function renderSubtitleReportModuleGrid() {
    return laboratorySubtitleReportStageRuntime.renderSubtitleReportModuleGrid();
  }

  function renderSubtitleReportExportHistoryPanel() {
    return laboratorySubtitleReportStageRuntime.renderSubtitleReportExportHistoryPanel();
  }

  function renderReportStage() {
    const reportRecord = getCurrentFeatureReportRecord();
    const asset = getEffectiveMediaAsset();
    const findings = getReportFindings();
    const summaryCards = getReportSummaryCards();
    const exportsList = getReportExports();
    const runningJob = getRunningReportJob();
    const previewUrl =
      typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== ""
        ? asset.previewUrl
        : getFeaturePreviewImage();

    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("report")}
          <section class="lab-panel lab-report-hero">
            <div class="lab-report-hero__media">
              <img class="lab-report-hero__image" src="${previewUrl}" alt="" />
            </div>
            <div class="lab-report-hero__copy">
              <div class="lab-panel__header">
                <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "overviewTitle"]))}</h2>
              </div>
              ${renderSummaryRows(getReportOverviewRows(reportRecord, findings, asset))}
              <p class="lab-panel__hint">${escapeHtml(featureText(["report", "stagedHint"]))}</p>
            </div>
          </section>
          <section class="lab-signal-grid">
            ${
              summaryCards.length > 0
                ? summaryCards
                    .map(function (card: any) {
                      return laboratoryReportStageSupportRuntime.renderSignalCard(
                        card.value || "--",
                        laboratoryReportStageSupportRuntime.getReportSignalCardLabel(card)
                      );
                    })
                    .join("")
                : `<p class="lab-panel__hint">${escapeHtml(featureText(["report", "emptyFindings"]))}</p>`
            }
          </section>
          ${isAudioAnalysisFeature() ? renderAudioAnalysisModuleGrid() : ""}
          ${isSubtitleAnalysisFeature() ? renderSubtitleReportModuleGrid() : ""}
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "findingsTitle"]))}</p>
            </div>
            <div class="lab-findings">
              ${
                findings.length > 0
                  ? findings
                      .map(function (finding: any) {
                        return renderReportFinding(finding);
                      })
                      .join("")
                  : `<p class="lab-panel__hint">${escapeHtml(featureText(["report", "emptyBody"]))}</p>`
              }
            </div>
          </section>
          ${isSubtitleAnalysisFeature() ? renderSubtitleReportExportHistoryPanel() : ""}
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            ${renderSummaryRows(getReportSideRows(reportRecord, findings, exportsList))}
            ${
              Array.isArray(reportRecord.caveats) && reportRecord.caveats.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "sideTitle"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${reportRecord.caveats
                        .slice(0, 4)
                        .map(function (entry: any) {
                          return `<li>${escapeHtml(entry)}</li>`;
                        })
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
            ${
              Array.isArray(reportRecord.warnings) && reportRecord.warnings.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${reportRecord.warnings
                        .slice(0, 4)
                        .map(function (entry: any) {
                          return `<li>${escapeHtml(entry)}</li>`;
                        })
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
            ${
              exportsList.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "actions", "export"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${exportsList
                        .slice(0, 4)
                        .map(function (entry: any) {
                          return `<li>${escapeHtml(entry.fileName || entry.path || "--")}</li>`;
                        })
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="reset-journey">
                ${escapeHtml(featureText(["report", "actions", "restart"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="export-report" ${
                reportRecord.status === "ready" && !runningJob ? "" : "disabled"
              }>
                ${escapeHtml(featureText(["report", "actions", "export"]))}
              </button>
            </div>
            ${
              runningJob &&
              typeof runningJob.message === "string" &&
              runningJob.message.trim() !== ""
                ? `<p class="lab-panel__hint">${escapeHtml(runningJob.message)}</p>`
                : ""
            }
          </section>
        </aside>
      </div>
    `;
  }

  return {
    getRunningReportJob: getRunningReportJob,
    renderReportFinding: renderReportFinding,
    renderReportStage: renderReportStage,
  };
}
