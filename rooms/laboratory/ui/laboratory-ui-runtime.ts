import type { LaboratorySettingsUiApi } from "../shared/ui/settings-overlay.js";
import type { LaboratoryUiShellRuntimeApi } from "../shared/ui/shell-runtime.js";
import { createSourceSnapshotSelectors } from "../shared/ui/source-snapshot-selectors.js";
import { createLaboratoryUiActionRouter } from "../shared/ui/action-router.js";
import {
  cloneLaboratoryValue,
  escapeLaboratoryHtml,
  formatLaboratoryDuration,
  formatLaboratoryStatusLabel,
  formatLaboratoryDateTime,
  readLaboratoryFormValue,
  readLaboratoryValue,
  resolveLaboratoryLocale,
} from "../shared/ui/base-utils.js";
import { createLaboratoryMarkupHelpers } from "../shared/ui/markup.js";
import { createLaboratoryProcessStageUi } from "../shared/ui/process-stage.js";
import { createLaboratoryReportStageUi } from "../shared/ui/report-stage.js";
import { createLaboratoryHostMessageRuntime } from "../shared/ui/host-messages.js";
import { createLaboratoryMediaPreviewUi } from "../shared/ui/media-preview.js";
import { createLaboratoryUiNavigationRuntime } from "../shared/ui/navigation-runtime.js";
import { createLaboratoryCopyRuntime } from "../shared/ui/copy-runtime.js";
import { createLaboratoryRequestRuntime } from "../shared/ui/request-runtime.js";
import { createLaboratoryStageShellDelegates } from "../shared/ui/stage-shell-delegates.js";
import { createLaboratoryShellFrameUi } from "../shared/ui/shell-frame.js";
import { createLaboratorySettingsUi } from "../shared/ui/settings-overlay.js";
import { createLaboratoryUiDraftRuntime } from "../shared/ui/draft-runtime.js";
import { createLaboratoryUiDraftAccessRuntime } from "./draft-access-runtime.js";
import { createLaboratoryProfileProcessReportAccessorsRuntime } from "../shared/ui/profile-process-report-accessors.js";
import { createLaboratoryProfileProcessReportRuntime } from "./profile-process-report-runtime.js";
import { createLaboratoryUiEditRuntime } from "./edit-runtime.js";
import { createLaboratoryUiShellRuntime } from "../shared/ui/shell-runtime.js";
import { createLaboratoryUiBootstrapRuntime } from "./bootstrap-runtime.js";
import { createLaboratoryUiBootstrapStateRuntime } from "./bootstrap-state-runtime.js";
import { createLaboratoryProfileProcessReportComposition } from "../shared/ui/profile-process-report-composition.js";
import { createLaboratoryUiRuntimeComposition } from "./runtime-composition.js";
import { createLaboratorySnapshotAccessRuntime } from "./snapshot-access-runtime.js";
import { createLaboratoryUiCoreRuntime } from "./core-runtime.js";
import { createLaboratorySourceStageComposition } from "./source-stage-composition.js";
import { createLaboratoryViewBindingsRuntime } from "./view-bindings-runtime.js";
import { createLaboratoryAudioAnalysisRuntime } from "./audio-analysis-runtime.js";
import { createLaboratoryFeatureStageRuntime } from "./feature-stage-runtime.js";
import { createLaboratoryUiShellComposition } from "./shell-composition.js";
import { createSubtitleAnalysisUiRuntime } from "../main-functions/subtitle-analysis/ui/runtime.js";
import { createMediaAnalysisEditPanels } from "../main-functions/media-analysis/ui/edit-panels.js";
import { renderMediaAnalysisEditStage } from "../main-functions/media-analysis/ui/edit-stage.js";
import { createMediaAnalysisUiRuntime } from "../main-functions/media-analysis/ui/runtime.js";
import { createMediaAnalysisProfilePanels } from "../main-functions/media-analysis/ui/profile-panels.js";
import { createMediaAnalysisProfileStage } from "../main-functions/media-analysis/ui/profile-stage.js";
import { getMediaAnalysisProfileTargetAsset } from "../main-functions/media-analysis/ui/profile-target.js";
import { createAudioAnalysisUi } from "../main-functions/audio-analysis/ui/module.js";

