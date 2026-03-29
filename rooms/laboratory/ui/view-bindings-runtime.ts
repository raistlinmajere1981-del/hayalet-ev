// @ts-nocheck
import { createLaboratoryViewAccessorsRuntime } from "./view-accessors-runtime.js";

export function createLaboratoryViewBindingsRuntime(deps) {
  const laboratorySnapshotAccessRuntime = deps.laboratorySnapshotAccessRuntime;
  const laboratoryProfileProcessReportAccessorsRuntime =
    deps.laboratoryProfileProcessReportAccessorsRuntime;
  const getLaboratorySettingsUi = deps.getLaboratorySettingsUi;
  const getMediaAnalysisProfileTargetAsset = deps.getMediaAnalysisProfileTargetAsset;
  const getCurrentSourceKind = deps.getCurrentSourceKind;
  const getCurrentSourceLabel = deps.getCurrentSourceLabel;
  const getEditOutputs = deps.getEditOutputs;
  const getProfileTargetSummary = deps.getProfileTargetSummary;
  const getProjectSource = deps.getProjectSource;
  const toRecord = deps.toRecord;

  const laboratoryViewAccessorsRuntime = createLaboratoryViewAccessorsRuntime({
    getAudioAnalysisCapabilities: laboratorySnapshotAccessRuntime.getAudioAnalysisCapabilities,
    getAudioAnalysisOrderedResultEntries:
      laboratorySnapshotAccessRuntime.getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisPresets: laboratorySnapshotAccessRuntime.getAudioAnalysisPresets,
    getAudioAnalysisProviders: laboratorySnapshotAccessRuntime.getAudioAnalysisProviders,
    getCurrentFeatureProcessRecord: function () {
      return laboratoryProfileProcessReportAccessorsRuntime.getCurrentFeatureProcessRecord();
    },
    getCurrentFeatureReportRecord: function () {
      return laboratoryProfileProcessReportAccessorsRuntime.getCurrentFeatureReportRecord();
    },
    getProjectAudioAnalysis: laboratorySnapshotAccessRuntime.getProjectAudioAnalysis,
    getProfileTargetAsset: function () {
      return getMediaAnalysisProfileTargetAsset({
        getCurrentSourceKind: getCurrentSourceKind,
        getCurrentSourceLabel: getCurrentSourceLabel,
        getEditOutputs: getEditOutputs,
        getProfileTargetSummary: getProfileTargetSummary,
        getProjectSource: getProjectSource,
        toRecord: toRecord,
      });
    },
    getSubtitleEntries: laboratorySnapshotAccessRuntime.getSubtitleEntries,
    getSubtitleProcessModuleLabel: laboratorySnapshotAccessRuntime.getSubtitleProcessModuleLabel,
    getSubtitleProviderLabel: laboratorySnapshotAccessRuntime.getSubtitleProviderLabel,
    renderProfileModelCard: function (entry) {
      return getLaboratorySettingsUi().renderProfileModelCard(entry);
    },
    renderSettingsOverlay: function () {
      return getLaboratorySettingsUi().renderSettingsOverlay();
    },
    renderToolCard: function (toolId, stageId) {
      return getLaboratorySettingsUi().renderToolCard(toolId, stageId);
    },
  });

  return {
    getAudioAnalysisCapabilities: function () {
      return laboratoryViewAccessorsRuntime.getAudioAnalysisCapabilities();
    },
    getAudioAnalysisOrderedResultEntries: function () {
      return laboratoryViewAccessorsRuntime.getAudioAnalysisOrderedResultEntries();
    },
    getAudioAnalysisProviderEntries: function () {
      return laboratoryViewAccessorsRuntime.getAudioAnalysisProviderEntries();
    },
    getCurrentFeatureProcessRecord: function () {
      return laboratoryViewAccessorsRuntime.getCurrentFeatureProcessRecord();
    },
    getCurrentFeatureReportRecord: function () {
      return laboratoryViewAccessorsRuntime.getCurrentFeatureReportRecord();
    },
    getProjectAudioAnalysis: function () {
      return laboratoryViewAccessorsRuntime.getProjectAudioAnalysis();
    },
    getProfileTargetAsset: function () {
      return laboratoryViewAccessorsRuntime.getProfileTargetAsset();
    },
    getSubtitleEntries: function () {
      return laboratoryViewAccessorsRuntime.getSubtitleEntries();
    },
    getSubtitleProcessModuleLabel: function (entry) {
      return laboratoryViewAccessorsRuntime.getSubtitleProcessModuleLabel(entry);
    },
    getSubtitleProviderLabel: function (entry) {
      return laboratoryViewAccessorsRuntime.getSubtitleProviderLabel(entry);
    },
    renderSettingsOverlay: function renderSettingsOverlay() {
      return laboratoryViewAccessorsRuntime.renderSettingsOverlay();
    },
  };
}
