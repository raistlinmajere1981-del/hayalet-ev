import { createLaboratoryUiViewBaseRuntime } from "./view-runtime.js";
import { createLaboratoryUiFeatureRuntime } from "../shared/ui/feature-runtime.js";
import { createLaboratoryStageAccessorsRuntime } from "./stage-accessors-runtime.js";
import type { createMediaAnalysisUiRuntime } from "../main-functions/media-analysis/ui/runtime.js";
import type { createLaboratoryViewBindingsRuntime } from "./view-bindings-runtime.js";
import type { createLaboratorySnapshotAccessRuntime } from "./snapshot-access-runtime.js";

type LaboratoryUiFeatureRuntimeDeps = Parameters<typeof createLaboratoryUiFeatureRuntime>[0];
type LaboratoryStageAccessorsRuntimeDeps = Parameters<
  typeof createLaboratoryStageAccessorsRuntime
>[0];
type LaboratoryProjectJobs = Parameters<
  LaboratoryUiFeatureRuntimeDeps["collectProfileStageJobs"]
>[0];

type LaboratorySnapshotAccessRuntime = ReturnType<typeof createLaboratorySnapshotAccessRuntime>;
type LaboratoryViewBindingsRuntime = ReturnType<typeof createLaboratoryViewBindingsRuntime>;
type MediaAnalysisUiRuntime = ReturnType<typeof createMediaAnalysisUiRuntime>;

type LaboratoryUiRuntimeCompositionDeps = {
  collectProcessStageJobs: LaboratoryUiFeatureRuntimeDeps["collectProcessStageJobs"];
  collectProfileStageJobs: LaboratoryUiFeatureRuntimeDeps["collectProfileStageJobs"];
  collectReportStageJobs: LaboratoryUiFeatureRuntimeDeps["collectReportStageJobs"];
  getActiveFeatureId: LaboratoryUiFeatureRuntimeDeps["getActiveFeatureId"];
  isAudioAnalysisFeature: LaboratoryUiFeatureRuntimeDeps["isAudioAnalysisFeature"];
  isSubtitleAnalysisFeature: LaboratoryUiFeatureRuntimeDeps["isSubtitleAnalysisFeature"];
  laboratoryProfileProcessReportAccessorsRuntime: LaboratoryStageAccessorsRuntimeDeps["laboratoryProfileProcessReportAccessorsRuntime"];
  laboratorySnapshotAccessRuntime: LaboratorySnapshotAccessRuntime;
  laboratoryUiDraftAccessRuntime: LaboratoryStageAccessorsRuntimeDeps["laboratoryUiDraftAccessRuntime"];
  laboratoryUiDraftRuntime: LaboratoryStageAccessorsRuntimeDeps["laboratoryUiDraftRuntime"];
  laboratoryViewBindingsRuntime: LaboratoryViewBindingsRuntime;
  mediaAnalysisUiRuntime: MediaAnalysisUiRuntime;
  setStage: LaboratoryStageAccessorsRuntimeDeps["setStage"];
  subtitleText: LaboratoryStageAccessorsRuntimeDeps["subtitleText"];
  text: LaboratoryStageAccessorsRuntimeDeps["text"];
  textFromKey: LaboratoryUiFeatureRuntimeDeps["textFromKey"];
  toRecord: LaboratoryUiFeatureRuntimeDeps["toRecord"];
};

export function createLaboratoryUiRuntimeComposition(deps: LaboratoryUiRuntimeCompositionDeps) {
  const laboratoryUiRuntimeBase = createLaboratoryUiViewBaseRuntime({
    laboratorySnapshotAccessRuntime: deps.laboratorySnapshotAccessRuntime,
    laboratoryViewBindingsRuntime: deps.laboratoryViewBindingsRuntime,
    mediaAnalysisUiRuntime: deps.mediaAnalysisUiRuntime,
  });

  const laboratoryUiFeatureRuntime = createLaboratoryUiFeatureRuntime({
    getActiveFeatureId: deps.getActiveFeatureId,
    getActiveProject: function () {
      return laboratoryUiRuntimeBase.getActiveProject();
    },
    getActiveSubtitleEntry: function () {
      return laboratoryUiRuntimeBase.getActiveSubtitleEntry();
    },
    getAudioAnalysisOrderedResultEntries: function () {
      return laboratoryUiRuntimeBase.getAudioAnalysisOrderedResultEntries();
    },
    getAudioAnalysisSourceState: function () {
      return laboratoryUiRuntimeBase.getAudioAnalysisSourceState();
    },
    getCurrentSourceLabel: function () {
      return laboratoryUiRuntimeBase.getCurrentSourceLabel();
    },
    getCurrentSourceKind: function () {
      return laboratoryUiRuntimeBase.getCurrentSourceKind();
    },
    getEditOutputs: function () {
      return laboratoryUiRuntimeBase.getEditOutputs();
    },
    getJobs: function () {
      return laboratoryUiRuntimeBase.getJobs();
    },
    getProfileModelsCatalog: function () {
      return laboratoryUiRuntimeBase.getProfileModelsCatalog();
    },
    getProfileModelState: function () {
      return laboratoryUiRuntimeBase.getProfileModelState();
    },
    getProfilePresets: function () {
      return laboratoryUiRuntimeBase.getProfilePresets();
    },
    getProjectProfile: function () {
      return laboratoryUiRuntimeBase.getProjectProfile();
    },
    getProjectProcess: function () {
      return laboratoryUiRuntimeBase.getProjectProcess();
    },
    getProjectReport: function () {
      return laboratoryUiRuntimeBase.getProjectReport();
    },
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    textFromKey: deps.textFromKey,
    toRecord: deps.toRecord,
    collectProfileStageJobs: function (projectJobs: LaboratoryProjectJobs) {
      return deps.collectProfileStageJobs(projectJobs);
    },
    collectProcessStageJobs: function (projectJobs: LaboratoryProjectJobs) {
      return deps.collectProcessStageJobs(projectJobs);
    },
    collectReportStageJobs: function (projectJobs: LaboratoryProjectJobs) {
      return deps.collectReportStageJobs(projectJobs);
    },
  });

  const laboratoryStageAccessorsRuntime = createLaboratoryStageAccessorsRuntime({
    laboratoryProfileProcessReportAccessorsRuntime:
      deps.laboratoryProfileProcessReportAccessorsRuntime,
    laboratoryUiDraftAccessRuntime: deps.laboratoryUiDraftAccessRuntime,
    laboratoryUiDraftRuntime: deps.laboratoryUiDraftRuntime,
    laboratoryUiFeatureRuntime: laboratoryUiFeatureRuntime,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    setStage: deps.setStage,
    subtitleText: deps.subtitleText,
    text: deps.text,
    toRecord: deps.toRecord,
  });

  return {
    ...laboratoryUiRuntimeBase,
    ...laboratoryUiFeatureRuntime,
    ...laboratoryStageAccessorsRuntime,
    laboratoryStageAccessorsRuntime,
    laboratoryUiFeatureRuntime,
    laboratoryUiRuntimeBase,
  };
}
