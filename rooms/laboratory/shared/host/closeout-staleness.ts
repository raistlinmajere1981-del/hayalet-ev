// @ts-nocheck
export function createLaboratoryCloseoutStalenessRuntime(deps) {
  const featureIds = deps.featureIds;
  const getFeatureProcessRecord = deps.getFeatureProcessRecord;
  const setFeatureProcessRecord = deps.setFeatureProcessRecord;
  const getFeatureReportRecord = deps.getFeatureReportRecord;
  const setFeatureReportRecord = deps.setFeatureReportRecord;

  function markFeatureProcessStale(project, featureId, reason) {
    const existing = getFeatureProcessRecord(project, featureId);
    setFeatureProcessRecord(project, featureId, {
      ...existing,
      status: existing.completedAt ? "stale" : "idle",
      jobId: null,
      requestId: null,
      runId: existing.runId,
      percent: 0,
      warnings: Array.from(new Set((existing.warnings || []).concat(reason ? [reason] : []))),
      error: null,
    });
    project.process.lastError = null;
    project.process.lastActionAt = new Date().toISOString();
  }

  function markFeatureReportStale(project, featureId, reason) {
    const existing = getFeatureReportRecord(project, featureId);
    setFeatureReportRecord(project, featureId, {
      ...existing,
      status: existing.generatedAt ? "stale" : "idle",
      warnings: Array.from(new Set((existing.warnings || []).concat(reason ? [reason] : []))),
      error: null,
    });
    project.report.lastError = null;
    project.report.lastActionAt = new Date().toISOString();
  }

  function markCloseoutAsStale(project, reason, targetFeatureIds) {
    const resolvedFeatureIds =
      Array.isArray(targetFeatureIds) && targetFeatureIds.length > 0 ? targetFeatureIds : featureIds;
    resolvedFeatureIds.forEach(function (featureId) {
      markFeatureProcessStale(project, featureId, reason);
      markFeatureReportStale(project, featureId, reason);
    });
  }

  return {
    markCloseoutAsStale: markCloseoutAsStale,
    markFeatureProcessStale: markFeatureProcessStale,
    markFeatureReportStale: markFeatureReportStale,
  };
}
