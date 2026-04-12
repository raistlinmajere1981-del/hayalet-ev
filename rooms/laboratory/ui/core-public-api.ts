import type { createLaboratoryRequestRuntime } from "../shared/ui/request-runtime.js";
import type { LaboratoryUiFeatureRuntimeApi } from "../shared/ui/feature-runtime.js";
import type { createMediaAnalysisUiRuntime } from "../main-functions/media-analysis/ui/runtime.js";
import type { createLaboratorySnapshotAccessRuntime } from "./snapshot-access-runtime.js";
import type { LaboratoryStageAccessorsRuntimeApi } from "./stage-accessors-runtime.js";
import type { createLaboratoryUiEditRuntime } from "./edit-runtime.js";
import type { createLaboratoryViewBindingsRuntime } from "./view-bindings-runtime.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryUiRuntimeBase = ReturnType<typeof createLaboratorySnapshotAccessRuntime> &
  ReturnType<typeof createLaboratoryViewBindingsRuntime> &
  ReturnType<typeof createMediaAnalysisUiRuntime>;

type LaboratoryUiRuntimeCompositionRuntime = LaboratoryUiRuntimeBase &
  LaboratoryUiFeatureRuntimeApi &
  LaboratoryStageAccessorsRuntimeApi & {
    laboratoryStageAccessorsRuntime: LaboratoryStageAccessorsRuntimeApi;
  };

type LaboratoryUiCoreApiDeps = {
  advanceStage: (...args: unknown[]) => unknown;
  applyLocale: (...args: unknown[]) => unknown;
  applyPresentationMode: (...args: unknown[]) => unknown;
  bootstrapText: unknown;
  captureScrollState: (...args: unknown[]) => unknown;
  escapeHtml: (...args: unknown[]) => string;
  featureText: unknown;
  formatDateTime: (value: unknown) => string;
  formatDuration: (value: unknown) => string;
  formatStatusLabel: (...args: unknown[]) => unknown;
  getActiveFeatureId: () => string;
  getAvailableSourceFormats: () => unknown;
  getDefaultSourceKind: () => string;
  getFeaturePreviewImage: (...args: unknown[]) => unknown;
  getStageIndex: (...args: unknown[]) => unknown;
  isAudioAnalysisFeature: () => boolean;
  isSubtitleAnalysisFeature: () => boolean;
  laboratoryRequestRuntime: ReturnType<typeof createLaboratoryRequestRuntime>;
  laboratoryUiEditRuntime: ReturnType<typeof createLaboratoryUiEditRuntime>;
  normalizeContext: (...args: unknown[]) => unknown;
  readFormValue: (...args: unknown[]) => unknown;
  renderBootstrap: (...args: unknown[]) => string;
  renderStageIntro: (...args: unknown[]) => string;
  renderStageRail: (...args: unknown[]) => string;
  renderSummaryRows: (...args: unknown[]) => string;
  renderTextField: (...args: unknown[]) => string;
  restoreScrollState: (...args: unknown[]) => unknown;
  setStage: (...args: unknown[]) => unknown;
  state: LaboratoryRecord;
  subtitleTemplate: unknown;
  subtitleText: unknown;
  text: unknown;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
  uiRuntimeComposition: LaboratoryUiRuntimeCompositionRuntime;
};

