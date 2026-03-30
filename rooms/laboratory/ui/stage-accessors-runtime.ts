import type { createLaboratoryProfileProcessReportAccessorsRuntime } from "../shared/ui/profile-process-report-accessors.js"
import type { LaboratoryUiFeatureRuntimeApi } from "../shared/ui/feature-runtime.js"
import type { createLaboratoryUiDraftRuntime } from "../shared/ui/draft-runtime.js"
import type { createLaboratoryUiDraftAccessRuntime } from "./draft-access-runtime.js"

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiDraftRuntimeApi = ReturnType<typeof createLaboratoryUiDraftRuntime>
type LaboratoryUiDraftAccessRuntimeApi = ReturnType<typeof createLaboratoryUiDraftAccessRuntime>
type LaboratoryProfileProcessReportAccessorsRuntimeApi = ReturnType<
  typeof createLaboratoryProfileProcessReportAccessorsRuntime
>

type LaboratoryStageAccessorsRuntimeDeps = {
  isSubtitleAnalysisFeature: () => boolean;
  laboratoryProfileProcessReportAccessorsRuntime: LaboratoryProfileProcessReportAccessorsRuntimeApi;
  laboratoryUiDraftAccessRuntime: LaboratoryUiDraftAccessRuntimeApi;
  laboratoryUiDraftRuntime: LaboratoryUiDraftRuntimeApi;
  laboratoryUiFeatureRuntime: LaboratoryUiFeatureRuntimeApi;
  setStage: (stageId: string) => void;
  subtitleText: (path: string[], tr: string, en: string) => string;
  text: (path: string[]) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryStageAccessorsRuntime(
  deps: LaboratoryStageAccessorsRuntimeDeps
) {
  const {
    isSubtitleAnalysisFeature,
    laboratoryProfileProcessReportAccessorsRuntime,
    laboratoryUiDraftAccessRuntime,
    laboratoryUiDraftRuntime,
    laboratoryUiFeatureRuntime,
    setStage,
    subtitleText,
    text,
    toRecord,
  } = deps;

  function getRelevantJobs() {
    return laboratoryUiFeatureRuntime.getRelevantJobs();
  }

  function collectEditStageJobs(projectJobs: unknown) {
    return laboratoryUiDraftRuntime.collectEditStageJobs(
      projectJobs as Parameters<LaboratoryUiDraftRuntimeApi["collectEditStageJobs"]>[0]
    );
  }

  function collectProfileStageJobs(projectJobs: unknown) {
    return laboratoryUiDraftRuntime.collectProfileStageJobs(
      projectJobs as Parameters<LaboratoryUiDraftRuntimeApi["collectProfileStageJobs"]>[0]
    );
  }

  function collectProcessStageJobs(projectJobs: unknown) {
    return laboratoryUiDraftRuntime.collectProcessStageJobs(
      projectJobs as Parameters<LaboratoryUiDraftRuntimeApi["collectProcessStageJobs"]>[0]
    );
  }

  function collectReportStageJobs(projectJobs: unknown) {
    return laboratoryUiDraftRuntime.collectReportStageJobs(
      projectJobs as Parameters<LaboratoryUiDraftRuntimeApi["collectReportStageJobs"]>[0]
    );
  }

  function getEditJobLabel(job: unknown) {
    const jobRecord = toRecord(job)
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

  function buildNestedPatch(path: unknown, value: unknown) {
    return laboratoryUiDraftAccessRuntime.buildNestedPatch(path, value);
  }

  function syncLocalEditField(path: unknown, value: unknown) {
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

export type LaboratoryStageAccessorsRuntimeApi = ReturnType<
  typeof createLaboratoryStageAccessorsRuntime
>;
