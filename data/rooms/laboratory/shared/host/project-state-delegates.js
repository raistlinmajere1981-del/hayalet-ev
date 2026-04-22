export function createLaboratoryProjectStateDelegatesRuntime(deps) {
  const { getMediaProfileStateRuntime, getProcessReportStateRuntime, getProjectStateRuntime } = deps;
  function serializeProjectSummary(project) {
    return getProjectStateRuntime().serializeProjectSummary(project);
  }
  function serializeProject(project, runtime) {
    return getProjectStateRuntime().serializeProject(project, runtime);
  }
  function syncProjectFeatureProjections(runtime, project) {
    return getProjectStateRuntime().syncProjectFeatureProjections(runtime, project);
  }
  function normalizeProjectProfileArtifact(rawValue) {
    return getMediaProfileStateRuntime().normalizeProfileArtifact(rawValue);
  }
  function normalizeProjectProfileSignal(rawValue) {
    return getMediaProfileStateRuntime().normalizeProfileSignal(rawValue);
  }
  function normalizeProjectProcessState(rawValue) {
    return getProcessReportStateRuntime().normalizeProcessState(rawValue);
  }
  function normalizeProjectReportState(rawValue) {
    return getProcessReportStateRuntime().normalizeReportState(rawValue);
  }
  function readFeatureProcessRecord(project, featureId) {
    return getProjectStateRuntime().readFeatureProcessRecord(project, featureId);
  }
  function readFeatureReportRecord(project, featureId) {
    return getProjectStateRuntime().readFeatureReportRecord(project, featureId);
  }
  return {
    normalizeProjectProfileArtifact,
    normalizeProjectProfileSignal,
    normalizeProjectProcessState,
    normalizeProjectReportState,
    readFeatureProcessRecord,
    readFeatureReportRecord,
    serializeProject,
    serializeProjectSummary,
    syncProjectFeatureProjections
  };
}
