export function createLaboratoryReportStageSupportRuntime(deps) {
  const {
    escapeHtml,
    featureText,
    formatDateTime,
    formatDuration,
    formatStatusLabel,
    getCurrentFeatureArtifactCount,
    getCurrentFeatureTargetLabel,
    getCurrentSourceLabel,
    getPreferredAssetDuration,
    getProfileConfidenceLabel,
    getProfileSignalKindLabel,
    getReportJobs,
    getSubtitleProcessModuleLabel,
    isSubtitleAnalysisFeature,
    text,
    textFromKey,
    toRecord
  } = deps;
  function toJobRecord(value) {
    return toRecord(value);
  }
  function toSignalRecord(value) {
    return toRecord(value);
  }
  function toSummaryCardRecord(value) {
    return toRecord(value);
  }
  function toFeatureReportRecord(value) {
    return toRecord(value);
  }
  function toAssetRecord(value) {
    return toRecord(value);
  }
  function toString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function getRunningReportJob() {
    return getReportJobs().map(toJobRecord).find(function(job) {
      return !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
    }) || null;
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
    const record = toSignalRecord(signal);
    if (isSubtitleAnalysisFeature()) {
      const moduleId = toString(record.moduleId) || toString(record.laneId);
      return `
        <article class="lab-finding">
          <h3 class="lab-finding__title">${escapeHtml(toString(record.title) || moduleId || "--")}</h3>
          <p class="lab-panel__hint">
            ${escapeHtml(
        `${featureText(["report", "findingMeta", "module"])}: ${getSubtitleProcessModuleLabel(
          {
            id: moduleId
          }
        )}`
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
          <p class="lab-finding__detail">${escapeHtml(toString(record.detail))}</p>
        </article>
      `;
    }
    return `
      <article class="lab-finding">
        <h3 class="lab-finding__title">${escapeHtml(toString(record.title) || toString(record.laneId) || "--")}</h3>
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
        <p class="lab-finding__detail">${escapeHtml(toString(record.detail))}</p>
      </article>
    `;
  }
  function getReportSignalCardLabel(card) {
    const record = toSummaryCardRecord(card);
    return textFromKey(toString(record.labelKey)) || toString(record.label) || "--";
  }
  function getReportOverviewRows(reportRecord, findings, asset) {
    const report = toFeatureReportRecord(reportRecord);
    const assetRecord = toAssetRecord(asset);
    if (isSubtitleAnalysisFeature()) {
      return [
        [featureText(["report", "overviewMeta", "target"]), getCurrentFeatureTargetLabel()],
        [
          featureText(["report", "overviewMeta", "status"]),
          formatStatusLabel(report.status || "idle")
        ],
        [featureText(["report", "overviewMeta", "findings"]), String(findings.length)],
        [
          featureText(["report", "overviewMeta", "artifacts"]),
          String(getCurrentFeatureArtifactCount())
        ],
        [featureText(["report", "overviewMeta", "generated"]), formatDateTime(report.generatedAt)]
      ];
    }
    return [
      [
        text(["mediaAnalysis", "shared", "summary"]),
        toString(assetRecord.label) || getCurrentSourceLabel()
      ],
      [
        text(["mediaAnalysis", "shared", "duration"]),
        formatDuration(getPreferredAssetDuration(assetRecord))
      ],
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(report.status || "idle")],
      [featureText(["report", "findingsTitle"]), String(findings.length)],
      [
        text(["mediaAnalysis", "profile", "summary", "artifacts"]),
        String(getCurrentFeatureArtifactCount())
      ]
    ];
  }
  function getReportSideRows(reportRecord, _findings, _exportsList) {
    const report = toFeatureReportRecord(reportRecord);
    const exportsList = _exportsList;
    if (isSubtitleAnalysisFeature()) {
      return [
        [
          featureText(["report", "overviewMeta", "status"]),
          formatStatusLabel(report.status || "idle")
        ],
        [featureText(["report", "overviewMeta", "target"]), getCurrentFeatureTargetLabel()],
        [featureText(["report", "overviewMeta", "exports"]), String(exportsList.length)],
        [featureText(["report", "overviewMeta", "generated"]), formatDateTime(report.generatedAt)]
      ];
    }
    return [
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(report.status || "idle")],
      [text(["mediaAnalysis", "profile", "summary", "target"]), getCurrentFeatureTargetLabel()],
      [featureText(["report", "exportHistoryEyebrow"]), String(exportsList.length)],
      [featureText(["report", "overviewMeta", "generated"]), formatDateTime(report.generatedAt)]
    ];
  }
  return {
    getReportOverviewRows,
    getReportSideRows,
    getReportSignalCardLabel,
    getRunningReportJob,
    renderReportFinding,
    renderSignalCard
  };
}
