export function createLaboratoryProcessStageUi(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const featureText = deps.featureText;
  const renderStageIntro = deps.renderStageIntro;
  const renderSummaryRows = deps.renderSummaryRows;
  const formatStatusLabel = deps.formatStatusLabel;
  const getCurrentFeatureProcessRecord = deps.getCurrentFeatureProcessRecord;
  const getProcessModules = deps.getProcessModules;
  const getProcessJobs = deps.getProcessJobs;
  const getProcessFindings = deps.getProcessFindings;
  const getCurrentFeatureTargetLabel = deps.getCurrentFeatureTargetLabel;
  const getCurrentFeatureArtifactCount = deps.getCurrentFeatureArtifactCount;
  const getCurrentFeatureReportRecord = deps.getCurrentFeatureReportRecord;
  function getProcessModulePercent(module) {
    const record = toRecord(module);
    const status = typeof record.status === "string" ? record.status : "idle";
    if (status === "running" || status === "queued" || status === "idle") {
      return Math.max(0, Math.min(100, Math.round(Number(record.percent) || 0)));
    }
    return 100;
  }
  function getProcessModuleTitle(module) {
    const record = toRecord(module);
    return featureText(["process", "moduleTitles", record.id || ""]) || record.title || record.id || "--";
  }
  function getRunningProcessJob() {
    return getProcessJobs().find(function(job) {
      return !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
    }) || null;
  }
  function renderProcessStage() {
    const processRecord = getCurrentFeatureProcessRecord();
    const modules = getProcessModules();
    const runningJob = getRunningProcessJob();
    const findings = getProcessFindings();
    const completedModules = modules.filter(function(entry) {
      return !["idle", "queued", "running"].includes(String(toRecord(entry).status || ""));
    }).length;
    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("process")}
          <section class="lab-panel lab-process-panel">
            ${modules.length > 0 ? modules.map(function(moduleEntry, index) {
      const progress = getProcessModulePercent(moduleEntry);
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
                          ${typeof toRecord(moduleEntry).summary === "string" && toRecord(moduleEntry).summary.trim() !== "" ? `<p class="lab-panel__hint">${escapeHtml(toRecord(moduleEntry).summary)}</p>` : ""}
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
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(processRecord.status || "idle")],
      [text(["mediaAnalysis", "profile", "summary", "target"]), getCurrentFeatureTargetLabel()],
      [featureText(["report", "findingsTitle"]), String(findings.length)],
      [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(getCurrentFeatureArtifactCount())],
      [featureText(["settings", "currentStageTitle"]), `${String(completedModules)} / ${String(modules.length || 0)}`]
    ])}
            ${Array.isArray(processRecord.warnings) && processRecord.warnings.length > 0 ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${processRecord.warnings.slice(0, 4).map(function(entry) {
      return `<li>${escapeHtml(entry)}</li>`;
    }).join("")}
                    </ul>
                  </div>
                ` : ""}
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="restart-process">
                ${escapeHtml(featureText(["process", "controls", "restart"]))}
              </button>
              <button class="lab-button lab-button--ghost" type="button" data-action="process-cancel" ${runningJob ? "" : "disabled"}>
                ${escapeHtml(text(["mediaAnalysis", "profile", "actions", "cancel"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="open-report" ${["ready", "stale"].includes(String(getCurrentFeatureReportRecord().status || "")) ? "" : "disabled"}>
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
