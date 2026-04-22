import {
  freezeAnalysisScope,
  normalizeAnalysisReference,
  normalizeAnalysisScope,
  serializeAnalysisScope
} from "../types/analysis-scope.js";
export function createLaboratoryProcessReportStateRuntime(deps) {
  const asNonEmptyString = deps["asNonEmptyString"];
  const asNumber = deps["asNumber"];
  const featureIds = Array.isArray(deps["featureIds"]) ? deps["featureIds"] : [];
  const normalizeProfileArtifact = deps["normalizeProfileArtifact"];
  const normalizeProfileSignal = deps["normalizeProfileSignal"];
  const toRecord = deps["toRecord"];
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
      events: [],
      rawLog: [],
      warnings: [],
      error: null,
      emptyReason: null,
      analysisScope: null,
      liveFindings: [],
      previewArtifacts: [],
      confidence: null,
      moduleTrace: [],
      comparisonVariants: [],
      hypothesisSummary: null
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
    const source = toRecord(rawValue);
    return {
      ...artifact,
      moduleId: asNonEmptyString(toRecord(rawValue).moduleId),
      label: asNonEmptyString(source.label),
      status: asNonEmptyString(source.status) || "ready",
      variantId: asNonEmptyString(source.variantId),
      active: source.active !== false,
      reference: normalizeAnalysisReference(source.reference ?? rawValue),
      metadata: toRecord(source.metadata)
    };
  }
  function normalizeProcessFinding(rawValue) {
    const source = toRecord(rawValue);
    const finding = normalizeProfileSignal(rawValue);
    const severity = asNonEmptyString(source.severity);
    return {
      ...finding,
      moduleId: asNonEmptyString(toRecord(rawValue).moduleId),
      code: asNonEmptyString(source.code),
      severity: severity === "success" || severity === "warning" || severity === "error" ? severity : "info",
      sourceModule: asNonEmptyString(source.sourceModule) || asNonEmptyString(source.moduleId),
      reference: normalizeAnalysisReference(source.reference ?? rawValue),
      hypothesis: asNonEmptyString(source.hypothesis)
    };
  }
  function normalizeLiveFinding(rawValue) {
    const source = toRecord(rawValue);
    const timestamp = asNumber(source.emittedAt);
    return {
      ...normalizeProcessFinding(rawValue),
      emittedAt: typeof timestamp === "number" ? Math.max(0, Math.round(timestamp)) : Date.now(),
      windowKey: asNonEmptyString(source.windowKey),
      streamId: asNonEmptyString(source.streamId)
    };
  }
  function normalizeModuleTraceEntry(rawValue) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `module-trace-${Date.now()}`,
      moduleId: asNonEmptyString(source.moduleId),
      stage: asNonEmptyString(source.stage) || "process",
      status: asNonEmptyString(source.status) || "idle",
      timestamp: asNonEmptyString(source["timestamp"]) || (/* @__PURE__ */ new Date()).toISOString(),
      message: asNonEmptyString(source.message),
      detail: asNonEmptyString(source.detail),
      eventId: asNonEmptyString(source.eventId)
    };
  }
  function normalizeComparisonVariant(rawValue) {
    const source = toRecord(rawValue);
    const artifactId = asNonEmptyString(source["artifactId"]);
    const artifactIds = Array.isArray(source.artifactIds) ? source.artifactIds.map(asNonEmptyString).filter(Boolean) : artifactId ? [artifactId] : [];
    return {
      id: asNonEmptyString(source.id) || `comparison-variant-${Date.now()}`,
      kind: asNonEmptyString(source.kind) || "variant",
      label: asNonEmptyString(source.label) || "Variant",
      status: asNonEmptyString(source.status) || "ready",
      summary: asNonEmptyString(source.summary),
      artifactIds,
      artifactId,
      artifactPath: asNonEmptyString(source["artifactPath"]),
      sourceModule: asNonEmptyString(source.sourceModule),
      active: source.active !== false
    };
  }
  function normalizeFrozenScope(rawValue, runId, status, startedAt) {
    const normalizedScope = normalizeAnalysisScope(rawValue);
    if (normalizedScope === null) {
      return null;
    }
    if (runId !== null && status !== "idle") {
      return freezeAnalysisScope(normalizedScope, runId, startedAt || (/* @__PURE__ */ new Date()).toISOString());
    }
    return serializeAnalysisScope(normalizedScope);
  }
  function normalizeProcessModule(rawValue) {
    const source = toRecord(rawValue);
    return {
      id: asNonEmptyString(source.id) || `process-module-${Date.now()}`,
      labelKey: asNonEmptyString(source.labelKey),
      title: asNonEmptyString(source.title),
      status: asNonEmptyString(source.status) || "idle",
      percent: typeof asNumber(source.percent) === "number" ? Math.max(0, Math.min(100, Math.round(asNumber(source.percent) || 0))) : null,
      progressMode: typeof asNumber(source.percent) === "number" || asNonEmptyString(source["progressMode"]) === "measured" ? "measured" : "none",
      summary: asNonEmptyString(source.summary) || "",
      message: asNonEmptyString(source["message"]),
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
    const status = asNonEmptyString(source.status) || "idle";
    const runId = asNonEmptyString(source.runId);
    const startedAt = asNonEmptyString(source.startedAt);
    return {
      ...createEmptyFeatureProcessRecord(featureId),
      ...source,
      featureId,
      status,
      jobId: asNonEmptyString(source.jobId),
      requestId: asNonEmptyString(source.requestId),
      runId,
      startedAt,
      completedAt: asNonEmptyString(source.completedAt),
      percent: Math.max(0, Math.min(100, Math.round(asNumber(source.percent) || 0))),
      targetSummary: Object.keys(toRecord(source.targetSummary)).length > 0 ? toRecord(source.targetSummary) : null,
      modules: Array.isArray(source.modules) ? source.modules.map(normalizeProcessModule) : [],
      findings: Array.isArray(source.findings) ? source.findings.map(normalizeProcessFinding) : [],
      artifacts: Array.isArray(source.artifacts) ? source.artifacts.map(normalizeProcessArtifact).filter(function(entry) {
        return entry.path !== null;
      }) : [],
      events: Array.isArray(source.events) ? source.events.map(function(entry) {
        return toRecord(entry);
      }) : [],
      rawLog: Array.isArray(source.rawLog) ? source.rawLog.map(function(entry) {
        return toRecord(entry);
      }) : [],
      warnings: Array.isArray(source.warnings) ? source.warnings.map(function(entry) {
        return String(entry);
      }) : [],
      error: asNonEmptyString(source.error),
      emptyReason: asNonEmptyString(source.emptyReason),
      analysisScope: normalizeFrozenScope(source.analysisScope, runId, status, startedAt),
      liveFindings: Array.isArray(source.liveFindings) ? source.liveFindings.map(normalizeLiveFinding) : [],
      previewArtifacts: Array.isArray(source.previewArtifacts) ? source.previewArtifacts.map(normalizeProcessArtifact) : [],
      confidence: asNonEmptyString(source.confidence),
      moduleTrace: Array.isArray(source.moduleTrace) ? source.moduleTrace.map(normalizeModuleTraceEntry) : [],
      comparisonVariants: Array.isArray(source.comparisonVariants) ? source.comparisonVariants.map(normalizeComparisonVariant) : [],
      hypothesisSummary: asNonEmptyString(source.hypothesisSummary) || asNonEmptyString(toRecord(normalizeAnalysisScope(source.analysisScope)).hypothesis)
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
      error: null,
      emptyReason: "Rapor henüz üretilmedi.",
      analysisScope: null,
      liveFindings: [],
      previewArtifacts: [],
      confidence: null,
      moduleTrace: [],
      comparisonVariants: [],
      hypothesisSummary: null
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
      error: asNonEmptyString(source.error),
      emptyReason: asNonEmptyString(source.emptyReason),
      analysisScope: serializeAnalysisScope(source.analysisScope),
      liveFindings: Array.isArray(source.liveFindings) ? source.liveFindings.map(normalizeLiveFinding) : [],
      previewArtifacts: Array.isArray(source.previewArtifacts) ? source.previewArtifacts.map(normalizeProcessArtifact) : [],
      confidence: asNonEmptyString(source.confidence),
      moduleTrace: Array.isArray(source.moduleTrace) ? source.moduleTrace.map(normalizeModuleTraceEntry) : [],
      comparisonVariants: Array.isArray(source.comparisonVariants) ? source.comparisonVariants.map(normalizeComparisonVariant) : [],
      hypothesisSummary: asNonEmptyString(source.hypothesisSummary) || asNonEmptyString(toRecord(normalizeAnalysisScope(source.analysisScope)).hypothesis)
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
    return nextProcess.records[featureId];
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
    setFeatureReportRecord
  };
}
