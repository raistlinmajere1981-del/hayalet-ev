/** Matches `normalizeSubtitleDiscoveryItem` output in state-normalization. */
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
  metadata: Record<string, unknown>;
};

export function createSubtitleStateDefaultsRuntime(deps: any) {
  const { asNonEmptyString, toRecord } = deps;

  function getDefaultSubtitleEditPresetId(runtime: any) {
    return (
      asNonEmptyString(toRecord(runtime.subtitleEditPresets).defaultPresetId) || "safe-cleanup"
    );
  }

  function getDefaultSubtitleEditRecipe(runtime: any, presetId: any) {
    const presets = Array.isArray(toRecord(runtime.subtitleEditPresets).presets)
      ? toRecord(runtime.subtitleEditPresets).presets.map(toRecord)
      : [];
    const matchedPreset =
      presets.find(function (entry: any) {
        return asNonEmptyString(entry.id) === presetId;
      }) || {};

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
      ...toRecord(matchedPreset.operations),
    };
  }

  function createEmptySubtitleDiscoveryState() {
    return {
      status: "idle",
      scope: "single",
      items: [] as SubtitleDiscoveryListItem[],
      selectedCandidateIds: [] as string[],
      totalCandidateCount: 0,
      lastError: null as string | null,
      lastRunAt: null as string | null,
      lastDownloadAt: null as string | null,
    };
  }

  function createEmptySubtitleAnalysisState(runtime: any) {
    const defaultPresetId = getDefaultSubtitleEditPresetId(runtime || {});
    return {
      workspace: {
        mode: "local-file",
        drafts: {
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
        },
        selection: {
          selectedEntryIds: [] as string[],
        },
        lastError: null as string | null,
        lastActionAt: null as string | null,
        lastImportAt: null as string | null,
      },
      discovery: createEmptySubtitleDiscoveryState(),
      entries: [] as unknown[],
      activeEntryId: null as string | null,
      edit: {
        presetId: defaultPresetId,
        recipe: getDefaultSubtitleEditRecipe(runtime || {}, defaultPresetId),
        preview: {
          status: "idle",
          entryId: null as string | null,
          outputText: "",
          warnings: [] as unknown[],
          summary: null as unknown,
        },
        outputs: [] as unknown[],
        lastError: null as string | null,
        lastActionAt: null as string | null,
      },
      analysis: {
        status: "idle",
        summaryCards: [] as unknown[],
        findings: [] as unknown[],
        warnings: [] as unknown[],
        moduleResults: {},
        lastRunAt: null as string | null,
        sourceSelection: "active-entry",
      },
      export: {
        lastGeneratedAt: null as string | null,
        items: [] as unknown[],
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
