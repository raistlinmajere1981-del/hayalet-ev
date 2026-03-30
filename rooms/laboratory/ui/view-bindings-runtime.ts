import { createLaboratoryViewAccessorsRuntime } from "./view-accessors-runtime.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratorySnapshotAccessRuntime = {
  getAudioAnalysisCapabilities: () => unknown;
  getAudioAnalysisOrderedResultEntries: () => unknown[];
  getAudioAnalysisPresets: () => unknown;
  getAudioAnalysisProviders: () => unknown;
  getProjectAudioAnalysis: () => unknown;
  getSubtitleEntries: () => unknown;
  getSubtitleProcessModuleLabel: (entry: unknown) => string;
  getSubtitleProviderLabel: (entry: unknown) => string;
};

type LaboratoryProfileProcessReportAccessorsRuntime = {
  getCurrentFeatureProcessRecord: () => unknown;
  getCurrentFeatureReportRecord: () => unknown;
};

type LaboratorySettingsUi = {
  renderProfileModelCard: (entry: unknown) => string;
  renderSettingsOverlay: () => string;
  renderToolCard: (toolId: string, stageId: string) => string;
};

type LaboratoryProfileTargetAssetDeps = {
  getCurrentSourceKind: () => string;
  getCurrentSourceLabel: () => string;
  getEditOutputs: () => unknown[];
  getProfileTargetSummary: () => unknown;
  getProjectSource: () => unknown;
  toRecord: (value: unknown) => LaboratoryRecord;
};

type LaboratoryViewBindingsRuntimeDeps = {
  getCurrentSourceKind: () => string;
  getCurrentSourceLabel: () => string;
  getEditOutputs: () => unknown[];
  getLaboratorySettingsUi: () => LaboratorySettingsUi;
  getMediaAnalysisProfileTargetAsset: (deps: LaboratoryProfileTargetAssetDeps) => unknown;
  getProfileTargetSummary: () => unknown;
  getProjectSource: () => unknown;
  laboratoryProfileProcessReportAccessorsRuntime: LaboratoryProfileProcessReportAccessorsRuntime;
  laboratorySnapshotAccessRuntime: LaboratorySnapshotAccessRuntime;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryViewBindingsRuntime(
  deps: LaboratoryViewBindingsRuntimeDeps
) {
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
    renderProfileModelCard: function (entry: unknown) {
      return getLaboratorySettingsUi().renderProfileModelCard(entry);
    },
    renderSettingsOverlay: function () {
      return getLaboratorySettingsUi().renderSettingsOverlay();
    },
    renderToolCard: function (toolId: string, stageId: string) {
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
    getAudioAnalysisProviderEntries: function (): unknown[] {
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
    getSubtitleProcessModuleLabel: function (entry: unknown) {
      return laboratoryViewAccessorsRuntime.getSubtitleProcessModuleLabel(entry);
    },
    getSubtitleProviderLabel: function (entry: unknown) {
      return laboratoryViewAccessorsRuntime.getSubtitleProviderLabel(entry);
    },
    renderSettingsOverlay: function renderSettingsOverlay() {
      return laboratoryViewAccessorsRuntime.renderSettingsOverlay();
    },
  };
}
