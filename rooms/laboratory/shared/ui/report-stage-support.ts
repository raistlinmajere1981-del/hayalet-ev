type LaboratoryRecord = Record<string, unknown>;

type LaboratoryJobRecord = LaboratoryRecord & {
  stage?: unknown;
};

type LaboratorySignalRecord = LaboratoryRecord & {
  artifactIds?: unknown;
  confidence?: unknown;
  detail?: unknown;
  evidenceCount?: unknown;
  kind?: unknown;
  laneId?: unknown;
  level?: unknown;
  moduleId?: unknown;
  title?: unknown;
};

type LaboratorySummaryCardRecord = LaboratoryRecord & {
  label?: unknown;
  labelKey?: unknown;
};

type LaboratoryFeatureReportRecord = LaboratoryRecord & {
  generatedAt?: unknown;
  status?: unknown;
};

type LaboratoryAssetRecord = LaboratoryRecord & {
  label?: unknown;
};

type LaboratoryReportStageSupportRuntimeDeps = {
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  formatDateTime: (value: unknown) => string;
  formatDuration: (value: unknown) => string;
  formatStatusLabel: (value: unknown) => string;
  getCurrentFeatureArtifactCount: () => number;
  getCurrentFeatureTargetLabel: () => string;
  getCurrentSourceLabel: () => string;
  getPreferredAssetDuration: (asset: LaboratoryAssetRecord) => unknown;
  getProfileConfidenceLabel: (confidence: unknown) => string;
  getProfileSignalKindLabel: (kind: unknown) => string;
  getReportJobs: () => unknown[];
  getSubtitleProcessModuleLabel: (module: LaboratoryRecord) => string;
  isSubtitleAnalysisFeature: () => boolean;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryReportStageSupportRuntime(
  deps: LaboratoryReportStageSupportRuntimeDeps
) {
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
    toRecord,
  } = deps;

  function toJobRecord(value: unknown): LaboratoryJobRecord {
    return toRecord(value);
  }

  function toSignalRecord(value: unknown): LaboratorySignalRecord {
    return toRecord(value);
  }

  function toSummaryCardRecord(value: unknown): LaboratorySummaryCardRecord {
    return toRecord(value);
  }

  function toFeatureReportRecord(value: unknown): LaboratoryFeatureReportRecord {
    return toRecord(value);
  }

  function toAssetRecord(value: unknown): LaboratoryAssetRecord {
    return toRecord(value);
  }

  function toString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }

  function getRunningReportJob(): LaboratoryJobRecord | null {
    return (
      getReportJobs()
        .map(toJobRecord)
        .find(function (job) {
          return !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
        }) || null
    );
  }

  function renderSignalCard(value: string, label: string) {
    return `
      <article class="lab-signal-card">
        <strong class="lab-signal-card__value">${escapeHtml(value)}</strong>
        <span class="lab-signal-card__label">${escapeHtml(label)}</span>
      </article>
    `;
  }

  function renderReportFinding(signal: unknown) {
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
                  id: moduleId,
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

  function getReportSignalCardLabel(card: unknown) {
    const record = toSummaryCardRecord(card);
    return textFromKey(toString(record.labelKey)) || toString(record.label) || "--";
  }

  function getReportOverviewRows(reportRecord: unknown, findings: unknown[], asset: unknown) {
    const report = toFeatureReportRecord(reportRecord);
    const assetRecord = toAssetRecord(asset);
    if (isSubtitleAnalysisFeature()) {
      return [
        [featureText(["report", "overviewMeta", "target"]), getCurrentFeatureTargetLabel()],
        [
          featureText(["report", "overviewMeta", "status"]),
          formatStatusLabel(report.status || "idle"),
        ],
        [featureText(["report", "overviewMeta", "findings"]), String(findings.length)],
        [
          featureText(["report", "overviewMeta", "artifacts"]),
          String(getCurrentFeatureArtifactCount()),
        ],
        [featureText(["report", "overviewMeta", "generated"]), formatDateTime(report.generatedAt)],
      ];
    }

    return [
      [
        text(["mediaAnalysis", "shared", "summary"]),
        toString(assetRecord.label) || getCurrentSourceLabel(),
      ],
      [
        text(["mediaAnalysis", "shared", "duration"]),
        formatDuration(getPreferredAssetDuration(assetRecord)),
      ],
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(report.status || "idle")],
      [featureText(["report", "findingsTitle"]), String(findings.length)],
      [
        text(["mediaAnalysis", "profile", "summary", "artifacts"]),
        String(getCurrentFeatureArtifactCount()),
      ],
    ];
  }

  function getReportSideRows(
    reportRecord: unknown,
    _findings: unknown[],
    _exportsList: unknown[]
  ) {
    const report = toFeatureReportRecord(reportRecord);
    const exportsList = _exportsList;
    if (isSubtitleAnalysisFeature()) {
      return [
        [
          featureText(["report", "overviewMeta", "status"]),
          formatStatusLabel(report.status || "idle"),
        ],
        [featureText(["report", "overviewMeta", "target"]), getCurrentFeatureTargetLabel()],
        [featureText(["report", "overviewMeta", "exports"]), String(exportsList.length)],
        [featureText(["report", "overviewMeta", "generated"]), formatDateTime(report.generatedAt)],
      ];
    }

    return [
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(report.status || "idle")],
      [text(["mediaAnalysis", "profile", "summary", "target"]), getCurrentFeatureTargetLabel()],
      [featureText(["report", "exportHistoryEyebrow"]), String(exportsList.length)],
      [featureText(["report", "overviewMeta", "generated"]), formatDateTime(report.generatedAt)],
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
