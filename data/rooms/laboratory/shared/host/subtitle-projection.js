export function createLaboratorySubtitleProjectionRuntime(deps) {
  const {
    asNonEmptyString,
    normalizeProcessFinding,
    normalizeProcessModule,
    normalizeReportExport,
    normalizeReportSummaryCard,
    normalizeSubtitleAnalysisState,
    readFeatureProcessRecord,
    readFeatureReportRecord,
    subtitleFeatureId,
    toRecord
  } = deps;
  function syncProjectSubtitleAnalysisProjection(runtime, project) {
    const subtitleState = normalizeSubtitleAnalysisState(
      toRecord(project)["subtitleAnalysis"],
      runtime
    );
    const processRecord = readFeatureProcessRecord(project, subtitleFeatureId);
    const reportRecord = readFeatureReportRecord(project, subtitleFeatureId);
    subtitleState.analysis = {
      ...subtitleState.analysis,
      status: asNonEmptyString(processRecord.status) ?? "idle",
      summaryCards: Array.isArray(reportRecord.summaryCards) ? reportRecord.summaryCards.map(normalizeReportSummaryCard) : [],
      findings: Array.isArray(reportRecord.findings) ? reportRecord.findings.map(normalizeProcessFinding) : [],
      warnings: Array.isArray(reportRecord.warnings) ? reportRecord.warnings.map(String) : [],
      moduleResults: (Array.isArray(processRecord.modules) ? processRecord.modules : []).reduce(function(accumulator, entry) {
        const moduleRecord = normalizeProcessModule(entry);
        accumulator[moduleRecord.id] = moduleRecord;
        return accumulator;
      }, {}),
      lastRunAt: asNonEmptyString(processRecord.completedAt)
    };
    subtitleState.export = {
      lastGeneratedAt: asNonEmptyString(reportRecord.generatedAt),
      items: Array.isArray(reportRecord.exports) ? reportRecord.exports.map(normalizeReportExport) : []
    };
    project.subtitleAnalysis = subtitleState;
    return subtitleState;
  }
  return {
    syncProjectSubtitleAnalysisProjection
  };
}
