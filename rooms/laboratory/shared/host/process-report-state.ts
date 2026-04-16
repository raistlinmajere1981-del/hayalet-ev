interface ProcessReportRecord extends Record<string, unknown> {
  moduleId?: unknown;
  id?: unknown;
  label?: unknown;
  labelKey?: unknown;
  title?: unknown;
  status?: unknown;
  percent?: unknown;
  summary?: unknown;
  warnings?: unknown;
  artifactIds?: unknown;
  findingIds?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  jobId?: unknown;
  requestId?: unknown;
  runId?: unknown;
  targetSummary?: unknown;
  modules?: unknown;
  findings?: unknown;
  artifacts?: unknown;
  events?: unknown;
  rawLog?: unknown;
  error?: unknown;
  emptyReason?: unknown;
  records?: unknown;
  lastError?: unknown;
  lastActionAt?: unknown;
  sourceRunId?: unknown;
  generatedAt?: unknown;
  summaryCards?: unknown;
  caveats?: unknown;
  exports?: unknown;
  value?: unknown;
  format?: unknown;
  path?: unknown;
  fileName?: unknown;
  createdAt?: unknown;
  process?: unknown;
  report?: unknown;
}

interface ProcessArtifactRecord extends Record<string, unknown> {
  path?: unknown;
  moduleId?: unknown;
}

