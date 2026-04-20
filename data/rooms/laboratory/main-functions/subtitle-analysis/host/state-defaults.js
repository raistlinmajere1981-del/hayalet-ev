function toSubtitleWorkspaceDrafts() {
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
    limitCount: null
  };
}
export function createSubtitleStateDefaultsRuntime(deps) {
  const { asNonEmptyString, toRecord } = deps;
  function toRuntimeRecord(value) {
    return toRecord(value);
  }
  function toEditPresetsConfigRecord(value) {
    return toRecord(value);
  }
  function toEditPresetRecord(value) {
    return toRecord(value);
  }
  function getDefaultSubtitleEditPresetId(runtime) {
    const presetConfig = toEditPresetsConfigRecord(toRuntimeRecord(runtime).subtitleEditPresets);
    return asNonEmptyString(presetConfig.defaultPresetId) ?? "safe-cleanup";
  }
  function getDefaultSubtitleEditRecipe(runtime, presetId) {
    const presetConfig = toEditPresetsConfigRecord(toRuntimeRecord(runtime).subtitleEditPresets);
    const presets = Array.isArray(presetConfig.presets) ? presetConfig.presets.map(toEditPresetRecord) : [];
    const matchedPreset = presets.find(function(entry) {
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
      ...operations
    };
  }
  function createEmptySubtitleDiscoveryState() {
    return {
      status: "idle",
      scope: "single",
      items: [],
      selectedCandidateIds: [],
      totalCandidateCount: 0,
      lastError: null,
      lastRunAt: null,
      lastDownloadAt: null
    };
  }
  function createEmptySubtitleAnalysisState(runtime) {
    const defaultPresetId = getDefaultSubtitleEditPresetId(runtime);
    return {
      workspace: {
        mode: "local-file",
        drafts: toSubtitleWorkspaceDrafts(),
        selection: {
          selectedEntryIds: []
        },
        lastError: null,
        lastActionAt: null,
        lastImportAt: null
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
          summary: null
        },
        outputs: [],
        lastError: null,
        lastActionAt: null
      },
      analysis: {
        status: "idle",
        summaryCards: [],
        findings: [],
        warnings: [],
        moduleResults: {},
        lastRunAt: null,
        sourceSelection: "active-entry"
      },
      export: {
        lastGeneratedAt: null,
        items: []
      }
    };
  }
  return {
    createEmptySubtitleAnalysisState,
    createEmptySubtitleDiscoveryState,
    getDefaultSubtitleEditPresetId,
    getDefaultSubtitleEditRecipe
  };
}
