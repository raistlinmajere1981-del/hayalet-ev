import { createLaboratoryReportStageSupportRuntime } from "./report-stage-support.js";
import { createLaboratorySubtitleReportStageRuntime } from "./report-stage-subtitle.js";
export function createLaboratoryReportStageUi(deps) {
  const featureIds = ["media-analysis", "audio-analysis", "subtitle-analysis"];
  const {
    escapeHtml,
    featureText,
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
    toRecord
  } = deps;
  const laboratoryReportStageSupportRuntime = createLaboratoryReportStageSupportRuntime(deps);
  const laboratorySubtitleReportStageRuntime = createLaboratorySubtitleReportStageRuntime(deps);
  function toFeatureReportRecord(value) {
    return toRecord(value);
  }
  function toAssetRecord(value) {
    return toRecord(value);
  }
  function toSummaryCardRecord(value) {
    return toRecord(value);
  }
  function toExportRecord(value) {
    return toRecord(value);
  }
  function toJobRecord(value) {
    return toRecord(value);
  }
  function toUnknownArray(value) {
    return Array.isArray(value) ? value.map(function(entry) {
      return entry;
    }) : [];
  }
  function getFeatureReportRecord(featureId) {
    const records = toRecord(toRecord(getProjectReport())["records"]);
    return toFeatureReportRecord(records[featureId]);
  }
  function getSelectedFeatureIds() {
    const workbench = toRecord(getWorkbench());
    const selectedFeatureIds = Array.isArray(workbench["selectedModuleIds"]) ? workbench["selectedModuleIds"].filter(function(entry) {
      return typeof entry === "string" && entry.trim() !== "";
    }) : [];
    const activeFeatureId = typeof workbench["activeModuleId"] === "string" && workbench["activeModuleId"].trim() !== "" ? workbench["activeModuleId"] : null;
    if (selectedFeatureIds.length === 0) {
      return activeFeatureId ? [activeFeatureId] : featureIds.slice();
    }
    if (activeFeatureId === null || selectedFeatureIds.includes(activeFeatureId) === false) {
      return selectedFeatureIds;
    }
    return [
      activeFeatureId,
      ...selectedFeatureIds.filter(function(featureId) {
        return featureId !== activeFeatureId;
      })
    ];
  }
  function getWorkbenchFindings() {
    return getSelectedFeatureIds().flatMap(function(featureId) {
      const reportRecord = getFeatureReportRecord(featureId);
      return toUnknownArray(reportRecord["findings"]);
    });
  }
  function getWorkbenchExports() {
    return getSelectedFeatureIds().flatMap(function(featureId) {
      const reportRecord = getFeatureReportRecord(featureId);
      const exports = Array.isArray(reportRecord["exports"]) ? reportRecord["exports"] : [];
      return exports.map(function(entry) {
        return {
          ...toExportRecord(entry),
          featureId
        };
      });
    });
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry) => typeof entry === "string");
  }
  function getRunningReportJob() {
    const runningJob = laboratoryReportStageSupportRuntime.getRunningReportJob();
    return runningJob;
  }
  function renderReportFinding(signal) {
    return laboratoryReportStageSupportRuntime.renderReportFinding(signal);
  }
  function getReportOverviewRows(reportRecord, findings, asset) {
    return laboratoryReportStageSupportRuntime.getReportOverviewRows(
      reportRecord,
      findings,
      asset
    );
  }
  function getReportSideRows(reportRecord, findings, exportsList) {
    return laboratoryReportStageSupportRuntime.getReportSideRows(
      reportRecord,
      findings,
      exportsList
    );
  }
  function renderSubtitleReportModuleGrid() {
    return laboratorySubtitleReportStageRuntime.renderSubtitleReportModuleGrid();
  }
  function renderUnifiedModuleEvidencePanel() {
    const sections = [
      isAudioAnalysisFeature() ? renderAudioAnalysisModuleGrid() : "",
      isSubtitleAnalysisFeature() ? renderSubtitleReportModuleGrid() : ""
    ].filter(function(entry) {
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
  function renderUnifiedExportHistoryPanel(exportsList) {
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
          ${exportsList.slice(0, 6).map(function(entry) {
      const label = typeof entry.fileName === "string" && entry.fileName.trim() !== "" ? entry.fileName : typeof entry.path === "string" && entry.path.trim() !== "" ? entry.path : "--";
      const featureId = typeof entry.featureId === "string" && entry.featureId.trim() !== "" ? entry.featureId : "media-analysis";
      return `<li>${escapeHtml(`${text(["features", featureId])}: ${label}`)}</li>`;
    }).join("")}
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
    const previewUrl = typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== "" ? asset.previewUrl.trim() : null;
    const heroClass = previewUrl ? "lab-panel lab-report-hero" : "lab-panel lab-report-hero lab-report-hero--text-only";
    return `
      <div class="lab-stage-stack">
          ${renderStageIntro("report")}
          <section class="${heroClass}">
            ${previewUrl ? `
                  <div class="lab-report-hero__media">
                    <div class="lab-report-hero__image" style="background-image:url('${escapeHtml(previewUrl)}')"></div>
                  </div>
                ` : ""}
            <div class="lab-report-hero__copy">
              <div class="lab-panel__header">
                <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "overviewTitle"]))}</h2>
              </div>
              ${renderSummaryRows(getReportOverviewRows(reportRecord, findings, asset))}
              <p class="lab-panel__hint">${escapeHtml(featureText(["report", "stagedHint"]))}</p>
            </div>
          </section>
          <section class="lab-signal-grid">
            ${summaryCards.length > 0 ? summaryCards.map(function(card) {
      const value = typeof card.value === "string" || typeof card.value === "number" ? String(card.value) : "--";
      return laboratoryReportStageSupportRuntime.renderSignalCard(
        value,
        laboratoryReportStageSupportRuntime.getReportSignalCardLabel(card)
      );
    }).join("") : `<p class="lab-panel__hint">${escapeHtml(featureText(["report", "emptyFindings"]))}</p>`}
          </section>
          ${renderUnifiedModuleEvidencePanel()}
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "findingsTitle"]))}</p>
            </div>
            <div class="lab-findings">
              ${findings.length > 0 ? findings.map(function(finding) {
      return renderReportFinding(finding);
    }).join("") : `<p class="lab-panel__hint">${escapeHtml(featureText(["report", "emptyBody"]))}</p>`}
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
    const reportWarnings = toStringArray(reportRecord.warnings);
    const reportCaveats = toStringArray(reportRecord.caveats);
    const summaryHint = reportCaveats[0] || reportWarnings[0] || (typeof runningJob.message === "string" && runningJob.message.trim() !== "" ? runningJob.message : "");
    return `
      <div class="lab-stage-stack lab-stage-stack--inspector">
        <section class="lab-panel">
            ${renderSummaryRows(getReportSideRows(reportRecord, findings, exportsList))}
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="reset-journey">
                ${escapeHtml(featureText(["report", "actions", "restart"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="export-report" ${reportRecord.status === "ready" && !getRunningReportJob() ? "" : "disabled"}>
                ${escapeHtml(featureText(["report", "actions", "export"]))}
              </button>
            </div>
            ${summaryHint !== "" ? `<p class="lab-panel__hint">${escapeHtml(summaryHint)}</p>` : ""}
        </section>
      </div>
    `;
  }
  function renderReportStage() {
    return {
      inspector: renderReportInspector(),
      inspectorClassName: "lab-workspace__inspector--report",
      main: renderReportMain(),
      mainClassName: "lab-workspace__main--report"
    };
  }
  return {
    getRunningReportJob,
    renderReportFinding,
    renderReportInspector,
    renderReportMain,
    renderReportStage
  };
}
