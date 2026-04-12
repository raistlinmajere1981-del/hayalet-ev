export function createLaboratoryProcessStageUi(deps) {
  const featureIds = ["media-analysis", "audio-analysis", "subtitle-analysis"];
  const {
    escapeHtml,
    featureText,
    formatStatusLabel,
    getCurrentFeatureArtifactCount,
    getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord,
    getCurrentFeatureTargetLabel,
    getProjectProcess,
    getProjectReport,
    getProcessFindings,
    getProcessJobs,
    getProcessModules,
    getWorkbench,
    renderStageIntro,
    renderSummaryRows,
    text,
    toRecord
  } = deps;
  function toFeatureProcessRecord(value) {
    return toRecord(value);
  }
  function toProcessModuleRecord(value) {
    return toRecord(value);
  }
  function toJobRecord(value) {
    return toRecord(value);
  }
  function toStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry) => typeof entry === "string");
  }
  function getProcessModulePercent(module) {
    const record = toProcessModuleRecord(module);
    const status = typeof record.status === "string" ? record.status : "idle";
    if (status === "running" || status === "queued" || status === "idle") {
      return Math.max(0, Math.min(100, Math.round(Number(record.percent) || 0)));
    }
    return 100;
  }
  function getProcessModuleTitle(module) {
    const record = toProcessModuleRecord(module);
    return featureText(["process", "moduleTitles", String(record.id || "")]) || String(record["title"] || record.id || "--");
  }
  function getRunningProcessJob() {
    return getProcessJobs().map(toJobRecord).find(function(job) {
      return !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
    }) || null;
  }
  function getFeatureProcessRecord(featureId) {
    const records = toRecord(toRecord(getProjectProcess())["records"]);
    return toFeatureProcessRecord(records[featureId]);
  }
  function getFeatureReportRecord(featureId) {
    const records = toRecord(toRecord(getProjectReport())["records"]);
    return toFeatureProcessRecord(records[featureId]);
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
  function renderFeatureRunMatrix() {
    const selectedFeatureIds = getSelectedFeatureIds();
    return `
      <section class="lab-signal-grid">
        ${selectedFeatureIds.map(function(featureId) {
      const processRecord = getFeatureProcessRecord(featureId);
      const reportRecord = getFeatureReportRecord(featureId);
      const moduleCount = Array.isArray(processRecord.modules) ? processRecord.modules.length : 0;
      const findingCount = Array.isArray(processRecord.findings) ? processRecord.findings.length : 0;
      return `
              <article class="lab-signal-card">
                <strong>${escapeHtml(text(["features", featureId]))}</strong>
                <span>${escapeHtml(formatStatusLabel(processRecord.status || "idle"))}</span>
                <span>${escapeHtml(
        `${String(moduleCount)} ${text(["workbench", "cards", "resultsSuffix"])}`
      )}</span>
                <span>${escapeHtml(
        `${String(findingCount)} ${featureText(["report", "findingsTitle"]).toLowerCase()}`
      )}</span>
                <span>${escapeHtml(formatStatusLabel(reportRecord.status || "idle"))}</span>
              </article>
            `;
    }).join("")}
      </section>
    `;
  }
  function renderProcessStage() {
    const processRecord = toFeatureProcessRecord(getCurrentFeatureProcessRecord());
    const modules = getProcessModules().map(toProcessModuleRecord);
    const runningJob = getRunningProcessJob();
    const findings = getProcessFindings();
    const completedModules = modules.filter(function(entry) {
      return !["idle", "queued", "running"].includes(String(entry.status || ""));
    }).length;
    const reportRecord = toFeatureProcessRecord(getCurrentFeatureReportRecord());
    const selectedFeatureIds = getSelectedFeatureIds();
    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("process")}
          ${renderFeatureRunMatrix()}
          <section class="lab-panel lab-process-panel">
            ${modules.length > 0 ? modules.map(function(moduleEntry, index) {
      const progress = getProcessModulePercent(moduleEntry);
      const summary = typeof moduleEntry.summary === "string" && moduleEntry.summary.trim() !== "" ? moduleEntry.summary : null;
      return `
                        <article class="lab-process-row">
                          <div class="lab-process-row__head">
                            <div>
                              <p class="lab-process-row__eyebrow">${String(index + 1)}</p>
                              <h2 class="lab-process-row__title">${escapeHtml(getProcessModuleTitle(moduleEntry))}</h2>
                            </div>
                            <strong>${escapeHtml(formatStatusLabel(moduleEntry.status))} ${String(progress)}%</strong>
                          </div>
                          <div class="lab-progress-bar lab-progress-bar--wide">
                            <span style="width:${progress}%"></span>
                          </div>
                          ${summary ? `<p class="lab-panel__hint">${escapeHtml(summary)}</p>` : ""}
                        </article>
                      `;
    }).join("") : `<p class="lab-panel__hint">${escapeHtml(featureText(["process", "subtitle"]))}</p>`}
          </section>
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(featureText(["process", "summaryTitle"]))}</p>
            </div>
            ${renderSummaryRows([
      [
        text(["mediaAnalysis", "shared", "status"]),
        formatStatusLabel(processRecord.status || "idle")
      ],
      [
        text(["mediaAnalysis", "profile", "summary", "target"]),
        getCurrentFeatureTargetLabel()
      ],
      [featureText(["report", "findingsTitle"]), String(findings.length)],
      [
        text(["mediaAnalysis", "profile", "summary", "artifacts"]),
        String(getCurrentFeatureArtifactCount())
      ],
      [
        featureText(["settings", "currentStageTitle"]),
        `${String(completedModules)} / ${String(modules.length || 0)}`
      ]
    ])}
            ${toStringArray(processRecord.warnings).length > 0 ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${toStringArray(processRecord.warnings).slice(0, 4).map(function(entry) {
      return `<li>${escapeHtml(entry)}</li>`;
    }).join("")}
                    </ul>
                  </div>
                ` : ""}
            <div class="lab-list-block">
              <strong>${escapeHtml(text(["workbench", "moduleTitle"]))}</strong>
              <ul class="lab-bullet-list">
                ${selectedFeatureIds.map(function(featureId) {
      const featureRecord = getFeatureProcessRecord(featureId);
      return `<li>${escapeHtml(
        `${text(["features", featureId])}: ${formatStatusLabel(
          featureRecord.status || "idle"
        )}`
      )}</li>`;
    }).join("")}
              </ul>
            </div>
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="restart-process">
                ${escapeHtml(featureText(["process", "controls", "restart"]))}
              </button>
              <button class="lab-button lab-button--ghost" type="button" data-action="process-cancel" ${runningJob ? "" : "disabled"}>
                ${escapeHtml(text(["mediaAnalysis", "profile", "actions", "cancel"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="open-report" ${["ready", "stale"].includes(String(reportRecord.status || "")) ? "" : "disabled"}>
                ${escapeHtml(featureText(["process", "controls", "jumpReport"]))}
              </button>
            </div>
            ${runningJob && typeof runningJob.message === "string" && runningJob.message.trim() !== "" ? `<p class="lab-panel__hint">${escapeHtml(runningJob.message)}</p>` : ""}
          </section>
        </aside>
      </div>
    `;
  }
  return {
    getProcessModulePercent,
    getProcessModuleTitle,
    getRunningProcessJob,
    renderProcessStage
  };
}
