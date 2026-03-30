type LaboratoryAudioAnalysisUi = {
  renderAudioAnalysisCatalogPanel: () => string;
  renderAudioAnalysisNoticePanel: () => string;
  renderAudioAnalysisProviderPanel: () => string;
  renderAudioAnalysisModuleGrid: () => string;
};

type LaboratoryAudioAnalysisRuntimeDeps<TAudioAnalysisUi extends LaboratoryAudioAnalysisUi> = {
  audioAnalysisUi: TAudioAnalysisUi;
};

export function createLaboratoryAudioAnalysisRuntime<
  TAudioAnalysisUi extends LaboratoryAudioAnalysisUi,
>(deps: LaboratoryAudioAnalysisRuntimeDeps<TAudioAnalysisUi>) {
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
