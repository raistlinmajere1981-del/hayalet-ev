import type { createLaboratoryUiActionRouter } from "../shared/ui/action-router.js";
import type { createLaboratoryStageShellDelegates } from "../shared/ui/stage-shell-delegates.js";
import type { createLaboratoryUiShellRuntime } from "../shared/ui/shell-runtime.js";
import type { LaboratoryStageSurface } from "../shared/types/room-shell-contracts.js";
import type { createLaboratoryUiBootstrapStateRuntime } from "./bootstrap-state-runtime.js";
import type { createLaboratoryUiBootstrapRuntime } from "./bootstrap-runtime.js";
import type { createLaboratorySourceStageComposition } from "./source-stage-composition.js";

type LaboratoryRecord = Record<string, unknown>;
type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];
type LaboratorySourceStageCompositionDeps = Parameters<
  typeof createLaboratorySourceStageComposition
>[0];
type LaboratoryStageShellDelegatesDeps = Parameters<typeof createLaboratoryStageShellDelegates>[0];
type LaboratoryUiShellRuntimeDeps = Parameters<typeof createLaboratoryUiShellRuntime>[0];
type LaboratoryUiActionRouterDeps = Parameters<typeof createLaboratoryUiActionRouter>[0];
type LaboratoryUiBootstrapRuntimeDeps = Parameters<typeof createLaboratoryUiBootstrapRuntime>[0];
type LaboratoryMediaAnalysisEditStageDeps = {
  escapeHtml: (value: string) => string;
  getCurrentEditMode: () => string;
  getProjectSource: () => unknown;
  renderEditAdvancedPanel: () => string;
  renderEditActionsPanel: () => string;
  renderEditCommonPanel: () => string;
  renderEditControlsPanel: () => string;
  renderEditModePanel: () => string;
  renderEditOutputsPanel: () => string;
  renderEditPresetChooser: () => string;
  renderEditProgressPanel: () => string;
  renderEditSummaryPanel: () => string;
  renderEditWorkspacePanel: () => string;
  renderStageIntro: (stageId: string) => string;
  text: (path: string[]) => string;
};
type LaboratoryProfileStageUi = {
  renderProfileStage: () => string;
};
type LaboratoryProcessStageUi = {
  renderProcessStage: () => LaboratoryStageSurface;
};
type LaboratoryReportStageUi = {
  renderReportStage: () => LaboratoryStageSurface;
};
type LaboratoryShellWindow = Window & {
  roomAPI?: unknown;
};

