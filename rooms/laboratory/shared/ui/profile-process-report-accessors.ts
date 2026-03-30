import type { LaboratoryUiFeatureRuntimeApi } from "./feature-runtime.js";

type LaboratoryProfileProcessReportAccessorsDeps = {
  getLaboratoryUiFeatureRuntime: () => LaboratoryUiFeatureRuntimeApi;
};

export function createLaboratoryProfileProcessReportAccessorsRuntime(
  deps: LaboratoryProfileProcessReportAccessorsDeps
) {
  const { getLaboratoryUiFeatureRuntime } = deps;

  function readLaboratoryUiFeatureRuntime(): LaboratoryUiFeatureRuntimeApi {
    return getLaboratoryUiFeatureRuntime();
  }

  function getCurrentFeatureProcessRecord() {
    return readLaboratoryUiFeatureRuntime().getCurrentFeatureProcessRecord();
  }

  function getCurrentFeatureReportRecord() {
    return readLaboratoryUiFeatureRuntime().getCurrentFeatureReportRecord();
  }

  function getProfileLabel() {
    return readLaboratoryUiFeatureRuntime().getProfileLabel();
  }

  function getFocusLabel() {
    return readLaboratoryUiFeatureRuntime().getFocusLabel();
  }

  function getCurrentProfileMode() {
    return readLaboratoryUiFeatureRuntime().getCurrentProfileMode();
  }

  function getProfileLaneMap() {
    return readLaboratoryUiFeatureRuntime().getProfileLaneMap();
  }

  function getCompatibleProfileLaneIds() {
    return readLaboratoryUiFeatureRuntime().getCompatibleProfileLaneIds();
  }

  function getProfilePresetOptions() {
    return readLaboratoryUiFeatureRuntime().getProfilePresetOptions();
  }

  function getProfileReadiness() {
    return readLaboratoryUiFeatureRuntime().getProfileReadiness();
  }

  function getProfileEstimate() {
    return readLaboratoryUiFeatureRuntime().getProfileEstimate();
  }

  function getProfilePreflight() {
    return readLaboratoryUiFeatureRuntime().getProfilePreflight();
  }

  function getProfileSignals() {
    return readLaboratoryUiFeatureRuntime().getProfileSignals();
  }

  function getProfileArtifacts() {
    return readLaboratoryUiFeatureRuntime().getProfileArtifacts();
  }

  function getProfileTargetSummary() {
    return readLaboratoryUiFeatureRuntime().getProfileTargetSummary();
  }

  function getProfileTargetMode() {
    return readLaboratoryUiFeatureRuntime().getProfileTargetMode();
  }

  function getProfileModelEntries() {
    return readLaboratoryUiFeatureRuntime().getProfileModelEntries();
  }

  function getProfileSelectedModel() {
    return readLaboratoryUiFeatureRuntime().getProfileSelectedModel();
  }

  function getProfileJobs() {
    return readLaboratoryUiFeatureRuntime().getProfileJobs();
  }

  function getProcessJobs() {
    return readLaboratoryUiFeatureRuntime().getProcessJobs();
  }

  function getReportJobs() {
    return readLaboratoryUiFeatureRuntime().getReportJobs();
  }

  function getProcessModules() {
    return readLaboratoryUiFeatureRuntime().getProcessModules();
  }

  function getProcessFindings() {
    return readLaboratoryUiFeatureRuntime().getProcessFindings();
  }

  function getProcessArtifacts() {
    return readLaboratoryUiFeatureRuntime().getProcessArtifacts();
  }

  function getReportSummaryCards() {
    return readLaboratoryUiFeatureRuntime().getReportSummaryCards();
  }

  function getReportFindings() {
    return readLaboratoryUiFeatureRuntime().getReportFindings();
  }

  function getReportExports() {
    return readLaboratoryUiFeatureRuntime().getReportExports();
  }

  function getCurrentFeatureTargetLabel() {
    return readLaboratoryUiFeatureRuntime().getCurrentFeatureTargetLabel();
  }

  function getCurrentFeatureArtifactCount() {
    return readLaboratoryUiFeatureRuntime().getCurrentFeatureArtifactCount();
  }

  function getProfileTargetOutputOptions() {
    return readLaboratoryUiFeatureRuntime().getProfileTargetOutputOptions();
  }

  return {
    getCompatibleProfileLaneIds: getCompatibleProfileLaneIds,
    getCurrentFeatureArtifactCount: getCurrentFeatureArtifactCount,
    getCurrentFeatureProcessRecord: getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord: getCurrentFeatureReportRecord,
    getCurrentFeatureTargetLabel: getCurrentFeatureTargetLabel,
    getCurrentProfileMode: getCurrentProfileMode,
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
    getReportExports: getReportExports,
    getReportFindings: getReportFindings,
    getReportJobs: getReportJobs,
    getReportSummaryCards: getReportSummaryCards,
  };
}
