import { createSourceSnapshotSelectors } from "../shared/ui/source-snapshot-selectors.js";
import { createLaboratoryUiActionRouter } from "../shared/ui/action-router.js";
import {
  cloneLaboratoryValue,
  escapeLaboratoryHtml,
  formatLaboratoryDateTime,
  formatLaboratoryDuration,
  formatLaboratoryStatusLabel,
  formatLaboratoryTime,
  readLaboratoryFormValue,
  readLaboratoryValue,
  resolveLaboratoryLocale,
} from "../shared/ui/base-utils.js";
import { createLaboratoryMarkupHelpers } from "../shared/ui/markup.js";
import { createLaboratoryProcessStageUi } from "../shared/ui/process-stage.js";
import { createLaboratoryReportStageUi } from "../shared/ui/report-stage.js";
import { createLaboratoryHostMessageRuntime } from "../shared/ui/host-messages.js";
import { createLaboratoryMediaPreviewUi } from "../shared/ui/media-preview.js";
import { createLaboratorySettingsUi } from "../shared/ui/settings-overlay.js";
import { createLaboratoryUiDraftRuntime } from "../shared/ui/draft-runtime.js";
import { createLaboratorySourceStageUi } from "../shared/ui/source-stage.js";
import { createMediaAnalysisEditPanels } from "../main-functions/media-analysis/ui/edit-panels.js";
import { createMediaAnalysisProfilePanels } from "../main-functions/media-analysis/ui/profile-panels.js";
import { createMediaAnalysisProfileStage } from "../main-functions/media-analysis/ui/profile-stage.js";
import { createAudioAnalysisUi } from "../main-functions/audio-analysis/ui/module.js";
import { createSubtitleAnalysisUi } from "../main-functions/subtitle-analysis/ui/module.js";

