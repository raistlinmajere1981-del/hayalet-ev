export function createLaboratoryProcessReportStateRuntime(deps) {
  const asNonEmptyString = deps.asNonEmptyString;
  const asNumber = deps.asNumber;
  const featureIds = Array.isArray(deps.featureIds) ? deps.featureIds : [];
  const normalizeProfileArtifact = deps.normalizeProfileArtifact;
  const normalizeProfileSignal = deps.normalizeProfileSignal;
  const toRecord = deps.toRecord;
  function createEmptyFeatureProcessRecord(featureId) {
    return {
      featureId,
      status: "idle",
      jobId: null,
      requestId: null,
      runId: null,
      startedAt: null,
      completedAt: null,
      percent: 0,
      targetSummary: null,
      modules: [],
      findings: [],
      artifacts: [],
      warnings: [],
      error: null
    };
  }
  function createEmptyProcessState() {
    const records = {};
    featureIds.forEach(function(featureId) {
      records[featureId] = createEmptyFeatureProcessRecord(featureId);
    });
    return {
      records,
      lastError: null,
      lastActionAt: null
    };
  }
  function normalizeProcessArtifact(rawValue) {
    const artifact = normalizeProfileArtifact(rawValue);
    return {
      ...artifact,
      moduleId: asNonEmptyString(toRecord(rawValue).moduleId)
    };
  }
  function normalizeProcessFinding(rawValue) {
    const finding = normalizeProfileSignal(rawValue);
    return {
      ...finding,
      moduleId: asNonEmptyString(toRecord(rawValue).moduleId)
    };
  }
  function normalizeProcessModule(rawValue) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `process-module-${Date.now()}`,
      labelKey: asNonEmptyString(source.labelKey),
      title: asNonEmptyString(source.title),
      status: asNonEmptyString(source.status) || "idle",
      percent: Math.max(0, Math.min(100, Math.round(asNumber(source.percent) || 0))),
      summary: asNonEmptyString(source.summary) || "",
      warnings: Array.isArray(source.warnings) ? source.warnings.map(function(entry) {
        return String(entry);
      }) : [],
      artifactIds: Array.isArray(source.artifactIds) ? source.artifactIds.map(asNonEmptyString).filter(Boolean) : [],
      findingIds: Array.isArray(source.findingIds) ? source.findingIds.map(asNonEmptyString).filter(Boolean) : [],
      startedAt: asNonEmptyString(source.startedAt),
      completedAt: asNonEmptyString(source.completedAt)
    };
  }
  function normalizeFeatureProcessRecord(rawValue, featureId) {
    const source = toRecord(rawValue);
    return {
      ...createEmptyFeatureProcessRecord(featureId),
      ...source,
      featureId,
      status: asNonEmptyString(source.status) || "idle",
      jobId: asNonEmptyString(source.jobId),
      requestId: asNonEmptyString(source.requestId),
      runId: asNonEmptyString(source.runId),
      startedAt: asNonEmptyString(source.startedAt),
      completedAt: asNonEmptyString(source.completedAt),
      percent: Math.max(0, Math.min(100, Math.round(asNumber(source.percent) || 0))),
      targetSummary: Object.keys(toRecord(source.targetSummary)).length > 0 ? toRecord(source.targetSummary) : null,
      modules: Array.isArray(source.modules) ? source.modules.map(normalizeProcessModule) : [],
      findings: Array.isArray(source.findings) ? source.findings.map(normalizeProcessFinding) : [],
      artifacts: Array.isArray(source.artifacts) ? source.artifacts.map(normalizeProcessArtifact).filter(function(entry) {
        return entry.path !== null;
      }) : [],
      warnings: Array.isArray(source.warnings) ? source.warnings.map(function(entry) {
        return String(entry);
      }) : [],
      error: asNonEmptyString(source.error)
    };
  }
  function normalizeProcessState(rawValue) {
    const source = toRecord(rawValue);
    const records = {};
    featureIds.forEach(function(featureId) {
      records[featureId] = normalizeFeatureProcessRecord(
        toRecord(toRecord(source.records)[featureId]),
        featureId
      );
    });
    return {
      records,
      lastError: asNonEmptyString(source.lastError),
      lastActionAt: asNonEmptyString(source.lastActionAt)
    };
  }
  function createEmptyFeatureReportRecord(featureId) {
    return {
      featureId,
      status: "idle",
      sourceRunId: null,
      generatedAt: null,
      summaryCards: [],
      findings: [],
      caveats: [],
      warnings: [],
      exports: [],
      error: null
    };
  }
  function createEmptyReportState() {
    const records = {};
    featureIds.forEach(function(featureId) {
      records[featureId] = createEmptyFeatureReportRecord(featureId);
    });
    return {
      records,
      lastError: null,
      lastActionAt: null
    };
  }
  function normalizeReportSummaryCard(rawValue) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `report-card-${Date.now()}`,
      label: asNonEmptyString(source.label),
      labelKey: asNonEmptyString(source.labelKey),
      value: asNonEmptyString(source.value) || "--"
    };
  }
  function normalizeReportExport(rawValue) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `report-export-${Date.now()}`,
      format: asNonEmptyString(source.format) || "md",
      path: asNonEmptyString(source.path),
      fileName: asNonEmptyString(source.fileName),
      createdAt: asNonEmptyString(source.createdAt) || (/* @__PURE__ */ new Date()).toISOString(),
      status: asNonEmptyString(source.status) || "ready",
      error: asNonEmptyString(source.error)
    };
  }
  function normalizeFeatureReportRecord(rawValue, featureId) {
    const source = toRecord(rawValue);
    return {
      ...createEmptyFeatureReportRecord(featureId),
      ...source,
      featureId,
      status: asNonEmptyString(source.status) || "idle",
      sourceRunId: asNonEmptyString(source.sourceRunId),
      generatedAt: asNonEmptyString(source.generatedAt),
      summaryCards: Array.isArray(source.summaryCards) ? source.summaryCards.map(normalizeReportSummaryCard) : [],
      findings: Array.isArray(source.findings) ? source.findings.map(normalizeProcessFinding) : [],
      caveats: Array.isArray(source.caveats) ? source.caveats.map(function(entry) {
        return String(entry);
      }) : [],
      warnings: Array.isArray(source.warnings) ? source.warnings.map(function(entry) {
        return String(entry);
      }) : [],
      exports: Array.isArray(source.exports) ? source.exports.map(normalizeReportExport) : [],
      error: asNonEmptyString(source.error)
    };
  }
  function normalizeReportState(rawValue) {
    const source = toRecord(rawValue);
    const records = {};
    featureIds.forEach(function(featureId) {
      records[featureId] = normalizeFeatureReportRecord(
        toRecord(toRecord(source.records)[featureId]),
        featureId
      );
    });
    return {
      records,
      lastError: asNonEmptyString(source.lastError),
      lastActionAt: asNonEmptyString(source.lastActionAt)
    };
  }
  function getFeatureProcessRecord(project, featureId) {
    return normalizeFeatureProcessRecord(
      toRecord(toRecord(toRecord(project).process).records)[featureId],
      featureId
    );
  }
  function setFeatureProcessRecord(project, featureId, record) {
    const nextProcess = normalizeProcessState(project.process);
    nextProcess.records[featureId] = normalizeFeatureProcessRecord(record, featureId);
    project.process = nextProcess;
    return project.process.records[featureId];
  }
  function getFeatureReportRecord(project, featureId) {
    return normalizeFeatureReportRecord(
      toRecord(toRecord(toRecord(project).report).records)[featureId],
      featureId
    );
  }
  function setFeatureReportRecord(project, featureId, record) {
    const nextReport = normalizeReportState(project.report);
    nextReport.records[featureId] = normalizeFeatureReportRecord(record, featureId);
    project.report = nextReport;
    return project.report.records[featureId];
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
    setFeatureReportRecord
  };
}