export function createLaboratoryProcessReportStateRuntime(deps: Record<string, unknown>) {
  const asNonEmptyString = deps["asNonEmptyString"] as (value: unknown) => string | null;
  const asNumber = deps["asNumber"] as (value: unknown) => number;
  const featureIds = Array.isArray(deps["featureIds"]) ? (deps["featureIds"] as string[]) : [];
  const normalizeProfileArtifact = deps["normalizeProfileArtifact"] as (
    rawValue: unknown
  ) => ProcessArtifactRecord;
  const normalizeProfileSignal = deps["normalizeProfileSignal"] as (
    rawValue: unknown
  ) => ProcessReportRecord;
  const toRecord = deps["toRecord"] as (value: unknown) => ProcessReportRecord;

  function createEmptyFeatureProcessRecord(featureId: string) {
    return {
      featureId: featureId,
      status: "idle" as string,
      jobId: null as string | null,
      requestId: null as string | null,
      runId: null as string | null,
      startedAt: null as string | null,
      completedAt: null as string | null,
      percent: 0,
      targetSummary: null as Record<string, unknown> | null,
      modules: [] as unknown[],
      findings: [] as unknown[],
      artifacts: [] as unknown[],
      events: [] as unknown[],
      rawLog: [] as unknown[],
      warnings: [] as string[],
      error: null as string | null,
      emptyReason: null as string | null,
    };
  }

  function createEmptyProcessState() {
    const records: Record<string, unknown> = {};
    featureIds.forEach(function (featureId: string) {
      records[featureId] = createEmptyFeatureProcessRecord(featureId);
    });
    return {
      records: records,
      lastError: null as string | null,
      lastActionAt: null as string | null,
    };
  }

  function normalizeProcessArtifact(rawValue: unknown) {
    const artifact = normalizeProfileArtifact(rawValue);
    return {
      ...artifact,
      moduleId: asNonEmptyString(toRecord(rawValue).moduleId),
    };
  }

  function normalizeProcessFinding(rawValue: unknown) {
    const finding = normalizeProfileSignal(rawValue);
    return {
      ...finding,
      moduleId: asNonEmptyString(toRecord(rawValue).moduleId),
    };
  }

  function normalizeProcessModule(rawValue: unknown) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `process-module-${Date.now()}`,
      labelKey: asNonEmptyString(source.labelKey),
      title: asNonEmptyString(source.title),
      status: asNonEmptyString(source.status) || "idle",
      percent:
        typeof asNumber(source.percent) === "number"
          ? Math.max(0, Math.min(100, Math.round(asNumber(source.percent) || 0)))
          : null,
      progressMode:
        typeof asNumber(source.percent) === "number" || asNonEmptyString(source["progressMode"]) === "measured"
          ? "measured"
          : "none",
      summary: asNonEmptyString(source.summary) || "",
      message: asNonEmptyString(source["message"]),
      warnings: Array.isArray(source.warnings)
        ? source.warnings.map(function (entry: unknown) {
            return String(entry);
          })
        : [],
      artifactIds: Array.isArray(source.artifactIds)
        ? (source.artifactIds as unknown[]).map(asNonEmptyString).filter(Boolean)
        : [],
      findingIds: Array.isArray(source.findingIds)
        ? (source.findingIds as unknown[]).map(asNonEmptyString).filter(Boolean)
        : [],
      startedAt: asNonEmptyString(source.startedAt),
      completedAt: asNonEmptyString(source.completedAt),
    };
  }

  function normalizeFeatureProcessRecord(rawValue: unknown, featureId: string) {
    const source = toRecord(rawValue);
    return {
      ...createEmptyFeatureProcessRecord(featureId),
      ...source,
      featureId: featureId,
      status: asNonEmptyString(source.status) || "idle",
      jobId: asNonEmptyString(source.jobId),
      requestId: asNonEmptyString(source.requestId),
      runId: asNonEmptyString(source.runId),
      startedAt: asNonEmptyString(source.startedAt),
      completedAt: asNonEmptyString(source.completedAt),
      percent: Math.max(0, Math.min(100, Math.round(asNumber(source.percent) || 0))),
      targetSummary:
        Object.keys(toRecord(source.targetSummary)).length > 0
          ? toRecord(source.targetSummary)
          : null,
      modules: Array.isArray(source.modules) ? source.modules.map(normalizeProcessModule) : [],
      findings: Array.isArray(source.findings) ? source.findings.map(normalizeProcessFinding) : [],
      artifacts: Array.isArray(source.artifacts)
        ? source.artifacts.map(normalizeProcessArtifact).filter(function (
            entry: ProcessArtifactRecord
          ) {
            return entry.path !== null;
          })
        : [],
      events: Array.isArray(source.events)
        ? source.events.map(function (entry: unknown) {
            return toRecord(entry);
          })
        : [],
      rawLog: Array.isArray(source.rawLog)
        ? source.rawLog.map(function (entry: unknown) {
            return toRecord(entry);
          })
        : [],
      warnings: Array.isArray(source.warnings)
        ? source.warnings.map(function (entry: unknown) {
            return String(entry);
          })
        : [],
      error: asNonEmptyString(source.error),
      emptyReason: asNonEmptyString(source.emptyReason),
    };
  }

  function normalizeProcessState(rawValue: unknown) {
    const source = toRecord(rawValue);
    const records: Record<string, unknown> = {};

    featureIds.forEach(function (featureId: string) {
      records[featureId] = normalizeFeatureProcessRecord(
        toRecord(toRecord(source.records)[featureId]),
        featureId
      );
    });

    return {
      records: records,
      lastError: asNonEmptyString(source.lastError),
      lastActionAt: asNonEmptyString(source.lastActionAt),
    };
  }

  function createEmptyFeatureReportRecord(featureId: string) {
    return {
      featureId: featureId,
      status: "idle" as string,
      sourceRunId: null as string | null,
      generatedAt: null as string | null,
      summaryCards: [] as unknown[],
      findings: [] as unknown[],
      caveats: [] as string[],
      warnings: [] as string[],
      exports: [] as unknown[],
      error: null as string | null,
      emptyReason: "Rapor henüz üretilmedi." as string | null,
    };
  }

  function createEmptyReportState() {
    const records: Record<string, unknown> = {};
    featureIds.forEach(function (featureId: string) {
      records[featureId] = createEmptyFeatureReportRecord(featureId);
    });
    return {
      records: records,
      lastError: null as string | null,
      lastActionAt: null as string | null,
    };
  }

  function normalizeReportSummaryCard(rawValue: unknown) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `report-card-${Date.now()}`,
      label: asNonEmptyString(source.label),
      labelKey: asNonEmptyString(source.labelKey),
      value: asNonEmptyString(source.value) || "--",
    };
  }

  function normalizeReportExport(rawValue: unknown) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `report-export-${Date.now()}`,
      format: asNonEmptyString(source.format) || "md",
      path: asNonEmptyString(source.path),
      fileName: asNonEmptyString(source.fileName),
      createdAt: asNonEmptyString(source.createdAt) || new Date().toISOString(),
      status: asNonEmptyString(source.status) || "ready",
      error: asNonEmptyString(source.error),
    };
  }

  function normalizeFeatureReportRecord(rawValue: unknown, featureId: string) {
    const source = toRecord(rawValue);
    return {
      ...createEmptyFeatureReportRecord(featureId),
      ...source,
      featureId: featureId,
      status: asNonEmptyString(source.status) || "idle",
      sourceRunId: asNonEmptyString(source.sourceRunId),
      generatedAt: asNonEmptyString(source.generatedAt),
      summaryCards: Array.isArray(source.summaryCards)
        ? source.summaryCards.map(normalizeReportSummaryCard)
        : [],
      findings: Array.isArray(source.findings) ? source.findings.map(normalizeProcessFinding) : [],
      caveats: Array.isArray(source.caveats)
        ? source.caveats.map(function (entry: unknown) {
            return String(entry);
          })
        : [],
      warnings: Array.isArray(source.warnings)
        ? source.warnings.map(function (entry: unknown) {
            return String(entry);
          })
        : [],
      exports: Array.isArray(source.exports) ? source.exports.map(normalizeReportExport) : [],
      error: asNonEmptyString(source.error),
      emptyReason: asNonEmptyString(source.emptyReason),
    };
  }

  function normalizeReportState(rawValue: unknown) {
    const source = toRecord(rawValue);
    const records: Record<string, unknown> = {};

    featureIds.forEach(function (featureId: string) {
      records[featureId] = normalizeFeatureReportRecord(
        toRecord(toRecord(source.records)[featureId]),
        featureId
      );
    });

    return {
      records: records,
      lastError: asNonEmptyString(source.lastError),
      lastActionAt: asNonEmptyString(source.lastActionAt),
    };
  }

  function getFeatureProcessRecord(project: ProcessReportRecord, featureId: string) {
    return normalizeFeatureProcessRecord(
      toRecord(toRecord(toRecord(project).process).records)[featureId],
      featureId
    );
  }

  function setFeatureProcessRecord(
    project: ProcessReportRecord,
    featureId: string,
    record: unknown
  ) {
    const nextProcess = normalizeProcessState(project.process);
    nextProcess.records[featureId] = normalizeFeatureProcessRecord(record, featureId);
    project.process = nextProcess;
    return nextProcess.records[featureId];
  }

  function getFeatureReportRecord(project: ProcessReportRecord, featureId: string) {
    return normalizeFeatureReportRecord(
      toRecord(toRecord(toRecord(project).report).records)[featureId],
      featureId
    );
  }

  function setFeatureReportRecord(
    project: ProcessReportRecord,
    featureId: string,
    record: unknown
  ) {
    const nextReport = normalizeReportState(project.report);
    nextReport.records[featureId] = normalizeFeatureReportRecord(record, featureId);
    project.report = nextReport;
    return nextReport.records[featureId];
  }

  return {
    createEmptyFeatureProcessRecord,
    createEmptyProcessState,
    normalizeProcessArtifact,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeFeatureProcessRecord,
    normalizeProcessState,
    createEmptyFeatureReportRecord,
    createEmptyReportState,
    normalizeReportSummaryCard,
    normalizeReportExport,
    normalizeFeatureReportRecord,
    normalizeReportState,
    getFeatureProcessRecord,
    setFeatureProcessRecord,
    getFeatureReportRecord,
    setFeatureReportRecord,
  };
}
