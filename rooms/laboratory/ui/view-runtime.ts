type LaboratoryUiViewBaseRuntimeDeps<
  TSnapshotAccessRuntime extends object,
  TViewBindingsRuntime extends object,
  TMediaAnalysisUiRuntime extends object,
> = {
  laboratorySnapshotAccessRuntime: TSnapshotAccessRuntime;
  laboratoryViewBindingsRuntime: TViewBindingsRuntime;
  mediaAnalysisUiRuntime: TMediaAnalysisUiRuntime;
};

export function createLaboratoryUiViewBaseRuntime<
  TSnapshotAccessRuntime extends object,
  TViewBindingsRuntime extends object,
  TMediaAnalysisUiRuntime extends object,
>(
  deps: LaboratoryUiViewBaseRuntimeDeps<
    TSnapshotAccessRuntime,
    TViewBindingsRuntime,
    TMediaAnalysisUiRuntime
  >,
) {
  return {
    ...deps.laboratorySnapshotAccessRuntime,
    ...deps.laboratoryViewBindingsRuntime,
    ...deps.mediaAnalysisUiRuntime,
  };
}
