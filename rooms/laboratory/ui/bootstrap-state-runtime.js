export function createLaboratoryUiBootstrapStateRuntime(deps) {
  const roomId = deps.roomId;
  const featureId = deps.featureId;
  const stageOrder = deps.stageOrder;
  const documentRef = deps.documentRef;
  const navigatorRef = deps.navigatorRef;
  const resolveLocale = deps.resolveLocale;

  function createContext() {
    return {
      room: {
        id: roomId,
        name: "Laboratory",
      },
      featureId: featureId,
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
      stages: stageOrder.slice(),
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

  const state = {
    locale: resolveLocale(documentRef.documentElement.lang || navigatorRef.language),
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

  return {
    state: state,
  };
}
