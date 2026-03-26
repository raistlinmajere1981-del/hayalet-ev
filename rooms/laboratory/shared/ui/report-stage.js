export function createLaboratoryReportStageUi(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const featureText = deps.featureText;
  const renderStageIntro = deps.renderStageIntro;
  const renderSummaryRows = deps.renderSummaryRows;
  const formatStatusLabel = deps.formatStatusLabel;
  const formatDateTime = deps.formatDateTime;
  const formatDuration = deps.formatDuration;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const getCurrentFeatureReportRecord = deps.getCurrentFeatureReportRecord;
  const getEffectiveMediaAsset = deps.getEffectiveMediaAsset;
  const getReportFindings = deps.getReportFindings;
  const getReportSummaryCards = deps.getReportSummaryCards;
  const getReportExports = deps.getReportExports;
  const getReportJobs = deps.getReportJobs;
  const getFeaturePreviewImage = deps.getFeaturePreviewImage;
  const renderAudioAnalysisModuleGrid = deps.renderAudioAnalysisModuleGrid;
  const getProcessModules = deps.getProcessModules;
  const getProcessArtifacts = deps.getProcessArtifacts;
  const getCurrentFeatureArtifactCount = deps.getCurrentFeatureArtifactCount;
  const getCurrentFeatureTargetLabel = deps.getCurrentFeatureTargetLabel;
  const getCurrentSourceLabel = deps.getCurrentSourceLabel;
  const getPreferredAssetDuration = deps.getPreferredAssetDuration;
  const getSubtitleProcessModuleLabel = deps.getSubtitleProcessModuleLabel;
  const getSubtitleProcessModuleSummary = deps.getSubtitleProcessModuleSummary;
  const getProfileSignalKindLabel = deps.getProfileSignalKindLabel;
  const getProfileConfidenceLabel = deps.getProfileConfidenceLabel;

  function getRunningReportJob() {
    return (
      getReportJobs().find(function (job) {
        return !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
      }) || null
    );
  }

  function renderSignalCard(value, label) {
    return `
      <article class="lab-signal-card">
        <strong class="lab-signal-card__value">${escapeHtml(value)}</strong>
        <span class="lab-signal-card__label">${escapeHtml(label)}</span>
      </article>
    `;
  }

  function renderReportFinding(signal) {
    const record = toRecord(signal);
    if (isSubtitleAnalysisFeature()) {
      return `
        <article class="lab-finding">
          <h3 class="lab-finding__title">${escapeHtml(record.title || record.moduleId || "--")}</h3>
          <p class="lab-panel__hint">
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "module"])}: ${getSubtitleProcessModuleLabel({
                id: record.moduleId || record.laneId,
              })}`
            )}
            ·
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "severity"])}: ${formatStatusLabel(record.level || "low")}`
            )}
            ·
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "confidence"])}: ${formatStatusLabel(
                record.confidence || "low"
              )}`
            )}
            ·
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "evidence"])}: ${String(Number(record.evidenceCount) || 0)}`
            )}
            ·
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "artifacts"])}: ${String(
                Array.isArray(record.artifactIds) ? record.artifactIds.length : 0
              )}`
            )}
          </p>
          <p class="lab-finding__detail">${escapeHtml(record.detail || "")}</p>
        </article>
      `;
    }

    return `
      <article class="lab-finding">
        <h3 class="lab-finding__title">${escapeHtml(record.title || record.laneId || "--")}</h3>
        <p class="lab-panel__hint">
          ${escapeHtml(
            `${text(["mediaAnalysis", "profile", "signalMeta", "kind"])}: ${getProfileSignalKindLabel(record.kind)}`
          )}
          ·
          ${escapeHtml(
            `${text(["mediaAnalysis", "profile", "signalMeta", "confidence"])}: ${getProfileConfidenceLabel(
              record.confidence
            )}`
          )}
          ·
          ${escapeHtml(
            `${text(["mediaAnalysis", "profile", "signalMeta", "evidence"])}: ${String(Number(record.evidenceCount) || 0)}`
          )}
        </p>
        <p class="lab-finding__detail">${escapeHtml(record.detail || "")}</p>
      </article>
    `;
  }

  function getSubtitleReportModuleFindingCount(moduleId) {
    return getReportFindings().filter(function (entry) {
      return toRecord(entry).moduleId === moduleId;
    }).length;
  }

  function getSubtitleReportModuleArtifactCount(moduleId) {
    return getProcessArtifacts().filter(function (entry) {
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
            .map(function (moduleEntry) {
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
                    moduleEntry.summary || getSubtitleProcessModuleSummary({ id: moduleId }) || featureText(["report", "emptyBody"])
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
            .map(function (entry) {
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

  function getReportSignalCardLabel(card) {
    return textFromKey(toRecord(card).labelKey || "") || toRecord(card).label || "--";
  }

  function getReportOverviewRows(reportRecord, findings, asset) {
    if (isSubtitleAnalysisFeature()) {
      return [
        [featureText(["report", "overviewMeta", "target"]), getCurrentFeatureTargetLabel()],
        [featureText(["report", "overviewMeta", "status"]), formatStatusLabel(reportRecord.status || "idle")],
        [featureText(["report", "overviewMeta", "findings"]), String(findings.length)],
        [featureText(["report", "overviewMeta", "artifacts"]), String(getCurrentFeatureArtifactCount())],
        [featureText(["report", "overviewMeta", "generated"]), formatDateTime(reportRecord.generatedAt)],
      ];
    }

    return [
      [text(["mediaAnalysis", "shared", "summary"]), asset.label || getCurrentSourceLabel()],
      [text(["mediaAnalysis", "shared", "duration"]), formatDuration(getPreferredAssetDuration(asset))],
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(reportRecord.status || "idle")],
      [featureText(["report", "findingsTitle"]), String(findings.length)],
      [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(getCurrentFeatureArtifactCount())],
    ];
  }

  function getReportSideRows(reportRecord, findings, exportsList) {
    if (isSubtitleAnalysisFeature()) {
      return [
        [featureText(["report", "overviewMeta", "status"]), formatStatusLabel(reportRecord.status || "idle")],
        [featureText(["report", "overviewMeta", "target"]), getCurrentFeatureTargetLabel()],
        [featureText(["report", "overviewMeta", "findings"]), String(findings.length)],
        [featureText(["report", "overviewMeta", "exports"]), String(exportsList.length)],
        [featureText(["report", "overviewMeta", "generated"]), formatDateTime(reportRecord.generatedAt)],
      ];
    }

    return [
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(reportRecord.status || "idle")],
      [text(["mediaAnalysis", "profile", "summary", "target"]), getCurrentFeatureTargetLabel()],
      [featureText(["report", "findingsTitle"]), String(findings.length)],
      [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(getCurrentFeatureArtifactCount())],
      [featureText(["report", "actions", "export"]), String(exportsList.length)],
    ];
  }

  function renderReportStage() {
    const reportRecord = getCurrentFeatureReportRecord();
    const asset = getEffectiveMediaAsset();
    const findings = getReportFindings();
    const summaryCards = getReportSummaryCards();
    const exportsList = getReportExports();
    const runningJob = getRunningReportJob();
    const previewUrl =
      typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== "" ? asset.previewUrl : getFeaturePreviewImage();

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
                      return renderSignalCard(card.value || "--", getReportSignalCardLabel(card));
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
              Array.isArray(reportRecord.caveats) && reportRecord.caveats.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "sideTitle"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${reportRecord.caveats
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
              Array.isArray(reportRecord.warnings) && reportRecord.warnings.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${reportRecord.warnings
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
              runningJob && typeof runningJob.message === "string" && runningJob.message.trim() !== ""
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
