import { createSubtitleStateDefaultsRuntime } from "./state-defaults.js";
import { createSubtitleStateNormalizationRuntime } from "./state-normalization.js";

type LaboratoryRecord = Record<string, unknown>;

type SubtitleStateDefaultsRuntimeDeps = Parameters<typeof createSubtitleStateDefaultsRuntime>[0];
type SubtitleStateNormalizationRuntimeDeps = Parameters<
  typeof createSubtitleStateNormalizationRuntime
>[0];
type SubtitleStateDefaultsRuntime = ReturnType<typeof createSubtitleStateDefaultsRuntime>;
type SubtitleStateNormalizationRuntime = ReturnType<typeof createSubtitleStateNormalizationRuntime>;

type LaboratorySubtitleFeatureStateRecord = ReturnType<
  SubtitleStateNormalizationRuntime["normalizeSubtitleAnalysisState"]
>;
type LaboratorySubtitleEntryRecord = ReturnType<
  SubtitleStateNormalizationRuntime["normalizeSubtitleEntryRecord"]
>;
type SubtitleRuntimeRecord = Parameters<
  SubtitleStateNormalizationRuntime["normalizeSubtitleAnalysisState"]
>[1];

type LaboratoryProjectRecord = LaboratoryRecord & {
  subtitleAnalysis?: unknown;
};

type SubtitleEntryCreateOptionsRecord = LaboratoryRecord & {
  durationSeconds?: unknown;
  fileName?: unknown;
  format?: unknown;
  isShort?: unknown;
  language?: unknown;
  metadata?: unknown;
  publishedAt?: unknown;
  sourceType?: unknown;
  sourceUrl?: unknown;
  warnings?: unknown;
};

type SubtitleEntryUpsertOptionsRecord = LaboratoryRecord & {
  activeEntryId?: unknown;
  mode?: unknown;
  replaceExisting?: unknown;
  selectedEntryIds?: unknown;
};

type SubtitleStateProjectRuntimeDeps = SubtitleStateDefaultsRuntimeDeps &
  SubtitleStateNormalizationRuntimeDeps & {
    markFeatureProcessStale: (
      project: LaboratoryProjectRecord,
      featureId: string,
      reason: string
    ) => unknown;
    markFeatureReportStale: (
      project: LaboratoryProjectRecord,
      featureId: string,
      reason: string
    ) => unknown;
    subtitleFeatureId: string;
  };

const EMPTY_SUBTITLE_RUNTIME: SubtitleRuntimeRecord = {};

