import type { createLaboratoryHostMessageRuntime } from "../shared/ui/host-messages.js";
import type { createLaboratoryProfileProcessReportComposition } from "../shared/ui/profile-process-report-composition.js";
import type { createLaboratoryRequestRuntime } from "../shared/ui/request-runtime.js";
import type { createLaboratorySettingsUi } from "../shared/ui/settings-overlay.js";
import type { LaboratoryStageAccessorsRuntimeApi } from "./stage-accessors-runtime.js";

type LaboratoryProfileProcessReportCompositionDeps = Parameters<
  typeof createLaboratoryProfileProcessReportComposition
>[0];
type LaboratorySettingsUiDeps = Parameters<typeof createLaboratorySettingsUi>[0];
type LaboratoryHostMessageRuntimeDeps = Parameters<typeof createLaboratoryHostMessageRuntime>[0];

type LaboratoryFeatureStageBundlesRuntimeDeps = Pick<
  LaboratoryProfileProcessReportCompositionDeps,
  | "createLaboratoryProcessStageUi"
  | "createLaboratoryProfileProcessReportRuntime"
  | "createLaboratoryReportStageUi"
  | "createMediaAnalysisProfilePanels"
  | "createMediaAnalysisProfileStage"
  | "escapeHtml"
  | "featureText"
  | "formatDateTime"
  | "formatDuration"
  | "formatStatusLabel"
  | "getCurrentFeatureProcessRecord"
  | "getCurrentFeatureReportRecord"
  | "getCurrentSourceKind"
  | "getCurrentSourceLabel"
  | "getEffectiveMediaAsset"
  | "getFeaturePreviewImage"
  | "getWorkbench"
  | "getPreferredAssetCodec"
  | "getPreferredAssetDuration"
  | "getPreferredAssetResolution"
  | "getProfileArtifactPreferenceEntries"
  | "getProfileCapabilities"
  | "getProfileConfidenceLabel"
  | "getProfileFrameDensityOptions"
  | "getProfileLaneCardState"
  | "getProfileSignalKindLabel"
  | "getProfileTranscriptSampleConfig"
  | "getProjectProfile"
  | "getProjectProcess"
  | "getProjectReport"
  | "getProjectSource"
  | "getProfileTargetAsset"
  | "getSubtitleProcessModuleLabel"
  | "getSubtitleProcessModuleSummary"
  | "isAudioAnalysisFeature"
  | "isSubtitleAnalysisFeature"
  | "renderAudioAnalysisModuleGrid"
  | "renderStageIntro"
  | "renderSummaryRows"
  | "sortProfileSignals"
  | "state"
  | "text"
  | "textFromKey"
  | "toRecord"
> & {
  applyLocale: (locale: string) => void;
  applyPresentationMode: (mode: unknown) => void;
  createLaboratoryHostMessageRuntime: typeof createLaboratoryHostMessageRuntime;
  createLaboratoryProfileProcessReportComposition: typeof createLaboratoryProfileProcessReportComposition;
  createLaboratorySettingsUi: typeof createLaboratorySettingsUi;
  formatBytes: (value: unknown) => string;
  formatCleanupPolicy: (value: unknown) => string;
  formatPlatformList: (value: unknown) => string;
  getStageToolIds: (stageId: string) => string[];
  getToolEntry: (toolId: unknown) => unknown;
  getToolRegistry: () => unknown[];
  laboratoryRequestRuntime: ReturnType<typeof createLaboratoryRequestRuntime>;
  laboratoryStageAccessorsRuntime: LaboratoryStageAccessorsRuntimeApi;
  normalizeContext: (value: unknown) => unknown;
  render: () => void;
  renderAudioAnalysisProviderPanel: () => string;
  renderPreviewMetaRow: (...args: unknown[]) => string;
  stageOrder: string[];
};

