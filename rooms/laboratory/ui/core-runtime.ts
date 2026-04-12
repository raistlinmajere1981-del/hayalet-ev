import { createLaboratoryUiCoreBootstrapRuntime } from "./core-bootstrap.js";
import { buildLaboratoryUiCoreApi } from "./core-public-api.js";
import type { createLaboratoryUiRuntimeComposition } from "./runtime-composition.js";

type LaboratoryUiRuntimeCompositionRuntime = ReturnType<
  typeof createLaboratoryUiRuntimeComposition
>;
type LaboratoryProjectJobs = Parameters<
  LaboratoryUiRuntimeCompositionRuntime["laboratoryStageAccessorsRuntime"]["collectProfileStageJobs"]
>[0];

type LaboratoryUiCoreRuntimeDeps = Parameters<typeof createLaboratoryUiCoreBootstrapRuntime>[0] & {
  createLaboratoryUiRuntimeComposition: typeof createLaboratoryUiRuntimeComposition;
};

export function createLaboratoryUiCoreRuntime(deps: LaboratoryUiCoreRuntimeDeps) {
  const laboratoryUiCoreBootstrapRuntime = createLaboratoryUiCoreBootstrapRuntime(deps);

  function getStageAccessors() {
    const accessors = laboratoryUiCoreBootstrapRuntime.runtimeRefs.laboratoryStageAccessorsRuntime;
    if (!accessors) {
      throw new Error("Laboratory stage accessors runtime is not initialized");
    }
    return accessors;
  }

  const uiRuntimeComposition = deps.createLaboratoryUiRuntimeComposition({
    laboratorySnapshotAccessRuntime:
      laboratoryUiCoreBootstrapRuntime.laboratorySnapshotAccessRuntime,
    laboratoryViewBindingsRuntime: laboratoryUiCoreBootstrapRuntime.laboratoryViewBindingsRuntime,
    mediaAnalysisUiRuntime: laboratoryUiCoreBootstrapRuntime.mediaAnalysisUiRuntime,
    laboratoryUiDraftRuntime: laboratoryUiCoreBootstrapRuntime.laboratoryUiDraftRuntime,
    laboratoryUiDraftAccessRuntime: laboratoryUiCoreBootstrapRuntime.laboratoryUiDraftAccessRuntime,
    laboratoryProfileProcessReportAccessorsRuntime:
      laboratoryUiCoreBootstrapRuntime.laboratoryProfileProcessReportAccessorsRuntime,
    isAudioAnalysisFeature: laboratoryUiCoreBootstrapRuntime.isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: laboratoryUiCoreBootstrapRuntime.isSubtitleAnalysisFeature,
    collectProfileStageJobs(projectJobs: LaboratoryProjectJobs) {
      return getStageAccessors().collectProfileStageJobs(projectJobs);
    },
    collectProcessStageJobs(projectJobs: LaboratoryProjectJobs) {
      return getStageAccessors().collectProcessStageJobs(projectJobs);
    },
    collectReportStageJobs(projectJobs: LaboratoryProjectJobs) {
      return getStageAccessors().collectReportStageJobs(projectJobs);
    },
    getActiveFeatureId: laboratoryUiCoreBootstrapRuntime.getActiveFeatureId,
    setStage: laboratoryUiCoreBootstrapRuntime.setStage,
    subtitleText: laboratoryUiCoreBootstrapRuntime.subtitleText,
    text: laboratoryUiCoreBootstrapRuntime.text,
    textFromKey: laboratoryUiCoreBootstrapRuntime.textFromKey,
    toRecord: laboratoryUiCoreBootstrapRuntime.toRecord,
  } as Parameters<typeof deps.createLaboratoryUiRuntimeComposition>[0]);

  laboratoryUiCoreBootstrapRuntime.runtimeRefs.laboratoryUiFeatureRuntime =
    uiRuntimeComposition.laboratoryUiFeatureRuntime;
  laboratoryUiCoreBootstrapRuntime.runtimeRefs.laboratoryStageAccessorsRuntime =
    uiRuntimeComposition.laboratoryStageAccessorsRuntime;
  laboratoryUiCoreBootstrapRuntime.bindViewCompositionAccessors(uiRuntimeComposition);

  return buildLaboratoryUiCoreApi({
    ...laboratoryUiCoreBootstrapRuntime,
    uiRuntimeComposition,
  } as Parameters<typeof buildLaboratoryUiCoreApi>[0]);
}
