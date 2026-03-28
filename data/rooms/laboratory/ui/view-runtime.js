export function createLaboratoryUiViewBaseRuntime(deps) {
  return {
    ...deps.laboratorySnapshotAccessRuntime,
    ...deps.laboratoryViewBindingsRuntime,
    ...deps.mediaAnalysisUiRuntime,
  };
}
