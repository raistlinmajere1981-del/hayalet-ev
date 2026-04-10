export function createLaboratoryProcessDelegatesRuntime(deps) {
  const { processCoordinationRuntime } = deps;
  function buildAudioAnalysisReportProjection(runtime, project) {
    return processCoordinationRuntime["buildAudioAnalysisReportProjection"](
      runtime,
      project
    );
  }
  function composeAudioAnalysisReport(runtime, project) {
    return processCoordinationRuntime["composeAudioAnalysisReport"](
      runtime,
      project
    );
  }
  function getProcessArtifactByKind(processRecord, kind) {
    return processCoordinationRuntime["getProcessArtifactByKind"](
      processRecord,
      kind
    );
  }
  function formatReportCardLabel(card) {
    return processCoordinationRuntime["formatReportCardLabel"](card);
  }
  function composeSubtitleAnalysisReport(runtime, project) {
    return processCoordinationRuntime["composeSubtitleAnalysisReport"](
      runtime,
      project
    );
  }
  function composeFeatureReport(runtime, project, featureId) {
    return processCoordinationRuntime["composeFeatureReport"](
      runtime,
      project,
      featureId
    );
  }
  function buildReportMarkdown(runtime, project, featureId, reportRecord) {
    return processCoordinationRuntime["buildReportMarkdown"](
      runtime,
      project,
      featureId,
      reportRecord
    );
  }
  async function runFeatureProcess(api, runtime, requestId, featureId) {
    return processCoordinationRuntime["runFeatureProcess"](
      api,
      runtime,
      requestId,
      featureId
    );
  }
  async function runManagedProcess(runtime, project, requestId, jobId, featureId) {
    return processCoordinationRuntime["runManagedProcess"](
      runtime,
      project,
      requestId,
      jobId,
      featureId
    );
  }
  async function cancelFeatureProcess(api, runtime, requestId, featureId) {
    return processCoordinationRuntime["cancelFeatureProcess"](
      api,
      runtime,
      requestId,
      featureId
    );
  }
  async function exportFeatureReport(api, runtime, requestId, featureId) {
    return processCoordinationRuntime["exportFeatureReport"](
      api,
      runtime,
      requestId,
      featureId
    );
  }
  return {
    buildAudioAnalysisReportProjection,
    buildReportMarkdown,
    cancelFeatureProcess,
    composeAudioAnalysisReport,
    composeFeatureReport,
    composeSubtitleAnalysisReport,
    exportFeatureReport,
    formatReportCardLabel,
    getProcessArtifactByKind,
    runManagedProcess,
    runFeatureProcess
  };
}
