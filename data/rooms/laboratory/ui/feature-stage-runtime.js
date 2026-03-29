import { createLaboratoryFeatureStageBundlesRuntime } from "./feature-stage-bundles.js";
import { createLaboratoryFeatureStagePanelsRuntime } from "./feature-stage-panels.js";
export function createLaboratoryFeatureStageRuntime(deps) {
  const laboratoryFeatureStagePanelsRuntime = createLaboratoryFeatureStagePanelsRuntime(deps);
  const laboratoryFeatureStageBundlesRuntime = createLaboratoryFeatureStageBundlesRuntime({
    ...deps,
    renderPreviewMetaRow: laboratoryFeatureStagePanelsRuntime.renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel: laboratoryFeatureStagePanelsRuntime.renderAudioAnalysisProviderPanel,
    renderAudioAnalysisModuleGrid: laboratoryFeatureStagePanelsRuntime.renderAudioAnalysisModuleGrid
  });
  return {
    ...laboratoryFeatureStagePanelsRuntime,
    ...laboratoryFeatureStageBundlesRuntime
  };
}
