export function createLaboratoryUiBootstrapStateRuntime(deps: any) {
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
        uiScale: 100,
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
      toolRegistry: [] as unknown[],
      projects: [] as unknown[],
      activeProjectId: null as string | null,
      activeProject: null as unknown,
      toolState: {
        tools: {},
      },
      jobs: [] as unknown[],
    };
  }

  function createLocalDrafts() {
    return {
      urlInput: "",
      youtubeUrl: "",
      fileNameHint: "",
      youtubePreset: null as unknown,
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
      durationMinSeconds: null as number | null,
      durationMaxSeconds: null as number | null,
      shortsMode: "all",
      liveMode: "all",
      titleInclude: "",
      titleExclude: "",
      playlistItems: "",
      limitCount: null as number | null,
    };
  }

  const state = {
    locale: resolveLocale(documentRef.documentElement.lang || navigatorRef.language),
    translations: null as unknown,
    context: createContext(),
    presentation: {
      mode: "classic",
      uiScale: 100,
    },
    activeStage: "source",
    sourceSnapshot: createSourceSnapshot(),
    ui: {
      settingsOpen: false,
      pendingDeleteProjectId: null as string | null,
      lastRequestId: null as string | null,
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
      localDraftProjectId: null as string | null,
      localDrafts: createLocalDrafts(),
      localSubtitleDraftProjectId: null as string | null,
      localSubtitleDrafts: createSubtitleLocalDrafts(),
      localEditProjectId: null as string | null,
      localEditUpdatedAt: null as string | null,
      localEditDraft: null as unknown,
      localSubtitleEditProjectId: null as string | null,
      localSubtitleEditUpdatedAt: null as string | null,
      localSubtitleEditDraft: null as unknown,
      previewMetrics: {
        url: null as string | null,
        duration: null as number | null,
        width: null as number | null,
        height: null as number | null,
      },
      audioAnalysis: {
        url: null as string | null,
        bars: [] as number[],
      },
      scrollPositions: {
        surface: 0,
        overlay: 0,
      },
      stackScrollPositions: {
        main: 0,
        side: 0,
      },
      surfaceScrollResetPending: false,
      overlayScrollResetPending: false,
    },
  };

  return {
    state: state,
  };
}
