// @ts-nocheck
export function createLaboratoryStageAccessorsRuntime(deps) {
  const laboratoryUiFeatureRuntime = deps.laboratoryUiFeatureRuntime;
  const laboratoryUiDraftRuntime = deps.laboratoryUiDraftRuntime;
  const laboratoryUiDraftAccessRuntime = deps.laboratoryUiDraftAccessRuntime;
  const laboratoryProfileProcessReportAccessorsRuntime =
    deps.laboratoryProfileProcessReportAccessorsRuntime;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const toRecord = deps.toRecord;
  const text = deps.text;
  const subtitleText = deps.subtitleText;
  const setStage = deps.setStage;

  function getRelevantJobs() {
    return laboratoryUiFeatureRuntime.getRelevantJobs();
  }

  function collectEditStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectEditStageJobs(projectJobs);
  }

  function collectProfileStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectProfileStageJobs(projectJobs);
  }

  function collectProcessStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectProcessStageJobs(projectJobs);
  }

  function collectReportStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectReportStageJobs(projectJobs);
  }

  function getEditJobLabel(job) {
    if (isSubtitleAnalysisFeature()) {
      switch (String(toRecord(job).action || "")) {
        case "subtitle-edit-preview":
          return subtitleText(["edit", "jobs", "preview"], "Temizleme Onizlemesi", "Cleanup Preview");
        case "subtitle-edit-apply":
          return subtitleText(["edit", "jobs", "apply"], "Temizleme Uygula", "Apply Cleanup");
        default:
          return subtitleText(["edit", "jobs", "default"], "Altyazi Duzenleme", "Subtitle Edit");
      }
    }

    switch (String(toRecord(job).action || "")) {
      case "edit-preview":
        return text(["mediaAnalysis", "edit", "actions", "preview"]);
      case "edit-apply":
        return text(["mediaAnalysis", "edit", "actions", "apply"]);
      default:
        return text(["mediaAnalysis", "edit", "jobsTitle"]);
    }
  }

  function getCurrentDrafts() {
    return laboratoryUiDraftAccessRuntime.getCurrentDrafts();
  }

  function getCurrentEditDraft() {
    return laboratoryUiDraftAccessRuntime.getCurrentEditDraft();
  }

  function buildNestedPatch(path, value) {
    return laboratoryUiDraftAccessRuntime.buildNestedPatch(path, value);
  }

  function syncLocalEditField(path, value) {
    laboratoryUiDraftAccessRuntime.syncLocalEditField(path, value);
  }

  function getProfileLabel() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileLabel();
  }

  function getFocusLabel() {
    return laboratoryProfileProcessReportAccessorsRuntime.getFocusLabel();
  }

  function getCurrentProfileMode() {
    return laboratoryProfileProcessReportAccessorsRuntime.getCurrentProfileMode();
  }

  function getProfileLaneMap() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileLaneMap();
  }

  function getCompatibleProfileLaneIds() {
    return laboratoryProfileProcessReportAccessorsRuntime.getCompatibleProfileLaneIds();
  }

  function getProfilePresetOptions() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfilePresetOptions();
  }

  function getProfileReadiness() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileReadiness();
  }

  function getProfileEstimate() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileEstimate();
  }

  function getProfilePreflight() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfilePreflight();
  }

  function getProfileSignals() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileSignals();
  }

  function getProfileArtifacts() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileArtifacts();
  }

  function getProfileTargetSummary() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileTargetSummary();
  }

  function getProfileTargetMode() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileTargetMode();
  }

  function getProfileModelEntries() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileModelEntries();
  }

  function getProfileSelectedModel() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileSelectedModel();
  }

  function getProfileJobs() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileJobs();
  }

  function getProcessJobs() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProcessJobs();
  }

  function getReportJobs() {
    return laboratoryProfileProcessReportAccessorsRuntime.getReportJobs();
  }

  function getProcessModules() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProcessModules();
  }

  function getProcessFindings() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProcessFindings();
  }

  function getProcessArtifacts() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProcessArtifacts();
  }

  function getReportSummaryCards() {
    return laboratoryProfileProcessReportAccessorsRuntime.getReportSummaryCards();
  }

  function getReportFindings() {
    return laboratoryProfileProcessReportAccessorsRuntime.getReportFindings();
  }

  function getReportExports() {
    return laboratoryProfileProcessReportAccessorsRuntime.getReportExports();
  }

  function getCurrentFeatureTargetLabel() {
    return laboratoryProfileProcessReportAccessorsRuntime.getCurrentFeatureTargetLabel();
  }

  function getCurrentFeatureArtifactCount() {
    return laboratoryProfileProcessReportAccessorsRuntime.getCurrentFeatureArtifactCount();
  }

  function getProfileTargetOutputOptions() {
    return laboratoryProfileProcessReportAccessorsRuntime.getProfileTargetOutputOptions();
  }

  function openReport() {
    setStage("report");
  }

  function resetJourney() {
    setStage("source");
  }

  function buildCurrentDraftPayload() {
    return laboratoryUiDraftAccessRuntime.buildCurrentDraftPayload();
  }

  return {
    buildCurrentDraftPayload: buildCurrentDraftPayload,
    buildNestedPatch: buildNestedPatch,
    collectEditStageJobs: collectEditStageJobs,
    collectProcessStageJobs: collectProcessStageJobs,
    collectProfileStageJobs: collectProfileStageJobs,
    collectReportStageJobs: collectReportStageJobs,
    getCompatibleProfileLaneIds: getCompatibleProfileLaneIds,
    getCurrentDrafts: getCurrentDrafts,
    getCurrentEditDraft: getCurrentEditDraft,
    getCurrentFeatureArtifactCount: getCurrentFeatureArtifactCount,
    getCurrentFeatureTargetLabel: getCurrentFeatureTargetLabel,
    getCurrentProfileMode: getCurrentProfileMode,
    getEditJobLabel: getEditJobLabel,
    getFocusLabel: getFocusLabel,
    getProcessArtifacts: getProcessArtifacts,
    getProcessFindings: getProcessFindings,
    getProcessJobs: getProcessJobs,
    getProcessModules: getProcessModules,
    getProfileArtifacts: getProfileArtifacts,
    getProfileEstimate: getProfileEstimate,
    getProfileJobs: getProfileJobs,
    getProfileLabel: getProfileLabel,
    getProfileLaneMap: getProfileLaneMap,
    getProfileModelEntries: getProfileModelEntries,
    getProfilePreflight: getProfilePreflight,
    getProfilePresetOptions: getProfilePresetOptions,
    getProfileReadiness: getProfileReadiness,
    getProfileSelectedModel: getProfileSelectedModel,
    getProfileSignals: getProfileSignals,
    getProfileTargetMode: getProfileTargetMode,
    getProfileTargetOutputOptions: getProfileTargetOutputOptions,
    getProfileTargetSummary: getProfileTargetSummary,
    getRelevantJobs: getRelevantJobs,
    getReportExports: getReportExports,
    getReportFindings: getReportFindings,
    getReportJobs: getReportJobs,
    getReportSummaryCards: getReportSummaryCards,
    openReport: openReport,
    resetJourney: resetJourney,
    syncLocalEditField: syncLocalEditField,
  };
}