export function createLaboratoryFeatureStageBundlesRuntime(
  deps: LaboratoryFeatureStageBundlesRuntimeDeps
) {
  const { laboratoryStageAccessorsRuntime, toRecord } = deps;

  function toUnknownArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  function toString(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  function toNumber(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  function getProfileModelEntries(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProfileModelEntries());
  }

  function getProfileSelectedModel(): unknown {
    const selectedModel: unknown = laboratoryStageAccessorsRuntime.getProfileSelectedModel();
    return selectedModel;
  }

  function getProcessModules(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProcessModules());
  }

  function getProcessJobs(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProcessJobs());
  }

  function getProcessFindings(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProcessFindings());
  }

  function getCurrentFeatureTargetLabel(): string {
    return toString(laboratoryStageAccessorsRuntime.getCurrentFeatureTargetLabel());
  }

  function getCurrentFeatureArtifactCount(): number {
    return toNumber(laboratoryStageAccessorsRuntime.getCurrentFeatureArtifactCount());
  }

  function getReportFindings(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getReportFindings());
  }

  function getReportSummaryCards(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getReportSummaryCards());
  }

  function getReportExports(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getReportExports());
  }

  function getReportJobs(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getReportJobs());
  }

  function getProcessArtifacts(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProcessArtifacts());
  }

  function getProfilePresetOptions(): unknown[] {
    return toUnknownArray(laboratoryStageAccessorsRuntime.getProfilePresetOptions());
  }

  function getProfileLaneMap() {
    return toRecord(laboratoryStageAccessorsRuntime.getProfileLaneMap());
  }

  function getCurrentProfileMode(): unknown {
    const mode: unknown = laboratoryStageAccessorsRuntime.getCurrentProfileMode();
    return mode;
  }

  function getProfileEstimate(): unknown {
    const estimate: unknown = laboratoryStageAccessorsRuntime.getProfileEstimate();
    return estimate;
  }

  function getProfileLabel(): string {
    return toString(laboratoryStageAccessorsRuntime.getProfileLabel());
  }

  function getProfileSignals(): unknown {
    const signals: unknown = laboratoryStageAccessorsRuntime.getProfileSignals();
    return signals;
  }

  function getProfileArtifacts(): unknown {
    const artifacts: unknown = laboratoryStageAccessorsRuntime.getProfileArtifacts();
    return artifacts;
  }

  function getProfileReadiness(): unknown {
    const readiness: unknown = laboratoryStageAccessorsRuntime.getProfileReadiness();
    return readiness;
  }

  function getProfilePreflight(): unknown {
    const preflight: unknown = laboratoryStageAccessorsRuntime.getProfilePreflight();
    return preflight;
  }

  function getProfileJobs(): unknown {
    const jobs: unknown = laboratoryStageAccessorsRuntime.getProfileJobs();
    return jobs;
  }

  function getProfileTargetSummary(): unknown {
    const summary: unknown = laboratoryStageAccessorsRuntime.getProfileTargetSummary();
    return summary;
  }

  function getProfileTargetAsset(): unknown {
    const targetAsset: unknown = deps.getProfileTargetAsset();
    return targetAsset;
  }

  function getProfileTargetMode(): unknown {
    const targetMode: unknown = laboratoryStageAccessorsRuntime.getProfileTargetMode();
    return targetMode;
  }

  function getProfileTargetOutputOptions(): unknown {
    const outputOptions: unknown = laboratoryStageAccessorsRuntime.getProfileTargetOutputOptions();
    return outputOptions;
  }

  function getFocusLabel(): string {
    return toString(laboratoryStageAccessorsRuntime.getFocusLabel());
  }

  const laboratorySettingsUi = deps.createLaboratorySettingsUi({
    stageOrder: deps.stageOrder,
    state: deps.state,
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    formatBytes: deps.formatBytes,
    formatCleanupPolicy: deps.formatCleanupPolicy,
    formatPlatformList: deps.formatPlatformList,
    getWorkbench: deps.getWorkbench,
    getToolEntry: deps.getToolEntry,
    getToolRegistry: deps.getToolRegistry,
    getStageToolIds: deps.getStageToolIds,
    getProfileModelEntries,
    getProfileSelectedModel,
    renderPreviewMetaRow: deps.renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel: deps.renderAudioAnalysisProviderPanel,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
  } as unknown as LaboratorySettingsUiDeps);

  const laboratoryHostMessageRuntime = deps.createLaboratoryHostMessageRuntime({
    state: deps.state,
    toRecord: deps.toRecord,
    text: deps.text,
    render: deps.render,
    applyPresentationMode: deps.applyPresentationMode,
    applyLocale: deps.applyLocale,
    normalizeContext: deps.normalizeContext,
    setActivityStatus: deps.laboratoryRequestRuntime.setActivityStatus,
    setBlockingStatus: deps.laboratoryRequestRuntime.setBlockingStatus,
    shouldIgnoreCorrelatedPayload: deps.laboratoryRequestRuntime.shouldIgnoreCorrelatedPayload,
    setLastAction: deps.laboratoryRequestRuntime.setLastAction,
    setResultStatus: deps.laboratoryRequestRuntime.setResultStatus,
  } as unknown as LaboratoryHostMessageRuntimeDeps);

  const profileProcessBundle = deps.createLaboratoryProfileProcessReportComposition({
    createLaboratoryProcessStageUi: deps.createLaboratoryProcessStageUi,
    createLaboratoryProfileProcessReportRuntime: deps.createLaboratoryProfileProcessReportRuntime,
    createLaboratoryReportStageUi: deps.createLaboratoryReportStageUi,
    createMediaAnalysisProfilePanels: deps.createMediaAnalysisProfilePanels,
    createMediaAnalysisProfileStage: deps.createMediaAnalysisProfileStage,
    state: deps.state,
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    renderStageIntro: deps.renderStageIntro,
    renderSummaryRows: deps.renderSummaryRows,
    formatStatusLabel: deps.formatStatusLabel,
    formatDateTime: deps.formatDateTime,
    formatDuration: deps.formatDuration,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    getCurrentFeatureProcessRecord: deps.getCurrentFeatureProcessRecord,
    getProcessModules,
    getProcessJobs,
    getProcessFindings,
    getCurrentFeatureTargetLabel,
    getCurrentFeatureArtifactCount,
    getCurrentFeatureReportRecord: deps.getCurrentFeatureReportRecord,
    getProjectProcess: deps.getProjectProcess,
    getProjectReport: deps.getProjectReport,
    getWorkbench: deps.getWorkbench,
    getEffectiveMediaAsset: deps.getEffectiveMediaAsset,
    getReportFindings,
    getReportSummaryCards,
    getReportExports,
    getReportJobs,
    getFeaturePreviewImage: deps.getFeaturePreviewImage,
    renderAudioAnalysisModuleGrid: deps.renderAudioAnalysisModuleGrid,
    getProcessArtifacts,
    getCurrentSourceLabel: deps.getCurrentSourceLabel,
    getPreferredAssetDuration: deps.getPreferredAssetDuration,
    getSubtitleProcessModuleLabel: deps.getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary: deps.getSubtitleProcessModuleSummary,
    getProfileSignalKindLabel: deps.getProfileSignalKindLabel,
    getProfileConfidenceLabel: deps.getProfileConfidenceLabel,
    getProjectProfile: deps.getProjectProfile,
    getProfilePresetOptions,
    getProfileModelEntries,
    getProfileSelectedModel,
    getProfileLaneMap,
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getProfileArtifactPreferenceEntries: deps.getProfileArtifactPreferenceEntries,
    getProfileTranscriptSampleConfig: deps.getProfileTranscriptSampleConfig,
    getProfileCapabilities: deps.getProfileCapabilities,
    getProfileFrameDensityOptions: deps.getProfileFrameDensityOptions,
    getProfileLaneCardState: deps.getProfileLaneCardState,
    getCurrentProfileMode,
    getProfileEstimate,
    getProfileLabel,
    getProfileSignals,
    sortProfileSignals: deps.sortProfileSignals,
    getProfileArtifacts,
    getProfileReadiness,
    getProfilePreflight,
    getProfileJobs,
    getProjectSource: deps.getProjectSource,
    getPreferredAssetResolution: deps.getPreferredAssetResolution,
    getPreferredAssetCodec: deps.getPreferredAssetCodec,
    getProfileTargetSummary,
    getProfileTargetAsset,
    getProfileTargetMode,
    getProfileTargetOutputOptions,
    getFocusLabel,
  });

  return {
    laboratoryHostMessageRuntime,
    laboratorySettingsUi,
    profileProcessBundle,
  };
}
