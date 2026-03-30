import type { createLaboratoryRequestRuntime } from "../shared/ui/request-runtime.js";
import type { createLaboratoryUiDraftRuntime } from "../shared/ui/draft-runtime.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryUiEditRuntimeDeps = {
  deepClone: <T>(value: T) => T;
  isAudioAnalysisFeature: () => boolean;
  isSubtitleAnalysisFeature: () => boolean;
  laboratoryRequestRuntime: Pick<ReturnType<typeof createLaboratoryRequestRuntime>, "sendMediaAction">;
  laboratoryUiDraftRuntime: Pick<ReturnType<typeof createLaboratoryUiDraftRuntime>, "getCurrentEditDraft">;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryUiEditRuntime(deps: LaboratoryUiEditRuntimeDeps) {
  const deepClone = deps.deepClone;
  const isAudioAnalysisFeature = deps.isAudioAnalysisFeature;
  const isSubtitleAnalysisFeature = deps.isSubtitleAnalysisFeature;
  const laboratoryRequestRuntime = deps.laboratoryRequestRuntime;
  const laboratoryUiDraftRuntime = deps.laboratoryUiDraftRuntime;
  const toRecord = deps.toRecord;

  function buildCurrentEditRecipePatch() {
    return deepClone(toRecord(toRecord(laboratoryUiDraftRuntime.getCurrentEditDraft())["recipe"]));
  }

  function commitEditPatch(patch: LaboratoryRecord, action?: string | null) {
    return laboratoryRequestRuntime.sendMediaAction(
      action ||
        (isSubtitleAnalysisFeature() ? "subtitle-edit-update-recipe" : "edit-update-recipe"),
      {
        patch: patch,
        featureStage: "edit",
      }
    );
  }

  function chooseProfilePreset(profileId: unknown) {
    if (typeof profileId !== "string" || profileId.trim() === "") {
      return;
    }
    laboratoryRequestRuntime.sendMediaAction("profile-apply-preset", {
      presetId: profileId,
      featureStage: "profile",
    });
  }

  function restartProcess() {
    laboratoryRequestRuntime.sendMediaAction(
      isAudioAnalysisFeature() ? "audio-process-run" : "process-run",
      {
        featureStage: "process",
      }
    );
  }

  return {
    buildCurrentEditRecipePatch: buildCurrentEditRecipePatch,
    chooseProfilePreset: chooseProfilePreset,
    commitEditPatch: commitEditPatch,
    restartProcess: restartProcess,
  };
}
