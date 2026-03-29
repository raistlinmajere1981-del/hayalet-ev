import { createAudioAnalysisCatalogRuntime } from "./catalog-runtime.js";
import { createAudioAnalysisProviderRuntime } from "./provider-runtime.js";
import { createAudioAnalysisResultRuntime } from "./result-runtime.js";

type AudioAnalysisUiDeps =
  & Parameters<typeof createAudioAnalysisCatalogRuntime>[0]
  & Parameters<typeof createAudioAnalysisProviderRuntime>[0]
  & Omit<
    Parameters<typeof createAudioAnalysisResultRuntime>[0],
    "getAudioAnalysisProviderLabel" | "getAudioAnalysisModuleTitle" | "getAudioAnalysisModuleSummary"
  >;

type AudioAnalysisUiRuntime =
  & ReturnType<typeof createAudioAnalysisCatalogRuntime>
  & ReturnType<typeof createAudioAnalysisProviderRuntime>
  & ReturnType<typeof createAudioAnalysisResultRuntime>;

export function createAudioAnalysisUi(deps: AudioAnalysisUiDeps): AudioAnalysisUiRuntime {
  const audioAnalysisCatalogRuntime = createAudioAnalysisCatalogRuntime(deps);
  const audioAnalysisProviderRuntime = createAudioAnalysisProviderRuntime(deps);
  const audioAnalysisResultRuntime = createAudioAnalysisResultRuntime({
    ...deps,
    getAudioAnalysisProviderLabel:
      audioAnalysisProviderRuntime.getAudioAnalysisProviderLabel,
    getAudioAnalysisModuleTitle:
      audioAnalysisProviderRuntime.getAudioAnalysisModuleTitle,
    getAudioAnalysisModuleSummary:
      audioAnalysisProviderRuntime.getAudioAnalysisModuleSummary,
  });

  function renderAudioAnalysisCatalogPanel() {
    return audioAnalysisCatalogRuntime.renderAudioAnalysisCatalogPanel();
  }

  function renderAudioAnalysisNoticePanel() {
    return audioAnalysisCatalogRuntime.renderAudioAnalysisNoticePanel();
  }

  function getAudioAnalysisProviderStatusLabel(status) {
    return audioAnalysisProviderRuntime.getAudioAnalysisProviderStatusLabel(status);
  }

  function getAudioAnalysisProviderLabel(providerId) {
    return audioAnalysisProviderRuntime.getAudioAnalysisProviderLabel(providerId);
  }

  function getAudioAnalysisModuleTitle(moduleEntry) {
    return audioAnalysisProviderRuntime.getAudioAnalysisModuleTitle(moduleEntry);
  }

  function getAudioAnalysisModuleSummary(moduleEntry) {
    return audioAnalysisProviderRuntime.getAudioAnalysisModuleSummary(moduleEntry);
  }

  function renderAudioAnalysisProviderPanel() {
    return audioAnalysisProviderRuntime.renderAudioAnalysisProviderPanel();
  }

  function renderAudioAnalysisResultCard(moduleEntry) {
    return audioAnalysisResultRuntime.renderAudioAnalysisResultCard(moduleEntry);
  }

  function renderAudioAnalysisModuleGrid() {
    return audioAnalysisResultRuntime.renderAudioAnalysisModuleGrid();
  }

  return {
    renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisNoticePanel,
    getAudioAnalysisProviderStatusLabel,
    renderAudioAnalysisProviderPanel,
    getAudioAnalysisProviderLabel,
    getAudioAnalysisModuleTitle,
    getAudioAnalysisModuleSummary,
    renderAudioAnalysisResultCard,
    renderAudioAnalysisModuleGrid,
  };
}
