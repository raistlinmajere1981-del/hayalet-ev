// @ts-nocheck
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
      return renderSubtitleEditStage();
    }
    return renderMediaAnalysisEditStage(mediaAnalysisEditStageDeps);
  }

  function renderProfileStage() {
    return mediaAnalysisProfileStage.renderProfileStage();
  }

  function renderProcessStage() {
    return laboratoryProcessStageUi.renderProcessStage();
  }

  function renderReportStage() {
    return laboratoryReportStageUi.renderReportStage();
  }

  return {
    renderEditStage: renderEditStage,
    renderProcessStage: renderProcessStage,
    renderProfileStage: renderProfileStage,
    renderReportStage: renderReportStage,
    renderSourceStage: renderSourceStage,
  };
}
