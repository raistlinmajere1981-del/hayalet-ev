import { createAudioAnalysisCatalogRuntime } from "./catalog-runtime.js";
import { createAudioAnalysisProviderRuntime } from "./provider-runtime.js";
import { createAudioAnalysisResultRuntime } from "./result-runtime.js";

type LaboratoryAudioModuleEntry = Record<string, unknown>;

type AudioAnalysisUiDeps = Parameters<typeof createAudioAnalysisCatalogRuntime>[0] &
  Parameters<typeof createAudioAnalysisProviderRuntime>[0] &
  Omit<
    Parameters<typeof createAudioAnalysisResultRuntime>[0],
    | "getAudioAnalysisProviderLabel"
    | "getAudioAnalysisModuleTitle"
    | "getAudioAnalysisModuleSummary"
  >;

type AudioAnalysisUiRuntime = ReturnType<typeof createAudioAnalysisCatalogRuntime> &
  ReturnType<typeof createAudioAnalysisProviderRuntime> &
  ReturnType<typeof createAudioAnalysisResultRuntime>;

export function createAudioAnalysisUi(deps: AudioAnalysisUiDeps): AudioAnalysisUiRuntime {
  const audioAnalysisCatalogRuntime = createAudioAnalysisCatalogRuntime(deps);
  const audioAnalysisProviderRuntime = createAudioAnalysisProviderRuntime(deps);
  const audioAnalysisResultRuntime = createAudioAnalysisResultRuntime({
    ...deps,
    getAudioAnalysisModuleSummary: audioAnalysisProviderRuntime.getAudioAnalysisModuleSummary,
    getAudioAnalysisModuleTitle: audioAnalysisProviderRuntime.getAudioAnalysisModuleTitle,
    getAudioAnalysisProviderLabel: audioAnalysisProviderRuntime.getAudioAnalysisProviderLabel,
  });

  function renderAudioAnalysisCatalogPanel() {
    return audioAnalysisCatalogRuntime.renderAudioAnalysisCatalogPanel();
  }

  function renderAudioAnalysisNoticePanel() {
    return audioAnalysisCatalogRuntime.renderAudioAnalysisNoticePanel();
  }

  function getAudioAnalysisProviderStatusLabel(status: unknown) {
    return audioAnalysisProviderRuntime.getAudioAnalysisProviderStatusLabel(status);
  }

  function getAudioAnalysisProviderLabel(providerId: string) {
    return audioAnalysisProviderRuntime.getAudioAnalysisProviderLabel(providerId);
  }

  function getAudioAnalysisModuleTitle(moduleEntry: LaboratoryAudioModuleEntry) {
    return audioAnalysisProviderRuntime.getAudioAnalysisModuleTitle(moduleEntry);
  }

  function getAudioAnalysisModuleSummary(moduleEntry: LaboratoryAudioModuleEntry) {
    return audioAnalysisProviderRuntime.getAudioAnalysisModuleSummary(moduleEntry);
  }

  function renderAudioAnalysisProviderPanel() {
    return audioAnalysisProviderRuntime.renderAudioAnalysisProviderPanel();
  }

  function renderAudioAnalysisResultCard(moduleEntry: LaboratoryAudioModuleEntry) {
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
    renderAudioAnalysisResultCard,
  };
}
