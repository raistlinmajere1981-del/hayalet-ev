function appendWarning(existingWarnings, reason) {
  return Array.from(/* @__PURE__ */ new Set([...existingWarnings ?? [], ...reason === null ? [] : [reason]]));
}
export function createLaboratoryCloseoutStalenessRuntime(deps) {
  const {
    featureIds,
    getFeatureProcessRecord,
    setFeatureProcessRecord,
    getFeatureReportRecord,
    setFeatureReportRecord
  } = deps;
  function markFeatureProcessStale(project, featureId, reason) {
    const existing = getFeatureProcessRecord(project, featureId);
    setFeatureProcessRecord(project, featureId, {
      ...existing,
      status: existing.completedAt ? "stale" : "idle",
      jobId: null,
      requestId: null,
      runId: existing.runId ?? null,
      percent: 0,
      warnings: appendWarning(existing.warnings, reason),
      error: null
    });
    project.process.lastError = null;
    project.process.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  function markFeatureReportStale(project, featureId, reason) {
    const existing = getFeatureReportRecord(project, featureId);
    setFeatureReportRecord(project, featureId, {
      ...existing,
      status: existing.generatedAt ? "stale" : "idle",
      warnings: appendWarning(existing.warnings, reason),
      error: null
    });
    project.report.lastError = null;
    project.report.lastActionAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  function markCloseoutAsStale(project, reason, targetFeatureIds) {
    const resolvedFeatureIds = Array.isArray(targetFeatureIds) && targetFeatureIds.length > 0 ? targetFeatureIds : featureIds;
    resolvedFeatureIds.forEach(function(featureId) {
      markFeatureProcessStale(project, featureId, reason);
      markFeatureReportStale(project, featureId, reason);
    });
  }
  return {
    markCloseoutAsStale,
    markFeatureProcessStale,
    markFeatureReportStale
  };
}
