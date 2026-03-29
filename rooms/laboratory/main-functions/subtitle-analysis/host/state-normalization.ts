import { createSubtitleStateDefaultsRuntime } from "./state-defaults.js";

export function createSubtitleStateNormalizationRuntime(deps) {
  const {
    asNonEmptyString,
    asNumber,
    normalizeReportExport,
    normalizeStringArray,
    toRecord,
  } = deps;
  const defaultsRuntime = createSubtitleStateDefaultsRuntime(deps);

  function getSubtitleSupportedExtensions(runtime) {
    const configured = Array.isArray(toRecord(runtime.subtitleSourcePresets).supportedExtensions)
      ? toRecord(runtime.subtitleSourcePresets).supportedExtensions
          .map(function (entry) {
            return String(entry || "").toLowerCase().replace(/^\./, "");
          })
          .filter(Boolean)
      : [];
    return configured.length > 0 ? configured : ["srt", "vtt", "ass", "ssa"];
  }

  function getSubtitleFileExtension(fileName) {
    const normalized = asNonEmptyString(fileName);
    if (normalized === null || normalized.indexOf(".") === -1) {
      return null;
    }
    return normalized.split(".").pop().toLowerCase();
  }

  function getSubtitleMimeType(fileName) {
    const extension = getSubtitleFileExtension(fileName);
    if (extension === "vtt") {
      return "text/vtt";
    }
    if (extension === "ass" || extension === "ssa") {
      return "text/x-ass";
    }
    return "application/x-subrip";
  }

  function isSubtitleFileName(runtime, fileName) {
    const extension = getSubtitleFileExtension(fileName);
    return extension !== null && getSubtitleSupportedExtensions(runtime).includes(extension);
  }

  function inferSubtitleLanguageFromFileName(fileName) {
    const normalized = asNonEmptyString(fileName);
    if (normalized === null) {
      return null;
    }

    const match = normalized.match(/\.([a-z]{2,3}(?:-[a-z0-9]+)?)\.(srt|vtt|ass|ssa)$/i);
    return match ? String(match[1]).toLowerCase() : null;
  }

  function normalizeSubtitleEntryRecord(rawValue, index) {
    const record = toRecord(rawValue);
    return {
      id: asNonEmptyString(record.id) || `subtitle-entry-${Date.now()}-${index}`,
      sourceType: asNonEmptyString(record.sourceType) || "local-file",
      status: asNonEmptyString(record.status) || "ready",
      fileName: asNonEmptyString(record.fileName) || `subtitle-${index + 1}.srt`,
      path: asNonEmptyString(record.path),
      format: asNonEmptyString(record.format) || getSubtitleFileExtension(record.fileName) || "srt",
      createdAt: asNonEmptyString(record.createdAt) || new Date().toISOString(),
      sourceUrl: asNonEmptyString(record.sourceUrl),
      language: asNonEmptyString(record.language) || inferSubtitleLanguageFromFileName(record.fileName),
      publishedAt: asNonEmptyString(record.publishedAt),
      durationSeconds: asNumber(record.durationSeconds),
      isShort: typeof record.isShort === "boolean" ? record.isShort : null,
      warnings: Array.isArray(record.warnings) ? record.warnings.map(String) : [],
      metadata: toRecord(record.metadata),
    };
  }

  function normalizeSubtitleOutputRecord(rawValue, index) {
    const record = toRecord(rawValue);
    return {
      id: asNonEmptyString(record.id) || `subtitle-output-${Date.now()}-${index}`,
      entryId: asNonEmptyString(record.entryId),
      label: asNonEmptyString(record.label),
      format: asNonEmptyString(record.format) || getSubtitleFileExtension(record.path || record.fileName) || "srt",
      path: asNonEmptyString(record.path),
      createdAt: asNonEmptyString(record.createdAt) || new Date().toISOString(),
      summary:
        toRecord(record.summary) && Object.keys(toRecord(record.summary)).length > 0
          ? toRecord(record.summary)
          : null,
    };
  }

  function normalizeSubtitleDiscoveryItem(rawValue, index) {
    const record = toRecord(rawValue);
    return {
      id: asNonEmptyString(record.id) || `subtitle-discovery-${Date.now()}-${index}`,
      url: asNonEmptyString(record.url),
      videoId: asNonEmptyString(record.videoId),
      title: asNonEmptyString(record.title) || `Subtitle candidate ${index + 1}`,
      channelTitle: asNonEmptyString(record.channelTitle),
      publishedAt: asNonEmptyString(record.publishedAt),
      durationSeconds: asNumber(record.durationSeconds),
      isShort: typeof record.isShort === "boolean" ? record.isShort : null,
      liveStatus: asNonEmptyString(record.liveStatus),
      subtitleLanguages: Array.isArray(record.subtitleLanguages) ? record.subtitleLanguages.map(String) : [],
      warnings: Array.isArray(record.warnings) ? record.warnings.map(String) : [],
      metadata: toRecord(record.metadata),
    };
  }

  function normalizeSubtitleAnalysisState(rawValue, runtime) {
    const source = toRecord(rawValue);
    const defaults = defaultsRuntime.createEmptySubtitleAnalysisState(runtime);
    const workspace = toRecord(source.workspace);
    const workspaceDrafts = toRecord(workspace.drafts);
    const selection = toRecord(workspace.selection);
    const discovery = toRecord(source.discovery);
    const edit = toRecord(source.edit);
    const editPreview = toRecord(edit.preview);
    const analysis = toRecord(source.analysis);
    const defaultPresetId = asNonEmptyString(edit.presetId) || defaults.edit.presetId;

    return {
      workspace: {
        mode: asNonEmptyString(workspace.mode) || defaults.workspace.mode,
        drafts: {
          ...defaults.workspace.drafts,
          ...workspaceDrafts,
          urlInput: asNonEmptyString(workspaceDrafts.urlInput) || "",
          youtubeUrl: asNonEmptyString(workspaceDrafts.youtubeUrl) || "",
          subtitleMode: asNonEmptyString(workspaceDrafts.subtitleMode) || defaults.workspace.drafts.subtitleMode,
          subtitlesLang: asNonEmptyString(workspaceDrafts.subtitlesLang) || defaults.workspace.drafts.subtitlesLang,
          publishedAfter: asNonEmptyString(workspaceDrafts.publishedAfter) || "",
          publishedBefore: asNonEmptyString(workspaceDrafts.publishedBefore) || "",
          weekdays: asNonEmptyString(workspaceDrafts.weekdays) || "",
          durationMinSeconds: asNumber(workspaceDrafts.durationMinSeconds),
          durationMaxSeconds: asNumber(workspaceDrafts.durationMaxSeconds),
          shortsMode: asNonEmptyString(workspaceDrafts.shortsMode) || defaults.workspace.drafts.shortsMode,
          liveMode: asNonEmptyString(workspaceDrafts.liveMode) || defaults.workspace.drafts.liveMode,
          titleInclude: asNonEmptyString(workspaceDrafts.titleInclude) || "",
          titleExclude: asNonEmptyString(workspaceDrafts.titleExclude) || "",
          playlistItems: asNonEmptyString(workspaceDrafts.playlistItems) || "",
          limitCount: asNumber(workspaceDrafts.limitCount),
        },
        selection: {
          selectedEntryIds: normalizeStringArray(selection.selectedEntryIds),
        },
        lastError: asNonEmptyString(workspace.lastError),
        lastActionAt: asNonEmptyString(workspace.lastActionAt),
        lastImportAt: asNonEmptyString(workspace.lastImportAt),
      },
      discovery: {
        status: asNonEmptyString(discovery.status) || defaults.discovery.status,
        scope: asNonEmptyString(discovery.scope) || defaults.discovery.scope,
        items: Array.isArray(discovery.items)
          ? discovery.items.map(function (entry, index) {
              return normalizeSubtitleDiscoveryItem(entry, index);
            })
          : [],
        selectedCandidateIds: normalizeStringArray(discovery.selectedCandidateIds),
        totalCandidateCount:
          typeof discovery.totalCandidateCount === "number"
            ? discovery.totalCandidateCount
            : defaults.discovery.totalCandidateCount,
        lastError: asNonEmptyString(discovery.lastError),
        lastRunAt: asNonEmptyString(discovery.lastRunAt),
        lastDownloadAt: asNonEmptyString(discovery.lastDownloadAt),
      },
      entries: Array.isArray(source.entries)
        ? source.entries.map(function (entry, index) {
            return normalizeSubtitleEntryRecord(entry, index);
          })
        : [],
      activeEntryId: asNonEmptyString(source.activeEntryId),
      edit: {
        presetId: defaultPresetId,
        recipe: {
          ...defaultsRuntime.getDefaultSubtitleEditRecipe(runtime, defaultPresetId),
          ...toRecord(edit.recipe),
        },
        preview: {
          status: asNonEmptyString(editPreview.status) || defaults.edit.preview.status,
          entryId: asNonEmptyString(editPreview.entryId),
          outputText: asNonEmptyString(editPreview.outputText) || "",
          warnings: Array.isArray(editPreview.warnings) ? editPreview.warnings.map(String) : [],
          summary:
            toRecord(editPreview.summary) && Object.keys(toRecord(editPreview.summary)).length > 0
              ? toRecord(editPreview.summary)
              : null,
        },
        outputs: Array.isArray(edit.outputs)
          ? edit.outputs.map(function (entry, index) {
              return normalizeSubtitleOutputRecord(entry, index);
            })
          : [],
        lastError: asNonEmptyString(edit.lastError),
        lastActionAt: asNonEmptyString(edit.lastActionAt),
      },
      analysis: {
        status: asNonEmptyString(analysis.status) || defaults.analysis.status,
        summaryCards: Array.isArray(analysis.summaryCards)
          ? analysis.summaryCards.map(function (entry) {
              return toRecord(entry);
            })
          : [],
        findings: Array.isArray(analysis.findings)
          ? analysis.findings.map(function (entry) {
              return toRecord(entry);
            })
          : [],
        warnings: Array.isArray(analysis.warnings) ? analysis.warnings.map(String) : [],
        moduleResults: toRecord(analysis.moduleResults),
        lastRunAt: asNonEmptyString(analysis.lastRunAt),
        sourceSelection: asNonEmptyString(analysis.sourceSelection) || defaults.analysis.sourceSelection,
      },
      export: {
        lastGeneratedAt: asNonEmptyString(toRecord(source.export).lastGeneratedAt),
        items: Array.isArray(toRecord(source.export).items)
          ? toRecord(source.export).items.map(normalizeReportExport)
          : [],
      },
    };
  }

  return {
    getSubtitleFileExtension,
    getSubtitleMimeType,
    getSubtitleSupportedExtensions,
    inferSubtitleLanguageFromFileName,
    isSubtitleFileName,
    normalizeSubtitleAnalysisState,
    normalizeSubtitleDiscoveryItem,
    normalizeSubtitleEntryRecord,
    normalizeSubtitleOutputRecord,
  };
}
