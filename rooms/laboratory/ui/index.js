(function () {
  const ROOM_ID = "laboratory";
  const SUBTITLE_FEATURE_ID = "subtitle-analysis";
  const AUDIO_FEATURE_ID = "audio-analysis";
  const FEATURE_ID = "media-analysis";
  const STAGE_ORDER = ["source", "edit", "profile", "process", "report"];
  const SOURCE_FORMATS = ["video", "audio", "image"];
  const REGION_OPTIONS = ["containment", "corridor", "archive"];
  const TOTAL_DURATION_MS = 9370;
  const PREVIEW_IMAGE = "../assets/media-analysis-view.webp";
  const FEATURE_NAMESPACES = {
    [FEATURE_ID]: "mediaAnalysis",
    [AUDIO_FEATURE_ID]: "audioAnalysis",
    [SUBTITLE_FEATURE_ID]: "subtitleAnalysis",
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
    locale: resolveLocale(document.documentElement.lang || navigator.language),
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
    },
  };

  function resolveLocale(value) {
    return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
  }

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

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readFormValue(target) {
    if (target instanceof HTMLInputElement && target.type === "number") {
      return target.value === "" ? null : Number(target.value);
    }
    return target.value;
  }

  function readValue(source, path) {
    let current = source;
    for (let index = 0; index < path.length; index += 1) {
      const key = path[index];
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  }

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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function applyLocale(locale) {
    state.locale = resolveLocale(locale);
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
    state.activeStage = stageId;
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

  function formatTime(ms) {
    const total = Math.max(0, Math.min(TOTAL_DURATION_MS, Math.round(ms)));
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const centiseconds = Math.floor((total % 1000) / 10);
    return [
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
      String(centiseconds).padStart(2, "0"),
    ].join(":");
  }

  function formatDuration(seconds) {
    if (typeof seconds !== "number" || Number.isFinite(seconds) === false || seconds <= 0) {
      return "--";
    }
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;
    if (hours > 0) {
      return [hours, minutes, remainingSeconds].map((item) => String(item).padStart(2, "0")).join(":");
    }
    return [minutes, remainingSeconds].map((item) => String(item).padStart(2, "0")).join(":");
  }

  function formatDateTime(value) {
    if (typeof value !== "string" || value.trim() === "") {
      return "--";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(state.locale === "tr" ? "tr-TR" : "en-US");
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

  function formatStatusLabel(value) {
    const token = typeof value === "string" ? value : "idle";
    return token
      .split(/[-_]/)
      .filter(Boolean)
      .map(function (segment) {
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      })
      .join(" ");
  }

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

  function getSourceSnapshot() {
    return toRecord(state.sourceSnapshot);
  }

  function getActiveProject() {
    const project = getSourceSnapshot().activeProject;
    return project && typeof project === "object" && Array.isArray(project) === false ? project : null;
  }

  function getProjectSummaries() {
    const projects = getSourceSnapshot().projects;
    return Array.isArray(projects) ? projects : [];
  }

  function getSourcePresets() {
    return toRecord(getSourceSnapshot().sourcePresets);
  }

  function getYtDlpForm() {
    return toRecord(getSourceSnapshot().ytDlpForm);
  }

  function getEditPresets() {
    return toRecord(getSourceSnapshot().editPresets);
  }

  function getEditCapabilities() {
    return toRecord(getSourceSnapshot().editCapabilities);
  }

  function getProfilePresets() {
    return toRecord(getSourceSnapshot().profilePresets);
  }

  function getProfileCapabilities() {
    return toRecord(getSourceSnapshot().profileCapabilities);
  }

  function getProfileModelsCatalog() {
    return toRecord(getSourceSnapshot().profileModels);
  }

  function getProfileModelState() {
    return toRecord(getSourceSnapshot().profileModelState);
  }

  function getSubtitleSourcePresets() {
    return toRecord(getSourceSnapshot().subtitleSourcePresets);
  }

  function getSubtitleYoutubeForm() {
    return toRecord(getSourceSnapshot().subtitleYoutubeForm);
  }

  function getSubtitleEditPresets() {
    return toRecord(getSourceSnapshot().subtitleEditPresets);
  }

  function getSubtitleAnalysisCatalog() {
    return toRecord(getSourceSnapshot().subtitleAnalysisCatalog);
  }

  function getSubtitleAnalysisCapabilities() {
    return toRecord(getSourceSnapshot().subtitleAnalysisCapabilities);
  }

  function getSubtitleAnalysisProviders() {
    return toRecord(getSourceSnapshot().subtitleAnalysisProviders);
  }

  function getSubtitleProcessStatusLabel(status) {
    const token = typeof status === "string" && status.trim() !== "" ? status.trim() : "planned";
    const localized = subtitleText(["process", "catalog", "status", token], "", "");
    return localized || formatStatusLabel(token);
  }

  function getSubtitleProviderStatusLabel(status) {
    const token = typeof status === "string" && status.trim() !== "" ? status.trim() : "planned";
    const localized = subtitleText(["process", "providers", "status", token], "", "");
    return localized || formatStatusLabel(token);
  }

  function getSubtitleProcessModuleLabel(entry) {
    const moduleId = typeof toRecord(entry).id === "string" ? toRecord(entry).id : "";
    const localized = moduleId
      ? subtitleText(["process", "catalog", "modules", moduleId, "label"], "", "")
      : "";
    return localized || toRecord(entry).label || moduleId || "--";
  }

  function getSubtitleProcessModuleSummary(entry) {
    const moduleId = typeof toRecord(entry).id === "string" ? toRecord(entry).id : "";
    return moduleId ? subtitleText(["process", "catalog", "modules", moduleId, "summary"], "", "") : "";
  }

  function getSubtitleProviderLabel(entry) {
    const providerId = typeof toRecord(entry).id === "string" ? toRecord(entry).id : "";
    const localized = providerId
      ? subtitleText(["process", "providers", "items", providerId, "label"], "", "")
      : "";
    return localized || providerId || "--";
  }

  function getSubtitleProviderSummary(entry) {
    const providerId = typeof toRecord(entry).id === "string" ? toRecord(entry).id : "";
    return providerId ? subtitleText(["process", "providers", "items", providerId, "summary"], "", "") : "";
  }

  function getSubtitleProviderModuleLabels(entry) {
    const moduleIds = Array.isArray(toRecord(entry).moduleIds) ? toRecord(entry).moduleIds : [];
    const labels = moduleIds
      .map(function (moduleId) {
        return getSubtitleProcessModuleLabel({ id: moduleId });
      })
      .filter(Boolean);

    if (labels.length === 0) {
      return subtitleText(["process", "providers", "emptyModules"], "Modul bagli degil", "No linked modules");
    }

    return subtitleTemplate(
      ["process", "providers", "labels", "modules"],
      { value: labels.join(", ") },
      `Moduller: ${labels.join(", ")}`,
      `Modules: ${labels.join(", ")}`
    );
  }

  function getAudioAnalysisCatalog() {
    return toRecord(getSourceSnapshot().audioAnalysisCatalog);
  }

  function getAudioAnalysisCapabilities() {
    return toRecord(getSourceSnapshot().audioAnalysisCapabilities);
  }

  function getAudioAnalysisPresets() {
    return toRecord(getSourceSnapshot().audioAnalysisPresets);
  }

  function getAudioAnalysisProviders() {
    return toRecord(getSourceSnapshot().audioAnalysisProviders);
  }

  function getAudioAnalysisModules() {
    const modules = getAudioAnalysisCatalog().modules;
    return Array.isArray(modules) ? modules.map(toRecord) : [];
  }

  function getAudioAnalysisProviderEntries() {
    const providers = getAudioAnalysisProviders().providers;
    return Array.isArray(providers) ? providers.map(toRecord) : [];
  }

  function getToolRegistry() {
    const toolRegistry = getSourceSnapshot().toolRegistry;
    return Array.isArray(toolRegistry) ? toolRegistry.map(toRecord) : [];
  }

  function getProjectSource() {
    const project = getActiveProject();
    return project ? toRecord(project.source) : {};
  }

  function getProjectEdit() {
    const project = getActiveProject();
    return project ? toRecord(project.edit) : {};
  }

  function getProjectProfile() {
    const project = getActiveProject();
    return project ? toRecord(project.profile) : {};
  }

  function getProjectProcess() {
    const project = getActiveProject();
    return project ? toRecord(project.process) : {};
  }

  function getProjectReport() {
    const project = getActiveProject();
    return project ? toRecord(project.report) : {};
  }

  function getProjectAudioAnalysis() {
    const project = getActiveProject();
    return project ? toRecord(project.audioAnalysis) : {};
  }

  function getProjectSubtitleAnalysis() {
    const project = getActiveProject();
    return project ? toRecord(project.subtitleAnalysis) : {};
  }

  function getSubtitleWorkspace() {
    return toRecord(getProjectSubtitleAnalysis().workspace);
  }

  function getSubtitleDiscoveryState() {
    return toRecord(getProjectSubtitleAnalysis().discovery);
  }

  function getSubtitleDiscoveryItems() {
    const items = getSubtitleDiscoveryState().items;
    return Array.isArray(items) ? items.map(toRecord) : [];
  }

  function getSubtitleSelectedCandidateIds() {
    const selectedCandidateIds = getSubtitleDiscoveryState().selectedCandidateIds;
    return Array.isArray(selectedCandidateIds)
      ? selectedCandidateIds.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [];
  }

  function getSubtitleEntries() {
    const entries = getProjectSubtitleAnalysis().entries;
    return Array.isArray(entries) ? entries.map(toRecord) : [];
  }

  function getActiveSubtitleEntry() {
    const activeEntryId =
      typeof getProjectSubtitleAnalysis().activeEntryId === "string"
        ? getProjectSubtitleAnalysis().activeEntryId
        : null;
    return (
      getSubtitleEntries().find(function (entry) {
        return activeEntryId !== null && entry.id === activeEntryId;
      }) || getSubtitleEntries()[0] || null
    );
  }

  function getSubtitleSelectedEntryIds() {
    const selectedEntryIds = toRecord(getSubtitleWorkspace().selection).selectedEntryIds;
    return Array.isArray(selectedEntryIds)
      ? selectedEntryIds.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : [];
  }

  function getSubtitleEditState() {
    return toRecord(getProjectSubtitleAnalysis().edit);
  }

  function getSubtitleEditPreview() {
    return toRecord(getSubtitleEditState().preview);
  }

  function getSubtitleOutputs() {
    const outputs = getSubtitleEditState().outputs;
    return Array.isArray(outputs) ? outputs.map(toRecord) : [];
  }

  function getAudioAnalysisSourceState() {
    return toRecord(getProjectAudioAnalysis().source);
  }

  function getAudioAnalysisCatalogState() {
    return toRecord(getProjectAudioAnalysis().analysisCatalog);
  }

  function getAudioAnalysisProviderState() {
    return toRecord(getProjectAudioAnalysis().providerState);
  }

  function getAudioAnalysisResultMap() {
    return toRecord(getProjectAudioAnalysis().results);
  }

  function getAudioAnalysisOrderedResultEntries() {
    const catalogModules = getAudioAnalysisModules().reduce(function (accumulator, entry) {
      const moduleId = typeof entry.id === "string" && entry.id.trim() !== "" ? entry.id : null;
      if (moduleId !== null) {
        accumulator[moduleId] = entry;
      }
      return accumulator;
    }, {});
    const catalogState = getAudioAnalysisCatalogState();
    const resultMap = getAudioAnalysisResultMap();
    const orderedIds = Array.isArray(catalogState.orderedIds)
      ? catalogState.orderedIds.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : getAudioAnalysisModules().map(function (entry) {
          return entry.id;
        });
    const extraIds = Object.keys(resultMap).filter(function (moduleId) {
      return !orderedIds.includes(moduleId);
    });

    return orderedIds.concat(extraIds).map(function (moduleId) {
      const descriptor = toRecord(catalogModules[moduleId]);
      const result = toRecord(resultMap[moduleId]);
      return {
        moduleId: moduleId,
        phase:
          typeof result.phase === "string" && result.phase.trim() !== ""
            ? result.phase
            : typeof descriptor.phase === "string" && descriptor.phase.trim() !== ""
              ? descriptor.phase
              : "v1",
        status:
          typeof result.status === "string" && result.status.trim() !== ""
            ? result.status
            : typeof descriptor.status === "string" && descriptor.status.trim() !== ""
              ? descriptor.status
              : "planned",
        titleKey:
          typeof result.titleKey === "string" && result.titleKey.trim() !== ""
            ? result.titleKey
            : typeof descriptor.titleKey === "string"
              ? descriptor.titleKey
              : null,
        summaryKey:
          typeof result.summaryKey === "string" && result.summaryKey.trim() !== ""
            ? result.summaryKey
            : typeof descriptor.summaryKey === "string"
              ? descriptor.summaryKey
              : null,
        summary: typeof result.summary === "string" ? result.summary : "",
        providerIds: Array.isArray(result.providerIds)
          ? result.providerIds
          : Array.isArray(descriptor.providerIds)
            ? descriptor.providerIds
            : [],
        blockers: Array.isArray(result.blockers) ? result.blockers : [],
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
        metrics: Array.isArray(result.metrics) ? result.metrics.map(toRecord) : [],
        confidence: typeof result.confidence === "string" ? result.confidence : null,
        signals: Array.isArray(result.signals) ? result.signals.map(toRecord) : [],
        artifacts: Array.isArray(result.artifacts) ? result.artifacts.map(toRecord) : [],
      };
    });
  }

  function getCurrentFeatureProcessRecord() {
    return toRecord(toRecord(getProjectProcess().records)[getActiveFeatureId()]);
  }

  function getCurrentFeatureReportRecord() {
    return toRecord(toRecord(getProjectReport().records)[getActiveFeatureId()]);
  }

  function getSourceMetadata() {
    return toRecord(getProjectSource().metadata);
  }

  function getEditPreview() {
    return toRecord(getProjectEdit().preview);
  }

  function getEditOutputs() {
    const outputs = getProjectEdit().outputs;
    return Array.isArray(outputs) ? outputs.map(toRecord) : [];
  }

  function getActiveEditOutput() {
    const edit = getProjectEdit();
    const activeOutputId =
      typeof edit.activeOutputId === "string" && edit.activeOutputId.trim() !== ""
        ? edit.activeOutputId
        : null;
    return (
      getEditOutputs().find(function (entry) {
        return activeOutputId !== null && entry.id === activeOutputId;
      }) || null
    );
  }

  function getToolEntry(toolId) {
    const tools = toRecord(toRecord(getSourceSnapshot().toolState).tools);
    return toRecord(tools[toolId]);
  }

  function getStageToolIds(stageId) {
    return getToolRegistry()
      .filter(function (entry) {
        const supportLevel = toRecord(entry.stageSupport)[stageId];
        return (
          typeof supportLevel === "string" &&
          supportLevel.trim() !== "" &&
          supportLevel !== "unsupported"
        );
      })
      .map(function (entry) {
        return entry.toolId;
      });
  }

  function getWorkspaceCapabilities(kind) {
    return toRecord(toRecord(getEditCapabilities().workspace)[kind]);
  }

  function getJobs() {
    const jobs = getSourceSnapshot().jobs;
    return Array.isArray(jobs) ? jobs : [];
  }

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
    const editJobs = Array.isArray(projectJobs)
      ? projectJobs
          .map(toRecord)
          .filter(function (entry) {
            return entry.featureStage === "edit" || String(entry.action || "").startsWith("edit-");
          })
      : [];
    const actionOrder = {
      "edit-preview": 0,
      "edit-apply": 1,
    };

    return editJobs.sort(function (left, right) {
      const leftRank = Object.prototype.hasOwnProperty.call(actionOrder, left.action)
        ? actionOrder[left.action]
        : 99;
      const rightRank = Object.prototype.hasOwnProperty.call(actionOrder, right.action)
        ? actionOrder[right.action]
        : 99;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftId = String(left.jobId || left.requestId || left.action || "");
      const rightId = String(right.jobId || right.requestId || right.action || "");
      return leftId.localeCompare(rightId);
    });
  }

  function collectProfileStageJobs(projectJobs) {
    const profileJobs = Array.isArray(projectJobs)
      ? projectJobs
          .map(toRecord)
          .filter(function (entry) {
            return entry.featureStage === "profile" || String(entry.action || "").startsWith("profile-");
          })
      : [];
    const actionOrder = {
      "profile-run-preflight": 0,
      "profile-model-install": 1,
      "profile-model-remove": 2,
    };

    return profileJobs.sort(function (left, right) {
      const leftRank = Object.prototype.hasOwnProperty.call(actionOrder, left.action)
        ? actionOrder[left.action]
        : 99;
      const rightRank = Object.prototype.hasOwnProperty.call(actionOrder, right.action)
        ? actionOrder[right.action]
        : 99;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftId = String(left.jobId || left.requestId || left.action || "");
      const rightId = String(right.jobId || right.requestId || right.action || "");
      return leftId.localeCompare(rightId);
    });
  }

  function collectProcessStageJobs(projectJobs) {
    return (Array.isArray(projectJobs) ? projectJobs : [])
      .map(toRecord)
      .filter(function (entry) {
        return entry.featureStage === "process" || String(entry.action || "").includes("process");
      })
      .sort(function (left, right) {
        return String(left.jobId || left.requestId || left.action || "").localeCompare(
          String(right.jobId || right.requestId || right.action || "")
        );
      });
  }

  function collectReportStageJobs(projectJobs) {
    return (Array.isArray(projectJobs) ? projectJobs : [])
      .map(toRecord)
      .filter(function (entry) {
        return entry.featureStage === "report" || String(entry.action || "").includes("report");
      })
      .sort(function (left, right) {
        return String(left.jobId || left.requestId || left.action || "").localeCompare(
          String(right.jobId || right.requestId || right.action || "")
        );
      });
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
    if (isSubtitleAnalysisFeature()) {
      const drafts = toRecord(getSubtitleWorkspace().drafts);

      if (state.ui.localSubtitleDraftProjectId !== getSourceSnapshot().activeProjectId) {
        state.ui.localSubtitleDraftProjectId = getSourceSnapshot().activeProjectId;
        state.ui.localSubtitleDrafts = {
          urlInput: typeof drafts.urlInput === "string" ? drafts.urlInput : "",
          youtubeUrl: typeof drafts.youtubeUrl === "string" ? drafts.youtubeUrl : "",
          subtitleMode:
            typeof drafts.subtitleMode === "string" && drafts.subtitleMode.trim() !== ""
              ? drafts.subtitleMode
              : "manual",
          subtitlesLang:
            typeof drafts.subtitlesLang === "string" && drafts.subtitlesLang.trim() !== ""
              ? drafts.subtitlesLang
              : "all",
          publishedAfter: typeof drafts.publishedAfter === "string" ? drafts.publishedAfter : "",
          publishedBefore: typeof drafts.publishedBefore === "string" ? drafts.publishedBefore : "",
          weekdays: typeof drafts.weekdays === "string" ? drafts.weekdays : "",
          durationMinSeconds:
            typeof drafts.durationMinSeconds === "number" ? drafts.durationMinSeconds : null,
          durationMaxSeconds:
            typeof drafts.durationMaxSeconds === "number" ? drafts.durationMaxSeconds : null,
          shortsMode:
            typeof drafts.shortsMode === "string" && drafts.shortsMode.trim() !== ""
              ? drafts.shortsMode
              : "all",
          liveMode:
            typeof drafts.liveMode === "string" && drafts.liveMode.trim() !== ""
              ? drafts.liveMode
              : "all",
          titleInclude: typeof drafts.titleInclude === "string" ? drafts.titleInclude : "",
          titleExclude: typeof drafts.titleExclude === "string" ? drafts.titleExclude : "",
          playlistItems: typeof drafts.playlistItems === "string" ? drafts.playlistItems : "",
          limitCount: typeof drafts.limitCount === "number" ? drafts.limitCount : null,
        };
      }

      return {
        ...drafts,
        ...state.ui.localSubtitleDrafts,
      };
    }

    const source = getProjectSource();
    const drafts = toRecord(source.drafts);

    if (state.ui.localDraftProjectId !== getSourceSnapshot().activeProjectId) {
      state.ui.localDraftProjectId = getSourceSnapshot().activeProjectId;
      state.ui.localDrafts = {
        urlInput: typeof drafts.urlInput === "string" ? drafts.urlInput : "",
        youtubeUrl: typeof drafts.youtubeUrl === "string" ? drafts.youtubeUrl : "",
        fileNameHint: typeof drafts.fileNameHint === "string" ? drafts.fileNameHint : "",
        youtubePreset:
          typeof drafts.youtubePreset === "string" && drafts.youtubePreset.trim() !== ""
            ? drafts.youtubePreset
            : null,
        youtubeCustom: { ...toRecord(drafts.youtubeCustom) },
      };
    }

    return {
      ...drafts,
      ...state.ui.localDrafts,
      youtubeCustom: {
        ...toRecord(drafts.youtubeCustom),
        ...toRecord(state.ui.localDrafts.youtubeCustom),
      },
    };
  }

  function getCurrentEditDraft() {
    if (isSubtitleAnalysisFeature()) {
      const project = getActiveProject();
      const subtitleEdit = getSubtitleEditState();
      const projectId = project ? project.id : null;
      const projectUpdatedAt =
        project && typeof project.updatedAt === "string" ? project.updatedAt : null;

      if (
        state.ui.localSubtitleEditProjectId !== projectId ||
        state.ui.localSubtitleEditUpdatedAt !== projectUpdatedAt ||
        state.ui.localSubtitleEditDraft === null
      ) {
        state.ui.localSubtitleEditProjectId = projectId;
        state.ui.localSubtitleEditUpdatedAt = projectUpdatedAt;
        state.ui.localSubtitleEditDraft = deepClone(subtitleEdit);
      }

      return toRecord(state.ui.localSubtitleEditDraft);
    }

    const project = getActiveProject();
    const projectEdit = getProjectEdit();
    const projectId = project ? project.id : null;
    const projectUpdatedAt =
      project && typeof project.updatedAt === "string" ? project.updatedAt : null;

    if (
      state.ui.localEditProjectId !== projectId ||
      state.ui.localEditUpdatedAt !== projectUpdatedAt ||
      state.ui.localEditDraft === null
    ) {
      state.ui.localEditProjectId = projectId;
      state.ui.localEditUpdatedAt = projectUpdatedAt;
      state.ui.localEditDraft = deepClone(projectEdit);
    }

    return toRecord(state.ui.localEditDraft);
  }

  function setNestedValue(target, path, value) {
    const segments = String(path || "")
      .split(".")
      .filter(Boolean);
    if (segments.length === 0) {
      return;
    }

    let current = target;
    while (segments.length > 1) {
      const segment = segments.shift();
      if (!current[segment] || typeof current[segment] !== "object" || Array.isArray(current[segment])) {
        current[segment] = {};
      }
      current = current[segment];
    }
    current[segments[0]] = value;
  }

  function buildNestedPatch(path, value) {
    const patch = {};
    setNestedValue(patch, path, value);
    return patch;
  }

  function syncLocalEditField(path, value) {
    if (isSubtitleAnalysisFeature()) {
      const draft = getCurrentEditDraft();
      setNestedValue(draft, path, value);
      state.ui.localSubtitleEditDraft = draft;
      return;
    }

    const draft = getCurrentEditDraft();
    setNestedValue(draft, path, value);

    if (path === "recipe.common.focusRegionId") {
      const focusRegion = toRecord(toRecord(getEditPresets().focusRegions)[String(value || "")]);
      const cropNormalized = toRecord(focusRegion.cropNormalized);
      if (Object.keys(cropNormalized).length > 0) {
        draft.recipe = toRecord(draft.recipe);
        draft.recipe.common = toRecord(draft.recipe.common);
        draft.recipe.common.cropNormalized = deepClone(cropNormalized);
      }
    }

    state.ui.localEditDraft = draft;
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
    state.activeStage = "report";
    render();
  }

  function resetJourney() {
    state.activeStage = "source";
    render();
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
    if (isSubtitleAnalysisFeature()) {
      return {
        urlInput: state.ui.localSubtitleDrafts.urlInput,
        youtubeUrl: state.ui.localSubtitleDrafts.youtubeUrl,
        subtitleMode: state.ui.localSubtitleDrafts.subtitleMode,
        subtitlesLang: state.ui.localSubtitleDrafts.subtitlesLang,
        publishedAfter: state.ui.localSubtitleDrafts.publishedAfter,
        publishedBefore: state.ui.localSubtitleDrafts.publishedBefore,
        weekdays: state.ui.localSubtitleDrafts.weekdays,
        durationMinSeconds: state.ui.localSubtitleDrafts.durationMinSeconds,
        durationMaxSeconds: state.ui.localSubtitleDrafts.durationMaxSeconds,
        shortsMode: state.ui.localSubtitleDrafts.shortsMode,
        liveMode: state.ui.localSubtitleDrafts.liveMode,
        titleInclude: state.ui.localSubtitleDrafts.titleInclude,
        titleExclude: state.ui.localSubtitleDrafts.titleExclude,
        playlistItems: state.ui.localSubtitleDrafts.playlistItems,
        limitCount: state.ui.localSubtitleDrafts.limitCount,
      };
    }

    return {
      urlInput: state.ui.localDrafts.urlInput,
      youtubeUrl: state.ui.localDrafts.youtubeUrl,
      fileNameHint: state.ui.localDrafts.fileNameHint,
      youtubePreset: state.ui.localDrafts.youtubePreset,
      youtubeCustom: { ...state.ui.localDrafts.youtubeCustom },
    };
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
    const modules = getAudioAnalysisModules();
    if (modules.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["catalog", "eyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["catalog", "title"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["catalog", "subtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${modules
            .map(function (entry) {
              const status = typeof entry.status === "string" ? entry.status : "planned";
              const statusLabel =
                status === "implemented"
                  ? featureText(["catalog", "status", "implemented"])
                  : status === "gated"
                    ? featureText(["catalog", "status", "gated"])
                    : featureText(["catalog", "status", "planned"]);
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(textFromKey(entry.titleKey || "") || entry.id || "--")}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(String(entry.phase || "--").toUpperCase())}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(textFromKey(entry.summaryKey || "") || "")}</p>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderAudioAnalysisNoticePanel() {
    const providerCount = getAudioAnalysisProviderEntries().length;
    const capabilities = getAudioAnalysisCapabilities();
    const capabilityNotes = [];
    if (capabilities.sharedSettingsOverlay === true) {
      capabilityNotes.push(featureText(["settings", "title"]));
    }
    if (capabilities.sharedToolRegistry === true) {
      capabilityNotes.push(text(["mediaAnalysis", "settings", "otherToolsTitle"]));
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["shared", "toolingEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["shared", "toolingTitle"]))}</h2>
          </div>
        </div>
        <p class="lab-panel__hint">${escapeHtml(featureText(["shared", "toolingBody"]))}</p>
        <ul class="lab-meta-list">
          <li>
            <span>${escapeHtml(text(["mediaAnalysis", "shared", "status"]))}</span>
            <strong>${escapeHtml(
              capabilityNotes.length > 0 ? capabilityNotes.join(" + ") : featureText(["settings", "title"])
            )}</strong>
          </li>
          <li>
            <span>${escapeHtml(text(["mediaAnalysis", "report", "findingsTitle"]))}</span>
            <strong>${escapeHtml(String(providerCount))}</strong>
          </li>
        </ul>
      </section>
    `;
  }

  function getAudioAnalysisProviderStatusLabel(status) {
    const token = typeof status === "string" ? status : "gated";
    if (token === "ready") {
      return text(["mediaAnalysis", "settings", "status", "ready"]);
    }
    if (token === "planned") {
      return featureText(["catalog", "status", "planned"]);
    }
    if (token === "gated") {
      return featureText(["catalog", "status", "gated"]);
    }
    return formatStatusLabel(token);
  }

  function renderAudioAnalysisProviderPanel() {
    const providers = getAudioAnalysisProviderEntries();
    const providerStateMap = getAudioAnalysisProviderState();
    if (providers.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["settings", "providersEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["settings", "providersTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["settings", "providersSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${providers
            .map(function (entry) {
              const providerState = toRecord(providerStateMap[entry.id]);
              const status =
                (typeof providerState.status === "string" && providerState.status.trim() !== ""
                  ? providerState.status
                  : typeof entry.status === "string"
                    ? entry.status
                    : "gated");
              const moduleIds = Array.isArray(providerState.moduleIds)
                ? providerState.moduleIds
                : Array.isArray(entry.moduleIds)
                  ? entry.moduleIds
                  : [];
              const moduleLabels = moduleIds
                .map(function (moduleId) {
                  return getAudioAnalysisModuleTitle(
                    getAudioAnalysisOrderedResultEntries().find(function (moduleEntry) {
                      return moduleEntry.moduleId === moduleId;
                    }) || { moduleId: moduleId }
                  );
                })
                .filter(Boolean);
              const expectedArtifacts = Array.isArray(providerState.expectedArtifacts)
                ? providerState.expectedArtifacts
                : Array.isArray(entry.expectedArtifacts)
                  ? entry.expectedArtifacts
                  : [];
              const fallbackProviderIds = Array.isArray(providerState.fallbackProviderIds)
                ? providerState.fallbackProviderIds
                : Array.isArray(entry.fallbackProviderIds)
                  ? entry.fallbackProviderIds
                  : [];

              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(textFromKey(entry.titleKey || "") || entry.id || "--")}</strong>
                      <span>${escapeHtml(getAudioAnalysisProviderStatusLabel(status))}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(getToolDisplayName(providerState.toolId || entry.toolId || "planned"))}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(textFromKey(entry.summaryKey || "") || "")}</p>
                  ${renderSummaryRows([
                    [
                      featureText(["settings", "providerMeta", "type"]),
                      providerState.providerType || entry.providerType || "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "install"]),
                      providerState.installStrategy || entry.installStrategy || "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "modules"]),
                      moduleLabels.length > 0 ? moduleLabels.join(", ") : "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "artifacts"]),
                      expectedArtifacts.length > 0 ? expectedArtifacts.join(", ") : "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "version"]),
                      providerState.version || "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "model"]),
                      providerState.modelId || "--",
                    ],
                    [
                      featureText(["settings", "providerMeta", "platform"]),
                      providerState.platformSupported === false
                        ? featureText(["settings", "providerMetaValues", "limited"])
                        : featureText(["settings", "providerMetaValues", "supported"]),
                    ],
                    [
                      featureText(["settings", "providerMeta", "fallbacks"]),
                      fallbackProviderIds.length > 0
                        ? fallbackProviderIds
                            .map(function (providerId) {
                              return getAudioAnalysisProviderLabel(providerId);
                            })
                            .join(", ")
                        : "--",
                    ],
                  ])}
                  ${
                    Array.isArray(providerState.blockers) && providerState.blockers.length > 0
                      ? `
                        <div class="lab-list-block">
                          <strong>${escapeHtml(featureText(["report", "moduleMeta", "blockers"]))}</strong>
                          <ul class="lab-bullet-list">
                            ${providerState.blockers
                              .slice(0, 3)
                              .map(function (item) {
                                return `<li>${escapeHtml(item)}</li>`;
                              })
                              .join("")}
                          </ul>
                        </div>
                      `
                      : ""
                  }
                  ${
                    Array.isArray(providerState.warnings) && providerState.warnings.length > 0
                      ? `
                        <div class="lab-list-block">
                          <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                          <ul class="lab-bullet-list">
                            ${providerState.warnings
                              .slice(0, 3)
                              .map(function (item) {
                                return `<li>${escapeHtml(item)}</li>`;
                              })
                              .join("")}
                          </ul>
                        </div>
                      `
                      : ""
                  }
                  ${
                    typeof providerState.lastError === "string" && providerState.lastError.trim() !== ""
                      ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(providerState.lastError)}</p>`
                      : ""
                  }
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderPreviewMetaRow(label, value) {
    return `
      <li>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "--")}</strong>
      </li>
    `;
  }

  function renderPreviewSurface() {
    const project = getActiveProject();
    const source = getProjectSource();
    const previewUrl =
      typeof source.previewUrl === "string" && source.previewUrl.trim() !== "" ? source.previewUrl : null;
    const fileName =
      typeof source.storedFileName === "string" && source.storedFileName.trim() !== ""
        ? source.storedFileName
        : "--";
    const sourceMode = getCurrentSourceMode();
    const routeLabel =
      typeof source.routeLabel === "string" && source.routeLabel.trim() !== ""
        ? source.routeLabel
        : text(["mediaAnalysis", "source", "modes", sourceMode]);

    const projectJobs = getRelevantJobs().project;
    const activeJob =
      projectJobs.find(function (entry) {
        return entry.featureStage !== "edit";
      }) || null;

    let mediaMarkup = `
      <div class="lab-empty-preview">
        <strong>${escapeHtml(text(["mediaAnalysis", "source", "previewEmptyTitle"]))}</strong>
        <p>${escapeHtml(text(["mediaAnalysis", "source", "previewEmptyBody"]))}</p>
      </div>
    `;

    if (previewUrl !== null) {
      if (getCurrentSourceKind() === "image") {
        mediaMarkup = `<img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${previewUrl}" alt="" />`;
      } else if (getCurrentSourceKind() === "audio") {
        mediaMarkup = `<audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" src="${previewUrl}" controls preload="metadata"></audio>`;
      } else {
        mediaMarkup = `<video class="lab-preview-media lab-preview-media--video" data-preview-media="video" src="${previewUrl}" controls preload="metadata"></video>`;
      }
    }

    const infoRows = [
      renderPreviewMetaRow(text(["mediaAnalysis", "source", "previewInfo", "route"]), routeLabel),
      renderPreviewMetaRow(text(["mediaAnalysis", "source", "previewInfo", "file"]), fileName),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "source", "previewInfo", "status"]),
        getProjectStatusLabel(source)
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "source", "previewInfo", "source"]),
        typeof source.sourceUrl === "string" && source.sourceUrl.trim() !== "" ? source.sourceUrl : "--"
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "duration"]),
        formatDuration(getPreferredSourceDuration(previewUrl))
      ),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "resolution"]),
        getPreferredSourceResolution(previewUrl)
      ),
      renderPreviewMetaRow(text(["mediaAnalysis", "shared", "codec"]), getPreferredSourceCodec()),
      renderPreviewMetaRow(text(["mediaAnalysis", "shared", "format"]), getPreferredSourceFormat()),
      renderPreviewMetaRow(
        text(["mediaAnalysis", "shared", "bitrate"]),
        formatBitRate(getSourceMetadata().bitRate)
      ),
    ];

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-preview-panel__header">
          <div>
            <p class="lab-panel__subtitle">${escapeHtml(project ? project.name : "--")}</p>
            <h2 class="lab-panel__title">${escapeHtml(getCurrentSourceLabel())}</h2>
          </div>
          <span class="lab-chip">${escapeHtml(getProjectStatusLabel(source))}</span>
        </div>
        <div class="lab-preview-card">
          <div class="lab-preview-frame">
            ${mediaMarkup}
          </div>
          <div class="lab-preview-copy">
            <ul class="lab-meta-list">${infoRows.join("")}</ul>
            ${
              activeJob
                ? `
                  <div class="lab-status-card">
                    <div class="lab-status-card__head">
                      <strong>${escapeHtml(text(["mediaAnalysis", "source", "jobs", "title"]))}</strong>
                      <span>${escapeHtml(
                        typeof activeJob.percent === "number" ? `${Math.round(activeJob.percent)}%` : activeJob.stage || "--"
                      )}</span>
                    </div>
                    <div class="lab-progress-bar">
                      <span style="width:${Math.max(4, Number(activeJob.percent) || 6)}%"></span>
                    </div>
                    <p class="lab-status-card__body">${escapeHtml(activeJob.message || activeJob.stage || "")}</p>
                  </div>
                `
                : ""
            }
          </div>
        </div>
      </section>
    `;
  }

  function renderProjectPanel() {
    const projects = getProjectSummaries();
    const activeProjectId = getSourceSnapshot().activeProjectId;
    const activeProject = getActiveProject();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "projects", "eyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "projects", "title"]))}</h2>
          </div>
          <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="project-create">
            ${escapeHtml(text(["mediaAnalysis", "projects", "newAction"]))}
          </button>
        </div>
        <div class="lab-project-card">
          <strong>${escapeHtml(activeProject ? activeProject.name : text(["mediaAnalysis", "projects", "empty"]))}</strong>
          <span>${escapeHtml(activeProject ? activeProject.updatedAt : "--")}</span>
        </div>
        <div class="lab-field">
          <label class="lab-field__label" for="project-select">${escapeHtml(
            text(["mediaAnalysis", "projects", "selectLabel"])
          )}</label>
          <select class="lab-select" id="project-select" data-select="project">
            ${projects
              .map(function (project) {
                return `
                  <option value="${escapeHtml(project.id)}" ${
                    project.id === activeProjectId ? "selected" : ""
                  }>
                    ${escapeHtml(project.name)}
                  </option>
                `;
              })
              .join("")}
          </select>
        </div>
        <div class="lab-action-stack">
          ${
            state.ui.pendingDeleteProjectId === activeProjectId
              ? `
                <button class="lab-button lab-button--danger" type="button" data-action="project-delete-confirm">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteConfirm"]))}
                </button>
                <button class="lab-button lab-button--ghost" type="button" data-action="project-delete-cancel">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteCancel"]))}
                </button>
              `
              : `
                <button class="lab-button lab-button--ghost" type="button" data-action="project-delete-arm">
                  ${escapeHtml(text(["mediaAnalysis", "projects", "deleteAction"]))}
                </button>
              `
          }
        </div>
      </section>
    `;
  }

  function renderSourceKindPanel() {
    const currentKind = getCurrentSourceKind();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["source", "formatLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["source", "title"]))}</h2>
          </div>
        </div>
        <div class="lab-source-grid">
          ${getAvailableSourceFormats().map(function (sourceId) {
            return `
              <button
                class="lab-source-card"
                type="button"
                data-action="source-kind"
                data-value="${sourceId}"
                data-selected="${sourceId === currentKind ? "true" : "false"}"
              >
                <span class="lab-source-card__icon">${escapeHtml(sourceId.slice(0, 1).toUpperCase())}</span>
                <span class="lab-source-card__title">${escapeHtml(
                  featureText(["source", "formats", sourceId, "title"])
                )}</span>
                <span class="lab-source-card__subtitle">${escapeHtml(
                  featureText(["source", "formats", sourceId, "subtitle"])
                )}</span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderSourceModes() {
    const currentKind = getCurrentSourceKind();
    const currentMode = getCurrentSourceMode();
    const modes = getSourceModeOptions(currentKind);
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;

    return `
      <div class="lab-segmented">
        ${modes
          .map(function (modeId) {
            const disabled = modeId === "youtube" && ytDlpInstalled !== true;
            return `
              <button
                class="lab-segmented__button"
                type="button"
                data-action="source-mode"
                data-value="${modeId}"
                data-selected="${modeId === currentMode ? "true" : "false"}"
                ${disabled ? "disabled" : ""}
              >
                ${escapeHtml(text(["mediaAnalysis", "source", "modes", modeId]))}
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderTextField(fieldId, value, label, placeholder, extra) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <input
          class="lab-input"
          type="${escapeHtml(extra && extra.type ? extra.type : "text")}"
          value="${escapeHtml(value || "")}"
          data-draft-field="${escapeHtml(fieldId)}"
          placeholder="${escapeHtml(placeholder || "")}"
        />
      </label>
    `;
  }

  function renderYoutubeCustomForm(drafts) {
    const sections = Array.isArray(getYtDlpForm().sections) ? getYtDlpForm().sections : [];
    return `
      <div class="lab-form-stack">
        ${sections
          .map(function (section) {
            const fields = Array.isArray(section.fields) ? section.fields : [];
            return `
              <div class="lab-form-section">
                <div class="lab-form-grid">
                  ${fields
                    .map(function (field) {
                      const value = toRecord(drafts.youtubeCustom)[field.id];
                      if (field.type === "toggle") {
                        return `
                          <button
                            class="lab-toggle"
                            type="button"
                            data-toggle-field="youtubeCustom.${field.id}"
                            data-active="${value === true ? "true" : "false"}"
                          >
                            <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
                            <span class="lab-toggle__label">${escapeHtml(textFromKey(field.labelKey))}</span>
                          </button>
                        `;
                      }

                      if (field.type === "select") {
                        return `
                          <label class="lab-field">
                            <span class="lab-field__label">${escapeHtml(textFromKey(field.labelKey))}</span>
                            <select class="lab-select" data-draft-field="youtubeCustom.${field.id}">
                              ${(Array.isArray(field.options) ? field.options : [])
                                .map(function (option) {
                                  return `
                                    <option value="${escapeHtml(option.value)}" ${
                                      String(option.value) === String(value) ? "selected" : ""
                                    }>
                                      ${escapeHtml(textFromKey(option.labelKey))}
                                    </option>
                                  `;
                                })
                                .join("")}
                            </select>
                          </label>
                        `;
                      }

                      return renderTextField(
                        `youtubeCustom.${field.id}`,
                        value,
                        textFromKey(field.labelKey),
                        textFromKey(field.placeholderKey),
                        {
                          type: field.type === "number" ? "number" : "text",
                        }
                      );
                    })
                    .join("")}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderSourceIntakePanel() {
    const currentMode = getCurrentSourceMode();
    const drafts = getCurrentDrafts();
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;
    const youtubePreset = typeof drafts.youtubePreset === "string" && drafts.youtubePreset.trim() !== "" ? drafts.youtubePreset : "medium";

    let body = "";

    if (currentMode === "local") {
      body = `
        ${renderTextField(
          "fileNameHint",
          drafts.fileNameHint,
          text(["mediaAnalysis", "source", "fields", "fileNameHint"]),
          text(["mediaAnalysis", "source", "placeholders", "fileNameHint"])
        )}
        <button class="lab-button lab-button--primary" type="button" data-action="source-pick-local">
          ${escapeHtml(text(["mediaAnalysis", "source", "actions", "pickLocal"]))}
        </button>
      `;
    } else if (currentMode === "url") {
      body = `
        ${renderTextField(
          "urlInput",
          drafts.urlInput,
          text(["mediaAnalysis", "source", "fields", "urlInput"]),
          text(["mediaAnalysis", "source", "placeholders", "urlInput"])
        )}
        ${renderTextField(
          "fileNameHint",
          drafts.fileNameHint,
          text(["mediaAnalysis", "source", "fields", "fileNameHint"]),
          text(["mediaAnalysis", "source", "placeholders", "fileNameHint"])
        )}
        <button class="lab-button lab-button--primary" type="button" data-action="source-download-url">
          ${escapeHtml(text(["mediaAnalysis", "source", "actions", "downloadUrl"]))}
        </button>
      `;
    } else {
      body = `
        ${
          ytDlpInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "source", "youtubeDisabled"]))}</div>`
            : ""
        }
        ${renderTextField(
          "youtubeUrl",
          drafts.youtubeUrl,
          text(["mediaAnalysis", "source", "fields", "youtubeUrl"]),
          text(["mediaAnalysis", "source", "placeholders", "youtubeUrl"])
        )}
        <div class="lab-field">
          <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "source", "youtubePresetLabel"]))}</span>
          <div class="lab-chip-row">
            ${["low", "medium", "best", "custom"]
              .map(function (presetId) {
                return `
                  <button
                    class="lab-choice-chip"
                    type="button"
                    data-action="youtube-preset"
                    data-value="${presetId}"
                    data-selected="${presetId === youtubePreset ? "true" : "false"}"
                  >
                    ${escapeHtml(text(["mediaAnalysis", "source", "youtubePresets", presetId]))}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
        ${youtubePreset === "custom" ? renderYoutubeCustomForm(drafts) : ""}
        <button
          class="lab-button lab-button--primary"
          type="button"
          data-action="source-download-youtube"
          ${ytDlpInstalled !== true ? "disabled" : ""}
        >
          ${escapeHtml(text(["mediaAnalysis", "source", "actions", "downloadYoutube"]))}
        </button>
      `;
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "source", "modeLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "source", "intakeTitle"]))}</h2>
          </div>
        </div>
        ${renderSourceModes()}
        <div class="lab-form-stack">${body}</div>
      </section>
    `;
  }

  function renderToolCard(toolId, stageId) {
    const tool = getToolEntry(toolId);
    const descriptor =
      getToolRegistry().find(function (entry) {
        return entry.toolId === toolId;
      }) || {};
    const details = toRecord(tool.details);
    const busy = tool.busy === true;
    const updateAvailable = tool.updateAvailable === true;
    const stageSupport = toRecord(descriptor.stageSupport)[stageId] || "unsupported";
    const availability =
      (typeof details.availability === "string" && details.availability.trim() !== ""
        ? details.availability
        : typeof descriptor.availability === "string" && descriptor.availability.trim() !== ""
          ? descriptor.availability
          : "installable");
    const planned = availability === "planned";
    const systemCommand = availability === "system-command";
    const plannedReason =
      (typeof details.plannedReason === "string" && details.plannedReason.trim() !== ""
        ? details.plannedReason
        : typeof descriptor.plannedReason === "string" && descriptor.plannedReason.trim() !== ""
          ? descriptor.plannedReason
          : null);
    const setupHint =
      (typeof details.setupHint === "string" && details.setupHint.trim() !== ""
        ? details.setupHint
        : typeof descriptor.setupHint === "string" && descriptor.setupHint.trim() !== ""
          ? descriptor.setupHint
          : null);
    const statusLabel =
      planned
        ? text(["mediaAnalysis", "settings", "status", "planned"])
        : systemCommand
        ? tool.installed === true
          ? text(["mediaAnalysis", "settings", "status", "manualReady"])
          : text(["mediaAnalysis", "settings", "status", "manualSetup"])
        : tool.installed === true
        ? updateAvailable
          ? text(["mediaAnalysis", "settings", "status", "updateAvailable"])
          : text(["mediaAnalysis", "settings", "status", "installed"])
        : text(["mediaAnalysis", "settings", "status", "missing"]);
    const actionMarkup =
      planned
        ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  disabled
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "status", "planned"]))}
                </button>
              `
        : systemCommand
        ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="${tool.installed === true ? "tool-update" : "tool-install"}"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(
                    tool.installed === true
                      ? text(["mediaAnalysis", "settings", "manualRefreshAction"])
                      : text(["mediaAnalysis", "settings", "manualCheckAction"])
                  )}
                </button>
              `
        : tool.installed === true
        ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="tool-update"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "updateAction"]))}
                </button>
              `
        : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="tool-install"
                  data-value="${toolId}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "settings", "installAction"]))}
                </button>
              `;

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(text(["mediaAnalysis", "settings", "tools", toolId]) || descriptor.displayName || toolId)}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${actionMarkup}
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "stageSupportLabel"]),
            text(["mediaAnalysis", "settings", "support", stageSupport])
          )}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "settings", "versionLabel"]), tool.version || "--")}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "latestLabel"]),
            tool.latestVersion || tool.latestReleaseName || "--"
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "settings", "pathLabel"]),
            tool.binaryPath || "--"
          )}
        </ul>
        ${
          busy
            ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "settings", "busyHint"]))}</p>`
            : ""
        }
        ${
          plannedReason
            ? `<p class="lab-panel__hint">${escapeHtml(plannedReason)}</p>`
            : ""
        }
        ${
          setupHint
            ? `<p class="lab-panel__hint">${escapeHtml(setupHint)}</p>`
            : ""
        }
        ${
          typeof tool.lastError === "string" && tool.lastError.trim() !== ""
            ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(tool.lastError)}</p>`
            : ""
        }
      </article>
    `;
  }

  function renderProfileModelCard(entry) {
    const model = toRecord(entry);
    const busy = model.busy === true;
    const canInstall =
      model.binarySupported === true &&
      getToolEntry("whisper.cpp").installed === true &&
      model.runtimeCompatible !== false;
    const statusLabel =
      model.ready === true
        ? text(["mediaAnalysis", "settings", "status", "ready"])
        : model.installed === true
          ? text(["mediaAnalysis", "settings", "status", "installed"])
          : text(["mediaAnalysis", "settings", "status", "missing"]);

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(textFromKey(model.labelKey || "") || model.modelId || "--")}</strong>
            <span>${escapeHtml(statusLabel)}</span>
          </div>
          ${
            model.installed === true
              ? `
                <button
                  class="lab-button lab-button--ghost lab-button--tight"
                  type="button"
                  data-action="profile-model-remove"
                  data-value="${escapeHtml(model.modelId || "")}"
                  ${busy ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "remove"]))}
                </button>
              `
              : `
                <button
                  class="lab-button lab-button--primary lab-button--tight"
                  type="button"
                  data-action="profile-model-install"
                  data-value="${escapeHtml(model.modelId || "")}"
                  ${busy || canInstall !== true ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modelActions", "install"]))}
                </button>
              `
          }
        </div>
        <ul class="lab-summary-list">
          ${renderPreviewMetaRow(text(["mediaAnalysis", "profile", "modelSummary", "size"]), formatBytes(model.sizeBytes || model.expectedBytes))}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "profile", "modelSummary", "quantization"]), model.quantization || "--")}
          ${renderPreviewMetaRow(text(["mediaAnalysis", "profile", "modelSummary", "language"]), model.language || "--")}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "platforms"]),
            formatPlatformList(model.supportedPlatforms)
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "cleanup"]),
            formatCleanupPolicy(model.cleanupPolicy)
          )}
          ${renderPreviewMetaRow(
            text(["mediaAnalysis", "profile", "modelSummary", "integrity"]),
            model.checksumValid === true
              ? text(["mediaAnalysis", "settings", "status", "ready"])
              : model.installed === true
                ? text(["mediaAnalysis", "settings", "status", "installed"])
                : "--"
          )}
        </ul>
        ${
          typeof model.summaryKey === "string" && model.summaryKey.trim() !== ""
            ? `<p class="lab-panel__hint">${escapeHtml(textFromKey(model.summaryKey))}</p>`
            : ""
        }
        ${
          canInstall !== true
            ? `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "modelUnavailable"]))}</p>`
            : ""
        }
        ${
          typeof model.compatibilityReason === "string" && model.compatibilityReason.trim() !== ""
            ? `<p class="lab-panel__hint">${escapeHtml(model.compatibilityReason)}</p>`
            : ""
        }
        ${
          typeof model.lastError === "string" && model.lastError.trim() !== ""
            ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(model.lastError)}</p>`
            : ""
        }
      </article>
    `;
  }

  function renderSettingsOverlay() {
    if (state.ui.settingsOpen !== true) {
      return "";
    }

    const stageId = STAGE_ORDER.includes(state.activeStage) ? state.activeStage : "source";
    const allToolIds = getToolRegistry().map(function (entry) {
      return entry.toolId;
    });
    const currentStageToolIds = getStageToolIds(stageId);
    const otherToolIds = allToolIds.filter(function (toolId) {
      return currentStageToolIds.includes(toolId) === false;
    });

    return `
      <div class="lab-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(
        featureText(["settings", "title"])
      )}">
        <div class="lab-overlay__scrim" data-action="close-settings"></div>
        <section class="lab-overlay__panel">
          <header class="lab-overlay__header">
            <div>
              <p class="lab-panel__eyebrow">${escapeHtml(featureText(["settings", "eyebrow"]))}</p>
              <h2 class="lab-panel__title">${escapeHtml(featureText(["settings", "title"]))}</h2>
              <p class="lab-panel__subtitle">${escapeHtml(
                `${featureText(["settings", "subtitle"])} ${featureText(["stages", stageId])}`
              )}</p>
            </div>
            <div class="lab-overlay__actions">
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="tools-refresh">
                ${escapeHtml(text(["mediaAnalysis", "settings", "refreshAction"]))}
              </button>
              <button class="lab-button lab-button--ghost lab-button--tight" type="button" data-action="close-settings">
                ${escapeHtml(text(["mediaAnalysis", "settings", "closeAction"]))}
              </button>
            </div>
          </header>
          <section class="lab-panel">
            <div class="lab-panel__header">
              <div>
                <p class="lab-panel__eyebrow">${escapeHtml(featureText(["settings", "currentStageTitle"]))}</p>
                <h2 class="lab-panel__title">${escapeHtml(featureText(["stages", stageId]))}</h2>
              </div>
            </div>
            <div class="lab-tool-grid">
              ${
                currentStageToolIds.length > 0
                  ? currentStageToolIds
                      .map(function (toolId) {
                        return renderToolCard(toolId, stageId);
                      })
                      .join("")
                  : `<p class="lab-panel__hint">${escapeHtml(
                      text(["mediaAnalysis", "settings", "noStageTools"])
                    )}</p>`
              }
            </div>
          </section>
          ${
            otherToolIds.length > 0
              ? `
                <section class="lab-panel">
                  <div class="lab-panel__header">
                    <div>
                      <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "settings", "otherToolsTitle"]))}</p>
                      <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "settings", "otherToolsSubtitle"]))}</h2>
                    </div>
                  </div>
                  <div class="lab-tool-grid">
                    ${otherToolIds
                      .map(function (toolId) {
                        return renderToolCard(toolId, stageId);
                      })
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }
          ${isAudioAnalysisFeature() ? renderAudioAnalysisProviderPanel() : ""}
          ${
            stageId === "profile" && getProfileModelEntries().length > 0
              ? `
                <section class="lab-panel">
                  <div class="lab-panel__header">
                    <div>
                      <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "modelTitle"]))}</p>
                      <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modelSubtitle"]))}</h2>
                    </div>
                  </div>
                  <div class="lab-tool-grid">
                    ${getProfileModelEntries()
                      .map(function (entry) {
                        return renderProfileModelCard(entry);
                      })
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }
        </section>
      </div>
    `;
  }

  function getSubtitleSourceModeOptions() {
    const modes = getSubtitleSourcePresets().modes;
    return Array.isArray(modes)
      ? modes.filter(function (entry) {
          return typeof entry === "string" && entry.trim() !== "";
        })
      : ["local-file", "local-folder", "url", "youtube-single", "youtube-playlist", "youtube-channel"];
  }

  function getCurrentSubtitleSourceMode() {
    const workspace = getSubtitleWorkspace();
    const currentMode = typeof workspace.mode === "string" ? workspace.mode : null;
    const modes = getSubtitleSourceModeOptions();
    return modes.includes(currentMode) ? currentMode : modes[0] || "local-file";
  }

  function getSubtitleSourceModeLabel(modeId) {
    switch (modeId) {
      case "local-folder":
        return subtitleText(["source", "modes", "localFolder"], "Klasor", "Folder");
      case "url":
        return "URL";
      case "youtube-single":
        return subtitleText(["source", "modes", "youtubeSingle"], "YouTube Tek Video", "YouTube Single");
      case "youtube-playlist":
        return subtitleText(["source", "modes", "youtubePlaylist"], "YouTube Playlist", "YouTube Playlist");
      case "youtube-channel":
        return subtitleText(["source", "modes", "youtubeChannel"], "YouTube Kanal", "YouTube Channel");
      case "local-file":
      default:
        return subtitleText(["source", "modes", "localFile"], "Tek Altyazi", "Single Subtitle");
    }
  }

  function renderSubtitleDraftSelect(fieldId, value, label, options) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <select class="lab-select" data-draft-field="${escapeHtml(fieldId)}">
          ${options
            .map(function (entry) {
              return `
                <option value="${escapeHtml(entry.value)}" ${
                  String(entry.value) === String(value) ? "selected" : ""
                }>
                  ${escapeHtml(entry.label)}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  function renderSubtitleCatalogPanel() {
    const modules = Array.isArray(getSubtitleAnalysisCatalog().modules)
      ? getSubtitleAnalysisCatalog().modules.map(toRecord)
      : [];
    if (modules.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["process", "catalog", "eyebrow"], "Analiz Plani", "Analysis Plan"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["process", "catalog", "title"], "Ilk Modul Seti", "Initial Module Set"))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              subtitleText(
                ["process", "catalog", "subtitle"],
                "QC, okunabilirlik, zamanlama ve batch ozet modulleri burada gorunur.",
                "QC, readability, timing, and batch summary modules live here."
              )
            )}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${modules
            .map(function (entry) {
              const statusLabel = getSubtitleProcessStatusLabel(entry.status || "planned");
              const summary = getSubtitleProcessModuleSummary(entry);
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProcessModuleLabel(entry))}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(statusLabel)}</span>
                  </div>
                  ${summary ? `<p class="lab-panel__hint">${escapeHtml(summary)}</p>` : ""}
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSubtitleProviderPanel() {
    const providers = Array.isArray(getSubtitleAnalysisProviders().providers)
      ? getSubtitleAnalysisProviders().providers.map(toRecord)
      : [];
    if (providers.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["process", "providers", "eyebrow"], "Saglayicilar", "Providers"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["process", "providers", "title"], "Calisma Katmani", "Execution Layer"))}</h2>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${providers
            .map(function (entry) {
              const statusLabel = getSubtitleProviderStatusLabel(entry.status || "planned");
              const providerSummary = getSubtitleProviderSummary(entry);
              const moduleSummary = getSubtitleProviderModuleLabels(entry);
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProviderLabel(entry))}</strong>
                      <span>${escapeHtml(statusLabel)}</span>
                    </div>
                  </div>
                  ${providerSummary ? `<p class="lab-panel__hint">${escapeHtml(providerSummary)}</p>` : ""}
                  <p class="lab-panel__hint">${escapeHtml(moduleSummary)}</p>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSubtitleSourceWorkspacePanel() {
    const workspace = getSubtitleWorkspace();
    const discovery = getSubtitleDiscoveryState();
    const activeEntry = getActiveSubtitleEntry();
    const selectedCount = getSubtitleSelectedEntryIds().length;
    const candidateCount = getSubtitleDiscoveryItems().length;
    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "summary", "eyebrow"], "Kaynak Ozet", "Source Summary"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(
              activeEntry
                ? activeEntry.fileName || activeEntry.id || "--"
                : subtitleText(["source", "summary", "emptyTitle"], "Altyazi secilmedi", "No subtitle selected")
            )}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              activeEntry
                ? subtitleText(
                    ["source", "summary", "activeSubtitle"],
                    "Aktif altyazi girisi ve secili batch durumu.",
                    "Active subtitle entry and current batch selection."
                  )
                : subtitleText(
                    ["source", "summary", "prepareHint"],
                    "Source asamasindan bir altyazi girisi hazirla.",
                    "Prepare a subtitle entry from the source stage."
                  )
            )}</p>
          </div>
        </div>
        ${renderSummaryRows([
          [subtitleText(["source", "summary", "labels", "workspaceMode"], "Calisma modu", "Workspace mode"), getSubtitleSourceModeLabel(getCurrentSubtitleSourceMode())],
          [subtitleText(["source", "summary", "labels", "selectedEntries"], "Secili giris", "Selected entries"), String(selectedCount || (activeEntry ? 1 : 0))],
          [subtitleText(["source", "summary", "labels", "discoveryCandidates"], "Kesif adayi", "Discovery candidates"), String(candidateCount)],
          [subtitleText(["source", "summary", "labels", "format"], "Format", "Format"), activeEntry ? String(activeEntry.format || "--").toUpperCase() : "--"],
          [subtitleText(["source", "summary", "labels", "language"], "Dil", "Language"), activeEntry ? activeEntry.language || "--" : "--"],
          [subtitleText(["source", "summary", "labels", "published"], "Yayin", "Published"), activeEntry ? activeEntry.publishedAt || "--" : "--"],
          [subtitleText(["source", "summary", "labels", "discovery"], "Kesif", "Discovery"), formatStatusLabel(discovery.status || "idle")],
          [subtitleText(["source", "summary", "labels", "status"], "Durum", "Status"), formatStatusLabel(workspace.lastError ? "error" : "ready")],
        ])}
        ${
          typeof workspace.lastError === "string" && workspace.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(workspace.lastError)}</div>`
            : ""
        }
      </section>
    `;
  }

  function renderSubtitleSourceIntakePanel() {
    const drafts = getCurrentDrafts();
    const currentMode = getCurrentSubtitleSourceMode();
    const ytDlpInstalled = getToolEntry("yt-dlp").installed === true;
    const discoveryItems = getSubtitleDiscoveryItems();
    const selectedCandidateCount = getSubtitleSelectedCandidateIds().length;
    let body = "";

    if (currentMode === "local-file") {
      body = `
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-pick-local">
          ${escapeHtml(subtitleText(["source", "actions", "pickLocal"], "Tek altyazi sec", "Pick subtitle file"))}
        </button>
      `;
    } else if (currentMode === "local-folder") {
      body = `
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-pick-folder">
          ${escapeHtml(subtitleText(["source", "actions", "pickFolder"], "Klasor sec", "Pick subtitle folder"))}
        </button>
      `;
    } else if (currentMode === "url") {
      body = `
        ${renderTextField(
          "urlInput",
          drafts.urlInput,
          subtitleText(["source", "fields", "subtitleUrl"], "Altyazi URL", "Subtitle URL"),
          subtitleText(["source", "placeholders", "subtitleUrl"], "https://example.com/file.vtt", "https://example.com/file.vtt")
        )}
        <button class="lab-button lab-button--primary" type="button" data-action="subtitle-source-download-url">
          ${escapeHtml(subtitleText(["source", "actions", "downloadUrl"], "URL indir", "Download URL"))}
        </button>
      `;
    } else {
      body = `
        ${
          ytDlpInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(featureText(["source", "youtubeDisabled"]))}</div>`
            : ""
        }
        ${renderTextField(
          "youtubeUrl",
          drafts.youtubeUrl,
          subtitleText(["source", "fields", "youtubeUrl"], "YouTube URL", "YouTube URL"),
          subtitleText(["source", "placeholders", "youtubeUrl"], "Kanal, playlist ya da video linki", "Channel, playlist, or video URL")
        )}
        <div class="lab-form-grid">
          ${renderSubtitleDraftSelect("subtitleMode", drafts.subtitleMode || "manual", subtitleText(["source", "fields", "subtitleMode"], "Altyazi modu", "Subtitle mode"), [
            { value: "manual", label: subtitleText(["source", "options", "subtitleMode", "manual"], "Manual", "Manual") },
            { value: "auto", label: subtitleText(["source", "options", "subtitleMode", "auto"], "Otomatik", "Automatic") },
            { value: "both", label: subtitleText(["source", "options", "subtitleMode", "both"], "Ikisi de", "Both") },
          ])}
          ${renderTextField(
            "subtitlesLang",
            drafts.subtitlesLang || "all",
            subtitleText(["source", "fields", "languageFilter"], "Dil filtresi", "Language filter"),
            subtitleText(["source", "placeholders", "languageFilter"], "tr,en ya da all", "tr,en or all")
          )}
          ${renderTextField(
            "publishedAfter",
            drafts.publishedAfter || "",
            subtitleText(["source", "fields", "publishedAfter"], "Yayin tarihi baslangic", "Published after"),
            "",
            { type: "date" }
          )}
          ${renderTextField(
            "publishedBefore",
            drafts.publishedBefore || "",
            subtitleText(["source", "fields", "publishedBefore"], "Yayin tarihi bitis", "Published before"),
            "",
            { type: "date" }
          )}
          ${renderTextField(
            "weekdays",
            drafts.weekdays || "",
            subtitleText(["source", "fields", "weekdays"], "Haftanin gunleri", "Weekdays"),
            subtitleText(["source", "placeholders", "weekdays"], "mon wed fri", "mon wed fri")
          )}
          ${renderTextField(
            "durationMinSeconds",
            drafts.durationMinSeconds == null ? "" : String(drafts.durationMinSeconds),
            subtitleText(["source", "fields", "durationMin"], "Min sure sn", "Min duration sec"),
            "0",
            { type: "number" }
          )}
          ${renderTextField(
            "durationMaxSeconds",
            drafts.durationMaxSeconds == null ? "" : String(drafts.durationMaxSeconds),
            subtitleText(["source", "fields", "durationMax"], "Max sure sn", "Max duration sec"),
            "0",
            { type: "number" }
          )}
          ${renderSubtitleDraftSelect("shortsMode", drafts.shortsMode || "all", subtitleText(["source", "fields", "shorts"], "Shorts", "Shorts"), [
            { value: "all", label: subtitleText(["source", "options", "shorts", "all"], "Tum", "All") },
            { value: "only", label: subtitleText(["source", "options", "shorts", "only"], "Sadece shorts", "Only shorts") },
            { value: "exclude", label: subtitleText(["source", "options", "shorts", "exclude"], "Shorts haric", "Exclude shorts") },
          ])}
          ${renderSubtitleDraftSelect("liveMode", drafts.liveMode || "all", subtitleText(["source", "fields", "liveStatus"], "Canli durumu", "Live status"), [
            { value: "all", label: subtitleText(["source", "options", "liveStatus", "all"], "Tum yuklemeler", "All uploads") },
            { value: "exclude-live", label: subtitleText(["source", "options", "liveStatus", "excludeLive"], "Canli haric", "Exclude live") },
            { value: "only-live", label: subtitleText(["source", "options", "liveStatus", "onlyLive"], "Sadece canli", "Only live") },
          ])}
          ${renderTextField(
            "titleInclude",
            drafts.titleInclude || "",
            subtitleText(["source", "fields", "titleInclude"], "Baslik dahil", "Title include"),
            subtitleText(["source", "placeholders", "titleInclude"], "roportaj, ozet", "interview, summary")
          )}
          ${renderTextField(
            "titleExclude",
            drafts.titleExclude || "",
            subtitleText(["source", "fields", "titleExclude"], "Baslik haric", "Title exclude"),
            subtitleText(["source", "placeholders", "titleExclude"], "teaser, shorts", "teaser, shorts")
          )}
          ${renderTextField(
            "playlistItems",
            drafts.playlistItems || "",
            subtitleText(["source", "fields", "playlistItems"], "Playlist araligi", "Playlist items"),
            subtitleText(["source", "placeholders", "playlistItems"], "1-10 gibi", "for example 1-10")
          )}
          ${renderTextField(
            "limitCount",
            drafts.limitCount == null ? "" : String(drafts.limitCount),
            subtitleText(["source", "fields", "limitCount"], "Max video", "Max videos"),
            "0",
            { type: "number" }
          )}
        </div>
        <button
          class="lab-button lab-button--ghost"
          type="button"
          data-action="subtitle-source-discover-youtube"
          ${ytDlpInstalled !== true ? "disabled" : ""}
        >
          ${escapeHtml(subtitleText(["source", "actions", "discoverYoutube"], "Adaylari kesfet", "Discover candidates"))}
        </button>
        <button
          class="lab-button lab-button--primary"
          type="button"
          data-action="subtitle-source-download-youtube"
          ${ytDlpInstalled !== true || discoveryItems.length === 0 || selectedCandidateCount === 0 ? "disabled" : ""}
        >
          ${escapeHtml(subtitleText(["source", "actions", "downloadSelected"], "Secili altyazilari indir", "Download selected subtitles"))}
        </button>
        ${
          discoveryItems.length > 0
            ? `<p class="lab-panel__hint">${escapeHtml(
                subtitleTemplate(
                  ["source", "discovery", "selectionHint"],
                  { count: selectedCandidateCount },
                  `${selectedCandidateCount} secili aday indirilmeye hazir.`,
                  `${selectedCandidateCount} selected candidate(s) are ready for download.`
                )
              )}</p>`
            : ""
        }
      `;
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["source", "modeLabel"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["source", "intakeTitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented lab-segmented--subtitle-source">
          ${getSubtitleSourceModeOptions()
            .map(function (modeId) {
              const disabled = modeId.indexOf("youtube-") === 0 && ytDlpInstalled !== true;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="subtitle-source-mode"
                  data-value="${escapeHtml(modeId)}"
                  data-selected="${modeId === currentMode ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(getSubtitleSourceModeLabel(modeId))}
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="lab-form-stack">${body}</div>
      </section>
    `;
  }

  function renderSubtitleEntryPanel() {
    const entries = getSubtitleEntries();
    const activeEntry = getActiveSubtitleEntry();
    const selectedIds = getSubtitleSelectedEntryIds();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "entries", "eyebrow"], "Girisler", "Entries"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["source", "entries", "title"], "Altyazi Listesi", "Subtitle List"))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            entries.length > 0
              ? entries
                  .map(function (entry) {
                    return `
                      <article class="lab-output-card" data-selected="${
                        activeEntry && activeEntry.id === entry.id ? "true" : "false"
                      }">
                        <div>
                          <strong>${escapeHtml(entry.fileName || entry.id || "--")}</strong>
                          <span>${escapeHtml(
                            [String(entry.format || "--").toUpperCase(), entry.language || "--", entry.sourceType || "--"]
                              .filter(Boolean)
                              .join(" · ")
                          )}</span>
                        </div>
                        <div class="lab-action-stack">
                          <button
                            class="lab-button lab-button--ghost lab-button--tight"
                            type="button"
                            data-action="subtitle-source-select-entry"
                            data-value="${escapeHtml(entry.id || "")}"
                          >
                            ${escapeHtml(subtitleText(["source", "entries", "actions", "makeActive"], "Aktif yap", "Make active"))}
                          </button>
                          <button
                            class="lab-button lab-button--ghost lab-button--tight"
                            type="button"
                            data-action="subtitle-source-toggle-selection"
                            data-value="${escapeHtml(entry.id || "")}"
                          >
                            ${escapeHtml(
                              selectedIds.includes(entry.id)
                                ? subtitleText(["source", "entries", "actions", "removeFromBatch"], "Batchten cikar", "Remove from batch")
                                : subtitleText(["source", "entries", "actions", "addToBatch"], "Batche ekle", "Add to batch")
                            )}
                          </button>
                        </div>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(subtitleText(["source", "entries", "empty"], "Henuz altyazi girisi yok.", "No subtitle entries yet."))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderSubtitleDiscoveryPanel() {
    const discovery = getSubtitleDiscoveryState();
    const items = getSubtitleDiscoveryItems();
    const selectedCandidateIds = getSubtitleSelectedCandidateIds();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["source", "discovery", "eyebrow"], "YouTube Kesfi", "YouTube Discovery"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["source", "discovery", "title"], "Aday Tablosu", "Candidate Table"))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              subtitleText(
                ["source", "discovery", "subtitle"],
                "Filtreye uyan videolari once inceleyip sonra secili altyazilari indirebilirsin.",
                "Inspect matching videos first, then download subtitles only for the selected rows."
              )
            )}</p>
          </div>
        </div>
        ${renderSummaryRows([
          [subtitleText(["source", "discovery", "labels", "status"], "Durum", "Status"), formatStatusLabel(discovery.status || "idle")],
          [subtitleText(["source", "discovery", "labels", "totalCandidates"], "Toplam aday", "Total candidates"), String(discovery.totalCandidateCount || items.length)],
          [subtitleText(["source", "discovery", "labels", "matched"], "Eslesen", "Matched"), String(items.length)],
          [subtitleText(["source", "discovery", "labels", "selected"], "Secili", "Selected"), String(selectedCandidateIds.length)],
        ])}
        ${
          typeof discovery.lastError === "string" && discovery.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(discovery.lastError)}</div>`
            : ""
        }
        ${
          items.length > 0
            ? `
              <div class="lab-action-stack lab-action-stack--inline">
                <button class="lab-button lab-button--ghost" type="button" data-action="subtitle-source-select-all-discovery">
                  ${escapeHtml(subtitleText(["source", "discovery", "actions", "selectAll"], "Tumunu sec", "Select all"))}
                </button>
                <button class="lab-button lab-button--ghost" type="button" data-action="subtitle-source-clear-discovery-selection">
                  ${escapeHtml(subtitleText(["source", "discovery", "actions", "clearSelection"], "Secimi temizle", "Clear selection"))}
                </button>
              </div>
              <div class="lab-discovery-table-wrap">
                <table class="lab-discovery-table">
                  <thead>
                    <tr>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "select"], "Sec", "Select"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "title"], "Baslik", "Title"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "published"], "Yayin", "Published"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "duration"], "Sure", "Duration"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "languages"], "Dil", "Languages"))}</th>
                      <th>${escapeHtml(subtitleText(["source", "discovery", "headers", "live"], "Canli", "Live"))}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items
                      .map(function (entry) {
                        const languageList = Array.isArray(entry.subtitleLanguages) ? entry.subtitleLanguages.slice(0, 4) : [];
                        return `
                          <tr data-selected="${selectedCandidateIds.includes(entry.id) ? "true" : "false"}">
                            <td>
                              <button
                                class="lab-button lab-button--ghost lab-button--tight"
                                type="button"
                                data-action="subtitle-source-toggle-discovery"
                                data-value="${escapeHtml(entry.id || "")}"
                              >
                                ${escapeHtml(
                                  selectedCandidateIds.includes(entry.id)
                                    ? subtitleText(["source", "discovery", "actions", "remove"], "Cikar", "Remove")
                                    : subtitleText(["source", "discovery", "actions", "select"], "Sec", "Select")
                                )}
                              </button>
                            </td>
                            <td>
                              <div class="lab-discovery-table__title">${escapeHtml(entry.title || "--")}</div>
                              <div class="lab-discovery-table__meta">${escapeHtml(entry.channelTitle || entry.videoId || "--")}</div>
                            </td>
                            <td>${escapeHtml(entry.publishedAt || "--")}</td>
                            <td>${escapeHtml(formatDuration(entry.durationSeconds))}</td>
                            <td>${escapeHtml(languageList.length > 0 ? languageList.join(", ") : "--")}</td>
                            <td>${escapeHtml(formatStatusLabel(entry.liveStatus || "offline"))}</td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
            : `<p class="lab-panel__hint">${escapeHtml(
                subtitleText(
                  ["source", "discovery", "empty"],
                  "YouTube modunda aday tablosunu doldurmak icin kesif calistir.",
                  "Run discovery in a YouTube mode to populate the candidate table."
                )
              )}</p>`
        }
      </section>
    `;
  }

  function renderSubtitlePreviewBody(textValue, emptyLabel) {
    const nextValue = typeof textValue === "string" ? textValue.trim() : "";
    return nextValue !== ""
      ? `<pre class="lab-subtitle-preview">${escapeHtml(nextValue)}</pre>`
      : `<p class="lab-panel__hint">${escapeHtml(emptyLabel)}</p>`;
  }

  function renderSubtitlePresetChooser() {
    const presetState = getSubtitleEditState();
    const presets = Array.isArray(getSubtitleEditPresets().presets)
      ? getSubtitleEditPresets().presets.map(toRecord)
      : [];
    if (presets.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "preset", "eyebrow"], "Preset", "Preset"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["edit", "preset", "title"], "Temizleme Profili", "Cleanup Profile"))}</h2>
          </div>
        </div>
        <div class="lab-chip-row">
          ${presets
            .map(function (preset) {
              return `
                <button
                  class="lab-choice-chip"
                  type="button"
                  data-action="subtitle-edit-preset"
                  data-value="${escapeHtml(preset.id || "")}"
                  data-selected="${preset.id === presetState.presetId ? "true" : "false"}"
                >
                  ${escapeHtml(preset.label || preset.id || "--")}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSubtitleEditWorkspacePanel() {
    const activeEntry = getActiveSubtitleEntry();
    const preview = getSubtitleEditPreview();
    const latestOutput = getSubtitleOutputs()[0] || null;
    const displayText =
      typeof preview.outputText === "string" && preview.outputText.trim() !== ""
        ? preview.outputText
        : "";
    const summary = toRecord(preview.summary);

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["edit", "workspaceTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(
              activeEntry
                ? activeEntry.fileName || activeEntry.id || "--"
                : subtitleText(["edit", "workspace", "emptyTitle"], "Altyazi secilmedi", "No subtitle selected")
            )}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["edit", "workspaceHint"]))}</p>
          </div>
        </div>
        ${renderSubtitlePreviewBody(
          displayText,
          subtitleText(["edit", "workspace", "previewEmpty"], "Preview icin bir preset secip onizleme calistir.", "Choose a preset and run preview to inspect output.")
        )}
        ${renderSummaryRows([
          [subtitleText(["edit", "workspace", "labels", "cues"], "Cue", "Cues"), String(summary.outputCueCount || summary.sourceCueCount || 0)],
          [subtitleText(["edit", "workspace", "labels", "lines"], "Satir", "Lines"), String(summary.outputLineCount || summary.sourceLineCount || 0)],
          [subtitleText(["edit", "workspace", "labels", "maxLine"], "Max satir", "Max line"), String(summary.maxLineLength || 0)],
          [subtitleText(["edit", "workspace", "labels", "output"], "Cikti", "Output"), latestOutput ? latestOutput.label || latestOutput.fileName || latestOutput.id || "--" : "--"],
        ])}
      </section>
    `;
  }

  function renderSubtitleEditControlsPanel() {
    const recipe = toRecord(getCurrentEditDraft().recipe);
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "controls", "eyebrow"], "Temizleme Ayarlari", "Cleanup Controls"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["edit", "controls", "title"], "Satir ve metin islemleri", "Line and text operations"))}</h2>
          </div>
        </div>
        <div class="lab-toggle-grid">
          ${renderEditToggle("trimWhitespace", subtitleText(["edit", "controls", "toggles", "trimWhitespace"], "Bosluk temizle", "Trim whitespace"), recipe.trimWhitespace === true)}
          ${renderEditToggle("collapseBlankLines", subtitleText(["edit", "controls", "toggles", "collapseBlankLines"], "Bos satirlari daralt", "Collapse blank lines"), recipe.collapseBlankLines === true)}
          ${renderEditToggle("normalizeQuotes", subtitleText(["edit", "controls", "toggles", "normalizeQuotes"], "Tirnak normalize et", "Normalize quotes"), recipe.normalizeQuotes === true)}
          ${renderEditToggle("stripHtml", subtitleText(["edit", "controls", "toggles", "stripHtml"], "HTML etiketlerini sil", "Strip HTML"), recipe.stripHtml === true)}
          ${renderEditToggle("removeMusicTags", subtitleText(["edit", "controls", "toggles", "removeMusicTags"], "Muzik etiketlerini sil", "Remove music tags"), recipe.removeMusicTags === true)}
          ${renderEditToggle("mergeShortCues", subtitleText(["edit", "controls", "toggles", "mergeShortCues"], "Kisa satirlari birlestir", "Merge short cues"), recipe.mergeShortCues === true)}
          ${renderEditToggle("splitLongLines", subtitleText(["edit", "controls", "toggles", "splitLongLines"], "Uzun satirlari bol", "Split long lines"), recipe.splitLongLines === true)}
        </div>
        <div class="lab-form-grid">
          ${renderEditSelectField("outputFormat", recipe.outputFormat || "source", subtitleText(["edit", "fields", "outputFormat"], "Cikti formati", "Output format"), [
            { value: "source", label: subtitleText(["edit", "outputFormats", "source"], "Kaynak formati", "Keep source format") },
            { value: "srt", label: "SRT" },
            { value: "vtt", label: "VTT" },
            { value: "json", label: "JSON" },
          ])}
          ${renderEditRangeField("maxCharsPerLine", recipe.maxCharsPerLine || 42, subtitleText(["edit", "controls", "labels", "maxChars"], "Max karakter", "Max chars"), {
            min: 24,
            max: 64,
            step: 1,
            displayValue: String(recipe.maxCharsPerLine || 42),
          })}
        </div>
      </section>
    `;
  }

  function renderSubtitleEditActionsPanel() {
    const editState = getSubtitleEditState();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "actions", "eyebrow"], "Aksiyonlar", "Actions"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["edit", "actions", "title"], "Preview ve cikti", "Preview and output"))}</h2>
          </div>
        </div>
        ${
          typeof editState.lastError === "string" && editState.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(editState.lastError)}</div>`
            : ""
        }
        <div class="lab-action-stack">
          <button class="lab-button lab-button--ghost" type="button" data-action="subtitle-edit-preview">
            ${escapeHtml(subtitleText(["edit", "actions", "preview"], "Onizleme uret", "Generate preview"))}
          </button>
          <button class="lab-button lab-button--primary" type="button" data-action="subtitle-edit-apply">
            ${escapeHtml(subtitleText(["edit", "actions", "apply"], "Temizlemeyi uygula", "Apply cleanup"))}
          </button>
        </div>
      </section>
    `;
  }

  function renderSubtitleOutputsPanel() {
    const outputs = getSubtitleOutputs();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "outputs", "eyebrow"], "Ciktilar", "Outputs"))}</p>
            <h2 class="lab-panel__title">${escapeHtml(subtitleText(["edit", "outputs", "title"], "Temizlenmis dosyalar", "Cleaned files"))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            outputs.length > 0
              ? outputs
                  .map(function (entry) {
                    const summary = toRecord(entry.summary);
                    return `
                      <article class="lab-output-card">
                        <div>
                          <strong>${escapeHtml(entry.label || entry.fileName || entry.id || "--")}</strong>
                          <span>${escapeHtml(entry.path || entry.fileUrl || "--")}</span>
                        </div>
                        <span>${escapeHtml(
                          subtitleText(["edit", "outputs", "labels", "cues"], "Cue", "Cues")
                        )}: ${escapeHtml(String(summary.outputCueCount || 0))}</span>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(subtitleText(["edit", "outputs", "empty"], "Henuz cikti yok.", "No outputs yet."))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderSubtitleEditSummaryPanel() {
    const preview = getSubtitleEditPreview();
    const summary = toRecord(preview.summary);
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(subtitleText(["edit", "summary", "eyebrow"], "Ozet", "Summary"))}</p>
        </div>
        ${renderSummaryRows([
          [subtitleText(["edit", "summary", "labels", "previewStatus"], "Preview durumu", "Preview status"), formatStatusLabel(preview.status || "idle")],
          [subtitleText(["edit", "summary", "labels", "changed"], "Degisti", "Changed"), summary.changed === true ? subtitleText(["edit", "summary", "values", "yes"], "Evet", "Yes") : subtitleText(["edit", "summary", "values", "no"], "Hayir", "No")],
          [subtitleText(["edit", "summary", "labels", "sourceCues"], "Kaynak cue", "Source cues"), String(summary.sourceCueCount || 0)],
          [subtitleText(["edit", "summary", "labels", "outputCues"], "Cikti cue", "Output cues"), String(summary.outputCueCount || 0)],
          [subtitleText(["edit", "summary", "labels", "maxLine"], "Max satir", "Max line"), String(summary.maxLineLength || 0)],
        ])}
      </section>
    `;
  }

  function renderSubtitleEditStage() {
    const activeEntry = getActiveSubtitleEntry();

    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("edit")}
          ${renderSubtitleEditWorkspacePanel()}
          ${renderSubtitlePresetChooser()}
          ${renderSubtitleEditControlsPanel()}
          ${renderSubtitleEditActionsPanel()}
          ${
            activeEntry === null
              ? `<div class="lab-notice">${escapeHtml(subtitleText(["edit", "emptySelection"], "Edit asamasi icin once bir altyazi girisi sec.", "Select a subtitle entry before using the edit stage."))}</div>`
              : ""
          }
        </section>
        <aside class="lab-side-stack">
          ${renderSubtitleEditSummaryPanel()}
          ${renderSubtitleOutputsPanel()}
        </aside>
      </div>
    `;
  }

  function renderSourceStage() {
    if (isSubtitleAnalysisFeature()) {
      return `
        <div class="lab-layout lab-layout--source">
          <section class="lab-main-stack">
            ${renderStageIntro("source")}
            ${renderSubtitleSourceWorkspacePanel()}
            ${renderSubtitleDiscoveryPanel()}
            ${renderSubtitleCatalogPanel()}
            ${renderSubtitleProviderPanel()}
          </section>
          <aside class="lab-side-stack">
            ${renderProjectPanel()}
            ${renderSubtitleSourceIntakePanel()}
            ${renderSubtitleEntryPanel()}
          </aside>
        </div>
      `;
    }

    if (isAudioAnalysisFeature()) {
      return `
        <div class="lab-layout lab-layout--source">
          <section class="lab-main-stack">
            ${renderStageIntro("source")}
            ${renderPreviewSurface()}
            ${renderAudioAnalysisCatalogPanel()}
            ${renderAudioAnalysisProviderPanel()}
          </section>
          <aside class="lab-side-stack">
            ${renderProjectPanel()}
            ${renderSourceKindPanel()}
            ${renderSourceIntakePanel()}
            ${renderAudioAnalysisNoticePanel()}
          </aside>
        </div>
      `;
    }

    return `
      <div class="lab-layout lab-layout--source">
        <section class="lab-main-stack">
          ${renderStageIntro("source")}
          ${renderPreviewSurface()}
        </section>
        <aside class="lab-side-stack">
          ${renderProjectPanel()}
          ${renderSourceKindPanel()}
          ${renderSourceIntakePanel()}
        </aside>
      </div>
    `;
  }

  function renderSummaryRows(rows) {
    return `
      <ul class="lab-summary-list">
        ${rows
          .map(function (row) {
            return `
              <li>
                <span>${escapeHtml(row[0])}</span>
                <strong>${escapeHtml(row[1])}</strong>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  function renderToggle(id, label, active) {
    return `
      <button
        class="lab-toggle"
        type="button"
        data-toggle="${id}"
        data-active="${active ? "true" : "false"}"
      >
        <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
        <span class="lab-toggle__label">${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderEditToggle(fieldId, label, active) {
    return `
      <button
        class="lab-toggle"
        type="button"
        data-edit-toggle="${escapeHtml(fieldId)}"
        data-active="${active ? "true" : "false"}"
      >
        <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
        <span class="lab-toggle__label">${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderEditTextField(fieldId, value, label, extra) {
    const options = toRecord(extra);
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <input
          class="lab-input"
          type="${escapeHtml(options.type || "text")}"
          value="${escapeHtml(value == null ? "" : value)}"
          placeholder="${escapeHtml(options.placeholder || "")}"
          data-edit-field="${escapeHtml(fieldId)}"
          data-edit-commit="${escapeHtml(options.commit || "change")}"
        />
      </label>
    `;
  }

  function renderEditSelectField(fieldId, value, label, optionEntries) {
    return `
      <label class="lab-field">
        <span class="lab-field__label">${escapeHtml(label)}</span>
        <select class="lab-select" data-edit-field="${escapeHtml(fieldId)}">
          ${optionEntries
            .map(function (entry) {
              return `
                <option value="${escapeHtml(entry.value)}" ${
                  String(entry.value) === String(value) ? "selected" : ""
                }>
                  ${escapeHtml(entry.label)}
                </option>
              `;
            })
            .join("")}
        </select>
      </label>
    `;
  }

  function renderEditRangeField(fieldId, value, label, options) {
    const config = toRecord(options);
    return `
      <label class="lab-range-group">
        <span>${escapeHtml(label)} <strong>${escapeHtml(String(config.displayValue || value || 0))}</strong></span>
        <input
          type="range"
          min="${escapeHtml(String(config.min ?? 0))}"
          max="${escapeHtml(String(config.max ?? 100))}"
          step="${escapeHtml(String(config.step ?? 1))}"
          value="${escapeHtml(String(value ?? config.min ?? 0))}"
          data-edit-field="${escapeHtml(fieldId)}"
          data-edit-commit="change"
        />
      </label>
    `;
  }

  function renderEditMediaMarkup(asset, cropNormalized) {
    const previewUrl =
      typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== "" ? asset.previewUrl : null;
    if (previewUrl === null) {
      return `
        <div class="lab-empty-preview">
          <strong>${escapeHtml(text(["mediaAnalysis", "edit", "previewEmptyTitle"]))}</strong>
          <p>${escapeHtml(text(["mediaAnalysis", "edit", "previewEmptyBody"]))}</p>
        </div>
      `;
    }

    const kind = getCurrentSourceKind();
    const crop = toRecord(cropNormalized);
    const focusStyle =
      kind === "audio"
        ? ""
        : `style="left:${Math.max(0, Number(crop.x || 0) * 100)}%; top:${Math.max(
            0,
            Number(crop.y || 0) * 100
          )}%; width:${Math.max(2, Number(crop.width || 0) * 100)}%; height:${Math.max(
            2,
            Number(crop.height || 0) * 100
          )}%;"`;

    if (kind === "image") {
      return `
        <img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${previewUrl}" alt="" />
        <div class="lab-edit-overlay__focus" ${focusStyle}></div>
      `;
    }

    if (kind === "audio") {
      const bars =
        state.ui.audioAnalysis.url === previewUrl && state.ui.audioAnalysis.bars.length > 0
          ? state.ui.audioAnalysis.bars
          : Array.from({ length: 42 }, function (_, index) {
              return 16 + ((index * 11) % 36);
            });
      const spectrogram =
        (Array.isArray(asset.artifacts) ? asset.artifacts : []).find(function (entry) {
          return entry.kind === "spectrogram" && typeof entry.previewUrl === "string";
        }) || null;
      return `
        <div class="lab-audio-workbench">
          ${
            spectrogram
              ? `<img class="lab-audio-spectrogram" src="${spectrogram.previewUrl}" alt="" />`
              : ""
          }
          <div class="lab-audio-bars">
            ${bars
              .map(function (height) {
                return `<span style="height:${height}px"></span>`;
              })
              .join("")}
          </div>
          <audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" src="${previewUrl}" controls preload="metadata"></audio>
        </div>
      `;
    }

    return `
      <video class="lab-preview-media lab-preview-media--video" data-preview-media="video" src="${previewUrl}" controls preload="metadata"></video>
      <div class="lab-edit-overlay__focus" ${focusStyle}></div>
    `;
  }

  function renderEditPresetChooser() {
    const presetOptions = getCurrentEditPresetOptions();
    const activePresetId =
      typeof getCurrentEditDraft().activePresetId === "string" ? getCurrentEditDraft().activePresetId : null;

    if (presetOptions.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "presetTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "presetSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-chip-row">
          ${presetOptions
            .map(function (preset) {
              return `
                <button
                  class="lab-choice-chip"
                  type="button"
                  data-action="edit-preset"
                  data-value="${escapeHtml(preset.id)}"
                  data-selected="${preset.id === activePresetId ? "true" : "false"}"
                >
                  ${escapeHtml(textFromKey(preset.labelKey))}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEditWorkspacePanel() {
    const source = getProjectSource();
    const recipe = getCurrentEditRecipe();
    const common = toRecord(recipe.common);
    const asset = getEffectiveMediaAsset();
    const preview = getEditPreview();
    const projectJobs = getRelevantJobs().project;
    const activeEditJobs = collectEditStageJobs(projectJobs);

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "workspaceTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(asset.label || text(["mediaAnalysis", "edit", "sourceAsset"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(
              preview.status === "stale"
                ? text(["mediaAnalysis", "edit", "previewStates", "stale"])
                : text(["mediaAnalysis", "edit", "workspaceHint"])
            )}</p>
          </div>
          <span class="lab-chip">${escapeHtml(text(["mediaAnalysis", "settings", "status", source.status === "error" ? "error" : "ready"]))}</span>
        </div>
        <div class="lab-preview-card">
          <div class="lab-preview-frame lab-edit-frame">
            ${renderEditMediaMarkup(asset, common.cropNormalized)}
          </div>
          <div class="lab-preview-copy">
            <ul class="lab-meta-list">
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "status"]), preview.status || text(["mediaAnalysis", "shared", "idle"]))}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "duration"]), formatDuration(typeof toRecord(asset.metadata).durationSeconds === "number" ? toRecord(asset.metadata).durationSeconds : getPreferredSourceDuration(asset.previewUrl)))}
              ${renderPreviewMetaRow(
                text(["mediaAnalysis", "shared", "resolution"]),
                typeof toRecord(asset.metadata).width === "number" && typeof toRecord(asset.metadata).height === "number"
                  ? `${asset.metadata.width} x ${asset.metadata.height}`
                  : getPreferredSourceResolution(getProjectSource().previewUrl || null)
              )}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "codec"]), asset.metadata.codec || getPreferredSourceCodec())}
              ${renderPreviewMetaRow(text(["mediaAnalysis", "shared", "format"]), asset.metadata.formatName || asset.mimeType || getPreferredSourceFormat())}
            </ul>
            ${
              activeEditJobs.length > 0
                ? `
                  <div class="lab-status-stack">
                    ${activeEditJobs
                      .map(function (activeEditJob) {
                        return `
                          <div class="lab-status-card">
                            <div class="lab-status-card__head">
                              <strong>${escapeHtml(getEditJobLabel(activeEditJob))}</strong>
                              <span>${escapeHtml(
                                typeof activeEditJob.percent === "number"
                                  ? `${Math.round(activeEditJob.percent)}%`
                                  : activeEditJob.stage || "--"
                              )}</span>
                            </div>
                            <div class="lab-progress-bar">
                              <span style="width:${Math.max(6, Number(activeEditJob.percent) || 8)}%"></span>
                            </div>
                            <p class="lab-status-card__body">${escapeHtml(activeEditJob.message || activeEditJob.action || "")}</p>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                `
                : ""
            }
          </div>
        </div>
      </section>
    `;
  }

  function renderEditModePanel() {
    const mode = getCurrentEditMode();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "modeTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "modeSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented">
          ${["beginner", "advanced"]
            .map(function (modeId) {
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="edit-mode"
                  data-value="${modeId}"
                  data-selected="${modeId === mode ? "true" : "false"}"
                >
                  ${escapeHtml(text(["mediaAnalysis", "edit", "modes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEditCommonPanel() {
    const kind = getCurrentSourceKind();
    const recipe = getCurrentEditRecipe();
    const common = toRecord(recipe.common);
    const focusRegions = toRecord(getEditPresets().focusRegions);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "commonTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "commonSubtitle"]))}</h2>
          </div>
        </div>
        ${kind !== "audio" ? `
          <div class="lab-chip-row">
            ${Object.keys(focusRegions)
              .map(function (regionId) {
                return `
                  <button
                    class="lab-choice-chip"
                    type="button"
                    data-action="edit-focus-region"
                    data-value="${regionId}"
                    data-selected="${regionId === getCurrentFocusRegionId() ? "true" : "false"}"
                  >
                    ${escapeHtml(textFromKey(toRecord(focusRegions[regionId]).labelKey))}
                  </button>
                `;
              })
              .join("")}
          </div>
        ` : ""}
        <div class="lab-form-grid">
          ${renderEditTextField(
            "recipe.common.outputNameHint",
            common.outputNameHint || "",
            text(["mediaAnalysis", "edit", "fields", "outputNameHint"]),
            { placeholder: text(["mediaAnalysis", "edit", "placeholders", "outputNameHint"]) }
          )}
          ${renderEditTextField(
            "recipe.common.notes",
            common.notes || "",
            text(["mediaAnalysis", "edit", "fields", "notes"]),
            { placeholder: text(["mediaAnalysis", "edit", "placeholders", "notes"]) }
          )}
        </div>
      </section>
    `;
  }

  function renderVideoEditPanel() {
    const recipe = getCurrentEditRecipe();
    const video = toRecord(recipe.video);
    const duration = getPreferredSourceDuration(getProjectSource().previewUrl || null) || 60;
    const resizePresets = toRecord(getEditPresets().resizePresets);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "videoTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "videoSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-toggle-grid">
          ${renderEditToggle("recipe.video.trimEnabled", text(["mediaAnalysis", "edit", "fields", "trimEnabled"]), video.trimEnabled === true)}
          ${renderEditToggle("recipe.video.includeAudio", text(["mediaAnalysis", "edit", "fields", "includeAudio"]), video.includeAudio === true)}
          ${renderEditToggle("recipe.video.blurFocusOutside", text(["mediaAnalysis", "edit", "fields", "blurFocusOutside"]), video.blurFocusOutside === true)}
        </div>
        <div class="lab-form-grid">
          ${renderEditRangeField("recipe.video.trimStartSeconds", video.trimStartSeconds || 0, text(["mediaAnalysis", "edit", "fields", "trimStartSeconds"]), {
            min: 0,
            max: Math.max(1, Math.round(duration)),
            step: 1,
            displayValue: formatDuration(video.trimStartSeconds || 0),
          })}
          ${renderEditRangeField("recipe.video.trimEndSeconds", video.trimEndSeconds || duration, text(["mediaAnalysis", "edit", "fields", "trimEndSeconds"]), {
            min: 0,
            max: Math.max(1, Math.round(duration)),
            step: 1,
            displayValue: formatDuration(video.trimEndSeconds || duration),
          })}
          ${renderEditSelectField(
            "recipe.video.resizePreset",
            video.resizePreset || "keep",
            text(["mediaAnalysis", "edit", "fields", "resizePreset"]),
            Object.keys(resizePresets).map(function (presetId) {
              return {
                value: presetId,
                label: textFromKey(toRecord(resizePresets[presetId]).labelKey),
              };
            })
          )}
          ${renderEditRangeField("recipe.video.fpsLimit", video.fpsLimit || 24, text(["mediaAnalysis", "edit", "fields", "fpsLimit"]), {
            min: 6,
            max: 60,
            step: 1,
            displayValue: `${video.fpsLimit || 24} fps`,
          })}
          ${video.resizePreset === "custom" || getCurrentEditMode() === "advanced"
            ? renderEditTextField("recipe.video.customWidth", video.customWidth || "", text(["mediaAnalysis", "edit", "fields", "customWidth"]), { type: "number" }) +
              renderEditTextField("recipe.video.customHeight", video.customHeight || "", text(["mediaAnalysis", "edit", "fields", "customHeight"]), { type: "number" })
            : ""}
          ${getCurrentEditMode() === "advanced"
            ? renderEditTextField("recipe.video.frameGrabCount", video.frameGrabCount || 0, text(["mediaAnalysis", "edit", "fields", "frameGrabCount"]), { type: "number" })
            : ""}
        </div>
      </section>
    `;
  }

  function renderAudioEditPanel() {
    const recipe = getCurrentEditRecipe();
    const audio = toRecord(recipe.audio);
    const duration = getPreferredSourceDuration(getProjectSource().previewUrl || null) || 60;

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "audioTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "audioSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-toggle-grid">
          ${renderEditToggle("recipe.audio.trimEnabled", text(["mediaAnalysis", "edit", "fields", "trimEnabled"]), audio.trimEnabled === true)}
          ${renderEditToggle("recipe.audio.normalize", text(["mediaAnalysis", "edit", "fields", "normalize"]), audio.normalize === true)}
          ${renderEditToggle("recipe.audio.silenceTrim", text(["mediaAnalysis", "edit", "fields", "silenceTrim"]), audio.silenceTrim === true)}
          ${renderEditToggle("recipe.audio.mono", text(["mediaAnalysis", "edit", "fields", "mono"]), audio.mono === true)}
          ${renderEditToggle("recipe.audio.spectrogram", text(["mediaAnalysis", "edit", "fields", "spectrogram"]), audio.spectrogram === true)}
        </div>
        <div class="lab-form-grid">
          ${renderEditRangeField("recipe.audio.trimStartSeconds", audio.trimStartSeconds || 0, text(["mediaAnalysis", "edit", "fields", "trimStartSeconds"]), {
            min: 0,
            max: Math.max(1, Math.round(duration)),
            step: 1,
            displayValue: formatDuration(audio.trimStartSeconds || 0),
          })}
          ${renderEditRangeField("recipe.audio.trimEndSeconds", audio.trimEndSeconds || duration, text(["mediaAnalysis", "edit", "fields", "trimEndSeconds"]), {
            min: 0,
            max: Math.max(1, Math.round(duration)),
            step: 1,
            displayValue: formatDuration(audio.trimEndSeconds || duration),
          })}
          ${renderEditRangeField("recipe.audio.normalizeTargetDb", audio.normalizeTargetDb || -16, text(["mediaAnalysis", "edit", "fields", "normalizeTargetDb"]), {
            min: -30,
            max: -8,
            step: 1,
            displayValue: `${audio.normalizeTargetDb || -16} LUFS`,
          })}
          ${getCurrentEditMode() === "advanced"
            ? renderEditTextField("recipe.audio.highpassHz", audio.highpassHz || 0, text(["mediaAnalysis", "edit", "fields", "highpassHz"]), { type: "number" }) +
              renderEditTextField("recipe.audio.lowpassHz", audio.lowpassHz || 0, text(["mediaAnalysis", "edit", "fields", "lowpassHz"]), { type: "number" })
            : ""}
        </div>
      </section>
    `;
  }

  function renderImageEditPanel() {
    const recipe = getCurrentEditRecipe();
    const image = toRecord(recipe.image);
    const resizePresets = toRecord(getEditPresets().resizePresets);

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "imageTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "imageSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-form-grid">
          ${renderEditSelectField(
            "recipe.image.resizePreset",
            image.resizePreset || "keep",
            text(["mediaAnalysis", "edit", "fields", "resizePreset"]),
            Object.keys(resizePresets).map(function (presetId) {
              return {
                value: presetId,
                label: textFromKey(toRecord(resizePresets[presetId]).labelKey),
              };
            })
          )}
          ${renderEditRangeField("recipe.image.brightness", image.brightness || 0, text(["mediaAnalysis", "edit", "fields", "brightness"]), {
            min: -0.3,
            max: 0.3,
            step: 0.01,
            displayValue: Number(image.brightness || 0).toFixed(2),
          })}
          ${renderEditRangeField("recipe.image.contrast", image.contrast || 1, text(["mediaAnalysis", "edit", "fields", "contrast"]), {
            min: 0.4,
            max: 2.2,
            step: 0.05,
            displayValue: Number(image.contrast || 1).toFixed(2),
          })}
          ${renderEditRangeField("recipe.image.blurStrength", image.blurStrength || 0, text(["mediaAnalysis", "edit", "fields", "blurStrength"]), {
            min: 0,
            max: 3,
            step: 0.1,
            displayValue: Number(image.blurStrength || 0).toFixed(1),
          })}
          ${(image.resizePreset === "custom" || getCurrentEditMode() === "advanced")
            ? renderEditTextField("recipe.image.customWidth", image.customWidth || "", text(["mediaAnalysis", "edit", "fields", "customWidth"]), { type: "number" }) +
              renderEditTextField("recipe.image.customHeight", image.customHeight || "", text(["mediaAnalysis", "edit", "fields", "customHeight"]), { type: "number" })
            : ""}
          ${getCurrentEditMode() === "advanced"
            ? renderEditTextField("recipe.image.rotateDegrees", image.rotateDegrees || 0, text(["mediaAnalysis", "edit", "fields", "rotateDegrees"]), { type: "number" }) +
              renderEditRangeField("recipe.image.sharpen", image.sharpen || 0, text(["mediaAnalysis", "edit", "fields", "sharpen"]), {
                min: 0,
                max: 2,
                step: 0.1,
                displayValue: Number(image.sharpen || 0).toFixed(1),
              })
            : ""}
        </div>
      </section>
    `;
  }

  function renderEditControlsPanel() {
    switch (getCurrentSourceKind()) {
      case "audio":
        return renderAudioEditPanel();
      case "image":
        return renderImageEditPanel();
      case "video":
      default:
        return renderVideoEditPanel();
    }
  }

  function renderEditActionsPanel() {
    const source = getProjectSource();
    const edit = getProjectEdit();
    const activeOutput = getActiveEditOutput();
    const ffmpegInstalled = getToolEntry("ffmpeg").installed === true;
    const previewJob =
      getRelevantJobs().project.find(function (entry) {
        return entry.action === "edit-preview";
      }) || null;
    const applyJob =
      getRelevantJobs().project.find(function (entry) {
        return entry.action === "edit-apply";
      }) || null;

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "actionsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "actionsSubtitle"]))}</h2>
          </div>
        </div>
        ${
          ffmpegInstalled !== true
            ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "edit", "ffmpegMissing"]))}</div>`
            : ""
        }
        ${
          typeof edit.lastError === "string" && edit.lastError.trim() !== ""
            ? `<div class="lab-notice">${escapeHtml(edit.lastError)}</div>`
            : ""
        }
        <div class="lab-action-stack">
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-preview"
            ${ffmpegInstalled !== true || typeof source.storedPath !== "string" || previewJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "preview"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-cancel-preview"
            ${previewJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "cancelPreview"]))}
          </button>
          <button
            class="lab-button lab-button--primary"
            type="button"
            data-action="edit-apply"
            ${ffmpegInstalled !== true || typeof source.storedPath !== "string" || applyJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "apply"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="edit-cancel-apply"
            ${applyJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "cancelApply"]))}
          </button>
        </div>
        <div class="lab-segmented">
          ${["source", "derived"]
            .map(function (modeId) {
              const disabled = modeId === "derived" && activeOutput === null;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="edit-handoff"
                  data-value="${modeId}"
                  data-selected="${edit.handoffMode === modeId ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "edit", "handoffModes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderEditOutputsPanel() {
    const outputs = getEditOutputs();
    const activeOutput = getActiveEditOutput();

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "outputsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "edit", "outputsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-output-list">
          ${
            outputs.length > 0
              ? outputs
                  .map(function (entry) {
                    return `
                      <article class="lab-output-card" data-selected="${activeOutput && activeOutput.id === entry.id ? "true" : "false"}">
                        <div>
                          <strong>${escapeHtml(entry.label || entry.fileName || entry.id)}</strong>
                          <span>${escapeHtml(entry.fileName || "--")}</span>
                        </div>
                        <button
                          class="lab-button lab-button--ghost lab-button--tight"
                          type="button"
                          data-action="edit-select-output"
                          data-value="${escapeHtml(entry.id)}"
                        >
                          ${escapeHtml(text(["mediaAnalysis", "edit", "actions", "selectOutput"]))}
                        </button>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "edit", "outputsEmpty"]))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderEditSummaryPanel() {
    const edit = getProjectEdit();
    const activeOutput = getActiveEditOutput();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "edit", "summaryTitle"]))}</p>
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "edit", "selectedWindow"]), formatEditWindowLabel()],
          [text(["mediaAnalysis", "edit", "selectedRegion"]), getCurrentFocusLabel()],
          [text(["mediaAnalysis", "edit", "selectedResize"]), getCurrentResizeLabel()],
          [
            text(["mediaAnalysis", "edit", "selectedOutput"]),
            activeOutput ? activeOutput.label || activeOutput.fileName || activeOutput.id : "--",
          ],
          [text(["mediaAnalysis", "edit", "handoffLabel"]), text(["mediaAnalysis", "edit", "handoffModes", edit.handoffMode === "derived" ? "derived" : "source"])],
        ])}
      </section>
    `;
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
    const target = getProfileTargetSummary();
    const asset = getProfileTargetAsset();
    const targetMode = getProfileTargetMode();
    const outputOptions = getProfileTargetOutputOptions();
    let mediaMarkup = `
      <div class="lab-empty-preview">
        <strong>${escapeHtml(text(["mediaAnalysis", "profile", "targetEmptyTitle"]))}</strong>
        <p>${escapeHtml(text(["mediaAnalysis", "profile", "targetEmptyBody"]))}</p>
      </div>
    `;

    if (typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== "") {
      if (asset.kind === "image") {
        mediaMarkup = `<img class="lab-preview-media lab-preview-media--image" data-preview-media="image" src="${asset.previewUrl}" alt="" />`;
      } else if (asset.kind === "audio") {
        mediaMarkup = `
          <div class="lab-audio-workbench">
            <div class="lab-audio-bars">
              ${(state.ui.audioAnalysis.bars.length > 0 ? state.ui.audioAnalysis.bars : new Array(36).fill(20))
                .map(function (value) {
                  return `<span style="height:${Math.max(10, Number(value) || 10)}px"></span>`;
                })
                .join("")}
            </div>
            <audio class="lab-preview-media lab-preview-media--audio" data-preview-media="audio" controls src="${asset.previewUrl}"></audio>
          </div>
        `;
      } else {
        mediaMarkup = `<video class="lab-preview-media lab-preview-media--video" data-preview-media="video" controls src="${asset.previewUrl}"></video>`;
      }
    }

    return `
      <section class="lab-panel lab-preview-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "targetTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "targetSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented">
          ${["source", "derived"]
            .map(function (modeId) {
              const disabled = modeId === "derived" && outputOptions.length === 0;
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="profile-target-mode"
                  data-value="${modeId}"
                  data-selected="${modeId === targetMode ? "true" : "false"}"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "targetModes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
        ${
          targetMode === "derived"
            ? `
              <label class="lab-field">
                <span class="lab-field__label">${escapeHtml(
                  text(["mediaAnalysis", "profile", "targetOutputLabel"])
                )}</span>
                <select class="lab-select" data-profile-field="targetOutputId">
                  <option value="">${escapeHtml(text(["mediaAnalysis", "profile", "targetOutputEmpty"]))}</option>
                  ${outputOptions
                    .map(function (entry) {
                      return `
                        <option value="${escapeHtml(entry.id)}" ${
                          entry.id === target.outputId ? "selected" : ""
                        }>
                          ${escapeHtml(entry.label || entry.fileName || entry.id)}
                        </option>
                      `;
                    })
                    .join("")}
                </select>
              </label>
            `
            : ""
        }
        <div class="lab-preview-card">
          <div class="lab-preview-frame">${mediaMarkup}</div>
          <section class="lab-panel lab-panel--dense">
            ${renderSummaryRows([
              [text(["mediaAnalysis", "profile", "summary", "target"]), asset.label || "--"],
              [text(["mediaAnalysis", "shared", "duration"]), formatDuration(getPreferredAssetDuration(asset))],
              [text(["mediaAnalysis", "shared", "resolution"]), getPreferredAssetResolution(asset)],
              [text(["mediaAnalysis", "shared", "codec"]), getPreferredAssetCodec(asset)],
            ])}
            ${
              target.usingFallback === true && typeof target.reason === "string"
                ? `<p class="lab-panel__hint lab-panel__hint--danger">${escapeHtml(target.reason)}</p>`
                : ""
            }
          </section>
        </div>
      </section>
    `;
  }

  function renderProfileModePanel() {
    const mode = getCurrentProfileMode();
    const estimate = getProfileEstimate();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "modeTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "modeSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-segmented">
          ${["beginner", "advanced"]
            .map(function (modeId) {
              return `
                <button
                  class="lab-segmented__button"
                  type="button"
                  data-action="profile-mode"
                  data-value="${modeId}"
                  data-selected="${modeId === mode ? "true" : "false"}"
                >
                  ${escapeHtml(text(["mediaAnalysis", "profile", "modes", modeId]))}
                </button>
              `;
            })
            .join("")}
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "profile", "summary", "preset"]), getProfileLabel()],
          [text(["mediaAnalysis", "profile", "summary", "sampleWindow"]), formatDuration(estimate.sampleWindowSeconds)],
          [text(["mediaAnalysis", "profile", "summary", "runtime"]), formatDuration(estimate.runtimeSeconds)],
        ])}
      </section>
    `;
  }

  function renderProfilePresetPanel() {
    const profile = getProjectProfile();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "presetTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "presetSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-profile-grid">
          ${getProfilePresetOptions()
            .map(function (preset) {
              return `
                <button
                  class="lab-profile-card"
                  type="button"
                  data-action="profile-preset"
                  data-value="${escapeHtml(preset.id || "")}"
                  data-selected="${preset.id === profile.activePresetId ? "true" : "false"}"
                >
                  <span class="lab-profile-card__title">${escapeHtml(textFromKey(preset.labelKey || ""))}</span>
                  <span class="lab-profile-card__summary">${escapeHtml(textFromKey(preset.summaryKey || ""))}</span>
                  <span class="lab-profile-card__pace">${escapeHtml(textFromKey(preset.paceKey || ""))}</span>
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderProfileAdvancedPanel() {
    const profile = getProjectProfile();
    const modelEntries = getProfileModelEntries();
    const selectedModel = getProfileSelectedModel();
    const laneIds = Object.keys(toRecord(getProfileLaneMap()));
    const sourceKind = getCurrentSourceKind();
    const artifactEntries = getProfileArtifactPreferenceEntries();
    const transcriptConfig = getProfileTranscriptSampleConfig();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "advancedTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "advancedSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-subgrid lab-subgrid--profile-controls">
          <label class="lab-field">
            <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "depthLabel"]))}</span>
            <select class="lab-select" data-profile-field="depth">
              ${Object.keys(toRecord(getProfileCapabilities().depthModes))
                .map(function (depthId) {
                  return `
                    <option value="${escapeHtml(depthId)}" ${depthId === profile.depth ? "selected" : ""}>
                      ${escapeHtml(textFromKey(toRecord(toRecord(getProfileCapabilities().depthModes)[depthId]).labelKey || ""))}
                    </option>
                  `;
                })
                .join("")}
            </select>
          </label>
          <label class="lab-field">
            <span class="lab-field__label">${escapeHtml(
              `${text(["mediaAnalysis", "profile", "sensitivityLabel"])} ${Math.round((Number(profile.sensitivity) || 0.58) * 100)}%`
            )}</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.02"
              value="${escapeHtml(String(Number(profile.sensitivity) || 0.58))}"
              data-profile-field="sensitivity"
            />
          </label>
          <label class="lab-field">
            <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "frameDensityLabel"]))}</span>
            <select class="lab-select" data-profile-field="frameSampleDensity">
              ${getProfileFrameDensityOptions()
                .map(function (entry) {
                  return `
                    <option value="${escapeHtml(entry.densityId)}" ${
                      entry.densityId === profile.frameSampleDensity ? "selected" : ""
                    }>
                      ${escapeHtml(textFromKey(entry.labelKey || "") || entry.densityId)}
                    </option>
                  `;
                })
                .join("")}
            </select>
          </label>
          ${
            sourceKind === "video" || sourceKind === "audio"
              ? `
                <label class="lab-field">
                  <span class="lab-field__label">${escapeHtml(
                    `${text(["mediaAnalysis", "profile", "transcriptSampleLabel"])} ${String(
                      Number(profile.transcriptSampleSeconds) || Number(transcriptConfig.defaultValue) || 45
                    )}s`
                  )}</span>
                  <input
                    type="range"
                    min="${escapeHtml(String(Number(transcriptConfig.min) || 15))}"
                    max="${escapeHtml(String(Number(transcriptConfig.max) || 90))}"
                    step="${escapeHtml(String(Number(transcriptConfig.step) || 15))}"
                    value="${escapeHtml(
                      String(Number(profile.transcriptSampleSeconds) || Number(transcriptConfig.defaultValue) || 45)
                    )}"
                    data-profile-field="transcriptSampleSeconds"
                  />
                </label>
              `
              : ""
          }
        </div>
        ${
          modelEntries.length > 0
            ? `
              <label class="lab-field">
                <span class="lab-field__label">${escapeHtml(text(["mediaAnalysis", "profile", "modelLabel"]))}</span>
                <select class="lab-select" data-profile-field="modelId">
                  <option value="">${escapeHtml(text(["mediaAnalysis", "profile", "modelAuto"]))}</option>
                  ${modelEntries
                    .map(function (entry) {
                      return `
                        <option value="${escapeHtml(entry.modelId || "")}" ${
                          selectedModel && selectedModel.modelId === entry.modelId ? "selected" : ""
                        }>
                          ${escapeHtml(textFromKey(entry.labelKey || "") || entry.modelId || "")}
                        </option>
                      `;
                    })
                    .join("")}
                </select>
              </label>
            `
            : ""
        }
        ${
          artifactEntries.length > 0
            ? `
              <section class="lab-panel lab-panel--dense">
                <div class="lab-panel__header">
                  <div>
                    <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "artifactControlsTitle"]))}</p>
                    <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "artifactControlsSubtitle"]))}</h2>
                  </div>
                </div>
                <div class="lab-toggle-grid">
                  ${artifactEntries
                    .map(function (entry) {
                      return `
                        <button
                          class="lab-toggle"
                          type="button"
                          data-profile-artifact-toggle="${entry.artifactId}"
                          data-active="${entry.enabled ? "true" : "false"}"
                        >
                          <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
                          <span class="lab-toggle__meta">
                            <strong>${escapeHtml(textFromKey(entry.labelKey || "") || entry.artifactId)}</strong>
                          </span>
                        </button>
                      `;
                    })
                    .join("")}
                </div>
              </section>
            `
            : ""
        }
        <div class="lab-toggle-grid">
          ${laneIds
            .map(function (laneId) {
              const laneState = getProfileLaneCardState(laneId);
              const lane = toRecord(laneState.lane);
              return `
                <button
                  class="lab-toggle lab-profile-lane"
                  type="button"
                  data-profile-toggle="${laneId}"
                  data-active="${laneState.enabled ? "true" : "false"}"
                  ${laneState.compatible ? "" : "disabled"}
                >
                  <span class="lab-toggle__track"><span class="lab-toggle__thumb"></span></span>
                  <span class="lab-toggle__meta">
                    <strong>${escapeHtml(textFromKey(lane.labelKey || "") || laneId)}</strong>
                    <span>${escapeHtml(textFromKey(lane.summaryKey || ""))}</span>
                    <em>${escapeHtml(text(["mediaAnalysis", "profile", "laneState", laneState.supportLevel || "ready"]))}</em>
                    <span>${escapeHtml(
                      `${text(["mediaAnalysis", "profile", "laneMeta", "requiredTools"])}: ${
                        laneState.requiredTools.join(", ") || "--"
                      }`
                    )}</span>
                    <span>${escapeHtml(
                      `${text(["mediaAnalysis", "profile", "laneMeta", "mediaKinds"])}: ${
                        laneState.mediaKinds.join(", ") || "--"
                      }`
                    )}</span>
                    ${
                      laneState.optionalTools.length > 0
                        ? `<span>${escapeHtml(
                            `${text(["mediaAnalysis", "profile", "laneMeta", "optionalTools"])}: ${laneState.optionalTools.join(", ")}`
                          )}</span>`
                        : ""
                    }
                    ${
                      laneState.note
                        ? `<span>${escapeHtml(laneState.note)}</span>`
                        : ""
                    }
                  </span>
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderProfileSignalsPanel() {
    const signals = sortProfileSignals(getProfileSignals());
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "signalsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "signalsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-finding-list">
          ${
            signals.length > 0
              ? signals
                  .map(function (signal) {
                    return `
                      <article class="lab-finding">
                        <div class="lab-finding__head">
                          <strong>${escapeHtml(signal.title || signal.laneId || "--")}</strong>
                          <span class="lab-chip">${escapeHtml(text(["mediaAnalysis", "profile", "levels", signal.level || "low"]))}</span>
                        </div>
                        <p class="lab-panel__hint">
                          ${escapeHtml(
                            `${text(["mediaAnalysis", "profile", "signalMeta", "kind"])}: ${getProfileSignalKindLabel(signal.kind)}`
                          )}
                          ·
                          ${escapeHtml(
                            `${text(["mediaAnalysis", "profile", "signalMeta", "confidence"])}: ${getProfileConfidenceLabel(signal.confidence)}`
                          )}
                          ·
                          ${escapeHtml(
                            `${text(["mediaAnalysis", "profile", "signalMeta", "evidence"])}: ${String(
                              Number(signal.evidenceCount) || 0
                            )}`
                          )}
                        </p>
                        <p class="lab-finding__detail">${escapeHtml(signal.detail || "")}</p>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "signalsEmpty"]))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderProfileArtifactsPanel() {
    const artifacts = getProfileArtifacts();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsSubtitle"]))}</h2>
          </div>
        </div>
        <div class="lab-artifact-grid">
          ${
            artifacts.length > 0
              ? artifacts
                  .map(function (artifact) {
                    const previewable =
                      typeof artifact.previewUrl === "string" &&
                      /\.(png|jpe?g|webp|gif)$/i.test(String(artifact.fileName || ""));
                    return `
                      <article class="lab-artifact-card">
                        ${
                          previewable
                            ? `<img class="lab-artifact-card__image" src="${artifact.previewUrl}" alt="" />`
                            : ""
                        }
                        <strong>${escapeHtml(artifact.label || artifact.fileName || artifact.kind || "--")}</strong>
                        <span>${escapeHtml(artifact.fileName || artifact.kind || "--")}</span>
                      </article>
                    `;
                  })
                  .join("")
              : `<p class="lab-panel__hint">${escapeHtml(text(["mediaAnalysis", "profile", "artifactsEmpty"]))}</p>`
          }
        </div>
      </section>
    `;
  }

  function renderProfileActionsPanel() {
    const readiness = getProfileReadiness();
    const preflight = getProfilePreflight();
    const jobs = getProfileJobs();
    const runningJob =
      jobs.find(function (job) {
        return (
          job.action === "profile-run-preflight" &&
          !["completed", "failed", "cancelled"].includes(String(job.stage || ""))
        );
      }) || null;
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "preflightTitle"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(text(["mediaAnalysis", "profile", "preflightSubtitle"]))}</h2>
          </div>
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "shared", "status"]), text(["mediaAnalysis", "profile", "status", preflight.status || "idle"])],
          [text(["mediaAnalysis", "profile", "summary", "signals"]), String(getProfileSignals().length)],
          [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(getProfileArtifacts().length)],
          [text(["mediaAnalysis", "profile", "summary", "runtime"]), formatDuration(getProfileEstimate().runtimeSeconds)],
        ])}
        <div class="lab-action-stack">
          <button
            class="lab-button lab-button--primary"
            type="button"
            data-action="profile-run"
            ${readiness.stageReady !== true || runningJob ? "disabled" : ""}
          >
            ${escapeHtml(text(["mediaAnalysis", "profile", "actions", "run"]))}
          </button>
          <button
            class="lab-button lab-button--ghost"
            type="button"
            data-action="profile-cancel"
            ${runningJob ? "" : "disabled"}
          >
            ${escapeHtml(text(["mediaAnalysis", "profile", "actions", "cancel"]))}
          </button>
        </div>
        ${
          runningJob && typeof runningJob.message === "string" && runningJob.message.trim() !== ""
            ? `<p class="lab-panel__hint">${escapeHtml(runningJob.message)}</p>`
            : ""
        }
      </section>
    `;
  }

  function renderProfileSummaryPanel() {
    const readiness = getProfileReadiness();
    const estimate = getProfileEstimate();
    const selectedModel = getProfileSelectedModel();
    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <p class="lab-panel__eyebrow">${escapeHtml(text(["mediaAnalysis", "profile", "summaryTitle"]))}</p>
        </div>
        ${renderSummaryRows([
          [text(["mediaAnalysis", "profile", "summary", "target"]), getFocusLabel()],
          [text(["mediaAnalysis", "profile", "summary", "preset"]), getProfileLabel()],
          [text(["mediaAnalysis", "profile", "summary", "lanes"]), String(readiness.enabledLaneCount || 0)],
          [text(["mediaAnalysis", "profile", "summary", "runtime"]), formatDuration(estimate.runtimeSeconds)],
          [text(["mediaAnalysis", "profile", "summary", "model"]), selectedModel ? textFromKey(selectedModel.labelKey || "") : "--"],
        ])}
        ${
          Array.isArray(readiness.blockers) && readiness.blockers.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(text(["mediaAnalysis", "profile", "blockersTitle"]))}</strong>
                <ul class="lab-bullet-list">
                  ${readiness.blockers
                    .map(function (entry) {
                      return `<li>${escapeHtml(entry)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
        ${
          Array.isArray(readiness.warnings) && readiness.warnings.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</strong>
                <ul class="lab-bullet-list">
                  ${readiness.warnings
                    .slice(0, 4)
                    .map(function (entry) {
                      return `<li>${escapeHtml(entry)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
      </section>
    `;
  }

  function renderProfileStage() {
    const sourceReady =
      typeof getProjectSource().storedPath === "string" && getProjectSource().storedPath.trim() !== "";
    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("profile")}
          ${renderProfileTargetPanel()}
          ${renderProfileModePanel()}
          ${renderProfilePresetPanel()}
          ${getCurrentProfileMode() === "advanced" ? renderProfileAdvancedPanel() : ""}
          <div class="lab-subgrid lab-subgrid--profile">
            ${renderProfileSignalsPanel()}
            ${renderProfileArtifactsPanel()}
            ${renderProfileActionsPanel()}
          </div>
          ${
            sourceReady !== true
              ? `<div class="lab-notice">${escapeHtml(text(["mediaAnalysis", "profile", "sourceRequired"]))}</div>`
              : ""
          }
        </section>
        <aside class="lab-side-stack">
          ${renderProfileSummaryPanel()}
        </aside>
      </div>
    `;
  }

  function getProcessModulePercent(module) {
    const record = toRecord(module);
    const status = typeof record.status === "string" ? record.status : "idle";
    if (status === "running" || status === "queued" || status === "idle") {
      return Math.max(0, Math.min(100, Math.round(Number(record.percent) || 0)));
    }
    return 100;
  }

  function getProcessModuleTitle(module) {
    const record = toRecord(module);
    return textFromKey(record.labelKey || "") || record.title || record.id || "--";
  }

  function getRunningProcessJob() {
    return (
      getProcessJobs().find(function (job) {
        return !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
      }) || null
    );
  }

  function getRunningReportJob() {
    return (
      getReportJobs().find(function (job) {
        return !["completed", "failed", "cancelled"].includes(String(job.stage || ""));
      }) || null
    );
  }

  function renderProcessStage() {
    const processRecord = getCurrentFeatureProcessRecord();
    const modules = getProcessModules();
    const runningJob = getRunningProcessJob();
    const findings = getProcessFindings();
    const artifacts = getProcessArtifacts();
    const completedModules = modules.filter(function (entry) {
      return !["idle", "queued", "running"].includes(String(toRecord(entry).status || ""));
    }).length;

    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("process")}
          <section class="lab-panel lab-process-panel">
            ${
              modules.length > 0
                ? modules
                    .map(function (moduleEntry, index) {
                      const progress = getProcessModulePercent(moduleEntry);
                      return `
                        <article class="lab-process-row">
                          <div class="lab-process-row__head">
                            <div>
                              <p class="lab-process-row__eyebrow">${String(index + 1)}</p>
                              <h2 class="lab-process-row__title">${escapeHtml(getProcessModuleTitle(moduleEntry))}</h2>
                            </div>
                            <strong>${escapeHtml(formatStatusLabel(moduleEntry.status))} ${String(progress)}%</strong>
                          </div>
                          <div class="lab-progress-bar lab-progress-bar--wide">
                            <span style="width:${progress}%"></span>
                          </div>
                          ${
                            typeof toRecord(moduleEntry).summary === "string" && toRecord(moduleEntry).summary.trim() !== ""
                              ? `<p class="lab-panel__hint">${escapeHtml(toRecord(moduleEntry).summary)}</p>`
                              : ""
                          }
                        </article>
                      `;
                    })
                    .join("")
                : `<p class="lab-panel__hint">${escapeHtml(featureText(["process", "subtitle"]))}</p>`
            }
          </section>
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(featureText(["process", "summaryTitle"]))}</p>
            </div>
            ${renderSummaryRows([
              [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(processRecord.status || "idle")],
              [text(["mediaAnalysis", "profile", "summary", "target"]), getCurrentFeatureTargetLabel()],
              [featureText(["report", "findingsTitle"]), String(findings.length)],
              [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(getCurrentFeatureArtifactCount())],
              [featureText(["settings", "currentStageTitle"]), `${String(completedModules)} / ${String(modules.length || 0)}`],
            ])}
            ${
              Array.isArray(processRecord.warnings) && processRecord.warnings.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(text(["mediaAnalysis", "profile", "warningsTitle"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${processRecord.warnings
                        .slice(0, 4)
                        .map(function (entry) {
                          return `<li>${escapeHtml(entry)}</li>`;
                        })
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="restart-process">
                ${escapeHtml(featureText(["process", "controls", "restart"]))}
              </button>
              <button class="lab-button lab-button--ghost" type="button" data-action="process-cancel" ${
                runningJob ? "" : "disabled"
              }>
                ${escapeHtml(text(["mediaAnalysis", "profile", "actions", "cancel"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="open-report" ${
                ["ready", "stale"].includes(String(getCurrentFeatureReportRecord().status || "")) ? "" : "disabled"
              }>
                ${escapeHtml(featureText(["process", "controls", "jumpReport"]))}
              </button>
            </div>
            ${
              runningJob && typeof runningJob.message === "string" && runningJob.message.trim() !== ""
                ? `<p class="lab-panel__hint">${escapeHtml(runningJob.message)}</p>`
                : ""
            }
          </section>
        </aside>
      </div>
    `;
  }

  function renderSignalCard(value, label) {
    return `
      <article class="lab-signal-card">
        <strong class="lab-signal-card__value">${escapeHtml(value)}</strong>
        <span class="lab-signal-card__label">${escapeHtml(label)}</span>
      </article>
    `;
  }

  function renderReportFinding(signal) {
    const record = toRecord(signal);
    if (isSubtitleAnalysisFeature()) {
      return `
        <article class="lab-finding">
          <h3 class="lab-finding__title">${escapeHtml(record.title || record.moduleId || "--")}</h3>
          <p class="lab-panel__hint">
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "module"])}: ${getSubtitleProcessModuleLabel({
                id: record.moduleId || record.laneId,
              })}`
            )}
            ·
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "severity"])}: ${formatStatusLabel(record.level || "low")}`
            )}
            ·
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "confidence"])}: ${formatStatusLabel(
                record.confidence || "low"
              )}`
            )}
            ·
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "evidence"])}: ${String(
                Number(record.evidenceCount) || 0
              )}`
            )}
            ·
            ${escapeHtml(
              `${featureText(["report", "findingMeta", "artifacts"])}: ${String(
                Array.isArray(record.artifactIds) ? record.artifactIds.length : 0
              )}`
            )}
          </p>
          <p class="lab-finding__detail">${escapeHtml(record.detail || "")}</p>
        </article>
      `;
    }

    return `
      <article class="lab-finding">
        <h3 class="lab-finding__title">${escapeHtml(record.title || record.laneId || "--")}</h3>
        <p class="lab-panel__hint">
          ${escapeHtml(
            `${text(["mediaAnalysis", "profile", "signalMeta", "kind"])}: ${getProfileSignalKindLabel(record.kind)}`
          )}
          ·
          ${escapeHtml(
            `${text(["mediaAnalysis", "profile", "signalMeta", "confidence"])}: ${getProfileConfidenceLabel(
              record.confidence
            )}`
          )}
          ·
          ${escapeHtml(
            `${text(["mediaAnalysis", "profile", "signalMeta", "evidence"])}: ${String(
              Number(record.evidenceCount) || 0
            )}`
          )}
        </p>
        <p class="lab-finding__detail">${escapeHtml(record.detail || "")}</p>
      </article>
    `;
  }

  function getSubtitleReportModuleFindingCount(moduleId) {
    return getReportFindings().filter(function (entry) {
      return toRecord(entry).moduleId === moduleId;
    }).length;
  }

  function getSubtitleReportModuleArtifactCount(moduleId) {
    return getProcessArtifacts().filter(function (entry) {
      return toRecord(entry).moduleId === moduleId;
    }).length;
  }

  function renderSubtitleReportModuleGrid() {
    const modules = getProcessModules();
    if (modules.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "moduleRollupEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "moduleRollupTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "moduleRollupSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${modules
            .map(function (moduleEntry) {
              const moduleId = String(moduleEntry.id || "");
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(getSubtitleProcessModuleLabel({ id: moduleId }))}</strong>
                      <span>${escapeHtml(formatStatusLabel(moduleEntry.status || "idle"))}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(formatStatusLabel(moduleEntry.status || "idle"))}</span>
                  </div>
                  <p class="lab-panel__hint">${escapeHtml(
                    moduleEntry.summary ||
                      getSubtitleProcessModuleSummary({ id: moduleId }) ||
                      featureText(["report", "emptyBody"])
                  )}</p>
                  <ul class="lab-meta-list">
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "status"]))}</span>
                      <strong>${escapeHtml(formatStatusLabel(moduleEntry.status || "idle"))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "findings"]))}</span>
                      <strong>${escapeHtml(String(getSubtitleReportModuleFindingCount(moduleId)))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "moduleMeta", "artifacts"]))}</span>
                      <strong>${escapeHtml(String(getSubtitleReportModuleArtifactCount(moduleId)))}</strong>
                    </li>
                  </ul>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSubtitleReportExportHistoryPanel() {
    const exportsList = getReportExports();
    if (exportsList.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "exportHistoryEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "exportHistoryTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "exportHistorySubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${exportsList
            .map(function (entry) {
              return `
                <article class="lab-tool-card">
                  <div class="lab-tool-card__head">
                    <div>
                      <strong>${escapeHtml(entry.fileName || entry.path || "--")}</strong>
                      <span>${escapeHtml(String(entry.format || "md").toUpperCase())}</span>
                    </div>
                    <span class="lab-chip">${escapeHtml(formatStatusLabel(entry.status || "ready"))}</span>
                  </div>
                  <ul class="lab-meta-list">
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "format"]))}</span>
                      <strong>${escapeHtml(String(entry.format || "md").toUpperCase())}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "created"]))}</span>
                      <strong>${escapeHtml(formatDateTime(entry.createdAt))}</strong>
                    </li>
                    <li>
                      <span>${escapeHtml(featureText(["report", "exportMeta", "status"]))}</span>
                      <strong>${escapeHtml(formatStatusLabel(entry.status || "ready"))}</strong>
                    </li>
                  </ul>
                </article>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function getAudioAnalysisProviderLabel(providerId) {
    const descriptor =
      getAudioAnalysisProviderEntries().find(function (entry) {
        return entry.id === providerId;
      }) || null;
    const providerState = toRecord(getAudioAnalysisProviderState()[providerId]);
    const title = textFromKey((descriptor && descriptor.titleKey) || "") || providerId || "--";
    const suffix =
      typeof providerState.status === "string" && providerState.status.trim() !== ""
        ? ` (${formatStatusLabel(providerState.status)})`
        : "";
    return `${title}${suffix}`;
  }

  function getAudioAnalysisModuleTitle(moduleEntry) {
    return textFromKey(moduleEntry.titleKey || "") || moduleEntry.moduleId || "--";
  }

  function getAudioAnalysisModuleSummary(moduleEntry) {
    if (typeof moduleEntry.summary === "string" && moduleEntry.summary.trim() !== "") {
      return moduleEntry.summary;
    }
    return textFromKey(moduleEntry.summaryKey || "") || featureText(["report", "emptyBody"]);
  }

  function renderAudioAnalysisResultCard(moduleEntry) {
    const metrics = Array.isArray(moduleEntry.metrics) ? moduleEntry.metrics.map(toRecord) : [];
    const providerLabels = Array.isArray(moduleEntry.providerIds)
      ? moduleEntry.providerIds
          .map(function (providerId) {
            return getAudioAnalysisProviderLabel(providerId);
          })
          .filter(Boolean)
      : [];

    return `
      <article class="lab-tool-card">
        <div class="lab-tool-card__head">
          <div>
            <strong>${escapeHtml(getAudioAnalysisModuleTitle(moduleEntry))}</strong>
            <span>${escapeHtml(formatStatusLabel(moduleEntry.status || "planned"))}</span>
          </div>
          <span class="lab-chip">${escapeHtml(String(moduleEntry.phase || "v1").toUpperCase())}</span>
        </div>
        <p class="lab-panel__hint">${escapeHtml(getAudioAnalysisModuleSummary(moduleEntry))}</p>
        <ul class="lab-meta-list">
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "phase"]))}</span>
            <strong>${escapeHtml(String(moduleEntry.phase || "v1").toUpperCase())}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "confidence"]))}</span>
            <strong>${escapeHtml(moduleEntry.confidence ? formatStatusLabel(moduleEntry.confidence) : "--")}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "providers"]))}</span>
            <strong>${escapeHtml(providerLabels.length > 0 ? providerLabels.join(", ") : "--")}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "signals"]))}</span>
            <strong>${escapeHtml(String(moduleEntry.signals.length))}</strong>
          </li>
          <li>
            <span>${escapeHtml(featureText(["report", "moduleMeta", "artifacts"]))}</span>
            <strong>${escapeHtml(String(moduleEntry.artifacts.length))}</strong>
          </li>
        </ul>
        ${
          metrics.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "metrics"]))}</strong>
                <ul class="lab-bullet-list">
                  ${metrics
                    .slice(0, 4)
                    .map(function (metric) {
                      return `<li>${escapeHtml(
                        `${metric.label || textFromKey(metric.labelKey || "") || metric.id || "--"}: ${
                          metric.value || "--"
                        }`
                      )}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
        ${
          Array.isArray(moduleEntry.blockers) && moduleEntry.blockers.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "blockers"]))}</strong>
                <ul class="lab-bullet-list">
                  ${moduleEntry.blockers
                    .slice(0, 3)
                    .map(function (entry) {
                      return `<li>${escapeHtml(entry)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
        ${
          Array.isArray(moduleEntry.warnings) && moduleEntry.warnings.length > 0
            ? `
              <div class="lab-list-block">
                <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                <ul class="lab-bullet-list">
                  ${moduleEntry.warnings
                    .slice(0, 3)
                    .map(function (entry) {
                      return `<li>${escapeHtml(entry)}</li>`;
                    })
                    .join("")}
                </ul>
              </div>
            `
            : ""
        }
      </article>
    `;
  }

  function renderAudioAnalysisModuleGrid() {
    const moduleEntries = getAudioAnalysisOrderedResultEntries();
    if (moduleEntries.length === 0) {
      return "";
    }

    return `
      <section class="lab-panel">
        <div class="lab-panel__header">
          <div>
            <p class="lab-panel__eyebrow">${escapeHtml(featureText(["report", "moduleRollupEyebrow"]))}</p>
            <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "moduleRollupTitle"]))}</h2>
            <p class="lab-panel__subtitle">${escapeHtml(featureText(["report", "moduleRollupSubtitle"]))}</p>
          </div>
        </div>
        <div class="lab-tool-grid">
          ${moduleEntries
            .map(function (moduleEntry) {
              return renderAudioAnalysisResultCard(moduleEntry);
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function getReportSignalCardLabel(card) {
    return textFromKey(toRecord(card).labelKey || "") || toRecord(card).label || "--";
  }

  function getReportOverviewRows(reportRecord, findings, asset) {
    if (isSubtitleAnalysisFeature()) {
      return [
        [featureText(["report", "overviewMeta", "target"]), getCurrentFeatureTargetLabel()],
        [featureText(["report", "overviewMeta", "status"]), formatStatusLabel(reportRecord.status || "idle")],
        [featureText(["report", "overviewMeta", "findings"]), String(findings.length)],
        [featureText(["report", "overviewMeta", "artifacts"]), String(getCurrentFeatureArtifactCount())],
        [featureText(["report", "overviewMeta", "generated"]), formatDateTime(reportRecord.generatedAt)],
      ];
    }

    return [
      [text(["mediaAnalysis", "shared", "summary"]), asset.label || getCurrentSourceLabel()],
      [text(["mediaAnalysis", "shared", "duration"]), formatDuration(getPreferredAssetDuration(asset))],
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(reportRecord.status || "idle")],
      [featureText(["report", "findingsTitle"]), String(findings.length)],
      [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(getCurrentFeatureArtifactCount())],
    ];
  }

  function getReportSideRows(reportRecord, findings, exportsList) {
    if (isSubtitleAnalysisFeature()) {
      return [
        [featureText(["report", "overviewMeta", "status"]), formatStatusLabel(reportRecord.status || "idle")],
        [featureText(["report", "overviewMeta", "target"]), getCurrentFeatureTargetLabel()],
        [featureText(["report", "overviewMeta", "findings"]), String(findings.length)],
        [featureText(["report", "overviewMeta", "exports"]), String(exportsList.length)],
        [featureText(["report", "overviewMeta", "generated"]), formatDateTime(reportRecord.generatedAt)],
      ];
    }

    return [
      [text(["mediaAnalysis", "shared", "status"]), formatStatusLabel(reportRecord.status || "idle")],
      [text(["mediaAnalysis", "profile", "summary", "target"]), getCurrentFeatureTargetLabel()],
      [featureText(["report", "findingsTitle"]), String(findings.length)],
      [text(["mediaAnalysis", "profile", "summary", "artifacts"]), String(getCurrentFeatureArtifactCount())],
      [featureText(["report", "actions", "export"]), String(exportsList.length)],
    ];
  }

  function renderReportStage() {
    const reportRecord = getCurrentFeatureReportRecord();
    const asset = getEffectiveMediaAsset();
    const findings = getReportFindings();
    const summaryCards = getReportSummaryCards();
    const exportsList = getReportExports();
    const runningJob = getRunningReportJob();
    const previewUrl =
      typeof asset.previewUrl === "string" && asset.previewUrl.trim() !== "" ? asset.previewUrl : PREVIEW_IMAGE;

    return `
      <div class="lab-layout">
        <section class="lab-main-stack">
          ${renderStageIntro("report")}
          <section class="lab-panel lab-report-hero">
            <div class="lab-report-hero__media">
              <img class="lab-report-hero__image" src="${previewUrl}" alt="" />
            </div>
            <div class="lab-report-hero__copy">
              <div class="lab-panel__header">
                <h2 class="lab-panel__title">${escapeHtml(featureText(["report", "overviewTitle"]))}</h2>
              </div>
              ${renderSummaryRows(getReportOverviewRows(reportRecord, findings, asset))}
              <p class="lab-panel__hint">${escapeHtml(featureText(["report", "stagedHint"]))}</p>
            </div>
          </section>
          <section class="lab-signal-grid">
            ${
              summaryCards.length > 0
                ? summaryCards
                    .map(function (card) {
                      return renderSignalCard(card.value || "--", getReportSignalCardLabel(card));
                    })
                    .join("")
                : `<p class="lab-panel__hint">${escapeHtml(featureText(["report", "emptyFindings"]))}</p>`
            }
          </section>
          ${isAudioAnalysisFeature() ? renderAudioAnalysisModuleGrid() : ""}
          ${isSubtitleAnalysisFeature() ? renderSubtitleReportModuleGrid() : ""}
          <section class="lab-panel">
            <div class="lab-panel__header">
              <p class="lab-panel__eyebrow">${escapeHtml(
                featureText(["report", "findingsTitle"])
              )}</p>
            </div>
            <div class="lab-findings">
              ${
                findings.length > 0
                  ? findings
                      .map(function (finding) {
                        return renderReportFinding(finding);
                      })
                      .join("")
                  : `<p class="lab-panel__hint">${escapeHtml(featureText(["report", "emptyBody"]))}</p>`
              }
            </div>
          </section>
          ${isSubtitleAnalysisFeature() ? renderSubtitleReportExportHistoryPanel() : ""}
        </section>
        <aside class="lab-side-stack">
          <section class="lab-panel">
            ${renderSummaryRows(getReportSideRows(reportRecord, findings, exportsList))}
            ${
              Array.isArray(reportRecord.caveats) && reportRecord.caveats.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "sideTitle"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${reportRecord.caveats
                        .slice(0, 4)
                        .map(function (entry) {
                          return `<li>${escapeHtml(entry)}</li>`;
                        })
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
            ${
              Array.isArray(reportRecord.warnings) && reportRecord.warnings.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "moduleMeta", "warnings"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${reportRecord.warnings
                        .slice(0, 4)
                        .map(function (entry) {
                          return `<li>${escapeHtml(entry)}</li>`;
                        })
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
            ${
              exportsList.length > 0
                ? `
                  <div class="lab-list-block">
                    <strong>${escapeHtml(featureText(["report", "actions", "export"]))}</strong>
                    <ul class="lab-bullet-list">
                      ${exportsList
                        .slice(0, 4)
                        .map(function (entry) {
                          return `<li>${escapeHtml(entry.fileName || entry.path || "--")}</li>`;
                        })
                        .join("")}
                    </ul>
                  </div>
                `
                : ""
            }
            <div class="lab-action-stack">
              <button class="lab-button lab-button--ghost" type="button" data-action="reset-journey">
                ${escapeHtml(featureText(["report", "actions", "restart"]))}
              </button>
              <button class="lab-button lab-button--primary" type="button" data-action="export-report" ${
                reportRecord.status === "ready" && !runningJob ? "" : "disabled"
              }>
                ${escapeHtml(featureText(["report", "actions", "export"]))}
              </button>
            </div>
            ${
              runningJob && typeof runningJob.message === "string" && runningJob.message.trim() !== ""
                ? `<p class="lab-panel__hint">${escapeHtml(runningJob.message)}</p>`
                : ""
            }
          </section>
        </aside>
      </div>
    `;
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

    bindPreviewMetrics();
    bindAudioAnalysis();
  }

  function bindPreviewMetrics() {
    const media = document.querySelector("[data-preview-media]");
    if (!(media instanceof HTMLVideoElement || media instanceof HTMLAudioElement || media instanceof HTMLImageElement)) {
      state.ui.previewMetrics = {
        url: null,
        duration: null,
        width: null,
        height: null,
      };
      return;
    }

    const nextUrl =
      media instanceof HTMLImageElement
        ? media.currentSrc || media.src
        : media.currentSrc || media.src;

    if (state.ui.previewMetrics.url === nextUrl) {
      return;
    }

    state.ui.previewMetrics = {
      url: nextUrl,
      duration: null,
      width: null,
      height: null,
    };

    if (media instanceof HTMLImageElement) {
      const applyImageMetrics = function () {
        state.ui.previewMetrics.duration = null;
        state.ui.previewMetrics.width = media.naturalWidth || null;
        state.ui.previewMetrics.height = media.naturalHeight || null;
        render();
      };

      if (media.complete) {
        applyImageMetrics();
      } else {
        media.addEventListener("load", applyImageMetrics, { once: true });
      }
      return;
    }

    const applyMediaMetrics = function () {
      state.ui.previewMetrics.duration =
        typeof media.duration === "number" && Number.isFinite(media.duration) ? media.duration : null;
      state.ui.previewMetrics.width =
        media instanceof HTMLVideoElement && media.videoWidth > 0 ? media.videoWidth : null;
      state.ui.previewMetrics.height =
        media instanceof HTMLVideoElement && media.videoHeight > 0 ? media.videoHeight : null;
      render();
    };

    if (media.readyState >= 1) {
      applyMediaMetrics();
    } else {
      media.addEventListener("loadedmetadata", applyMediaMetrics, { once: true });
    }
  }

  async function decodeAudioBars(url) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (typeof window.fetch !== "function" || typeof AudioContextCtor !== "function") {
      return [];
    }

    const response = await window.fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContextCtor();

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const samples = audioBuffer.getChannelData(0);
      const bucketCount = 42;
      const bucketSize = Math.max(1, Math.floor(samples.length / bucketCount));
      const bars = [];

      for (let index = 0; index < bucketCount; index += 1) {
        const start = index * bucketSize;
        const end = Math.min(samples.length, start + bucketSize);
        let sum = 0;
        for (let cursor = start; cursor < end; cursor += 1) {
          sum += Math.abs(samples[cursor] || 0);
        }
        const average = end > start ? sum / (end - start) : 0;
        bars.push(Math.max(10, Math.min(84, Math.round(average * 240))));
      }

      return bars;
    } finally {
      await audioContext.close();
    }
  }

  function bindAudioAnalysis() {
    const media = document.querySelector('[data-preview-media="audio"]');
    if (!(media instanceof HTMLAudioElement)) {
      state.ui.audioAnalysis = {
        url: null,
        bars: [],
      };
      return;
    }

    const nextUrl = media.currentSrc || media.src;
    if (typeof nextUrl !== "string" || nextUrl.trim() === "") {
      return;
    }

    if (state.ui.audioAnalysis.url === nextUrl && state.ui.audioAnalysis.bars.length > 0) {
      return;
    }

    state.ui.audioAnalysis = {
      url: nextUrl,
      bars: [],
    };

    void decodeAudioBars(nextUrl)
      .then(function (bars) {
        if (state.ui.audioAnalysis.url !== nextUrl) {
          return;
        }
        state.ui.audioAnalysis = {
          url: nextUrl,
          bars: Array.isArray(bars) ? bars : [],
        };
        render();
      })
      .catch(function () {
        if (state.ui.audioAnalysis.url !== nextUrl) {
          return;
        }
        state.ui.audioAnalysis = {
          url: nextUrl,
          bars: [],
        };
        render();
      });
  }

  function handleHostMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return;
    }

    const payload =
      message.payload && typeof message.payload === "object" && Array.isArray(message.payload) === false
        ? message.payload
        : message;

    if (message.type === "host-context") {
      const presentation = toRecord(payload.presentation);
      applyPresentationMode(presentation.mode);
      if (typeof payload.locale === "string") {
        applyLocale(payload.locale);
      }
      if (
        payload.translations &&
        typeof payload.translations === "object" &&
        Array.isArray(payload.translations) === false
      ) {
        state.translations = payload.translations;
      }
      state.context = normalizeContext(payload);
      render();
      return;
    }

    if (message.type === "media-state" || message.type === "source-state") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      const snapshot =
        payload.snapshot && typeof payload.snapshot === "object" && Array.isArray(payload.snapshot) === false
          ? payload.snapshot
          : {};
      state.sourceSnapshot = snapshot;
      render();
      return;
    }

    if (message.type === "media-action-result" || message.type === "source-action-result") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      if (payload.success === true) {
        setLastAction(text(["mediaAnalysis", "messages", payload.action]) || payload.action || "");
      } else if (typeof payload.error === "string" && payload.error.trim() !== "") {
        setLastAction(payload.error);
      }
      render();
      return;
    }

    if (message.type === "media-job" || message.type === "source-job") {
      if (shouldIgnoreCorrelatedPayload(payload.requestId, payload.action)) {
        return;
      }
      if (typeof payload.message === "string" && payload.message.trim() !== "") {
        setLastAction(payload.message);
      }
      render();
    }
  }

  function handleAction(action, value) {
    switch (action) {
      case "nav-previous":
        advanceStage(-1);
        return;
      case "nav-next":
        advanceStage(1);
        return;
      case "open-settings":
        openSettingsOverlay();
        return;
      case "close-settings":
        closeSettingsOverlay();
        return;
      case "tools-refresh":
        sendSourceAction("tools-refresh");
        return;
      case "project-create":
        state.ui.pendingDeleteProjectId = null;
        sendSourceAction("project-create");
        return;
      case "project-delete-arm":
        state.ui.pendingDeleteProjectId = getSourceSnapshot().activeProjectId;
        render();
        return;
      case "project-delete-confirm":
        sendSourceAction("project-delete", {
          projectId: state.ui.pendingDeleteProjectId,
        });
        state.ui.pendingDeleteProjectId = null;
        render();
        return;
      case "project-delete-cancel":
        state.ui.pendingDeleteProjectId = null;
        render();
        return;
      case "source-kind":
        sendSourceAction("source-set-kind", { kind: value });
        return;
      case "source-mode":
        sendSourceAction("source-set-mode", { mode: value });
        return;
      case "subtitle-source-mode":
        sendSourceAction("subtitle-source-set-mode", { mode: value });
        return;
      case "subtitle-source-select-entry":
        sendSourceAction("subtitle-source-select-entry", { entryId: value });
        return;
      case "subtitle-source-toggle-selection":
        sendSourceAction("subtitle-source-toggle-selection", { entryId: value });
        return;
      case "youtube-preset":
        syncDraftField("youtubePreset", value);
        persistDrafts({ youtubePreset: value });
        return;
      case "source-pick-local":
        sendSourceAction("source-pick-local");
        return;
      case "subtitle-source-pick-local":
        sendSourceAction("subtitle-source-pick-local", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-pick-folder":
        sendSourceAction("subtitle-source-pick-folder", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "source-download-url":
        sendSourceAction("source-download-url", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-download-url":
        sendSourceAction("subtitle-source-download-url", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-discover-youtube":
        sendSourceAction("subtitle-source-discover-youtube", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "source-download-youtube":
        sendSourceAction("source-download-youtube", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-download-youtube":
        sendSourceAction("subtitle-source-download-youtube", {
          fields: buildCurrentDraftPayload(),
        });
        return;
      case "subtitle-source-toggle-discovery":
        sendSourceAction("subtitle-source-toggle-discovery", { candidateId: value });
        return;
      case "subtitle-source-select-all-discovery":
        sendSourceAction("subtitle-source-select-all-discovery");
        return;
      case "subtitle-source-clear-discovery-selection":
        sendSourceAction("subtitle-source-clear-discovery-selection");
        return;
      case "subtitle-edit-preset":
        sendMediaAction("subtitle-edit-apply-preset", {
          presetId: value,
          featureStage: "edit",
        });
        return;
      case "subtitle-edit-preview":
        sendMediaAction("subtitle-edit-preview", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit",
        });
        return;
      case "subtitle-edit-apply":
        sendMediaAction("subtitle-edit-apply", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit",
        });
        return;
      case "edit-mode":
        sendMediaAction("edit-set-mode", {
          mode: value,
          featureStage: "edit",
        });
        return;
      case "edit-preset":
        sendMediaAction("edit-apply-preset", {
          presetId: value,
          featureStage: "edit",
        });
        return;
      case "edit-focus-region":
        syncLocalEditField("recipe.common.focusRegionId", value);
        commitEditPatch(buildNestedPatch("common.focusRegionId", value));
        render();
        return;
      case "edit-preview":
        sendMediaAction("edit-preview", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit",
        });
        return;
      case "edit-apply":
        sendMediaAction("edit-apply", {
          patch: buildCurrentEditRecipePatch(),
          featureStage: "edit",
        });
        return;
      case "edit-cancel-preview":
        sendMediaAction("edit-cancel-preview", {
          featureStage: "edit",
        });
        return;
      case "edit-cancel-apply":
        sendMediaAction("edit-cancel-apply", {
          featureStage: "edit",
        });
        return;
      case "edit-select-output":
        sendMediaAction("edit-set-output", {
          outputId: value,
          featureStage: "edit",
        });
        return;
      case "edit-handoff":
        sendMediaAction("edit-set-handoff", {
          mode: value,
          featureStage: "edit",
        });
        return;
      case "profile-mode":
        sendMediaAction("profile-set-mode", {
          mode: value,
          featureStage: "profile",
        });
        return;
      case "profile-preset":
        sendMediaAction("profile-apply-preset", {
          presetId: value,
          featureStage: "profile",
        });
        return;
      case "profile-target-mode":
        sendMediaAction("profile-set-target", {
          mode: value,
          outputId:
            value === "derived"
              ? getProfileTargetSummary().outputId || (getActiveEditOutput() && getActiveEditOutput().id) || null
              : null,
          featureStage: "profile",
        });
        return;
      case "profile-run":
        sendMediaAction("profile-run-preflight", {
          featureStage: "profile",
        });
        return;
      case "profile-cancel":
        sendMediaAction("profile-cancel-preflight", {
          featureStage: "profile",
        });
        return;
      case "profile-model-install":
        sendMediaAction("profile-model-install", {
          modelId: value,
          featureStage: "profile",
        });
        return;
      case "profile-model-remove":
        sendMediaAction("profile-model-remove", {
          modelId: value,
          featureStage: "profile",
        });
        return;
      case "tool-install":
        sendMediaAction("tool-install", { toolId: value, featureStage: state.activeStage });
        return;
      case "tool-update":
        sendMediaAction("tool-update", { toolId: value, featureStage: state.activeStage });
        return;
      case "restart-process":
        restartProcess();
        return;
      case "process-cancel":
        sendMediaAction(isAudioAnalysisFeature() ? "audio-process-cancel" : "process-cancel", {
          featureStage: "process",
        });
        return;
      case "open-report":
        openReport();
        return;
      case "reset-journey":
        resetJourney();
        return;
      case "export-report":
        sendMediaAction(isAudioAnalysisFeature() ? "audio-report-export" : "report-export", {
          featureStage: "report",
        });
        return;
      default:
        break;
    }
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionButton = target.closest("[data-action]");
    if (actionButton instanceof HTMLElement) {
      handleAction(actionButton.dataset["action"] || "", actionButton.dataset["value"] || "");
      return;
    }

    const stageButton = target.closest("[data-stage-target]");
    if (stageButton instanceof HTMLElement) {
      setStage(stageButton.dataset["stageTarget"] || "");
      return;
    }

    const toggleButton = target.closest("[data-toggle]");
    if (toggleButton instanceof HTMLElement) {
      const toggleId = toggleButton.dataset["toggle"] || "";
      if (toggleId.startsWith("cleanup-")) {
        toggleCleanup(toggleId.replace("cleanup-", ""));
        return;
      }
    }

    const editToggle = target.closest("[data-edit-toggle]");
    if (editToggle instanceof HTMLElement) {
      const fieldId = editToggle.dataset["editToggle"] || "";
      const path = fieldId.replace(/^recipe\./, "");
      const currentValue = fieldId
        .split(".")
        .reduce(function (accumulator, key) {
          return accumulator && typeof accumulator === "object" ? accumulator[key] : undefined;
        }, getCurrentEditDraft()) === true;
      syncLocalEditField(fieldId, currentValue !== true);
      commitEditPatch(buildNestedPatch(path, currentValue !== true));
      render();
      return;
    }

    const profileToggle = target.closest("[data-profile-toggle]");
    if (profileToggle instanceof HTMLElement) {
      const laneId = profileToggle.dataset["profileToggle"] || "";
      const currentValue = toRecord(getProjectProfile().laneSelection)[laneId] === true;
      sendMediaAction("profile-update", {
        patch: {
          laneSelection: {
            [laneId]: currentValue !== true,
          },
        },
        featureStage: "profile",
      });
      return;
    }

    const profileArtifactToggle = target.closest("[data-profile-artifact-toggle]");
    if (profileArtifactToggle instanceof HTMLElement) {
      const artifactId = profileArtifactToggle.dataset["profileArtifactToggle"] || "";
      const currentValue = toRecord(getProjectProfile().artifactPreferences)[artifactId] === true;
      sendMediaAction("profile-update", {
        patch: {
          artifactPreferences: {
            [artifactId]: currentValue !== true,
          },
        },
        featureStage: "profile",
      });
      return;
    }

    const draftToggle = target.closest("[data-toggle-field]");
    if (draftToggle instanceof HTMLElement) {
      const fieldId = draftToggle.dataset["toggleField"] || "";
      const currentValue = toRecord(state.ui.localDrafts.youtubeCustom)[fieldId.replace("youtubeCustom.", "")] === true;
      syncDraftField(fieldId, currentValue !== true);
      persistDrafts({
        youtubeCustom: {
          ...toRecord(state.ui.localDrafts.youtubeCustom),
        },
      });
      render();
    }
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.dataset["draftField"]) {
      syncDraftField(target.dataset["draftField"], target.type === "number" ? Number(target.value) : target.value);
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset["draftField"]) {
      syncDraftField(target.dataset["draftField"], target.value);
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["editField"]
    ) {
      const fieldId = target.dataset["editField"];
      const nextValue = readFormValue(target);
      syncLocalEditField(fieldId, nextValue);
      render();
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      ["sensitivity", "transcriptSampleSeconds"].includes(target.dataset["profileField"] || "")
    ) {
      render();
    }
  });

  document.addEventListener("change", function (event) {
    const target = event.target;

    if (target instanceof HTMLSelectElement && target.dataset["select"] === "project") {
      sendSourceAction("project-select", { projectId: target.value });
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["draftField"]
    ) {
      persistDrafts();
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["editField"]
    ) {
      const fieldId = target.dataset["editField"] || "";
      const path = fieldId.replace(/^recipe\./, "");
      const nextValue = readFormValue(target);
      syncLocalEditField(fieldId, nextValue);
      commitEditPatch(buildNestedPatch(path, nextValue));
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset["profileField"]
    ) {
      const fieldId = target.dataset["profileField"] || "";
      const nextValue = readFormValue(target);
      if (fieldId === "targetOutputId") {
        sendMediaAction("profile-set-target", {
          mode: "derived",
          outputId: typeof nextValue === "string" && nextValue.trim() !== "" ? nextValue : null,
          featureStage: "profile",
        });
        return;
      }
      if (fieldId === "modelId") {
        sendMediaAction("profile-set-model", {
          modelId: typeof nextValue === "string" && nextValue.trim() !== "" ? nextValue : null,
          featureStage: "profile",
        });
        return;
      }
      sendMediaAction("profile-update", {
        patch: {
          [fieldId]: nextValue,
        },
        featureStage: "profile",
      });
    }
  });

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
