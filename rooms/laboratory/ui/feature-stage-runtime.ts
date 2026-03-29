import { createLaboratoryFeatureStageBundlesRuntime } from "./feature-stage-bundles.js";
import { createLaboratoryFeatureStagePanelsRuntime } from "./feature-stage-panels.js";

type LaboratoryFeatureStageRuntimeDeps =
  & Parameters<typeof createLaboratoryFeatureStagePanelsRuntime>[0]
  & Omit<
    Parameters<typeof createLaboratoryFeatureStageBundlesRuntime>[0],
    "renderPreviewMetaRow" | "renderAudioAnalysisProviderPanel" | "renderAudioAnalysisModuleGrid"
  >;

type LaboratoryFeatureStageRuntime =
  & ReturnType<typeof createLaboratoryFeatureStagePanelsRuntime>
  & ReturnType<typeof createLaboratoryFeatureStageBundlesRuntime>;

export function createLaboratoryFeatureStageRuntime(
  deps: LaboratoryFeatureStageRuntimeDeps,
): LaboratoryFeatureStageRuntime {
  const laboratoryFeatureStagePanelsRuntime = createLaboratoryFeatureStagePanelsRuntime(deps);
  const laboratoryFeatureStageBundlesRuntime = createLaboratoryFeatureStageBundlesRuntime({
    ...deps,
    renderPreviewMetaRow: laboratoryFeatureStagePanelsRuntime.renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel:
      laboratoryFeatureStagePanelsRuntime.renderAudioAnalysisProviderPanel,
    renderAudioAnalysisModuleGrid:
      laboratoryFeatureStagePanelsRuntime.renderAudioAnalysisModuleGrid,
  });

  return {
    ...laboratoryFeatureStagePanelsRuntime,
    ...laboratoryFeatureStageBundlesRuntime,
  };
}