export function buildLaboratoryUiCoreApi(deps: LaboratoryUiCoreApiDeps) {
  const { laboratoryRequestRuntime, laboratoryUiEditRuntime, uiRuntimeComposition } = deps;
  const { laboratoryStageAccessorsRuntime } = uiRuntimeComposition;

  return {
    advanceStage: deps.advanceStage,
    applyLocale: deps.applyLocale,
    applyPresentationMode: deps.applyPresentationMode,
    bootstrapText: deps.bootstrapText,
    buildCurrentDraftPayload: laboratoryStageAccessorsRuntime.buildCurrentDraftPayload,
    buildCurrentEditRecipePatch: laboratoryUiEditRuntime.buildCurrentEditRecipePatch,
    buildNestedPatch: laboratoryStageAccessorsRuntime.buildNestedPatch,
    captureScrollState: deps.captureScrollState,
    closeSettingsOverlay: laboratoryRequestRuntime.closeSettingsOverlay,
    commitEditPatch: laboratoryUiEditRuntime.commitEditPatch,
    escapeHtml: deps.escapeHtml,
    featureText: deps.featureText,
    formatBitRate: uiRuntimeComposition.formatBitRate,
    formatBytes: uiRuntimeComposition.formatBytes,
    formatCleanupPolicy: uiRuntimeComposition.formatCleanupPolicy,
    formatDateTime: deps.formatDateTime,
    formatDuration: deps.formatDuration,
    formatEditWindowLabel: uiRuntimeComposition.formatEditWindowLabel,
    formatPlatformList: uiRuntimeComposition.formatPlatformList,
    formatStatusLabel: deps.formatStatusLabel,
    getActiveEditOutput: uiRuntimeComposition.getActiveEditOutput,
    getActiveFeatureId: deps.getActiveFeatureId,
    getActiveProject: uiRuntimeComposition.getActiveProject,
    getActiveSubtitleEntry: uiRuntimeComposition.getActiveSubtitleEntry,
    getAudioAnalysisCapabilities: uiRuntimeComposition.getAudioAnalysisCapabilities,
    getAudioAnalysisModules: uiRuntimeComposition.getAudioAnalysisModules,
    getAudioAnalysisOrderedResultEntries: uiRuntimeComposition.getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisProviderEntries: uiRuntimeComposition.getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState: uiRuntimeComposition.getAudioAnalysisProviderState,
    getAvailableSourceFormats: deps.getAvailableSourceFormats,
    getCurrentDrafts: laboratoryStageAccessorsRuntime.getCurrentDrafts,
    getCurrentEditDraft: laboratoryStageAccessorsRuntime.getCurrentEditDraft,
    getCurrentEditMode: uiRuntimeComposition.getCurrentEditMode,
    getCurrentEditPresetOptions: uiRuntimeComposition.getCurrentEditPresetOptions,
    getCurrentEditRecipe: uiRuntimeComposition.getCurrentEditRecipe,
    getCurrentFeatureProcessRecord: uiRuntimeComposition.getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord: uiRuntimeComposition.getCurrentFeatureReportRecord,
    getCurrentFocusLabel: uiRuntimeComposition.getCurrentFocusLabel,
    getCurrentFocusRegionId: uiRuntimeComposition.getCurrentFocusRegionId,
    getCurrentResizeLabel: uiRuntimeComposition.getCurrentResizeLabel,
    getCurrentSourceKind: uiRuntimeComposition.getCurrentSourceKind,
    getCurrentSourceLabel: uiRuntimeComposition.getCurrentSourceLabel,
    getCurrentSourceMode: uiRuntimeComposition.getCurrentSourceMode,
    getDefaultSourceKind: deps.getDefaultSourceKind,
    getEditOutputs: uiRuntimeComposition.getEditOutputs,
    getEditPresets: uiRuntimeComposition.getEditPresets,
    getEditPreview: uiRuntimeComposition.getEditPreview,
    getEffectiveMediaAsset: uiRuntimeComposition.getEffectiveMediaAsset,
    getFeaturePreviewImage: deps.getFeaturePreviewImage,
    getWorkbench() {
      return deps.toRecord(deps.state["context"])["workbench"];
    },
    getPreferredAssetCodec: uiRuntimeComposition.getPreferredAssetCodec,
    getPreferredAssetDuration: uiRuntimeComposition.getPreferredAssetDuration,
    getPreferredAssetResolution: uiRuntimeComposition.getPreferredAssetResolution,
    getPreferredSourceCodec: uiRuntimeComposition.getPreferredSourceCodec,
    getPreferredSourceDuration: uiRuntimeComposition.getPreferredSourceDuration,
    getPreferredSourceFormat: uiRuntimeComposition.getPreferredSourceFormat,
    getPreferredSourceResolution: uiRuntimeComposition.getPreferredSourceResolution,
    getProfileArtifactPreferenceEntries: uiRuntimeComposition.getProfileArtifactPreferenceEntries,
    getProfileCapabilities: uiRuntimeComposition.getProfileCapabilities,
    getProfileConfidenceLabel: uiRuntimeComposition.getProfileConfidenceLabel,
    getProfileFrameDensityOptions: uiRuntimeComposition.getProfileFrameDensityOptions,
    getProfileLaneCardState: uiRuntimeComposition.getProfileLaneCardState,
    getProfileSignalKindLabel: uiRuntimeComposition.getProfileSignalKindLabel,
    getProfileTargetAsset: uiRuntimeComposition.getProfileTargetAsset,
    getProfileTargetSummary: laboratoryStageAccessorsRuntime.getProfileTargetSummary,
    getProfileTranscriptSampleConfig: uiRuntimeComposition.getProfileTranscriptSampleConfig,
    getProjectEdit: uiRuntimeComposition.getProjectEdit,
    getProjectAudioAnalysis: uiRuntimeComposition.getProjectAudioAnalysis,
    getProjectProcess: uiRuntimeComposition.getProjectProcess,
    getProjectProfile: uiRuntimeComposition.getProjectProfile,
    getProjectReport: uiRuntimeComposition.getProjectReport,
    getProjectSource: uiRuntimeComposition.getProjectSource,
    getProjectSubtitleAnalysis: uiRuntimeComposition.getProjectSubtitleAnalysis,
    getProjectStatusLabel: uiRuntimeComposition.getProjectStatusLabel,
    getProjectSummaries: uiRuntimeComposition.getProjectSummaries,
    getSourceMetadata: uiRuntimeComposition.getSourceMetadata,
    getSourceModeOptions: uiRuntimeComposition.getSourceModeOptions,
    getSourceSnapshot: uiRuntimeComposition.getSourceSnapshot,
    getStageIndex: deps.getStageIndex,
    getStageToolIds: uiRuntimeComposition.getStageToolIds,
    getSubtitleAnalysisCatalog: uiRuntimeComposition.getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders: uiRuntimeComposition.getSubtitleAnalysisProviders,
    getSubtitleDiscoveryItems: uiRuntimeComposition.getSubtitleDiscoveryItems,
    getSubtitleDiscoveryState: uiRuntimeComposition.getSubtitleDiscoveryState,
    getSubtitleEditPresets: uiRuntimeComposition.getSubtitleEditPresets,
    getSubtitleEditPreview: uiRuntimeComposition.getSubtitleEditPreview,
    getSubtitleEditState: uiRuntimeComposition.getSubtitleEditState,
    getSubtitleEntries: uiRuntimeComposition.getSubtitleEntries,
    getSubtitleOutputs: uiRuntimeComposition.getSubtitleOutputs,
    getSubtitleProcessModuleLabel: uiRuntimeComposition.getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary: uiRuntimeComposition.getSubtitleProcessModuleSummary,
    getSubtitleProcessStatusLabel: uiRuntimeComposition.getSubtitleProcessStatusLabel,
    getSubtitleProviderLabel: uiRuntimeComposition.getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels: uiRuntimeComposition.getSubtitleProviderModuleLabels,
    getSubtitleProviderStatusLabel: uiRuntimeComposition.getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary: uiRuntimeComposition.getSubtitleProviderSummary,
    getSubtitleSelectedCandidateIds: uiRuntimeComposition.getSubtitleSelectedCandidateIds,
    getSubtitleSelectedEntryIds: uiRuntimeComposition.getSubtitleSelectedEntryIds,
    getSubtitleSourcePresets: uiRuntimeComposition.getSubtitleSourcePresets,
    getSubtitleWorkspace: uiRuntimeComposition.getSubtitleWorkspace,
    getToolDisplayName: uiRuntimeComposition.getToolDisplayName,
    getToolEntry: uiRuntimeComposition.getToolEntry,
    getToolRegistry: uiRuntimeComposition.getToolRegistry,
    getYtDlpForm: uiRuntimeComposition.getYtDlpForm,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    laboratoryRequestRuntime,
    laboratoryStageAccessorsRuntime,
    normalizeContext: deps.normalizeContext,
    openReport: laboratoryStageAccessorsRuntime.openReport,
    openSettingsOverlay: laboratoryRequestRuntime.openSettingsOverlay,
    persistDrafts: laboratoryRequestRuntime.persistDrafts,
    readFormValue: deps.readFormValue,
    renderBootstrap: deps.renderBootstrap,
    renderSettingsOverlay: uiRuntimeComposition.renderSettingsOverlay,
    renderStageIntro: deps.renderStageIntro,
    renderStageRail: deps.renderStageRail,
    renderSummaryRows: deps.renderSummaryRows,
    renderTextField: deps.renderTextField,
    resetJourney: laboratoryStageAccessorsRuntime.resetJourney,
    restartProcess: laboratoryUiEditRuntime.restartProcess,
    restoreScrollState: deps.restoreScrollState,
    sendMediaAction: laboratoryRequestRuntime.sendMediaAction,
    sendSourceAction: laboratoryRequestRuntime.sendSourceAction,
    setActiveWorkbenchModule: laboratoryRequestRuntime.setActiveWorkbenchModule,
    setLastAction: laboratoryRequestRuntime.setLastAction,
    setStage: deps.setStage,
    sortProfileSignals: uiRuntimeComposition.sortProfileSignals,
    state: deps.state,
    subtitleTemplate: deps.subtitleTemplate,
    subtitleText: deps.subtitleText,
    syncHostContext: laboratoryRequestRuntime.syncHostContext,
    syncWorkbenchContext: laboratoryRequestRuntime.syncWorkbenchContext,
    syncDraftField: laboratoryRequestRuntime.syncDraftField,
    syncLocalEditField: laboratoryStageAccessorsRuntime.syncLocalEditField,
    text: deps.text,
    textFromKey: deps.textFromKey,
    toRecord: deps.toRecord,
    toggleWorkbenchModuleSelection: laboratoryRequestRuntime.toggleWorkbenchModuleSelection,
  };
}
