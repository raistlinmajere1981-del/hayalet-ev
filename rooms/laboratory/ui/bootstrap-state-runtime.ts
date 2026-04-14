import { createLaboratoryWorkbenchState } from "../shared/host/runtime-primitives.js";
import type {
  LaboratoryShellEventLogItem,
  LaboratoryShellStatusChannel,
} from "../shared/types/room-shell-contracts.js";

type LaboratoryRecord = Record<string, unknown>;

type LaboratoryUiRequestDomain =
  | "project"
  | "source-config"
  | "source-acquire"
  | "edit-config"
  | "edit-preview"
  | "edit-apply"
  | "edit-preview-cancel"
  | "edit-apply-cancel"
  | "profile-config"
  | "profile-run"
  | "profile-cancel"
  | "profile-model"
  | "process-run"
  | "process-cancel"
  | "report-export"
  | "tools"
  | "misc";

type LaboratoryUiBootstrapContext = {
  featureId: string;
  presentation: {
    mode: "classic";
    uiScale: number;
  };
  room: {
    id: string;
    name: string;
  };
  user: {
    nickname: string;
  };
  workbench: ReturnType<typeof createLaboratoryWorkbenchState>;
};

type LaboratorySourceSnapshot = {
  activeProject: unknown;
  activeProjectId: string | null;
  audioAnalysisCapabilities: LaboratoryRecord;
  audioAnalysisCatalog: LaboratoryRecord;
  audioAnalysisPresets: LaboratoryRecord;
  audioAnalysisProviders: LaboratoryRecord;
  editCapabilities: LaboratoryRecord;
  editPresets: LaboratoryRecord;
  jobs: unknown[];
  profileCapabilities: LaboratoryRecord;
  profileModelState: {
    models: LaboratoryRecord;
  };
  profileModels: LaboratoryRecord;
  profilePresets: LaboratoryRecord;
  projects: unknown[];
  ready: boolean;
  sourcePresets: LaboratoryRecord;
  stages: string[];
  subtitleAnalysisCapabilities: LaboratoryRecord;
  subtitleAnalysisCatalog: LaboratoryRecord;
  subtitleAnalysisProviders: LaboratoryRecord;
  subtitleEditPresets: LaboratoryRecord;
  subtitleSourcePresets: LaboratoryRecord;
  subtitleYoutubeForm: LaboratoryRecord;
  toolRegistry: unknown[];
  toolState: {
    tools: LaboratoryRecord;
  };
  workbench: ReturnType<typeof createLaboratoryWorkbenchState>;
  ytDlpForm: LaboratoryRecord;
};

type LaboratoryLocalDrafts = {
  fileNameHint: string;
  urlInput: string;
  youtubeCustom: LaboratoryRecord;
  youtubePreset: unknown;
  youtubeUrl: string;
};

type LaboratoryLocalSubtitleDrafts = {
  durationMaxSeconds: number | null;
  durationMinSeconds: number | null;
  limitCount: number | null;
  liveMode: string;
  playlistItems: string;
  publishedAfter: string;
  publishedBefore: string;
  shortsMode: string;
  subtitleMode: string;
  subtitlesLang: string;
  titleExclude: string;
  titleInclude: string;
  urlInput: string;
  weekdays: string;
  youtubeUrl: string;
};

type LaboratoryManualHelperPlatform = "linux" | "macos" | "windows";