type LaboratoryUiShellCompositionDeps = {
  advanceStage: (...args: unknown[]) => unknown;
  applyLocale: (locale: string) => void;
  applyPresentationMode: (mode: unknown) => void;
  bindAudioAnalysis: () => void;
  bindPreviewMetrics: () => void;
  bootstrapText: (key: string) => string;
  buildCurrentDraftPayload: () => LaboratoryRecord;
  buildCurrentEditRecipePatch: () => LaboratoryRecord;
  buildNestedPatch: (...args: unknown[]) => LaboratoryRecord;
  captureScrollState: (root: Element) => void;
  closeSettingsOverlay: () => void;
  commitEditPatch: (...args: unknown[]) => unknown;
  createLaboratorySourceStageComposition: typeof createLaboratorySourceStageComposition;
  createLaboratoryStageShellDelegates: typeof createLaboratoryStageShellDelegates;
  createLaboratoryUiActionRouter: typeof createLaboratoryUiActionRouter;
  createLaboratoryUiBootstrapRuntime: typeof createLaboratoryUiBootstrapRuntime;
  createLaboratoryUiShellRuntime: typeof createLaboratoryUiShellRuntime;
  documentRef: Document;
  escapeHtml: (value: string) => string;
  featureText: (path: string[]) => string;
  getActiveEditOutput: () => unknown;
  getActiveFeatureId: () => string;
  getActiveProject: () => unknown;
  getAvailableSourceFormats: () => unknown;
  getCurrentDrafts: () => unknown;
  getCurrentEditDraft: () => unknown;
  getCurrentEditMode: () => string;
  getCurrentSourceKind: () => string;
  getCurrentSourceMode: () => unknown;
  getProfileTargetSummary: () => unknown;
  getProjectProfile: () => unknown;
  getProjectSource: () => unknown;
  getProjectSummaries: () => unknown[];
  getSourceModeOptions: () => unknown[];
  getSourceSnapshot: () => unknown;
  getToolEntry: (toolId: unknown) => unknown;
  getToolRegistry: () => unknown[];
  getYtDlpForm: () => unknown;
  handleHostMessage: (message: unknown) => void;
  isAudioAnalysisFeature: () => boolean;
  isSubtitleAnalysisFeature: () => boolean;
  laboratoryProcessStageUi: LaboratoryProcessStageUi;
  laboratoryReportStageUi: LaboratoryReportStageUi;
  mediaAnalysisProfileStage: LaboratoryProfileStageUi;
  openReport: () => void;
  openSettingsOverlay: () => void;
  persistDrafts: (...args: unknown[]) => unknown;
  readFormValue: (...args: unknown[]) => unknown;
  render: () => void;
  renderAudioAnalysisCatalogPanel: () => string;
  renderAudioAnalysisNoticePanel: () => string;
  renderAudioAnalysisProviderPanel: () => string;
  renderBootstrap: () => string;
  renderEditAdvancedPanel: () => string;
  renderEditActionsPanel: () => string;
  renderEditCommonPanel: () => string;
  renderEditControlsPanel: () => string;
  renderEditModePanel: () => string;
  renderEditOutputsPanel: () => string;
  renderEditPresetChooser: () => string;
  renderEditProgressPanel: () => string;
  renderEditSummaryPanel: () => string;
  renderEditWorkspacePanel: () => string;
  renderMediaAnalysisEditStage: (deps: LaboratoryMediaAnalysisEditStageDeps) => string;
  renderPreviewSurface: () => string;
  renderSettingsOverlay: () => string;
  renderStageIntro: (stageId: string) => string;
  renderStageRail: () => string;
  renderSubtitleCatalogPanel: () => string;
  renderSubtitleDiscoveryPanel: () => string;
  renderSubtitleEditStage: () => string;
  renderSubtitleEntryPanel: () => string;
  renderSubtitleProviderPanel: () => string;
  renderSubtitleSourceIntakePanel: () => string;
  renderSubtitleSourceWorkspacePanel: () => string;
  renderTextField: (...args: unknown[]) => string;
  resetJourney: () => void;
  restartProcess: () => void;
  restoreScrollState: (root: Element) => void;
  setActiveWorkbenchModule: (featureId: string) => void;
  setBlockingStatus: (message: string, detail?: string | null) => void;
  setResultStatus: (message: string, detail?: string | null) => void;
  sendMediaAction: (...args: unknown[]) => unknown;
  sendSourceAction: (...args: unknown[]) => unknown;
  setLastAction: (message: string) => void;
  setStage: (...args: unknown[]) => unknown;
  state: LaboratoryUiState;
  syncDraftField: (path: string, value: unknown) => void;
  syncLocalEditField: (...args: unknown[]) => unknown;
  text: (path: string[]) => string;
  textFromKey: (key: string) => string;
  toRecord: (value: unknown) => LaboratoryRecord;
  toggleEventLog: (force?: boolean) => void;
  toggleWorkbenchModuleSelection: (featureId: string) => void;
  toggleCleanup: (...args: unknown[]) => unknown;
  windowRef: LaboratoryShellWindow;
};

