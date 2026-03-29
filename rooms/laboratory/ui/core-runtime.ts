import { createLaboratoryUiCoreBootstrapRuntime } from "./core-bootstrap.js";
import { buildLaboratoryUiCoreApi } from "./core-public-api.js";

export function createLaboratoryUiCoreRuntime(deps) {
  const laboratoryUiCoreBootstrapRuntime = createLaboratoryUiCoreBootstrapRuntime(deps);
  const uiRuntimeComposition = deps.createLaboratoryUiRuntimeComposition({
    laboratorySnapshotAccessRuntime:
      laboratoryUiCoreBootstrapRuntime.laboratorySnapshotAccessRuntime,
    laboratoryViewBindingsRuntime:
      laboratoryUiCoreBootstrapRuntime.laboratoryViewBindingsRuntime,
    mediaAnalysisUiRuntime: laboratoryUiCoreBootstrapRuntime.mediaAnalysisUiRuntime,
    laboratoryUiDraftRuntime: laboratoryUiCoreBootstrapRuntime.laboratoryUiDraftRuntime,
    laboratoryUiDraftAccessRuntime:
      laboratoryUiCoreBootstrapRuntime.laboratoryUiDraftAccessRuntime,
    laboratoryProfileProcessReportAccessorsRuntime:
      laboratoryUiCoreBootstrapRuntime.laboratoryProfileProcessReportAccessorsRuntime,
    isAudioAnalysisFeature: laboratoryUiCoreBootstrapRuntime.isAudioAnalysisFeature,
    isSubtitleAnalysisFeature:
      laboratoryUiCoreBootstrapRuntime.isSubtitleAnalysisFeature,
    collectProfileStageJobs(projectJobs) {
      return laboratoryUiCoreBootstrapRuntime.runtimeRefs.laboratoryStageAccessorsRuntime.collectProfileStageJobs(
        projectJobs
      );
    },
    collectProcessStageJobs(projectJobs) {
      return laboratoryUiCoreBootstrapRuntime.runtimeRefs.laboratoryStageAccessorsRuntime.collectProcessStageJobs(
        projectJobs
      );
    },
    collectReportStageJobs(projectJobs) {
      return laboratoryUiCoreBootstrapRuntime.runtimeRefs.laboratoryStageAccessorsRuntime.collectReportStageJobs(
        projectJobs
      );
    },
    setStage: laboratoryUiCoreBootstrapRuntime.setStage,
    subtitleText: laboratoryUiCoreBootstrapRuntime.subtitleText,
    text: laboratoryUiCoreBootstrapRuntime.text,
    textFromKey: laboratoryUiCoreBootstrapRuntime.textFromKey,
    toRecord: laboratoryUiCoreBootstrapRuntime.toRecord,
  });

  laboratoryUiCoreBootstrapRuntime.runtimeRefs.laboratoryUiFeatureRuntime =
    uiRuntimeComposition.laboratoryUiFeatureRuntime;
  laboratoryUiCoreBootstrapRuntime.runtimeRefs.laboratoryStageAccessorsRuntime =
    uiRuntimeComposition.laboratoryStageAccessorsRuntime;
  laboratoryUiCoreBootstrapRuntime.bindViewCompositionAccessors(uiRuntimeComposition);

  return buildLaboratoryUiCoreApi({
    ...laboratoryUiCoreBootstrapRuntime,
    uiRuntimeComposition,
  });
}