type LaboratoryUiState = {
  activeStage: string;
  context: LaboratoryUiBootstrapContext;
  locale: string;
  presentation: {
    mode: "classic";
    uiScale: number;
  };
  sourceSnapshot: LaboratorySourceSnapshot;
  translations: LaboratoryRecord | null;
  ui: {
    audioAnalysis: {
      bars: number[];
      url: string | null;
    };
    eventLog: LaboratoryShellEventLogItem[];
    eventLogOpen: boolean;
    lastActionMessage: string;
    lastRequestId: string | null;
    latestRequestByDomain: Record<LaboratoryUiRequestDomain, number>;
    localDraftProjectId: string | null;
    localDrafts: LaboratoryLocalDrafts;
    localEditDraft: unknown;
    localEditProjectId: string | null;
    localEditUpdatedAt: string | null;
    localSubtitleDraftProjectId: string | null;
    localSubtitleDrafts: LaboratoryLocalSubtitleDrafts;
    localSubtitleEditDraft: unknown;
    localSubtitleEditProjectId: string | null;
    localSubtitleEditUpdatedAt: string | null;
    overlayScrollResetPending: boolean;
    pendingDeleteProjectId: string | null;
    previewMetrics: {
      duration: number | null;
      height: number | null;
      url: string | null;
      width: number | null;
    };
    requestCounter: number;
    requestLookup: Record<string, unknown>;
    status: {
      activity: LaboratoryShellStatusChannel;
      blocking: LaboratoryShellStatusChannel;
      result: LaboratoryShellStatusChannel;
    };
    scrollPositions: {
      overlay: number;
      surface: number;
    };
    settingsHelperPlatform: LaboratoryManualHelperPlatform;
    settingsHelperToolId: string | null;
    settingsAnimateIn: boolean;
    settingsOpen: boolean;
    stackScrollPositions: {
      main: number;
      side: number;
    };
    surfaceScrollResetPending: boolean;
  };
};

type LaboratoryUiBootstrapStateRuntimeDeps = {
  documentRef: Document;
  featureId: string;
  navigatorRef: Navigator;
  resolveLocale: (value: unknown) => string;
  roomId: string;
  stageOrder: string[];
};

export function createLaboratoryUiBootstrapStateRuntime(
  deps: LaboratoryUiBootstrapStateRuntimeDeps
) {
  const roomId = deps.roomId;
  const featureId = deps.featureId;
  const stageOrder = deps.stageOrder;
  const documentRef = deps.documentRef;
  const navigatorRef = deps.navigatorRef;
  const resolveLocale = deps.resolveLocale;

  function resolveManualHelperPlatform(): LaboratoryManualHelperPlatform {
    const platform =
      typeof navigatorRef.userAgent === "string" ? navigatorRef.userAgent : navigatorRef.platform;
    const normalized = String(platform || "").toLowerCase();

    if (normalized.includes("mac")) {
      return "macos";
    }
    if (normalized.includes("win")) {
      return "windows";
    }
    return "linux";
  }

  function createContext(): LaboratoryUiBootstrapContext {
    const workbench = createLaboratoryWorkbenchState({
      activeModuleId: featureId,
    });
    return {
      room: {
        id: roomId,
        name: "Laboratory",
      },
      featureId: workbench.activeModuleId,
      user: {
        nickname: "Operator",
      },
      presentation: {
        mode: "classic",
        uiScale: 100,
      },
      workbench,
    };
  }

  function createSourceSnapshot(): LaboratorySourceSnapshot {
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
      workbench: createLaboratoryWorkbenchState({
        activeModuleId: featureId,
      }),
    };
  }

  function createLocalDrafts(): LaboratoryLocalDrafts {
    return {
      urlInput: "",
      youtubeUrl: "",
      fileNameHint: "",
      youtubePreset: null as unknown,
      youtubeCustom: {},
    };
  }

  function createSubtitleLocalDrafts(): LaboratoryLocalSubtitleDrafts {
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

  function createStatusChannel(): LaboratoryShellStatusChannel {
    return {
      detail: null,
      message: "",
      source: "system",
      sticky: false,
      updatedAt: null,
      visible: false,
    };
  }

  const state: LaboratoryUiState = {
    locale: resolveLocale(documentRef.documentElement.lang || navigatorRef.language),
    translations: null,
    context: createContext(),
    presentation: {
      mode: "classic",
      uiScale: 100,
    },
    activeStage: "source",
    sourceSnapshot: createSourceSnapshot(),
    ui: {
      settingsOpen: false,
      eventLogOpen: false,
      eventLog: [] as LaboratoryShellEventLogItem[],
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
      status: {
        blocking: createStatusChannel(),
        activity: createStatusChannel(),
        result: createStatusChannel(),
      },
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
      settingsHelperPlatform: resolveManualHelperPlatform(),
      settingsHelperToolId: null as string | null,
      settingsAnimateIn: false,
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