export function createLaboratoryUiShellComposition(deps: LaboratoryUiShellCompositionDeps) {
  const laboratorySourceStageCompositionDeps = {
    state: deps.state,
    toRecord: deps.toRecord,
    escapeHtml: deps.escapeHtml,
    text: deps.text,
    textFromKey: deps.textFromKey,
    featureText: deps.featureText,
    renderStageIntro: deps.renderStageIntro,
    renderTextField: deps.renderTextField,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    getProjectSummaries: deps.getProjectSummaries,
    getSourceSnapshot: deps.getSourceSnapshot,
    getActiveProject: deps.getActiveProject,
    getAvailableSourceFormats: deps.getAvailableSourceFormats,
    getCurrentSourceKind: deps.getCurrentSourceKind,
    getCurrentSourceMode: deps.getCurrentSourceMode,
    getSourceModeOptions: deps.getSourceModeOptions,
    getToolEntry: deps.getToolEntry,
    getCurrentDrafts: deps.getCurrentDrafts,
    getYtDlpForm: deps.getYtDlpForm,
    renderPreviewSurface: deps.renderPreviewSurface,
    renderAudioAnalysisCatalogPanel: deps.renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisProviderPanel: deps.renderAudioAnalysisProviderPanel,
    renderAudioAnalysisNoticePanel: deps.renderAudioAnalysisNoticePanel,
    renderSubtitleSourceWorkspacePanel: deps.renderSubtitleSourceWorkspacePanel,
    renderSubtitleDiscoveryPanel: deps.renderSubtitleDiscoveryPanel,
    renderSubtitleCatalogPanel: deps.renderSubtitleCatalogPanel,
    renderSubtitleProviderPanel: deps.renderSubtitleProviderPanel,
    renderSubtitleSourceIntakePanel: deps.renderSubtitleSourceIntakePanel,
    renderSubtitleEntryPanel: deps.renderSubtitleEntryPanel,
  };
  const laboratorySourceStageUi = deps.createLaboratorySourceStageComposition(
    laboratorySourceStageCompositionDeps as unknown as LaboratorySourceStageCompositionDeps
  );

  const laboratoryStageShellDelegatesDeps = {
    laboratorySourceStageUi,
    isSubtitleAnalysisFeature: deps.isSubtitleAnalysisFeature,
    renderSubtitleEditStage: deps.renderSubtitleEditStage,
    renderMediaAnalysisEditStage: deps.renderMediaAnalysisEditStage,
    mediaAnalysisEditStageDeps: {
      escapeHtml: deps.escapeHtml,
      getCurrentEditMode: deps.getCurrentEditMode,
      getProjectSource: deps.getProjectSource,
      renderEditAdvancedPanel: deps.renderEditAdvancedPanel,
      renderEditActionsPanel: deps.renderEditActionsPanel,
      renderEditCommonPanel: deps.renderEditCommonPanel,
      renderEditControlsPanel: deps.renderEditControlsPanel,
      renderEditModePanel: deps.renderEditModePanel,
      renderEditOutputsPanel: deps.renderEditOutputsPanel,
      renderEditPresetChooser: deps.renderEditPresetChooser,
      renderEditProgressPanel: deps.renderEditProgressPanel,
      renderEditSummaryPanel: deps.renderEditSummaryPanel,
      renderEditWorkspacePanel: deps.renderEditWorkspacePanel,
      renderStageIntro: deps.renderStageIntro,
      text: deps.text,
    },
    mediaAnalysisProfileStage: deps.mediaAnalysisProfileStage,
    laboratoryProcessStageUi: deps.laboratoryProcessStageUi,
    laboratoryReportStageUi: deps.laboratoryReportStageUi,
  };
  const laboratoryStageShellDelegates = deps.createLaboratoryStageShellDelegates(
    laboratoryStageShellDelegatesDeps as unknown as LaboratoryStageShellDelegatesDeps
  );

  const laboratoryUiShellRuntimeDeps = {
    state: deps.state,
    documentRef: deps.documentRef,
    escapeHtml: deps.escapeHtml,
    renderBootstrap: deps.renderBootstrap,
    renderStageRail: deps.renderStageRail,
    renderSettingsOverlay: deps.renderSettingsOverlay,
    renderSourceStage: laboratoryStageShellDelegates.renderSourceStage,
    renderEditStage: laboratoryStageShellDelegates.renderEditStage,
    renderProfileStage: laboratoryStageShellDelegates.renderProfileStage,
    renderProcessStage: laboratoryStageShellDelegates.renderProcessStage,
    renderReportStage: laboratoryStageShellDelegates.renderReportStage,
    captureScrollState: deps.captureScrollState,
    restoreScrollState: deps.restoreScrollState,
    bindPreviewMetrics: deps.bindPreviewMetrics,
    bindAudioAnalysis: deps.bindAudioAnalysis,
    text: deps.text,
  };
  const laboratoryUiShellRuntime = deps.createLaboratoryUiShellRuntime(
    laboratoryUiShellRuntimeDeps as unknown as LaboratoryUiShellRuntimeDeps
  );

  const laboratoryUiActionRouterDeps = {
    advanceStage: deps.advanceStage,
    buildCurrentDraftPayload: deps.buildCurrentDraftPayload,
    buildCurrentEditRecipePatch: deps.buildCurrentEditRecipePatch,
    buildNestedPatch: deps.buildNestedPatch,
    closeSettingsOverlay: deps.closeSettingsOverlay,
    commitEditPatch: deps.commitEditPatch,
    getActiveEditOutput: deps.getActiveEditOutput,
    getCurrentEditDraft: deps.getCurrentEditDraft,
    getProfileTargetSummary: deps.getProfileTargetSummary,
    getProjectProfile: deps.getProjectProfile,
    getSourceSnapshot: deps.getSourceSnapshot,
    getToolRegistry: deps.getToolRegistry,
    isAudioAnalysisFeature: deps.isAudioAnalysisFeature,
    openReport: deps.openReport,
    openSettingsOverlay: deps.openSettingsOverlay,
    persistDrafts: deps.persistDrafts,
    readFormValue: deps.readFormValue,
    render: deps.render,
    resetJourney: deps.resetJourney,
    restartProcess: deps.restartProcess,
    setActiveWorkbenchModule: deps.setActiveWorkbenchModule,
    setBlockingStatus: deps.setBlockingStatus,
    setResultStatus: deps.setResultStatus,
    sendMediaAction: deps.sendMediaAction,
    sendSourceAction: deps.sendSourceAction,
    setStage: deps.setStage,
    state: deps.state,
    syncDraftField: deps.syncDraftField,
    syncLocalEditField: deps.syncLocalEditField,
    text: deps.text,
    toRecord: deps.toRecord,
    toggleEventLog: deps.toggleEventLog,
    toggleWorkbenchModuleSelection: deps.toggleWorkbenchModuleSelection,
    toggleCleanup: deps.toggleCleanup,
  };
  const laboratoryUiActionRouter = deps.createLaboratoryUiActionRouter(
    laboratoryUiActionRouterDeps as unknown as LaboratoryUiActionRouterDeps
  );

  const laboratoryUiBootstrapRuntimeDeps = {
    actionRouter: laboratoryUiActionRouter,
    applyLocale: deps.applyLocale,
    applyPresentationMode: deps.applyPresentationMode,
    bootstrapText: deps.bootstrapText,
    documentRef: deps.documentRef,
    getActiveFeatureId: deps.getActiveFeatureId,
    handleHostMessage(message: unknown) {
      deps.handleHostMessage(message);
    },
    render: deps.render,
    setLastAction: deps.setLastAction,
    state: deps.state,
    windowRef: deps.windowRef,
  };
  const laboratoryUiBootstrapRuntime = deps.createLaboratoryUiBootstrapRuntime(
    laboratoryUiBootstrapRuntimeDeps as unknown as LaboratoryUiBootstrapRuntimeDeps
  );

  return {
    laboratoryUiBootstrapRuntime,
    laboratoryUiShellRuntime,
  };
}
