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
  createdAt?: unknown;
  fileName?: unknown;
  featureId?: unknown;
  format?: unknown;
  path?: unknown;
  status?: unknown;
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
    formatDateTime,
    formatStatusLabel,
    getCurrentFeatureReportRecord,
    getEffectiveMediaAsset,
    getProjectReport,
    getWorkbench,
    getReportSummaryCards,
    isAudioAnalysisFeature,
    isSubtitleAnalysisFeature,
    renderAudioAnalysisModuleGrid,
    renderStageIntro,
    renderSummaryRows,
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

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function getExportFileLabel(entry: LaboratoryExportRecord) {
    const fileName = toString(entry.fileName).trim();
    if (fileName !== "") {
      return fileName;
    }

    const exportPath = toString(entry.path).trim();
    if (exportPath === "") {
      return "--";
    }

    const normalizedPath = exportPath.replace(/\\/g, "/");
    const pathParts = normalizedPath.split("/");
    return pathParts[pathParts.length - 1] || exportPath;
  }

  function getExportDirectoryPath(entry: LaboratoryExportRecord) {
    const exportPath = toString(entry.path).trim();
    if (exportPath === "") {
      return "";
    }

    const normalizedPath = exportPath.replace(/\\/g, "/");
    const lastSlashIndex = normalizedPath.lastIndexOf("/");
    return lastSlashIndex > 0 ? normalizedPath.slice(0, lastSlashIndex) : exportPath;
  }

  function getExportTimestamp(entry: LaboratoryExportRecord) {
    const createdAt = toString(entry.createdAt).trim();
    if (createdAt === "") {
      return Number.NEGATIVE_INFINITY;
    }

    const parsed = Date.parse(createdAt);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  }

  function getLatestExport(exportsList: LaboratoryExportRecord[]) {
    return exportsList.reduce<LaboratoryExportRecord | null>(function (latestEntry, entry) {
      if (latestEntry === null) {
        return entry;
      }
      return getExportTimestamp(entry) > getExportTimestamp(latestEntry) ? entry : latestEntry;
    }, null);
  }

  function renderExportCard(
    entry: LaboratoryExportRecord,
    options?: {
      showActions?: boolean;
      showPath?: boolean;
    }
  ) {
    const showActions = options?.showActions === true;
    const showPath = options?.showPath === true;
    const featureId =
      typeof entry.featureId === "string" && entry.featureId.trim() !== ""
        ? entry.featureId
        : "media-analysis";
    const exportPath = toString(entry.path).trim();
    const directoryPath = getExportDirectoryPath(entry);
    const fileLabel = getExportFileLabel(entry);
    const formatLabel = toString(entry.format, "md").toUpperCase();
    const statusLabel = formatStatusLabel(entry.status || "ready");

    return `
      <article class="lab-tool-card lab-report-export-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(fileLabel)}</strong>
            <span>${escapeHtml(text(["features", featureId]))}</span>
          </div>
          <span class="lab-chip">${escapeHtml(formatLabel)}</span>
        </div>
        <ul class="lab-meta-list">
          <li>
            <span>${escapeHtml(featureText(["report", "exportMeta", "created"]))}</span>
            <strong>${escapeHtml(formatDateTime(entry.createdAt))}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "exportMeta", "status"]))}</span>
            <strong>${escapeHtml(statusLabel)}</strong>
          </li>
        </ul>
        ${
          showPath && exportPath !== ""
            ? `
              <div class="lab-report-export__path">
                <span>${escapeHtml(featureText(["report", "exportMeta", "path"]))}</span>
                <code>${escapeHtml(exportPath)}</code>
              </div>
            `
            : ""
        }
        ${
          showActions && exportPath !== ""
            ? `
              <div class="lab-action-stack lab-report-export__actions">
                <button class="lab-button lab-button--ghost" type="button" data-action="report-open-file" data-value="${escapeHtml(exportPath)}">
                  ${escapeHtml(featureText(["report", "actions", "openFile"]))}
                </button>
                <button class="lab-button lab-button--ghost" type="button" data-action="report-open-folder" data-value="${escapeHtml(directoryPath || exportPath)}">
                  ${escapeHtml(featureText(["report", "actions", "openFolder"]))}
                </button>
              </div>
            `
            : ""
        }
      </article>
    `;
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
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "exportHistoryEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "exportHistoryTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "exportHistorySubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${exportsList
            .slice(0, 6)
            .map(function (entry) {
              return renderExportCard(entry);
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderLatestExportPanel(exportsList: LaboratoryExportRecord[]) {
    const latestExport = getLatestExport(exportsList);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "latestExportEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "latestExportTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "latestExportSubtitle"]))}</p>
          </div>
        </div>
        ${
          latestExport
            ? renderExportCard(latestExport, {
                showActions: true,
                showPath: true,
              })
            : `<p class="lab-panel__hint">${escapeHtml(featureText(["report", "latestExportEmpty"]))}</p>`
        }
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
    const heroClass = previewUrl
      ? "lab-panel lab-report-hero"
      : "lab-panel lab-report-hero lab-report-hero--text-only";

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
    const runningReportJob = getRunningReportJob();
    const runningJob = toJobRecord(runningReportJob);
    const reportWarnings = toStringArray(reportRecord.warnings);
    const reportCaveats = toStringArray(reportRecord.caveats);
    const summaryHint =
      reportCaveats[0] ||
      reportWarnings[0] ||
      (typeof runningJob.message === "string" && runningJob.message.trim() !== ""
        ? runningJob.message
        : "");

    return `
      <div class="lab-stage-stack lab-stage-stack--inspector">
        <section class="lab-panel">
            ${renderSummaryRows(getReportSideRows(reportRecord, findings, exportsList))}
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="reset-journey">
                ${escapeHtml(featureText(["report", "actions", "restart"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="export-report" ${
                reportRecord.status === "ready" && !runningReportJob ? "" : "disabled"
              }>
                ${escapeHtml(featureText(["report", "actions", "export"]))}
              </button>
            </div>
            ${summaryHint !== "" ? `<p class="lab-panel__hint">${escapeHtml(summaryHint)}</p>` : ""}
        </section>
        ${renderLatestExportPanel(exportsList)}
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
