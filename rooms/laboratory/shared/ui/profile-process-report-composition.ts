import type { createMediaAnalysisProfilePanels } from "../../main-functions/media-analysis/ui/profile-panels.js";
import type { createMediaAnalysisProfileStage } from "../../main-functions/media-analysis/ui/profile-stage.js";
import type { createLaboratoryProfileProcessReportRuntime } from "../../ui/profile-process-report-runtime.js";
import type { createLaboratoryProcessStageUi } from "./process-stage.js";
import type { createLaboratoryReportStageUi } from "./report-stage.js";

type LaboratoryRecord = Record<string, unknown>;
type MediaAnalysisProfileStageDeps = Parameters<typeof createMediaAnalysisProfileStage>[0];
type LaboratoryReportStageUiDeps = Parameters<typeof createLaboratoryReportStageUi>[0];

type LaboratoryProfileProcessReportCompositionDeps = {
  createLaboratoryProcessStageUi: typeof createLaboratoryProcessStageUi;
  createLaboratoryProfileProcessReportRuntime: typeof createLaboratoryProfileProcessReportRuntime;
  createLaboratoryReportStageUi: typeof createLaboratoryReportStageUi;
  createMediaAnalysisProfilePanels: typeof createMediaAnalysisProfilePanels;
  createMediaAnalysisProfileStage: typeof createMediaAnalysisProfileStage;
  escapeHtml: MediaAnalysisProfileStageDeps["escapeHtml"];
  featureText: (path: string[]) => string;
  formatDateTime: (value: unknown) => string;
  formatDuration: MediaAnalysisProfileStageDeps["formatDuration"];
  formatStatusLabel: (value: unknown) => string;
  getCurrentFeatureArtifactCount: () => number;
  getCurrentFeatureProcessRecord: () => unknown;
  getCurrentFeatureReportRecord: () => unknown;
  getCurrentFeatureTargetLabel: () => string;
  getCurrentProfileMode: MediaAnalysisProfileStageDeps["getCurrentProfileMode"];
  getCurrentSourceKind: () => string;
  getCurrentSourceLabel: () => string;
  getEffectiveMediaAsset: () => unknown;
  getFeaturePreviewImage: () => string;
  getFocusLabel: () => string;
  getPreferredAssetCodec: MediaAnalysisProfileStageDeps["getPreferredAssetCodec"];
  getPreferredAssetDuration: MediaAnalysisProfileStageDeps["getPreferredAssetDuration"];
  getPreferredAssetResolution: MediaAnalysisProfileStageDeps["getPreferredAssetResolution"];
  getProcessArtifacts: () => unknown[];
  getProcessFindings: () => unknown[];
  getProcessJobs: () => unknown[];
  getProcessModules: () => unknown[];
  getProfileArtifactPreferenceEntries: () => unknown[];
  getProfileArtifacts: MediaAnalysisProfileStageDeps["getProfileArtifacts"];
  getProfileCapabilities: () => LaboratoryRecord;
  getProfileConfidenceLabel: MediaAnalysisProfileStageDeps["getProfileConfidenceLabel"];
  getProfileEstimate: MediaAnalysisProfileStageDeps["getProfileEstimate"];
  getProfileFrameDensityOptions: () => unknown[];
  getProfileJobs: MediaAnalysisProfileStageDeps["getProfileJobs"];
  getProfileLabel: () => string;
  getProfileLaneCardState: (laneId: string) => LaboratoryRecord;
  getProfileLaneMap: () => LaboratoryRecord;
  getProfileModelEntries: () => unknown[];
  getProfilePreflight: MediaAnalysisProfileStageDeps["getProfilePreflight"];
  getProfilePresetOptions: () => unknown[];
  getProfileReadiness: MediaAnalysisProfileStageDeps["getProfileReadiness"];
  getProfileSelectedModel: MediaAnalysisProfileStageDeps["getProfileSelectedModel"];
  getProfileSignalKindLabel: MediaAnalysisProfileStageDeps["getProfileSignalKindLabel"];
  getProfileSignals: MediaAnalysisProfileStageDeps["getProfileSignals"];
  getProfileTargetAsset: MediaAnalysisProfileStageDeps["getProfileTargetAsset"];
  getProfileTargetMode: MediaAnalysisProfileStageDeps["getProfileTargetMode"];
  getProfileTargetOutputOptions: MediaAnalysisProfileStageDeps["getProfileTargetOutputOptions"];
  getProfileTargetSummary: MediaAnalysisProfileStageDeps["getProfileTargetSummary"];
  getProfileTranscriptSampleConfig: () => LaboratoryRecord;
  getProjectProfile: () => unknown;
  getProjectSource: MediaAnalysisProfileStageDeps["getProjectSource"];
  getReportExports: () => unknown[];
  getReportFindings: () => unknown[];
  getReportJobs: () => unknown[];
  getReportSummaryCards: () => unknown[];
  getSubtitleProcessModuleLabel: (moduleId: unknown) => string;
  getSubtitleProcessModuleSummary: (module: unknown) => string;
  isAudioAnalysisFeature: () => boolean;
  isSubtitleAnalysisFeature: () => boolean;
  renderAudioAnalysisModuleGrid: () => string;
  renderStageIntro: MediaAnalysisProfileStageDeps["renderStageIntro"];
  renderSummaryRows: MediaAnalysisProfileStageDeps["renderSummaryRows"];
  sortProfileSignals: MediaAnalysisProfileStageDeps["sortProfileSignals"];
  state: MediaAnalysisProfileStageDeps["state"];
  text: MediaAnalysisProfileStageDeps["text"];
  textFromKey: MediaAnalysisProfileStageDeps["textFromKey"];
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryProfileProcessReportComposition(
  deps: LaboratoryProfileProcessReportCompositionDeps
) {
  const laboratoryProcessStageUi = deps.createLaboratoryProcessStageUi({
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    featureText: deps.featureText,
    renderStageIntro: deps.renderStageIntro,
    renderSummaryRows: deps.renderSummaryRows,
    formatStatusLabel: deps.formatStatusLabel,
    getCurrentFeatureProcessRecord: deps.getCurrentFeatureProcessRecord,
    getProcessModules: deps.getProcessModules,
    getProcessJobs: deps.getProcessJobs,
    getProcessFindings: deps.getProcessFindings,
    getCurrentFeatureTargetLabel: deps.getCurrentFeatureTargetLabel,
    getCurrentFeatureArtifactCount: deps.getCurrentFeatureArtifactCount,
    getCurrentFeatureReportRecord: deps.getCurrentFeatureReportRecord,
  });

  const laboratoryReportStageUi = deps.createLaboratoryReportStageUi({
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    renderStageIntro: deps.renderStageIntro,
    renderSummaryRows: deps.renderSummaryRows,
    formatStatusLabel: deps.formatStatusLabel,
    formatDateTime: deps.formatDateTime,
    formatDuration:
      deps.formatDuration as unknown as LaboratoryReportStageUiDeps["formatDuration"],
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    getCurrentFeatureReportRecord: deps.getCurrentFeatureReportRecord,
    getEffectiveMediaAsset: deps.getEffectiveMediaAsset,
    getReportFindings: deps.getReportFindings,
    getReportSummaryCards: deps.getReportSummaryCards,
    getReportExports: deps.getReportExports,
    getReportJobs: deps.getReportJobs,
    getFeaturePreviewImage: deps.getFeaturePreviewImage,
    renderAudioAnalysisModuleGrid: deps.renderAudioAnalysisModuleGrid,
    getProcessModules: deps.getProcessModules,
    getProcessArtifacts: deps.getProcessArtifacts,
    getCurrentFeatureArtifactCount: deps.getCurrentFeatureArtifactCount,
    getCurrentFeatureTargetLabel: deps.getCurrentFeatureTargetLabel,
    getCurrentSourceLabel: deps.getCurrentSourceLabel,
    getPreferredAssetDuration: deps.getPreferredAssetDuration,
    getSubtitleProcessModuleLabel: deps.getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary: deps.getSubtitleProcessModuleSummary,
    getProfileSignalKindLabel: deps.getProfileSignalKindLabel,
    getProfileConfidenceLabel: deps.getProfileConfidenceLabel,
  });

  const mediaAnalysisProfilePanels = deps.createMediaAnalysisProfilePanels({
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    getProjectProfile: deps.getProjectProfile,
    getProfilePresetOptions: deps.getProfilePresetOptions,
    getProfileModelEntries: deps.getProfileModelEntries,
    getProfileSelectedModel: deps.getProfileSelectedModel,
    getProfileLaneMap: deps.getProfileLaneMap,
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getProfileArtifactPreferenceEntries: deps.getProfileArtifactPreferenceEntries,
    getProfileTranscriptSampleConfig: deps.getProfileTranscriptSampleConfig,
    getProfileCapabilities: deps.getProfileCapabilities,
    getProfileFrameDensityOptions: deps.getProfileFrameDensityOptions,
    getProfileLaneCardState: deps.getProfileLaneCardState,
  });

  const mediaAnalysisProfileStage = deps.createMediaAnalysisProfileStage({
    state: deps.state,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    formatDuration: deps.formatDuration,
    renderStageIntro: deps.renderStageIntro,
    renderSummaryRows: deps.renderSummaryRows,
    getCurrentProfileMode: deps.getCurrentProfileMode,
    getProfileEstimate: deps.getProfileEstimate,
    getProfileLabel: deps.getProfileLabel,
    renderProfilePresetPanel: function () {
      return mediaAnalysisProfilePanels.renderProfilePresetPanel();
    },
    renderProfileAdvancedPanel: function () {
      return mediaAnalysisProfilePanels.renderProfileAdvancedPanel();
    },
    getProfileSignals: deps.getProfileSignals,
    sortProfileSignals: deps.sortProfileSignals,
    getProfileSignalKindLabel: deps.getProfileSignalKindLabel,
    getProfileConfidenceLabel: deps.getProfileConfidenceLabel,
    getProfileArtifacts: deps.getProfileArtifacts,
    getProfileReadiness: deps.getProfileReadiness,
    getProfilePreflight: deps.getProfilePreflight,
    getProfileJobs: deps.getProfileJobs,
    getProfileSelectedModel: deps.getProfileSelectedModel,
    getProjectSource: deps.getProjectSource,
    getPreferredAssetDuration: deps.getPreferredAssetDuration,
    getPreferredAssetResolution: deps.getPreferredAssetResolution,
    getPreferredAssetCodec: deps.getPreferredAssetCodec,
    getProfileTargetSummary: deps.getProfileTargetSummary,
    getProfileTargetAsset: deps.getProfileTargetAsset,
    getProfileTargetMode: deps.getProfileTargetMode,
    getProfileTargetOutputOptions: deps.getProfileTargetOutputOptions,
    getFocusLabel: deps.getFocusLabel,
  });

  const laboratoryProfileProcessReportRuntime = deps.createLaboratoryProfileProcessReportRuntime({
    laboratoryProcessStageUi: laboratoryProcessStageUi,
    laboratoryReportStageUi: laboratoryReportStageUi,
    mediaAnalysisProfilePanels: mediaAnalysisProfilePanels,
    mediaAnalysisProfileStage: mediaAnalysisProfileStage,
  });

  return {
    getProcessModulePercent: laboratoryProfileProcessReportRuntime.getProcessModulePercent,
    getProcessModuleTitle: laboratoryProfileProcessReportRuntime.getProcessModuleTitle,
    getRunningProcessJob: laboratoryProfileProcessReportRuntime.getRunningProcessJob,
    getRunningReportJob: laboratoryProfileProcessReportRuntime.getRunningReportJob,
    laboratoryProcessStageUi: laboratoryProcessStageUi,
    laboratoryReportStageUi: laboratoryReportStageUi,
    mediaAnalysisProfilePanels: mediaAnalysisProfilePanels,
    mediaAnalysisProfileStage: mediaAnalysisProfileStage,
    renderProfileActionsPanel: laboratoryProfileProcessReportRuntime.renderProfileActionsPanel,
    renderProfileAdvancedPanel: laboratoryProfileProcessReportRuntime.renderProfileAdvancedPanel,
    renderProfileArtifactsPanel: laboratoryProfileProcessReportRuntime.renderProfileArtifactsPanel,
    renderProfileModePanel: laboratoryProfileProcessReportRuntime.renderProfileModePanel,
    renderProfilePresetPanel: laboratoryProfileProcessReportRuntime.renderProfilePresetPanel,
    renderProfileSignalsPanel: laboratoryProfileProcessReportRuntime.renderProfileSignalsPanel,
    renderProfileSummaryPanel: laboratoryProfileProcessReportRuntime.renderProfileSummaryPanel,
    renderProfileTargetPanel: laboratoryProfileProcessReportRuntime.renderProfileTargetPanel,
    renderReportFinding: laboratoryProfileProcessReportRuntime.renderReportFinding,
  };
}
