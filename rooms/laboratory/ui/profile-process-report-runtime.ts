// @ts-nocheck
export function createLaboratoryProfileProcessReportRuntime(deps) {
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

  function getProcessModulePercent(module) {
    return laboratoryProcessStageUi.getProcessModulePercent(module);
  }

  function getProcessModuleTitle(module) {
    return laboratoryProcessStageUi.getProcessModuleTitle(module);
  }

  function getRunningProcessJob() {
    return laboratoryProcessStageUi.getRunningProcessJob();
  }

  function getRunningReportJob() {
    return laboratoryReportStageUi.getRunningReportJob();
  }

  function renderReportFinding(signal) {
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
