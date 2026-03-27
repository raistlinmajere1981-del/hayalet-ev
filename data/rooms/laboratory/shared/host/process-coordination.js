export function createLaboratoryProcessCoordinationRuntime(deps) {
  const { processRuntime, reportingRuntime } = deps;

  function runManagedProcess(runtime, project, requestId, jobId, featureId) {
    return processRuntime.runManagedProcess(runtime, project, requestId, jobId, featureId);
  }

  function runFeatureProcess(api, runtime, requestId, featureId) {
    return processRuntime.runFeatureProcess(api, runtime, requestId, featureId);
  }

  function cancelFeatureProcess(api, runtime, requestId, featureId) {
    return processRuntime.cancelFeatureProcess(api, runtime, requestId, featureId);
  }

  function exportFeatureReport(api, runtime, requestId, featureId) {
    return reportingRuntime.exportFeatureReport(api, runtime, requestId, featureId);
  }

  function buildAudioAnalysisReportProjection(runtime, project) {
    return reportingRuntime.buildAudioAnalysisReportProjection(runtime, project);
  }

  function composeAudioAnalysisReport(runtime, project) {
    return reportingRuntime.composeAudioAnalysisReport(runtime, project);
  }

  function getProcessArtifactByKind(processRecord, kind) {
    return reportingRuntime.getProcessArtifactByKind(processRecord, kind);
  }

  function formatReportCardLabel(card) {
    return reportingRuntime.formatReportCardLabel(card);
  }

  function composeSubtitleAnalysisReport(runtime, project) {
    return reportingRuntime.composeSubtitleAnalysisReport(runtime, project);
  }

  function composeFeatureReport(runtime, project, featureId) {
    return reportingRuntime.composeFeatureReport(runtime, project, featureId);
  }

  function buildReportMarkdown(runtime, project, featureId, reportRecord) {
    return reportingRuntime.buildReportMarkdown(runtime, project, featureId, reportRecord);
  }

  return {
    buildAudioAnalysisReportProjection: buildAudioAnalysisReportProjection,
    buildReportMarkdown: buildReportMarkdown,
    cancelFeatureProcess: cancelFeatureProcess,
    composeAudioAnalysisReport: composeAudioAnalysisReport,
    composeFeatureReport: composeFeatureReport,
    composeSubtitleAnalysisReport: composeSubtitleAnalysisReport,
    exportFeatureReport: exportFeatureReport,
    formatReportCardLabel: formatReportCardLabel,
    getProcessArtifactByKind: getProcessArtifactByKind,
    runFeatureProcess: runFeatureProcess,
    runManagedProcess: runManagedProcess,
  };
}
