import { createSubtitleStateDefaultsRuntime } from "./state-defaults.js";

type LaboratoryRecord = Record<string, unknown>;

type SubtitleEntryRecord = LaboratoryRecord & {
  id: string;
  sourceType: string;
  status: string;
  fileName: string;
  path: string | null;
  format: string;
  createdAt: string;
  sourceUrl: string | null;
  language: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  isShort: boolean | null;
  warnings: string[];
  metadata: LaboratoryRecord;
};

type SubtitleOutputRecord = LaboratoryRecord & {
  id: string;
  entryId: string | null;
  label: string | null;
  format: string;
  path: string | null;
  createdAt: string;
  summary: LaboratoryRecord | null;
};

type SubtitleDiscoveryItemRecord = LaboratoryRecord & {
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

type SubtitleWorkspaceDraftsRecord = LaboratoryRecord & {
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

type SubtitleWorkspaceSelectionRecord = {
  selectedEntryIds: string[];
};

type SubtitleWorkspaceRecord = {
  mode: string;
  drafts: SubtitleWorkspaceDraftsRecord;
  selection: SubtitleWorkspaceSelectionRecord;
  lastError: string | null;
  lastActionAt: string | null;
  lastImportAt: string | null;
};

type SubtitleDiscoveryStateRecord = {
  status: string;
  scope: string;
  items: SubtitleDiscoveryItemRecord[];
  selectedCandidateIds: string[];
  totalCandidateCount: number;
  lastError: string | null;
  lastRunAt: string | null;
  lastDownloadAt: string | null;
};

type SubtitleEditPreviewRecord = {
  status: string;
  entryId: string | null;
  outputText: string;
  warnings: string[];
  summary: LaboratoryRecord | null;
};

type SubtitleEditRecipeRecord = LaboratoryRecord;

type SubtitleEditRecord = {
  presetId: string;
  recipe: SubtitleEditRecipeRecord;
  preview: SubtitleEditPreviewRecord;
  outputs: SubtitleOutputRecord[];
  lastError: string | null;
  lastActionAt: string | null;
};

type SubtitleAnalysisRecord = {
  status: string;
  summaryCards: LaboratoryRecord[];
  findings: LaboratoryRecord[];
  warnings: string[];
  moduleResults: LaboratoryRecord;
  lastRunAt: string | null;
  sourceSelection: string;
};

type SubtitleExportRecord = {
  lastGeneratedAt: string | null;
  items: LaboratoryRecord[];
};

type SubtitleFeatureStateRecord = {
  workspace: SubtitleWorkspaceRecord;
  discovery: SubtitleDiscoveryStateRecord;
  entries: SubtitleEntryRecord[];
  activeEntryId: string | null;
  edit: SubtitleEditRecord;
  analysis: SubtitleAnalysisRecord;
  export: SubtitleExportRecord;
};

type SubtitleRuntimeRecord = LaboratoryRecord & {
  subtitleSourcePresets?: unknown;
};

type SubtitleSourcePresetsRecord = LaboratoryRecord & {
  supportedExtensions?: unknown;
};

type SubtitleEntryInputRecord = {
  createdAt?: unknown;
  durationSeconds?: unknown;
  fileName?: unknown;
  format?: unknown;
  id?: unknown;
  isShort?: unknown;
  language?: unknown;
  metadata?: unknown;
  path?: unknown;
  publishedAt?: unknown;
  sourceType?: unknown;
  sourceUrl?: unknown;
  status?: unknown;
  warnings?: unknown;
};

type SubtitleOutputInputRecord = {
  createdAt?: unknown;
  entryId?: unknown;
  fileName?: unknown;
  format?: unknown;
  id?: unknown;
  label?: unknown;
  path?: unknown;
  summary?: unknown;
};

type SubtitleDiscoveryItemInputRecord = {
  channelTitle?: unknown;
  durationSeconds?: unknown;
  id?: unknown;
  isShort?: unknown;
  liveStatus?: unknown;
  metadata?: unknown;
  publishedAt?: unknown;
  subtitleLanguages?: unknown;
  title?: unknown;
  url?: unknown;
  videoId?: unknown;
  warnings?: unknown;
};

type SubtitleWorkspaceDraftsInputRecord = {
  durationMaxSeconds?: unknown;
  durationMinSeconds?: unknown;
  limitCount?: unknown;
  liveMode?: unknown;
  playlistItems?: unknown;
  publishedAfter?: unknown;
  publishedBefore?: unknown;
  shortsMode?: unknown;
  subtitleMode?: unknown;
  subtitlesLang?: unknown;
  titleExclude?: unknown;
  titleInclude?: unknown;
  urlInput?: unknown;
  weekdays?: unknown;
  youtubeUrl?: unknown;
};

type SubtitleWorkspaceSelectionInputRecord = {
  selectedEntryIds?: unknown;
};

type SubtitleWorkspaceInputRecord = {
  drafts?: unknown;
  lastActionAt?: unknown;
  lastError?: unknown;
  lastImportAt?: unknown;
  mode?: unknown;
  selection?: unknown;
};

type SubtitleDiscoveryStateInputRecord = {
  items?: unknown;
  lastDownloadAt?: unknown;
  lastError?: unknown;
  lastRunAt?: unknown;
  scope?: unknown;
  selectedCandidateIds?: unknown;
  status?: unknown;
  totalCandidateCount?: unknown;
};

type SubtitleEditPreviewInputRecord = {
  entryId?: unknown;
  outputText?: unknown;
  status?: unknown;
  summary?: unknown;
  warnings?: unknown;
};

type SubtitleEditInputRecord = {
  lastActionAt?: unknown;
  lastError?: unknown;
  outputs?: unknown;
  presetId?: unknown;
  preview?: unknown;
  recipe?: unknown;
};

type SubtitleAnalysisInputRecord = {
  findings?: unknown;
  lastRunAt?: unknown;
  moduleResults?: unknown;
  sourceSelection?: unknown;
  status?: unknown;
  summaryCards?: unknown;
  warnings?: unknown;
};

type SubtitleExportInputRecord = {
  items?: unknown;
  lastGeneratedAt?: unknown;
};

type SubtitleFeatureStateInputRecord = {
  activeEntryId?: unknown;
  analysis?: unknown;
  discovery?: unknown;
  edit?: unknown;
  entries?: unknown;
  export?: unknown;
  workspace?: unknown;
};

type SubtitleStateNormalizationRuntimeDeps = {
  asNonEmptyString: (value: unknown) => string | null;
  asNumber: (value: unknown) => number | null;
  normalizeReportExport: (rawValue: unknown) => LaboratoryRecord;
  normalizeStringArray: (value: unknown) => string[];
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createSubtitleStateNormalizationRuntime(
  deps: SubtitleStateNormalizationRuntimeDeps
) {
  const { asNonEmptyString, asNumber, normalizeReportExport, normalizeStringArray, toRecord } =
    deps;
  const defaultsRuntime = createSubtitleStateDefaultsRuntime(deps);

  function toRuntimeRecord(value: unknown): SubtitleRuntimeRecord {
    return toRecord(value);
  }

  function toSourcePresetsRecord(value: unknown): SubtitleSourcePresetsRecord {
    return toRecord(value);
  }

  function toSubtitleEntryInputRecord(value: unknown): SubtitleEntryInputRecord {
    return toRecord(value) as SubtitleEntryInputRecord;
  }

  function toSubtitleOutputInputRecord(value: unknown): SubtitleOutputInputRecord {
    return toRecord(value) as SubtitleOutputInputRecord;
  }

  function toSubtitleDiscoveryItemInputRecord(value: unknown): SubtitleDiscoveryItemInputRecord {
    return toRecord(value) as SubtitleDiscoveryItemInputRecord;
  }

  function toSubtitleWorkspaceDraftsInputRecord(
    value: unknown
  ): SubtitleWorkspaceDraftsInputRecord {
    return toRecord(value) as SubtitleWorkspaceDraftsInputRecord;
  }

  function toSubtitleWorkspaceSelectionInputRecord(
    value: unknown
  ): SubtitleWorkspaceSelectionInputRecord {
    return toRecord(value) as SubtitleWorkspaceSelectionInputRecord;
  }

  function toSubtitleWorkspaceInputRecord(value: unknown): SubtitleWorkspaceInputRecord {
    return toRecord(value) as SubtitleWorkspaceInputRecord;
  }

  function toSubtitleDiscoveryStateInputRecord(value: unknown): SubtitleDiscoveryStateInputRecord {
    return toRecord(value) as SubtitleDiscoveryStateInputRecord;
  }

  function toSubtitleEditPreviewInputRecord(value: unknown): SubtitleEditPreviewInputRecord {
    return toRecord(value) as SubtitleEditPreviewInputRecord;
  }

  function toSubtitleEditInputRecord(value: unknown): SubtitleEditInputRecord {
    return toRecord(value) as SubtitleEditInputRecord;
  }

  function toSubtitleAnalysisInputRecord(value: unknown): SubtitleAnalysisInputRecord {
    return toRecord(value) as SubtitleAnalysisInputRecord;
  }

  function toSubtitleExportInputRecord(value: unknown): SubtitleExportInputRecord {
    return toRecord(value) as SubtitleExportInputRecord;
  }

  function toSubtitleFeatureStateInputRecord(value: unknown): SubtitleFeatureStateInputRecord {
    return toRecord(value) as SubtitleFeatureStateInputRecord;
  }

  function toNonEmptyRecord(value: unknown): LaboratoryRecord | null {
    const record = toRecord(value);
    return Object.keys(record).length > 0 ? record : null;
  }

  function getSubtitleSupportedExtensions(runtime: SubtitleRuntimeRecord): string[] {
    const sourcePresets = toSourcePresetsRecord(toRuntimeRecord(runtime).subtitleSourcePresets);
    const configured = Array.isArray(sourcePresets.supportedExtensions)
      ? sourcePresets.supportedExtensions
          .map(function (entry) {
            return String(entry ?? "")
              .toLowerCase()
              .replace(/^\./, "");
          })
          .filter(function (entry) {
            return entry.length > 0;
          })
      : [];
    return configured.length > 0 ? configured : ["srt", "vtt", "ass", "ssa"];
  }

  function getSubtitleFileExtension(fileName: unknown): string | null {
    const normalized = asNonEmptyString(fileName);
    if (normalized === null || normalized.indexOf(".") === -1) {
      return null;
    }
    return normalized.split(".").pop()?.toLowerCase() ?? null;
  }

  function getSubtitleMimeType(fileName: unknown): string {
    const extension = getSubtitleFileExtension(fileName);
    if (extension === "vtt") {
      return "text/vtt";
    }
    if (extension === "ass" || extension === "ssa") {
      return "text/x-ass";
    }
    return "application/x-subrip";
  }

  function isSubtitleFileName(runtime: SubtitleRuntimeRecord, fileName: unknown): boolean {
    const extension = getSubtitleFileExtension(fileName);
    return extension !== null && getSubtitleSupportedExtensions(runtime).includes(extension);
  }

  function inferSubtitleLanguageFromFileName(fileName: unknown): string | null {
    const normalized = asNonEmptyString(fileName);
    if (normalized === null) {
      return null;
    }

    const match = normalized.match(/\.([a-z]{2,3}(?:-[a-z0-9]+)?)\.(srt|vtt|ass|ssa)$/i);
    return match ? String(match[1]).toLowerCase() : null;
  }

  function normalizeSubtitleEntryRecord(rawValue: unknown, index: number): SubtitleEntryRecord {
    const record = toSubtitleEntryInputRecord(rawValue);
    return {
      id: asNonEmptyString(record.id) ?? `subtitle-entry-${Date.now()}-${index}`,
      sourceType: asNonEmptyString(record.sourceType) ?? "local-file",
      status: asNonEmptyString(record.status) ?? "ready",
      fileName: asNonEmptyString(record.fileName) ?? `subtitle-${index + 1}.srt`,
      path: asNonEmptyString(record.path),
      format: asNonEmptyString(record.format) ?? getSubtitleFileExtension(record.fileName) ?? "srt",
      createdAt: asNonEmptyString(record.createdAt) ?? new Date().toISOString(),
      sourceUrl: asNonEmptyString(record.sourceUrl),
      language:
        asNonEmptyString(record.language) ?? inferSubtitleLanguageFromFileName(record.fileName),
      publishedAt: asNonEmptyString(record.publishedAt),
      durationSeconds: asNumber(record.durationSeconds),
      isShort: typeof record.isShort === "boolean" ? record.isShort : null,
      warnings: Array.isArray(record.warnings) ? record.warnings.map(String) : [],
      metadata: toRecord(record.metadata),
    };
  }

  function normalizeSubtitleOutputRecord(rawValue: unknown, index: number): SubtitleOutputRecord {
    const record = toSubtitleOutputInputRecord(rawValue);
    const summaryRecord = toNonEmptyRecord(record.summary);

    return {
      id: asNonEmptyString(record.id) ?? `subtitle-output-${Date.now()}-${index}`,
      entryId: asNonEmptyString(record.entryId),
      label: asNonEmptyString(record.label),
      format:
        asNonEmptyString(record.format) ??
        getSubtitleFileExtension(record.path ?? record.fileName) ??
        "srt",
      path: asNonEmptyString(record.path),
      createdAt: asNonEmptyString(record.createdAt) ?? new Date().toISOString(),
      summary: summaryRecord,
    };
  }

  function normalizeSubtitleDiscoveryItem(
    rawValue: unknown,
    index: number
  ): SubtitleDiscoveryItemRecord {
    const record = toSubtitleDiscoveryItemInputRecord(rawValue);
    return {
      id: asNonEmptyString(record.id) ?? `subtitle-discovery-${Date.now()}-${index}`,
      url: asNonEmptyString(record.url),
      videoId: asNonEmptyString(record.videoId),
      title: asNonEmptyString(record.title) ?? `Subtitle candidate ${index + 1}`,
      channelTitle: asNonEmptyString(record.channelTitle),
      publishedAt: asNonEmptyString(record.publishedAt),
      durationSeconds: asNumber(record.durationSeconds),
      isShort: typeof record.isShort === "boolean" ? record.isShort : null,
      liveStatus: asNonEmptyString(record.liveStatus),
      subtitleLanguages: Array.isArray(record.subtitleLanguages)
        ? record.subtitleLanguages.map(String)
        : [],
      warnings: Array.isArray(record.warnings) ? record.warnings.map(String) : [],
      metadata: toRecord(record.metadata),
    };
  }

  function normalizeSubtitleAnalysisState(
    rawValue: unknown,
    runtime: SubtitleRuntimeRecord
  ): SubtitleFeatureStateRecord {
    const source = toSubtitleFeatureStateInputRecord(rawValue);
    const defaults = defaultsRuntime.createEmptySubtitleAnalysisState(runtime);
    const workspace = toSubtitleWorkspaceInputRecord(source.workspace);
    const workspaceDrafts = toSubtitleWorkspaceDraftsInputRecord(workspace.drafts);
    const selection = toSubtitleWorkspaceSelectionInputRecord(workspace.selection);
    const discovery = toSubtitleDiscoveryStateInputRecord(source.discovery);
    const edit = toSubtitleEditInputRecord(source.edit);
    const editPreview = toSubtitleEditPreviewInputRecord(edit.preview);
    const analysis = toSubtitleAnalysisInputRecord(source.analysis);
    const exportState = toSubtitleExportInputRecord(source.export);
    const defaultPresetId = asNonEmptyString(edit.presetId) ?? defaults.edit.presetId;
    const previewSummary = toNonEmptyRecord(editPreview.summary);

    return {
      workspace: {
        mode: asNonEmptyString(workspace.mode) ?? defaults.workspace.mode,
        drafts: {
          ...defaults.workspace.drafts,
          ...workspaceDrafts,
          urlInput: asNonEmptyString(workspaceDrafts.urlInput) ?? "",
          youtubeUrl: asNonEmptyString(workspaceDrafts.youtubeUrl) ?? "",
          subtitleMode:
            asNonEmptyString(workspaceDrafts.subtitleMode) ??
            defaults.workspace.drafts.subtitleMode,
          subtitlesLang:
            asNonEmptyString(workspaceDrafts.subtitlesLang) ??
            defaults.workspace.drafts.subtitlesLang,
          publishedAfter: asNonEmptyString(workspaceDrafts.publishedAfter) ?? "",
          publishedBefore: asNonEmptyString(workspaceDrafts.publishedBefore) ?? "",
          weekdays: asNonEmptyString(workspaceDrafts.weekdays) ?? "",
          durationMinSeconds: asNumber(workspaceDrafts.durationMinSeconds),
          durationMaxSeconds: asNumber(workspaceDrafts.durationMaxSeconds),
          shortsMode:
            asNonEmptyString(workspaceDrafts.shortsMode) ?? defaults.workspace.drafts.shortsMode,
          liveMode:
            asNonEmptyString(workspaceDrafts.liveMode) ?? defaults.workspace.drafts.liveMode,
          titleInclude: asNonEmptyString(workspaceDrafts.titleInclude) ?? "",
          titleExclude: asNonEmptyString(workspaceDrafts.titleExclude) ?? "",
          playlistItems: asNonEmptyString(workspaceDrafts.playlistItems) ?? "",
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
        status: asNonEmptyString(discovery.status) ?? defaults.discovery.status,
        scope: asNonEmptyString(discovery.scope) ?? defaults.discovery.scope,
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
          status: asNonEmptyString(editPreview.status) ?? defaults.edit.preview.status,
          entryId: asNonEmptyString(editPreview.entryId),
          outputText: asNonEmptyString(editPreview.outputText) ?? "",
          warnings: Array.isArray(editPreview.warnings) ? editPreview.warnings.map(String) : [],
          summary: previewSummary,
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
        status: asNonEmptyString(analysis.status) ?? defaults.analysis.status,
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
        sourceSelection:
          asNonEmptyString(analysis.sourceSelection) ?? defaults.analysis.sourceSelection,
      },
      export: {
        lastGeneratedAt: asNonEmptyString(exportState.lastGeneratedAt),
        items: Array.isArray(exportState.items) ? exportState.items.map(normalizeReportExport) : [],
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
