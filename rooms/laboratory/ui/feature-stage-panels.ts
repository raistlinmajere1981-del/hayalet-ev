import type { createAudioAnalysisUi } from "../main-functions/audio-analysis/ui/module.js";
import type { createMediaAnalysisEditPanels } from "../main-functions/media-analysis/ui/edit-panels.js";
import type { createSubtitleAnalysisUiRuntime } from "../main-functions/subtitle-analysis/ui/runtime.js";
import type { createLaboratoryMediaPreviewUi } from "../shared/ui/media-preview.js";
import type { LaboratoryDraftStageJobRecord } from "../shared/ui/draft-runtime.js";
import type { createLaboratoryUiBootstrapStateRuntime } from "./bootstrap-state-runtime.js";
import type { createLaboratoryAudioAnalysisRuntime } from "./audio-analysis-runtime.js";
import type { LaboratoryStageAccessorsRuntimeApi } from "./stage-accessors-runtime.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];

type LaboratoryRelevantJobsRecord = LaboratoryRecord & {
  project?: unknown;
};

type LaboratoryFeatureStagePanelsDeps = {
  createAudioAnalysisUi: typeof createAudioAnalysisUi;
  createLaboratoryAudioAnalysisRuntime: typeof createLaboratoryAudioAnalysisRuntime;
  createLaboratoryMediaPreviewUi: typeof createLaboratoryMediaPreviewUi;
  createMediaAnalysisEditPanels: typeof createMediaAnalysisEditPanels;
  createSubtitleAnalysisUiRuntime: typeof createSubtitleAnalysisUiRuntime;
  escapeHtml: (value: string) => string;
  featureText: (...args: unknown[]) => string;
  formatBitRate: (value: unknown) => string;
  formatDuration: (value: number | null | undefined) => string;
  formatEditWindowLabel: () => string;
  formatStatusLabel: (...args: unknown[]) => string;
  getActiveEditOutput: () => unknown | null;
  getActiveProject: () => LaboratoryRecord | null;
  getActiveSubtitleEntry: () => unknown | null;
  getAudioAnalysisCapabilities: () => unknown;
  getAudioAnalysisModules: () => unknown;
  getAudioAnalysisOrderedResultEntries: () => unknown;
  getAudioAnalysisProviderEntries: () => unknown;
  getAudioAnalysisProviderState: () => unknown;
  getCurrentEditMode: () => string;
  getCurrentEditRecipe: () => LaboratoryRecord;
  getCurrentFocusLabel: () => string;
  getCurrentFocusRegionId: () => string;
  getCurrentResizeLabel: () => string;
  getCurrentSourceKind: () => string;
  getCurrentSourceLabel: () => string;
  getCurrentSourceMode: () => string;
  getEditOutputs: () => unknown[];
  getEditPresets: () => LaboratoryRecord;
  getEditPreview: () => LaboratoryRecord;
  getEffectiveMediaAsset: () => LaboratoryRecord;
  getPreferredSourceCodec: () => string;
  getPreferredSourceDuration: (previewUrl: string | null) => number | null;
  getPreferredSourceFormat: () => string;
  getPreferredSourceResolution: (previewUrl: string | null) => string;
  getProjectEdit: () => LaboratoryRecord;
  getProjectSource: () => LaboratoryRecord;
  getProjectStatusLabel: (...args: unknown[]) => string;
  getSourceMetadata: () => LaboratoryRecord;
  getSubtitleAnalysisCatalog: () => unknown;
  getSubtitleAnalysisProviders: () => unknown;
  getSubtitleDiscoveryItems: () => unknown;
  getSubtitleDiscoveryState: () => unknown;
  getSubtitleEditPresets: () => unknown;
  getSubtitleEditPreview: () => unknown;
  getSubtitleEditState: () => unknown;
  getSubtitleEntries: () => unknown;
  getSubtitleOutputs: () => unknown;
  getSubtitleProcessModuleLabel: (...args: unknown[]) => string;
  getSubtitleProcessModuleSummary: (...args: unknown[]) => unknown;
  getSubtitleProcessStatusLabel: (...args: unknown[]) => string;
  getSubtitleProviderLabel: (...args: unknown[]) => string;
  getSubtitleProviderModuleLabels: (...args: unknown[]) => unknown;
  getSubtitleProviderStatusLabel: (...args: unknown[]) => string;
  getSubtitleProviderSummary: (...args: unknown[]) => unknown;
  getSubtitleSelectedCandidateIds: () => unknown;
  getSubtitleSelectedEntryIds: () => unknown;
  getSubtitleSourcePresets: () => unknown;
  getSubtitleWorkspace: () => unknown;
  getToolDisplayName: (...args: unknown[]) => string;
  getToolEntry: (...args: unknown[]) => LaboratoryRecord;
  laboratoryStageAccessorsRuntime: LaboratoryStageAccessorsRuntimeApi;
  render: () => unknown;
  renderStageIntro: (...args: unknown[]) => string;
  renderSummaryRows: (...args: unknown[]) => string;
  renderTextField: (...args: unknown[]) => string;
  state: LaboratoryUiState;
  subtitleTemplate: unknown;
  subtitleText: (...args: unknown[]) => string;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryFeatureStagePanelsRuntime(deps: LaboratoryFeatureStagePanelsDeps) {
  const {
    createAudioAnalysisUi,
    createLaboratoryAudioAnalysisRuntime,
    createLaboratoryMediaPreviewUi,
    createMediaAnalysisEditPanels,
    createSubtitleAnalysisUiRuntime,
    escapeHtml,
    featureText,
    formatBitRate,
    formatDuration,
    formatEditWindowLabel,
    formatStatusLabel,
    getActiveEditOutput,
    getActiveProject,
    getActiveSubtitleEntry,
    getAudioAnalysisCapabilities,
    getAudioAnalysisModules,
    getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState,
    getCurrentEditMode,
    getCurrentEditRecipe,
    getCurrentFocusLabel,
    getCurrentFocusRegionId,
    getCurrentResizeLabel,
    getCurrentSourceKind,
    getCurrentSourceLabel,
    getCurrentSourceMode,
    getEditOutputs,
    getEditPresets,
    getEditPreview,
    getEffectiveMediaAsset,
    getPreferredSourceCodec,
    getPreferredSourceDuration,
    getPreferredSourceFormat,
    getPreferredSourceResolution,
    getProjectEdit,
    getProjectSource,
    getProjectStatusLabel,
    getSourceMetadata,
    getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders,
    getSubtitleDiscoveryItems,
    getSubtitleDiscoveryState,
    getSubtitleEditPresets,
    getSubtitleEditPreview,
    getSubtitleEditState,
    getSubtitleEntries,
    getSubtitleOutputs,
    getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary,
    getSubtitleProcessStatusLabel,
    getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels,
    getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary,
    getSubtitleSelectedCandidateIds,
    getSubtitleSelectedEntryIds,
    getSubtitleSourcePresets,
    getSubtitleWorkspace,
    getToolDisplayName,
    getToolEntry,
    laboratoryStageAccessorsRuntime,
    render,
    renderStageIntro,
    renderSummaryRows,
    renderTextField,
    state,
    subtitleTemplate,
    subtitleText,
    text,
    textFromKey,
    toRecord,
  } = deps;

  function asRecord(value: unknown): LaboratoryRecord {
    return toRecord(value);
  }

  function toJobRecord(value: unknown): LaboratoryDraftStageJobRecord {
    return asRecord(value);
  }

  function getRelevantJobsSafe(): LaboratoryRelevantJobsRecord {
    return asRecord(laboratoryStageAccessorsRuntime.getRelevantJobs());
  }

  function getCurrentEditDraftSafe() {
    return asRecord(laboratoryStageAccessorsRuntime.getCurrentEditDraft());
  }

  function getCurrentDraftsSafe() {
    return asRecord(laboratoryStageAccessorsRuntime.getCurrentDrafts());
  }

  function getProfilePresetOptionsSafe() {
    const presetOptions: unknown = laboratoryStageAccessorsRuntime.getProfilePresetOptions();
    return Array.isArray(presetOptions) ? presetOptions.map(asRecord) : [];
  }

  function collectEditStageJobsSafe(projectJobs: unknown[]) {
    const jobs: unknown = laboratoryStageAccessorsRuntime.collectEditStageJobs(projectJobs);
    return Array.isArray(jobs) ? jobs.map(toJobRecord) : [];
  }

  function getEditJobLabelSafe(job: LaboratoryDraftStageJobRecord) {
    const label: unknown = laboratoryStageAccessorsRuntime.getEditJobLabel(job);
    return typeof label === "string" ? label : "";
  }

  const laboratoryMediaPreviewUiDeps = {
    state,
    render,
    escapeHtml,
    text,
    formatDuration,
    getActiveProject,
    getProjectSource,
    getCurrentSourceMode,
    getRelevantJobs: getRelevantJobsSafe,
    getCurrentSourceKind,
    getProjectStatusLabel,
    getCurrentSourceLabel,
    getPreferredSourceDuration,
    getPreferredSourceResolution,
    getPreferredSourceCodec,
    getPreferredSourceFormat,
    formatBitRate,
    getSourceMetadata,
  };
  const laboratoryMediaPreviewUi = createLaboratoryMediaPreviewUi(
    laboratoryMediaPreviewUiDeps as unknown as Parameters<typeof createLaboratoryMediaPreviewUi>[0]
  );
  const { bindAudioAnalysis, bindPreviewMetrics, renderPreviewMetaRow, renderPreviewSurface } =
    laboratoryMediaPreviewUi;

  const mediaAnalysisEditPanelsDeps = {
    toRecord,
    escapeHtml,
    text,
    textFromKey,
    formatDuration,
    state,
    getCurrentSourceKind,
    getCurrentEditPresetOptions: getProfilePresetOptionsSafe,
    getCurrentEditDraft: getCurrentEditDraftSafe,
    getProjectSource,
    getCurrentEditRecipe,
    getEffectiveMediaAsset,
    getEditPreview,
    getRelevantJobs: getRelevantJobsSafe,
    collectEditStageJobs: collectEditStageJobsSafe,
    renderPreviewMetaRow,
    getPreferredSourceDuration,
    getPreferredSourceResolution,
    getPreferredSourceCodec,
    getPreferredSourceFormat,
    getEditJobLabel: getEditJobLabelSafe,
    getCurrentEditMode,
    getEditPresets,
    getCurrentFocusRegionId,
    getEditOutputs,
    getActiveEditOutput,
    getToolEntry,
    getProjectEdit,
    renderSummaryRows,
    formatEditWindowLabel,
    getCurrentFocusLabel,
    getCurrentResizeLabel,
  };
  const mediaAnalysisEditPanels = createMediaAnalysisEditPanels(
    mediaAnalysisEditPanelsDeps as unknown as Parameters<typeof createMediaAnalysisEditPanels>[0]
  );

  const subtitleAnalysisUiRuntimeDeps = {
    toRecord,
    escapeHtml,
    featureText,
    subtitleText,
    subtitleTemplate,
    formatStatusLabel,
    formatDuration,
    renderSummaryRows,
    renderTextField,
    renderEditToggle: mediaAnalysisEditPanels.renderEditToggle,
    renderEditSelectField: mediaAnalysisEditPanels.renderEditSelectField,
    renderEditRangeField: mediaAnalysisEditPanels.renderEditRangeField,
    renderStageIntro,
    getCurrentDrafts: getCurrentDraftsSafe,
    getCurrentEditDraft: getCurrentEditDraftSafe,
    getToolEntry,
    getSubtitleSourcePresets,
    getSubtitleWorkspace,
    getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders,
    getSubtitleProcessStatusLabel,
    getSubtitleProcessModuleSummary,
    getSubtitleProcessModuleLabel,
    getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary,
    getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels,
    getActiveSubtitleEntry,
    getSubtitleSelectedEntryIds,
    getSubtitleDiscoveryState,
    getSubtitleDiscoveryItems,
    getSubtitleSelectedCandidateIds,
    getSubtitleEntries,
    getSubtitleEditState,
    getSubtitleEditPresets,
    getSubtitleEditPreview,
    getSubtitleOutputs,
  };
  const subtitleAnalysisUiRuntime = createSubtitleAnalysisUiRuntime(
    subtitleAnalysisUiRuntimeDeps as unknown as Parameters<
      typeof createSubtitleAnalysisUiRuntime
    >[0]
  );

  const audioAnalysisUi = createAudioAnalysisUi({
    toRecord,
    escapeHtml,
    text,
    textFromKey,
    featureText,
    formatStatusLabel,
    renderSummaryRows,
    getToolDisplayName,
    getAudioAnalysisModules,
    getAudioAnalysisCapabilities,
    getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState,
    getAudioAnalysisOrderedResultEntries,
  });
  const laboratoryAudioAnalysisRuntime = createLaboratoryAudioAnalysisRuntime({
    audioAnalysisUi,
  });

  return {
    bindAudioAnalysis,
    bindPreviewMetrics,
    renderPreviewMetaRow,
    renderPreviewSurface,
    renderEditActionsPanel: mediaAnalysisEditPanels.renderEditActionsPanel,
    renderEditCommonPanel: mediaAnalysisEditPanels.renderEditCommonPanel,
    renderEditControlsPanel: mediaAnalysisEditPanels.renderEditControlsPanel,
    renderEditMediaMarkup: mediaAnalysisEditPanels.renderEditMediaMarkup,
    renderEditModePanel: mediaAnalysisEditPanels.renderEditModePanel,
    renderEditOutputsPanel: mediaAnalysisEditPanels.renderEditOutputsPanel,
    renderEditPresetChooser: mediaAnalysisEditPanels.renderEditPresetChooser,
    renderEditRangeField: mediaAnalysisEditPanels.renderEditRangeField,
    renderEditSelectField: mediaAnalysisEditPanels.renderEditSelectField,
    renderEditSummaryPanel: mediaAnalysisEditPanels.renderEditSummaryPanel,
    renderEditTextField: mediaAnalysisEditPanels.renderEditTextField,
    renderEditToggle: mediaAnalysisEditPanels.renderEditToggle,
    renderEditWorkspacePanel: mediaAnalysisEditPanels.renderEditWorkspacePanel,
    renderSubtitleDraftSelect: subtitleAnalysisUiRuntime.renderSubtitleDraftSelect,
    renderSubtitleProviderPanel: subtitleAnalysisUiRuntime.renderSubtitleProviderPanel,
    renderSubtitleSourceWorkspacePanel:
      subtitleAnalysisUiRuntime.renderSubtitleSourceWorkspacePanel,
    renderSubtitleSourceIntakePanel: subtitleAnalysisUiRuntime.renderSubtitleSourceIntakePanel,
    renderSubtitleEntryPanel: subtitleAnalysisUiRuntime.renderSubtitleEntryPanel,
    renderSubtitleDiscoveryPanel: subtitleAnalysisUiRuntime.renderSubtitleDiscoveryPanel,
    renderSubtitleCatalogPanel: subtitleAnalysisUiRuntime.renderSubtitleCatalogPanel,
    renderSubtitlePreviewBody: subtitleAnalysisUiRuntime.renderSubtitlePreviewBody,
    renderSubtitlePresetChooser: subtitleAnalysisUiRuntime.renderSubtitlePresetChooser,
    renderSubtitleEditWorkspacePanel: subtitleAnalysisUiRuntime.renderSubtitleEditWorkspacePanel,
    renderSubtitleEditControlsPanel: subtitleAnalysisUiRuntime.renderSubtitleEditControlsPanel,
    renderSubtitleEditActionsPanel: subtitleAnalysisUiRuntime.renderSubtitleEditActionsPanel,
    renderSubtitleOutputsPanel: subtitleAnalysisUiRuntime.renderSubtitleOutputsPanel,
    renderSubtitleEditSummaryPanel: subtitleAnalysisUiRuntime.renderSubtitleEditSummaryPanel,
    renderSubtitleEditStage: subtitleAnalysisUiRuntime.renderSubtitleEditStage,
    renderAudioAnalysisCatalogPanel: laboratoryAudioAnalysisRuntime.renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisNoticePanel: laboratoryAudioAnalysisRuntime.renderAudioAnalysisNoticePanel,
    renderAudioAnalysisProviderPanel:
      laboratoryAudioAnalysisRuntime.renderAudioAnalysisProviderPanel,
    renderAudioAnalysisModuleGrid: laboratoryAudioAnalysisRuntime.renderAudioAnalysisModuleGrid,
  };
}