export function createSubtitleStateProjectRuntime(deps: SubtitleStateProjectRuntimeDeps) {
  const {
    asNonEmptyString,
    asNumber,
    markFeatureProcessStale,
    markFeatureReportStale,
    normalizeStringArray,
    subtitleFeatureId,
    toRecord,
  } = deps;
  const defaultsRuntime: SubtitleStateDefaultsRuntime = createSubtitleStateDefaultsRuntime(deps);
  const normalizationRuntime: SubtitleStateNormalizationRuntime =
    createSubtitleStateNormalizationRuntime(deps);

  function toProjectRecord(value: unknown): LaboratoryProjectRecord {
    return toRecord(value);
  }

  function toEntryCreateOptionsRecord(value: unknown): SubtitleEntryCreateOptionsRecord {
    return toRecord(value);
  }

  function toEntryUpsertOptionsRecord(value: unknown): SubtitleEntryUpsertOptionsRecord {
    return toRecord(value);
  }

  function getProjectSubtitleState(
    project: LaboratoryProjectRecord,
    runtime: SubtitleRuntimeRecord
  ): LaboratorySubtitleFeatureStateRecord {
    return normalizationRuntime.normalizeSubtitleAnalysisState(project.subtitleAnalysis, runtime);
  }

  function getSubtitleEntries(project: unknown): LaboratorySubtitleEntryRecord[] {
    return getProjectSubtitleState(toProjectRecord(project), EMPTY_SUBTITLE_RUNTIME).entries;
  }

  function getSubtitleEntryById(
    project: unknown,
    entryId: unknown
  ): LaboratorySubtitleEntryRecord | null {
    const requestedId = asNonEmptyString(entryId);
    return (
      getSubtitleEntries(project).find(function (entry) {
        return requestedId !== null && entry.id === requestedId;
      }) ?? null
    );
  }

  function getActiveSubtitleEntry(project: unknown): LaboratorySubtitleEntryRecord | null {
    const subtitleState = getProjectSubtitleState(toProjectRecord(project), EMPTY_SUBTITLE_RUNTIME);
    return (
      getSubtitleEntryById(project, subtitleState.activeEntryId) ??
      getSubtitleEntries(project)[0] ??
      null
    );
  }

  function getSubtitleSelectedEntries(project: unknown): LaboratorySubtitleEntryRecord[] {
    const subtitleState = getProjectSubtitleState(toProjectRecord(project), EMPTY_SUBTITLE_RUNTIME);
    const selectedIds = subtitleState.workspace.selection.selectedEntryIds;
    const entries = getSubtitleEntries(project);

    if (selectedIds.length > 0) {
      const selectedEntries = entries.filter(function (entry) {
        return selectedIds.includes(entry.id);
      });
      if (selectedEntries.length > 0) {
        return selectedEntries;
      }
    }

    const activeEntry = getActiveSubtitleEntry(project);
    return activeEntry === null ? [] : [activeEntry];
  }

  function createSubtitleEntryRecord(
    filePath: unknown,
    options: unknown
  ): LaboratorySubtitleEntryRecord {
    const config = toEntryCreateOptionsRecord(options);
    const metadata = toRecord(config.metadata);
    const normalizedFilePath = asNonEmptyString(filePath);
    const requestedFileName = asNonEmptyString(config.fileName);
    const derivedFileName =
      normalizedFilePath === null ? null : asNonEmptyString(normalizedFilePath.split(/[\\/]/).pop());
    const fileName = requestedFileName ?? derivedFileName ?? `subtitle-${Date.now()}.srt`;

    return normalizationRuntime.normalizeSubtitleEntryRecord(
      {
        id: `subtitle-entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sourceType: asNonEmptyString(config.sourceType) ?? "local-file",
        status: "ready",
        fileName,
        path: normalizedFilePath,
        format:
          asNonEmptyString(config.format) ??
          normalizationRuntime.getSubtitleFileExtension(fileName) ??
          "srt",
        createdAt: new Date().toISOString(),
        sourceUrl: asNonEmptyString(config.sourceUrl),
        language:
          asNonEmptyString(config.language) ??
          normalizationRuntime.inferSubtitleLanguageFromFileName(fileName),
        publishedAt: asNonEmptyString(config.publishedAt),
        durationSeconds: asNumber(config.durationSeconds),
        isShort: typeof config.isShort === "boolean" ? config.isShort : null,
        warnings: Array.isArray(config.warnings) ? config.warnings.map(String) : [],
        metadata: {
          ...metadata,
          mimeType:
            asNonEmptyString(metadata["mimeType"]) ??
            normalizationRuntime.getSubtitleMimeType(fileName),
        },
      },
      0
    );
  }

  function resetSubtitleFeatureState(
    runtime: SubtitleRuntimeRecord,
    project: LaboratoryProjectRecord,
    reason: string
  ): LaboratorySubtitleFeatureStateRecord {
    const subtitleState = getProjectSubtitleState(project, runtime);
    const nextPresetId =
      asNonEmptyString(subtitleState.edit.presetId) ??
      defaultsRuntime.getDefaultSubtitleEditPresetId(runtime);

    subtitleState.edit = {
      presetId: nextPresetId,
      recipe: defaultsRuntime.getDefaultSubtitleEditRecipe(runtime, nextPresetId),
      preview: {
        status: "idle",
        entryId: null,
        outputText: "",
        warnings: [],
        summary: null,
      },
      outputs: [],
      lastError: null,
      lastActionAt: new Date().toISOString(),
    };
    subtitleState.analysis = {
      ...subtitleState.analysis,
      status: "idle",
      summaryCards: [],
      findings: [],
      warnings: [],
      moduleResults: {},
      lastRunAt: null,
    };
    subtitleState.export = {
      lastGeneratedAt: null,
      items: [],
    };
    project.subtitleAnalysis = subtitleState;
    markFeatureProcessStale(project, subtitleFeatureId, reason);
    markFeatureReportStale(project, subtitleFeatureId, reason);
    return subtitleState;
  }

  function resetSubtitleDiscovery(
    runtime: SubtitleRuntimeRecord,
    project: LaboratoryProjectRecord
  ): LaboratorySubtitleFeatureStateRecord {
    const subtitleState = getProjectSubtitleState(project, runtime);
    subtitleState.discovery = defaultsRuntime.createEmptySubtitleDiscoveryState();
    project.subtitleAnalysis = subtitleState;
    return subtitleState;
  }

  function upsertSubtitleEntries(
    runtime: SubtitleRuntimeRecord,
    project: LaboratoryProjectRecord,
    incomingEntries: unknown,
    options: unknown
  ): LaboratorySubtitleFeatureStateRecord {
    const config = toEntryUpsertOptionsRecord(options);
    const subtitleState = getProjectSubtitleState(project, runtime);
    const existingEntries = subtitleState.entries;
    const existingByPath = existingEntries.reduce<Record<string, LaboratorySubtitleEntryRecord>>(
      function (accumulator, entry) {
        if (entry.path !== null) {
          accumulator[entry.path] = entry;
        }
        return accumulator;
      },
      {}
    );
    const normalizedIncoming = Array.isArray(incomingEntries)
      ? incomingEntries
          .map(function (entry, index) {
            return normalizationRuntime.normalizeSubtitleEntryRecord(entry, index);
          })
          .filter(function (entry) {
            return entry.path !== null;
          })
      : [];
    const mergedEntries =
      config.replaceExisting === true
        ? []
        : existingEntries.filter(function (entry) {
            return (
              normalizedIncoming.some(function (incomingEntry) {
                return incomingEntry.path === entry.path;
              }) === false
            );
          });

    normalizedIncoming.forEach(function (entry) {
      const existingEntry = entry.path === null ? null : (existingByPath[entry.path] ?? null);
      mergedEntries.push(
        normalizationRuntime.normalizeSubtitleEntryRecord(
          {
            ...toRecord(existingEntry),
            ...entry,
            id: existingEntry?.id ?? entry.id,
          },
          mergedEntries.length
        )
      );
    });

    const selectedEntryIds =
      Array.isArray(config.selectedEntryIds) && config.selectedEntryIds.length > 0
        ? normalizeStringArray(config.selectedEntryIds)
        : normalizedIncoming.map(function (entry) {
            return entry.id;
          });

    subtitleState.entries = mergedEntries;
    subtitleState.activeEntryId =
      asNonEmptyString(config.activeEntryId) ??
      normalizedIncoming[0]?.id ??
      subtitleState.activeEntryId ??
      mergedEntries[0]?.id ??
      null;
    subtitleState.workspace = {
      ...subtitleState.workspace,
      mode: asNonEmptyString(config.mode) ?? subtitleState.workspace.mode,
      selection: {
        selectedEntryIds,
      },
      lastError: null,
      lastActionAt: new Date().toISOString(),
      lastImportAt: new Date().toISOString(),
    };
    project.subtitleAnalysis = subtitleState;

    resetSubtitleFeatureState(
      runtime,
      project,
      "Subtitle sources changed; rerun the subtitle analysis."
    );

    return getProjectSubtitleState(project, runtime);
  }

  return {
    createSubtitleEntryRecord,
    getActiveSubtitleEntry,
    getSubtitleEntries,
    getSubtitleEntryById,
    getSubtitleSelectedEntries,
    resetSubtitleDiscovery,
    resetSubtitleFeatureState,
    upsertSubtitleEntries,
  };
}