(function () {
  const ROOM_ID = "laboratory";
  const SUBTITLE_FEATURE_ID = "subtitle-analysis";
  const AUDIO_FEATURE_ID = "audio-analysis";
  const FEATURE_ID = "media-analysis";
  const STAGE_ORDER = ["source", "edit", "profile", "process", "report"];
  const SOURCE_FORMATS = ["video", "audio", "image"];
  const FEATURE_NAMESPACES = {
    [FEATURE_ID]: "mediaAnalysis",
    [AUDIO_FEATURE_ID]: "audioAnalysis",
    [SUBTITLE_FEATURE_ID]: "subtitleAnalysis",
  };
  const FEATURE_PREVIEW_IMAGES = {
    [FEATURE_ID]: "../main-functions/media-analysis/assets/media-analysis-view.webp",
    [AUDIO_FEATURE_ID]: "../main-functions/audio-analysis/assets/sound-analysis.webp",
    [SUBTITLE_FEATURE_ID]: "../main-functions/subtitle-analysis/assets/subtitle-analysis.webp",
  };

  const BOOTSTRAP_COPY = {
    en: {
      loadingTitle: "Loading Laboratory",
      loadingBody: "Waiting for room context and room-local translations.",
      roomApiUnavailable: "Room API bridge is not connected.",
    },
    tr: {
      loadingTitle: "Laboratuvar Yukleniyor",
      loadingBody: "Oda baglami ve room-local ceviriler bekleniyor.",
      roomApiUnavailable: "Room API koprusu bagli degil.",
    },
  };

  const laboratoryUiRefs: {
    settingsUi: LaboratorySettingsUiApi | null;
    shellRuntime: LaboratoryUiShellRuntimeApi | null;
  } = {
    settingsUi: null,
    shellRuntime: null,
  };

  function render() {
    const shell = laboratoryUiRefs.shellRuntime;
    if (!shell) {
      throw new Error("Laboratory shell runtime is not initialized");
    }
    return shell.render();
  }
  const coreRuntimeDeps = {
    audioFeatureId: AUDIO_FEATURE_ID,
    bootstrapCopy: BOOTSTRAP_COPY,
    cloneLaboratoryValue,
    createLaboratoryCopyRuntime,
    createLaboratoryMarkupHelpers,
    createLaboratoryProfileProcessReportAccessorsRuntime,
    createLaboratoryRequestRuntime,
    createLaboratoryShellFrameUi,
    createLaboratorySnapshotAccessRuntime,
    createLaboratoryUiBootstrapStateRuntime,
    createLaboratoryUiDraftAccessRuntime,
    createLaboratoryUiDraftRuntime,
    createLaboratoryUiEditRuntime,
    createLaboratoryUiNavigationRuntime,
    createLaboratoryUiRuntimeComposition,
    createLaboratoryViewBindingsRuntime,
    createMediaAnalysisUiRuntime,
    createSourceSnapshotSelectors,
    documentRef: document,
    escapeLaboratoryHtml,
    featureId: FEATURE_ID,
    featureNamespaces: FEATURE_NAMESPACES,
    featurePreviewImages: FEATURE_PREVIEW_IMAGES,
    formatLaboratoryDateTime,
    formatLaboratoryDuration,
    formatLaboratoryStatusLabel,
    getLaboratorySettingsUi() {
      return laboratoryUiRefs.settingsUi;
    },
    getMediaAnalysisProfileTargetAsset,
    navigatorRef: navigator,
    readLaboratoryFormValue,
    readLaboratoryValue,
    render,
    resolveLaboratoryLocale,
    roomId: ROOM_ID,
    sourceFormats: SOURCE_FORMATS,
    stageOrder: STAGE_ORDER,
    subtitleFeatureId: SUBTITLE_FEATURE_ID,
  };
  const coreRuntime = createLaboratoryUiCoreRuntime(
    coreRuntimeDeps as unknown as Parameters<typeof createLaboratoryUiCoreRuntime>[0]
  );
  void coreRuntime.laboratoryStageAccessorsRuntime.collectProfileStageJobs;

  const laboratoryFeatureStageRuntimeDeps = {
    applyLocale: coreRuntime.applyLocale,
    applyPresentationMode: coreRuntime.applyPresentationMode,
    createAudioAnalysisUi: createAudioAnalysisUi,
    createLaboratoryAudioAnalysisRuntime: createLaboratoryAudioAnalysisRuntime,
    createLaboratoryHostMessageRuntime: createLaboratoryHostMessageRuntime,
    createLaboratoryMediaPreviewUi: createLaboratoryMediaPreviewUi,
    createLaboratoryProcessStageUi: createLaboratoryProcessStageUi,
    createLaboratoryProfileProcessReportComposition:
      createLaboratoryProfileProcessReportComposition,
    createLaboratoryProfileProcessReportRuntime: createLaboratoryProfileProcessReportRuntime,
    createLaboratoryReportStageUi: createLaboratoryReportStageUi,
    createLaboratorySettingsUi: createLaboratorySettingsUi,
    createMediaAnalysisEditPanels: createMediaAnalysisEditPanels,
    createMediaAnalysisProfilePanels: createMediaAnalysisProfilePanels,
    createMediaAnalysisProfileStage: createMediaAnalysisProfileStage,
    createSubtitleAnalysisUiRuntime: createSubtitleAnalysisUiRuntime,
    escapeHtml: coreRuntime.escapeHtml,
    featureText: coreRuntime.featureText,
    formatBitRate: coreRuntime.formatBitRate,
    formatBytes: coreRuntime.formatBytes,
    formatCleanupPolicy: coreRuntime.formatCleanupPolicy,
    formatDateTime: coreRuntime.formatDateTime,
    formatDuration: coreRuntime.formatDuration,
    formatEditWindowLabel: coreRuntime.formatEditWindowLabel,
    formatPlatformList: coreRuntime.formatPlatformList,
    formatStatusLabel: coreRuntime.formatStatusLabel,
    getActiveProject: coreRuntime.getActiveProject,
    getActiveEditOutput: coreRuntime.getActiveEditOutput,
    getActiveSubtitleEntry: coreRuntime.getActiveSubtitleEntry,
    getAudioAnalysisCapabilities: coreRuntime.getAudioAnalysisCapabilities,
    getAudioAnalysisModules: coreRuntime.getAudioAnalysisModules,
    getAudioAnalysisOrderedResultEntries: coreRuntime.getAudioAnalysisOrderedResultEntries,
    getAudioAnalysisProviderEntries: coreRuntime.getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState: coreRuntime.getAudioAnalysisProviderState,
    getCurrentEditMode: coreRuntime.getCurrentEditMode,
    getCurrentEditPresetOptions: coreRuntime.getCurrentEditPresetOptions,
    getCurrentEditRecipe: coreRuntime.getCurrentEditRecipe,
    getCurrentFeatureProcessRecord: coreRuntime.getCurrentFeatureProcessRecord,
    getCurrentFeatureReportRecord: coreRuntime.getCurrentFeatureReportRecord,
    getCurrentFocusLabel: coreRuntime.getCurrentFocusLabel,
    getCurrentFocusRegionId: coreRuntime.getCurrentFocusRegionId,
    getCurrentSourceKind: coreRuntime.getCurrentSourceKind,
    getCurrentSourceLabel: coreRuntime.getCurrentSourceLabel,
    getCurrentSourceMode: coreRuntime.getCurrentSourceMode,
    getEditOutputs: coreRuntime.getEditOutputs,
    getEditPresets: coreRuntime.getEditPresets,
    getEditPreview: coreRuntime.getEditPreview,
    getEffectiveMediaAsset: coreRuntime.getEffectiveMediaAsset,
    getFeaturePreviewImage: coreRuntime.getFeaturePreviewImage,
    getPreferredAssetCodec: coreRuntime.getPreferredAssetCodec,
    getPreferredAssetDuration: coreRuntime.getPreferredAssetDuration,
    getPreferredAssetResolution: coreRuntime.getPreferredAssetResolution,
    getPreferredSourceCodec: coreRuntime.getPreferredSourceCodec,
    getPreferredSourceDuration: coreRuntime.getPreferredSourceDuration,
    getPreferredSourceFormat: coreRuntime.getPreferredSourceFormat,
    getPreferredSourceResolution: coreRuntime.getPreferredSourceResolution,
    getProfileArtifactPreferenceEntries: coreRuntime.getProfileArtifactPreferenceEntries,
    getProfileCapabilities: coreRuntime.getProfileCapabilities,
    getProfileFrameDensityOptions: coreRuntime.getProfileFrameDensityOptions,
    getProfileLaneCardState: coreRuntime.getProfileLaneCardState,
    getProfileConfidenceLabel: coreRuntime.getProfileConfidenceLabel,
    getProfileSignalKindLabel: coreRuntime.getProfileSignalKindLabel,
    getProfileTargetAsset: coreRuntime.getProfileTargetAsset,
    getProfileTranscriptSampleConfig: coreRuntime.getProfileTranscriptSampleConfig,
    getProjectEdit: coreRuntime.getProjectEdit,
    getProjectProfile: coreRuntime.getProjectProfile,
    getProjectSource: coreRuntime.getProjectSource,
    getProjectStatusLabel: coreRuntime.getProjectStatusLabel,
    getSourceMetadata: coreRuntime.getSourceMetadata,
    getStageToolIds: coreRuntime.getStageToolIds,
    getSubtitleAnalysisCatalog: coreRuntime.getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders: coreRuntime.getSubtitleAnalysisProviders,
    getSubtitleDiscoveryItems: coreRuntime.getSubtitleDiscoveryItems,
    getSubtitleDiscoveryState: coreRuntime.getSubtitleDiscoveryState,
    getSubtitleEditPresets: coreRuntime.getSubtitleEditPresets,
    getSubtitleEditPreview: coreRuntime.getSubtitleEditPreview,
    getSubtitleEditState: coreRuntime.getSubtitleEditState,
    getSubtitleEntries: coreRuntime.getSubtitleEntries,
    getSubtitleOutputs: coreRuntime.getSubtitleOutputs,
    getSubtitleProcessModuleLabel: coreRuntime.getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary: coreRuntime.getSubtitleProcessModuleSummary,
    getSubtitleProcessStatusLabel: coreRuntime.getSubtitleProcessStatusLabel,
    getSubtitleProviderLabel: coreRuntime.getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels: coreRuntime.getSubtitleProviderModuleLabels,
    getSubtitleProviderStatusLabel: coreRuntime.getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary: coreRuntime.getSubtitleProviderSummary,
    getSubtitleSelectedCandidateIds: coreRuntime.getSubtitleSelectedCandidateIds,
    getSubtitleSelectedEntryIds: coreRuntime.getSubtitleSelectedEntryIds,
    getSubtitleSourcePresets: coreRuntime.getSubtitleSourcePresets,
    getSubtitleWorkspace: coreRuntime.getSubtitleWorkspace,
    getToolDisplayName: coreRuntime.getToolDisplayName,
    getToolEntry: coreRuntime.getToolEntry,
    getToolRegistry: coreRuntime.getToolRegistry,
    isAudioAnalysisFeature: coreRuntime.isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: coreRuntime.isSubtitleAnalysisFeature,
    laboratoryRequestRuntime: coreRuntime.laboratoryRequestRuntime,
    laboratoryStageAccessorsRuntime: coreRuntime.laboratoryStageAccessorsRuntime,
    normalizeContext: coreRuntime.normalizeContext,
    render: render,
    renderStageIntro: coreRuntime.renderStageIntro,
    renderSummaryRows: coreRuntime.renderSummaryRows,
    renderTextField: coreRuntime.renderTextField,
    sortProfileSignals: coreRuntime.sortProfileSignals,
    stageOrder: STAGE_ORDER,
    state: coreRuntime.state,
    subtitleTemplate: coreRuntime.subtitleTemplate,
    subtitleText: coreRuntime.subtitleText,
    text: coreRuntime.text,
    textFromKey: coreRuntime.textFromKey,
    toRecord: coreRuntime.toRecord,
  };
  const laboratoryFeatureStageRuntime = createLaboratoryFeatureStageRuntime(
    laboratoryFeatureStageRuntimeDeps as unknown as Parameters<
      typeof createLaboratoryFeatureStageRuntime
    >[0]
  );
  const profileProcessBundle = laboratoryFeatureStageRuntime.profileProcessBundle;
  void profileProcessBundle.renderReportFinding;

  const laboratoryUiShellCompositionDeps = {
    advanceStage: coreRuntime.advanceStage,
    applyLocale: coreRuntime.applyLocale,
    applyPresentationMode: coreRuntime.applyPresentationMode,
    bindAudioAnalysis: laboratoryFeatureStageRuntime.bindAudioAnalysis,
    bindPreviewMetrics: laboratoryFeatureStageRuntime.bindPreviewMetrics,
    bootstrapText: coreRuntime.bootstrapText,
    buildCurrentDraftPayload: coreRuntime.buildCurrentDraftPayload,
    buildCurrentEditRecipePatch: coreRuntime.buildCurrentEditRecipePatch,
    buildNestedPatch: coreRuntime.buildNestedPatch,
    captureScrollState: coreRuntime.captureScrollState,
    closeSettingsOverlay: coreRuntime.closeSettingsOverlay,
    commitEditPatch: coreRuntime.commitEditPatch,
    createLaboratorySourceStageComposition: createLaboratorySourceStageComposition,
    createLaboratoryStageShellDelegates: createLaboratoryStageShellDelegates,
    createLaboratoryUiActionRouter: createLaboratoryUiActionRouter,
    createLaboratoryUiBootstrapRuntime: createLaboratoryUiBootstrapRuntime,
    createLaboratoryUiShellRuntime: createLaboratoryUiShellRuntime,
    documentRef: document,
    escapeHtml: coreRuntime.escapeHtml,
    featureText: coreRuntime.featureText,
    getActiveEditOutput: coreRuntime.getActiveEditOutput,
    getActiveFeatureId: coreRuntime.getActiveFeatureId,
    getActiveProject: coreRuntime.getActiveProject,
    getAudioAnalysisFeature: coreRuntime.isAudioAnalysisFeature,
    getAvailableSourceFormats: coreRuntime.getAvailableSourceFormats,
    getCurrentDrafts: coreRuntime.getCurrentDrafts,
    getCurrentEditDraft: coreRuntime.getCurrentEditDraft,
    getCurrentSourceKind: coreRuntime.getCurrentSourceKind,
    getCurrentSourceMode: coreRuntime.getCurrentSourceMode,
    getProfileTargetSummary: coreRuntime.getProfileTargetSummary,
    getProjectProfile: coreRuntime.getProjectProfile,
    getProjectSource: coreRuntime.getProjectSource,
    getProjectSummaries: coreRuntime.getProjectSummaries,
    getSourceModeOptions: coreRuntime.getSourceModeOptions,
    getSourceSnapshot: coreRuntime.getSourceSnapshot,
    getToolEntry: coreRuntime.getToolEntry,
    getYtDlpForm: coreRuntime.getYtDlpForm,
    handleHostMessage: function (message: unknown) {
      return laboratoryFeatureStageRuntime.laboratoryHostMessageRuntime.handleHostMessage(message);
    },
    isAudioAnalysisFeature: coreRuntime.isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: coreRuntime.isSubtitleAnalysisFeature,
    laboratoryProcessStageUi: profileProcessBundle.laboratoryProcessStageUi,
    laboratoryReportStageUi: profileProcessBundle.laboratoryReportStageUi,
    mediaAnalysisProfileStage: profileProcessBundle.mediaAnalysisProfileStage,
    openReport: coreRuntime.openReport,
    openSettingsOverlay: coreRuntime.openSettingsOverlay,
    persistDrafts: coreRuntime.persistDrafts,
    readFormValue: coreRuntime.readFormValue,
    render: render,
    renderAudioAnalysisCatalogPanel: laboratoryFeatureStageRuntime.renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisModuleGrid: laboratoryFeatureStageRuntime.renderAudioAnalysisModuleGrid,
    renderAudioAnalysisNoticePanel: laboratoryFeatureStageRuntime.renderAudioAnalysisNoticePanel,
    renderAudioAnalysisProviderPanel:
      laboratoryFeatureStageRuntime.renderAudioAnalysisProviderPanel,
    renderBootstrap: coreRuntime.renderBootstrap,
    renderEditActionsPanel: laboratoryFeatureStageRuntime.renderEditActionsPanel,
    renderEditCommonPanel: laboratoryFeatureStageRuntime.renderEditCommonPanel,
    renderEditControlsPanel: laboratoryFeatureStageRuntime.renderEditControlsPanel,
    renderEditModePanel: laboratoryFeatureStageRuntime.renderEditModePanel,
    renderEditOutputsPanel: laboratoryFeatureStageRuntime.renderEditOutputsPanel,
    renderEditPresetChooser: laboratoryFeatureStageRuntime.renderEditPresetChooser,
    renderEditStage: laboratoryFeatureStageRuntime.renderSubtitleEditStage,
    renderEditSummaryPanel: laboratoryFeatureStageRuntime.renderEditSummaryPanel,
    renderEditWorkspacePanel: laboratoryFeatureStageRuntime.renderEditWorkspacePanel,
    renderMediaAnalysisEditStage: renderMediaAnalysisEditStage,
    renderPreviewSurface: laboratoryFeatureStageRuntime.renderPreviewSurface,
    renderSettingsOverlay: coreRuntime.renderSettingsOverlay,
    renderSourceStage: null,
    renderStageIntro: coreRuntime.renderStageIntro,
    renderStageRail: coreRuntime.renderStageRail,
    renderSubtitleCatalogPanel: laboratoryFeatureStageRuntime.renderSubtitleCatalogPanel,
    renderSubtitleDiscoveryPanel: laboratoryFeatureStageRuntime.renderSubtitleDiscoveryPanel,
    renderSubtitleEditStage: laboratoryFeatureStageRuntime.renderSubtitleEditStage,
    renderSubtitleEntryPanel: laboratoryFeatureStageRuntime.renderSubtitleEntryPanel,
    renderSubtitleProviderPanel: laboratoryFeatureStageRuntime.renderSubtitleProviderPanel,
    renderSubtitleSourceIntakePanel: laboratoryFeatureStageRuntime.renderSubtitleSourceIntakePanel,
    renderSubtitleSourceWorkspacePanel:
      laboratoryFeatureStageRuntime.renderSubtitleSourceWorkspacePanel,
    renderTextField: coreRuntime.renderTextField,
    resetJourney: coreRuntime.resetJourney,
    restartProcess: coreRuntime.restartProcess,
    restoreScrollState: coreRuntime.restoreScrollState,
    sendMediaAction: coreRuntime.sendMediaAction,
    sendSourceAction: coreRuntime.sendSourceAction,
    setLastAction: coreRuntime.setLastAction,
    setStage: coreRuntime.setStage,
    state: coreRuntime.state,
    syncDraftField: coreRuntime.syncDraftField,
    syncLocalEditField: coreRuntime.syncLocalEditField,
    text: coreRuntime.text,
    textFromKey: coreRuntime.textFromKey,
    toRecord: coreRuntime.toRecord,
    toggleCleanup(key: unknown) {
      void key;
    },
    windowRef: window,
  };
  const laboratoryUiShellComposition = createLaboratoryUiShellComposition(
    laboratoryUiShellCompositionDeps as unknown as Parameters<
      typeof createLaboratoryUiShellComposition
    >[0]
  );

  const laboratoryUiBootstrapRuntime = laboratoryUiShellComposition.laboratoryUiBootstrapRuntime;
  laboratoryUiRefs.settingsUi = laboratoryFeatureStageRuntime.laboratorySettingsUi;
  laboratoryUiRefs.shellRuntime = laboratoryUiShellComposition.laboratoryUiShellRuntime;
  laboratoryUiBootstrapRuntime.attach();
})();
