type UnknownFn = (...args: unknown[]) => unknown;

export function createLaboratoryProcessCoordinationRuntime(deps: Record<string, unknown>) {
  const { processRuntime, reportingRuntime } = deps as {
    processRuntime: Record<string, unknown>;
    reportingRuntime: Record<string, unknown>;
  };

  function runManagedProcess(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    requestId: string,
    jobId: string,
    featureId: string
  ) {
    return (processRuntime["runManagedProcess"] as UnknownFn)(
      runtime,
      project,
      requestId,
      jobId,
      featureId
    );
  }

  function runFeatureProcess(
    api: Record<string, unknown>,
    runtime: Record<string, unknown>,
    requestId: string,
    featureId: string
  ) {
    return (processRuntime["runFeatureProcess"] as UnknownFn)(api, runtime, requestId, featureId);
  }

  function cancelFeatureProcess(
    api: Record<string, unknown>,
    runtime: Record<string, unknown>,
    requestId: string,
    featureId: string
  ) {
    return (processRuntime["cancelFeatureProcess"] as UnknownFn)(
      api,
      runtime,
      requestId,
      featureId
    );
  }

  function exportFeatureReport(
    api: Record<string, unknown>,
    runtime: Record<string, unknown>,
    requestId: string,
    featureId: string
  ) {
    return (reportingRuntime["exportFeatureReport"] as UnknownFn)(
      api,
      runtime,
      requestId,
      featureId
    );
  }

  function buildAudioAnalysisReportProjection(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>
  ) {
    return (reportingRuntime["buildAudioAnalysisReportProjection"] as UnknownFn)(runtime, project);
  }

  function composeAudioAnalysisReport(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>
  ) {
    return (reportingRuntime["composeAudioAnalysisReport"] as UnknownFn)(runtime, project);
  }

  function getProcessArtifactByKind(processRecord: Record<string, unknown>, kind: string) {
    return (reportingRuntime["getProcessArtifactByKind"] as UnknownFn)(processRecord, kind);
  }

  function formatReportCardLabel(card: Record<string, unknown>) {
    return (reportingRuntime["formatReportCardLabel"] as UnknownFn)(card);
  }

  function composeSubtitleAnalysisReport(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>
  ) {
    return (reportingRuntime["composeSubtitleAnalysisReport"] as UnknownFn)(runtime, project);
  }

  function composeFeatureReport(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    featureId: string
  ) {
    return (reportingRuntime["composeFeatureReport"] as UnknownFn)(runtime, project, featureId);
  }

  function buildReportMarkdown(
    runtime: Record<string, unknown>,
    project: Record<string, unknown>,
    featureId: string,
    reportRecord: Record<string, unknown>
  ) {
    return (reportingRuntime["buildReportMarkdown"] as UnknownFn)(
      runtime,
      project,
      featureId,
      reportRecord
    );
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
