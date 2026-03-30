type LaboratoryRecord = Record<string, unknown>;

type SubtitleDiscoveryListItem = {
  id: string;
  url: string | null;
  videoId: string | null;
  title: string;
  channelTitle: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isShort: boolean | null;
  liveStatus: string | null;
  subtitleLanguages: string[];
  warnings: string[];
  metadata: LaboratoryRecord;
};

type SubtitleEditRecipe = LaboratoryRecord & {
  trimWhitespace: boolean;
  collapseBlankLines: boolean;
  normalizeQuotes: boolean;
  stripHtml: boolean;
  removeMusicTags: boolean;
  mergeShortCues: boolean;
  splitLongLines: boolean;
  maxCharsPerLine: number;
  outputFormat: string;
};

type SubtitleWorkspaceDrafts = {
  urlInput: string;
  youtubeUrl: string;
  subtitleMode: string;
  subtitlesLang: string;
  publishedAfter: string;
  publishedBefore: string;
  weekdays: string;
  durationMinSeconds: number | null;
  durationMaxSeconds: number | null;
  shortsMode: string;
  liveMode: string;
  titleInclude: string;
  titleExclude: string;
  playlistItems: string;
  limitCount: number | null;
};

type SubtitleWorkspaceSelection = {
  selectedEntryIds: string[];
};

type SubtitleWorkspaceState = {
  mode: string;
  drafts: SubtitleWorkspaceDrafts;
  selection: SubtitleWorkspaceSelection;
  lastError: string | null;
  lastActionAt: string | null;
  lastImportAt: string | null;
};

type SubtitleDiscoveryState = {
  status: string;
  scope: string;
  items: SubtitleDiscoveryListItem[];
  selectedCandidateIds: string[];
  totalCandidateCount: number;
  lastError: string | null;
  lastRunAt: string | null;
  lastDownloadAt: string | null;
};

type SubtitleEditPreviewState = {
  status: string;
  entryId: string | null;
  outputText: string;
  warnings: string[];
  summary: LaboratoryRecord | null;
};

type SubtitleEditState = {
  presetId: string;
  recipe: SubtitleEditRecipe;
  preview: SubtitleEditPreviewState;
  outputs: LaboratoryRecord[];
  lastError: string | null;
  lastActionAt: string | null;
};

type SubtitleAnalysisState = {
  status: string;
  summaryCards: LaboratoryRecord[];
  findings: LaboratoryRecord[];
  warnings: string[];
  moduleResults: LaboratoryRecord;
  lastRunAt: string | null;
  sourceSelection: string;
};

type SubtitleExportState = {
  lastGeneratedAt: string | null;
  items: LaboratoryRecord[];
};

type SubtitleFeatureState = {
  workspace: SubtitleWorkspaceState;
  discovery: SubtitleDiscoveryState;
  entries: LaboratoryRecord[];
  activeEntryId: string | null;
  edit: SubtitleEditState;
  analysis: SubtitleAnalysisState;
  export: SubtitleExportState;
};

type SubtitleRuntimeRecord = LaboratoryRecord & {
  subtitleEditPresets?: unknown;
};

type SubtitleEditPresetsConfigRecord = LaboratoryRecord & {
  defaultPresetId?: unknown;
  presets?: unknown;
};

type SubtitleEditPresetRecord = LaboratoryRecord & {
  id?: unknown;
  operations?: unknown;
};

type SubtitleStateDefaultsRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  toRecord: (value: unknown) => LaboratoryRecord;
};

function toSubtitleWorkspaceDrafts(): SubtitleWorkspaceDrafts {
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

export function createSubtitleStateDefaultsRuntime(deps: SubtitleStateDefaultsRuntimeDeps) {
  const { asNonEmptyString, toRecord } = deps;

  function toRuntimeRecord(value: unknown): SubtitleRuntimeRecord {
    return toRecord(value);
  }

  function toEditPresetsConfigRecord(value: unknown): SubtitleEditPresetsConfigRecord {
    return toRecord(value);
  }

  function toEditPresetRecord(value: unknown): SubtitleEditPresetRecord {
    return toRecord(value);
  }

  function getDefaultSubtitleEditPresetId(runtime: SubtitleRuntimeRecord): string {
    const presetConfig = toEditPresetsConfigRecord(toRuntimeRecord(runtime).subtitleEditPresets);
    return asNonEmptyString(presetConfig.defaultPresetId) ?? "safe-cleanup";
  }

  function getDefaultSubtitleEditRecipe(
    runtime: SubtitleRuntimeRecord,
    presetId: string
  ): SubtitleEditRecipe {
    const presetConfig = toEditPresetsConfigRecord(toRuntimeRecord(runtime).subtitleEditPresets);
    const presets = Array.isArray(presetConfig.presets)
      ? presetConfig.presets.map(toEditPresetRecord)
      : [];
    const matchedPreset =
      presets.find(function (entry) {
        return asNonEmptyString(entry.id) === presetId;
      }) ?? null;
    const operations = matchedPreset === null ? {} : toRecord(matchedPreset.operations);

    return {
      trimWhitespace: true,
      collapseBlankLines: true,
      normalizeQuotes: false,
      stripHtml: false,
      removeMusicTags: false,
      mergeShortCues: false,
      splitLongLines: true,
      maxCharsPerLine: 42,
      outputFormat: "source",
      ...operations,
    };
  }

  function createEmptySubtitleDiscoveryState(): SubtitleDiscoveryState {
    return {
      status: "idle",
      scope: "single",
      items: [],
      selectedCandidateIds: [],
      totalCandidateCount: 0,
      lastError: null,
      lastRunAt: null,
      lastDownloadAt: null,
    };
  }

  function createEmptySubtitleAnalysisState(runtime: SubtitleRuntimeRecord): SubtitleFeatureState {
    const defaultPresetId = getDefaultSubtitleEditPresetId(runtime);

    return {
      workspace: {
        mode: "local-file",
        drafts: toSubtitleWorkspaceDrafts(),
        selection: {
          selectedEntryIds: [],
        },
        lastError: null,
        lastActionAt: null,
        lastImportAt: null,
      },
      discovery: createEmptySubtitleDiscoveryState(),
      entries: [],
      activeEntryId: null,
      edit: {
        presetId: defaultPresetId,
        recipe: getDefaultSubtitleEditRecipe(runtime, defaultPresetId),
        preview: {
          status: "idle",
          entryId: null,
          outputText: "",
          warnings: [],
          summary: null,
        },
        outputs: [],
        lastError: null,
        lastActionAt: null,
      },
      analysis: {
        status: "idle",
        summaryCards: [],
        findings: [],
        warnings: [],
        moduleResults: {},
        lastRunAt: null,
        sourceSelection: "active-entry",
      },
      export: {
        lastGeneratedAt: null,
        items: [],
      },
    };
  }

  return {
    createEmptySubtitleAnalysisState,
    createEmptySubtitleDiscoveryState,
    getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe,
  };
}
