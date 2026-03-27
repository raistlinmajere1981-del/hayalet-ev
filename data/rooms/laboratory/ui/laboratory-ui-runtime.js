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
import { createLaboratorySourceStageComposition } from "./source-stage-composition.js";
import { createLaboratoryViewBindingsRuntime } from "./view-bindings-runtime.js";
import { createLaboratoryAudioAnalysisRuntime } from "./audio-analysis-runtime.js";
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
  const REGION_OPTIONS = ["containment", "corridor", "archive"];
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

  const laboratoryUiStateRuntime = createLaboratoryUiBootstrapStateRuntime({
    roomId: ROOM_ID,
    featureId: FEATURE_ID,
    stageOrder: STAGE_ORDER,
    documentRef: document,
    navigatorRef: navigator,
    resolveLocale: resolveLaboratoryLocale,
  });
  const state = laboratoryUiStateRuntime.state;

  function toRecord(value) {
    if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
      return value;
    }
    return {};
  }

  function render() {
    return laboratoryUiShellRuntime.render();
  }
  const deepClone = cloneLaboratoryValue;
  const readFormValue = readLaboratoryFormValue;
  const readValue = readLaboratoryValue;

  const escapeHtml = escapeLaboratoryHtml;
  const laboratoryMarkupHelpers = createLaboratoryMarkupHelpers({
    escapeHtml: escapeHtml,
  });
  const renderSummaryRows = laboratoryMarkupHelpers.renderSummaryRows;
  const renderTextField = laboratoryMarkupHelpers.renderTextField;
  const laboratoryUiNavigationRuntime = createLaboratoryUiNavigationRuntime({
    defaultFeatureId: FEATURE_ID,
    documentRef: document,
    render: render,
    resolveLocale: resolveLaboratoryLocale,
    roomId: ROOM_ID,
    stageOrder: STAGE_ORDER,
    state: state,
    toRecord: toRecord,
  });
  const applyLocale = laboratoryUiNavigationRuntime.applyLocale;
  const applyPresentationMode = laboratoryUiNavigationRuntime.applyPresentationMode;
  const normalizeContext = laboratoryUiNavigationRuntime.normalizeContext;
  const getStageIndex = laboratoryUiNavigationRuntime.getStageIndex;
  const setStage = laboratoryUiNavigationRuntime.setStage;
  const advanceStage = laboratoryUiNavigationRuntime.advanceStage;
  const requestSurfaceScrollReset = laboratoryUiNavigationRuntime.requestSurfaceScrollReset;
  const requestOverlayScrollReset = laboratoryUiNavigationRuntime.requestOverlayScrollReset;
  const captureScrollState = laboratoryUiNavigationRuntime.captureScrollState;
  const restoreScrollState = laboratoryUiNavigationRuntime.restoreScrollState;
  const laboratoryCopyRuntime = createLaboratoryCopyRuntime({
    audioFeatureId: AUDIO_FEATURE_ID,
    bootstrapCopy: BOOTSTRAP_COPY,
    defaultFeatureId: FEATURE_ID,
    featureNamespaces: FEATURE_NAMESPACES,
    featurePreviewImages: FEATURE_PREVIEW_IMAGES,
    getAudioAnalysisCapabilities: function () {
      return snapshotSelectors.getAudioAnalysisCapabilities();
    },
    getAudioAnalysisPresets: function () {
      return snapshotSelectors.getAudioAnalysisPresets();
    },
    readValue: readValue,
    sourceFormats: SOURCE_FORMATS,
    state: state,
    subtitleFeatureId: SUBTITLE_FEATURE_ID,
  });
  const text = laboratoryCopyRuntime.text;
  const textFromKey = laboratoryCopyRuntime.textFromKey;
  const list = laboratoryCopyRuntime.list;
  const getActiveFeatureId = laboratoryCopyRuntime.getActiveFeatureId;
  const isSubtitleAnalysisFeature = laboratoryCopyRuntime.isSubtitleAnalysisFeature;
  const isAudioAnalysisFeature = laboratoryCopyRuntime.isAudioAnalysisFeature;
  const getFeatureNamespace = laboratoryCopyRuntime.getFeatureNamespace;
  const getFeaturePreviewImage = laboratoryCopyRuntime.getFeaturePreviewImage;
  const featureText = laboratoryCopyRuntime.featureText;
  const getAvailableSourceFormats = laboratoryCopyRuntime.getAvailableSourceFormats;
  const getDefaultSourceKind = laboratoryCopyRuntime.getDefaultSourceKind;
  const bootstrapText = laboratoryCopyRuntime.bootstrapText;
  const subtitleText = laboratoryCopyRuntime.subtitleText;
  const subtitleTemplate = laboratoryCopyRuntime.subtitleTemplate;
  const laboratoryShellFrameUi = createLaboratoryShellFrameUi({
    bootstrapText: bootstrapText,
    escapeHtml: escapeHtml,
    featureText: featureText,
    getActiveStage: function () {
      return state.activeStage;
    },
    getStageIndex: getStageIndex,
    getTranslations: function () {
      return state.translations;
    },
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    readValue: readValue,
    stageOrder: STAGE_ORDER,
    subtitleText: subtitleText,
    toRecord: toRecord,
  });
  const renderBootstrap = laboratoryShellFrameUi.renderBootstrap;
  const renderStageRail = laboratoryShellFrameUi.renderStageRail;
  const renderStageIntro = laboratoryShellFrameUi.renderStageIntro;

  function setRange(edge, value) {
    void edge;
    void value;
  }

  const formatDuration = formatLaboratoryDuration;

  function formatDateTime(value) {
    return formatLaboratoryDateTime(value, state.locale);
  }

  const formatStatusLabel = formatLaboratoryStatusLabel;

  const snapshotSelectors = createSourceSnapshotSelectors({
    getState: function () {
      return state;
    },
    toRecord: toRecord,
    subtitleText: subtitleText,
    subtitleTemplate: subtitleTemplate,
    formatStatusLabel: formatStatusLabel,
    getActiveFeatureId: getActiveFeatureId,
  });
  const laboratorySnapshotAccessRuntime = createLaboratorySnapshotAccessRuntime({
    snapshotSelectors: snapshotSelectors,
  });
  const laboratoryUiDraftRuntime = createLaboratoryUiDraftRuntime({
    state: state,
    toRecord: toRecord,
    deepClone: deepClone,
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    getSourceSnapshot: laboratorySnapshotAccessRuntime.getSourceSnapshot,
    getProjectSource: laboratorySnapshotAccessRuntime.getProjectSource,
    getSubtitleWorkspace: laboratorySnapshotAccessRuntime.getSubtitleWorkspace,
    getActiveProject: laboratorySnapshotAccessRuntime.getActiveProject,
    getProjectEdit: laboratorySnapshotAccessRuntime.getProjectEdit,
    getSubtitleEditState: laboratorySnapshotAccessRuntime.getSubtitleEditState,
    getEditPresets: laboratorySnapshotAccessRuntime.getEditPresets,
  });
  const laboratoryUiDraftAccessRuntime = createLaboratoryUiDraftAccessRuntime({
    laboratoryUiDraftRuntime: laboratoryUiDraftRuntime,
  });
  const laboratoryProfileProcessReportAccessorsRuntime =
    createLaboratoryProfileProcessReportAccessorsRuntime({
      getLaboratoryUiFeatureRuntime: function () {
        return laboratoryUiFeatureRuntime;
      },
    });
  const laboratoryRequestRuntime = createLaboratoryRequestRuntime({
    bootstrapText: bootstrapText,
    buildCurrentDraftPayload: function () {
      return buildCurrentDraftPayload();
    },
    getActiveFeatureId: getActiveFeatureId,
    getRoomApi: function () {
      return window.roomAPI;
    },
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    render: render,
    requestOverlayScrollReset: requestOverlayScrollReset,
    state: state,
    toRecord: toRecord,
  });
  const laboratoryUiEditRuntime = createLaboratoryUiEditRuntime({
    deepClone: deepClone,
    isAudioAnalysisFeature: isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    laboratoryRequestRuntime: laboratoryRequestRuntime,
    laboratoryUiDraftRuntime: laboratoryUiDraftRuntime,
    toRecord: toRecord,
  });
  const mediaAnalysisUiRuntime = createMediaAnalysisUiRuntime({
    ...laboratorySnapshotAccessRuntime,
    ...laboratoryProfileProcessReportAccessorsRuntime,
    state: state,
    text: text,
    featureText: featureText,
    toRecord: toRecord,
    getAvailableSourceFormats: getAvailableSourceFormats,
    getDefaultSourceKind: getDefaultSourceKind,
    getCurrentEditDraft: function () {
      return laboratoryUiDraftAccessRuntime.getCurrentEditDraft();
    },
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    getProfileLaneMap: function () {
      return laboratoryProfileProcessReportAccessorsRuntime.getProfileLaneMap();
    },
    getProfileReadiness: function () {
      return laboratoryProfileProcessReportAccessorsRuntime.getProfileReadiness();
    },
    getProfileSignals: function () {
      return laboratoryProfileProcessReportAccessorsRuntime.getProfileSignals();
    },
  });
  const laboratoryViewBindingsRuntime = createLaboratoryViewBindingsRuntime({
    laboratorySnapshotAccessRuntime: laboratorySnapshotAccessRuntime,
    laboratoryProfileProcessReportAccessorsRuntime:
      laboratoryProfileProcessReportAccessorsRuntime,
    getLaboratorySettingsUi: function () {
      return laboratorySettingsUi;
    },
    getMediaAnalysisProfileTargetAsset: getMediaAnalysisProfileTargetAsset,
    getCurrentSourceKind: function () {
      return getCurrentSourceKind();
    },
    getCurrentSourceLabel: function () {
      return getCurrentSourceLabel();
    },
    getEditOutputs: function () {
      return getEditOutputs();
    },
    getProfileTargetSummary: function () {
      return getProfileTargetSummary();
    },
    getProjectSource: function () {
      return getProjectSource();
    },
    toRecord: toRecord,
  });
  const {
    getSourceSnapshot, getActiveProject, getProjectSummaries, getSourcePresets, getYtDlpForm,
    getEditPresets, getEditCapabilities, getProfilePresets, getProfileCapabilities, getProfileModelsCatalog,
    getProfileModelState, getSubtitleSourcePresets, getSubtitleYoutubeForm, getSubtitleEditPresets, getSubtitleAnalysisCatalog,
    getSubtitleAnalysisCapabilities, getSubtitleAnalysisProviders, getSubtitleProcessStatusLabel, getSubtitleProviderStatusLabel, getSubtitleProcessModuleSummary,
    getSubtitleProviderSummary, getSubtitleProviderModuleLabels, getAudioAnalysisCatalog, getAudioAnalysisModules, getToolRegistry,
    getProjectSource, getProjectEdit, getProjectProfile, getProjectProcess, getProjectReport,
    getProjectSubtitleAnalysis, getSubtitleWorkspace, getSubtitleDiscoveryState, getSubtitleDiscoveryItems, getSubtitleSelectedCandidateIds,
    getActiveSubtitleEntry, getSubtitleSelectedEntryIds, getSubtitleEditState, getSubtitleEditPreview, getSubtitleOutputs,
    getAudioAnalysisSourceState, getAudioAnalysisCatalogState, getAudioAnalysisProviderState, getAudioAnalysisResultMap, getSourceMetadata,
    getEditPreview, getEditOutputs, getActiveEditOutput, getToolEntry, getStageToolIds,
    getWorkspaceCapabilities, getJobs, getCurrentFeatureProcessRecord, getCurrentFeatureReportRecord, getProjectAudioAnalysis,
    getSubtitleEntries, getSubtitleProcessModuleLabel, getSubtitleProviderLabel, getAudioAnalysisCapabilities, getAudioAnalysisProviderEntries,
    getAudioAnalysisOrderedResultEntries, getProfileTargetAsset, renderSettingsOverlay, getSourceConfig, getSourceModeOptions,
    getCurrentSourceKind, getCurrentSourceLabel, getCurrentEditMode, getCurrentEditRecipe, getCurrentFocusRegionId,
    getCurrentFocusLabel, getCurrentResizeLabel, formatEditWindowLabel, getCurrentEditPresetOptions, getEffectiveMediaAsset,
    formatBitRate, formatBytes, formatCleanupPolicy, formatPlatformList, getMediaKindLabel,
    getPreferredAssetCodec, getPreferredAssetDuration, getPreferredAssetResolution, getPreferredSourceCodec, getPreferredSourceDuration,
    getPreferredSourceFormat, getPreferredSourceResolution, getProfileArtifactPreferenceEntries, getProfileConfidenceLabel, getProfileFrameDensityOptions,
    getProfileLaneCardState, getProfileSignalKindLabel, getProfileTranscriptSampleConfig, getSubtitleMimeType, getToolDisplayName,
    getProjectStatusLabel, sortProfileSignals, getCurrentSourceMode,
    laboratoryStageAccessorsRuntime,
  } = createLaboratoryUiRuntimeComposition({
    laboratorySnapshotAccessRuntime: laboratorySnapshotAccessRuntime,
    laboratoryViewBindingsRuntime: laboratoryViewBindingsRuntime,
    mediaAnalysisUiRuntime: mediaAnalysisUiRuntime,
    laboratoryUiDraftRuntime: laboratoryUiDraftRuntime,
    laboratoryUiDraftAccessRuntime: laboratoryUiDraftAccessRuntime,
    laboratoryProfileProcessReportAccessorsRuntime:
      laboratoryProfileProcessReportAccessorsRuntime,
    isAudioAnalysisFeature: isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    collectProfileStageJobs: function (projectJobs) {
      return collectProfileStageJobs(projectJobs);
    },
    collectProcessStageJobs: function (projectJobs) {
      return collectProcessStageJobs(projectJobs);
    },
    collectReportStageJobs: function (projectJobs) {
      return collectReportStageJobs(projectJobs);
    },
    setStage: setStage,
    subtitleText: subtitleText,
    text: text,
    textFromKey: textFromKey,
    toRecord: toRecord,
  });

  const laboratoryMediaPreviewUi = createLaboratoryMediaPreviewUi({
    state: state,
    render: render,
    escapeHtml: escapeHtml,
    text: text,
    formatDuration: formatDuration,
    getActiveProject: getActiveProject,
    getProjectSource: getProjectSource,
    getCurrentSourceMode: getCurrentSourceMode,
    getRelevantJobs: function () {
      return getRelevantJobs();
    },
    getCurrentSourceKind: getCurrentSourceKind,
    getProjectStatusLabel: getProjectStatusLabel,
    getCurrentSourceLabel: getCurrentSourceLabel,
    getPreferredSourceDuration: getPreferredSourceDuration,
    getPreferredSourceResolution: getPreferredSourceResolution,
    getPreferredSourceCodec: getPreferredSourceCodec,
    getPreferredSourceFormat: getPreferredSourceFormat,
    formatBitRate: formatBitRate,
    getSourceMetadata: getSourceMetadata,
  });
  const {
    bindAudioAnalysis,
    bindPreviewMetrics,
    renderPreviewMetaRow,
    renderPreviewSurface,
  } = laboratoryMediaPreviewUi;

  const mediaAnalysisEditPanels = createMediaAnalysisEditPanels({
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    text: text,
    textFromKey: textFromKey,
    formatDuration: formatDuration,
    state: state,
    getCurrentSourceKind: getCurrentSourceKind,
    getCurrentEditPresetOptions: getCurrentEditPresetOptions,
    getCurrentEditDraft: function () {
      return getCurrentEditDraft();
    },
    getProjectSource: getProjectSource,
    getCurrentEditRecipe: getCurrentEditRecipe,
    getEffectiveMediaAsset: getEffectiveMediaAsset,
    getEditPreview: getEditPreview,
    getRelevantJobs: function () {
      return getRelevantJobs();
    },
    collectEditStageJobs: function (projectJobs) {
      return collectEditStageJobs(projectJobs);
    },
    renderPreviewMetaRow: renderPreviewMetaRow,
    getPreferredSourceDuration: getPreferredSourceDuration,
    getPreferredSourceResolution: getPreferredSourceResolution,
    getPreferredSourceCodec: getPreferredSourceCodec,
    getPreferredSourceFormat: getPreferredSourceFormat,
    getEditJobLabel: function (job) {
      return getEditJobLabel(job);
    },
    getCurrentEditMode: getCurrentEditMode,
    getEditPresets: getEditPresets,
    getCurrentFocusRegionId: getCurrentFocusRegionId,
    getEditOutputs: getEditOutputs,
    getActiveEditOutput: getActiveEditOutput,
    getToolEntry: getToolEntry,
    getProjectEdit: getProjectEdit,
    renderSummaryRows: renderSummaryRows,
    formatEditWindowLabel: formatEditWindowLabel,
    getCurrentFocusLabel: getCurrentFocusLabel,
    getCurrentResizeLabel: getCurrentResizeLabel,
  });
  const {
    renderEditActionsPanel,
    renderEditCommonPanel,
    renderEditControlsPanel,
    renderEditMediaMarkup,
    renderEditModePanel,
    renderEditOutputsPanel,
    renderEditPresetChooser,
    renderEditRangeField,
    renderEditSelectField,
    renderEditSummaryPanel,
    renderEditTextField,
    renderEditToggle,
    renderEditWorkspacePanel,
  } = mediaAnalysisEditPanels;

  const subtitleAnalysisUiRuntime = createSubtitleAnalysisUiRuntime({
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    featureText: featureText,
    subtitleText: subtitleText,
    subtitleTemplate: subtitleTemplate,
    formatStatusLabel: formatStatusLabel,
    formatDuration: formatDuration,
    renderSummaryRows: renderSummaryRows,
    renderTextField: renderTextField,
    renderEditToggle: renderEditToggle,
    renderEditSelectField: renderEditSelectField,
    renderEditRangeField: renderEditRangeField,
    renderStageIntro: renderStageIntro,
    getCurrentDrafts: function () {
      return getCurrentDrafts();
    },
    getCurrentEditDraft: function () {
      return getCurrentEditDraft();
    },
    getToolEntry: getToolEntry,
    getSubtitleSourcePresets: getSubtitleSourcePresets,
    getSubtitleWorkspace: getSubtitleWorkspace,
    getSubtitleAnalysisCatalog: getSubtitleAnalysisCatalog,
    getSubtitleAnalysisProviders: getSubtitleAnalysisProviders,
    getSubtitleProcessStatusLabel: getSubtitleProcessStatusLabel,
    getSubtitleProcessModuleSummary: getSubtitleProcessModuleSummary,
    getSubtitleProcessModuleLabel: getSubtitleProcessModuleLabel,
    getSubtitleProviderStatusLabel: getSubtitleProviderStatusLabel,
    getSubtitleProviderSummary: getSubtitleProviderSummary,
    getSubtitleProviderLabel: getSubtitleProviderLabel,
    getSubtitleProviderModuleLabels: getSubtitleProviderModuleLabels,
    getActiveSubtitleEntry: getActiveSubtitleEntry,
    getSubtitleSelectedEntryIds: getSubtitleSelectedEntryIds,
    getSubtitleDiscoveryState: getSubtitleDiscoveryState,
    getSubtitleDiscoveryItems: getSubtitleDiscoveryItems,
    getSubtitleSelectedCandidateIds: getSubtitleSelectedCandidateIds,
    getSubtitleEntries: getSubtitleEntries,
    getSubtitleEditState: getSubtitleEditState,
    getSubtitleEditPresets: getSubtitleEditPresets,
    getSubtitleEditPreview: getSubtitleEditPreview,
    getSubtitleOutputs: getSubtitleOutputs,
  });
  const renderSubtitleDraftSelect = subtitleAnalysisUiRuntime.renderSubtitleDraftSelect;
  const renderSubtitleProviderPanel = subtitleAnalysisUiRuntime.renderSubtitleProviderPanel;
  const renderSubtitleSourceWorkspacePanel = subtitleAnalysisUiRuntime.renderSubtitleSourceWorkspacePanel;
  const renderSubtitleSourceIntakePanel = subtitleAnalysisUiRuntime.renderSubtitleSourceIntakePanel;
  const renderSubtitleEntryPanel = subtitleAnalysisUiRuntime.renderSubtitleEntryPanel;
  const renderSubtitleDiscoveryPanel = subtitleAnalysisUiRuntime.renderSubtitleDiscoveryPanel;
  const renderSubtitleCatalogPanel = subtitleAnalysisUiRuntime.renderSubtitleCatalogPanel;
  const renderSubtitlePreviewBody = subtitleAnalysisUiRuntime.renderSubtitlePreviewBody;
  const renderSubtitlePresetChooser = subtitleAnalysisUiRuntime.renderSubtitlePresetChooser;
  const renderSubtitleEditWorkspacePanel = subtitleAnalysisUiRuntime.renderSubtitleEditWorkspacePanel;
  const renderSubtitleEditControlsPanel = subtitleAnalysisUiRuntime.renderSubtitleEditControlsPanel;
  const renderSubtitleEditActionsPanel = subtitleAnalysisUiRuntime.renderSubtitleEditActionsPanel;
  const renderSubtitleOutputsPanel = subtitleAnalysisUiRuntime.renderSubtitleOutputsPanel;
  const renderSubtitleEditSummaryPanel = subtitleAnalysisUiRuntime.renderSubtitleEditSummaryPanel;
  const renderSubtitleEditStage = subtitleAnalysisUiRuntime.renderSubtitleEditStage;
  const audioAnalysisUi = createAudioAnalysisUi({
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    text: text,
    textFromKey: textFromKey,
    featureText: featureText,
    formatStatusLabel: formatStatusLabel,
    renderSummaryRows: renderSummaryRows,
    getToolDisplayName: getToolDisplayName,
    getAudioAnalysisModules: getAudioAnalysisModules,
    getAudioAnalysisCapabilities: getAudioAnalysisCapabilities,
    getAudioAnalysisProviderEntries: getAudioAnalysisProviderEntries,
    getAudioAnalysisProviderState: getAudioAnalysisProviderState,
    getAudioAnalysisOrderedResultEntries: getAudioAnalysisOrderedResultEntries,
  });
  const laboratoryAudioAnalysisRuntime = createLaboratoryAudioAnalysisRuntime({
    audioAnalysisUi: audioAnalysisUi,
  });
  const renderAudioAnalysisCatalogPanel = laboratoryAudioAnalysisRuntime.renderAudioAnalysisCatalogPanel;
  const renderAudioAnalysisNoticePanel = laboratoryAudioAnalysisRuntime.renderAudioAnalysisNoticePanel;
  const renderAudioAnalysisProviderPanel = laboratoryAudioAnalysisRuntime.renderAudioAnalysisProviderPanel;
  const renderAudioAnalysisModuleGrid = laboratoryAudioAnalysisRuntime.renderAudioAnalysisModuleGrid;
  const laboratorySettingsUi = createLaboratorySettingsUi({
    stageOrder: STAGE_ORDER,
    state: state,
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    text: text,
    textFromKey: textFromKey,
    featureText: featureText,
    formatBytes: formatBytes,
    formatCleanupPolicy: formatCleanupPolicy,
    formatPlatformList: formatPlatformList,
    getToolEntry: getToolEntry,
    getToolRegistry: getToolRegistry,
    getStageToolIds: getStageToolIds,
    getProfileModelEntries: function () {
      return getProfileModelEntries();
    },
    getProfileSelectedModel: function () {
      return getProfileSelectedModel();
    },
    renderPreviewMetaRow: renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel: renderAudioAnalysisProviderPanel,
    isAudioAnalysisFeature: isAudioAnalysisFeature,
  });
  const laboratoryHostMessageRuntime = createLaboratoryHostMessageRuntime({
    state: state,
    toRecord: toRecord,
    text: text,
    render: render,
    applyPresentationMode: applyPresentationMode,
    applyLocale: applyLocale,
    normalizeContext: normalizeContext,
    shouldIgnoreCorrelatedPayload: laboratoryRequestRuntime.shouldIgnoreCorrelatedPayload,
    setLastAction: laboratoryRequestRuntime.setLastAction,
  });
  const {
    laboratoryProcessStageUi,
    laboratoryReportStageUi,
    mediaAnalysisProfilePanels,
    mediaAnalysisProfileStage,
    renderProfileTargetPanel,
    renderProfileModePanel,
    renderProfilePresetPanel,
    renderProfileAdvancedPanel,
    renderProfileSignalsPanel,
    renderProfileArtifactsPanel,
    renderProfileActionsPanel,
    renderProfileSummaryPanel,
    getProcessModulePercent,
    getProcessModuleTitle,
    getRunningProcessJob,
    getRunningReportJob,
    renderReportFinding,
  } = createLaboratoryProfileProcessReportComposition({
    createLaboratoryProcessStageUi: createLaboratoryProcessStageUi,
    createLaboratoryProfileProcessReportRuntime: createLaboratoryProfileProcessReportRuntime,
    createLaboratoryReportStageUi: createLaboratoryReportStageUi,
    createMediaAnalysisProfilePanels: createMediaAnalysisProfilePanels,
    createMediaAnalysisProfileStage: createMediaAnalysisProfileStage,
    state: state,
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    text: text,
    textFromKey: textFromKey,
    featureText: featureText,
    renderStageIntro: renderStageIntro,
    renderSummaryRows: renderSummaryRows,
    formatStatusLabel: formatStatusLabel,
    formatDateTime: formatDateTime,
    formatDuration: formatDuration,
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    isAudioAnalysisFeature: isAudioAnalysisFeature,
    getCurrentFeatureProcessRecord: getCurrentFeatureProcessRecord,
    getProcessModules: function () {
      return getProcessModules();
    },
    getProcessJobs: function () {
      return getProcessJobs();
    },
    getProcessFindings: function () {
      return getProcessFindings();
    },
    getCurrentFeatureTargetLabel: function () {
      return getCurrentFeatureTargetLabel();
    },
    getCurrentFeatureArtifactCount: function () {
      return getCurrentFeatureArtifactCount();
    },
    getCurrentFeatureReportRecord: getCurrentFeatureReportRecord,
    getEffectiveMediaAsset: getEffectiveMediaAsset,
    getReportFindings: function () {
      return getReportFindings();
    },
    getReportSummaryCards: function () {
      return getReportSummaryCards();
    },
    getReportExports: function () {
      return getReportExports();
    },
    getReportJobs: function () {
      return getReportJobs();
    },
    getFeaturePreviewImage: getFeaturePreviewImage,
    renderAudioAnalysisModuleGrid: renderAudioAnalysisModuleGrid,
    getProcessArtifacts: function () {
      return getProcessArtifacts();
    },
    getCurrentSourceLabel: getCurrentSourceLabel,
    getPreferredAssetDuration: getPreferredAssetDuration,
    getSubtitleProcessModuleLabel: getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary: getSubtitleProcessModuleSummary,
    getProfileSignalKindLabel: getProfileSignalKindLabel,
    getProfileConfidenceLabel: getProfileConfidenceLabel,
    getProjectProfile: getProjectProfile,
    getProfilePresetOptions: function () {
      return getProfilePresetOptions();
    },
    getProfileModelEntries: function () {
      return getProfileModelEntries();
    },
    getProfileSelectedModel: function () {
      return getProfileSelectedModel();
    },
    getProfileLaneMap: function () {
      return getProfileLaneMap();
    },
    getCurrentSourceKind: getCurrentSourceKind,
    getProfileArtifactPreferenceEntries: getProfileArtifactPreferenceEntries,
    getProfileTranscriptSampleConfig: getProfileTranscriptSampleConfig,
    getProfileCapabilities: getProfileCapabilities,
    getProfileFrameDensityOptions: getProfileFrameDensityOptions,
    getProfileLaneCardState: getProfileLaneCardState,
    getCurrentProfileMode: function () {
      return getCurrentProfileMode();
    },
    getProfileEstimate: function () {
      return getProfileEstimate();
    },
    getProfileLabel: function () {
      return getProfileLabel();
    },
    getProfileSignals: function () {
      return getProfileSignals();
    },
    sortProfileSignals: sortProfileSignals,
    getProfileArtifacts: function () {
      return getProfileArtifacts();
    },
    getProfileReadiness: function () {
      return getProfileReadiness();
    },
    getProfilePreflight: function () {
      return getProfilePreflight();
    },
    getProfileJobs: function () {
      return getProfileJobs();
    },
    getProjectSource: getProjectSource,
    getPreferredAssetResolution: getPreferredAssetResolution,
    getPreferredAssetCodec: getPreferredAssetCodec,
    getProfileTargetSummary: function () {
      return getProfileTargetSummary();
    },
    getProfileTargetAsset: getProfileTargetAsset,
    getProfileTargetMode: function () {
      return getProfileTargetMode();
    },
    getProfileTargetOutputOptions: function () {
      return getProfileTargetOutputOptions();
    },
    getFocusLabel: function () {
      return getFocusLabel();
    },
  });

  const buildCurrentDraftPayload = laboratoryStageAccessorsRuntime.buildCurrentDraftPayload;
  const buildNestedPatch = laboratoryStageAccessorsRuntime.buildNestedPatch;
  const collectEditStageJobs = laboratoryStageAccessorsRuntime.collectEditStageJobs;
  const collectProcessStageJobs = laboratoryStageAccessorsRuntime.collectProcessStageJobs;
  const collectProfileStageJobs = laboratoryStageAccessorsRuntime.collectProfileStageJobs;
  const collectReportStageJobs = laboratoryStageAccessorsRuntime.collectReportStageJobs;
  const getCompatibleProfileLaneIds = laboratoryStageAccessorsRuntime.getCompatibleProfileLaneIds;
  const getCurrentDrafts = laboratoryStageAccessorsRuntime.getCurrentDrafts;
  const getCurrentEditDraft = laboratoryStageAccessorsRuntime.getCurrentEditDraft;
  const getCurrentFeatureArtifactCount = laboratoryStageAccessorsRuntime.getCurrentFeatureArtifactCount;
  const getCurrentFeatureTargetLabel = laboratoryStageAccessorsRuntime.getCurrentFeatureTargetLabel;
  const getCurrentProfileMode = laboratoryStageAccessorsRuntime.getCurrentProfileMode;
  const getEditJobLabel = laboratoryStageAccessorsRuntime.getEditJobLabel;
  const getFocusLabel = laboratoryStageAccessorsRuntime.getFocusLabel;
  const getProcessArtifacts = laboratoryStageAccessorsRuntime.getProcessArtifacts;
  const getProcessFindings = laboratoryStageAccessorsRuntime.getProcessFindings;
  const getProcessJobs = laboratoryStageAccessorsRuntime.getProcessJobs;
  const getProcessModules = laboratoryStageAccessorsRuntime.getProcessModules;
  const getProfileArtifacts = laboratoryStageAccessorsRuntime.getProfileArtifacts;
  const getProfileEstimate = laboratoryStageAccessorsRuntime.getProfileEstimate;
  const getProfileJobs = laboratoryStageAccessorsRuntime.getProfileJobs;
  const getProfileLabel = laboratoryStageAccessorsRuntime.getProfileLabel;
  const getProfileLaneMap = laboratoryStageAccessorsRuntime.getProfileLaneMap;
  const getProfileModelEntries = laboratoryStageAccessorsRuntime.getProfileModelEntries;
  const getProfilePreflight = laboratoryStageAccessorsRuntime.getProfilePreflight;
  const getProfilePresetOptions = laboratoryStageAccessorsRuntime.getProfilePresetOptions;
  const getProfileReadiness = laboratoryStageAccessorsRuntime.getProfileReadiness;
  const getProfileSelectedModel = laboratoryStageAccessorsRuntime.getProfileSelectedModel;
  const getProfileSignals = laboratoryStageAccessorsRuntime.getProfileSignals;
  const getProfileTargetMode = laboratoryStageAccessorsRuntime.getProfileTargetMode;
  const getProfileTargetOutputOptions = laboratoryStageAccessorsRuntime.getProfileTargetOutputOptions;
  const getProfileTargetSummary = laboratoryStageAccessorsRuntime.getProfileTargetSummary;
  const getRelevantJobs = laboratoryStageAccessorsRuntime.getRelevantJobs;
  const getReportExports = laboratoryStageAccessorsRuntime.getReportExports;
  const getReportFindings = laboratoryStageAccessorsRuntime.getReportFindings;
  const getReportJobs = laboratoryStageAccessorsRuntime.getReportJobs;
  const getReportSummaryCards = laboratoryStageAccessorsRuntime.getReportSummaryCards;
  const openReport = laboratoryStageAccessorsRuntime.openReport;
  const resetJourney = laboratoryStageAccessorsRuntime.resetJourney;
  const syncLocalEditField = laboratoryStageAccessorsRuntime.syncLocalEditField;

  const commitEditPatch = laboratoryUiEditRuntime.commitEditPatch;
  const buildCurrentEditRecipePatch = laboratoryUiEditRuntime.buildCurrentEditRecipePatch;

  function chooseRegion(regionId) {
    void regionId;
  }

  function chooseProfileFocus(focusId) {
    void focusId;
  }

  function toggleCleanup(key) {
    void key;
  }

  const restartProcess = laboratoryUiEditRuntime.restartProcess;

  const { laboratoryUiBootstrapRuntime, laboratoryUiShellRuntime } = createLaboratoryUiShellComposition({
    advanceStage: advanceStage,
    applyLocale: applyLocale,
    applyPresentationMode: applyPresentationMode,
    bindAudioAnalysis: bindAudioAnalysis,
    bindPreviewMetrics: bindPreviewMetrics,
    bootstrapText: bootstrapText,
    buildCurrentDraftPayload: buildCurrentDraftPayload,
    buildCurrentEditRecipePatch: buildCurrentEditRecipePatch,
    buildNestedPatch: buildNestedPatch,
    captureScrollState: captureScrollState,
    closeSettingsOverlay: laboratoryRequestRuntime.closeSettingsOverlay,
    commitEditPatch: commitEditPatch,
    createLaboratorySourceStageComposition: createLaboratorySourceStageComposition,
    createLaboratoryStageShellDelegates: createLaboratoryStageShellDelegates,
    createLaboratoryUiActionRouter: createLaboratoryUiActionRouter,
    createLaboratoryUiBootstrapRuntime: createLaboratoryUiBootstrapRuntime,
    createLaboratoryUiShellRuntime: createLaboratoryUiShellRuntime,
    documentRef: document,
    escapeHtml: escapeHtml,
    featureText: featureText,
    getActiveEditOutput: getActiveEditOutput,
    getActiveFeatureId: getActiveFeatureId,
    getActiveProject: getActiveProject,
    getAudioAnalysisFeature: isAudioAnalysisFeature,
    getAudioAnalysisNoticePanel: renderAudioAnalysisNoticePanel,
    getAudioAnalysisProviderPanel: renderAudioAnalysisProviderPanel,
    getAvailableSourceFormats: getAvailableSourceFormats,
    getCurrentDrafts: getCurrentDrafts,
    getCurrentEditDraft: getCurrentEditDraft,
    getCurrentSourceKind: getCurrentSourceKind,
    getCurrentSourceMode: getCurrentSourceMode,
    getProfileTargetSummary: getProfileTargetSummary,
    getProjectProfile: getProjectProfile,
    getProjectSource: getProjectSource,
    getProjectSummaries: getProjectSummaries,
    getSourceModeOptions: getSourceModeOptions,
    getSourceSnapshot: getSourceSnapshot,
    getToolEntry: getToolEntry,
    getYtDlpForm: getYtDlpForm,
    handleHostMessage: function (message) {
      return laboratoryHostMessageRuntime.handleHostMessage(message);
    },
    isAudioAnalysisFeature: isAudioAnalysisFeature,
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    laboratoryProcessStageUi: laboratoryProcessStageUi,
    laboratoryReportStageUi: laboratoryReportStageUi,
    mediaAnalysisProfileStage: mediaAnalysisProfileStage,
    openReport: openReport,
    openSettingsOverlay: laboratoryRequestRuntime.openSettingsOverlay,
    persistDrafts: laboratoryRequestRuntime.persistDrafts,
    readFormValue: readFormValue,
    render: render,
    renderAudioAnalysisCatalogPanel: renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisModuleGrid: renderAudioAnalysisModuleGrid,
    renderBootstrap: renderBootstrap,
    renderEditActionsPanel: renderEditActionsPanel,
    renderEditCommonPanel: renderEditCommonPanel,
    renderEditControlsPanel: renderEditControlsPanel,
    renderEditModePanel: renderEditModePanel,
    renderEditOutputsPanel: renderEditOutputsPanel,
    renderEditPresetChooser: renderEditPresetChooser,
    renderEditStage: renderSubtitleEditStage,
    renderEditSummaryPanel: renderEditSummaryPanel,
    renderEditWorkspacePanel: renderEditWorkspacePanel,
    renderMediaAnalysisEditStage: renderMediaAnalysisEditStage,
    renderPreviewSurface: renderPreviewSurface,
    renderSettingsOverlay: renderSettingsOverlay,
    renderSourceStage: null,
    renderStageIntro: renderStageIntro,
    renderStageRail: renderStageRail,
    renderSubtitleCatalogPanel: renderSubtitleCatalogPanel,
    renderSubtitleDiscoveryPanel: renderSubtitleDiscoveryPanel,
    renderSubtitleEditStage: renderSubtitleEditStage,
    renderSubtitleEntryPanel: renderSubtitleEntryPanel,
    renderSubtitleProviderPanel: renderSubtitleProviderPanel,
    renderSubtitleSourceIntakePanel: renderSubtitleSourceIntakePanel,
    renderSubtitleSourceWorkspacePanel: renderSubtitleSourceWorkspacePanel,
    renderTextField: renderTextField,
    resetJourney: resetJourney,
    restartProcess: restartProcess,
    restoreScrollState: restoreScrollState,
    sendMediaAction: laboratoryRequestRuntime.sendMediaAction,
    sendSourceAction: laboratoryRequestRuntime.sendSourceAction,
    setLastAction: laboratoryRequestRuntime.setLastAction,
    setStage: setStage,
    state: state,
    syncDraftField: laboratoryRequestRuntime.syncDraftField,
    syncLocalEditField: syncLocalEditField,
    text: text,
    textFromKey: textFromKey,
    toRecord: toRecord,
    toggleCleanup: toggleCleanup,
    windowRef: window,
  });

  laboratoryUiBootstrapRuntime.attach();
})();
