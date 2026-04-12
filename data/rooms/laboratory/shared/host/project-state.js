export function createLaboratoryProjectStateRuntime(deps) {
  const {
    roomSnapshotRuntime,
    runtimeStorage,
    syncProjectAudioAnalysisProjection,
    syncProjectProfileProjection,
    syncProjectSubtitleAnalysisProjection,
    toFileUrl
  } = deps;
  function serializeProjectSummary(project) {
    return roomSnapshotRuntime.serializeProjectSummary(project);
  }
  function serializeProject(project, runtime) {
    return roomSnapshotRuntime.serializeProject(project, runtime);
  }
  function syncProjectFeatureProjections(runtime, project) {
    syncProjectProfileProjection(runtime, project);
    syncProjectAudioAnalysisProjection(runtime, project);
    syncProjectSubtitleAnalysisProjection(runtime, project);
    return project;
  }
  function readFeatureProcessRecord(project, featureId) {
    return runtimeStorage.getFeatureProcessRecord(project, featureId);
  }
  function readFeatureReportRecord(project, featureId) {
    return runtimeStorage.getFeatureReportRecord(project, featureId);
  }
  function readProfileModelDescriptor(runtime, modelId) {
    return runtimeStorage.getProfileModelDescriptor(runtime, modelId);
  }
  function readProfileModelDescriptorMap(runtime) {
    return runtimeStorage.getProfileModelDescriptorMap(runtime);
  }
  function saveProfileModelState(runtime) {
    return runtimeStorage.persistProfileModelState(runtime);
  }
  function saveToolState(runtime) {
    return runtimeStorage.persistToolState(runtime);
  }
  function reloadProfileModelState(runtime) {
    return runtimeStorage.refreshProfileModelState(runtime);
  }
  return {
    readFeatureProcessRecord,
    readFeatureReportRecord,
    readProfileModelDescriptor,
    readProfileModelDescriptorMap,
    reloadProfileModelState,
    saveProfileModelState,
    saveToolState,
    serializeProject,
    serializeProjectSummary,
    syncProjectFeatureProjections,
    toFileUrl
  };
}
