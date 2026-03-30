export function createLaboratorySubtitleReportStageRuntime(deps: any) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const featureText = deps.featureText;
  const formatStatusLabel = deps.formatStatusLabel;
  const formatDateTime = deps.formatDateTime;
  const getReportFindings = deps.getReportFindings;
  const getReportExports = deps.getReportExports;
  const getProcessModules = deps.getProcessModules;
  const getProcessArtifacts = deps.getProcessArtifacts;
  const getSubtitleProcessModuleLabel = deps.getSubtitleProcessModuleLabel;
  const getSubtitleProcessModuleSummary = deps.getSubtitleProcessModuleSummary;

  function getSubtitleReportModuleFindingCount(moduleId: any) {
    return getReportFindings().filter(function (entry: any) {
      return toRecord(entry).moduleId === moduleId;
    }).length;
  }

  function getSubtitleReportModuleArtifactCount(moduleId: any) {
    return getProcessArtifacts().filter(function (entry: any) {
      return toRecord(entry).moduleId === moduleId;
    }).length;
  }

  function renderSubtitleReportModuleGrid() {
    const modules = getProcessModules();
    if (modules.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "moduleRollupEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "moduleRollupTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "moduleRollupSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${modules
            .map(function (moduleEntry: any) {
              const moduleId = String(moduleEntry.id || "");
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProcessModuleLabel({ id: moduleId }))}</strong>
                      <span>${escapeHtml(formatStatusLabel(moduleEntry.status || "idle"))}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(formatStatusLabel(moduleEntry.status || "idle"))}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(
                    moduleEntry.summary ||
                      getSubtitleProcessModuleSummary({ id: moduleId }) ||
                      featureText(["report", "emptyBody"])
                  )}</p>
                  <ul class="lab-meta-list">
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "status"]))}</span>
                      <strong>${escapeHtml(formatStatusLabel(moduleEntry.status || "idle"))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "findings"]))}</span>
                      <strong>${escapeHtml(String(getSubtitleReportModuleFindingCount(moduleId)))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "artifacts"]))}</span>
                      <strong>${escapeHtml(String(getSubtitleReportModuleArtifactCount(moduleId)))}</strong>
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

  function renderSubtitleReportExportHistoryPanel() {
    const exportsList = getReportExports();
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
            .map(function (entry: any) {
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(entry.fileName || entry.path || "--")}</strong>
                      <span>${escapeHtml(String(entry.format || "md").toUpperCase())}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(formatStatusLabel(entry.status || "ready"))}</span>
                  </div>
                  <ul class="lab-meta-list">
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "format"]))}</span>
                      <strong>${escapeHtml(String(entry.format || "md").toUpperCase())}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "created"]))}</span>
                      <strong>${escapeHtml(formatDateTime(entry.createdAt))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "status"]))}</span>
                      <strong>${escapeHtml(formatStatusLabel(entry.status || "ready"))}</strong>
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

  return {
    renderSubtitleReportExportHistoryPanel,
    renderSubtitleReportModuleGrid,
  };
}
