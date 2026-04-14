import { createLaboratoryReportStageSupportRuntime } from "./report-stage-support.js";
import { createLaboratorySubtitleReportStageRuntime } from "./report-stage-subtitle.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryFeatureReportRecord = LaboratoryRecord & {
  caveats?: unknown;
  exports?: unknown;
  findings?: unknown;
  status?: unknown;
  warnings?: unknown;
};

type LaboratoryFeatureProcessRecord = LaboratoryRecord & {
  modules?: unknown;
  status?: unknown;
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
  featureId?: unknown;
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
  getProjectProcess: () => unknown;
  getProjectReport: () => unknown;
  getWorkbench: () => unknown;
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
  const featureIds = ["media-analysis", "audio-analysis", "subtitle-analysis"] as const;
  const {
    escapeHtml,
    featureText,
    getCurrentFeatureReportRecord,
    getEffectiveMediaAsset,
    getProjectProcess,
    getProjectReport,
    getWorkbench,
    getReportSummaryCards,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    renderAudioAnalysisModuleGrid,
    renderStageIntro,
    renderSummaryRows,
    formatStatusLabel,
    text,
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

  function toUnknownArray(value: unknown): unknown[] {
    return Array.isArray(value)
      ? value.map(function (entry): unknown {
          return entry;
        })
      : [];
  }

  function getFeatureProcessRecord(featureId: string): LaboratoryFeatureProcessRecord {
    const records = toRecord(toRecord(getProjectProcess())["records"]);
    return toRecord(records[featureId]);
  }

  function getFeatureReportRecord(featureId: string): LaboratoryFeatureReportRecord {
    const records = toRecord(toRecord(getProjectReport())["records"]);
    return toFeatureReportRecord(records[featureId]);
  }

  function getSelectedFeatureIds() {
    const workbench = toRecord(getWorkbench());
    const selectedFeatureIds = Array.isArray(workbench["selectedModuleIds"])
      ? workbench["selectedModuleIds"].filter(function (entry): entry is string {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [];
    const activeFeatureId =
      typeof workbench["activeModuleId"] === "string" && workbench["activeModuleId"].trim() !== ""
        ? workbench["activeModuleId"]
        : null;

    if (selectedFeatureIds.length === 0) {
      return activeFeatureId ? [activeFeatureId] : featureIds.slice();
    }

    if (activeFeatureId === null || selectedFeatureIds.includes(activeFeatureId) === false) {
      return selectedFeatureIds;
    }

    return [
      activeFeatureId,
      ...selectedFeatureIds.filter(function (featureId) {
        return featureId !== activeFeatureId;
      }),
    ];
  }

  function getWorkbenchFindings(): unknown[] {
    return getSelectedFeatureIds().flatMap(function (featureId) {
      const reportRecord = getFeatureReportRecord(featureId);
      return toUnknownArray(reportRecord["findings"]);
    });
  }

  function getWorkbenchExports(): LaboratoryExportRecord[] {
    return getSelectedFeatureIds().flatMap(function (featureId) {
      const reportRecord = getFeatureReportRecord(featureId);
      const exports = Array.isArray(reportRecord["exports"]) ? reportRecord["exports"] : [];
      return exports.map(function (entry) {
        return {
          ...toExportRecord(entry),
          featureId,
        };
      });
    });
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

  function renderWorkbenchReportMatrix() {
    const selectedFeatureIds = getSelectedFeatureIds();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "sideTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["workbench", "moduleRailLabel"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(text(["workbench", "stages", "report", "subtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${selectedFeatureIds
            .map(function (featureId) {
              const processRecord = getFeatureProcessRecord(featureId);
              const reportRecord = getFeatureReportRecord(featureId);
              const moduleCount = Array.isArray(processRecord["modules"])
                ? processRecord["modules"].length
                : 0;
              const findingCount = Array.isArray(reportRecord["findings"])
                ? reportRecord["findings"].length
                : 0;
              const exportCount = Array.isArray(reportRecord["exports"])
                ? reportRecord["exports"].length
                : 0;
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(text(["features", featureId]))}</strong>
                      <span>${escapeHtml(formatStatusLabel(reportRecord["status"] || "idle"))}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(formatStatusLabel(processRecord["status"] || "idle"))}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(text(["workbench", "modules", featureId, "summary"]))}</p>
                  <ul class="lab-meta-list">
                    <li>
                      <span>${escapeHtml(text(["mediaAnalysis", "shared", "status"]))}</span>
                      <strong>${escapeHtml(formatStatusLabel(reportRecord["status"] || "idle"))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "findingsTitle"]))}</span>
                      <strong>${escapeHtml(String(findingCount))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "actions", "export"]))}</span>
                      <strong>${escapeHtml(String(exportCount))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "artifacts"]))}</span>
                      <strong>${escapeHtml(String(moduleCount))}</strong>
                    </li>
                  </ul>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderUnifiedModuleEvidencePanel() {
    const sections = [
      isAudioAnalysisFeature() ? renderAudioAnalysisModuleGrid() : "",
      isSubtitleAnalysisFeature() ? renderSubtitleReportModuleGrid() : "",
    ].filter(function (entry) {
      return entry.trim() !== "";
    });

    if (sections.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["workbench", "moduleRailLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "moduleMeta", "artifacts"]))}</h2>
          </div>
        </div>
        ${sections.join("")}
      </section>
    `;
  }

  function renderUnifiedExportHistoryPanel(exportsList: LaboratoryExportRecord[]) {
    if (exportsList.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "actions", "export"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "sideTitle"]))}</h2>
          </div>
        </div>
        <ul class="lab-bullet-list">
          ${exportsList
            .slice(0, 6)
            .map(function (entry) {
              const label =
                typeof entry.fileName === "string" && entry.fileName.trim() !== ""
                  ? entry.fileName
                  : typeof entry.path === "string" && entry.path.trim() !== ""
                    ? entry.path
                    : "--";
              const featureId =
                typeof entry.featureId === "string" && entry.featureId.trim() !== ""
                  ? entry.featureId
                  : "media-analysis";
              return `<li>${escapeHtml(`${text(["features", featureId])}: ${label}`)}</li>`;
            })
            .join("")}
        </ul>
      </section>
    `;
  }

  function renderReportMain() {
    const reportRecord = toFeatureReportRecord(getCurrentFeatureReportRecord());
    const asset = toAssetRecord(getEffectiveMediaAsset());
    const findings = getWorkbenchFindings();
    const summaryCards = getReportSummaryCards().map(toSummaryCardRecord);
    const exportsList = getWorkbenchExports();
    const previewUrl =
      typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== ""
        ? asset.previewUrl.trim()
        : null;
    const heroClass = previewUrl ? "lab-panel lab-report-hero" : "lab-panel lab-report-hero lab-report-hero--text-only";

    return `
      <div class="lab-stage-stack">
          ${renderStageIntro("report")}
          <section class="${heroClass}">
            ${
              previewUrl
                ? `
                  <div class="lab-report-hero__media">
                    <div class="lab-report-hero__image" style="background-image:url('${escapeHtml(previewUrl)}')"></div>
                  </div>
                `
                : ""
            }
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
          ${renderUnifiedModuleEvidencePanel()}
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
          ${renderUnifiedExportHistoryPanel(exportsList)}
      </div>
    `;
  }

  function renderReportInspector() {
    const reportRecord = toFeatureReportRecord(getCurrentFeatureReportRecord());
    const findings = getWorkbenchFindings();
    const exportsList = getWorkbenchExports();
    const runningJob = toJobRecord(getRunningReportJob());

    return `
      <div class="lab-stage-stack lab-stage-stack--inspector">
        ${renderWorkbenchReportMatrix()}
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
            <div class="lab-list-block">
              <strong>${escapeHtml(text(["workbench", "moduleRailLabel"]))}</strong>
              <ul class="lab-bullet-list">
                ${featureIds
                  .map(function (featureId) {
                    const featureRecord = getFeatureReportRecord(featureId);
                    const findingCount = Array.isArray(featureRecord["findings"])
                      ? featureRecord["findings"].length
                      : 0;
                    return `<li>${escapeHtml(
                      `${text(["features", featureId])}: ${formatStatusLabel(
                        featureRecord["status"] || "idle"
                      )} · ${String(findingCount)} ${featureText(["report", "findingsTitle"]).toLowerCase()}`
                    )}</li>`;
                  })
                  .join("")}
              </ul>
            </div>
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
      </div>
    `;
  }

  function renderReportStage() {
    return {
      inspector: renderReportInspector(),
      inspectorClassName: "lab-workspace__inspector--report",
      main: renderReportMain(),
      mainClassName: "lab-workspace__main--report",
    };
  }

  return {
    getRunningReportJob: getRunningReportJob,
    renderReportFinding: renderReportFinding,
    renderReportInspector,
    renderReportMain,
    renderReportStage: renderReportStage,
  };
}
