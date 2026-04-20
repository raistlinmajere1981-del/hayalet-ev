export function createLaboratoryUiEditRuntime(deps) {
  const deepClone = deps.deepClone;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const laboratoryRequestRuntime = deps.laboratoryRequestRuntime;
  const laboratoryUiDraftRuntime = deps.laboratoryUiDraftRuntime;
  const toRecord = deps.toRecord;
  function buildCurrentEditRecipePatch() {
    return deepClone(toRecord(toRecord(laboratoryUiDraftRuntime.getCurrentEditDraft())["recipe"]));
  }
  function commitEditPatch(patch, action) {
    return laboratoryRequestRuntime.sendMediaAction(
      action || (isSubtitleAnalysisFeature() ? "subtitle-edit-update-recipe" : "edit-update-recipe"),
      {
        patch,
        featureStage: "edit"
      }
    );
  }
  function chooseProfilePreset(profileId) {
    if (typeof profileId !== "string" || profileId.trim() === "") {
      return;
    }
    laboratoryRequestRuntime.sendMediaAction("profile-apply-preset", {
      presetId: profileId,
      featureStage: "profile"
    });
  }
  function restartProcess() {
    laboratoryRequestRuntime.sendMediaAction(
      isAudioAnalysisFeature() ? "audio-process-run" : "process-run",
      {
        featureStage: "process"
      }
    );
  }
  return {
    buildCurrentEditRecipePatch,
    chooseProfilePreset,
    commitEditPatch,
    restartProcess
  };
}
