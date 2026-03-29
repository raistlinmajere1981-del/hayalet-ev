// @ts-nocheck
export function createLaboratoryReportStageSupportRuntime(deps) {
  const toRecord = deps.toRecord;
  const escapeHtml = deps.escapeHtml;
  const text = deps.text;
  const textFromKey = deps.textFromKey;
  const featureText = deps.featureText;
  const formatStatusLabel = deps.formatStatusLabel;
  const formatDateTime = deps.formatDateTime;
  const formatDuration = deps.formatDuration;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const getReportJobs = deps.getReportJobs;
  const getReportFindings = deps.getReportFindings;
  const getCurrentFeatureArtifactCount = deps.getCurrentFeatureArtifactCount;
  const getCurrentFeatureTargetLabel = deps.getCurrentFeatureTargetLabel;
  const getCurrentSourceLabel = deps.getCurrentSourceLabel;
  const getPreferredAssetDuration = deps.getPreferredAssetDuration;
  const getSubtitleProcessModuleLabel = deps.getSubtitleProcessModuleLabel;
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

  return {
    getReportOverviewRows,
    getReportSideRows,
    getReportSignalCardLabel,
    getRunningReportJob,
    renderReportFinding,
    renderSignalCard,
  };
}
