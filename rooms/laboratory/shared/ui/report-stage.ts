import { createLaboratoryReportStageSupportRuntime } from "./report-stage-support.js";
import { createLaboratorySubtitleReportStageRuntime } from "./report-stage-subtitle.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryFeatureReportRecord = LaboratoryRecord & {
  caveats?: unknown;
  status?: unknown;
  warnings?: unknown;
};

type LaboratoryAssetRecord = LaboratoryRecord & {
  label?: unknown;
  previewUrl?: unknown;
};

type LaboratorySummaryCardRecord = LaboratoryRecord & {
  label?: unknown;
  labelKey?: unknown;
  value?: unknown;
};

type LaboratoryExportRecord = LaboratoryRecord & {
  fileName?: unknown;
  path?: unknown;
};

type LaboratoryJobRecord = LaboratoryRecord & {
  message?: unknown;
};

type LaboratoryReportStageUiDeps = {
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  formatDateTime: (value: unknown) => string;
  formatDuration: (value: unknown) => string;
  formatStatusLabel: (value: unknown) => string;
  getCurrentFeatureArtifactCount: () => number;
  getCurrentFeatureReportRecord: () => unknown;
  getCurrentFeatureTargetLabel: () => string;
  getCurrentSourceLabel: () => string;
  getEffectiveMediaAsset: () => unknown;
  getFeaturePreviewImage: () => string;
  getPreferredAssetDuration: (asset: LaboratoryAssetRecord) => unknown;
  getProcessArtifacts: () => unknown[];
  getProcessModules: () => unknown[];
  getProfileConfidenceLabel: (confidence: unknown) => string;
  getProfileSignalKindLabel: (kind: unknown) => string;
  getReportExports: () => unknown[];
  getReportFindings: () => unknown[];
  getReportJobs: () => unknown[];
  getReportSummaryCards: () => unknown[];
  getSubtitleProcessModuleLabel: (module: LaboratoryRecord) => string;
  getSubtitleProcessModuleSummary: (module: LaboratoryRecord) => string;
  isAudioAnalysisFeature: () => boolean;
  isSubtitleAnalysisFeature: () => boolean;
  renderAudioAnalysisModuleGrid: () => string;
  renderStageIntro: (stageId: string) => string;
  renderSummaryRows: (rows: Array<[string, string]>) => string;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryReportStageUi(deps: LaboratoryReportStageUiDeps) {
  const {
    escapeHtml,
    featureText,
    getCurrentFeatureReportRecord,
    getEffectiveMediaAsset,
    getFeaturePreviewImage,
    getReportExports,
    getReportFindings,
    getReportSummaryCards,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    renderAudioAnalysisModuleGrid,
    renderStageIntro,
    renderSummaryRows,
    toRecord,
  } = deps;
  const laboratoryReportStageSupportRuntime = createLaboratoryReportStageSupportRuntime(deps);
  const laboratorySubtitleReportStageRuntime = createLaboratorySubtitleReportStageRuntime(deps);

  function toFeatureReportRecord(value: unknown): LaboratoryFeatureReportRecord {
    return toRecord(value);
  }

  function toAssetRecord(value: unknown): LaboratoryAssetRecord {
    return toRecord(value);
  }

  function toSummaryCardRecord(value: unknown): LaboratorySummaryCardRecord {
    return toRecord(value);
  }

  function toExportRecord(value: unknown): LaboratoryExportRecord {
    return toRecord(value);
  }

  function toJobRecord(value: unknown): LaboratoryJobRecord {
    return toRecord(value);
  }

  function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  function getRunningReportJob() {
    const runningJob: unknown = laboratoryReportStageSupportRuntime.getRunningReportJob();
    return runningJob;
  }

  function renderReportFinding(signal: unknown) {
    return laboratoryReportStageSupportRuntime.renderReportFinding(signal);
  }

  function getReportOverviewRows(
    reportRecord: LaboratoryFeatureReportRecord,
    findings: unknown[],
    asset: LaboratoryAssetRecord
  ): [string, string][] {
    return laboratoryReportStageSupportRuntime.getReportOverviewRows(
      reportRecord,
      findings,
      asset
    ) as [string, string][];
  }

  function getReportSideRows(
    reportRecord: LaboratoryFeatureReportRecord,
    findings: unknown[],
    exportsList: LaboratoryExportRecord[]
  ): [string, string][] {
    return laboratoryReportStageSupportRuntime.getReportSideRows(
      reportRecord,
      findings,
      exportsList
    ) as [string, string][];
  }

  function renderSubtitleReportModuleGrid() {
    return laboratorySubtitleReportStageRuntime.renderSubtitleReportModuleGrid();
  }

  function renderSubtitleReportExportHistoryPanel() {
    return laboratorySubtitleReportStageRuntime.renderSubtitleReportExportHistoryPanel();
  }

  function renderReportStage() {
    const reportRecord = toFeatureReportRecord(getCurrentFeatureReportRecord());
    const asset = toAssetRecord(getEffectiveMediaAsset());
    const findings = getReportFindings();
    const summaryCards = getReportSummaryCards().map(toSummaryCardRecord);
    const exportsList = getReportExports().map(toExportRecord);
    const runningJob = toJobRecord(getRunningReportJob());
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
                    .map(function (card) {
                      const value =
                        typeof card.value === "string" || typeof card.value === "number"
                          ? String(card.value)
                          : "--";
                      return laboratoryReportStageSupportRuntime.renderSignalCard(
                        value,
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
                      .map(function (finding) {
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
              toStringArray(reportRecord.caveats).length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "sideTitle"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${toStringArray(reportRecord.caveats)
                        .slice(0, 4)
                        .map(function (entry) {
                          return `<li>${escapeHtml(entry)}</li>`;
                        })
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
            ${
              toStringArray(reportRecord.warnings).length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${toStringArray(reportRecord.warnings)
                        .slice(0, 4)
                        .map(function (entry) {
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
                        .map(function (entry) {
                          const label =
                            typeof entry.fileName === "string" && entry.fileName.trim() !== ""
                              ? entry.fileName
                              : typeof entry.path === "string" && entry.path.trim() !== ""
                                ? entry.path
                                : "--";
                          return `<li>${escapeHtml(label)}</li>`;
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
                reportRecord.status === "ready" && !getRunningReportJob() ? "" : "disabled"
              }>
                ${escapeHtml(featureText(["report", "actions", "export"]))}
              </button>
            </div>
            ${
              typeof runningJob.message === "string" && runningJob.message.trim() !== ""
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
