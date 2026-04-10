import { createLaboratoryFeatureStageBundlesRuntime } from "./feature-stage-bundles.js";
import { createLaboratoryFeatureStagePanelsRuntime } from "./feature-stage-panels.js";
export function createLaboratoryFeatureStageRuntime(deps) {
  const laboratoryFeatureStagePanelsRuntime = createLaboratoryFeatureStagePanelsRuntime(deps);
  const renderPreviewMetaRow = laboratoryFeatureStagePanelsRuntime.renderPreviewMetaRow;
  const renderAudioAnalysisProviderPanel = laboratoryFeatureStagePanelsRuntime.renderAudioAnalysisProviderPanel;
  const renderAudioAnalysisModuleGrid = laboratoryFeatureStagePanelsRuntime.renderAudioAnalysisModuleGrid;
  const laboratoryFeatureStageBundlesRuntime = createLaboratoryFeatureStageBundlesRuntime({
    ...deps,
    renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel,
    renderAudioAnalysisModuleGrid
  });
  return {
    ...laboratoryFeatureStagePanelsRuntime,
    ...laboratoryFeatureStageBundlesRuntime
  };
}
