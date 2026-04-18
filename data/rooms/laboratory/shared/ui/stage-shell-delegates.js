export function createLaboratoryStageShellDelegates(deps) {
  const laboratorySourceStageUi = deps.laboratorySourceStageUi;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const renderSubtitleEditStage = deps.renderSubtitleEditStage;
  const renderMediaAnalysisEditStage = deps.renderMediaAnalysisEditStage;
  const mediaAnalysisEditStageDeps = deps.mediaAnalysisEditStageDeps;
  const mediaAnalysisProfileStage = deps.mediaAnalysisProfileStage;
  const laboratoryProcessStageUi = deps.laboratoryProcessStageUi;
  const laboratoryReportStageUi = deps.laboratoryReportStageUi;
  function renderSourceStage() {
    return laboratorySourceStageUi.renderSourceStage();
  }
  function renderEditStage() {
    if (isSubtitleAnalysisFeature()) {
      return {
        main: renderSubtitleEditStage(),
        mainClassName: "lab-workspace__main--full"
      };
    }
    return {
      main: renderMediaAnalysisEditStage(mediaAnalysisEditStageDeps),
      mainClassName: "lab-workspace__main--full"
    };
  }
  function renderProfileStage() {
    return {
      main: mediaAnalysisProfileStage.renderProfileStage(),
      mainClassName: "lab-workspace__main--full"
    };
  }
  function renderProcessStage() {
    return laboratoryProcessStageUi.renderProcessStage();
  }
  function renderReportStage() {
    return laboratoryReportStageUi.renderReportStage();
  }
  return {
    renderEditStage,
    renderProcessStage,
    renderProfileStage,
    renderReportStage,
    renderSourceStage
  };
}
