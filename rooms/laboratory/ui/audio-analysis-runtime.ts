// @ts-nocheck
export function createLaboratoryAudioAnalysisRuntime(deps) {
  const { audioAnalysisUi } = deps;

  function renderAudioAnalysisCatalogPanel() {
    return audioAnalysisUi.renderAudioAnalysisCatalogPanel();
  }

  function renderAudioAnalysisNoticePanel() {
    return audioAnalysisUi.renderAudioAnalysisNoticePanel();
  }

  function renderAudioAnalysisProviderPanel() {
    return audioAnalysisUi.renderAudioAnalysisProviderPanel();
  }

  function renderAudioAnalysisModuleGrid() {
    return audioAnalysisUi.renderAudioAnalysisModuleGrid();
  }

  return {
    renderAudioAnalysisCatalogPanel: renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisNoticePanel: renderAudioAnalysisNoticePanel,
    renderAudioAnalysisProviderPanel: renderAudioAnalysisProviderPanel,
    renderAudioAnalysisModuleGrid: renderAudioAnalysisModuleGrid,
  };
}
