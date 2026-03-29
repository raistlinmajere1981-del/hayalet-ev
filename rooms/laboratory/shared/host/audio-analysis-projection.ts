// @ts-nocheck
export function createLaboratoryAudioAnalysisProjectionRuntime(deps) {
  const { audioAnalysisProjectionRuntime } = deps;

  function buildAudioAnalysisCatalogProjection(runtime) {
    return audioAnalysisProjectionRuntime.buildAudioAnalysisCatalogProjection(runtime);
  }

  function buildAudioAnalysisProviderState(runtime, project) {
    return audioAnalysisProjectionRuntime.buildAudioAnalysisProviderState(runtime, project);
  }

  function buildAudioAnalysisCapabilityState(runtime, project, target, providerState) {
    return audioAnalysisProjectionRuntime.buildAudioAnalysisCapabilityState(
      runtime,
      project,
      target,
      providerState
    );
  }

  function getAudioAnalysisConfidenceRank(confidence) {
    return audioAnalysisProjectionRuntime.getAudioAnalysisConfidenceRank(confidence);
  }

  function mapAudioAnalysisResultStatus(processRecord, moduleEntry, capabilityEntry) {
    return audioAnalysisProjectionRuntime.mapAudioAnalysisResultStatus(
      processRecord,
      moduleEntry,
      capabilityEntry
    );
  }

  function buildAudioAnalysisModuleMetrics(signals, artifacts) {
    return audioAnalysisProjectionRuntime.buildAudioAnalysisModuleMetrics(signals, artifacts);
  }

  function buildAudioAnalysisModuleSummary(resultStatus, moduleEntry, capabilityEntry) {
    return audioAnalysisProjectionRuntime.buildAudioAnalysisModuleSummary(
      resultStatus,
      moduleEntry,
      capabilityEntry
    );
  }

  function syncProjectAudioAnalysisProjection(runtime, project) {
    return audioAnalysisProjectionRuntime.syncProjectAudioAnalysisProjection(runtime, project);
  }

  return {
    buildAudioAnalysisCapabilityState,
    buildAudioAnalysisCatalogProjection,
    buildAudioAnalysisModuleMetrics,
    buildAudioAnalysisModuleSummary,
    buildAudioAnalysisProviderState,
    getAudioAnalysisConfidenceRank,
    mapAudioAnalysisResultStatus,
    syncProjectAudioAnalysisProjection,
  };
}
