type LaboratoryProcessStageUi<TProcessModule> = {
  getProcessModulePercent: (module: TProcessModule) => number;
  getProcessModuleTitle: (module: TProcessModule) => string;
  getRunningProcessJob: () => unknown;
};

type LaboratoryReportStageUi<TSignal> = {
  getRunningReportJob: () => unknown;
  renderReportFinding: (signal: TSignal) => string;
};

type MediaAnalysisProfilePanels = {
  renderProfilePresetPanel: () => string;
  renderProfileAdvancedPanel: () => string;
};

type MediaAnalysisProfileStage = {
  renderProfileTargetPanel: () => string;
  renderProfileModePanel: () => string;
  renderProfileSignalsPanel: () => string;
  renderProfileArtifactsPanel: () => string;
  renderProfileActionsPanel: () => string;
  renderProfileSummaryPanel: () => string;
};

type LaboratoryProfileProcessReportRuntimeDeps<TProcessModule, TSignal> = {
  laboratoryProcessStageUi: LaboratoryProcessStageUi<TProcessModule>;
  laboratoryReportStageUi: LaboratoryReportStageUi<TSignal>;
  mediaAnalysisProfilePanels: MediaAnalysisProfilePanels;
  mediaAnalysisProfileStage: MediaAnalysisProfileStage;
};

export function createLaboratoryProfileProcessReportRuntime<TProcessModule, TSignal>(
  deps: LaboratoryProfileProcessReportRuntimeDeps<TProcessModule, TSignal>,
) {
  const {
    laboratoryProcessStageUi,
    laboratoryReportStageUi,
    mediaAnalysisProfilePanels,
    mediaAnalysisProfileStage,
  } = deps;

  function renderProfileTargetPanel() {
    return mediaAnalysisProfileStage.renderProfileTargetPanel();
  }

  function renderProfileModePanel() {
    return mediaAnalysisProfileStage.renderProfileModePanel();
  }

  function renderProfilePresetPanel() {
    return mediaAnalysisProfilePanels.renderProfilePresetPanel();
  }

  function renderProfileAdvancedPanel() {
    return mediaAnalysisProfilePanels.renderProfileAdvancedPanel();
  }

  function renderProfileSignalsPanel() {
    return mediaAnalysisProfileStage.renderProfileSignalsPanel();
  }

  function renderProfileArtifactsPanel() {
    return mediaAnalysisProfileStage.renderProfileArtifactsPanel();
  }

  function renderProfileActionsPanel() {
    return mediaAnalysisProfileStage.renderProfileActionsPanel();
  }

  function renderProfileSummaryPanel() {
    return mediaAnalysisProfileStage.renderProfileSummaryPanel();
  }

  function getProcessModulePercent(module: TProcessModule) {
    return laboratoryProcessStageUi.getProcessModulePercent(module);
  }

  function getProcessModuleTitle(module: TProcessModule) {
    return laboratoryProcessStageUi.getProcessModuleTitle(module);
  }

  function getRunningProcessJob() {
    return laboratoryProcessStageUi.getRunningProcessJob();
  }

  function getRunningReportJob() {
    return laboratoryReportStageUi.getRunningReportJob();
  }

  function renderReportFinding(signal: TSignal) {
    return laboratoryReportStageUi.renderReportFinding(signal);
  }

  return {
    renderProfileTargetPanel: renderProfileTargetPanel,
    renderProfileModePanel: renderProfileModePanel,
    renderProfilePresetPanel: renderProfilePresetPanel,
    renderProfileAdvancedPanel: renderProfileAdvancedPanel,
    renderProfileSignalsPanel: renderProfileSignalsPanel,
    renderProfileArtifactsPanel: renderProfileArtifactsPanel,
    renderProfileActionsPanel: renderProfileActionsPanel,
    renderProfileSummaryPanel: renderProfileSummaryPanel,
    getProcessModulePercent: getProcessModulePercent,
    getProcessModuleTitle: getProcessModuleTitle,
    getRunningProcessJob: getRunningProcessJob,
    getRunningReportJob: getRunningReportJob,
    renderReportFinding: renderReportFinding,
  };
}
