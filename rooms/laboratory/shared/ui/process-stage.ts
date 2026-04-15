type LaboratoryRecord = Record<string, unknown>;

type LaboratoryFeatureProcessRecord = LaboratoryRecord & {
  findings?: unknown;
  modules?: unknown;
  status?: unknown;
  warnings?: unknown;
};

type LaboratoryProcessModuleRecord = LaboratoryRecord & {
  id?: unknown;
  percent?: unknown;
  status?: unknown;
  summary?: unknown;
};

type LaboratoryJobRecord = LaboratoryRecord & {
  message?: unknown;
  stage?: unknown;
};

type LaboratoryProcessStageUiDeps = {
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  formatStatusLabel: (value: unknown) => string;
  getCurrentFeatureArtifactCount: () => number;
  getCurrentFeatureProcessRecord: () => unknown;
  getCurrentFeatureReportRecord: () => unknown;
  getCurrentFeatureTargetLabel: () => string;
  getProjectProcess: () => unknown;
  getProjectReport: () => unknown;
  getProcessFindings: () => unknown[];
  getProcessJobs: () => unknown[];
  getProcessModules: () => unknown[];
  getWorkbench: () => unknown;
  renderStageIntro: (stageId: string) => string;
  renderSummaryRows: (rows: Array<[string, string]>) => string;
  text: (path: string[]) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryProcessStageUi(deps: LaboratoryProcessStageUiDeps) {
  const featureIds = ["media-analysis", "audio-analysis", "subtitle-analysis"] as const;
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
    toRecord,
  } = deps;

  function toFeatureProcessRecord(value: unknown): LaboratoryFeatureProcessRecord {
    return toRecord(value);
  }

  function toProcessModuleRecord(value: unknown): LaboratoryProcessModuleRecord {
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

  function getProcessModulePercent(module: unknown) {
    const record = toProcessModuleRecord(module);
    const status = typeof record.status === "string" ? record.status : "idle";
    if (status === "running" || status === "queued" || status === "idle") {
      return Math.max(0, Math.min(100, Math.round(Number(record.percent) || 0)));
    }
    return 100;
  }

  function getProcessModuleTitle(module: unknown) {
    const record = toProcessModuleRecord(module);
    return (
      featureText(["process", "moduleTitles", String(record.id || "")]) ||
      String(record["title"] || record.id || "--")
    );
  }

  function getRunningProcessJob(): LaboratoryJobRecord | null {
    return (
      getProcessJobs()
        .map(toJobRecord)
        .find(function (job) {
          return !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
        }) || null
    );
  }

  function getFeatureProcessRecord(featureId: string): LaboratoryFeatureProcessRecord {
    const records = toRecord(toRecord(getProjectProcess())["records"]);
    return toFeatureProcessRecord(records[featureId]);
  }

  function getFeatureReportRecord(featureId: string): LaboratoryFeatureProcessRecord {
    const records = toRecord(toRecord(getProjectReport())["records"]);
    return toFeatureProcessRecord(records[featureId]);
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

  function renderFeatureRunMatrix() {
    const selectedFeatureIds = getSelectedFeatureIds();
    return `
      <section class="lab-signal-grid">
        ${selectedFeatureIds
          .map(function (featureId) {
            const processRecord = getFeatureProcessRecord(featureId);
            const reportRecord = getFeatureReportRecord(featureId);
            const moduleCount = Array.isArray(processRecord.modules)
              ? processRecord.modules.length
              : 0;
            const findingCount = Array.isArray(processRecord.findings)
              ? processRecord.findings.length
              : 0;
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
          })
          .join("")}
      </section>
    `;
  }

  function renderProcessMain() {
    const processRecord = toFeatureProcessRecord(getCurrentFeatureProcessRecord());
    const modules = getProcessModules().map(toProcessModuleRecord);
    const runningJob = getRunningProcessJob();
    const findings = getProcessFindings();
    const queueSummary =
      runningJob && typeof runningJob.message === "string" && runningJob.message.trim() !== ""
        ? runningJob.message
        : featureText(["process", "subtitle"]);

    return `
      <div class="lab-stage-stack">
          ${renderStageIntro("process")}
          <section class="lab-panel lab-panel--orientation">
            <div class="lab-orientation__header">
              <div class="lab-orientation__intro">
                <p class="lab-panel__eyebrow">${escapeHtml(featureText(["process", "summaryTitle"]))}</p>
                <h2 class="lab-panel__title">${escapeHtml(getCurrentFeatureTargetLabel())}</h2>
                <p class="lab-panel__subtitle">${escapeHtml(queueSummary)}</p>
              </div>
              <div class="lab-orientation__metrics">
                ${renderSummaryRows([
                  [
                    text(["mediaAnalysis", "shared", "status"]),
                    formatStatusLabel(processRecord.status || "idle"),
                  ],
                  [featureText(["report", "findingsTitle"]), String(findings.length)],
                  [
                    text(["mediaAnalysis", "profile", "summary", "artifacts"]),
                    String(getCurrentFeatureArtifactCount()),
                  ],
                ])}
              </div>
            </div>
          </section>
          ${renderFeatureRunMatrix()}
          <section class="lab-panel lab-process-panel">
            <div class="lab-panel__header">
              <div>
                <p class="lab-panel__eyebrow">${escapeHtml(featureText(["process", "currentStageTitle"]))}</p>
                <h2 class="lab-panel__title">${escapeHtml(featureText(["process", "summaryTitle"]))}</h2>
              </div>
            </div>
            <div class="lab-process-panel__body">
              ${
                modules.length > 0
                  ? modules
                      .map(function (moduleEntry, index) {
                        const progress = getProcessModulePercent(moduleEntry);
                        const summary =
                          typeof moduleEntry.summary === "string" &&
                          moduleEntry.summary.trim() !== ""
                            ? moduleEntry.summary
                            : null;
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
                      })
                      .join("")
                  : `<p class="lab-panel__hint">${escapeHtml(featureText(["process", "subtitle"]))}</p>`
              }
            </div>
          </section>
      </div>
    `;
  }

  function renderProcessInspector() {
    const processRecord = toFeatureProcessRecord(getCurrentFeatureProcessRecord());
    const modules = getProcessModules().map(toProcessModuleRecord);
    const findings = getProcessFindings();
    const completedModules = modules.filter(function (entry) {
      return !["idle", "queued", "running"].includes(String(entry.status || ""));
    }).length;
    const reportRecord = toFeatureProcessRecord(getCurrentFeatureReportRecord());
    const runningJob = getRunningProcessJob();
    const processWarnings = toStringArray(processRecord.warnings);
    const inspectorHint =
      (runningJob && typeof runningJob.message === "string" && runningJob.message.trim() !== ""
        ? runningJob.message
        : null) ||
      processWarnings[0] ||
      "";

    return `
      <div class="lab-stage-stack lab-stage-stack--inspector">
        <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(featureText(["process", "summaryTitle"]))}</p>
            </div>
            ${renderSummaryRows([
              [
                text(["mediaAnalysis", "shared", "status"]),
                formatStatusLabel(processRecord.status || "idle"),
              ],
              [
                text(["mediaAnalysis", "profile", "summary", "target"]),
                getCurrentFeatureTargetLabel(),
              ],
              [featureText(["report", "findingsTitle"]), String(findings.length)],
              [
                text(["mediaAnalysis", "profile", "summary", "artifacts"]),
                String(getCurrentFeatureArtifactCount()),
              ],
              [
                featureText(["settings", "currentStageTitle"]),
                `${String(completedModules)} / ${String(modules.length || 0)}`,
              ],
            ])}
            <div class="lab-action-stack">
              <button class="lab-button lab-button--primary" type="button" data-action="restart-process">
                ${escapeHtml(featureText(["process", "controls", "restart"]))}
              </button>
              <button class="lab-button lab-button--ghost" type="button" data-action="process-cancel" ${
                runningJob ? "" : "disabled"
              }>
                ${escapeHtml(text(["mediaAnalysis", "profile", "actions", "cancel"]))}
              </button>
              <button class="lab-button lab-button--ghost" type="button" data-action="open-report" ${
                ["ready", "stale"].includes(String(reportRecord.status || "")) ? "" : "disabled"
              }>
                ${escapeHtml(featureText(["process", "controls", "jumpReport"]))}
              </button>
            </div>
            ${
              inspectorHint !== ""
                ? `<p class="lab-panel__hint">${escapeHtml(inspectorHint)}</p>`
                : ""
            }
        </section>
      </div>
    `;
  }

  function renderProcessStage() {
    return {
      inspector: renderProcessInspector(),
      inspectorClassName: "lab-workspace__inspector--process",
      main: renderProcessMain(),
      mainClassName: "lab-workspace__main--process",
    };
  }

  return {
    getProcessModulePercent,
    getProcessModuleTitle,
    getRunningProcessJob,
    renderProcessInspector,
    renderProcessMain,
    renderProcessStage,
  };
}
