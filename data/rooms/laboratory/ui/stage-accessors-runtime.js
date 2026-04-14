export function createLaboratoryStageAccessorsRuntime(deps) {
  const {
    isSubtitleAnalysisFeature,
    laboratoryProfileProcessReportAccessorsRuntime,
    laboratoryUiDraftAccessRuntime,
    laboratoryUiDraftRuntime,
    laboratoryUiFeatureRuntime,
    setStage,
    subtitleText,
    text,
    toRecord
  } = deps;
  function getRelevantJobs() {
    return laboratoryUiFeatureRuntime.getRelevantJobs();
  }
  function collectEditStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectEditStageJobs(
      projectJobs
    );
  }
  function collectProfileStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectProfileStageJobs(
      projectJobs
    );
  }
  function collectProcessStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectProcessStageJobs(
      projectJobs
    );
  }
  function collectReportStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectReportStageJobs(
      projectJobs
    );
  }
  function getEditJobLabel(job) {
    const jobRecord = toRecord(job);
    const jobAction = typeof jobRecord["action"] === "string" ? jobRecord["action"] : "";
    if (isSubtitleAnalysisFeature()) {
      switch (jobAction) {
        case "subtitle-edit-preview":
          return subtitleText(
            ["edit", "jobs", "preview"],
            "Temizleme Onizlemesi",
            "Cleanup Preview"
          );
        case "subtitle-edit-apply":
          return subtitleText(["edit", "jobs", "apply"], "Temizleme Uygula", "Apply Cleanup");
        default:
          return subtitleText(["edit", "jobs", "default"], "Altyazi Duzenleme", "Subtitle Edit");
      }
    }
    switch (jobAction) {
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
    buildCurrentDraftPayload,
    buildNestedPatch,
    collectEditStageJobs,
    collectProcessStageJobs,
    collectProfileStageJobs,
    collectReportStageJobs,
    getCompatibleProfileLaneIds,
    getCurrentDrafts,
    getCurrentEditDraft,
    getCurrentFeatureArtifactCount,
    getCurrentFeatureTargetLabel,
    getCurrentProfileMode,
    getEditJobLabel,
    getFocusLabel,
    getProcessArtifacts,
    getProcessFindings,
    getProcessJobs,
    getProcessModules,
    getProfileArtifacts,
    getProfileEstimate,
    getProfileJobs,
    getProfileLabel,
    getProfileLaneMap,
    getProfileModelEntries,
    getProfilePreflight,
    getProfilePresetOptions,
    getProfileReadiness,
    getProfileSelectedModel,
    getProfileSignals,
    getProfileTargetMode,
    getProfileTargetOutputOptions,
    getProfileTargetSummary,
    getRelevantJobs,
    getReportExports,
    getReportFindings,
    getReportJobs,
    getReportSummaryCards,
    openReport,
    resetJourney,
    syncLocalEditField
  };
}