(function () {
  const ROOM_ID = "laboratory";
  const SUBTITLE_FEATURE_ID = "subtitle-analysis";
  const AUDIO_FEATURE_ID = "audio-analysis";
  const FEATURE_ID = "media-analysis";
  const STAGE_ORDER = ["source", "edit", "profile", "process", "report"];
  const SOURCE_FORMATS = ["video", "audio", "image"];
  const REGION_OPTIONS = ["containment", "corridor", "archive"];
  const TOTAL_DURATION_MS = 9370;
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

  const state = {
    locale: resolveLaboratoryLocale(document.documentElement.lang || navigator.language),
    translations: null,
    context: createContext(),
    presentation: {
      mode: "scene-view",
    },
    activeStage: "source",
    sourceSnapshot: createSourceSnapshot(),
    ui: {
      settingsOpen: false,
      pendingDeleteProjectId: null,
      lastRequestId: null,
      requestCounter: 0,
      latestRequestByDomain: {
        project: 0,
        "source-config": 0,
        "source-acquire": 0,
        "edit-config": 0,
        "edit-preview": 0,
        "edit-apply": 0,
        "edit-preview-cancel": 0,
        "edit-apply-cancel": 0,
        "profile-config": 0,
        "profile-run": 0,
        "profile-cancel": 0,
        "profile-model": 0,
        "process-run": 0,
        "process-cancel": 0,
        "report-export": 0,
        tools: 0,
        misc: 0,
      },
      requestLookup: {},
      lastActionMessage: "",
      localDraftProjectId: null,
      localDrafts: createLocalDrafts(),
      localSubtitleDraftProjectId: null,
      localSubtitleDrafts: createSubtitleLocalDrafts(),
      localEditProjectId: null,
      localEditUpdatedAt: null,
      localEditDraft: null,
      localSubtitleEditProjectId: null,
      localSubtitleEditUpdatedAt: null,
      localSubtitleEditDraft: null,
      previewMetrics: {
        url: null,
        duration: null,
        width: null,
        height: null,
      },
      audioAnalysis: {
        url: null,
        bars: [],
      },
      scrollPositions: {
        surface: 0,
        overlay: 0,
      },
      surfaceScrollResetPending: false,
      overlayScrollResetPending: false,
    },
  };

  function createContext() {
    return {
      room: {
        id: ROOM_ID,
        name: "Laboratory",
      },
      featureId: FEATURE_ID,
      user: {
        nickname: "Operator",
      },
      presentation: {
        mode: "classic",
      },
    };
  }

  function createSourceSnapshot() {
    return {
      ready: false,
      stages: STAGE_ORDER.slice(),
      sourcePresets: {},
      ytDlpForm: {},
      editPresets: {},
      editCapabilities: {},
      profilePresets: {},
      profileCapabilities: {},
      profileModels: {},
      subtitleSourcePresets: {},
      subtitleYoutubeForm: {},
      subtitleEditPresets: {},
      subtitleAnalysisCatalog: {},
      subtitleAnalysisCapabilities: {},
      subtitleAnalysisProviders: {},
      audioAnalysisCatalog: {},
      audioAnalysisCapabilities: {},
      audioAnalysisPresets: {},
      audioAnalysisProviders: {},
      profileModelState: {
        models: {},
      },
      toolRegistry: [],
      projects: [],
      activeProjectId: null,
      activeProject: null,
      toolState: {
        tools: {},
      },
      jobs: [],
    };
  }

  function createLocalDrafts() {
    return {
      urlInput: "",
      youtubeUrl: "",
      fileNameHint: "",
      youtubePreset: null,
      youtubeCustom: {},
    };
  }

  function createSubtitleLocalDrafts() {
    return {
      urlInput: "",
      youtubeUrl: "",
      subtitleMode: "manual",
      subtitlesLang: "all",
      publishedAfter: "",
      publishedBefore: "",
      weekdays: "",
      durationMinSeconds: null,
      durationMaxSeconds: null,
      shortsMode: "all",
      liveMode: "all",
      titleInclude: "",
      titleExclude: "",
      playlistItems: "",
      limitCount: null,
    };
  }

  function toRecord(value) {
    if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
      return value;
    }
    return {};
  }
  const deepClone = cloneLaboratoryValue;
  const readFormValue = readLaboratoryFormValue;
  const readValue = readLaboratoryValue;

  function text(path) {
    const localized = readValue(state.translations, path);
    if (typeof localized === "string") {
      return localized;
    }
    const fallback = readValue(BOOTSTRAP_COPY[state.locale], path);
    if (typeof fallback === "string") {
      return fallback;
    }
    const englishFallback = readValue(BOOTSTRAP_COPY.en, path);
    if (typeof englishFallback === "string") {
      return englishFallback;
    }
    return path[path.length - 1] || "";
  }

  function textFromKey(key) {
    if (typeof key !== "string" || key.trim() === "") {
      return "";
    }
    return text(key.split("."));
  }

  function list(path) {
    const value = readValue(state.translations, path);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  }

  const escapeHtml = escapeLaboratoryHtml;
  const laboratoryMarkupHelpers = createLaboratoryMarkupHelpers({
    escapeHtml: escapeHtml,
  });
  const renderSummaryRows = laboratoryMarkupHelpers.renderSummaryRows;
  const renderTextField = laboratoryMarkupHelpers.renderTextField;

  function applyLocale(locale) {
    state.locale = resolveLaboratoryLocale(locale);
    document.documentElement.lang = state.locale;
  }

  function applyPresentationMode(mode) {
    state.presentation.mode = mode === "scene-view" ? "scene-view" : "classic";
    document.body.dataset.presentationMode = state.presentation.mode;
    document.documentElement.dataset.presentationMode = state.presentation.mode;
  }

  function normalizeContext(message) {
    const source =
      message && typeof message === "object" && Array.isArray(message) === false ? message : {};
    const room = toRecord(source.room);
    const user = toRecord(source.user);
    const presentation = toRecord(source.presentation);
    const activeFeature = toRecord(source.activeFeature);
    const featureId =
      (typeof activeFeature.id === "string" && activeFeature.id.trim() !== ""
        ? activeFeature.id.trim()
        : null) ||
      (typeof source.featureId === "string" && source.featureId.trim() !== ""
        ? source.featureId.trim()
        : null) ||
      FEATURE_ID;

    return {
      room: {
        id: typeof room.id === "string" && room.id.trim() !== "" ? room.id.trim() : ROOM_ID,
        name:
          typeof room.name === "string" && room.name.trim() !== ""
            ? room.name.trim()
            : "Laboratory",
      },
      featureId: featureId,
      user: {
        nickname:
          typeof user.nickname === "string" && user.nickname.trim() !== ""
            ? user.nickname.trim()
            : "Operator",
      },
      presentation: {
        mode: presentation.mode === "scene-view" ? "scene-view" : "classic",
      },
    };
  }

  function getActiveFeatureId() {
    return typeof state.context.featureId === "string" && state.context.featureId.trim() !== ""
      ? state.context.featureId
      : FEATURE_ID;
  }

  function isSubtitleAnalysisFeature() {
    return getActiveFeatureId() === SUBTITLE_FEATURE_ID;
  }

  function isAudioAnalysisFeature() {
    return getActiveFeatureId() === AUDIO_FEATURE_ID;
  }

  function getFeatureNamespace() {
    return FEATURE_NAMESPACES[getActiveFeatureId()] || FEATURE_NAMESPACES[FEATURE_ID];
  }

  function getFeaturePreviewImage() {
    return FEATURE_PREVIEW_IMAGES[getActiveFeatureId()] || FEATURE_PREVIEW_IMAGES[FEATURE_ID];
  }

  function featureText(path) {
    const localized = readValue(state.translations, [getFeatureNamespace()].concat(path));
    if (typeof localized === "string") {
      return localized;
    }
    return text(["mediaAnalysis"].concat(path));
  }

  function getAvailableSourceFormats() {
    if (isAudioAnalysisFeature()) {
      const presets = getAudioAnalysisPresets();
      const capabilities = getAudioAnalysisCapabilities();
      const configuredFormats = Array.isArray(presets.allowedSourceKinds)
        ? presets.allowedSourceKinds
        : Array.isArray(capabilities.allowedSourceKinds)
          ? capabilities.allowedSourceKinds
          : [];
      const filteredFormats = configuredFormats.filter(function (entry) {
        return typeof entry === "string" && SOURCE_FORMATS.includes(entry);
      });
      return filteredFormats.length > 0 ? filteredFormats : ["audio", "video"];
    }

    return SOURCE_FORMATS.slice();
  }

  function getDefaultSourceKind() {
    if (isAudioAnalysisFeature()) {
      const configuredKind = getAudioAnalysisPresets().defaultSourceKind;
      if (typeof configuredKind === "string" && getAvailableSourceFormats().includes(configuredKind)) {
        return configuredKind;
      }
      return "audio";
    }

    return "video";
  }

  function bootstrapText(key) {
    return (
      readValue(BOOTSTRAP_COPY[state.locale], [key]) ||
      readValue(BOOTSTRAP_COPY.en, [key]) ||
      key
    );
  }

  function subtitleCopy(trValue, enValue) {
    return state.locale === "tr" ? trValue : enValue;
  }

  function subtitleText(path, trFallback, enFallback) {
    const localized = readValue(state.translations, ["subtitleAnalysis"].concat(path));
    if (typeof localized === "string") {
      return localized;
    }
    return subtitleCopy(trFallback, enFallback);
  }

  function subtitleTemplate(path, replacements, trFallback, enFallback) {
    const template = subtitleText(path, trFallback, enFallback);
    return Object.keys(toRecord(replacements)).reduce(function (message, key) {
      return message.replaceAll(`{${key}}`, String(toRecord(replacements)[key]));
    }, template);
  }

  function getStageIndex(stageId) {
    return STAGE_ORDER.indexOf(stageId);
  }

  function setStage(stageId) {
    if (STAGE_ORDER.includes(stageId) === false) {
      return;
    }
    if (state.activeStage === stageId) {
      return;
    }
    state.activeStage = stageId;
    requestSurfaceScrollReset();
    render();
  }

  function advanceStage(direction) {
    const currentIndex = getStageIndex(state.activeStage);
    const nextIndex = Math.max(0, Math.min(STAGE_ORDER.length - 1, currentIndex + direction));
    setStage(STAGE_ORDER[nextIndex]);
  }

  function setRange(edge, value) {
    void edge;
    void value;
  }

  function requestSurfaceScrollReset() {
    state.ui.scrollPositions.surface = 0;
    state.ui.surfaceScrollResetPending = true;
  }

  function requestOverlayScrollReset() {
    state.ui.scrollPositions.overlay = 0;
    state.ui.overlayScrollResetPending = true;
  }

  function captureScrollState(root) {
    const surface = root.querySelector(".lab-surface");
    if (surface instanceof HTMLElement) {
      state.ui.scrollPositions.surface = surface.scrollTop;
    }

    const overlayPanel = root.querySelector(".lab-overlay__panel");
    if (overlayPanel instanceof HTMLElement) {
      state.ui.scrollPositions.overlay = overlayPanel.scrollTop;
    }
  }

  function restoreScrollState(root) {
    const surface = root.querySelector(".lab-surface");
    if (surface instanceof HTMLElement) {
      surface.scrollTop = state.ui.surfaceScrollResetPending ? 0 : state.ui.scrollPositions.surface;
    }
    state.ui.surfaceScrollResetPending = false;

    const overlayPanel = root.querySelector(".lab-overlay__panel");
    if (overlayPanel instanceof HTMLElement) {
      overlayPanel.scrollTop = state.ui.overlayScrollResetPending ? 0 : state.ui.scrollPositions.overlay;
    }
    state.ui.overlayScrollResetPending = false;
  }

  function formatTime(ms) {
    return formatLaboratoryTime(ms, TOTAL_DURATION_MS);
  }

  const formatDuration = formatLaboratoryDuration;

  function formatDateTime(value) {
    return formatLaboratoryDateTime(value, state.locale);
  }

  function getSubtitleMimeType(fileName) {
    const normalized = typeof fileName === "string" ? fileName.toLowerCase() : "";
    if (normalized.endsWith(".vtt")) {
      return "text/vtt";
    }
    if (normalized.endsWith(".ass") || normalized.endsWith(".ssa")) {
      return "text/x-ass";
    }
    return "application/x-subrip";
  }

  const formatStatusLabel = formatLaboratoryStatusLabel;

  function getRangeTimes() {
    return { start: formatTime(0), end: formatTime(TOTAL_DURATION_MS) };
  }

  function setLastAction(message) {
    state.ui.lastActionMessage = message;
  }

  function getActionDomain(action) {
    switch (action) {
      case "project-create":
      case "project-select":
      case "project-delete":
        return "project";
      case "source-set-kind":
      case "source-set-mode":
      case "source-update-draft":
      case "subtitle-source-set-mode":
      case "subtitle-source-update-drafts":
      case "refresh":
        return "source-config";
      case "source-pick-local":
      case "source-download-url":
      case "source-download-youtube":
      case "subtitle-source-pick-local":
      case "subtitle-source-pick-folder":
      case "subtitle-source-download-url":
      case "subtitle-source-discover-youtube":
      case "subtitle-source-download-youtube":
      case "subtitle-source-toggle-discovery":
      case "subtitle-source-select-all-discovery":
      case "subtitle-source-clear-discovery-selection":
      case "subtitle-source-select-entry":
      case "subtitle-source-toggle-selection":
        return "source-acquire";
      case "edit-set-mode":
      case "edit-apply-preset":
      case "edit-update-recipe":
      case "edit-set-output":
      case "edit-set-handoff":
      case "subtitle-edit-apply-preset":
      case "subtitle-edit-update-recipe":
        return "edit-config";
      case "edit-preview":
      case "subtitle-edit-preview":
        return "edit-preview";
      case "edit-apply":
      case "subtitle-edit-apply":
        return "edit-apply";
      case "edit-cancel-preview":
        return "edit-preview-cancel";
      case "edit-cancel-apply":
        return "edit-apply-cancel";
      case "profile-set-mode":
      case "profile-apply-preset":
      case "profile-update":
      case "profile-set-target":
      case "profile-set-model":
        return "profile-config";
      case "profile-run-preflight":
        return "profile-run";
      case "profile-cancel-preflight":
        return "profile-cancel";
      case "profile-model-install":
      case "profile-model-remove":
        return "profile-model";
      case "process-run":
      case "audio-process-run":
        return "process-run";
      case "process-cancel":
      case "audio-process-cancel":
        return "process-cancel";
      case "report-export":
      case "audio-report-export":
        return "report-export";
      case "tool-install":
      case "tool-update":
      case "tools-refresh":
        return "tools";
      default:
        return "misc";
    }
  }

  function rememberRequest(requestId, action) {
    const domain = getActionDomain(action);
    const nextSequence = state.ui.requestCounter + 1;
    state.ui.requestCounter = nextSequence;
    state.ui.latestRequestByDomain[domain] = nextSequence;
    state.ui.requestLookup[requestId] = {
      domain: domain,
      sequence: nextSequence,
    };

    const lookupEntries = Object.entries(state.ui.requestLookup);
    if (lookupEntries.length > 120) {
      lookupEntries
        .sort(function (left, right) {
          return Number(toRecord(right[1]).sequence) - Number(toRecord(left[1]).sequence);
        })
        .slice(100)
        .forEach(function (entry) {
          delete state.ui.requestLookup[entry[0]];
        });
    }
  }

  function shouldIgnoreCorrelatedPayload(requestId, action) {
    if (typeof requestId !== "string" || requestId.trim() === "") {
      return false;
    }

    const tracked = toRecord(state.ui.requestLookup[requestId]);
    const trackedDomain =
      typeof tracked.domain === "string" && tracked.domain.trim() !== "" ? tracked.domain : null;
    const trackedSequence =
      typeof tracked.sequence === "number" && Number.isFinite(tracked.sequence)
        ? tracked.sequence
        : null;

    if (trackedDomain === null || trackedSequence === null) {
      return false;
    }

    const domain = getActionDomain(action || trackedDomain);
    const latestSequence = Number(state.ui.latestRequestByDomain[domain] || 0);
    return trackedDomain === domain && trackedSequence < latestSequence;
  }

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
  const laboratoryUiDraftRuntime = createLaboratoryUiDraftRuntime({
    state: state,
    toRecord: toRecord,
    deepClone: deepClone,
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    getSourceSnapshot: getSourceSnapshot,
    getProjectSource: getProjectSource,
    getSubtitleWorkspace: getSubtitleWorkspace,
    getActiveProject: getActiveProject,
    getProjectEdit: getProjectEdit,
    getSubtitleEditState: getSubtitleEditState,
    getEditPresets: getEditPresets,
  });
  const getSourceSnapshot = snapshotSelectors.getSourceSnapshot;
  const getActiveProject = snapshotSelectors.getActiveProject;
  const getProjectSummaries = snapshotSelectors.getProjectSummaries;
  const getSourcePresets = snapshotSelectors.getSourcePresets;
  const getYtDlpForm = snapshotSelectors.getYtDlpForm;
  const getEditPresets = snapshotSelectors.getEditPresets;
  const getEditCapabilities = snapshotSelectors.getEditCapabilities;
  const getProfilePresets = snapshotSelectors.getProfilePresets;
  const getProfileCapabilities = snapshotSelectors.getProfileCapabilities;
  const getProfileModelsCatalog = snapshotSelectors.getProfileModelsCatalog;
  const getProfileModelState = snapshotSelectors.getProfileModelState;
  const getSubtitleSourcePresets = snapshotSelectors.getSubtitleSourcePresets;
  const getSubtitleYoutubeForm = snapshotSelectors.getSubtitleYoutubeForm;
  const getSubtitleEditPresets = snapshotSelectors.getSubtitleEditPresets;
  const getSubtitleAnalysisCatalog = snapshotSelectors.getSubtitleAnalysisCatalog;
  const getSubtitleAnalysisCapabilities = snapshotSelectors.getSubtitleAnalysisCapabilities;
  const getSubtitleAnalysisProviders = snapshotSelectors.getSubtitleAnalysisProviders;
  const getSubtitleProcessStatusLabel = snapshotSelectors.getSubtitleProcessStatusLabel;
  const getSubtitleProviderStatusLabel = snapshotSelectors.getSubtitleProviderStatusLabel;
  function getSubtitleProcessModuleLabel(entry) {
    return snapshotSelectors.getSubtitleProcessModuleLabel(entry);
  }
  const getSubtitleProcessModuleSummary = snapshotSelectors.getSubtitleProcessModuleSummary;
  function getSubtitleProviderLabel(entry) {
    return snapshotSelectors.getSubtitleProviderLabel(entry);
  }
  const getSubtitleProviderSummary = snapshotSelectors.getSubtitleProviderSummary;
  const getSubtitleProviderModuleLabels = snapshotSelectors.getSubtitleProviderModuleLabels;
  const getAudioAnalysisCatalog = snapshotSelectors.getAudioAnalysisCatalog;
  function getAudioAnalysisCapabilities() {
    return snapshotSelectors.getAudioAnalysisCapabilities();
  }

  function getAudioAnalysisPresets() {
    return snapshotSelectors.getAudioAnalysisPresets();
  }

  function getAudioAnalysisProviders() {
    return snapshotSelectors.getAudioAnalysisProviders();
  }
  const getAudioAnalysisModules = snapshotSelectors.getAudioAnalysisModules;
  const getToolRegistry = snapshotSelectors.getToolRegistry;
  const getProjectSource = snapshotSelectors.getProjectSource;
  const getProjectEdit = snapshotSelectors.getProjectEdit;
  const getProjectProfile = snapshotSelectors.getProjectProfile;
  const getProjectProcess = snapshotSelectors.getProjectProcess;
  const getProjectReport = snapshotSelectors.getProjectReport;
  const getProjectSubtitleAnalysis = snapshotSelectors.getProjectSubtitleAnalysis;
  const getSubtitleWorkspace = snapshotSelectors.getSubtitleWorkspace;
  const getSubtitleDiscoveryState = snapshotSelectors.getSubtitleDiscoveryState;
  const getSubtitleDiscoveryItems = snapshotSelectors.getSubtitleDiscoveryItems;
  const getSubtitleSelectedCandidateIds = snapshotSelectors.getSubtitleSelectedCandidateIds;
  const getActiveSubtitleEntry = snapshotSelectors.getActiveSubtitleEntry;
  const getSubtitleSelectedEntryIds = snapshotSelectors.getSubtitleSelectedEntryIds;
  const getSubtitleEditState = snapshotSelectors.getSubtitleEditState;
  const getSubtitleEditPreview = snapshotSelectors.getSubtitleEditPreview;
  const getSubtitleOutputs = snapshotSelectors.getSubtitleOutputs;
  const getAudioAnalysisSourceState = snapshotSelectors.getAudioAnalysisSourceState;
  const getAudioAnalysisCatalogState = snapshotSelectors.getAudioAnalysisCatalogState;
  const getAudioAnalysisProviderState = snapshotSelectors.getAudioAnalysisProviderState;
  const getAudioAnalysisResultMap = snapshotSelectors.getAudioAnalysisResultMap;
  function getCurrentFeatureProcessRecord() {
    return snapshotSelectors.getCurrentFeatureProcessRecord();
  }

  function getCurrentFeatureReportRecord() {
    return snapshotSelectors.getCurrentFeatureReportRecord();
  }
  const getSourceMetadata = snapshotSelectors.getSourceMetadata;
  const getEditPreview = snapshotSelectors.getEditPreview;
  const getEditOutputs = snapshotSelectors.getEditOutputs;
  const getActiveEditOutput = snapshotSelectors.getActiveEditOutput;
  const getToolEntry = snapshotSelectors.getToolEntry;
  const getStageToolIds = snapshotSelectors.getStageToolIds;
  const getWorkspaceCapabilities = snapshotSelectors.getWorkspaceCapabilities;
  const getJobs = snapshotSelectors.getJobs;

  function getProjectAudioAnalysis() {
    return snapshotSelectors.getProjectAudioAnalysis();
  }

  function getSubtitleEntries() {
    return snapshotSelectors.getSubtitleEntries();
  }

  function getAudioAnalysisProviderEntries() {
    return snapshotSelectors.getAudioAnalysisProviderEntries();
  }

  function getAudioAnalysisOrderedResultEntries() {
    return snapshotSelectors.getAudioAnalysisOrderedResultEntries();
  }

  const laboratoryMediaPreviewUi = createLaboratoryMediaPreviewUi({
    state: state,
    render: render,
    escapeHtml: escapeHtml,
    text: text,
    formatDuration: formatDuration,
    getActiveProject: getActiveProject,
    getProjectSource: getProjectSource,
    getCurrentSourceMode: getCurrentSourceMode,
    getRelevantJobs: getRelevantJobs,
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
    getCurrentEditDraft: getCurrentEditDraft,
    getProjectSource: getProjectSource,
    getCurrentEditRecipe: getCurrentEditRecipe,
    getEffectiveMediaAsset: getEffectiveMediaAsset,
    getEditPreview: getEditPreview,
    getRelevantJobs: getRelevantJobs,
    collectEditStageJobs: collectEditStageJobs,
    renderPreviewMetaRow: renderPreviewMetaRow,
    getPreferredSourceDuration: getPreferredSourceDuration,
    getPreferredSourceResolution: getPreferredSourceResolution,
    getPreferredSourceCodec: getPreferredSourceCodec,
    getPreferredSourceFormat: getPreferredSourceFormat,
    getEditJobLabel: getEditJobLabel,
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

  const subtitleAnalysisUi = createSubtitleAnalysisUi({
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
    getCurrentDrafts: getCurrentDrafts,
    getCurrentEditDraft: getCurrentEditDraft,
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
    getProfileModelEntries: getProfileModelEntries,
    getProfileSelectedModel: getProfileSelectedModel,
    renderPreviewMetaRow: renderPreviewMetaRow,
    renderAudioAnalysisProviderPanel: renderAudioAnalysisProviderPanel,
    isAudioAnalysisFeature: isAudioAnalysisFeature,
  });
  const laboratoryProcessStageUi = createLaboratoryProcessStageUi({
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    text: text,
    featureText: featureText,
    renderStageIntro: renderStageIntro,
    renderSummaryRows: renderSummaryRows,
    formatStatusLabel: formatStatusLabel,
    getCurrentFeatureProcessRecord: getCurrentFeatureProcessRecord,
    getProcessModules: getProcessModules,
    getProcessJobs: getProcessJobs,
    getProcessFindings: getProcessFindings,
    getCurrentFeatureTargetLabel: getCurrentFeatureTargetLabel,
    getCurrentFeatureArtifactCount: getCurrentFeatureArtifactCount,
    getCurrentFeatureReportRecord: getCurrentFeatureReportRecord,
  });
  const laboratoryHostMessageRuntime = createLaboratoryHostMessageRuntime({
    state: state,
    toRecord: toRecord,
    text: text,
    render: render,
    applyPresentationMode: applyPresentationMode,
    applyLocale: applyLocale,
    normalizeContext: normalizeContext,
    shouldIgnoreCorrelatedPayload: shouldIgnoreCorrelatedPayload,
    setLastAction: setLastAction,
  });
  const laboratoryReportStageUi = createLaboratoryReportStageUi({
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
    getCurrentFeatureReportRecord: getCurrentFeatureReportRecord,
    getEffectiveMediaAsset: getEffectiveMediaAsset,
    getReportFindings: getReportFindings,
    getReportSummaryCards: getReportSummaryCards,
    getReportExports: getReportExports,
    getReportJobs: getReportJobs,
    getFeaturePreviewImage: getFeaturePreviewImage,
    renderAudioAnalysisModuleGrid: renderAudioAnalysisModuleGrid,
    getProcessModules: getProcessModules,
    getProcessArtifacts: getProcessArtifacts,
    getCurrentFeatureArtifactCount: getCurrentFeatureArtifactCount,
    getCurrentFeatureTargetLabel: getCurrentFeatureTargetLabel,
    getCurrentSourceLabel: getCurrentSourceLabel,
    getPreferredAssetDuration: getPreferredAssetDuration,
    getSubtitleProcessModuleLabel: getSubtitleProcessModuleLabel,
    getSubtitleProcessModuleSummary: getSubtitleProcessModuleSummary,
    getProfileSignalKindLabel: getProfileSignalKindLabel,
    getProfileConfidenceLabel: getProfileConfidenceLabel,
  });
  const mediaAnalysisProfilePanels = createMediaAnalysisProfilePanels({
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    text: text,
    textFromKey: textFromKey,
    getProjectProfile: getProjectProfile,
    getProfilePresetOptions: getProfilePresetOptions,
    getProfileModelEntries: getProfileModelEntries,
    getProfileSelectedModel: getProfileSelectedModel,
    getProfileLaneMap: getProfileLaneMap,
    getCurrentSourceKind: getCurrentSourceKind,
    getProfileArtifactPreferenceEntries: getProfileArtifactPreferenceEntries,
    getProfileTranscriptSampleConfig: getProfileTranscriptSampleConfig,
    getProfileCapabilities: getProfileCapabilities,
    getProfileFrameDensityOptions: getProfileFrameDensityOptions,
    getProfileLaneCardState: getProfileLaneCardState,
  });
  const mediaAnalysisProfileStage = createMediaAnalysisProfileStage({
    state: state,
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    text: text,
    textFromKey: textFromKey,
    formatDuration: formatDuration,
    renderStageIntro: renderStageIntro,
    renderSummaryRows: renderSummaryRows,
    getCurrentSourceKind: getCurrentSourceKind,
    getCurrentSourceLabel: getCurrentSourceLabel,
    getCurrentProfileMode: getCurrentProfileMode,
    getProfileEstimate: getProfileEstimate,
    getProfileLabel: getProfileLabel,
    renderProfilePresetPanel: renderProfilePresetPanel,
    renderProfileAdvancedPanel: renderProfileAdvancedPanel,
    getProfileSignals: getProfileSignals,
    sortProfileSignals: sortProfileSignals,
    getProfileSignalKindLabel: getProfileSignalKindLabel,
    getProfileConfidenceLabel: getProfileConfidenceLabel,
    getProfileArtifacts: getProfileArtifacts,
    getProfileReadiness: getProfileReadiness,
    getProfilePreflight: getProfilePreflight,
    getProfileJobs: getProfileJobs,
    getProfileSelectedModel: getProfileSelectedModel,
    getProjectSource: getProjectSource,
    getPreferredAssetDuration: getPreferredAssetDuration,
    getPreferredAssetResolution: getPreferredAssetResolution,
    getPreferredAssetCodec: getPreferredAssetCodec,
    getProfileTargetSummary: getProfileTargetSummary,
    getProfileTargetAsset: getProfileTargetAsset,
    getProfileTargetMode: getProfileTargetMode,
    getProfileTargetOutputOptions: getProfileTargetOutputOptions,
    getFocusLabel: getFocusLabel,
  });

  function getRelevantJobs() {
    const project = getActiveProject();
    const toolJobs = [];
    const projectJobs = [];

    getJobs().forEach(function (job) {
      const jobRecord = toRecord(job);
      if (project && jobRecord.projectId === project.id) {
        projectJobs.push(jobRecord);
        return;
      }
      if (typeof jobRecord.toolId === "string" && jobRecord.toolId.trim() !== "") {
        toolJobs.push(jobRecord);
      }
    });

    return {
      project: projectJobs,
      tools: toolJobs,
    };
  }

  function collectEditStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectEditStageJobs(projectJobs);
  }

  function collectProfileStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectProfileStageJobs(projectJobs);
  }

  function collectProcessStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectProcessStageJobs(projectJobs);
  }

  function collectReportStageJobs(projectJobs) {
    return laboratoryUiDraftRuntime.collectReportStageJobs(projectJobs);
  }

  function getEditJobLabel(job) {
    if (isSubtitleAnalysisFeature()) {
      switch (String(toRecord(job).action || "")) {
        case "subtitle-edit-preview":
          return subtitleText(["edit", "jobs", "preview"], "Temizleme Onizlemesi", "Cleanup Preview");
        case "subtitle-edit-apply":
          return subtitleText(["edit", "jobs", "apply"], "Temizleme Uygula", "Apply Cleanup");
        default:
          return subtitleText(["edit", "jobs", "default"], "Altyazi Duzenleme", "Subtitle Edit");
      }
    }

    switch (String(toRecord(job).action || "")) {
      case "edit-preview":
        return text(["mediaAnalysis", "edit", "actions", "preview"]);
      case "edit-apply":
        return text(["mediaAnalysis", "edit", "actions", "apply"]);
      default:
        return text(["mediaAnalysis", "edit", "jobsTitle"]);
    }
  }

  function getCurrentDrafts() {
    return laboratoryUiDraftRuntime.getCurrentDrafts();
  }

  function getCurrentEditDraft() {
    return laboratoryUiDraftRuntime.getCurrentEditDraft();
  }

  function buildNestedPatch(path, value) {
    return laboratoryUiDraftRuntime.buildNestedPatch(path, value);
  }

  function syncLocalEditField(path, value) {
    laboratoryUiDraftRuntime.syncLocalEditField(path, value);
  }

  function commitEditPatch(patch, action) {
    return sendMediaAction(
      action || (isSubtitleAnalysisFeature() ? "subtitle-edit-update-recipe" : "edit-update-recipe"),
      {
      patch: patch,
      featureStage: "edit",
      }
    );
  }

  function buildCurrentEditRecipePatch() {
    return deepClone(toRecord(getCurrentEditDraft().recipe));
  }

  function getSourceConfig(kind) {
    const sourceTypes = toRecord(getSourcePresets().sourceTypes);
    return toRecord(sourceTypes[kind]);
  }

  function getSourceModeOptions(kind) {
    const config = getSourceConfig(kind);
    return Array.isArray(config.modes) ? config.modes : [];
  }

  function getCurrentSourceKind() {
    const source = getProjectSource();
    const kind = typeof source.kind === "string" ? source.kind : null;
    return getAvailableSourceFormats().includes(kind) ? kind : getDefaultSourceKind();
  }

  function getCurrentSourceMode() {
    const kind = getCurrentSourceKind();
    const source = getProjectSource();
    const mode = typeof source.mode === "string" ? source.mode : null;
    const modes = getSourceModeOptions(kind);
    return modes.includes(mode) ? mode : modes[0] || "local";
  }

  function getCurrentSourceLabel() {
    if (isSubtitleAnalysisFeature()) {
      const activeEntry = getActiveSubtitleEntry();
      return activeEntry
        ? activeEntry.fileName || activeEntry.id || "Subtitle"
        : subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle");
    }
    return featureText(["source", "formats", getCurrentSourceKind(), "title"]);
  }

  function getCurrentEditMode() {
    const mode = getCurrentEditDraft().mode;
    return mode === "advanced" ? "advanced" : "beginner";
  }

  function getCurrentEditRecipe() {
    return toRecord(getCurrentEditDraft().recipe);
  }

  function getCurrentFocusRegionId() {
    return (
      (typeof toRecord(getCurrentEditRecipe().common).focusRegionId === "string" &&
        toRecord(getCurrentEditRecipe().common).focusRegionId) ||
      "full-frame"
    );
  }

  function getCurrentFocusLabel() {
    const focusRegion = toRecord(toRecord(getEditPresets().focusRegions)[getCurrentFocusRegionId()]);
    const labelKey = typeof focusRegion.labelKey === "string" ? focusRegion.labelKey : null;
    return labelKey ? textFromKey(labelKey) : "--";
  }

  function getCurrentResizeLabel() {
    const kind = getCurrentSourceKind();
    const recipe = getCurrentEditRecipe();
    const branch = toRecord(recipe[kind]);
    const presetId =
      typeof branch.resizePreset === "string" && branch.resizePreset.trim() !== ""
        ? branch.resizePreset
        : "keep";
    const preset = toRecord(toRecord(getEditPresets().resizePresets)[presetId]);
    return preset.labelKey ? textFromKey(preset.labelKey) : presetId;
  }

  function formatEditWindowLabel() {
    const kind = getCurrentSourceKind();
    const recipe = getCurrentEditRecipe();
    const branch = toRecord(recipe[kind]);
    const duration = getPreferredSourceDuration(getProjectSource().previewUrl || null);

    if ((kind === "video" || kind === "audio") && branch.trimEnabled === true) {
      const endSeconds =
        typeof branch.trimEndSeconds === "number" && branch.trimEndSeconds > 0
          ? branch.trimEndSeconds
          : duration;
      return `${formatDuration(branch.trimStartSeconds)} - ${formatDuration(endSeconds)}`;
    }

    return text(["mediaAnalysis", "edit", "fullWindow"]);
  }

  function getCurrentEditPresetOptions() {
    const presetsByKind = toRecord(toRecord(getEditPresets().presets)[getCurrentSourceKind()]);
    const presetList = presetsByKind[getCurrentEditMode()];
    return Array.isArray(presetList) ? presetList.map(toRecord) : [];
  }

  function getEffectiveMediaAsset() {
    if (isSubtitleAnalysisFeature()) {
      const preview = getSubtitleEditPreview();
      const activeEntry = getActiveSubtitleEntry();
      const latestOutput = getSubtitleOutputs()[0] || null;

      return {
        kind: latestOutput ? "derived" : "subtitle",
        label:
          (latestOutput && (latestOutput.label || latestOutput.fileName || latestOutput.id)) ||
          (activeEntry && (activeEntry.fileName || activeEntry.id)) ||
          subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle"),
        previewUrl: null,
        path:
          (latestOutput && (latestOutput.path || latestOutput.fileUrl)) ||
          (activeEntry && (activeEntry.path || activeEntry.fileUrl)) ||
          null,
        mimeType: activeEntry ? getSubtitleMimeType(activeEntry.fileName || "") : null,
        metadata: preview.summary || {},
        artifacts: [],
      };
    }

    const project = getActiveProject();
    if (!project) {
      return {
        kind: "source",
        label: "--",
        previewUrl: null,
        path: null,
        mimeType: null,
        metadata: {},
      };
    }

    const source = getProjectSource();
    const edit = getProjectEdit();
    const preview = getEditPreview();
    const activeOutput = getActiveEditOutput();

    if (
      typeof edit.handoffMode === "string" &&
      edit.handoffMode === "derived" &&
      activeOutput &&
      typeof activeOutput.previewUrl === "string"
    ) {
      return {
        kind: "derived",
        label: activeOutput.label || text(["mediaAnalysis", "edit", "derivedOutput"]),
        previewUrl: activeOutput.previewUrl,
        path: activeOutput.path || null,
        mimeType: activeOutput.mimeType || null,
        metadata: toRecord(activeOutput.metadata),
        artifacts: Array.isArray(activeOutput.artifacts) ? activeOutput.artifacts.map(toRecord) : [],
      };
    }

    if (
      typeof preview.previewUrl === "string" &&
      preview.previewUrl.trim() !== "" &&
      (preview.status === "ready" || preview.status === "stale")
    ) {
      return {
        kind: "preview",
        label: text(["mediaAnalysis", "edit", "previewAsset"]),
        previewUrl: preview.previewUrl,
        path: preview.path || null,
        mimeType: preview.mimeType || null,
        metadata: toRecord(preview.metadata),
        artifacts: Array.isArray(preview.artifacts) ? preview.artifacts.map(toRecord) : [],
      };
    }

    return {
      kind: "source",
      label: text(["mediaAnalysis", "edit", "sourceAsset"]),
      previewUrl: source.previewUrl || null,
      path: source.storedPath || null,
      mimeType: source.mimeType || null,
      metadata: getSourceMetadata(),
      artifacts: [],
    };
  }

  function getProfileLabel() {
    const activePresetId =
      typeof getProjectProfile().activePresetId === "string" ? getProjectProfile().activePresetId : null;
    const preset =
      getProfilePresetOptions().find(function (entry) {
        return entry.id === activePresetId;
      }) || null;
    const labelKey = preset && typeof preset.labelKey === "string" ? preset.labelKey : null;
    return labelKey ? textFromKey(labelKey) : "--";
  }

  function getFocusLabel() {
    const target = getProfileTargetSummary();
    if (typeof target.label === "string" && target.label.trim() !== "") {
      return target.label;
    }
    return getCurrentSourceLabel();
  }

  function getCurrentProfileMode() {
    return getProjectProfile().mode === "advanced" ? "advanced" : "beginner";
  }

  function getProfileLaneMap() {
    return toRecord(getProfilePresets().lanes);
  }

  function getCompatibleProfileLaneIds() {
    const laneMap = getProfileLaneMap();
    const sourceKind = getCurrentSourceKind();
    return Object.keys(laneMap).filter(function (laneId) {
      const mediaKinds = Array.isArray(toRecord(laneMap[laneId]).mediaKinds)
        ? toRecord(laneMap[laneId]).mediaKinds
        : [];
      return mediaKinds.length === 0 || mediaKinds.includes(sourceKind);
    });
  }

  function getProfilePresetOptions() {
    const presetsByKind = toRecord(toRecord(getProfilePresets().presets)[getCurrentSourceKind()]);
    const mode = getCurrentProfileMode();
    const presetList = Array.isArray(presetsByKind[mode])
      ? presetsByKind[mode]
      : Array.isArray(presetsByKind.beginner)
        ? presetsByKind.beginner
        : [];
    return presetList.map(toRecord);
  }

  function getProfileReadiness() {
    return toRecord(getProjectProfile().readiness);
  }

  function getProfileEstimate() {
    return toRecord(getProjectProfile().estimate);
  }

  function getProfilePreflight() {
    return toRecord(getProjectProfile().preflight);
  }

  function getProfileSignals() {
    const signals = getProjectProfile().signals;
    return Array.isArray(signals) ? signals.map(toRecord) : [];
  }

  function getProfileArtifacts() {
    const artifacts = getProjectProfile().artifacts;
    return Array.isArray(artifacts) ? artifacts.map(toRecord) : [];
  }

  function getProfileTargetSummary() {
    return toRecord(getProfileReadiness().target);
  }

  function getProfileTargetMode() {
    const target = getProfileTargetSummary();
    return target.requestedMode === "derived" ? "derived" : "source";
  }

  function getProfileModelEntries() {
    const readinessModels = getProfileReadiness().models;
    if (Array.isArray(readinessModels)) {
      return readinessModels.map(toRecord);
    }
    const catalog = toRecord(getProfileModelsCatalog().models);
    const stateMap = toRecord(getProfileModelState().models);
    return Object.keys(catalog).map(function (modelId) {
      return {
        modelId: modelId,
        ...toRecord(catalog[modelId]),
        ...toRecord(stateMap[modelId]),
      };
    });
  }

  function getProfileSelectedModel() {
    return (
      getProfileModelEntries().find(function (entry) {
        return entry.selected === true;
      }) || null
    );
  }

  function getProfileJobs() {
    const project = getActiveProject();
    if (!project) {
      return [];
    }
    return collectProfileStageJobs(
      getJobs()
        .map(toRecord)
        .filter(function (job) {
          return job.projectId === project.id;
        })
    );
  }

  function getProcessJobs() {
    const project = getActiveProject();
    if (!project) {
      return [];
    }
    return collectProcessStageJobs(
      getJobs()
        .map(toRecord)
        .filter(function (job) {
          return job.projectId === project.id;
        })
    );
  }

  function getReportJobs() {
    const project = getActiveProject();
    if (!project) {
      return [];
    }
    return collectReportStageJobs(
      getJobs()
        .map(toRecord)
        .filter(function (job) {
          return job.projectId === project.id;
        })
    );
  }

  function getProcessModules() {
    const modules = getCurrentFeatureProcessRecord().modules;
    return Array.isArray(modules) ? modules.map(toRecord) : [];
  }

  function getProcessFindings() {
    const findings = getCurrentFeatureProcessRecord().findings;
    return Array.isArray(findings) ? findings.map(toRecord) : [];
  }

  function getProcessArtifacts() {
    const artifacts = getCurrentFeatureProcessRecord().artifacts;
    return Array.isArray(artifacts) ? artifacts.map(toRecord) : [];
  }

  function getReportSummaryCards() {
    const cards = getCurrentFeatureReportRecord().summaryCards;
    return Array.isArray(cards) ? cards.map(toRecord) : [];
  }

  function getReportFindings() {
    const findings = getCurrentFeatureReportRecord().findings;
    return Array.isArray(findings) ? findings.map(toRecord) : [];
  }

  function getReportExports() {
    const exportsList = getCurrentFeatureReportRecord().exports;
    return Array.isArray(exportsList) ? exportsList.map(toRecord) : [];
  }

  function getCurrentFeatureTargetLabel() {
    if (isAudioAnalysisFeature()) {
      return (
        (typeof getAudioAnalysisSourceState().targetLabel === "string" && getAudioAnalysisSourceState().targetLabel) ||
        (typeof toRecord(getCurrentFeatureProcessRecord().targetSummary).label === "string" &&
          toRecord(getCurrentFeatureProcessRecord().targetSummary).label) ||
        getCurrentSourceLabel()
      );
    }
    if (isSubtitleAnalysisFeature()) {
      return (
        toRecord(getCurrentFeatureProcessRecord().targetSummary).label ||
        (getActiveSubtitleEntry() && (getActiveSubtitleEntry().fileName || getActiveSubtitleEntry().id)) ||
        getCurrentSourceLabel()
      );
    }
    return toRecord(getCurrentFeatureProcessRecord().targetSummary).label || getFocusLabel();
  }

  function getCurrentFeatureArtifactCount() {
    if (isSubtitleAnalysisFeature()) {
      return getProcessArtifacts().length;
    }
    if (!isAudioAnalysisFeature()) {
      return getProcessArtifacts().length;
    }
    return getAudioAnalysisOrderedResultEntries().reduce(function (sum, entry) {
      return sum + entry.artifacts.length;
    }, 0);
  }

  function getProfileTargetOutputOptions() {
    return getEditOutputs().filter(function (entry) {
      return typeof entry.path === "string" && entry.path.trim() !== "";
    });
  }

  function getProfileArtifactPreferenceEntries() {
    const preferenceMap = toRecord(getProfileCapabilities().artifactPreferences);
    const currentKind = getCurrentSourceKind();
    const selected = toRecord(getProjectProfile().artifactPreferences);
    return Object.keys(preferenceMap)
      .map(function (artifactId) {
        const descriptor = toRecord(preferenceMap[artifactId]);
        const mediaKinds = Array.isArray(descriptor.mediaKinds) ? descriptor.mediaKinds : [];
        const compatible = mediaKinds.length === 0 || mediaKinds.includes(currentKind);
        return {
          artifactId: artifactId,
          labelKey: descriptor.labelKey,
          compatible: compatible,
          enabled: compatible && selected[artifactId] === true,
        };
      })
      .filter(function (entry) {
        return entry.compatible === true;
      });
  }

  function getProfileFrameDensityOptions() {
    const densityModes = toRecord(toRecord(getProfileCapabilities().sampling).frameDensityModes);
    return Object.keys(densityModes).map(function (densityId) {
      return {
        densityId: densityId,
        labelKey: toRecord(densityModes[densityId]).labelKey,
      };
    });
  }

  function getProfileTranscriptSampleConfig() {
    return toRecord(toRecord(getProfileCapabilities().sampling).transcriptSampleSeconds);
  }

  function sortProfileSignals(signals) {
    const levelOrder = { high: 0, medium: 1, low: 2 };
    const kindOrder = { measured: 0, heuristic: 1, derived: 2 };
    return (Array.isArray(signals) ? signals.map(toRecord) : []).sort(function (left, right) {
      const levelDelta =
        (levelOrder[String(left.level || "low")] ?? 99) - (levelOrder[String(right.level || "low")] ?? 99);
      if (levelDelta !== 0) {
        return levelDelta;
      }
      const kindDelta =
        (kindOrder[String(left.kind || "derived")] ?? 99) - (kindOrder[String(right.kind || "derived")] ?? 99);
      if (kindDelta !== 0) {
        return kindDelta;
      }
      return String(left.id || left.title || "").localeCompare(String(right.id || right.title || ""));
    });
  }

  function getTopProfileSignals(limit) {
    return sortProfileSignals(getProfileSignals()).slice(0, Math.max(0, Number(limit) || 0));
  }

  function getProfileSignalKindLabel(kind) {
    return text(["mediaAnalysis", "profile", "signalKinds", typeof kind === "string" ? kind : "derived"]);
  }

  function getProfileConfidenceLabel(confidence) {
    return text([
      "mediaAnalysis",
      "profile",
      "confidenceLevels",
      typeof confidence === "string" ? confidence : "low",
    ]);
  }

  function formatPlatformList(platforms) {
    return Array.isArray(platforms) && platforms.length > 0 ? platforms.join(", ") : "--";
  }

  function formatCleanupPolicy(policy) {
    const source = toRecord(policy);
    const labels = [];
    if (source.removeOnChecksumMismatch === true) {
      labels.push(text(["mediaAnalysis", "profile", "cleanupPolicy", "checksumMismatch"]));
    }
    if (source.removeOnDescriptorChange === true) {
      labels.push(text(["mediaAnalysis", "profile", "cleanupPolicy", "descriptorChange"]));
    }
    return labels.length > 0 ? labels.join(", ") : "--";
  }

  function getPreferredSourceDuration(previewUrl) {
    const metadata = getSourceMetadata();
    if (typeof metadata.durationSeconds === "number" && metadata.durationSeconds > 0) {
      return metadata.durationSeconds;
    }
    return state.ui.previewMetrics.url === previewUrl ? state.ui.previewMetrics.duration : null;
  }

  function getPreferredSourceResolution(previewUrl) {
    const metadata = getSourceMetadata();
    const width =
      typeof metadata.width === "number" && metadata.width > 0
        ? metadata.width
        : state.ui.previewMetrics.url === previewUrl
          ? state.ui.previewMetrics.width
          : null;
    const height =
      typeof metadata.height === "number" && metadata.height > 0
        ? metadata.height
        : state.ui.previewMetrics.url === previewUrl
          ? state.ui.previewMetrics.height
          : null;

    if (typeof width === "number" && typeof height === "number") {
      return `${width} x ${height}`;
    }

    return "--";
  }

  function getPreferredSourceCodec() {
    const metadata = getSourceMetadata();
    return (
      (typeof metadata.codec === "string" && metadata.codec.trim() !== "" && metadata.codec) ||
      (typeof metadata.videoCodec === "string" &&
        metadata.videoCodec.trim() !== "" &&
        metadata.videoCodec) ||
      (typeof metadata.audioCodec === "string" &&
        metadata.audioCodec.trim() !== "" &&
        metadata.audioCodec) ||
      "--"
    );
  }

  function getPreferredAssetDuration(asset) {
    const metadata = toRecord(toRecord(asset).metadata);
    if (typeof metadata.durationSeconds === "number" && metadata.durationSeconds > 0) {
      return metadata.durationSeconds;
    }
    const previewUrl = typeof toRecord(asset).previewUrl === "string" ? toRecord(asset).previewUrl : null;
    return state.ui.previewMetrics.url === previewUrl ? state.ui.previewMetrics.duration : null;
  }

  function getPreferredAssetResolution(asset) {
    const metadata = toRecord(toRecord(asset).metadata);
    const previewUrl = typeof toRecord(asset).previewUrl === "string" ? toRecord(asset).previewUrl : null;
    const width =
      typeof metadata.width === "number" && metadata.width > 0
        ? metadata.width
        : state.ui.previewMetrics.url === previewUrl
          ? state.ui.previewMetrics.width
          : null;
    const height =
      typeof metadata.height === "number" && metadata.height > 0
        ? metadata.height
        : state.ui.previewMetrics.url === previewUrl
          ? state.ui.previewMetrics.height
          : null;

    if (typeof width === "number" && typeof height === "number") {
      return `${width} x ${height}`;
    }

    return "--";
  }

  function getPreferredAssetCodec(asset) {
    const metadata = toRecord(toRecord(asset).metadata);
    return (
      (typeof metadata.codec === "string" && metadata.codec.trim() !== "" && metadata.codec) ||
      (typeof metadata.videoCodec === "string" &&
        metadata.videoCodec.trim() !== "" &&
        metadata.videoCodec) ||
      (typeof metadata.audioCodec === "string" &&
        metadata.audioCodec.trim() !== "" &&
        metadata.audioCodec) ||
      "--"
    );
  }

  function getToolDisplayName(toolId) {
    const registryEntry =
      getToolRegistry().find(function (entry) {
        return entry.toolId === toolId;
      }) || {};
    return (
      (typeof registryEntry.displayName === "string" && registryEntry.displayName.trim() !== "" && registryEntry.displayName) ||
      text(["mediaAnalysis", "settings", "tools", toolId]) ||
      toolId
    );
  }

  function getMediaKindLabel(kind) {
    if (typeof kind !== "string" || kind.trim() === "") {
      return "--";
    }
    return featureText(["source", "formats", kind, "title"]) || kind;
  }

  function getProfileLaneCardState(laneId) {
    const lane = toRecord(getProfileLaneMap()[laneId]);
    const currentKind = getCurrentSourceKind();
    const mediaKinds = Array.isArray(lane.mediaKinds) ? lane.mediaKinds : [];
    const compatible = mediaKinds.length === 0 || mediaKinds.includes(currentKind);
    const profile = getProjectProfile();
    const readiness = getProfileReadiness();
    const laneSummary =
      (Array.isArray(readiness.lanes) ? readiness.lanes : []).find(function (entry) {
        return toRecord(entry).laneId === laneId;
      }) || {};
    const requiredTools = Array.isArray(lane.requiredTools) ? lane.requiredTools : [];
    const optionalTools = Array.isArray(lane.optionalTools) ? lane.optionalTools : [];
    let supportLevel = compatible ? "ready" : "blocked";
    let note = compatible ? "" : text(["mediaAnalysis", "profile", "laneMeta", "incompatible"]);

    if (compatible) {
      supportLevel = toRecord(laneSummary).supportLevel || "ready";
      if (supportLevel === "degraded" && optionalTools.includes("whisper.cpp")) {
        const whisperReady = getToolEntry("whisper.cpp").ready === true;
        note = whisperReady
          ? text(["mediaAnalysis", "profile", "laneMeta", "speechModelMissing"])
          : text(["mediaAnalysis", "profile", "laneMeta", "speechToolMissing"]);
      }
    }

    return {
      lane: lane,
      compatible: compatible,
      enabled: compatible && toRecord(profile.laneSelection)[laneId] === true,
      supportLevel: supportLevel,
      note: note,
      requiredTools: requiredTools.map(getToolDisplayName),
      optionalTools: optionalTools.map(getToolDisplayName),
      mediaKinds: mediaKinds.map(getMediaKindLabel),
    };
  }

  function getPreferredSourceFormat() {
    const metadata = getSourceMetadata();
    const source = getProjectSource();
    return (
      (typeof metadata.formatName === "string" &&
        metadata.formatName.trim() !== "" &&
        metadata.formatName) ||
      (typeof source.mimeType === "string" && source.mimeType.trim() !== "" && source.mimeType) ||
      "--"
    );
  }

  function formatBitRate(bitsPerSecond) {
    if (
      typeof bitsPerSecond !== "number" ||
      Number.isFinite(bitsPerSecond) === false ||
      bitsPerSecond <= 0
    ) {
      return "--";
    }

    if (bitsPerSecond >= 1_000_000) {
      return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
    }

    return `${Math.round(bitsPerSecond / 1000)} kbps`;
  }

  function formatBytes(value) {
    if (typeof value !== "number" || Number.isFinite(value) !== true || value <= 0) {
      return "--";
    }
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)} GB`;
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)} MB`;
    }
    if (value >= 1_000) {
      return `${Math.round(value / 1_000)} KB`;
    }
    return `${Math.round(value)} B`;
  }

  function chooseRegion(regionId) {
    void regionId;
  }

  function chooseProfilePreset(profileId) {
    if (typeof profileId !== "string" || profileId.trim() === "") {
      return;
    }
    sendMediaAction("profile-apply-preset", {
      presetId: profileId,
      featureStage: "profile",
    });
  }

  function chooseProfileFocus(focusId) {
    void focusId;
  }

  function toggleCleanup(key) {
    void key;
  }

  function restartProcess() {
    sendMediaAction(isAudioAnalysisFeature() ? "audio-process-run" : "process-run", {
      featureStage: "process",
    });
  }

  function openReport() {
    setStage("report");
  }

  function resetJourney() {
    setStage("source");
  }

  function nextRequestId(action) {
    return [action, Date.now(), Math.random().toString(36).slice(2, 8)].join("-");
  }

  function sendMediaAction(action, payload) {
    if (!window.roomAPI || typeof window.roomAPI.sendEvent !== "function") {
      setLastAction(bootstrapText("roomApiUnavailable"));
      render();
      return null;
    }

    const requestId = nextRequestId(action);
    state.ui.lastRequestId = requestId;
    rememberRequest(requestId, action);
    window.roomAPI.sendEvent("media-action", {
      requestId: requestId,
      action: action,
      payload: {
        featureId: getActiveFeatureId(),
        ...(payload || {}),
      },
    });
    return requestId;
  }

  function sendSourceAction(action, payload) {
    return sendMediaAction(action, payload);
  }

  function syncDraftField(path, value) {
    if (isSubtitleAnalysisFeature()) {
      state.ui.localSubtitleDrafts[path] = value;
      return;
    }
    if (path === "youtubePreset") {
      state.ui.localDrafts.youtubePreset = value;
      return;
    }
    if (path.indexOf("youtubeCustom.") === 0) {
      const key = path.replace("youtubeCustom.", "");
      state.ui.localDrafts.youtubeCustom[key] = value;
      return;
    }
    state.ui.localDrafts[path] = value;
  }

  function buildCurrentDraftPayload() {
    return laboratoryUiDraftRuntime.buildCurrentDraftPayload();
  }

  function persistDrafts(extraFields) {
    const nextFields = {
      ...buildCurrentDraftPayload(),
      ...toRecord(extraFields),
    };
    if (isSubtitleAnalysisFeature()) {
      sendSourceAction("subtitle-source-update-drafts", { fields: nextFields });
      return;
    }

    nextFields.youtubeCustom = {
      ...toRecord(buildCurrentDraftPayload().youtubeCustom),
      ...toRecord(toRecord(extraFields).youtubeCustom),
    };
    sendSourceAction("source-update-draft", { fields: nextFields });
  }

  function openSettingsOverlay() {
    state.ui.settingsOpen = true;
    requestOverlayScrollReset();
    render();
    sendSourceAction("tools-refresh");
  }

  function closeSettingsOverlay() {
    state.ui.settingsOpen = false;
    render();
  }

  function getProjectStatusLabel(source) {
    if (source.status === "error") {
      return text(["mediaAnalysis", "settings", "status", "error"]);
    }
    if (typeof source.storedPath === "string" && source.storedPath.trim() !== "") {
      return text(["mediaAnalysis", "settings", "status", "ready"]);
    }
    return text(["mediaAnalysis", "settings", "status", "idle"]);
  }

  function renderBootstrap() {
    return `
      <section class="lab-bootstrap">
        <div class="lab-bootstrap__panel">
          <h1 class="lab-bootstrap__title">${escapeHtml(bootstrapText("loadingTitle"))}</h1>
          <p class="lab-bootstrap__body">${escapeHtml(bootstrapText("loadingBody"))}</p>
        </div>
      </section>
    `;
  }

  function renderStageRail() {
    const currentIndex = getStageIndex(state.activeStage);

    return `
      <header class="lab-topbar">
        <div class="lab-stage-rail">
          <button
            class="lab-stage-nav"
            type="button"
            data-action="nav-previous"
            ${currentIndex === 0 ? "disabled" : ""}
          >
            ${escapeHtml(featureText(["stageNav", "previous"]))}
          </button>
          <div class="lab-stage-rail__track" role="tablist" aria-label="Stages">
            ${STAGE_ORDER.map(function (stageId, index) {
              const stateName =
                stageId === state.activeStage
                  ? "active"
                  : index < currentIndex
                    ? "complete"
                    : "idle";
              return `
                <button
                  class="lab-stage-pill"
                  type="button"
                  role="tab"
                  aria-selected="${stageId === state.activeStage ? "true" : "false"}"
                  data-stage-target="${stageId}"
                  data-state="${stateName}"
                >
                  <span class="lab-stage-pill__index">${String(index + 1)}</span>
                  <span class="lab-stage-pill__label">${escapeHtml(
                    featureText(["stages", stageId])
                  )}</span>
                </button>
              `;
            }).join("")}
          </div>
          <button
            class="lab-stage-nav"
            type="button"
            data-action="nav-next"
            ${currentIndex === STAGE_ORDER.length - 1 ? "disabled" : ""}
          >
            ${escapeHtml(featureText(["stageNav", "next"]))}
          </button>
          <button
            class="lab-rail-icon"
            type="button"
            data-action="open-settings"
            aria-label="${escapeHtml(featureText(["settings", "title"]))}"
            title="${escapeHtml(featureText(["settings", "title"]))}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.4 2h3.2l.6 2.6a7.8 7.8 0 0 1 1.8.8L18.4 4l2.2 2.2-1.4 2.4c.3.6.6 1.2.8 1.8L22 11.2v3.2l-2.6.6a7.8 7.8 0 0 1-.8 1.8l1.4 2.4-2.2 2.2-2.4-1.4a7.8 7.8 0 0 1-1.8.8L13.6 22h-3.2l-.6-2.6a7.8 7.8 0 0 1-1.8-.8L5.6 20 3.4 17.8l1.4-2.4a7.8 7.8 0 0 1-.8-1.8L2 13.6v-3.2l2.6-.6a7.8 7.8 0 0 1 .8-1.8L4 5.6 6.2 3.4l2.4 1.4a7.8 7.8 0 0 1 1.8-.8L10.4 2Zm1.6 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path>
            </svg>
          </button>
        </div>
      </header>
    `;
  }

  function renderStageIntro(stageId) {
    if (isSubtitleAnalysisFeature()) {
      const copy = toRecord(readValue(state.translations, ["subtitleAnalysis", "stages", stageId]));
      return `
        <section class="lab-stage-copy">
          <h1 class="lab-stage-copy__title">${escapeHtml(copy.title || subtitleText(["labels", "subtitle"], "Altyazi", "Subtitle"))}</h1>
          <p class="lab-stage-copy__subtitle">${escapeHtml(copy.subtitle || "")}</p>
        </section>
      `;
    }

    return `
      <section class="lab-stage-copy">
        <h1 class="lab-stage-copy__title">${escapeHtml(featureText([stageId, "title"]))}</h1>
        <p class="lab-stage-copy__subtitle">${escapeHtml(
          featureText([stageId, "subtitle"])
        )}</p>
      </section>
    `;
  }

  function renderAudioAnalysisCatalogPanel() {
    return audioAnalysisUi.renderAudioAnalysisCatalogPanel();
  }

  function renderAudioAnalysisNoticePanel() {
    return audioAnalysisUi.renderAudioAnalysisNoticePanel();
  }

  function getAudioAnalysisProviderStatusLabel(status) {
    return audioAnalysisUi.getAudioAnalysisProviderStatusLabel(status);
  }

  function renderAudioAnalysisProviderPanel() {
    return audioAnalysisUi.renderAudioAnalysisProviderPanel();
  }

  function renderToolCard(toolId, stageId) {
    return laboratorySettingsUi.renderToolCard(toolId, stageId);
  }

  function renderProfileModelCard(entry) {
    return laboratorySettingsUi.renderProfileModelCard(entry);
  }

  function renderSettingsOverlay() {
    return laboratorySettingsUi.renderSettingsOverlay();
  }

  function getSubtitleSourceModeOptions() {
    return subtitleAnalysisUi.getSubtitleSourceModeOptions();
  }

  function getCurrentSubtitleSourceMode() {
    return subtitleAnalysisUi.getCurrentSubtitleSourceMode();
  }

  function getSubtitleSourceModeLabel(modeId) {
    return subtitleAnalysisUi.getSubtitleSourceModeLabel(modeId);
  }

  function renderSubtitleDraftSelect(fieldId, value, label, options) {
    return subtitleAnalysisUi.renderSubtitleDraftSelect(fieldId, value, label, options);
  }

  function renderSubtitleCatalogPanel() {
    return subtitleAnalysisUi.renderSubtitleCatalogPanel();
  }

  function renderSubtitleProviderPanel() {
    return subtitleAnalysisUi.renderSubtitleProviderPanel();
  }

  function renderSubtitleSourceWorkspacePanel() {
    return subtitleAnalysisUi.renderSubtitleSourceWorkspacePanel();
  }

  function renderSubtitleSourceIntakePanel() {
    return subtitleAnalysisUi.renderSubtitleSourceIntakePanel();
  }

  function renderSubtitleEntryPanel() {
    return subtitleAnalysisUi.renderSubtitleEntryPanel();
  }

  function renderSubtitleDiscoveryPanel() {
    return subtitleAnalysisUi.renderSubtitleDiscoveryPanel();
  }

  function renderSubtitlePreviewBody(textValue, emptyLabel) {
    return subtitleAnalysisUi.renderSubtitlePreviewBody(textValue, emptyLabel);
  }

  function renderSubtitlePresetChooser() {
    return subtitleAnalysisUi.renderSubtitlePresetChooser();
  }

  function renderSubtitleEditWorkspacePanel() {
    return subtitleAnalysisUi.renderSubtitleEditWorkspacePanel();
  }

  function renderSubtitleEditControlsPanel() {
    return subtitleAnalysisUi.renderSubtitleEditControlsPanel();
  }

  function renderSubtitleEditActionsPanel() {
    return subtitleAnalysisUi.renderSubtitleEditActionsPanel();
  }

  function renderSubtitleOutputsPanel() {
    return subtitleAnalysisUi.renderSubtitleOutputsPanel();
  }

  function renderSubtitleEditSummaryPanel() {
    return subtitleAnalysisUi.renderSubtitleEditSummaryPanel();
  }

  function renderSubtitleEditStage() {
    return subtitleAnalysisUi.renderSubtitleEditStage();
  }

  const laboratorySourceStageUi = createLaboratorySourceStageUi({
    state: state,
    toRecord: toRecord,
    escapeHtml: escapeHtml,
    text: text,
    textFromKey: textFromKey,
    featureText: featureText,
    renderStageIntro: renderStageIntro,
    renderTextField: renderTextField,
    isSubtitleAnalysisFeature: isSubtitleAnalysisFeature,
    isAudioAnalysisFeature: isAudioAnalysisFeature,
    getProjectSummaries: getProjectSummaries,
    getSourceSnapshot: getSourceSnapshot,
    getActiveProject: getActiveProject,
    getAvailableSourceFormats: getAvailableSourceFormats,
    getCurrentSourceKind: getCurrentSourceKind,
    getCurrentSourceMode: getCurrentSourceMode,
    getSourceModeOptions: getSourceModeOptions,
    getToolEntry: getToolEntry,
    getCurrentDrafts: getCurrentDrafts,
    getYtDlpForm: getYtDlpForm,
    renderPreviewSurface: renderPreviewSurface,
    renderAudioAnalysisCatalogPanel: renderAudioAnalysisCatalogPanel,
    renderAudioAnalysisProviderPanel: renderAudioAnalysisProviderPanel,
    renderAudioAnalysisNoticePanel: renderAudioAnalysisNoticePanel,
    renderSubtitleSourceWorkspacePanel: renderSubtitleSourceWorkspacePanel,
    renderSubtitleDiscoveryPanel: renderSubtitleDiscoveryPanel,
    renderSubtitleCatalogPanel: renderSubtitleCatalogPanel,
    renderSubtitleProviderPanel: renderSubtitleProviderPanel,
    renderSubtitleSourceIntakePanel: renderSubtitleSourceIntakePanel,
    renderSubtitleEntryPanel: renderSubtitleEntryPanel,
  });

  function renderSourceStage() {
    return laboratorySourceStageUi.renderSourceStage();
  }

  function renderEditStage() {
    if (isSubtitleAnalysisFeature()) {
      return renderSubtitleEditStage();
    }

    const sourceReady = typeof getProjectSource().storedPath === "string" && getProjectSource().storedPath.trim() !== "";

    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("edit")}
          ${renderEditWorkspacePanel()}
          ${renderEditModePanel()}
          ${renderEditPresetChooser()}
          <div class="lab-subgrid lab-subgrid--edit">
            ${renderEditCommonPanel()}
            ${renderEditControlsPanel()}
            ${renderEditActionsPanel()}
          </div>
          ${
            sourceReady !== true
              ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "edit", "sourceRequired"]))}</div>`
              : ""
          }
        </section>
        <aside class="lab-side-stack">
          ${renderEditSummaryPanel()}
          ${renderEditOutputsPanel()}
        </aside>
      </div>
    `;
  }

  function getProfileTargetAsset() {
    const source = getProjectSource();
    const target = getProfileTargetSummary();
    if (target.mode === "derived") {
      const output = getEditOutputs().find(function (entry) {
        return entry.id === target.outputId;
      });
      if (output) {
        return {
          kind: getCurrentSourceKind(),
          label: output.label || output.fileName || output.id,
          previewUrl: output.previewUrl || null,
          path: output.path || null,
          mimeType: output.mimeType || null,
          metadata: toRecord(output.metadata),
        };
      }
    }

    return {
      kind: getCurrentSourceKind(),
      label: target.label || source.storedFileName || getCurrentSourceLabel(),
      previewUrl: source.previewUrl || null,
      path: target.path || source.storedPath || null,
      mimeType: target.mimeType || source.mimeType || null,
      metadata: toRecord(target.metadata),
    };
  }

  function renderProfileTargetPanel() {
    return mediaAnalysisProfileStage.renderProfileTargetPanel();
  }

  function renderProfileModePanel() {
    return mediaAnalysisProfileStage.renderProfileModePanel();
  }

  function renderProfilePresetPanel() {
    return mediaAnalysisProfilePanels.renderProfilePresetPanel();
  }

  function renderProfileAdvancedPanel() {
    return mediaAnalysisProfilePanels.renderProfileAdvancedPanel();
  }

  function renderProfileSignalsPanel() {
    return mediaAnalysisProfileStage.renderProfileSignalsPanel();
  }

  function renderProfileArtifactsPanel() {
    return mediaAnalysisProfileStage.renderProfileArtifactsPanel();
  }

  function renderProfileActionsPanel() {
    return mediaAnalysisProfileStage.renderProfileActionsPanel();
  }

  function renderProfileSummaryPanel() {
    return mediaAnalysisProfileStage.renderProfileSummaryPanel();
  }

  function renderProfileStage() {
    return mediaAnalysisProfileStage.renderProfileStage();
  }

  function getProcessModulePercent(module) {
    return laboratoryProcessStageUi.getProcessModulePercent(module);
  }

  function getProcessModuleTitle(module) {
    return laboratoryProcessStageUi.getProcessModuleTitle(module);
  }

  function getRunningProcessJob() {
    return laboratoryProcessStageUi.getRunningProcessJob();
  }

  function getRunningReportJob() {
    return laboratoryReportStageUi.getRunningReportJob();
  }

  function renderProcessStage() {
    return laboratoryProcessStageUi.renderProcessStage();
  }

  function renderReportFinding(signal) {
    return laboratoryReportStageUi.renderReportFinding(signal);
  }

  function getAudioAnalysisProviderLabel(providerId) {
    return audioAnalysisUi.getAudioAnalysisProviderLabel(providerId);
  }

  function getAudioAnalysisModuleTitle(moduleEntry) {
    return audioAnalysisUi.getAudioAnalysisModuleTitle(moduleEntry);
  }

  function getAudioAnalysisModuleSummary(moduleEntry) {
    return audioAnalysisUi.getAudioAnalysisModuleSummary(moduleEntry);
  }

  function renderAudioAnalysisResultCard(moduleEntry) {
    return audioAnalysisUi.renderAudioAnalysisResultCard(moduleEntry);
  }

  function renderAudioAnalysisModuleGrid() {
    return audioAnalysisUi.renderAudioAnalysisModuleGrid();
  }

  function renderReportStage() {
    return laboratoryReportStageUi.renderReportStage();
  }

  function renderStageContent() {
    switch (state.activeStage) {
      case "edit":
        return renderEditStage();
      case "profile":
        return renderProfileStage();
      case "process":
        return renderProcessStage();
      case "report":
        return renderReportStage();
      case "source":
      default:
        return renderSourceStage();
    }
  }

  function render() {
    const root = document.getElementById("app");
    if (!root) {
      return;
    }

    captureScrollState(root);

    if (state.translations === null) {
      root.innerHTML = renderBootstrap();
      return;
    }

    root.innerHTML = `
      <main class="lab-shell" data-stage="${state.activeStage}">
        <div class="lab-shell__grain"></div>
        <div class="lab-shell__aura"></div>
        ${renderStageRail()}
        <section class="lab-surface">
          ${renderStageContent()}
        </section>
        <footer class="lab-footer">
          <p class="lab-footer__note">${escapeHtml(
            state.ui.lastActionMessage || featureText(["shared", "dummyHint"])
          )}</p>
        </footer>
        ${renderSettingsOverlay()}
      </main>
    `;

    restoreScrollState(root);
    bindPreviewMetrics();
    bindAudioAnalysis();
  }

  function handleHostMessage(message) {
    return laboratoryHostMessageRuntime.handleHostMessage(message);
  }

  const laboratoryUiActionRouter = createLaboratoryUiActionRouter({
    advanceStage: advanceStage,
    buildCurrentDraftPayload: buildCurrentDraftPayload,
    buildCurrentEditRecipePatch: buildCurrentEditRecipePatch,
    buildNestedPatch: buildNestedPatch,
    closeSettingsOverlay: closeSettingsOverlay,
    commitEditPatch: commitEditPatch,
    getActiveEditOutput: getActiveEditOutput,
    getCurrentEditDraft: getCurrentEditDraft,
    getProfileTargetSummary: getProfileTargetSummary,
    getProjectProfile: getProjectProfile,
    getSourceSnapshot: getSourceSnapshot,
    isAudioAnalysisFeature: isAudioAnalysisFeature,
    openReport: openReport,
    openSettingsOverlay: openSettingsOverlay,
    persistDrafts: persistDrafts,
    readFormValue: readFormValue,
    render: render,
    resetJourney: resetJourney,
    restartProcess: restartProcess,
    sendMediaAction: sendMediaAction,
    sendSourceAction: sendSourceAction,
    setStage: setStage,
    state: state,
    syncDraftField: syncDraftField,
    syncLocalEditField: syncLocalEditField,
    toRecord: toRecord,
    toggleCleanup: toggleCleanup,
  });

  document.addEventListener("click", laboratoryUiActionRouter.handleClick);
  document.addEventListener("input", laboratoryUiActionRouter.handleInput);
  document.addEventListener("change", laboratoryUiActionRouter.handleChange);

  if (window.roomAPI && typeof window.roomAPI.onHostMessage === "function") {
    window.roomAPI.onHostMessage(handleHostMessage);
  } else {
    setLastAction(bootstrapText("roomApiUnavailable"));
  }

  applyPresentationMode(state.presentation.mode);
  applyLocale(state.locale);
  render();

  if (window.roomAPI && typeof window.roomAPI.ready === "function") {
    window.roomAPI.ready({
      room: ROOM_ID,
      feature: getActiveFeatureId(),
      stage: "ui-ready",
    });
  }
})();
