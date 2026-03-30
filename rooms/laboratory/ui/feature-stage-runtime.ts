import { createLaboratoryFeatureStageBundlesRuntime } from "./feature-stage-bundles.js";
import { createLaboratoryFeatureStagePanelsRuntime } from "./feature-stage-panels.js";

type LaboratoryFeatureStageRuntimeDeps = Parameters<
  typeof createLaboratoryFeatureStagePanelsRuntime
>[0] &
  Omit<
    Parameters<typeof createLaboratoryFeatureStageBundlesRuntime>[0],
    "renderPreviewMetaRow" | "renderAudioAnalysisProviderPanel" | "renderAudioAnalysisModuleGrid"
  >;

type LaboratoryFeatureStageRuntime = ReturnType<typeof createLaboratoryFeatureStagePanelsRuntime> &
  ReturnType<typeof createLaboratoryFeatureStageBundlesRuntime>;
type LaboratoryFeatureStageBundlesRuntimeDeps = Parameters<
  typeof createLaboratoryFeatureStageBundlesRuntime
>[0];

export function createLaboratoryFeatureStageRuntime(
  deps: LaboratoryFeatureStageRuntimeDeps
): LaboratoryFeatureStageRuntime {
  const laboratoryFeatureStagePanelsRuntime = createLaboratoryFeatureStagePanelsRuntime(deps);
  const renderPreviewMetaRow = laboratoryFeatureStagePanelsRuntime.renderPreviewMetaRow;
  const renderAudioAnalysisProviderPanel =
    laboratoryFeatureStagePanelsRuntime.renderAudioAnalysisProviderPanel;
  const renderAudioAnalysisModuleGrid =
    laboratoryFeatureStagePanelsRuntime.renderAudioAnalysisModuleGrid;
  const laboratoryFeatureStageBundlesRuntime = createLaboratoryFeatureStageBundlesRuntime({
    ...deps,
    renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel,
    renderAudioAnalysisModuleGrid,
  } as unknown as LaboratoryFeatureStageBundlesRuntimeDeps);

  return {
    ...laboratoryFeatureStagePanelsRuntime,
    ...laboratoryFeatureStageBundlesRuntime,
  };
}
