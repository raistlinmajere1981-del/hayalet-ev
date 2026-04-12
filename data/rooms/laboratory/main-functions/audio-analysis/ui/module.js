import { createAudioAnalysisCatalogRuntime } from "./catalog-runtime.js";
import { createAudioAnalysisProviderRuntime } from "./provider-runtime.js";
import { createAudioAnalysisResultRuntime } from "./result-runtime.js";
export function createAudioAnalysisUi(deps) {
  const audioAnalysisCatalogRuntime = createAudioAnalysisCatalogRuntime(deps);
  const audioAnalysisProviderRuntime = createAudioAnalysisProviderRuntime(deps);
  const audioAnalysisResultRuntime = createAudioAnalysisResultRuntime({
    ...deps,
    getAudioAnalysisModuleSummary: audioAnalysisProviderRuntime.getAudioAnalysisModuleSummary,
    getAudioAnalysisModuleTitle: audioAnalysisProviderRuntime.getAudioAnalysisModuleTitle,
    getAudioAnalysisProviderLabel: audioAnalysisProviderRuntime.getAudioAnalysisProviderLabel
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
    getAudioAnalysisModuleSummary,
    getAudioAnalysisModuleTitle,
    getAudioAnalysisProviderLabel,
    getAudioAnalysisProviderStatusLabel,
    renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisModuleGrid,
    renderAudioAnalysisNoticePanel,
    renderAudioAnalysisProviderPanel,
    renderAudioAnalysisResultCard
  };
}
