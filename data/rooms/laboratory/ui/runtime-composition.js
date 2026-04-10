import { createLaboratoryUiViewBaseRuntime } from "./view-runtime.js";
import { createLaboratoryUiFeatureRuntime } from "../shared/ui/feature-runtime.js";
import { createLaboratoryStageAccessorsRuntime } from "./stage-accessors-runtime.js";
export function createLaboratoryUiRuntimeComposition(deps) {
  const laboratoryUiRuntimeBase = createLaboratoryUiViewBaseRuntime({
    laboratorySnapshotAccessRuntime: deps.laboratorySnapshotAccessRuntime,
    laboratoryViewBindingsRuntime: deps.laboratoryViewBindingsRuntime,
    mediaAnalysisUiRuntime: deps.mediaAnalysisUiRuntime
  });
  const laboratoryUiFeatureRuntime = createLaboratoryUiFeatureRuntime({
    getActiveProject: function() {
      return laboratoryUiRuntimeBase.getActiveProject();
    },
    getActiveSubtitleEntry: function() {
      return laboratoryUiRuntimeBase.getActiveSubtitleEntry();
    },
    getAudioAnalysisOrderedResultEntries: function() {
      return laboratoryUiRuntimeBase.getAudioAnalysisOrderedResultEntries();
    },
    getAudioAnalysisSourceState: function() {
      return laboratoryUiRuntimeBase.getAudioAnalysisSourceState();
    },
    getCurrentSourceLabel: function() {
      return laboratoryUiRuntimeBase.getCurrentSourceLabel();
    },
    getCurrentSourceKind: function() {
      return laboratoryUiRuntimeBase.getCurrentSourceKind();
    },
    getEditOutputs: function() {
      return laboratoryUiRuntimeBase.getEditOutputs();
    },
    getJobs: function() {
      return laboratoryUiRuntimeBase.getJobs();
    },
    getProfileModelsCatalog: function() {
      return laboratoryUiRuntimeBase.getProfileModelsCatalog();
    },
    getProfileModelState: function() {
      return laboratoryUiRuntimeBase.getProfileModelState();
    },
    getProfilePresets: function() {
      return laboratoryUiRuntimeBase.getProfilePresets();
    },
    getProjectProfile: function() {
      return laboratoryUiRuntimeBase.getProjectProfile();
    },
    getProjectProcess: function() {
      return laboratoryUiRuntimeBase.getProjectProcess();
    },
    getProjectReport: function() {
      return laboratoryUiRuntimeBase.getProjectReport();
    },
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    textFromKey: deps.textFromKey,
    toRecord: deps.toRecord,
    collectProfileStageJobs: function(projectJobs) {
      return deps.collectProfileStageJobs(projectJobs);
    },
    collectProcessStageJobs: function(projectJobs) {
      return deps.collectProcessStageJobs(projectJobs);
    },
    collectReportStageJobs: function(projectJobs) {
      return deps.collectReportStageJobs(projectJobs);
    }
  });
  const laboratoryStageAccessorsRuntime = createLaboratoryStageAccessorsRuntime({
    laboratoryProfileProcessReportAccessorsRuntime: deps.laboratoryProfileProcessReportAccessorsRuntime,
    laboratoryUiDraftAccessRuntime: deps.laboratoryUiDraftAccessRuntime,
    laboratoryUiDraftRuntime: deps.laboratoryUiDraftRuntime,
    laboratoryUiFeatureRuntime,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    setStage: deps.setStage,
    subtitleText: deps.subtitleText,
    text: deps.text,
    toRecord: deps.toRecord
  });
  return {
    ...laboratoryUiRuntimeBase,
    ...laboratoryUiFeatureRuntime,
    ...laboratoryStageAccessorsRuntime,
    laboratoryStageAccessorsRuntime,
    laboratoryUiFeatureRuntime,
    laboratoryUiRuntimeBase
  };
}
